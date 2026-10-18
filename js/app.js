// App shell: progress, the Level 1 map, the lesson player frame, the piano dock, grown-ups, and the certificate.
(() => {
'use strict';
const NG = window.NG, A = NG.audio;
const {HUE, LETTERS, INK, textOn, pretty, esc} = NG;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
NG.$ = $; NG.$$ = $$;
NG.pick = arr => arr[Math.floor(Math.random() * arr.length)];
NG.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ================= progress ================= */
const STORE = 'noteGarden.v2';
const fresh = () => ({v:2, name:'', notes:{}, lessons:{}, tempo:{}, bubbleSpeed:30, sensitivity:'normal', speech:true, unlockAll:false, hl:12, certificate:false});
let P = (() => {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return Object.assign(fresh(), JSON.parse(raw));
    const old = localStorage.getItem('noteGarden.v1');
    if (old){ const p = fresh(); p.notes = JSON.parse(old).notes || {}; return p; }
  } catch (e){}
  return fresh();
})();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(P)); } catch (e){} };
NG.P = () => P; NG.save = save;

// Each note has a helper level. 3 = color + letter + glowing key, 2 = color + letter, 1 = color only, 0 = plain black note.
NG.HINT_LABEL = ['Reads plain notes', 'Color only', 'Color + letter', 'Color + letter + glowing key'];
const FADE_AFTER = 4;
NG.stat = l => P.notes[l] || (P.notes[l] = {hist:[], hint:3, streak:0});
NG.accuracy = l => { const h = NG.stat(l).hist; return h.length ? h.reduce((a, b) => a + b, 0) / h.length : null; };
NG.recordResult = (l, ok) => {
  const s = NG.stat(l);
  s.hist.push(ok ? 1 : 0); if (s.hist.length > 12) s.hist.shift();
  let faded = false;
  if (ok){ s.streak++; if (s.streak >= FADE_AFTER && s.hint > 0){ s.hint--; s.streak = 0; faded = true; } }
  else s.streak = 0;
  save(); return faded;
};
NG.bumpHint = l => { const s = NG.stat(l); s.hint = Math.min(3, s.hint + 1); s.streak = 0; save(); };

/* ================= the path ================= */
const LESSONS = NG.LEVEL1.flatMap((u, ui) => u.lessons.map((l, li) => Object.assign(l, {unit:u, ui, li})));
LESSONS.forEach((l, i) => { l.idx = i; });
NG.LESSONS = LESSONS;
const byId = id => LESSONS.find(l => l.id === id);
const starsOf = id => (P.lessons[id] && P.lessons[id].stars) || 0;
const isOpen = l => P.unlockAll || l.idx === 0 || starsOf(LESSONS[l.idx - 1].id) >= 1;
NG.starsOf = starsOf; NG.isOpen = isOpen; NG.lessonById = byId;
NG.nextLesson = () => LESSONS.find(l => starsOf(l.id) === 0 && isOpen(l)) || null;
NG.setResult = (id, stars, extra) => {
  const r = P.lessons[id] || (P.lessons[id] = {stars:0, plays:0});
  r.stars = Math.max(r.stars, stars); r.plays++;
  if (extra) Object.assign(r, extra);
  save();
};
// Notes the child has met: every note introduced up to and including the lesson they are on.
NG.metLetters = () => {
  const s = new Set();
  for (const l of LESSONS){ (l.intro || []).forEach(x => s.add(x)); if (starsOf(l.id) === 0) break; }
  return LETTERS.filter(l => s.has(l));
};
NG.weakLetters = () => NG.metLetters()
  .map(l => ({l, a:NG.accuracy(l), n:NG.stat(l).hist.length}))
  .filter(x => x.n >= 5 && x.a < 0.8)
  .sort((a, b) => a.a - b.a).slice(0, 2).map(x => x.l);
// Picks a letter, favoring ones the child gets wrong or still needs helpers for.
NG.weightedLetter = (pool, avoid) => {
  const w = pool.map(l => { const a = NG.accuracy(l); return [l, 1 + (a == null ? 1 : 1 - a) * 4 + NG.stat(l).hint * 0.5]; });
  for (let tries = 0; tries < 4; tries++){
    let t = w.reduce((s, x) => s + x[1], 0) * Math.random(), choice = w[0][0];
    for (const [l, wt] of w){ if ((t -= wt) <= 0){ choice = l; break; } }
    if (choice !== avoid || pool.length < 2) return choice;
  }
  return pool.find(l => l !== avoid);
};

/* ================= shared UI helpers ================= */
let toastTimer = null;
NG.toast = (text, ms = 5000) => { const t = $('#toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); };
NG.coach = (el, text, speak) => { if (el) el.textContent = text; if (speak) A.say(text); };
NG.starStr = n => '★'.repeat(n) + `<span class="off">${'★'.repeat(Math.max(0, 3 - n))}</span>`;
NG.chip = l => `<span class="chip" style="background:${HUE[l]};color:${textOn(l)}">${l}</span>`;
const PIP = '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#pip"/></svg>';
NG.PIP = PIP;

// The intro card Pip reads aloud before a quiz or rhythm lesson.
NG.intro = (stage, lesson, onStart, o = {}) => {
  stage.innerHTML = `<div class="intro">
    <div class="intro-pip">${PIP}</div>
    <div class="intro-body">
      <p class="intro-text">${esc(lesson.learn)}</p>
      ${lesson.visual ? `<div class="intro-visual">${lesson.visual()}</div>` : ''}
      ${o.extra || ''}
      <div class="row"><button class="btn primary big" data-go>${o.startLabel || "Let's go!"}</button><button class="btn" data-say>Hear Pip again</button></div>
    </div></div>`;
  A.say(lesson.learn);
  $('[data-go]', stage).onclick = () => { A.hush(); A.ensure(); onStart(); };
  $('[data-say]', stage).onclick = () => A.say(lesson.learn);
};

NG.showResult = (stage, r) => {
  const l = r.lesson, next = l && LESSONS[l.idx + 1];
  const ov = document.createElement('div');
  ov.className = 'finish';
  const acts = (r.actions || []).slice();
  if (l && l.recital && starsOf(l.id) >= 1) acts.unshift({label:'See my certificate', primary:true, fn:() => NG.showCertificate()});
  if (!r.noRetry && l) acts.push({label:'Try again', fn:() => NG.openLesson(l.id)});
  if (next && isOpen(next) && !r.noNext) acts.push({label:'Next lesson', primary:!acts.some(a => a.primary), fn:() => NG.openLesson(next.id)});
  acts.push({label:'Back to the map', fn:() => NG.showMap()});
  ov.innerHTML = `<div class="finish-card">
    ${r.stars != null ? `<div class="big-stars">${NG.starStr(r.stars)}</div>` : ''}
    <h3>${esc(r.title)}</h3><p>${esc(r.text || '')}</p>
    ${r.note ? `<p class="finish-note">${esc(r.note)}</p>` : ''}
    <div class="row">${acts.map((a, i) => `<button class="btn${a.primary ? ' primary' : ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
  ov.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) acts[+b.dataset.a].fn(); });
  stage.append(ov);
  if (r.stars) setTimeout(A.fanfare, 250);
  // Numbers stay on screen; Pip says the title and the advice.
  A.say([r.title, r.note || '']);
  if (NG.updateMapBadge) NG.updateMapBadge();
};

/* ================= routing input to whatever is on screen ================= */
let active = null;
NG.setActive = a => { if (active && active !== a && active.stop) active.stop(); active = a; NG.keys.clear(); };
A.on('note', d => {
  const hn = $('#hearNote'), letter = d.pc[0];
  hn.textContent = pretty(d.pc);
  hn.style.background = d.pc.length === 1 ? HUE[letter] : INK;
  hn.style.color = d.pc.length === 1 ? textOn(letter) : '#fff';
  if (d.src === 'mic') $$(`.key[data-pc="${d.pc}"]`).forEach(NG.keys.flash);
  if (active && active.onNote) active.onNote(d);
});
A.on('onset', d => { if (active && active.onOnset) active.onOnset(d); });
A.on('loudness', d => { if (active && active.onLoudness) active.onLoudness(d); });
A.on('level', rms => { $('#levelBar').style.width = Math.min(100, rms * 900) + '%'; });
A.on('mic', on => {
  $('#micBtn').setAttribute('aria-pressed', String(on));
  $('#micLabel').innerHTML = on ? 'Listening' : 'Listen<span class="long"> to my instrument</span>';
});

/* ================= piano dock ================= */
const WHITE = ['C4','D4','E4','F4','G4','A4','B4','C5'];
const BLACK = [['C#4',0],['D#4',1],['F#4',3],['G#4',4],['A#4',5]];
const COMPUTER_KEYS = {a:'C4', s:'D4', d:'E4', f:'F4', g:'G4', h:'A4', j:'B4', k:'C5', w:'C#4', e:'D#4', t:'F#4', y:'G#4', u:'A#4'};
NG.keys = {
  flash: k => { k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 180); },
  clear: () => $$('.key.hint').forEach(k => k.classList.remove('hint')),
  hint: name => { NG.keys.clear(); const k = $(`.key[data-note="${name}"]`); if (k) k.classList.add('hint'); },
};
function buildKeys(){
  const box = $('#keys');
  box.innerHTML = WHITE.map(n => { const l = n[0];
    return `<button class="key white" data-note="${n}" data-pc="${l}" aria-label="${l}"><span class="dot" style="background:${HUE[l]};color:${textOn(l)}">${l}</span></button>`; }).join('')
    + BLACK.map(([n, i]) => `<button class="key black" data-note="${n}" data-pc="${n.slice(0, 2)}" aria-label="${pretty(n.slice(0, 2))}" style="left:calc(${(i + 1) * 12.5}% - 3.8%)"></button>`).join('');
  // Where you tap sets the loudness: near the top of a key is soft, near the bottom is loud.
  box.addEventListener('pointerdown', e => {
    const k = e.target.closest('.key'); if (!k) return;
    e.preventDefault();
    const r = k.getBoundingClientRect(), vel = Math.max(0.25, Math.min(1, 0.2 + 0.85 * (e.clientY - r.top) / r.height));
    NG.keys.flash(k); A.press(k.dataset.note, vel);
  });
  box.addEventListener('keydown', e => {
    const k = e.target.closest('.key');
    if (k && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); NG.keys.flash(k); A.press(k.dataset.note, 0.75); }
  });
}
document.addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === ' ' && active && active.wantsTaps){ e.preventDefault(); A.tap(); return; }
  const n = COMPUTER_KEYS[e.key.toLowerCase()];
  if (n){ e.preventDefault(); const k = $(`.key[data-note="${n}"]`); if (k) NG.keys.flash(k); A.press(n, e.shiftKey ? 1 : 0.7); }
});

/* ================= views ================= */
let VIEW = 'level';
NG.setView = v => {
  VIEW = v;
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === v)));
  $$('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
  A.hush();
  $('.dock').hidden = v === 'grown' || (v === 'level' && $('#player').hidden);
  if (v === 'level'){ if ($('#player').hidden) NG.setActive(null); }
  else if (v === 'echo') NG.setActive(NG.games.echo.enter());
  else if (v === 'bubbles') NG.setActive(NG.games.bubbles.enter());
  else { NG.setActive(null); renderGrown(); }
};

/* ================= the map ================= */
const ICON = {
  song:'<svg viewBox="0 0 24 24"><path d="M9 17.5a3 3 0 1 1-2-2.83V5l11-2v11.5a3 3 0 1 1-2-2.83V6.4l-7 1.3z" fill="currentColor"/></svg>',
  rhythm:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="8" rx="8" ry="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 8v8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 2l5 5M10 2 5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  quiz:'<svg viewBox="0 0 24 24"><path d="M9.2 9a3 3 0 1 1 4.3 2.7c-1 .5-1.5 1.2-1.5 2.3v.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18.6" r="1.5" fill="currentColor"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M12 2.5l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 2.9 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor"/></svg>',
};
NG.ICON = ICON;
const TYPE_NAME = {song:'Song', rhythm:'Rhythm', quiz:'Activity', check:'Star check'};
NG.showMap = () => {
  NG.setActive(null); A.hush();
  NG.setView('level');
  $('#player').hidden = true; $('#map').hidden = false; $('.dock').hidden = true;
  renderMap(); window.scrollTo(0, 0);
};
function renderMap(){
  const total = LESSONS.length, done = LESSONS.filter(l => starsOf(l.id) > 0).length;
  const stars = LESSONS.reduce((s, l) => s + starsOf(l.id), 0), next = NG.nextLesson(), weak = NG.weakLetters();
  const recitalDone = starsOf('u7-recital') > 0;
  $('#mapHero').innerHTML = `
    <div class="hero-main">
      <div class="eyebrow">Level 1 · Note Garden</div>
      <h1>${done === 0 ? 'Welcome to the garden!' : recitalDone ? 'Level 1 complete!' : 'Welcome back!'}</h1>
      <div class="meter" aria-label="${done} of ${total} lessons done"><i style="width:${Math.round(done / total * 100)}%"></i></div>
      <p class="hero-stats"><b>${done}</b> of ${total} lessons · <b>${stars}</b> of ${total * 3} stars</p>
    </div>
    <div class="hero-next">
      ${next ? `<div class="eyebrow">Next up · Unit ${next.ui + 1}</div><div class="next-title"><span class="tile-ic t-${next.type}">${ICON[next.type]}</span>${esc(next.title)}</div>
        <button class="btn primary big" data-lesson="${next.id}">${done === 0 ? 'Start Level 1' : 'Keep going'}</button>`
        : `<div class="next-title">Every lesson has a star!</div><p class="hero-stats">Go back and earn three stars on each one.</p>`}
      ${recitalDone ? `<button class="btn" data-cert>See my certificate</button>` : ''}
      ${weak.length ? `<button class="btn" data-practice>Practice ${weak.join(' and ')}</button>` : ''}
    </div>`;
  $('#units').innerHTML = NG.LEVEL1.map((u, ui) => {
    const ls = u.lessons, got = ls.filter(l => starsOf(l.id) > 0).length, l0 = ls[0], color = HUE[LETTERS[ui]];
    const complete = got === ls.length;
    return `<section class="unit${isOpen(l0) ? '' : ' locked'}" style="--unit:${color}">
      <header class="unit-head">
        <span class="unit-num">${ui + 1}</span>
        <div><h2>${esc(u.title)}</h2><p>${esc(u.goal)}</p></div>
        <span class="unit-state">${complete ? 'Unit complete' : `${got} / ${ls.length}`}</span>
      </header>
      <ol class="tiles">${ls.map(l => {
        const open = isOpen(l), s = starsOf(l.id), isNext = next && next.id === l.id;
        return `<li><button class="tile${isNext ? ' next' : ''}${s ? ' done' : ''}" data-lesson="${l.id}" ${open ? '' : 'disabled'} aria-label="${esc(TYPE_NAME[l.type] + ': ' + l.title)}${open ? '' : ' (locked)'}">
          <span class="tile-ic t-${l.type}">${ICON[l.type]}</span>
          <span class="tile-t">${esc(l.title)}</span>
          <span class="tile-s">${open ? NG.starStr(s) : 'Locked'}</span>
          ${isNext ? '<span class="tile-badge">Next</span>' : ''}</button></li>`;
      }).join('')}</ol></section>`;
  }).join('');
}
NG.updateMapBadge = () => {};

/* ================= lesson player ================= */
NG.openLesson = id => {
  const l = byId(id); if (!l || !isOpen(l)) return;
  NG.setActive(null); A.hush();
  if (VIEW !== 'level') NG.setView('level');
  $('#map').hidden = true; $('#player').hidden = false; $('.dock').hidden = l.type === 'rhythm';
  $('#lessonEyebrow').textContent = `Unit ${l.ui + 1} · ${l.unit.title} · ${TYPE_NAME[l.type]}`;
  $('#lessonTitle').textContent = l.title;
  const stage = $('#stage');
  stage.innerHTML = ''; stage.className = 'page stage-' + l.type;
  window.scrollTo(0, 0);
  NG.setActive(NG.ACT[l.type](l, stage));
};
NG.openPractice = () => {
  NG.setActive(null); A.hush();
  if (VIEW !== 'level') NG.setView('level');
  $('#map').hidden = true; $('#player').hidden = false; $('.dock').hidden = false;
  $('#lessonEyebrow').textContent = 'Made just for you';
  $('#lessonTitle').textContent = "Pip's Practice Page";
  const stage = $('#stage'); stage.innerHTML = ''; stage.className = 'page stage-song';
  window.scrollTo(0, 0);
  NG.setActive(NG.ACT.practice(stage));
};

/* ================= grown-ups ================= */
function renderGrown(){
  const letters = LETTERS.filter(l => P.notes[l] || NG.metLetters().includes(l));
  $('#mastery').innerHTML = letters.length ? letters.map(l => {
    const a = NG.accuracy(l), s = NG.stat(l), pct = a == null ? null : Math.round(a * 100);
    return `<div class="m-row">${NG.chip(l)}
      <div><div class="m-bar"><i style="width:${pct || 0}%;background:${HUE[l]}"></i></div>
      <div class="m-sub">${NG.HINT_LABEL[s.hint]} · ${s.hist.length ? s.hist.length + ' recent tries' : 'not played yet'}</div></div>
      <span class="m-pct">${pct == null ? '–' : pct + '%'}</span></div>`;
  }).join('') : '<p class="empty">Progress shows up here after the first song.</p>';
  $('#unitProgress').innerHTML = NG.LEVEL1.map((u, ui) => {
    const ls = u.lessons, got = ls.filter(l => starsOf(l.id) > 0).length, st = ls.reduce((s, l) => s + starsOf(l.id), 0);
    return `<div class="u-row"><span class="unit-dot" style="background:${HUE[LETTERS[ui]]}">${ui + 1}</span><span>${esc(u.title)}</span>
      <span class="u-meta">${got}/${ls.length} lessons · ${st}/${ls.length * 3} ★</span></div>`;
  }).join('');
  $('#sensitivity').value = P.sensitivity;
  $('#speechSetting').checked = P.speech;
  $('#unlockAll').checked = P.unlockAll;
  $('#childName').value = P.name || '';
}

/* ================= certificate ================= */
NG.showCertificate = () => {
  const stars = LESSONS.reduce((s, l) => s + starsOf(l.id), 0);
  $('#certName').value = P.name || '';
  $('#certStars').textContent = `${stars} stars earned`;
  $('#certDate').textContent = new Date().toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'});
  $('#cert').hidden = false;
  A.fanfare();
  A.say('Congratulations! You finished Level 1 of Note Garden!');
};

/* ================= wiring ================= */
function init(){
  A.speechOn = P.speech;
  A.setSensitivity(P.sensitivity);
  if (!A.canSpeak){ $('#speechBtn').hidden = true; $('#speechSetting').closest('label').hidden = true; }
  $('#speechBtn').setAttribute('aria-pressed', String(P.speech));
  buildKeys();
  $$('.tab').forEach(t => t.addEventListener('click', () => t.dataset.view === 'level' ? NG.showMap() : NG.setView(t.dataset.view)));
  $('#micBtn').addEventListener('click', async () => {
    const r = await A.toggleMic();
    if (r.ok){ if (A.micOn()) NG.toast('Pip is listening. Play a note!', 2200); return; }
    NG.toast(r.why === 'blocked' ? 'The microphone is blocked. Allow it from the icon in the address bar, or tap the keys below.'
      : r.why === 'unsupported' ? 'This browser won\'t share the microphone with this page. Try Chrome or Edge, or tap the keys below.'
      : 'No microphone was found. You can still play with the keys below.');
  });
  $('#speechBtn').addEventListener('click', () => {
    P.speech = !P.speech; A.speechOn = P.speech; save();
    if (!P.speech) A.hush();
    $('#speechBtn').setAttribute('aria-pressed', String(P.speech));
    NG.toast(P.speech ? 'Pip will read aloud.' : 'Pip will stay quiet.', 1800);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lesson]'); if (b && !b.disabled){ NG.openLesson(b.dataset.lesson); return; }
    if (e.target.closest('[data-practice]')) NG.openPractice();
    if (e.target.closest('[data-cert]')) NG.showCertificate();
  });
  $('#backToMap').addEventListener('click', NG.showMap);
  $('#sensitivity').addEventListener('change', e => { P.sensitivity = e.target.value; A.setSensitivity(P.sensitivity); save(); });
  $('#speechSetting').addEventListener('change', e => { P.speech = e.target.checked; A.speechOn = P.speech; $('#speechBtn').setAttribute('aria-pressed', String(P.speech)); save(); });
  $('#unlockAll').addEventListener('change', e => { P.unlockAll = e.target.checked; save(); });
  $('#childName').addEventListener('input', e => { P.name = e.target.value.slice(0, 40); save(); });
  $('#certName').addEventListener('input', e => { P.name = e.target.value.slice(0, 40); save(); });
  $('#certClose').addEventListener('click', () => { $('#cert').hidden = true; });
  $('#certPrint').addEventListener('click', () => { try { window.print(); } catch (e){} });
  $('#resetBtn').addEventListener('click', () => { $('#resetConfirm').hidden = false; $('#resetBtn').hidden = true; });
  $('#resetNo').addEventListener('click', () => { $('#resetConfirm').hidden = true; $('#resetBtn').hidden = false; });
  $('#resetYes').addEventListener('click', () => {
    P = fresh(); save(); A.speechOn = true; A.setSensitivity('normal');
    $('#resetConfirm').hidden = true; $('#resetBtn').hidden = false;
    renderGrown(); NG.toast('Progress erased. Back to the start of Level 1.', 2500);
  });
  NG.showMap();
}

// Testing hooks.
NG.test = {
  press:A.press, tap:A.tap, tone:A.testTone, active:() => active,
  progress:() => JSON.parse(JSON.stringify(P)),
  complete(ids, stars = 3){ (ids === 'all' ? LESSONS.map(l => l.id) : ids).forEach(id => NG.setResult(id, stars, {learned:true})); },
  reset(){ P = fresh(); save(); },
};
window.NoteGarden = NG.test;
init();
})();
