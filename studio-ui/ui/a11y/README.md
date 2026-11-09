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

Against a running Studio (default `http://localhost:8080`) that has a project and an administrator account:

```bash
yarn install
yarn workspace @craftercms/studio-a11y browsers   # one time, downloads Chromium
yarn test:a11y                                    # from studio-ui/; runs both themes
yarn workspace @craftercms/studio-a11y report     # opens the HTML report
```

In this workspace, `test:light` and `test:dark` run a single theme, and `test:unit` runs the suite's own helper tests
(allow-list filter and readiness), which need a browser but no Studio. Reports are written to `ui/a11y/report/`
(`html/` and `results.json`). Every scan attaches its complete axe result, plus the allowed, blocking and stale nodes,
as JSON to the HTML report.

| Variable               | Default                 | Purpose                                                           |
| ---------------------- | ----------------------- | ----------------------------------------------------------------- |
| `STUDIO_URL`           | `http://localhost:8080` | Studio origin                                                     |
| `STUDIO_USERNAME`      | `admin`                 | Login user (needs edit and publish permissions)                   |
| `STUDIO_PASSWORD`      | `admin`                 | Login password                                                    |
| `STUDIO_PROJECT`       | `editorial`             | Existing Website Editorial project used by project screens        |
| `STUDIO_PREVIEW_PAGE`  | `/`                     | Preview page used for the edit form and publish dialog            |
| `A11Y_BROWSER_CHANNEL` | (bundled Chromium)      | `chrome` runs the installed Google Chrome instead                 |
| `A11Y_CAPTURE`         | (off)                   | `1` records the run's ticketed findings (see [Capture](#capture)) |

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
  ticket must list the screen and theme, and every entry names at least one node.

A node fingerprint is axe's CSS path to the node, with emotion class hashes, tss-react hashes and React/MUI generated
ids normalised away (`filter.ts`). Each fingerprint allows exactly one node. So:

- a new failure of an allow-listed rule on the same screen and theme fails the run;
- an allowed node that no longer fails is reported as **stale** and fails the run: delete it in the PR that fixed it;
- an entry for a screen its test never scanned (renamed or removed screen) fails the run.

A markup change on an allowed node changes its fingerprint, which shows up as one stale and one blocking node. Review
it and recapture.

### Capture

On a live Studio:

```bash
yarn workspace @craftercms/studio-a11y capture
```

runs both themes and rewrites `tests/allow-list.json` with every serious or critical node whose rule ticket lists the
screen and theme. Screens the run did not reach keep their existing entries. Findings no ticket covers are never
recorded; `report/capture-summary.md` lists them with a rule/ticket/screen/theme/node-count table for reconciling
against the tickets. Capture records whatever fails, so review the diff before committing it.

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
