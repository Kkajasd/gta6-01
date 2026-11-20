// WebAudio sound for Vireo Bay: every effect is synthesized, no audio
// files. The audio context starts on the first user gesture (browsers
// require it) and stays quiet until then.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    muted: false,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(audio.ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows the speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 60;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const filt = audio.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    audio.engineOsc.connect(filt);
    filt.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren: a slow two-tone triangle, silent until wanted.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  } catch (e) { /* no audio in this browser */ }
}

// A short blip: menu clicks, pickups, job pings.
export function blip(audio, freq, dur) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq || 660, t);
    o.frequency.exponentialRampToValueAtTime((freq || 660) * 1.5, t + (dur || 0.09));
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.09));
    o.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + (dur || 0.09) + 0.02);
  } catch (e) { /* ignore */ }
}

// A car horn: two quick square-wave toots.
export function horn(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = 'square';
      o.frequency.value = 370;
      g.gain.setValueAtTime(0.12, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.12);
      o.connect(g);
      g.connect(audio.master);
      o.start(t + i * 0.14);
      o.stop(t + i * 0.14 + 0.13);
    }
  } catch (e) { /* ignore */ }
}

// A gunshot crack: a burst of filtered noise.
export function gunshot(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const len = audio.ctx.sampleRate * 0.12;
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const filt = audio.ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 900;
    const g = audio.ctx.createGain();
    g.gain.value = 0.4;
    src.connect(filt);
    filt.connect(g);
    g.connect(audio.master);
    src.start(t);
  } catch (e) { /* ignore */ }
}

// A crash thud: a low sine drop.
export function thud(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + 0.22);
  } catch (e) { /* ignore */ }
}

// Per-frame audio: engine pitch from speed, siren wail while wanted.
export function updateAudio(audio, world) {
  if (!audio.ctx || audio.muted) return;
  try {
    const p = world.player;
    const speed = Math.abs(p.speed || 0);
    const inCar = !!p.car;
    audio.engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.min(0.12, speed / 520 * 0.12) : 0, audio.ctx.currentTime, 0.08);
    audio.engineOsc.frequency.setTargetAtTime(55 + speed * 0.16, audio.ctx.currentTime, 0.08);
    const wanted = p.wanted || 0;
    audio.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0, audio.ctx.currentTime, 0.2);
    if (wanted > 0) {
      const wail = 700 + Math.sin(world.time * 2.4) * 220;
      audio.sirenOsc.frequency.setTargetAtTime(wail, audio.ctx.currentTime, 0.05);
    }
  } catch (e) { /* ignore */ }
}
