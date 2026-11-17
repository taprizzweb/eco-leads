-- Internal helpers must not be callable over the API.
revoke execute on function guest_rate_ok(uuid, text, int, interval) from public, anon, authenticated;
revoke execute on function guard_client_billing_fields() from public, anon, authenticated;
alter function client_is_live(clients) set search_path = public;
-- New functions are private by default; grant explicitly when a function is meant for the API.
alter default privileges in schema public revoke execute on functions from public, anon;
