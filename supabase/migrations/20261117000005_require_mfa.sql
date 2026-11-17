-- Owner and admin data is only readable after the second factor (aal2).
-- Guest functions are unaffected: they never call these helpers for access.
create or replace function has_aal2()
returns boolean language sql stable as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;

create or replace function is_team(min_role team_role default 'rep')
returns boolean language sql stable security definer set search_path = public as $$
  select has_aal2() and exists (
    select 1 from team_members t
    where t.user_id = auth.uid()
      and (min_role = 'rep'
        or (min_role = 'manager' and t.role in ('owner','manager'))
        or (min_role = 'owner' and t.role = 'owner'))
  );
$$;

create or replace function is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_aal2() and (
    exists (select 1 from client_members m where m.client_id = cid and m.user_id = auth.uid())
    or is_team('rep'));
$$;

grant execute on function has_aal2() to authenticated;
alter function has_aal2() set search_path = public;

-- Owners list their own memberships (needed before choosing a client).
drop policy if exists members_read on client_members;
create policy members_read on client_members for select to authenticated
using ((user_id = auth.uid() and has_aal2()) or is_team('rep'));

-- Resolving a complaint stamps the time; used for "resolved in" in the monthly report.
create or replace function feedback_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then new.resolved_at := now(); end if;
  if new.status <> 'resolved' then new.resolved_at := null; end if;
  return new;
end $$;
create trigger feedback_stamp before update on feedback for each row execute function feedback_stamp();
revoke execute on function feedback_stamp() from public, anon, authenticated;
