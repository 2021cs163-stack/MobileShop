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

