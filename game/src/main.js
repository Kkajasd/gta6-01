// Vireo Bay's entry point: the screens (title / play / pause / end), the
// game loop, input wiring, audio updates and the ?shot= harness the maker
// uses to take the four screenshots.
import { createWorld, stepWorld, saveBest } from './world.js';
import { createInput, bindInput, clearEdges } from './input.js';
import { createAudio, ensureAudio, updateAudio, blip, gunshot, thud } from './audio.js';
import { render } from './render.js';
import { stageShot, SHOT_STEPS } from './shots.js';
import { STEP } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = createWorld(20261120);
const input = createInput();
const audio = createAudio();
bindInput(input, window, canvas);

let shotMode = null;
let shotStepsLeft = 0;
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  shotMode = shot;
  stageShot(world, shot);
  shotStepsLeft = SHOT_STEPS;
  world.screen = shot === '4-start' ? 'title' : 'play';
}

let last = performance.now();
let acc = 0;
let lastShootAt = -9;
let lastRamAt = -9;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (shotMode) {
    // Frozen after the fixed steps: the screenshot is deterministic.
    if (shotStepsLeft > 0) {
      stepWorld(world, input, STEP);
      shotStepsLeft--;
    }
    world.time += STEP;
    render(ctx, world, canvas.width, canvas.height);
    return;
  }
  if (world.screen === 'title') {
    world.time += dt;
    if (input.any || input.clicked) {
      ensureAudio(audio);
      blip(audio, 660, 0.1);
      world.screen = 'play';
      world.job.phase = 'idle';
    }
    render(ctx, world, canvas.width, canvas.height);
    clearEdges(input);
    return;
  }
  if (input.pause) {
    world.paused = !world.paused;
    world.screen = world.paused ? 'pause' : 'play';
  }
  if (world.screen === 'pause') {
    render(ctx, world, canvas.width, canvas.height);
    clearEdges(input);
    return;
  }
  if (world.over) {
    if (input.any && now - (world.overAt || 0) > 1200) {
      location.reload();
    }
    if (!world.overAt) world.overAt = now;
    render(ctx, world, canvas.width, canvas.height);
    clearEdges(input);
    return;
  }
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    const beforeHealth = world.player.health;
    const beforeAmmo = world.player.ammo;
    const beforeJob = world.job.index;
    stepWorld(world, input, STEP);
    if (world.player.ammo < beforeAmmo) gunshot(audio);
    if (world.player.health < beforeHealth) thud(audio);
    if (world.job.index > beforeJob) blip(audio, 880, 0.14);
    clearEdges(input);
  }
  updateAudio(audio, world);
  render(ctx, world, canvas.width, canvas.height);
}

function resize() {
  canvas.width = 1280;
  canvas.height = 720;
}
resize();
requestAnimationFrame(frame);
