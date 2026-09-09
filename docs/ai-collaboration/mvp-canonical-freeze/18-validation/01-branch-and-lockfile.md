# 01 — Branch and lockfile

**Date:** 2026-09-08

| Check | Frontend | Backend |
| --- | --- | --- |
| Branch | `freeze/mvp-canonical-application-v1` | `freeze/mvp-canonical-application-v1` |
| HEAD at start of RUN 3 | `e10a5cc85458bac10ef3ec2fd5abd58dba90f0ac` | `7c324e554371193f327d5b1add54c2238996abe8` |
| `package-lock.json` | present | present |
| `node_modules` | present (not a fresh checkout) | present (not a fresh checkout) |

```text
fresh checkout/reproducibility = PARTIAL (RUN 5 local freeze-branch clones; 14-npm-ci-fresh-clone.md)
package install / lockfile integrity = PASS npm ci on those clones
```

Working copies still have `node_modules` from earlier runs. Clone proof is RUN 5, not a second install in the working trees.
