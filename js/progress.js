/* Yay Medical English — mastery-based progression (no points).
 * Ranks from anchored words, work situations per theme, day streak with weekly grace.
 * Pure logic, usable in the browser (window.Progress) and in Node.
 */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./engine.js") : root.Engine);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Progress = api;
})(typeof self !== "undefined" ? self : this, function (Engine) {
  "use strict";

  // Thresholds designed for 2,500 entries; they are scaled to the real corpus size.
  const BASE_TOTAL = 2500;
  const BASE_THRESHOLDS = [0, 50, 150, 350, 650, 1000, 1500];
  const SITUATION_READY = 0.8;

  function rankThresholds(total) {
    const scale = total / BASE_TOTAL;
    return BASE_THRESHOLDS.map(t => (t === 0 ? 0 : Math.max(10, Math.round((t * scale) / 10) * 10)));
  }

  function rankIndex(anchored, total) {
    const th = rankThresholds(total);
    let r = 0;
    th.forEach((t, i) => { if (anchored >= t) r = i; });
    return r;
  }

  /** { index, next, toNext } — the displayed rank never goes below the best rank ever reached. */
  function rankInfo(anchored, total, bestIndex) {
    const th = rankThresholds(total);
    const current = rankIndex(anchored, total);
    const index = Math.max(current, bestIndex || 0);
    const nextIndex = index + 1 < th.length ? index + 1 : null;
    return {
      index,
      current,
      thresholds: th,
      nextIndex,
      toNext: nextIndex === null ? 0 : Math.max(0, th[nextIndex] - anchored)
    };
  }

  function countAnchored(vocab, cards) {
    let n = 0;
    for (const v of vocab) if (Engine.isAnchored(cards[v.id])) n++;
    return n;
  }

  /** Stage of a word for the collection colors: 0 new, 1 learning, 2 young, 3 maturing, 4 anchored. */
  function stage(card) {
    if (!card || card.s === "new") return 0;
    if (card.s !== "review") return 1;
    if (card.ivl >= Engine.CONFIG.matureInterval) return 4;
    if (card.ivl >= 7) return 3;
    return 2;
  }

  function themeStats(vocab, cards, themeId) {
    const list = vocab.filter(v => v.theme === themeId);
    const stages = [0, 0, 0, 0, 0];
    list.forEach(v => { stages[stage(cards[v.id])]++; });
    const anchored = stages[4];
    const ratio = list.length ? anchored / list.length : 0;
    return { total: list.length, stages, anchored, ratio, ready: ratio >= SITUATION_READY };
  }

  // ------------------------------------------------------------ streak
  function isoWeekKey(ts) {
    const d = new Date(ts);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  /**
   * days: { "YYYY-MM-DD": { answered, goalMet } }. A day counts when at least one card was answered.
   * One missed day per calendar week (Mon-Sun) is forgiven automatically.
   * Returns { count, graceDays: Set(keys) }.
   */
  function streak(days, now) {
    const graceDays = new Set();
    const weeksUsed = new Set();
    let cursor = Engine.dayStart(now);
    const todayKey = Engine.dayKey(now);
    let count = 0;
    // Today does not break the streak if it is not done yet.
    if (!(days[todayKey] && days[todayKey].answered > 0)) cursor = Engine.addDays(cursor, -1);
    for (let i = 0; i < 3650; i++) {
      const key = Engine.dayKey(cursor);
      const active = days[key] && days[key].answered > 0;
      if (active) { count++; }
      else {
        const wk = isoWeekKey(cursor);
        // Grace only bridges a gap between active days: it never extends a streak into the past.
        const before = Engine.dayKey(Engine.addDays(cursor, -1));
        const prevActive = days[before] && days[before].answered > 0;
        if (!weeksUsed.has(wk) && prevActive && count > 0) { weeksUsed.add(wk); graceDays.add(key); }
        else break;
      }
      cursor = Engine.addDays(cursor, -1);
    }
    return { count, graceDays };
  }

  /** Last 30 days for the calendar: [{ key, state: "goal" | "active" | "grace" | "none" | "today" }]. */
  function calendar(days, now, n) {
    n = n || 30;
    const { graceDays } = streak(days, now);
    const out = [];
    let cursor = Engine.addDays(Engine.dayStart(now), -(n - 1));
    const todayKey = Engine.dayKey(now);
    for (let i = 0; i < n; i++) {
      const key = Engine.dayKey(cursor);
      const d = days[key];
      let state = "none";
      if (d && d.goalMet) state = "goal";
      else if (d && d.answered > 0) state = "active";
      else if (graceDays.has(key)) state = "grace";
      out.push({ key, state, today: key === todayKey, date: new Date(cursor) });
      cursor = Engine.addDays(cursor, 1);
    }
    return out;
  }

  return { BASE_THRESHOLDS, SITUATION_READY, rankThresholds, rankIndex, rankInfo, countAnchored, stage, themeStats, streak, calendar };
});
