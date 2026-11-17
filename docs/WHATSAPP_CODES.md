# Switching on WhatsApp sign-in codes

Until these steps are done, the verify screen uses the authenticator app, as it does today.
Once the three Vault secrets exist, it switches to WhatsApp by itself. No redeploy is needed.

## When a code is sent (to keep message costs low)

- Only when someone signs in on a **new or untrusted device**, and only after they tap **Send code**.
- "Trust this device for 30 days" (ticked by default) skips the code on that phone or laptop for 30 days.
- Sensitive actions (team, plan, WhatsApp number changes, contact export) will ask for a fresh code.
- Limits per person: 1 code a minute, 5 an hour, 10 a day. A code lasts 10 minutes and allows 5 tries.
- Reloading the page never sends a second code; it reopens the code box.

## 1. Meta setup (one time)

1. Go to business.facebook.com and create or open the **Taprizz** Business portfolio. Complete **Business verification** (GST or shop documents).
2. Go to developers.facebook.com, then **My Apps**, then **Create app**, choose **Business**, and add the **WhatsApp** product.
3. Under **WhatsApp, then API Setup**, add your Taprizz phone number and verify it by SMS or call.
   - This number then sends through the API. With Meta's "coexistence" option it can keep working in the WhatsApp Business app too. Check that option while adding the number.
4. Under **WhatsApp Manager, then Message templates**, create a template:
   - Category: **Authentication**
   - Name: `taprizz_login_code`
   - Language: **English**
   - Code delivery: **Copy code** button
   - Optionally tick "Add security recommendation" and set expiry to 10 minutes.
   Wait for it to be approved, usually within minutes.
5. Create a **permanent access token**: Business settings, then **System users**, then add an admin system user. Assign it your app and WhatsApp account with full control, then **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`. Copy it.
6. Note the **Phone number ID** shown on the API Setup page. It is a long number, not your mobile number.

## 2. Save the secrets in Supabase (never in chat or in the code)

Open Supabase, then project **taprizz-app**, then **SQL Editor**, and run this with your values:

```sql
select vault.create_secret('PASTE_PERMANENT_TOKEN', 'whatsapp_token');
select vault.create_secret('PASTE_PHONE_NUMBER_ID', 'whatsapp_phone_number_id');
select vault.create_secret('taprizz_login_code', 'whatsapp_otp_template');
```

To replace the token later: `select vault.update_secret((select id from vault.secrets where name = 'whatsapp_token'), 'NEW_TOKEN');`

## 3. Check delivery

After a test sign-in, this shows what Meta answered (200 means sent):

```sql
select c.created_at, c.purpose, r.status_code, left(r.content::text, 200)
from otp_codes c left join net._http_response r on r.id = c.request_id
order by c.created_at desc limit 5;
```

## Cost

Meta charges per authentication message (about Rs 0.12 to 0.15 in India, plus GST). Trusted devices
mean most owners need roughly one code a month per phone or laptop.
