// Vireo Bay — tiny WebAudio sound kit. Everything is synthesized, nothing is
// loaded, and every call is guarded: no audio context, no sound, no crash.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call on the first user gesture; unlocks the context. */
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (!m) this.engine(0);
      else this.siren(false);
    },
    /** Continuous engine hum; speed01 is 0..1 of top speed. */
    engine(speed01) {
      if (!ensure() || muted) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 55;
          engineGain.gain.value = 0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 320;
          engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
          engineOsc.start();
        }
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.015 + speed01 * 0.03, ctx.currentTime, 0.1);
      } catch {
        // Ignore.
      }
    },
    /** Police siren on/off: a slow two-tone wail. */
    siren(on) {
      if (!ensure() || muted) {
        if (sirenOsc) { try { sirenOsc.stop(); } catch { /* ignore */ } sirenOsc = null; }
        return;
      }
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenOsc.type = 'sine';
          sirenOsc.frequency.value = 660;
          sirenGain.gain.value = 0.02;
          sirenOsc.connect(sirenGain).connect(ctx.destination);
          sirenOsc.start();
          let high = false;
          sirenTimer = window.setInterval(() => {
            if (!sirenOsc) return;
            high = !high;
            sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.05);
          }, 420);
        } else if (!on && sirenOsc) {
          window.clearInterval(sirenTimer);
          sirenTimer = null;
          const osc = sirenOsc;
          sirenOsc = null;
          osc.stop();
        }
      } catch {
        // Ignore.
      }
    },
    blip() { tone(880, 0.09, 'sine', 0.06, 1320); },
    thud() { tone(140, 0.14, 'triangle', 0.12, 70); },
    shot() { tone(220, 0.08, 'square', 0.07, 90); },
    cash() { tone(988, 0.1, 'sine', 0.06); window.setTimeout(() => tone(1319, 0.14, 'sine', 0.06), 90); },
    crash() { tone(90, 0.25, 'sawtooth', 0.1, 45); },
  };
}
