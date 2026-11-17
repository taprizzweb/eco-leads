# Taprizz

One product, three faces:

| Face | Who | Where |
|---|---|---|
| Guest page | Customer at the table, opened by NFC tap or QR | `/e/<code>` (e.g. `taprizz.in/e/demo1`) |
| Owner dashboard | Cafe, salon, gym, hotel, stay owners and staff | _next step_ |
| Admin panel | Taprizz team | _next step_ |

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

## Decisions so far

- **Plate links:** `taprizz.in/e/<code>`. A code never changes once printed; admins reassign it.
- **Login:** Google sign-in plus an authenticator-app code (TOTP) for owners and the Taprizz team. The first super-admin is the founder's Google account.
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
- [ ] Google sign-in + 2FA, owner dashboard (Home, Inbox, My Page, Plan)
- [ ] Admin panel (clients, package switches, plates and QR, pause and renew)
- [ ] Share your moment, offer claim codes, membership, Creators corner
- [ ] Review replies, monthly report, WhatsApp contacts and campaigns
- [ ] CAPTCHA on guest forms, 90-day deletion of complaint media, security review
