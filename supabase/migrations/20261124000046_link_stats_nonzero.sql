-- Buttons with no taps in the period are not listed.
create or replace function public._link_stats(p_id uuid, p_days int) returns jsonb
language sql stable security definer set search_path = public as $$
  with n as (select greatest(1, least(coalesce(p_days, 30), 90)) as d),
  days as (
    select g::date as day from n, generate_series(current_date - (n.d - 1), current_date, interval '1 day') g
  ),
  per as (
    select days.day, coalesce(s.views, 0) as views, coalesce(s.clicks, 0) as clicks
    from days left join link_stats s on s.link_id = p_id and s.day = days.day
  ),
  btn as (
    select key, sum(clicks)::int as clicks from link_button_stats, n
    where link_id = p_id and day >= current_date - (n.d - 1) group by key having sum(clicks) > 0 order by sum(clicks) desc limit 40
  )
  select jsonb_build_object(
    'days', (select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'clicks', clicks) order by day) from per),
    'buttons', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'clicks', clicks) order by clicks desc) from btn), '[]'::jsonb),
    'views', (select coalesce(sum(views), 0) from per), 'clicks', (select coalesce(sum(clicks), 0) from per),
    'since_start', (select jsonb_build_object('views', coalesce(sum(views), 0), 'clicks', coalesce(sum(clicks), 0)) from link_stats where link_id = p_id)
  );
$$;
revoke all on function public._link_stats(uuid, int) from public, anon, authenticated;
