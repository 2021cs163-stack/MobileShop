-- FIRST create your administrator in Supabase Authentication > Users > Add user.
-- Disable "Allow new users to sign up" under Authentication > Sign In / Providers.
-- Set admin_email below to the EXACT email of your first shop administrator.
-- Auth users created manually do not automatically receive a shop profile.
-- Run this in the owner SQL Editor after migrations. Safe to rerun.
do $$
declare
 admin_email text := 'admin@aminzi.af'; -- CHANGE THIS to your Auth user's email
 admin_username text := 'admin'; -- lowercase, 3-30 letters/numbers/underscores
 admin_id uuid;
begin
 select id into admin_id from auth.users where lower(email)=lower(trim(admin_email));
 if admin_id is null then raise exception 'No Auth user found for %. Create the user first or correct admin_email.',admin_email; end if;
 insert into public.profiles(id,username,email,role,active,must_change_password)
 values(admin_id,admin_username,lower(trim(admin_email)),'Administrator',true,false)
 on conflict(id) do update set email=excluded.email,role='Administrator',active=true,must_change_password=false;
 insert into public.user_permissions(user_id,permission) select admin_id,key from public.permission_catalog
 on conflict(user_id,permission) do nothing;
end $$;
