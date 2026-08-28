# Audit: jobs, hiring and site-wide responsive behaviour

Scope: `app/pages/jobs/`, `app/pages/hiring/`, their components and composables, and
the responsive system across the whole app. Every finding below was reproduced
before being written down; fixed items say what changed.

---

## 1. Bugs found and fixed

### 1.1 Stats panel collapse button had no accessible name on mobile — **fixed**

`app/components/ui/AnalyticsPanel.vue`

The collapse/expand toggle's only accessible text was a `<span>`, and the
component's own mobile rule hides it:

```css
@media (max-width: 700px) { .analytics-panel__toggle span { display: none } }
```

The button carried `aria-expanded` but no `aria-label`, so below 700px it was an
icon-only button with **no accessible name at all** — a WCAG 4.1.2 failure. It
affects every stats panel: jobs, hiring and flat-finder.

Fixed by adding `:aria-label`. Verified at 375px: the label span is hidden and
visible text is empty, but the button now exposes the name "Свернуть".

### 1.2 Flat feed never notified the availability cache — **fixed**

`app/composables/flats/useFlatFeed.ts`

`useFlatFeed(options)` and its inner `loadFeed(params, options)` both used the
name `options`. Inside `loadFeed`, the inner parameter shadowed the outer one, so:

```js
if (data.availabilityChecked?.length) options.onAvailabilityChecked?.(...)
```

always resolved to `undefined` and the optional call silently did nothing.
`app/pages/flat-finder/index.vue:87` passes `onAvailabilityChecked: markAvailabilityFresh`,
so that callback had never fired from a feed response. Fixed by renaming the outer
parameter to `feedOptions`.

### 1.3 Hiring had two media queries that both matched at exactly 700px — **fixed**

`app/pages/hiring/index.vue` declared `@media (min-width: 700px)` (desktop filter
grid) and `@media (max-width: 700px)` (mobile stacking) in the same stylesheet.
At exactly 700px **both** applied. Fixed structurally — see §2.

### 1.4 Dead CSS — **fixed**

`app/components/hiring/StatsPanel.vue` carried
`.hiring-stats__toggle { font-size: 0 !important }` inside its 650px block. No
element anywhere uses that class; the real toggle is `.analytics-panel__toggle`
in `AnalyticsPanel.vue`. Rule deleted.

### 1.5 Hiring activity segments were unlabelled — **fixed**

The 7/30/60-day segment group in `app/components/hiring/StatsPanel.vue` had no
group label and no pressed state, while the jobs equivalent
(`app/components/jobs/StatsPanel.vue:215`) already passed `:aria-label`. Added
`role="group"`, `aria-label` and `aria-pressed`.

**Checked and already correct:** `SearchFilterControl.vue` and the `U/` kit wire
labels properly (`useId()` + `:for` in `U/Input.vue`, `aria-label` in
`U/SelectMenu.vue`). No action needed.

---

## 2. Responsive system

### The problem

The app had **40 distinct breakpoints** (27 `max-width`, 13 `min-width`) and no
shared definition. Symptoms:

- The three main feature pages shared **no** breakpoint values: jobs used
  700/1200/620, hiring 700, flat-finder 1100/760/390.
- `JobCard.vue` broke at 480px, `CandidateCard.vue` at 700px — the two card
  components disagreed about what "mobile" means.
- Hand-managed off-by-one pairs (639/640, 699/700, 767/768, 1179/1180) existed to
  stop a `min-` and a `max-` query both matching on the boundary pixel. One place
  got it wrong (§1.3).

### The fix

`app/assets/css/mixins/_breakpoints.scss` defines one scale —
**480 / 640 / 768 / 1024 / 1280 / 1440** (`xs`…`xxl`) — and exposes
`bp-up()` / `bp-down()` / `bp-between()`, following the `_flat-tone.scss` mixin
convention already used by `FlatCard.vue` and `SearchDetailsModal.vue`.

`bp-down()` emits `max-width: <token> - 0.02px`, so an up/down pair on the same
token can never overlap and callers never hand-manage the -1. This eliminates the
whole class of bug in §1.3 structurally rather than case by case.

### Migrated (18 files)

All of `app/components/search/*`, both feature pages and their cards/stats panels,
`AnalyticsPanel.vue`, all of `app/components/flats/*`, `app/pages/flat-finder/`,
and the new validator page.

Verified in the browser that the mixins expand as intended: `639.98px`, `767.98px`,
`768px`, `1024px`, `1280px`, `1440px`.

### Deliberately **not** snapped — needs a design decision

Three clusters sit more than 32px from any token, so snapping them would change
real layout behaviour rather than just tidy a number. They were left as-is:

| Value | Where | Why not snapped |
|---|---|---|
| `390px` | `flat-finder/index.vue` | A very-narrow-phone tweak (11px font, tighter gaps). Snapping to `xs` (480) would apply cramped styling to all phones up to 480px. |
| `900px` | `flats/StatsPanel.vue`, 12 `min-width` uses site-wide | Equidistant between `md` (768) and `lg` (1024); both directions move it >120px. |
| `1100px` | `flat-finder/index.vue` + 6 other uses | Snapping to `lg` (1024) delays the 2-column filter layout by 76px and risks overflow between 1024–1100. |

**Recommendation:** decide per case whether the layout should move to the nearest
token or whether the scale should gain a 7th token. Both are defensible; neither
should be done silently.

### Still to migrate

28 distinct raw breakpoint values remain in pages outside this audit's scope
(`quizzes/`, `services/*` except the new one, `about/`, `cv/`, `projects/`, and
assorted components). The mechanism is in place; those are a follow-up.

---

## 3. Duplication

### Fixed: the feed polling machinery was triplicated

`useJobFeed.ts`, `useHiringFeed.ts` and `useFlatFeed.ts` each contained a
byte-identical copy of `debounceFilterRequest()`, `scheduleWarmPoll()`, the
timer/`warmParams` declarations and the `onBeforeUnmount` cleanup — including the
same `FILTER_REQUEST_DEBOUNCE_MS = 180` and 1800ms poll interval.

Extracted to `app/composables/search/useFeedPolling.ts`, beside the existing shared
`useLatestRequest.ts`. The primitive owns **only** the mechanism. Each feed keeps
its own merge and error semantics, which differ on purpose and must not be
collapsed:

- jobs dedupes by `url || id` via a `Set` and **clears** results on error;
- hiring dedupes by `id` via a `Map` and **preserves** the previous page
  (`failed = !profiles.length`);
- flats dedupes by `source:country:id` and has a separate statistics request.

`useJobFeed` went 103 → 76 lines, `useHiringFeed` 96 → 69, `useFlatFeed` 164 → 141.

### Remaining (not fixed — larger design decisions)

- **`useJobFilterBlocks.ts` / `useHiringFilterBlocks.ts`** are structurally
  identical (same local `Model`/`OptionSource` types, same options shape). A shared
  builder is possible but the field sets are genuinely different; worth doing only
  alongside a shared filter-schema type.
- **`jobs/StatsPanel.vue` / `hiring/StatsPanel.vue`** share the `analytics-card`
  markup and segment-toggle pattern. The chart contents differ; the wrapper could
  become a shared component.

### Feature asymmetry worth deciding on

Jobs has **no preset support and no share dialog** — no `preset` handling anywhere
in `app/pages/jobs/index.vue`, and sharing is a clipboard-copy button. Hiring and
flat-finder both use `SearchPresetDialog` + `SearchShareDialog`. This looks like
drift rather than intent; jobs is the odd one out of the three.

---

## 4. Verification

- `npm test` — 316 passing.
- `/jobs`, `/hiring`, `/flat-finder`, `/quizzes/country-fit`,
  `/services/workflow-validator` each load with zero console errors in a fresh tab.
- A11y fix confirmed by inspecting the computed accessible name at 375px.
- Four tests that asserted literal media-query text were updated to assert the
  breakpoint token instead (`tests/flats-layout-and-stats.test.mjs`,
  `tests/flats-visual-continuity.test.mjs`, `tests/search-feed-debounce.test.mjs`,
  `tests/filter-debounce-budget.test.mjs`) — they were testing the implementation,
  not the behaviour.
