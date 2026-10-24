begin;
create table public.bpro_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.bpro_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '', name text not null default '',
  role_id integer, active boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.bpro_state (
  id integer primary key check(id=1), revision bigint not null default 0,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  updated_at timestamptz not null default now()
);
create table public.bpro_audit (
  id bigint generated always as identity primary key,
  user_id uuid, user_name text, action text not null,
  detail text not null default '', pr_no text,
  created_at timestamptz not null default now()
);
alter table public.bpro_owner enable row level security;
alter table public.bpro_profiles enable row level security;
alter table public.bpro_state enable row level security;
alter table public.bpro_audit enable row level security;
revoke all on public.bpro_owner, public.bpro_profiles, public.bpro_state, public.bpro_audit from anon, authenticated;
grant select on public.bpro_owner, public.bpro_profiles to authenticated;
grant all on public.bpro_owner, public.bpro_profiles, public.bpro_state, public.bpro_audit to service_role;
grant usage,select on sequence public.bpro_audit_id_seq to service_role;
-- The state document and audit log have no browser policies: default-deny RLS.
-- Authenticated app traffic uses a same-origin server that enforces each role/action.
create policy owner_identity on public.bpro_owner for select to authenticated using (user_id=(select auth.uid()));
create policy own_profile on public.bpro_profiles for select to authenticated using (id=(select auth.uid()));

create function public.bpro_protect_owner() returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Primary owner is immutable; use a reviewed operator migration for recovery';
end $$;
create trigger bpro_owner_immutable before update or delete on public.bpro_owner for each row execute function public.bpro_protect_owner();
create function public.bpro_protect_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.bpro_owner where user_id=old.id) then
    if tg_op='DELETE' then raise exception 'Primary owner cannot be deleted'; end if;
    if new.id<>old.id or new.role_id is distinct from old.role_id or not new.active then
      raise exception 'Primary owner access is protected';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger bpro_profile_protected before update or delete on public.bpro_profiles for each row execute function public.bpro_protect_profile();

create function public.bpro_sync_auth() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.bpro_profiles(id,email,name)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',new.email,''))
  on conflict(id) do update set email=excluded.email,name=excluded.name,updated_at=now();
  return new;
end $$;
create trigger bpro_auth_sync after insert or update of email,raw_user_meta_data on auth.users for each row execute function public.bpro_sync_auth();
insert into public.bpro_profiles(id,email,name)
select id,coalesce(email,''),coalesce(raw_user_meta_data->>'full_name',email,'') from auth.users on conflict do nothing;

create function public.bpro_assign_role(target_id uuid,new_role integer,enabled boolean,actor_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.bpro_owner where user_id=actor_id) then raise exception 'Owner required'; end if;
  if exists(select 1 from public.bpro_owner where user_id=target_id) then raise exception 'Owner protected'; end if;
  perform 1 from public.bpro_state where id=1 for share;
  if new_role is not null and not exists(select 1 from public.bpro_state s,jsonb_array_elements(s.payload->'overview'->'roles') r where (r->>'id')::integer=new_role) then raise exception 'Unknown role'; end if;
  update public.bpro_profiles set role_id=new_role,active=enabled,updated_at=now() where id=target_id;
  if not found then raise exception 'Unknown Auth user'; end if;
  insert into public.bpro_audit(user_id,user_name,action,detail)
  select actor_id,name,'role_assigned',target_id::text||': role '||coalesce(new_role::text,'unassigned')||', active '||enabled::text from public.bpro_profiles where id=actor_id;
end $$;

create function public.bpro_commit(expected_revision bigint,new_payload jsonb,actor_id uuid,action_name text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.bpro_state set payload=new_payload,revision=revision+1,updated_at=now() where id=1 and revision=expected_revision;
  if not found then return false; end if;
  if exists(select 1 from public.bpro_profiles p where p.role_id is not null and not exists(select 1 from jsonb_array_elements(new_payload->'overview'->'roles') r where (r->>'id')::integer=p.role_id)) then
    raise exception 'Reassign all users before removing their role';
  end if;
  insert into public.bpro_audit(user_id,user_name,action)
    select actor_id,name,left(action_name,200) from public.bpro_profiles where id=actor_id;
  return true;
end $$;
revoke all on function public.bpro_commit(bigint,jsonb,uuid,text),public.bpro_assign_role(uuid,integer,boolean,uuid),public.bpro_sync_auth(),public.bpro_protect_profile(),public.bpro_protect_owner() from public,anon,authenticated;
grant execute on function public.bpro_commit(bigint,jsonb,uuid,text),public.bpro_assign_role(uuid,integer,boolean,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bpro-files','bpro-files',false,6291456,array['application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=6291456;
-- No anon/authenticated policies are added for this bucket. All file operations
-- pass through the server, which enforces owner-only upload and request-scoped read.
-- Defense in depth even if another broad storage policy already exists:
create policy bpro_no_client_storage on storage.objects as restrictive for all to anon,authenticated
using (bucket_id<>'bpro-files') with check(bucket_id<>'bpro-files');
commit;
