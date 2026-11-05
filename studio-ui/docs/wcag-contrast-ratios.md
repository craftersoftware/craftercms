# WCAG 2.1 AA contrast and focus ratios

craftersoftware/craftercms-e#1427 (parent craftersoftware/craftercms-e#1419). Success criteria covered: 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast, 1.4.1 Use of Color, 2.4.7 Focus Visible.

Ratios use the WCAG relative luminance formula. Semi-transparent colours are composited over the real background, including the MUI dark-mode elevation overlay on dialogs and menus. The theme tokens are in `ui/app/src/styles/palette.ts` and `ui/app/src/components/CrafterThemeProvider/CrafterThemeProvider.tsx`.

Targets: 4.5:1 for text, 3:1 for the boundary of a control, state icons and focus indicators. Disabled controls and purely decorative dividers are exempt (1.4.3 and 1.4.11).

How to read the tables:

- The token tables are computed from the theme. They cover the three surfaces a control can sit on: `paper` (cards, panels), `default` (page) and `dialog`.
- "Measured component states" come from the rendered components in a harness that mounts `CrafterThemeProvider` (computed styles, composited). The worst case across the three surfaces is shown.
- Text sweep: every text node in a gallery of the MUI components the app uses (typography, inputs, helper text, buttons, chips, alerts, tabs, tables, lists, tooltips, badges, breadcrumbs, accordions) is at least 4.5:1 on all three surfaces in both modes (279 text nodes, 0 failures), and axe-core `color-contrast` reports 0 violations on the same gallery and on the login view.
- Focus ring: a 2px white outline with a 4px black ring around it, so the indicator has 3:1 or more on any light or dark surface (the better of the two bands is shown).

## Light mode

Surfaces: paper `#fff`, default `#FAFAFA`, dialog `#FFFFFF`. (Dark dialog and menu surfaces are `#121212` plus the 16.5% MUI elevation overlay.)

### Text (SC 1.4.3, 4.5:1)

| Token                                    | Foreground            | on paper  | on default | on dialog |
| ---------------------------------------- | --------------------- | --------- | ---------- | --------- |
| text.primary                             | `rgba(0, 0, 0, 0.87)` | 16.07 yes | 15.52 yes  | 16.07 yes |
| text.secondary (also placeholder, label) | `rgba(0, 0, 0, 0.6)`  | 5.74 yes  | 5.67 yes   | 5.74 yes  |
| primary.main as text or link             | `#0068DA`             | 5.26 yes  | 5.04 yes   | 5.26 yes  |
| secondary.main as text or link           | `#8944AB`             | 6.04 yes  | 5.78 yes   | 6.04 yes  |
| error.main as text or link               | `#D12E25`             | 5.09 yes  | 4.87 yes   | 5.09 yes  |
| warning.main as text or link             | `#A35F00`             | 5.01 yes  | 4.8 yes    | 5.01 yes  |
| info.main as text or link                | `#357694`             | 5.04 yes  | 4.82 yes   | 5.04 yes  |
| success.main as text or link             | `#217F39`             | 5.05 yes  | 4.84 yes   | 5.05 yes  |

### Filled and contained controls (SC 1.4.3)

| State                     | Foreground | Background | Ratio    | Ratio when hovered (measured) |
| ------------------------- | ---------- | ---------- | -------- | ----------------------------- |
| contained primary label   | `#fff`     | `#0068DA`  | 5.26 yes | 8.82 yes                      |
| contained secondary label | `#fff`     | `#8944AB`  | 6.04 yes | 9.72 yes                      |
| contained error label     | `#fff`     | `#D12E25`  | 5.09 yes | 8.6 yes                       |
| contained warning label   | `#fff`     | `#A35F00`  | 5.01 yes | 8.42 yes                      |
| contained info label      | `#fff`     | `#357694`  | 5.04 yes | 8.46 yes                      |
| contained success label   | `#fff`     | `#217F39`  | 5.05 yes | 8.53 yes                      |

Hovered label contrast, all 18 variant (contained, outlined, text) and colour combinations: minimum 4.75:1.

### Non-text (SC 1.4.11, 3:1)

| Token or state                                                     | Colour                | vs paper | vs default | vs dialog |
| ------------------------------------------------------------------ | --------------------- | -------- | ---------- | --------- |
| Form border, switch track, unchecked icon (`gray.medium3`)         | `#8E8E93`             | 3.26 yes | 3.12 yes   | 3.26 yes  |
| primary.main as border, icon or indicator                          | `#0068DA`             | 5.26 yes | 5.04 yes   | 5.26 yes  |
| secondary.main as border, icon or indicator                        | `#8944AB`             | 6.04 yes | 5.78 yes   | 6.04 yes  |
| error.main as border, icon or indicator                            | `#D12E25`             | 5.09 yes | 4.87 yes   | 5.09 yes  |
| warning.main as border, icon or indicator                          | `#A35F00`             | 5.01 yes | 4.8 yes    | 5.01 yes  |
| info.main as border, icon or indicator                             | `#357694`             | 5.04 yes | 4.82 yes   | 5.04 yes  |
| success.main as border, icon or indicator                          | `#217F39`             | 5.05 yes | 4.84 yes   | 5.05 yes  |
| Focus ring (white outline over black ring; the better band counts) | `#FFFFFF` / `#000000` | 21 yes   | 20.12 yes  | 21 yes    |

## Dark mode

Surfaces: paper `#121212`, default `#1C1C1E`, dialog `#393939`. (Dark dialog and menu surfaces are `#121212` plus the 16.5% MUI elevation overlay.)

### Text (SC 1.4.3, 4.5:1)

| Token                                    | Foreground                 | on paper  | on default | on dialog |
| ---------------------------------------- | -------------------------- | --------- | ---------- | --------- |
| text.primary                             | `#fff`                     | 18.73 yes | 17.01 yes  | 11.55 yes |
| text.secondary (also placeholder, label) | `rgba(255, 255, 255, 0.7)` | 9.43 yes  | 8.86 yes   | 6.59 yes  |
| primary.main as text or link             | `#54A6FF`                  | 7.38 yes  | 6.7 yes    | 4.55 yes  |
| secondary.main as text or link           | `#9A98FF`                  | 7.41 yes  | 6.73 yes   | 4.57 yes  |
| error.main as text or link               | `#FF7A73`                  | 7.39 yes  | 6.71 yes   | 4.56 yes  |
| warning.main as text or link             | `#FFB340`                  | 10.5 yes  | 9.54 yes   | 6.48 yes  |
| info.main as text or link                | `#70D7FF`                  | 11.47 yes | 10.41 yes  | 7.07 yes  |
| success.main as text or link             | `#30DB5B`                  | 10.18 yes | 9.24 yes   | 6.27 yes  |

### Filled and contained controls (SC 1.4.3)

| State                     | Foreground            | Background | Ratio     | Ratio when hovered (measured) |
| ------------------------- | --------------------- | ---------- | --------- | ----------------------------- |
| contained primary label   | `rgba(0, 0, 0, 0.87)` | `#54A6FF`  | 7.21 yes  | 8.52 yes                      |
| contained secondary label | `rgba(0, 0, 0, 0.87)` | `#9A98FF`  | 7.22 yes  | 8.63 yes                      |
| contained error label     | `rgba(0, 0, 0, 0.87)` | `#FF7A73`  | 7.23 yes  | 8.46 yes                      |
| contained warning label   | `rgba(0, 0, 0, 0.87)` | `#FFB340`  | 9.86 yes  | 10.86 yes                     |
| contained info label      | `rgba(0, 0, 0, 0.87)` | `#70D7FF`  | 10.65 yes | 11.53 yes                     |
| contained success label   | `rgba(0, 0, 0, 0.87)` | `#30DB5B`  | 9.64 yes  | 10.47 yes                     |

Hovered label contrast, all 18 variant (contained, outlined, text) and colour combinations: minimum 6.63:1.

### Non-text (SC 1.4.11, 3:1)

| Token or state                                                     | Colour                | vs paper  | vs default | vs dialog |
| ------------------------------------------------------------------ | --------------------- | --------- | ---------- | --------- |
| Form border, switch track, unchecked icon (`gray.medium3`)         | `#8E8E93`             | 5.75 yes  | 5.22 yes   | 3.54 yes  |
| primary.main as border, icon or indicator                          | `#54A6FF`             | 7.38 yes  | 6.7 yes    | 4.55 yes  |
| secondary.main as border, icon or indicator                        | `#9A98FF`             | 7.41 yes  | 6.73 yes   | 4.57 yes  |
| error.main as border, icon or indicator                            | `#FF7A73`             | 7.39 yes  | 6.71 yes   | 4.56 yes  |
| warning.main as border, icon or indicator                          | `#FFB340`             | 10.5 yes  | 9.54 yes   | 6.48 yes  |
| info.main as border, icon or indicator                             | `#70D7FF`             | 11.47 yes | 10.41 yes  | 7.07 yes  |
| success.main as border, icon or indicator                          | `#30DB5B`             | 10.18 yes | 9.24 yes   | 6.27 yes  |
| Focus ring (white outline over black ring; the better band counts) | `#FFFFFF` / `#000000` | 18.73 yes | 17.01 yes  | 11.55 yes |

## Measured component states

Measured from the rendered MUI components (computed styles, alpha composited, gradients and elevation overlays included). Each value is the worst case over the paper, default and dialog surfaces.

### Light

| State                                      | Foreground                | Worst ratio | Pass 3:1 |
| ------------------------------------------ | ------------------------- | ----------- | -------- |
| Outlined input border vs surface           | `rgb(142, 142, 147)`      | 3.12        | yes      |
| Outlined input border vs field fill        | `rgb(142, 142, 147)`      | 3.26        | yes      |
| Filled input underline                     | `rgb(142, 142, 147)`      | 3.26        | yes      |
| Checkbox unchecked                         | `rgba(0, 0, 0, 0.6)`      | 5.67        | yes      |
| Checkbox checked                           | `rgb(0, 104, 218)`        | 5.04        | yes      |
| Radio unchecked                            | `rgba(0, 0, 0, 0.6)`      | 5.67        | yes      |
| Switch track (off) vs surface              | `rgb(142, 142, 147) op 1` | 3.12        | yes      |
| Switch thumb (off) vs track                | `rgb(255, 255, 255)`      | 3.26        | yes      |
| Switch track (on) vs surface               | `rgb(0, 104, 218) op 1`   | 5.04        | yes      |
| Contained button text primary              | `rgb(255, 255, 255)`      | 5.26        | yes      |
| Contained button fill primary vs surface   | `rgb(0, 104, 218)`        | 5.04        | yes      |
| Contained button text secondary            | `rgb(255, 255, 255)`      | 6.04        | yes      |
| Contained button fill secondary vs surface | `rgb(137, 68, 171)`       | 5.78        | yes      |
| Contained button text error                | `rgb(255, 255, 255)`      | 5.09        | yes      |
| Contained button fill error vs surface     | `rgb(209, 46, 37)`        | 4.87        | yes      |
| Contained button text warning              | `rgb(255, 255, 255)`      | 5.01        | yes      |
| Contained button fill warning vs surface   | `rgb(163, 95, 0)`         | 4.8         | yes      |
| Contained button text info                 | `rgb(255, 255, 255)`      | 5.04        | yes      |
| Contained button fill info vs surface      | `rgb(53, 118, 148)`       | 4.82        | yes      |
| Contained button text success              | `rgb(255, 255, 255)`      | 5.05        | yes      |
| Contained button fill success vs surface   | `rgb(33, 127, 57)`        | 4.84        | yes      |
| Outlined button border primary             | `rgb(0, 104, 218)`        | 5.04        | yes      |
| Outlined button border secondary           | `rgb(137, 68, 171)`       | 5.78        | yes      |
| Outlined button border error               | `rgb(209, 46, 37)`        | 4.87        | yes      |
| Outlined button border warning             | `rgb(163, 95, 0)`         | 4.8         | yes      |
| Outlined button border info                | `rgb(53, 118, 148)`       | 4.82        | yes      |
| Outlined button border success             | `rgb(33, 127, 57)`        | 4.84        | yes      |
| Outlined chip border (outlined primary)    | `rgb(0, 104, 218)`        | 5.04        | yes      |
| Outlined chip border (outlined secondary)  | `rgb(137, 68, 171)`       | 5.78        | yes      |
| Outlined chip border (outlined error)      | `rgb(209, 46, 37)`        | 4.87        | yes      |
| Outlined chip border (outlined warning)    | `rgb(163, 95, 0)`         | 4.8         | yes      |
| Outlined chip border (outlined info)       | `rgb(53, 118, 148)`       | 4.82        | yes      |
| Outlined chip border (outlined success)    | `rgb(33, 127, 57)`        | 4.84        | yes      |
| Outlined chip border (default outlined)    | `rgb(142, 142, 147)`      | 3.12        | yes      |
| Tab indicator                              | `rgb(0, 104, 218)`        | 5.04        | yes      |
| Outlined alert border ()                   | `rgb(93, 145, 169)`       | 3.3         | yes      |
| State icon: New                            | `rgb(53, 118, 148)`       | 4.82        | yes      |
| State icon: Modified                       | `rgb(168, 135, 0)`        | 3.28        | yes      |
| State icon: Deleted                        | `rgb(255, 59, 48)`        | 3.4         | yes      |
| State icon: Locked                         | `rgb(163, 95, 0)`         | 4.8         | yes      |
| State icon: System Processing              | `rgb(88, 86, 214)`        | 5.41        | yes      |
| State icon: Submitted                      | `rgb(175, 82, 222)`       | 3.96        | yes      |
| State icon: Scheduled                      | `rgb(33, 127, 57)`        | 4.84        | yes      |
| State icon: Publishing                     | `rgb(88, 86, 214)`        | 5.41        | yes      |
| State icon: Scheduled to staging           | `rgb(0, 104, 218)`        | 5.04        | yes      |
| State icon: Scheduled to live              | `rgb(33, 127, 57)`        | 4.84        | yes      |

### Dark

| State                                      | Foreground                 | Worst ratio | Pass 3:1 |
| ------------------------------------------ | -------------------------- | ----------- | -------- |
| Outlined input border vs surface           | `rgb(142, 142, 147)`       | 3.54        | yes      |
| Outlined input border vs field fill        | `rgb(142, 142, 147)`       | 5.75        | yes      |
| Filled input underline                     | `rgba(255, 255, 255, 0.7)` | 9.43        | yes      |
| Checkbox unchecked                         | `rgba(255, 255, 255, 0.7)` | 6.59        | yes      |
| Checkbox checked                           | `rgb(84, 166, 255)`        | 4.54        | yes      |
| Radio unchecked                            | `rgba(255, 255, 255, 0.7)` | 6.59        | yes      |
| Switch track (off) vs surface              | `rgb(142, 142, 147) op 1`  | 3.54        | yes      |
| Switch thumb (off) vs track                | `rgb(255, 255, 255)`       | 3.26        | yes      |
| Switch track (on) vs surface               | `rgb(84, 166, 255) op 1`   | 4.54        | yes      |
| Contained button text primary              | `rgba(0, 0, 0, 0.87)`      | 7.21        | yes      |
| Contained button fill primary vs surface   | `rgb(84, 166, 255)`        | 4.54        | yes      |
| Contained button text secondary            | `rgba(0, 0, 0, 0.87)`      | 7.22        | yes      |
| Contained button fill secondary vs surface | `rgb(154, 152, 255)`       | 4.56        | yes      |
| Contained button text error                | `rgba(0, 0, 0, 0.87)`      | 7.23        | yes      |
| Contained button fill error vs surface     | `rgb(255, 122, 115)`       | 4.55        | yes      |
| Contained button text warning              | `rgba(0, 0, 0, 0.87)`      | 9.86        | yes      |
| Contained button fill warning vs surface   | `rgb(255, 179, 64)`        | 6.46        | yes      |
| Contained button text info                 | `rgba(0, 0, 0, 0.87)`      | 10.65       | yes      |
| Contained button fill info vs surface      | `rgb(112, 215, 255)`       | 7.06        | yes      |
| Contained button text success              | `rgba(0, 0, 0, 0.87)`      | 9.64        | yes      |
| Contained button fill success vs surface   | `rgb(48, 219, 91)`         | 6.26        | yes      |
| Outlined button border primary             | `rgb(84, 166, 255)`        | 4.54        | yes      |
| Outlined button border secondary           | `rgb(154, 152, 255)`       | 4.56        | yes      |
| Outlined button border error               | `rgb(255, 122, 115)`       | 4.55        | yes      |
| Outlined button border warning             | `rgb(255, 179, 64)`        | 6.46        | yes      |
| Outlined button border info                | `rgb(112, 215, 255)`       | 7.06        | yes      |
| Outlined button border success             | `rgb(48, 219, 91)`         | 6.26        | yes      |
| Outlined chip border (outlined primary)    | `rgb(84, 166, 255)`        | 4.54        | yes      |
| Outlined chip border (outlined secondary)  | `rgb(154, 152, 255)`       | 4.56        | yes      |
| Outlined chip border (outlined error)      | `rgb(255, 122, 115)`       | 4.55        | yes      |
| Outlined chip border (outlined warning)    | `rgb(255, 179, 64)`        | 6.46        | yes      |
| Outlined chip border (outlined info)       | `rgb(112, 215, 255)`       | 7.06        | yes      |
| Outlined chip border (outlined success)    | `rgb(48, 219, 91)`         | 6.26        | yes      |
| Outlined chip border (default outlined)    | `rgb(142, 142, 147)`       | 3.54        | yes      |
| Tab indicator                              | `rgb(84, 166, 255)`        | 4.54        | yes      |
| Outlined alert border ()                   | `rgb(255, 148, 143)`       | 5.43        | yes      |
| State icon: New                            | `rgb(112, 215, 255)`       | 7.06        | yes      |
| State icon: Modified                       | `rgb(255, 212, 38)`        | 8.07        | yes      |
| State icon: Deleted                        | `rgb(255, 59, 48)`         | 3.25        | yes      |
| State icon: Locked                         | `rgb(255, 179, 64)`        | 6.46        | yes      |
| State icon: System Processing              | `rgb(154, 152, 255)`       | 4.56        | yes      |
| State icon: Submitted                      | `rgb(218, 143, 255)`       | 5.14        | yes      |
| State icon: Scheduled                      | `rgb(48, 219, 91)`         | 6.26        | yes      |
| State icon: Publishing                     | `rgb(154, 152, 255)`       | 4.56        | yes      |
| State icon: Scheduled to staging           | `rgb(84, 166, 255)`        | 4.54        | yes      |
| State icon: Scheduled to live              | `rgb(48, 219, 91)`         | 6.26        | yes      |

## Guest overlay chips (experience builder)

Zone marker label chips use `#121212` text on the `.light` variant of the guest theme colour, in both modes.

| Mode  | State              | Foreground | Background | Ratio | Pass |
| ----- | ------------------ | ---------- | ---------- | ----- | ---- |
| light | primary.light chip | `#121212`  | `#3386E1`  | 5.03  | yes  |
| light | success.light chip | `#121212`  | `#4D9860`  | 5.33  | yes  |
| light | error.light chip   | `#121212`  | `#DA5750`  | 4.87  | yes  |
| light | warning.light chip | `#121212`  | `#B57F33`  | 5.4   | yes  |
| dark  | primary.light chip | `#121212`  | `#76B7FF`  | 8.91  | yes  |
| dark  | success.light chip | `#121212`  | `#59E27B`  | 11.23 | yes  |
| dark  | error.light chip   | `#121212`  | `#FF948F`  | 8.82  | yes  |
| dark  | warning.light chip | `#121212`  | `#FFC266`  | 11.74 | yes  |

## `error.main` evaluation

Candidates for light-mode `error.main` used as text (4.5:1) on the light surfaces and on a `#F3F3F3` light-grey panel. `#D93229` fails on the grey panel and is only 0.03 above the limit on `#FAFAFA`, so `#D12E25` is used. Dark mode keeps `red.tint`.

| Light candidate    | on #FFFFFF  | on #FAFAFA | on #F3F3F3  |
| ------------------ | ----------- | ---------- | ----------- |
| #FF3B30 (previous) | 3.55 **no** | 3.4 **no** | 3.2 **no**  |
| #D93229            | 4.73 yes    | 4.53 yes   | 4.26 **no** |
| #D12E25 (chosen)   | 5.09 yes    | 4.87 yes   | 4.58 yes    |

| Dark token           | on paper | on default | on dialog |
| -------------------- | -------- | ---------- | --------- |
| #FF7A73 (`red.tint`) | 7.39 yes | 6.71 yes   | 4.56 yes  |

## Not a pass, and why

- Selected list items, menu items and tree-like rows also get a tinted background. The tint alone is 1.1:1 to 1.3:1 and is not relied on. A 3px bar in the text colour marks the selected item (text colour on surface is at least 11:1).
- MUI `Alert` with `variant="filled"` in dark mode (black text on the darkened fill, 3.95:1 on the error colour). The app does not use filled alerts.
- Disabled controls, divider lines and the 1px decorative borders of cards are exempt.
- Text drawn over photographs or arbitrary images (for example the login page background) cannot be measured from the theme.
- Surfaces outside the theme (TinyMCE and Ace editor chrome, legacy `.scss` views) were adjusted for the specific values listed in the pull request. They are not part of these tables.
