/* GRE Words Practice — local-first vocabulary trainer.
   No build step, no backend. All progress lives in this browser's localStorage. */
'use strict';
(function () {
  // ───────────────────────────── helpers ─────────────────────────────
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAY = 86_400_000;
  const pad = n => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const uniqBy = (a, f) => { const seen = new Set(); return a.filter(x => { const k = f(x); if (seen.has(k)) return false; seen.add(k); return true; }); };
  const fmtInterval = days => {
    if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))}m`;
    if (days < 1) return `${Math.round(days * 24)}h`;
    if (days < 30) return `${Math.round(days * 10) / 10}d`;
    if (days < 365) return `${Math.round(days / 30 * 10) / 10}mo`;
    return `${Math.round(days / 365 * 10) / 10}y`;
  };
  const relDue = ts => { const d = ts - Date.now(); if (d <= 0) return 'due now'; return 'in ' + fmtInterval(d / DAY); };
  const fmtTime = ms => { const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${pad(s % 60)}s`; };

  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('storage', e); } },
    del(k) { try { localStorage.removeItem(k); } catch { } },
  };

  let toastTimer;
  function toast(msg, ms = 2200) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="box">${html}</div>`; m.hidden = false; return m; }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  // ───────────────────────────── fun bits: mascot, sounds, confetti ─────────────────────────────
  function mascot(mood = 'happy', cls = '') {
    const mouth = {
      happy: '<path d="M36 58 q10 10 20 0" stroke="#2d5a00" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
      party: '<path d="M33 56 q13 18 26 0 z" fill="#2d5a00"/><path d="M38 60 q8 6 16 0" fill="#ff86d0"/>',
      think: '<path d="M38 60 h14" stroke="#2d5a00" stroke-width="3.5" stroke-linecap="round"/>',
      sad: '<path d="M36 62 q10 -9 20 0" stroke="#2d5a00" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    }[mood] || '';
    const brows = mood === 'think' ? '<path d="M28 34 l10 3 M64 34 l-10 3" stroke="#2d5a00" stroke-width="3" stroke-linecap="round"/>' : mood === 'sad' ? '<path d="M28 36 l10 -3 M64 36 l-10 -3" stroke="#2d5a00" stroke-width="3" stroke-linecap="round"/>' : '';
    const extra = mood === 'party' ? '<text x="70" y="22" font-size="16">🎉</text>' : mood === 'think' ? '<text x="68" y="24" font-size="14">💭</text>' : '';
    return `<svg class="mascot ${cls}" viewBox="0 0 92 92" aria-hidden="true">
      <ellipse cx="46" cy="84" rx="26" ry="4" fill="rgba(0,0,0,.12)"/>
      <circle cx="46" cy="50" r="32" fill="#58cc02"/>
      <circle cx="46" cy="50" r="32" fill="none" stroke="#46a302" stroke-width="3"/>
      <path d="M14 30 L46 16 L78 30 L46 44 Z" fill="#3c3c3c"/><rect x="42" y="30" width="8" height="14" rx="2" fill="#3c3c3c"/>
      <path d="M72 31 v10" stroke="#ffc800" stroke-width="3" stroke-linecap="round"/><circle cx="72" cy="43" r="3" fill="#ffc800"/>
      <circle cx="35" cy="48" r="7" fill="#fff"/><circle cx="57" cy="48" r="7" fill="#fff"/>
      <circle cx="36.5" cy="49" r="3.2" fill="#3c3c3c"/><circle cx="58.5" cy="49" r="3.2" fill="#3c3c3c"/>
      <circle cx="37.5" cy="47.5" r="1" fill="#fff"/><circle cx="59.5" cy="47.5" r="1" fill="#fff"/>
      <circle cx="27" cy="58" r="4" fill="#ff86d0" opacity=".7"/><circle cx="65" cy="58" r="4" fill="#ff86d0" opacity=".7"/>
      ${brows}${mouth}${extra}</svg>`;
  }
  const TIPS = {
    home: ['Ready to grow your word garden?', 'A few minutes a day beats a cram the night before.', 'Words you say out loud stick twice as well.', 'Tap a circle on the path to start.', 'Review what is due first, then learn new words.'],
    review: ['Say the meaning out loud before you flip.', 'Be honest with the rating. Future you will thank you.', 'Picture the mnemonic. Weird images stick.', 'Do you remember this one?'],
    quiz: ['Trust your first instinct.', 'Look for the root inside the word.', 'Eliminate the two that are clearly wrong first.'],
    listen: ['Great for a walk or a commute.', 'Repeat the word after me!', 'Loop a cluster until it feels easy.'],
  };
  const tip = k => pick(TIPS[k]);

  const sfx = {
    ctx: null,
    play(kind) {
      if (!S.sound) return;
      try {
        this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
        const c = this.ctx, t0 = c.currentTime;
        const seq = { ok: [[523, 0], [659, .07], [784, .14]], no: [[247, 0], [196, .14]], flip: [[440, 0]], win: [[523, 0], [659, .1], [784, .2], [1047, .3], [1319, .45]], tap: [[660, 0]] }[kind] || [];
        for (const [f, t] of seq) {
          const o = c.createOscillator(), g = c.createGain();
          o.type = kind === 'no' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t0 + t); g.gain.exponentialRampToValueAtTime(kind === 'tap' ? .05 : .12, t0 + t + .012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + (kind === 'win' ? .3 : .18));
          o.connect(g).connect(c.destination); o.start(t0 + t); o.stop(t0 + t + .35);
        }
      } catch { }
    },
  };
  function confetti(n = 70) {
    const colors = ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff', '#ffc800', '#2bd2c5', '#ff86d0'];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = 'confetti';
      el.style.left = Math.random() * 100 + 'vw'; el.style.background = pick(colors);
      el.style.animationDuration = 1.6 + Math.random() * 1.6 + 's'; el.style.animationDelay = Math.random() * .6 + 's';
      el.style.transform = `rotate(${Math.random() * 360}deg)`; el.style.width = 6 + Math.random() * 8 + 'px';
      document.body.appendChild(el); setTimeout(() => el.remove(), 3600);
    }
  }
  function floatXP(n) {
    const el = document.createElement('div'); el.className = 'xp-float'; el.textContent = `+${n} XP`;
    el.style.left = 'calc(50% - 30px)'; el.style.bottom = '7rem'; document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
  }

  // ───────────────────────────── data model ─────────────────────────────
  const DATA = window.GRE_DATA || { title: 'GRE Words', days: [], clusters: [] };
  let clusters = [], clustersById = new Map(), days = [], words = new Map(), wordList = [];

  function buildIndex() {
    const custom = LS.get('gre.custom', { clusters: [] });
    clusters = [...DATA.clusters, ...custom.clusters];
    clustersById = new Map(clusters.map(c => [c.id, c]));
    days = DATA.days.map(d => ({ ...d }));
    if (custom.clusters.length) days.push({ day: 'custom', title: 'Imported', clusters: custom.clusters.map(c => c.id) });
    words = new Map();
    for (const c of clusters) for (const e of c.entries) {
      const key = e.word.trim().toLowerCase();
      let w = words.get(key);
      if (!w) { w = { key, word: e.word.trim(), senses: [] }; words.set(key, w); }
      w.senses.push({ clusterId: c.id, meaning: e.meaning, mnemonic: e.mnemonic });
    }
    wordList = Array.from(words.values());
  }
  const clusterLabel = c => `#${c.id} ${c.name}`;
  const dayLabel = d => d.day === 'custom' ? 'Imported' : `Day ${d.day}`;
  const dayOf = d => days.find(x => String(x.day) === String(d));
  const dayIndexOfCluster = c => Math.max(0, days.findIndex(d => d.clusters.includes(c.id)));

  // Unit colours cycle per day, like lesson units.
  const UNIT_COLORS = ['green', 'blue', 'purple', 'orange', 'teal', 'pink', 'red', 'yellow'];
  const unitColor = i => UNIT_COLORS[i % UNIT_COLORS.length];
  const unitStyle = name => `--unit:var(--${name});--unit-d:var(--${name}-d);--unit-bg:var(--${name}-bg);--unit-t:var(--${name}-t)`;
  const clusterStyle = c => unitStyle(unitColor(dayIndexOfCluster(c)));

  const EMOJI = [
    ['harsh crit', '⚔️'], ['harmful', '☠️'], ['benefic', '💊'], ['stubborn', '🐐'], ['decept', '🎭'], ['anger', '😡'], ['indiffer', '😐'], ['weaken', '🔨'], ['strengthen', '💪'],
    ['clever', '🦊'], ['foolish', '🤪'], ['calm down', '🕊️'], ['certain', '✅'], ['literary', '📜'], ['calm', '🧘'], ['vague', '🌫️'], ['clear', '🔆'], ['coward', '🐔'],
    ['arrogant', '👑'], ['temporary', '⏳'], ['permanent', '🗿'], ['criticize', '🗯️'], ['improve', '🛠️'], ['increase', '📈'], ['decrease', '📉'], ['show', '🔦'], ['hide', '🙈'],
    ['praise', '🏆'], ['fearless', '🦁'], ['greedy', '💰'], ['sorrow', '😢'], ['happy', '😄'], ['weird', '🦄'], ['worsen', '🔥'], ['careful', '🔍'], ['blame', '👉'],
    ['injustice', '⛓️'], ['justice', '⚖️'], ['fast', '⚡'], ['talkative', '🗣️'], ['brief', '📝'], ['lazy', '🦥'], ['energetic', '🎉'], ['flexible', '🌿'], ['honest', '🤝'],
    ['humble', '🙇'], ['generous', '🎁'], ['normal', '📏'], ['scarce', '🏜️'], ['abundant', '🌊'], ['spread', '🦠'], ['avoid', '🏃'], ['flatter', '🍯'], ['predict', '🔮'],
    ['begin', '🌱'], ['end', '🏁'], ['confused emotion', '🎢'], ['confused', '😵'], ['serious', '🎩'], ['funny', '🤡'], ['force', '💥'], ['rebel', '✊'], ['obey', '🐑'], ['wander', '🧭'],
    ['poverty', '🥣'], ['wealth', '💎'], ['sacred', '⛪'], ['irreverent', '😈'], ['isolate', '🔒'], ['free', '🔓'], ['forgive', '🤲'], ['copy', '📋'], ['original', '🎨'],
    ['old', '🦕'], ['new', '🐣'], ['fear', '👻'], ['confidence', '🦸'], ['mix', '🌀'], ['separate', '✂️'], ['argument', '🥊'], ['agreement', '🤗'], ['question', '❓'],
    ['excess', '🍰'], ['restraint', '🧊'], ['slow', '🐌'], ['loss', '🕳️'], ['passage of time', '⏰'], ['appearance', '🪞'], ['study', '🎓'], ['instinct', '🐺'], ['prevent', '🚧'],
    ['ornate', '🎪'], ['size', '🐘'], ['degrade', '🧪'], ['restore', '🛡️'],
  ];
  function clusterEmoji(c) { const n = c.name.toLowerCase(); for (const [k, e] of EMOJI) if (n.includes(k)) return e; return '📖'; }

  // Scope: { type: 'all'|'due'|'new'|'weak'|'day'|'cluster', id }
  function scopeLabel(s) {
    switch (s.type) {
      case 'all': return 'All words';
      case 'due': return 'Due for review';
      case 'new': return 'New words';
      case 'weak': return 'Weak spots';
      case 'day': { const d = dayOf(s.id); return d ? dayLabel(d) : 'Day'; }
      case 'cluster': { const c = clustersById.get(+s.id); return c ? c.name : 'Cluster'; }
    }
    return '';
  }
  function scopeStyle(s) {
    if (s.type === 'cluster') { const c = clustersById.get(+s.id); return c ? clusterStyle(c) : ''; }
    if (s.type === 'day') { const i = days.findIndex(d => String(d.day) === String(s.id)); return unitStyle(unitColor(Math.max(0, i))); }
    return unitStyle({ due: 'blue', new: 'green', weak: 'red', all: 'purple' }[s.type] || 'green');
  }
  function scopeClusters(s) {
    if (s.type === 'day') { const d = dayOf(s.id); return d ? d.clusters.map(id => clustersById.get(id)).filter(Boolean) : []; }
    if (s.type === 'cluster') { const c = clustersById.get(+s.id); return c ? [c] : []; }
    return clusters;
  }
  function scopeEntries(s) {
    if (s.type === 'weak' || s.type === 'due' || s.type === 'new') {
      return scopeWords(s).map(w => ({ word: w.word, key: w.key, ...w.senses[0], clusterName: clustersById.get(w.senses[0].clusterId)?.name }));
    }
    const out = [];
    for (const c of scopeClusters(s)) for (const e of c.entries) out.push({ word: e.word, key: e.word.toLowerCase(), meaning: e.meaning, mnemonic: e.mnemonic, clusterId: c.id, clusterName: c.name });
    return out;
  }
  function scopeWords(s) {
    const now = Date.now();
    if (s.type === 'due') return wordList.filter(w => P.srs[w.key] && P.srs[w.key].due <= now).sort((a, b) => P.srs[a.key].due - P.srs[b.key].due);
    if (s.type === 'new') return wordList.filter(w => !P.srs[w.key]);
    if (s.type === 'weak') return weakWords().map(x => x.w);
    if (s.type === 'all') return wordList;
    const keys = new Set();
    for (const c of scopeClusters(s)) for (const e of c.entries) keys.add(e.word.toLowerCase());
    return Array.from(keys).map(k => words.get(k)).filter(Boolean);
  }

  // ───────────────────────────── settings & profiles ─────────────────────────────
  const DEFAULTS = {
    voice: '', rate: 1, pause: 1.2, gap: 1.5, repeatWord: 2, spell: false, sayMeaning: true, sayMnemonic: true, sayCluster: false, sayWordAgain: true,
    loop: false, shuffle: false, newPerDay: 20, autoSpeak: true, hardQuiz: false, quizCount: 15, quizTypes: ['w2m', 'm2w', 'odd', 'spell'],
    sound: true, dailyGoal: 50,
  };
  let S = { ...DEFAULTS, ...LS.get('gre.settings', {}) };
  const saveSettings = () => LS.set('gre.settings', S);

  let profile = LS.get('gre.profile', null);
  let P = null;
  const profiles = () => LS.get('gre.profiles', []);
  function loadProgress() {
    P = LS.get('gre.progress.' + profile, null) || { srs: {}, quiz: {}, notes: {}, log: {}, created: Date.now() };
    P.srs ||= {}; P.quiz ||= {}; P.notes ||= {}; P.log ||= {};
  }
  const saveProgress = () => LS.set('gre.progress.' + profile, P);
  function setProfile(name) {
    name = name.trim(); if (!name) return;
    const list = profiles(); if (!list.includes(name)) { list.push(name); LS.set('gre.profiles', list); }
    profile = name; LS.set('gre.profile', name); loadProgress(); updateProfileBtn();
  }
  function updateProfileBtn() {
    $('#profileName').textContent = profile || 'Profile';
    const av = $('#avatar'); av.textContent = (profile || '?')[0].toUpperCase();
    const hue = profile ? [...profile].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 260;
    av.style.background = `hsl(${hue} 70% 55%)`;
  }

  function todayLog() { return P.log[dateKey()] ||= { reviews: 0, correct: 0, quiz: 0, quizCorrect: 0, newSeen: 0, xp: 0 }; }
  function logEvent(kind, ok) {
    const l = todayLog();
    if (kind === 'review') { l.reviews++; if (ok) l.correct++; }
    if (kind === 'quiz') { l.quiz++; if (ok) l.quizCorrect++; }
    if (kind === 'new') l.newSeen++;
  }
  function addXP(n) { const l = todayLog(); l.xp = (l.xp || 0) + n; return n; }
  const totalXP = () => Object.values(P.log).reduce((a, l) => a + (l.xp || 0), 0);
  function streak() {
    let n = 0; const d = new Date();
    const active = k => { const l = P.log[k]; return l && (l.reviews + l.quiz + (l.xp || 0)) > 0; };
    if (!active(dateKey(d))) d.setDate(d.getDate() - 1);
    while (active(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ───────────────────────────── spaced repetition (SM-2 flavoured) ─────────────────────────────
  function applyRating(s0, q, now = Date.now()) {
    const s = { ease: 2.5, interval: 0, reps: 0, lapses: 0, ...(s0 || {}) };
    if (q === 1) { s.reps = 0; s.interval = 10 / 1440; s.lapses++; s.ease = Math.max(1.3, s.ease - 0.2); }
    else if (q === 2) { s.interval = s.reps === 0 ? 0.5 : Math.max(1, s.interval * 1.2); s.ease = Math.max(1.3, s.ease - 0.15); s.reps++; }
    else if (q === 3) { s.interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.interval * s.ease * 10) / 10; s.reps++; }
    else { s.interval = s.reps === 0 ? 4 : Math.round(s.interval * s.ease * 1.3 * 10) / 10; s.ease = Math.min(3, s.ease + 0.15); s.reps++; }
    s.due = now + s.interval * DAY; s.last = now; s.lastQ = q; s.seen = (s.seen || 0) + 1;
    return s;
  }
  function rate(key, q) {
    const isNew = !P.srs[key];
    P.srs[key] = applyRating(P.srs[key], q);
    if (isNew) logEvent('new');
    logEvent('review', q >= 3);
    const xp = addXP(q === 1 ? 5 : 10);
    saveProgress();
    return xp;
  }
  function stageOf(key) {
    const s = P.srs[key]; if (!s) return 'new';
    if (s.reps === 0 || s.interval < 7) return 'learning';
    if (s.interval < 21) return 'known';
    return 'mastered';
  }
  const STAGE_W = { new: 0, learning: 0.35, known: 0.75, mastered: 1 };
  function clusterMastery(c) {
    if (!c.entries.length) return 0;
    return Math.round(100 * c.entries.reduce((a, e) => a + STAGE_W[stageOf(e.word.toLowerCase())], 0) / c.entries.length);
  }
  function weakWords() {
    const out = [];
    for (const w of wordList) {
      const s = P.srs[w.key], q = P.quiz[w.key];
      const lapses = s?.lapses || 0, wrong = q?.w || 0, right = q?.c || 0;
      const score = lapses * 2 + wrong * 1.5 - right * 0.5 + (s && s.lastQ === 2 ? 0.5 : 0);
      if (lapses + wrong > 0 && score > 0) out.push({ w, score, lapses, wrong, right });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function quizResult(key, ok) {
    const q = P.quiz[key] ||= { c: 0, w: 0 };
    if (ok) q.c++; else { q.w++; if (P.srs[key]) { P.srs[key].due = Math.min(P.srs[key].due, Date.now()); P.srs[key].lapses = (P.srs[key].lapses || 0) + 1; } }
    logEvent('quiz', ok);
    const xp = addXP(ok ? 10 : 2);
    saveProgress();
    return xp;
  }

  // ───────────────────────────── speech ─────────────────────────────
  const synth = window.speechSynthesis;
  let voices = [];
  function loadVoices() { voices = synth ? synth.getVoices().filter(v => /^en/i.test(v.lang)) : []; }
  if (synth) { loadVoices(); synth.onvoiceschanged = () => { const had = voices.length; loadVoices(); if (!had && voices.length && (route().name === 'listen' || route().name === 'settings')) render(); }; }
  function pickVoice() {
    let v = voices.find(x => x.name === S.voice);
    if (!v) for (const re of [/natural/i, /google us english/i, /aria|jenny|guy|zira/i, /en[-_]US/i]) { v = voices.find(x => re.test(x.name) || re.test(x.lang)); if (v) break; }
    return v || voices[0];
  }
  function speechify(text) {
    return String(text || '')
      .replace(/["“”]/g, '')
      .replace(/[—–]/g, ', ')
      .replace(/~/g, ' sounds like ')
      .replace(/\+/g, ' plus ')
      .replace(/\besp\./gi, 'especially').replace(/\be\.g\./gi, 'for example').replace(/\bi\.e\./gi, 'that is').replace(/\betc\./gi, 'et cetera')
      .replace(/(\w)-(\w)/g, '$1 $2')
      .replace(/\(/g, ', ').replace(/\)/g, ', ')
      .replace(/(\s*,\s*)+/g, ', ').replace(/\s+/g, ' ').trim();
  }
  function speak(text, { rate = S.rate } = {}) {
    return new Promise(resolve => {
      if (!synth || !text) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = rate; u.pitch = 1;
      let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 4000 + text.length * 120 / rate);
      speak._keep = u;
      synth.speak(u);
    });
  }
  function sayWord(text) { if (synth) { if (player.playing) player.pause(); synth.cancel(); speak(text); } }

  const player = {
    items: [], i: 0, playing: false, token: 0, phase: '', onchange: null,
    load(items, start = 0) { this.stop(); this.items = items; this.i = start; this.emit(); },
    emit() { this.onchange && this.onchange(); },
    async wait(ms, tok) { const end = Date.now() + ms; while (Date.now() < end && tok === this.token) await new Promise(r => setTimeout(r, 60)); },
    async play() {
      if (this.playing || !this.items.length || !synth) return;
      synth.cancel();
      this.playing = true; const tok = ++this.token; this.emit();
      while (this.playing && tok === this.token && this.i < this.items.length) {
        await this.sayItem(this.items[this.i], tok);
        if (tok !== this.token) return;
        addXP(2); saveProgress();
        if (this.i >= this.items.length - 1) { if (S.loop) this.i = 0; else { this.playing = false; this.phase = ''; break; } }
        else this.i++;
        this.emit();
        await this.wait(S.gap * 1000, tok);
      }
      if (tok === this.token) { this.playing = false; this.phase = ''; this.emit(); }
    },
    async sayItem(it, tok) {
      const step = async (phase, text, rate) => { if (tok !== this.token) return; this.phase = phase; this.emit(); await speak(text, rate ? { rate } : {}); };
      if (S.sayCluster && it.clusterName) { await step('cluster', 'Cluster: ' + speechify(it.clusterName)); await this.wait(300, tok); }
      for (let r = 0; r < S.repeatWord; r++) { await step('word', it.word, Math.min(S.rate, 0.95)); await this.wait(S.pause * 1000, tok); }
      if (S.spell) { await step('spelling', it.word.toUpperCase().split('').join(' '), 0.9); await this.wait(400, tok); }
      if (S.sayMeaning) { await step('meaning', speechify(it.meaning)); await this.wait(S.pause * 1000, tok); }
      if (S.sayMnemonic && it.mnemonic) { await step('mnemonic', speechify(it.mnemonic)); await this.wait(S.pause * 600, tok); }
      if (S.sayWordAgain) { await step('word', it.word, Math.min(S.rate, 0.95)); }
    },
    pause(silent) { this.playing = false; this.token++; this.phase = ''; if (synth) synth.cancel(); if (!silent) this.emit(); },
    stop() { this.pause(); this.i = 0; this.emit(); },
    goto(i, resume) { const was = this.playing; this.pause(); this.i = Math.max(0, Math.min(this.items.length - 1, i)); this.emit(); if (was || resume) this.play(); },
    next() { this.goto(this.i + 1); }, prev() { this.goto(this.i - 1); },
  };
  window.addEventListener('beforeunload', () => synth && synth.cancel());

  // ───────────────────────────── routing ─────────────────────────────
  function route() {
    const h = location.hash.replace(/^#/, '') || 'home';
    const [name, ...rest] = h.split('/');
    return { name, param: rest.join('/') };
  }
  const views = {};

  function render(opts = {}) {
    const r = route();
    $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === r.name));
    const app = $('#app');
    if (r.name !== 'listen') { if (player.playing) player.pause(); player.onchange = null; }
    if (!profile) { app.innerHTML = ''; return showOnboarding(); }
    const v = views[r.name] || views.home;
    const y = window.scrollY;
    app.innerHTML = ''; app._keys = null; app.classList.remove('has-foot');
    v(app, r.param);
    document.body.classList.toggle('lesson', app.classList.contains('has-foot'));
    if (opts.keepScroll) window.scrollTo(0, y); else window.scrollTo({ top: 0 });
  }
  window.addEventListener('hashchange', () => render());

  function showOnboarding() {
    const list = profiles();
    openModal(`
      <div class="bubble-row">${mascot('happy', 'bounce')}<div class="bubble">Hi! I'm Lex. Who's studying today?</div></div>
      <p class="muted small">Each profile keeps its own progress on this device, so you and your friend can share one laptop.</p>
      ${list.length ? `<div class="btn-row" style="margin-bottom:.9rem">${list.map(n => `<button class="btn outline-blue" data-pick="${esc(n)}">👤 ${esc(n)}</button>`).join('')}</div>` : ''}
      <form id="newProfile" class="row"><input type="text" id="pname" placeholder="Your name" required class="input grow"><button class="btn green">Start</button></form>`);
    $$('#modal [data-pick]').forEach(b => b.onclick = () => { setProfile(b.dataset.pick); closeModal(); render(); });
    $('#newProfile').onsubmit = e => { e.preventDefault(); setProfile($('#pname').value); closeModal(); render(); };
    setTimeout(() => $('#pname')?.focus(), 50);
  }
  $('#profileBtn').onclick = () => showOnboarding();

  // ───────────────────────────── shared UI pieces ─────────────────────────────
  const chip = key => { const st = stageOf(key); const due = P.srs[key] && P.srs[key].due <= Date.now(); return `<span class="chip ${st}">${st}</span>${due ? ' <span class="chip due">due</span>' : ''}`; };
  const speakBtn = word => `<button class="btn icon" data-say="${esc(word)}" title="Pronounce">🔊</button>`;
  const wordLink = w => `<span class="wordlink" data-word="${esc(w.toLowerCase())}">${esc(w)}</span>`;
  const ring = (pct, size = 96, cls = '') => { const r = 40, c = 2 * Math.PI * r; return `<div class="ring ${cls}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${r}"/><circle class="fill" cx="50" cy="50" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}"/></svg><div class="txt">${Math.round(pct * 100)}%</div></div>`; };

  function scopeOptions(sel, { includeSmart = true } = {}) {
    let html = '';
    if (includeSmart) html += `<optgroup label="Smart">
      <option value="due" ${sel === 'due' ? 'selected' : ''}>Due for review</option>
      <option value="new" ${sel === 'new' ? 'selected' : ''}>New words</option>
      <option value="weak" ${sel === 'weak' ? 'selected' : ''}>Weak spots</option>
      <option value="all" ${sel === 'all' ? 'selected' : ''}>All words</option></optgroup>`;
    html += `<optgroup label="Days">${days.map(d => `<option value="day:${d.day}" ${sel === 'day:' + d.day ? 'selected' : ''}>${dayLabel(d)} (${d.clusters.length} clusters)</option>`).join('')}</optgroup>`;
    html += `<optgroup label="Clusters">${clusters.slice().sort((a, b) => a.id - b.id).map(c => `<option value="cluster:${c.id}" ${sel === 'cluster:' + c.id ? 'selected' : ''}>${esc(clusterLabel(c))}</option>`).join('')}</optgroup>`;
    return html;
  }
  const parseScope = v => { if (!v) return { type: 'due' }; const [t, id] = v.split(':'); return id ? { type: t, id } : { type: t }; };
  const scopeToStr = s => s.id ? `${s.type}:${s.id}` : s.type;

  document.addEventListener('click', e => {
    const say = e.target.closest('[data-say]'); if (say) { sayWord(say.dataset.say); return; }
    const wl = e.target.closest('[data-word]'); if (wl && !e.target.closest('.opt')) { showWord(wl.dataset.word); }
  });

  function showWord(key) {
    const w = words.get(key); if (!w) return;
    const s = P.srs[key];
    openModal(`
      <div class="row between"><h2 style="margin:0;font-size:1.6rem">${esc(w.word)} ${speakBtn(w.word)}</h2><button class="btn icon" id="mClose">✕</button></div>
      <div class="row small" style="margin:.3rem 0 .8rem">${chip(key)} ${s ? `<span class="muted">ease ${s.ease.toFixed(2)} · interval ${fmtInterval(s.interval)} · ${relDue(s.due)} · ${s.lapses || 0} lapses</span>` : '<span class="muted">not reviewed yet</span>'}</div>
      ${w.senses.map(se => { const c = clustersById.get(se.clusterId); return `<div class="sense" style="${clusterStyle(c)}"><div class="cl"><a href="#cluster/${c.id}" data-nav style="color:inherit">${clusterEmoji(c)} ${esc(clusterLabel(c))}</a></div><div class="mean">${esc(se.meaning)}</div><div class="mnem">💡 ${esc(se.mnemonic)}</div></div>`; }).join('')}
      <label class="field" style="margin-top:.8rem">Your own note / mnemonic<textarea id="mNote" placeholder="Write a mnemonic that works for you…">${esc(P.notes[key] || '')}</textarea></label>
      <div class="row between" style="margin-top:.7rem">
        <button class="btn blue sm" id="mSave">Save note</button>
        <button class="btn ghost sm" id="mReset" title="Forget progress for this word">Reset progress</button>
      </div>`);
    $('#mClose').onclick = closeModal;
    $$('#modal [data-nav]').forEach(a => a.onclick = closeModal);
    $('#mSave').onclick = () => { const v = $('#mNote').value.trim(); if (v) P.notes[key] = v; else delete P.notes[key]; saveProgress(); toast('Note saved ✍️'); };
    $('#mReset').onclick = () => { delete P.srs[key]; delete P.quiz[key]; saveProgress(); toast('Progress reset for ' + w.word); closeModal(); render({ keepScroll: true }); };
  }

  // ───────────────────────────── HOME: the path ─────────────────────────────
  const home = { open: null };
  views.home = app => {
    const now = Date.now();
    let due = 0, mastered = 0;
    for (const w of wordList) { if (P.srs[w.key] && P.srs[w.key].due <= now) due++; if (stageOf(w.key) === 'mastered') mastered++; }
    const today = todayLog();
    const newLeft = Math.max(0, S.newPerDay - (today.newSeen || 0));
    const weak = weakWords();
    const goalPct = Math.min(1, (today.xp || 0) / S.dailyGoal);
    const OFFS = window.innerWidth <= 820 ? [0, 38, 60, 38, 0, -38, -60, -38] : [0, 44, 72, 44, 0, -44, -72, -44];
    let firstTodo = null;
    for (const c of clusters) if (clusterMastery(c) === 0) { firstTodo = c.id; break; }

    const week = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const l = P.log[dateKey(d)]; week.push({ d, on: !!(l && (l.reviews + l.quiz + (l.xp || 0)) > 0) }); }

    const path = days.map((d, di) => {
      const cs = d.clusters.map(id => clustersById.get(id)).filter(Boolean);
      const color = unitColor(di);
      const m = Math.round(cs.reduce((a, c) => a + clusterMastery(c), 0) / (cs.length || 1));
      return `<section style="${unitStyle(color)}">
        <div class="unit-banner"><div><div class="caps">Unit ${di + 1} · ${m}% mastered</div><h2>${dayLabel(d)}</h2><div class="sub">${cs.map(c => c.name.split(' / ')[0]).join(' · ')}</div></div>
          <a class="btn sm" href="#browse/${d.day}">📖 Words</a></div>
        <div class="path">${cs.map((c, i) => {
          const pm = clusterMastery(c);
          const state = pm >= 80 ? 'done' : pm > 0 ? 'started' : c.id === firstTodo ? 'active' : '';
          const open = home.open === c.id;
          const r = 40, circ = 2 * Math.PI * r;
          return `<div class="node-wrap">
            <div class="node-inner" style="transform:translateX(${OFFS[i % OFFS.length]}px)">
            ${state === 'active' && !open ? '<div class="start-tip">Start</div>' : ''}
            <button class="node ${state}" data-node="${c.id}" title="${esc(c.name)}">
              <div class="ringp"><svg viewBox="0 0 100 100"><circle class="t" cx="50" cy="50" r="${r}"/><circle class="f" cx="50" cy="50" r="${r}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pm / 100)}"/></svg></div>
              <span>${state === 'done' ? '👑' : clusterEmoji(c)}</span></button>
            <div class="node-label">${esc(c.name)}</div>
            </div>
            ${open ? `<div class="node-pop ${state ? '' : 'gray'}"><div class="caps" style="opacity:.8">Cluster #${c.id} · ${c.entries.length} words</div><h3>${clusterEmoji(c)} ${esc(c.name)}</h3>
              <div class="bar thin" style="margin:.5rem 0 .8rem"><i style="width:${pm}%"></i></div>
              <div class="btn-row"><a class="btn sm" href="#listen/cluster:${c.id}">🎧 Listen</a><a class="btn sm" href="#review/cluster:${c.id}">🃏 Review</a><a class="btn sm" href="#quiz/cluster:${c.id}">✏️ Quiz</a><a class="btn sm" href="#cluster/${c.id}">📖 Words</a></div></div>` : ''}
          </div>`; }).join('')}
        </div></section>`;
    }).join('');

    const avatarBg = $('#avatar').style.background;
    const statsHtml = `
        <div class="card" style="padding:1rem">
          <div class="row" style="gap:.9rem"><span class="avatar" style="width:44px;height:44px;font-size:1.2rem;background:${avatarBg}">${esc((profile || '?')[0].toUpperCase())}</span><div><div style="font-weight:900;font-size:1.1rem">${esc(profile)}</div><div class="faint small">${mastered} of ${wordList.length} words mastered</div></div></div>
          <div class="rail-stats" style="margin-top:.9rem">
            <div class="rstat"><div class="ic">🔥</div><div class="n">${streak()}</div><div class="l">streak</div></div>
            <div class="rstat"><div class="ic">⚡</div><div class="n">${totalXP()}</div><div class="l">total xp</div></div>
            <div class="rstat"><div class="ic">👑</div><div class="n">${mastered}</div><div class="l">mastered</div></div>
          </div>
        </div>
        <div class="card">
          <div class="row between"><h3 style="margin:0">Daily goal</h3><a class="small" href="#settings" data-close>edit</a></div>
          <div class="row" style="gap:1rem;margin-top:.6rem">${ring(goalPct)}<div><div style="font-weight:900;font-size:1.2rem">${today.xp || 0} / ${S.dailyGoal} XP</div><div class="muted small">${goalPct >= 1 ? 'Goal smashed! 🎉' : `${S.dailyGoal - (today.xp || 0)} XP to go. About ${Math.ceil((S.dailyGoal - (today.xp || 0)) / 10)} cards.`}</div></div></div>
          <div class="mini-days" style="margin-top:1rem">${week.map(w => `<div class="d ${w.on ? 'on' : ''}"><i>${w.on ? '🔥' : ''}</i>${['S', 'M', 'T', 'W', 'T', 'F', 'S'][w.d.getDay()]}</div>`).join('')}</div>
        </div>`;
    app.innerHTML = `<div class="home">
      <div>
        <div class="mstrip" id="mstrip" title="Your stats">
          <span class="avatar" style="background:${avatarBg}">${esc((profile || '?')[0].toUpperCase())}</span>
          <span class="st"><span class="ic">🔥</span>${streak()}</span>
          <span class="goal"><span class="ic">⚡</span><span class="bar yellow"><i style="width:${Math.round(goalPct * 100)}%"></i></span><b>${today.xp || 0}/${S.dailyGoal}</b></span>
          <span class="st"><span class="ic">👑</span>${mastered}</span>
        </div>
        <div class="bubble-row">${mascot(due > 0 ? 'think' : 'happy', 'bounce')}<div class="bubble">${due > 0 ? `You have <b>${due}</b> word${due === 1 ? '' : 's'} due. Let's clear them!` : esc(tip('home'))}</div></div>
        <div class="btn-row home-actions" style="margin-bottom:.4rem">
          <a class="btn blue" href="#review/due">🃏 Review due (${due})</a>
          <a class="btn green" href="#review/new">✨ Learn ${newLeft} new</a>
          ${weak.length ? `<a class="btn red wide" href="#weak">🎯 Weak spots (${weak.length})</a>` : ''}
        </div>
        ${path}
      </div>
      <aside class="rail">${statsHtml}
        <div class="card">
          <h3>Jump in</h3>
          <div class="btn-row"><a class="btn sm outline-blue" href="#listen">🎧 Listen</a><a class="btn sm outline-blue" href="#quiz">✏️ Quiz</a><a class="btn sm outline-blue" href="#browse">📚 Browse</a></div>
        </div>
      </aside></div>`;
    $('#mstrip').onclick = () => {
      openModal(`<div class="row between" style="margin-bottom:.6rem"><h2 style="margin:0">Your stats</h2><button class="btn icon" id="mClose">✕</button></div>${statsHtml}
        <div class="btn-row" style="margin-top:1rem"><button class="btn outline-blue sm" id="mSwitch">👤 Switch profile</button></div>`);
      $('#mClose').onclick = closeModal; $$('#modal [data-close]').forEach(a => a.onclick = closeModal);
      $('#mSwitch').onclick = () => { closeModal(); showOnboarding(); };
    };
    $$('[data-node]').forEach(b => b.onclick = () => { const id = +b.dataset.node; home.open = home.open === id ? null : id; sfx.play('tap'); render({ keepScroll: true }); });
  };

  // ───────────────────────────── BROWSE / CLUSTER / SEARCH ─────────────────────────────
  let searchTerm = '';
  views.browse = (app, param) => {
    const sel = param || 'days';
    const card = c => `<a class="cluster-card" style="${clusterStyle(c)}" href="#cluster/${c.id}"><div class="row between"><span class="ic">${clusterEmoji(c)}</span><span class="faint tiny caps">#${c.id}</span></div><div class="t">${esc(c.name)}</div><div class="m">${c.entries.length} words · ${clusterMastery(c)}% mastered</div><div class="bar thin unit"><i style="width:${clusterMastery(c)}%"></i></div></a>`;
    const q = searchTerm.trim().toLowerCase();
    let body = '';
    if (q) {
      const hits = wordList.filter(w => w.word.toLowerCase().includes(q) || w.senses.some(s => s.meaning.toLowerCase().includes(q) || s.mnemonic.toLowerCase().includes(q))).slice(0, 80);
      hits.sort((a, b) => (a.word.toLowerCase().startsWith(q) ? 0 : 1) - (b.word.toLowerCase().startsWith(q) ? 0 : 1));
      body = hits.length ? `<div class="card table-wrap"><table class="words"><thead><tr><th>Word</th><th>Meaning</th><th>Cluster</th><th>Status</th></tr></thead><tbody>
        ${hits.map(w => w.senses.map((s, i) => { const c = clustersById.get(s.clusterId); return `<tr><td class="w">${i === 0 ? wordLink(w.word) + ' ' + speakBtn(w.word) : ''}</td><td>${esc(s.meaning)}<div class="small muted">${esc(s.mnemonic)}</div></td><td><a href="#cluster/${c.id}">${clusterEmoji(c)} ${esc(c.name)}</a></td><td>${i === 0 ? chip(w.key) : ''}</td></tr>`; }).join('')).join('')}
        </tbody></table></div>` : `<div class="empty">${mascot('sad')}<div>No words match “${esc(searchTerm)}”.</div></div>`;
    } else if (sel === 'all') body = `<div class="grid">${clusters.slice().sort((a, b) => a.id - b.id).map(card).join('')}</div>`;
    else {
      const list = sel === 'days' ? days : days.filter(d => String(d.day) === sel);
      body = list.map((d, i) => { const di = days.indexOf(d); return `<div class="unit-head" style="${unitStyle(unitColor(di))}"><span class="dot"></span><h2>${dayLabel(d)}</h2><span class="faint small">${d.clusters.length} clusters</span><span class="grow"></span><a class="btn sm outline-blue" href="#listen/day:${d.day}">🎧</a><a class="btn sm outline-blue" href="#review/day:${d.day}">🃏</a><a class="btn sm outline-blue" href="#quiz/day:${d.day}">✏️</a></div>
        <div class="grid">${d.clusters.map(id => clustersById.get(id)).filter(Boolean).map(card).join('')}</div>`; }).join('');
    }
    app.innerHTML = `<div class="row between browse-head" style="margin-bottom:1rem"><h1 style="margin:0">Browse</h1><div class="search" style="min-width:260px">🔍<input id="search" type="search" placeholder="Search words, meanings, mnemonics…" value="${esc(searchTerm)}" autocomplete="off"></div></div>
      ${q ? '' : `<div class="pill-tabs"><a class="${sel === 'days' ? 'on' : ''}" href="#browse/days">By day</a><a class="${sel === 'all' ? 'on' : ''}" href="#browse/all">All clusters</a>${days.map(d => `<a class="${sel == d.day ? 'on' : ''}" href="#browse/${d.day}">${dayLabel(d)}</a>`).join('')}</div>`}
      ${body}`;
    const si = $('#search');
    si.addEventListener('input', e => { searchTerm = e.target.value; const pos = e.target.selectionStart; render({ keepScroll: true }); const n = $('#search'); n.focus(); n.setSelectionRange(pos, pos); });
    si.addEventListener('keydown', e => { if (e.key === 'Escape') { searchTerm = ''; render(); } });
  };

  views.cluster = (app, param) => {
    const c = clustersById.get(+param);
    if (!c) { app.innerHTML = '<div class="empty">Cluster not found.</div>'; return; }
    const m = clusterMastery(c);
    app.innerHTML = `<div style="${clusterStyle(c)}">
      <a href="#browse/${c.day}" class="small" style="font-weight:800">← ${c.day === 'custom' ? 'Imported' : 'Day ' + c.day}</a>
      <div class="unit-banner cluster-hero" style="margin-top:.5rem"><div><div class="caps">Cluster #${c.id} · ${c.entries.length} words · ${m}% mastered</div><h2 style="font-size:1.6rem">${clusterEmoji(c)} ${esc(c.name)}</h2></div>
        <div class="btn-row"><a class="btn sm" href="#listen/cluster:${c.id}">🎧 Listen</a><a class="btn sm" href="#review/cluster:${c.id}">🃏 Review</a><a class="btn sm" href="#quiz/cluster:${c.id}">✏️ Quiz</a></div></div>
      <div class="card table-wrap"><table class="words"><thead><tr><th>Word</th><th>Meaning</th><th>Mnemonic</th><th>Status</th></tr></thead><tbody>
        ${c.entries.map(e => { const k = e.word.toLowerCase(); const w = words.get(k); const other = w.senses.filter(s => s.clusterId !== c.id).map(s => clustersById.get(s.clusterId)); return `<tr>
          <td class="w">${wordLink(e.word)} ${speakBtn(e.word)}</td>
          <td>${esc(e.meaning)}${other.length ? `<div class="small faint">also in ${other.map(o => `<a href="#cluster/${o.id}">${clusterEmoji(o)} ${esc(o.name)}</a>`).join(', ')}</div>` : ''}${P.notes[k] ? `<div class="small" style="color:var(--blue-t)">✍️ ${esc(P.notes[k])}</div>` : ''}</td>
          <td class="mn">💡 ${esc(e.mnemonic)}</td><td>${chip(k)}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  };

  // ───────────────────────────── LISTEN ─────────────────────────────
  views.listen = (app, param) => {
    const scope = parseScope(param || LS.get('gre.listenScope', 'day:1'));
    LS.set('gre.listenScope', scopeToStr(scope));
    let items = scopeEntries(scope);
    if (S.shuffle) items = shuffle(items);
    player.onchange = null;
    if (!player.items.length || player._scope !== scopeToStr(scope) || player._shuffle !== S.shuffle) { player.load(items); player._scope = scopeToStr(scope); player._shuffle = S.shuffle; }
    const cur = () => player.items[player.i];
    const tog = (id, on, label) => `<span class="tog ${on ? 'on' : ''}" data-tog="${id}">${on ? '✓' : '○'} ${label}</span>`;

    app.innerHTML = `<div class="lesson" style="${scopeStyle(scope)}">
      <div class="bubble-row">${mascot('happy')}<div class="bubble">${esc(tip('listen'))}</div></div>
      <div class="row listen-controls" style="margin-bottom:1rem">
        <label class="field grow">Playlist<select id="lScope">${scopeOptions(scopeToStr(scope))}</select></label>
        <label class="field">Voice<select id="lVoice">${voices.length ? voices.map(v => `<option value="${esc(v.name)}" ${pickVoice()?.name === v.name ? 'selected' : ''}>${esc(v.name.replace(/Microsoft |Google /, '').replace(/ - English.*$/, ''))}</option>`).join('') : '<option>No voices found</option>'}</select></label>
      </div>
      <div class="now-card">
        <div class="caps" style="opacity:.85" id="nowCl"></div>
        <div class="word" id="nowWord">—</div><div class="mean" id="nowMean"></div><div class="mnem" id="nowMnem"></div><div class="phase" id="nowPhase"></div>
        <div class="player">
          <button class="btn ${S.shuffle ? 'on' : ''}" id="pShuffle" title="Shuffle">🔀</button>
          <button class="btn" id="pPrev" title="Previous (←)">⏮</button>
          <button class="btn big" id="pPlay" title="Play / pause (space)">▶</button>
          <button class="btn" id="pNext" title="Next (→)">⏭</button>
          <button class="btn ${S.loop ? 'on' : ''}" id="pLoop" title="Loop">🔁</button>
        </div>
        <div class="small" style="opacity:.85;margin-top:.6rem;font-weight:800" id="pPos"></div>
      </div>
      ${!synth ? '<p class="small" style="color:var(--red-t);font-weight:700">This browser has no speech synthesis. Use Chrome or Edge.</p>' : ''}
      <div class="card" style="margin-top:1rem">
        <div class="row between"><h3 style="margin:0">What I read for each word</h3></div>
        <div class="script-opts" style="margin-top:.7rem">
          ${tog('sayCluster', S.sayCluster, 'cluster name')}
          <span class="tog on">word × <select id="oRepeat" style="border:0;background:transparent;font-weight:900;color:inherit">${[1, 2, 3].map(n => `<option ${S.repeatWord === n ? 'selected' : ''}>${n}</option>`).join('')}</select></span>
          ${tog('spell', S.spell, 'spell it')}${tog('sayMeaning', S.sayMeaning, 'meaning')}${tog('sayMnemonic', S.sayMnemonic, 'mnemonic')}${tog('sayWordAgain', S.sayWordAgain, 'word again')}
        </div>
        <div class="sliders">
          <label>Speed <input type="range" id="oRate" min="0.6" max="1.5" step="0.05" value="${S.rate}"><b id="oRateV">${S.rate}×</b></label>
          <label>Pause <input type="range" id="oPause" min="0" max="4" step="0.25" value="${S.pause}"><b id="oPauseV">${S.pause}s</b></label>
          <label>Gap <input type="range" id="oGap" min="0" max="6" step="0.5" value="${S.gap}"><b id="oGapV">${S.gap}s</b></label>
        </div>
      </div>
      <div class="card"><div class="row between"><h3 style="margin:0">Playlist · ${player.items.length}</h3><span class="faint small">click a word to jump</span></div><div class="playlist" id="plist" style="margin-top:.6rem"></div></div>
    </div>`;

    const plist = $('#plist');
    plist.innerHTML = player.items.map((it, i) => `<div class="it" data-i="${i}"><span class="w">${esc(it.word)}</span><span class="m">${esc(it.meaning)}</span></div>`).join('');
    plist.onclick = e => { const it = e.target.closest('.it'); if (it) player.goto(+it.dataset.i, true); };

    const update = () => {
      const it = cur();
      $('#nowWord').textContent = it ? it.word : '—';
      $('#nowMean').textContent = it ? it.meaning : '';
      $('#nowMnem').textContent = it && it.mnemonic ? '💡 ' + it.mnemonic : '';
      $('#nowCl').textContent = it && it.clusterName ? it.clusterName : '';
      $('#nowPhase').textContent = player.playing ? (player.phase || '…') : 'paused';
      $('#pPlay').textContent = player.playing ? '⏸' : '▶';
      $('#pPos').textContent = player.items.length ? `${player.i + 1} / ${player.items.length}` : 'Nothing to play';
      $$('#plist .it').forEach((el, i) => el.classList.toggle('cur', i === player.i));
      const c = $('#plist .it.cur'); if (c && player.playing) c.scrollIntoView({ block: 'nearest' });
    };
    player.onchange = update; update();

    $('#pPlay').onclick = () => player.playing ? player.pause() : player.play();
    $('#pNext').onclick = () => player.next();
    $('#pPrev').onclick = () => player.prev();
    $('#pShuffle').onclick = () => { S.shuffle = !S.shuffle; saveSettings(); render(); };
    $('#pLoop').onclick = () => { S.loop = !S.loop; saveSettings(); $('#pLoop').classList.toggle('on', S.loop); };
    $('#lScope').onchange = e => { location.hash = '#listen/' + e.target.value; };
    $('#lVoice').onchange = e => { S.voice = e.target.value; saveSettings(); };
    $$('[data-tog]').forEach(t => t.onclick = () => { const k = t.dataset.tog; S[k] = !S[k]; saveSettings(); t.classList.toggle('on', S[k]); t.textContent = (S[k] ? '✓ ' : '○ ') + t.textContent.slice(2); });
    $('#oRepeat').onchange = e => { S.repeatWord = +e.target.value; saveSettings(); };
    const bind = (id, key, after) => { $(id).oninput = e => { S[key] = +e.target.value; saveSettings(); after(); }; };
    bind('#oRate', 'rate', () => $('#oRateV').textContent = S.rate + '×');
    bind('#oPause', 'pause', () => $('#oPauseV').textContent = S.pause + 's');
    bind('#oGap', 'gap', () => $('#oGapV').textContent = S.gap + 's');
    app._keys = e => {
      if (e.code === 'Space') { e.preventDefault(); player.playing ? player.pause() : player.play(); }
      else if (e.key === 'ArrowRight') player.next(); else if (e.key === 'ArrowLeft') player.prev();
    };
  };

  // ───────────────────────────── REVIEW (flashcards) ─────────────────────────────
  const review = { queue: [], i: 0, flipped: false, scope: null, done: 0, again: [], xp: 0, started: 0, good: 0 };
  views.review = (app, param) => {
    if (param) {
      const scope = parseScope(param);
      let list = scopeWords(scope);
      const now = Date.now();
      if (scope.type === 'new') { const today = todayLog(); list = list.slice(0, Math.max(0, S.newPerDay - (today.newSeen || 0)) || S.newPerDay); }
      else if (scope.type !== 'due' && scope.type !== 'weak') {
        const due = list.filter(w => P.srs[w.key] && P.srs[w.key].due <= now), fresh = list.filter(w => !P.srs[w.key]), rest = list.filter(w => P.srs[w.key] && P.srs[w.key].due > now);
        list = [...due, ...shuffle(fresh), ...rest];
      }
      Object.assign(review, { queue: list, i: 0, flipped: false, scope, done: 0, again: [], xp: 0, started: Date.now(), good: 0 });
      location.hash = '#review'; return;
    }
    if (review.queue.length && review.i >= review.queue.length) return renderCelebration(app, {
      title: 'Session complete!', sub: `${review.done} cards reviewed`, xp: review.xp, accuracy: review.done ? Math.round(100 * review.good / review.done) : 0, time: Date.now() - review.started,
      missed: review.again, retry: review.again.length ? { label: `Redo ${review.again.length} missed`, fn: () => { Object.assign(review, { queue: review.again.map(k => words.get(k)), again: [], i: 0, done: 0, flipped: false, xp: 0, good: 0, started: Date.now() }); render(); } } : null,
      onDone: () => { review.queue = []; },
    });
    if (!review.queue.length) return renderReviewStart(app);
    renderCard(app);
  };
  function renderReviewStart(app) {
    const now = Date.now();
    const due = wordList.filter(w => P.srs[w.key] && P.srs[w.key].due <= now).length;
    app.innerHTML = `<div class="lesson">
      <div class="bubble-row">${mascot('happy', 'bounce')}<div class="bubble">${due ? `${due} word${due === 1 ? ' is' : 's are'} due. Shall we?` : 'Nothing is due right now. Learn something new?'}</div></div>
      <h1>Review</h1>
      <div class="card">
        <div class="row"><label class="field grow">What to review<select id="rScope">${scopeOptions(due ? 'due' : 'new')}</select></label></div>
        <div class="btn-row" style="margin-top:1rem"><button class="btn green lg" id="rStart">Start session</button></div>
        <p class="small muted" style="margin-top:.8rem">Due: ${due} · New words per day: ${S.newPerDay}. Picking a day or cluster shows due cards first, then new ones, then the rest.</p>
        <p class="small faint">Keys: <kbd>space</kbd> flip · <kbd>1</kbd> again · <kbd>2</kbd> hard · <kbd>3</kbd> good · <kbd>4</kbd> easy · <kbd>s</kbd> speak</p>
      </div></div>`;
    $('#rStart').onclick = () => { location.hash = '#review/' + $('#rScope').value; };
  }
  function renderCard(app) {
    const w = review.queue[review.i]; const key = w.key;
    const s = P.srs[key];
    const preview = q => fmtInterval(applyRating(s, q).interval);
    app.classList.add('has-foot');
    app.innerHTML = `<div class="lesson" style="${scopeStyle(review.scope || { type: 'due' })}">
      <div class="lesson-top"><button class="x" id="rQuit" title="End session">✕</button><div class="bar unit"><i style="width:${Math.round(100 * review.i / review.queue.length)}%"></i></div><span class="small faint" style="font-weight:800">${review.i + 1}/${review.queue.length}</span></div>
      ${review.flipped ? '' : `<div class="bubble-row">${mascot('think')}<div class="bubble">${esc(tip('review'))}</div></div>`}
      <div class="flashcard pop" id="fc">
        <div class="row" style="justify-content:center;gap:.4rem"><div class="word">${esc(w.word)}</div>${speakBtn(w.word)}</div>
        <div class="row small" style="justify-content:center;margin-top:.4rem">${chip(key)}</div>
        ${review.flipped ? `<div style="margin-top:1.2rem">${w.senses.map(se => { const c = clustersById.get(se.clusterId); return `<div class="sense" style="${clusterStyle(c)}"><div class="cl">${clusterEmoji(c)} ${esc(clusterLabel(c))}</div><div class="mean">${esc(se.meaning)}</div><div class="mnem">💡 ${esc(se.mnemonic)}</div></div>`; }).join('')}
          ${P.notes[key] ? `<div class="sense"><div class="cl" style="color:var(--blue-t)">✍️ Your note</div><div style="font-weight:700">${esc(P.notes[key])}</div></div>` : ''}
          <div class="row" style="justify-content:center;margin-top:.6rem"><button class="btn ghost sm" data-word="${esc(key)}">Edit note / details</button></div></div>`
        : `<div class="hint">Think of the meaning, then tap to flip</div>`}
      </div>
    </div>
    <div class="lesson-foot"><div class="in">${review.flipped ? `<div class="rate-row grow">
        <button class="btn red" data-q="1">Again<span class="sub">${preview(1)}</span></button>
        <button class="btn orange" data-q="2">Hard<span class="sub">${preview(2)}</span></button>
        <button class="btn green" data-q="3">Good<span class="sub">${preview(3)}</span></button>
        <button class="btn blue" data-q="4">Easy<span class="sub">${preview(4)}</span></button></div>`
      : `<span class="faint small" style="font-weight:800">${esc(scopeLabel(review.scope || { type: 'due' }))}</span><button class="btn green lg grow" id="flip" style="max-width:320px">Show answer</button>`}</div></div>`;
    const flip = () => { review.flipped = true; sfx.play('flip'); render({ keepScroll: true }); };
    $('#fc').onclick = e => { if (!e.target.closest('[data-say]') && !e.target.closest('[data-word]') && !review.flipped) flip(); };
    const fb = $('#flip'); if (fb) fb.onclick = flip;
    $$('[data-q]').forEach(b => b.onclick = () => rateCard(+b.dataset.q));
    $('#rQuit').onclick = () => { if (review.done === 0) review.queue = []; else review.i = review.queue.length; render(); };
    if (S.autoSpeak && !review.flipped) speak(w.word);
    app._keys = e => {
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!review.flipped) flip(); }
      else if (review.flipped && /^[1-4]$/.test(e.key)) rateCard(+e.key);
      else if (e.key === 's') speak(w.word);
    };
  }
  function rateCard(q) {
    const w = review.queue[review.i];
    const xp = rate(w.key, q); review.xp += xp; review.done++; if (q >= 3) review.good++;
    floatXP(xp); sfx.play(q === 1 ? 'no' : 'ok');
    if (q === 1 && !review.again.includes(w.key)) review.again.push(w.key);
    review.i++; review.flipped = false; render();
  }

  // ───────────────────────────── celebration ─────────────────────────────
  function renderCelebration(app, o) {
    app.innerHTML = `<div class="lesson celebrate">
      <div style="display:flex;justify-content:center">${mascot(o.accuracy >= 50 ? 'party' : 'happy', 'bounce')}</div>
      <h1>${esc(o.title)}</h1><p class="muted" style="font-weight:700">${esc(o.sub)}</p>
      <div class="tiles">
        <div class="tile y"><div class="l">Total XP</div><div class="in"><div class="v">⚡ ${o.xp}</div></div></div>
        <div class="tile ${o.accuracy >= 80 ? 'g' : o.accuracy >= 50 ? 'b' : 'r'}"><div class="l">Accuracy</div><div class="in"><div class="v">${o.accuracy}%</div></div></div>
        <div class="tile b"><div class="l">Time</div><div class="in"><div class="v">⏱ ${fmtTime(o.time)}</div></div></div>
      </div>
      ${o.missed && o.missed.length ? `<div class="card" style="text-align:left"><h3>Worth another look</h3><ul class="list-plain">${uniqBy(o.missed, k => k).map(k => { const w = words.get(k); return `<li>${wordLink(w.word)} ${speakBtn(w.word)}<span class="muted small">${esc(w.senses[0].meaning)}</span></li>`; }).join('')}</ul></div>` : ''}
      <div class="btn-row" style="justify-content:center;margin-top:1.4rem">${o.retry ? `<button class="btn orange lg" id="cRetry">${esc(o.retry.label)}</button>` : ''}${o.extra ? `<button class="btn blue lg" id="cExtra">${esc(o.extra.label)}</button>` : ''}<button class="btn green lg" id="cDone">Continue</button></div>
    </div>`;
    confetti(); sfx.play('win');
    $('#cDone').onclick = () => { o.onDone && o.onDone(); location.hash = '#home'; if (route().name === 'home') render(); };
    const r = $('#cRetry'); if (r) r.onclick = o.retry.fn;
    const x = $('#cExtra'); if (x) x.onclick = o.extra.fn;
  }

  // ───────────────────────────── QUIZ ─────────────────────────────
  const quiz = { qs: [], i: 0, answered: false, sel: null, score: 0, wrong: [], scope: null, xp: 0, started: 0 };
  views.quiz = (app, param) => {
    if (param) { startQuiz(parseScope(param)); return; }
    if (!quiz.qs.length) return renderQuizStart(app);
    if (quiz.i >= quiz.qs.length) return renderCelebration(app, {
      title: quiz.score === quiz.qs.length ? 'Perfect!' : quiz.score / quiz.qs.length >= .7 ? 'Nice work!' : 'Good practice!', sub: `${quiz.score} of ${quiz.qs.length} correct · ${scopeLabel(quiz.scope)}`,
      xp: quiz.xp, accuracy: Math.round(100 * quiz.score / quiz.qs.length), time: Date.now() - quiz.started, missed: quiz.wrong,
      retry: { label: 'Play again', fn: () => { const sc = quiz.scope; quiz.qs = []; startQuiz(sc); } },
      extra: quiz.wrong.length ? { label: 'Review missed', fn: () => { Object.assign(review, { queue: uniqBy(quiz.wrong, k => k).map(k => words.get(k)), i: 0, flipped: false, done: 0, again: [], xp: 0, good: 0, started: Date.now(), scope: { type: 'weak' } }); quiz.qs = []; location.hash = '#review'; } } : null,
      onDone: () => { quiz.qs = []; },
    });
    renderQuestion(app);
  };
  function renderQuizStart(app) {
    const types = [['w2m', 'Word → meaning'], ['m2w', 'Meaning → word'], ['odd', 'Odd one out'], ['spell', 'Type the word']];
    app.innerHTML = `<div class="lesson">
      <div class="bubble-row">${mascot('happy', 'bounce')}<div class="bubble">${esc(tip('quiz'))}</div></div>
      <h1>Quiz</h1><div class="card">
      <div class="row"><label class="field grow">Words from<select id="qScope">${scopeOptions(LS.get('gre.quizScope', 'all'))}</select></label>
        <label class="field">Questions<select id="qCount">${[10, 15, 20, 30, 50].map(n => `<option ${S.quizCount === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:.8rem">${types.map(([k, l]) => `<label class="check"><input type="checkbox" data-type="${k}" ${S.quizTypes.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <div class="row" style="margin-top:.6rem"><label class="check"><input type="checkbox" id="qHard" ${S.hardQuiz ? 'checked' : ''}> <span>Hard mode: wrong options come from the <i>same</i> cluster</span></label></div>
      <div class="btn-row" style="margin-top:1rem"><button class="btn green lg" id="qStart">Start quiz</button></div>
      <p class="small faint" style="margin-top:.8rem">Wrong answers push a word back to "due" and onto your weak spots. Keys: <kbd>1</kbd>–<kbd>4</kbd> pick, <kbd>enter</kbd> check / continue.</p></div></div>`;
    $('#qStart').onclick = () => {
      S.quizCount = +$('#qCount').value; S.hardQuiz = $('#qHard').checked;
      S.quizTypes = $$('[data-type]').filter(c => c.checked).map(c => c.dataset.type);
      if (!S.quizTypes.length) { toast('Pick at least one question type'); return; }
      saveSettings(); LS.set('gre.quizScope', $('#qScope').value);
      location.hash = '#quiz/' + $('#qScope').value;
    };
  }
  function startQuiz(scope) {
    const pool = scopeWords(scope);
    if (pool.length < 4) { toast('Need at least 4 words in that scope'); location.hash = '#quiz'; return; }
    const chosen = sample(pool, Math.min(S.quizCount, pool.length));
    Object.assign(quiz, { qs: chosen.map(w => makeQuestion(w, pool)).filter(Boolean), i: 0, answered: false, sel: null, score: 0, wrong: [], scope, xp: 0, started: Date.now() });
    if (location.hash === '#quiz') render(); else location.hash = '#quiz';
  }
  function makeQuestion(w, pool) {
    const types = S.quizTypes.length ? S.quizTypes : ['w2m'];
    const sense = pick(w.senses); const cl = clustersById.get(sense.clusterId);
    const sameCluster = cl.entries.filter(e => e.word.toLowerCase() !== w.key);
    const others = wordList.filter(x => x.key !== w.key && !x.senses.some(s => s.clusterId === cl.id));
    const myMeanings = new Set(w.senses.map(s => s.meaning.toLowerCase()));
    let type = pick(types);
    if (type === 'odd' && (sameCluster.length < 3 || !others.length)) type = 'w2m';
    if (type === 'spell') {
      return { type, w, sense, cl, prompt: sense.meaning, hint: `${w.word[0].toUpperCase()} ${'_ '.repeat(w.word.length - 1).trim()}`, sub: `${w.word.length} letters · ${cl.name}`, answer: w.word };
    }
    if (type === 'odd') {
      const trio = sample(sameCluster, 3);
      const trioClusters = new Set(trio.flatMap(e => words.get(e.word.toLowerCase())?.senses.map(s => s.clusterId) || []));
      const clean = others.filter(o => !o.senses.some(s => trioClusters.has(s.clusterId)));
      const odd = pick(clean.length ? clean : others);
      const opts = shuffle([...trio.map(e => ({ text: e.word, ok: false, key: e.word.toLowerCase() })), { text: odd.word, ok: true, key: odd.key }]);
      const os = odd.senses[0], oc = clustersById.get(os.clusterId);
      return { type, w: odd, sense: os, cl: oc, prompt: 'Which word is the odd one out?', sub: 'Three of these share a meaning.', opts,
        explain: `${trio.map(e => e.word).join(', ')} are all “${cl.name}”. ${odd.word} means “${os.meaning}”.` };
    }
    const otherSrc = sample(others, 40).map(x => ({ word: x.word, meaning: x.senses[0].meaning }));
    const src = S.hardQuiz ? [...shuffle(sameCluster), ...otherSrc] : otherSrc;
    if (type === 'w2m') {
      const ds = uniqBy(src.filter(e => !myMeanings.has(e.meaning.toLowerCase())), e => e.meaning.toLowerCase()).slice(0, 3);
      if (ds.length < 3) return null;
      const opts = shuffle([{ text: sense.meaning, ok: true }, ...ds.map(e => ({ text: e.meaning, ok: false }))]);
      return { type, w, sense, cl, prompt: w.word, big: true, ask: 'What does this word mean?', opts, explain: `${w.word}: ${sense.meaning} · 💡 ${sense.mnemonic}` };
    }
    const ds = uniqBy(src.filter(e => e.meaning.toLowerCase() !== sense.meaning.toLowerCase() && e.word.toLowerCase() !== w.key), e => e.word.toLowerCase()).slice(0, 3);
    if (ds.length < 3) return null;
    const opts = shuffle([{ text: w.word, ok: true, key: w.key }, ...ds.map(e => ({ text: e.word, ok: false, key: e.word.toLowerCase() }))]);
    return { type, w, sense, cl, prompt: sense.meaning, ask: 'Which word means…', sub: `Cluster: ${cl.name}`, opts, explain: `${w.word}: ${sense.meaning} · 💡 ${sense.mnemonic}` };
  }
  function renderQuestion(app) {
    const q = quiz.qs[quiz.i];
    app.classList.add('has-foot');
    let body;
    if (q.type === 'spell') {
      body = `<div class="bubble-row">${mascot('think')}<div class="bubble">Type the word that means…</div></div><div class="q-prompt">${esc(q.prompt)}</div><div class="faint" style="font-family:monospace;font-weight:800;letter-spacing:.1em;margin:-.6rem 0 .3rem">${esc(q.hint)}</div><div class="faint small" style="margin-bottom:1rem">${esc(q.sub)}</div>
        <form id="spellForm"><input class="spell-input" id="spellIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type the word…" ${quiz.answered ? 'disabled' : ''}></form>`;
    } else {
      body = `<div class="bubble-row">${mascot(q.type === 'odd' ? 'think' : 'happy')}<div class="bubble">${esc(q.ask || q.prompt)}</div></div>
        ${q.big ? `<div class="q-prompt big">${esc(q.prompt)} ${speakBtn(q.prompt)}</div>` : `<div class="q-prompt">${esc(q.type === 'odd' ? q.sub : q.prompt)}</div>`}
        ${!q.big && q.sub && q.type !== 'odd' ? `<div class="faint small" style="margin:-.8rem 0 1rem;font-weight:800">${esc(q.sub)}</div>` : ''}
        <div class="options">${q.opts.map((o, i) => `<button class="opt ${quiz.sel === i ? 'selected' : ''}" data-i="${i}"><span class="key">${i + 1}</span><span>${esc(o.text)}</span></button>`).join('')}</div>`;
    }
    app.innerHTML = `<div class="lesson" style="${scopeStyle(quiz.scope)}">
      <div class="lesson-top"><button class="x" id="qQuit" title="Quit">✕</button><div class="bar unit"><i style="width:${Math.round(100 * quiz.i / quiz.qs.length)}%"></i></div><span class="small faint" style="font-weight:800">${quiz.score} ✓</span></div>
      ${body}</div>
      <div class="lesson-foot" id="foot"><div class="in"><button class="btn ghost" id="qSkip">Skip</button><button class="btn green lg" id="qCheck" disabled>Check</button></div></div>`;
    $('#qQuit').onclick = () => { if (quiz.i === 0 && !quiz.answered) quiz.qs = []; else quiz.i = quiz.qs.length; render(); };
    const opts = $$('.opt');
    const select = i => { if (quiz.answered) return; quiz.sel = i; opts.forEach((b, j) => b.classList.toggle('selected', j === i)); $('#qCheck').disabled = false; sfx.play('tap'); };
    opts.forEach(b => b.onclick = () => select(+b.dataset.i));
    const sf = $('#spellForm'), si = $('#spellIn');
    if (sf) { si.oninput = () => { $('#qCheck').disabled = !si.value.trim(); }; sf.onsubmit = e => { e.preventDefault(); check(); }; setTimeout(() => si.focus(), 30); }
    const next = () => { quiz.i++; quiz.answered = false; quiz.sel = null; render(); };
    const check = (skipped) => {
      if (quiz.answered) return;
      let ok = false;
      if (q.type === 'spell') { const v = (si.value || '').trim().toLowerCase(); if (!v && !skipped) return; ok = v === q.answer.toLowerCase(); }
      else { if (quiz.sel == null && !skipped) return; ok = quiz.sel != null && q.opts[quiz.sel].ok; }
      quiz.answered = true;
      if (ok) quiz.score++; else quiz.wrong.push(q.w.key);
      const xp = quizResult(q.w.key, ok); quiz.xp += xp;
      sfx.play(ok ? 'ok' : 'no'); if (ok) floatXP(xp);
      opts.forEach((b, i) => { b.disabled = true; if (q.opts[i].ok) b.classList.add('correct'); else if (i === quiz.sel) b.classList.add('wrong'); });
      if (si) { si.disabled = true; si.style.borderColor = ok ? 'var(--green)' : 'var(--red)'; }
      const foot = $('#foot'); foot.classList.add(ok ? 'ok' : 'no');
      foot.innerHTML = `<div class="in stack"><div><div class="msg">${ok ? pick(['Nicely done!', 'Correct!', 'You got it!', 'Excellent!']) : 'Not quite.'}</div><div class="detail">${esc(q.explain || `The word is ${q.answer} · 💡 ${q.sense.mnemonic}`)} <span class="wordlink" data-word="${esc(q.w.key)}" style="border-color:currentColor">details</span></div></div>
        <div class="btn-row" style="flex-wrap:nowrap;align-items:center">${speakBtn(q.w.word)}<button class="btn ${ok ? 'green' : 'red'} lg grow" id="qNext">${quiz.i + 1 < quiz.qs.length ? 'Continue' : 'See results'}</button></div></div>`;
      $('#qNext').onclick = next; $('#qNext').focus();
    };
    $('#qCheck').onclick = () => check();
    $('#qSkip').onclick = () => check(true);
    app._keys = e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Enter') { e.preventDefault(); quiz.answered ? next() : check(); }
      else if (!quiz.answered && q.opts && /^[1-4]$/.test(e.key)) { const i = +e.key - 1; if (q.opts[i]) select(i); }
    };
  }

  // ───────────────────────────── WEAK SPOTS ─────────────────────────────
  views.weak = app => {
    const list = weakWords();
    app.innerHTML = `<div style="${unitStyle('red')}">
      <div class="bubble-row">${mascot(list.length ? 'think' : 'party')}<div class="bubble">${list.length ? (list.length === 1 ? 'One word keeps slipping. Let\'s pin it down.' : `These ${list.length} words keep slipping. Let's pin them down.`) : 'No weak spots. You are on fire! 🔥'}</div></div>
      <div class="row between"><h1>Weak spots</h1>${list.length ? `<div class="btn-row"><a class="btn outline-blue sm" href="#listen/weak">🎧 Listen</a><a class="btn red sm" href="#review/weak">🃏 Review</a><a class="btn outline-blue sm" href="#quiz/weak">✏️ Quiz</a></div>` : ''}</div>
      <p class="muted small">Words you rated <b>Again</b> or missed in a quiz, worst first. They drop off as you get them right.</p>
      ${list.length ? `<div class="card table-wrap"><table class="words"><thead><tr><th>Word</th><th>Meaning</th><th>Misses</th><th>Status</th></tr></thead><tbody>
        ${list.map(({ w, lapses, wrong, right }) => `<tr class="weak-row"><td class="w">${wordLink(w.word)} ${speakBtn(w.word)}</td><td>${w.senses.map(s => `<div>${esc(s.meaning)} <span class="faint small">(${esc(clustersById.get(s.clusterId).name)})</span></div>`).join('')}</td><td><span class="misses">${lapses} again · ${wrong} wrong</span><div class="faint tiny">${right} right</div></td><td>${chip(w.key)}</td></tr>`).join('')}
      </tbody></table></div>` : ''}</div>`;
  };

  // ───────────────────────────── SETTINGS ─────────────────────────────
  views.settings = app => {
    const list = profiles();
    const customN = LS.get('gre.custom', { clusters: [] }).clusters.length;
    app.innerHTML = `<h1>Settings</h1>
      <div class="card"><h2>Profiles</h2><p class="small muted">Progress is stored per profile in this browser. Export a backup to move it to another device or share with your friend.</p>
        <ul class="list-plain">${list.map(n => `<li><b>${esc(n)}</b>${n === profile ? '<span class="chip known">current</span>' : `<button class="btn sm outline-blue" data-switch="${esc(n)}">Switch</button>`}<span class="grow"></span><button class="btn ghost sm" data-delp="${esc(n)}">Delete</button></li>`).join('')}</ul>
        <form id="addP" class="row" style="margin-top:.8rem"><input type="text" id="addPName" placeholder="New profile name" class="input"><button class="btn blue sm">Add</button></form></div>
      <div class="card"><h2>Study</h2>
        <div class="row" style="gap:1.2rem"><label class="field">New words per day<input type="number" id="sNew" min="1" max="200" value="${S.newPerDay}"></label>
        <label class="field">Daily goal (XP)<select id="sGoal">${[20, 30, 50, 100, 150, 250].map(n => `<option ${S.dailyGoal === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <div class="row" style="margin-top:.8rem;gap:1.2rem"><label class="check"><input type="checkbox" id="sAuto" ${S.autoSpeak ? 'checked' : ''}> Pronounce words automatically on flashcards</label>
        <label class="check"><input type="checkbox" id="sSound" ${S.sound ? 'checked' : ''}> Sound effects</label></div>
        <p class="small faint" style="margin-top:.6rem">XP: 10 per card rated Good or better, 5 for Again, 10 per correct quiz answer, 2 per word listened.</p></div>
      <div class="card"><h2>Voice</h2>
        <div class="row"><label class="field grow">Voice<select id="sVoice">${voices.map(v => `<option value="${esc(v.name)}" ${pickVoice()?.name === v.name ? 'selected' : ''}>${esc(v.name)} (${v.lang})</option>`).join('') || '<option>No voices</option>'}</select></label><button class="btn outline-blue" id="sTest">Test</button></div>
        <p class="small muted">Tip: on Windows, Edge has the most natural voices (look for “Natural” in the name). Chrome offers Google voices when online.</p></div>
      <div class="card"><h2>Backup & sharing</h2>
        <div class="btn-row"><button class="btn outline-blue" id="expProg">⬇ Export progress</button><label class="btn outline-blue">⬆ Import progress<input type="file" id="impProg" accept="application/json" hidden></label><button class="btn outline-blue" id="expAnki">⬇ Anki export (TSV)</button></div></div>
      <div class="card"><h2>Add more words</h2>
        <p class="small muted">Upload another handbook in the same Word format (Cluster headings + Word/Meaning/Mnemonic tables), or paste plain text: a line starting with <code>#</code> names a cluster, then one word per line as <code>word | meaning | mnemonic</code> (tabs also work).</p>
        <div class="btn-row"><label class="btn outline-blue">📄 Import .docx<input type="file" id="impDocx" accept=".docx" hidden></label></div>
        <textarea id="impText" style="margin-top:.8rem" placeholder="# Cluster name&#10;word | meaning | mnemonic"></textarea>
        <div class="row between" style="margin-top:.6rem"><button class="btn blue sm" id="impTextBtn">Import pasted words</button>${customN ? `<button class="btn ghost sm" id="clearCustom">Remove imported clusters (${customN})</button>` : ''}</div></div>
      <div class="card"><h2>Danger zone</h2><button class="btn red sm" id="resetAll">Reset all progress for ${esc(profile)}</button></div>`;

    $$('[data-switch]').forEach(b => b.onclick = () => { setProfile(b.dataset.switch); render(); toast('Switched to ' + profile); });
    $$('[data-delp]').forEach(b => b.onclick = () => {
      const n = b.dataset.delp; if (!confirm(`Delete profile "${n}" and all its progress?`)) return;
      LS.set('gre.profiles', profiles().filter(x => x !== n)); LS.del('gre.progress.' + n);
      if (n === profile) { profile = null; LS.del('gre.profile'); } render();
    });
    $('#addP').onsubmit = e => { e.preventDefault(); const n = $('#addPName').value.trim(); if (n) { setProfile(n); render(); } };
    $('#sNew').onchange = e => { S.newPerDay = Math.max(1, +e.target.value || 20); saveSettings(); };
    $('#sGoal').onchange = e => { S.dailyGoal = +e.target.value; saveSettings(); };
    $('#sAuto').onchange = e => { S.autoSpeak = e.target.checked; saveSettings(); };
    $('#sSound').onchange = e => { S.sound = e.target.checked; saveSettings(); sfx.play('ok'); };
    $('#sVoice').onchange = e => { S.voice = e.target.value; saveSettings(); };
    $('#sTest').onclick = () => sayWord('Perspicacious. Having keen insight.');
    $('#expProg').onclick = () => download(`gre-progress-${profile}-${dateKey()}.json`, JSON.stringify({ profile, exported: Date.now(), progress: P }, null, 1));
    $('#impProg').onchange = e => readFile(e.target.files[0], txt => {
      try { const d = JSON.parse(txt); const prog = d.progress || d; if (!prog.srs) throw 0; if (!confirm('Replace current progress with the imported file?')) return; P = prog; P.quiz ||= {}; P.notes ||= {}; P.log ||= {}; saveProgress(); toast('Progress imported'); render(); }
      catch { toast('That file is not a progress export'); }
    });
    $('#expAnki').onclick = () => {
      const rows = clusters.flatMap(c => c.entries.map(e => [e.word, `${e.meaning}<br><i>${e.mnemonic}</i>`, `cluster${c.id} day${c.day} ${c.name.replace(/[^a-z0-9]+/gi, '_')}`].join('\t')));
      download('gre-words-anki.tsv', rows.join('\n'));
    };
    $('#impDocx').onchange = e => importDocx(e.target.files[0]);
    $('#impTextBtn').onclick = () => { const cs = parseTextImport($('#impText').value); if (!cs.length) return toast('Nothing recognised'); addCustomClusters(cs); };
    const cc = $('#clearCustom'); if (cc) cc.onclick = () => { if (confirm('Remove all imported clusters?')) { LS.del('gre.custom'); buildIndex(); render(); } };
    $('#resetAll').onclick = () => { if (confirm(`Erase all progress for ${profile}?`)) { P = { srs: {}, quiz: {}, notes: {}, log: {}, created: Date.now() }; saveProgress(); toast('Progress reset'); render(); } };
  };

  // ───────────────────────────── import / export ─────────────────────────────
  function download(name, text) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function readFile(f, cb, asBuffer) { if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); asBuffer ? r.readAsArrayBuffer(f) : r.readAsText(f); }
  function parseTextImport(text) {
    const out = []; let cur = null;
    for (let line of text.split(/\r?\n/)) {
      line = line.trim(); if (!line) continue;
      if (line.startsWith('#')) { const m = line.replace(/^#+\s*/, '').match(/^(?:Cluster\s*#?\s*(\d+)\s*[—–:-]\s*)?(.+)$/i); cur = { id: m && m[1] ? +m[1] : null, name: m ? m[2].trim() : line, entries: [] }; out.push(cur); continue; }
      const parts = line.split(/\t|\s\|\s|\|/).map(s => s.trim());
      if (parts.length < 2 || /^word$/i.test(parts[0])) continue;
      if (!cur) { cur = { id: null, name: 'Imported words', entries: [] }; out.push(cur); }
      cur.entries.push({ word: parts[0], meaning: parts[1], mnemonic: parts[2] || '' });
    }
    return out.filter(c => c.entries.length);
  }
  function addCustomClusters(cs) {
    const custom = LS.get('gre.custom', { clusters: [] });
    const used = new Set(clusters.map(c => c.id)); let nextId = 1000;
    for (const c of cs) {
      let id = c.id && !used.has(c.id) ? c.id : null;
      if (!id) { while (used.has(nextId)) nextId++; id = nextId; }
      used.add(id);
      custom.clusters.push({ id, name: c.name, day: 'custom', entries: c.entries });
    }
    LS.set('gre.custom', custom); buildIndex();
    toast(`Imported ${cs.length} cluster(s), ${cs.reduce((a, c) => a + c.entries.length, 0)} words`); render();
  }
  async function importDocx(file) {
    if (!file) return;
    try {
      if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const zip = await JSZip.loadAsync(file);
      const xml = await zip.file('word/document.xml').async('string');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      const textOf = el => Array.from(el.getElementsByTagNameNS(W, 't')).map(t => t.textContent).join('');
      const body = doc.getElementsByTagNameNS(W, 'body')[0];
      const cs = []; let cur = null;
      for (const el of Array.from(body.children)) {
        if (el.localName === 'p') {
          const style = el.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || '';
          const t = textOf(el).trim(); if (!t) continue;
          const m = t.match(/^Cluster\s*#?\s*(\d+)\s*[—–:-]\s*(.+)$/i);
          if (m || /^Heading2$/i.test(style)) { cur = { id: m ? +m[1] : null, name: m ? m[2].trim() : t, entries: [] }; cs.push(cur); }
        } else if (el.localName === 'tbl' && cur) {
          for (const tr of Array.from(el.getElementsByTagNameNS(W, 'tr'))) {
            const cells = Array.from(tr.getElementsByTagNameNS(W, 'tc')).map(tc => textOf(tc).trim());
            if (cells.length < 2 || !cells[0] || /^word$/i.test(cells[0])) continue;
            cur.entries.push({ word: cells[0], meaning: cells[1], mnemonic: cells[2] || '' });
          }
        }
      }
      const good = cs.filter(c => c.entries.length);
      if (!good.length) return toast('No clusters found in that document');
      addCustomClusters(good);
    } catch (e) { console.error(e); toast('Could not read the .docx (needs internet the first time to load the reader)'); }
  }
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

  // ───────────────────────────── keyboard ─────────────────────────────
  document.addEventListener('keydown', e => {
    if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;
    if (e.key === '/') { e.preventDefault(); if (route().name !== 'browse') location.hash = '#browse'; setTimeout(() => $('#search')?.focus(), 50); return; }
    const h = $('#app')._keys; if (h) h(e);
  });

  // ───────────────────────────── boot ─────────────────────────────
  buildIndex();
  if (profile) loadProgress();
  updateProfileBtn();
  render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
