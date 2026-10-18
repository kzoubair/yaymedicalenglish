/* Yay Medical English — progress storage (versioned localStorage, separate from the app cache). */
(function (root) {
  "use strict";

  const KEY = "yme-progress";
  const VERSION = 1;

  const DEFAULT_SETTINGS = {
    theme: "dark",            // "system" | "dark" | "light"
    mode: "flip",             // "flip" | "quiz"
    shuffle: false,
    themes: null,             // null = all themes
    levels: ["B2", "C1"],
    dailyGoal: 40,
    sessionLength: 20,
    newPerDay: 30,
    reviewsPerDay: 300,
    requireArticle: false,
    sound: true,
    reduceMotion: "system",   // "system" | "on" | "off"
    seed: 0
  };

  function fresh() {
    return {
      version: VERSION,
      created: Date.now(),
      cards: {},              // id -> card state
      days: {},               // "YYYY-MM-DD" -> { answered, correct, newCards, reviews, goalMet }
      bestRank: 0,
      sprintBest: 0,
      longestCombo: 0,
      settings: Object.assign({}, DEFAULT_SETTINGS, { seed: Math.floor(Math.random() * 1e9) })
    };
  }

  /** Bring older saves up to the current version. */
  function migrate(data) {
    if (!data || typeof data !== "object") return fresh();
    const out = Object.assign(fresh(), data);
    out.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    if (!out.settings.seed) out.settings.seed = Math.floor(Math.random() * 1e9);
    out.cards = data.cards || {};
    out.days = data.days || {};
    out.version = VERSION;
    return out;
  }

  let memory = null; // fallback when localStorage is unavailable (private mode, blocked storage)

  function load() {
    try {
      const raw = root.localStorage.getItem(KEY);
      if (!raw) return fresh();
      return migrate(JSON.parse(raw));
    } catch (e) {
      return memory ? migrate(memory) : fresh();
    }
  }

  function save(data) {
    memory = data;
    try {
      root.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportJSON(data) {
    return JSON.stringify({ app: "yay-medical-english", exported: new Date().toISOString(), data }, null, 2);
  }

  /** Accepts an export file (or a raw save). Throws on invalid content. */
  function importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.app === "yay-medical-english" ? parsed.data : parsed;
    if (!data || typeof data !== "object" || typeof data.cards !== "object") throw new Error("invalid file");
    return migrate(data);
  }

  function reset() {
    const data = fresh();
    save(data);
    return data;
  }

  root.Storage = { KEY, VERSION, DEFAULT_SETTINGS, load, save, exportJSON, importJSON, reset, fresh, migrate };
})(typeof self !== "undefined" ? self : this);
