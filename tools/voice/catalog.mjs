// Collects every sentence Pip can say and writes tools/voice/catalog.json: [{sentence, file, tts}].
// It runs the real question generators with stubbed progress, so new prompts and hints are picked up automatically.
// Usage: node tools/voice/catalog.mjs   (from the note-garden folder), then run render.py.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const win = {console, Math, Date, performance:{now:() => 0}};
win.window = win;
const ctx = vm.createContext(win);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename:f});
load('js/music.js');
load('js/curriculum.js');
const NG = win.NG;

// Stubs for the pieces app.js and audio.js normally provide.
let HINT = 3;
NG.audio = {tone(){}, say(){}, hush(){}, micOn:() => false, sentences:t => (Array.isArray(t) ? t : [t])
  .flatMap(x => String(x || '').split(/(?<=[.!?])\s+/)).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)};
const P = {hl:12, tempo:{}, lessons:{}};
Object.assign(NG, {
  P:() => P, save(){}, stat:() => ({hint:HINT, hist:[]}), keys:{hint(){}, clear(){}},
  recordResult:() => false, bumpHint(){}, pick:a => a[Math.floor(Math.random() * a.length)],
  shuffle:a => a.slice(), weightedLetter:(pool) => pool[Math.floor(Math.random() * pool.length)],
});
load('js/activities.js');

const out = new Set();
const add = t => NG.audio.sentences(t).forEach(s => out.add(s));

// 1. Lesson texts.
NG.LEVEL1.forEach(u => u.lessons.forEach(l => add(l.learn)));
add('I picked the notes you find trickiest.');
// 2. Song helpers and the lines spoken in songs.
add("Play the first note when you're ready.");
for (const h of [0, 1, 2, 3]){
  HINT = h;
  for (const l of NG.LETTERS){
    for (let oct = 4; oct <= 5; oct++){ add(NG.helperFor(NG.parseNote(l + oct))); }
    if (h < 3) add(NG.fadeMessage(l));
  }
}
for (const l of NG.LETTERS) add(`Let me sing it for you. It's ${l}. Find the glowing key.`);
// 3. Quiz questions: run each generator many times at every helper level.
const specs = [];
NG.LEVEL1.forEach(u => u.lessons.forEach(l => (l.gens || []).forEach(g => specs.push([g, l.count || 6]))));
const infos = [undefined, {pc:'C'}, {pc:'C#'}, {src:'keys'}, {src:'mic'}];
for (const [spec, count] of specs){
  for (const h of [0, 1, 2, 3]){
    HINT = h;
    for (let rep = 0; rep < 120; rep++){
      for (let k = 0; k < count; k++){
        const q = NG.GEN[spec.gen](spec, k, {setVisual(){}, extra:null}, count);
        add(q.prompt);
        for (let t = 1; t <= 3; t++) for (const info of infos) add(q.hint(t, info));
        add(q.reveal());
      }
    }
  }
}
// 4. Results, games and the certificate.
[
  'Practice page done!', 'Beautiful playing!', 'You played the whole song!',
  'Now play it with the beat to earn the third star.',
  'Get almost every note on the first try for a second star, then play with the beat for the third.',
  'Right on the beat!', 'Good try!', "Let's try that again", 'Play 8 out of 10 notes on the beat for the third star.',
  "Next time I'll count a little faster.", "Next time I'll count a little slower.",
  'Perfect rhythm!', 'Great drumming!', 'You kept the beat!',
  'Only tap when a note starts. Count the long notes and rests quietly.',
  'Next time the beat will be a little faster.', 'Next time the beat will be a little slower.',
  'Superstar!', 'Great job!', 'You did it!', "Let's practice a bit more",
  'Get 4 out of 10 right on the first try to earn a star.', 'You finished Level 1!',
  'Great listening! That was the last note.', 'You popped all the bubbles!',
  'Congratulations! You finished Level 1 of Note Garden!',
].forEach(add);
NG.PRAISE.forEach(add);

// How each sentence should be read: note letters become their spoken names.
// Spellings checked against the voice's phonemizer ("eff" gets spelled out and "ay" reads as "eye").
const NAME = {C:'see', D:'dee', E:'ee', F:'ef', G:'jee', A:'eigh', B:'bee'};
function ttsText(s){
  let t = s.replace(/([A-G])♯/g, (m, l) => `${l} sharp`)
    .replace(/\bmf\b/g, 'em ef').replace(/\bmp\b/g, 'em pee')
    .replace(/(marked|written) f\b/g, '$1 ef').replace(/(marked|written) p\b/g, '$1 pee')
    .replace(/\bo'er\b/g, 'oer');
  return t.replace(/(^|[^A-Za-z'])([A-G])(?![A-Za-z'])/g, (m, pre, l, off) => {
    // "A note can sit…" at the start of a sentence is the article, not the note A.
    if (l === 'A' && off === 0 && /^A [a-z]/.test(t) && !/^A is\b/.test(t)) return m;
    return pre + NAME[l];
  });
}
// Stable file names from the sentence text (FNV-1a).
function hash(s){ let h = 0x811c9dc5; for (const ch of s){ h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

const list = [...out].sort().map(sentence => ({sentence, file:hash(sentence) + '.mp3', tts:ttsText(sentence)}));
fs.writeFileSync(path.join(root, 'tools/voice/catalog.json'), JSON.stringify(list, null, 1));
const manifest = Object.fromEntries(list.map(x => [x.sentence, x.file]));
fs.mkdirSync(path.join(root, 'voice'), {recursive:true});
fs.writeFileSync(path.join(root, 'voice/manifest.js'), '// Generated by tools/voice/catalog.mjs: sentence -> recorded clip.\nwindow.NG = window.NG || {};\nNG.VOICE = ' + JSON.stringify(manifest) + ';\n');
console.log(list.length, 'sentences');
