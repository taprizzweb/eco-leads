-- Admin panel support: invites, team helpers, audit trail.

-- ------------------------------------------------------------------ invites
-- "Taprizz sets up your page and sends you an invite": an invite is claimed the first time the
-- invited email signs in (Google or a confirmed email account), which links them to the business or team.
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind text not null check (kind in ('client', 'team')),
  client_id uuid references clients on delete cascade,
  member_role member_role not null default 'owner',
  team_role team_role not null default 'rep',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users on delete set null,
  check ((kind = 'client' and client_id is not null) or (kind = 'team' and client_id is null))
);
create index if not exists invites_email_idx on invites (email) where claimed_at is null;
alter table invites enable row level security;
create policy invites_manage on invites for all to authenticated using (is_team('manager')) with check (is_team('manager'));

create or replace function claim_invites()
returns int language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text; confirmed timestamptz; i invites; n int := 0;
begin
  if uid is null then return 0; end if;
  select lower(email), email_confirmed_at into mail, confirmed from auth.users where id = uid;
  if mail is null or confirmed is null then return 0; end if;     -- only verified emails can claim
  for i in select * from invites where email = mail and claimed_at is null loop
    if i.kind = 'client' then
      insert into client_members (client_id, user_id, role) values (i.client_id, uid, i.member_role) on conflict do nothing;
    else
      insert into team_members (user_id, role) values (uid, i.team_role) on conflict (user_id) do nothing;
    end if;
    update invites set claimed_at = now(), claimed_by = uid where id = i.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------------ team helpers
create or replace function my_team_role()
returns text language sql stable security definer set search_path = public as $$
  select t.role::text from team_members t where t.user_id = auth.uid() and has_aal2();
$$;

create or replace function admin_team_list()
returns table (user_id uuid, email text, role team_role, created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.user_id, u.email::text, t.role, t.created_at, u.last_sign_in_at
  from team_members t join auth.users u on u.id = t.user_id
  where is_team('manager') order by t.created_at;
$$;

create or replace function admin_client_members(p_client uuid)
returns table (user_id uuid, email text, role member_role, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from client_members m join auth.users u on u.id = m.user_id
  where m.client_id = p_client and is_team('rep') order by m.created_at;
$$;

-- ------------------------------------------------------------------ audit trail
create or replace function audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid; detail jsonb;
begin
  detail := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  cid := case tg_table_name
           when 'clients' then (detail->>'id')::uuid
           when 'plates' then nullif(detail->>'client_id', '')::uuid
           when 'client_members' then nullif(detail->>'client_id', '')::uuid
           when 'invites' then nullif(detail->>'client_id', '')::uuid
           else null end;
  insert into audit_log (actor, client_id, action, detail)
  values (auth.uid(), cid, tg_table_name || '.' || lower(tg_op),
          detail - 'encrypted_password' - 'token_hash');
  return null;
end $$;
revoke execute on function audit_row() from public, anon, authenticated;

drop trigger if exists audit_plates on plates;
create trigger audit_plates after insert or update or delete on plates for each row execute function audit_row();
drop trigger if exists audit_team on team_members;
create trigger audit_team after insert or update or delete on team_members for each row execute function audit_row();
drop trigger if exists audit_members on client_members;
create trigger audit_members after insert or delete on client_members for each row execute function audit_row();
drop trigger if exists audit_packages on packages;
create trigger audit_packages after update on packages for each row execute function audit_row();
drop trigger if exists audit_invites on invites;
create trigger audit_invites after insert on invites for each row execute function audit_row();
drop trigger if exists audit_clients_ins on clients;
create trigger audit_clients_ins after insert or delete on clients for each row execute function audit_row();

-- ------------------------------------------------------------------ grants
revoke all on invites from anon;
revoke execute on function claim_invites() from public, anon;
revoke execute on function my_team_role() from public, anon;
revoke execute on function admin_team_list() from public, anon;
revoke execute on function admin_client_members(uuid) from public, anon;
grant execute on function claim_invites() to authenticated;
grant execute on function my_team_role() to authenticated;
grant execute on function admin_team_list() to authenticated;
grant execute on function admin_client_members(uuid) to authenticated;

-- Reps can read audit entries for clients they manage; managers read everything (existing policy).
