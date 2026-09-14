# Return prod to PLACEHOLDER

**Status:** TBD  
**Audience:** Product + Deploy (ops workers stay read-only — they do **not** execute teardown under standing posture)  
**Goal:** After a temp prod test / ops rehearsal, return `creator-prod` to the cheap skeleton (~$2/mo class) with **automated CLI/SST steps**, not console click-ops.

## Authorization required

```text
ENVELOPE=RETURN_TO_PLACEHOLDER
account=creator-prod
reason=post-rehearsal | cost save | abort TEMP_TEST
```

Without that name, refuse teardown.

## Design rules for this rehearsal path

- **No Wix / pretty CNAME work required** for temp test or teardown. Use ALB DNS / CloudFront defaults from SST. Leave public `api.thecreatorshop.in` alone if it is already NXDOMAIN.  
- Prefer **scripted AWS CLI + SST** sequences recorded in the rehearsal folder.  
- Tear down **test alarms/budgets** created during rehearsal so PLACEHOLDER integrity stays honest.  
- Ops workers (Monitor/Cost/Capacity) may **verify** after (read-only); they do not delete ALB/ECS/Aurora themselves.

## Keep vs remove

| Keep (cheap skeleton) | Remove / stop (bill drivers) |
| --- | --- |
| VPC / networking crumbs if SST retains them | ECS services, tasks, cluster (or scale to 0 then delete per agreed script) |
| ACM certificates | Application Load Balancer |
| ECR (with lifecycle) | Aurora / RDS clusters and instances from the test |
| CloudFront + S3 placeholder dashboard origin | Running bastion / jumpbox |
| SST/Pulumi state (unless Product says otherwise) | Rehearsal SNS alarms that assume LIVE stack |
| Secrets Manager leftovers only if removing them is riskier — prefer document | Orphan ENIs / unused NAT if rehearsal created extras |

Historical precedent: `docs/aws-environments/current-state.md` (“What was deleted on prod, and why”).

## Automated sequence (outline)

Execute under Deploy/Product envelope; log each step in `08-teardown.md` of the rehearsal pack.

1. **Snapshot decision** — if test DB had data worth keeping, snapshot first (`backup-and-restore.md`); temp rehearsals usually discard.  
2. **Drain compute** — ECS desired count 0; wait tasks stop (CLI).  
3. **Delete or remove service/cluster** — per SST remove subset or CLI delete (choose one path and stick to it; record commands).  
4. **Delete ALB** — confirm no requirement to keep stable CNAME for this test.  
5. **Delete Aurora/RDS** — skip final snapshot if Product says disposable.  
6. **Stop bastion** — terminate/stop instance.  
7. **Uninstall rehearsal monitors** — delete alarms/dashboards/SNS subs created under `INSTALL_*` for this test (or disable). Re-enable PLACEHOLDER integrity expectations in docs.  
8. **Optional budget** — reset prod budget ceiling to placeholder band.  
9. **Auditor after** — read-only prove: 0 ECS, 0 ALB, 0 Aurora; cost trajectory back toward ~$2/mo.  
10. **Docs** — `env/prod.md` posture = PLACEHOLDER; human report “teardown PASS”.

### SST note

A full `sst remove --stage prod` may be broader than intended. Prefer a **documented, repeatable** teardown script/checklist that matches the keep/remove table. If using SST remove, Product must accept blast radius in the envelope text.

## Verification (PASS)

| Check | Pass |
| --- | --- |
| ECS clusters/services | None (or empty) |
| ALB | None |
| Aurora/RDS | None |
| Bastion | Not running |
| Rehearsal LIVE alarms | Gone or disabled |
| Cost Explorer (few days) | Heading to placeholder band |
| Human report | States PLACEHOLDER restored |

## Cost while tearing down

Partial teardown (e.g. leave ALB) still burns ~$16/mo — treat as **FAIL** for return-to-placeholder unless Product explicitly keeps ALB.
