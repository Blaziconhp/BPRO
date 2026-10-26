-- Browser clients may use only the publishable key. This migration establishes
-- narrowly scoped RPCs for identity, state reads, owner user management,
-- validated workflow mutations, and private attachment access. Every write
-- derives the caller from auth.uid() and checks role capabilities in SQL.
begin;

create or replace function public.bpro_is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.bpro_owner o where o.user_id = (select auth.uid()))
$$;

create or replace function public.bpro_active_profile()
returns public.bpro_profiles language sql stable security definer set search_path = '' as $$
  select p from public.bpro_profiles p where p.id = (select auth.uid()) and p.active and p.role_id is not null
$$;

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
    'role_name',case when owner_user then 'Primary owner' else coalesce((select r->>'name' from public.bpro_state s,jsonb_array_elements(s.payload->'overview'->'roles') r where s.id=1 and (r->>'id')::integer=profile.role_id),'') end,
    'permissions',case when owner_user then '[]'::jsonb else coalesce((select r->'permissions' from public.bpro_state s,jsonb_array_elements(s.payload->'overview'->'roles') r where s.id=1 and (r->>'id')::integer=profile.role_id),'[]'::jsonb) end
  );
end $$;

create or replace function public.bpro_redact_financials(value jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb; key text; item jsonb;
begin
  if value is null or jsonb_typeof(value) not in ('object','array') then return value; end if;
  if jsonb_typeof(value)='array' then
    select coalesce(jsonb_agg(public.bpro_redact_financials(v)), '[]'::jsonb) into result from jsonb_array_elements(value) v;
    return result;
  end if;
  result := '{}'::jsonb;
  for key,item in select e.key,e.value from jsonb_each(value) e loop
    result := result || jsonb_build_object(key, case when key in ('rate','amount','cost_impact','spend','issue_cost','ratecard_rate','rates','total_spend','cost') then 'null'::jsonb else public.bpro_redact_financials(item) end);
  end loop;
  return result;
end $$;

create or replace function public.bpro_direct_read_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); profile public.bpro_profiles; payload jsonb; owner_user boolean; role_perms jsonb; request_rows jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  owner_user := public.bpro_is_owner();
  select p.* into profile from public.bpro_profiles p where p.id=caller;
  if not owner_user and (profile.id is null or not profile.active or profile.role_id is null) then raise exception 'Access has not been granted'; end if;
  select s.payload into payload from public.bpro_state s where s.id=1;
  if payload is null then raise exception 'BPRO state is not initialized'; end if;
  select r->'permissions' into role_perms from jsonb_array_elements(payload->'overview'->'roles') r where (r->>'id')::integer=profile.role_id;
  if not owner_user then
    select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) into request_rows
    from jsonb_each(payload->'req') q(k,v)
    where coalesce(role_perms ? 'requests.view_all',false)
       or v->>'created_by'=caller::text or v->>'ops_poc_id'=caller::text or v->>'marketing_poc_id'=caller::text;
    payload := jsonb_set(payload,'{req}',coalesce(request_rows,'{}'::jsonb),true);
    if not coalesce(role_perms ? 'financials.view',false) then payload := public.bpro_redact_financials(payload); end if;
  end if;
  payload := jsonb_set(payload,'{meta,users}',coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',coalesce(nullif(p.name,''),p.email),'active',p.active,'role_id',p.role_id,
    'role_name',coalesce((select r->>'name' from jsonb_array_elements(payload->'overview'->'roles') r where (r->>'id')::integer=p.role_id),'Unassigned'),
    'poc_type',(select r->>'poc_type' from jsonb_array_elements(payload->'overview'->'roles') r where (r->>'id')::integer=p.role_id)
  ) order by p.email) from public.bpro_profiles p where p.active and p.role_id is not null),'[]'::jsonb),true);
  return payload;
end $$;

create or replace function public.bpro_direct_read_snapshot()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('revision',s.revision,'payload',public.bpro_direct_read_state())
  from public.bpro_state s where s.id=1
$$;

create or replace function public.bpro_sensitive_values(value jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb; key text; item jsonb;
begin
  if value is null or jsonb_typeof(value) not in ('object','array') then return '{}'::jsonb; end if;
  if jsonb_typeof(value)='array' then
    select coalesce(jsonb_agg(public.bpro_sensitive_values(v)), '[]'::jsonb) into result from jsonb_array_elements(value) v;
    return result;
  end if;
  result := '{}'::jsonb;
  for key,item in select e.key,e.value from jsonb_each(value) e loop
    if key in ('rate','amount','cost_impact','spend','issue_cost','ratecard_rate','rates','total_spend','cost') then
      result := result || jsonb_build_object(key,item);
    else
      result := result || jsonb_build_object(key,public.bpro_sensitive_values(item));
    end if;
  end loop;
  return result;
end $$;

create or replace function public.bpro_restore_hidden_financials(old_value jsonb,new_value jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb; key text; item jsonb; idx integer := 0; old_item jsonb;
begin
  if jsonb_typeof(new_value)='array' then
    result := '[]'::jsonb;
    for item in select value from jsonb_array_elements(new_value) loop
      old_item := case when jsonb_typeof(old_value)='array' then old_value->idx else null end;
      result := result || jsonb_build_array(public.bpro_restore_hidden_financials(old_item,item));
      idx := idx+1;
    end loop;
    return result;
  elsif jsonb_typeof(new_value)='object' then
    result := new_value;
    for key,item in select e.key,e.value from jsonb_each(new_value) e loop
      if key in ('rate','amount','cost_impact','spend','issue_cost','ratecard_rate','rates','total_spend','cost') then
        if jsonb_typeof(old_value)='object' and old_value ? key then result := jsonb_set(result,array[key],old_value->key,true); end if;
      else
        result := jsonb_set(result,array[key],public.bpro_restore_hidden_financials(case when jsonb_typeof(old_value)='object' then old_value->key else null end,item),true);
      end if;
    end loop;
    return result;
  end if;
  return new_value;
end $$;

create or replace function public.bpro_direct_commit(expected_revision bigint,new_payload jsonb,action_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid()); owner_user boolean; profile public.bpro_profiles; old_payload jsonb;
  role_perms jsonb; role_id integer; k text; request_key text; old_req jsonb; new_req jsonb; financial_access boolean;
  old_val jsonb; new_val jsonb; can_edit boolean; can_read boolean; old_step jsonb; new_step jsonb;
  step_item jsonb; today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  owner_user := public.bpro_is_owner();
  select p.* into profile from public.bpro_profiles p where p.id=caller;
  if not owner_user and (profile.id is null or not profile.active or profile.role_id is null) then raise exception 'Access has not been granted'; end if;
  select payload into old_payload from public.bpro_state where id=1 for update;
  if old_payload is null then raise exception 'BPRO state is not initialized'; end if;
  if jsonb_typeof(new_payload)<>'object' or new_payload ? 'profiles' or new_payload ? 'audit' then raise exception 'Invalid application state'; end if;
  if not owner_user then
    role_id := profile.role_id;
    select r->'permissions' into role_perms from jsonb_array_elements(old_payload->'overview'->'roles') r where (r->>'id')::integer=role_id;
    financial_access := coalesce(role_perms ? 'financials.view',false);
    if not financial_access then new_payload := public.bpro_restore_hidden_financials(old_payload,new_payload); end if;
    if new_payload->'overview' is distinct from old_payload->'overview' or new_payload->'reports' is distinct from old_payload->'reports' then raise exception 'Only the primary owner may change dashboard configuration'; end if;
    if new_payload->'vendors' is distinct from old_payload->'vendors' then
      if not coalesce(role_perms ? 'vendors.manage',false) then raise exception 'Vendor management permission required'; end if;
      if not coalesce(role_perms ? 'financials.view',false) and public.bpro_sensitive_values(new_payload->'vendors') is distinct from public.bpro_sensitive_values(old_payload->'vendors') then raise exception 'Financial permission required'; end if;
    end if;
    if (new_payload->'req') is null or jsonb_typeof(new_payload->'req')<>'object' then raise exception 'Invalid request data'; end if;
    for request_key,old_req in select key,value from jsonb_each(old_payload->'req') loop
      can_read := coalesce(role_perms ? 'requests.view_all',false) or old_req->>'created_by'=caller::text or old_req->>'ops_poc_id'=caller::text or old_req->>'marketing_poc_id'=caller::text;
      if not can_read and not (new_payload->'req' ? request_key) then new_payload := jsonb_set(new_payload,array['req',request_key],old_req,true); end if;
    end loop;
    for request_key in select key from (
      select jsonb_object_keys(old_payload->'req') key union select jsonb_object_keys(new_payload->'req') key
    ) ids loop
      old_req := old_payload->'req'->request_key;
      new_req := new_payload->'req'->request_key;
      if old_req is not distinct from new_req then continue; end if;
      if old_req is null then
        if not coalesce(role_perms ? 'requests.create',false) or new_req->>'created_by'<>caller::text then raise exception 'Request creation permission required'; end if;
        if new_req->>'id'<>request_key or new_req->>'pr_no'<>coalesce(old_payload->'overview'->'settings'->>'pr_prefix','BPRO/PR')||'/'||lpad(request_key,6,'0')
          or new_req->>'created_by_name' is distinct from profile.name
          or coalesce(new_req->>'status','')<>'open' or coalesce(new_req->>'is_demo','false')<>'false'
          or coalesce(new_req->>'proof_rounds','0')<>'0' or new_req->>'vendor_id' is not null
          or coalesce(new_req->'quotes','[]'::jsonb)<>'[]'::jsonb or coalesce(new_req->'issues','[]'::jsonb)<>'[]'::jsonb
          or coalesce(new_req->'attachments','[]'::jsonb)<>'[]'::jsonb or coalesce(new_req->'comments','[]'::jsonb)<>'[]'::jsonb
          or coalesce(new_req->'activity','[]'::jsonb)<>'[]'::jsonb or coalesce(new_req->'batch_siblings','[]'::jsonb)<>'[]'::jsonb
          or new_req->'rate' is not null and new_req->'rate'<>'null'::jsonb
          or new_req->'amount' is not null and new_req->'amount'<>'null'::jsonb
          or new_req->'cost_impact' is not null and new_req->'cost_impact'<>'null'::jsonb then raise exception 'Invalid new request data'; end if;
        if not exists(select 1 from jsonb_array_elements(old_payload->'overview'->'lookups') l where l->>'type'='location' and l->>'value'=new_req->>'location' and coalesce((l->>'active')::boolean,false))
          or not exists(select 1 from jsonb_array_elements(old_payload->'overview'->'collaterals') c where (c->>'id')::integer=(new_req->>'collateral_id')::integer and coalesce((c->>'active')::boolean,false))
          or not exists(select 1 from jsonb_array_elements(old_payload->'overview'->'lookups') t where t->>'type'='request_type' and (t->>'id')::integer=(new_req->>'request_type_id')::integer and coalesce((t->>'active')::boolean,false)) then raise exception 'Request contains an inactive or unknown lookup'; end if;
        if jsonb_array_length(coalesce(new_req->'steps','[]'::jsonb))<>(select count(*) from jsonb_array_elements(old_payload->'overview'->'steps') s where coalesce((s->>'active')::boolean,false)) then raise exception 'Request workflow does not match the configured workflow'; end if;
        for step_item in select value from jsonb_array_elements(coalesce(new_req->'steps','[]'::jsonb)) loop
          select value into old_step from jsonb_array_elements(old_payload->'overview'->'steps') where (value->>'id')::integer=(step_item->>'id')::integer and coalesce((value->>'active')::boolean,false);
          if old_step is null or (step_item - array['group','status','done_date','done_by','done_by_name','remark','is_active','start_date','elapsed','tat','due_date','overdue_days','late_by','esc_level']) is distinct from old_step then raise exception 'Request workflow does not match the configured workflow'; end if;
          if coalesce((old_step->>'auto_done')::boolean,false) then
            if step_item->>'status'<>'done' or step_item->>'done_by'<>caller::text or step_item->>'done_date'<>new_req->>'raised_date' then raise exception 'Invalid initial automatic workflow step'; end if;
          elsif step_item->>'status'<>'pending' or step_item->>'done_by' is not null or step_item->>'done_date' is not null then raise exception 'New workflow steps must start pending'; end if;
        end loop;
        continue;
      end if;
      can_read := coalesce(role_perms ? 'requests.view_all',false) or old_req->>'created_by'=caller::text or old_req->>'ops_poc_id'=caller::text or old_req->>'marketing_poc_id'=caller::text;
      if not can_read then raise exception 'Request is outside your access scope'; end if;
      if new_req is null then
        if not coalesce(role_perms ? 'requests.delete',false) then raise exception 'Request deletion permission required'; end if;
        continue;
      end if;
      can_edit := coalesce(role_perms ? 'requests.edit_all',false) or (coalesce(role_perms ? 'requests.edit',false) and (old_req->>'created_by'=caller::text or old_req->>'ops_poc_id'=caller::text or old_req->>'marketing_poc_id'=caller::text));
      if new_req->>'created_by' is distinct from old_req->>'created_by' then raise exception 'Request creator is immutable'; end if;
      if public.bpro_sensitive_values(new_req) is distinct from public.bpro_sensitive_values(old_req) and not coalesce(role_perms ? 'financials.view',false) then raise exception 'Financial permission required'; end if;
      for k in select key from (
        select jsonb_object_keys(old_req) key union select jsonb_object_keys(new_req) key
      ) fields loop
        old_val := old_req->k; new_val := new_req->k;
        if old_val is not distinct from new_val then continue; end if;
        if k in ('requirement','material','quantity','dimension','artwork_link','req_delivery_date','remark_marketing','remark_procurement','urgency_reason','raised_date','custom','collateral_id','request_type_id','ops_poc_id','marketing_poc_id','committed_date') then
          if not can_edit then raise exception 'Request edit permission required'; end if;
        elsif k in ('status','status_reason') then
          if not can_edit or not coalesce(role_perms ? 'requests.hold',false) then raise exception 'Request status permission required'; end if;
        elsif k='steps' then
          if not coalesce(role_perms ? 'steps.override',false) and not coalesce(role_perms ? 'steps.update',false) then raise exception 'Workflow permission required'; end if;
          for step_item in select value from jsonb_array_elements(coalesce(old_val,'[]'::jsonb)) loop
            select value into new_step from jsonb_array_elements(coalesce(new_val,'[]'::jsonb)) where value->>'id'=step_item->>'id' limit 1;
            if new_step is null then raise exception 'Workflow steps cannot be removed'; end if;
            if new_step is distinct from step_item then
              if not coalesce(role_perms ? 'steps.override',false) then
                if not coalesce(role_perms ? 'steps.update',false) or not exists(select 1 from jsonb_array_elements_text(coalesce(step_item->'update_roles','[]'::jsonb)) assigned(value) where assigned.value::integer=role_id) or step_item->>'is_active'<>'true' then raise exception 'This workflow step is not assigned to your role'; end if;
                if (step_item - array['status','done_date','done_by','done_by_name','remark','is_active','start_date','elapsed','tat','due_date','overdue_days','late_by','esc_level']) is distinct from (new_step - array['status','done_date','done_by','done_by_name','remark','is_active','start_date','elapsed','tat','due_date','overdue_days','late_by','esc_level']) then raise exception 'Workflow configuration is protected'; end if;
                if new_step->>'status'<>'done' or new_step->>'done_by'<>caller::text or new_step->>'done_date' is distinct from today::text then raise exception 'Assigned users may only complete their active step today'; end if;
                if coalesce((step_item->>'req_quotes')::boolean,false) and jsonb_array_length(jsonb_path_query_array(new_req,'$.quotes[*] ? (@.rate != null)')) < coalesce((new_req->>'min_quotes')::integer,1) then raise exception 'Required quotes are missing'; end if;
                if coalesce((step_item->>'req_vendor')::boolean,false) and new_req->>'vendor_id' is null then raise exception 'A vendor must be selected first'; end if;
                if coalesce((step_item->>'req_attachment')::boolean,false) and not exists(select 1 from jsonb_array_elements(coalesce(new_req->'attachments','[]'::jsonb)) a where a->>'step_id'=step_item->>'id') then raise exception 'The required owner attachment is missing'; end if;
              end if;
            end if;
          end loop;
          if jsonb_array_length(coalesce(old_val,'[]'::jsonb))<>jsonb_array_length(coalesce(new_val,'[]'::jsonb)) and not coalesce(role_perms ? 'steps.override',false) then raise exception 'Workflow steps cannot be added'; end if;
        elsif k='comments' then
          if not coalesce(role_perms ? 'comments.add',false) or jsonb_array_length(coalesce(new_val,'[]'::jsonb))<jsonb_array_length(coalesce(old_val,'[]'::jsonb)) then raise exception 'Comment permission required'; end if;
          if (select coalesce(jsonb_agg(v order by ord),'[]'::jsonb) from jsonb_array_elements(coalesce(new_val,'[]'::jsonb)) with ordinality e(v,ord) where ord<=jsonb_array_length(coalesce(old_val,'[]'::jsonb))) is distinct from coalesce(old_val,'[]'::jsonb) then raise exception 'Existing comments cannot be edited'; end if;
          for step_item in select value from jsonb_array_elements(coalesce(new_val,'[]'::jsonb)) offset jsonb_array_length(coalesce(old_val,'[]'::jsonb)) loop
            if step_item->>'user_id'<>caller::text then raise exception 'Comments must identify the signed-in user'; end if;
          end loop;
        elsif k='quotes' then
          if not coalesce(role_perms ? 'quotes.manage',false) or not coalesce(role_perms ? 'financials.view',false) then raise exception 'Quote management and financial permission required'; end if;
        elsif k='issues' then
          if not coalesce(role_perms ? 'issues.manage',false) then raise exception 'Issue management permission required'; end if;
        elsif k='attachments' then
          raise exception 'Only the primary owner can change attachments';
        elsif k in ('activity','updated_at','current_steps','current_step','progress','age','delivered_date','actual_dispatch','lead_start','expected_dispatch','production_tat','e2e_tat','flags','strip','vendor_name','issue_count','open_issue_count','quote_count','comment_count','attachment_count') then
          null;
        else
          raise exception 'Protected request field: %',k;
        end if;
      end loop;
    end loop;
    if new_payload->>'sequence' is distinct from old_payload->>'sequence' and abs(coalesce((new_payload->>'sequence')::bigint,0)-coalesce((old_payload->>'sequence')::bigint,0))>10000 then raise exception 'Invalid sequence'; end if;
    new_payload := jsonb_set(new_payload,'{overview}',old_payload->'overview',true);
    new_payload := jsonb_set(new_payload,'{reports}',old_payload->'reports',true);
    new_payload := jsonb_set(new_payload,'{meta,users}',coalesce(old_payload->'meta'->'users','[]'::jsonb),true);
  end if;
  if exists(select 1 from public.bpro_profiles p where p.role_id is not null and not exists(select 1 from jsonb_array_elements(new_payload->'overview'->'roles') r where (r->>'id')::integer=p.role_id)) then
    raise exception 'Reassign all users before removing their role';
  end if;
  update public.bpro_state set payload=new_payload,revision=revision+1,updated_at=now() where id=1 and revision=expected_revision;
  if not found then return jsonb_build_object('saved',false); end if;
  insert into public.bpro_audit(user_id,user_name,action,detail)
  select caller,p.name,left(action_name,200),'' from public.bpro_profiles p where p.id=caller;
  return jsonb_build_object('saved',true,'revision',expected_revision+1);
end $$;

create or replace function public.bpro_direct_list_users()
returns table(id uuid,email text,name text,active boolean,role_id integer,role_name text,is_owner boolean,last_login timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.bpro_is_owner() then raise exception 'Primary owner required'; end if;
  return query select p.id,p.email,p.name,p.active,p.role_id,
    coalesce((select r->>'name' from public.bpro_state s,jsonb_array_elements(s.payload->'overview'->'roles') r where s.id=1 and (r->>'id')::integer=p.role_id),'Unassigned'),
    exists(select 1 from public.bpro_owner o where o.user_id=p.id),u.last_sign_in_at
  from public.bpro_profiles p join auth.users u on u.id=p.id order by p.email;
end $$;

create or replace function public.bpro_direct_list_audit(row_limit integer default 300)
returns setof public.bpro_audit language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.bpro_is_owner() then raise exception 'Primary owner required'; end if;
  return query select a.* from public.bpro_audit a order by a.created_at desc limit greatest(1,least(coalesce(row_limit,300),1000));
end $$;

create or replace function public.bpro_assign_role_direct(target_id uuid,new_role integer,enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if not public.bpro_is_owner() then raise exception 'Primary owner required'; end if;
  if exists(select 1 from public.bpro_owner o where o.user_id=target_id) then raise exception 'Primary owner is protected'; end if;
  if new_role is not null and not exists(select 1 from public.bpro_state s,jsonb_array_elements(s.payload->'overview'->'roles') r where s.id=1 and (r->>'id')::integer=new_role) then raise exception 'Unknown role'; end if;
  update public.bpro_profiles set role_id=new_role,active=enabled,updated_at=now() where id=target_id;
  if not found then raise exception 'Auth user not found'; end if;
  insert into public.bpro_audit(user_id,user_name,action,detail)
  select actor,p.name,'role_assigned',target_id::text||': role '||coalesce(new_role::text,'unassigned')||', active '||enabled::text from public.bpro_profiles p where p.id=actor;
end $$;

create or replace function public.bpro_can_read_file(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); profile public.bpro_profiles; owner_user boolean; payload jsonb; req jsonb; perms jsonb; request_id text;
begin
  if caller is null then return false; end if;
  owner_user := public.bpro_is_owner();
  if owner_user then return true; end if;
  select p.* into profile from public.bpro_profiles p where p.id=caller and p.active and p.role_id is not null;
  if profile.id is null then return false; end if;
  select s.payload into payload from public.bpro_state s where s.id=1;
  select r->'permissions' into perms from jsonb_array_elements(payload->'overview'->'roles') r where (r->>'id')::integer=profile.role_id;
  request_id := split_part(object_name,'/',1);
  req := payload->'req'->request_id;
  return req is not null and (coalesce(perms ? 'requests.view_all',false) or req->>'created_by'=caller::text or req->>'ops_poc_id'=caller::text or req->>'marketing_poc_id'=caller::text);
end $$;

revoke all on function public.bpro_is_owner(), public.bpro_active_profile(), public.bpro_direct_context(), public.bpro_redact_financials(jsonb), public.bpro_sensitive_values(jsonb), public.bpro_restore_hidden_financials(jsonb,jsonb), public.bpro_direct_read_state(), public.bpro_direct_read_snapshot(), public.bpro_direct_commit(bigint,jsonb,text), public.bpro_direct_list_users(), public.bpro_direct_list_audit(integer), public.bpro_assign_role_direct(uuid,integer,boolean), public.bpro_can_read_file(text) from public,anon,authenticated;
grant execute on function public.bpro_direct_context(), public.bpro_direct_read_state(), public.bpro_direct_read_snapshot(), public.bpro_direct_commit(bigint,jsonb,text), public.bpro_direct_list_users(), public.bpro_direct_list_audit(integer), public.bpro_assign_role_direct(uuid,integer,boolean) to authenticated;
grant execute on function public.bpro_is_owner(), public.bpro_can_read_file(text) to authenticated;

drop policy if exists bpro_no_client_storage on storage.objects;
drop policy if exists bpro_direct_file_read on storage.objects;
drop policy if exists bpro_direct_file_select on storage.objects;
drop policy if exists bpro_direct_file_insert on storage.objects;
drop policy if exists bpro_direct_file_update on storage.objects;
drop policy if exists bpro_direct_file_delete on storage.objects;
drop policy if exists bpro_direct_file_owner_insert on storage.objects;
drop policy if exists bpro_direct_file_owner_update on storage.objects;
drop policy if exists bpro_direct_file_owner_delete on storage.objects;
create policy bpro_direct_file_select on storage.objects for select to authenticated using (bucket_id='bpro-files' and public.bpro_can_read_file(name));
create policy bpro_direct_file_insert on storage.objects for insert to authenticated with check (bucket_id='bpro-files' and public.bpro_is_owner());
create policy bpro_direct_file_update on storage.objects for update to authenticated using (bucket_id='bpro-files' and public.bpro_is_owner()) with check (bucket_id='bpro-files' and public.bpro_is_owner());
create policy bpro_direct_file_delete on storage.objects for delete to authenticated using (bucket_id='bpro-files' and public.bpro_is_owner());
create policy bpro_direct_file_read on storage.objects as restrictive for select to authenticated using (bucket_id <> 'bpro-files' or public.bpro_can_read_file(name));
create policy bpro_direct_file_owner_insert on storage.objects as restrictive for insert to authenticated with check (bucket_id <> 'bpro-files' or public.bpro_is_owner());
create policy bpro_direct_file_owner_update on storage.objects as restrictive for update to authenticated using (bucket_id <> 'bpro-files' or public.bpro_is_owner()) with check (bucket_id <> 'bpro-files' or public.bpro_is_owner());
create policy bpro_direct_file_owner_delete on storage.objects as restrictive for delete to authenticated using (bucket_id <> 'bpro-files' or public.bpro_is_owner());
commit;
