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



