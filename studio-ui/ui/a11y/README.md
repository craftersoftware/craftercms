# Studio accessibility (axe) checks

Playwright + `@axe-core/playwright` suite that visits the main Studio screens in light and dark mode and fails on
serious or critical violations of the WCAG 2.0/2.1 A and AA rule tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
It is isolated from the Studio build: nothing here is part of the app bundle.

> **Scope:** the rule tags are WCAG 2.0 and 2.1 A and AA only. A green run is **not** evidence of WCAG 2.2
> conformance (2.2 adds success criteria, and axe's `wcag22aa` tag is not enabled). Move to the 2.2 tags once this 2.1
> gate is stable.

Screens: login, global app (projects, users), create project dialog, dashboard, site tools, search, preview, preview
tools panel (every top level page), preview edit mode tools panel (every top level page), edit form and publish
dialog. Each runs once for the `light` and once for the `dark` Playwright project (`prefers-color-scheme`), giving 12
tests per theme and 24 in total.

On `develop`, before the a11y remediation PRs land, 20 of those 24 tests fail across 11 axe rules. Those findings are
recorded in the allow-list below, so the suite passes on `develop` today and fails on a regression or a new finding.

## Run

Against a running Studio (default `http://localhost:8080`) that has a project and an administrator account:

```bash
yarn install
yarn workspace @craftercms/studio-a11y browsers   # one time, downloads Chromium
yarn test:a11y                                    # from studio-ui/; runs both themes
yarn workspace @craftercms/studio-a11y report     # opens the HTML report
```

`test:light` and `test:dark` (in this workspace) run a single theme. Reports are written to `ui/a11y/report/`
(`html/` and `results.json`); every scan attaches its complete axe result as JSON to the HTML report.

| Variable              | Default                 | Purpose                                                |
| --------------------- | ----------------------- | ------------------------------------------------------ |
| `STUDIO_URL`          | `http://localhost:8080` | Studio origin                                          |
| `STUDIO_USERNAME`     | `admin`                 | Login user (needs edit and publish permissions)        |
| `STUDIO_PASSWORD`     | `admin`                 | Login password                                         |
| `STUDIO_PROJECT`      | `editorial`             | Existing project used by project-scoped screens        |
| `STUDIO_PREVIEW_PAGE` | `/`                     | Preview page used for the edit form and publish dialog |

## CI

Same command, headless, with `CI=1` (enables one retry and forbids `test.only`). A non-zero exit code means at least
one screen has a blocking violation. Publish `ui/a11y/report/` as the build artifact. No workflow runs the suite yet;
wiring it into CI is a follow-up once the baseline is green.

```bash
CI=1 STUDIO_URL=https://studio.example.com yarn test:a11y
```

## Allow-list

Known exceptions live in `tests/allow-list.ts`: one entry per axe rule per screen, where a screen is the key the test
scans with (`login`, `dashboard`, `edit mode tools panel > Search`, ...). Each entry carries a `reason` citing the
success criterion and a `ticket` (`craftersoftware/craftercms-e#<number>`, or `'TBD'` until the ticket is filed).
Entries stay coarse on purpose: axe selectors contain generated class names and React ids that change between runs, so
a selector-scoped entry would drift.

The list is the baseline recorded on `develop` (20 of 24 tests failing, 11 axe rules). `clearedBy` marks the a11y PR
whose combined run no longer reports the finding; delete those entries when that PR merges. A finding on a screen with
no matching entry fails the run, so the gate is still a regression check everywhere the baseline is clean.

`tests/fixtures.ts` exposes `settle(page, screen, ready?)`, which waits out Studio's loading state and then for a
screen-specific element. Every wait throws `NotReadyError` naming the screen, so a scan can never be reported against
a screen that did not render. There is no best-effort mode and `networkidle` is not used: Studio keeps long-lived
connections open, so it returns before the UI has rendered.
