# Handoff audit

Engineering audit of clone-to-origin handoff integration. Record origin-branch
results here **before** opening a PR or merging to `development`.

Clone handoffs under `docs/ai-collaboration/c01-*` and `c05-*` are **reference
copies**. They describe accepted clone work. They are not origin verification.

## Two-origin model

| Remote | Repository | Role |
|--------|------------|------|
| `origin` | `growth-verse/creator-commerce-*-v2` | Source of truth for production integration |
| `piyush` | `Piyush1087/creator-commerce-*-v2-clone` | Clone mirror; handoff docs pin SHAs on clone `development` |

## Integration method

Handoff slices are reconciled onto origin feature branches, then PR to
`development`. Method depends on the slice:

- Brand Centre / PI: squash-style integration from clone `development` @ handoff SHA.
- C-01 / C-05: **path checkout + surgical reconcile**. Do **not** merge clone
  `development` (clone lacks origin collaboration migration history and would
  overwrite origin naming).

## Folder structure

```
handoff-audit/
├── README.md
├── .logs/                              ← paste raw command output here
├── brand-centre/
│   ├── 01-phase1-brand-centre-bi-v1/
│   └── 02-phase2-product-intelligence-v1/
└── creator/
    ├── README.md
    ├── commands-to-run.md              ← run these locally; paste results back
    ├── origin-run-log.md               ← filled from your command output
    ├── origin-integration-ledger.yaml
    ├── 01-c01-creator-entry/
    └── 02-c05-creator-settings-shell/
```

Each module folder keeps:

| File | Purpose |
|------|---------|
| `handoff-summary.md` | Frozen Product scope, origin branch, clone SHAs |
| `clone-refs-verification.md` | What we took from clone vs what we kept on origin |
| `automated-test-results.md` | Origin-branch counts (never clone counts) |
| `checklist-compliance.md` | Handoff checklist vs origin port status |

## Status badges

| Badge | Meaning |
|-------|---------|
| VERIFIED | Ran locally and passed |
| FAILED | Ran locally and failed |
| PENDING | Not yet run this audit cycle |
| BLOCKED | Requires deployed env, credentials, or local DB |
| N/A | Not applicable locally |

## Test count note

Clone closeouts cite clone acceptance counts (C-01: 1103/744; C-05: 1229/853).
Origin integration branches report **actual local counts**. Deltas are expected
after origin reconciliation. Do not copy clone numbers into origin result files.
