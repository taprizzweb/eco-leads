# Plugging in your own trained review AI

Taprizz asks one URL to write two things: the review draft a guest sees, and the reply an owner sends to a Google review.
Your model keeps its own rules and training. We only send the facts and read the text back.

## Switch it on (Vercel, Settings, Environment Variables)

| Name | Value |
|---|---|
| `REVIEW_AI_PROVIDER` | `custom` |
| `REVIEW_AI_URL` | the https address of your model's endpoint |
| `REVIEW_AI_SECRET` | optional. Sent as `Authorization: Bearer <secret>` so only Taprizz can call it |

Then redeploy. If the URL is slow (over 8 seconds), fails, or returns nothing, the guest or owner still gets a built-in
draft, so a page never breaks. The secret lives only in Vercel, never in the code or in chat.

## Easiest way to check it

In the admin panel open **Integrations** and press **Send a test review**. It shows whether your model answered,
how long it took, the text it sent back, and a plain hint if something is wrong (wrong secret, wrong address, an error
inside your project, or an empty answer).

## What we send (POST, JSON)

Review draft, from a guest's own answers:

```json
{
  "task": "review_draft",
  "business": { "name": "Brew & Bloom", "type": "cafe" },
  "rating": 5,
  "answers": { "chips": ["Coffee", "Ambience"], "company": "friends", "recommend": "yes" }
}
```

Reply to a Google review, pasted by the owner:

```json
{
  "task": "review_reply",
  "business": { "name": "Brew & Bloom", "type": "cafe" },
  "review": { "author": "Ananya S.", "rating": 2, "text": "Waited 20 minutes for a cold coffee." }
}
```

## What we expect back

```json
{ "text": "the review or the reply, as plain text" }
```

(`review` or `reply` also work as the key.) Plain text only, no quotation marks.

## Rules we keep on our side

- A draft uses only what the guest answered. We never add facts, and nothing is ever offered in return for a review.
- Guests can edit the draft before copying it, and Google's own review button is always shown.
- Your model should follow the same rules for replies: no discounts, gifts or rewards, no arguing, no asking for another review.

## Today's other options

`REVIEW_AI_PROVIDER` can also be `openai`, `gemini` or `anthropic` (with their key), or `template` for the built-in sentences.

## Gemini only, with several keys as backups
- Set `REVIEW_AI_PROVIDER=gemini` in Vercel.
- Put up to 6 Gemini keys in `GEMINI_API_KEYS`, comma separated, in the order to try (or one key in `GEMINI_API_KEY`). A key that is used up, busy or refused (401, 403, 408, 429, 5xx, timeout) hands over to the next key. A bad request (400) is not retried.
- To use no other AI, remove `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` from Vercel. A backup runs only when its key is set. If every Gemini key fails, the guest gets the plain built-in review.
- Keys go only in Vercel, never in code or chat. Check Google's Gemini API terms before spreading use across several accounts; one paid key is safer.

## Speed limit and writing rules
- The AI gets `REVIEW_AI_BUDGET_MS` (3000 by default). If it has not answered in that time, the guest gets the plain review built from their own picks. Each Gemini key waits at most 2.5 s and never longer than the time that is left.
- For speed use a fast model, for example `REVIEW_AI_MODEL=gemini-flash-lite-latest`.
- The prompt asks for correct grammar, spelling and punctuation, and for search-friendly wording: the business name, the kind of place and up to two of the business's own keywords, only where they are true to what the guest chose, never stuffed.
- The total wait the guest sees also includes the page's own steps before and after the AI.

## A failed key rests
A Gemini key that is busy, used up or slow is skipped for 1 minute (30 seconds after a timeout), and a refused key (401 or 403) for 10 minutes, so a rush does not keep waiting on it. If every key is resting they are all tried again, the one that rests the shortest first. The memory is per server instance and is lost on a new deploy.
