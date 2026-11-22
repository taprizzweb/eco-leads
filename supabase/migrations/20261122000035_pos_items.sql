-- Owner edits the lines of an order (quantity, price, remove, add a custom line); totals are recalculated on the server.
create or replace function public.pos_set_items(p_order uuid, p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare o orders; ln jsonb; snap jsonb := '[]'::jsonb; sub numeric := 0; q int; pr numeric; t jsonb;
begin
  select * into o from orders where id = p_order;
  if o.id is null or not (o.client_id in (select public.my_client_ids())) then raise exception 'Not allowed'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 80 then raise exception 'An order needs at least one item'; end if;
  for ln in select * from jsonb_array_elements(p_items) loop
    q := least(99, greatest(1, coalesce((ln->>'qty')::int, 1)));
    pr := coalesce((ln->>'unit')::numeric, (ln->>'price')::numeric, 0);
    if pr < 0 or pr > 100000 then raise exception 'Check the price'; end if;
    snap := snap || jsonb_build_object('item_id', ln->'item_id', 'name', left(coalesce(ln->>'name', 'Item'), 80), 'veg', coalesce((ln->>'veg')::boolean, true), 'qty', q,
      'price', coalesce((ln->>'price')::numeric, pr), 'addons', coalesce(ln->'addons', '[]'::jsonb), 'unit', pr, 'note', left(coalesce(ln->>'note', ''), 120));
    sub := sub + pr * q;
  end loop;
  t := pos_totals(sub, o.extras, o.discount, o.gst_rate, o.gst_inclusive);
  update orders set items = snap, subtotal = sub, cgst = (t->>'cgst')::numeric, sgst = (t->>'sgst')::numeric, total = (t->>'total')::numeric where id = o.id;
  return t;
end $$;
revoke execute on function public.pos_set_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.pos_set_items(uuid, jsonb) to authenticated;
