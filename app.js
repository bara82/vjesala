(() => {
  "use strict";

  // ---------- konstante ----------
  const BASE_KEYS = ["A","B","C","Č","Ć","D","DŽ","Đ","E","F","G","H","I","J","K","L","LJ","M","N","NJ","O","P","R","S","Š","T","U","V","Z","Ž"];
  const DIGRAPHS = { N: "J", L: "J", D: "Ž" };     // prvo slovo -> drugo slovo dvoslova
  const DIFFS = {
    lako:    { lives: 10, min: 2, max: 6 },
    srednje: { lives: 8,  min: 5, max: 9 },
    tesko:   { lives: 6,  min: 8, max: 99 }
  };
  const PARTS = 10;
  const STORE = "vjesala.v2";
  const CATS = window.VJESALA_WORDS || {};

  const PRAISE = ["Bravo!","Super!","Odlično!","Tako je!","Pogodak!","Sjajno!"];
  const OOPS = ["Nema ga.","Ups!","Nije tu.","Probaj drugo."];

  const $ = id => document.getElementById(id);
  const el = {
    home: $("home"), game: $("game"),
    catChips: $("catChips"), diffSeg: $("diffSeg"), playBtn: $("playBtn"), duoBtn: $("duoBtn"),
    stats: $("stats"), offlineNote: $("offlineNote"),
    homeBtn: $("homeBtn"), catPill: $("catPill"), lives: $("lives"),
    hangman: $("hangman"), word: $("word"), feedback: $("feedback"),
    hintBtn: $("hintBtn"), solveBtn: $("solveBtn"), keyboard: $("keyboard"),
    duoDlg: $("duoDlg"), duoForm: $("duoForm"), secretInput: $("secretInput"), clueInput: $("clueInput"),
    peekBtn: $("peekBtn"), duoError: $("duoError"), duoCancel: $("duoCancel"),
    solveDlg: $("solveDlg"), solveForm: $("solveForm"), solveInput: $("solveInput"),
    solveError: $("solveError"), solveCancel: $("solveCancel"),
    endDlg: $("endDlg"), endEmoji: $("endEmoji"), endTitle: $("endTitle"), endWord: $("endWord"),
    endText: $("endText"), endHome: $("endHome"), endNext: $("endNext"),
    confetti: $("confetti")
  };

  // ---------- spremanje (localStorage može biti nedostupan) ----------
  const defaults = { cat: "sve", diff: "lako", stats: { played: 0, won: 0, streak: 0, best: 0 }, recent: [], current: null };
  let store = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "null");
      return Object.assign({}, defaults, s || {}, { stats: Object.assign({}, defaults.stats, (s && s.stats) || {}) });
    } catch (e) { return JSON.parse(JSON.stringify(defaults)); }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {} }

  // ---------- riječi ----------
  const upper = s => (s || "").normalize("NFC").toLocaleUpperCase("hr");
  const isLetter = ch => /\p{L}/u.test(ch);

  // Rastavi tekst na znakove igre: slova, dvoslove (NJ, LJ, DŽ) i ostalo (razmak, crtica)
  function tokenize(text) {
    const s = upper(text).replace(/\s+/g, " ").trim();
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!isLetter(ch)) { out.push({ t: ch, fixed: true }); continue; }
      const second = DIGRAPHS[ch];
      if (second && s[i + 1] === second) { out.push({ t: ch + second }); i++; continue; }
      out.push({ t: ch });
    }
    return out;
  }
  const letterCount = text => tokenize(text).filter(x => !x.fixed).length;
  const tokensToText = toks => toks.map(x => x.t).join("");

  function pool(cat, diff) {
    const keys = cat === "sve" ? Object.keys(CATS) : [cat];
    const seen = new Set(), all = [];
    keys.forEach(k => (CATS[k] ? CATS[k].words : []).forEach(w => {
      if (!seen.has(w)) { seen.add(w); all.push({ w, cat: k }); }
    }));
    const d = DIFFS[diff];
    const fit = all.filter(x => { const n = letterCount(x.w); return n >= d.min && n <= d.max; });
    return fit.length >= 4 ? fit : all;
  }

  function pickWord(cat, diff) {
    const list = pool(cat, diff);
    let fresh = list.filter(x => !store.recent.includes(x.w));
    if (!fresh.length) {
      const inList = new Set(list.map(x => x.w));
      store.recent = store.recent.filter(w => !inList.has(w));
      fresh = list;
    }
    const pick = fresh[Math.floor(Math.random() * fresh.length)];
    store.recent.push(pick.w);
    if (store.recent.length > 150) store.recent = store.recent.slice(-150);
    return pick;
  }

  // ---------- stanje igre ----------
  let g = null;   // trenutna igra

  function newGame({ word, label, diff, duo }) {
    const toks = tokenize(word);
    g = {
      word: tokensToText(toks), label, diff, duo: !!duo,
      lives: DIFFS[diff].lives, wrong: 0,
      guessed: [], hinted: [], hintUsed: false, over: false, won: false
    };
    store.current = g; save();
    showGame();
  }

  const tokens = () => tokenize(g.word);
  const isRevealed = tok => tok.fixed || g.guessed.includes(tok.t);
  const allRevealed = () => tokens().every(isRevealed);
  const livesLeft = () => Math.max(0, g.lives - g.wrong);

  function guess(letter) {
    if (!g || g.over || g.guessed.includes(letter)) return;
    g.guessed.push(letter);
    const hit = tokens().some(x => x.t === letter);
    if (hit) {
      say(PRAISE[Math.floor(Math.random() * PRAISE.length)], "good");
      vibrate(15);
    } else {
      g.wrong++;
      say(OOPS[Math.floor(Math.random() * OOPS.length)], "bad");
      vibrate([30, 40, 30]);
      el.lives.classList.remove("shake"); void el.lives.offsetWidth; el.lives.classList.add("shake");
    }
    afterMove(hit ? letter : null);
  }

  function hint() {
    if (!g || g.over || g.hintUsed || livesLeft() <= 1) return;
    const hidden = [...new Set(tokens().filter(x => !isRevealed(x)).map(x => x.t))];
    if (hidden.length < 2) return;
    const t = hidden[Math.floor(Math.random() * hidden.length)];
    g.hintUsed = true;
    g.hinted.push(t);
    g.guessed.push(t);
    g.wrong++;
    say("💡 Evo jednog slova!", "");
    afterMove(t);
  }

  function solve(text) {
    const attempt = tokensToText(tokenize(text));
    if (attempt === g.word) {
      tokens().forEach(x => { if (!x.fixed && !g.guessed.includes(x.t)) g.guessed.push(x.t); });
      afterMove(null);
      return true;
    }
    g.wrong = Math.min(g.lives, g.wrong + 2);
    say("Nije ta riječ. −2 života", "bad");
    vibrate([30, 40, 30]);
    afterMove(null);
    return false;
  }

  function afterMove(revealed) {
    if (allRevealed()) finish(true);
    else if (g.wrong >= g.lives) finish(false);
    store.current = g.over ? null : g; save();
    render(revealed);
  }

  function finish(won) {
    g.over = true; g.won = won;
    if (!g.duo) {
      const s = store.stats;
      s.played++;
      if (won) { s.won++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
    }
    setTimeout(() => showEnd(), won ? 900 : 1300);
    if (won) confetti();
  }

  // ---------- prikaz ----------
  function render(justRevealed) {
    // srca
    el.lives.innerHTML = `<span class="heart">${livesLeft() ? "❤️" : "🖤"}</span><span>${livesLeft()}</span>`;
    el.lives.classList.toggle("low", livesLeft() <= 2);
    el.lives.setAttribute("aria-label", `Preostalo života: ${livesLeft()} od ${g.lives}`);

    // čovječuljak
    const steps = g.wrong >= g.lives ? PARTS : Math.floor(g.wrong * PARTS / g.lives);
    el.hangman.querySelectorAll(".part").forEach(p => p.classList.toggle("on", +p.dataset.step <= steps));
    const mouth = el.hangman.querySelector(".mouth");
    mouth.setAttribute("d", g.over && !g.won ? "M178 94 Q190 86 202 94" : "M178 89 Q190 98 202 89");
    el.hangman.classList.toggle("lost", g.over && !g.won);
    el.hangman.classList.toggle("won", g.over && g.won);

    // riječ
    const toks = tokens();
    const groups = [[]];
    toks.forEach(x => { if (x.t === " ") groups.push([]); else groups[groups.length - 1].push(x); });
    const longest = Math.max(...groups.map(w => w.length), 1);
    const avail = Math.min(window.innerWidth, 640) - 32;
    const size = Math.max(20, Math.min(46, Math.floor(avail / (longest + 0.12 * (longest - 1)))));
    el.word.style.setProperty("--s", size + "px");
    el.word.innerHTML = "";
    groups.forEach(w => {
      const wd = document.createElement("div");
      wd.className = "w";
      w.forEach(x => {
        const s = document.createElement("div");
        s.className = "slot";
        if (x.t.length > 1) s.classList.add("di");
        if (x.fixed) { s.classList.add("fixed"); s.textContent = x.t; }
        else if (isRevealed(x)) {
          s.textContent = x.t;
          if (g.hinted.includes(x.t)) s.classList.add("hinted");
          if (x.t === justRevealed) s.classList.add("show");
        } else if (g.over) { s.textContent = x.t; s.classList.add("missed"); }
        wd.appendChild(s);
      });
      el.word.appendChild(wd);
    });
    const shown = toks.map(x => x.t === " " ? " " : (isRevealed(x) ? x.t : "_")).join(" ");
    el.word.setAttribute("aria-label", "Riječ: " + shown);

    // tipkovnica
    const extra = [...new Set(toks.filter(x => !x.fixed && !BASE_KEYS.includes(x.t)).map(x => x.t))];
    const keys = BASE_KEYS.concat(extra);
    if (el.keyboard.dataset.keys !== keys.join(",")) {
      el.keyboard.innerHTML = "";
      keys.forEach(k => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "key" + (k.length > 1 ? " di" : "");
        b.textContent = k; b.dataset.k = k;
        b.setAttribute("aria-label", "Slovo " + k);
        el.keyboard.appendChild(b);
      });
      el.keyboard.dataset.keys = keys.join(",");
    }
    const inWord = new Set(toks.map(x => x.t));
    el.keyboard.querySelectorAll(".key").forEach(b => {
      const k = b.dataset.k, used = g.guessed.includes(k);
      b.classList.toggle("good", used && inWord.has(k));
      b.classList.toggle("bad", used && !inWord.has(k));
      b.disabled = used || g.over;
    });

    el.hintBtn.disabled = g.over || g.hintUsed || livesLeft() <= 1 ||
      new Set(toks.filter(x => !isRevealed(x)).map(x => x.t)).size < 2;
    el.solveBtn.disabled = g.over;
  }

  function say(text, kind) {
    el.feedback.textContent = text || " ";
    el.feedback.className = "feedback" + (kind ? " " + kind : "");
  }

  function showGame() {
    el.home.hidden = true; el.game.hidden = false;
    el.catPill.textContent = g.label;
    say("Odaberi slovo 👇", "");
    render(null);
    window.scrollTo(0, 0);
  }

  function showHome() {
    closeAll();
    el.game.hidden = true; el.home.hidden = false;
    renderHome();
    window.scrollTo(0, 0);
  }

  function renderHome() {
    // kategorije
    const cats = [["sve", "🎲", "Sve"]].concat(Object.keys(CATS).map(k => [k, CATS[k].emoji, CATS[k].name]));
    if (!CATS[store.cat] && store.cat !== "sve") store.cat = "sve";
    el.catChips.innerHTML = "";
    cats.forEach(([k, e, n]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("role", "radio");
      b.dataset.cat = k; b.textContent = `${e} ${n}`;
      b.setAttribute("aria-checked", String(store.cat === k));
      el.catChips.appendChild(b);
    });
    el.diffSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.diff === store.diff)));

    // nastavak prekinute igre
    const cur = store.current;
    el.playBtn.innerHTML = cur && !cur.over ? "▶ Nastavi igru<small>" + escapeHtml(cur.label) + "</small>" : "▶ Igraj";

    // statistika
    const s = store.stats;
    const pct = s.played ? Math.round(100 * s.won / s.played) : 0;
    el.stats.innerHTML =
      stat(s.played, "odigrano") + stat(pct + "%", "pobjeda") + stat(s.streak, "u nizu") + stat(s.best, "najbolji niz");
  }
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function startRandom() {
    const p = pickWord(store.cat, store.diff);
    const c = CATS[p.cat];
    newGame({ word: p.w, label: `${c.emoji} ${c.name}`, diff: store.diff, duo: false });
  }

  function showEnd() {
    if (!g || !g.over) return;
    const won = g.won;
    el.endEmoji.textContent = won ? (g.wrong === 0 ? "🏆" : "🎉") : "😵";
    el.endTitle.textContent = won ? (g.wrong === 0 ? "Bez ijedne greške!" : "Pogodio si!") : "Ovaj put nije uspjelo";
    el.endWord.textContent = g.word;
    if (g.duo) el.endText.textContent = won ? "Pogađač je pobijedio! 🥳" : "Pobijedio je onaj tko je zadao riječ.";
    else {
      const s = store.stats;
      el.endText.textContent = won ? (s.streak > 1 ? `${s.streak} pobjede zaredom! 🔥` : "Idemo još jednu?") : "Ništa zato — idemo dalje!";
    }
    el.endNext.textContent = g.duo ? "Nova riječ (za dvoje)" : "Nova riječ";
    if (!el.endDlg.open) el.endDlg.showModal();
  }

  function closeAll() { [el.duoDlg, el.solveDlg, el.endDlg].forEach(d => { if (d.open) d.close(); }); }

  function confetti() {
    const colors = ["#ff7a59", "#ffc93c", "#22a06b", "#4f8cff", "#c86bfa"];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement("i");
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
      c.style.animationDelay = Math.random() * .4 + "s";
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.confetti.appendChild(c);
    }
    setTimeout(() => { el.confetti.innerHTML = ""; }, 4000);
  }

  function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  // ---------- događaji: početni ekran ----------
  el.catChips.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    store.cat = b.dataset.cat; save(); renderHome();
  });
  el.diffSeg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    store.diff = b.dataset.diff; save(); renderHome();
  });
  el.catChips.addEventListener("click", () => { if (store.current) { store.current = null; save(); renderHome(); } }, true);
  el.diffSeg.addEventListener("click", () => { if (store.current) { store.current = null; save(); } }, true);

  el.playBtn.addEventListener("click", () => {
    if (store.current && !store.current.over) { g = store.current; showGame(); }
    else startRandom();
  });

  // ---------- igra za dvoje ----------
  function openDuo() {
    el.secretInput.value = ""; el.clueInput.value = ""; el.duoError.textContent = "";
    el.secretInput.classList.remove("peek");
    el.duoDlg.showModal();
    el.secretInput.focus();
  }
  el.duoBtn.addEventListener("click", openDuo);
  el.duoCancel.addEventListener("click", () => el.duoDlg.close());
  el.peekBtn.addEventListener("click", () => {
    const on = el.secretInput.classList.toggle("peek");
    el.peekBtn.textContent = on ? "🙈" : "👁";
    el.secretInput.focus();
  });
  el.duoForm.addEventListener("submit", e => {
    e.preventDefault();
    const raw = upper(el.secretInput.value).replace(/[^\p{L}\s-]/gu, "").replace(/\s+/g, " ").trim();
    if (letterCount(raw) < 2) { el.duoError.textContent = "Upiši riječ od barem 2 slova."; return; }
    const clue = el.clueInput.value.trim();
    el.duoDlg.close();
    store.current = null;
    newGame({ word: raw, label: clue ? `👥 Trag: ${clue}` : "👥 Igra za dvoje", diff: "srednje", duo: true });
    // u igri za dvoje: 10 života kao u originalu
    g.lives = 10; store.current = g; save(); render(null);
  });

  // ---------- igra ----------
  el.homeBtn.addEventListener("click", showHome);
  el.keyboard.addEventListener("click", e => {
    const b = e.target.closest(".key"); if (!b || b.disabled) return;
    guess(b.dataset.k);
  });
  el.hintBtn.addEventListener("click", hint);
  el.solveBtn.addEventListener("click", () => {
    if (!g || g.over) return;
    el.solveInput.value = ""; el.solveError.textContent = "";
    el.solveDlg.showModal(); el.solveInput.focus();
  });
  el.solveCancel.addEventListener("click", () => el.solveDlg.close());
  el.solveForm.addEventListener("submit", e => {
    e.preventDefault();
    if (letterCount(el.solveInput.value) < 1) { el.solveError.textContent = "Upiši riječ."; return; }
    el.solveDlg.close();
    solve(el.solveInput.value);
  });

  el.endHome.addEventListener("click", showHome);
  el.endNext.addEventListener("click", () => {
    const duo = g && g.duo;
    el.endDlg.close();
    if (duo) openDuo(); else startRandom();
  });

  // ---------- fizička tipkovnica (laptop / tablet s tipkovnicom) ----------
  // N, L i D čekaju kratko da vidimo slijedi li J / Ž (NJ, LJ, DŽ).
  let pending = null;
  function flushPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    const k = pending.k; pending = null;
    guess(k);
  }
  window.addEventListener("keydown", e => {
    if (el.game.hidden || !g || g.over) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "Enter" && document.activeElement && document.activeElement.classList.contains("key")) return;
    if (!e.key || e.key.length !== 1) return;
    const k = upper(e.key);
    if (!isLetter(k)) return;
    e.preventDefault();

    if (pending) {
      if (DIGRAPHS[pending.k] === k) {
        const di = pending.k + k;
        clearTimeout(pending.timer); pending = null;
        // dvoslov samo ako nije već pogođen; inače tretiraj kao dva slova
        if (!g.guessed.includes(di)) { guess(di); return; }
        guess(di.slice(0, 1));
      } else flushPending();
    }
    if (DIGRAPHS[k] && !g.guessed.includes(k + DIGRAPHS[k])) {
      pending = { k, timer: setTimeout(flushPending, 450) };
      return;
    }
    const known = el.keyboard.querySelector(`.key[data-k="${CSS.escape(k)}"]`);
    if (known) guess(k);
  });

  window.addEventListener("resize", () => { if (g && !el.game.hidden) render(null); });

  // ---------- offline (service worker) ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js").then(() => navigator.serviceWorker.ready).then(() => {
      el.offlineNote.textContent = "✈️ Spremno za igru bez interneta.";
    }).catch(() => {});
  }

  // ---------- start ----------
  renderHome();
})();
