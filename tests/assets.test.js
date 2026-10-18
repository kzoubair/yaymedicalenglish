// Every file the app needs must be precached by the service worker, and every precached file must exist.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));

test("every precached file exists", () => {
  assets.filter(a => a !== "./").forEach(a => assert.ok(fs.existsSync(path.join(ROOT, a)), `missing: ${a}`));
});

test("every app file is precached, with relative paths only", () => {
  const files = ["index.html", "manifest.webmanifest", "vocabulaire.js"]
    .concat(fs.readdirSync(path.join(ROOT, "js")).map(f => "js/" + f))
    .concat(fs.readdirSync(path.join(ROOT, "css")).map(f => "css/" + f))
    .concat(fs.readdirSync(path.join(ROOT, "fonts")).filter(f => f.endsWith(".woff2")).map(f => "fonts/" + f))
    .concat(fs.readdirSync(path.join(ROOT, "icons")).map(f => "icons/" + f));
  files.forEach(f => assert.ok(assets.includes(f), `not precached: ${f}`));
  assets.forEach(a => assert.ok(!a.startsWith("/"), `absolute path: ${a}`));
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(!/(src|href)="\//.test(html), "index.html uses absolute paths");
});

test("vocabulaire.js declares the target language once and loads in Node", () => {
  const v = require("../vocabulaire.js");
  assert.equal(v.TARGET_LANGUAGE, "en-US");
  assert.ok(v.VOCABULAIRE.length >= 2000);
  const ids = new Set(v.VOCABULAIRE.map(e => e.id));
  assert.equal(ids.size, v.VOCABULAIRE.length);
});
