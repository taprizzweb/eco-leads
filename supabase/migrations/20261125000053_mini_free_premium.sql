-- Mini links: a free page goes live at once but is limited. Premium (Rs 150 once, paid by UPI and approved by the team) unlocks more.
--   Free:    3 photos, no videos, no offers, no scrolling tags or search keywords, 1 extra link.
--   Premium: 10 photos with up to 2 videos, offers, tags and keywords, 6 extra links.

create or replace function public.mini_create(p_name text, p_slug text, p_phone text, p_email text, p_terms boolean, p_marketing boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text := lower(trim(coalesce(p_slug, ''))); ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); t text; i uuid;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 80 then raise exception 'bad name'; end if;
  if s !~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$' then raise exception 'bad slug'; end if;
  if s in ('admin', 'api', 'create', 'edit', 'login', 'dashboard', 'l', 'e', 'm', 's', 'pos', 'group', 'jaipur', 'install', 'app', 'auth', 'taprizz', 'nbc', 'www', 'help', 'support', 'terms', 'privacy', 'demo') then raise exception 'slug taken'; end if;
  ph := regexp_replace(ph, '^(91|0)(?=[6-9][0-9]{9}$)', '');
  if ph !~ '^[6-9][0-9]{9}$' then raise exception 'bad phone'; end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'bad email'; end if;
  if not coalesce(p_terms, false) then raise exception 'terms needed'; end if;
  if exists (select 1 from link_pages where slug = s) then raise exception 'slug taken'; end if;
  if (select count(*) from mini_signups where created_at > now() - interval '1 hour') >= 60 then raise exception 'busy'; end if;
  if (select count(*) from mini_signups where phone = ph) >= 3 then raise exception 'too many pages'; end if;
  t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into link_pages (slug, name, published, plan, edit_token, edit_enabled, theme)
  values (s, left(trim(p_name), 80), true, 'mini', t, true, 'midnight') returning id into i;
  insert into mini_signups (link_id, name, phone, email, marketing_consent, consent_at)
  values (i, left(trim(p_name), 80), ph, nullif(lower(trim(coalesce(p_email, ''))), ''), coalesce(p_marketing, false), case when coalesce(p_marketing, false) then now() end);
  return jsonb_build_object('token', t, 'slug', s);
end $$;
revoke all on function public.mini_create(text, text, text, text, boolean, boolean) from public;
grant execute on function public.mini_create(text, text, text, text, boolean, boolean) to anon, authenticated;

create or replace function public.mini_state(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i uuid; pl text; pub boolean; pa timestamptz; pay record;
begin
  if not link_token_ok(p_token) then return null; end if;
  select id, plan, published, paid_at into i, pl, pub, pa from link_pages where edit_token = p_token;
  select status, note, created_at into pay from mini_payments where link_id = i order by created_at desc limit 1;
  return jsonb_build_object('plan', pl, 'published', pub, 'paid_at', pa, 'premium', pa is not null,
    'payment', case when pay.status is null then null else jsonb_build_object('status', pay.status, 'note', pay.note, 'at', pay.created_at) end);
end $$;
revoke all on function public.mini_state(text) from public;
grant execute on function public.mini_state(text) to anon, authenticated;

create or replace function public.link_edit_save(p_token text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare i uuid; pl text; prem boolean; o jsonb; ph jsonb; vids int := 0; extra int; patch jsonb := p_patch; maxp int; maxv int; maxl int;
begin
  if not link_token_ok(p_token) then raise exception 'not allowed'; end if;
  select id, plan, (paid_at is not null) into i, pl, prem from link_pages where edit_token = p_token;
  if pl = 'mini' then
    maxp := case when prem then 10 else 3 end; maxv := case when prem then 2 else 0 end; maxl := case when prem then 6 else 1 end;
    ph := coalesce(patch -> 'photos', '[]'::jsonb);
    if jsonb_array_length(ph) > maxp then raise exception 'too many photos'; end if;
    for o in select * from jsonb_array_elements(ph) loop
      if (o ->> 'kind') = 'video' or (o ->> 'url') ~* '\.(mp4|webm|mov|m4v)(\?|$)' then vids := vids + 1; end if;
    end loop;
    if vids > maxv then raise exception 'no videos'; end if;
    if not prem then
      -- A free page has no offers, no scrolling tags and no search keywords, whatever is sent.
      patch := patch || jsonb_build_object('offers', '[]'::jsonb, 'tags', '[]'::jsonb, 'seo_keywords', '[]'::jsonb);
      if jsonb_exists(patch, 'buttons') then
        patch := jsonb_set(patch, '{buttons}', coalesce((select jsonb_agg(b) from jsonb_array_elements(patch -> 'buttons') b where b ->> 'url' <> '#offers'), '[]'::jsonb));
      end if;
    elsif jsonb_array_length(coalesce(patch -> 'offers', '[]'::jsonb)) > 10 then raise exception 'too many offers';
    end if;
    if jsonb_exists(patch, 'buttons') then
      select count(*) into extra from jsonb_array_elements(patch -> 'buttons') b where left(coalesce(b ->> 'url', ''), 1) <> '#' and coalesce(b ->> 'icon', '') <> 'menu';
      if extra > maxl then raise exception 'too many links'; end if;
    end if;
  end if;
  perform _link_apply(i, patch);
end $$;
revoke all on function public.link_edit_save(text, jsonb) from public;
grant execute on function public.link_edit_save(text, jsonb) to anon, authenticated;

-- The public page also says if it is Premium, so a free page shows its footer and a Premium page does not.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.public_link_page(text)'::regprocedure);
  if position($q$'plan', l.plan,$q$ in d) = 0 then raise exception 'public_link_page layout changed'; end if;
  if position($q$'premium'$q$ in d) = 0 then
    d := replace(d, $q$'plan', l.plan,$q$, $q$'plan', l.plan, 'premium', (l.paid_at is not null),$q$);
    execute d;
  end if;
end $$;
