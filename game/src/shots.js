// Shot staging for Vireo Bay: put the world into a fixed, photogenic pose
// for each of the four screenshots. Every pose is deterministic — the same
// seed and the same number of fixed steps always land the same frame.
// main.js calls stageShot once, runs a fixed number of steps, then freezes.
import { CAR, JOBS } from './config.js';
import { roadX, roadY } from './city.js';
import { dist } from './random.js';

export const SHOT_NAMES = ['1-chase', '2-street', '3-mission', '4-start'];

// A pink player car: the hero car of the chase and mission shots.
function heroCar(world, x, y, angle, speed) {
  const car = {
    x, y, angle, speed, color: '#ff5a9e', parked: false, vertical: false,
    turnAt: 0, targetSpeed: 0, isPlayer: true, isPolice: false,
  };
  world.cars.push(car);
  const p = world.player;
  p.car = car;
  p.onFoot = false;
  p.x = x; p.y = y; p.angle = angle; p.speed = speed;
  return car;
}

// A police car placed right behind a point, already in pursuit.
function copBehind(world, x, y, angle, gap) {
  const bx = x - Math.cos(angle) * gap;
  const by = y - Math.sin(angle) * gap;
  const cop = {
    x: bx, y: by, angle, speed: 380, health: 100,
    color: '#2244aa', isPolice: true, isPlayer: false, parked: false, vertical: false,
  };
  world.police.push(cop);
  return cop;
}

export function stageShot(world, name) {
  const p = world.player;
  const places = world.city.places;
  // Clear the default traffic near the shot so the frame stays clean.
  world.cars.length = 0;
  world.peds.length = 0;
  world.police.length = 0;
  world.parts.length = 0;
  world.bullets.length = 0;
  world.screen = 'play';
  world.over = false;
  world.won = false;
  p.health = 100;
  p.ammo = 48;
  p.cash = 1250;

  if (name === '1-chase') {
    // The Getaway, mid-chase: pink hero car, two PD cars right behind,
    // four wanted stars, the job banner up top.
    world.job.index = 2;
    world.job.phase = 'go';
    world.job.target = { x: places.hideout.x, y: places.hideout.y, label: 'Hideout' };
    p.wanted = 4;
    p.heat = 8;
    const x = roadX(2) + 120;
    const y = roadY(2);
    heroCar(world, x, y, 0, 320);
    copBehind(world, x, y, 0, 200);
    copBehind(world, x, y + 26, 0, 280);
    // A couple of bystanders ahead for depth.
    world.cars.push({
      x: x + 260, y: y - 14, angle: 0, speed: 130, color: '#f2c14e',
      parked: false, vertical: false, turnAt: 0, targetSpeed: 0, isPlayer: false, isPolice: false,
    });
    world.camera.x = x + 60;
    world.camera.y = y;
    return;
  }

  if (name === '2-street') {
    // The beach district: palms, umbrellas and sand on one side, the
    // marina's boats and pier on the other, neon signs down the block.
    world.job.index = 1;
    world.job.phase = 'go';
    world.job.target = { x: places.marina.x, y: places.marina.y, label: 'Marina' };
    p.wanted = 0;
    p.heat = 0;
    // The hero car cruises the beach road; beachgoers stroll the sand.
    heroCar(world, roadX(1) - 120, roadY(1), 0, 130);
    const sandX = places.beach.x;
    const sandY = places.beach.y;
    for (let i = 0; i < 3; i++) {
      world.peds.push({
        x: sandX + 40 + i * 36, y: sandY - 30 + i * 44, angle: Math.PI / 2,
        speed: 30, color: ['#ff8a80', '#80d8ff', '#ffd54f'][i],
        flee: 0, tx: sandX, ty: sandY, wait: 2,
      });
    }
    // A few cars cruising the beach road and the marina road.
    world.cars.push({
      x: roadX(1), y: roadY(0) + 60, angle: Math.PI / 2, speed: 120, color: '#4a90e8',
      parked: false, vertical: true, turnAt: 0, targetSpeed: 0, isPlayer: false, isPolice: false,
    });
    world.cars.push({
      x: roadX(2) + 200, y: roadY(1), angle: 0, speed: 110, color: '#e84a4a',
      parked: false, vertical: false, turnAt: 0, targetSpeed: 0, isPlayer: false, isPolice: false,
    });
    world.camera.x = roadX(1) + 112;
    world.camera.y = 360;
    return;
  }

  if (name === '3-mission') {
    // The Getaway's endgame: the Hideout ring, gold marker, police
    // closing in on the hero car.
    world.job.index = 2;
    world.job.phase = 'go';
    world.job.target = { x: places.hideout.x, y: places.hideout.y, label: 'Hideout' };
    p.wanted = 3;
    p.heat = 8;
    const hx = places.hideout.x;
    const hy = places.hideout.y;
    heroCar(world, hx - 190, hy + 90, -Math.PI / 2, 260);
    copBehind(world, hx - 190, hy + 90, -Math.PI / 2, 140);
    copBehind(world, hx - 160, hy + 130, -Math.PI / 2, 220);
    world.camera.x = hx - 60;
    world.camera.y = hy + 40;
    return;
  }

  if (name === '4-start') {
    // The title screen over a golden-hour downtown view.
    world.screen = 'title';
    world.camera.x = roadX(3);
    world.camera.y = roadY(1);
    return;
  }
}

// How many fixed steps the harness runs after staging before freezing.
export const SHOT_STEPS = 45;
