/* Yay Medical English — short sounds synthesized with Web Audio (no audio files). */
(function (root) {
  "use strict";

  let ctx = null;
  let enabled = true;

  function audio() {
    if (!enabled) return null;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, opts) {
    const a = audio();
    if (!a) return;
    opts = opts || {};
    const t0 = a.currentTime + start;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const peak = opts.volume || 0.12;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const Sounds = {
    setEnabled(v) { enabled = !!v; },
    isEnabled() { return enabled; },
    /** Must be called from a user gesture once so mobile browsers allow audio. */
    unlock() { audio(); },
    flip() { tone(520, 0, 0.07, { type: "triangle", volume: 0.05, slideTo: 760 }); },
    correct() { tone(660, 0, 0.09, { type: "sine" }); tone(990, 0.07, 0.12, { type: "sine", volume: 0.1 }); },
    wrong() { tone(220, 0, 0.16, { type: "triangle", volume: 0.09, slideTo: 170 }); },
    tap() { tone(440, 0, 0.04, { type: "sine", volume: 0.04 }); },
    combo(n) {
      const base = 520 * Math.pow(2, Math.min(n, 24) / 24);
      tone(base, 0, 0.08, { type: "square", volume: 0.035 });
    },
    /** Short major arpeggio for a promotion. */
    promotion() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.32, { type: "triangle", volume: 0.11 }));
    },
    ready() { [587.33, 880].forEach((f, i) => tone(f, i * 0.1, 0.25, { type: "sine", volume: 0.1 })); },
    finish() { [392, 523.25, 659.25].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: "sine", volume: 0.09 })); },
    tick() { tone(1200, 0, 0.03, { type: "square", volume: 0.025 }); }
  };

  root.Sounds = Sounds;
})(typeof self !== "undefined" ? self : this);
