# Dark mode and colour themes for the pgweb UI

Date: 2026-11-17. Branch: `security-update-2026-11`.

## Intent

pgweb gets a dark appearance. The operator can make it the default with the
environment variable `PGWEB_DARK_MODE=true` (or the flag `--dark-mode`), and
every user can switch between light and dark in the browser.

The owner of this fork wants to add further colour themes afterwards,
converted from the Prism palettes in
<https://github.com/mfeilen/macdown3000-themes>. Dark mode is therefore built
as the first additional *theme* of a small theme system, not as a one-off
override stylesheet.

## Goals

- A dark theme that covers the whole UI: tab bar, sidebar, tables, query
  editor, result grid, dropdowns, context menus, modals, buttons, inputs.
- `PGWEB_DARK_MODE=true|false` and `--dark-mode` set the server default.
- A toggle in the UI. The browser remembers the user's choice.
- Adding a theme later means adding one block of CSS custom properties, with
  no change to markup or JavaScript.
- The light theme looks exactly as pgweb looks today.

## Non-goals

- Following the operating system setting (`prefers-color-scheme`). Can be
  added later as a third value `auto`.
- A theme picker for more than two themes. The toggle switches light/dark
  only; a picker comes with the themes.
- Shipping any of the Prism-derived themes in this change.

## Anti-goals

- A `filter: invert()` hack, or a second copy of `app.css`.
- Touching Bootstrap's own stylesheet (`static/css/bootstrap.css`, v3.2.0,
  minified). Bootstrap stays as is; pgweb overrides what it uses.

## Constraints

- Frontend is plain jQuery + Bootstrap 3 + Ace 1.4.6, no build step, files are
  embedded into the Go binary from `static/`. No new third-party files.
- No JavaScript test setup exists in the repo. Go tests cover the server side.
- CSS custom properties are supported by every browser pgweb targets
  (Bootstrap 3 era browsers aside, which Ace 1.4.6 no longer supports either).

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| A | Separate `dark.css` that overrides colours under `body.dark-mode` | Small diff, nothing refactored. Every further theme would be another full override file; palette changes need edits in many selectors. |
| **B** | **Refactor `app.css` to CSS custom properties; a theme is one block of variable values** | Touches ~90 colour declarations once. Afterwards a theme is ~25 lines. Chosen because more themes are planned. |
| C | Follow the operating system setting only | No operator default, no user choice. Rejected; may return as `auto`. |

## Design

### 1. Theme model

- The active theme is the attribute `data-theme` on `<html>`: `light` or
  `dark`. Default (attribute missing) renders `light`.
- `static/css/themes.css` (new) defines one block per theme:

  ```css
  :root, :root[data-theme="light"] { --bg: #fff; ... }
  :root[data-theme="dark"]          { --bg: #1d1f21; ... }
  ```

- Variables are semantic, not per element. Palette for the page:

  | Variable | Light (today's value) | Used for |
  |---|---|---|
  | `--bg` | `#fff` | page, result grid, editor surround |
  | `--bg-panel` | `#f1f1f1` / `#f9f9f9` | sidebar, table headers, toolbars |
  | `--bg-hover` | `#f8f8f8` | hovered rows, menu items |
  | `--bg-active` | `#eee` / `#ddd` | selected object, pressed buttons |
  | `--fg` | `#000` / `#333` | text |
  | `--fg-muted` | `#999` / `#aaa` | hints, counts, placeholders |
  | `--border` | `#eee` / `#ddd` | borders, separators |
  | `--brand` | `#79589f` | header bar (`#nav`), current-database box, Connect/Disconnect buttons |
  | `--brand-fg` | `#fff` | selected tab text, button text on the header |
  | `--brand-fg-muted` | `#d6cce2` | unselected tab text on the header |
  | `--accent` | `#79589f` | links, focus rings, primary actions outside the header |
  | `--accent-fg` | `#fff` | text on accent |
  | `--success` | `#7eb54e` | connect button, ok states |
  | `--danger` | `#be2740` | error banner, destructive actions |
  | `--highlight` | `#ffe` / `#f3faff` | row highlight, search hit |
  | `--selection` | `#3874d7` | selected cell |
  | `--shadow` | `#ddd` | box shadows |

  The existing `app.css` colours that are near-duplicates (`#f9f9f9`,
  `#fafafa`, `#f8f8f8`, `#f6f6f6`, `#f5f5f5`) collapse onto these variables.
  The builder picks the mapping so the light rendering stays visually
  unchanged (differences of one or two shades on hover surfaces are fine).

- Editor palette, same file, same blocks. Light values are Ace's
  "Tomorrow", dark values are "Tomorrow Night":

  `--editor-bg`, `--editor-fg`, `--editor-gutter-bg`, `--editor-gutter-fg`,
  `--editor-active-line`, `--editor-selection`, `--editor-cursor`,
  `--editor-keyword`, `--editor-string`, `--editor-number`,
  `--editor-comment`, `--editor-function`, `--editor-constant`,
  `--editor-operator`, `--editor-bracket`.

  A later Prism-derived theme maps naturally onto this set: Prism tokens
  `keyword`, `string`, `number`, `comment`, `function`, `constant`,
  `operator`, `punctuation` are the same vocabulary.

### 2. `app.css`

Every literal colour becomes `var(--...)`. No selector changes, no layout
changes. Bootstrap components pgweb uses get colour overrides at the end of
`app.css` (tables, `.dropdown-menu`, `.btn-default`, `.form-control`,
`.modal-content`, `.well`, `.nav-tabs`, typeahead menu, context menu), all
through the same variables.

### 3. Ace editor

A new theme `static/js/theme-pgweb.js` registers `ace/theme/pgweb`. Its
`cssText` uses the `--editor-*` variables, so the editor follows the page
theme with no JavaScript when the theme changes. It is written by hand from
Ace's `theme-tomorrow.js` structure (same selectors), no file is downloaded.
`app.js` calls `editor.setTheme("ace/theme/pgweb")` instead of
`"ace/theme/tomorrow"`. `theme-tomorrow.js` is removed from `index.html`
and from the repo, since nothing uses it any more.

### 4. Server side

- `pkg/command/options.go`: new option
  `DarkMode bool \`long:"dark-mode" description:"Enable dark mode by default"\``.
- Environment: `PGWEB_DARK_MODE`. Accepted values are what Go's
  `strconv.ParseBool` accepts (`true`, `false`, `1`, `0`, ...). An
  unparsable value is a startup error, like other invalid options. The flag
  wins over the variable when both are set. Added to `AvailableEnvVars()`.
- `GetInfo` in `pkg/api/api.go` adds `"dark_mode": command.Opts.DarkMode`
  to `features`.
- README: `--dark-mode` in the options list, `PGWEB_DARK_MODE` in the
  environment variables section.

### 5. Frontend behaviour

Precedence, highest first:

1. The user's choice in this browser: `localStorage["pgweb_theme"]`
   (`light` or `dark`).
2. The server default from `/api/info` `features.dark_mode`.
3. `light`.

- `index.html` gets a tiny inline script in `<head>`, before the
  stylesheets, that reads `localStorage["pgweb_theme"]` and sets
  `data-theme` on `<html>`. This avoids a light flash for users who chose
  dark. On a first visit with `PGWEB_DARK_MODE=true` the page may render
  light for the moment until `/api/info` answers; accepted.
- `app.js`: after `/api/info` is loaded, if no local choice exists, apply the
  server default. Function `applyTheme(name)` sets the attribute and updates
  the toggle icon. The toggle writes the choice to `localStorage` and applies
  it.
- Toggle: a button at the right end of the tab bar (`#nav`), next to the
  Connect/Disconnect buttons, plus one in the top-right corner of the
  connection window (see Decisions). Font Awesome icon `fa-moon-o` in light
  mode and `fa-sun-o` in dark mode, with a `title` tooltip. Sketch:

  ```
  [Rows] [Structure] [Indexes] [Constraints] [Query] [History] [Activity] [Connection]   [Connect] [Disconnect] [☾]
  ```

### 6. Tests and verification

- Go: `TestParseOptions` cases for `--dark-mode`, `PGWEB_DARK_MODE=true`,
  `PGWEB_DARK_MODE=false`, `PGWEB_DARK_MODE=garbage` (error). `GetInfo` test
  asserts `features.dark_mode`.
- Frontend: no test framework exists; verification is by screenshots of the
  running app in both themes (headless Chromium) on the Query, Rows,
  Structure and Connection views, plus one open dropdown and one modal.
- `app.css` must contain no literal colour after the refactor
  (`grep -E '#[0-9a-f]{3,6}|rgba?\(' static/css/app.css` is empty apart from
  `themes.css`).

### 7. Changelog

`NEW` Dark mode with `--dark-mode` / `PGWEB_DARK_MODE` and an in-app toggle;
UI colours moved to CSS custom properties as the base for further themes.

## Decisions from the builder check

- **Header bar stays purple.** The purple header is pgweb's identity, not a
  surface colour. It is its own variable group (`--brand`, `--brand-fg`,
  `--brand-fg-muted`). The light theme keeps today's `#79589f`; the dark
  theme uses a darker purple (around `#4a3862`) so the header still reads
  as pgweb. A future Prism-derived theme may fill `--brand` from its own
  palette (keyword or heading colour) or keep the purple; the converter
  decides, not this change.
- **Toggle before a connection exists.** `#main` (and with it `#nav`) is
  hidden until a connection is established, and the connection window is a
  full-screen overlay. So there are two toggle buttons: one at the right
  end of `#nav`, one in the top-right corner of `#connection_window`. Both
  carry the class `theme-toggle`, one handler serves both, and
  `applyTheme` updates the icon on both.
- **Ace `isDark`.** Ace sets the `ace_dark` class from the theme's static
  `isDark` flag; it cannot follow a variable. The few `.ace_dark` rules
  (fold widgets, gutter icons, scroller) are overridden in `app.css`
  through the `--editor-*` variables instead. The statement "no JavaScript
  when the theme changes" holds for the editor with that override.
- **Branch.** The user chose one collective branch for all of this work;
  the feature and this document stay on `security-update-2026-11`.

## Left to the builder

- Exact dark palette values (start from Tomorrow Night for the editor and a
  neutral dark grey set for the page; keep contrast of text on `--bg` at
  least 7:1 and of muted text at least 4.5:1).
- Which of the near-duplicate light greys map to which variable.
- Where exactly in `#nav` the toggle button sits and its CSS.
- Name and structure of the Go test cases.
