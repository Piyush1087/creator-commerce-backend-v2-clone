# Campaign Stitch Reference Registry — Phase 7

Status: APPROVED REFERENCE INPUT

This registry records the approved Stitch Campaign design set imported as unmodified generated HTML. These are visual/reference artifacts only: they are not production components, routing, state-management, or API implementation.

All references represent Campaign feature content. They must later be composed inside the canonical platform navigation shell at `frontend/layout/app_shell/`; none replaces or modifies that shell.

| Reference | Device | Campaign state / surface | Imported generated HTML | Stitch screen ID |
|---|---|---|---|---|
| Mobile Campaign shell / steady state | Mobile | Campaign Content Area steady state: Campaign Header, Campaign Copilot, Performance, Products & Briefs | `html/mobile-campaign-shell-steady-state.html` | `13292ed16a3542459c3d658ad78daf3c` |
| Mobile Discovery | Mobile | Discovery workspace: collapsed and expanded, filter interaction, internal scrolling, outreach-focused Creator Cards | `html/mobile-discovery-workspace.html` | `c28a8a6958cb4beb8904bacdc00c9a11` |
| Mobile Applicants | Mobile | Applicants workspace: collapsed and expanded, Applicant Cards, Approve/Reject actions, internal scrolling | `html/mobile-applicants-workspace.html` | `fc57151086b147508c91ee4964d48854` |
| Desktop steady state | Desktop | STATE 4 / Discovery Active: information-rich operational Campaign Page | `html/desktop-campaign-steady-state.html` | `29218ca51f874178a29fea676bba6bbb` |
| Lifecycle state board | Desktop | Draft, Published, Live, Paused, Completed, Archived presentation reference | `html/campaign-lifecycle-state-board.html` | `9274c522184f4736be193c067fc8a060` |
| Local state board | Desktop | Discovery empty/loading/error/no results; Applicants empty/loading/error; Products & Briefs setup states; Campaign Copilot loading/no actions/unavailable | `html/campaign-local-state-board.html` | `844f6737c99b450082e03ac4f16964b3` |

## Import boundary

The files in `html/` preserve original Stitch-generated source as reference input. They have not been normalized, refactored, restyled, merged into production components, or treated as business-rule authority.

Canonical contracts, Aurora, approved copy, the application shell, and the production frontend architecture remain authoritative for later implementation.
