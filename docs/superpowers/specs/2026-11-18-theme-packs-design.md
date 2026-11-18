# Theme packs: selectable colour themes converted from Prism

Date: 2026-11-18. Branch: `feat/theme-packs`. Builds on
`2026-11-17-dark-mode-themes-design.md` (variable set, `data-theme`).

## Intent

pgweb gets a menu of colour themes. The themes are converted from the Prism
syntax-highlighting themes collected in
<https://github.com/mfeilen/macdown3000-themes> (`prism/`, 37 files, MIT),
the same source that repo converts for MacDown. The owner decided: all 37
themes, and the header bar takes its colour from each theme's palette.

## Goals

- A generated stylesheet with one variable block per theme, produced by a
  converter script kept in this repo, re-runnable when the source changes.
- A theme menu in the UI replacing the three-state toggle: Auto, Light, Dark,
  then the packs grouped into dark and light. The choice is stored per
  browser; `--theme <id>` / `PGWEB_THEME=<id>` set the server default.
- Every theme covers the whole UI (page and editor) through the existing
  variables; nothing else in app.css changes.
- A generated `docs/themes.md` listing every theme with id, group and source.

## Non-goals

- Editing themes by hand. Hand changes go into the converter's override
  table, like the source repo does.
- Per-theme Ace token rules beyond the existing `--editor-*` set.
- Shipping the Prism CSS files themselves; only the generated variables.

## Constraints

- Converter: Node, no dependencies, `script/themes/convert.mjs`, input is a
  path to a checkout of macdown3000-themes (its `prism/` directory). Generated
  files are committed; the build needs no Node.
- No literal colours in app.css (unchanged rule). Generated CSS lives in
  `static/css/theme-packs.css` only.
- Theme ids: lowercase, `[a-z0-9-]`, derived from the display names of the
  source repo (`One Dark` -> `one-dark`, `VS Code Dark Plus` ->
  `vs-code-dark-plus`, `Synthwave 84` -> `synthwave-84`). `auto`, `light`,
  `dark` stay reserved for the built-ins.

## Design

### Converter (`script/themes/convert.mjs`)

For each `prism/prism-*.css` (skipping `*.min.css`):

1. Strip comments and at-rules, parse rules into (selectors, declarations),
   last declaration wins (CSS order).
2. Base: foreground from `code[class*="language-"]` / `pre[class*="language-"]`
   `color`; background from their `background` / `background-image` (first
   colour of a gradient); without a background use near-black or white by
   foreground luminance. Alpha colours are composited over the background.
3. Group: `dark` when the background luminance is below 0.5, else `light`
   (this reproduces the source repo's `color-scheme` split: 28 dark, 9 light).
4. Tokens: colour of `.token.<name>` for keyword, operator, punctuation,
   number, boolean, constant, function, property, class-name, builtin,
   attr-name, string, variable, tag, comment, inserted, deleted, important;
   `::selection` background and colour.
5. Variables, `mix(a, b, t)` = linear RGB mix toward `b` by `t`:

   | Variable | Value |
   |---|---|
   | `--bg`, `--editor-bg` | background |
   | `--fg` | foreground mixed 15% toward white (dark) or black (light) |
   | `--fg-text`, `--editor-fg` | foreground |
   | `--fg-dim` | mix(fg, bg, 0.3) |
   | `--fg-muted` | comment colour, else mix(fg, bg, 0.45) |
   | `--fg-faint` | mix(fg, bg, 0.6) |
   | `--bg-panel` | mix(bg, fg, 0.03) |
   | `--bg-form` | mix(bg, fg, 0.05) |
   | `--bg-hover` | mix(bg, fg, 0.07) |
   | `--bg-active` | mix(bg, fg, 0.13) |
   | `--bg-sorted` | mix(bg, function colour, 0.15) |
   | `--border` | mix(bg, fg, 0.12) |
   | `--border-mid` | mix(bg, fg, 0.22) |
   | `--border-strong` | mix(bg, fg, 0.35) |
   | `--brand` | keyword colour, dark themes: mix toward bg 0.35; light themes: mix toward black 0.25 |
   | `--brand-fg` | `#fff` |
   | `--brand-fg-muted` | mix(#fff, brand, 0.3) |
   | `--brand-hover` | `rgba(255, 255, 255, 0.15)` |
   | `--accent` | function colour, else keyword (same as `--editor-function`) |
   | `--accent-fg` | `#fff` |
   | `--success` | inserted, else string |
   | `--success-hover` | mix(success, fg, 0.2) |
   | `--danger` | deleted, else important, else `#be2740` |
   | `--highlight` | mix(bg, string, 0.12) |
   | `--selection` | mix(bg, accent, 0.4) |
   | `--shadow` | dark: `#000`; light: mix(bg, fg, 0.3) |
   | `--overlay` | dark: `rgba(0,0,0,0.6)`; light: `rgba(0,0,0,0.3)` |
   | `--editor-active-line`, `--editor-gutter-active-line` | mix(bg, fg, 0.06) |
   | `--editor-selection` | `::selection` background, else mix(bg, fg, 0.2) |
   | `--editor-cursor` | keyword, else fg |
   | `--editor-bracket` | mix(bg, fg, 0.3) |
   | `--editor-keyword` | keyword, else fg |
   | `--editor-operator` | operator, else punctuation, else keyword |
   | `--editor-constant` | number, else boolean, else constant, else keyword |
   | `--editor-function` | function, else property, else keyword |
   | `--editor-type` | class-name, else builtin, else attr-name, else function |
   | `--editor-string` | string, else fg |
   | `--editor-variable` | variable, else tag, else attr-name, else keyword |
   | `--editor-comment` | comment, else fg-muted |
   | `--editor-gutter-bg`, `--editor-gutter-fg` | `var(--bg)`, `var(--fg-faint)` |

   Every token fallback chain ends in a value, so a block never has a
   missing variable. An `OVERRIDES` map keyed by theme id allows hand fixes.

   Legibility floors (added after review; `ensureContrast` mixes a colour
   toward black or toward the text direction in 8 % steps until the floor
   holds): `--fg-text` and `--fg` at least 4.5:1 on `--bg`, `--fg-dim` 3.5:1,
   `--fg-muted` 3:1, `--success` 3:1 on `--bg`; `--brand` and `--selection`
   at least 4.5:1 under white text, `--danger` 3:1; `--brand-fg-muted` 3:1 on
   `--brand`. `--danger` takes the theme's `deleted` colour only when it is
   red (hue within 25 degrees of 0) and legible, `--success` the `inserted`
   or `string` colour only when green (hue 60 to 180), else pgweb's own
   `#be2740` / `#7eb54e` adjusted to the pack. `--accent` falls back to the
   keyword colour, `--editor-function` too (not to the foreground).
   `script/themes/packs.test.mjs` asserts these floors on the committed
   output and that the three generated id lists agree; a Go test does the
   same for `themePackIDs` against `theme-packs.js`.

6. Outputs, all generated with a "do not edit" header naming the source
   file and the converter:
   - `static/css/theme-packs.css`: `:root[data-theme="<id>"] { color-scheme: ...; ... }` per theme.
   - `static/js/theme-packs.js`: `var themePacks = [{ id, name, dark }]`,
     dark group first, each group alphabetical by name.
   - `pkg/command/theme_packs.go`: `var themePackIDs = []string{...}`.
   - `docs/themes.md`: table (name, id, group, source file, credits copied
     from the source file's header comment) plus the prism-themes MIT licence
     text; each CSS block comment repeats the credits.

### Server

`validTheme` accepts `auto`, `light`, `dark` and every id in
`themePackIDs`. Error messages name the docs file. `/api/info` keeps
`features.theme`.

### Frontend

- `index.html` loads `theme-packs.css` after `themes.css` and
  `theme-packs.js` before `app.js`. Both `.theme-toggle` anchors become
  Bootstrap dropdown toggles with an empty `<ul class="dropdown-menu
  theme-menu">`; `app.js` fills both menus from `themePacks` on ready:
  Auto, Light, Dark, divider, header "Dark themes", items, divider,
  header "Light themes", items. The active choice carries a check icon.
- `themeChoices` becomes the built-ins plus pack ids. `resolveTheme(choice)`
  returns the choice itself for a pack (its CSS block applies), `applyTheme`
  sets `data-theme` and `data-theme-choice` as today. The button icon:
  `fa-adjust` auto, `fa-sun-o` light, `fa-moon-o` dark, `fa-paint-brush`
  for a pack; the title names the theme.
- The head script keeps its logic: a stored pack id is applied directly.
- `storedTheme()` accepts any id present in `themePacks` or a built-in; an
  unknown stored id falls back to the server default.

### Verification

- `node --test script/themes/convert.test.mjs`: colour parsing (hex, rgb,
  hsl, alpha over bg), mix, group classification, and a full conversion of
  one fixture file producing every variable.
- Go: `--theme dracula` accepted, `--theme blue` rejected with the docs hint;
  `themePackIDs` non-empty and all lowercase.
- Browser: screenshots of the Rows and Query views for every theme in both
  groups (loop over `themePacks` in the screenshot script); every image
  read for legibility of header, sidebar, grid, editor, autocomplete.
- No literal colour in app.css; invisible-character check on all outputs.
