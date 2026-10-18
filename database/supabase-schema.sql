-- C.F. Mechanical Growth Workspace: private, two-person backend
-- Run in a NEW Supabase project using SQL Editor. Recommended: enable email confirmation.
-- Only the PUBLIC anon key belongs in config.js; NEVER put a service_role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 150),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat text not null check (seat in ('christian','growth')),
  display_name text not null,
  role text not null check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id,user_id),
  unique (workspace_id,seat)
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  seat text not null check (seat in ('christian','growth')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (length(email) <= 254)
);

create index if not exists workspace_invites_email_idx on public.workspace_invitations (lower(email)) where accepted_at is null;

create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category text not null check (category in ('response','vote','task','comment','update','event','opportunity')),
  object_id text not null check (length(object_id) between 1 and 150),
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id,category,object_id)
);
create index if not exists app_records_workspace_idx on public.app_records(workspace_id,category);

-- A row's ownership and identity cannot be changed after insertion, even by
-- another member with permission to edit shared tasks or opportunities.
create or replace function public.keep_growth_record_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id
     or new.category is distinct from old.category or new.object_id is distinct from old.object_id
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Record identity cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger app_records_immutable_identity before update on public.app_records
 for each row execute function public.keep_growth_record_identity();

-- SECURITY DEFINER membership checks avoid recursive RLS lookup on workspace_members.
create or replace function public.is_growth_member(p_workspace_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_growth_owner(p_workspace_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function public.is_growth_seat(p_workspace_id uuid,p_seat text)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid()) and m.seat = p_seat
  );
$$;

-- Creates a workspace with exactly one originating partner.
create or replace function public.create_growth_workspace(p_name text,p_seat text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_workspace uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Verify your email address before creating a workspace';
  end if;
  if p_seat not in ('christian','growth') then raise exception 'Invalid role'; end if;
  if length(trim(p_name)) not between 2 and 150 then raise exception 'Invalid name'; end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a workspace';
  end if;
  insert into public.workspaces(name,created_by) values(trim(p_name),auth.uid()) returning id into v_workspace;
  insert into public.workspace_members(workspace_id,user_id,seat,display_name,role)
  values (v_workspace,auth.uid(),p_seat,
    case when p_seat='christian' then 'Christian Okoh' else 'Debynyhan Banks' end,'owner');
  return v_workspace;
end;
$$;

-- Invitation is bound to the sign-in email, confirmed by Supabase Auth.
-- The invitation itself is created by the owner via RLS, not by this function.
create or replace function public.claim_workspace_invitation()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_email text;v_invite public.workspace_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select email into v_email from auth.users
   where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Verify your email address before joining'; end if;
  if exists(select 1 from public.workspace_members where user_id=auth.uid()) then
    raise exception 'You already belong to a workspace'; end if;
  select * into v_invite from public.workspace_invitations
   where lower(email)=lower(v_email) and accepted_at is null
   order by created_at desc limit 1 for update;
  if not found then return false; end if;
  if (select count(*) from public.workspace_members where workspace_id=v_invite.workspace_id)>=2 then
    raise exception 'This workspace already has two members'; end if;
  insert into public.workspace_members(workspace_id,user_id,seat,display_name,role)
   values(v_invite.workspace_id,auth.uid(),v_invite.seat,
     case when v_invite.seat='christian' then 'Christian Okoh' else 'Debynyhan Banks' end,'member');
  update public.workspace_invitations set accepted_at=now() where id=v_invite.id;
  return true;
end;
$$;

revoke all on function public.create_growth_workspace(text,text) from public, anon;
revoke all on function public.claim_workspace_invitation() from public, anon;
grant execute on function public.create_growth_workspace(text,text) to authenticated;
grant execute on function public.claim_workspace_invitation() to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.app_records enable row level security;

create policy "workspace private read" on public.workspaces
 for select to authenticated using (public.is_growth_member(id));

create policy "members visible within workspace" on public.workspace_members
 for select to authenticated using (public.is_growth_member(workspace_id));
-- Membership writes are performed only through the controlled functions above.

create policy "owner can view workspace invitations" on public.workspace_invitations
 for select to authenticated using (public.is_growth_owner(workspace_id));
create policy "owner can invite one other seat" on public.workspace_invitations
 for insert to authenticated with check (
   public.is_growth_owner(workspace_id)
   and created_by = auth.uid()
   and not public.is_growth_seat(workspace_id,seat)
   and (select count(*) from public.workspace_members m where m.workspace_id=workspace_invitations.workspace_id) < 2
 );

create policy "records readable only by members" on public.app_records
 for select to authenticated using (public.is_growth_member(workspace_id));

create policy "members create allowed records" on public.app_records
 for insert to authenticated with check (
   public.is_growth_member(workspace_id)
   and created_by=auth.uid()
   and (
     (category in ('task','opportunity'))
     or (category in ('comment','update') and public.is_growth_seat(workspace_id,body->>'author'))
     or (category='event' and public.is_growth_seat(workspace_id,body->>'actor'))
     or (category in ('response','vote') and (body->>'respondent_uid')=auth.uid()::text
         and public.is_growth_seat(workspace_id,body->>'seat')
         and object_id like (body->>'seat') || ':%')
   )
 );

create policy "members update shared data or own answers" on public.app_records
 for update to authenticated
 using (
   public.is_growth_member(workspace_id)
   and (category not in ('response','vote') or
        ((body->>'respondent_uid')=auth.uid()::text and public.is_growth_seat(workspace_id,body->>'seat')
         and object_id like (body->>'seat') || ':%'))
   and category not in ('event','comment','update')
 )
 with check (
   public.is_growth_member(workspace_id)
   and (category not in ('response','vote') or
        ((body->>'respondent_uid')=auth.uid()::text and public.is_growth_seat(workspace_id,body->>'seat')
         and object_id like (body->>'seat') || ':%'))
   and category not in ('event','comment','update')
 );
-- No client delete policy. Events, comments and weekly updates are append-only.
-- Explicit privileges; RLS still controls which rows each member can access.
grant select on public.workspaces, public.workspace_members, public.workspace_invitations, public.app_records to authenticated;
grant insert on public.workspace_invitations, public.app_records to authenticated;
grant update on public.app_records to authenticated;
