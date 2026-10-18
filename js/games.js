// Free-play games: Echo Bird (ear training) and Bubble Pop (note reading against the clock).
(() => {
'use strict';
const NG = window.NG, A = NG.audio;
const {HUE, INK, textOn, parseNote, PCS} = NG;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
NG.games = {};

/* ================= Echo Bird ================= */
const ROUNDS = 6;
let EB = {running:false, results:[]};
const pool = () => { const m = NG.metLetters(); return m.length >= 3 ? m : ['C', 'D', 'E']; };
function dots(){
  $('#echoDots').innerHTML = Array.from({length:ROUNDS}, (_, i) =>
    `<span class="${EB.results[i] || (EB.running && i === EB.round ? 'now' : '')}"></span>`).join('');
}
function showNote(mode){
  const el = $('#echoNote'), l = EB.target && EB.target.letter;
  if (mode === 'hidden' || !l){ el.textContent = '?'; el.style.background = ''; el.style.color = ''; return; }
  el.style.background = HUE[l]; el.style.color = textOn(l);
  el.textContent = mode === 'color' ? '' : l;
}
function sing(){
  if (!EB.target) return;
  A.tone(EB.target.midi, {dur:0.9});
  const p = $('#pipBig'); p.classList.remove('sing'); void p.offsetWidth; p.classList.add('sing');
}
const msg = t => { $('#echoMsg').textContent = t; };
function echoStart(){
  A.ensure(); clearTimeout(EB.timer);
  EB = {running:true, round:0, target:null, misses:0, score:0, waiting:false, results:[], timer:null};
  $('#echoStart').textContent = 'Start over'; $('#echoReplay').disabled = false;
  nextRound();
}
function nextRound(){
  if (EB.round >= ROUNDS) return finish();
  const prev = EB.target && EB.target.letter;
  EB.target = parseNote(NG.weightedLetter(pool(), prev) + '4');
  EB.misses = 0; EB.waiting = false; NG.keys.clear(); showNote('hidden'); dots();
  msg('Listen…');
  EB.timer = setTimeout(() => { sing(); EB.waiting = true; msg('Your turn! Play it back.'); }, 650);
}
function echoInput(d){
  if (!EB.running || !EB.waiting) return;
  const t = EB.target;
  if (d.pc === t.pc){
    EB.waiting = false; NG.keys.clear();
    EB.results[EB.round] = EB.misses === 0 ? 'good' : 'helped';
    if (EB.misses === 0) EB.score++;
    showNote('letter');
    msg(EB.misses === 0 ? `Perfect echo! It was ${t.letter}.` : `You found it! It was ${t.letter}.`);
    EB.round++; dots();
    EB.timer = setTimeout(nextRound, 1400);
    return;
  }
  EB.misses++; EB.waiting = false;
  const dir = PCS.indexOf(t.pc) > PCS.indexOf(d.pc) ? 'higher' : 'lower';
  if (EB.misses === 1){ showNote('color'); msg(`Close! Pip's note is ${dir}. Here's its color.`); }
  else { showNote('letter'); NG.keys.hint(t.name); msg(`It's ${t.letter}. Find the glowing key.`); }
  EB.timer = setTimeout(() => { sing(); EB.waiting = true; }, 800);
}
function finish(){
  EB.running = false; NG.keys.clear(); dots(); EB.target = null; showNote('hidden');
  msg(`You echoed ${EB.score} of ${ROUNDS} notes on the first try!`);
  A.say(`You echoed ${EB.score} of ${ROUNDS} notes on the first try!`);
  $('#echoStart').textContent = 'Play again'; $('#echoReplay').disabled = true;
  setTimeout(A.fanfare, 200);
}
NG.games.echo = {
  enter(){
    clearTimeout(EB.timer); EB = {running:false, results:[]};
    showNote('hidden'); dots(); msg('');
    $('#echoStart').textContent = 'Start singing game'; $('#echoReplay').disabled = true;
    return {onNote:echoInput, stop(){ clearTimeout(EB.timer); EB.running = false; EB.waiting = false; }};
  },
};
$('#echoStart').addEventListener('click', echoStart);
$('#echoReplay').addEventListener('click', () => { if (EB.running && EB.target) sing(); });

/* ================= Bubble Pop ================= */
const GOAL = 12;
let BP = {running:false, bubbles:[], focus:[]};
const speedName = v => v < 28 ? 'gentle' : v < 42 ? 'steady' : v < 62 ? 'quick' : 'zooming';
function miniStaff(n){
  const sp = 8, bot = 46, y = bot - (n.step - 2) * sp / 2, h = NG.stat(n.letter).hint, fill = h >= 1 ? HUE[n.letter] : INK;
  let s = '<svg viewBox="0 0 80 62" aria-hidden="true">';
  for (let k = 0; k < 5; k++) s += `<line x1="6" x2="74" y1="${bot - k * sp}" y2="${bot - k * sp}" stroke="#58557A" stroke-width="1.3"/>`;
  if (n.step <= 0) s += `<line x1="27" x2="49" y1="${bot + sp}" y2="${bot + sp}" stroke="#58557A" stroke-width="1.3"/>`;
  s += `<line x1="44.5" x2="44.5" y1="${y - 2}" y2="${y - 26}" stroke="${INK}" stroke-width="1.8"/>`;
  s += `<ellipse cx="38" cy="${y}" rx="7.2" ry="5.2" transform="rotate(-20 38 ${y})" fill="${fill}"/>`;
  if (h >= 2) s += `<text x="38" y="${y + 3.4}" font-size="8.5" font-weight="800" text-anchor="middle" fill="${textOn(n.letter)}" font-family="Baloo 2, sans-serif">${n.letter}</text>`;
  return s + '</svg>';
}
function stats(){
  $('#bpPopped').textContent = BP.popped || 0; $('#bpGoal').textContent = GOAL;
  $('#bpEscaped').textContent = BP.escaped || 0; $('#bpSpeed').textContent = speedName(BP.speed || NG.P().bubbleSpeed);
}
function intro(){
  stop();
  const weak = NG.weakLetters();
  BP.focus = weak;
  $('#bubblesFocus').textContent = weak.length ? `Pip will send lots of ${weak.join(' and ')} bubbles.` : `Bubbles use the notes you have met: ${pool().join(', ')}.`;
  $('#arenaStart').hidden = false; $('#bubblesStart').textContent = 'Start popping';
  BP.speed = NG.P().bubbleSpeed; BP.popped = 0; BP.escaped = 0; stats(); $('#bpMsg').textContent = '';
}
function start(){
  A.ensure();
  const focus = BP.focus || [];
  stop();
  BP = {running:true, bubbles:[], speed:NG.P().bubbleSpeed, popped:0, escaped:0, nextSpawn:0, last:performance.now(), focus, timer:0};
  $('#arenaStart').hidden = true; $('#bpMsg').textContent = 'Play the note in a bubble!';
  stats();
  BP.timer = setTimeout(() => tick(performance.now()), 16);
}
function stop(){
  BP.running = false; clearTimeout(BP.timer);
  (BP.bubbles || []).forEach(b => b.el.remove()); BP.bubbles = [];
}
function spawn(){
  const arena = $('#arena');
  const l = BP.focus.length && Math.random() < 0.6 ? NG.pick(BP.focus) : NG.weightedLetter(pool());
  const n = parseNote(l + '4'), el = document.createElement('div');
  el.className = 'bubble'; el.innerHTML = miniStaff(n);
  // Spread bubbles across lanes so two never stack.
  const lanes = Math.max(2, Math.floor((arena.clientWidth - 20) / 104));
  const used = new Set(BP.bubbles.filter(b => b.y > arena.clientHeight - 200).map(b => b.lane));
  let lane = Math.floor(Math.random() * lanes);
  for (let k = 0; k < lanes && used.has(lane); k++) lane = (lane + 1) % lanes;
  el.style.left = (10 + lane * ((arena.clientWidth - 116) / Math.max(1, lanes - 1))) + 'px';
  arena.append(el);
  BP.bubbles.push({n, el, lane, y:arena.clientHeight + 6, wob:Math.random() * 6.3});
}
function tick(t){
  if (!BP.running) return;
  const dt = Math.min(0.05, (t - BP.last) / 1000); BP.last = t;
  if (t >= BP.nextSpawn && BP.bubbles.length < 5){ spawn(); BP.nextSpawn = t + Math.max(1300, 4200 - BP.speed * 40); }
  for (const b of [...BP.bubbles]){
    b.y -= BP.speed * dt; b.wob += dt * 2.2;
    b.tf = `translate(${Math.sin(b.wob) * 7}px, ${b.y}px)`;
    b.el.style.transform = b.tf;
    if (b.y < -100) escape(b);
  }
  BP.timer = setTimeout(() => tick(performance.now()), 16);
}
function escape(b){
  b.el.remove(); BP.bubbles.splice(BP.bubbles.indexOf(b), 1);
  BP.escaped++; NG.recordResult(b.n.letter, false);
  BP.speed = Math.max(16, BP.speed * 0.85);
  $('#bpMsg').textContent = `A ${b.n.letter} floated away. Pip slowed the bubbles down.`;
  stats();
}
function input(d){
  if (!BP.running) return;
  const hits = BP.bubbles.filter(b => b.n.pc === d.pc);
  if (!hits.length){
    const a = $('#arena'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
    $('#bpMsg').textContent = `No ${NG.pretty(d.pc)} bubbles right now. Look again!`; return;
  }
  const b = hits.reduce((m, x) => x.y < m.y ? x : m);
  BP.bubbles.splice(BP.bubbles.indexOf(b), 1);
  b.el.style.setProperty('--t', b.tf || 'none'); b.el.classList.add('pop');
  setTimeout(() => b.el.remove(), 320);
  BP.popped++; NG.recordResult(b.n.letter, true);
  BP.speed = Math.min(110, BP.speed * 1.07);
  $('#bpMsg').textContent = `${NG.pick(NG.PRAISE)} That was ${b.n.letter}.`;
  stats();
  if (BP.popped >= GOAL){
    const P = NG.P(); P.bubbleSpeed = Math.max(18, Math.round(BP.speed * 0.9)); NG.save();
    const escaped = BP.escaped;
    stop(); setTimeout(A.fanfare, 200);
    const text = `You popped ${GOAL} bubbles${escaped ? ` and only ${escaped} got away` : ' and none got away'}! Next time starts a little ${escaped < 3 ? 'faster' : 'gentler'}.`;
    $('#bpMsg').textContent = text; A.say(text);
    $('#arenaStart').hidden = false; $('#bubblesStart').textContent = 'Pop again'; $('#bubblesFocus').textContent = '';
  }
}
NG.games.bubbles = {enter(){ intro(); return {onNote:input, stop}; }};
$('#bubblesStart').addEventListener('click', start);
})();
