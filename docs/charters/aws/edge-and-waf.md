# Edge and WAF (public entry)

**Status:** TBD — decision record  
**Audience:** product + eng  
**Scope:** What sits in front of the API (and briefly the dashboard) once LIVE

## Current design (SST)

```text
Client → ALB (HTTPS, ACM cert, dns: false / Wix CNAME) → ECS task :80
Dashboard → CloudFront → S3 (FE)
```

- ALB health checks `/health/live`.  
- Idle timeout raised for long brand-scan requests (see `sst.config.ts`).  
- **No AWS WAF** is declared in SST today.

## Decision for early LIVE (recommended)

| Control | Early LIVE | Later |
| --- | --- | --- |
| HTTPS on ALB | **Required** (already) | Keep |
| AWS WAF on ALB | **Defer** unless abuse appears | Add managed rule groups + rate limits |
| CloudFront WAF (dashboard) | **Defer** | Optional with FE hardening |
| Rate limit auth / OTP / webhooks | Prefer **app-level** limits first | Edge rate rules as backup |
| DDoS (AWS Shield Standard) | Included with ALB/CF | Shield Advanced only if justified |

**Rationale:** You are cost-sensitive, prod may stay PLACEHOLDER until real go-live, and first risks are misconfig/cost more than nation-state DDoS. App auth throttles + ALB-only is an acceptable early posture **if Product accepts residual risk**.

## When to revisit WAF (triggers)

- Credential stuffing on login/OTP  
- Expensive endpoints scraped (scans, AI routes)  
- Webhook floods (Razorpay)  
- Cost anomaly from traffic with low conversion  

Then: attach WAF WebACL to ALB (and document rule IDs here).

## What eng should still do without WAF

- Keep auth OTP / login rate limits in application code.  
- Validate webhook signatures (Razorpay, etc.).  
- Do not expose DB or bastion publicly.  
- Keep admin/debug routes off prod.

## Explicit non-goals (for now)

- Multi-CDN  
- API Gateway in front of Nest (unless Product redesigns)  
- Putting WAF install into Monitor’s day-one LIVE checklist as mandatory  

Monitor may still alarm on traffic spikes (capacity/cost), which is separate from WAF.
