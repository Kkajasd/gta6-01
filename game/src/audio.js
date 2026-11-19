// Sound, all synthesized with WebAudio: no audio files, no network. A tiny engine
// hum follows the car's speed, a two-tone siren wails while the police chase, and
// short blips mark pickups, shots and mission bells. Everything is created lazily on
// the first user gesture, so a screenshot run never needs audio at all.
// Round 3: no audio change — the polish is visual only.
// Round 6: re-written live under the recording; no audio change.
// Round 7: re-written live under the recording; no audio change.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume || 0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function noise(duration, volume) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume || 0.2;
      src.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    isMuted() { return muted; },
    pickup() { blip(660, 0.12, 'sine', 0.2, 990); },
    bell() { blip(523, 0.18, 'sine', 0.22); setTimeout(() => blip(784, 0.3, 'sine', 0.22), 140); },
    shot() { noise(0.09, 0.25); },
    hit() { blip(180, 0.12, 'square', 0.16, 90); },
    crime() { blip(440, 0.15, 'square', 0.16, 330); },
    busted() { blip(220, 0.5, 'sawtooth', 0.2, 110); },
    /** Called every frame: engine pitch follows speed, siren wails while wanted. */
    update(dt, speed, wanted) {
      if (!ctx || muted) return;
      sirenTimer += dt;
      try {
        if (engineGain) {
          engineGain.gain.value = speed > 30 ? 0.03 + Math.min(0.06, speed / 9000) : 0;
          engineOsc.frequency.value = 50 + speed * 0.12;
        }
        if (sirenGain) {
          if (wanted > 0) {
            sirenGain.gain.value = 0.045;
            sirenOsc.frequency.value = Math.sin(sirenTimer * 5) > 0 ? 720 : 540;
          } else {
            sirenGain.gain.value = 0;
          }
        }
      } catch {
        // Audio is decoration; a failure never stops the game.
      }
    },
  };
}
