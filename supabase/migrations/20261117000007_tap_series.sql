-- Daily tap counts (India time) for the dashboard Peak Chart. Runs as the caller, so RLS on taps applies.
create or replace function client_tap_days(p_client uuid, p_days int default 730)
returns table (day date, taps int) language sql stable security invoker set search_path = public as $$
  select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as taps
  from taps
  where client_id = p_client and created_at > now() - make_interval(days => least(p_days, 800))
  group by 1 order by 1;
$$;
revoke execute on function client_tap_days(uuid, int) from public, anon;
grant execute on function client_tap_days(uuid, int) to authenticated;
