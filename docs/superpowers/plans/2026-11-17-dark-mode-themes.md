# Dark Mode and Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dark theme for the pgweb UI, switchable in the browser, with `PGWEB_DARK_MODE` / `--dark-mode` as the server default, built on CSS custom properties so further themes are one variable block each.

**Architecture:** `static/css/themes.css` holds one `:root[data-theme=...]` block per theme; `app.css` and a hand-written Ace theme read only variables. The server exposes `features.dark_mode` in `/api/info`; `app.js` resolves the theme (browser choice, then server default, then light), sets `data-theme` on `<html>` and serves two `.theme-toggle` buttons.

**Tech Stack:** Go (go-flags, gin, testify), plain CSS custom properties, jQuery 2.1, Ace 1.4.6, Font Awesome 4.2. No new dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-11-17-dark-mode-themes-design.md`

## Global Constraints

- Light theme renders as today; hover surfaces may differ by one or two shades.
- No literal colour remains in `static/css/app.css`; all colours live in `static/css/themes.css`.
- No new third-party file. `static/js/theme-tomorrow.js` is deleted.
- Branch: `security-update-2026-11`. Every edited file passes the invisible-character check
  `grep -nP '[\x{00A0}\x{00AD}\x{200B}-\x{200F}\x{2028}\x{2029}\x{2060}\x{FEFF}]' <file>`.
- Go tests run with `PGPASSFILE=/nonexistent go test ./pkg/command/ ./pkg/api/`.
- Toggle icons: `fa-moon-o` while light, `fa-sun-o` while dark. Storage key: `localStorage["pgweb_theme"]`, values `light` | `dark`.

## Review Focus

1. `PGWEB_DARK_MODE=garbage` must fail startup with a clear message, not silently run light. (Task 1 test `dark mode env invalid`.)
2. `--dark-mode` together with `PGWEB_DARK_MODE=false` must run dark; the flag wins. (Task 1 test `dark mode flag wins`.)
3. A browser with `pgweb_theme=light` stored and a server with `PGWEB_DARK_MODE=true` must render light. (Task 4 screenshot `light-forced`.)
4. `localStorage` throwing (private mode, blocked storage) must not break page load. (Task 4: inline script and `applyTheme` wrap storage in `try/catch`; verified by evaluating with storage stubbed to throw.)
5. The toggle must be reachable before a connection exists. (Task 4 screenshot `connection-window` shows the button in both themes.)

---

### Task 1: Server option, environment variable, API feature flag, README

**Files:**
- Modify: `pkg/command/options.go` (struct ~line 67, `ParseOptions` after the `LOCK_SESSION` block, `AvailableEnvVars`)
- Modify: `pkg/api/api.go:605` (`GetInfo` features map)
- Modify: `README.md` (new section after "Multiple database sessions")
- Test: `pkg/command/options_test.go`, `pkg/api/api_test.go`

**Interfaces:**
- Produces: `command.Opts.DarkMode bool` (flag `--dark-mode`, env `PGWEB_DARK_MODE`); `/api/info` JSON `features.dark_mode: bool`.

- [ ] **Step 1: Write the failing option tests** in `TestParseOptions`:

```go
t.Run("dark mode flag", func(t *testing.T) {
    opts, err := ParseOptions([]string{"--dark-mode"})
    assert.NoError(t, err)
    assert.True(t, opts.DarkMode)
})
t.Run("dark mode env", func(t *testing.T) {
    for _, v := range []string{"true", "1", "TRUE"} {
        t.Setenv("PGWEB_DARK_MODE", v)
        opts, err := ParseOptions([]string{})
        assert.NoError(t, err)
        assert.True(t, opts.DarkMode, v)
    }
    t.Setenv("PGWEB_DARK_MODE", "false")
    opts, err := ParseOptions([]string{})
    assert.NoError(t, err)
    assert.False(t, opts.DarkMode)
})
t.Run("dark mode env invalid", func(t *testing.T) {
    t.Setenv("PGWEB_DARK_MODE", "garbage")
    _, err := ParseOptions([]string{})
    assert.EqualError(t, err, `invalid PGWEB_DARK_MODE value "garbage": expected true or false`)
})
t.Run("dark mode flag wins", func(t *testing.T) {
    t.Setenv("PGWEB_DARK_MODE", "false")
    opts, err := ParseOptions([]string{"--dark-mode"})
    assert.NoError(t, err)
    assert.True(t, opts.DarkMode)
})
```
Also add `assert.Equal(t, false, opts.DarkMode)` to the `defaults` subtest.

- [ ] **Step 2: Write the failing API test** `TestGetInfo` in `pkg/api/api_test.go`: set `command.Opts.DarkMode = true` (restore with `defer`), build a gin test context over `httptest.NewRecorder()`, call `GetInfo(c)`, decode the body and assert `features.dark_mode == true` and `features.session_lock == false`.

- [ ] **Step 3: Run tests, expect compile failure** (`opts.DarkMode` undefined).

- [ ] **Step 4: Implement**: struct field `DarkMode bool \`long:"dark-mode" description:"Enable dark mode by default"\``; in `ParseOptions`, when `!opts.DarkMode`, read `getPrefixedEnvVar("DARK_MODE")`, parse with `strconv.ParseBool`, return `fmt.Errorf("invalid PGWEB_DARK_MODE value %q: expected true or false", v)` on failure; add `"dark_mode": command.Opts.DarkMode` to `GetInfo`; add `DARK_MODE     Enable dark mode by default` to `AvailableEnvVars`.

- [ ] **Step 5: README**: section `### Dark mode` with `pgweb --dark-mode`, `PGWEB_DARK_MODE=true pgweb`, and one sentence on the in-app toggle overriding the default per browser.

- [ ] **Step 6: Run** `PGPASSFILE=/nonexistent go test ./pkg/command/ ./pkg/api/` → PASS. `go vet ./...` clean.

- [ ] **Step 7: Commit** `Add --dark-mode option and PGWEB_DARK_MODE, expose features.dark_mode`.

### Task 2: Theme variables and app.css refactor (light unchanged)

**Files:**
- Create: `static/css/themes.css`
- Modify: `static/css/app.css` (every colour literal), `static/index.html:8-10` (link `themes.css` before `app.css`)

**Interfaces:**
- Produces the variable names below; Tasks 3 and 4 use exactly these.

Page variables with light values (today's colours), mapping from `app.css`:

| Variable | Light | Replaces |
|---|---|---|
| `--brand` | `#79589f` | nav, current-database, typeahead input, Connect/Disconnect buttons |
| `--brand-fg` | `#fff` | text on brand surfaces, selected-tab underline, `.refresh`, placeholder |
| `--brand-fg-muted` | `#d6cce2` | unselected tab text |
| `--bg` | `#fff` | page, `#input .actions`, `#pagination`, even rows, modal, copy button, connection window, `.ace_gutter`, selected tab bg, h1 text-shadow |
| `--bg-panel` | `#f9f9f9` | sidebar, odd rows |
| `--bg-hover` | `#f1f1f1` | sidebar li hover/active, `th:hover` (`#f8f8f8`, `#fafafa`), pagination shadow |
| `--bg-active` | `#eee` | `th.active` (`#f3faff`), autocomplete active line |
| `--bg-form` | `#f6f6f6` | connection form, modal title (`#f5f5f5`) |
| `--fg` | `#000` | selected tab, objects filter input, textarea, btn hover text |
| `--fg-text` | `#333` | `th`, `td` (`#3a3633`), active object, action buttons (`#555`), table-info values (`#4f4f4f`) |
| `--fg-muted` | `#999` | counts, hints, `#aaa`, `#a1a1a1`, `#888`, `#7f7e7f` |
| `--fg-faint` | `#bbb` | NULL cells, gutter numbers, btn-default hover bg |
| `--border` | `#eee` | separators, `#eae9e9`, `#f2f2f2` |
| `--border-mid` | `#ccc` | modal border, resize handle (`#ddd`), copy/action borders (`#ddd`) |
| `--border-strong` | `#999` | action button borders, hover borders (`#444`) |
| `--accent` | `#79589f` | reserved for links/focus; unused by app.css today |
| `--accent-fg` | `#fff` | text on `--selection` and `--danger` |
| `--success` | `#7eb54e` | Run Query button, `#7eb154` |
| `--success-hover` | `#64903e` | Run Query hover |
| `--danger` | `#be2740` | error banner |
| `--highlight` | `#ffe` | row hover |
| `--selection` | `#3874d7` | selected row |
| `--shadow` | `#ddd` | modal shadow, `#eee` action hover shadow |

Editor variables (light = Ace Tomorrow): `--editor-bg #FFFFFF`, `--editor-fg #4D4D4C`, `--editor-gutter-bg` = `--bg`, `--editor-gutter-fg` = `--fg-faint`, `--editor-active-line #EFEFEF`, `--editor-gutter-active-line #dcdcdc`, `--editor-selection #D6D6D6`, `--editor-cursor #AEAFAD`, `--editor-bracket #D1D1D1`, `--editor-keyword #8959A8`, `--editor-operator #3E999F`, `--editor-constant #F5871F`, `--editor-function #4271AE`, `--editor-type #C99E00`, `--editor-string #718C00`, `--editor-variable #C82829`, `--editor-comment #8E908C`.

Dark block values (page): `--brand #4a3862`, `--brand-fg #fff`, `--brand-fg-muted #c9bcd9`, `--bg #1d1f21`, `--bg-panel #25282c`, `--bg-hover #2d3035`, `--bg-active #373b41`, `--bg-form #25282c`, `--fg #f2f2f2`, `--fg-text #c5c8c6`, `--fg-muted #8e9196`, `--fg-faint #63676d`, `--border #2f3337`, `--border-mid #45494f`, `--border-strong #6b6f76`, `--accent #b294bb`, `--accent-fg #fff`, `--success #8fcf5f`, `--success-hover #a7dd7c`, `--danger #c0392b`, `--highlight #2a2d24`, `--selection #2f5fa8`, `--shadow #000`.
Dark editor (Ace Tomorrow Night): bg `#1D1F21`, fg `#C5C8C6`, active line `#282A2E`, gutter active line `#282A2E`, selection `#373B41`, cursor `#AEAFAD`, bracket `#4B4E55`, keyword `#B294BB`, operator `#8ABEB7`, constant `#DE935F`, function `#81A2BE`, type `#F0C674`, string `#B5BD68`, variable `#CC6666`, comment `#969896`.

Bootstrap overrides appended to `app.css` (values equal Bootstrap's light defaults so light is unchanged): `body { background: var(--bg); color: var(--fg-text) }`, `.btn-default` (bg `--bg`, border `--border-mid`, color `--fg-text`; `:hover/:focus/.active` bg `--bg-active`), `.form-control` and `select` (bg `--bg`, border `--border-mid`, color `--fg-text`), `.dropdown-menu` (bg `--bg`, border `--border-mid`, `> li > a` color `--fg-text`, hover bg `--bg-form`), `.dropdown-menu .divider` (`--border`), `pre` (bg `--bg-form`, border `--border-mid`, color `--fg-text`), `.help-block` (`--fg-muted`), `.alert-warning` untouched, `::placeholder` (`--fg-muted`), `:root[data-theme="dark"] { color-scheme: dark }` in `themes.css`.

- [ ] **Step 1: Create `static/css/themes.css`** with the two blocks above (`:root, :root[data-theme="light"]` and `:root[data-theme="dark"]`), each variable on its own line, grouped Page / Editor.
- [ ] **Step 2: Rewrite the colour declarations in `app.css`** per the table; append the Bootstrap override section.
- [ ] **Step 3: Verify no literal remains**: `grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' static/css/app.css` → no output.
- [ ] **Step 4: Link `themes.css`** in `index.html` before `app.css`.
- [ ] **Step 5: Screenshot check (light)**: build, start pgweb against the test database, run `node <scratch>/shots/shoot.mjs <scratch>/shots/task2 ""`, compare each image with `<scratch>/shots/baseline/` by eye (Read); differences limited to hover shades.
- [ ] **Step 6: Commit** `Move UI colours to CSS custom properties (themes.css)`.

### Task 3: Variable-driven Ace theme

**Files:**
- Create: `static/js/theme-pgweb.js`
- Delete: `static/js/theme-tomorrow.js`
- Modify: `static/index.html` (script tag), `static/js/app.js:1109` (`setTheme`)

- [ ] **Step 1: Write `theme-pgweb.js`**: `ace.define("ace/theme/pgweb", ["require","exports","module","ace/lib/dom"], function(require, exports, module) { exports.isDark = false; exports.cssClass = "ace-pgweb"; exports.cssText = "..."; require("../lib/dom").importCssString(exports.cssText, exports.cssClass); })`. The cssText keeps every selector of `theme-tomorrow.js` with each colour replaced by its `--editor-*` variable (`.ace_invalid` background → `var(--danger)`, `.ace_fold` → `--editor-function` / `--editor-fg`, `.ace_constant.ace_other` → `--editor-fg`, `.ace_invisible` → `--editor-bracket`, multiselect shadow → `--editor-bg`, `.ace_step` stays `rgb(255, 255, 0)`).
- [ ] **Step 2: Switch** `editor.setTheme("ace/theme/pgweb")`; replace the script tag; `git rm static/js/theme-tomorrow.js`; `grep -rn tomorrow static/ pkg/` → nothing.
- [ ] **Step 3: Verify** with a light screenshot of `02-query-results` (keyword purple, number orange as in baseline).
- [ ] **Step 4: Commit** `Replace Ace Tomorrow theme with variable-driven ace/theme/pgweb`.

### Task 4: Toggle, theme resolution, dark screenshots

**Files:**
- Modify: `static/index.html` (head inline script; `.theme-toggle` in `#nav` and in `#connection_window`), `static/js/app.js` (new functions, startup wiring), `static/css/app.css` (`.theme-toggle` placement, `.connection-actions { right: 44px }`), `CHANGELOG.md`

**Interfaces:**
- `applyTheme(name)`: sets `data-theme`, swaps icon classes and `title` on every `.theme-toggle`.
- `storedTheme()`: returns `"light"`, `"dark"` or `null`; never throws.
- `initTheme()`: called after `appFeatures` is set: `applyTheme(storedTheme() || (appFeatures.dark_mode ? "dark" : "light"))`.
- Click handler on `.theme-toggle`: next = current is dark ? light : dark; store (try/catch); `applyTheme(next)`.

- [ ] **Step 1: Head script** (before the stylesheet links): reads `localStorage.getItem("pgweb_theme")` in `try/catch`, sets `data-theme` when it is `dark` or `light`.
- [ ] **Step 2: Markup**: in `#nav` after `.connection-actions`: `<a href="#" class="theme-toggle" title="Switch to dark mode"><i class="fa fa-moon-o"></i></a>`; the same element as the first child of `#connection_window`. CSS: `.theme-toggle { position: fixed; top: 10px; right: 8px; width: 30px; height: 30px; line-height: 30px; text-align: center; border-radius: 3px; border: 1px solid var(--brand-fg); color: var(--brand-fg); z-index: 901 }`, `#connection_window .theme-toggle { border-color: var(--border-mid); color: var(--fg-muted) }`, `.connection-actions { right: 46px }`.
- [ ] **Step 3: app.js**: the four functions above; bind the click handler in `$(document).ready`; call `initTheme()` right after `appFeatures = resp.features;`.
- [ ] **Step 4: Screenshots**: `shoot.mjs <scratch>/shots/dark dark` and `<scratch>/shots/light-forced light` with the server started with `--dark-mode`; Read every dark image; fix contrast issues in `themes.css` dark block only. Verify storage failure: in the dark run evaluate `Object.defineProperty(window,"localStorage",{get(){throw new Error("blocked")}}); location.reload()` → page still renders.
- [ ] **Step 5: CHANGELOG** `## Next`: `- \`NEW\` Dark mode: \`--dark-mode\` / \`PGWEB_DARK_MODE\` set the default, a toggle in the UI switches per browser; UI colours moved to CSS custom properties (\`static/css/themes.css\`) as the base for further themes`.
- [ ] **Step 6: Full verification**: `go build ./... && go vet ./...`, full test run against the Docker database, `node -e` parse of `app.js`, invisible-character check on every touched file.
- [ ] **Step 7: Commit** `Add dark mode with in-app toggle and PGWEB_DARK_MODE default`.
