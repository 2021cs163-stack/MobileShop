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

