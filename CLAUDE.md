# Taprizz app (eco-leads) — CLAUDE.md

Next.js 15 app for app.taprizz.in: owner dashboard, admin, guest pages, AI review, mini links (link.taprizz.in).
Database: Supabase project `taprizz-app` (id `znvuvemeaobmwrluwxwd`). Migrations: `supabase/migrations/` (apply with the Supabase MCP, keep the file in git too).

## Do this without being asked to paste anything
- Business setup from just a name: use the `onboard-business` skill (`.claude/skills/onboard-business/SKILL.md`).
- Everything the business needs (questions, chips, SEO/GEO keywords, mini link page, outlets) is saved straight into the database. Ask the owner only for what cannot be found publicly (Instagram handle, Google Place ID, photos, logo, timings).

## Rules
- Never gate reviews (every star rating gets the same flow; low stars see the private feedback box first, Google stays available). No rewards for reviews.
- Never send a guest to review an outlet they did not visit. Never post reviews to a business listing for people who were not customers.
- Never invent facts (prices, staff names, claims). Never use another business's name as a client.
- Do not collect guest names or numbers unless the guest chooses to give them.
- No secrets in chat, code, or `NEXT_PUBLIC_*`.
- Run `npx tsc --noEmit`, `npm run lint`, `npm run build` before pushing to `main`. Commits end with the attribution lines.

## Where things are
- Mini link page `src/components/link/LinkPage.tsx`, editor `src/components/admin/LinkEditor.tsx`, owner screen `src/app/dashboard/[slug]/mini-link/`.
- AI review on mini links: `src/components/link/LinkReview.tsx` + `ReviewFlow`; switched on per page in admin (`link_pages.ai_review`).
- "Mini link only" locked dashboard: admin client page switch (`hidden_sections` contains `mini_only`).
- QR with Taprizz logo: `src/lib/qr-logo.ts`. Mini link base URL: `src/lib/features.ts` (default https://link.taprizz.in).
