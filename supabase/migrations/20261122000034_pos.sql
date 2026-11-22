-- Food orders (POS): menu, orders with GST, table requests, chat. Guests only use the guest_* functions; staff use row security.
-- Safe to run again.

create table if not exists pos_settings (
  client_id uuid primary key references clients on delete cascade,
  accepting boolean not null default true,
  gst_rate numeric(5,2) not null default 5 check (gst_rate between 0 and 40),
  gst_inclusive boolean not null default false,
  gstin text, legal_name text, address text, bill_footer text,
  geo_lat double precision, geo_lng double precision,
  geo_radius_m int not null default 150 check (geo_radius_m between 20 and 5000),
  geo_required boolean not null default false,
  next_order_no int not null default 1, next_bill_no int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort int not null default 0, active boolean not null default true
);
create index if not exists menu_categories_client_idx on menu_categories (client_id, sort);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  category_id uuid references menu_categories on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  price numeric(10,2) not null check (price >= 0 and price <= 100000),
  veg boolean not null default true, image_url text,
  available boolean not null default true, bestseller boolean not null default false,
  addons jsonb not null default '[]'::jsonb,
  sort int not null default 0, created_at timestamptz not null default now()
);
create index if not exists menu_items_client_idx on menu_items (client_id, sort);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  order_no int not null,
  channel text not null default 'dine_in' check (channel in ('dine_in', 'takeaway', 'zomato', 'swiggy', 'other')),
  external_ref text, table_label text, plate_code text,
  customer_name text, customer_phone text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0, extras jsonb not null default '[]'::jsonb, discount numeric(10,2) not null default 0,
  gst_rate numeric(5,2) not null default 0, gst_inclusive boolean not null default false,
  cgst numeric(10,2) not null default 0, sgst numeric(10,2) not null default 0, total numeric(10,2) not null default 0,
  note text,
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')), payment_mode text,
  public_token uuid not null default gen_random_uuid(),
  bill_no int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists orders_client_idx on orders (client_id, created_at desc);
create index if not exists orders_open_idx on orders (client_id, status) where status in ('new', 'preparing', 'ready', 'served');

alter table server_calls add column if not exists kind text not null default 'waiter';
alter table server_calls add column if not exists note text;

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  plate_code text, table_label text, customer_name text, customer_phone text,
  token uuid not null default gen_random_uuid(),
  unread_staff int not null default 0,
  last_message_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index if not exists chat_threads_client_idx on chat_threads (client_id, last_message_at desc);
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads on delete cascade,
  client_id uuid not null references clients on delete cascade,
  sender text not null check (sender in ('customer', 'staff')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on chat_messages (thread_id, created_at);

-- Row security: the owner and their team see their own shop; guests have no direct access at all.
alter table pos_settings enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pos_settings' and policyname='pos_settings_member') then
    create policy pos_settings_member on pos_settings for all to authenticated using (client_id in (select public.my_client_ids())) with check (client_id in (select public.my_client_ids())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_categories' and policyname='menu_categories_member') then
    create policy menu_categories_member on menu_categories for all to authenticated using (client_id in (select public.my_client_ids())) with check (client_id in (select public.my_client_ids())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_items' and policyname='menu_items_member') then
    create policy menu_items_member on menu_items for all to authenticated using (client_id in (select public.my_client_ids())) with check (client_id in (select public.my_client_ids())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_member') then
    create policy orders_member on orders for all to authenticated using (client_id in (select public.my_client_ids())) with check (client_id in (select public.my_client_ids())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_threads' and policyname='chat_threads_member') then
    create policy chat_threads_member on chat_threads for all to authenticated using (client_id in (select public.my_client_ids())) with check (client_id in (select public.my_client_ids())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='chat_messages_member') then
    create policy chat_messages_member on chat_messages for all to authenticated using (client_id in (select public.my_client_ids())) with check (client_id in (select public.my_client_ids()) and sender = 'staff'); end if;
end $$;

-- Live updates for the owner screen.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then alter publication supabase_realtime add table public.orders; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='server_calls') then alter publication supabase_realtime add table public.server_calls; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages') then alter publication supabase_realtime add table public.chat_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_threads') then alter publication supabase_realtime add table public.chat_threads; end if;
end $$;

create or replace function public.pos_touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_touch') then create trigger orders_touch before update on orders for each row execute function public.pos_touch(); end if;
end $$;

-- The bill maths, in one place. Extras (packing, service) and the discount are applied first, then GST.
-- Exclusive: GST is added on top. Inclusive: the prices already contain GST, so it is taken out of the total.
create or replace function public.pos_totals(p_subtotal numeric, p_extras jsonb, p_discount numeric, p_rate numeric, p_inclusive boolean) returns jsonb
language plpgsql immutable as $$
declare ex numeric := coalesce((select sum(greatest(0, (e->>'amount')::numeric)) from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) e), 0);
  gross numeric := greatest(0, p_subtotal + ex - greatest(0, coalesce(p_discount, 0)));
  net numeric; gst numeric; cg numeric; sg numeric; total numeric;
begin
  if p_inclusive then net := round(gross / (1 + p_rate / 100), 2); gst := gross - net; total := gross;
  else net := gross; gst := round(gross * p_rate / 100, 2); total := gross + gst; end if;
  cg := round(gst / 2, 2); sg := gst - cg;
  return jsonb_build_object('extras_total', ex, 'taxable', net, 'gst', gst, 'cgst', cg, 'sgst', sg, 'total', total);
end $$;

create or replace function public.guest_pos_on(p_client uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('on', client_is_live(c) and coalesce((client_features(c.id)->>'pos')::boolean, false), 'accepting', coalesce(s.accepting, true))
  from clients c left join pos_settings s on s.client_id = c.id where c.id = p_client;
$$;

create or replace function public.guest_menu(p_client uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'accepting', coalesce(s.accepting, true), 'gst_rate', coalesce(s.gst_rate, 5), 'gst_inclusive', coalesce(s.gst_inclusive, false),
    'geo', jsonb_build_object('required', coalesce(s.geo_required, false) and s.geo_lat is not null, 'lat', s.geo_lat, 'lng', s.geo_lng, 'radius', coalesce(s.geo_radius_m, 150)),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name) order by k.sort, k.name) from menu_categories k where k.client_id = c.id and k.active), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'category_id', i.category_id, 'name', i.name, 'description', i.description, 'price', i.price, 'veg', i.veg,
        'image_url', i.image_url, 'available', i.available, 'addons', i.addons, 'bestseller', i.bestseller) order by i.sort, i.name) from menu_items i where i.client_id = c.id), '[]'::jsonb))
  from clients c left join pos_settings s on s.client_id = c.id
  where c.id = p_client and client_is_live(c) and coalesce((client_features(c.id)->>'pos')::boolean, false);
$$;

create or replace function public.guest_place_order(p_client uuid, p_code text, p_name text, p_phone text, p_lines jsonb, p_note text default null, p_lat double precision default null, p_lng double precision default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c clients; s pos_settings; pl plates; ph text; nm text; ln jsonb; it menu_items; q int; unit numeric; ad jsonb; adsum numeric; a jsonb; an text;
  snap jsonb := '[]'::jsonb; sub numeric := 0; t jsonb; n int; oid uuid; tok uuid; dist double precision;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not accepting orders'; end if;
  if not coalesce((client_features(p_client)->>'pos')::boolean, false) then raise exception 'Ordering is not switched on'; end if;
  insert into pos_settings (client_id) values (p_client) on conflict do nothing;
  select * into s from pos_settings where client_id = p_client;
  if not s.accepting then raise exception 'We are not taking orders right now'; end if;
  select * into pl from plates where code = p_code and client_id = p_client and active;
  if pl.code is null then raise exception 'Please scan the QR on your table to order'; end if;
  nm := left(trim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[<>]', '', 'g'), '\s+', ' ', 'g')), 40);
  if char_length(nm) < 1 then raise exception 'Add your name'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(ph) = 10 then ph := '91' || ph; end if;
  if ph !~ '^[1-9][0-9]{9,14}$' then raise exception 'Enter a valid mobile number'; end if;
  if s.geo_required and s.geo_lat is not null and s.geo_lng is not null then
    if p_lat is null or p_lng is null then raise exception 'LOCATION_NEEDED'; end if;
    dist := 6371000 * 2 * asin(sqrt(power(sin(radians(p_lat - s.geo_lat) / 2), 2) + cos(radians(s.geo_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - s.geo_lng) / 2), 2)));
    if dist > s.geo_radius_m then raise exception 'OUT_OF_RANGE'; end if;
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 40 then raise exception 'Your cart is empty'; end if;
  if not guest_rate_ok(p_client, 'orders', 200, interval '1 hour') then raise exception 'Too many orders just now. Please ask the staff'; end if;
  if (select count(*) from orders where client_id = p_client and customer_phone = ph and created_at > now() - interval '1 hour') >= 10 then raise exception 'Too many orders from this number. Please ask the staff'; end if;
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := least(50, greatest(1, coalesce((ln->>'qty')::int, 1)));
    select * into it from menu_items where id = (ln->>'item_id')::uuid and client_id = p_client;
    if it.id is null or not it.available then raise exception 'ITEM_UNAVAILABLE:%', coalesce(it.name, 'an item'); end if;
    adsum := 0; ad := '[]'::jsonb;
    for an in select jsonb_array_elements_text(coalesce(ln->'addons', '[]'::jsonb)) loop
      select e into a from jsonb_array_elements(it.addons) e where e->>'name' = an limit 1;
      if a is not null then ad := ad || jsonb_build_object('name', a->>'name', 'price', (a->>'price')::numeric); adsum := adsum + (a->>'price')::numeric; end if;
    end loop;
    unit := it.price + adsum;
    snap := snap || jsonb_build_object('item_id', it.id, 'name', it.name, 'veg', it.veg, 'qty', q, 'price', it.price, 'addons', ad, 'unit', unit, 'note', left(coalesce(ln->>'note', ''), 120));
    sub := sub + unit * q;
  end loop;
  t := pos_totals(sub, '[]'::jsonb, 0, s.gst_rate, s.gst_inclusive);
  update pos_settings set next_order_no = next_order_no + 1 where client_id = p_client returning next_order_no - 1 into n;
  insert into orders (client_id, order_no, channel, table_label, plate_code, customer_name, customer_phone, items, subtotal, gst_rate, gst_inclusive, cgst, sgst, total, note)
  values (p_client, n, 'dine_in', pl.label, pl.code, nm, ph, snap, sub, s.gst_rate, s.gst_inclusive, (t->>'cgst')::numeric, (t->>'sgst')::numeric, (t->>'total')::numeric, nullif(left(btrim(coalesce(p_note, '')), 300), ''))
  returning id, public_token into oid, tok;
  -- guest numbers on orders are kept 45 days, then only the bill stays
  update orders set customer_name = null, customer_phone = null where client_id = p_client and customer_phone is not null and created_at < now() - interval '45 days';
  return jsonb_build_object('id', oid, 'token', tok, 'order_no', n, 'total', (t->>'total')::numeric, 'table', pl.label);
end $$;

create or replace function public.guest_order_status(p_order uuid, p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', status, 'order_no', order_no, 'total', total, 'table', table_label, 'updated_at', updated_at) from orders where id = p_order and public_token = p_token;
$$;

create or replace function public.guest_table_request(p_client uuid, p_code text, p_kind text, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c clients; pl plates; f jsonb;
begin
  if p_kind not in ('waiter', 'bill', 'clean', 'other') then raise exception 'Not available'; end if;
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'This page is not accepting requests'; end if;
  f := client_features(p_client);
  if not (coalesce((f->>'pos')::boolean, false) or coalesce((f->>'call_server')::boolean, false)) then raise exception 'Not available'; end if;
  select * into pl from plates where code = p_code and client_id = p_client and active;
  if pl.code is null then raise exception 'Not available'; end if;
  if exists (select 1 from server_calls where client_id = p_client and plate_code = pl.code and kind = p_kind and status = 'new' and created_at > now() - interval '15 minutes') then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if not guest_rate_ok(p_client, 'server_calls', 120, interval '1 hour') then raise exception 'Too many requests, try again shortly'; end if;
  insert into server_calls (client_id, plate_code, label, kind, note) values (p_client, pl.code, pl.label, p_kind, nullif(left(btrim(coalesce(p_note, '')), 200), ''));
  return jsonb_build_object('ok', true, 'already', false);
end $$;

create or replace function public.guest_chat_open(p_client uuid, p_code text, p_name text, p_phone text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c clients; pl plates; th chat_threads; ph text;
begin
  select * into c from clients where id = p_client;
  if c.id is null or not client_is_live(c) then raise exception 'Chat is not available'; end if;
  if not coalesce((client_features(p_client)->>'pos')::boolean, false) then raise exception 'Chat is not available'; end if;
  select * into pl from plates where code = p_code and client_id = p_client and active;
  if pl.code is null then raise exception 'Chat is not available'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(ph) = 10 then ph := '91' || ph; end if;
  select * into th from chat_threads where client_id = p_client and plate_code = pl.code and customer_phone = ph and last_message_at > now() - interval '12 hours' order by last_message_at desc limit 1;
  if th.id is null then
    if not guest_rate_ok(p_client, 'chat_threads', 60, interval '1 hour') then raise exception 'Too many chats right now'; end if;
    insert into chat_threads (client_id, plate_code, table_label, customer_name, customer_phone) values (p_client, pl.code, pl.label, left(coalesce(p_name, ''), 40), ph) returning * into th;
  end if;
  return jsonb_build_object('thread_id', th.id, 'token', th.token);
end $$;

create or replace function public.guest_chat_send(p_thread uuid, p_token uuid, p_body text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare th chat_threads; b text := left(btrim(coalesce(p_body, '')), 1000);
begin
  select * into th from chat_threads where id = p_thread and token = p_token;
  if th.id is null or b = '' then raise exception 'Not available'; end if;
  if (select count(*) from chat_messages where thread_id = th.id and sender = 'customer' and created_at > now() - interval '10 minutes') >= 30 then raise exception 'Please wait a moment before sending more'; end if;
  insert into chat_messages (thread_id, client_id, sender, body) values (th.id, th.client_id, 'customer', b);
  update chat_threads set last_message_at = now(), unread_staff = unread_staff + 1 where id = th.id;
end $$;

create or replace function public.guest_chat_messages(p_thread uuid, p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.created_at), '[]'::jsonb)
  from chat_messages m join chat_threads t on t.id = m.thread_id where t.id = p_thread and t.token = p_token;
$$;

-- Owner side: change extras and discount on a bill, add an order that came from the counter, phone, Zomato or Swiggy.
create or replace function public.pos_set_extras(p_order uuid, p_extras jsonb, p_discount numeric) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare o orders; t jsonb; ex jsonb := '[]'::jsonb; e jsonb;
begin
  select * into o from orders where id = p_order;
  if o.id is null or not (o.client_id in (select public.my_client_ids())) then raise exception 'Not allowed'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop
    if coalesce((e->>'amount')::numeric, 0) > 0 and coalesce(e->>'name', '') <> '' then ex := ex || jsonb_build_object('name', left(e->>'name', 40), 'amount', least(100000, (e->>'amount')::numeric)); end if;
  end loop;
  t := pos_totals(o.subtotal, ex, p_discount, o.gst_rate, o.gst_inclusive);
  update orders set extras = ex, discount = greatest(0, coalesce(p_discount, 0)), cgst = (t->>'cgst')::numeric, sgst = (t->>'sgst')::numeric, total = (t->>'total')::numeric where id = o.id;
  return t;
end $$;

create or replace function public.pos_create_order(p_client uuid, p_channel text, p_table text, p_name text, p_phone text, p_lines jsonb, p_ref text default null, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare s pos_settings; ln jsonb; q int; pr numeric; snap jsonb := '[]'::jsonb; sub numeric := 0; t jsonb; n int; oid uuid; it menu_items; nm text;
begin
  if not (p_client in (select public.my_client_ids())) then raise exception 'Not allowed'; end if;
  if p_channel not in ('dine_in', 'takeaway', 'zomato', 'swiggy', 'other') then raise exception 'Unknown channel'; end if;
  insert into pos_settings (client_id) values (p_client) on conflict do nothing;
  select * into s from pos_settings where client_id = p_client;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 60 then raise exception 'Add at least one item'; end if;
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := least(99, greatest(1, coalesce((ln->>'qty')::int, 1)));
    if (ln->>'item_id') is not null then
      select * into it from menu_items where id = (ln->>'item_id')::uuid and client_id = p_client;
      nm := it.name; pr := coalesce((ln->>'price')::numeric, it.price);
    else nm := left(coalesce(ln->>'name', 'Item'), 80); pr := coalesce((ln->>'price')::numeric, 0); end if;
    if pr < 0 or pr > 100000 then raise exception 'Check the price of %', nm; end if;
    snap := snap || jsonb_build_object('item_id', ln->>'item_id', 'name', nm, 'veg', coalesce((ln->>'veg')::boolean, true), 'qty', q, 'price', pr, 'addons', '[]'::jsonb, 'unit', pr, 'note', left(coalesce(ln->>'note', ''), 120));
    sub := sub + pr * q;
  end loop;
  t := pos_totals(sub, '[]'::jsonb, 0, s.gst_rate, s.gst_inclusive);
  update pos_settings set next_order_no = next_order_no + 1 where client_id = p_client returning next_order_no - 1 into n;
  insert into orders (client_id, order_no, channel, external_ref, table_label, customer_name, customer_phone, items, subtotal, gst_rate, gst_inclusive, cgst, sgst, total, note, status)
  values (p_client, n, p_channel, nullif(left(coalesce(p_ref, ''), 60), ''), nullif(left(coalesce(p_table, ''), 30), ''), nullif(left(coalesce(p_name, ''), 40), ''), nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), snap, sub, s.gst_rate, s.gst_inclusive, (t->>'cgst')::numeric, (t->>'sgst')::numeric, (t->>'total')::numeric, nullif(left(coalesce(p_note, ''), 300), ''), 'preparing')
  returning id into oid;
  return jsonb_build_object('id', oid, 'order_no', n, 'total', (t->>'total')::numeric);
end $$;

create or replace function public.pos_bill_no(p_order uuid) returns int
language plpgsql volatile security definer set search_path = public as $$
declare o orders; b int;
begin
  select * into o from orders where id = p_order;
  if o.id is null or not (o.client_id in (select public.my_client_ids())) then raise exception 'Not allowed'; end if;
  if o.bill_no is not null then return o.bill_no; end if;
  update pos_settings set next_bill_no = next_bill_no + 1 where client_id = o.client_id returning next_bill_no - 1 into b;
  update orders set bill_no = b where id = o.id;
  return b;
end $$;

revoke execute on function public.guest_pos_on(uuid), public.guest_menu(uuid), public.guest_place_order(uuid, text, text, text, jsonb, text, double precision, double precision), public.guest_order_status(uuid, uuid),
  public.guest_table_request(uuid, text, text, text), public.guest_chat_open(uuid, text, text, text), public.guest_chat_send(uuid, uuid, text), public.guest_chat_messages(uuid, uuid),
  public.pos_set_extras(uuid, jsonb, numeric), public.pos_create_order(uuid, text, text, text, text, jsonb, text, text), public.pos_bill_no(uuid), public.pos_totals(numeric, jsonb, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.guest_pos_on(uuid), public.guest_menu(uuid), public.guest_place_order(uuid, text, text, text, jsonb, text, double precision, double precision), public.guest_order_status(uuid, uuid),
  public.guest_table_request(uuid, text, text, text), public.guest_chat_open(uuid, text, text, text), public.guest_chat_send(uuid, uuid, text), public.guest_chat_messages(uuid, uuid) to anon, authenticated;
grant execute on function public.pos_set_extras(uuid, jsonb, numeric), public.pos_create_order(uuid, text, text, text, text, jsonb, text, text), public.pos_bill_no(uuid), public.pos_totals(numeric, jsonb, numeric, numeric, boolean) to authenticated;
