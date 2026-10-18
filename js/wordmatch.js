/* Yay Medical English — word matching helpers.
 * Shared by the browser (to bold the headword in examples) and by
 * tools/build-vocab.js (to check that both examples contain the word,
 * and that every a / an agrees with the sound of the following word). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WordMatch = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Common irregular verbs: base -> other forms (past, past participle, -ing quirks).
  const IRREGULAR = {
    arise: ["arose", "arisen"], awake: ["awoke", "awoken"], bear: ["bore", "borne", "born"],
    beat: ["beaten"], become: ["became"], begin: ["began", "begun"], bend: ["bent"],
    bind: ["bound"], bite: ["bit", "bitten"], bleed: ["bled"], blow: ["blew", "blown"],
    break: ["broke", "broken"], breed: ["bred"], bring: ["brought"], build: ["built"],
    burn: ["burnt"], burst: [], buy: ["bought"], catch: ["caught"], choose: ["chose", "chosen"],
    cling: ["clung"], come: ["came"], cost: [], creep: ["crept"], cut: [], deal: ["dealt"],
    dig: ["dug"], do: ["did", "done", "does"], draw: ["drew", "drawn"], drink: ["drank", "drunk"],
    drive: ["drove", "driven"], eat: ["ate", "eaten"], fall: ["fell", "fallen"], feed: ["fed"],
    feel: ["felt"], fight: ["fought"], find: ["found"], flee: ["fled"], fly: ["flew", "flown", "flies"],
    forbid: ["forbade", "forbidden"], foresee: ["foresaw", "foreseen"], forget: ["forgot", "forgotten"],
    forgive: ["forgave", "forgiven"], freeze: ["froze", "frozen"], get: ["got", "gotten"],
    give: ["gave", "given"], go: ["went", "gone", "goes"], grind: ["ground"], grow: ["grew", "grown"],
    hang: ["hung"], have: ["had", "has"], hear: ["heard"], hide: ["hid", "hidden"], hit: [],
    hold: ["held"], hurt: [], keep: ["kept"], kneel: ["knelt"], know: ["knew", "known"],
    lay: ["laid"], lead: ["led"], lean: ["leant"], leave: ["left"], lend: ["lent"], let: [],
    lie: ["lay", "lain", "lying"], light: ["lit"], lose: ["lost"], make: ["made"], mean: ["meant"],
    meet: ["met"], mislead: ["misled"], overcome: ["overcame"], overtake: ["overtook", "overtaken"],
    oversee: ["oversaw", "overseen"], pay: ["paid"], put: [], quit: [], read: [], rid: [],
    ride: ["rode", "ridden"], ring: ["rang", "rung"], rise: ["rose", "risen"], run: ["ran"],
    say: ["said"], see: ["saw", "seen"], seek: ["sought"], sell: ["sold"], send: ["sent"],
    set: [], shake: ["shook", "shaken"], shed: [], shoot: ["shot"], show: ["shown"],
    shrink: ["shrank", "shrunk"], shut: [], sink: ["sank", "sunk"], sit: ["sat"], sleep: ["slept"],
    slide: ["slid"], speak: ["spoke", "spoken"], spend: ["spent"], spin: ["spun"], split: [],
    spread: [], stand: ["stood"], steal: ["stole", "stolen"], stick: ["stuck"], sting: ["stung"],
    strike: ["struck", "stricken"], swear: ["swore", "sworn"], sweep: ["swept"], swell: ["swelled", "swollen"],
    swim: ["swam", "swum"], swing: ["swung"], take: ["took", "taken"], teach: ["taught"],
    tear: ["tore", "torn"], tell: ["told"], think: ["thought"], throw: ["threw", "thrown"],
    undergo: ["underwent", "undergone", "undergoes"], understand: ["understood"],
    undertake: ["undertook", "undertaken"], upset: [], wake: ["woke", "woken"], wear: ["wore", "worn"],
    weep: ["wept"], win: ["won"], wind: ["wound"], withdraw: ["withdrew", "withdrawn"],
    withhold: ["withheld"], withstand: ["withstood"], write: ["wrote", "written"],
    be: ["is", "are", "was", "were", "been", "being", "am", "'s", "'re", "’s", "’re"]
  };

  // Placeholders in headwords that are never searched for in examples.
  const PLACEHOLDERS = new Set(["sb", "sth", "someone", "something", "one's", "someone's",
    "one’s", "someone’s", "oneself", "sb's", "sb’s"]);
  // Short function words: matched only exactly and never sufficient on their own.
  const SMALL = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "up",
    "out", "off", "as", "or", "and", "with", "from", "into", "be", "is", "it", "its", "no",
    "not", "so", "all", "one", "per", "via", "down", "over", "back", "away", "about"]);

  function norm(s) {
    return s.toLowerCase().replace(/’/g, "'");
  }

  function stem(t) {
    const n = t.length;
    if (n <= 3) return t;
    if (n === 4) return t.slice(0, 3);
    if (n <= 6) return t.slice(0, n - 1);
    return t.slice(0, n - 2);
  }

  /** Extra forms declared in an entry's info, e.g. "irregular: bled, bled". */
  function infoForms(info) {
    const m = /irregular:\s*([^;)]+)/i.exec(info || "");
    if (!m) return [];
    return m[1].split(/[,/]/).map(s => norm(s.trim())).filter(Boolean);
  }

  /** Tokens of a headword with the forms that count as a match. */
  function headTokens(headword, info) {
    const cleaned = norm(headword).replace(/\([^)]*\)/g, " ");
    const raw = cleaned.split(/[\s/]+/).map(t => t.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "")).filter(Boolean);
    const extra = infoForms(info);
    return raw.filter(t => !PLACEHOLDERS.has(t)).map((t, i) => {
      const small = SMALL.has(t);
      const forms = new Set([t]);
      (IRREGULAR[t] || []).forEach(f => forms.add(f));
      if (i === 0 || raw.length === 1) extra.forEach(f => forms.add(f));
      return { token: t, small, stem: small ? null : stem(t), forms };
    });
  }

  function tokenMatches(word, tk) {
    const w = norm(word);
    if (tk.forms.has(w)) return true;
    if (tk.small) return false;
    // Hyphenated headwords ("follow-up") also match "follow up" split across words.
    return w.startsWith(tk.stem);
  }

  const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;

  /** Character spans [start, end) in `sentence` that should be shown in bold. */
  function findSpans(sentence, headword, info) {
    const tks = headTokens(headword, info);
    const words = [];
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(sentence))) {
      let text = m[0].replace(/['’]s$/, "");
      const parts = [{ text, start: m.index }];
      // Allow "follow-up" to match the stem "follow" and "up", and vice versa.
      const hyph = text.split("-");
      if (hyph.length > 1) {
        let off = m.index;
        hyph.forEach(p => { parts.push({ text: p, start: off, sub: true }); off += p.length + 1; });
      }
      let content = false, any = false;
      for (const p of parts) {
        for (const tk of tks) {
          if (tokenMatches(p.text, tk) || tokenMatches(text, tk)) {
            any = true;
            if (!tk.small) content = true;
          }
        }
      }
      words.push({ start: m.index, end: m.index + text.length, any, content });
    }
    // Group consecutive matched words into runs; keep runs that contain a content match.
    const spans = [];
    // Headwords made only of short words ("on and off") need a run of 2+ matched words.
    const allSmall = tks.every(t => t.small);
    if (allSmall) words.forEach(w => { if (w.any) w.content = true; });
    let run = null;
    words.forEach(w => {
      if (w.any) {
        if (run) { run.end = w.end; run.content = run.content || w.content; run.n++; }
        else run = { start: w.start, end: w.end, content: w.content, n: 1 };
      } else if (run) { if (run.content && (!allSmall || run.n > 1)) spans.push([run.start, run.end]); run = null; }
    });
    if (run && run.content && (!allSmall || run.n > 1)) spans.push([run.start, run.end]);
    return spans;
  }

  /** Validator rule: every content token of the headword must appear in the sentence. */
  function containsHeadword(sentence, headword, info) {
    const tks = headTokens(headword, info);
    const content = tks.filter(t => !t.small);
    const needed = content.length ? content : tks;
    const words = (sentence.match(WORD_RE) || []).flatMap(w => {
      const base = w.replace(/['’]s$/, "");
      return [base].concat(base.includes("-") ? base.split("-") : []);
    });
    const joined = norm(sentence);
    return needed.every(tk => words.some(w => tokenMatches(w, tk)) ||
      (tk.token.includes("-") && (joined.includes(tk.token) || joined.includes(tk.token.replace(/-/g, " ")))));
  }

  // ---------- a / an ----------
  const WORD_ACRONYMS = { NSAID: "an", NSAIDS: "an", ECMO: "an", AIDS: "an", OSCE: "an", OSCES: "an",
    ERAS: "an", SBAR: "an", NSTEMI: "an", HIPAA: "a", COVID: "a", "COVID-19": "a", STEMI: "a",
    NICU: "a", PICU: "a", PACU: "a", SOAP: "a", CABG: "a", GERD: "a", MRSA: "a", SARS: "a",
    MEDLINE: "a", PUBMED: "a", JAMA: "a", PHD: "a", OB: "an", "OB-GYN": "an" };
  const LETTER_AN = new Set("AEFHILMNORSX".split(""));

  /** Expected article before `token` in American English, or null if undecidable. */
  function articleFor(token) {
    let t = token.replace(/^[("“'‘]+/, "").replace(/[)"”'’.,;:!?]+$/, "");
    if (!t) return null;
    const head = t.split(/[-\s]/)[0];
    const upper = t.toUpperCase();
    if (WORD_ACRONYMS[upper]) return WORD_ACRONYMS[upper];
    if (WORD_ACRONYMS[head.toUpperCase()] && head.length > 1 && head === head.toUpperCase()) return WORD_ACRONYMS[head.toUpperCase()];
    if (/^\d/.test(t)) {
      if (/^8/.test(t) || /^1[18](?!\d)/.test(t) || /^1[18]\d{3}(?!\d)/.test(t)) return "an";
      return "a";
    }
    // Initialisms spelled letter by letter (MRI, ECG, ICU, X-ray, H&P, IV).
    if ((head.length >= 2 && /^[A-Z][A-Z0-9&]*$/.test(head)) || /^[A-Z](-|&)/.test(t) || /^[A-Z]$/.test(head)) {
      return LETTER_AN.has(head[0]) ? "an" : "a";
    }
    const w = t.toLowerCase();
    if (/^(hour|honest|honor|heir|herb)/.test(w)) return "an";
    if (/^(one\b|one-|once|uni(?!nsur|ntend|nterr|nform|dent|mport|mpres|magin|nhib|nfect|nvit|ntell)|use|usu|ure|uri|uro|uter|uti|uvu|ubiq|unanim|eu|ewe|u-)/.test(w)) return "a";
    return /^[aeiou]/.test(w) ? "an" : "a";
  }

  // Words after which a capital "A" is a label (vitamin A, hepatitis A, Plan A), not an article.
  const LABEL_BEFORE = /(vitamin|hepatitis|type|grade|class|plan|influenza|group|step|part|section|zone|box|level|room|wing|ward|bed|floor|exhibit|appendix|figure|table|option|answer|column|row)$/i;

  /** Returns a list of a/an problems found in a sentence. */
  function checkArticles(sentence) {
    const issues = [];
    const re = /(^|[^A-Za-z0-9'’-])(a|an|A|An)\s+([A-Za-z0-9“"‘(][A-Za-z0-9&'’-]*)/g;
    let m;
    while ((m = re.exec(sentence))) {
      const art = m[2];
      const idx = m.index + m[1].length;
      const before = sentence.slice(0, idx).trimEnd();
      if (/^A/.test(art) && before.length && !/[.!?:"“]$/.test(before)) continue; // capital A mid-sentence
      if (LABEL_BEFORE.test(before)) continue;
      const expected = articleFor(m[3]);
      if (expected && expected !== art.toLowerCase()) {
        issues.push(`"${art} ${m[3]}" should be "${expected} ${m[3]}"`);
      }
      re.lastIndex = m.index + m[0].length - m[3].length;
    }
    return issues;
  }

  return { IRREGULAR, findSpans, containsHeadword, articleFor, checkArticles, headTokens, stem };
});
