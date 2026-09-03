# C-05 checklist vs origin port

Mapped from `c05-developer-code-integration-handoff-v1.md`.

| Handoff item | Origin status |
|--------------|---------------|
| Persistent Creator shell nav (6 items; Marketplace hidden) | Ported |
| Settings routes account/profile/team/instagram/payouts | Ported |
| `/creator/settings/social` → Instagram | Ported |
| Actor/subject contract; `associatedEmail` not authorization | Ported |
| Team Owner/Manager/Assistant policy; 5-seat cap | Ported; scoped tests 124/125 (one assertion-order fail). UI: `../ui-verification.md` C05-10 / C05-R |
| Instagram six-state Settings facade over C-01 continuity | Ported; live lifecycle BLOCKED. UI load: C05-11 |
| Encrypted payout destination; legal profile without PAN/KYC | Ported; UI drawers: C05-12. No payout execution |
| `POST .../payouts/bank` → 410 | Ported |
| Brand Settings regression retained | PARTIAL — FE 3 fails are dialog vs Aurora aside. UI: C05-13 |
| Additive-only four C-05 migrations | Ported; IDs unchanged |
| Replay 0→74 on clone disposable DB | Clone evidence only; origin expected 82 after C-01+C-05 |
| Production encryption-key custody | Deferred |
| Real PostgreSQL contention suite | Deferred / BLOCKED |
| Local UI smoke | PENDING — `../ui-verification.md` § C-05 |
| C-02 / C-03 / C-04 / C-06 business behavior | Out of scope |

## Product-visible changes to tell product before merge

- Creator nav loses Marketplace / Insights / Profile items
- Settings: Account, Profile & Contact, Team, Instagram, Payouts & Legal
- `POST /api/v1/creator/settings/payouts/bank` → 410
