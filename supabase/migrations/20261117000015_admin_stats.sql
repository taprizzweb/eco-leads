-- One row per client with the numbers the admin panel shows. Runs as the caller, so RLS still applies.
create or replace function admin_client_stats()
returns table (client_id uuid, taps_30d int, taps_month int, last_tap_at timestamptz, reviews_month int,
               open_complaints int, late_complaints int, plates int)
language sql stable security invoker set search_path = public as $$
  select c.id,
    (select count(*)::int from taps t where t.client_id = c.id and t.created_at > now() - interval '30 days'),
    (select count(*)::int from taps t where t.client_id = c.id
        and t.created_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata'),
    (select max(t.created_at) from taps t where t.client_id = c.id),
    (select count(*)::int from review_drafts r where r.client_id = c.id and r.copied
        and r.created_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata'),
    (select count(*)::int from feedback f where f.client_id = c.id and f.kind = 'complaint' and f.status <> 'resolved'),
    (select count(*)::int from feedback f where f.client_id = c.id and f.kind = 'complaint' and f.status <> 'resolved'
        and f.created_at < now() - interval '24 hours'),
    (select count(*)::int from plates p where p.client_id = c.id and p.active)
  from clients c;
$$;
revoke execute on function admin_client_stats() from public, anon;
grant execute on function admin_client_stats() to authenticated;
