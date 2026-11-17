# Taprizz

One product, three faces:

| Face | Who | Where |
|---|---|---|
| Guest page | Customer at the table, opened by NFC tap or QR | `/e/<code>` (e.g. `taprizz.in/e/demo1`) |
| Owner dashboard | Cafe, salon, gym, hotel, stay owners and staff | `/dashboard` (Google sign-in + 2-step code) |
| Admin panel | Taprizz team | `/admin` (team members land here after sign-in) |

Built from the Taprizz Product Blueprint (Nov 17, 2026).

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind v4), to be hosted on Vercel
- Supabase project `taprizz-app` (ap-south-1, Mumbai): Postgres with row-level security, private storage
- `motion` + `lucide-react` for animated card icons (21st.dev animated-icon style, swappable per card)

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000/e/demo1 in a phone-sized window.

## Sign-in and security

- Everyone (owners, their staff, the Taprizz admin and employees) signs in on `/login` with Google or email + password.
- A second step is needed only on a new or untrusted device: a WhatsApp code (setup: `docs/WHATSAPP_CODES.md`), or the authenticator app as backup.
- "Trust this device for 30 days" skips the code on that device. Dashboard data stays locked in the database until the session is verified.
- **The second step is currently switched OFF** (`app_settings.require_second_step = false`), so a password is enough. Turn it back on in the Supabase SQL Editor before real clients start using the dashboard:

  ```sql
  update app_settings set value = 'true'::jsonb, updated_at = now() where key = 'require_second_step';
  ```

## Decisions so far

- **Plate links:** `taprizz.in/e/<code>`. A code never changes once printed; admins reassign it.
- **Login:** Google or email + password; WhatsApp code only on new devices and sensitive actions; authenticator app as backup. The first super-admin is the founder's Google account.
- **Themes:** each client picks a guest page theme: Deep Navy (default), Midnight, Soft Pastel, Warm Sand or Forest. They live in `src/lib/themes.ts`.
- **Business templates:** cafe, salon, gym, hotel, clinic, homestay/villa and resort. Each pre-fills review chips, keywords, card wording and sample offers.
- **Review drafts:** pluggable provider (`REVIEW_AI_PROVIDER` = `template` | `openai` | `gemini` | `anthropic`). With no key it uses the built-in template writer. Drafts use only the guest's own answers.
- **Packages:** stored in the `packages` table as presets of feature switches. Prices are editable in admin and seeded with the blueprint proposals (Rs 349 / 999 / 2,499 / 9,999).
- **Language:** English only at launch.

## Database (`supabase/migrations`)

- Guests never touch tables. They call `SECURITY DEFINER` functions only: `guest_page`, `guest_log_tap`, `guest_save_review`, `guest_mark_copied` and `guest_submit_feedback`. Each one checks the client's package switches and a per-client rate limit.
- Owners can edit page content through RLS. A trigger blocks them from changing plan, status, expiry or slug, and every plan change goes into `audit_log`.
- A paused or expired client still shows the Google review link, so a plate is never dead.
- Storage: `guest-uploads` is private, 10 MB, with an allowed list of file types; guests can upload only into a live client's folder. `page-assets` is public, 2 MB, images only.

## Build progress (blueprint order)

- [x] Database and security foundation (tables, RLS, private storage)
- [x] Guest page: header, socials, offers strip, gallery, keyword strip, action cards, rainbow review card, reviews strip, paused state
- [x] Complaint and suggestion forms with photo, video and voice notes
- [x] Google sign-in + 2FA, owner dashboard (Home, Inbox, My Page, Plan) in the Sheen look, tested end to end
- [x] Admin panel: overview, clients, add client, package switches, plates and QR, alerts, billing, packages, audit log, team (templates editor still to do)
- [x] Creators corner: shoot brief, collab requests with approval, visit codes, monthly cap, post submissions, owner Content screen
- [ ] Share your moment, offer claim codes, membership
- [x] Extra link buttons: owners add a name and a URL on My Page; the admin sets how many each client may add (switch `custom_links`, 0 is off)
- [x] Admin Integrations page: shows how the review writer is connected and sends a test review
- [x] Reviews tab: paste a Google review, get a reply to copy; guests' drafts and answers visible; your own trained AI plugs in (`docs/REVIEW_AI.md`)
- [ ] One-click and automatic review replies (waiting for Google Business Profile API approval), monthly report, WhatsApp contacts and campaigns
- [ ] CAPTCHA on guest forms, 90-day deletion of complaint media, security review
