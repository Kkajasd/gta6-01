// Vireo Bay — the simulation: the player on foot and by car, traffic, pedestrians,
// police, wanted level, bullets, particles and the mission clock. Everything
// advances in fixed steps from a seed, so a shot stages identically every time.
import {
  STEP, WORLD, AVENUES, STREETS, PLAYER, TRAFFIC, PEDS, POLICE,
  WANTED_MAX, AMMO_START, HEALTH_MAX, HIDEOUT,
} from './config.js';
import { createRandom } from './random.js';
import { createCity, resolveCircle, randomRoadPoint } from './city.js';
import { createMission, startJob, updateMission, jobObjective } from './missions.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_JOB = 4;
export const EVENT_CRIME = 8;

const CAR_COLORS = TRAFFIC.colors;

/** A traffic car driving the grid on a road, turning at intersections. */
function makeTrafficCar(random, city) {
  const vertical = random.chance(0.5);
  if (vertical) {
    const index = random.int(0, AVENUES.length - 1);
    const dir = random.chance(0.5) ? 1 : -1;
    return {
      kind: 'traffic', roadKind: 'v', roadIndex: index,
      along: random.range(200, 2300), dir,
      x: AVENUES[index] + dir * 20, y: 0, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      speed: TRAFFIC.speed, color: random.pick(CAR_COLORS), length: 46, width: 24,
      health: 100, brakeLight: false, laneShift: 0,
    };
  }
  const index = random.int(0, STREETS.length - 1);
  const dir = random.chance(0.5) ? 1 : -1;
  return {
    kind: 'traffic', roadKind: 'h', roadIndex: index,
    along: random.range(200, 3600), dir,
    x: 0, y: STREETS[index] + dir * 20, angle: dir > 0 ? 0 : Math.PI,
    speed: TRAFFIC.speed, color: random.pick(CAR_COLORS), length: 46, width: 24,
    health: 100, brakeLight: false, laneShift: 0,
  };
}

function makePed(random) {
  const vertical = random.chance(0.5);
  if (vertical) {
    const index = random.int(0, AVENUES.length - 1);
    const dir = random.chance(0.5) ? 1 : -1;
    return {
      roadKind: 'v', roadIndex: index, along: random.range(200, 2300), dir,
      x: AVENUES[index] + dir * 58, y: 0, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      speed: PEDS.speed * random.range(0.7, 1.3),
      color: random.pick(['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22']),
      down: 0, panic: 0,
    };
  }
  const index = random.int(0, STREETS.length - 1);
  const dir = random.chance(0.5) ? 1 : -1;
  return {
    roadKind: 'h', roadIndex: index, along: random.range(200, 3600), dir,
    x: 0, y: STREETS[index] + dir * 58, angle: dir > 0 ? 0 : Math.PI,
    speed: PEDS.speed * random.range(0.7, 1.3),
    color: random.pick(['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22']),
    down: 0, panic: 0,
  };
}

function makeParkedCar(random) {
  const vertical = random.chance(0.5);
  if (vertical) {
    const index = random.int(0, AVENUES.length - 1);
    const side = random.chance(0.5) ? 1 : -1;
    return {
      kind: 'parked', x: AVENUES[index] + side * 55, y: random.range(300, 2300),
      angle: Math.PI / 2, speed: 0, color: random.pick(CAR_COLORS), length: 46, width: 18,
      health: 100, brakeLight: false,
    };
  }
  const index = random.int(0, STREETS.length - 1);
  const side = random.chance(0.5) ? 1 : -1;
  return {
    kind: 'parked', x: random.range(300, 3600), y: STREETS[index] + side * 55,
    angle: 0, speed: 0, color: random.pick(CAR_COLORS), length: 46, width: 18,
    health: 100, brakeLight: false,
  };
}

export function createWorld(random) {
  const city = createCity(random);
  const world = {
    random,
    city,
    time: 0,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    wanted: 0,
    crimeTimer: 0,
    decayTimer: 0,
    copSpawnTimer: 0,
    mission: createMission(),
    cash: 0,
    score: 0,
    best: 0,
    message: '',
    announce: '',
    over: false,
    won: false,
    shotCam: null,
    attractTarget: null,

    reset() {
      this.time = 0;
      this.cars = [];
      this.peds = [];
      this.cops = [];
      this.bullets = [];
      this.particles = [];
      this.wanted = 0;
      this.crimeTimer = 0;
      this.decayTimer = 0;
      this.copSpawnTimer = 0;
      this.mission = createMission();
      this.cash = 0;
      this.score = 0;
      this.message = '';
      this.announce = '';
      this.over = false;
      this.won = false;
      this.shotCam = null;
      this.attractTarget = null;
      // The player's own car: a magenta convertible parked on Neon Ave,
      // facing south down the avenue so the first drive heads straight out.
      const ownCar = {
        kind: 'player', x: 800, y: 1180, angle: Math.PI / 2, speed: 0,
        color: '#ff2e88', length: 52, width: 26,
        from: { x: 800, y: 1180 }, to: { x: 800, y: 1180 }, health: 100, brakeLight: false,
      };
      this.cars.push(ownCar);
      this.player = {
        x: 800, y: 1240, angle: Math.PI / 2, onFoot: true,
        health: HEALTH_MAX, cash: 0, ammo: AMMO_START, speed: 0,
        car: null, punchT: 0, invuln: 0,
      };
      for (let i = 0; i < TRAFFIC.count; i += 1) this.cars.push(makeTrafficCar(this.random, this.city));
      for (let i = 0; i < 10; i += 1) this.cars.push(makeParkedCar(this.random));
      for (let i = 0; i < PEDS.count; i += 1) this.peds.push(makePed(this.random));
    },

    step(dt, input, attract) {
      return stepWorld(this, dt, input, attract);
    },
  };
  world.reset();
  return world;
}

/** Raise the wanted level by n (capped) and stamp the crime clock. */
export function commitCrime(world, n) {
  world.wanted = Math.min(WANTED_MAX, world.wanted + n);
  world.crimeTimer = 0;
  return EVENT_CRIME;
}

function addParticles(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = world.random.range(0, Math.PI * 2);
    const s = world.random.range(speed * 0.3, speed);
    world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: world.random.range(0.3, 0.7), color, size: world.random.range(2, 5) });
  }
}

function stepPlayer(world, dt, input) {
  const p = world.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.punchT > 0) p.punchT -= dt;

  if (p.onFoot) {
    const w = input.walk || { x: 0, y: 0, moving: false };
    if (w.moving) {
      p.x += w.x * PLAYER.walkSpeed * dt;
      p.y += w.y * PLAYER.walkSpeed * dt;
      p.angle = Math.atan2(w.y, w.x);
      const fixed = resolveCircle(world.city, p.x, p.y, PLAYER.radius);
      p.x = fixed.x;
      p.y = fixed.y;
      p.speed = PLAYER.walkSpeed;
    } else {
      p.speed = 0;
    }
    return 0;
  }

  // Driving: the player's car is the car object itself.
  const car = p.car;
  if (!car) { p.onFoot = true; return 0; }
  const drive = input.drive || { steer: 0, gas: 0, brake: 0 };
  const accel = drive.gas ? PLAYER.carAccel : 0;
  car.speed += accel * dt;
  if (drive.brake) car.speed -= PLAYER.carBrake * dt;
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  car.speed = Math.max(-PLAYER.carReverseMax, Math.min(PLAYER.carMax, car.speed));
  const turnAuthority = Math.min(1, Math.abs(car.speed) / 140);
  car.angle += drive.steer * PLAYER.carTurn * turnAuthority * Math.sign(car.speed || 1) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveCircle(world.city, nx, ny, 20);
  const hitWall = fixed.x !== nx || fixed.y !== ny;
  if (hitWall && Math.abs(car.speed) > 260) {
    addParticles(world, fixed.x, fixed.y, '#ffb347', 8, 160);
    car.speed *= 0.45;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  car.brakeLight = !!drive.brake;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  return hitWall && Math.abs(car.speed) > 200 ? EVENT_HIT : 0;
}

function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.kind !== 'traffic') continue;
    car.along += car.dir * car.speed * dt;
    const maxAlong = car.roadKind === 'v' ? 2400 : 3680;
    // Turn at an intersection, or U-turn at the map edge.
    const crossings = car.roadKind === 'v' ? STREETS : AVENUES;
    for (const c of crossings) {
      if (Math.abs(car.along - c) < 8 && world.random.chance(0.06)) {
        const oldCenter = car.roadKind === 'v' ? AVENUES[car.roadIndex] : STREETS[car.roadIndex];
        if (car.roadKind === 'v') { car.roadKind = 'h'; car.roadIndex = STREETS.indexOf(c); }
        else { car.roadKind = 'v'; car.roadIndex = AVENUES.indexOf(c); }
        car.along = oldCenter;
        car.dir = world.random.chance(0.5) ? 1 : -1;
        break;
      }
    }
    if (car.along < 170) { car.along = 170; car.dir = 1; }
    if (car.along > maxAlong - 10) { car.along = maxAlong - 10; car.dir = -1; }
    // Ease off when a car is right ahead; swing around parked cars.
    let ahead = 1;
    for (const other of world.cars) {
      if (other === car || other.kind === 'parked') continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (along > 0 && along < 90 && side < 30) { ahead = 0.35; break; }
    }
    let wantShift = 0;
    for (const other of world.cars) {
      if (other.kind !== 'parked') continue;
      if (other.roadKind !== undefined) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = -ox * Math.sin(car.angle) + oy * Math.cos(car.angle);
      if (along > 0 && along < 130 && Math.abs(side - car.dir * 20) < 34) { wantShift = -car.dir * 40; break; }
    }
    car.laneShift += (wantShift - car.laneShift) * Math.min(1, 3 * dt);
    car.speed = TRAFFIC.speed * ahead;
    const lane = car.dir * 20 + car.laneShift;
    if (car.roadKind === 'v') {
      car.x = AVENUES[car.roadIndex] + lane;
      car.y = car.along;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = car.along;
      car.y = STREETS[car.roadIndex] + lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
  }
}

function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.down > 0) { ped.down -= dt; continue; }
    if (ped.panic > 0) {
      ped.panic -= dt;
      // Run away from the player.
      const away = Math.atan2(ped.y - world.player.y, ped.x - world.player.x);
      ped.x += Math.cos(away) * PEDS.speed * 2.1 * dt;
      ped.y += Math.sin(away) * PEDS.speed * 2.1 * dt;
    } else {
      // Walk the sidewalk along the current road, turning at intersections.
      ped.along += ped.dir * ped.speed * dt;
      const maxAlong = ped.roadKind === 'v' ? 2400 : 3680;
      const crossings = ped.roadKind === 'v' ? STREETS : AVENUES;
      for (const c of crossings) {
        if (Math.abs(ped.along - c) < 8 && world.random.chance(0.04)) {
          const oldCenter = ped.roadKind === 'v' ? AVENUES[ped.roadIndex] : STREETS[ped.roadIndex];
          if (ped.roadKind === 'v') { ped.roadKind = 'h'; ped.roadIndex = STREETS.indexOf(c); }
          else { ped.roadKind = 'v'; ped.roadIndex = AVENUES.indexOf(c); }
          ped.along = oldCenter;
          ped.dir = world.random.chance(0.5) ? 1 : -1;
          break;
        }
      }
      if (ped.along < 170) { ped.along = 170; ped.dir = 1; }
      if (ped.along > maxAlong - 10) { ped.along = maxAlong - 10; ped.dir = -1; }
      const side = ped.dir * 58;
      if (ped.roadKind === 'v') {
        ped.x = AVENUES[ped.roadIndex] + side;
        ped.y = ped.along;
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.x = ped.along;
        ped.y = STREETS[ped.roadIndex] + side;
        ped.angle = ped.dir > 0 ? 0 : Math.PI;
      }
    }
    const fixed = resolveCircle(world.city, ped.x, ped.y, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    // A car brushing a pedestrian knocks them down and draws the law.
    for (const car of world.cars) {
      if (car.speed < 40) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 34) {
        ped.down = 2.2;
        addParticles(world, ped.x, ped.y, '#ff5e5e', 6, 120);
        if (car.kind === 'player') commitCrime(world, 1);
      }
    }
  }
}

function stepBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += Math.cos(b.angle) * 950 * dt;
    b.y += Math.sin(b.angle) * 950 * dt;
    b.life -= dt;
    for (const ped of world.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(b.x - ped.x, b.y - ped.y) < 16) {
        ped.down = 2.5;
        ped.panic = 3;
        b.life = 0;
        commitCrime(world, 1);
        addParticles(world, b.x, b.y, '#ff5e5e', 5, 100);
      }
    }
    for (const cop of world.cops) {
      if (Math.hypot(b.x - cop.x, b.y - cop.y) < 26) {
        cop.health -= 25;
        b.life = 0;
        commitCrime(world, 1);
        addParticles(world, b.x, b.y, '#ffd75e', 7, 140);
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
}

function nearestCopDist(world) {
  let best = Infinity;
  for (const cop of world.cops) {
    best = Math.min(best, Math.hypot(cop.x - world.player.x, cop.y - world.player.y));
  }
  return best;
}

function stepPolice(world, dt) {
  const p = world.player;
  // Spawn up to the wanted level, from a road a little away from the player.
  world.copSpawnTimer -= dt;
  if (world.cops.length < world.wanted && world.copSpawnTimer <= 0) {
    world.copSpawnTimer = 2;
    const spot = randomRoadPoint(world.random);
    let guard = 0;
    while (Math.hypot(spot.x - p.x, spot.y - p.y) < 600 && guard < 10) {
      const s2 = randomRoadPoint(world.random);
      spot.x = s2.x; spot.y = s2.y;
      guard += 1;
    }
    world.cops.push({
      kind: 'police', x: spot.x, y: spot.y, angle: 0, speed: 0,
      color: '#1d2733', length: 50, width: 26, health: 100,
      from: spot, to: spot, brakeLight: false, flash: world.random.next(),
    });
  }
  for (const cop of world.cops) {
    const want = Math.atan2(p.y - cop.y, p.x - cop.x);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    cop.speed = Math.min(POLICE.speed, cop.speed + 700 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    const fixed = resolveCircle(world.city, cop.x, cop.y, 20);
    cop.x = fixed.x;
    cop.y = fixed.y;
    // Ram the player: damage and a shove.
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < 46 && p.invuln <= 0) {
      p.health -= POLICE.ramDamage;
      p.invuln = 0.8;
      addParticles(world, p.x, p.y, '#ff5e5e', 10, 200);
      if (!p.onFoot && p.car) p.car.speed *= 0.55;
    }
  }
  // No heat, no cops: they drive off.
  if (world.wanted === 0) {
    world.cops = world.cops.filter((cop) => Math.hypot(cop.x - p.x, cop.y - p.y) < 900);
  }
  world.cops = world.cops.filter((cop) => cop.health > 0);
}

function stepActions(world, input) {
  const p = world.player;
  let events = 0;
  if (input.enter) {
    if (p.onFoot) {
      let bestCar = null;
      let bestD = 70;
      for (const car of world.cars) {
        if (car.kind === 'player') continue;
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < bestD) { bestD = d; bestCar = car; }
      }
      if (bestCar) {
        if (bestCar.kind === 'traffic') events |= commitCrime(world, 1);
        bestCar.kind = 'player';
        p.car = bestCar;
        p.onFoot = false;
        p.angle = bestCar.angle;
        world.message = bestCar.kind === 'player' ? 'Car stolen. The law is coming.' : '';
      }
    } else if (p.car) {
      const car = p.car;
      car.kind = 'parked';
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      const fixed = resolveCircle(world.city, p.x, p.y, PLAYER.radius);
      p.x = fixed.x;
      p.y = fixed.y;
      p.car = null;
      p.onFoot = true;
    }
  }
  if (input.punch && p.onFoot && p.punchT <= 0) {
    p.punchT = 0.28;
    for (const ped of world.peds) {
      if (ped.down > 0) continue;
      const dx = ped.x - p.x;
      const dy = ped.y - p.y;
      const d = Math.hypot(dx, dy);
      const facing = Math.cos(Math.atan2(dy, dx) - p.angle);
      if (d < 52 && facing > 0.3) {
        ped.down = 2.2;
        ped.panic = 3;
        addParticles(world, ped.x, ped.y, '#ffd75e', 6, 130);
        if (nearestCopDist(world) < 600) events |= commitCrime(world, 1);
      }
    }
  }
  if (input.shoot && p.ammo > 0) {
    p.ammo -= 1;
    const ox = p.x + Math.cos(p.angle) * 26;
    const oy = p.y + Math.sin(p.angle) * 26;
    world.bullets.push({ x: ox, y: oy, angle: p.angle, life: 0.6 });
    addParticles(world, ox, oy, '#ffe14d', 4, 90);
    events |= commitCrime(world, 1);
  }
  return events;
}

function stepWorld(world, dt, input, attract) {
  world.time += dt;
  let events = 0;
  const p = world.player;

  if (attract) {
    // Title-screen demo: Dana cruises downtown on her own, intersection to
    // intersection, so she stays on the roads.
    if (!world.attractTarget || Math.hypot(world.attractTarget.x - p.x, world.attractTarget.y - p.y) < 90) {
      let ai = 0;
      let aj = 0;
      for (let i = 0; i < AVENUES.length; i += 1) if (Math.abs(p.x - AVENUES[i]) < Math.abs(p.x - AVENUES[ai])) ai = i;
      for (let j = 0; j < STREETS.length; j += 1) if (Math.abs(p.y - STREETS[j]) < Math.abs(p.y - STREETS[aj])) aj = j;
      const options = [];
      if (ai > 0) options.push({ x: AVENUES[ai - 1], y: STREETS[aj] });
      if (ai < AVENUES.length - 1) options.push({ x: AVENUES[ai + 1], y: STREETS[aj] });
      if (aj > 0) options.push({ x: AVENUES[ai], y: STREETS[aj - 1] });
      if (aj < STREETS.length - 1) options.push({ x: AVENUES[ai], y: STREETS[aj + 1] });
      world.attractTarget = world.random.pick(options);
    }
    if (p.onFoot && p.car === null) {
      const own = world.cars.find((c) => c.color === '#ff2e88');
      if (own) { p.car = own; own.kind = 'player'; p.onFoot = false; }
    }
    const t = world.attractTarget;
    const want = Math.atan2(t.y - p.y, t.x - p.x);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const driveInput = { steer: Math.max(-1, Math.min(1, diff * 1.6)), gas: 1, brake: 0 };
    events |= stepPlayer(world, dt, { drive: driveInput, walk: { x: 0, y: 0, moving: false } });
  } else {
    events |= stepPlayer(world, dt, input);
    events |= stepActions(world, input);
  }

  stepTraffic(world, dt);
  stepPeds(world, dt);
  stepBullets(world, dt);
  stepPolice(world, dt);

  for (const part of world.particles) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.life -= dt;
  }
  world.particles = world.particles.filter((part) => part.life > 0);

  // Wanted decays when the heat is off and no cop is close; the Hideout clears it.
  world.crimeTimer += dt;
  const hideoutD = Math.hypot(p.x - HIDEOUT.x, p.y - HIDEOUT.y);
  if (hideoutD < HIDEOUT.radius && world.wanted > 0) {
    world.decayTimer += dt;
    if (world.decayTimer > 1) { world.wanted -= 1; world.decayTimer = 0; }
  } else if (world.wanted > 0 && world.crimeTimer > 10 && nearestCopDist(world) > 500) {
    world.decayTimer += dt;
    if (world.decayTimer > 6) { world.wanted -= 1; world.decayTimer = 0; }
  } else {
    world.decayTimer = 0;
  }

  // Mission clock, and the current objective for the renderer.
  if (world.mission.phase === 'active') {
    events |= updateMission(world, dt);
  }
  world.objective = jobObjective(world);

  if (p.health <= 0 && !world.over) {
    world.over = true;
    events |= EVENT_OVER;
  }
  if (world.mission.won) world.won = true;
  return events;
}
