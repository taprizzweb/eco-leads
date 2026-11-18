-- The review functions that guests' browsers should never call directly now need a server key.
-- Only the Taprizz server knows it (REVIEW_SERVER_KEY in Vercel), so strangers cannot read the AI writing rules,
-- flood a business with fake drafts, or use up its hourly AI budget. The key is stored in app_settings as review_server_key.
-- (Insert the key first, with the same value that is in Vercel.)
create or replace function public._review_key_ok(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select k is not null and length(k) >= 32 and k = (select value #>> '{}' from app_settings where key = 'review_server_key');
$$;
revoke execute on function public._review_key_ok(text) from public, anon, authenticated;

create or replace function public.review_ai_config(p_client uuid, p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb; c clients; t business_templates;
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  select * into c from clients where id = p_client;
  if c.id is null then return null; end if;
  select * into t from business_templates where id = c.business_type;
  select value into s from app_settings where key = 'ai_studio';
  s := coalesce(s, '{}'::jsonb);
  return jsonb_build_object(
    'rules', coalesce(s->>'rules', ''),
    'banned', coalesce(s->'banned', '[]'::jsonb),
    'length_min', coalesce((s->>'length_min')::int, 25),
    'length_max', coalesce((s->>'length_max')::int, 80),
    'examples', coalesce(s->'examples', '[]'::jsonb),
    'category', jsonb_build_object('id', t.id, 'label', t.label, 'keywords', to_jsonb(coalesce(t.keywords, '{}')), 'notes', coalesce(t.notes, '')),
    'business', jsonb_build_object('name', c.name, 'tagline', c.tagline));
end $$;

create or replace function public.guest_recent_sigs(p_client uuid, p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  return (select coalesce(jsonb_agg(shingles), '[]'::jsonb)
    from (select shingles from review_drafts where client_id = p_client and shingles is not null order by created_at desc limit 60) s);
end $$;

create or replace function public.review_budget_ok(p_client uuid, p_max int, p_key text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  return (select count(*) from review_drafts where client_id = p_client and created_at > now() - interval '1 hour') < p_max;
end $$;

create or replace function public.guest_save_review(p_client uuid, p_code text, p_rating int, p_answers jsonb, p_draft text, p_provider text, p_language text, p_name text, p_shingles jsonb, p_key text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare rid uuid;
begin
  if not _review_key_ok(p_key) then raise exception 'Not allowed'; end if;
  if p_rating not between 1 and 5 then raise exception 'bad rating'; end if;
  if p_language is not null and p_language not in ('en', 'hi', 'hinglish') then raise exception 'bad language'; end if;
  if not guest_rate_ok(p_client, 'review_drafts', 300, interval '1 hour') then raise exception 'Too many requests, try again shortly'; end if;
  insert into review_drafts (client_id, plate_code, rating, answers, draft, provider, language, guest_name, shingles)
  values (p_client, p_code, p_rating, coalesce(p_answers, '{}'), left(p_draft, 2000), p_provider, p_language, left(p_name, 40), p_shingles)
  returning id into rid;
  return rid;
end $$;

revoke execute on function public.review_ai_config(uuid, text) from public;
revoke execute on function public.guest_recent_sigs(uuid, text) from public;
revoke execute on function public.review_budget_ok(uuid, int, text) from public;
revoke execute on function public.guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb, text) from public;
grant execute on function public.review_ai_config(uuid, text) to anon, authenticated;
grant execute on function public.guest_recent_sigs(uuid, text) to anon, authenticated;
grant execute on function public.review_budget_ok(uuid, int, text) to anon, authenticated;
grant execute on function public.guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb, text) to anon, authenticated;

-- The older versions without a key are closed to the outside.
revoke execute on function public.review_ai_config(uuid) from public, anon, authenticated;
revoke execute on function public.guest_recent_sigs(uuid) from public, anon, authenticated;
revoke execute on function public.review_budget_ok(uuid, int) from public, anon, authenticated;
revoke execute on function public.guest_save_review(uuid, text, int, jsonb, text, text, text, text, jsonb) from public, anon, authenticated;
