# Logging and tracing

**Status:** TBD  
**Audience:** eng + anyone debugging “API is slow / broken”  
**Notify:** findings still email `brian@growthverse.in` when Monitor is active

## Goal

When Monitor says the API is unhealthy, an engineer can find **recent logs for the failing service** without rediscovering ECS log group names in chat.

## Current intended shape

| Layer | Where logs go (typical SST/ECS) | Notes |
| --- | --- | --- |
| Nest API (ECS Fargate) | CloudWatch Logs log group on the service/task | Confirm exact group name on Auditor/LIVE install |
| ALB | Optional access logs → S3 | **Not required day-one**; enable if forensics needed |
| Aurora / RDS | Engine logs / Performance Insights later | Enable thoughtfully (cost + noise) |
| Frontend (CloudFront) | Standard CF metrics; limited “app” logs | FE errors often browser/Sentry-class — out of this file unless Product adds tooling |

App already uses structured Nest logging for some paths (e.g. Postmark). Prefer **one request id** in logs when we add/propagate it (future eng task — document here when done).

## Retention (design defaults — set at install)

| Log class | Starter retention | Why |
| --- | --- | --- |
| ECS application logs | 14–30 days | Enough for weekly ops; cost-bounded |
| ALB access logs (if on) | 30–90 days | Incidents rarely need older |
| Audit-style (if any) | Per compliance later | Not defined yet |

Put real retention values in this table when configured.

## What to log (product rules)

| Do | Do not |
| --- | --- |
| Request path, status, duration, error class | JWT, OTP codes, passwords, raw tokens |
| TemplateId / MessageId style provider refs | Full provider payloads with PII if avoidable |
| `STAGE` and task id when useful | Secrets from env |

Prod must keep OTP out of logs (`STAGE=prod` behavior already intended in app).

## Tracing (phased)

| Phase | What |
| --- | --- |
| **Now (docs)** | Know log group + how to filter last 1h around an incident |
| **Soon after LIVE** | Metric filters on ERROR / 5xx patterns → optional alarm (register later) |
| **Later** | OpenTelemetry / X-Ray only if Product wants cross-service traces |

Do not block go-live on full distributed tracing.

## Engineer quick path (LIVE / wake-dev)

1. Confirm env (dev vs prod LIVE).  
2. ECS → service → Tasks → View logs (or CloudWatch log group).  
3. Filter by time window of the alarm.  
4. Correlate with ALB 5xx spike time.  
5. If empty logs: task crash-loop / wrong cluster — Monitor scenario, not “app bug” yet.

## Monitor worker use

Monitor may cite log evidence in incident notes but must not dump secrets. Cost/Capacity do not own log retention — eng updates this file when retention changes.
