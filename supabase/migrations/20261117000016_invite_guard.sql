-- Anyone who can manage clients may invite a business owner, but only a Taprizz owner may invite team members.
-- (Claiming a team invite adds the person to team_members, so this closes a promotion path for managers.)
drop policy if exists invites_manage on invites;
create policy invites_manage on invites for all to authenticated
  using (is_team('manager') and (kind = 'client' or is_team('owner')))
  with check (is_team('manager') and (kind = 'client' or is_team('owner')));
