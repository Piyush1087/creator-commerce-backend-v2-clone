# Brand escrow — expected behaviour (plain language)

This document explains what a brand user should see and what should happen when they use escrow in **Settings**. It is written for product, QA, and anyone who is not reading code.

---

## Where to find it

- In the brand app, open **Settings** (footer navigation).
- Escrow lives under **Settings → Escrow** (and a summary also appears on **Settings → Billing**).

---

## First visit — no vault yet

**What you see**

- A card titled **Secure Escrow Account**.
- An explanation that you must set up escrow before campaigns and payouts can run.
- A green button: **Initialize Secure Escrow Vault**.
- No balance numbers yet (those areas show **—** once the vault exists but data is missing).

**What should happen when you click Initialize**

1. The screen shows **Provisioning in progress** for a short time.
2. The system creates a dedicated virtual bank account for your brand (via Razorpay).
3. When finished, the vault is **Active**.
4. Balances start at **₹0** (or your currency).
5. You see bank transfer details (virtual account number, IFSC, bank name).
6. **Beneficiary name** may show **—** until we add that field from the payment partner.

You do **not** pay anything to initialize. Setup is free.

---

## Active vault — everyday view

**What you see**

- Status badge: **Active**.
- Three balance boxes:
  - **Total Pooled Balance** — all cleared money in your vault.
  - **Locked Campaign Funds** — money reserved for live collaborations.
  - **Available Balance** — money you can still allocate to new work.
- **Virtual account details** (expandable) — use these for bank transfers.
- **Top Up Balance** button.
- **Financial Ledger** — list of money in and out. If nothing has happened yet, you still see the ledger section with **—** in the row (the section is never hidden).

**Important display rule**

- If the app does not have a value, it shows **—** (em dash), not a fake number and not a hidden section. Use **—** to spot gaps in design or API coverage.

---

## Adding money — two ways

### 1. Bank wire (NEFT / RTGS / IMPS)

1. Click **Top Up Balance**.
2. Enter how much you want in the vault.
3. Choose **Bank Wire**.
4. Copy the virtual account number and IFSC from the drawer.
5. Send money from your company bank account to those details.
6. Close the drawer (no card checkout for this path).

**What happens behind the scenes**

- Razorpay detects the incoming transfer to your virtual account.
- Our server receives a webhook and credits your vault.
- Balances and the ledger update after the transfer clears (this can take minutes, not seconds).

### 2. Corporate card (instant)

1. Click **Top Up Balance**.
2. Enter an amount.
3. Choose **Instant Deposit (Corporate Credit Card)**.
4. Review the fee breakdown (2% gateway fee + GST on the fee for INR).
5. Click **Proceed to Secure Payment Gateway**.
6. Complete payment in the Razorpay popup (test cards in test mode).

**What should happen**

1. Screen may briefly show **Processing** while we confirm payment.
2. On success: a confirmation modal — **Escrow Top-Up Cleared**.
3. Balances go up by the **allocation** amount (not the total charged to the card, which includes fees).
4. A new **Card top-up** line appears in the ledger.

**If payment fails or you close the popup**

- A **Transaction Failed** (or cancelled) message.
- No change to vault balance.
- You can try again.

---

## Ledger entries (what they mean)

| What you might see | Meaning |
| --- | --- |
| Bank wire top-up | Money arrived via bank transfer |
| Card top-up | Money arrived via card |
| Contract lock reserve | Funds set aside for a collaboration |
| Advance payout (30%) | First creator payout tranche |
| Final payout (70%) | Second creator payout tranche |
| Platform fee capture | Platform commission taken from escrow |
| Collaboration refund | Money returned after a cancelled collaboration |

---

## What is **not** in Settings UI yet

These flows exist on the server but are **not** screens in Settings today:

- Locking funds when a collaboration moves to production (Stage 2).
- Releasing 30% / 70% payouts to creators.
- Cancellation refunds tied to collaboration stages.

Brands will use those through the **collaboration workflow** once that UI is connected. See `gaps-and-missing-setup.md`.

---

## Who can use it

- Only a **logged-in brand** user tied to a brand profile.
- The app uses your login session; you do not pick a brand ID manually.

---

## Summary flow (bird’s-eye)

```text
Sign in as brand
    → Open Settings → Escrow
    → (First time) Initialize vault → Active with ₹0
    → Top up via bank OR card
    → Money shows in balances + ledger
    → (Later, in collaboration flow) Lock → Pay creators → Refund if cancelled
```
