-- The guest app gallery can hold clips as well as photos. The Jaipur hub shows still pictures only,
-- so its three photo lists skip clips (mp4, webm, mov, m4v).
do $$
declare f regprocedure; d text;
begin
  for f in select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = any(array['hub_nearby_places', 'hub_place', 'hub_cards']) loop
    d := pg_get_functiondef(f);
    if d ~ 'from gallery_photos where client_id = [dc]\.id' and d !~ 'mp4\|webm' then
      d := regexp_replace(d, 'from gallery_photos where client_id = ([dc])\.id', 'from gallery_photos where client_id = \1.id and url !~* ''\\.(mp4|webm|mov|m4v)(\\?|$)''', 'g');
      execute d;
    end if;
  end loop;
end $$;
