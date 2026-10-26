-- Expand the primary-owner set from one UUID to a controlled set of co-owners.
-- Existing owner rows are retained. Apply only after reviewing and verifying
-- each intended Auth account. No browser-accessible owner-claim path is added.
begin;

alter table public.bpro_owner drop constraint bpro_owner_pkey;
alter table public.bpro_owner drop column singleton;
alter table public.bpro_owner add constraint bpro_owner_pkey primary key (user_id);

create or replace function public.bpro_direct_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); profile public.bpro_profiles; owner_user boolean;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  owner_user := public.bpro_is_owner();
  select p.* into profile from public.bpro_profiles p where p.id=caller;
  if not owner_user and (profile.id is null or not profile.active or profile.role_id is null) then
    raise exception 'Access has not been granted';
  end if;
  return jsonb_build_object(
    'id',caller,'email',coalesce(profile.email,''),'name',coalesce(nullif(profile.name,''),profile.email,''),
    'role_id',profile.role_id,'is_owner',owner_user,
    'role_name',case when owner_user then 'Co-owner' else coalesce((select r->>'name' from public.bpro_state s,jsonb_array_elements(s.payload->'overview'->'roles') r where s.id=1 and (r->>'id')::integer=profile.role_id),'') end,
    'permissions',case when owner_user then '[]'::jsonb else coalesce((select r->'permissions' from public.bpro_state s,jsonb_array_elements(s.payload->'overview'->'roles') r where s.id=1 and (r->>'id')::integer=profile.role_id),'[]'::jsonb) end
  );
end $$;

commit;
