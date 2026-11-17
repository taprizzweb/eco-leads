-- If a code was already sent and is still valid, the verify screen reopens on the code box
-- instead of asking to send again (no second WhatsApp message, no extra cost).
create or replace function my_security_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s user_security; c otp_codes;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into s from user_security where user_id = auth.uid();
  select * into c from otp_codes
   where user_id = auth.uid() and used_at is null and expires_at > now() and attempts < 5
   order by created_at desc limit 1;
  return jsonb_build_object(
    'verified', has_aal2(),
    'whatsapp_ready', whatsapp_ready(),
    'phone', mask_phone(s.whatsapp_phone),
    'phone_verified', s.phone_verified_at is not null,
    'has_totp', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified' and f.factor_type = 'totp'),
    'pending_to', mask_phone(c.phone),
    'retry_in', case when c.id is null then 0 else greatest(0, 60 - extract(epoch from now() - c.created_at)::int) end
  );
end $$;
