-- Run as postgres only after creating and verifying both Auth accounts.
-- This grants co-owner access; it does not create users or set passwords.
begin;
do $$
declare
  target_emails text[] := array['nihal.p@boheco.com','harsh.p@boheco.com'];
  matched_count integer;
begin
  select count(*) into matched_count
  from auth.users u where lower(u.email)=any(target_emails);
  if matched_count <> cardinality(target_emails) then
    raise exception 'Expected exactly one Auth account for each configured co-owner email';
  end if;

  update public.bpro_profiles p
  set role_id=1,active=true,updated_at=now()
  from auth.users u
  where p.id=u.id and lower(u.email)=any(target_emails);

  if (select count(*) from public.bpro_profiles p join auth.users u on u.id=p.id
      where lower(u.email)=any(target_emails) and p.active and p.role_id=1) <> cardinality(target_emails) then
    raise exception 'Both co-owner profiles must be provisioned before adding owner identities';
  end if;

  insert into public.bpro_owner(user_id)
  select u.id from auth.users u where lower(u.email)=any(target_emails)
  on conflict (user_id) do nothing;
end $$;
commit;
