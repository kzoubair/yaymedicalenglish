#!/usr/bin/env node
/* Yay Medical English — vocabulary validator and generator.
 *
 * Reads the compact source files in data/*.txt (one entry per line), validates
 * every entry and writes vocabulaire.js. Any error blocks the generation.
 *
 *   node tools/build-vocab.js           validate + generate
 *   node tools/build-vocab.js --check   validate only
 *
 * Source line format (fields separated by " | "):
 *   ID | english | arabic | level | nature | article | plural | info | alt | example 1 | example 2
 *   nature:  n (noun), v (verb), adj (adjective), adv (adverb), expr (expression)
 *   article: a / an for countable nouns, "-" otherwise
 *   alt:     other accepted answers separated by ";"
 * A file starts with:  @theme <themeId> <ID-PREFIX> <domain>
 */
"use strict";
const fs = require("fs");
const path = require("path");
const WM = require("../js/wordmatch.js");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const OUT = path.join(ROOT, "vocabulaire.js");
const CHECK_ONLY = process.argv.includes("--check");

const NATURES = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", expr: "expression" };
const LEVELS = ["B2", "C1"];
const MIN_PER_THEME_NATURE = 4;

// British spellings that must not appear in an American English corpus.
const BRITISH = [
  /\bhaem/i, /anaem/i, /\boedem/i, /\boesoph/i, /gastro-?oesoph/i, /paediat/i, /anaesth/i, /\bfoet/i, /diarrhoe/i, /oestr/i, /ischaem/i,
  /leukaem/i, /orthopaed/i, /gynaec/i, /colour/i, /tumour/i, /labour/i, /behaviour/i, /favour/i,
  /honour/i, /humour/i, /centre/i, /litre/i, /metre\b/i, /fibre/i, /programme/i, /\bcheque/i,
  /travelling/i, /counselling/i, /cancelled/i, /judgement/i, /\bgrey/i, /practise/i, /licence/i,
  /defence/i, /offence/i, /aluminium/i, /\bmum\b/i, /\blorry/i, /\bqueue/i,
  /\b(organi|reali|recogni|hospitali|stabili|immobili|steri|immuni|minimi|apologi|summari|prioriti|speciali|catheteri|anaesthet|critici|emphasi|categori|standardi|randomi|analy)s(e|ed|es|ing|ation)\b/i,
  /analyse\b/i, /paralyse/i, /dialyse/i, /enrol\b/i, /fulfil\b/i, /skilful/i, /plough/i, /tyre/i, /kerb/i,
  /\bmobile phone/i, /\bpetrol/i, /\bpavement/i, /\bgp\b/i, /\bA&E\b/, /\bcasualty department/i,
  /\bpostcode/i, /\btimetable/i, /\bfortnight/i, /\bcar park/i, /\bground floor/i
];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---------------------------------------------------------------- self-test
// The a / an cross-check must catch injected mistakes before we trust it.
function selfTest() {
  const mustFail = [
    "The patient has a ulcer on the left foot.", "We ordered a MRI of the spine.",
    "She needs an urinalysis today.", "He was admitted for a hour.", "It is an useful sign.",
    "A elderly man presents with chest pain.", "Start an NICU transfer.", "He gave a honest answer.",
    "She had an X-ray and a ECG."
  ];
  const mustPass = [
    "The patient has an ulcer on the left foot.", "We ordered an MRI of the spine.",
    "She needs a urinalysis today.", "He waited for an hour.", "It is a useful sign.",
    "An elderly man presents with chest pain.", "She has a history of hepatitis A infection.",
    "An 82-year-old woman and a 45-year-old man were admitted.", "He is an NSAID user with a UTI.",
    "We need an IV line, an ICU bed and a CT scan.", "She is a USMLE candidate with an ECFMG certificate.",
    "A unique case of a unilateral effusion in an uninsured patient."
  ];
  const fails = [];
  mustFail.forEach(s => { if (WM.checkArticles(s).length === 0) fails.push(`not detected: ${s}`); });
  mustPass.forEach(s => { const i = WM.checkArticles(s); if (i.length) fails.push(`false alarm: ${s} -> ${i}`); });
  // Headword detection must also work on inflected and irregular forms.
  const contain = [
    ["The wound bled for an hour.", "bleed", "irregular: bled, bled"],
    ["We palpated the abdomen gently.", "palpate", ""],
    ["The follow up visit is next week.", "follow-up", ""],
    ["Two biopsies were taken.", "biopsy", ""],
    ["She underwent surgery last year.", "undergo", ""]
  ];
  contain.forEach(([s, w, info]) => { if (!WM.containsHeadword(s, w, info)) fails.push(`headword not found: ${w} in ${s}`); });
  if (WM.containsHeadword("The patient is stable.", "unstable", "")) fails.push("false headword match: unstable");
  if (fails.length) {
    console.error("SELF-TEST FAILED — the validator cannot be trusted:\n  " + fails.join("\n  "));
    process.exit(2);
  }
  console.log(`Self-test OK: ${mustFail.length} injected a/an errors detected, ${mustPass.length} correct sentences accepted.`);
}

// ---------------------------------------------------------------- checks
function checkSentence(where, s, entry) {
  if (!s) return err(where, "missing example");
  if (s !== s.trim()) err(where, "leading or trailing space");
  if (/\s{2,}/.test(s)) err(where, "double space");
  if (!/^["“]?[A-Z]/.test(s)) err(where, `must start with a capital letter: ${s}`);
  if (!/[.!?]["”]?$/.test(s)) err(where, `must end with . ! or ?: ${s}`);
  if (/\s[,.;:!?]/.test(s)) err(where, `space before punctuation: ${s}`);
  if (/[,;:][A-Za-z]/.test(s)) err(where, `missing space after punctuation: ${s}`);
  if (/[؀-ۿ]/.test(s)) err(where, "Arabic characters in an English example");
  if (/'/.test(s) && /’/.test(s)) err(where, "mixed straight and curly apostrophes");
  if (s.length > 170) warn(where, `example is long (${s.length} chars)`);
  if (s.split(/\s+/).length < 5) err(where, `example too short: ${s}`);
  const q = (s.match(/"/g) || []).length;
  if (q % 2) err(where, "unbalanced quotes");
  if ((s.match(/\(/g) || []).length !== (s.match(/\)/g) || []).length) err(where, "unbalanced parentheses");
  WM.checkArticles(s).forEach(i => err(where, `article: ${i} in "${s}"`));
  BRITISH.forEach(re => { if (re.test(s)) err(where, `British spelling or term (${re}) in "${s}"`); });
  if (!WM.containsHeadword(s, entry.en, entry.info) && !entry.alt.concat(entry.pluriel ? [entry.pluriel] : []).some(a => WM.containsHeadword(s, a, entry.info))) {
    err(where, `headword "${entry.en}" not found in: ${s}`);
  }
}

function normAr(s) {
  return s.replace(/[ً-ٰٟ]/g, "").replace(/[()\s«»"]+/g, " ").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim();
}
function normEn(s) {
  return s.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------- parse
function parse() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".txt")).sort();
  const themes = [];
  const entries = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(DATA_DIR, file), "utf8").split(/\r?\n/);
    let theme = null;
    lines.forEach((line, i) => {
      const where = `${file}:${i + 1}`;
      if (!line.trim() || line.startsWith("#")) return;
      if (line.startsWith("@theme")) {
        const [, id, prefix, domain] = line.trim().split(/\s+/);
        theme = { id, prefix, domain };
        if (themes.some(t => t.id === id || t.prefix === prefix)) err(where, `theme ${id} declared twice`);
        themes.push(theme);
        return;
      }
      if (!theme) return err(where, "entry before @theme header");
      const f = line.split(" | ");
      if (f.length !== 11) return err(where, `expected 11 fields, found ${f.length}`);
      const [id, en, ar, niveau, nat, art, pluriel, info, alt, ex1, ex2] = f.map(x => x.trim());
      const e = {
        id, ar, en, niveau, theme: theme.id, nature: NATURES[nat] || nat,
        article: art === "-" ? "" : art, pluriel: pluriel === "-" ? "" : pluriel,
        info: info === "-" ? "" : info,
        alt: alt === "-" ? [] : alt.split(";").map(a => a.trim()).filter(Boolean),
        exemple1: ex1, exemple2: ex2, _where: where, _prefix: theme.prefix, _domain: theme.domain, _rawNature: nat
      };
      entries.push(e);
    });
  }
  return { themes, entries };
}

function validate(themes, entries) {
  const ids = new Map(), ens = new Map(), ars = new Map(), exs = new Map();
  for (const e of entries) {
    const w = `${e._where} ${e.id}`;
    if (!new RegExp(`^${e._prefix}\\d{3}$`).test(e.id)) err(w, `id must be ${e._prefix} + 3 digits`);
    if (ids.has(e.id)) err(w, `duplicate id (also ${ids.get(e.id)})`); else ids.set(e.id, e._where);
    if (!e.en || e.en !== e.en.trim() || /\s{2,}/.test(e.en)) err(w, "bad English headword spacing");
    if (/[؀-ۿ]/.test(e.en)) err(w, "Arabic in English headword");
    BRITISH.forEach(re => { if (re.test(e.en)) err(w, `British spelling in headword ${e.en}`); });
    if (!/[؀-ۿ]/.test(e.ar)) err(w, "Arabic translation missing");
    if (/[A-Za-z]/.test(e.ar)) err(w, `Latin letters in Arabic translation: ${e.ar}`);
    if (!LEVELS.includes(e.niveau)) err(w, `level must be B2 or C1, got ${e.niveau}`);
    if (!NATURES[e._rawNature]) err(w, `unknown nature ${e._rawNature}`);
    if (e.nature === "noun") {
      if (!["a", "an", ""].includes(e.article)) err(w, `article must be a, an or -, got ${e.article}`);
      if (e.article) {
        const expected = WM.articleFor(e.en.split(" ")[0]);
        if (expected !== e.article) err(w, `article "${e.article}" does not match the sound of "${e.en}" (expected ${expected})`);
      }
    } else {
      if (e.article) err(w, "article only applies to nouns");
      if (e.pluriel) err(w, "plural only applies to nouns");
    }
    if (e.pluriel && normEn(e.pluriel) === normEn(e.en)) err(w, "plural identical to singular");
    e.alt.forEach(a => { if (normEn(a) === normEn(e.en)) err(w, `alt "${a}" equals headword`); });
    const k = normEn(e.en);
    if (ens.has(k)) err(w, `duplicate English headword "${e.en}" (also ${ens.get(k)})`); else ens.set(k, e.id);
    const ka = normAr(e.ar);
    if (ars.has(ka)) warn(w, `duplicate Arabic translation "${e.ar}" (also ${ars.get(ka)})`); else ars.set(ka, e.id);
    checkSentence(`${w} ex1`, e.exemple1, e);
    checkSentence(`${w} ex2`, e.exemple2, e);
    if (e.exemple1 === e.exemple2) err(w, "both examples are identical");
    [e.exemple1, e.exemple2].forEach(x => { if (exs.has(x)) warn(w, `example reused from ${exs.get(x)}`); else exs.set(x, e.id); });
  }
  // alt answers that collide with another entry's headword make typed answers ambiguous
  for (const e of entries) {
    e.alt.forEach(a => {
      const other = ens.get(normEn(a));
      if (other && other !== e.id) warn(`${e._where} ${e.id}`, `alt "${a}" is the headword of ${other}`);
    });
  }
  // Every theme x nature pair must hold enough entries for multiple-choice distractors.
  for (const t of themes) {
    const counts = {};
    entries.filter(e => e.theme === t.id).forEach(e => { counts[e.nature] = (counts[e.nature] || 0) + 1; });
    Object.entries(counts).forEach(([nat, c]) => {
      if (c < MIN_PER_THEME_NATURE) err(`theme ${t.id}`, `only ${c} ${nat}(s): at least ${MIN_PER_THEME_NATURE} needed for multiple choice`);
    });
  }
}

// ---------------------------------------------------------------- output
function js(s) { return JSON.stringify(s); }

function generate(themes, entries) {
  const out = [];
  out.push("/* Yay Medical English — vocabulary.");
  out.push(" * GENERATED by tools/build-vocab.js from data/*.txt — do not edit by hand.");
  out.push(` * ${entries.length} entries, generated ${new Date().toISOString().slice(0, 10)}. */`);
  out.push('"use strict";');
  out.push("");
  out.push("// Target language of the cards (the question side is always Arabic).");
  out.push('const TARGET_LANGUAGE = "en-US";');
  out.push("");
  out.push("const THEMES = " + JSON.stringify(themes.map(t => ({ id: t.id, prefix: t.prefix, domain: t.domain }))) + ";");
  out.push("");
  out.push("const VOCABULAIRE = [");
  const order = { B2: 0, C1: 1 };
  for (const t of themes) {
    const list = entries.filter(e => e.theme === t.id).sort((a, b) => order[a.niveau] - order[b.niveau] || a.id.localeCompare(b.id));
    out.push("");
    out.push(`  // ===================== Theme: ${t.id} (${t.domain}) — ${list.length} entries =====================`);
    for (const lvl of LEVELS) {
      const sub = list.filter(e => e.niveau === lvl);
      if (!sub.length) continue;
      out.push(`  // ----- ${t.id} · level ${lvl} (${sub.length}) -----`);
      for (const e of sub) {
        out.push(`  {id:${js(e.id)}, ar:${js(e.ar)}, en:${js(e.en)}, niveau:${js(e.niveau)}, theme:${js(e.theme)}, nature:${js(e.nature)}, article:${js(e.article)}, pluriel:${js(e.pluriel)}, info:${js(e.info)}, alt:${js(e.alt)}, exemple1:${js(e.exemple1)}, exemple2:${js(e.exemple2)}},`);
      }
    }
  }
  out.push("];");
  out.push("");
  out.push('if (typeof module === "object" && module.exports) module.exports = { TARGET_LANGUAGE, THEMES, VOCABULAIRE };');
  out.push("");
  fs.writeFileSync(OUT, out.join("\n"));
}

function stats(themes, entries) {
  const byDomain = {};
  entries.forEach(e => { byDomain[e._domain] = (byDomain[e._domain] || 0) + 1; });
  console.log(`\n${entries.length} entries — ` + Object.entries(byDomain).map(([d, c]) => `${d}: ${c} (${Math.round(c * 100 / entries.length)}%)`).join(", "));
  for (const t of themes) {
    const l = entries.filter(e => e.theme === t.id);
    const nat = {};
    l.forEach(e => { nat[e.nature] = (nat[e.nature] || 0) + 1; });
    const b2 = l.filter(e => e.niveau === "B2").length;
    console.log(`  ${t.id.padEnd(14)} ${String(l.length).padStart(4)}  B2 ${String(b2).padStart(3)} / C1 ${String(l.length - b2).padStart(3)}  ` +
      Object.entries(nat).map(([k, v]) => `${k} ${v}`).join(", "));
  }
}

selfTest();
const { themes, entries } = parse();
validate(themes, entries);
stats(themes, entries);
if (warnings.length) console.warn(`\n${warnings.length} warning(s):\n  ` + warnings.join("\n  "));
if (errors.length) {
  console.error(`\n${errors.length} error(s) — vocabulaire.js NOT generated:\n  ` + errors.join("\n  "));
  process.exit(1);
}
if (!CHECK_ONLY) {
  generate(themes, entries);
  console.log(`\nvocabulaire.js written (${entries.length} entries).`);
} else console.log("\nAll checks passed.");
