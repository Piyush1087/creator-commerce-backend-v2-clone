# Intelligence Execution Profiles

Execution Profiles define **how already-defined Intelligence processors are orchestrated for a use case**.

They define execution order, parallelism, gates/checkpoints, prerequisites, active processor scopes, partial execution behaviour and failure handling. They do **not** define processor reasoning, evidence semantics, model instructions, or the events/schedules that trigger execution.

## Identity Onboarding — v1.0 FROZEN

Machine-readable profile: `identity_onboarding.yaml`

### Journey

```text
Website submitted
       |
       v
Application / scan admission
 |- verified brand exists -> stop / contact admin
 |- eligible reusable result <7 days -> reuse; no new scan
 |- abuse threshold reached -> verify domain before new scan
 `- fresh scan admitted
       |
       +---------------- parallel ----------------+
       |                                          |
       v                                          v
Gatekeeper                                Website Evidence acquisition
Gemini direct                            Zyte -> Cheerio -> page discovery
industry + sub-industry
       |
       v
SUPPORTED?
 |- NO / UNRESOLVED -> stop onboarding
 `- YES
       |
       v
identity_core
       |
       `-- country -> deterministic reporting_currency
       |
       v
EARLY IDENTITY CHECKPOINT
       |
       | displayed objects != editable objects
       | country / website currency may be AI-null
       | but are required before checkpoint submit
       | manual changes remain provisional
       v
persist checkpoint state; active worker exits
       |
       v
DOMAIN VERIFICATION
       |
       |- failed/abandoned -> discard provisional edits
       `- verified -> resume profile -> commit edits + apply onboarding locks
       |
       +-----------------------------+
       |                             |
       v                             v
industry_niche                market_geography
confirmed industry/           confirmed country + website
sub-industry                  + optional Similarweb/Instagram
       +-------------+---------------+
                     |
                     v
             Identity complete
                     |
                     v
       Remaining Surface Intelligence
```

The Identity checkpoint is **not the final Surface Intelligence review**. Its purpose is to correct critical Identity anchors before downstream Surface Intelligence depends on them.

### Important boundaries

- Trigger rules are separate from the Execution Profile. The compiler runs the profile when asked.
- `website_url`/domain is application input, not AI-derived Intelligence.
- Evidence Acquisition may run in parallel with AI execution but is a separate architectural responsibility.
- User edits made before domain verification are provisional; they become canonical only after successful verification.
- Domain verification is asynchronous: profile state is persisted, the active worker exits, and execution resumes after the application supplies the verification outcome.
- Optional Similarweb/Instagram evidence must not block Identity completion.
- Onboarding lock means the field cannot be changed through normal user editing or automated Intelligence refresh; it does not make the database field physically immutable. Explicitly authorized admin/system correction remains possible.
- Existing canonical backend fields remain the storage source of truth where they already exist. An Intelligence Object definition must not automatically create a duplicate value store.

### Scan-admission safeguards used by onboarding

The application journey applies these rules before dispatching a fresh Identity onboarding scan:

1. If the normalized brand/domain already exists as a verified brand, do not start onboarding; return the existing-brand/contact-admin journey.
2. If an **eligible reusable result** exists for the same normalized website within the last 7 days, reuse it rather than spending AI/acquisition resources on a new scan. A technical failure or incomplete failed scan is not a reusable result. Abandoned provisional manual edits are never reused.
3. Abuse/rate safeguard: when the configured threshold is reached (currently 5+ websites added by a user or the same website added 5+ times), require domain verification before allowing further onboarding/new scan execution.

These are application/scan-admission policies. They call, resume, reuse, or withhold the Execution Profile; they are not Intelligence processor reasoning.

### Retry principle

Retry the failed task rather than restarting the entire profile when valid prerequisite evidence/state can still be reused.
