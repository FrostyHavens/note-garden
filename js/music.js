// Music basics and notation rendering for Note Garden.
window.NG = window.NG || {};
(() => {
'use strict';
const NG = window.NG;

const PCS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const LETTERS = ['C','D','E','F','G','A','B'];
const STEP = {C:0,D:1,E:2,F:3,G:4,A:5,B:6};
// Rainbow note colors, as used on color-coded bells and Boomwhackers in early music classes.
const HUE = {C:'#E5383B',D:'#F3862B',E:'#EDBE1F',F:'#3FA845',G:'#2B97D4',A:'#4A55CF',B:'#9A4FC6'};
const COLOR_NAME = {C:'red',D:'orange',E:'yellow',F:'green',G:'blue',A:'dark blue',B:'purple'};
const INK = '#2B2A45';
const textOn = l => l === 'E' ? INK : '#fff';
const textOnWhite = l => l === 'E' ? '#A07A00' : HUE[l];
const KEY_HINT = {
  C:'just to the left of the two black keys', D:'in the middle of the two black keys', E:'just to the right of the two black keys',
  F:'just to the left of the three black keys', G:'between the first two of the three black keys',
  A:'between the last two of the three black keys', B:'just to the right of the three black keys'
};
const WHERE = {0:'on the little line under the staff', 1:'hanging just under the staff', 2:'on the bottom line', 3:'in the bottom space',
  4:'on the second line', 5:'in the second space', 6:'on the middle line', 7:'in the third space', 8:'on the fourth line',
  9:'in the top space', 10:'on the top line', 11:'sitting on top of the staff'};

function parseNote(s){
  const m = /^([A-G])(#?)(\d)$/.exec(s);
  if (!m) throw new Error('Bad note ' + s);
  const letter = m[1], pc = m[1] + m[2], oct = +m[3];
  return {name:s, letter, pc, oct, midi:12 * (oct + 1) + PCS.indexOf(pc), step:STEP[letter] + 7 * (oct - 4)};
}
const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
const pretty = pc => pc.replace('#', '♯');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

/* ---------- parsing ----------
   Bars are separated by "|". A token is a pitch ("E", "C5", "F#4"), "x" for an unpitched beat, or "r" for a rest,
   optionally followed by a length: ":q" quarter (default), ":h" half, ":h." dotted half, ":w" whole.
   Lyrics are one word or syllable per pitched note; "_" leaves a note without a syllable. */
const BEATS = {q:1, h:2, 'h.':3, w:4};
function parseMusic(def){
  const per = (def.time || [4, 4])[0];
  const lyr = def.lyrics ? def.lyrics.trim().split(/\s+/) : [];
  const events = [];
  let beat = 0, li = 0, n = 0;
  const measures = def.bars.split('|').map(m => m.trim()).filter(Boolean).map((m, mi) => {
    const start = beat, evs = [];
    for (const tok of m.split(/\s+/)){
      const [p, d = 'q'] = tok.split(':');
      const beats = BEATS[d];
      if (!beats) throw new Error(`Bad length in ${def.id || def.title}: ${tok}`);
      const ev = {i:events.length, beat, inBar:beat - start, beats, measure:mi};
      if (p === 'r') ev.rest = true;
      else if (p === 'x'){ ev.unpitched = true; ev.n = n++; }
      else {
        Object.assign(ev, parseNote(/\d/.test(p) ? p : p + '4'));
        ev.n = n++;
        const l = lyr[li++]; ev.lyric = l && l !== '_' ? l : '';
      }
      events.push(ev); evs.push(ev); beat += beats;
    }
    if (beat - start !== per) console.warn(`${def.id || def.title}: bar ${mi + 1} has ${beat - start} beats`);
    return {i:mi, events:evs, startBeat:start, beats:beat - start};
  });
  return Object.assign({}, def, {per, measures, events, notes:events.filter(e => !e.rest), totalBeats:beat});
}

/* ---------- staff drawing ---------- */
const SP = 18, TOP = 46, SW = 760, SH = 216;
const yOf = st => TOP + 4 * SP - (st - 2) * SP / 2;
const ledger = (x, st) => `<line class="ledger" x1="${x - 19}" x2="${x + 19}" y1="${yOf(st)}" y2="${yOf(st)}"/>`;
const CLEF = '\u{1D11E}';

function pitchedSVG(ev, x, level){
  const y = yOf(ev.step), col = level >= 1 ? HUE[ev.letter] : INK;
  const hollow = ev.beats >= 2, whole = ev.beats >= 4, up = ev.step < 6;
  let s = `<g class="ev nh" data-n="${ev.n}" data-i="${ev.i}">`;
  for (let st = 0; st >= ev.step; st -= 2) s += ledger(x, st);
  for (let st = 12; st <= ev.step; st += 2) s += ledger(x, st);
  s += `<circle class="ring" cx="${x}" cy="${y}" r="22"/>`;
  if (!whole) s += up ? `<line class="stem" x1="${x + 11.5}" x2="${x + 11.5}" y1="${y - 3}" y2="${y - 56}"/>`
                      : `<line class="stem" x1="${x - 11.5}" x2="${x - 11.5}" y1="${y + 3}" y2="${y + 56}"/>`;
  s += '<g class="head-wrap">';
  if (hollow) s += `<ellipse class="head" cx="${x}" cy="${y}" rx="${whole ? 14.5 : 13}" ry="${whole ? 9.6 : 9.2}" transform="rotate(${whole ? -10 : -20} ${x} ${y})" style="fill:#fff;stroke:${col};stroke-width:3.6"/>`;
  else s += `<ellipse class="head" cx="${x}" cy="${y}" rx="13" ry="9.2" transform="rotate(-20 ${x} ${y})" style="fill:${col}"/>`;
  if (level >= 2) s += `<text class="nl" x="${x}" y="${y + 5}" style="fill:${hollow ? textOnWhite(ev.letter) : textOn(ev.letter)}">${ev.letter}</text>`;
  s += '</g>';
  if (ev.beats === 3) s += `<circle cx="${x + 22}" cy="${ev.step % 2 === 0 ? y - SP / 2 : y}" r="3" fill="${INK}"/>`;
  s += `<text class="star" x="${x}" y="${up ? y + 36 : y - 30}">★</text><text class="mark" x="${x}" y="${up ? y + 38 : y - 30}"></text></g>`;
  return s;
}
function beatSVG(ev, x, mid){
  const hollow = ev.beats >= 2, whole = ev.beats >= 4;
  let s = `<g class="ev nh" data-n="${ev.n}" data-i="${ev.i}"><circle class="ring" cx="${x}" cy="${mid}" r="22"/>`;
  if (!whole) s += `<line class="stem" x1="${x + 11.5}" x2="${x + 11.5}" y1="${mid - 3}" y2="${mid - 56}"/>`;
  s += '<g class="head-wrap">' + (hollow
    ? `<ellipse class="head" cx="${x}" cy="${mid}" rx="${whole ? 14.5 : 13}" ry="9.4" transform="rotate(${whole ? -10 : -20} ${x} ${mid})" style="fill:#fff;stroke:${INK};stroke-width:3.6"/>`
    : `<ellipse class="head" cx="${x}" cy="${mid}" rx="13" ry="9.2" transform="rotate(-20 ${x} ${mid})" style="fill:${INK}"/>`) + '</g>';
  if (ev.beats === 3) s += `<circle cx="${x + 22}" cy="${mid - 6}" r="3" fill="${INK}"/>`;
  return s + `<text class="mark" x="${x}" y="${mid + 40}"></text></g>`;
}
function restSVG(ev, x, mid, perc){
  let s = `<g class="ev rest" data-i="${ev.i}">`;
  if (ev.beats === 1) s += `<path class="rest-g" d="M${x - 4} ${mid - 22} l8 10 l-7 8 l8 10 c-7 -3 -11 1 -6 8"/>`;
  else if (ev.beats < 4) s += `<rect class="rest-fill" x="${x - 11}" y="${mid - 8}" width="22" height="8"/>` + (ev.beats === 3 ? `<circle cx="${x + 19}" cy="${mid - 12}" r="3" fill="${INK}"/>` : '');
  else s += `<rect class="rest-fill" x="${x - 11}" y="${perc ? mid : mid - SP}" width="22" height="8"/>`;
  return s + '</g>';
}

// Lays out one line (system) of a parsed piece. Returns the SVG and the geometry needed to place a playhead.
function lineSVG(music, mIdxs, o){
  const perc = !!o.perc, mid = yOf(6), first = !!o.first, last = !!o.last;
  const H = perc ? 156 : SH, W = o.width || SW;
  const X0 = first ? 122 : 96, right = W - 12, mw = (right - X0) / mIdxs.length;
  const layout = {measures:mIdxs.map((mi, k) => ({mi, x0:X0 + k * mw, x1:X0 + (k + 1) * mw, startBeat:music.measures[mi].startBeat})), per:music.per, mw};
  layout.startBeat = layout.measures[0].startBeat;
  layout.endBeat = layout.startBeat + mIdxs.length * music.per;
  let s = `<svg class="staff${perc ? ' perc' : ''}" data-line="${o.index}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Music')}">`;
  if (perc) s += `<line class="sl" x1="8" x2="${right}" y1="${mid}" y2="${mid}"/><rect x="22" y="${mid - 18}" width="6" height="36" fill="${INK}"/><rect x="33" y="${mid - 18}" width="6" height="36" fill="${INK}"/>`;
  else {
    for (let k = 0; k < 5; k++) s += `<line class="sl" x1="8" x2="${right}" y1="${TOP + k * SP}" y2="${TOP + k * SP}"/>`;
    s += `<line class="bar" x1="8" x2="8" y1="${TOP}" y2="${TOP + 4 * SP}"/><text class="clef" x="12" y="${TOP + 4 * SP + 20}">${CLEF}</text>`;
  }
  if (first){
    const tx = X0 - 30;
    s += perc ? `<text class="tsig" x="${tx}" y="${mid - 4}">${music.per}</text><text class="tsig" x="${tx}" y="${mid + 24}">4</text>`
              : `<text class="tsig" x="${tx}" y="${TOP + SP + 12}">${music.per}</text><text class="tsig" x="${tx}" y="${TOP + 3 * SP + 12}">4</text>`;
  }
  const by0 = perc ? mid - 18 : TOP, by1 = perc ? mid + 18 : TOP + 4 * SP;
  layout.measures.forEach((m, k) => {
    const isEnd = last && k === layout.measures.length - 1;
    s += isEnd ? `<line class="bar" x1="${m.x1 - 9}" x2="${m.x1 - 9}" y1="${by0}" y2="${by1}"/><line class="bar heavy" x1="${m.x1 - 2}" x2="${m.x1 - 2}" y1="${by0}" y2="${by1}"/>`
               : `<line class="bar" x1="${m.x1}" x2="${m.x1}" y1="${by0}" y2="${by1}"/>`;
    for (const ev of music.measures[m.mi].events){
      const x = ev.beats === music.per ? (m.x0 + m.x1) / 2 - 4 : beatX(layout, ev.beat);
      ev.x = x; ev.line = o.index;
      if (ev.rest) s += restSVG(ev, x, perc ? mid : mid, perc);
      else if (perc || ev.unpitched) s += beatSVG(ev, x, mid);
      else {
        s += pitchedSVG(ev, x, o.hint ? o.hint(ev.letter) : 2);
        if (ev.lyric) s += `<text class="lyric" x="${x}" y="${SH - 10}">${esc(ev.lyric)}</text>`;
      }
    }
    if (o.counts){
      for (let b = 0; b < music.per; b++){
        const ab = m.startBeat + b, ev = music.measures[m.mi].events.find(e => e.beat <= ab && ab < e.beat + e.beats);
        const start = ev && ev.beat === ab, cls = start ? (ev.rest ? 'cnt rst' : 'cnt on') : 'cnt held';
        s += `<text class="${cls}" data-beat="${ab}" x="${beatX(layout, ab)}" y="${H - 12}">${start ? b + 1 : '(' + (b + 1) + ')'}</text>`;
      }
    }
  });
  if (first && o.dyn) s += `<text class="dyn" x="${X0 - 30}" y="${perc ? mid + 50 : TOP + 4 * SP + 50}" text-anchor="middle">${esc(o.dyn)}</text>`;
  s += `<line class="playhead" x1="-20" x2="-20" y1="${by0 - 20}" y2="${by1 + 20}"/>`;
  return {svg:s + '</svg>', layout};
}
function beatX(layout, beat){
  const m = layout.measures.find(mm => beat >= mm.startBeat && beat < mm.startBeat + layout.per) || layout.measures[layout.measures.length - 1];
  return m.x0 + 16 + (beat - m.startBeat + 0.5) * (layout.mw - 24) / layout.per;
}
function renderMusic(music, o = {}){
  const perLine = o.perLine || music.perLine || 2, lines = [];
  for (let k = 0; k < music.measures.length; k += perLine){
    const idx = music.measures.slice(k, k + perLine).map(m => m.i);
    lines.push(lineSVG(music, idx, {...o, index:lines.length, first:k === 0, last:k + perLine >= music.measures.length, label:o.label}));
  }
  return {html:lines.map(l => l.svg).join(''), layouts:lines.map(l => l.layout)};
}

// A short staff for quiz questions: items are parsed notes (with beats) or {rest:true, beats}.
function snippetSVG(items, o = {}){
  const gap = o.gap || 92, X0 = 120, W = X0 + items.length * gap + 30, H = 186;
  let s = `<svg class="staff snippet" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(Math.max(300, W * 1.1))}px" role="img" aria-label="${esc(o.label || 'Notes on the staff')}">`;
  for (let k = 0; k < 5; k++) s += `<line class="sl" x1="8" x2="${W - 10}" y1="${TOP + k * SP}" y2="${TOP + k * SP}"/>`;
  s += `<line class="bar" x1="8" x2="8" y1="${TOP}" y2="${TOP + 4 * SP}"/><text class="clef" x="12" y="${TOP + 4 * SP + 20}">${CLEF}</text>`;
  items.forEach((it, k) => {
    const x = X0 + gap * (k + 0.5), ev = Object.assign({i:k, n:k, beats:1}, it);
    s += ev.rest ? restSVG(ev, x, yOf(6), false) : pitchedSVG(ev, x, o.level != null ? o.level : (o.hint ? o.hint(ev.letter) : 0));
  });
  return s + '</svg>';
}

// A two-octave keyboard picture. marks: {"C4": color}; ring: ["C#4", ...] outlines keys; labels: show letters.
function miniKeysSVG(o = {}){
  const WN = ['C','D','E','F','G','A','B'], ww = 30, wh = 112, bw = 19, bh = 70, oct = o.octaves || 2;
  const whites = [], blacks = [];
  for (let k = 0; k < oct; k++) WN.forEach(l => whites.push(l + (4 + k)));
  const BL = {C:'C#', D:'D#', F:'F#', G:'G#', A:'A#'};
  const W = whites.length * ww + 4;
  let s = `<svg class="minikeys" viewBox="0 0 ${W} ${wh + 6}" role="img" aria-label="${esc(o.label || 'Piano keys')}">`;
  whites.forEach((n, k) => {
    const mark = o.marks && o.marks[n], ring = o.ring && o.ring.includes(n);
    s += `<rect x="${2 + k * ww}" y="2" width="${ww}" height="${wh}" rx="4" fill="${mark ? mark : '#fff'}" stroke="${ring ? '#F5C800' : INK}" stroke-width="${ring ? 4 : 2}"/>`;
    if (o.labels) s += `<text x="${2 + k * ww + ww / 2}" y="${wh - 10}" text-anchor="middle" font-size="13" font-weight="800" fill="${mark ? '#fff' : '#68658A'}" font-family="Baloo 2, sans-serif">${n[0]}</text>`;
  });
  whites.forEach((n, k) => {
    const b = BL[n[0]]; if (!b) return;
    const bn = b + n.slice(1), mark = o.marks && o.marks[bn], ring = o.ring && o.ring.includes(bn);
    blacks.push(`<rect x="${2 + (k + 1) * ww - bw / 2}" y="2" width="${bw}" height="${bh}" rx="3" fill="${mark ? mark : INK}" stroke="${ring ? '#F5C800' : INK}" stroke-width="${ring ? 4 : 1.5}"/>`);
  });
  return s + blacks.join('') + '</svg>';
}

Object.assign(NG, {PCS, LETTERS, STEP, HUE, COLOR_NAME, INK, KEY_HINT, WHERE, textOn, textOnWhite,
  parseNote, midiToFreq, pretty, esc, parseMusic, renderMusic, beatX, snippetSVG, miniKeysSVG, yOf, SP, TOP});
})();
