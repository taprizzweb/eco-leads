-- Tables added after the first lock-down inherit Supabase's default grants. Row-level security already
-- returns nothing to the public, but they should not answer public requests at all.
revoke all on app_settings, otp_codes, verified_sessions, user_security, trusted_devices from anon;
revoke all on app_settings, otp_codes, verified_sessions, user_security from authenticated;
-- New tables are private to the public by default from now on.
alter default privileges in schema public revoke all on tables from anon;
