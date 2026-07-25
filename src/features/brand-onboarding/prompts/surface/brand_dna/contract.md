# Brand DNA — Output Contract

Return exactly this JSON shape (types illustrated):

```json
{
  "brand_dna": {
    "industry_niche": {
      "value": "string",
      "confidence": 0,
      "evidence": [
        { "page_url": "string", "page_type": "string", "excerpt": "string" }
      ],
      "source": "AI",
      "edited": false
    },
    "brand_positioning": {
      "value": "string",
      "confidence": 0,
      "evidence": [
        { "page_url": "string", "page_type": "string", "excerpt": "string" }
      ],
      "source": "AI",
      "edited": false
    },
    "brand_narrative": {
      "value": "string",
      "confidence": 0,
      "evidence": [
        { "page_url": "string", "page_type": "string", "excerpt": "string" }
      ],
      "source": "AI",
      "edited": false
    },
    "core_value_proposition": {
      "value": "string",
      "confidence": 0,
      "evidence": [
        { "page_url": "string", "page_type": "string", "excerpt": "string" }
      ],
      "source": "AI",
      "edited": false
    },
    "key_differentiators": {
      "value": ["string"],
      "confidence": 0,
      "evidence": [
        { "page_url": "string", "page_type": "string", "excerpt": "string" }
      ],
      "source": "AI",
      "edited": false
    },
    "tone_of_voice": {
      "value": ["string"],
      "confidence": 0,
      "evidence": [
        { "page_url": "string", "page_type": "string", "excerpt": "string" }
      ],
      "source": "AI",
      "edited": false
    },
    "visual_aesthetic": {
      "value": ["string"],
      "confidence": 0,
      "evidence": [
        { "page_url": "string", "page_type": "string", "excerpt": "string" }
      ],
      "source": "AI",
      "edited": false
    },
    "audience_personas": [
      {
        "name": {
          "value": "string",
          "confidence": 0,
          "evidence": [
            { "page_url": "string", "page_type": "string", "excerpt": "string" }
          ],
          "source": "AI",
          "edited": false
        },
        "age_range": {
          "value": "string",
          "confidence": 0,
          "evidence": [
            { "page_url": "string", "page_type": "string", "excerpt": "string" }
          ],
          "source": "AI",
          "edited": false
        },
        "gender": {
          "value": "string",
          "confidence": 0,
          "evidence": [
            { "page_url": "string", "page_type": "string", "excerpt": "string" }
          ],
          "source": "AI",
          "edited": false
        },
        "geography": {
          "value": "string",
          "confidence": 0,
          "evidence": [
            { "page_url": "string", "page_type": "string", "excerpt": "string" }
          ],
          "source": "AI",
          "edited": false
        },
        "affluence_score": {
          "value": "string",
          "confidence": 0,
          "evidence": [
            { "page_url": "string", "page_type": "string", "excerpt": "string" }
          ],
          "source": "AI",
          "edited": false
        },
        "traits": {
          "value": ["string"],
          "confidence": 0,
          "evidence": [
            { "page_url": "string", "page_type": "string", "excerpt": "string" }
          ],
          "source": "AI",
          "edited": false
        }
      }
    ]
  }
}
```

Constraints:

- Prefer 2–4 audience personas; never exceed 6.
- Array fields (`key_differentiators`, `tone_of_voice`, `visual_aesthetic`,
  persona `traits`) must contain at least one string.
- Use URLs from the runtime context when possible for `page_url`.
