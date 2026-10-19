-- DISPOSABLE EMPTY DATABASE ONLY. This deliberately bootstraps mocked Auth and
-- the original schema by running the existing regression first. Never run this
-- against the live Supabase project or use it as a migration.
\set ON_ERROR_STOP on
\ir supabase-security.test.sql

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

-- Planning documents use shared task policies, while private partner answers
-- and confirmations retain their existing own-seat policies.
insert into public.app_records(workspace_id,category,object_id,body) values
 (:'wid','task','plan:evidence:capacity',
  '{"planningType":"evidence","title":"Delivery capacity","classification":"unknown","details":"Christian to verify","verified":false}'),
 (:'wid','task','plan:proposal:launch',
  '{"planningType":"proposal","title":"Initial revenue test","direction":"Residential pilot","conditions":"Delivery capacity must be confirmed","evidenceIds":["plan:evidence:capacity"]}');
insert into public.app_records(workspace_id,category,object_id,body) values
 (:'wid','vote','christian:confirm:plan:proposal:launch',
  '{"seat":"christian","respondent_uid":"11111111-1111-4111-8111-111111111111","proposalId":"plan:proposal:launch","choice":"confirmed","snapshot":"canonical-content-version-one","confirmedAt":"2026-10-19T12:00:00Z"}');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select 1 / ((select count(*) from public.app_records where object_id in ('plan:evidence:capacity','plan:proposal:launch'))=2)::int;
select 1 / ((select body->>'classification' from public.app_records where object_id='plan:evidence:capacity')='unknown')::int;

-- Both members can maintain the planning documents; an estimate is still an
-- estimate. The UI's canonical content check invalidates existing approvals.
update public.app_records set body=body || '{"details":"Weekends need verification","classification":"estimate","verified":false}'
 where object_id='plan:evidence:capacity';
update public.app_records set body=body || '{"direction":"Review residential and small commercial capacity"}'
 where object_id='plan:proposal:launch';
insert into public.app_records(workspace_id,category,object_id,body) values
 (:'wid','vote','growth:confirm:plan:proposal:launch',
  '{"seat":"growth","respondent_uid":"22222222-2222-4222-8222-222222222222","proposalId":"plan:proposal:launch","choice":"confirmed","snapshot":"canonical-content-version-two","confirmedAt":"2026-10-19T13:00:00Z"}');

-- A shared planning document cannot be transformed into another partner's vote.
select public.expect_denied($q$update public.app_records
 set category='vote',object_id='christian:confirm:plan:proposal:forged',
 body='{"seat":"christian","respondent_uid":"11111111-1111-4111-8111-111111111111","choice":"confirmed"}'
 where object_id='plan:proposal:launch'$q$);

-- A member may not insert or update an approval using the other seat, their
-- own uid under the other seat, or the other uid under their own seat.
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'vote','christian:confirm:plan:proposal:other',
 '{"seat":"christian","respondent_uid":"11111111-1111-4111-8111-111111111111","choice":"confirmed"}')$q$, :'wid'));
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'vote','christian:confirm:plan:proposal:wrong-prefix',
 '{"seat":"growth","respondent_uid":"22222222-2222-4222-8222-222222222222","choice":"confirmed"}')$q$, :'wid'));
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'vote','growth:confirm:plan:proposal:wrong-uid',
 '{"seat":"growth","respondent_uid":"11111111-1111-4111-8111-111111111111","choice":"confirmed"}')$q$, :'wid'));
with changed as (
 update public.app_records set body=body || '{"snapshot":"forged-approval"}'
 where object_id='christian:confirm:plan:proposal:launch' returning 1
) select 1 / (count(*)=0)::int from changed;

-- The member can revise their own confirmation; changing its immutable identity
-- or respondent metadata to the other partner is refused.
update public.app_records set body=body || '{"snapshot":"my-revised-confirmation"}'
 where object_id='growth:confirm:plan:proposal:launch';
select public.expect_denied($q$update public.app_records
 set body=body || '{"seat":"christian","respondent_uid":"11111111-1111-4111-8111-111111111111"}'
 where object_id='growth:confirm:plan:proposal:launch'$q$);
select 1 / ((select body->>'snapshot' from public.app_records where object_id='growth:confirm:plan:proposal:launch')='my-revised-confirmation')::int;
select 1 / ((select body->>'snapshot' from public.app_records where object_id='christian:confirm:plan:proposal:launch')='canonical-content-version-one')::int;

-- Historical response values are preserved by new planning writes.
select 1 / ((select body->>'value' from public.app_records where object_id='christian:primary_goal')='A')::int;
select 1 / ((select body->>'value' from public.app_records where object_id='growth:primary_goal')='C')::int;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select 1 / ((select body->>'details' from public.app_records where object_id='plan:evidence:capacity')='Weekends need verification')::int;
select 1 / ((select count(*) from public.app_records where category='vote' and object_id like '%:confirm:%')=2)::int;
with changed as (
 update public.app_records set body=body || '{"snapshot":"president-cannot-forge-partner"}'
 where object_id='growth:confirm:plan:proposal:launch' returning 1
) select 1 / (count(*)=0)::int from changed;

-- New typed documents inherit the same shared planning boundary without a
-- schema reset or weaker partner-specific confirmation permissions.
insert into public.app_records(workspace_id,category,object_id,body) values
 (:'wid','task','plan:charter:charter','{"id":"charter","planningType":"charter","mandate":"Proposed operating scope","sourceRefs":["response:christian:primary_goal"]}'),
 (:'wid','task','plan:segment:homeowners','{"id":"homeowners","planningType":"segment","title":"Proposed homeowner segment"}'),
 (:'wid','task','plan:website-brief:website-brief','{"id":"website-brief","planningType":"website-brief","audience":"Proposed segment"}'),
 (:'wid','task','plan:forecast-baseline:test-baseline','{"id":"test-baseline","planningType":"forecast-baseline","scenario":"base","snapshot":{"revenue":100}}');
insert into public.app_records(workspace_id,category,object_id,body) values
 (:'wid','vote','christian:confirm:charter',
  '{"seat":"christian","respondent_uid":"11111111-1111-4111-8111-111111111111","proposalId":"charter","choice":"confirmed","snapshot":"exact-charter-and-linked-sources","confirmedAt":"2026-10-19T15:00:00Z"}');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select 1 / ((select count(*) from public.app_records where object_id in ('plan:charter:charter','plan:segment:homeowners','plan:website-brief:website-brief','plan:forecast-baseline:test-baseline'))=4)::int;
update public.app_records set body=body || '{"mandate":"Revised proposal for discussion"}' where object_id='plan:charter:charter';
with changed as (
 update public.app_records set body=body || '{"snapshot":"forged-partner-charter"}'
 where object_id='christian:confirm:charter' returning 1
) select 1 / (count(*)=0)::int from changed;
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'vote','christian:confirm:strategy-brief',
 '{"seat":"christian","respondent_uid":"11111111-1111-4111-8111-111111111111","choice":"confirmed"}')$q$, :'wid'));
insert into public.app_records(workspace_id,category,object_id,body) values
 (:'wid','vote','growth:confirm:charter',
  '{"seat":"growth","respondent_uid":"22222222-2222-4222-8222-222222222222","proposalId":"charter","choice":"confirmed","snapshot":"revised-charter-and-linked-sources","confirmedAt":"2026-10-19T16:00:00Z"}');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
with changed as (
 update public.app_records set body=body || '{"snapshot":"president-cannot-confirm-for-partner"}'
 where object_id='growth:confirm:charter' returning 1
) select 1 / (count(*)=0)::int from changed;

-- A third account has neither shared planning visibility nor write authority.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select 1 / ((select count(*) from public.app_records)=0)::int;
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'task','plan:evidence:outside','{"planningType":"evidence","title":"Unauthorized"}')$q$, :'wid'));
select public.expect_denied(format($q$insert into public.app_records(workspace_id,category,object_id,body)
 values (%L,'vote','christian:confirm:plan:proposal:outside',
 '{"seat":"christian","respondent_uid":"33333333-3333-4333-8333-333333333333","choice":"confirmed"}')$q$, :'wid'));
with changed as (
 update public.app_records set body='{"planningType":"evidence","details":"Hidden tampering"}'
 where object_id='plan:evidence:capacity' returning 1
) select 1 / (count(*)=0)::int from changed;
reset role;

-- Check as test administrator that outsider attempts changed no persisted data.
select 1 / ((select body->>'classification' from public.app_records where object_id='plan:evidence:capacity')='estimate')::int;
select 1 / ((select body->>'verified' from public.app_records where object_id='plan:evidence:capacity')='false')::int;
select 1 / ((select body->>'snapshot' from public.app_records where object_id='growth:confirm:plan:proposal:launch')='my-revised-confirmation')::int;
