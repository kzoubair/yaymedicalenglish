/* Yay Medical English — interface. Uses Engine, Progress, Corrector, WordMatch, Storage, Sounds and STRINGS. */
(function () {
  "use strict";

  const S = window.STRINGS;
  const E = window.Engine;
  const P = window.Progress;
  const C = window.Corrector;
  const WM = window.WordMatch;
  const ST = window.Storage;
  const SND = window.Sounds;
  /* global VOCABULAIRE, THEMES */
  const VOCAB = VOCABULAIRE;
  const THEME_IDS = THEMES.map(t => t.id);
  const THEME_BY_ID = new Map(THEMES.map(t => [t.id, t]));
  const BY_ID = new Map(VOCAB.map(v => [v.id, v]));
  const KNOWN_WORDS = new Set(VOCAB.flatMap(v => [v.en].concat(v.alt)).map(w => C.normalize(w)));

  const $app = document.getElementById("app");
  const $overlay = document.getElementById("overlay-root");
  const $toast = document.getElementById("toast");

  let data = ST.load();
  let view = "home";
  let session = null;
  let sprint = null;
  let resetArmed = false;
  let openTheme = null;
  let tileInfo = {};

  const now = () => Date.now();
  const save = () => ST.save(data);

  // ------------------------------------------------------------ helpers
  function esc(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function withArticle(word) {
    return WM.articleFor(word) + " " + word;
  }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  function todayStats() {
    const k = E.dayKey(now());
    if (!data.days[k]) data.days[k] = { answered: 0, correct: 0, newCards: 0, reviews: 0, goalMet: false };
    return data.days[k];
  }
  function reducedMotion() {
    const r = data.settings.reduceMotion;
    return r === "on" || (r === "system" && window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function applyAppearance() {
    const t = data.settings.theme;
    const light = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches;
    const eff = t === "system" ? (light ? "light" : "dark") : t;
    document.documentElement.dataset.theme = eff;
    document.documentElement.classList.toggle("reduce-motion", reducedMotion());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", eff === "light" ? "#F2EFE9" : "#0E1116");
    SND.setEnabled(data.settings.sound);
  }
  function anchoredCount() { return P.countAnchored(VOCAB, data.cards); }
  function rankName(i) { return S.ranks[i]; }
  function themeName(id) { return S.themes[id].name; }

  function toast(msg, ms) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => $toast.classList.remove("show"), ms || 2600);
  }

  const ICON = {
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.6.85 1 1.51 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5 5 5.6 5 10.5A5 5 0 0 1 7 12.5c0-2 .9-3.4 2-4.5.2 1.6 1 2.6 2 3 0-3 .3-6 1-9Z" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  // ------------------------------------------------------------ navigation
  function go(v) {
    view = v;
    if (v !== "session") document.body.classList.remove("combo-pulse");
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (view === "home") renderHome();
    else if (view === "session") renderSession();
    else if (view === "summary") renderSummary();
    else if (view === "collection") renderCollection();
    else if (view === "settings") renderSettings();
    else if (view === "sprint") renderSprint();
    animateCounts();
  }

  function sessionOptions(t, extraNew) {
    const day = todayStats();
    const s = data.settings;
    return {
      vocab: VOCAB, cards: data.cards, now: t,
      length: s.sessionLength,
      newPerDay: extraNew ? day.newCards + extraNew : s.newPerDay,
      reviewsPerDay: s.reviewsPerDay,
      newDoneToday: day.newCards, reviewsDoneToday: day.reviews,
      themes: s.themes, levels: s.levels, shuffle: s.shuffle, seed: s.seed, themeOrder: THEME_IDS
    };
  }

  // ------------------------------------------------------------ home
  function ring(pct, size, stroke, cls) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(1, pct)));
    return `<svg class="ring ${cls || ""}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}" fill="none"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="round"/>
    </svg>`;
  }

  function renderHome() {
    const t = now();
    const counts = E.dueCounts(sessionOptions(t));
    const anchored = anchoredCount();
    const ri = P.rankInfo(anchored, VOCAB.length, data.bestRank);
    const day = todayStats();
    const goal = data.settings.dailyGoal;
    const st = P.streak(data.days, t);
    const cal = P.calendar(data.days, t, 30);
    const readyCount = THEME_IDS.filter(id => P.themeStats(VOCAB, data.cards, id).ready).length;
    const total = counts.reviews + counts.fresh + counts.learning;
    const prevTh = ri.thresholds[ri.index];
    const nextTh = ri.nextIndex === null ? prevTh : ri.thresholds[ri.nextIndex];
    const rankPct = ri.nextIndex === null ? 1 : (anchored - prevTh) / Math.max(1, nextTh - prevTh);

    $app.innerHTML = `
    <main class="screen home">
      <header class="topbar">
        <div class="brand"><span class="brand-mark" aria-hidden="true"></span>${esc(S.appName)}</div>
        <div class="topbar-actions">
          <button class="icon-btn" data-action="toggle-sound" aria-label="${esc(S.settings.sound)}" aria-pressed="${data.settings.sound}">${data.settings.sound ? ICON.sound : ICON.mute}</button>
          <button class="icon-btn" data-action="go" data-to="settings" aria-label="${esc(S.home.settings)}">${ICON.gear}</button>
        </div>
      </header>

      <section class="panel rank-panel" aria-label="Rank">
        <div class="rank-top">
          <div>
            <div class="kicker">${esc(S.home.anchored)}</div>
            <div class="big-num num" data-count="${anchored}">${anchored}</div>
          </div>
          <div class="rank-badge"><span class="rank-label">${esc(rankName(ri.index))}</span></div>
        </div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(rankPct * 100)}"><div class="bar-fill" style="transform:scaleX(${Math.max(0.02, rankPct).toFixed(3)})"></div></div>
        <p class="muted small">${ri.nextIndex === null ? esc(S.home.topRank) : esc(S.home.nextRank(ri.toNext, withArticle(rankName(ri.nextIndex))))}</p>
      </section>

      <section class="panel today">
        <div class="goal">
          ${ring(day.answered / goal, 96, 9, day.goalMet ? "done" : "")}
          <div class="goal-text">
            <div class="kicker">${esc(S.home.goal)}</div>
            <div class="goal-num num">${day.answered}<span class="muted"> / ${goal}</span></div>
            <div class="small ${day.goalMet ? "gold" : "muted"}">${day.goalMet ? esc(S.home.goalDone) : esc(S.home.goalOf(day.answered, goal))}</div>
          </div>
        </div>
        <div class="streak">
          <div class="streak-head"><span class="flame ${st.count ? "on" : ""}">${ICON.flame}</span>
            <span class="streak-num">${st.count ? esc(S.home.streak(st.count)) : esc(S.home.streakZero)}</span></div>
          <div class="calendar" aria-label="${esc(S.home.calendar)}">
            ${cal.map(d => `<span class="cal-day ${d.state} ${d.today ? "today" : ""}" title="${d.key}"></span>`).join("")}
          </div>
          <div class="tiny muted">${esc(S.home.streakNote)}</div>
        </div>
      </section>

      <section class="cta">
        ${total > 0 ? `
          <button class="btn primary big" data-action="start">${esc(S.home.start)}
            <span class="cta-sub">${[counts.reviews ? S.home.due(counts.reviews) : "", counts.learning ? S.home.learning(counts.learning) : "", counts.fresh ? S.home.fresh(counts.fresh) : ""].filter(Boolean).map(esc).join(" · ")}</span>
          </button>` : `
          <div class="panel done-panel"><div class="done-title">${esc(S.home.allDone)}</div><p class="muted small">${esc(S.home.allDoneSub)}</p>
          <button class="btn" data-action="start-extra">${esc(S.home.extra)}</button></div>`}
        <div class="cta-row">
          <button class="btn tile-btn" data-action="go" data-to="sprint"><span class="tile-icon">${ICON.bolt}</span><span><b>${esc(S.home.sprint)}</b><span class="tiny muted block">${esc(S.home.sprintSub)}</span></span></button>
          <button class="btn tile-btn" data-action="go" data-to="collection"><span class="tile-icon">${ICON.grid}</span><span><b>${esc(S.home.collection)}</b><span class="tiny muted block">${esc(S.home.situations)}: ${readyCount}/${THEME_IDS.length} ${esc(S.home.ready.toLowerCase())}</span></span></button>
        </div>
      </section>
    </main>`;
  }

  // ------------------------------------------------------------ session
  function startSession(extraNew) {
    SND.unlock();
    const t = now();
    const eng = E.createSession(Object.assign(sessionOptions(t, extraNew), { rng: Math.random }));
    session = {
      eng,
      current: null,
      kind: "flip",
      revealed: false,
      flipped: false,
      answered: false,
      mustAgain: false,
      quiz: null,
      combo: 0,
      maxCombo: 0,
      first: new Map(),
      newLearned: 0,
      startAnchored: anchoredCount(),
      startThemes: {},
      touched: new Set(),
      pendingEvents: []
    };
    THEME_IDS.forEach(id => { session.startThemes[id] = P.themeStats(VOCAB, data.cards, id).ratio; });
    nextCard();
  }

  function kindFor(card) {
    if (data.settings.mode === "flip") return "flip";
    if (E.isNew(card)) return "mcq";
    return E.isMature(card) ? "type" : "hint";
  }

  function nextCard() {
    const v = session.eng.next(now());
    if (!v) { finishSession(); return; }
    session.current = v;
    session.kind = kindFor(data.cards[v.id]);
    session.revealed = false;
    session.flipped = false;
    session.answered = false;
    session.mustAgain = false;
    session.quiz = null;
    if (session.kind === "mcq") session.quiz = { options: mcqOptions(v), chosen: null };
    view = "session";
    renderSession(true);
  }

  function mcqOptions(v) {
    let pool = VOCAB.filter(x => x.theme === v.theme && x.nature === v.nature && x.id !== v.id && x.en.toLowerCase() !== v.en.toLowerCase() && !v.alt.includes(x.en));
    if (pool.length < 3) pool = pool.concat(VOCAB.filter(x => x.nature === v.nature && x.id !== v.id && x.theme !== v.theme));
    return shuffle([v].concat(shuffle(pool).slice(0, 3)));
  }

  function highlight(sentence, v) {
    let spans = WM.findSpans(sentence, v.en, v.info);
    if (!spans.length) {
      for (const f of [v.pluriel].concat(v.alt).filter(Boolean)) {
        spans = WM.findSpans(sentence, f, v.info);
        if (spans.length) break;
      }
    }
    let out = "", pos = 0;
    spans.forEach(([a, b]) => { out += esc(sentence.slice(pos, a)) + "<strong>" + esc(sentence.slice(a, b)) + "</strong>"; pos = b; });
    return out + esc(sentence.slice(pos));
  }

  function cardFaces(v) {
    const nature = S.natures[v.nature];
    const article = v.article ? `<span class="article">${esc(v.article)} </span>` : "";
    const lines = [];
    if (v.pluriel) lines.push(`<div class="plural"><span class="muted-ink">${esc(S.card.plural)}</span> ${esc(v.pluriel)}</div>`);
    if (v.info) lines.push(`<div class="info">${esc(v.info)}</div>`);
    const leech = data.cards[v.id] && data.cards[v.id].leech ? `<span class="leech-badge">${esc(S.card.leech)}</span>` : "";
    return `
      <div class="face front">
        <div class="nature">${esc(nature)}</div>
        <div class="ar" lang="ar" dir="rtl">${esc(v.ar)}</div>
        ${session.kind === "flip" ? `<div class="tap-hint">${esc(S.card.tapToFlip)}</div>` : ""}
      </div>
      <div class="face back">
        <div class="nature">${esc(nature)}${leech}</div>
        <div class="en" lang="en">${article}${esc(v.en)}</div>
        ${lines.join("")}
        <ul class="examples" lang="en">
          <li>${highlight(v.exemple1, v)}</li>
          <li>${highlight(v.exemple2, v)}</li>
        </ul>
      </div>`;
  }

  function gradeButtons() {
    const card = data.cards[session.current.id];
    if (session.mustAgain) {
      return `<button class="btn grade grade-1 wide" data-action="rate" data-g="1">${esc(S.card.continue)}<span class="delay">${esc(E.formatDelay(E.preview(card, now())[0]))}</span></button>`;
    }
    const pv = E.preview(card, now()).map(E.formatDelay);
    return [1, 2, 3, 4].map(g => `<button class="btn grade grade-${g}" data-action="rate" data-g="${g}" aria-keyshortcuts="${g}">
      <span class="grade-name">${esc(S.grades[g - 1])}</span><span class="delay num">${esc(pv[g - 1])}</span></button>`).join("");
  }

  function answerZone() {
    const v = session.current;
    if (session.kind === "flip") return "";
    if (session.kind === "mcq") {
      const q = session.quiz;
      return `<div class="mcq" role="group" aria-label="${esc(S.card.chooseAnswer)}">
        ${q.options.map((o, i) => {
          let cls = "";
          if (q.chosen !== null) {
            if (o.id === v.id) cls = "is-correct";
            else if (i === q.chosen) cls = "is-wrong";
            else cls = "is-dim";
          }
          return `<button class="btn option ${cls}" data-action="choose" data-i="${i}" ${q.chosen !== null ? "disabled" : ""}><span class="key num">${i + 1}</span>${esc(o.en)}</button>`;
        }).join("")}
      </div>`;
    }
    const q = session.quiz;
    if (q && q.result) return feedback(q.result);
    return `<form class="typing" data-action="type-form" autocomplete="off">
      ${session.kind === "hint" ? `<div class="hint"><span class="muted">${esc(S.card.hint)}</span> <span class="hint-text num">${esc(C.hint(v.en))}</span></div>` : ""}
      <input class="type-input" type="text" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" lang="en"
        placeholder="${esc(S.card.typeHere)}" aria-label="${esc(S.card.typeHere)}">
      <div class="typing-row">
        <button type="button" class="btn ghost" data-action="dont-know">${esc(S.card.dontKnow)}</button>
        <button type="submit" class="btn primary">${esc(S.card.check)}</button>
      </div>
    </form>`;
  }

  function feedback(r) {
    const v = session.current;
    const exact = (v.article ? v.article + " " : "") + v.en;
    if (r.correct && r.exact) return `<div class="feedback good" role="status">${ICON.check}<span>${esc(S.card.correct)}</span></div>`;
    if (r.correct && r.typo) {
      const t = r.typed;
      let shown;
      if (r.typo.kind === "missing") shown = esc(t.slice(0, r.typo.index)) + '<u class="miss">_</u>' + esc(t.slice(r.typo.index));
      else shown = esc(t.slice(0, r.typo.index)) + "<u>" + esc(t[r.typo.index]) + "</u>" + esc(t.slice(r.typo.index + 1));
      return `<div class="feedback almost" role="status"><div><b>${esc(S.card.almost)}</b></div>
        <div class="small">${esc(S.card.yourAnswer)} <span class="typed">${shown}</span></div>
        <div class="small">${esc(S.card.exactForm)} <b>${esc(exact)}</b></div></div>`;
    }
    return `<div class="feedback bad" role="status"><div><b>${esc(S.card.wrong)}</b>${r.articleMissing && r.typed ? ` · <span class="small">${esc(S.card.articleNeeded)}</span>` : ""}</div>
      ${r.typed ? `<div class="small">${esc(S.card.yourAnswer)} <span class="typed">${esc(r.typed)}</span></div>` : ""}
      <div class="small">${esc(S.card.exactForm)} <b>${esc(exact)}</b></div></div>`;
  }

  function renderSession(entering) {
    if (!session || !session.current) { go("home"); return; }
    const v = session.current;
    const remaining = session.eng.remaining(now());
    const done = session.first.size;
    const pct = done / Math.max(1, done + remaining);
    const comboCls = comboClass(session.combo);
    $app.innerHTML = `
    <main class="screen session ${comboCls}">
      <header class="session-top">
        <button class="icon-btn" data-action="quit" aria-label="${esc(S.session.quit)}">${ICON.close}</button>
        <div class="bar thin"><div class="bar-fill" style="transform:scaleX(${Math.max(0.02, pct).toFixed(3)})"></div></div>
        <span class="left num small muted">${esc(S.session.left(remaining))}</span>
      </header>
      <div class="combo ${session.combo >= 2 ? "show" : ""}" aria-live="polite">
        <span class="combo-n num">${session.combo}</span><span class="combo-label">${esc(S.session.combo)}</span>
      </div>
      <div class="scene">
        <div class="card ${session.flipped ? "flipped" : ""} ${entering && !reducedMotion() ? "enter" : ""}" data-action="card" role="button" tabindex="0"
          aria-label="${esc(S.card.tapToFlipKey)}">${cardFaces(v)}</div>
        <div class="particles" aria-hidden="true"></div>
      </div>
      <div class="answer-zone">${answerZone()}</div>
      <div class="grades ${session.revealed ? "visible" : ""}">${session.revealed ? gradeButtons() : ""}</div>
    </main>`;
    const input = $app.querySelector(".type-input");
    if (input) setTimeout(() => input.focus(), 30);
  }

  function comboClass(n) {
    let c = "";
    if (n >= 3) c += " combo-3";
    if (n >= 5) c += " combo-5";
    if (n >= 10) c += " combo-10";
    if (n >= 20) c += " combo-20";
    return c;
  }

  function setFlipped(f) {
    session.flipped = f;
    const card = $app.querySelector(".card");
    if (card) { card.classList.remove("enter"); card.classList.toggle("flipped", f); }
  }

  function reveal() {
    session.revealed = true;
    setFlipped(true);
    const g = $app.querySelector(".grades");
    if (g) { g.innerHTML = gradeButtons(); g.classList.add("visible"); }
  }

  function onCardTap() {
    if (!session) return;
    if (session.kind === "flip" && !session.revealed) { SND.flip(); reveal(); return; }
    if (session.revealed) { SND.flip(); setFlipped(!session.flipped); }
  }

  function chooseOption(i) {
    const q = session.quiz;
    if (!q || q.chosen !== null || !q.options[i]) return;
    q.chosen = i;
    const ok = q.options[i].id === session.current.id;
    ok ? SND.correct() : SND.wrong();
    session.answered = true;
    session.mustAgain = !ok;
    $app.querySelector(".answer-zone").innerHTML = answerZone();
    reveal();
  }

  function submitTyping(dontKnow) {
    const input = $app.querySelector(".type-input");
    if (!input && !dontKnow) return;
    const value = dontKnow ? "" : input.value;
    if (!dontKnow && !value.trim()) { input.focus(); return; }
    const r = dontKnow ? { correct: false, typed: "", expected: "" } :
      C.check(value, session.current, { requireArticle: data.settings.requireArticle, knownWords: KNOWN_WORDS });
    session.quiz = { result: r };
    session.answered = true;
    session.mustAgain = !r.correct;
    r.correct ? SND.correct() : SND.wrong();
    if (input) input.blur();
    $app.querySelector(".answer-zone").innerHTML = answerZone();
    reveal();
  }

  function rate(g) {
    if (!session || !session.revealed || !session.current) return;
    if (session.mustAgain) g = 1;
    const v = session.current;
    const t = now();
    const themeBefore = P.themeStats(VOCAB, data.cards, v.theme);
    const res = session.eng.rate(v.id, g, t, Math.random);

    const day = todayStats();
    day.answered += 1;
    if (g > 1) day.correct += 1;
    if (res.wasNew) day.newCards += 1;
    if (res.wasReview) day.reviews += 1;
    let goalJustMet = false;
    if (!day.goalMet && day.answered >= data.settings.dailyGoal) { day.goalMet = true; goalJustMet = true; }

    if (!session.first.has(v.id)) session.first.set(v.id, g > 1);
    if (res.wasNew) session.newLearned += 1;
    session.touched.add(v.theme);

    if (g > 1) {
      session.combo += 1;
      session.maxCombo = Math.max(session.maxCombo, session.combo);
      data.longestCombo = Math.max(data.longestCombo || 0, session.combo);
    } else session.combo = 0;

    // Rank and work situations
    const anchored = anchoredCount();
    const ri = P.rankIndex(anchored, VOCAB.length);
    let promoted = null;
    if (ri > (data.bestRank || 0)) { data.bestRank = ri; promoted = ri; }
    const themeAfter = P.themeStats(VOCAB, data.cards, v.theme);
    const becameReady = !themeBefore.ready && themeAfter.ready;
    if (res.after.leech && !res.before.leech) toast(S.card.leech + ": " + v.en);
    save();

    if (g > 1 && session.kind === "flip") SND.tap();
    if (session.combo >= 2) SND.combo(session.combo);
    comboEffects();

    const continueNext = () => nextCard();
    if (promoted !== null) { showPromotion(promoted, continueNext); }
    else continueNext();
    if (becameReady) setTimeout(() => showReady(v.theme), promoted !== null ? 1700 : 50);
    if (goalJustMet) setTimeout(() => toast(S.home.goalDone), 400);
  }

  function comboEffects() {
    const n = session.combo;
    document.body.classList.toggle("combo-pulse", n >= 20 && !reducedMotion());
    if (n >= 10 && navigator.vibrate) { try { navigator.vibrate(18); } catch (e) { /* not supported */ } }
    session.burst = n >= 5 && !reducedMotion();
  }

  function burstParticles() {
    const box = $app.querySelector(".particles");
    if (!box) return;
    const colors = ["var(--accent)", "var(--good)", "var(--card)"];
    let html = "";
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.3;
      const d = 90 + Math.random() * 70;
      html += `<i style="--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px;background:${colors[i % 3]}"></i>`;
    }
    box.innerHTML = html;
    setTimeout(() => { if (box) box.innerHTML = ""; }, 800);
  }

  function finishSession() {
    document.body.classList.remove("combo-pulse");
    if (!session) { go("home"); return; }
    if (session.first.size === 0) { session.empty = true; }
    SND.finish();
    go("summary");
  }

  function renderSummary() {
    if (!session) { go("home"); return; }
    if (session.empty) {
      $app.innerHTML = `<main class="screen summary"><div class="panel center">
        <h1 class="h1">${esc(S.session.empty)}</h1><p class="muted">${esc(S.session.emptySub)}</p>
        <div class="row"><button class="btn" data-action="go" data-to="settings">${esc(S.settings.title)}</button>
        <button class="btn primary" data-action="go" data-to="home">${esc(S.summary.home)}</button></div></div></main>`;
      return;
    }
    const seen = session.first.size;
    const ok = [...session.first.values()].filter(Boolean).length;
    const success = Math.round((100 * ok) / Math.max(1, seen));
    const anchored = anchoredCount();
    const gained = anchored - session.startAnchored;
    const ri = P.rankInfo(anchored, VOCAB.length, data.bestRank);
    const themes = [...session.touched].map(id => {
      const st = P.themeStats(VOCAB, data.cards, id);
      return { id, before: session.startThemes[id] || 0, after: st.ratio, ready: st.ready };
    });
    $app.innerHTML = `
    <main class="screen summary">
      <h1 class="h1">${esc(S.summary.title)}</h1>
      <section class="stats-grid">
        <div class="stat"><div class="stat-num num" data-count="${seen}">${seen}</div><div class="stat-label">${esc(S.summary.seen)}</div></div>
        <div class="stat"><div class="stat-num num" data-count="${success}" data-suffix="%">${success}%</div><div class="stat-label">${esc(S.summary.success)}</div></div>
        <div class="stat"><div class="stat-num num" data-count="${session.newLearned}">${session.newLearned}</div><div class="stat-label">${esc(S.summary.newWords)}</div></div>
        <div class="stat"><div class="stat-num num" data-count="${session.maxCombo}">${session.maxCombo}</div><div class="stat-label">${esc(S.summary.combo)}</div></div>
      </section>
      <section class="panel">
        <div class="kicker">${esc(S.summary.anchored)}</div>
        <div class="row-between"><div class="big-num num" data-count="${anchored}">${anchored}</div><div class="small ${gained > 0 ? "gold" : "muted"}">${esc(S.summary.anchoredGained(gained))}</div></div>
        <p class="small muted">${ri.nextIndex === null ? esc(S.summary.top) : esc(S.summary.toNext(ri.toNext, withArticle(rankName(ri.nextIndex))))}</p>
      </section>
      <section class="panel">
        <div class="kicker">${esc(S.summary.situations)}</div>
        ${themes.map(th => `
          <div class="sit-row">
            <div class="sit-name">${th.ready ? `<span class="ready-check">${ICON.check}</span>` : ""}${esc(S.themes[th.id].skill)}</div>
            <div class="bar mini ${th.ready ? "gold-bar" : ""}"><div class="bar-fill" style="transform:scaleX(${Math.max(0.02, th.after).toFixed(3)})"></div></div>
            <div class="tiny muted num">${Math.round(th.before * 100)}% → <b>${Math.round(th.after * 100)}%</b></div>
          </div>`).join("")}
      </section>
      <div class="row">
        <button class="btn" data-action="go" data-to="home">${esc(S.summary.home)}</button>
        <button class="btn primary" data-action="start">${esc(S.summary.again)}</button>
      </div>
    </main>`;
  }

  function animateCounts() {
    const els = $app.querySelectorAll("[data-count]");
    if (reducedMotion() || view === "home") return;
    els.forEach(el => {
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      if (!target) return;
      const t0 = performance.now();
      const dur = 900;
      const step = ts => {
        const k = Math.min(1, (ts - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = "0" + suffix;
      requestAnimationFrame(step);
    });
  }

  function showPromotion(idx, then) {
    SND.promotion();
    $overlay.innerHTML = `<div class="promo" role="alertdialog" aria-live="assertive">
      <div class="promo-inner">
        <div class="kicker">${esc(S.promotion.title)}</div>
        <div class="promo-rank">${esc(rankName(idx))}</div>
        <div class="promo-sub">${esc(S.promotion.sub(withArticle(rankName(idx))))}</div>
      </div></div>`;
    const el = $overlay.firstElementChild;
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { $overlay.innerHTML = ""; then(); }, reducedMotion() ? 0 : 250);
    }, 1500);
  }

  function showReady(themeId) {
    SND.ready();
    const div = document.createElement("div");
    div.className = "ready-banner";
    div.setAttribute("role", "status");
    div.innerHTML = `<span class="ready-check big">${ICON.check}</span><div><div class="kicker">${esc(S.home.ready)}</div><b>${esc(S.themes[themeId].skill)}</b></div>`;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.classList.add("show"));
    setTimeout(() => { div.classList.remove("show"); setTimeout(() => div.remove(), 400); }, 3200);
  }

  // ------------------------------------------------------------ sprint
  function renderSprint() {
    if (!sprint || sprint.phase === "intro") {
      $app.innerHTML = `<main class="screen sprint">
        <header class="topbar"><button class="icon-btn" data-action="go" data-to="home" aria-label="${esc(S.session.back)}">${ICON.back}</button><div class="brand">${esc(S.sprint.title)}</div><span></span></header>
        <section class="panel center">
          <div class="sprint-icon">${ICON.bolt}</div>
          <p>${esc(S.sprint.intro)}</p>
          <p class="muted small">${esc(S.sprint.record)}: <b class="num">${data.sprintBest || 0}</b></p>
          <button class="btn primary big" data-action="sprint-start">${esc(S.sprint.start)}</button>
        </section></main>`;
      return;
    }
    if (sprint.phase === "done") {
      const acc = Math.round((100 * sprint.score) / Math.max(1, sprint.total));
      $app.innerHTML = `<main class="screen sprint">
        <h1 class="h1">${esc(S.sprint.done)}</h1>
        <section class="stats-grid three">
          <div class="stat"><div class="stat-num num" data-count="${sprint.score}">${sprint.score}</div><div class="stat-label">${esc(S.sprint.score)}</div></div>
          <div class="stat"><div class="stat-num num" data-count="${acc}" data-suffix="%">${acc}%</div><div class="stat-label">${esc(S.sprint.accuracy)}</div></div>
          <div class="stat"><div class="stat-num num" data-count="${data.sprintBest}">${data.sprintBest}</div><div class="stat-label">${esc(S.sprint.record)}</div></div>
        </section>
        ${sprint.record ? `<p class="center gold"><b>${esc(S.sprint.newRecord)}</b></p>` : ""}
        <div class="row"><button class="btn" data-action="go" data-to="home">${esc(S.sprint.home)}</button>
        <button class="btn primary" data-action="sprint-start">${esc(S.sprint.again)}</button></div></main>`;
      return;
    }
    const v = sprint.current;
    const left = Math.max(0, sprint.endAt - now());
    $app.innerHTML = `<main class="screen sprint playing">
      <header class="session-top">
        <button class="icon-btn" data-action="sprint-quit" aria-label="${esc(S.session.quit)}">${ICON.close}</button>
        <div class="bar thin timer"><div class="bar-fill" style="transform:scaleX(${(left / 60000).toFixed(3)})"></div></div>
        <span class="num small"><b class="sprint-score">${sprint.score}</b></span>
      </header>
      <div class="scene"><div class="card sprint-card"><div class="face front">
        <div class="nature">${esc(S.natures[v.nature])}</div>
        <div class="ar" lang="ar" dir="rtl">${esc(v.ar)}</div></div></div></div>
      <div class="mcq">${sprint.options.map((o, i) => {
        let cls = "";
        if (sprint.chosen !== null) cls = o.id === v.id ? "is-correct" : (i === sprint.chosen ? "is-wrong" : "is-dim");
        return `<button class="btn option ${cls}" data-action="sprint-choose" data-i="${i}" ${sprint.chosen !== null ? "disabled" : ""}><span class="key num">${i + 1}</span>${esc(o.en)}</button>`;
      }).join("")}</div>
    </main>`;
  }

  function sprintStart() {
    SND.unlock();
    const known = shuffle(VOCAB.filter(v => data.cards[v.id] && data.cards[v.id].s !== "new"));
    const rest = shuffle(VOCAB.filter(v => !data.cards[v.id] || data.cards[v.id].s === "new"));
    sprint = { phase: "play", queue: known.concat(rest), score: 0, total: 0, endAt: now() + 60000, chosen: null, record: false };
    sprintNext();
    clearInterval(sprint.timer);
    sprint.timer = setInterval(sprintTick, 200);
  }
  function sprintNext() {
    sprint.current = sprint.queue.shift();
    sprint.options = mcqOptions(sprint.current);
    sprint.chosen = null;
    view = "sprint";
    renderSprint();
  }
  function sprintTick() {
    if (!sprint || sprint.phase !== "play") return;
    const left = sprint.endAt - now();
    const fill = $app.querySelector(".timer .bar-fill");
    if (fill) fill.style.transform = `scaleX(${Math.max(0, left / 60000).toFixed(3)})`;
    if (left <= 0) sprintEnd();
  }
  function sprintChoose(i) {
    if (!sprint || sprint.phase !== "play" || sprint.chosen !== null) return;
    sprint.chosen = i;
    sprint.total += 1;
    const ok = sprint.options[i].id === sprint.current.id;
    if (ok) { sprint.score += 1; SND.correct(); } else SND.wrong();
    renderSprint();
    setTimeout(() => { if (sprint && sprint.phase === "play") sprintNext(); }, ok ? 280 : 650);
  }
  function sprintEnd() {
    clearInterval(sprint.timer);
    sprint.phase = "done";
    if (sprint.score > (data.sprintBest || 0)) { data.sprintBest = sprint.score; sprint.record = sprint.score > 0; save(); }
    SND.finish();
    renderSprint();
    animateCounts();
  }

  // ------------------------------------------------------------ collection
  function renderCollection() {
    const domains = ["medicine", "general"];
    $app.innerHTML = `<main class="screen collection">
      <header class="topbar"><button class="icon-btn" data-action="go" data-to="home" aria-label="${esc(S.session.back)}">${ICON.back}</button><div class="brand">${esc(S.collection.title)}</div><span></span></header>
      <div class="legend">${S.collection.legend.map((l, i) => `<span><i class="tile s${i}"></i>${esc(l)}</span>`).join("")}</div>
      ${domains.map(d => `
        <h2 class="h2">${esc(S.domains[d])}</h2>
        ${THEMES.filter(t => t.domain === d).map(t => themeBlock(t.id)).join("")}`).join("")}
    </main>`;
  }

  function themeBlock(id) {
    const st = P.themeStats(VOCAB, data.cards, id);
    const pct = Math.round(st.ratio * 100);
    const open = openTheme === id;
    const words = VOCAB.filter(v => v.theme === id);
    const segs = st.stages.map((n, i) => n ? `<span class="seg s${i}" style="flex:${n}"></span>` : "").join("");
    const info = tileInfo[id] ? BY_ID.get(tileInfo[id]) : null;
    return `<section class="panel theme ${st.ready ? "is-ready" : ""}">
      <div class="theme-head">
        <div class="theme-ring">${ring(st.ratio, 54, 6, st.ready ? "done" : "")}<span class="ring-pct num">${st.ready ? ICON.check : pct + "%"}</span></div>
        <div class="theme-titles">
          <div class="theme-skill">${esc(S.themes[id].skill)}${st.ready ? ` <span class="ready-pill">${esc(S.collection.ready)}</span>` : ""}</div>
          <div class="tiny muted">${esc(themeName(id))} · ${esc(S.collection.words(st.total))} · ${esc(S.collection.anchoredPct(pct))}</div>
        </div>
      </div>
      <div class="segbar" aria-hidden="true">${segs}</div>
      <button class="btn ghost small" data-action="toggle-theme" data-id="${id}" aria-expanded="${open}">${esc(open ? S.collection.hide : S.collection.show)}</button>
      ${open ? `<div class="tiles">${words.map(v => `<button class="tile s${P.stage(data.cards[v.id])}" data-action="tile" data-id="${v.id}" data-theme="${id}" aria-label="${esc(v.en)}"></button>`).join("")}</div>
        <div class="tile-info small">${info ? `<b>${esc(info.en)}</b> · <span lang="ar" dir="rtl">${esc(info.ar)}</span>` : `<span class="muted">${esc(S.collection.tapTile)}</span>`}</div>` : ""}
    </section>`;
  }

  // ------------------------------------------------------------ settings
  function seg(name, options, current) {
    return `<div class="segmented" role="radiogroup">${Object.entries(options).map(([k, label]) =>
      `<button class="seg-btn ${current === k ? "on" : ""}" role="radio" aria-checked="${current === k}" data-action="set" data-key="${name}" data-value="${k}">${esc(label)}</button>`).join("")}</div>`;
  }
  function toggle(name, on) {
    return `<button class="switch ${on ? "on" : ""}" role="switch" aria-checked="${on}" data-action="toggle" data-key="${name}"><span></span></button>`;
  }
  function stepper(name, value, step, min, max) {
    return `<div class="stepper"><button class="btn small" data-action="step" data-key="${name}" data-d="${-step}" data-min="${min}" data-max="${max}" aria-label="−">−</button>
      <span class="num stepper-val">${value}</span>
      <button class="btn small" data-action="step" data-key="${name}" data-d="${step}" data-min="${min}" data-max="${max}" aria-label="+">+</button></div>`;
  }

  function renderSettings() {
    const s = data.settings;
    const active = new Set(s.themes || THEME_IDS);
    const leeches = VOCAB.filter(v => data.cards[v.id] && data.cards[v.id].leech);
    $app.innerHTML = `<main class="screen settings">
      <header class="topbar"><button class="icon-btn" data-action="go" data-to="home" aria-label="${esc(S.session.back)}">${ICON.back}</button><div class="brand">${esc(S.settings.title)}</div><span></span></header>
      <section class="panel form">
        <div class="field"><label>${esc(S.settings.appearance)}</label>${seg("theme", S.settings.appearanceOptions, s.theme)}</div>
        <div class="field"><label>${esc(S.settings.mode)}</label>${seg("mode", S.settings.modeOptions, s.mode)}</div>
        <div class="field row-between"><div><label>${esc(S.settings.shuffle)}</label><div class="tiny muted">${esc(S.settings.shuffleHelp)}</div></div>${toggle("shuffle", s.shuffle)}</div>
        <div class="field"><label>${esc(S.settings.levels)}</label>
          <div class="chips">${["B2", "C1"].map(l => `<button class="chip ${s.levels.includes(l) ? "on" : ""}" data-action="level" data-value="${l}" aria-pressed="${s.levels.includes(l)}">${l}</button>`).join("")}</div></div>
        <div class="field"><label>${esc(S.settings.themes)}</label>
          <div class="chips">
            <button class="chip ghost-chip" data-action="themes-all">${esc(S.settings.selectAll)}</button>
            <button class="chip ghost-chip" data-action="themes-none">${esc(S.settings.selectNone)}</button>
            ${THEME_IDS.map(id => `<button class="chip ${active.has(id) ? "on" : ""}" data-action="theme" data-value="${id}" aria-pressed="${active.has(id)}">${esc(themeName(id))}</button>`).join("")}
          </div></div>
        <div class="field row-between"><label>${esc(S.settings.dailyGoal)}</label>${stepper("dailyGoal", s.dailyGoal, 10, 10, 300)}</div>
        <div class="field row-between"><label>${esc(S.settings.sessionLength)}</label>${stepper("sessionLength", s.sessionLength, 5, 5, 100)}</div>
        <div class="field row-between"><label>${esc(S.settings.newPerDay)}</label>${stepper("newPerDay", s.newPerDay, 5, 0, 200)}</div>
        <div class="field row-between"><label>${esc(S.settings.reviewsPerDay)}</label>${stepper("reviewsPerDay", s.reviewsPerDay, 50, 50, 2000)}</div>
        <div class="field row-between"><label>${esc(S.settings.requireArticle)}</label>${toggle("requireArticle", s.requireArticle)}</div>
        <div class="field row-between"><label>${esc(S.settings.sound)}</label>${toggle("sound", s.sound)}</div>
        <div class="field"><label>${esc(S.settings.reduceMotion)}</label>${seg("reduceMotion", S.settings.reduceOptions, s.reduceMotion)}</div>
      </section>
      <section class="panel">
        <h2 class="h2 flush">${esc(S.settings.problems)}</h2>
        <p class="tiny muted">${esc(S.settings.problemsHelp)}</p>
        ${leeches.length ? `<ul class="leeches">${leeches.map(v => {
          const c = data.cards[v.id];
          return `<li><div><b>${esc(v.en)}</b> <span class="tiny muted" lang="ar" dir="rtl">${esc(v.ar)}</span><div class="tiny muted num">${c.lapses} lapses</div></div>
            <div class="row tight"><button class="btn small" data-action="leech-reset" data-id="${v.id}">${esc(S.settings.resetCard)}</button>
            <button class="btn small" data-action="leech-suspend" data-id="${v.id}">${esc(c.suspended ? S.settings.unsuspend : S.settings.suspend)}</button></div></li>`;
        }).join("")}</ul>` : `<p class="small muted">${esc(S.settings.noProblems)}</p>`}
      </section>
      <section class="panel">
        <h2 class="h2 flush">${esc(S.settings.data)}</h2>
        <div class="stack">
          <button class="btn" data-action="export">${esc(S.settings.exportBtn)}</button>
          <label class="btn file-btn">${esc(S.settings.importBtn)}<input type="file" accept="application/json,.json" data-action="import" hidden></label>
          <button class="btn danger ${resetArmed ? "armed" : ""}" data-action="reset">${esc(resetArmed ? S.settings.resetConfirm : S.settings.reset)}</button>
        </div>
      </section>
      <section class="panel"><h2 class="h2 flush">${esc(S.settings.about)}</h2><p class="small muted">${esc(S.settings.aboutText(VOCAB.length))}</p></section>
    </main>`;
  }

  function changeSetting(key, value) {
    data.settings[key] = value;
    save();
    applyAppearance();
    renderSettings();
  }

  // ------------------------------------------------------------ events
  document.addEventListener("click", ev => {
    const el = ev.target.closest("[data-action]");
    if (!el) return;
    const a = el.dataset.action;
    if (a !== "reset" && resetArmed) { resetArmed = false; }
    switch (a) {
      case "go": if (el.dataset.to === "sprint") sprint = { phase: "intro" }; go(el.dataset.to); break;
      case "start": startSession(); break;
      case "start-extra": startSession(10); break;
      case "quit": finishSession(); break;
      case "card": onCardTap(); break;
      case "rate": rate(+el.dataset.g); break;
      case "choose": chooseOption(+el.dataset.i); break;
      case "dont-know": submitTyping(true); break;
      case "toggle-sound": data.settings.sound = !data.settings.sound; save(); applyAppearance(); if (data.settings.sound) SND.tap(); renderHome(); break;
      case "sprint-start": sprintStart(); break;
      case "sprint-choose": sprintChoose(+el.dataset.i); break;
      case "sprint-quit": clearInterval(sprint.timer); sprint = { phase: "intro" }; go("home"); break;
      case "toggle-theme": openTheme = openTheme === el.dataset.id ? null : el.dataset.id; renderCollection(); break;
      case "tile": tileInfo[el.dataset.theme] = el.dataset.id; {
        const box = el.closest(".theme").querySelector(".tile-info");
        const v = BY_ID.get(el.dataset.id);
        box.innerHTML = `<b>${esc(v.en)}</b> · <span lang="ar" dir="rtl">${esc(v.ar)}</span>`;
      } break;
      case "set": changeSetting(el.dataset.key, el.dataset.value); break;
      case "toggle": changeSetting(el.dataset.key, !data.settings[el.dataset.key]); break;
      case "step": {
        const k = el.dataset.key;
        const val = Math.min(+el.dataset.max, Math.max(+el.dataset.min, data.settings[k] + +el.dataset.d));
        changeSetting(k, val);
      } break;
      case "level": {
        const set = new Set(data.settings.levels);
        set.has(el.dataset.value) ? set.delete(el.dataset.value) : set.add(el.dataset.value);
        if (!set.size) return;
        changeSetting("levels", ["B2", "C1"].filter(l => set.has(l)));
      } break;
      case "theme": {
        const set = new Set(data.settings.themes || THEME_IDS);
        set.has(el.dataset.value) ? set.delete(el.dataset.value) : set.add(el.dataset.value);
        if (!set.size) return;
        changeSetting("themes", set.size === THEME_IDS.length ? null : THEME_IDS.filter(id => set.has(id)));
      } break;
      case "themes-all": changeSetting("themes", null); break;
      case "themes-none": changeSetting("themes", [THEME_IDS[0]]); break;
      case "leech-reset": { const c = data.cards[el.dataset.id]; data.cards[el.dataset.id] = Object.assign(E.newCard(), { suspended: !!(c && c.suspended) }); save(); renderSettings(); } break;
      case "leech-suspend": { const c = data.cards[el.dataset.id]; c.suspended = !c.suspended; save(); renderSettings(); } break;
      case "export": exportProgress(); break;
      case "reset":
        if (!resetArmed) { resetArmed = true; renderSettings(); }
        else { resetArmed = false; data = ST.reset(); applyAppearance(); toast(S.settings.resetDone); renderSettings(); }
        break;
      default: break;
    }
  });

  document.addEventListener("submit", ev => {
    if (ev.target.matches("[data-action=type-form]")) { ev.preventDefault(); submitTyping(false); }
  });

  document.addEventListener("change", ev => {
    if (ev.target.matches("[data-action=import]")) {
      const file = ev.target.files[0];
      if (!file) return;
      file.text().then(text => {
        try { data = ST.importJSON(text); save(); applyAppearance(); toast(S.settings.imported); renderSettings(); }
        catch (e) { toast(S.settings.importError); }
      });
    }
  });

  function exportProgress() {
    const blob = new Blob([ST.exportJSON(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yay-medical-english-progress-${E.dayKey(now())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.addEventListener("keydown", ev => {
    const inInput = ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA");
    if (view === "session" && session) {
      if (ev.key === "Escape") { ev.preventDefault(); finishSession(); return; }
      if (inInput) return; // Enter submits the form natively
      if (ev.key === " " || ev.code === "Space") { ev.preventDefault(); onCardTap(); return; }
      if (/^[1-4]$/.test(ev.key)) {
        ev.preventDefault();
        const n = +ev.key;
        if (session.kind === "mcq" && !session.answered) chooseOption(n - 1);
        else if (session.revealed) rate(session.mustAgain ? 1 : n);
        return;
      }
      if (ev.key === "Enter") {
        if (ev.target.closest && ev.target.closest("button")) return; // let the focused button act
        ev.preventDefault();
        if (session.revealed) rate(session.mustAgain ? 1 : 3);
        else if (session.kind === "flip") onCardTap();
      }
      return;
    }
    if (view === "sprint" && sprint && sprint.phase === "play") {
      if (ev.key === "Escape") { clearInterval(sprint.timer); sprint = { phase: "intro" }; go("home"); return; }
      if (/^[1-4]$/.test(ev.key)) { ev.preventDefault(); sprintChoose(+ev.key - 1); }
      return;
    }
    if (ev.key === "Escape" && view !== "home") { ev.preventDefault(); go("home"); return; }
    if (view === "home" && ev.key === "Enter" && !(ev.target.closest && ev.target.closest("button"))) {
      const b = $app.querySelector("[data-action=start],[data-action=start-extra]");
      if (b) { ev.preventDefault(); b.click(); }
    }
  });

  // Particle bursts are triggered after the next card is rendered.
  const observer = new MutationObserver(() => {
    if (view === "session" && session && session.burst) { session.burst = false; burstParticles(); }
  });
  observer.observe($app, { childList: true });

  if (window.matchMedia) {
    matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (data.settings.theme === "system") applyAppearance(); });
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", applyAppearance);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && view === "home") renderHome(); });

  // ------------------------------------------------------------ service worker
  let updateRequested = false;
  function registerSW() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").then(reg => {
      const offerUpdate = worker => {
        const bar = document.getElementById("update-bar");
        bar.innerHTML = `<span>${esc(S.update.available)}</span><button class="btn small primary" id="update-btn">${esc(S.update.reload)}</button>`;
        bar.classList.add("show");
        document.getElementById("update-btn").addEventListener("click", () => { updateRequested = true; worker.postMessage({ type: "SKIP_WAITING" }); });
      };
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed") {
            if (navigator.serviceWorker.controller) offerUpdate(w);
            else toast(S.offline);
          }
        });
      });
    }).catch(() => { /* offline support unavailable */ });
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Reload only when the learner asked for the update (not when the first install takes control).
      if (reloading || !updateRequested) return;
      reloading = true;
      location.reload();
    });
  }

  // Expose a tiny hook for automated browser checks.
  window.YME = { get data() { return data; }, get session() { return session; }, get view() { return view; }, save, render, go };

  applyAppearance();
  render();
  registerSW();
})();
