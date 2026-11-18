-- The admin belongs to the owner alone. While admin_locked is true, nobody can be added to the Taprizz team
-- and no team invite can be created. To add a teammate one day, set app_settings admin_locked to false first.
insert into app_settings (key, value) values ('admin_locked', 'true'::jsonb) on conflict (key) do nothing;

create or replace function public.guard_admin_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select (value #>> '{}')::boolean from app_settings where key = 'admin_locked'), true) then
    raise exception 'Admin access is locked to the owner';
  end if;
  return new;
end $$;

create or replace function public.guard_team_invite_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'team' and coalesce((select (value #>> '{}')::boolean from app_settings where key = 'admin_locked'), true) then
    raise exception 'Admin access is locked to the owner';
  end if;
  return new;
end $$;

drop trigger if exists team_members_locked on team_members;
create trigger team_members_locked before insert or update on team_members for each row execute function guard_admin_lock();
drop trigger if exists invites_team_locked on invites;
create trigger invites_team_locked before insert or update on invites for each row execute function guard_team_invite_lock();
