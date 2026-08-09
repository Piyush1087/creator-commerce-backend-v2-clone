# Campaign UI Content Dictionary

**Status:** CANONICAL / PHASE 6
**Purpose:** Single source of truth for Campaign user-visible terminology and concise UI copy.

## 1. Canonical Vocabulary

| Use | Do not invent alternatives |
|---|---|
| Campaign Copilot | AI Dashboard / Campaign AI |
| Campaign Details | Campaign Info |
| Products & Briefs | Campaign Assets |
| Discovery | Creator Search |
| Applicants | Applications |
| Collaborations | Active Creators |
| Performance | Analytics Dashboard |
| Reporting | Analytics |
| Brief | Task |
| Product | SKU |
| Creator Profile | Creator Details |
| Share | Invite |
| View | Details |

## 2. Campaign Header

Primary actions:

- View
- Edit
- Share

Compact context:

- `2 Products`
- `5 Briefs`

Combined expandable summary may use:

`2 Products · 5 Briefs  <expand>`

Expanded controls:

- Add Product
- Add Brief

Product and Brief names are shown inline. Their detailed information is opened separately.

## 3. Campaign Lifecycle Labels

- Draft
- Published
- Live
- Paused
- Completed
- Archived

Use only where the underlying canonical lifecycle state permits the label.

## 4. Campaign Copilot

Title:

`Campaign Copilot`

AI summary: maximum approximately 2–3 short lines on mobile.

Priority action examples:

- Review
- View Creators
- Review Applicants
- Find Creators
- Continue Outreach
- View Report
- Review Budget
- Complete Setup

Example action:

`8 new creators found for the campaign` → `Review`

The Review action opens the creator-card quick review surface.

## 5. Performance

Section title:

`Performance`

Possible metric labels, depending on supplied Reporting data:

- Reach
- Impressions
- Views
- Engagement
- CTR
- Conversions
- Budget
- Available
- Committed
- Collaborations
- Completed

Do not use `Campaign Health` as a metric or composite status.

## 6. Products & Briefs

Section title:

`Products & Briefs`

Example product names:

- Glow Face Serum
- Night Repair Cream

Example brief names:

- Instagram Reel
- Instagram Story
- UGC Video
- Product Review Reel
- Story + Link

Buttons:

- Add Product
- Add Brief

Do not display brief description/details inline.

## 7. Discovery

Collapsed example:

`Discovery · 8 New`

Controls:

- Filter
- Profile
- Outreach

Empty:

`No creators found.`

No matching results:

`No matching creators.`

Error:

`Unable to load creators.`

Action:

`Retry`

## 8. Applicants

Collapsed example:

`Applicants · 12 Pending`

Controls/actions:

- Filter
- Approve
- Reject

Empty:

`No pending applicants.`

## 9. Collaborations

Collapsed example:

`Collaborations · 18 Active`

Primary action:

`Open`

Empty:

`No active collaborations.`

Collaboration copy should remain provisional until the Collaboration module is independently specified.

## 10. Detail Surfaces

Campaign drawer:

`Campaign Details`

Product drawer:

`Product Details`

Brief drawer:

`Brief Details`

Creator drawer:

`Creator Profile`

Reporting surface:

`Campaign Report`

Future collaboration surface:

`Collaboration`

## 11. Quick Modals

New creators:

`New Creators`

Pending applicants:

`Pending Applicants`

Share:

`Share Campaign`

Pause:

`Pause Campaign`

Archive:

`Archive Campaign`

Delete Brief:

`Delete Brief`

## 12. Empty / Loading / Error

Generic empty copy should be specific to the surface where possible.

Examples:

- `No products added.`
- `No briefs added.`
- `No pending applicants.`
- `No collaborations yet.`

Generic error:

`Something went wrong.`

Retry:

`Try again.` or `Retry` according to the component context.

Loading:

Use the Design System loading/skeleton pattern. Avoid adding verbose `Loading...` copy when the visual loading state is sufficient.

## 13. Tone

Campaign UI copy should be:

- short;
- action-oriented;
- operational;
- human;
- specific;
- minimally worded on mobile.

Avoid marketing language, technical implementation terminology and unnecessary explanatory paragraphs.

## 14. Copy Authority

When a canonical Campaign contract supplies exact user-facing wording, that wording takes precedence over this dictionary. This dictionary exists to prevent inconsistent labels and AI-generated synonyms where the canonical contract is silent.
