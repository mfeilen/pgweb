# Theme Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 37 selectable colour themes converted from the Prism themes in mfeilen/macdown3000-themes, with a theme menu in the UI and `--theme <id>` on the server.

**Architecture:** A dependency-free Node converter turns each Prism CSS file into one `:root[data-theme="<id>"]` variable block (page palette derived from foreground/background, editor palette from tokens). Generated CSS, a JS theme list and a Go id list are committed. The frontend swaps the three-state toggle for a dropdown fed by the generated list.

**Tech Stack:** Node 26 (`node --test`), Go 1.27, jQuery/Bootstrap 3 dropdowns, headless Chromium for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-18-theme-packs-design.md`

## Global Constraints

- Theme ids `[a-z0-9-]+`, built-ins `auto|light|dark` reserved.
- Generated files carry a "generated, do not edit" header; no literal colour enters `static/css/app.css`.
- Converter input: `<checkout>/prism` of macdown3000-themes; a scratch checkout exists at `/private/tmp/claude-501/-Users-fc-dev-fc-pgweb/e1c9212c-64b0-405b-858f-6f730a46a50b/scratchpad/themes-src/macdown3000-themes`.
- Invisible-character check on every written file; no pushes without asking.

## Review Focus

1. A Prism theme without a `background` or with a gradient background must still convert (synthwave84, coy) — fixture test in Task 1.
2. A stored theme id that no longer exists (theme removed later) must fall back to the server default, not break the page — Task 3 browser check with `pgweb_theme=gone`.
3. `--theme` must reject unknown ids with a hint to `docs/themes.md` — Task 2 test.
4. Both menus (tab bar and connection window) must show the same checked item after a choice — Task 3 screenshot of the connection window after choosing a pack.
5. Light packs must get a header bar that is dark enough for white text — converter clamps `--brand` luminance below 0.4 — Task 1 test.

---

### Task 1: Converter with tests and generated outputs

**Files:**
- Create: `script/themes/convert.mjs`, `script/themes/convert.test.mjs`, `script/themes/fixtures/prism-fixture.css`
- Generate: `static/css/theme-packs.css`, `static/js/theme-packs.js`, `pkg/command/theme_packs.go`, `docs/themes.md`

**Interfaces:**
- Produces: `window.themePacks` (`[{id, name, dark}]`), `command.themePackIDs []string`, CSS blocks keyed by `data-theme="<id>"`.

- [ ] Step 1: Write `convert.test.mjs` (RED): `parseColor` for `#abc`, `#aabbcc`, `rgb(1,2,3)`, `rgba(0,0,0,.5)` over white = `#808080`, `hsl(120,100%,25%)`; `mix("#000","#fff",0.5)` = `#808080`; `isDark("#1d1f21")` true, `isDark("#fdf6e3")` false; `convertTheme(fixtureCss, "fixture")` returns every variable in the spec table, group dark, `--brand` luminance < 0.4; `slug("VS Code Dark Plus")` = `vs-code-dark-plus`.
- [ ] Step 2: Run `node --test script/themes/` → FAIL (module missing).
- [ ] Step 3: Implement `convert.mjs` exporting `parseColor`, `mix`, `isDark`, `slug`, `convertTheme`, `main`; `main(argv)` writes the four outputs; NAMES table copied from the source repo's convert.js.
- [ ] Step 4: `node --test script/themes/` → PASS. Run `node script/themes/convert.mjs <checkout>/prism` → 37 themes, outputs written; `grep -c 'data-theme=' static/css/theme-packs.css` = 37.
- [ ] Step 5: Commit `Add Prism theme converter and generated theme packs`.

### Task 2: Server accepts pack ids

**Files:** Modify `pkg/command/options.go` (`validTheme`), `pkg/command/options_test.go`.

- [ ] Step 1: Tests (RED): `--theme dracula` ok; `--theme blue` error `invalid theme "blue": expected auto, light, dark or an id from docs/themes.md`; `PGWEB_THEME=one-dark` ok; `TestThemePackIDs`: non-empty, all match `^[a-z0-9-]+$`, none equals a built-in.
- [ ] Step 2: `PGPASSFILE=/nonexistent go test ./pkg/command/` → FAIL.
- [ ] Step 3: Implement; update both error messages (flag and env).
- [ ] Step 4: Tests PASS; `go vet ./...`.
- [ ] Step 5: Commit `Accept theme pack ids in --theme and PGWEB_THEME`.

### Task 3: Theme menu in the UI

**Files:** Modify `static/index.html`, `static/js/app.js`, `static/css/app.css` (menu placement only, variables), `README.md`, `CHANGELOG.md`.

- [ ] Step 1: RED: extend `shoot.mjs` with mode `packs`: for each id in `themePacks` set `localStorage.pgweb_theme`, reload, record `data-theme`, body background, toggle icon class, checked menu item; expect failure (no `themePacks`, no menu).
- [ ] Step 2: Markup: both toggles become `<div class="btn-group theme-switcher"><a class="theme-toggle dropdown-toggle" data-toggle="dropdown">…</a><ul class="dropdown-menu theme-menu"></ul></div>`; load `theme-packs.css` and `theme-packs.js`.
- [ ] Step 3: `app.js`: `themeChoices` = built-ins + ids; `buildThemeMenus()` fills both `.theme-menu`; `applyTheme` marks the active item and sets the icon (`fa-paint-brush` for packs); click handler on `.theme-menu a[data-theme]` calls `chooseTheme(id)`; remove the cycle behaviour.
- [ ] Step 4: CSS: `.theme-switcher` positioned where `.theme-toggle` was; menu right-aligned, max-height with scroll; `.theme-menu .dropdown-header` uses `--fg-muted`.
- [ ] Step 5: GREEN: `shoot.mjs packs` reports 37 distinct backgrounds, icon `fa-paint-brush`, checked item = id; plus `pgweb_theme=gone` → server default; connection-window screenshot with a pack chosen shows the check mark.
- [ ] Step 6: Read screenshots of Rows and Query for at least 6 dark and all 9 light packs; fix derivation ratios in the converter if something is unreadable, regenerate, re-shoot.
- [ ] Step 7: README theme section lists `--theme <id>` with the docs link; CHANGELOG entry. Commit `Add theme menu with 37 Prism-derived theme packs`.
