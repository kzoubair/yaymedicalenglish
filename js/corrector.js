/* Yay Medical English — typed-answer corrector.
 * Tolerates case, spaces, punctuation, curly or straight apostrophes, hyphens or spaces,
 * and one wrong letter (shown underlined, with the exact form displayed again).
 * Works in the browser (window.Corrector) and in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Corrector = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ARTICLES = /^(a|an|the)\s+/;
  const POSSESSIVES = ["my", "your", "his", "her", "its", "our", "their", "one's"];

  /** Normalized comparison form. keepArticle: do not drop a leading a / an / the. */
  function normalize(s, keepArticle) {
    let t = String(s || "").normalize("NFKC").toLowerCase();
    t = t.replace(/[‘’‛′`´]/g, "'");          // curly apostrophes -> straight
    t = t.replace(/[“”«»]/g, '"');
    t = t.replace(/[‐-―−-]/g, " ");                // hyphens and dashes -> space
    t = t.replace(/[.,;:!?"()\[\]{}…/\\]/g, " ");                  // punctuation
    t = t.replace(/\s+/g, " ").trim();
    if (!keepArticle) t = t.replace(ARTICLES, "");
    return t;
  }

  /** Expand dictionary placeholders (sb, sth, one's) into the forms a learner may type. */
  function expand(answer) {
    let variants = [answer];
    const swap = (re, options) => {
      const out = [];
      variants.forEach(v => {
        if (!re.test(v)) { out.push(v); return; }
        options.forEach(o => out.push(v.replace(re, o).replace(/\s+/g, " ").trim()));
      });
      variants = out;
    };
    swap(/\bsb's\b/i, ["someone's", "somebody's", ""]);
    swap(/\bsb\b/i, ["someone", "somebody", "sb", ""]);
    swap(/\bsth\b/i, ["something", "sth", ""]);
    swap(/\bone's\b/i, POSSESSIVES.concat([""]));
    swap(/\boneself\b/i, ["oneself", "myself", "yourself", "himself", "herself", "themselves", ""]);
    return [...new Set(variants)];
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 1) return 2;
    const prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      for (let j = 0; j <= n; j++) prev[j] = cur[j];
    }
    return prev[n];
  }

  /** Locate the single difference between typed and expected (distance 1). */
  function locateTypo(typed, expected) {
    let i = 0;
    while (i < typed.length && i < expected.length && typed[i] === expected[i]) i++;
    if (typed.length === expected.length) return { kind: "substitution", index: i, expectedChar: expected[i] };
    if (typed.length > expected.length) return { kind: "extra", index: i };
    return { kind: "missing", index: i, expectedChar: expected[i] };
  }

  /**
   * Check a typed answer.
   * entry: vocabulary entry { en, alt, article, nature }
   * opts:  { requireArticle: bool, knownWords: Set of normalized headwords (to refuse a typo that is another real word) }
   * returns { correct, exact, typo, typed, expected }
   */
  function check(input, entry, opts) {
    opts = opts || {};
    const needArticle = !!(opts.requireArticle && entry.article);
    const typed = normalize(input, false);
    const candidates = [];
    [entry.en].concat(entry.alt || []).forEach(a => expand(a).forEach(v => candidates.push(normalize(v, false))));
    const expected = normalize(entry.en, false);
    const result = { correct: false, exact: false, typo: null, typed, expected, articleMissing: false };
    if (!typed) return result;
    if (needArticle) {
      const m = /^(a|an)\s+/.exec(normalize(input, true));
      if (!m || m[1] !== entry.article) {
        result.articleMissing = true;   // the word may be right, but the article is required
        return result;
      }
    }
    if (candidates.includes(typed)) { result.correct = true; result.exact = true; return result; }
    if (opts.knownWords && opts.knownWords.has(typed)) return result; // "ache" is not a typo of "acne"
    for (const cand of candidates) {
      if (cand.replace(/[^a-z]/g, "").length < 4) continue;          // no tolerance on very short words
      if (levenshtein(typed, cand) === 1) {
        result.correct = true;
        result.typo = locateTypo(typed, cand);
        result.expected = cand;
        return result;
      }
    }
    return result;
  }

  /** Hint for typing: first letter of each word, the rest as underscores. */
  function hint(en) {
    return String(en).split(/(\s+|-)/).map(part => {
      if (/^\s+$/.test(part) || part === "-") return part;
      return part.replace(/[A-Za-z0-9]/g, (ch, i) => (i === 0 ? ch : "_"));
    }).join("");
  }

  return { normalize, expand, levenshtein, locateTypo, check, hint };
});
