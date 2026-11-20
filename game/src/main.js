// Vireo Bay — the boot and the game loop. Two modes: a screenshot shot
// (?shot=<name>&seed=1) stages the world and paints twice, and the normal game
// runs the title screen, the drive, and the debt.
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_OVER, EVENT_JOB, EVENT_CRIME } from './world.js';
import { render, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_SHOOT } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { BEST_KEY, STEP } from './config.js';
import { startJob } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 20261120;
const shotName = params.get('shot');

const random = createRandom(seed);
const world = createWorld(random);
try {
  world.best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
} catch {
  world.best = 0;
}

function saveBest() {
  if (world.cash > world.best) {
    world.best = world.cash;
    try {
      window.localStorage.setItem(BEST_KEY, String(world.best));
    } catch {
      // Best score is a nicety, not a requirement.
    }
  }
}

if (shotName) {
  // Screenshot mode: stage the shot, paint twice, signal readiness.
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const staged = stageShot(shotName, world);
  render(ctx, world, staged.screen);
  render(ctx, world, staged.screen);
  window.__shotReady = true;
} else {
  // Game mode.
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let last = performance.now();
  let accumulator = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function frameInput(actions) {
    return {
      drive: input.drive(),
      walk: input.walk(),
      enter: Boolean(actions & ACTION_ENTER),
      punch: Boolean(actions & ACTION_PUNCH),
      shoot: Boolean(actions & ACTION_SHOOT),
    };
  }

  const EMPTY_INPUT = {
    drive: { steer: 0, gas: 0, brake: 0 },
    walk: { x: 0, y: 0, moving: false },
    enter: false, punch: false, shoot: false,
  };

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      accumulator -= STEP;
      steps += 1;
      tick();
    }
    if (steps === 5) accumulator = 0;
    render(ctx, world, screen);
  }

  function tick() {
    const actions = input.takeActions();
    audio.setMuted(input.muted);
    if (screen === SCREEN_TITLE) {
      world.step(STEP, EMPTY_INPUT, true);
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.blip();
        world.reset();
        startJob(world, 0);
        screen = SCREEN_PLAY;
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        audio.unlock();
        screen = SCREEN_PLAY;
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        world.reset();
        screen = SCREEN_TITLE;
      }
      return;
    }
    // Playing.
    const fi = frameInput(actions);
    const events = world.step(STEP, fi, false);
    if (events & EVENT_CRIME) audio.thud();
    if (events & EVENT_JOB) audio.cash();
    if (events & EVENT_HIT) audio.crash();
    if (fi.shoot) audio.shot();
    if (fi.punch) audio.blip();
    audio.engine(world.player.onFoot ? 0 : Math.abs(world.player.speed) / 640);
    audio.siren(world.wanted > 0);
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      return;
    }
    if (events & EVENT_OVER || world.over) {
      saveBest();
      audio.siren(false);
      audio.engine(0);
      screen = SCREEN_OVER;
    }
  }

  requestAnimationFrame(frame);
}
