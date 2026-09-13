# External dependencies

**Status:** TBD  
**Audience:** product + eng + anyone getting “site down” email  
**Point:** AWS can be green while the product still fails.

## Why this file exists

Monitor’s `/health/live` proves the **API process** is up. It does **not** prove email, payments, Instagram, or DNS at Wix.

## Dependency register

| Dependency | Used for | Dev notes | Prod LIVE notes | Who notices failure |
| --- | --- | --- | --- | --- |
| **Postmark** | OTP, reset, invites, notifications | Templates `*-v2`; sending may be paused | Must send for real auth | Users can’t log in / reset |
| **Razorpay** | Payments, webhooks | Test keys | Live keys + webhook URLs | Checkout / payouts |
| **Meta / Instagram APIs** | Creator connect / marketplace | App review / redirect URIs | Prod redirect URIs | Connect flows |
| **Google OAuth** (if enabled) | Login | Client IDs per env | Prod client | Login |
| **Wix DNS** | Pretty names (`dns: false` in SST) | `*.dev.thecreatorshop.in` | `api` / `dashboard` CNAMEs | “Site not found” / TLS mismatch |
| **ACM certs** | ALB / CloudFront TLS | Per-account certs in SST | Must stay issued + attached | Browser TLS errors |
| **S3 / CloudFront** | FE + files | Dev/prod distributions | LIVE dashboard origin must be real app | Blank/placeholder UI |

Update rows when vendors or URLs change. **No API keys in this file.**

## Health vs dependency (triage)

| Symptom | Check AWS first? | Check dependency? |
| --- | --- | --- |
| `/health/live` fails | Yes | After |
| Health OK, OTP never arrives | No | Postmark (templates, pause, From domain) |
| Health OK, pay fails | No | Razorpay dashboard / webhooks |
| API NXDOMAIN | DNS/Wix | Not ECS |
| Dashboard shows SST placeholder | CloudFront origin | Not Nest |

## Process

1. Monitor classifies **AWS** vs **external**.  
2. If external: note vendor + evidence; email `brian@growthverse.in`.  
3. Do not scale ECS/Aurora to “fix” Postmark.  
4. Record lasting changes (e.g. Postmark unpaused) in register notes above.

## Synthetics (optional later)

Day-one LIVE: HTTP check on `/health/live` is enough.  
Later: one authenticated smoke (OTP request **without** asserting mail delivery if paused) — only if Product wants it.

## Out of scope

- Vendor contract management  
- Full status-page product  
