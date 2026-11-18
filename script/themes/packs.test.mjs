// Guards the committed, generated theme packs: readable contrast in every
// block, and the three generated lists agree on the ids.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseColor, luminance, VARIABLES } from "./convert.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const css = readFileSync(path.join(root, "static/css/theme-packs.css"), "utf8");
const js = readFileSync(path.join(root, "static/js/theme-packs.js"), "utf8");
const go = readFileSync(path.join(root, "pkg/command/theme_packs.go"), "utf8");

function blocks() {
  const out = [];
  const re = /:root\[data-theme="([a-z0-9-]+)"\] \{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const vars = {};
    for (const line of m[2].split("\n")) {
      const d = line.match(/^\s*(--[a-z-]+|color-scheme):\s*(.+);$/);
      if (d) vars[d[1]] = d[2];
    }
    out.push({ id: m[1], vars });
  }
  return out;
}

function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const packs = blocks();

test("37 packs, every variable present", () => {
  assert.equal(packs.length, 37);
  for (const p of packs) {
    for (const v of VARIABLES) assert.ok(p.vars[v], `${p.id}: missing ${v}`);
    assert.match(p.vars["color-scheme"], /^(dark|light)$/);
  }
});

test("text on background is readable in every pack", () => {
  for (const p of packs) {
    const bg = p.vars["--bg"];
    assert.ok(contrast(p.vars["--fg-text"], bg) >= 4.5, `${p.id}: --fg-text ${contrast(p.vars["--fg-text"], bg).toFixed(2)}`);
    assert.ok(contrast(p.vars["--fg"], bg) >= 4.5, `${p.id}: --fg`);
    assert.ok(contrast(p.vars["--fg-dim"], bg) >= 3.5, `${p.id}: --fg-dim ${contrast(p.vars["--fg-dim"], bg).toFixed(2)}`);
    assert.ok(contrast(p.vars["--fg-muted"], bg) >= 3, `${p.id}: --fg-muted ${contrast(p.vars["--fg-muted"], bg).toFixed(2)}`);
    assert.ok(contrast(p.vars["--success"], bg) >= 3, `${p.id}: --success ${contrast(p.vars["--success"], bg).toFixed(2)}`);
  }
});

test("white text on coloured surfaces is readable in every pack", () => {
  for (const p of packs) {
    for (const v of ["--brand", "--selection", "--danger"]) {
      const c = contrast(p.vars[v], "#ffffff");
      const floor = v === "--danger" ? 3 : 4.5;
      assert.ok(c >= floor, `${p.id}: ${v} ${c.toFixed(2)} < ${floor}`);
    }
    assert.ok(contrast(p.vars["--brand-fg-muted"], p.vars["--brand"]) >= 3, `${p.id}: --brand-fg-muted`);
  }
});

test("danger reads red and success reads green", () => {
  const hue = (h) => {
    const { r, g, b } = parseColor(h);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return null;
    let x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((x * 60) + 360) % 360;
  };
  for (const p of packs) {
    const hd = hue(p.vars["--danger"]), hs = hue(p.vars["--success"]);
    assert.ok(hd !== null && (hd <= 25 || hd >= 330), `${p.id}: --danger hue ${hd}`);
    assert.ok(hs !== null && hs >= 60 && hs <= 180, `${p.id}: --success hue ${hs}`);
  }
});

test("generated id lists agree", () => {
  const cssIds = packs.map((p) => p.id);
  const jsIds = [...js.matchAll(/id: "([a-z0-9-]+)"/g)].map((m) => m[1]);
  const goIds = [...go.matchAll(/^\t"([a-z0-9-]+)",$/gm)].map((m) => m[1]);
  assert.deepEqual(jsIds, cssIds);
  assert.deepEqual(goIds, cssIds);
});
