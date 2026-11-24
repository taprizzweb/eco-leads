-- Search keywords: phrases people type into Google ("cafe in C-Scheme Jaipur"). Used in review replies and in the mini link's search description.
alter table public.clients add column if not exists seo_keywords text[] not null default '{}';
alter table public.link_pages add column if not exists seo_keywords text[] not null default '{}';

create or replace function public._link_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'slug', l.slug, 'client_id', l.client_id, 'name', l.name, 'tagline', l.tagline, 'logo_url', l.logo_url,
    'theme', l.theme, 'tags', to_jsonb(l.tags), 'socials', l.socials, 'photos', l.photos, 'photo_direction', l.photo_direction,
    'buttons', l.buttons, 'outlets', l.outlets, 'offers', coalesce(l.offers, '[]'::jsonb), 'reviews', l.reviews,
    'show_client_reviews', l.show_client_reviews, 'published', l.published, 'colors', coalesce(l.colors, '{}'::jsonb), 'seo_keywords', to_jsonb(l.seo_keywords))
  from link_pages l where l.id = p_id;
$$;
revoke all on function public._link_json(uuid) from public, anon, authenticated;


create or replace function public._link_apply(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l link_pages; b jsonb; o jsonb; s record; nb jsonb; nph jsonb; nout jsonb; noff jsonb; nsoc jsonb; nth text; ntags text[]; ncol jsonb; nseo text[];
begin
  select * into l from link_pages where id = p_id;
  if l.id is null then raise exception 'not found'; end if;
  if pg_column_size(p) > 400000 then raise exception 'too large'; end if;

  nb := _link_arr(p, 'buttons', 12, l.buttons);
  for b in select * from jsonb_array_elements(nb) loop
    if not _link_url_ok(b ->> 'url', true) then raise exception 'bad button link'; end if;
  end loop;
  nout := _link_arr(p, 'outlets', 30, l.outlets);
  for o in select * from jsonb_array_elements(nout) loop
    if not (_link_url_ok(o ->> 'map_url') and _link_url_ok(o ->> 'review_url') and _link_url_ok(o ->> 'image_url') and _link_url_ok(o ->> 'instagram')) then raise exception 'bad outlet link'; end if;
  end loop;
  noff := _link_arr(p, 'offers', 60, coalesce(l.offers, '[]'::jsonb));
  for o in select * from jsonb_array_elements(noff) loop
    if not _link_url_ok(o ->> 'link') then raise exception 'bad offer link'; end if;
  end loop;
  nph := _link_arr(p, 'photos', 30, l.photos);
  for o in select * from jsonb_array_elements(nph) loop
    if not _link_url_ok(o ->> 'url') then raise exception 'bad photo link'; end if;
  end loop;
  nsoc := case when p ? 'socials' and jsonb_typeof(p -> 'socials') = 'object' then p -> 'socials' else l.socials end;
  for s in select key, value from jsonb_each_text(nsoc) loop
    if s.key not in ('phone', 'whatsapp') and not _link_url_ok(s.value) then raise exception 'bad social link'; end if;
  end loop;
  nth := case when p ? 'theme' and (p ->> 'theme') in ('midnight','graphite','obsidian','ocean','wine','forest','plum','ivory') then p ->> 'theme' else l.theme end;
  ntags := case when p ? 'tags' and jsonb_typeof(p -> 'tags') = 'array' and jsonb_array_length(p -> 'tags') <= 20
    then array(select left(trim(x), 40) from jsonb_array_elements_text(p -> 'tags') x where trim(x) <> '') else l.tags end;
  ncol := case when p ? 'colors' and jsonb_typeof(p -> 'colors') = 'object' then p -> 'colors' else coalesce(l.colors, '{}'::jsonb) end;
  for s in select key, value from jsonb_each_text(ncol) loop
    if s.key not in ('bg', 'accent', 'button') or s.value !~* '^#[0-9a-f]{6}$' then raise exception 'bad colour'; end if;
  end loop;
  nseo := case when p ? 'seo_keywords' and jsonb_typeof(p -> 'seo_keywords') = 'array' and jsonb_array_length(p -> 'seo_keywords') <= 8
    then array(select left(trim(x), 60) from jsonb_array_elements_text(p -> 'seo_keywords') x where trim(x) <> '') else l.seo_keywords end;
  if p ? 'logo_url' and not _link_url_ok(p ->> 'logo_url') then raise exception 'bad logo link'; end if;

  update link_pages set
    name = coalesce(nullif(left(trim(p ->> 'name'), 80), ''), l.name),
    tagline = case when p ? 'tagline' then nullif(left(trim(p ->> 'tagline'), 120), '') else l.tagline end,
    logo_url = case when p ? 'logo_url' then nullif(p ->> 'logo_url', '') else l.logo_url end,
    theme = nth, colors = ncol, seo_keywords = nseo, tags = ntags, socials = nsoc, photos = nph, buttons = nb, outlets = nout, offers = noff,
    photo_direction = case when (p ->> 'photo_direction') in ('forward', 'backward') then p ->> 'photo_direction' else l.photo_direction end,
    updated_at = now()
  where id = p_id;
end $$;
revoke all on function public._link_apply(uuid, jsonb) from public, anon, authenticated;

create or replace function public.public_link_page(p_slug text)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare l link_pages; rv jsonb;
begin
  select * into l from link_pages where slug = lower(p_slug) and published;
  if l.id is null then return null; end if;
  rv := coalesce(l.reviews, '[]'::jsonb);
  if l.client_id is not null and l.show_client_reviews then
    rv := rv || coalesce((select jsonb_agg(jsonb_build_object('author', r.author, 'rating', r.rating, 'body', r.body, 'date', to_char(r.created_at, 'DD Mon YYYY')))
      from (select * from google_reviews where client_id = l.client_id and show_on_page order by created_at desc limit 20) r), '[]'::jsonb);
  end if;
  return jsonb_build_object('id', l.id, 'slug', l.slug, 'name', l.name, 'tagline', l.tagline, 'logo_url', l.logo_url, 'theme', l.theme, 'colors', coalesce(l.colors, '{}'::jsonb), 'seo_keywords', to_jsonb(l.seo_keywords),
    'tags', to_jsonb(l.tags), 'socials', l.socials, 'photos', l.photos, 'photo_direction', l.photo_direction, 'buttons', l.buttons, 'outlets', l.outlets,
    'offers', coalesce(l.offers, '[]'::jsonb) || coalesce((select jsonb_agg(jsonb_build_object('outlet', l.name, 'title', o.title, 'details', o.details, 'valid_till', o.ends_at) order by o.created_at desc) from offers o where l.client_id is not null and o.client_id = l.client_id and (o.starts_at is null or o.starts_at <= (now() at time zone 'Asia/Kolkata')::date) and (o.ends_at is null or o.ends_at >= (now() at time zone 'Asia/Kolkata')::date)), '[]'::jsonb), 'reviews', rv);
end $function$;
