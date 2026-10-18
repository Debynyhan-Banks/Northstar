-- Run only against a disposable empty PostgreSQL database; mocks Supabase Auth.
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
\ir ../database/supabase-schema.sql

create function public.expect_denied(statement text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    return;
  end;
  raise exception 'Expected this operation to be denied: %', statement;
end;
$$;
insert into auth.users values
  ('11111111-1111-4111-8111-111111111111','christian@example.test',now()),
  ('22222222-2222-4222-8222-222222222222','partner@example.test',now()),
  ('33333333-3333-4333-8333-333333333333','outsider@example.test',now()),
  ('44444444-4444-4444-8444-444444444444','unverified@example.test',null);
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
select public.expect_denied($q$select public.create_growth_workspace('Unverified','christian')$q$);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_growth_workspace('C.F. Mechanical','christian') as wid \gset
insert into public.workspace_invitations(workspace_id,email,seat)
 values (:'wid','partner@example.test','growth');
insert into public.app_records(workspace_id,category,object_id,body)
 values (:'wid','response','christian:primary_goal',
 '{"seat":"christian","respondent_uid":"11111111-1111-4111-8111-111111111111","value":"A"}');
insert into public.app_records(workspace_id,category,object_id,body)
 values (:'wid','task','test-task','{"title":"First"}');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select 1 / (public.claim_workspace_invitation())::int;
insert into public.app_records(workspace_id,category,object_id,body)
 values (:'wid','response','growth:primary_goal',
 '{"seat":"growth","respondent_uid":"22222222-2222-4222-8222-222222222222","value":"B"}')
 on conflict (workspace_id,category,object_id) do update set body=excluded.body;
insert into public.app_records(workspace_id,category,object_id,body)
 values (:'wid','response','growth:primary_goal',
 '{"seat":"growth","respondent_uid":"22222222-2222-4222-8222-222222222222","value":"C"}')
 on conflict (workspace_id,category,object_id) do update set body=excluded.body;
select 1 / (body->>'value'='C')::int from public.app_records where object_id='growth:primary_goal';
with changed as (
  update public.app_records set body='{"seat":"growth","respondent_uid":"22222222-2222-4222-8222-222222222222"}'
   where object_id='christian:primary_goal' returning 1
) select 1 / (count(*)=0)::int from changed;
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'response','christian:unanswered','{"seat":"growth","respondent_uid":"22222222-2222-4222-8222-222222222222","value":"forged"}')$q$, :'wid'));
select public.expect_denied($q$update public.app_records set category='response', object_id='christian:forged' where object_id='test-task'$q$);
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'comment','fake-comment','{"author":"christian","message":"forged"}')$q$, :'wid'));
insert into public.app_records(workspace_id,category,object_id,body)
 values (:'wid','task','test-task','{"title":"Updated by partner"}')
 on conflict (workspace_id,category,object_id) do update set body=excluded.body;
select 1 / (body->>'title'='Updated by partner')::int from public.app_records where object_id='test-task';
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select 1 / (count(*)=0)::int from public.app_records;
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'task','outside','{"title":"unauthorized"}')$q$, :'wid'));
reset role;
