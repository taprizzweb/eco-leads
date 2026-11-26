# Handoff for the next session

Read `docs/HANDOVER.md` too (plan, prices, rules). This file says what was built, where we stopped and what comes next. No passwords, keys or secrets are written here and none should be added.

## What has been built (all pushed to `main`)
**App (`eco-leads`, app.taprizz.in and link.taprizz.in)**
- Mini link self-serve: free (limited) and Premium Rs 150 once, paid by UPI with a screenshot and approved by the team; easy step-by-step editor; locked premium features.
- **AI Review by Tap** on mini links: a button (own name and position), switched on per page in admin, only for a page linked to a registered business with a Google review link. Same flow for every rating; 1 to 3 stars see the private feedback box first (name and phone optional, only if the guest chooses); stars pop up once when a guest returns from another link.
- Owner dashboard "Mini link only" mode: every panel is visible but locked except Mini link; the Mini link screen shows visits, taps, AI review counts and complaints.
- Contact form on mini links, with messages shown to the owner and in admin.
- QR codes carry the small round Taprizz logo; mini link QR download only in admin (editor and links list).
- The Taprizz top-left logo and "Powered by Taprizz" open taprizz.in; each button gets the logo of the site it points to.
- Mini link base is https://link.taprizz.in. Package prices in the database: Starter 1,700, Growth 2,700, Pro 3,500.
- `onboard-business` skill (name in, research, questions and chips, SEO and GEO keywords, mini link). `CLAUDE.md` and `docs/HANDOVER.md` for new chats.
- Migrations 0055 to 0059 are applied to the live database.

**Website (`taprizz`, www.taprizz.in)**
- Hero offers (free SEO and GEO for first-time customers who take a plan; Rs 1,200 referral reward).
- Pricing section with tabs (Taprizz App, AI Review plates), Pro special offer (15% on 12 months), free tabletops box; plans live in `lib/plans.ts`.
- Quote pages not in search: `/start/app`, `/start/ai-qr`, `/start/custom`; each saves a lead and ends on a pre-written WhatsApp message.
- "We have built demos for them too" section, and "Be ready for your customized customer experience" section.

**Earlier in this project (kept short)**
- Pitch material for Nothing Before Coffee (deck, email, video), a LinkedIn approach to the Crazy Coffee founder, and a mini link tutorial video (now out of date).

**Carbon Cafe Jaipur demo**: https://link.taprizz.in/carbon. 3 outlets, buttons, Instagram, contact form, 10 photos, AI Review on with the C Scheme review link, stall-style questions.

## The last task
The owner asked for a handoff so a new session knows everything. Before that: the laptop automation attempt (Settings "Add folder" shows "cannot be used" on the owner's Windows, so use a Local session in the Claude Desktop Code tab with a folder like `Documents\Taprizz`), feedback on the Carbon standee design (4x6 inch, portrait), and a check that the live website shows all changes (it does, on www.taprizz.in).

## Not finished
- Website: two settings must be added by the owner in Vercel (the database service key and the Google Sheet webhook address), otherwise leads are not saved or sent to a Sheet (steps in the website repo, `docs/ORDER-SHEET.md`). The forms still end on WhatsApp.
- Carbon: photos are hotlinked from another company's server and must be replaced with files Carbon sends; Carbon's OK is needed for the demo, photos and name; the real Carbon logo is needed; Instagram posts and reels need Carbon's own files.
- Standee: print-ready 4x6 portrait PDF and PNG not made yet. Copy agreed: hook "Tap. Scan. See what's inside.", a thank-you line, "Powered by Taprizz · taprizz.in", and an NFC symbol only if the plate has NFC.
- Check whether an NBC C Scheme demo really exists before keeping it in the demos list (only one `nbc` page is in the database).
- Favicon: the owner saw a black triangle tab icon; the page serves the green mark, so it is probably cache or another site.
- Mini link tutorial video is out of date.
- No end-to-end test yet of the AI review on a real mini page, or of the three `/start` forms through to WhatsApp and the lead.

## Owner decisions and preferences
- Writes Hinglish; wants short answers in simple Hinglish and things done, not only advised.
- Wants everything automated from one prompt ("onboard <name>"): research, Place IDs, links, questions, SEO and GEO keywords, logo, photos.
- Prices and discounts as in `HANDOVER.md`; only the 1, 6 and 12 month terms. The design price is not shown on the page. Free tabletops, setup fee and plates as written there.
- Wants strong, exciting headlines but accepts "latest technology" and "most recommended" instead of unprovable claims like "best", "cheapest", "most in demand".
- Review link for Carbon: decided by the owner (C Scheme). Never gate reviews, never route a review to an outlet the guest did not visit.
- Wants mini links for all cafes, and a standee with a QR that makes people curious (not "follow us" or "leave a review").
- Does not want payments taken on the website or in the app (except mini link Premium).

## Next step
1. Owner adds the two Vercel settings on the website project (or says to skip the Sheet).
2. Get Carbon's OK, logo, photos and reels; replace the hotlinked photos; make the print-ready standee (ask: NFC plate or QR only).
3. Test the three `/start` forms and the Carbon AI review on a phone, and fix what breaks.
4. Run an SEO audit (SEOcrawl AI connector) to back the free SEO and GEO offer with real numbers.
5. Move to a Local session on the laptop (`Documents\Taprizz`, clone both repos, Claude in Chrome) so the owner only says "onboard <name>".
