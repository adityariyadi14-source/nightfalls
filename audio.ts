import { getPrefs } from './prefs';

/**
 * Procedural audio. Every effect and the ambient score are synthesised with the Web Audio API,
 * so the game ships no audio files and works offline. Effects run through a small mixing chain:
 * dry + convolution reverb (a generated hall) into a compressor.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let reverbSend: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicNodes: { osc: OscillatorNode[]; lfo: OscillatorNode; filter: BiquadFilterNode } | null = null;
let pulseTimer: ReturnType<typeof setTimeout> | null = null;
type Mood = 'menu' | 'night' | 'day' | 'tense';
let musicMood: Mood | null = null;

function impulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = getPrefs().volume;
  comp.connect(master).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(comp);
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 3.2, 2.6);
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.35;
  reverbSend.connect(verb).connect(comp);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(comp);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  syncMusic();
}

export function setVolume(v: number) {
  if (master) master.gain.value = v;
}

const on = () => !!ensure() && getPrefs().sfx;
const now = () => ctx!.currentTime;

/** Route a node to the dry bus and (optionally) the reverb. */
function out(node: AudioNode, wet = 0.25) {
  node.connect(sfxBus!);
  if (wet > 0) {
    const g = ctx!.createGain();
    g.gain.value = wet;
    node.connect(g).connect(reverbSend!);
  }
}

interface ToneOpts { type?: OscillatorType; gain?: number; when?: number; slide?: number; attack?: number; wet?: number; detune?: number; filter?: number }
function tone(freq: number, dur: number, o: ToneOpts = {}) {
  if (!on()) return;
  const c = ctx!;
  const t0 = now() + (o.when ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.detune) osc.detune.value = o.detune;
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
  const g = c.createGain();
  const peak = o.gain ?? 0.2;
  const atk = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let last: AudioNode = osc.connect(g);
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    last = g.connect(f);
  }
  out(last, o.wet ?? 0.25);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

interface NoiseOpts { gain?: number; when?: number; type?: BiquadFilterType; freq?: number; endFreq?: number; q?: number; attack?: number; wet?: number }
function noise(dur: number, o: NoiseOpts = {}) {
  if (!on()) return;
  const c = ctx!;
  const t0 = now() + (o.when ?? 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'lowpass';
  f.frequency.setValueAtTime(o.freq ?? 1200, t0);
  if (o.endFreq) f.frequency.exponentialRampToValueAtTime(o.endFreq, t0 + dur);
  f.Q.value = o.q ?? 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out(src.connect(f).connect(g), o.wet ?? 0.2);
  src.start(t0);
}

/** Distorted low hit: kicks, body falls, explosions. */
function thump(freq: number, dur: number, gain = 0.5, when = 0, drive = 4) {
  if (!on()) return;
  const c = ctx!;
  const t0 = now() + when;
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(freq * 2.5, t0);
  osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.06);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.5), t0 + dur);
  const shaper = c.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * drive);
  }
  shaper.curve = curve;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out(osc.connect(shaper).connect(g), 0.3);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Tubular bell: inharmonic partials with long decay. */
function bell(freq: number, when = 0, gain = 0.12, dur = 4) {
  [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(freq * m, dur / (1 + i * 0.6), { gain: gain / (1 + i * 1.4), when, wet: 0.6 }));
}

/** Brass-like stab: detuned saws through a swelling low-pass. */
function brass(freqs: number[], when: number, dur: number, gain = 0.09, cutoff = 1400) {
  if (!on()) return;
  const c = ctx!;
  const t0 = now() + when;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(200, t0);
  f.frequency.exponentialRampToValueAtTime(cutoff, t0 + 0.12);
  f.frequency.exponentialRampToValueAtTime(300, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  f.connect(g);
  out(g, 0.45);
  freqs.forEach((fr) => [-9, 0, 9].forEach((det) => {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = fr;
    o.detune.value = det;
    o.connect(f);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }));
}

/** Dark choir "aah": saw stack through two vowel formants. */
function choir(freqs: number[], when: number, dur: number, gain = 0.05) {
  if (!on()) return;
  const c = ctx!;
  const t0 = now() + when;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out(g, 0.7);
  [700, 1150].forEach((fq) => {
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fq;
    bp.Q.value = 6;
    bp.connect(g);
    freqs.forEach((fr) => [-12, 0, 11].forEach((det) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = det;
      const vib = c.createOscillator();
      vib.frequency.value = 5 + Math.random();
      const vg = c.createGain();
      vg.gain.value = 4;
      vib.connect(vg).connect(o.detune);
      o.connect(bp);
      o.start(t0); vib.start(t0);
      o.stop(t0 + dur + 0.1); vib.stop(t0 + dur + 0.1);
    }));
  });
}

function heartbeat(when: number, gain = 0.5) {
  thump(55, 0.18, gain, when, 2);
  thump(48, 0.22, gain * 0.7, when + 0.2, 2);
}

export const sfx = {
  click: () => { tone(1800, 0.025, { type: 'square', gain: 0.025, wet: 0 }); noise(0.02, { gain: 0.03, type: 'highpass', freq: 3000, wet: 0 }); },
  hover: () => tone(2400, 0.015, { type: 'square', gain: 0.012, wet: 0 }),
  select: () => { tone(880, 0.05, { type: 'square', gain: 0.04, wet: 0.1 }); tone(1320, 0.07, { type: 'square', gain: 0.03, when: 0.05, wet: 0.1 }); },
  error: () => { tone(140, 0.18, { type: 'sawtooth', gain: 0.08, filter: 900 }); tone(110, 0.22, { type: 'sawtooth', gain: 0.08, when: 0.14, filter: 900 }); },
  notify: () => { tone(988, 0.08, { type: 'triangle', gain: 0.07 }); tone(1480, 0.14, { type: 'triangle', gain: 0.06, when: 0.08 }); },
  glitch: () => { for (let i = 0; i < 5; i++) tone(200 + Math.random() * 2400, 0.03, { type: 'square', gain: 0.03, when: i * 0.035, wet: 0 }); },
  whoosh: () => noise(0.45, { gain: 0.14, type: 'bandpass', freq: 300, endFreq: 3000, q: 1.2, attack: 0.2, wet: 0.3 }),
  cardSpin: () => {
    for (let i = 0; i < 6; i++) noise(0.16, { gain: 0.09 * (1 - i / 7), type: 'bandpass', freq: 900 + i * 150, endFreq: 2400, q: 2, attack: 0.06, when: i * (0.13 + i * 0.045), wet: 0.15 });
  },
  reveal: () => {
    thump(60, 0.9, 0.55, 0, 3);
    noise(1.4, { gain: 0.07, type: 'highpass', freq: 4000, attack: 0.01, wet: 0.6 });
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 1.6, { type: 'triangle', gain: 0.05, when: 0.05 + i * 0.04, wet: 0.7 }));
  },
  night: () => { bell(196, 0, 0.14, 5); noise(3, { gain: 0.05, type: 'bandpass', freq: 400, endFreq: 200, q: 0.6, attack: 1, wet: 0.5 }); thump(40, 1.4, 0.35, 0.05, 1.5); },
  day: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.9, { type: 'triangle', gain: 0.06, when: i * 0.1, wet: 0.5 }));
    for (let i = 0; i < 4; i++) tone(3200 + Math.random() * 800, 0.06, { gain: 0.02, when: 0.6 + i * 0.12, slide: 4200, wet: 0.4 }); // birds
  },
  stab: () => { noise(0.12, { gain: 0.25, type: 'highpass', freq: 2500, wet: 0.2 }); thump(90, 0.35, 0.5, 0.05, 6); tone(620, 1.1, { type: 'sawtooth', gain: 0.03, slide: 180, when: 0.08, filter: 1800, wet: 0.7 }); },
  gunshot: () => { noise(0.05, { gain: 0.6, type: 'lowpass', freq: 6000, wet: 0 }); thump(70, 0.5, 0.6, 0, 8); noise(1.6, { gain: 0.12, type: 'lowpass', freq: 1200, endFreq: 200, wet: 0.8, when: 0.03 }); },
  explosion: () => { thump(38, 1.6, 0.8, 0, 9); noise(2.2, { gain: 0.5, type: 'lowpass', freq: 3000, endFreq: 120, attack: 0.01, wet: 0.6 }); noise(0.5, { gain: 0.2, type: 'highpass', freq: 3000, wet: 0.3, when: 0.05 }); },
  heartbreak: () => { [988, 880, 740, 659, 587, 494].forEach((f, i) => tone(f, 0.7, { type: 'triangle', gain: 0.05, when: i * 0.22, wet: 0.7 })); tone(330, 1.8, { gain: 0.04, when: 1.2, slide: 160, wet: 0.8 }); },
  bread: () => { [784, 988, 1175].forEach((f, i) => tone(f, 0.5, { type: 'sine', gain: 0.05, when: i * 0.08, wet: 0.5 })); },
  death: () => { thump(55, 1.2, 0.6, 0, 5); noise(0.9, { gain: 0.12, type: 'lowpass', freq: 800, endFreq: 100, wet: 0.6 }); tone(220, 2, { type: 'sawtooth', gain: 0.03, slide: 55, filter: 700, wet: 0.8 }); },
  vote: () => { thump(120, 0.12, 0.35, 0, 3); noise(0.05, { gain: 0.15, type: 'bandpass', freq: 1800, wet: 0.1 }); },
  gavel: () => { thump(150, 0.18, 0.5, 0, 5); noise(0.08, { gain: 0.2, type: 'bandpass', freq: 1200, wet: 0.4 }); thump(150, 0.18, 0.45, 0.22, 5); noise(0.08, { gain: 0.18, type: 'bandpass', freq: 1200, wet: 0.4, when: 0.22 }); },
  tick: () => tone(1600, 0.03, { type: 'square', gain: 0.025, wet: 0 }),

  /** End-of-game stingers. The Mafia's is the centrepiece. */
  stinger: (team: 'town' | 'mafia' | 'neutral' | 'draw') => {
    if (team === 'mafia') {
      [0, 0.75, 1.65].forEach((w, i) => heartbeat(w, 0.55 - i * 0.08)); // slowing heartbeat...
      // ...then it stops. Silence, then the hit.
      const hit = 2.9;
      thump(32, 3, 0.9, hit, 10);
      noise(3.5, { gain: 0.35, type: 'lowpass', freq: 2500, endFreq: 80, wet: 0.8, when: hit });
      brass([65.4, 77.8, 92.5, 98], hit, 3.4, 0.11, 1600); // C minor cluster with a tritone bite
      brass([130.8, 155.6, 185], hit + 0.02, 3, 0.06, 2200);
      choir([130.8, 155.6, 196, 233], hit + 0.4, 6, 0.045);
      [0, 1.8, 3.6].forEach((w) => bell(98, hit + 1.2 + w, 0.13, 5)); // funeral bell
      tone(48, 6, { type: 'sawtooth', gain: 0.06, when: hit + 0.2, filter: 300, wet: 0.5 }); // drone
      for (let i = 0; i < 6; i++) tone(1200 - i * 90, 0.12, { type: 'square', gain: 0.012, when: hit + 3 + i * 0.4, wet: 0.6 }); // music box, falling
    } else if (team === 'town') {
      noise(0.9, { gain: 0.06, type: 'bandpass', freq: 3000, q: 1, attack: 0.8, wet: 0.2 }); // snare roll swell
      brass([261.6, 329.6, 392], 0.9, 1.4, 0.08, 3000);
      brass([349.2, 440, 523.3], 1.5, 1.2, 0.08, 3200);
      brass([392, 493.9, 587.3, 784], 2.1, 2.6, 0.09, 3600);
      [784, 988, 1175, 1568].forEach((f, i) => bell(f, 2.1 + i * 0.12, 0.05, 3));
      thump(80, 0.4, 0.4, 2.1, 3);
    } else if (team === 'neutral') {
      [392, 523, 392, 659, 587, 523].forEach((f, i) => tone(f, 0.25, { type: 'square', gain: 0.05, when: i * 0.18, detune: Math.sin(i) * 40, filter: 2200 }));
      tone(196, 1.4, { type: 'sawtooth', gain: 0.05, when: 1.1, slide: 98, filter: 900 });
    } else {
      noise(4, { gain: 0.06, type: 'bandpass', freq: 500, endFreq: 250, attack: 1.5, wet: 0.6 });
      bell(110, 0.5, 0.12, 6);
    }
  },
  win: () => sfx.stinger('town'),
  lose: () => sfx.stinger('mafia')
};

// ---------------------------------------------------------------------------- music
const MOODS: Record<Mood, { notes: number[]; cutoff: number; rate: number; gain: number; pulse: number | null }> = {
  menu: { notes: [65.4, 98, 116.5, 155.6], cutoff: 520, rate: 0.06, gain: 0.16, pulse: null },
  night: { notes: [55, 82.4, 98, 130.8], cutoff: 380, rate: 0.04, gain: 0.18, pulse: 1150 }, // heartbeat
  day: { notes: [87.3, 130.8, 174.6, 220], cutoff: 900, rate: 0.1, gain: 0.12, pulse: null },
  tense: { notes: [61.7, 92.5, 123.5, 146.8], cutoff: 750, rate: 0.3, gain: 0.17, pulse: 500 } // ticking clock
};

export function setMusicMood(m: Mood) {
  musicMood = m;
  syncMusic();
}

function schedulePulse() {
  if (pulseTimer) clearTimeout(pulseTimer);
  pulseTimer = null;
  if (!musicMood || !getPrefs().music) return;
  const mood = MOODS[musicMood];
  if (!mood.pulse) return;
  const beat = () => {
    if (!ctx || !musicMood || !getPrefs().music || !MOODS[musicMood].pulse) return;
    const prev = getPrefs().sfx;
    // pulses belong to the music, so they play even with SFX off
    if (musicMood === 'night') {
      if (prev) heartbeat(0, 0.18);
    } else if (prev) {
      tone(2200, 0.02, { type: 'square', gain: 0.015, wet: 0.2 });
    }
    pulseTimer = setTimeout(beat, MOODS[musicMood].pulse!);
  };
  pulseTimer = setTimeout(beat, mood.pulse);
}

function stopMusic() {
  if (pulseTimer) clearTimeout(pulseTimer);
  pulseTimer = null;
  if (!musicNodes || !ctx || !musicGain) return;
  musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  const nodes = musicNodes;
  musicNodes = null;
  setTimeout(() => {
    nodes.osc.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
    try { nodes.lfo.stop(); } catch { /* noop */ }
  }, 1200);
}

export function syncMusic() {
  const c = ensure();
  if (!c || !musicGain) return;
  const want = getPrefs().music && musicMood;
  if (!want) return stopMusic();
  const mood = MOODS[musicMood!];
  schedulePulse();
  if (musicNodes) {
    musicNodes.osc.forEach((o, i) => o.frequency.linearRampToValueAtTime(mood.notes[i % mood.notes.length] * (i >= mood.notes.length ? 2.003 : 1), c.currentTime + 2));
    musicNodes.filter.frequency.linearRampToValueAtTime(mood.cutoff, c.currentTime + 2);
    musicNodes.lfo.frequency.linearRampToValueAtTime(mood.rate, c.currentTime + 2);
    musicGain.gain.linearRampToValueAtTime(mood.gain, c.currentTime + 2);
    return;
  }
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = mood.cutoff;
  filter.Q.value = 3;
  const lfo = c.createOscillator();
  lfo.frequency.value = mood.rate;
  const lfoGain = c.createGain();
  lfoGain.gain.value = mood.cutoff * 0.5;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  const osc: OscillatorNode[] = [];
  for (let i = 0; i < mood.notes.length * 2; i++) {
    const o = c.createOscillator();
    o.type = i % 2 ? 'sawtooth' : 'triangle';
    o.frequency.value = mood.notes[i % mood.notes.length] * (i >= mood.notes.length ? 2.003 : 1);
    o.detune.value = (i % 3) * 7 - 7;
    const g = c.createGain();
    g.gain.value = i >= mood.notes.length ? 0.025 : 0.07;
    o.connect(g).connect(filter);
    o.start();
    osc.push(o);
  }
  filter.connect(musicGain);
  const wet = c.createGain();
  wet.gain.value = 0.4;
  filter.connect(wet).connect(reverbSend!);
  musicGain.gain.setValueAtTime(0, c.currentTime);
  musicGain.gain.linearRampToValueAtTime(mood.gain, c.currentTime + 3);
  musicNodes = { osc, lfo, filter };
}
