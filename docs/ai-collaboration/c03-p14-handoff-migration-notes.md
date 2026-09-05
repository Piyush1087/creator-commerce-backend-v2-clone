# C-03 P1.4 Application handoff and notifications

Candidate based on accepted P1.3 `4780c4924e85039a3cbb9e235b7c3af5a8b4e7dd`.
This checkpoint does not authorize P2, production deployment, or C-04 workflow development.

## Persistence and transaction

Migration `20260910122000_c03_application_handoff_notifications` is the single
78→79 migration. Existing migrations are unchanged. It adds nullable, unique,
immutable `Collaboration.sourceApplicationId`, its restrictive Application FK,
and a restrictive approval-event link. The existing deferred Application evidence
guard and new approved-event link guard prevent committing approval without the
matching Application-sourced Collaboration.

Global Campaign/Creator uniqueness becomes a nonunique lookup index. A partial
unique index preserves that constraint for legacy rows only. Existing legacy
Brief/Product references, commercial values, messages, and workflow state are
preserved. No source lineage is inferred or backfilled.

`Collaboration.handoffCommercialState` uses the new nullable enum
`CollaborationHandoffCommercialState`: `FIXED_AGREED` or
`AWAITING_CREATOR_PROPOSAL`. Legacy rows retain null. Canonical rows have no
legacy Brief/Product/pipeline reference. FIXED seeds only the immutable snapshot
offer as finalQuote; NEGOTIABLE keeps initialQuote, brandCounterOffer and finalQuote
null. Both retain round zero and zero advance/balance amounts. No welcome message,
identity creation, inventory change, or negotiation action is invoked.

Application commands retain workspace-first locking, current authorization,
conditional status/version updates, and scoped receipt replay. Approval generates
one transition UUID, updates the Application, provisions Collaboration, appends
the linked event, enqueues notification intent and recipient snapshots, then writes
the receipt in the same transaction. Submit and Reject similarly append their
notification intent before their receipt. Any failure rolls back the transaction.

## Notification compatibility

Notification and NotificationJob retain `workspaceId` as the Brand-profile FK and
add `creatorWorkspaceId`. Both have an exactly-one-scope check. Independent
NULL-distinct unique keys on Brand and Creator scopes preserve existing Brand
semantic deduplication and enforce Creator deduplication without cross-scope
collisions. NotificationJob gains the previously absent Brand FK after preflight.

The existing submitted event produces Brand `campaigns.application_received`.
Exactly two events are added: `campaigns.application_approved` and
`campaigns.application_rejected`. Both require in-app delivery, have OPTIONAL
email policy, and link to `/creator/campaigns/applications/{application_id}`.
Payloads contain only Application/Campaign IDs and, for approval, Collaboration ID.
Source identity is `c03_application` + Application ID + transition UUID.

Creator recipients are active Owner/Manager/Assistant memberships with an active
Creator User, deduplicated by User ID. Associated email is not identity authority.
There is no canonical Creator optional-email opt-in authority; Creator snapshots
therefore use `NOT_REQUIRED` for email while preserving their required inbox
obligation. Brand preferences and email behavior are unchanged. Materialization,
email work, and realtime delivery run after the Application transaction commits.

The four Creator notification read/read-state routes reuse current C-05 actor
resolution, lock and revalidate membership, scope by current User and workspace,
and do not consult Instagram. Responses are private/no-store. Brand routes remain
unchanged. Application history and Brand applicant projections resolve the unique
Application-sourced Collaboration. Canonical Collaboration Brief display comes
from immutable Application evidence.

## Migration evidence and recovery

The bounded local runner captures an exact 78-migration preflight and a complete
before-state of representative legacy Collaboration/commercial/message rows,
Brand notification/job/recipient/email rows, and canonical Application evidence.
The upgrade verifier compares every original field and row count and all 78
historical migration checksums. A separate fresh database replays all 79 migrations.
P1.4 runtime resources are isolated from P1.2/P1.3 and have no published PG port.

Do not roll back by dropping lineage/scope columns or deleting history. Before
publication, only the uncommitted migration may be corrected on disposable P1.4
databases. Once published, migration 79 is immutable; a database correction requires
new SA authority. No production migration or rollback is authorized here.

Independent SA acceptance is required. The runner's evidence report, not this
implementation note, records final test totals, commit identity and acceptance state.
