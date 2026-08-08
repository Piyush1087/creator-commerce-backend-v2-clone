# AURORA DESIGN SYSTEM

**Version:** 5.0\
**Status:** CANONICAL
**Product:** Creator Shop\
**Purpose:** Canonical reusable interface system for Creator Shop
product surfaces

------------------------------------------------------------------------

## Table of Contents

0.  Authority, Scope & Conformance\
1.  Foundations\
2.  Foundation Tokens\
3.  Accessibility\
4.  Interaction State System\
5.  Layout System\
6.  Application Shell\
7.  Responsive Transformation System\
8.  Content Resilience\
9.  Components --- Actions\
10. Components --- Form Controls\
11. Components --- Selection & Status\
12. Components --- Navigation\
13. Components --- Containers\
14. Components --- Disclosure\
15. Components --- Overlays\
16. Components --- Feedback & Progress\
17. Components --- Data Display\
18. Components --- Identity & Media\
19. Reusable Patterns\
20. Component Selection Guidance\
21. Responsive Component Matrix\
22. Design Acceptance & Resilience Matrix\
23. Visual Reference\
24. AI / Design Tool Interpretation\
25. Change Governance

------------------------------------------------------------------------

## 0. Authority, Scope & Conformance

### 0.1 Purpose

Aurora defines Creator Shop's reusable interface system. It standardizes
visual primitives, component semantics, interaction behavior, responsive
design behavior, design accessibility, and reusable UI patterns so
product features do not repeatedly solve the same interface decisions.

Aurora does **not** define feature-specific business logic, domain
lifecycles, canonical taxonomies, Intelligence calculations, backend
contracts, final feature copy, or screen-specific product requirements.

Normative language:

-   **MUST / MUST NOT** --- mandatory.
-   **SHOULD / SHOULD NOT** --- strong default; deviation requires a
    valid reason.
-   **MAY** --- optional and context-dependent.

### 0.2 Aurora release model

A canonical Aurora release consists of synchronized representations:

``` text
Aurora Release
├── AURORA_DESIGN_SYSTEM.md       semantic contract
├── Executable Aurora             executable realization
└── Aurora Visual Reference       visual illustration
```

These are not competing authorities. They represent the same Design
System in different forms.

-   `AURORA_DESIGN_SYSTEM.md` owns semantics, tokens, component
    contracts, design behavior, responsive rules, and design
    accessibility.
-   Executable Aurora owns the production implementation of those
    contracts.
-   The Visual Reference demonstrates intended appearance and
    representative composition.

If same-version artifacts materially disagree, that is a Design System
inconsistency to resolve. An implementation or AI agent MUST NOT
silently choose whichever artifact is most convenient.

### 0.3 Relationship to other sources

Authority boundaries:

-   Product/domain contracts → feature behavior.
-   Approved UI copy → product language.
-   Aurora → reusable visual-system decisions and behavior.
-   Approved Stitch/UI reference → screen composition and visual intent.
-   Frontend engineering standards → production implementation.
-   AI engineering standards → AI-assisted engineering.

A screen reference may compose Aurora components but does not create or
override Aurora primitives.

### 0.4 Product ownership boundary

Aurora may define how a score, status, date, table, selector, or
workflow state is presented. It MUST NOT define:

-   how a product score is calculated;
-   which campaign fields are editable;
-   which creator archetypes are valid;
-   what a reporting metric means;
-   what data is sent to an Intelligence engine;
-   lifecycle or persistence rules;
-   feature-specific validation;
-   final feature copy where an approved copy contract exists.

### 0.5 Conformance

A surface conforms to Aurora when it uses canonical tokens/components,
preserves component semantics, follows applicable
responsive/state/accessibility/resilience contracts, avoids conflicting
local primitives, and preserves approved feature composition unless
higher authority requires change.

Feature-specific composition is expected; feature-specific Design System
drift is not.

## 1. Foundations

### 1.1 Design principles

Aurora is **clear, consistent, calm, responsive by transformation,
content-resilient, semantic, composable, and accessible by design**.
Equivalent concepts should behave equivalently; constrained screens
reflow rather than become miniature desktop layouts; components are
chosen by meaning rather than resemblance; real content determines
robustness.

### 1.2 Visual hierarchy

Use hierarchy deliberately:

1.  page/workflow identity;
2.  section identity;
3.  primary task/data;
4.  supporting information;
5.  metadata and helper information.

Do not create hierarchy by arbitrary font sizes, extra colors, excessive
cards, or multiple competing primary actions.

### 1.3 Density

Aurora is a dashboard system, not a mobile-native consumer app. Dense
information is acceptable where it improves scanning and
decision-making, but density MUST NOT compromise readability, touch
interaction, or information hierarchy.

Do not mechanically wrap every section in a Card. Spacing and section
structure may provide sufficient grouping.

### 1.4 Reuse

Before introducing a new Aurora component, determine whether the
requirement can be satisfied by:

``` text
Existing component
→ Existing pattern
→ Feature composition of Aurora primitives
→ New Aurora capability only if genuinely reusable
```

------------------------------------------------------------------------

## 2. Foundation Tokens

This section preserves the approved v4.1 visual foundation unless a
future Aurora release explicitly changes a value.

### 2.1 Color palette

  -----------------------------------------------------------------------
  Token                   Value                   Usage
  ----------------------- ----------------------- -----------------------
  `--color-primary`       `#34D399`               Aurora Green; brand
                                                  identity, primary
                                                  actions, active states

  `--color-secondary`     `#061F23`               Midnight Black; sidebar
                                                  and dark surfaces

  `--color-tertiary`      `#F5926E`               Light Orange; accent
                                                  highlights and tertiary
                                                  emphasis

  `--surface-workflow`    `#F0FDF4`               Light Mint; selected
                                                  states and success/info
                                                  backgrounds

  `--surface-page`        `#F8F8F8`               page background

  `--surface-card`        `#FFFFFF`               cards and elevated
                                                  surfaces

  `--border-default`      `#E5E7EB`               borders and dividers

  `--text-high`           `#0E1214`               primary text and
                                                  headings

  `--text-muted`          `#6B7280`               secondary text,
                                                  placeholders, metadata

  `--status-error`        `#CA0F1C`               error states and
                                                  destructive emphasis

  `--status-warning-bg`   `#FFF6F6`               warning/error-family
                                                  light background

  `--disabled-bg`         `#F3F4F6`               disabled backgrounds

  `--disabled-text`       `#6B7280`               disabled text
  -----------------------------------------------------------------------

Rules:

-   `--border-default` and `--disabled-bg` are different tokens and MUST
    NOT be used interchangeably.
-   `#FFF6F6` is light pink, not amber/orange.
-   Colors MUST NOT change merely because the viewport changes.
-   Status meaning MUST NOT rely on color alone.

### 2.2 Typography

  -------------------------------------------------------------------------
  Role      Family           Desktop        Mobile Weight    Use
  --------- ---------- ------------- ------------- --------- --------------
  H1        Satoshi             32px          28px Bold      page titles /
            Variable                                         major workflow
                                                             titles

  H2        Satoshi             24px          20px Bold      section
            Variable                                         headings /
                                                             major card
                                                             titles

  Body      Source              14px          14px Regular   paragraphs /
            Sans 3                                           descriptions

  Caption   Source              12px          12px Medium    helper text /
            Sans 3                                           metadata

  Label     Satoshi             14px          14px Bold      form and UI
            Variable                                         labels

  Input     Source              14px          14px Regular   user-entered
  text      Sans 3                                           values
  -------------------------------------------------------------------------

Rules:

-   H1 and H2 use the canonical scale rather than feature-specific
    heading sizes.
-   Body line-height: `1.5`.
-   Heading line-height: `1.2`.
-   Body content MUST NOT be reduced below 14px to make a layout fit.
-   Use Satoshi Variable and Source Sans 3 as the Aurora type families.
    Font loading is an implementation concern governed by frontend
    engineering; the visual result MUST preserve the approved families.

### 2.3 Spacing

Base grid: **8px**.

Canonical scale:

``` text
8px / 16px / 24px / 32px / 48px
```

  Use                                Desktop      Mobile
  ------------------------------ ----------- -----------
  Outer page/container padding          32px        16px
  Internal card/panel padding           24px        24px
  Button padding                   12px 24px   12px 24px
  Input horizontal padding              16px        16px
  Standard item gap                     16px        16px

Tablet outer container padding: **24px**.

Internal component spacing SHOULD remain stable across breakpoints
unless a component contract explicitly defines otherwise. Responsive
design should first reduce outer margins, columns, and arrangement
rather than collapsing internal breathing room.

### 2.4 Radius & borders

  ---------------------------------------------------------------------
  Component                                                      Radius
  ----------------------------- ---------------------------------------
  Button                                                            8px

  Input / Select / Date Input                                       8px

  Textarea                                                          8px

  Badge                                                             8px

  Standard Card                                                    12px

  Compact Card                                                      8px

  Chip                                                           9999px

  Dialog                                                           12px

  Bottom Sheet                                         12px top corners

  Drawer / Full-screen Sheet        according to edge treatment; do not
                                              introduce arbitrary radii
  ---------------------------------------------------------------------

Default border width: **1px** except components such as charts/progress
where their own geometry applies.

Radius MUST NOT be reduced on mobile merely to save space. Avoid
arbitrary sharp-corner variants.

### 2.5 Canonical component geometry

  Token / property                  Value
  ------------------------------- -------
  Desktop Header height              72px
  Mobile Header height               56px
  Bottom Navigation height           64px
  Input height                       48px
  Button height                      48px
  Chip height                        32px
  Sidebar collapsed width            80px
  Sidebar expanded width            240px
  Standard desktop Drawer width     320px
  Dialog max width                  600px
  Textarea minimum height           120px

### 2.6 Breakpoints

``` text
Mobile:  < 768px
Tablet:  768px–1280px
Desktop: > 1280px
```

Breakpoints are classification boundaries, not permission to apply a
fixed transformation mechanically. Content and task semantics still
determine the correct responsive representation.

### 2.7 Z-index baseline

Preserved baseline:

``` text
Sidebar:       100
Header:        200
Modal overlay: 900
Modal content: 901
Bottom nav:   1000
```

Executable Aurora MAY evolve the scale as a coordinated system. Feature
code MUST NOT solve layering conflicts by arbitrary local z-index
escalation.

------------------------------------------------------------------------

## 3. Accessibility

Aurora owns design accessibility. Frontend engineering owns
implementation details such as semantic HTML, ARIA, focus trapping, and
DOM behavior.

### 3.1 Core requirements

-   Interactive elements MUST have a clearly perceivable focus-visible
    state.
-   Critical meaning MUST NOT depend on color alone.
-   Text and controls MUST preserve readable contrast.
-   Icon-only controls require an understandable accessible name in
    implementation.
-   Mobile interactive targets SHOULD provide an effective target of at
    least 44×44px even when the visible icon is smaller.
-   Disabled state must remain distinguishable from selected/active
    state.
-   Errors must be identifiable through more than color where correction
    is required.
-   Essential instructions MUST remain visible or otherwise reliably
    available; do not hide essential task information only in Tooltips.
-   Motion SHOULD be purposeful. Reduced-motion preferences must not
    make state changes incomprehensible.

### 3.2 Typography & zoom resilience

Do not solve constrained layouts by shrinking canonical body text.
Components and compositions must tolerate increased text size, wrapping,
and realistic browser zoom without semantic loss.

### 3.3 Touch & pointer parity

Hover may enhance discoverability on pointer devices but MUST NOT be
required to access essential information or primary actions.

------------------------------------------------------------------------

## 4. Interaction State System

This section is the canonical state vocabulary. Component sections
specify only special or non-applicable states.

### 4.1 Standard interactive states

Where applicable:

``` text
Default
Hover
Focus-visible
Pressed
Disabled
```

Components may additionally support semantic states such as:

``` text
Selected / Active
Open / Expanded
Invalid / Error
Loading
Complete
```

### 4.2 State rules

-   **Hover** supplements interaction; it is not required on touch.
-   **Focus-visible** must be clearly perceivable and must not be
    removed without an equivalent replacement.
-   **Pressed** communicates active pointer/touch activation.
-   **Selected/Active** communicates current choice or destination and
    is distinct from focus.
-   **Disabled** communicates unavailable action and must not look
    selected.
-   **Invalid/Error** communicates a condition requiring correction or
    attention.
-   **Loading** must not create duplicate execution where the action
    should be temporarily unavailable.

### 4.3 State stability

State changes SHOULD preserve component geometry where practical.
Loading a Button, validating a Field, or selecting a Card should not
cause unnecessary layout shift.

------------------------------------------------------------------------

## 5. Layout System

### 5.1 Page hierarchy

Canonical composition:

``` text
Application Shell
└── Page
    ├── Page Header / Context
    └── Sections
        └── Components / Feature Compositions
```

Domain nesting does not require visual container nesting. Avoid
card-inside-card structures simply because the data model is
hierarchical.

### 5.2 Grid

Desktop may use 2--3 columns according to content density. Tablet
normally reduces to 2 columns. Mobile normally uses one primary column.

Canonical gaps:

-   Desktop: 24px where a larger page grid requires it.
-   Tablet: 16px.
-   Mobile: 16px.

These are defaults; component-specific layout may differ when semantics
require it.

### 5.3 Width & overflow

Page-level horizontal scrolling SHOULD NOT be used as a general
responsive strategy.

Components with inherently wide content may own horizontal scrolling
where that preserves usability, but the page shell itself should remain
within the usable viewport.

### 5.4 Scroll ownership

Use the simplest scroll model:

-   page content normally scrolls with the document;
-   a bounded Table/Popover/overlay may own internal scroll when
    required;
-   nested scroll regions SHOULD be avoided unless they materially
    improve the task;
-   fixed/persistent regions must reserve enough content clearance that
    they do not cover reachable content.

------------------------------------------------------------------------

## 6. Application Shell

Creator Shop is a responsive web dashboard that may run inside mobile
Chrome/Safari. The usable viewport can therefore be reduced by browser
chrome, address bars, tab/tool ribbons, virtual keyboards, and device
safe areas.

### 6.1 Desktop shell

Typical desktop shell:

``` text
┌──────── Sidebar ────────┬──────────── Header ────────────┐
│                         │                                │
│                         ├────────────────────────────────┤
│                         │                                │
│                         │ Page content                   │
│                         │                                │
└─────────────────────────┴────────────────────────────────┘
```

Desktop Header height: 72px. Sidebar supports collapsed 80px and
expanded 240px states.

### 6.2 Tablet shell

Tablet may hide the persistent Sidebar and expose global navigation
through a menu/drawer while retaining an adapted Header. Bottom
Navigation is not automatically required for every tablet width; use the
application navigation contract.

### 6.3 Mobile web shell

Mobile uses:

-   compact 56px Header;
-   Bottom Navigation for a small set of frequent primary destinations
    where applicable;
-   Global Navigation Drawer for the broader application navigation;
-   Back Navigation for nested hierarchy instead of desktop breadcrumbs;
-   a Persistent Action Region only when continuous access to the
    dominant workflow action is justified.

Mobile design MUST account for **usable viewport**, not assume the CSS
viewport is fully visible.

### 6.4 Header

Baseline visual treatment:

-   background `#FFFFFF`;
-   bottom border `1px #E5E7EB`;
-   desktop horizontal padding 32px;
-   mobile horizontal padding 16px.

Root mobile screen may show product/brand identity and global utilities.
Nested mobile screens prioritize Back Navigation + current context. Do
not show a redundant logo when a back-navigation context occupies the
same hierarchy position.

### 6.5 Sidebar

Visual baseline:

-   background `#061F23`;
-   full available shell height;
-   collapsed 80px / expanded 240px;
-   24px icons;
-   expanded labels use 14px Source Sans 3;
-   active state uses Aurora Green and may use a 4px left indicator;
-   inactive state uses muted treatment; hover increases contrast.

Aurora owns Sidebar presentation and states. Application configuration
owns destinations, ordering, permissions, and feature availability.

### 6.6 Bottom Navigation

Mobile Bottom Navigation:

-   fixed to the usable viewport bottom;
-   height 64px;
-   contains a small set of frequent primary destinations;
-   does not attempt to reproduce every Sidebar destination.

The application owns which destinations appear.

### 6.7 Global Navigation Drawer

The mobile global navigation drawer exposes destinations not represented
in Bottom Navigation.

The old 90vw Midnight Black right-side drawer remains an acceptable
baseline visual pattern for the global navigation drawer where it
matches the executable shell, but its exact width is not a universal
rule for all Drawers.

### 6.8 Breadcrumbs and Back Navigation

Desktop/tablet Breadcrumbs communicate hierarchy. Mobile nested screens
use Back Navigation + current context rather than a traditional
breadcrumb trail.

This resolves the v4.1 contradiction that both hid breadcrumbs on mobile
and instructed mobile headers to retain/truncate them.

### 6.9 Persistent Action Region

A Persistent Action Region keeps a dominant workflow action reachable
when natural page-end placement is insufficient.

It MUST:

-   sit above Bottom Navigation where Bottom Navigation exists;
-   account for device safe area and browser chrome;
-   reserve content clearance so the final content is not hidden;
-   adapt when the virtual keyboard reduces usable height;
-   avoid permanently obscuring the focused field or validation message.

Do not make every mobile CTA sticky. Use this pattern only when
persistence materially improves workflow completion.

------------------------------------------------------------------------

## 7. Responsive Transformation System

Responsive behavior preserves product semantics while adapting
composition to available space.

### 7.1 Transformation vocabulary

Use **Stack** (horizontal → vertical), **Reflow** (rearrange), **Wrap**
(additional lines), **Collapse** (compact without losing access),
**Transform** (change representation, e.g. Table → Data Cards),
**Reposition**, and **Progressive disclosure**.

### 7.2 Responsive invariants

Responsive transformation MUST NOT, without an explicit product
contract:

-   change product meaning;
-   remove required data;
-   change a primary action into a secondary action or vice versa;
-   rewrite approved copy;
-   alter lifecycle/state meaning;
-   shrink body text below the canonical minimum;
-   reduce touch targets below usable size.

Feature/product contracts determine information priority when not all
information can remain simultaneously visible.

### 7.3 Long mobile pages

A long mobile page is not inherently a design defect. Prefer readable
vertical flow over compressing, hiding, or arbitrarily accordionizing
content.

### 7.4 Forms

Desktop may use 2--3 columns where field relationships support it.
Tablet may use 1--2 columns. Mobile is primarily single-column.

### 7.5 Tables

A Table may remain a Table where it remains readable and operable. Where
column comparison becomes unusable, transform to a Data List/Data Card
representation. The owning feature determines which fields are primary,
secondary, or progressively disclosed.

### 7.6 Overlays

Overlay transformation depends on task complexity, not breakpoint alone:

-   small focused task → Dialog or compact Bottom Sheet;
-   short mobile action/choice → Bottom Sheet;
-   contextual desktop Drawer → full/near-full-screen Sheet on mobile
    where necessary;
-   long form / complex temporary workflow → Full-screen Sheet.

There is no universal `70vh` mobile overlay rule.

------------------------------------------------------------------------

## 8. Content Resilience

Design examples are representative content, not maximum content
contracts.

### 8.1 Canonical responses to content pressure

Use intentionally:

-   **Wrap** --- default for meaningful text.
-   **Expand** --- containers normally grow vertically.
-   **Truncate** --- only where full content remains recoverable or the
    feature explicitly allows it.
-   **Scroll** --- for bounded content where preserving geometry is more
    important than expansion.

### 8.2 Dynamic content

Components must tolerate realistic variation in names, titles,
currencies/amounts, dates, counts, statuses, validation messages,
metadata, and user-generated text. Do not invent abbreviations or
rewrite approved copy to make a layout fit.

### 8.3 Missing and partial data

Missing optional data must not collapse the surrounding composition into
an invalid state. Use explicit placeholders only where the product
contract requires them; otherwise remove the absent optional item
cleanly.

Loading, empty, missing, unavailable, and error are different states.

### 8.4 Fixed and persistent UI

Persistent headers, actions, Bottom Navigation, browser chrome, and
virtual keyboards must not make critical content or actions unreachable.

------------------------------------------------------------------------

## 9. Components --- Actions

### 9.1 Button

Buttons initiate actions. Navigation uses Link.

### Variants

  ----------------------------------------------------------------------
  Variant                Treatment              Use
  ---------------------- ---------------------- ------------------------
  Primary                `#34D399`, dark text,  dominant action;
                         bold                   normally one per action
                                                context

  Secondary              white surface, dark    supporting/alternative
                         text, bold             action

  Outline                transparent,           tertiary action
                         `1px #34D399`, green   
                         text                   

  Ghost                  transparent, green     subtle action in dense
                         text                   UI

  Destructive            error semantics        consequential
                                                destructive action

  Disabled               `#F3F4F6`, muted text  unavailable action
  ----------------------------------------------------------------------

Baseline: 48px height, 8px radius, Satoshi Bold, 12px 24px padding.

Applies standard interactive states (§4); Loading may preserve geometry
while replacing/augmenting the label with progress indication.

Mobile forms and isolated action regions MAY use full-width buttons.
Inline Card actions may remain auto-width. Responsive action layout
follows §7.

### 9.2 Icon Button

An action represented primarily by an icon. Typical uses: Edit, Close,
Share, More, Notifications, Menu.

The visible icon may be 16--24px while the effective mobile target
remains at least 44×44px. Every Icon Button requires an accessible name
in implementation. Tooltip may supplement discoverability but does not
replace the accessible name.

### 9.3 Link

Links navigate to another page, route, resource, or meaningful location.
They must remain distinguishable from surrounding non-interactive text
and support standard navigation states.

### 9.4 Action Group

Groups related actions while preserving hierarchy. Horizontal groups may
stack/reflow on constrained screens. Responsive transformation MUST NOT
change action semantics.

------------------------------------------------------------------------

## 10. Components --- Form Controls

### 10.1 Field

Field is the canonical form-control composition:

``` text
Label                    Optional meta
[ Control                             ]
Helper / validation message
```

Labels remain visibly associated with controls. Placeholder text MUST
NOT replace a persistent label where the user needs the field identity
after entering a value.

Field errors expand vertically and remain readable.

### 10.2 Text Input

Single-line entry.

Baseline:

-   48px height;
-   white background;
-   1px default border;
-   8px radius;
-   0 16px padding;
-   label: 14px Bold Satoshi, 4px gap;
-   placeholder/input: 14px Source Sans 3;
-   helper: 12px Source Sans 3, 4px gap.

States:

-   Default: border `#E5E7EB`;
-   Focus: border `#34D399`;
-   Error: border/helper `#CA0F1C`;
-   Disabled: background `#F3F4F6`, muted content.

Search variant may include a leading 16px muted search icon.

### 10.3 Textarea

Uses Field and Text Input visual language, except:

-   min-height 120px;
-   padding 12px 16px;
-   vertical resize where supported by implementation.

### 10.4 Select

For choosing from a defined option set. Uses Text Input geometry with
trailing 16px chevron. The option surface must remain within the usable
viewport and operable across input modes.

Do not apply the old fixed `70vh` mobile sheet rule mechanically.

### 10.5 Searchable Select / Combobox

Use where a large or dynamic option set benefits from filtering/search.
Clearly distinguish search text, selected value(s), options, and
no-results state.

Multi-select values may use Chips.

### 10.6 Checkbox

For independent binary selection. Supports unchecked, checked, and
indeterminate where meaningful. Multiple Checkboxes may be selected in
one group.

### 10.7 Radio

For mutually exclusive choices in a defined group. Use a clear group
label.

### 10.8 Switch

For an immediately applicable on/off setting. Do not use Switch merely
as a modern-looking replacement for Checkbox.

### 10.9 Date Input

Uses Field/Input visual language with a trailing 16px calendar icon.
Aurora owns presentation and date-selection surface behavior. Feature
contracts own permissible ranges, deadline rules, and business
validation.

Feature-specific visual indicators such as a campaign "Fixed Date" dot
are not universal Aurora behavior unless promoted through governance.

### 10.10 Amount / Numeric Input

Structured numeric entry. May include currency, percentage, or unit
adornments. Feature contracts own allowed range, precision, currency,
and business meaning.

### 10.11 Search Field

Text Input variant with search affordance and optional clear action.
Clear uses Icon Button semantics.

------------------------------------------------------------------------

## 11. Components --- Selection & Status

### 11.1 Selection Card

Use when a choice benefits from description, visual identity, or
stronger emphasis than a simple Radio/Checkbox.

Baseline:

-   standard Card geometry;
-   20px internal padding;
-   optional 24px icon;
-   title + description;
-   selection indicator.

Visual states:

-   Default: white, `1px #E5E7EB`;
-   Hover: stronger neutral border;
-   Selected: `#F0FDF4`, `1px #34D399`, green selection indicator.

Selection cardinality is feature-owned; Selection Card itself may
support single- or multi-select composition.

### 11.2 Slider

For continuous/percentage selection where visual position is useful.

Baseline:

-   track: 4px, `#E5E7EB`;
-   fill: `#34D399`;
-   thumb: 32px circular Aurora Green;
-   thumb value: 12px Medium Source Sans 3, white;
-   supporting label: 12px Source Sans 3, muted, 8px gap.

Use numeric input when precise direct entry is more appropriate. Do not
use Slider for binary state.

### 11.3 Chip

Chip is interactive/selectable/removable compact content.

Baseline:

-   9999px pill radius;
-   32px height;
-   8px 16px padding;
-   8px group gap;
-   14px Medium Satoshi;
-   groups wrap.

Selected Chip baseline: Aurora Green background with dark bold text.

A removable Chip must expose an operable removal action.

### 11.4 Badge

Badge is non-interactive status or metadata.

Baseline radius: 8px.

Status treatment may use:

-   success: `#F0FDF4` + Aurora Green;
-   warning/pending: light warning background + `#F5926E`;
-   error: light warning/error background + `#CA0F1C`.

Controlled status vocabulary should remain concise. Color is not the
only status cue where distinction is important.

### 11.5 Chip vs Badge

``` text
Chip  = interactive / selectable / removable
Badge = informational / status
```

Do not use the terms interchangeably. Aurora v5 does not add a separate
Tag primitive without demonstrated semantics distinct from both.

------------------------------------------------------------------------

## 12. Components --- Navigation

### 12.1 Header

Uses the shell contract in §6. Root, nested, and overlay contexts may
vary composition while preserving canonical geometry and hierarchy.

### 12.2 Sidebar Item

Contains icon, label, and optional indicator. Supports standard
interactive states plus Active. Collapsed Sidebar must retain
understandable accessible navigation.

### 12.3 Bottom Navigation Item

Contains icon, short label, and optional approved indicator. Active
destination must be distinguishable without relying only on subtle
color.

### 12.4 Breadcrumb

Desktop/tablet hierarchy component.

Baseline:

-   12px;
-   inactive `#6B7280`;
-   current page `#0E1214`;
-   restrained tracking may be used where consistent with executable
    Aurora.

Avoid unnecessary hierarchy levels.

### 12.5 Back Navigation

Mobile/nested navigation to parent context. Back is navigation; it is
not interchangeable with Close/dismiss.

### 12.6 Tabs

Tabs switch between peer views in the same broader context.

Baseline:

-   16px Bold Satoshi;
-   full-width bottom border `#E5E7EB`;
-   desktop gap 32px;
-   tablet gap 24px;
-   active text `#0E1214` with 2px Aurora Green underline;
-   inactive text `#6B7280`.

On mobile, keep a normal row if it fits; otherwise horizontal scrolling
is preferred where the tab model remains suitable. Use an alternative
navigation model only when Tabs themselves cease to be suitable.

Tabs MUST NOT represent sequential workflow steps.

### 12.7 Overflow Menu

Contains eligible lower-priority actions. Critical/high-frequency
actions should remain directly discoverable where practical. Destructive
actions remain clearly distinguishable.

------------------------------------------------------------------------

## 13. Components --- Containers

### 13.1 Card

Groups related content into a bounded surface.

Baseline:

-   white background;
-   `1px #E5E7EB`;
-   12px standard radius or 8px compact radius;
-   24px internal padding at all breakpoints.

Optional Card header may contain title and action. Cards normally expand
vertically according to §8.

Do not wrap every section in a Card or nest Cards more deeply than the
information hierarchy justifies.

### 13.2 Interactive Card

Use when the entire Card represents one coherent action or selection. It
supports applicable hover/focus/pressed behavior. Avoid conflicting
nested interactions without a deliberate model.

### 13.3 Section Container

Reusable composition for a major page region. May contain heading,
description, actions, and content without automatically adding Card
styling.

### 13.4 Divider

Horizontal or vertical separation where spacing alone is insufficient.
Uses canonical border tokens.

------------------------------------------------------------------------

## 14. Components --- Disclosure

### 14.1 Accordion

Progressively reveals independently understandable secondary content.
Supports collapsed/expanded states.

Do not introduce Accordion solely because a mobile page is long.

### 14.2 Tooltip

Brief supplementary explanation for an existing element. Tooltips MUST
NOT contain essential task information, prerequisites, or the only
explanation of an error.

### 14.3 Popover

Temporary non-modal surface anchored to a trigger. Use for compact
contextual information or controls. It should remain connected to the
trigger, fit/reposition within the usable viewport, and dismiss
predictably.

------------------------------------------------------------------------

## 15. Components --- Overlays

### 15.1 Overlay taxonomy

Aurora distinguishes:

-   **Dialog**
-   **Drawer**
-   **Bottom Sheet**
-   **Full-screen Sheet**

Choose by task complexity, relationship to underlying context, content
length, and viewport---not visual preference.

### 15.2 Dialog

Focused temporary surface retaining conceptual relationship to the
underlying page.

Baseline desktop treatment:

-   backdrop approximately `rgba(0,0,0,0.5)`;
-   white surface;
-   12px radius;
-   max-width 600px;
-   centered;
-   32px desktop padding;
-   Close Icon Button where applicable.

Suitable for confirmations, concise decisions, and short focused forms.
Content must scroll if it exceeds usable height.

### 15.3 Confirmation Dialog

Dialog pattern containing consequence/explanation plus confirm and
cancel/dismiss actions. Use when accidental activation has meaningful
consequences. Do not add confirmation to routine reversible actions
merely for perceived safety.

### 15.4 Drawer

Temporary edge surface maintaining strong context with the underlying
page.

Desktop baseline may use a 320px right-side Drawer below the Header with
white background, left border, and 24px padding.

Suitable for contextual details, editing, and supporting workflows. A
mobile Drawer generally transforms to a full/near-full-screen Sheet when
side-panel geometry is no longer usable.

### 15.5 Bottom Sheet

Mobile temporary surface for short decisions, compact action sets,
concise option selection, or lightweight contextual tasks.

Baseline: white surface, 12px top corners, 24px padding, optional 32×4px
handle. Height is content-driven within safe viewport constraints; v5
removes the universal v4.1 `70vh` rule.

### 15.6 Full-screen Sheet

Preferred constrained-screen overlay for substantial temporary workflows
such as long forms, complex editing, or detailed contextual tasks.

It may use a persistent header and Persistent Action Region where
required while content owns the remaining scrollable area.

### 15.7 Dismissal

Dismissal may use Close, Cancel, explicit action, safe outside
interaction, or platform-appropriate escape behavior. Feature contracts
determine unsaved-work policy.

A user must not accidentally lose meaningful unsaved work merely because
an overlay supports casual dismissal.

### 15.8 Virtual keyboard

Editable mobile overlays must remain usable when the virtual keyboard
appears. Focused controls, relevant validation, and workflow actions
must remain reachable.

------------------------------------------------------------------------

## 16. Components --- Feedback & Progress

### 16.1 Alert

Persistent contextual information requiring awareness or action.

Variants:

  Type      Background   Accent
  --------- ------------ -----------
  Error     `#FFF6F6`    `#CA0F1C`
  Warning   `#FFF6F6`    `#F5926E`
  Success   `#F0FDF4`    `#34D399`
  Info      `#F0FDF4`    `#34D399`

Baseline: 8px radius, 16px padding, 20px leading icon, 12px icon/text
gap, 14px body text. Optional action/close affordance may be included.

### 16.2 Toast / Snackbar

Transient, non-blocking feedback such as save/copy confirmation. May
include one concise contextual action such as Undo.

Do not use Toast as the sole representation of blocking errors,
unresolved prerequisites, or information requiring later reference.

### 16.3 Spinner

Short operation with unknown duration. Place near the operation it
represents. Do not use indefinite Spinner as the only explanation of a
long-running asynchronous process.

### 16.4 Skeleton

Represents expected content geometry while data loads. Primitive forms
may include line, block, and avatar. Feature-specific Skeleton
compositions should be built from these rather than promoted
automatically.

### 16.5 Linear Progress

Known/measurable completion.

Preserved baseline:

-   track 6px, `#E5E7EB`, 8px radius;
-   fill `#34D399`, 8px radius;
-   label 14px Source Sans 3;
-   percentage 14px Medium Source Sans 3.

Do not imply false precision.

### 16.6 Step Indicator

Sequential workflow position. States may include Upcoming, Current,
Complete, and Error.

Tabs are peer views; Step Indicator is workflow progression.

Aurora owns presentation. Feature contracts own number of steps, labels,
navigation rules, validation, and skip/revisit behavior.

### 16.7 Processing State

Long-running operation where a Spinner is insufficient.

May contain:

-   status indicator;
-   title;
-   explanation;
-   optional supporting detail;
-   optional actual progress;
-   optional allowed action.

A feature may map its lifecycle to states such as Queued, Processing,
Complete, Failed. Do not display invented progress percentages.

### 16.8 Section Error

Contained failure that allows the broader page to remain usable. May
include recovery action such as Retry.

### 16.9 Feedback selection

  Situation                           Preferred presentation
  ----------------------------------- ------------------------
  Specific invalid field              Field error
  Contained region failed             Section Error
  Important persistent condition      Alert
  Blocking page/task issue            Page/System Alert
  Brief non-blocking confirmation     Toast
  Short unknown-duration operation    Spinner
  Expected content geometry loading   Skeleton
  Known measurable progress           Linear Progress
  Sequential workflow                 Step Indicator
  Long-running contextual operation   Processing State

------------------------------------------------------------------------

## 17. Components --- Data Display

### 17.1 Table

For structured data where comparison across rows/columns matters.

A Table may include text, identity, numbers, Badge, compact actions, and
approved feature compositions.

Row actions should keep frequent/critical actions direct and move
eligible secondary actions to Overflow Menu.

A Table/data region should account for Loading, Populated, Empty, and
Error states where applicable.

### 17.2 Data List / Data Cards

For repeated structured items where individual-item comprehension
matters more than strict column comparison. May also be the mobile
transformation of a Table.

Aurora owns transformation mechanics. The feature contract owns which
fields are primary, secondary, collapsible, or omitted.

### 17.3 Metadata Group

Compact related attributes. May contain optional icon, label, value, and
Badge.

Desktop may be inline; constrained layouts wrap/stack while preserving
label/value association.

### 17.4 Metric / Stat

Prominent quantitative value with enough context to understand meaning,
unit, and qualifier.

Change indicators must not assume `up = good` and `down = bad`; feature
semantics determine interpretation. Color alone does not communicate
direction/quality.

### 17.5 Bar Chart

Basic category comparison.

Preserved visual baseline:

-   vertical bars;
-   4px top-corner radius;
-   8px gap;
-   primary `#34D399`;
-   secondary/background `#F0FDF4`;
-   axis labels 12px Medium Source Sans 3, muted.

Avoid excessive categories where labels become unreadable.

### 17.6 Donut Chart

Part-to-whole visualization.

Preserved visual baseline:

-   24px stroke;
-   hollow center;
-   primary `#34D399`;
-   secondary `#059669`;
-   starts at 12 o'clock;
-   legend swatch 12px;
-   legend label 14px Source Sans 3;
-   percentage 14px Medium Source Sans 3.

Avoid \>6 segments where interpretation suffers. If exact values matter,
provide an appropriate data representation.

### 17.7 Chart resilience

Charts must handle long labels, missing/zero data, loading, error, and
constrained width. Do not make labels unreadably small to preserve
desktop geometry.

### 17.8 Ownership boundary

Aurora defines presentation. Feature/reporting/Intelligence contracts
define metric definitions, calculations, ranking, severity, scores,
aggregation, and interpretation.

------------------------------------------------------------------------

## 18. Components --- Identity & Media

### 18.1 Avatar

Represents a person, brand, account, or comparable identity.

Variants:

-   image;
-   initials fallback;
-   generic fallback.

Equivalent identity types should use consistent geometry. Optional
status indicators must not obscure the Avatar or rely solely on color
for important meaning.

### 18.2 Avatar + Identity

Reusable pattern:

``` text
[Avatar]  Primary identity
          Secondary identity / metadata
```

Feature composition determines which identity fields are shown.

### 18.3 Image / Media

Canonical handling includes bounds, aspect-ratio behavior, crop/fit,
radius, loading, and fallback.

Supported fit modes where applicable:

-   Cover
-   Contain

Use according to content intent; logos and product imagery may require
different fit behavior.

### 18.4 Missing media

Use approved fallback rather than broken image UI, collapsed geometry,
or arbitrary replacement imagery.

------------------------------------------------------------------------

## 19. Reusable Patterns

Patterns are reusable compositions, not foundational primitives.

  -----------------------------------------------------------------------
  Pattern                 Composition / Purpose   Canonical owner
  ----------------------- ----------------------- -----------------------
  Persistent Action       persistent workflow     §6
  Region                  action + safe clearance 

  Empty State             explanation + optional  §19.1
                          action                  

  Section Error           contained error +       §16
                          recovery                

  Confirmation            Dialog + consequence +  §15
                          actions                 

  Avatar + Identity       Avatar + identity       §18
                          metadata                

  Responsive Table → Data semantic data           §17
  Cards                   transformation          

  Multi-select Chip Group selection/search +      §§10--11
                          Chips + removal         
  -----------------------------------------------------------------------

### 19.1 Empty State

Valid content region with no applicable data.

May represent:

-   first use;
-   no results;
-   filtered empty;
-   completed/cleared state.

An Empty State may contain optional icon/illustration, title,
explanation, primary action, and secondary action.

Do not use Empty State for Loading, Error, or unavailable permission.

### 19.2 Pattern promotion

Promote a feature composition to Aurora when it appears across unrelated
features, requires standardized interaction/responsive/accessibility
behavior, and central ownership reduces meaningful drift.

Repeated use inside one feature is not sufficient evidence.

------------------------------------------------------------------------

## 20. Component Selection Guidance

Choose components by semantics and information structure.

  Question                                       Use
  ---------------------------------------------- ----------------------------------
  Performs an action?                            Button
  Navigates?                                     Link
  Independent binary selection?                  Checkbox
  Immediate on/off setting?                      Switch
  Mutually exclusive simple options?             Radio
  Defined compact option list?                   Select
  Large/searchable option set?                   Searchable Select / Combobox
  Descriptive/consequential choice?              Selection Card
  Multiple compact selected values?              Multi-select + Chips
  Peer views?                                    Tabs
  Sequential workflow?                           Step Indicator
  Cross-row/column comparison central?           Table
  Individual item comprehension primary?         Data List
  Persistent important condition?                Alert
  Brief non-blocking confirmation?               Toast
  Short unknown-duration operation?              Spinner
  Content geometry loading?                      Skeleton
  Measurable progress?                           Linear Progress
  Long-running contextual operation?             Processing State
  Short focused temporary task?                  Dialog
  Contextual secondary desktop task?             Drawer
  Short compact mobile task?                     Bottom Sheet
  Substantial constrained-screen workflow?       Full-screen Sheet
  Distinct grouped object/surface?               Card
  Major page region?                             Section Container
  Informational/status?                          Badge
  Selectable/removable/filtering?                Chip
  Supplementary clarification?                   Tooltip
  Essential explanation?                         Visible content
  Secondary disclosure improves comprehension?   Accordion
  Critical/high-frequency object action?         Direct action
  Secondary/infrequent action?                   Overflow Menu may be appropriate

Option count is a useful constraint but not the sole selector. The old
v4.1 rules such as "2--4 Selection Cards" or "\>5 Dropdown" are
heuristics, not universal semantics.

------------------------------------------------------------------------

## 21. Responsive Component Matrix

§7 remains authoritative.

  ------------------------------------------------------------------------
  Component /     Desktop         Tablet           Mobile
  Pattern                                          
  --------------- --------------- ---------------- -----------------------
  Application     Sidebar         adapted/hidden   Bottom Navigation +
  navigation                      Sidebar + menu   Global Navigation
                                                   Drawer where applicable

  Header          Desktop Header  adapted Header   Mobile Header

  Breadcrumb      full            full/condensed   Back Navigation +
                                                   context

  Page grid       multi-column    reduced columns  primary single column

  Card grid       multi-column    reduced columns  stack

  Metadata        inline          wrap             wrap/stack

  Tabs            horizontal      horizontal       fit or horizontal
                                                   scroll; alternative
                                                   only if Tabs unsuitable

  Table           Table           Table/compact    Table if usable;
                                                   otherwise Data
                                                   List/Cards

  Form            1--3 columns    1--2 columns     primarily one column

  Selection Cards grid/row        reduced grid     primarily stack

  Chip Group      inline/wrap     wrap             wrap

  Action Group    horizontal      reflow           stack/reposition where
                                                   needed

  Toolbar         full            reduced          essential direct
                                                   actions + eligible
                                                   overflow

  Alert           inline where    reflow           stack action where
                  suitable                         needed

  Step Indicator  horizontal      adapted          adapted
                  where suitable                   horizontal/vertical

  Context Drawer  side surface    adapted          full/near-full-screen
                                                   Sheet

  Small Dialog    Dialog          Dialog           Dialog or compact
                                                   Bottom Sheet

  Long form /     Dialog/Drawer   adapted          Full-screen Sheet
  complex overlay                                  

  Persistent      usually         contextual       Persistent Action
  workflow action contextual                       Region where warranted
  ------------------------------------------------------------------------

Responsive transformation does not authorize arbitrary information
deletion.

------------------------------------------------------------------------

## 22. Design Acceptance & Resilience Matrix

Apply only conditions relevant to the component or composition.

  ---------------------------------------------------------------------
  Condition                          Acceptance expectation
  ---------------------------------- ----------------------------------
  Default                            canonical Aurora presentation

  Short / typical content            intentional layout

  Long / very long content           defined wrap/truncate/expand
                                     behavior; no semantic loss

  Missing optional data              valid structure

  Desktop / tablet / mobile          correct applicable transformation

  Hover                              correct where applicable

  Focus-visible                      clearly perceivable

  Pressed                            interaction communicated

  Selected / Active                  semantically distinguishable

  Disabled                           unavailable without appearing
                                     selected

  Loading                            stable and understandable

  Error                              readable and recoverable where
                                     appropriate

  Empty                              correct Empty State where
                                     applicable

  Reduced motion                     state remains understandable

  Virtual keyboard                   critical mobile controls remain
                                     reachable
  ---------------------------------------------------------------------

For responsive compositions verify:

-   no accidental page-level horizontal overflow;
-   readable text;
-   preserved action hierarchy;
-   required information remains available;
-   usable touch targets;
-   persistent UI does not cover content;
-   overlay content fits the usable viewport.

Feature compositions must pass applicable acceptance conditions even
when their individual Aurora primitives already conform.

------------------------------------------------------------------------

## 23. Visual Reference

The Aurora Visual Reference provides visual grounding for designers,
Stitch, Codex, Cursor, Antigravity, frontend engineers, and reviewers.

It may demonstrate:

-   visual character;
-   component appearance;
-   hierarchy and density;
-   representative states;
-   responsive transformations;
-   component combinations.

It does not independently override tokens, semantics, responsive rules,
accessibility requirements, product logic, feature behavior, or domain
contracts.

A screenshot with short content does not establish a one-line maximum. A
mobile screenshot does not authorize deleting information not visible in
the example.

If the Visual Reference materially disagrees with the same-version
semantic specification or executable Aurora, surface and resolve the
drift.

------------------------------------------------------------------------

## 24. AI / Design Tool Interpretation

This section contains only Aurora-specific interpretation rules. General
AI engineering behavior is governed by `AI_ENGINEERING_STANDARD.md`;
production frontend implementation is governed by
`docs/engineering/frontend.md`.

1.  **Semantics over resemblance.** Choose components according to §20
    before copying the apparent shape of a reference.
2.  **Reference screens demonstrate composition, not fixed content
    geometry.** Apply §8 to realistic data.
3.  **Responsive variants preserve the same product semantics.** Apply
    §7 rather than independently redesigning each breakpoint.
4.  **Feature contracts determine information priority.** If
    prioritization is consequential and unspecified, preserve
    information or surface the unresolved product decision.
5.  **Use existing Aurora capability before proposing new Aurora
    capability.** Prefer component → pattern → feature composition →
    Design System proposal.
6.  **Do not rewrite approved product copy to solve layout pressure.**
7.  **Do not treat generated variation as a new token/component.** A
    Stitch/Codex variation that differs from Aurora is a discrepancy to
    reconcile, not automatic Design System evolution.

------------------------------------------------------------------------

## 25. Change Governance

### 25.1 Change types

-   **Clarification:** wording improvement without intended behavior
    change.
-   **Correction:** resolves inconsistency or erroneous rule.
-   **Extension:** adds reusable backward-compatible capability.
-   **Breaking change:** changes an established contract and may require
    migration.

### 25.2 Feature composition first

``` text
Can Aurora support it?
→ yes: use Aurora
→ no: can Aurora primitives compose it?
     → yes: create feature composition
     → no: is the missing capability reusable beyond the feature?
          → yes: consider Aurora extension
```

Avoid premature abstraction.

### 25.3 Promotion criteria

A feature composition is an Aurora candidate when the same semantic
problem recurs across unrelated features and centralizing interaction,
responsive, or accessibility behavior would prevent meaningful drift or
repeated cost.

### 25.4 Token creation

New global tokens require reusable semantic meaning. Do not create
tokens for isolated feature spacing, one-off visual adjustments, or
arbitrary generated values.

Repeated copying of an arbitrary value does not make it canonical.

### 25.5 Feature exceptions

Approved exceptions should document:

-   what differs from Aurora;
-   why;
-   scope;
-   temporary/permanent intent;
-   whether Aurora evolution should be considered.

Exceptions do not silently become product-wide conventions.

### 25.6 Deprecation

When replacing an Aurora component, Pattern, token, or behavior:

1.  mark it deprecated;
2.  identify replacement;
3.  stop using it in new work;
4.  migrate existing work when justified;
5.  remove it when compatibility permits.

### 25.7 Versioning

Use explicit semantic versions:

-   **Major:** breaking/system architectural change.
-   **Minor:** backward-compatible capability addition.
-   **Patch:** clarification/correction without material contract
    change.

### 25.8 Release synchronization

``` text
Requirement → check Aurora → define contract → review responsive/accessibility/resilience
→ approve → update specification + executable Aurora + relevant Visual Reference
→ migrate affected features where required
```

Same-version artifact conflicts must be resolved, not locally selected
around.

### 25.9 Canonical principle

> Aurora standardizes reusable interface decisions so individual
> features do not repeatedly solve them. It does not absorb the product
> decisions that make those features different.

------------------------------------------------------------------------

## Appendix A --- Canonical Token Reference

``` css
:root {
  /* Colors */
  --color-primary: #34D399;
  --color-secondary: #061F23;
  --color-tertiary: #F5926E;

  --surface-workflow: #F0FDF4;
  --surface-page: #F8F8F8;
  --surface-card: #FFFFFF;

  --border-default: #E5E7EB;

  --text-high: #0E1214;
  --text-muted: #6B7280;

  --status-error: #CA0F1C;
  --status-warning-bg: #FFF6F6;

  --disabled-bg: #F3F4F6;
  --disabled-text: #6B7280;

  /* Typography */
  --font-heading: 'Satoshi Variable';
  --font-body: 'Source Sans 3';

  --size-h1-desktop: 32px;
  --size-h2-desktop: 24px;
  --size-h1-mobile: 28px;
  --size-h2-mobile: 20px;
  --size-body: 14px;
  --size-caption: 12px;

  /* Spacing */
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 32px;
  --space-xl: 48px;

  /* Radius */
  --radius-button: 8px;
  --radius-input: 8px;
  --radius-badge: 8px;
  --radius-card-standard: 12px;
  --radius-card-compact: 8px;
  --radius-pill: 9999px;

  /* Heights */
  --height-header: 72px;
  --height-header-mobile: 56px;
  --height-bottom-nav: 64px;
  --height-input: 48px;
  --height-button: 48px;

  /* Breakpoints */
  --breakpoint-mobile: 768px;
  --breakpoint-desktop: 1280px;

  /* Baseline layering */
  --z-sidebar: 100;
  --z-header: 200;
  --z-modal-overlay: 900;
  --z-modal-content: 901;
  --z-bottom-nav: 1000;
}
```

**Note:** CSS custom properties cannot themselves drive media-query
conditions in standard CSS. The breakpoint values above are semantic
reference tokens; executable Aurora should implement breakpoints through
the repository's established styling mechanism.

------------------------------------------------------------------------

------------------------------------------------------------------------

## Appendix B --- v5.0 Changelog

v5.0 preserves the v4.1 brand foundation while resolving responsive and
semantic ambiguities: mobile nested hierarchy uses Back Navigation;
mobile web accounts for browser chrome/safe areas/keyboard; Persistent
Action Region is formalized; Bottom Sheets are content-driven rather
than fixed at `70vh`; complex mobile overlays may use Full-screen Sheet;
Table → Data Cards is conditional; component selection is semantic; Chip
and Badge are distinct; Field is canonical; Processing State is distinct
from Spinner; responsive/content-resilience rules are centralized;
application navigation content remains application-owned.
