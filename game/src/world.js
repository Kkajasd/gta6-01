// The living world of Vireo Bay: the player, traffic, pedestrians, police,
// the wanted level and the job state, and one step of simulation for each.
// Rendering lives in render.js; the screens and the loop live in main.js.
import {
  WORLD_W, WORLD_H, PLAYER, CAR, TRAFFIC, POLICE, WANTED_MAX,
  JOBS, BEST_KEY, STEP, ROAD_W, BLOCK_W, BLOCK_H,
} from './config.js';
import { buildCity, roadX, roadY, onRoad, snapToRoad, streetAt } from './city.js';
import { mulberry32, pick, intBetween, floatBetween, clamp, wrapAngle, angleDelta, dist } from './random.js';
import { startJob, jobTarget, jobComplete } from './missions.js';

const CAR_COLORS = ['#e84a4a', '#4a90e8', '#f2c14e', '#7ac74f', '#e8e8e8', '#8a6fd0', '#ff8a3d', '#3dd0c8'];
const PED_COLORS = ['#ff8a80', '#80d8ff', '#ffd54f', '#a5d6a7', '#ce93d8', '#ffcc80'];

export function createWorld(seed) {
  const city = buildCity(seed);
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const plaza = city.places.plaza;
  const world = {
    seed,
    city,
    rnd,
    time: 0,
    screen: 'title',
    paused: false,
    over: false,
    won: false,
    player: {
      x: plaza.x + 40, y: plaza.y + 60, angle: -Math.PI / 2, speed: 0,
      onFoot: true, car: null, health: PLAYER.maxHealth,
      ammo: PLAYER.startAmmo, cash: 0, wanted: 0, heat: 0,
      punchAt: -9, shootAt: -9, invulnUntil: 0, best: 0,
    },
    cars: [],
    peds: [],
    police: [],
    bullets: [],
    parts: [],
    camera: { x: plaza.x, y: plaza.y },
    job: { index: 0, phase: 'idle', target: null, timer: 0, done: false },
    stats: { jobsDone: 0, carsStolen: 0, busts: 0 },
    message: null,
    messageUntil: 0,
  };
  try {
    world.player.best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (e) { world.player.best = 0; }
  spawnTraffic(world);
  spawnPeds(world);
  return world;
}

export function saveBest(world) {
  const p = world.player;
  if (p.cash > p.best) {
    p.best = p.cash;
    try { localStorage.setItem(BEST_KEY, String(p.best)); } catch (e) { /* offline play */ }
  }
}

// Traffic cars drive the road grid; parked cars wait at the kerb.
export function spawnTraffic(world) {
  const { rnd, city } = world;
  for (let i = 0; i < TRAFFIC.count; i++) {
    const c = intBetween(rnd, 0, 5);
    const r = intBetween(rnd, 0, 4);
    const vertical = rnd() < 0.5;
    const x = vertical ? roadX(c) + (rnd() < 0.5 ? -14 : 14) : roadX(intBetween(rnd, 0, 6));
    const y = vertical ? roadY(intBetween(rnd, 0, 5)) : roadY(r) + (rnd() < 0.5 ? -14 : 14);
    world.cars.push({
      x, y, angle: vertical ? (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rnd() < 0.5 ? 0 : Math.PI),
      speed: floatBetween(rnd, TRAFFIC.speedMin, TRAFFIC.speedMax),
      color: pick(rnd, CAR_COLORS), parked: false, vertical,
      turnAt: 0, targetSpeed: 0, isPlayer: false, isPolice: false,
    });
  }
  for (let i = 0; i < 8; i++) {
    const c = intBetween(rnd, 0, 6);
    const r = intBetween(rnd, 0, 5);
    const vertical = rnd() < 0.5;
    world.cars.push({
      x: vertical ? roadX(c) + 26 : roadX(intBetween(rnd, 0, 6)) + floatBetween(rnd, -80, 80),
      y: vertical ? roadY(intBetween(rnd, 0, 5)) + floatBetween(rnd, -80, 80) : roadY(r) + 26,
      angle: vertical ? Math.PI / 2 : 0,
      speed: 0, color: pick(rnd, CAR_COLORS), parked: true, vertical,
      turnAt: 0, targetSpeed: 0, isPlayer: false, isPolice: false,
    });
  }
}

export function spawnPeds(world) {
  const { rnd } = world;
  for (let i = 0; i < TRAFFIC.pedCount; i++) {
    const x = floatBetween(rnd, 80, WORLD_W - 80);
    const y = floatBetween(rnd, 80, WORLD_H - 80);
    world.peds.push({
      x, y, angle: floatBetween(rnd, 0, Math.PI * 2),
      speed: floatBetween(rnd, 24, 48), color: pick(rnd, PED_COLORS),
      flee: 0, tx: x, ty: y, wait: floatBetween(rnd, 0, 3),
    });
  }
}

export function nearestCar(world, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of world.cars) {
    if (car.isPolice) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function addWanted(world, n) {
  const p = world.player;
  p.wanted = clamp(p.wanted + n, 0, WANTED_MAX);
  p.heat = 6;
}

export function setMessage(world, text, seconds) {
  world.message = text;
  world.messageUntil = world.time + seconds;
}

// One simulation step: player, traffic, pedestrians, police, bullets, jobs.
export function stepWorld(world, input, dt) {
  world.time += dt;
  const p = world.player;
  if (p.wanted > 0) {
    p.heat -= dt;
    if (p.heat <= 0) p.wanted = Math.max(0, p.wanted - 1), p.heat = p.wanted > 0 ? 8 : 0;
  }
  stepPlayer(world, input, dt);
  stepTraffic(world, dt);
  stepPeds(world, dt);
  stepPolice(world, dt);
  stepBullets(world, dt);
  stepParticles(world, dt);
  stepJob(world, dt);
  // Camera follows the player, clamped to the world.
  const tx = clamp(p.x, 640, WORLD_W - 640);
  const ty = clamp(p.y, 360, WORLD_H - 360);
  world.camera.x += (tx - world.camera.x) * Math.min(1, dt * 4);
  world.camera.y += (ty - world.camera.y) * Math.min(1, dt * 4);
  if (world.message && world.time > world.messageUntil) world.message = null;
}

function stepPlayer(world, input, dt) {
  const p = world.player;
  const car = p.car;
  if (p.health <= 0) { world.over = true; return; }
  if (car) {
    // Driving: W/S accelerate, A/D steer, Space handbrake, E step out.
    const fwd = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    car.speed += fwd * (fwd > 0 ? CAR.accel : CAR.brake) * dt;
    if (input.handbrake) car.speed *= Math.max(0, 1 - dt * 3);
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    car.angle += steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * dir;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 40, WORLD_W - 40);
    car.y = clamp(car.y, 40, WORLD_H - 40);
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    if (input.enter && world.time - (world.lastEnter || -9) > 0.4) {
      world.lastEnter = world.time;
      p.car = null; p.onFoot = true;
      car.parked = true; car.speed = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    }
    if (Math.abs(car.speed) > 240 && world.rnd() < dt * 8) {
      world.parts.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.4, max: 0.4, kind: 'dust', size: 5 });
    }
    return;
  }
  // On foot: WASD moves, E enters a nearby car, Space punches, F shoots.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  mx /= len; my /= len;
  const moving = input.up || input.down || input.left || input.right;
  const speed = moving ? PLAYER.walkSpeed : 0;
  p.x = clamp(p.x + mx * speed * dt, 24, WORLD_W - 24);
  p.y = clamp(p.y + my * speed * dt, 24, WORLD_H - 24);
  if (moving) p.angle = Math.atan2(my, mx);
  p.speed = speed;
  if (input.enter && world.time - (world.lastEnter || -9) > 0.4) {
    world.lastEnter = world.time;
    const target = nearestCar(world, p.x, p.y, 56);
    if (target) {
      target.parked = false; target.isPlayer = true;
      p.car = target; p.onFoot = false;
      world.stats.carsStolen++;
      addWanted(world, 1);
      setMessage(world, 'Car stolen — the cops noticed!', 2.5);
    }
  }
  if (input.punch && world.time - p.punchAt > 0.35) {
    p.punchAt = world.time;
    for (const ped of world.peds) {
      if (dist(p.x, p.y, ped.x, ped.y) < PLAYER.punchRange + 12) {
        ped.flee = 3;
        ped.x += Math.cos(p.angle) * 30;
        ped.y += Math.sin(p.angle) * 30;
      }
    }
    for (const cop of world.police) {
      if (dist(p.x, p.y, cop.x, cop.y) < PLAYER.punchRange + 16) {
        cop.health -= 20;
        addWanted(world, 1);
      }
    }
  }
  if (input.shoot && p.ammo > 0 && world.time - p.shootAt > PLAYER.shootCooldown) {
    p.shootAt = world.time;
    p.ammo--;
    const bx = p.x + Math.cos(p.angle) * 20;
    const by = p.y + Math.sin(p.angle) * 20;
    world.bullets.push({ x: bx, y: by, vx: Math.cos(p.angle) * 700, vy: Math.sin(p.angle) * 700, life: 0.6 });
    world.parts.push({ x: bx, y: by, vx: 0, vy: 0, life: 0.12, max: 0.12, kind: 'flash', size: 9 });
    addWanted(world, 0);
    p.wanted = Math.max(p.wanted, 1);
    p.heat = 6;
  }
}

function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.isPlayer || car.isPolice || car.parked) continue;
    // Follow the road: at an intersection, sometimes turn.
    const nearX = Math.abs(car.x - roadX(0)) < 40;
    const atJunction = car.vertical
      ? Math.abs(car.y - roadY(Math.round((car.y - ROAD_W / 2) / (BLOCK_H + ROAD_W)))) < 30
      : Math.abs(car.x - roadX(Math.round((car.x - ROAD_W / 2) / (BLOCK_W + ROAD_W)))) < 30;
    if (atJunction && world.time > car.turnAt) {
      car.turnAt = world.time + 2 + world.rnd() * 3;
      if (world.rnd() < 0.4) {
        car.vertical = !car.vertical;
        car.angle = car.vertical ? (world.rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (world.rnd() < 0.5 ? 0 : Math.PI);
      }
    }
    // Slow for a stopped car ahead.
    let blocked = false;
    for (const other of world.cars) {
      if (other === car || other.isPlayer) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 24) { blocked = true; break; }
    }
    const want = blocked ? 0 : car.speed || 120;
    car.speed += (want - car.speed) * Math.min(1, dt * 2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 30 || car.x > WORLD_W - 30 || car.y < 30 || car.y > WORLD_H - 30) {
      car.angle += Math.PI;
      car.x = clamp(car.x, 40, WORLD_W - 40);
      car.y = clamp(car.y, 40, WORLD_H - 40);
    }
  }
}

function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.x += Math.cos(ped.angle) * 130 * dt;
      ped.y += Math.sin(ped.angle) * 130 * dt;
    } else if (ped.wait > 0) {
      ped.wait -= dt;
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (world.rnd() < dt * 0.2 || onRoad(ped.x, ped.y)) {
        ped.angle = world.rnd() * Math.PI * 2;
        ped.wait = 1 + world.rnd() * 2;
      }
    }
    ped.x = clamp(ped.x, 30, WORLD_W - 30);
    ped.y = clamp(ped.y, 30, WORLD_H - 30);
  }
}

function stepPolice(world, dt) {
  const p = world.player;
  // Spawn cops while wanted; cap the pack.
  const want = Math.min(p.wanted + 1, 4);
  while (world.police.length < want && p.wanted > 0) {
    const a = world.rnd() * Math.PI * 2;
    const sx = clamp(p.x + Math.cos(a) * POLICE.spawnDistance, 60, WORLD_W - 60);
    const sy = clamp(p.y + Math.sin(a) * POLICE.spawnDistance, 60, WORLD_H - 60);
    const snap = snapToRoad(sx, sy);
    world.police.push({
      x: snap.x, y: snap.y, angle: 0, speed: 0, health: 100,
      color: '#2244aa', isPolice: true, isPlayer: false, parked: false, vertical: false,
    });
  }
  for (const cop of world.police) {
    if (cop.health <= 0) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += clamp(angleDelta(cop.angle, wantAngle), -POLICE.turnRate * dt, POLICE.turnRate * dt);
    cop.speed += (POLICE.maxSpeed - cop.speed) * Math.min(1, dt * 1.2);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (d < 46 && world.time > (world.lastRam || -9) + 0.8) {
      world.lastRam = world.time;
      p.health -= POLICE.ramDamage;
      world.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.5, max: 0.5, kind: 'smoke', size: 12 });
      if (p.car) { p.car.speed *= 0.4; }
    }
    if (d < POLICE.bustRange && !p.car && p.health > 0) {
      p.health = 0;
      world.stats.busts++;
      setMessage(world, 'Busted! The cops got you.', 3);
    }
  }
  world.police = world.police.filter((c) => c.health > 0);
  if (p.wanted === 0) world.police.length = 0;
}

function stepBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const cop of world.police) {
      if (dist(b.x, b.y, cop.x, cop.y) < 24) {
        cop.health -= 34;
        b.life = 0;
        world.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, kind: 'smoke', size: 8 });
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
}

function stepParticles(world, dt) {
  for (const pt of world.parts) {
    pt.life -= dt;
    pt.x += (pt.vx || 0) * dt;
    pt.y += (pt.vy || 0) * dt;
  }
  world.parts = world.parts.filter((pt) => pt.life > 0);
}

function stepJob(world, dt) {
  const job = world.job;
  if (job.done) return;
  const def = JOBS[job.index];
  if (!def) { job.done = true; world.won = true; return; }
  if (job.phase === 'idle') {
    startJob(world, job.index);
  }
  const target = job.target;
  if (!target) return;
  const p = world.player;
  const d = dist(p.x, p.y, target.x, target.y);
  if (job.phase === 'go' && d < 60) {
    job.phase = 'act';
    job.timer = 2;
    setMessage(world, def.brief + ' — hold on…', 2);
  } else if (job.phase === 'act') {
    job.timer -= dt;
    if (job.timer <= 0) {
      const reward = jobComplete(world, job.index);
      world.stats.jobsDone++;
      setMessage(world, def.name + ' done — +$' + reward, 3);
      saveBest(world);
      job.index++;
      job.phase = 'idle';
      job.target = null;
      if (job.index >= JOBS.length) {
        job.done = true;
        world.won = true;
        setMessage(world, 'Debt paid! Vireo Bay is yours.', 5);
      }
    }
  }
}
