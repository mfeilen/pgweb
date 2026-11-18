import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parseColor, hex, mix, isDark, slug, convertTheme, VARIABLES } from "./convert.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, "fixtures", "prism-fixture.css"), "utf8");

test("parseColor understands hex, rgb, hsl and alpha", () => {
  assert.equal(hex(parseColor("#abc")), "#aabbcc");
  assert.equal(hex(parseColor("#AABBCC")), "#aabbcc");
  assert.equal(hex(parseColor("rgb(1, 2, 3)")), "#010203");
  assert.equal(hex(parseColor("hsl(120, 100%, 25%)")), "#008000");
  assert.equal(hex(parseColor("rgba(0, 0, 0, .5)", parseColor("#ffffff"))), "#808080");
  assert.equal(parseColor("none"), null);
  assert.equal(parseColor("inherit"), null);
});

test("mix blends linearly in RGB", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#000000", "#ffffff", 0), "#000000");
  assert.equal(mix("#000000", "#ffffff", 1), "#ffffff");
});

test("isDark classifies by background luminance", () => {
  assert.equal(isDark("#1d1f21"), true);
  assert.equal(isDark("#fdf6e3"), false);
});

test("slug turns display names into ids", () => {
  assert.equal(slug("VS Code Dark Plus"), "vs-code-dark-plus");
  assert.equal(slug("Synthwave 84"), "synthwave-84");
  assert.equal(slug("Atelier Sulphurpool Light"), "atelier-sulphurpool-light");
  assert.equal(slug("Coy without shadows"), "coy-without-shadows");
});

test("convertTheme derives every variable from the fixture", () => {
  const theme = convertTheme(fixture, { id: "fixture", name: "Fixture" });

  assert.equal(theme.id, "fixture");
  assert.equal(theme.dark, true);
  for (const name of VARIABLES) {
    assert.ok(theme.vars[name], `missing ${name}`);
  }
  assert.equal(theme.vars["--bg"], "#1d1f21", "first colour of the gradient");
  assert.equal(theme.vars["--fg-text"], "#c5c8c6");
  assert.equal(theme.vars["--editor-keyword"], "#b294bb", "last rule for a token wins");
  assert.equal(theme.vars["--editor-constant"], "#de935f");
  assert.equal(theme.vars["--editor-type"], "#f0c674");
  assert.equal(theme.vars["--editor-comment"], "#969896", "rgb() token colour");
  assert.equal(theme.vars["--success"], "#98c379", "inserted beats string");
  assert.equal(theme.vars["--danger"], "#e06c75");
  assert.equal(theme.vars["--editor-selection"], "#4a4c4d", "rgba selection composited over the background");
  assert.equal(theme.vars["--overlay"], "rgba(0, 0, 0, 0.6)");
  assert.match(theme.vars["--brand"], /^#[0-9a-f]{6}$/);
});

test("convertTheme keeps the header bar dark enough for white text, also on light themes", () => {
  const light = fixture
    .replace("color: #c5c8c6;", "color: #383a42;")
    .replace("linear-gradient(to bottom, #1d1f21, #111)", "linear-gradient(to bottom, #fafafa, #fff)")
    .replace("color: #b294bb;", "color: #e8c7ff;"); // very light keyword colour
  const theme = convertTheme(light, { id: "light-fixture", name: "Light Fixture" });

  assert.equal(theme.dark, false);
  const l = luminanceOf(theme.vars["--brand"]);
  assert.ok(l < 0.4, `brand luminance ${l} too high for white text`);
});

test("convertTheme falls back when the source has no background", () => {
  const noBg = fixture
    .replace("background-image: linear-gradient(to bottom, #1d1f21, #111);", "");
  const theme = convertTheme(noBg, { id: "nobg", name: "No Bg" });
  assert.equal(theme.dark, true, "light foreground implies a dark background");
  assert.match(theme.vars["--bg"], /^#[0-9a-f]{6}$/);
});

function luminanceOf(h) {
  const c = parseColor(h);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
