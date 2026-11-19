// The screenshot scenes behind ?shot=chase|street|mission|start. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame. The cover (chase) shows the player driving with police
// behind, wanted stars, the minimap and a mission objective all at once.
// Round 6: re-written live under the recording; no scene change.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const CHASE_SECONDS = 10;
const STREET_SECONDS = 7;
const MISSION_SECONDS = 3;
/** The player car's top speed, for the autopilot's cornering. */
const CAR_MAX_SPEED = 560;

function idleInput() {
  return { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, aimWorld: null };
}

function turnInput(angle, targetAngle, speed, cornerDist) {
  let diff = targetAngle - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Slow down for the corner well before reaching it: a car at full speed turns
  // wider than the road and clips the building on the corner. Never brake below
  // a crawl: holding brake at a standstill would reverse the car and flip the
  // steering, so a slow car coasts through the turn instead.
  let desired = cornerDist < 320 ? 200 : CAR_MAX_SPEED;
  if (Math.abs(diff) > 0.7) desired = Math.min(desired, 150);
  const brake = speed > desired + 40 && speed > 60;
  // Floor it on a straight, and creep through a tight turn from a crawl: a car
  // stopped mid-turn must keep moving or it never finishes turning.
  const gas = speed < desired && (Math.abs(diff) < 0.5 || speed < 30);
  return { up: gas, down: brake, left: diff < -0.08, right: diff > 0.08, run: false, enter: false, punch: false, shoot: false, aimWorld: null };
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Drive the player's car toward a list of waypoints, one after another, along roads. */
function driveAutopilot(world, waypoints, seconds) {
  const state = world.state;
  let target = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const wp = waypoints[target % waypoints.length];
    if (dist(state.player.x, state.player.y, wp.x, wp.y) < 140) target += 1;
    const corner = world.nextRoadPoint(state.player.x, state.player.y, wp.x, wp.y);
    const aim = angleTo(state.player.x, state.player.y, corner.x, corner.y);
    const input = state.player.onFoot
      ? { ...idleInput(), up: true }
      : turnInput(state.player.angle, aim, state.player.car ? state.player.car.speed : 0, dist(state.player.x, state.player.y, corner.x, corner.y));
    world.step(STEP, input);
    if (state.dead || state.busted) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * haul to show. Any unknown name stages the title screen.
 */
export function stageShot(name, world, city) {
  const state = world.state;
  if (name === 'chase') {
    world.reset();
    // Job 3: the getaway — wanted, two patrol cars, and the Hideout as the goal.
    world.jumpToMission(2);
    // Round 3: a third patrol car joins the chase, so the cover frame shows
    // the player boxed in by police instead of a single car behind.
    world.addWanted(1, 0);
    // Put Dana in the car by the garage and floor it toward the Hideout.
    const car = state.cars.find((c) => c.kind === 'parked');
    if (car) {
      state.player.x = car.x + 30;
      state.player.y = car.y;
      world.enterExitCar();
    }
    const hideout = city.places.hideout;
    const plaza = city.places.plaza;
    const market = city.places.market;
    // Loop the route instead of U-turning: plaza, south down the plaza road, west
    // to the market, then to the Hideout and back — every turn is a right angle.
    const southOfPlaza = { x: plaza.x, y: market.y };
    driveAutopilot(world, [plaza, southOfPlaza, market, hideout, plaza], CHASE_SECONDS);
    return { screen: state.dead ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
  }
  if (name === 'street') {
    world.reset();
    // Job 2: the red coupe waits at Sol Plaza — on foot downtown, among traffic and
    // pedestrians, with the theft marker and the coupe in frame. Dana walks the road
    // east and west past the coupe so the marker never leaves the frame.
    world.jumpToMission(1);
    state.player.x = city.places.plaza.x - 300;
    state.player.y = city.places.plaza.y;
    state.player.angle = 0;
    for (let i = 0; i < STREET_SECONDS / STEP; i += 1) {
      const input = idleInput();
      const east = Math.floor(i / 120) % 2 === 0;
      input.right = east;
      input.left = !east;
      world.step(STEP, input);
      if (state.dead) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    world.reset();
    // Job 4: the docks shootout — three rivals, Dana armed, crate job on the HUD.
    // Dana starts close in and fires in bursts, so the frame still shows rivals standing.
    // Round 3: Dana stands on the pier itself, so the stacked containers and the
    // wooden docks fill the left of the frame instead of sitting at its edge.
    world.jumpToMission(3);
    state.player.x = city.places.docks.x + 140;
    state.player.y = city.places.docks.y + 230;
    state.player.angle = Math.PI;
    state.ammo = 48;
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      const enemy = state.enemies[0];
      const input = idleInput();
      if (enemy) {
        const d = dist(state.player.x, state.player.y, enemy.x, enemy.y);
        const aim = angleTo(state.player.x, state.player.y, enemy.x, enemy.y);
        input.aimWorld = { x: enemy.x, y: enemy.y };
        // Fire only once close in, in bursts, so the frame still shows rivals standing.
        input.shoot = d < 240 && (i % 50) < 25;
        // Close in until the shot lands, then hold position.
        if (d > 200) {
          input.up = Math.sin(aim) < -0.5;
          input.down = Math.sin(aim) > 0.5;
          input.left = Math.cos(aim) < -0.5;
          input.right = Math.cos(aim) > 0.5;
        }
      }
      world.step(STEP, input);
      if (state.dead) break;
    }
    return { screen: state.dead ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
  }
  // start: the title screen over a living city.
  world.reset();
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idleInput());
  return { screen: SCREEN_TITLE, best: 0 };
}

export { SCREEN_PAUSED, SCREEN_OVER };
