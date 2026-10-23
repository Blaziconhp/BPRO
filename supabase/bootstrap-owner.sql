-- Run manually as postgres in the SQL Editor AFTER creating your owner in Auth.
-- Replace the UUID below with the exact Authentication > Users UUID.
-- Never deploy a public first-user/claim-owner endpoint.
begin;
do $$
declare chosen uuid := '00000000-0000-0000-0000-000000000000';
begin
  if exists(select 1 from public.bpro_owner) then raise exception 'An owner already exists'; end if;
  if not exists(select 1 from auth.users where id=chosen) then raise exception 'Create the chosen user in Supabase Auth first'; end if;
  -- Enable before installing immutable owner identity.
  update public.bpro_profiles set role_id=1,active=true where id=chosen;
  insert into public.bpro_owner(user_id) values(chosen);
end $$;
commit;
