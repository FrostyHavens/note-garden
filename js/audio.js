// Sound out (tones, clicks, claps, Pip's voice) and sound in (pitch and onset detection from the microphone).
(() => {
'use strict';
const NG = window.NG;
const A = NG.audio = {};
const listeners = {};
A.on = (ev, fn) => (listeners[ev] || (listeners[ev] = [])).push(fn);
const emit = (ev, d) => (listeners[ev] || []).forEach(fn => { try { fn(d); } catch (err){ console.error(err); } });
A.emit = emit;

const S = A.state = {ctx:null, master:null, analyser:null, buf:null, nsdf:null, noise:null, stream:null, src:null, timer:null,
  minRms:0.012, st:'armed', cand:null, count:0, held:null, holdStart:0, floor:1, silent:0,
  toneMuteUntil:0, speechMuteUntil:0, onsetMuteUntil:0, rmsHist:[], lastOnset:0, peak:0, peakSent:true};
A.SENS = {quiet:0.006, normal:0.012, noisy:0.03};
A.setSensitivity = k => { S.minRms = A.SENS[k] || A.SENS.normal; };

A.ensure = () => {
  if (!S.ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    S.ctx = new AC();
    S.master = S.ctx.createGain(); S.master.gain.value = 0.85; S.master.connect(S.ctx.destination);
    S.analyser = S.ctx.createAnalyser(); S.analyser.fftSize = 2048;
    const sink = S.ctx.createGain(); sink.gain.value = 0; // keeps the analyser running without playing the mic aloud
    S.analyser.connect(sink).connect(S.ctx.destination);
    S.buf = new Float32Array(2048); S.nsdf = new Float32Array(1026);
    const len = Math.floor(S.ctx.sampleRate * 0.25);
    S.noise = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
    const d = S.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (S.ctx.state === 'suspended') S.ctx.resume();
  return S.ctx;
};
// Converts an audio-clock time to the performance.now() moment the listener hears it.
A.perfAt = t => performance.now() + (t - S.ctx.currentTime) * 1000 + (S.ctx.outputLatency || S.ctx.baseLatency || 0) * 1000;
A.time = () => A.ensure().currentTime;

// A soft music-box tone. vel 0..1 sets loudness. Mutes the listener while it rings so Pip doesn't hear itself.
A.tone = (midi, o = {}) => {
  const ctx = A.ensure(), dur = o.dur || 0.7, vel = o.vel == null ? 0.75 : o.vel;
  const t = o.at != null ? o.at : ctx.currentTime + (o.when || 0), f = NG.midiToFreq(midi);
  const g = ctx.createGain(), peak = 0.42 * Math.pow(vel, 1.5) + 0.008;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.22;
  o1.connect(g); o2.connect(g2).connect(g); g.connect(S.master);
  o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  S.toneMuteUntil = Math.max(S.toneMuteUntil, A.perfAt(t + dur) + 160);
};
function noiseHit(t, {freq, q, gain, decay}){
  const ctx = A.ensure(), src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = S.noise; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(bp).connect(g).connect(S.master); src.start(t); src.stop(t + decay + 0.02);
}
// Metronome tick: filtered noise, so the pitch detector never mistakes it for a note.
A.click = (t, accent) => noiseHit(t, {freq:accent ? 3400 : 2500, q:2.5, gain:accent ? 0.8 : 0.5, decay:0.045});
A.clap = (t, vel = 0.8) => { noiseHit(t, {freq:1300, q:0.8, gain:vel, decay:0.13}); noiseHit(t + 0.012, {freq:1100, q:0.8, gain:vel * 0.6, decay:0.1}); };
A.drum = (t) => {
  const ctx = A.ensure(); t = t == null ? ctx.currentTime : t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.15);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(S.master); o.start(t); o.stop(t + 0.25);
  noiseHit(t, {freq:900, q:0.7, gain:0.25, decay:0.06});
};
A.fanfare = () => [60, 64, 67, 72].forEach((m, i) => A.tone(m, {dur:0.55, when:i * 0.12}));

/* ---------- local input (on-screen keys, computer keys, tap pad) ---------- */
A.press = (name, vel = 0.75) => {
  const n = NG.parseNote(name), t = performance.now();
  A.tone(n.midi, {dur:0.75, vel});
  S.onsetMuteUntil = t + 160;
  emit('note', {pc:n.pc, midi:n.midi, name, t, src:'keys', vel});
  emit('onset', {t, src:'keys'});
  emit('loudness', {pc:n.pc, vel, src:'keys'});
};
A.tap = () => {
  A.drum(); const t = performance.now();
  S.onsetMuteUntil = t + 160;
  emit('onset', {t, src:'tap'});
};

/* ---------- Pip's voice ----------
   Pip speaks one sentence at a time. Each sentence plays from a pre-recorded clip (voice/manifest.js maps
   sentence -> file) when there is one, and otherwise from the most natural voice the browser offers. */
A.canSpeak = 'speechSynthesis' in window || !!window.Audio;
A.speechOn = true;
A.missing = new Set(); // sentences spoken without a recording (for finding gaps)
NG.VOICE_BASE = NG.VOICE_BASE || 'voice/';
A.sentences = text => (Array.isArray(text) ? text : [text])
  .flatMap(t => String(t || '').split(/(?<=[.!?])\s+/)).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

let voice = null, sayId = 0, clip = null;
// Ranks the device's voices: neural/natural voices first, novelty and old desktop voices last.
function rankVoice(v){
  if (!/^en/i.test(v.lang)) return -1;
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural|online/.test(n)) s += 50;
  if (/enhanced|premium|siri/.test(n)) s += 40;
  if (/google/.test(n)) s += 30;
  if (/aria|jenny|ava|emma|michelle|samantha|allison|joanna|libby|sonia|serena|karen/.test(n)) s += 10;
  if (/^en[-_]us/i.test(v.lang)) s += 5;
  if (/david|zira|mark|hazel|desktop|espeak|fred|albert|bad news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy/.test(n)) s -= 40;
  return s;
}
function pickVoice(){
  const vs = window.speechSynthesis.getVoices().filter(v => rankVoice(v) >= 0);
  voice = vs.sort((a, b) => rankVoice(b) - rankVoice(a))[0] || null;
}
if ('speechSynthesis' in window){ pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; }
A.voiceName = () => voice ? voice.name : '';

function speakDevice(sentence, id){
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || id !== sayId) return resolve();
    const u = new SpeechSynthesisUtterance(sentence.replace(/([A-G])♯/g, '$1 sharp').replace(/\b(an|the|note|and|to) A\b/g, '$1 Ay').replace(/\bA(?=[.!?,])/g, 'Ay'));
    u.rate = 0.95; u.pitch = 1.05; if (voice){ u.voice = voice; u.lang = voice.lang; }
    // Some browsers never fire onend, so a length-based timeout backs it up.
    const est = 900 + sentence.length * 75;
    S.speechMuteUntil = performance.now() + est + 1500;
    let done = false;
    const finish = () => { if (!done){ done = true; resolve(); } };
    u.onend = u.onerror = finish;
    setTimeout(finish, est + 1500);
    window.speechSynthesis.speak(u);
  });
}
function playClip(file, sentence, id){
  return new Promise(resolve => {
    if (id !== sayId) return resolve();
    const a = new Audio(NG.VOICE_BASE + file);
    clip = a;
    S.speechMuteUntil = performance.now() + 20000;
    let done = false;
    const finish = () => { if (done) return; done = true; if (clip === a) clip = null; setTimeout(resolve, 70); };
    a.onended = finish;
    a.onerror = () => {
      if (done) return; done = true; if (clip === a) clip = null;
      if (id !== sayId) return resolve(); // interrupted by the next line, not a real failure
      A.missing.add(sentence); speakDevice(sentence, id).then(resolve);
    };
    a.play().catch(() => a.onerror());
    setTimeout(finish, 20000);
  });
}
// Resolves when Pip finishes talking (right away when speech is off).
A.say = async text => {
  if (!A.speechOn || !text) return;
  A.hush();
  const id = ++sayId, map = NG.VOICE || {};
  for (const s of A.sentences(text)){
    if (id !== sayId) return;
    const file = map[s];
    if (file) await playClip(file, s, id);
    else { A.missing.add(s); await speakDevice(s, id); }
  }
  if (id === sayId) S.speechMuteUntil = performance.now() + 250;
};
A.hush = () => {
  sayId++;
  if (clip){ clip.pause(); clip = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  S.speechMuteUntil = 0;
};

/* ---------- listening ---------- */
// McLeod normalized square difference with first-peak picking, which avoids most octave errors.
function detectPitch(buf, sr, minRms){
  const N = buf.length;
  let sum = 0; for (let i = 0; i < N; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / N);
  if (rms < minRms) return {rms, freq:0};
  const maxLag = Math.min(N >> 1, Math.floor(sr / 65)), minLag = Math.max(2, Math.floor(sr / 2200)), nsdf = S.nsdf;
  for (let lag = 0; lag <= maxLag; lag++){
    let ac = 0, m = 0;
    for (let i = 0, n = N - lag; i < n; i++){ const a = buf[i], b = buf[i + lag]; ac += a * b; m += a * a + b * b; }
    nsdf[lag] = m > 0 ? 2 * ac / m : 0;
  }
  let lag = 1; while (lag < maxLag && nsdf[lag] > 0) lag++;
  const peaks = []; let curMax = -1, curPos = -1;
  for (; lag < maxLag; lag++){
    if (nsdf[lag] > 0){ if (nsdf[lag] > curMax){ curMax = nsdf[lag]; curPos = lag; } }
    else if (curPos > 0){ peaks.push(curPos); curMax = -1; curPos = -1; }
  }
  if (curPos > 0) peaks.push(curPos);
  if (!peaks.length) return {rms, freq:0};
  const best = Math.max(...peaks.map(p => nsdf[p])), pos = peaks.find(p => nsdf[p] >= 0.9 * best);
  if (pos < minLag || nsdf[pos] < 0.75) return {rms, freq:0};
  const a = nsdf[pos - 1], b = nsdf[pos], c = nsdf[pos + 1], d = a - 2 * b + c;
  return {rms, freq:sr / (pos + (d ? 0.5 * (a - c) / d : 0)), clarity:nsdf[pos]};
}
A.detectPitch = detectPitch;

function tick(){
  S.analyser.getFloatTimeDomainData(S.buf);
  const now = performance.now(), r = detectPitch(S.buf, S.ctx.sampleRate, S.minRms);
  emit('level', r.rms);
  const muted = now < S.toneMuteUntil || now < S.speechMuteUntil;
  // Onsets (claps, taps, new notes): the level jumps well above the last few frames.
  const h = S.rmsHist, base = h.length ? Math.min(...h) : 1;
  h.push(r.rms); if (h.length > 3) h.shift();
  if (!muted && now >= S.onsetMuteUntil && r.rms > S.minRms * 2 && r.rms > base * 2.2 && now - S.lastOnset > 130){
    S.lastOnset = now; emit('onset', {t:now - 45, src:'mic', rms:r.rms});
  }
  if (muted){ S.cand = null; S.count = 0; return; }
  if (!S.peakSent){
    S.peak = Math.max(S.peak, r.rms);
    if (now - S.holdStart > 200){ S.peakSent = true; emit('loudness', {pc:S.held, rms:S.peak, src:'mic'}); }
  }
  if (!r.freq){
    if (++S.silent >= 2){ S.st = 'armed'; S.held = null; }
    S.cand = null; S.count = 0; return;
  }
  S.silent = 0;
  const midi = Math.round(69 + 12 * Math.log2(r.freq / 440)), pc = NG.PCS[((midi % 12) + 12) % 12];
  if (S.st === 'holding'){
    // A fresh strike of the same note: the level jumps well above where it had decayed to.
    if (now - S.holdStart < 160) S.floor = r.rms;
    else {
      S.floor = Math.min(S.floor, r.rms);
      if (r.rms > S.floor * 1.7 && r.rms - S.floor > S.minRms){ S.st = 'armed'; S.cand = null; S.count = 0; }
    }
  }
  if (pc === S.cand) S.count++; else { S.cand = pc; S.count = 1; }
  if (S.count >= 3 && (S.st === 'armed' || pc !== S.held)){
    S.st = 'holding'; S.held = pc; S.holdStart = now; S.floor = r.rms; S.peak = r.rms; S.peakSent = false;
    emit('note', {pc, midi, t:now - 110, src:'mic', rms:r.rms});
  }
}
A.startListening = () => { if (!S.timer) S.timer = setInterval(tick, 30); };
A.stopListening = () => { clearInterval(S.timer); S.timer = null; emit('level', 0); };
A.micOn = () => !!S.stream;
A.toggleMic = async () => {
  if (S.stream){
    S.stream.getTracks().forEach(t => t.stop()); S.src.disconnect(); S.stream = null; A.stopListening();
    emit('mic', false); return {ok:true};
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return {ok:false, why:'unsupported'};
  const ctx = A.ensure();
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}});
  } catch (err){
    S.stream = null; return {ok:false, why:err && err.name === 'NotAllowedError' ? 'blocked' : 'missing'};
  }
  await ctx.resume();
  S.src = ctx.createMediaStreamSource(S.stream); S.src.connect(S.analyser);
  A.startListening(); emit('mic', true);
  return {ok:true};
};
// Testing hook: feeds a pure tone straight into the listener.
A.testTone = async (freq, ms = 400, gain = 0.3) => {
  const ctx = A.ensure(); await ctx.resume();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = freq; g.gain.value = gain;
  o.connect(g).connect(S.analyser); A.startListening(); o.start();
  await new Promise(r => setTimeout(r, ms)); o.stop(); g.disconnect();
  await new Promise(r => setTimeout(r, 150));
};
})();
