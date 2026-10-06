-- COMPLETE MIGRATIONS: run once in a fresh Supabase project's SQL Editor.
-- Do not also run the individual migration files.
begin;

-- 202610060001_schema.sql
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

-- 202610060002_operations.sql
create function public.inventory_record(p_id uuid, p_cost boolean default false) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',i.id,'purchase_id',pu.id,'product_id',p.id,'type',p.type,'name',p.name,'brand',p.brand,'category',p.category,'quantity',i.quantity,'imei1',i.imei1,'imei2',i.imei2,'color',i.color,'storage',i.storage,'ram',i.ram,'condition',i.condition,'battery_health',i.battery_health,'physical_condition',i.physical_condition,'status',case when i.quantity>0 then 'available' else 'sold' end,'date',pu.date,'notes',pu.notes,'original_quantity',pu.quantity,'added_by',pr.username) || case when p_cost then jsonb_build_object('unit_cost',pu.unit_cost) else '{}'::jsonb end
 from inventory i join purchases pu on pu.id=i.purchase_id join products p on p.id=pu.product_id join profiles pr on pr.id=pu.created_by where i.id=p_id
$$;
create function public.create_purchase(p_data jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare prod uuid; pur uuid; inv uuid; qty integer; serial boolean;
begin
 perform require_permission('purchases.create');
 select serialized into serial from product_types where key=p_data->>'type';
 if serial is null then raise exception 'Invalid product type'; end if;
 qty:=case when serial then 1 else (p_data->>'quantity')::integer end;
 if serial and (nullif(p_data->>'imei1','') is null or nullif(p_data->>'brand','') is null) then raise exception 'Phone brand and IMEI are required'; end if;
 insert into products(type,name,brand,category) values(p_data->>'type',p_data->>'name',coalesce(p_data->>'brand',''),coalesce(p_data->>'category','')) returning id into prod;
 insert into purchases(product_id,unit_cost,quantity,date,notes,created_by) values(prod,(p_data->>'unit_cost')::numeric,qty,(p_data->>'date')::timestamptz,coalesce(p_data->>'notes',''),auth.uid()) returning id into pur;
 insert into inventory(purchase_id,quantity,imei1,imei2,color,storage,ram,condition,battery_health,physical_condition) values(pur,qty,case when serial then nullif(p_data->>'imei1','') end,case when serial then nullif(p_data->>'imei2','') end,coalesce(p_data->>'color',''),coalesce(p_data->>'storage',''),coalesce(p_data->>'ram',''),coalesce(p_data->>'condition','new'),nullif(p_data->>'battery_health','')::integer,coalesce(p_data->>'physical_condition','')) returning id into inv;
 return inv;
end $$;
create function public.create_sale(p_inventory_id uuid,p_quantity integer,p_unit_price numeric,p_date timestamptz) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inv inventory; pur purchases; prod products; sid uuid; shop jsonb;
begin
 perform require_permission('sales.create');
 select * into inv from inventory where id=p_inventory_id for update;
 if not found or p_quantity is null or p_quantity<1 or inv.quantity<p_quantity then raise exception 'Insufficient available stock'; end if;
 if p_unit_price is null or p_unit_price<0 then raise exception 'Invalid selling price'; end if;
 select * into pur from purchases where id=inv.purchase_id;
 select * into prod from products where id=pur.product_id;
 if (select serialized from product_types where key=prod.type) and p_quantity<>1 then raise exception 'A phone sale must have quantity one'; end if;
 select to_jsonb(s)-'id' into shop from shop_settings s;
 insert into sales(date,created_by,shop_snapshot) values(p_date,auth.uid(),shop) returning id into sid;
 insert into sale_items(sale_id,inventory_id,snapshot,quantity,unit_price,unit_cost) values(sid,inv.id,jsonb_build_object('type',prod.type,'name',prod.name,'brand',prod.brand,'imei1',inv.imei1,'imei2',inv.imei2,'color',inv.color,'storage',inv.storage,'ram',inv.ram,'condition',inv.condition,'sold_by',(select username from profiles where id=auth.uid())),p_quantity,p_unit_price,pur.unit_cost);
 update inventory set quantity=quantity-p_quantity where id=inv.id;
 return sid;
end $$;
create function public.save_expense(p_data jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare eid uuid;
begin
 perform require_permission(case when p_id is null then 'expenses.create' else 'expenses.edit' end);
 if p_id is null then
 insert into expenses(amount,reason,date,created_by) values((p_data->>'amount')::numeric,p_data->>'reason',(p_data->>'date')::timestamptz,auth.uid()) returning id into eid;
 else update expenses set amount=(p_data->>'amount')::numeric,reason=p_data->>'reason',date=(p_data->>'date')::timestamptz where id=p_id returning id into eid;
 end if;
 if eid is null then raise exception 'Expense not found'; end if; return eid;
end $$;
create function public.delete_expense(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform require_permission('expenses.delete'); delete from expenses where id=p_id; end $$;
create function public.change_inventory(p_id uuid,p_data jsonb,p_context text default 'inventory',p_delete boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare inv inventory; pur purchases;
begin
 if p_context not in ('inventory','purchases') then raise exception 'Invalid context'; end if;
 perform require_permission(p_context||case when p_delete then '.delete' else '.edit' end);
 select * into inv from inventory where id=p_id for update;
 if not found then raise exception 'Inventory not found'; end if;
 if exists(select 1 from sale_items where inventory_id=p_id) then raise exception 'Inventory with sale history cannot be changed or deleted'; end if;
 select * into pur from purchases where id=inv.purchase_id;
 if p_delete then delete from inventory where id=p_id; delete from purchases where id=pur.id; delete from products where id=pur.product_id; return; end if;
 update products set name=p_data->>'name',brand=coalesce(p_data->>'brand',''),category=coalesce(p_data->>'category','') where id=pur.product_id;
 update inventory set color=coalesce(p_data->>'color',''),storage=coalesce(p_data->>'storage',''),ram=coalesce(p_data->>'ram',''),condition=coalesce(p_data->>'condition','new'),battery_health=nullif(p_data->>'battery_health','')::integer,physical_condition=coalesce(p_data->>'physical_condition','') where id=p_id;
 update purchases set notes=coalesce(p_data->>'notes','') where id=pur.id;
 if p_context='purchases' and p_data ? 'unit_cost' then
 perform require_permission('purchases.cost'); update purchases set unit_cost=(p_data->>'unit_cost')::numeric where id=pur.id;
 end if;
end $$;
create function public.save_settings(p_data jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform require_permission('settings.edit');
 update shop_settings set name=p_data->>'name',phone=p_data->>'phone',address=p_data->>'address',logo=p_data->>'logo',primary_color=p_data->>'primary_color',accent_color=p_data->>'accent_color',receipt_note=p_data->>'receipt_note',updated_at=now() where id=true;
end $$;
revoke execute on function public.inventory_record(uuid,boolean),public.create_purchase(jsonb),public.create_sale(uuid,integer,numeric,timestamptz),public.save_expense(jsonb,uuid),public.delete_expense(uuid),public.change_inventory(uuid,jsonb,text,boolean),public.save_settings(jsonb) from public,anon,authenticated;
grant execute on function public.has_permission(text),public.create_purchase(jsonb),public.create_sale(uuid,integer,numeric,timestamptz),public.save_expense(jsonb,uuid),public.delete_expense(uuid),public.change_inventory(uuid,jsonb,text,boolean),public.save_settings(jsonb) to authenticated;

-- 202610060003_read_api.sql
create function public.get_receipt(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform require_permission('sales.receipt');
 perform require_permission('sales.price');
 select to_jsonb(s)||jsonb_build_object('items',(select jsonb_agg(jsonb_build_object('snapshot',i.snapshot,'quantity',i.quantity,'unit_price',i.unit_price)) from sale_items i where i.sale_id=s.id)) into result from sales s where s.id=p_id;
 if result is null then raise exception 'Sale not found'; end if; return result;
end $$;
create function public.get_shop_data() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare me profiles; perms jsonb; inv jsonb:='[]'; pur jsonb:='[]'; sal jsonb:='[]'; exp jsonb:='[]'; usr jsonb:='[]'; dash jsonb:='{}'; trends jsonb:='[]'; brands jsonb:='[]';
begin
 select * into me from profiles where id=auth.uid();
 if me.id is null or not me.active then raise exception 'Account unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_agg(permission),'[]') into perms from user_permissions where user_id=me.id;
 if me.must_change_password then return jsonb_build_object('profile',to_jsonb(me),'permissions',perms); end if;
 if has_permission('inventory.view') or has_permission('sales.create') then
 select coalesce(jsonb_agg(inventory_record(i.id,has_permission('inventory.cost')) order by p.date desc),'[]') into inv from inventory i join purchases p on p.id=i.purchase_id;
 -- Detail permission redacts the serialized specifications, independently of list access.
 if not has_permission('inventory.details') and not has_permission('sales.create') then select coalesce(jsonb_agg(v-'imei2'-'color'-'storage'-'ram'-'battery_health'-'physical_condition'-'notes'),'[]') into inv from jsonb_array_elements(inv) v; end if;
 end if;
 if has_permission('purchases.view') then select coalesce(jsonb_agg(inventory_record(i.id,has_permission('purchases.cost')) order by p.date desc),'[]') into pur from inventory i join purchases p on p.id=i.purchase_id; end if;
 if has_permission('sales.view') then
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'invoice',s.invoice,'date',s.date,'sold_by',pr.username,'items',
 (select jsonb_agg(jsonb_build_object('id',si.id,'inventory_id',si.inventory_id,'quantity',si.quantity,'snapshot',case when has_permission('sales.details') then si.snapshot else si.snapshot-'imei2'-'color'-'storage'-'ram'-'condition' end)||case when has_permission('sales.price') then jsonb_build_object('unit_price',si.unit_price) else '{}'::jsonb end||case when has_permission('sales.profit') then jsonb_build_object('profit',si.profit) else '{}'::jsonb end) from sale_items si where si.sale_id=s.id)) order by s.date desc),'[]') into sal from sales s join profiles pr on pr.id=s.created_by;
 end if;
 if has_permission('expenses.view') then select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('added_by',p.username) order by e.date desc),'[]') into exp from expenses e join profiles p on p.id=e.created_by; end if;
 if has_permission('users.view') then select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('last_login',a.last_sign_in_at,'permissions',(select coalesce(jsonb_agg(permission),'[]') from user_permissions where user_id=p.id)) order by p.created_at),'[]') into usr from profiles p join auth.users a on a.id=p.id; end if;
 if has_permission('home.view') then
 select jsonb_build_object('total_inventory',coalesce(sum(i.quantity),0),'available_phones',coalesce(sum(i.quantity) filter(where pr.type='phone'),0),'available_accessories',coalesce(sum(i.quantity) filter(where pr.type<>'phone'),0),'sold',coalesce((select sum(quantity) from sale_items),0),'phones_sold',coalesce((select sum(quantity) from sale_items where snapshot->>'type'='phone'),0)) into dash from inventory i join purchases pu on pu.id=i.purchase_id join products pr on pr.id=pu.product_id;
 select dash||jsonb_build_object('total_sales',count(*),'today_sales',count(*) filter(where (s.date at time zone 'Asia/Kabul')::date=(now() at time zone 'Asia/Kabul')::date),'monthly_sales',count(*) filter(where date_trunc('month',s.date at time zone 'Asia/Kabul')=date_trunc('month',now() at time zone 'Asia/Kabul'))) into dash from sales s;
 if has_permission('home.revenue') then
 select dash||jsonb_build_object('total_revenue',coalesce(sum(si.unit_price*si.quantity),0),'today_revenue',coalesce(sum(si.unit_price*si.quantity) filter(where (s.date at time zone 'Asia/Kabul')::date=(now() at time zone 'Asia/Kabul')::date),0),'monthly_revenue',coalesce(sum(si.unit_price*si.quantity) filter(where date_trunc('month',s.date at time zone 'Asia/Kabul')=date_trunc('month',now() at time zone 'Asia/Kabul')),0)) into dash from sale_items si join sales s on s.id=si.sale_id; end if;
 if has_permission('home.profit') then
 select dash||jsonb_build_object('total_profit',coalesce(sum(si.profit),0),'today_profit',coalesce(sum(si.profit) filter(where (s.date at time zone 'Asia/Kabul')::date=(now() at time zone 'Asia/Kabul')::date),0),'monthly_profit',coalesce(sum(si.profit) filter(where date_trunc('month',s.date at time zone 'Asia/Kabul')=date_trunc('month',now() at time zone 'Asia/Kabul')),0),'net_profit',coalesce(sum(si.profit),0)-(select coalesce(sum(amount),0) from expenses)) into dash from sale_items si join sales s on s.id=si.sale_id; end if;
 if has_permission('home.expenses') then
 select dash||jsonb_build_object('total_expenses',coalesce(sum(amount),0),'today_expenses',coalesce(sum(amount) filter(where (date at time zone 'Asia/Kabul')::date=(now() at time zone 'Asia/Kabul')::date),0),'monthly_expenses',coalesce(sum(amount) filter(where date_trunc('month',date at time zone 'Asia/Kabul')=date_trunc('month',now() at time zone 'Asia/Kabul')),0)) into dash from expenses; end if;
 if has_permission('home.analytics') then
 select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'sales',(select count(*) from sales where (date at time zone 'Asia/Kabul')::date=d::date))||case when has_permission('home.revenue') then jsonb_build_object('revenue',(select coalesce(sum(si.unit_price*si.quantity),0) from sale_items si join sales s on s.id=si.sale_id where (s.date at time zone 'Asia/Kabul')::date=d::date)) else '{}'::jsonb end||case when has_permission('home.profit') then jsonb_build_object('profit',(select coalesce(sum(si.profit),0) from sale_items si join sales s on s.id=si.sale_id where (s.date at time zone 'Asia/Kabul')::date=d::date)) else '{}'::jsonb end||case when has_permission('home.expenses') then jsonb_build_object('expenses',(select coalesce(sum(amount),0) from expenses where (date at time zone 'Asia/Kabul')::date=d::date)) else '{}'::jsonb end),'[]') into trends from generate_series((now() at time zone 'Asia/Kabul')::date-13,(now() at time zone 'Asia/Kabul')::date,interval '1 day') d;
 select coalesce(jsonb_agg(to_jsonb(b)),'[]') into brands from (select si.snapshot->>'brand' brand,sum(si.quantity) quantity from sale_items si group by si.snapshot->>'brand') b;
 end if;
 end if;
 return jsonb_build_object('profile',to_jsonb(me),'permissions',perms,'inventory',inv,'purchases',pur,'sales',sal,'expenses',exp,'users',usr,'dashboard',dash,'trends',trends,'brands',brands,'settings',(select to_jsonb(s) from shop_settings s),'types',(select jsonb_agg(to_jsonb(t)) from product_types t),'conditions',(select jsonb_agg(key) from conditions));
end $$;
revoke execute on function public.inventory_record(uuid,boolean),public.get_shop_data(),public.get_receipt(uuid) from public,anon;
grant execute on function public.get_shop_data(),public.get_receipt(uuid) to authenticated;

-- 202610060004_admin.sql
-- Used only by the service-role Edge Function; never callable by authenticated clients.
create function public.admin_profile(p_actor uuid,p_target uuid,p_data jsonb,p_action text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare key text; requested text; actor profiles;
begin
 select * into actor from profiles where id=p_actor for update;
 if not found or not actor.active or actor.must_change_password then raise exception 'Unauthorized administrator'; end if;
 requested:=case p_action when 'create' then 'users.create' when 'disable' then 'users.disable' when 'permissions' then 'users.permissions' else 'users.edit' end;
 if not exists(select 1 from user_permissions where user_id=p_actor and permission=requested) then raise exception 'Permission denied'; end if;
 if p_actor=p_target then raise exception 'Use Account settings for your own account'; end if;
 if p_action='create' then
 insert into profiles(id,username,email,role) values(p_target,p_data->>'username',(p_data->>'username')||'@aminzi.af',coalesce(p_data->>'role','Staff'));
 elsif p_action='disable' then update profiles set active=(p_data->>'active')::boolean where id=p_target;
 elsif p_action='edit' then update profiles set role=p_data->>'role' where id=p_target;
 elsif p_action<>'permissions' then raise exception 'Invalid action'; end if;
 if p_data ? 'permissions' then
 if not exists(select 1 from user_permissions where user_id=p_actor and permission='users.permissions') then raise exception 'Permission management denied'; end if;
 delete from user_permissions where user_id=p_target;
 for key in select jsonb_array_elements_text(p_data->'permissions') loop insert into user_permissions values(p_target,key); end loop;
 end if;
end $$;
revoke execute on function public.admin_profile(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_profile(uuid,uuid,jsonb,text) to service_role;
grant select on public.profiles,public.user_permissions to service_role;
revoke all on sequence public.sales_invoice_seq from anon,authenticated;

commit;
