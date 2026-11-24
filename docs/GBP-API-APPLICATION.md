# Google Business Profile API: access request text

Fill the `[ ]` parts before sending. Nothing here is submitted yet. Send it through Google's Business Profile API access request form
(find it from the "Prerequisites" page of the Business Profile APIs documentation, and use the Google Cloud project you want approved).

## Why the first request was refused (Google's reply, Nov 2026)
Google's email said the application could not go ahead because:
- The email used to apply must belong to an **Owner or Manager of a business listing that has been verified for at least 60 days**.
- The listing must have a **working website on its own unique domain**, and the **website URL in the application must be an exact match** of the URL shown on the Google Business Profile.

So the application must come from Taprizz's own Business Profile (or another listing the applicant owns or manages) that meets both points.
If a listing already meets them and Google still refused, contact the Business Profile API support team and choose **General API Question**.

## Before you apply
- A Business Profile for Taprizz exists, is **verified, and the verification is more than 60 days old**.
- That profile shows a website on its own domain (for example https://taprizz.in), the site really works, and the same address, written exactly the same way
  (http or https, www or not, trailing slash or not), is the website URL in the application.
- The email used to apply is an **Owner or Manager** of that profile.
- Use one Google Cloud project for this and note its **project number** (not the name).
- The OAuth consent screen needs the app name, a support email, the **privacy policy URL** and the domain `taprizz.in`. The scope
  `https://www.googleapis.com/auth/business.manage` is a sensitive scope, so Google will also ask to verify the app.
- A short screen recording of the reviews panel (reading a review, writing and approving a reply) helps.

## Text to paste

**Company / product:** Taprizz (https://taprizz.in), India. Contact: [name, email, phone]. Cloud project number: [number].

**What we do:** Taprizz gives restaurants, cafes, salons, clinics and similar local businesses a QR or NFC plate and a dashboard
(https://app.taprizz.in). Guests tap the plate, choose what they liked, get a draft review written from their own choices, edit it,
and post it themselves on Google. The business owner uses the dashboard to see feedback and respond.

**Why we need the API:** To let a business owner manage the reviews of their own Google listing from the Taprizz dashboard, in one place.
- The owner or manager signs in with their Google account and approves access (OAuth). We only ever see the locations they grant.
- We read their reviews (accounts, locations, reviews.list / get) and show them in the dashboard with rating, text and reply status.
- The owner replies from the dashboard (reviews.updateReply). A reply can be drafted by software, and the owner approves it before it is posted.
  If an owner switches it on, replies to 4 and 5 star reviews may be posted automatically after a short delay. 1 to 3 star reviews are never
  answered automatically; they are shown to the owner to answer.
- Optional: reviews.deleteReply, so an owner can remove a reply from the dashboard.

**API methods we expect to use:** accounts.list, accounts.locations.list, accounts.locations.reviews.list / get / updateReply / deleteReply.
We do not need posts, media, listing edits or any data of locations the owner has not granted.

**Data handling:** We keep review text, rating, reviewer display name, date and reply status only to show them to the business that owns the
listing. We do not sell, share or use this data for advertising. Access tokens are stored encrypted on the server. The owner can disconnect at any
time. [Before sending, confirm: on disconnect we delete the tokens and the stored reviews of that location.]

**Policy compliance:** We do not gate reviews by rating, we do not offer rewards or discounts for reviews, we do not post reviews on behalf of
guests, and replies never offer discounts or make health or result claims. Guests post their own reviews on Google.

**Expected usage:** About [number] locations in the first three months, [number] review reads and replies per day.

**Links:** Privacy policy [URL]. Screen recording [URL].
