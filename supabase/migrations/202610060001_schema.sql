-- Run migrations in filename order in the Supabase SQL editor.
-- gen_random_uuid() is built into the PostgreSQL version used by Supabase.
create table public.permission_catalog (key text primary key, group_name text not null);
insert into public.permission_catalog(key,group_name) select g||'.'||p,g from (values
 ('home',array['view','revenue','profit','expenses','analytics']),
 ('sales',array['view','create','details','price','profit','receipt']),
 ('purchases',array['view','create','edit','delete','cost']),
 ('inventory',array['view','details','cost','edit','delete']),
 ('expenses',array['view','create','edit','delete']),
 ('users',array['view','create','edit','disable','permissions']),
 ('settings',array['view','edit'])) x(g,ps) cross join unnest(ps) p;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z][a-z0-9_]{2,29}$'),
 email text not null unique, role text not null default 'Staff',
 active boolean not null default true, must_change_password boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.user_permissions (
 user_id uuid references public.profiles(id) on delete cascade,
 permission text references public.permission_catalog(key), primary key(user_id,permission)
);
create table public.shop_settings (
 id boolean primary key default true check(id), name text not null default 'Aminzi Phone Shop',
 phone text not null default '', address text not null default '', logo text not null default '',
 primary_color text not null default '#319dea' check(primary_color ~ '^#[0-9A-Fa-f]{6}$'),
 accent_color text not null default '#12bdd0' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
 currency text not null default 'AFN' check(currency='AFN'), receipt_note text not null default 'Thank you for shopping with us.',
 updated_at timestamptz not null default now()
);
insert into public.shop_settings(id) values(true);
create table public.product_types (key text primary key, serialized boolean not null);
insert into public.product_types values ('phone',true),('accessory',false),('other',false);
create table public.conditions (key text primary key);
insert into public.conditions values ('new'),('used');
create table public.products (
 id uuid primary key default gen_random_uuid(), type text not null references public.product_types(key),
 name text not null check(length(trim(name))>0), brand text not null default '', category text not null default ''
);
create table public.purchases (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 unit_cost numeric(14,2) not null check(unit_cost>=0), quantity integer not null check(quantity>0),
 date timestamptz not null default now(), notes text not null default '', created_by uuid not null references public.profiles(id)
);
create table public.inventory (
 id uuid primary key default gen_random_uuid(), purchase_id uuid not null unique references public.purchases(id),
 quantity integer not null check(quantity>=0), imei1 text, imei2 text,
 color text not null default '', storage text not null default '', ram text not null default '',
 condition text not null default 'new' references public.conditions(key),
 battery_health integer check(battery_health between 0 and 100), physical_condition text not null default '',
 check(imei1 is null or imei1 ~ '^[0-9]{15}$'), check(imei2 is null or imei2 ~ '^[0-9]{15}$'),
 check(imei1 is null or imei2 is null or imei1<>imei2)
);
-- One global registry prevents duplicates across either IMEI slot.
create table public.inventory_imeis (imei text primary key, inventory_id uuid not null references public.inventory(id) on delete cascade);
create function public.sync_imeis() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 delete from inventory_imeis where inventory_id=new.id;
 if new.imei1 is not null then insert into inventory_imeis values(new.imei1,new.id); end if;
 if new.imei2 is not null then insert into inventory_imeis values(new.imei2,new.id); end if;
 return new;
end $$;
create trigger inventory_imei_registry after insert or update of imei1,imei2 on public.inventory for each row execute function public.sync_imeis();
create table public.sales (
 id uuid primary key default gen_random_uuid(), invoice bigint generated always as identity unique,
 date timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 payment_method text not null default 'cash' check(payment_method='cash'),
 shop_snapshot jsonb not null
);
create table public.sale_items (
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id),
 inventory_id uuid not null references public.inventory(id), snapshot jsonb not null,
 quantity integer not null check(quantity>0), unit_price numeric(14,2) not null check(unit_price>=0),
 unit_cost numeric(14,2) not null check(unit_cost>=0),
 profit numeric(16,2) generated always as ((unit_price-unit_cost)*quantity) stored
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(), amount numeric(14,2) not null check(amount>0),
 reason text not null check(length(trim(reason))>0), date timestamptz not null default now(),
 created_by uuid not null references public.profiles(id)
);
create index products_search on public.products(lower(name),lower(brand));
create index purchases_date on public.purchases(date desc);
create index sales_date on public.sales(date desc);
create index expenses_date on public.expenses(date desc);
create index sale_items_inventory on public.sale_items(inventory_id);
create index sale_items_sale on public.sale_items(sale_id);
create index permissions_user on public.user_permissions(user_id);
-- No raw table access is granted to API clients. All data passes through redacting RPCs.
do $$ declare t text; begin
 foreach t in array array['permission_catalog','profiles','user_permissions','shop_settings','product_types','conditions','products','purchases','inventory','inventory_imeis','sales','sale_items','expenses'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
create function public.has_permission(p_key text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from profiles p join user_permissions u on u.user_id=p.id where p.id=auth.uid() and p.active and not p.must_change_password and u.permission=p_key)
$$;
create function public.require_permission(p_key text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin if not has_permission(p_key) then raise exception 'Permission denied: %',p_key using errcode='42501'; end if; end $$;
-- A real auth password change clears the first-login gate. Profile updates cannot bypass it.
create function public.password_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin if new.encrypted_password is distinct from old.encrypted_password then update profiles set must_change_password=false where id=new.id; end if; return new; end $$;
create trigger shop_password_changed after update of encrypted_password on auth.users for each row execute function public.password_changed();
revoke execute on function public.sync_imeis(),public.has_permission(text),public.require_permission(text),public.password_changed() from public,anon,authenticated;
grant execute on function public.has_permission(text) to authenticated;

