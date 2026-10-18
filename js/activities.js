// Lesson activities: songs (learn it, then play with the beat), rhythm tapping, and quizzes.
(() => {
'use strict';
const NG = window.NG, A = NG.audio;
const {HUE, COLOR_NAME, KEY_HINT, WHERE, LETTERS, esc, pretty, parseNote} = NG;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ACT = NG.ACT = {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wobble = g => { if (!g) return; g.classList.remove('wobble'); void g.getBBox(); g.classList.add('wobble'); };
const clearOverlay = stage => $$('.finish', stage).forEach(o => o.remove());
// On narrow screens, one bar per line on a narrower staff keeps notes big enough to read.
NG.narrowLayout = stage => stage.clientWidth && stage.clientWidth < 560 ? {perLine:1, width:430} : {};
const noteAtStep = step => parseNote(LETTERS[((step % 7) + 7) % 7] + (4 + Math.floor(step / 7)));

function plantFlower(garden, l){
  const e = $('.garden-empty', garden); if (e) e.remove();
  const d = document.createElement('span'); d.className = 'flower';
  d.innerHTML = `<svg viewBox="0 0 40 74" aria-hidden="true"><path d="M20 74V30" stroke="#3E8E3A" stroke-width="3"/><path d="M20 56c-9-2-13-8-13-14 8 0 12 5 13 12z" fill="#5DB34F"/>`
    + [0, 72, 144, 216, 288].map(a => `<ellipse cx="20" cy="12" rx="6.5" ry="10" fill="${HUE[l] || '#5B4BDB'}" transform="rotate(${a} 20 22)"/>`).join('')
    + '<circle cx="20" cy="22" r="5.5" fill="#FFE7A0"/></svg>';
  garden.append(d);
}

/* =====================================================================
   Songs. "Learn it" waits for each note; "Play with the beat" keeps time.
   ===================================================================== */
const EARLY = 300, LATE = 380, PERFECT = 160;
function songActivity(stage, def, lesson, o = {}){
  const music = NG.parseMusic(def), notes = music.notes, practice = !!o.practice, P = NG.P();
  const tempoOf = () => P.tempo[def.id] || def.tempo || 72;
  const learned = () => !practice && !!(P.lessons[lesson.id] || {}).learned;
  let mode = 'learn', st = {idx:0, misses:0, firstTry:0, done:false}, layouts = [], timers = [], beatTimer = null, B = null, playing = false, alive = true;
  const newLetters = lesson.intro || [];
  stage.innerHTML = `
    <div class="bird" aria-hidden="true">${NG.PIP}</div>
    <div class="song-bar">
      <div class="song-info">${newLetters.length ? `<span class="new-notes">New: ${newLetters.map(NG.chip).join('')}</span>` : ''}${def.about ? `<span class="about">${esc(def.about)}</span>` : ''}</div>
      <div class="song-tools">
        ${practice ? '' : `<div class="seg" role="group" aria-label="How to play">
          <button data-mode="learn" aria-pressed="true">Learn it</button><button data-mode="beat" aria-pressed="false">Play with the beat</button></div>
        <span class="tempo"><button class="mini" data-tempo="-1" aria-label="Slower">−</button><span>♩ = <b data-bpm></b></span><button class="mini" data-tempo="1" aria-label="Faster">+</button></span>`}
        <button class="btn" data-hear>Hear it first</button>
        <button class="btn" data-restart>Start over</button>
      </div>
    </div>
    <div class="coach">${NG.PIP}<p class="coach-text" aria-live="polite"></p></div>
    <div class="countin" hidden></div>
    <div class="staves"></div>
    <div class="garden" aria-label="Flowers you grew"></div>`;
  const staves = $('.staves', stage), garden = $('.garden', stage), coachEl = $('.coach-text', stage), bird = $('.bird', stage), countin = $('.countin', stage);
  const say = (t, speak) => NG.coach(coachEl, t, speak);
  const noteEl = n => $(`.nh[data-n="${n}"]`, staves);

  function render(){
    const r = NG.renderMusic(music, {hint:l => NG.stat(l).hint, dyn:def.dyn, label:def.title, ...NG.narrowLayout(stage)});
    staves.innerHTML = r.html; layouts = r.layouts; sync();
  }
  function sync(){
    if (mode !== 'learn') return;
    $$('.nh', staves).forEach(g => {
      const n = +g.dataset.n;
      g.classList.toggle('done', n < st.idx);
      g.classList.toggle('current', n === st.idx && !st.done && !playing);
    });
  }
  function moveBird(n, scroll){
    const el = noteEl(n); if (!el) return;
    const head = $('.head', el), svg = el.ownerSVGElement;
    const r = head.getBoundingClientRect(), pr = stage.getBoundingClientRect(), sr = svg.getBoundingClientRect();
    if (!pr.width || !sr.height) return;
    const y = sr.top - pr.top + (NG.TOP - 2) * (sr.height / svg.viewBox.baseVal.height) - 48;
    // The first placement is instant so Pip doesn't fly in from the corner.
    const first = !bird.dataset.placed;
    if (first) bird.style.transition = 'none';
    bird.style.transform = `translate(${r.left + r.width / 2 - pr.left - 25}px, ${y}px)`;
    if (first){ void bird.offsetWidth; bird.style.transition = ''; bird.dataset.placed = '1'; }
    bird.classList.remove('hop'); void bird.offsetWidth; bird.classList.add('hop');
    if (scroll) svg.scrollIntoView({block:'nearest', behavior:'smooth'});
  }
  function helperFor(t){
    const h = NG.stat(t.letter).hint;
    if (h >= 2) return `Look for the ${COLOR_NAME[t.letter]} ${t.letter}.`;
    if (h === 1) return `It's the ${COLOR_NAME[t.letter]} note.`;
    return `It sits ${WHERE[t.step]}.`;
  }
  function setModeButtons(){
    $$('[data-mode]', stage).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const bb = $('[data-mode="beat"]', stage);
    if (bb){ bb.classList.toggle('locked', !learned()); bb.title = learned() ? '' : 'Finish "Learn it" first'; }
  }
  const updateTempo = () => { const el = $('[data-bpm]', stage); if (el) el.textContent = tempoOf(); };

  /* ----- learn it ----- */
  function startLearn(speak){
    stopPlay(); stopBeat(); clearOverlay(stage);
    mode = 'learn'; setModeButtons();
    st = {idx:0, misses:0, firstTry:0, done:false};
    garden.innerHTML = '<span class="garden-empty">Every right note grows a flower here.</span>';
    render();
    const intro = lesson.learn ? lesson.learn + ' ' : '';
    say(intro + 'Play the first note when you\'re ready. ' + helperFor(notes[0]), speak);
    setTimeout(() => updateCurrent(false), 30);
  }
  function updateCurrent(scroll = true){
    sync(); NG.keys.clear();
    const t = notes[st.idx]; if (!t || st.done) return;
    if (NG.stat(t.letter).hint >= 3 || st.misses >= 2) NG.keys.hint(t.name);
    moveBird(st.idx, scroll);
  }
  function learnInput(d){
    if (st.done || playing) return;
    const t = notes[st.idx];
    if (d.pc === t.pc){
      const first = st.misses === 0;
      if (first) st.firstTry++;
      const faded = NG.recordResult(t.letter, first);
      plantFlower(garden, t.letter);
      st.idx++; st.misses = 0;
      if (faded){ render(); say(NG.fadeMessage(t.letter), true); }
      else {
        const nx = notes[st.idx];
        say(nx ? `${NG.pick(NG.PRAISE)} ${NG.stat(nx.letter).hint >= 2 ? 'Next is ' + nx.letter + '.' : 'What comes next?'}` : NG.pick(NG.PRAISE));
      }
      if (st.idx >= notes.length) finishLearn(); else updateCurrent();
    } else {
      st.misses++;
      wobble(noteEl(st.idx));
      if (st.misses === 1) say(`That was ${pretty(d.pc)}. Try again! ${helperFor(t)}`);
      else if (st.misses === 2){
        NG.bumpHint(t.letter); render(); updateCurrent(false);
        const line = `Let me sing it for you. It's ${t.letter}. Find the glowing key.`;
        coachEl.textContent = line;
        A.say(line).then(() => { if (alive) A.tone(t.midi, {dur:0.9}); });
      } else say(`It's ${t.letter}, the ${COLOR_NAME[t.letter]} one. You can do it!`);
    }
  }
  function finishLearn(){
    st.done = true; NG.keys.clear(); sync();
    const n = notes.length, rate = st.firstTry / n;
    if (practice){
      NG.showResult(stage, {title:'Practice page done!', text:`${st.firstTry} of ${n} notes right on the first try.`, noRetry:true, noNext:true,
        actions:[{label:'New practice page', primary:true, fn:() => NG.openPractice()}]});
      return;
    }
    NG.setResult(lesson.id, rate >= 0.9 ? 2 : 1, {learned:true});
    setModeButtons();
    const total = NG.starsOf(lesson.id);
    NG.showResult(stage, {lesson, stars:total, title:rate >= 0.9 ? 'Beautiful playing!' : 'You played the whole song!',
      text:`${st.firstTry} of ${n} notes right on the first try.`,
      note:total < 3 ? (rate >= 0.9 ? 'Now play it with the beat to earn the third star.' : 'Get almost every note on the first try for a second star, then play with the beat for the third.') : '',
      actions:[{label:'Play with the beat', primary:true, fn:() => startBeat()}]});
  }

  /* ----- play with the beat ----- */
  function startBeat(){
    if (!learned()){ NG.toast('Finish "Learn it" first. Then you can play with the beat.', 2600); return; }
    stopPlay(); stopBeat(); clearOverlay(stage); A.hush();
    mode = 'beat'; setModeButtons(); NG.keys.clear();
    garden.innerHTML = '';
    render();
    $$('.nh', staves).forEach(g => g.classList.remove('done', 'current'));
    const tempo = tempoOf(), spb = 60 / tempo, ctx = A.ensure(), t0 = ctx.currentTime + 0.6, per = music.per;
    for (let b = 0; b < per + music.totalBeats; b++) A.click(t0 + b * spb, b % per === 0);
    const start = A.perfAt(t0);
    B = {spb, start, per, hits:0, perfect:0, judged:new Array(notes.length).fill(null), cur:-1, line:-1};
    notes.forEach(n => { n.time = start + (per + n.beat) * spb * 1000; });
    say(`Listen to the clicks. I'll count to ${per}, then you play along as the line moves.`);
    beatTimer = setInterval(beatTick, 25);
  }
  function beatTick(){
    const now = performance.now(), b = (now - B.start) / (B.spb * 1000) - B.per;
    if (b < -B.per) countin.hidden = true;
    else if (b < 0){
      const c = String(Math.floor(b + B.per) + 1);
      countin.hidden = false;
      if (countin.textContent !== c){ countin.textContent = c; countin.classList.remove('pulse'); void countin.offsetWidth; countin.classList.add('pulse'); }
    } else countin.hidden = true;
    const bb = Math.max(0, b), li = layouts.findIndex(L => bb >= L.startBeat && bb < L.endBeat);
    if (li >= 0){
      const heads = $$('.playhead', staves);
      if (li !== B.line){
        heads.forEach(p => { p.classList.remove('on'); });
        B.line = li; heads[li].ownerSVGElement.scrollIntoView({block:'nearest', behavior:'smooth'});
      }
      const x = NG.beatX(layouts[li], bb);
      heads[li].setAttribute('x1', x); heads[li].setAttribute('x2', x); heads[li].classList.add('on');
    }
    notes.forEach((n, i) => { if (!B.judged[i] && now > n.time + LATE){ B.judged[i] = 'miss'; mark(i, 'miss'); } });
    const cur = B.judged.findIndex(j => !j);
    if (cur !== B.cur){
      if (B.cur >= 0){ const g = noteEl(B.cur); if (g) g.classList.remove('current'); }
      B.cur = cur; NG.keys.clear();
      if (cur >= 0){ noteEl(cur).classList.add('current'); moveBird(cur, false); if (NG.stat(notes[cur].letter).hint >= 3) NG.keys.hint(notes[cur].name); }
    }
    if (b > music.totalBeats + 0.3) finishBeat();
  }
  function mark(i, kind){
    const g = noteEl(i); if (!g) return;
    g.classList.add(kind);
    const m = $('.mark', g); if (m) m.textContent = kind === 'miss' ? '✗' : '✓';
  }
  function beatInput(d){
    let best = -1, bd = 1e9;
    notes.forEach((n, i) => {
      if (B.judged[i]) return;
      const dt = d.t - n.time;
      if (dt >= -EARLY && dt <= LATE && Math.abs(dt) < bd){ bd = Math.abs(dt); best = i; }
    });
    if (best < 0) return;
    const n = notes[best];
    if (d.pc !== n.pc){ wobble(noteEl(best)); return; }
    const perfect = bd <= PERFECT;
    B.judged[best] = perfect ? 'perfect' : 'ok'; B.hits++; if (perfect) B.perfect++;
    mark(best, perfect ? 'perfect' : 'ok');
    plantFlower(garden, n.letter);
  }
  function finishBeat(){
    const R = B; stopBeat(); NG.keys.clear();
    const n = notes.length, rate = R.hits / n, t = tempoOf();
    let tempoNote = '';
    if (rate >= 0.9 && t < 120){ P.tempo[def.id] = t + 6; tempoNote = "Next time I'll count a little faster."; }
    else if (rate < 0.6 && t > 48){ P.tempo[def.id] = t - 6; tempoNote = "Next time I'll count a little slower."; }
    NG.save(); updateTempo();
    NG.setResult(lesson.id, rate >= 0.8 ? 3 : 0);
    NG.showResult(stage, {lesson, stars:NG.starsOf(lesson.id),
      title:rate >= 0.8 ? 'Right on the beat!' : rate >= 0.5 ? 'Good try!' : "Let's try that again",
      text:`${R.hits} of ${n} notes on the beat${R.perfect ? `, and ${R.perfect} were perfect` : ''}.`,
      note:(rate < 0.8 ? 'Play 8 out of 10 notes on the beat for the third star. ' : '') + tempoNote,
      noRetry:true, actions:[{label:'Play with the beat again', primary:rate < 0.8, fn:() => startBeat()}, {label:'Learn it again', fn:() => startLearn(false)}]});
  }
  function stopBeat(){
    clearInterval(beatTimer); beatTimer = null; B = null;
    countin.hidden = true;
    $$('.playhead', staves).forEach(p => { p.classList.remove('on'); });
  }

  /* ----- hear it first ----- */
  function hear(){
    if (playing){ stopPlay(); return; }
    if (B) return;
    A.hush();
    playing = true; $('[data-hear]', stage).textContent = 'Stop'; sync(); NG.keys.clear();
    const spb = 60 / tempoOf();
    say('Listen, then play it yourself!');
    music.events.forEach(ev => timers.push(setTimeout(() => {
      $$('.nh.sing', staves).forEach(g => g.classList.remove('sing'));
      if (ev.rest) return;
      A.tone(ev.midi, {dur:Math.max(0.3, ev.beats * spb * 0.9)});
      const g = noteEl(ev.n); if (g) g.classList.add('sing');
      moveBird(ev.n, true);
    }, ev.beat * spb * 1000)));
    timers.push(setTimeout(stopPlay, music.totalBeats * spb * 1000 + 200));
  }
  function stopPlay(){
    timers.forEach(clearTimeout); timers = [];
    if (!playing) return;
    playing = false;
    const hb = $('[data-hear]', stage); if (hb) hb.textContent = 'Hear it first';
    $$('.nh.sing', staves).forEach(g => g.classList.remove('sing'));
    if (mode === 'learn' && !st.done){ say(`Your turn! ${helperFor(notes[st.idx])}`); updateCurrent(); }
  }

  stage.addEventListener('click', e => {
    const m = e.target.closest('[data-mode]');
    if (m){ if (m.dataset.mode === 'beat') startBeat(); else startLearn(false); return; }
    const tb = e.target.closest('[data-tempo]');
    if (tb && !B){ P.tempo[def.id] = clamp(tempoOf() + 6 * +tb.dataset.tempo, 48, 132); NG.save(); updateTempo(); return; }
    if (e.target.closest('[data-hear]')) hear();
    if (e.target.closest('[data-restart]')){ if (mode === 'beat') startBeat(); else startLearn(false); }
  });
  const ro = window.ResizeObserver ? new ResizeObserver(() => { if (mode === 'learn' && !st.done && !playing) moveBird(st.idx, false); }) : null;
  if (ro) ro.observe(staves);
  updateTempo();
  startLearn(true);

  return {
    onNote(d){ if (mode === 'beat'){ if (B) beatInput(d); } else learnInput(d); },
    stop(){ alive = false; stopPlay(); stopBeat(); if (ro) ro.disconnect(); },
    debug:() => ({mode, st, B, notes}),
  };
}
ACT.song = (lesson, stage) => songActivity(stage, NG.SONGS[lesson.song], lesson);
ACT.practice = stage => {
  const met = NG.metLetters(), pool = met.length >= 2 ? met : ['C', 'D', 'E'], weak = NG.weakLetters(), ls = [];
  for (let i = 0; i < 8; i++) ls.push(weak.length && Math.random() < 0.5 ? NG.pick(weak) : NG.weightedLetter(pool, Math.random() < 0.6 ? ls[i - 1] : null));
  const def = {id:'practice', title:"Pip's Practice Page", tempo:72, bars:ls.slice(0, 4).join(' ') + ' | ' + ls.slice(4).join(' ')};
  return songActivity(stage, def, {learn:'I picked the notes you find trickiest.', intro:[]}, {practice:true});
};

/* =====================================================================
   Rhythm: Pip claps the rhythm, then the child taps it with the clicks.
   ===================================================================== */
ACT.rhythm = (lesson, stage) => {
  const def = NG.RHYTHMS[lesson.rhythm], music = NG.parseMusic(def), notes = music.notes, P = NG.P(), tkey = 'r-' + def.id;
  let phase = 'intro', timer = null, R = null, layouts = [], alive = true;
  const act = {wantsTaps:false, onOnset(d){ if (phase === 'turn' && R) tapInput(d.t); }, stop(){ alive = false; clearInterval(timer); act.wantsTaps = false; }, debug:() => ({phase, R, notes})};
  NG.intro(stage, lesson, build, {extra:`<div class="intro-visual wide">${NG.renderMusic(music, {perc:true, counts:true, label:def.title}).html}</div>`});
  return act;

  function build(){
    stage.innerHTML = `
      <div class="rh-top"><div class="phase" aria-live="polite">Listen to Pip</div>
        <div class="beat-lights" aria-hidden="true">${Array.from({length:music.per}, (_, i) => `<span>${i + 1}</span>`).join('')}</div></div>
      <div class="staves"></div>
      <div class="rh-pad"><button class="pad" data-pad aria-label="Drum: tap on each note">${NG.ICON.rhythm}<span>Tap</span></button>
        <p class="pad-help">Tap the drum or press Space on every note${A.micOn() ? '. You can clap, too' : ''}. Keep counting through long notes and rests.</p></div>
      <div class="row center"><button class="btn" data-listen>Listen again</button><button class="btn primary" data-turn>My turn</button></div>`;
    const r = NG.renderMusic(music, {perc:true, counts:true, label:def.title, ...NG.narrowLayout(stage)});
    $('.staves', stage).innerHTML = r.html; layouts = r.layouts;
    $('[data-pad]', stage).addEventListener('pointerdown', e => { e.preventDefault(); if (act.wantsTaps) A.tap(); else A.drum(); });
    $('[data-listen]', stage).onclick = () => { if (phase !== 'demo' && phase !== 'turn') demo(false); };
    $('[data-turn]', stage).onclick = () => { if (phase !== 'demo' && phase !== 'turn') turn(); };
    demo(true);
  }
  function phaseText(t){ const p = $('.phase', stage); if (p) p.textContent = t; }
  function run(kind, after){
    clearInterval(timer); clearOverlay(stage);
    const tempo = P.tempo[tkey] || def.tempo, spb = 60 / tempo, ctx = A.ensure(), t0 = ctx.currentTime + 0.5, per = music.per;
    // With the microphone on, the clicks stop after the count-in so Pip can hear the claps.
    const allClicks = kind === 'demo' || !A.micOn();
    for (let b = 0; b < per + music.totalBeats; b++) if (b < per || allClicks) A.click(t0 + b * spb, b % per === 0);
    if (kind === 'demo') notes.forEach(n => A.clap(t0 + (per + n.beat) * spb));
    const start = A.perfAt(t0);
    R = {kind, spb, start, per, judged:new Array(notes.length).fill(null), extra:0, line:-1};
    notes.forEach(n => { n.time = start + (per + n.beat) * spb * 1000; });
    $$('.nh', stage).forEach(g => { g.classList.remove('perfect', 'ok', 'miss', 'sing'); const m = $('.mark', g); if (m) m.textContent = ''; });
    const lights = $$('.beat-lights span', stage), cnts = $$('.cnt', stage), heads = $$('.playhead', stage);
    timer = setInterval(() => {
      const now = performance.now(), b = (now - R.start) / (R.spb * 1000) - R.per, whole = Math.floor(b + R.per);
      lights.forEach((s, i) => s.classList.toggle('on', whole >= 0 && whole % per === i));
      if (b < 0) phaseText(`${kind === 'demo' ? 'Listen to Pip' : 'Your turn'}: get ready…${whole >= 0 ? ' ' + (whole + 1) : ''}`);
      else phaseText(kind === 'demo' ? 'Listen to Pip' : 'Your turn! Tap on every note.');
      const fb = Math.floor(b);
      cnts.forEach(c => c.classList.toggle('now', +c.dataset.beat === fb));
      const bb = Math.max(0, b), li = layouts.findIndex(L => bb >= L.startBeat && bb < L.endBeat);
      if (li >= 0){
        if (li !== R.line){ heads.forEach(p => { p.classList.remove('on'); }); R.line = li; heads[li].ownerSVGElement.scrollIntoView({block:'nearest', behavior:'smooth'}); }
        const x = NG.beatX(layouts[li], bb); heads[li].setAttribute('x1', x); heads[li].setAttribute('x2', x); heads[li].classList.add('on');
      }
      notes.forEach((n, i) => {
        const g = $(`.nh[data-n="${i}"]`, stage);
        if (kind === 'demo' && g) g.classList.toggle('sing', now >= n.time && now < n.time + 220);
        if (kind === 'turn' && !R.judged[i] && now > n.time + 300){ R.judged[i] = 'miss'; mark(i, 'miss'); }
      });
      if (b > music.totalBeats + 0.4){
        clearInterval(timer);
        lights.forEach(s => s.classList.remove('on')); cnts.forEach(c => c.classList.remove('now'));
        heads.forEach(p => { p.classList.remove('on'); });
        after();
      }
    }, 25);
  }
  function demo(auto){
    phase = 'demo'; act.wantsTaps = false;
    run('demo', () => {
      phase = 'ready';
      if (auto && alive){ phaseText('Your turn next!'); setTimeout(() => { if (alive && phase === 'ready') turn(); }, 1000); }
      else phaseText('Press "My turn" when you are ready.');
    });
  }
  function turn(){ phase = 'turn'; act.wantsTaps = true; run('turn', finishTurn); }
  function mark(i, kind){
    const g = $(`.nh[data-n="${i}"]`, stage); if (!g) return;
    g.classList.add(kind);
    const m = $('.mark', g); if (m) m.textContent = kind === 'miss' ? '✗' : '✓';
  }
  function tapInput(t){
    let best = -1, bd = 1e9;
    notes.forEach((n, i) => { if (R.judged[i]) return; const dt = t - n.time; if (Math.abs(dt) <= 300 && Math.abs(dt) < bd){ bd = Math.abs(dt); best = i; } });
    if (best < 0){
      if (t > notes[0].time - 300 && t < notes[notes.length - 1].time + 600){ R.extra++; const pad = $('.pad', stage); if (pad){ pad.classList.remove('oops'); void pad.offsetWidth; pad.classList.add('oops'); } }
      return;
    }
    R.judged[best] = bd <= 120 ? 'perfect' : 'ok';
    mark(best, R.judged[best]);
  }
  function finishTurn(){
    phase = 'done'; act.wantsTaps = false;
    const n = notes.length, perfect = R.judged.filter(j => j === 'perfect').length, ok = R.judged.filter(j => j === 'ok').length;
    const score = clamp((perfect + 0.75 * ok) / n - 0.08 * R.extra, 0, 1);
    const stars = score >= 0.85 ? 3 : score >= 0.65 ? 2 : score >= 0.4 ? 1 : 0;
    if (stars) NG.setResult(lesson.id, stars);
    const tempo = P.tempo[tkey] || def.tempo;
    let note = '';
    if (score >= 0.9 && tempo < 100){ P.tempo[tkey] = tempo + 4; note = 'Next time the beat will be a little faster.'; }
    else if (score < 0.5 && tempo > 52){ P.tempo[tkey] = tempo - 6; note = 'Next time the beat will be a little slower.'; }
    NG.save();
    phaseText(stars ? 'Nice drumming!' : 'Listen again, then try once more.');
    NG.showResult(stage, {lesson, stars:NG.starsOf(lesson.id),
      title:stars === 3 ? 'Perfect rhythm!' : stars === 2 ? 'Great drumming!' : stars === 1 ? 'You kept the beat!' : "Let's try that again",
      text:`${perfect + ok} of ${n} notes on the beat${R.extra ? `, plus ${R.extra} extra tap${R.extra > 1 ? 's' : ''}` : ''}.`,
      note:(R.extra ? 'Only tap when a note starts. Count the long notes and rests quietly. ' : '') + note, noRetry:true,
      actions:[{label:'Try again', primary:stars < 3, fn:() => { clearOverlay(stage); turn(); }}, {label:'Listen again', fn:() => { clearOverlay(stage); demo(false); }}]});
  }
};

/* =====================================================================
   Quizzes and star checks. Each generator makes one question.
   kind "choice": tap an answer; "play": play a note; "loud": play soft or loud.
   ===================================================================== */
let lastFind = null, lastName = null;
const GEN = {
  highlow(spec, k, ctx){
    const P = NG.P(), gap = clamp(P.hl || 12, 2, 12), a = 55 + Math.floor(Math.random() * 14), up = Math.random() < 0.5, b = up ? a + gap : a - gap;
    return {kind:'choice', prompt:'Is the second note higher or lower?', listen:true,
      options:[{v:'up', label:'Higher', icon:'up'}, {v:'down', label:'Lower', icon:'down'}], answer:up ? 'up' : 'down',
      sound(){ A.tone(a, {dur:0.7}); A.tone(b, {dur:0.7, when:0.85}); },
      onRight(first){ if (first){ P.hl = Math.max(2, gap - 2); NG.save(); } },
      onWrong(){ P.hl = Math.min(12, gap + 3); NG.save(); },
      hint:() => 'Listen again. Does the second note go up like a bird, or down like a bear?',
      reveal:() => up ? 'It went up. Higher!' : 'It went down. Lower!'};
  },
  blackgroups(spec, k){
    const two = Math.random() < 0.5;
    if (k % 2 === 0) return {kind:'play', prompt:`Play a black key from a group of ${two ? 'two' : 'three'}.`,
      accept:pc => two ? ['C#', 'D#'].includes(pc) : ['F#', 'G#', 'A#'].includes(pc),
      hint:(t, d) => d && d.pc && d.pc.length === 1 ? `That was a white key. Look for the black keys in a group of ${two ? 'two' : 'three'}.`
        : `That black key is in a group of ${two ? 'three' : 'two'}. Try the other group!`,
      reveal:() => { NG.keys.hint(two ? 'C#4' : 'F#4'); return `Here's one! The glowing key is in a group of ${two ? 'two' : 'three'}.`; }};
    const ring = two ? NG.pick([['C#4', 'D#4'], ['C#5', 'D#5']]) : NG.pick([['F#4', 'G#4', 'A#4'], ['F#5', 'G#5', 'A#5']]);
    return {kind:'choice', prompt:'How many black keys are in the yellow group?',
      visual:NG.miniKeysSVG({ring, marks:Object.fromEntries(ring.map(r => [r, '#F5C800'])), label:'Piano keys with one group of black keys colored yellow'}),
      options:[{v:'2', label:'Two'}, {v:'3', label:'Three'}], answer:two ? '2' : '3',
      hint:() => 'Count the yellow keys: one, two…', reveal:() => `That group has ${two ? 'two' : 'three'} black keys.`};
  },
  findkeys(spec, k, ctx){
    const l = NG.weightedLetter(spec.letters, lastFind); lastFind = l;
    const pic = () => ctx.setVisual(NG.miniKeysSVG({marks:{[l + '4']:HUE[l], [l + '5']:HUE[l]}, labels:true, label:`Where ${l} is on the piano`}));
    return {kind:'play', prompt:`Find ${l} on the piano and play it.`, accept:pc => pc === l,
      onWrong(t){ if (t === 1) pic(); if (t === 2) NG.keys.hint(l + '4'); },
      hint:t => `${l} is ${KEY_HINT[l]}.${t >= 2 ? ' Look for the glowing key!' : ''}`,
      reveal:() => { pic(); NG.keys.hint(l + '4'); return `Here it is! ${l} is ${KEY_HINT[l]}.`; }};
  },
  linespace(){
    const step = Math.floor(Math.random() * 11), n = noteAtStep(step), line = step % 2 === 0;
    return {kind:'choice', prompt:'Is this note on a line or in a space?', visual:NG.snippetSVG([n], {level:0}),
      options:[{v:'line', label:'Line'}, {v:'space', label:'Space'}], answer:line ? 'line' : 'space',
      hint:() => 'Look closely. Does a line go right through the middle of the note?',
      reveal:() => line ? 'A line goes right through it. It\'s a line note!' : 'It sits between two lines. It\'s a space note!'};
  },
  stepskip(spec){
    const kinds = spec.kinds || ['step', 'skip', 'repeat'], kind = NG.pick(kinds), d = kind === 'step' ? 1 : kind === 'skip' ? 2 : 0;
    const a = Math.floor(Math.random() * 6); let b = Math.random() < 0.5 ? a + d : a - d;
    if (b < 0) b = a + d;
    const na = noteAtStep(a), nb = noteAtStep(b);
    return {kind:'choice', prompt:kinds.length === 2 ? 'Is this a step or a repeat?' : 'Is this a step, a skip, or a repeat?',
      visual:NG.snippetSVG([na, nb], {level:0}), listen:true,
      sound(){ A.tone(na.midi, {dur:0.6}); A.tone(nb.midi, {dur:0.6, when:0.7}); },
      options:['step', 'skip', 'repeat'].filter(x => kinds.includes(x)).map(x => ({v:x, label:x[0].toUpperCase() + x.slice(1)})), answer:kind,
      hint:() => kinds.includes('skip') ? 'A step moves to the very next line or space. A skip jumps over one. A repeat stays the same.'
        : 'A step moves to the very next line or space. A repeat stays in the same place.',
      reveal:() => `It's a ${kind}!`};
  },
  values(){
    const it = NG.pick([{beats:1, name:'quarter note'}, {beats:2, name:'half note'}, {beats:4, name:'whole note'}, {rest:true, beats:1, name:'quarter rest'}]);
    const vis = NG.snippetSVG([it.rest ? {rest:true, beats:1} : {...parseNote('G4'), beats:it.beats}], {level:0, label:it.name});
    if (it.rest || Math.random() < 0.2) return {kind:'choice', prompt:'Is this a note or a rest?', visual:vis,
      options:[{v:'note', label:'Note'}, {v:'rest', label:'Rest'}], answer:it.rest ? 'rest' : 'note',
      hint:() => 'Notes have round heads. Rests are quiet symbols with no head.',
      reveal:() => `That's a ${it.name}.`};
    return {kind:'choice', prompt:'How many beats does this note get?', visual:vis,
      options:[{v:'1', label:'1 beat'}, {v:'2', label:'2 beats'}, {v:'4', label:'4 beats'}], answer:String(it.beats),
      hint:() => 'Filled in with a stem: one beat. Hollow with a stem: two beats. Hollow with no stem: four beats.',
      reveal:() => `That's a ${it.name}. It gets ${it.beats} beat${it.beats > 1 ? 's' : ''}.`};
  },
  names(spec, k, ctx){
    const l = NG.weightedLetter(spec.letters, lastName); lastName = l;
    const n = parseNote(l + '4'), vis = () => NG.snippetSVG([n], {level:NG.stat(l).hint, label:'A note to play'});
    return {kind:'play', prompt:'Play this note!', visual:vis(), accept:pc => pc === l,
      onShow(){ if (NG.stat(l).hint >= 3) NG.keys.hint(n.name); },
      onRight(first){ if (NG.recordResult(l, first)) ctx.extra = NG.fadeMessage(l); },
      onWrong(t){ if (t === 2){ NG.bumpHint(l); ctx.setVisual(vis()); NG.keys.hint(n.name); } },
      onFail(){ NG.recordResult(l, false); },
      hint:t => t >= 2 ? `It's ${l}! Find the glowing key.` : NG.stat(l).hint >= 1 ? `It's the ${COLOR_NAME[l]} note.` : `This note sits ${WHERE[n.step]}.`,
      reveal:() => { NG.keys.hint(n.name); return `This note is ${l}. It sits ${WHERE[n.step]}.`; }};
  },
  dynamics(spec, k, ctx, count){
    if (!spec.listenOnly && k >= count - 2){
      const loud = k === count - 1;
      return {kind:'loud', target:loud ? 'loud' : 'soft',
        prompt:loud ? 'Now play a loud note: forte, like a lion!' : 'Play a soft note: piano, like a mouse.',
        visual:`<div class="dyn-big" aria-hidden="true">${loud ? 'f' : 'p'}</div><p class="play-hint">${A.micOn() ? 'Play any note on your instrument.' : 'On the keys below, tap near the top of a key for soft and near the bottom for loud.'}</p>`,
        hint:(t, d) => d && d.src === 'keys' ? (loud ? 'Tap near the bottom of a key for a big, loud sound.' : 'Tap gently near the top of a key for a small, soft sound.')
          : (loud ? 'Even louder! Play it strong, like a lion\'s roar.' : 'Softer, like a tiny mouse.'),
        reveal:() => loud ? 'Forte means loud!' : 'Piano means soft!'};
    }
    const loud = Math.random() < 0.5;
    return {kind:'choice', prompt:'Was that loud or soft?', listen:true, answer:loud ? 'f' : 'p',
      options:[{v:'f', label:'forte', sub:'loud', dyn:'f'}, {v:'p', label:'piano', sub:'soft', dyn:'p'}],
      sound(){ [60, 64, 67, 64, 60].forEach((m, i) => A.tone(m, {dur:0.35, vel:loud ? 1 : 0.16, when:i * 0.28})); },
      hint:() => 'Listen again. Big and strong, or small and gentle?',
      reveal:() => loud ? 'That was forte: loud!' : 'That was piano: soft!'};
  },
};
NG.GEN = GEN;
const ARROW = {up:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 8h-4.5v8h-5v-8H5z" fill="currentColor"/></svg>',
  down:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20l-7-8h4.5V4h5v8H19z" fill="currentColor"/></svg>'};

ACT.quiz = ACT.check = (lesson, stage) => {
  let qs = [], qi = 0, q = null, tries = 0, firstTry = 0, results = [], alive = true, busy = false, softRef = null, pending = null;
  const ctx = {extra:null, setVisual:html => { const v = $('.qvisual', stage); if (v) v.innerHTML = html; }};
  const act = {
    onNote(d){ if (q && q.kind === 'play' && !busy) answer(q.accept(d.pc), d); },
    onLoudness(d){ if (q && q.kind === 'loud' && !busy) judgeLoud(d); },
    stop(){ alive = false; clearTimeout(pending); },
    debug:() => ({q, qi, tries, firstTry, results}),
  };
  NG.intro(stage, lesson, start);
  return act;

  function start(){
    const count = lesson.count || 6;
    let specs = Array.from({length:count}, (_, k) => lesson.gens[k % lesson.gens.length]);
    if (lesson.type === 'check') specs = NG.shuffle(specs);
    qs = specs.map((g, k) => GEN[g.gen](g, k, ctx, count));
    qi = 0; firstTry = 0; results = []; softRef = null;
    stage.innerHTML = `<div class="quiz">
      <div class="qdots" aria-hidden="true">${qs.map(() => '<span></span>').join('')}</div>
      <div class="qcard">
        <h2 class="qprompt" aria-live="polite"></h2>
        <div class="qvisual"></div>
        <div class="qopts"></div>
        <p class="qfeedback" aria-live="polite"></p>
        <div class="row center"><button class="btn" data-again>Hear it again</button></div>
      </div></div>`;
    $('[data-again]', stage).onclick = () => { if (q) (q.sound ? q.sound() : A.say(q.prompt)); };
    $('.qopts', stage).addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b && q && q.kind === 'choice' && !busy && !b.disabled) answer(b.dataset.v === String(q.answer), {btn:b});
    });
    show();
  }
  function show(){
    q = qs[qi]; tries = 0; busy = false; ctx.extra = null; NG.keys.clear();
    $$('.qdots span', stage).forEach((s, i) => { s.className = results[i] || (i === qi ? 'now' : ''); });
    $('.qprompt', stage).textContent = q.prompt;
    ctx.setVisual(q.visual || '');
    $('.qopts', stage).innerHTML = q.kind === 'choice'
      ? q.options.map(o => `<button class="opt" data-v="${o.v}">${o.icon ? ARROW[o.icon] : ''}${o.dyn ? `<span class="opt-dyn">${o.dyn}</span>` : ''}<span class="opt-l">${esc(o.label)}</span>${o.sub ? `<span class="opt-s">${esc(o.sub)}</span>` : ''}</button>`).join('')
      : q.kind === 'play' ? `<p class="play-hint">Play it on your instrument${A.micOn() ? '' : ' (turn on listening at the top)'} or on the keys below.</p>` : '';
    feedback('', '');
    $('[data-again]', stage).hidden = !q.sound;
    if (q.onShow) q.onShow();
    A.say(q.prompt).then(() => { if (alive && qs[qi] === q && q.sound) q.sound(); });
  }
  function feedback(text, cls){ const f = $('.qfeedback', stage); if (f){ f.textContent = text; f.className = 'qfeedback ' + cls; } }
  function judgeLoud(d){
    let ok;
    if (d.src === 'keys') ok = q.target === 'loud' ? d.vel >= 0.7 : d.vel <= 0.55;
    else if (q.target === 'soft'){ ok = true; softRef = d.rms; }
    else ok = softRef ? d.rms >= softRef * 1.6 : d.rms >= 0.08;
    answer(ok, d);
  }
  function answer(ok, info){
    if (ok){
      busy = true;
      const first = tries === 0;
      if (first) firstTry++;
      results[qi] = first ? 'good' : 'helped';
      if (q.onRight) q.onRight(first);
      if (info && info.btn) info.btn.classList.add('right');
      const text = ctx.extra || NG.pick(NG.PRAISE);
      feedback(text, 'good'); if (ctx.extra) A.say(text); else A.hush();
      pending = setTimeout(next, ctx.extra ? 2600 : 1100);
      return;
    }
    tries++;
    if (q.onWrong) q.onWrong(tries, info);
    if (info && info.btn){ info.btn.classList.add('wrong'); info.btn.disabled = true; }
    if (tries >= 3 || (q.kind === 'choice' && q.options.length - tries <= 1 && tries >= 2)){
      busy = true; results[qi] = 'missed';
      if (q.onFail) q.onFail();
      const text = q.reveal();
      feedback(text, 'bad'); A.say(text);
      pending = setTimeout(next, 3000);
      return;
    }
    const text = q.hint(tries, info);
    feedback(text, 'try');
    A.say(text).then(() => { if (alive && qs[qi] === q && q.listen && q.sound) q.sound(); });
  }
  function next(){ NG.keys.clear(); qi++; if (qi >= qs.length) finish(); else show(); }
  function finish(){
    q = null;
    $$('.qdots span', stage).forEach((s, i) => { s.className = results[i] || ''; });
    const n = qs.length, rate = firstTry / n;
    const stars = rate >= 0.9 ? 3 : rate >= 0.7 ? 2 : rate >= 0.4 ? 1 : 0;
    if (stars) NG.setResult(lesson.id, stars);
    if (lesson.recital && stars){ NG.P().certificate = true; NG.save(); }
    NG.showResult(stage, {lesson, stars, title:stars === 3 ? 'Superstar!' : stars === 2 ? 'Great job!' : stars === 1 ? 'You did it!' : "Let's practice a bit more",
      text:`${firstTry} of ${n} right on the first try.`,
      note:stars === 0 ? 'Get 4 out of 10 right on the first try to earn a star.' : lesson.recital ? 'You finished Level 1!' : ''});
  }
};
})();
