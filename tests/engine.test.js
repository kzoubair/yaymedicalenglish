// Run with: npm test  (or: node --test tests/*.test.js)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const P = require("../js/progress.js");

const MIN = 60 * 1000;
// A fixed local date at 10 a.m. (after the 4 a.m. rollover).
const NOW = new Date(2026, 9, 18, 10, 0, 0).getTime();
const day = n => E.addDays(E.dayStart(NOW), n);

test("new card: Again -> 1 min, Hard -> 6 min, Good -> 10 min, Easy -> 4 days", () => {
  const c = E.newCard();
  assert.equal(E.answer(c, E.AGAIN, NOW).due, NOW + 1 * MIN);
  assert.equal(E.answer(c, E.HARD, NOW).due, NOW + 6 * MIN);
  const g = E.answer(c, E.GOOD, NOW);
  assert.equal(g.s, "learning");
  assert.equal(g.due, NOW + 10 * MIN);
  const e = E.answer(c, E.EASY, NOW);
  assert.equal(e.s, "review");
  assert.equal(e.ivl, 4);
  assert.equal(e.due, day(4));
});

test("learning card on the 10-minute step: Good graduates to 1 day", () => {
  const step1 = E.answer(E.newCard(), E.GOOD, NOW);
  const grad = E.answer(step1, E.GOOD, NOW + 10 * MIN);
  assert.equal(grad.s, "review");
  assert.equal(grad.ivl, 1);
  assert.equal(grad.ease, 2.5, "ease is unchanged while learning");
});

test("ease starts at 2.5; review deltas -0.20 / -0.15 / 0 / +0.15", () => {
  const r = { s: "review", ivl: 10, ease: 2.5, due: day(0), reps: 3, lapses: 0 };
  assert.equal(E.answer(r, E.AGAIN, NOW).ease, 2.3);
  assert.equal(E.answer(r, E.HARD, NOW).ease, 2.35);
  assert.equal(E.answer(r, E.GOOD, NOW).ease, 2.5);
  assert.equal(E.answer(r, E.EASY, NOW).ease, 2.65);
});

test("ease never goes below 1.3", () => {
  let c = { s: "review", ivl: 10, ease: 1.35, due: day(0), reps: 3, lapses: 0 };
  c = E.answer(c, E.AGAIN, NOW);
  assert.equal(c.ease, 1.3);
  c = E.answer({ ...c, s: "review" }, E.HARD, NOW);
  assert.equal(c.ease, 1.3);
});

test("review intervals: Hard x1.2, Good x ease, Easy x ease x 1.3 (no fuzz)", () => {
  const r = { s: "review", ivl: 10, ease: 2.5, due: day(0), reps: 5, lapses: 0 };
  assert.equal(E.answer(r, E.HARD, NOW).ivl, 12);
  assert.equal(E.answer(r, E.GOOD, NOW).ivl, 25);
  assert.equal(E.answer(r, E.EASY, NOW).ivl, 33); // 10 * 2.5 * 1.3 = 32.5
  assert.equal(E.answer(r, E.GOOD, NOW).due, day(25));
});

test("fuzz stays within ±5 %", () => {
  const r = { s: "review", ivl: 100, ease: 2.5, due: day(0), reps: 5, lapses: 0 };
  for (let i = 0; i < 200; i++) {
    const v = Math.random();
    const out = E.answer(r, E.GOOD, NOW, () => v).ivl;
    assert.ok(out >= Math.round(250 * 0.95) && out <= Math.round(250 * 1.05), `out of range: ${out}`);
  }
  assert.equal(E.answer(r, E.GOOD, NOW, () => 0).ivl, Math.round(250 * 0.95));
  assert.equal(E.answer(r, E.GOOD, NOW, () => 0.75).ivl, Math.round(250 * 1.025));
});

test("Again on a review card: relearning at 10 min, next interval = half, min 1 day", () => {
  const r = { s: "review", ivl: 30, ease: 2.5, due: day(0), reps: 5, lapses: 0 };
  const a = E.answer(r, E.AGAIN, NOW);
  assert.equal(a.s, "relearning");
  assert.equal(a.due, NOW + 10 * MIN);
  assert.equal(a.ivl, 15);
  assert.equal(a.lapses, 1);
  const back = E.answer(a, E.GOOD, NOW + 10 * MIN);
  assert.equal(back.s, "review");
  assert.equal(back.ivl, 15);
  assert.equal(back.due, day(15));
  const small = E.answer({ s: "review", ivl: 1, ease: 2.5, due: day(0) }, E.AGAIN, NOW);
  assert.equal(small.ivl, 1);
});

test("a card failed 8 times is flagged as a leech", () => {
  let c = { s: "review", ivl: 4, ease: 2.5, due: day(0), reps: 1, lapses: 0 };
  for (let i = 0; i < 7; i++) {
    c = E.answer(c, E.AGAIN, NOW);
    c = E.answer(c, E.GOOD, NOW + 10 * MIN);
    assert.equal(c.leech, false);
  }
  c = E.answer(c, E.AGAIN, NOW);
  assert.equal(c.lapses, 8);
  assert.equal(c.leech, true);
});

test("preview shows the delay under each button", () => {
  const p = E.preview(E.newCard(), NOW).map(E.formatDelay);
  assert.deepEqual(p, ["1 min", "6 min", "10 min", "4 days"]);
  const r = { s: "review", ivl: 10, ease: 2.5, due: day(0) };
  assert.deepEqual(E.preview(r, NOW).map(E.formatDelay), ["10 min", "12 days", "25 days", "1.1 mo"]);
});

test("day rollover at 4 a.m.", () => {
  const lateNight = new Date(2026, 9, 19, 2, 0, 0).getTime();
  assert.equal(E.dayKey(lateNight), "2026-10-18");
  assert.equal(E.dayKey(new Date(2026, 9, 19, 5, 0, 0).getTime()), "2026-10-19");
});

const vocab = [];
["anatomy", "symptoms", "history"].forEach((t, ti) => {
  for (let i = 1; i <= 12; i++) vocab.push({ id: `T${ti}${String(i).padStart(3, "0")}`, theme: t, niveau: i <= 8 ? "B2" : "C1", en: `w${ti}-${i}` });
});

test("new cards: lowest level first, themes alternate by packs of 5", () => {
  const order = E.orderNew(vocab, { levels: ["B2", "C1"], themeOrder: ["anatomy", "symptoms", "history"] });
  assert.equal(order.length, 36);
  assert.deepEqual(order.slice(0, 6).map(v => v.theme), ["anatomy", "anatomy", "anatomy", "anatomy", "anatomy", "symptoms"]);
  assert.ok(order.slice(0, 24).every(v => v.niveau === "B2"));
  assert.ok(order.slice(24).every(v => v.niveau === "C1"));
  const shuffled = E.orderNew(vocab, { levels: ["B2", "C1"], shuffle: true, seed: 7 });
  assert.ok(shuffled.slice(0, 24).every(v => v.niveau === "B2"), "shuffle keeps level order");
  assert.deepEqual(shuffled.map(v => v.id), E.orderNew(vocab, { levels: ["B2", "C1"], shuffle: true, seed: 7 }).map(v => v.id), "shuffle is stable");
});

test("session respects daily caps and session length", () => {
  const cards = {};
  const s = E.createSession({ vocab, cards, now: NOW, length: 20, newPerDay: 30, newDoneToday: 25, reviewsPerDay: 300, themeOrder: ["anatomy", "symptoms", "history"] });
  assert.equal(s.state.main.length, 5, "only 5 new cards left for today");
  const s2 = E.createSession({ vocab, cards, now: NOW, length: 10, newPerDay: 30 });
  assert.equal(s2.state.main.length, 10);
});

test("session: a failed card comes back after its learning step", () => {
  const cards = {};
  const s = E.createSession({ vocab: vocab.slice(0, 2), cards, now: NOW, length: 2, newPerDay: 30 });
  const first = s.next(NOW);
  s.rate(first.id, E.AGAIN, NOW);
  const second = s.next(NOW);
  assert.notEqual(second.id, first.id);
  s.rate(second.id, E.GOOD, NOW);
  // main queue empty: learn-ahead brings back the failed card (due in 1 min)
  const again = s.next(NOW + 30 * 1000);
  assert.equal(again.id, first.id);
});

test("ranks scale with the corpus size and never go down", () => {
  assert.deepEqual(P.rankThresholds(2500), [0, 50, 150, 350, 650, 1000, 1500]);
  const th = P.rankThresholds(2073);
  assert.equal(th.length, 7);
  assert.ok(th.every((t, i) => i === 0 || t > th[i - 1]));
  assert.equal(P.rankInfo(0, 2500, 3).index, 3, "best rank is kept");
  assert.equal(P.rankInfo(160, 2500, 0).index, 2);
  assert.equal(P.rankInfo(160, 2500, 0).toNext, 190);
});

test("streak with one grace day per week", () => {
  const days = {};
  const key = n => E.dayKey(E.addDays(E.dayStart(NOW), n));
  [0, -1, -2, -4, -5].forEach(n => { days[key(n)] = { answered: 10 }; });
  const s = P.streak(days, NOW);
  assert.equal(s.count, 5);
  assert.equal(s.graceDays.size, 1);
  // Two missed days in a row break the streak.
  const d2 = {};
  [0, -3].forEach(n => { d2[key(n)] = { answered: 5 }; });
  assert.equal(P.streak(d2, NOW).count, 1);
  // Today not done yet does not break it.
  const d3 = {};
  [-1, -2].forEach(n => { d3[key(n)] = { answered: 5 }; });
  assert.equal(P.streak(d3, NOW).count, 2);
});
