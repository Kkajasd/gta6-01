// Vireo Bay — the four dossier shots. Each one stages the same seeded world
// forward with a road-following autopilot, so the same shot always plays the
// same way. The game page boots with ?shot=<name>&seed=1 to take a shot.
import { AVENUES, STREETS, HIDEOUT } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { startJob } from './missions.js';

const STEP = 1 / 60;

function nearestAvenueIndex(x) {
  let best = 0;
  for (let i = 1; i < AVENUES.length; i += 1) {
    if (Math.abs(x - AVENUES[i]) < Math.abs(x - AVENUES[best])) best = i;
  }
  return best;
}

function nearestStreetIndex(y) {
  let best = 0;
  for (let j = 1; j < STREETS.length; j += 1) {
    if (Math.abs(y - STREETS[j]) < Math.abs(y - STREETS[best])) best = j;
  }
  return best;
}

/** Road waypoints to a target: along the current avenue, then along a street. */
function routeTo(world, target) {
  const p = world.player;
  const ai = nearestAvenueIndex(p.x);
  const sj = nearestStreetIndex(target.y);
  const queue = [{ x: AVENUES[ai], y: STREETS[sj] }];
  if (Math.abs(target.x - AVENUES[ai]) > 40) queue.push({ x: target.x, y: STREETS[sj] });
  else queue.push({ x: target.x, y: target.y });
  return queue;
}

/** Drive toward the head of the queue; refill with a new route when done. */
function autopilot(world, queue, fallbackTarget) {
  const p = world.player;
  if (queue.length === 0) {
    queue.push(...routeTo(world, fallbackTarget));
  }
  const head = queue[0];
  if (Math.hypot(head.x - p.x, head.y - p.y) < 90) queue.shift();
  const target = queue[0] || fallbackTarget;
  const want = Math.atan2(target.y - p.y, target.x - p.x);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    drive: { steer: Math.max(-1, Math.min(1, diff * 1.8)), gas: 1, brake: 0 },
    walk: { x: 0, y: 0, moving: false },
    enter: false, punch: false, shoot: false,
  };
}

/** Put Dana in her own car (the magenta one) and start driving. */
function getInCar(world) {
  const p = world.player;
  const own = world.cars.find((c) => c.color === '#ff2e88');
  if (own) {
    p.car = own;
    own.kind = 'player';
    p.onFoot = false;
    p.angle = own.angle;
  }
}

function stepFor(world, seconds, queue, fallbackTarget) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, autopilot(world, queue, fallbackTarget), false);
  }
}

export function stageShot(name, world) {
  if (name === 'start') {
    // The title screen: Dana cruises downtown on her own for five seconds.
    for (let i = 0; i < 300; i += 1) {
      world.step(STEP, { drive: { steer: 0, gas: 0, brake: 0 }, walk: { x: 0, y: 0, moving: false }, enter: false, punch: false, shoot: false }, true);
    }
    world.shotCam = { x: world.player.x, y: world.player.y };
    return { screen: SCREEN_TITLE, best: world.best };
  }

  getInCar(world);
  if (name === 'street') {
    // A straight cruise down Neon Ave: three seconds of traffic, palms and neon.
    const queue = routeTo(world, { x: 800, y: 2400 });
    stepFor(world, 3, queue, { x: 800, y: 2400 });
    return { screen: SCREEN_PLAY, best: world.best };
  }
  if (name === 'chase') {
    // Three stars of heat and three cop cars on Dana's tail: eighteen seconds.
    world.wanted = 3;
    const queue = routeTo(world, { x: HIDEOUT.x, y: HIDEOUT.y });
    stepFor(world, 18, queue, { x: HIDEOUT.x, y: HIDEOUT.y });
    return { screen: SCREEN_PLAY, best: world.best };
  }
  if (name === 'mission') {
    // Job 3, The Getaway: lose the cops, then reach the Hideout. Twenty seconds.
    startJob(world, 2);
    const queue = routeTo(world, { x: HIDEOUT.x, y: HIDEOUT.y });
    stepFor(world, 20, queue, { x: HIDEOUT.x, y: HIDEOUT.y });
    return { screen: SCREEN_PLAY, best: world.best };
  }
  return { screen: SCREEN_PLAY, best: world.best };
}
