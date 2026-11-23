-- One place for announcements: a live offer added in the business dashboard also shows on the mini link (alongside any offers set for it by Taprizz).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.public_link_page(text)'::regprocedure);
  if d not like '%from offers o where l.client_id%' then
    d := replace(d, '''offers'', l.offers,', '''offers'', coalesce(l.offers, ''[]''::jsonb) || coalesce((select jsonb_agg(jsonb_build_object(''outlet'', l.name, ''title'', o.title, ''details'', o.details, ''valid_till'', o.ends_at) order by o.created_at desc) from offers o where l.client_id is not null and o.client_id = l.client_id and (o.starts_at is null or o.starts_at <= (now() at time zone ''Asia/Kolkata'')::date) and (o.ends_at is null or o.ends_at >= (now() at time zone ''Asia/Kolkata'')::date)), ''[]''::jsonb),');
    execute d;
  end if;
end $$;
