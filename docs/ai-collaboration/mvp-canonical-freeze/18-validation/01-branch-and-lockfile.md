# 01 — Branch and lockfile

**Date:** 2026-09-08

| Check | Frontend | Backend |
| --- | --- | --- |
| Branch | `freeze/mvp-canonical-application-v1` | `freeze/mvp-canonical-application-v1` |
| HEAD at start of RUN 3 | `e10a5cc85458bac10ef3ec2fd5abd58dba90f0ac` | `7c324e554371193f327d5b1add54c2238996abe8` |
| `package-lock.json` | present | present |
| `node_modules` | present (not a fresh checkout) | present (not a fresh checkout) |

```text
fresh checkout/reproducibility = NOT_RUN (working copies, not a clean clone)
package install / lockfile integrity = LOCKFILE_PRESENT; npm ci not re-run this gate
```

Classification: `PREEXISTING_ACCEPTED_DEBT` for skipping `npm ci` on an already-installed freeze worktree. A later gate can still run `npm ci` if Parent wants a clean-machine proof.
