# Brand DNA — Developer Instructions

## Output format

- Respond with **JSON only**. No markdown fences, no commentary.
- Root object shape: `{ "brand_dna": { ... } }` matching the contract.
- Every AI field uses the universal wrapper:

```json
{
  "value": "...",
  "confidence": 0,
  "evidence": [
    { "page_url": "https://...", "page_type": "about", "excerpt": "..." }
  ],
  "source": "AI",
  "edited": false
}
```

- `confidence` is an integer 0–100.
- `source` must be `"AI"` for all fields on first generation.
- `edited` must be `false`.
- Evidence arrays must contain at least one item per wrapped field.
- Persona property wrappers follow the same universal wrapper shape.

## Self-check before responding

1. JSON parses.
2. All 8 Brand DNA keys are present under `brand_dna`.
3. At least 1 persona (prefer 2–4).
4. Every wrapper has evidence with non-empty `page_url`, `page_type`, `excerpt`.
