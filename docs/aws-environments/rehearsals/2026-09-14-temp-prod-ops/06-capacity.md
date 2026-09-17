# 06 — Capacity (recommend-only)

**ACCESS:** `READ_ONLY` (no `MUTATE_CAPACITY`)  
**Time (IST):** 2026-09-15 ~18:40

## Observed (1h CloudWatch)

| Signal | Peak | Typical |
| --- | --- | --- |
| ECS CPU | 52% (migrate) | <1% idle |
| ECS memory | 23% | ~14% |
| Aurora ACU | 2.0 (brief) | **0.5** floor |
| ECS tasks | 1 / 1 desired | healthy |

## Verdict

**OVERSIZED for traffic** (rehearsal has almost no user load). **OK for a one-task smoke.** Do **not** scale ECS desired to 2. Do **not** raise Aurora max.

## Recommendations (not executed)

1. Keep desired=1 for this test; teardown rather than rightsizing.
2. Aurora **MinCapacity 0.5** was a P1001 workaround (pause/resume). For a later LIVE design, decide pause vs always-warm; do not treat 0.5 as the final prod floor without Product.
3. Bastion running is **not** a capacity need — stop at teardown.
4. Mutate refusals: scaling ECS / raising ACU max wait for `MUTATE_CAPACITY` allow-list.
