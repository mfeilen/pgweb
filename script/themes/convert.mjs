#!/usr/bin/env node
// Converts Prism syntax-highlighting themes into pgweb theme packs.
//
// Input:  the prism/ directory of https://github.com/mfeilen/macdown3000-themes
//         (unchanged copies of PrismJS/prism-themes, MIT).
// Output: static/css/theme-packs.css, static/js/theme-packs.js,
//         pkg/command/theme_packs.go and docs/themes.md, all generated.
//
// Usage:  node script/themes/convert.mjs <path-to-prism-dir>
//
// No dependencies. The page palette is derived from the theme's foreground
// and background (mixing ratios below), the editor palette from its tokens.
// See docs/superpowers/specs/2026-11-18-theme-packs-design.md.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

/** Display names, same table as the source repository's convert.js. */
export const NAMES = {
  "prism-a11y-dark": "a11y Dark",
  "prism-atom-dark": "Atom Dark",
  "prism-base16-ateliersulphurpool.light": "Atelier Sulphurpool Light",
  "prism-cb": "CB",
  "prism-coldark-cold": "Coldark Cold",
  "prism-coldark-dark": "Coldark Dark",
  "prism-coy-without-shadows": "Coy without shadows",
  "prism-darcula": "Darcula",
  "prism-dracula": "Dracula",
  "prism-duotone-dark": "Duotone Dark",
  "prism-duotone-earth": "Duotone Earth",
  "prism-duotone-forest": "Duotone Forest",
  "prism-duotone-light": "Duotone Light",
  "prism-duotone-sea": "Duotone Sea",
  "prism-duotone-space": "Duotone Space",
  "prism-ghcolors": "GHColors",
  "prism-gruvbox-dark": "Gruvbox Dark",
  "prism-gruvbox-light": "Gruvbox Light",
  "prism-holi-theme": "Holi Theme",
  "prism-hopscotch": "Hopscotch",
  "prism-laserwave": "Laserwave",
  "prism-lucario": "Lucario",
  "prism-material-dark": "Material Dark",
  "prism-material-light": "Material Light",
  "prism-material-oceanic": "Material Oceanic",
  "prism-night-owl": "Night Owl",
  "prism-nord": "Nord",
  "prism-one-dark": "One Dark",
  "prism-one-light": "One Light",
  "prism-pojoaque": "Pojoaque",
  "prism-shades-of-purple": "Shades of Purple",
  "prism-solarized-dark-atom": "Solarized Dark Atom",
  "prism-synthwave84": "Synthwave 84",
  "prism-vs": "VS",
  "prism-vsc-dark-plus": "VS Code Dark Plus",
  "prism-xonokai": "Xonokai",
  "prism-z-touch": "Z-Touch",
};

/** Hand fixes per theme id: { "--variable": "#rrggbb" }. */
export const OVERRIDES = {};

/** Output order of the variables; every theme block defines all of them. */
export const VARIABLES = [
  "--brand", "--brand-fg", "--brand-fg-muted", "--brand-hover",
  "--bg", "--bg-panel", "--bg-hover", "--bg-active", "--bg-form", "--bg-sorted",
  "--fg", "--fg-text", "--fg-dim", "--fg-muted", "--fg-faint",
  "--border", "--border-mid", "--border-strong",
  "--accent", "--accent-fg", "--success", "--success-hover", "--danger",
  "--highlight", "--selection", "--shadow", "--overlay",
  "--editor-bg", "--editor-fg", "--editor-gutter-bg", "--editor-gutter-fg",
  "--editor-active-line", "--editor-gutter-active-line", "--editor-selection",
  "--editor-cursor", "--editor-bracket", "--editor-keyword", "--editor-operator",
  "--editor-constant", "--editor-function", "--editor-type", "--editor-string",
  "--editor-variable", "--editor-comment",
];

// ---------------------------------------------------------------- colours

const NAMED = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  gray: "#808080", grey: "#808080", silver: "#c0c0c0", yellow: "#ffff00", orange: "#ffa500",
  purple: "#800080", teal: "#008080", navy: "#000080", maroon: "#800000", olive: "#808000",
  lime: "#00ff00", aqua: "#00ffff", cyan: "#00ffff", fuchsia: "#ff00ff", magenta: "#ff00ff",
  pink: "#ffc0cb", brown: "#a52a2a", gold: "#ffd700", darkgray: "#a9a9a9", darkgrey: "#a9a9a9",
  lightgray: "#d3d3d3", lightgrey: "#d3d3d3", dimgray: "#696969", whitesmoke: "#f5f5f5",
  tomato: "#ff6347", crimson: "#dc143c", coral: "#ff7f50", salmon: "#fa8072", khaki: "#f0e68c",
  slategray: "#708090", slategrey: "#708090", steelblue: "#4682b4", skyblue: "#87ceeb",
  orchid: "#da70d6", violet: "#ee82ee", indigo: "#4b0082", tan: "#d2b48c", beige: "#f5f5dc",
};

function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/**
 * Parses a CSS colour into {r, g, b, a}. Returns null for none, inherit,
 * transparent, currentColor or anything unparseable. When `over` is given,
 * a colour with alpha is composited onto it.
 */
export function parseColor(str, over = null) {
  if (!str) return null;
  let s = String(str).trim().toLowerCase().replace(/\s*!important$/, "");
  if (!s || ["none", "inherit", "transparent", "currentcolor", "initial", "unset"].includes(s)) return null;
  if (NAMED[s]) s = NAMED[s];

  let c = null;
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,4})$/))) {
    const d = m[1].split("").map((x) => parseInt(x + x, 16));
    c = { r: d[0], g: d[1], b: d[2], a: d.length === 4 ? d[3] / 255 : 1 };
  } else if ((m = s.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/))) {
    const v = m[1];
    c = { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16), a: v.length === 8 ? parseInt(v.slice(6, 8), 16) / 255 : 1 };
  } else if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
    const parts = m[1].split(/[\s,\/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const num = (p, max) => (p.endsWith("%") ? (parseFloat(p) / 100) * max : parseFloat(p));
    c = { r: num(parts[0], 255), g: num(parts[1], 255), b: num(parts[2], 255), a: parts[3] !== undefined ? num(parts[3], 1) : 1 };
  } else if ((m = s.match(/^hsla?\(([^)]+)\)$/))) {
    const parts = m[1].split(/[\s,\/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const [r, g, b] = hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]) / 100, parseFloat(parts[2]) / 100);
    const a = parts[3] !== undefined ? (parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
    c = { r, g, b, a };
  }
  if (!c || [c.r, c.g, c.b, c.a].some((v) => Number.isNaN(v))) return null;

  if (c.a < 1 && over) {
    c = { r: c.r * c.a + over.r * (1 - c.a), g: c.g * c.a + over.g * (1 - c.a), b: c.b * c.a + over.b * (1 - c.a), a: 1 };
  }
  return c;
}

export function hex(c) {
  if (!c) return null;
  return "#" + [c.r, c.g, c.b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");
}

/** Linear RGB mix of two hex colours, t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const A = parseColor(a), B = parseColor(b);
  return hex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t, a: 1 });
}

export function luminance(h) {
  const c = parseColor(h);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function isDark(h) { return luminance(h) < 0.5; }

/** First colour found inside a value such as a gradient. */
function firstColorIn(value, over) {
  if (!value) return null;
  const tokens = String(value).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b[a-z]+\b/gi) || [];
  for (const t of tokens) {
    const c = parseColor(t, over);
    if (c) return c;
  }
  return null;
}

export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------- CSS parsing

function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ""); }

/** Removes @import lines and whole @media/@supports blocks. */
function stripAtRules(css) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css[i] === "@") {
      const brace = css.indexOf("{", i);
      const semi = css.indexOf(";", i);
      if (brace === -1 || (semi !== -1 && semi < brace)) { i = semi === -1 ? css.length : semi + 1; continue; }
      let depth = 0, j = brace;
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}" && --depth === 0) break;
      }
      i = j + 1;
      continue;
    }
    out += css[i++];
  }
  return out;
}

/** Returns [{ selectors: [...], decls: { prop: value } }] in source order. */
export function parseRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  for (const src = stripAtRules(stripComments(css)); (m = re.exec(src)); ) {
    // Attribute selectors appear with single or double quotes; normalise to double.
    const selectors = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ").replace(/'/g, '"')).filter(Boolean);
    const decls = {};
    for (const d of m[2].split(";")) {
      const idx = d.indexOf(":");
      if (idx < 0) continue;
      decls[d.slice(0, idx).trim().toLowerCase()] = d.slice(idx + 1).trim();
    }
    if (selectors.length) rules.push({ selectors, decls });
  }
  return rules;
}

const BASE = /^(code\[class\*="language-"\]|pre\[class\*="language-"\]|pre\[class\*="language-"\] > code|pre > code\[class\*="language-"\])$/;
const SELECTION = /^(code|pre)\[class\*="language-"\](?: ::selection| ?::-?(?:moz-)?selection|::selection)$/;
const TOKEN = /^\.token\.([a-z0-9-]+)$/;

/** Collects base, selection and token declarations; the last rule wins. */
function collect(rules) {
  const state = { base: {}, selection: {}, token: {} };
  for (const rule of rules) {
    for (const sel of rule.selectors) {
      let slot = null;
      if (BASE.test(sel)) slot = state.base;
      else if (SELECTION.test(sel) || /\[class\*="language-"\].*::(-moz-)?selection$/.test(sel)) slot = state.selection;
      else if (TOKEN.test(sel)) slot = state.token[sel.match(TOKEN)[1]] ||= {};
      if (!slot) continue;
      for (const [k, v] of Object.entries(rule.decls)) slot[k] = v;
    }
  }
  return state;
}

// ---------------------------------------------------------------- conversion

/** Converts one Prism stylesheet to a theme { id, name, dark, vars, file }. */
export function convertTheme(css, { id, name, file = "" }) {
  const state = collect(parseRules(css));
  const base = state.base;

  const fgRaw = parseColor(base.color);
  if (!fgRaw) throw new Error(`${id}: no base foreground colour`);

  let bg = parseColor(base["background"]) || parseColor(base["background-color"]) ||
    firstColorIn(base["background-image"]) || firstColorIn(base["background"]);
  if (!bg) bg = luminance(hex(fgRaw)) > 0.5 ? parseColor("#1e1e1e") : parseColor("#ffffff");
  bg = { ...bg, a: 1 };
  const bgHex = hex(bg);
  const fg = hex(parseColor(hex(fgRaw), bg) || fgRaw);
  const dark = isDark(bgHex);

  const token = (...names) => {
    for (const n of names) {
      const c = state.token[n] && parseColor(state.token[n].color, bg);
      if (c) return hex(c);
    }
    return null;
  };

  const keyword  = token("keyword", "atrule", "important") || fg;
  const fn       = token("function", "property", "attr-name") || fg;
  const string   = token("string", "attr-value", "char") || fg;
  const comment  = token("comment", "prolog") || mix(fg, bgHex, 0.45);
  const operator = token("operator", "punctuation") || keyword;
  const constant = token("number", "boolean", "constant") || keyword;
  const type     = token("class-name", "builtin", "attr-name", "selector") || fn;
  const variable = token("variable", "tag", "attr-name", "property") || keyword;
  const success  = token("inserted") || string;
  const danger   = token("deleted") || token("important") || "#be2740";
  const accent   = fn;

  let brand = dark ? mix(keyword, bgHex, 0.35) : mix(keyword, "#000000", 0.25);
  for (let i = 0; i < 12 && luminance(brand) >= 0.4; i++) brand = mix(brand, "#000000", 0.15);

  const selBg = parseColor(state.selection.background || state.selection["background-color"], bg);

  const vars = {
    "--brand": brand,
    "--brand-fg": "#fff",
    "--brand-fg-muted": mix("#ffffff", brand, 0.3),
    "--brand-hover": "rgba(255, 255, 255, 0.15)",
    "--bg": bgHex,
    "--bg-panel": mix(bgHex, fg, 0.03),
    "--bg-hover": mix(bgHex, fg, 0.07),
    "--bg-active": mix(bgHex, fg, 0.13),
    "--bg-form": mix(bgHex, fg, 0.05),
    "--bg-sorted": mix(bgHex, fn, 0.15),
    "--fg": mix(fg, dark ? "#ffffff" : "#000000", 0.15),
    "--fg-text": fg,
    "--fg-dim": mix(fg, bgHex, 0.3),
    "--fg-muted": comment,
    "--fg-faint": mix(fg, bgHex, 0.6),
    "--border": mix(bgHex, fg, 0.12),
    "--border-mid": mix(bgHex, fg, 0.22),
    "--border-strong": mix(bgHex, fg, 0.35),
    "--accent": accent,
    "--accent-fg": "#fff",
    "--success": success,
    "--success-hover": mix(success, fg, 0.2),
    "--danger": danger,
    "--highlight": mix(bgHex, string, 0.12),
    "--selection": mix(bgHex, accent, 0.4),
    "--shadow": dark ? "#000" : mix(bgHex, fg, 0.3),
    "--overlay": dark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.3)",
    "--editor-bg": bgHex,
    "--editor-fg": fg,
    "--editor-gutter-bg": "var(--bg)",
    "--editor-gutter-fg": "var(--fg-faint)",
    "--editor-active-line": mix(bgHex, fg, 0.06),
    "--editor-gutter-active-line": mix(bgHex, fg, 0.06),
    "--editor-selection": selBg && hex(selBg) !== bgHex ? hex(selBg) : mix(bgHex, fg, 0.2),
    "--editor-cursor": keyword,
    "--editor-bracket": mix(bgHex, fg, 0.3),
    "--editor-keyword": keyword,
    "--editor-operator": operator,
    "--editor-constant": constant,
    "--editor-function": fn,
    "--editor-type": type,
    "--editor-string": string,
    "--editor-variable": variable,
    "--editor-comment": comment,
    ...(OVERRIDES[id] || {}),
  };

  return { id, name, dark, vars, file };
}

// ---------------------------------------------------------------- outputs

const HEADER = (kind) => `${kind} Generated by script/themes/convert.mjs from the Prism themes in
${kind} https://github.com/mfeilen/macdown3000-themes (prism/, MIT). Do not edit;
${kind} re-run the converter instead.`;

function renderCss(themes) {
  const out = ["/*", HEADER(" *"), " */", ""];
  for (const t of themes) {
    out.push(`/* ${t.name} (${t.file}) */`);
    out.push(`:root[data-theme="${t.id}"] {`);
    out.push(`  color-scheme: ${t.dark ? "dark" : "light"};`);
    for (const name of VARIABLES) out.push(`  ${name}: ${t.vars[name]};`);
    out.push("}", "");
  }
  return out.join("\n");
}

function renderJs(themes) {
  const list = themes.map((t) => `  { id: ${JSON.stringify(t.id)}, name: ${JSON.stringify(t.name)}, dark: ${t.dark} }`);
  return `${HEADER("//")}\n\nvar themePacks = [\n${list.join(",\n")}\n];\n`;
}

function renderGo(themes) {
  const ids = themes.map((t) => `\t${JSON.stringify(t.id)},`);
  return `${HEADER("//")}\n\npackage command\n\n// themePackIDs lists the selectable theme packs (see docs/themes.md).\nvar themePackIDs = []string{\n${ids.join("\n")}\n}\n`;
}

function renderDocs(themes) {
  const rows = themes.map((t) => `| ${t.name} | \`${t.id}\` | ${t.dark ? "dark" : "light"} | \`${t.file}\` |`);
  return `# Themes

${themes.length} theme packs, selectable in the UI (button in the top right corner)
or as the server default with \`--theme <id>\` / \`PGWEB_THEME=<id>\`. The built-in
choices \`auto\`, \`light\` and \`dark\` come first; \`auto\` follows the operating
system.

| Name | Id | Group | Source |
|---|---|---|---|
${rows.join("\n")}

## Origin and licence

The packs are generated by \`script/themes/convert.mjs\` from the Prism
syntax-highlighting themes collected in
[mfeilen/macdown3000-themes](https://github.com/mfeilen/macdown3000-themes)
(\`prism/\`), which are unchanged copies from
[PrismJS/prism-themes](https://github.com/PrismJS/prism-themes), MIT licence.
The author of each theme is named in the header of its source file. Only the
derived colour variables ship with pgweb, not the Prism stylesheets.

To regenerate after a change in the source repository:

\`\`\`
node script/themes/convert.mjs /path/to/macdown3000-themes/prism
\`\`\`
`;
}

/** Sorts dark group first, then light, each alphabetically by name. */
function sortThemes(themes) {
  return [...themes].sort((a, b) => (a.dark === b.dark ? a.name.localeCompare(b.name) : a.dark ? -1 : 1));
}

export function main(argv) {
  const dir = argv[0];
  if (!dir) {
    console.error("usage: node script/themes/convert.mjs <path-to-prism-dir>");
    return 2;
  }
  const themes = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".css") || file.endsWith(".min.css")) continue;
    const base = file.replace(/\.css$/, "");
    const name = NAMES[base];
    if (!name) { console.warn(`skipping ${file}: no display name in NAMES`); continue; }
    const css = readFileSync(path.join(dir, file), "utf8");
    themes.push(convertTheme(css, { id: slug(name), name, file }));
  }
  const sorted = sortThemes(themes);
  const write = (rel, content) => {
    const p = path.join(repoRoot, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, content);
    console.log("wrote", rel);
  };
  write("static/css/theme-packs.css", renderCss(sorted));
  write("static/js/theme-packs.js", renderJs(sorted));
  write("pkg/command/theme_packs.go", renderGo(sorted));
  write("docs/themes.md", renderDocs(sorted));
  console.log(`${sorted.length} themes: ${sorted.filter((t) => t.dark).length} dark, ${sorted.filter((t) => !t.dark).length} light`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
