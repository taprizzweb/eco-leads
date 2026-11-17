-- One switch for the second sign-in step (WhatsApp code / authenticator app).
-- OFF  -> a signed-in session is enough to open the dashboard.
-- ON   -> the session must also be verified (authenticator, WhatsApp code or trusted device).
-- Turn it back on any time:  update app_settings set value = 'true'::jsonb where key = 'require_second_step';
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;   -- no policies: only the functions below read it

insert into app_settings (key, value) values ('require_second_step', 'false'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function second_step_required()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text::boolean from app_settings where key = 'require_second_step'), true);
$$;
revoke execute on function second_step_required() from public, anon, authenticated;

create or replace function has_aal2()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
        not second_step_required()
     or coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
     or exists (select 1 from verified_sessions v
                where v.session_id = current_session_id() and v.user_id = auth.uid()
                  and v.verified_at > now() - interval '30 days'));
$$;
