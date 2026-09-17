# 00 — Authorization

```text
ENVELOPE=TEMP_PROD_OPS_REHEARSAL
account=creator-prod (250037328530)
profile=creator-prod
NOT live go-live
pretty DNS / Wix CNAME=NOT REQUIRED
auth login tests=SKIP (Postmark may be down)
RETURN_TO_PLACEHOLDER=required at end
INSTALL_MONITORING=authorized for this rehearsal (alarms + email test)
```

Product / authorizer: Brian (chat 2026-09-14 — “lets go for initial on demand tests”)  
Date (IST): 2026-09-14  
Notes: Full §J sequence; automated non-auth smoke only; scale back to PLACEHOLDER after.
