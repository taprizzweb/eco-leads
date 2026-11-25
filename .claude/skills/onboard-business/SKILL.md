---
name: onboard-business
description: Set up a new Taprizz business from just its name. Researches the business from public sources, creates the client, review questions and chips, Google review link, mini link page and (only when the owner agrees) photos and logo. Use when the owner says "onboard <name>" or "set up <name>".
---

# Onboard a business from its name

Input: the business name (and city if not Jaipur). Everything else is found, drafted and shown for a quick OK. Never invent facts.

## 1. Research (public sources only)
- WebSearch the name + city. Collect: official site, Google Maps listing, Instagram handle, phone, address, opening hours, what kind of business (cafe, salon, gym, hotel, clinic, restaurant...), 5-10 things guests really mention (menu items, services, vibe) from the business's own site/menu and public review summaries.
- Find the Google **Place ID** (Maps listing / Place ID finder). Review link = `https://search.google.com/local/writereview?placeid=<ID>`. Open it once to confirm it is the right business. If unsure, ask the owner; never guess.
- Write down every fact with its source. If a fact is missing, leave it empty.

## 2. Draft the setup (show it before saving)
- `business_type`: closest of cafe | salon | gym | hotel | clinic | generic. Use that category's questions as a base (`src/lib/review/questions.ts`) and change them to fit THIS business: use real menu items / services as chips (e.g. a dosa place: "Masala dosa, Filter coffee, Idli"). 5-8 questions, 4-8 chips each, plain words.
- Give each question its Hinglish and English text (`tr`), same chip order. Optional "write your own" box where it helps.
- Never put medical claims, prices, staff names or results in chips. Banned words: 100%, guaranteed, cure, miracle, no side effects.
- Suggest colours from the logo (`accent`), tagline (max ~8 words), and mini link buttons (Menu, Instagram, Maps, Call, WhatsApp) with the real URLs found.

## 3. Photos and logo
- Use only what the owner sends or what is on the business's OWN site/social with their consent. Do not scrape or re-host other people's photos. If none, leave empty and tell the owner what to send. Logo: ask for the file, or use the site's logo only if the owner OKs it.

## 4. Save (after the owner says OK)
Supabase project `taprizz-app` (znvuvemeaobmwrluwxwd). Prefer the admin UI paths the app already uses:
1. `clients` insert: name, slug (lowercase, dashes, free), business_type, google_review_url, package_id, expires_at, theme. Check slug is free first.
2. `clients.review_setup` (questions, languages) and `review_chips`/`keywords` as drafted. Test the guest page `/e/<slug>` or `/<code>` loads and one AI review is written (use the preview, no real data saved).
3. Mini link: `link_pages` row with `client_id` set, buttons, socials, `ai_review` only if the owner wants "AI Review by Tap".
4. Owner invite via `invites` (email) when given. Plates only if asked.
Use transactions or clean up on failure; destructive SQL needs the owner's confirmation.

## 5. Report back
One short list: what was created, links (guest page, mini link, dashboard), what is missing (photos, logo, Place ID unsure), and anything you were not sure about. Never claim "done" without showing the checks that passed.

## Rules
- Own clients only. No gating of reviews, no rewards for reviews, no stored guest answers.
- Never use another business's name as a client or testimonial.
- Secrets never in chat or code.
