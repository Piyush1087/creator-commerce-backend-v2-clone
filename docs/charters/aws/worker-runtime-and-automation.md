# Worker runtime and automation

**Status:** TBD  
**Point:** Ops workers are **not** always-on daemons. They run **on a schedule, on incident, or on demand** — then stop. That keeps cost and blast radius low and matches “no ad-hoc chat archaeology.”

## How workers run (final setup)

| Trigger | What runs | How (designed) |
| --- | --- | --- |
| **On demand** | Any worker | Human pastes initiation + assignment into a Cursor/agent chat (or CLI runner later) |
| **Weekly hygiene** | Auditor + Cost skim (+ Monitor quiet check) | Scheduled job opens the assignment (EventBridge / cron / Cursor Automation) → agent runs → commits Git + emails |
| **Monthly pack** | Cost + Capacity + Auditor | Same scheduler, monthly |
| **Alarm / incident** | Monitor first | SNS email to `brian@growthverse.in` → human starts Monitor initiation with the alarm text (v1). Later: chatbot/automation can pre-fill the assignment |
| **Pre-campaign** | Capacity | Product asks → on-demand Capacity run |
| **Deploy / Hotfix** | Deploy or Hotfix | Only when Product names an envelope — never on a timer |
| **Temp prod rehearsal** | Full sequence once | See `processes.md` §J — then `return-to-placeholder.md` |

**Not continuous:** no 24/7 agent polling AWS every minute. CloudWatch/SNS watch continuously (cheap platform sensors). **Workers** interpret and record when triggered.

```text
CloudWatch / Budgets / SNS     →  always-on sensors (after INSTALL_*)
        ↓  (email or schedule tick)
Human or automation starts worker chat / runner
        ↓
Worker (read-only unless envelope) → Git artifact + email
        ↓
Session ends
```

## Automation layers (no manual console clicking)

| Layer | Mechanism | Owns |
| --- | --- | --- |
| Infra create/update | **SST CLI** (`sst deploy`) | Deploy worker |
| App-only ship | **Hotfix CLI** (ECS image) | Hotfix worker |
| Inventory / cost / health interpret | **Worker + AWS CLI** (read APIs) | Auditor / Monitor / Cost / Capacity |
| Alarms & budgets | **AWS CLI / IaC** under `INSTALL_*` envelopes | Monitor / Cost install only |
| Tear down to cheap prod | **Automated checklist** via Deploy/Product envelope | `return-to-placeholder.md` |
| Smoke (non-auth) | **HTTP/CLI scripts** against ALB DNS or health URL | Rehearsal / Monitor assist |

Human role: authorize envelopes, confirm SNS email once, read human reports. Not: click-ops in console for routine work.

## When each worker should run

| Worker | Runs when | Does not run |
| --- | --- | --- |
| Auditor | Weekly; before/after deploy or teardown; on demand | Continuously |
| Monitor | Alarm email; weekly quiet check; rehearsal; on demand | Continuously; does not install alarms unless `INSTALL_MONITORING` |
| Cost | Weekly skim; monthly pack; anomaly email; rehearsal | Continuously |
| Capacity | Monthly; campaign ask; sustained high CPU/ACU signal; rehearsal | Continuously; no mute scale without `MUTATE_CAPACITY` |
| Deploy / Hotfix | Explicit Product assignment only | Timers |

## Scheduling sketch (install later)

1. EventBridge (or GitHub/Cursor cron) weekly → “run Auditor+Cost assignment for creator-dev; creator-prod if SSO”.  
2. Same monthly → historic pack template.  
3. SNS → email already; optional second target that opens a prepared worker prompt.  
4. Record every run under `docs/aws-environments/rehearsals/` or dated hygiene folders.

Until that automation exists: **on-demand initiation prompts** are the supported path (still charter-bound, still Git-recorded — not ad hoc).
