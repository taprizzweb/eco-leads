-- A free mini page uses the templates only. Its own background, glow and button colours are a Premium feature.
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
      -- A free page has no offers, no scrolling tags, no search keywords and no colours of its own, whatever is sent.
      patch := patch || jsonb_build_object('offers', '[]'::jsonb, 'tags', '[]'::jsonb, 'seo_keywords', '[]'::jsonb, 'colors', '{}'::jsonb);
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
