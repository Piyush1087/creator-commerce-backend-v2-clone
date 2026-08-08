# Discovery Workspace UI Contract

**Status:** FROZEN

## 1. Workspace presentation

Discovery is the first Campaign creator workspace. Campaign Page orchestration decides whether the workspace is visible. Downstream Applicants and Collaborations are hidden until their own activation conditions are met; unavailable workspaces are not shown as disabled tabs.

When Discovery is the only visible workspace, the redundant workspace-tab/title treatment may be omitted.

## 2. Creator list

The primary surface is the Campaign-level creator list. Creator matching is not Product- or Brief-specific.

Marketplace-recommended creators are ordered using the internal Recommendation Score/rank supplied by Intelligence. The numeric score is not displayed.

Display the Recommendation Score as the canonical band only:

```text
HIGH
MEDIUM
LOW
```

These labels replace the numeric recommendation score in UI. They are not a separate Recommendation Confidence field.

Manual creators without Intelligence evaluation do not receive a fabricated recommendation band.

## 3. Creator information

Marketplace creators display the creator information supplied through the Intelligence/Marketplace projection.

The creator drawer must include a note communicating that additional creator information becomes available after the creator applies.

For manually added creators with limited enrichment, use the frozen meaning:

> Limited creator information. Additional creator insights become available once creator applies.

Exact copy may receive later editorial polish without changing the backend contract.

## 4. Review actions

Discovery supports brand review actions corresponding to:

```text
PENDING_REVIEW → REVIEWED
PENDING_REVIEW → REJECTED
REVIEWED       → REJECTED
REJECTED       → REVIEWED  // Restore
```

Rejected creators are not deleted. Restore returns them to `REVIEWED`.

Review state is not presented as Application validity or as a replacement for recommendation quality.

## 5. Manual creator entry

Manual acquisition is one flow with two ingestion methods:

- single creator entry;
- CSV upload.

Both require email and social handle. The social handle must be validated using the frozen lightweight crawl before creator creation.

If the creator already exists in the Campaign, the UI must not create another creator. An existing rejected creator should be offered Restore. A creator already downstream in the Campaign journey should be communicated as already existing rather than re-added.

## 6. CSV flow

Canonical flow:

```text
UPLOAD → MAP → VALIDATE → PREVIEW → CONFIRM → IMPORT
```

Preview distinguishes at least:

- valid new rows;
- duplicate rows in file;
- creators already in Campaign;
- invalid rows;
- restorable rejected creators where applicable.

Partial import is allowed: valid rows may be confirmed while invalid/duplicate rows are excluded.

## 7. Recommendation states

The workspace must support content treatments for:

- no recommendation started / Marketplace unavailable;
- recommendation running;
- recommendation succeeded with creators;
- recommendation succeeded with zero creators;
- recommendation failed;
- existing recommendation inventory while Marketplace becomes unavailable.

A successful zero-result run is an empty result, not an error.

Failure of Marketplace recommendation does not remove Manual Add.

## 8. Meta unavailable

When Marketplace capability is unavailable, existing creator/recommendation data remains visible. Marketplace acquisition may show an appropriate connection action/state while Manual Add remains a separate capability subject to Campaign rules.

## 9. Downstream handoff

When a valid Application exists, the creator moves out of the active Discovery projection and Applicants becomes the relevant workspace. CampaignCreator and historical Discovery review/recommendation data are retained.

Applicants later owns display of current-Campaign and cross-Campaign creator application/collaboration history.

## 10. UI/backend separation

Layout, copy polish, responsive treatment and card/drawer composition may evolve without changing the backend domain provided these semantics remain stable:

- Campaign-level creator matching;
- hidden unavailable downstream workspaces;
- HIGH/MEDIUM/LOW recommendation band only;
- no fake score/band for unevaluated manual creators;
- non-destructive review states;
- Manual single + CSV as one source;
- creator enrichment messaging;
- Application handoff without deleting Discovery history.