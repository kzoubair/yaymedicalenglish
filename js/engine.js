/* Yay Medical English — spaced-repetition engine (Anki-style SM-2).
 * Pure logic: no DOM, no storage. Works in the browser (window.Engine) and in Node.
 *
 * Card state: { s, step, due, ivl, ease, reps, lapses, leech, suspended }
 *   s     "new" | "learning" | "review" | "relearning"
 *   due   timestamp (ms). Review cards are due at the start of a day (4 a.m. rollover).
 *   ivl   current interval in days (review), or the interval to resume after relearning.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CONFIG = {
    learnSteps: [1, 10],        // minutes, new cards
    relearnSteps: [10],         // minutes, lapsed review cards
    graduateGood: 1,            // days
    graduateEasy: 4,            // days
    startEase: 2.5,
    minEase: 1.3,
    easeAgain: -0.20,
    easeHard: -0.15,
    easeEasy: 0.15,
    hardFactor: 1.2,
    easyBonus: 1.3,
    lapseFactor: 0.5,
    minLapseInterval: 1,        // days
    fuzz: 0.05,                 // ±5 %
    leechThreshold: 8,          // lapses
    matureInterval: 21,         // days: the word is "anchored"
    learnAheadMinutes: 20,
    dayRolloverHour: 4
  };

  const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;
  const MINUTE = 60 * 1000;

  // ------------------------------------------------------------ days
  function dayStart(now) {
    const d = new Date(now);
    if (d.getHours() < CONFIG.dayRolloverHour) d.setDate(d.getDate() - 1);
    d.setHours(CONFIG.dayRolloverHour, 0, 0, 0);
    return d.getTime();
  }
  function addDays(ts, n) {
    const d = new Date(ts);
    d.setDate(d.getDate() + n); // calendar arithmetic keeps the hour across DST changes
    return d.getTime();
  }
  function dayKey(now) {
    const d = new Date(dayStart(now));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // ------------------------------------------------------------ cards
  function newCard() {
    return { s: "new", step: 0, due: 0, ivl: 0, ease: CONFIG.startEase, reps: 0, lapses: 0, leech: false, suspended: false };
  }
  function normalize(card) {
    return Object.assign(newCard(), card || {});
  }
  function isNew(card) { return !card || card.s === "new"; }
  function isLearning(card) { return !!card && (card.s === "learning" || card.s === "relearning"); }
  function isAnchored(card) { return !!card && card.s === "review" && card.ivl >= CONFIG.matureInterval; }
  function isMature(card) { return isAnchored(card); }

  function fuzzed(days, rng) {
    if (!rng) return Math.max(1, Math.round(days));
    const f = 1 + (rng() * 2 - 1) * CONFIG.fuzz;
    return Math.max(1, Math.round(days * f));
  }

  /** Raw (unfuzzed) intervals in days for a review card. Each button gives at least one more day than the previous one. */
  function reviewIntervals(card) {
    const ivl = Math.max(1, card.ivl);
    const hard = Math.max(ivl + 1, Math.round(ivl * CONFIG.hardFactor));
    const good = Math.max(hard + 1, Math.round(ivl * card.ease));
    const easy = Math.max(good + 1, Math.round(ivl * card.ease * CONFIG.easyBonus));
    return { hard, good, easy };
  }

  function hardStepMinutes(steps, step) {
    if (step === 0 && steps.length > 1) return Math.round((steps[0] + steps[1]) / 2);
    return steps[Math.min(step, steps.length - 1)];
  }

  /**
   * Apply a rating. Returns a new card object (the input is not modified).
   * grade: 1 Again, 2 Hard, 3 Good, 4 Easy. rng: optional () => [0,1) for the ±5 % fuzz.
   */
  function answer(cardIn, grade, now, rng) {
    if (![AGAIN, HARD, GOOD, EASY].includes(grade)) throw new Error("grade must be 1-4");
    const c = normalize(cardIn);
    const today = dayStart(now);
    c.reps += 1;
    c.lastReview = now;

    const graduate = days => {
      c.s = "review";
      c.step = 0;
      c.ivl = fuzzed(days, rng);
      c.due = addDays(today, c.ivl);
    };

    if (c.s === "new") { c.s = "learning"; c.step = 0; }

    if (c.s === "learning") {
      const steps = CONFIG.learnSteps;
      if (grade === AGAIN) { c.step = 0; c.due = now + steps[0] * MINUTE; }
      else if (grade === HARD) { c.due = now + hardStepMinutes(steps, c.step) * MINUTE; }
      else if (grade === GOOD) {
        if (c.step + 1 >= steps.length) graduate(CONFIG.graduateGood);
        else { c.step += 1; c.due = now + steps[c.step] * MINUTE; }
      } else graduate(CONFIG.graduateEasy);
      return c;
    }

    if (c.s === "review") {
      if (grade === AGAIN) {
        c.lapses += 1;
        c.ease = Math.max(CONFIG.minEase, round2(c.ease + CONFIG.easeAgain));
        c.ivl = Math.max(CONFIG.minLapseInterval, Math.round(c.ivl * CONFIG.lapseFactor));
        c.s = "relearning";
        c.step = 0;
        c.due = now + CONFIG.relearnSteps[0] * MINUTE;
        if (c.lapses >= CONFIG.leechThreshold) c.leech = true;
        return c;
      }
      const iv = reviewIntervals(c);
      let days;
      if (grade === HARD) { days = iv.hard; c.ease = Math.max(CONFIG.minEase, round2(c.ease + CONFIG.easeHard)); }
      else if (grade === GOOD) days = iv.good;
      else { days = iv.easy; c.ease = round2(c.ease + CONFIG.easeEasy); }
      c.ivl = fuzzed(days, rng);
      c.due = addDays(today, c.ivl);
      return c;
    }

    // relearning
    const steps = CONFIG.relearnSteps;
    if (grade === AGAIN) { c.step = 0; c.due = now + steps[0] * MINUTE; }
    else if (grade === HARD) { c.due = now + hardStepMinutes(steps, c.step) * MINUTE; }
    else if (grade === GOOD) {
      if (c.step + 1 >= steps.length) { c.s = "review"; c.step = 0; c.due = addDays(today, c.ivl); }
      else { c.step += 1; c.due = now + steps[c.step] * MINUTE; }
    } else { c.s = "review"; c.step = 0; c.ivl = c.ivl + 1; c.due = addDays(today, c.ivl); }
    return c;
  }

  function round2(x) { return Math.round(x * 100) / 100; }

  /** Predicted delay for each button, without fuzz: [{ minutes } | { days }] for Again, Hard, Good, Easy. */
  function preview(cardIn, now) {
    const c = normalize(cardIn);
    return [AGAIN, HARD, GOOD, EASY].map(g => {
      const r = answer(c, g, now);
      if (r.s === "review") return { days: r.ivl };
      return { minutes: Math.round((r.due - now) / MINUTE) };
    });
  }

  function formatDelay(p) {
    if (p.minutes !== undefined) {
      if (p.minutes < 60) return Math.max(1, p.minutes) + " min";
      return Math.round(p.minutes / 60) + " h";
    }
    const d = p.days;
    if (d < 30) return d + (d === 1 ? " day" : " days");
    if (d < 365) return trim1(d / 30.4) + " mo";
    return trim1(d / 365) + (d < 730 ? " yr" : " yrs");
  }
  function trim1(x) { return (Math.round(x * 10) / 10).toString(); }

  function isDue(card, now) {
    if (!card || card.suspended) return false;
    if (card.s === "review") return card.due <= dayStart(now);
    if (isLearning(card)) return card.due <= now;
    return false;
  }

  // ------------------------------------------------------------ new-card order
  /** Lowest level first; inside a level, themes alternate in packs of 5 (or a stable shuffle). */
  function orderNew(vocab, opts) {
    const levels = opts.levels || ["B2", "C1"];
    const themeOrder = opts.themeOrder || [];
    const out = [];
    for (const lvl of levels) {
      const items = vocab.filter(v => v.niveau === lvl);
      if (opts.shuffle) {
        out.push(...seededShuffle(items, (opts.seed || 1) + lvl.charCodeAt(1)));
        continue;
      }
      const byTheme = new Map();
      themeOrder.forEach(t => byTheme.set(t, []));
      items.forEach(v => { if (!byTheme.has(v.theme)) byTheme.set(v.theme, []); byTheme.get(v.theme).push(v); });
      const lists = [...byTheme.values()].map(l => l.slice().sort((a, b) => a.id.localeCompare(b.id))).filter(l => l.length);
      let i = 0;
      while (lists.some(l => i < l.length)) {
        lists.forEach(l => out.push(...l.slice(i, i + 5)));
        i += 5;
      }
    }
    return out;
  }

  function seededShuffle(arr, seed) {
    const a = arr.slice();
    const rng = mulberry32(seed);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------ session
  /**
   * Build a study session.
   * opts: { vocab, cards: {id: state}, now, length, newPerDay, reviewsPerDay, newDoneToday, reviewsDoneToday,
   *         themes: [ids] | null, levels: [..], shuffle, seed, themeOrder, rng }
   */
  function createSession(opts) {
    const now = opts.now;
    const cards = opts.cards;
    const allowedThemes = opts.themes ? new Set(opts.themes) : null;
    const allowedLevels = new Set(opts.levels || ["B2", "C1"]);
    const eligible = opts.vocab.filter(v => (!allowedThemes || allowedThemes.has(v.theme)) && allowedLevels.has(v.niveau) && !(cards[v.id] && cards[v.id].suspended));
    const byId = new Map(opts.vocab.map(v => [v.id, v]));
    const learnAhead = CONFIG.learnAheadMinutes * MINUTE;

    const learning = eligible.filter(v => isLearning(cards[v.id])).map(v => v.id);
    const reviews = eligible.filter(v => cards[v.id] && cards[v.id].s === "review" && isDue(cards[v.id], now))
      .sort((a, b) => cards[a.id].due - cards[b.id].due || a.id.localeCompare(b.id)).map(v => v.id);
    const newOrdered = orderNew(eligible.filter(v => isNew(cards[v.id])), opts).map(v => v.id);

    const length = Math.max(1, opts.length || 20);
    const newLeft = Math.max(0, (opts.newPerDay ?? 30) - (opts.newDoneToday || 0));
    const reviewsLeft = Math.max(0, (opts.reviewsPerDay ?? 300) - (opts.reviewsDoneToday || 0));
    const learningNow = learning.filter(id => cards[id].due <= now + learnAhead).length;
    const room = Math.max(0, length - learningNow);
    const newAvail = Math.min(newLeft, newOrdered.length);
    const revAvail = Math.min(reviewsLeft, reviews.length);
    const reserveNew = Math.min(newAvail, Math.ceil(room / 4));
    const takeRev = Math.min(revAvail, room - reserveNew);
    const takeNew = Math.min(newAvail, room - takeRev);
    const revPart = reviews.slice(0, takeRev);
    const newPart = newOrdered.slice(0, takeNew);

    // Spread the new cards evenly among the reviews.
    const main = [];
    const total = revPart.length + newPart.length;
    let ri = 0, ni = 0;
    for (let k = 0; k < total; k++) {
      const n = newPart.length;
      const wantNew = Math.floor((k + 1) * n / total) > Math.floor(k * n / total);
      main.push(wantNew && ni < n ? newPart[ni++] : (ri < revPart.length ? revPart[ri++] : newPart[ni++]));
    }

    const state = {
      cards,                       // live map, updated by answer()
      main,
      learning: learning.slice(),  // ids currently in (re)learning
      seen: new Set(),
      newIntroduced: 0,
      reviewsDone: 0,
      initialCount: main.length + learningNow,
      byId
    };

    function next(t) {
      const due = state.learning.filter(id => state.cards[id].due <= t).sort((a, b) => state.cards[a].due - state.cards[b].due);
      if (due.length) return byId.get(due[0]);
      if (state.main.length) return byId.get(state.main[0]);
      const ahead = state.learning.filter(id => state.cards[id].due <= t + learnAhead).sort((a, b) => state.cards[a].due - state.cards[b].due);
      if (ahead.length) return byId.get(ahead[0]);
      return null;
    }

    function rate(id, grade, t, rng) {
      const before = normalize(state.cards[id]);
      const after = answer(before, grade, t, rng || opts.rng);
      state.cards[id] = after;
      const mi = state.main.indexOf(id);
      if (mi >= 0) state.main.splice(mi, 1);
      const li = state.learning.indexOf(id);
      if (isLearning(after)) { if (li < 0) state.learning.push(id); }
      else if (li >= 0) state.learning.splice(li, 1);
      const wasNew = before.s === "new";
      if (wasNew) state.newIntroduced += 1;
      if (before.s === "review") state.reviewsDone += 1;
      state.seen.add(id);
      return {
        before, after, wasNew, wasReview: before.s === "review",
        anchoredBefore: isAnchored(before), anchoredAfter: isAnchored(after)
      };
    }

    function remaining(t) {
      return state.main.length + state.learning.filter(id => state.cards[id].due <= t + learnAhead).length;
    }

    return { next, rate, remaining, state };
  }

  /** Counts used by the home screen: due reviews, (re)learning, new available today. */
  function dueCounts(opts) {
    const s = createSession(Object.assign({}, opts, { length: 100000 }));
    const t = opts.now;
    return {
      learning: s.state.learning.filter(id => opts.cards[id].due <= t + CONFIG.learnAheadMinutes * MINUTE).length,
      reviews: s.state.main.filter(id => opts.cards[id] && opts.cards[id].s === "review").length,
      fresh: s.state.main.filter(id => isNew(opts.cards[id])).length
    };
  }

  return {
    CONFIG, AGAIN, HARD, GOOD, EASY,
    newCard, normalize, answer, preview, formatDelay, reviewIntervals,
    isNew, isLearning, isAnchored, isMature, isDue,
    dayStart, dayKey, addDays, orderNew, seededShuffle, mulberry32,
    createSession, dueCounts
  };
});
