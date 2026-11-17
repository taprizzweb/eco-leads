-- Guests cannot read clients directly, so check upload folders through a definer function.
create or replace function client_accepts_uploads(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients c where c.id::text = p_folder and client_is_live(c));
$$;
revoke execute on function client_accepts_uploads(text) from public;
grant execute on function client_accepts_uploads(text) to anon, authenticated;

drop policy guest_upload on storage.objects;
create policy guest_upload on storage.objects for insert to anon, authenticated
with check (bucket_id = 'guest-uploads' and client_accepts_uploads((storage.foldername(name))[1]));
