# Studio accessibility (axe) checks

Playwright + `@axe-core/playwright` suite that visits the main Studio screens in light and dark mode and fails on
serious or critical violations of the WCAG 2.0/2.1 A and AA rule tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
It is isolated from the Studio build: nothing here is part of the app bundle.

> **Scope:** the rule tags are WCAG 2.0 and 2.1 A and AA only. A green run is **not** evidence of WCAG 2.2
> conformance (2.2 adds success criteria, and axe's `wcag22aa` tag is not enabled). It is also not a substitute for
> manual keyboard and screen reader checks, and, run in Chromium, not cross-browser evidence.

Screens: login, global app (projects, users), create project dialog, dashboard, site tools, search, preview, preview
tools panel (every top level page), preview edit mode tools panel (every top level page), edit form and publish
dialog. Each runs once for the `light` and once for the `dark` Playwright project (`prefers-color-scheme`), giving 12
tests per theme and 24 in total. The preview iframe is excluded: it hosts the project's site, not Studio UI.

## Run

Against a running Studio (default `http://localhost:8080`) that has a freshly created Website Editorial project with no
edits (see [Content baseline guards](#content-baseline-guards)) and an administrator account:

```bash
yarn install
yarn workspace @craftercms/studio-a11y browsers   # one time, downloads Chromium
yarn test:a11y                                    # from studio-ui/; runs both themes
yarn workspace @craftercms/studio-a11y report     # opens the HTML report
```

In this workspace, `test:light` and `test:dark` run a single theme, and `test:unit` runs the suite's own helper tests
(allow-list filter, coverage check and readiness), which need a browser but no Studio. Reports are written to `ui/a11y/report/`
(`html/` and `results.json`). Every scan attaches its complete axe result, plus the allowed, blocking and stale nodes,
as JSON to the HTML report.

| Variable               | Default                 | Purpose                                                                                            |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `STUDIO_URL`           | `http://localhost:8080` | Studio origin                                                                                      |
| `STUDIO_USERNAME`      | `admin`                 | Login user (needs edit and publish permissions)                                                    |
| `STUDIO_PASSWORD`      | `admin`                 | Login password                                                                                     |
| `STUDIO_PROJECT`       | `editorial`             | Freshly created Website Editorial project, no edits (see below)                                    |
| `STUDIO_PREVIEW_PAGE`  | `/`                     | Preview page used for the edit form and publish dialog                                             |
| `A11Y_BROWSER_CHANNEL` | (bundled Chromium)      | `chrome` runs the installed Google Chrome instead                                                  |
| `A11Y_CAPTURE`         | (off)                   | `1` records the run's ticketed findings, `prune` only removes fixed ones (see [Capture](#capture)) |

## CI

Same command, headless, with `CI=1` (enables one retry and forbids `test.only`). A non-zero exit code means at least
one screen has a blocking violation, a stale exception, or did not render. Publish `ui/a11y/report/` as the build
artifact. No workflow runs the suite yet; wiring it into CI is a follow-up.

```bash
CI=1 STUDIO_URL=https://studio.example.com yarn test:a11y
```

## Allow-list

Known exceptions are node-level and ticketed:

- `tests/allow-list.ts` maps each axe rule to its umbrella ticket in `craftersoftware/craftercms-e` and the screens and
  themes that ticket lists. A rule without a ticket cannot be allow-listed.
- `tests/allow-list.json` lists, per rule, screen (the key passed to `checkA11y`, e.g. `edit mode tools panel > Search`)
  and theme, the fingerprint of each node allowed to fail. Entries are validated at load: the rule needs a ticket, the
  ticket must list the screen and theme, every entry names at least one node, and every node fingerprint carries a
  stable token. A stable token is a `Mui*` or authored class, an authored id, an attribute selector with a literal
  value, the start tag's `role`, or an anchor's `href`. A bare tag, `:nth-child` and generated `.mui-*`, `.css-*` or
  `#*` parts are not stable, so a fingerprint made only of them (which could match any node at that position) is
  rejected with the list of offenders.

A node fingerprint is axe's CSS path to the node followed by a normalised copy of its start tag, for example
`.MuiInput-input.mui-*.MuiSelect-select <div role="combobox" class="MuiInput-input MuiInputBase-input MuiSelect-select MuiSelect-standard">`.
`filter.ts` normalises it: emotion and MUI class hashes (`.css-*`, `.mui-*`, `css-<hash>` classes) and tss-react hashes
are dropped from the path and the tag, React/MUI generated ids (`_r_1_`, `:r1:`) become `*` in id selectors, in whole
tokens of id reference attributes such as `[aria-labelledby]` and in an anchor's `#fragment` (other attribute values
are kept), and the tag keeps only its name, `role`, sorted authored classes (`Mui*` and project classes) and, for an
`<a>`, its `href`. `.mui-fixed` is a stable MUI marker, not a hash, so it is kept. Transient interaction state classes
(`Mui-focusVisible`, `Mui-focused`, and component scoped ones such as `MuiButton-focusVisible`) are
dropped from the path and the tag, because they follow whatever the run focused last and would make the same node look
new and stale at once. `checkPanelPages` blurs after an Escape so the opener does not keep `Mui-focusVisible`; dropping
them covers any other starting focus (an autofocused field, a focus a dialog restores). Deterministic state classes
(`Mui-checked`, `Mui-selected`, `Mui-expanded`, `Mui-disabled`, `Mui-active`) come from props and data, so they are kept
(`Mui-active`'s one pointer driven use, a `Slider` thumb while dragged, never happens in a scan): the two
`Mui-checked` entries of the edit mode Settings switch stay as captured. The start tag is what identifies a
node when the path alone is positional (`.mui-*:nth-child(8)`), so a reordered list does not silently allow a different
node. Each fingerprint allows exactly one node. So:

- a new failure of an allow-listed rule on the same screen and theme fails the run;
- an allowed node that no longer fails is reported as **stale** and fails the run: delete it in the PR that fixed it;
- an entry for a screen its test never scanned (renamed or removed screen) fails the run. The test itself reports this
  for its own screens (its title, or `title > page`); the suite-wide check below covers the rest.

A markup change on an allowed node changes its fingerprint, which shows up as one stale and one blocking node. Review
it and recapture. A change to the fingerprint format makes the committed file invalid (it is validated at load): run
`yarn capture`, which loads the file unvalidated, and validates the new entries before writing them.

### Suite-wide coverage check

A renamed or removed root test (say `dashboard`) matches no running test, so the per-test check never sees its entries.
After every run, `tests/coverage-teardown.ts` (a global teardown next to the capture one) fails the run on each
allow-list entry, per screen and theme, that no scan reached. It reads the records `checkA11y` writes for each scan and
the one the fixture writes when a test starts (both under `report/artifacts`), plus the list of tests the suite declares
(a `playwright test --list` of the same config in a child process). The root of an entry is the first segment of its
screen key, which must be the title of the test that scans it. Each entry is then:

- **covered** if a scan reached its screen in that theme;
- **unscanned** if its root test ran in that theme without scanning it, or if the suite declares no test with that
  title in that theme (renamed or removed), however the run was filtered;
- **skipped**, with a log line, if its root test exists but did not run in this run.

So partial runs do not false-fail, and no flags are parsed: `--grep`, `test:light`, `test:dark`, one spec file, a shard
or an early stop leave the entries of tests that did not run unjudged, while an entry whose test is gone fails in any of
them. If the listing can't be read, a warning is logged and only tests that ran are judged. The check passes trivially
while the allow-list is empty and is off with `A11Y_CAPTURE` set (either mode).

### Capture

On a live Studio, against a freshly created Website Editorial project with no edits (see
[Content baseline guards](#content-baseline-guards)):

```bash
yarn workspace @craftercms/studio-a11y capture
```

runs both themes and rewrites `tests/allow-list.json` with every serious or critical node whose rule ticket lists the
screen and theme. Screens the run did not reach keep their existing entries. Findings no ticket covers are never
recorded; `report/capture-summary.md` lists them with a rule/ticket/screen/theme/node-count table for reconciling
against the tickets. Capture records whatever fails, so review the diff before committing it.

A capture does not enforce the content guards: it logs what each one observed and goes on, and the Search guard reads
its total once instead of waiting for the index to settle (see [Content baseline guards](#content-baseline-guards)), so
let the project's search index finish building before you recapture.

The committed baseline was captured on 2026-11-17 in both themes against a live authoring Studio built from `develop`
at `f2950f2c` (the Website Editorial blueprint, project `editorial`, user `admin`), and recaptured on 2026-11-17 on
this branch's build to move to start-tag fingerprints (same 62 entries and 658 nodes).

#### Prune-only capture

A PR that fixes allow-listed nodes should delete their entries without recording anything new:

```bash
yarn workspace @craftercms/studio-a11y capture:prune     # A11Y_CAPTURE=prune
```

It runs both themes and removes the allowed fingerprints that no longer fail on the screens it scanned (a node that
fails more than once with the same fingerprint is counted per node). It never adds an entry, so a new regression still
fails the next normal run. Entries of screens the run did not reach are kept, so `--grep` limits the run. Removed
nodes are listed in `report/capture-summary.md`. The content guards below stay on in this mode, since a project that
is not in its baseline state would prune wrongly.

### Content baseline guards

The allow-list was captured against a freshly created Website Editorial project with no edits, and `STUDIO_PROJECT`
must be one. Some entries are keyed by row position, so editing, publishing or deleting content, or adding a user,
would leave them stale and fail the run without saying why. Before scanning, the screens below read their listing and
compare it with a constant in `tests/baseline.ts`. On a mismatch they fail with "the project is not in its baseline
state", naming the screen, what was observed, what was expected and the entries it affects: recreate the project from
the Website Editorial blueprint (and remove extra users), or recapture.

| Screen                               | Constant             | Observed                                      | Baseline              |
| ------------------------------------ | -------------------- | --------------------------------------------- | --------------------- |
| `dashboard`, tools panel > Dashboard | `DASHBOARD_BASELINE` | Unpublished Work "1-50 of N" total, row count | 228 items, 50 rows    |
| `search`                             | `SEARCH_BASELINE`    | "N results" total, result card count          | 103 results, 21 cards |
| `users` (global app)                 | `USERS_BASELINE`     | users table total and rows                    | 2 users, 2 rows       |

Limits: the guards compare counts, not content. The Users guard does not check usernames or avatars, and the Search
guard does not check which items are listed. Other screens (site tools, preview pages) have no content-dependent
entries.

The Search guard waits for the results to settle before it compares them, because a project created moments ago keeps
adding results while its search index builds. The search page runs its query when it mounts and again only after a
content event, so an open page never picks up a growing index: between two reads the guard waits `pollMs` (2s),
reloads the page and waits for it to load, which runs the search again. It passes as soon as the total and card count
match `SEARCH_BASELINE`. A state that differs but shows the same non-empty total for 5s is taken as final and reported
as a baseline mismatch. If the total is still changing, empty or unreadable after 60s, it fails with "the search
results did not settle" and the last state it saw: wait for the index to finish and run again. The intervals are
`SEARCH_SETTLE` in `tests/baseline.ts`. The dashboard and Users guards read once.

A capture (`A11Y_CAPTURE=1`) skips the guards, since a recapture is how the baseline changes. It logs `<Screen>
baseline observed: total=N rows=M` (and attaches it to the report): set the constants to those values in the same
commit as the new allow-list. The Search guard does not wait in a capture: it reads the total once, without reloading
and without throwing (an unreadable or empty list is logged and attached instead of failing the capture), so a
recapture on a project that is off the baseline does not stall. That also means the value it logs is only the baseline
when the search index has finished building, so wait for the index before you recapture. A prune-only capture keeps the
guards enforced, including the wait.

## Readiness

`tests/readiness.ts` exposes `settle(page, screen, ready)`. `ready` is the screen's own loaded state, its explicit
empty state and its error state, scoped to the screen or destination that was opened, never a dialog frame, panel
header or Back button that renders before the data arrives. Each tools panel destination has its own contract
(`panelDestination`); a panel button with no contract fails rather than being scanned on a guess. `settle` waits for
the loaded or empty state, for loading indicators (progress bars, skeletons, `LoadingState`) to clear, and for
notifications to close. Every wait throws `NotReadyError` naming the screen, and an error state also throws, so a
scan is never reported against a screen that did not render. `networkidle` is not used: Studio keeps long-lived
connections open, so it is not a signal that the UI rendered.

The publish dialog test also asserts the dialog's computed accessible name (`Publish`), as a soft assertion.

## Browser setup

Studio's legacy browser check (`templates/web/common/page-fragments/studio-context.ftl`) reads `window.chrome`, which
Playwright's bundled Chromium doesn't define, and prepends a "browser not supported" banner that Chrome and Firefox
users don't see. As a Chromium-shell compatibility setup, `fixtures.ts` defines `window.chrome` before any page script
runs. It disables no axe rule, but it removes that banner from what is scanned. With `A11Y_BROWSER_CHANNEL=chrome`
the browser defines `window.chrome` itself and the shim does nothing.
