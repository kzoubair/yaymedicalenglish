// Run with: npm test  (or: node --test tests/*.test.js)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/corrector.js");
const WM = require("../js/wordmatch.js");

const e = (en, extra) => Object.assign({ en, alt: [], article: "", nature: "noun" }, extra || {});

test("case, spaces and final punctuation are ignored", () => {
  assert.ok(C.check("  Myocardial   Infarction. ", e("myocardial infarction")).exact);
  assert.ok(C.check("TAKE YOUR TIME", e("Take your time.")).exact);
});

test("curly and straight apostrophes are equivalent", () => {
  assert.ok(C.check("don’t", e("don't")).exact);
  assert.ok(C.check("Parkinson's disease", e("Parkinson’s disease")).exact);
});

test("hyphen or space are equivalent", () => {
  assert.ok(C.check("follow up", e("follow-up")).exact);
  assert.ok(C.check("follow-up", e("follow up")).exact);
  assert.ok(C.check("x ray", e("X-ray")).exact);
});

test("alternative answers and abbreviations are accepted", () => {
  assert.ok(C.check("MI", e("myocardial infarction", { alt: ["MI"] })).exact);
});

test("one wrong letter is accepted and located", () => {
  const r = C.check("diagnosys", e("diagnosis"));
  assert.ok(r.correct && !r.exact);
  assert.deepEqual(r.typo, { kind: "substitution", index: 7, expectedChar: "i" });
  const miss = C.check("diagnsis", e("diagnosis"));
  assert.ok(miss.correct);
  assert.equal(miss.typo.kind, "missing");
  const extra = C.check("diagnossis", e("diagnosis"));
  assert.equal(extra.typo.kind, "extra");
  assert.equal(C.check("diagnoses", e("diagnosis")).correct, true);
});

test("two wrong letters are refused", () => {
  assert.equal(C.check("diagnusys", e("diagnosis")).correct, false);
});

test("no tolerance on very short words, nor for another real word", () => {
  assert.equal(C.check("rob", e("rib")).correct, false);
  const known = new Set(["ache", "acne"]);
  assert.equal(C.check("ache", e("acne"), { knownWords: known }).correct, false);
});

test("article a / an not required by default, required when the setting is on", () => {
  const ent = e("ulcer", { article: "an" });
  assert.ok(C.check("an ulcer", ent).exact);
  assert.ok(C.check("ulcer", ent).exact);
  assert.equal(C.check("ulcer", ent, { requireArticle: true }).correct, false);
  assert.equal(C.check("a ulcer", ent, { requireArticle: true }).correct, false);
  assert.ok(C.check("an ulcer", ent, { requireArticle: true }).exact);
});

test("placeholders sb / sth / one's are expanded", () => {
  assert.ok(C.check("keep someone up at night", e("keep sb up at night")).exact);
  assert.ok(C.check("keep up at night", e("keep sb up at night")).exact);
  assert.ok(C.check("in my own words", e("in one's own words")).exact);
});

test("typing hint keeps the first letter of each word", () => {
  assert.equal(C.hint("heart attack"), "h____ a_____");
  assert.equal(C.hint("follow-up"), "f_____-u_");
});

test("headword highlighting finds inflected and irregular forms", () => {
  const s = "The wound bled for an hour.";
  const spans = WM.findSpans(s, "bleed", "irregular: bled, bled");
  assert.deepEqual(spans.map(([a, b]) => s.slice(a, b)), ["bled"]);
  const s2 = "I've had this cough on and off for a month.";
  assert.deepEqual(WM.findSpans(s2, "on and off", "").map(([a, b]) => s2.slice(a, b)), ["on and off"]);
});
