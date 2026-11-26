# Taprizz: handover for any new chat (read this first)

This is the owner's running brief. The owner writes Hinglish. Reply in short Hinglish, plain words, no jargon. Show what you verified; never say "done" without checking. Today's plan, prices and decisions are below. If this file and the code disagree, the code (`lib/plans.ts` on the website, the database) is the truth: fix this file.

## Who and what
- Owner: Taprizz (Jaipur). Sells NFC/QR review plates, a guest page, a Taprizz App (dashboard) and mini links to cafes, restaurants, salons, gyms in Jaipur. Goal: sell to cafes; run ads on the website.
- Two repos on GitHub (org `taprizzweb`):
  - `eco-leads` (this repo): app.taprizz.in (owner dashboard, admin, guest pages, AI review) and mini links at link.taprizz.in. Database: Supabase `taprizz-app` (`znvuvemeaobmwrluwxwd`).
  - `taprizz`: the marketing website www.taprizz.in. Database: Supabase `taprizz Project` (`khthtasavgtpqhesvavc`). Leads table is `leads`.
- Push to `main` after `npx tsc --noEmit`, `npm run lint`, `npm run build`. Website also needs `git push -u origin claude/optimistic-darwin-j7nxej`. Commits end with the attribution lines from the session.

## Owner's rules (never break)
- Never gate reviews: every star rating gets the same flow; 1 to 3 stars see the private feedback box first; the Google link stays for everyone. No rewards or discounts for reviews.
- Never send a guest to review an outlet they did not visit. Never help post reviews for people who were not customers.
- No claims that cannot be proven: not "best", "cheapest", "most famous", "most in demand", not earnings from reviews. Use "latest technology", "most recommended", "made for cafes and restaurants in Jaipur". Offers must be real.
- Do not use other businesses as clients or testimonials. "Demos, not partners" section lists only businesses for whom a demo page really exists (`DEMO_FOR` in website `lib/home-data.ts`).
- Do not download or copy other people's Instagram posts or photos. Owner photos/reels come from the business with its OK. (Carbon photos currently hotlink True Labs' server: replace with files Carbon sends.)
- No payment on the website or the app, except mini link Premium (UPI + screenshot, manual approval). The team talks to every customer first.
- Collect guest names or numbers only if the guest chooses to give them.
- No secrets in chat or code. The owner enters secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY` for the website in Vercel).

## Products and prices (source: website `lib/plans.ts`)
- **Taprizz App**, per month: Starter 1,700, Growth 2,700, Pro 3,500. Terms: 1 month no discount, 6 months 5% off, 12 months 10% off (Pro 12 months 15% off, "Special offer"). No 3-month term.
  - Starter: AI review page, menu link, offers strip, keyword strip, WhatsApp contact capture, basic report, review replies by copy. No POS.
  - Growth: plus first WhatsApp campaign free, complaint inbox, offers with claim codes, events, creators corner, full report, POS free.
  - Pro: plus POS with no separate charges, Gulabi Nagri (membership discounts on listing, first to be listed), staff complaints and reports, call server bell, content help, report with a call, more WhatsApp campaigns, all upcoming updates. "Most premium plan".
  - Free tabletops with an app plan: 2 NFC-based or 4 QR-based. After that: QR 250 each, NFC 450 each.
- **AI QR plates** (without the app): plan 1 month 550/month, 6 months 500/month, 12 months 400/month. Plates: NFC + QR 700 (latest technology, most recommended), QR 600. Setup: 2,000 for 1 plate, 4,000 for 2, stays 4,000 for 3 or more. Custom design: 500 per 10 plates; NOT shown on the page, goes to the team in the lead (`design_estimate`).
- **Mini link**: free (limited) and Premium Rs 150 once.
- Offers on the website hero: free SEO & GEO for first-time customers who take a plan; Rs 1,200 referral reward (cash or discount), claim by contacting.
- Gulabi Nagri: the guest guide app for the Pink City, a pilot; no promises of visits or sales.

## Website pages (www.taprizz.in)
- Home sections: hero offers, partners, demos ("We have built demos for them too"), products, pricing (tabs: Taprizz App / AI Review plates, free tabletops box), advantages, custom experience, Gulabi Nagri, book a meeting.
- Links the owner sends to customers (not in search): `/start/app` (App quote), `/start/ai-qr` (AI QR quote), `/start/custom` (customized experience, website or app). Each saves a lead (`/api/leads`) and ends on a WhatsApp button with the choices pre-written.
- Optional Google Sheet: `docs/ORDER-SHEET.md` (needs `LEADS_SHEET_WEBHOOK` in Vercel). Still to set up.

## Carbon Cafe Jaipur (demo, shown at an event)
- Mini link: https://link.taprizz.in/carbon (slug `carbon`, business `carbon-jaipur`). 3 outlets (C Scheme, Raja Park, Vaishali Nagar) with phone, WhatsApp, Maps. Buttons: Menu (Google Drive), Outlets, Zomato, Swiggy, EazyDiner, Contact Us. Instagram @coffeewithcarbon. AI Review by Tap is ON; review link = C Scheme Place ID. Questions are written for a food-festival stall.
- Place IDs: C Scheme `ChIJI5v4OCm1bTkRe6IPBOuVldM`, Raja Park `ChIJlfZY8Wq3bTkRrYaYt6mFFUg`, Vaishali Nagar `ChIJ89msl2G1bTkRm2rPsjwaPDM`.
- Open: Carbon's OK for photos/logo/name; real logo for the standee; Instagram posts/reels need Carbon's files; confirm the NBC C Scheme demo exists (only one `nbc` page is in the database); standee (4x6 inch portrait) copy: hook "Tap. Scan. See what's inside.", thank-you line, Powered by Taprizz.

## How the owner wants to work
- "Onboard <name>": use `.claude/skills/onboard-business/SKILL.md` (research, Place ID, questions and chips, SEO/GEO keywords, mini link, outlets). Ask only for what cannot be found publicly.
- Owner's laptop (Windows, user SAKSHAM): Settings > Code > "Add folder" does not work for cloud sessions there (shows "cannot be used"). Use a **Local session** in the Claude Desktop Code tab with folder `Documents\Taprizz` (clone `eco-leads` and `taprizz` into it) plus the Claude in Chrome extension.
- Review settings (questions) are guarded by a trigger so only the team can change them; use the admin UI or a team session. A direct database edit was done once for Carbon.

## Still to do
- Website: set `SUPABASE_SERVICE_ROLE_KEY` and `LEADS_SHEET_WEBHOOK` in Vercel; check the live site on a phone.
- App: admin screen for the Carbon-style per-business setup; replace hotlinked Carbon photos; AI-review end to end test on a real page.
- Mini link tutorial video is out of date (shows "pay to go live").
