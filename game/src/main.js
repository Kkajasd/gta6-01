// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
// Round 3: no boot change — the polish is visual only.
// Round 6: re-written live under the recording; no boot change.
//
// ?seed=N fixes the city and traffic. ?shot=chase|street|mission|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_BUSTED, EVENT_CRIME, EVENT_DEAD, EVENT_DELIVERED, EVENT_SHOT, EVENT_WON } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(createRandom(seed));
const world = createWorld(createRandom(seed + 1), city);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { best: 0, money: 0, jobs: 0 };
    const parsed = JSON.parse(raw);
    return {
      best: Number(parsed.best) || 0,
      money: Number(parsed.money) || 0,
      jobs: Number(parsed.jobs) || 0,
    };
  } catch {
    return { best: 0, money: 0, jobs: 0 };
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const save = readSave();
  const scene = stageShot(name, world, city);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, city, scene.screen, Math.max(save.best, scene.best));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let best = save.best;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function bankProgress() {
    const earned = world.state.earned;
    if (earned > best) best = earned;
    save = { best, money: world.state.money, jobs: world.state.stats.delivered };
    writeSave(save);
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Job 1: pick up the crate at the Harbor Docks.');
  }

  function endGame(reason) {
    screen = SCREEN_OVER;
    world.state.endReason = reason;
    bankProgress();
    if (reason === 'won') announce(`Debt paid! You kept $${world.state.money}. Best haul $${best}.`);
    else if (reason === 'busted') announce('Busted. Bail cost $100.');
    else announce(`Wasted. Cash kept $${world.state.money}. Best haul $${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_DELIVERED) audio.bell();
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_CRIME) audio.crime();
    if (events & EVENT_BUSTED) audio.busted();
    if (events & EVENT_DEAD) audio.busted();
    if (events & EVENT_WON) audio.bell();
  }

  // Actions are taken once per frame here and handed to both handlers, so a press
  // is never lost and never counted twice.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions) {
    const held = input.held();
    // One-shot presses fire on the first sub-step of the frame only.
    const once = { enter: actions.enter, punch: actions.punch };
    actions.enter = false;
    actions.punch = false;
    const stepInput = {
      up: held.up,
      down: held.down,
      left: held.left,
      right: held.right,
      run: held.run,
      enter: once.enter,
      punch: once.punch,
      shoot: held.shoot,
      aimWorld: null,
    };
    if (stepInput.shoot) stepInput.aimWorld = renderer.screenToWorld(held.aimScreen.x, held.aimScreen.y, world.state.camera);
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, aimWorld: null });
      return;
    }
    const events = world.step(STEP, stepInput);
    handleEvents(events);
    if (world.state.dead) endGame('dead');
    else if (world.state.won) endGame('won');
    else if (world.state.busted) {
      world.state.busted = false;
      endGame('busted');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const flags = input.takeActions();
    handleActions(flags);
    const actions = { enter: Boolean(flags & ACTION_ENTER), punch: Boolean(flags & ACTION_PUNCH) };
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.update(STEP, world.state.player.speed || 0, world.state.wanted);
    renderer.draw(world.state, city, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Vireo Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
