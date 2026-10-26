-- Operator-run transfer for the production BPRO project.
-- Guarded to the current owner UUID and Harsh's exact confirmed Auth email.
-- Run only after reviewing the target account in Supabase Auth.
begin;

do $$
declare
  previous_owner uuid := 'c349ffe5-d006-4e9a-8260-9dd4534405fe';
  next_owner uuid;
begin
  select id into next_owner from auth.users
  where lower(email) = 'harsh.p@boheco.com' and email_confirmed_at is not null;
  if next_owner is null then
    raise exception 'Harsh Auth user must exist and have a confirmed email';
  end if;
  if (select count(*) from public.bpro_owner) <> 1 then
    raise exception 'Expected exactly one current BPRO owner';
  end if;
  if not exists(select 1 from public.bpro_owner where user_id=previous_owner) then
    raise exception 'Current BPRO owner does not match the reviewed account';
  end if;
  if not exists(select 1 from public.bpro_profiles where id=next_owner) then
    raise exception 'Harsh profile is not synchronized from Supabase Auth';
  end if;

  update public.bpro_profiles
  set role_id=1,active=true,updated_at=now()
  where id=next_owner;

  alter table public.bpro_owner disable trigger bpro_owner_immutable;
  update public.bpro_owner set user_id=next_owner where user_id=previous_owner;
  alter table public.bpro_owner enable trigger bpro_owner_immutable;

  update public.bpro_profiles
  set role_id=null,active=false,updated_at=now()
  where id=previous_owner and id<>next_owner;
end $$;

commit;
