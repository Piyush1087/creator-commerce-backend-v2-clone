# Campaign Stitch References — Phase 7

Status: APPROVED REFERENCE INPUT

This directory preserves the approved Stitch Campaign outputs as reference artifacts only.

- `html/` contains the original Stitch-generated HTML, copied without normalization, refactoring, restyling, or integration into production components.
- `reference-registry.md` maps every imported artifact to the Campaign state or surface it represents and records its originating Stitch screen ID.
- These artifacts represent Campaign feature content. They must later compose inside the canonical platform navigation shell at `frontend/layout/app_shell/`; they must not replace or modify that shell.

These files are not executable production frontend architecture and do not establish production component paths, routing, state management, or API contracts.
