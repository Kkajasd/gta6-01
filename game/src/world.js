// The game's rules and state, with no drawing and no browser in it: the player on foot
// and in cars, traffic and pedestrians, police and the wanted level, the four missions,
// combat, pickups and particles. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react (sound, announcements) without the world knowing
// about screens. Nothing here allocates after createWorld returns, except the small
// particle bursts, which are pooled by reuse.

import {
  CAR, COMBAT, PEDS, PLAYER, POLICE, ROAD, TRAFFIC, VIEW, WANTED, WORLD,
} from './config.js';
import { MISSION_DEFS, missionReward } from './missions.js';
import { ROAD_XS, ROAD_YS, hitsBuilding, nearestRoadPoint, onRoad, onSidewalk, resolveBuildings } from './city.js';
import { pick, range } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_DELIVERED = 2;
export const EVENT_BUSTED = 4;
export const EVENT_DEAD = 8;
export const EVENT_WON = 16;
export const EVENT_SHOT = 32;
export const EVENT_CRIME = 64;
export const EVENT_MISSION = 128;

const TWO_PI = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  return angle + clamp(diff, -maxStep, maxStep);
}

function overlaps(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

export function createWorld(random, city) {
  const player = {
    x: city.places.home.x, y: city.places.home.y, angle: -Math.PI / 2,
    onFoot: true, car: null, punchTimer: 0, shootCd: 0, invuln: 0,
    moving: false, speed: 0,
  };

  const cars = [];
  const peds = [];
  const enemies = [];
  const bullets = [];
  const pickups = [];
  const particles = [];
  for (let i = 0; i < 160; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 3 });
  for (let i = 0; i < 40; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, friendly: true });

  const state = {
    player, cars, peds, enemies, bullets, pickups, particles,
    elapsed: 0, money: 0, earned: 0, health: PLAYER.health, ammo: COMBAT.startAmmo,
    wanted: 0, wantedTimer: 0, bustTimer: 0,
    missionIndex: 0, stageIndex: 0, missionTimer: 0, missionDone: false, missionPlace: null,
    message: '', messageTimer: 0,
    busted: false, dead: false, won: false, endReason: '',
    stats: { stolen: 0, delivered: 0, busted: 0 },
    camera: { x: player.x, y: player.y },
  };

  function say(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 3;
  }

  function burst(x, y, color, count, speed, size) {
    let made = 0;
    for (const p of particles) {
      if (made >= count) break;
      if (p.active) continue;
      p.active = true;
      p.x = x; p.y = y;
      const a = random() * TWO_PI;
      const s = speed * (0.4 + random() * 0.8);
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = 0.4 + random() * 0.35; p.max = p.life;
      p.color = color; p.size = size * (0.7 + random() * 0.6);
      made += 1;
    }
  }

  function fireBullet(x, y, angle, friendly) {
    for (const b of bullets) {
      if (b.active) continue;
      b.active = true;
      b.x = x; b.y = y;
      b.vx = Math.cos(angle) * COMBAT.bulletSpeed;
      b.vy = Math.sin(angle) * COMBAT.bulletSpeed;
      b.life = COMBAT.bulletLife;
      b.friendly = friendly;
      return true;
    }
    return false;
  }

  function addWanted(amount, events) {
    if (amount <= 0) return events;
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.wantedTimer = 0;
    return events | EVENT_CRIME;
  }

  function spawnCar(kind, x, y, angle, color) {
    const car = {
      kind, x, y, angle, speed: 0, color,
      driver: kind === 'traffic' ? 'ped' : 'none',
      dir: angle, turnTimer: 0, brake: false, siren: random() * TWO_PI,
      missionCar: false, stopped: false,
    };
    cars.push(car);
    return car;
  }

  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    const road = vertical ? pick(random, cityRoadXs()) : pick(random, cityRoadYs());
    const along = range(random, 200, (vertical ? WORLD.height : WORLD.width) - 200);
    const lane = (random() < 0.5 ? 1 : -1) * (ROAD.width / 4);
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const angle = vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI);
    const car = spawnCar('traffic', x, y, angle, pick(random, trafficColors()));
    car.speed = TRAFFIC.cruise + range(random, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter);
    car.dir = angle;
    return car;
  }

  function cityRoadXs() {
    const xs = [];
    for (let x = ROAD.first; x < WORLD.width; x += ROAD.spacing) xs.push(x);
    return xs;
  }
  function cityRoadYs() {
    const ys = [];
    for (let y = ROAD.first; y < WORLD.height; y += ROAD.spacing) ys.push(y);
    return ys;
  }
  function trafficColors() {
    return ['#d8d8d8', '#7fb3d5', '#c27ba0', '#f0a35e', '#8bc34a', '#9e9e9e', '#e8c547'];
  }

  function spawnParkedCar(x, y, angle, color, missionCar) {
    const car = spawnCar('parked', x, y, angle, color);
    car.missionCar = !!missionCar;
    return car;
  }

  function spawnPed(x, y) {
    const ped = {
      x, y, angle: random() * TWO_PI, speed: PEDS.speed + range(random, -PEDS.speedJitter, PEDS.speedJitter),
      color: pick(random, ['#e8e0d0', '#7a9cc6', '#c67b7b', '#8fce9b', '#d9c27a']),
      state: 'walk', timer: range(random, 2, 6), down: 0, flee: 0,
    };
    peds.push(ped);
    return ped;
  }

  function spawnEnemy(x, y) {
    const enemy = {
      x, y, angle: 0, speed: 120, health: COMBAT.enemyHealth,
      shootCd: range(random, 0.4, 1.2), state: 'guard',
    };
    enemies.push(enemy);
    return enemy;
  }

  function spawnPolice() {
    const angle = random() * TWO_PI;
    const x = clamp(player.x + Math.cos(angle) * POLICE.spawnDistance, 120, WORLD.width - 120);
    const y = clamp(player.y + Math.sin(angle) * POLICE.spawnDistance, 120, WORLD.height - 120);
    // Patrol cars spawn on a road, never inside a block.
    const road = nearestRoadPoint(x, y);
    const car = spawnCar('police', road.x, road.y, angleTo(road.x, road.y, player.x, player.y), '#2f6fd0');
    car.speed = POLICE.cruise;
    return car;
  }

  /**
   * The next corner of a road route from (x, y) toward (tx, ty): drive along the road
   * the car is already on to the crossing nearest the target, then turn onto it. Cars
   * that follow this never cut across city blocks.
   */
  function nextRoadPoint(x, y, tx, ty) {
    let rx = ROAD_XS[0];
    let ry = ROAD_YS[0];
    for (const vx of ROAD_XS) if (Math.abs(vx - x) < Math.abs(rx - x)) rx = vx;
    for (const hy of ROAD_YS) if (Math.abs(hy - y) < Math.abs(ry - y)) ry = hy;
    let txr = ROAD_XS[0];
    let tyr = ROAD_YS[0];
    for (const vx of ROAD_XS) if (Math.abs(vx - tx) < Math.abs(txr - tx)) txr = vx;
    for (const hy of ROAD_YS) if (Math.abs(hy - ty) < Math.abs(tyr - ty)) tyr = hy;
    const onV = Math.abs(x - rx) < 70;
    const onH = Math.abs(y - ry) < 70;
    if (onV && !onH) return { x: rx, y: tyr };
    if (onH && !onV) return { x: txr, y: ry };
    if (onV && onH) {
      return Math.abs(tx - x) > Math.abs(ty - y) ? { x: txr, y: ry } : { x: rx, y: tyr };
    }
    return nearestRoadPoint(x, y);
  }

  function placePickups() {
    pickups.length = 0;
    pickups.push({ kind: 'health', x: city.places.market.x + 60, y: city.places.market.y + 40, taken: false, respawn: 0 });
    pickups.push({ kind: 'ammo', x: city.places.cafe.x - 60, y: city.places.cafe.y + 40, taken: false, respawn: 0 });
    pickups.push({ kind: 'health', x: city.places.beach.x, y: city.places.beach.y - 60, taken: false, respawn: 0 });
    pickups.push({ kind: 'ammo', x: city.places.hideout.x + 60, y: city.places.hideout.y - 40, taken: false, respawn: 0 });
  }

  function currentStage() {
    const def = MISSION_DEFS[state.missionIndex];
    if (!def) return null;
    return def.stages[state.stageIndex] || null;
  }

  function currentPlace() {
    const stage = currentStage();
    if (!stage) return null;
    return city.places[stage.place] || null;
  }

  function startStage() {
    const stage = currentStage();
    if (!stage) return;
    const place = city.places[stage.place];
    state.missionPlace = place || null;
    state.missionTimer = stage.timed || 0;
    if (stage.kind === 'steal') {
      // The red coupe waits by Sol Plaza, in the northbound lane; taking it is the job.
      spawnParkedCar(place.x + 29, place.y + 120, -Math.PI / 2, '#e8452c', true);
      say('Take the red coupe at Sol Plaza. Press E near it.');
    } else if (stage.kind === 'escape') {
      addWanted(2, 0);
      spawnPolice();
      spawnPolice();
      say('The cops are on you! Lose them, then reach the Hideout.');
    } else if (stage.kind === 'fight') {
      spawnEnemy(place.x - 80, place.y + 60);
      spawnEnemy(place.x + 60, place.y + 90);
      spawnEnemy(place.x + 10, place.y - 70);
      say('Rival crew at the docks! Clear them out.');
    } else {
      say(stage.text);
    }
  }

  function completeStage(events) {
    const def = MISSION_DEFS[state.missionIndex];
    state.stageIndex += 1;
    if (state.stageIndex >= def.stages.length) {
      const reward = missionReward(state.missionIndex);
      state.money += reward;
      state.earned += reward;
      state.stats.delivered += 1;
      say(`${def.title} complete! +$${reward}`);
      state.missionIndex += 1;
      state.stageIndex = 0;
      if (state.missionIndex >= MISSION_DEFS.length) {
        state.won = true;
        state.missionDone = true;
        return events | EVENT_DELIVERED | EVENT_WON;
      }
      startStage();
      return events | EVENT_DELIVERED | EVENT_MISSION;
    }
    startStage();
    return events | EVENT_DELIVERED;
  }

  /** Jump to a mission (used by the screenshot scenes); resets the wanted level first. */
  function jumpToMission(index) {
    state.missionIndex = index;
    state.stageIndex = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    startStage();
  }

  function reset() {
    player.x = city.places.home.x;
    player.y = city.places.home.y;
    player.angle = -Math.PI / 2;
    player.onFoot = true;
    player.car = null;
    player.punchTimer = 0;
    player.shootCd = 0;
    player.invuln = 0;
    cars.length = 0;
    peds.length = 0;
    enemies.length = 0;
    for (const b of bullets) b.active = false;
    for (const p of particles) p.active = false;
    state.elapsed = 0;
    state.money = 0;
    state.earned = 0;
    state.health = PLAYER.health;
    state.ammo = COMBAT.startAmmo;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.bustTimer = 0;
    state.missionIndex = 0;
    state.stageIndex = 0;
    state.missionTimer = 0;
    state.missionDone = false;
    state.busted = false;
    state.dead = false;
    state.won = false;
    state.endReason = '';
    state.stats = { stolen: 0, delivered: 0, busted: 0 };
    state.camera.x = player.x;
    state.camera.y = player.y;
    // Parked cars the player can take, parked on roads (in a lane, facing along it).
    spawnParkedCar(city.places.home.x + 29, city.places.home.y + 150, -Math.PI / 2, '#e8452c', false);
    spawnParkedCar(city.places.cafe.x + 29, city.places.cafe.y + 150, -Math.PI / 2, '#7fb3d5', false);
    spawnParkedCar(city.places.market.x - 29, city.places.market.y - 150, Math.PI / 2, '#f0a35e', false);
    spawnParkedCar(city.places.beach.x + 29, ROAD_YS[5], 0, '#8bc34a', false);
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < PEDS.count; i += 1) {
      const p = nearestRoadPoint(range(random, 300, WORLD.width - 300), range(random, 300, WORLD.height - 300));
      spawnPed(p.x + range(random, -90, 90), p.y + range(random, -90, 90));
    }
    placePickups();
    startStage();
    say('Job 1: pick up the crate at the Harbor Docks.');
  }

  /** The player presses E: get in the nearest car, or get out of the one driven. */
  function enterExitCar() {
    if (!player.onFoot) {
      const car = player.car;
      if (!car) return;
      car.driver = 'none';
      car.kind = 'parked';
      car.speed = 0;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      player.onFoot = true;
      player.car = null;
      resolveBuildings(city, player, PLAYER.radius);
      return;
    }
    let best = null;
    let bestD = 78;
    for (const car of cars) {
      if (car.driver === 'player') continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return;
    if (best.kind === 'police') return; // Police cars stay locked.
    if (best.driver === 'ped') {
      // Pull the driver out; they run off, and the theft is noticed.
      const driver = spawnPed(best.x + 30, best.y + 30);
      driver.flee = 3;
      driver.state = 'flee';
      state.stats.stolen += 1;
      addWanted(WANTED.steal, 0);
      say('Car stolen! The cops noticed.');
      burst(best.x, best.y, '#ffd23e', 8, 120, 4);
    } else if (best.missionCar) {
      state.stats.stolen += 1;
      addWanted(WANTED.steal, 0);
      say('Coupe taken. Deliver it to Bay Market — fast!');
      burst(best.x, best.y, '#ffd23e', 8, 120, 4);
    }
    best.driver = 'player';
    best.kind = 'player';
    player.car = best;
    player.onFoot = false;
  }

  function damagePlayer(amount, events) {
    if (player.invuln > 0 || state.dead) return events;
    state.health -= amount;
    player.invuln = PLAYER.invulnerable;
    burst(player.x, player.y, '#e5534b', 10, 160, 4);
    if (state.health <= 0) {
      state.health = 0;
      state.dead = true;
      return events | EVENT_DEAD;
    }
    return events;
  }

  function stepPlayer(dt, input) {
    player.punchTimer = Math.max(0, player.punchTimer - dt);
    player.shootCd = Math.max(0, player.shootCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.moving = false;

    if (player.onFoot) {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len; dy /= len;
        const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        player.x += dx * speed * dt;
        player.y += dy * speed * dt;
        player.angle = Math.atan2(dy, dx);
        player.moving = true;
        player.speed = speed;
      } else {
        player.speed = 0;
      }
      player.x = clamp(player.x, 20, WORLD.width - 20);
      player.y = clamp(player.y, 20, WORLD.height - 20);
      resolveBuildings(city, player, PLAYER.radius);
      if (input.enter) enterExitCar();
      if (input.punch && player.punchTimer <= 0) {
        player.punchTimer = PLAYER.punchCooldown;
        punch();
      }
      if (input.shoot && player.shootCd <= 0 && state.ammo > 0) {
        player.shootCd = PLAYER.shootCooldown;
        state.ammo -= 1;
        const aim = input.aimWorld ? angleTo(player.x, player.y, input.aimWorld.x, input.aimWorld.y) : player.angle;
        fireBullet(player.x + Math.cos(aim) * 20, player.y + Math.sin(aim) * 20, aim, true);
      }
    } else if (player.car) {
      const car = player.car;
      const forward = input.up ? 1 : input.down ? -0.6 : 0;
      if (input.up) car.speed += CAR.accel * dt;
      else if (input.down) {
        if (car.speed > 30) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.reverseAccel * dt;
      } else {
        car.speed -= Math.sign(car.speed) * 260 * dt;
        if (Math.abs(car.speed) < 12) car.speed = 0;
      }
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      // A slow car still steers, but a stopped car cannot rotate in place: the
      // turn fades with speed and is zero at a standstill.
      const grip = Math.abs(car.speed) < 5 ? 0 : Math.max(0.25, Math.min(1, Math.abs(car.speed) / 160));
      const turn = steer * CAR.turnRate * grip * (car.speed < 0 ? -1 : 1);
      car.angle += turn * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 20, WORLD.width - 20);
      car.y = clamp(car.y, 20, WORLD.height - 20);
      if (resolveBuildings(city, car, 22)) {
        if (Math.abs(car.speed) > 240) {
          car.speed *= -0.25;
          burst(car.x, car.y, '#ffb020', 8, 140, 4);
        } else {
          car.speed *= 0.4;
        }
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = Math.abs(car.speed);
      player.moving = Math.abs(car.speed) > 20;
      if (input.enter) enterExitCar();
      // Drive-by shooting: F fires from the window.
      if (input.shoot && player.shootCd <= 0 && state.ammo > 0) {
        player.shootCd = PLAYER.shootCooldown;
        state.ammo -= 1;
        const aim = input.aimWorld ? angleTo(car.x, car.y, input.aimWorld.x, input.aimWorld.y) : car.angle;
        fireBullet(car.x + Math.cos(aim) * 30, car.y + Math.sin(aim) * 30, aim, true);
      }
      if (forward !== 0 && Math.abs(car.speed) > 60 && random() < 0.25) {
        burst(car.x - Math.cos(car.angle) * 26, car.y - Math.sin(car.angle) * 26, '#888888', 1, 30, 3);
      }
    }
  }

  function punch() {
    let hitAny = false;
    for (const enemy of enemies) {
      if (dist(player.x, player.y, enemy.x, enemy.y) < PLAYER.punchRange + 14) {
        enemy.health -= PLAYER.punchDamage;
        enemy.x += Math.cos(player.angle) * 14;
        enemy.y += Math.sin(player.angle) * 14;
        burst(enemy.x, enemy.y, '#ffd23e', 6, 120, 4);
        hitAny = true;
      }
    }
    if (!hitAny) {
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (dist(player.x, player.y, ped.x, ped.y) < PLAYER.punchRange + 10) {
          ped.down = 2.5;
          ped.flee = 4;
          burst(ped.x, ped.y, '#e5534b', 6, 120, 4);
          addWanted(WANTED.hitPed, 0);
          hitAny = true;
        }
      }
    }
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      car.turnTimer -= dt;
      // Slow down for the car ahead on the same road.
      let ahead = Infinity;
      for (const other of cars) {
        if (other === car || other.kind === 'player') continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 110) {
          const ang = angleTo(car.x, car.y, other.x, other.y);
          let diff = Math.abs(ang - car.angle);
          if (diff > Math.PI) diff = TWO_PI - diff;
          if (diff < 0.7 && d < ahead) ahead = d;
        }
      }
      const target = ahead < 95 ? 0 : TRAFFIC.cruise + (car.cruiseJitter || 0);
      car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const nearCrossX = ROAD_XS.some((rx) => Math.abs(nx - rx) < 34);
      const nearCrossY = ROAD_YS.some((ry) => Math.abs(ny - ry) < 34);
      if (nearCrossX && nearCrossY && car.turnTimer <= 0 && random() < 0.012) {
        const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
        const turn = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.angle += turn;
        car.dir = car.angle;
        car.turnTimer = 4;
        // Snap onto the new road's lane.
        const lane = ROAD.width / 4;
        if (vertical) car.y = nearestRoadPoint(car.x, car.y).y + (Math.sin(car.angle) > 0 ? lane : -lane);
        else car.x = nearestRoadPoint(car.x, car.y).x + (Math.cos(car.angle) > 0 ? lane : -lane);
      }
      car.x = nx;
      car.y = ny;
      car.x = clamp(car.x, 60, WORLD.width - 60);
      car.y = clamp(car.y, 60, WORLD.height - 60);
      // A traffic car that drifted off its road (after a turn) is pulled back to it.
      if (!onRoad(car.x, car.y)) {
        const p = nearestRoadPoint(car.x, car.y);
        if (Math.abs(Math.cos(car.angle)) > 0.5) car.y += clamp(p.y - car.y, -90 * dt, 90 * dt);
        else car.x += clamp(p.x - car.x, -90 * dt, 90 * dt);
      }
      if (resolveBuildings(city, car, 22)) car.speed *= 0.5;
    }
  }

  function stepPolice(dt, events) {
    const want = Math.min(state.wanted, POLICE.maxCars);
    let have = 0;
    for (const car of cars) if (car.kind === 'police') have += 1;
    if (state.wanted > 0 && have < want && random() < 0.02) spawnPolice();
    for (const car of cars) {
      if (car.kind !== 'police') continue;
      car.siren += dt * 6;
      // Chase along the roads, corner by corner, toward the player. A patrol car
      // sheds speed for a sharp corner instead of swinging wide into a building.
      const wp = nextRoadPoint(car.x, car.y, player.x, player.y);
      const target = angleTo(car.x, car.y, wp.x, wp.y);
      car.angle = turnToward(car.angle, target, 2.4 * dt);
      const d = dist(car.x, car.y, player.x, player.y);
      let align = target - car.angle;
      while (align > Math.PI) align -= TWO_PI;
      while (align < -Math.PI) align += TWO_PI;
      const alignFactor = Math.abs(align) > 1.0 ? 0.35 : Math.abs(align) > 0.5 ? 0.6 : 1;
      const cruise = (d > 320 ? POLICE.cruise + 60 : POLICE.cruise) * alignFactor;
      car.speed += clamp(cruise - car.speed, -420 * dt, 380 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 20, WORLD.width - 20);
      car.y = clamp(car.y, 20, WORLD.height - 20);
      if (resolveBuildings(city, car, 22)) car.speed *= 0.5;
      // Ram the player: damage on foot, a shove in a car.
      if (d < 46) {
        const shove = angleTo(car.x, car.y, player.x, player.y);
        if (player.onFoot) {
          events = damagePlayer(POLICE.ramDamage, events);
          player.x += Math.cos(shove) * 26;
          player.y += Math.sin(shove) * 26;
          resolveBuildings(city, player, PLAYER.radius);
        } else if (player.car) {
          player.car.speed *= 0.82;
          if (player.invuln <= 0) {
            state.health -= 2;
            player.invuln = 0.6;
            if (state.health <= 0) {
              state.health = 0;
              state.dead = true;
              events |= EVENT_DEAD;
            }
          }
        }
      }
      // Standing next to a patrol car while wanted gets you busted.
      if (player.onFoot && d < POLICE.bustRange && Math.abs(player.speed) < 40) {
        state.bustTimer += dt;
        if (state.bustTimer > 1.2) {
          state.busted = true;
          state.stats.busted += 1;
          state.money = Math.max(0, state.money - 100);
          state.wanted = 0;
          state.bustTimer = 0;
          player.x = city.places.home.x;
          player.y = city.places.home.y;
          state.camera.x = player.x;
          state.camera.y = player.y;
          say('BUSTED! $100 bail. Back at Voss Garage.');
          events |= EVENT_BUSTED;
        }
      }
    }
    if (state.wanted === 0) {
      // The heat is off: patrol cars drive away and leave.
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        if (cars[i].kind !== 'police') continue;
        const car = cars[i];
        car.speed = POLICE.cruise;
        car.angle = turnToward(car.angle, angleTo(car.x, car.y, WORLD.width / 2, WORLD.height / 2), 1.5 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (dist(car.x, car.y, player.x, player.y) > 1100) cars.splice(i, 1);
      }
    }
    if (player.onFoot) state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    return events;
  }

  function stepPeds(dt, events) {
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      ped.timer -= dt;
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.state = 'flee';
      } else if (state.wanted >= 3 && dist(ped.x, ped.y, player.x, player.y) < 260) {
        ped.state = 'flee';
        ped.flee = 1.5;
      } else {
        ped.state = 'walk';
      }
      const speed = ped.state === 'flee' ? PEDS.fleeSpeed : ped.speed;
      if (ped.timer <= 0) {
        ped.timer = range(random, 2, 7);
        // Walk along a road or sidewalk; fleeing runs away from the player.
        if (ped.state === 'flee') ped.angle = angleTo(player.x, player.y, ped.x, ped.y) + range(random, -0.5, 0.5);
        else ped.angle = Math.floor(random() * 4) * (Math.PI / 2);
      }
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      ped.x = clamp(ped.x, 20, WORLD.width - 20);
      ped.y = clamp(ped.y, 20, WORLD.height - 20);
      if (!onSidewalk(ped.x, ped.y) && !onRoad(ped.x, ped.y) && ped.state === 'walk') {
        const p = nearestRoadPoint(ped.x, ped.y);
        ped.x += clamp(p.x - ped.x, -60 * dt, 60 * dt);
        ped.y += clamp(p.y - ped.y, -60 * dt, 60 * dt);
      }
      resolveBuildings(city, ped, 10);
      // The player's car running a pedestrian over is a crime.
      if (!player.onFoot && player.car && dist(ped.x, ped.y, player.x, player.y) < 34 && Math.abs(player.car.speed) > 60) {
        ped.down = 3;
        burst(ped.x, ped.y, '#e5534b', 10, 160, 4);
        events = addWanted(WANTED.hitPed, events);
        say('You hit a pedestrian! Wanted up.');
      }
    }
    return events;
  }

  function stepEnemies(dt, events) {
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const e = enemies[i];
      if (e.health <= 0) {
        burst(e.x, e.y, '#8e2f2f', 14, 180, 5);
        enemies.splice(i, 1);
        continue;
      }
      const d = dist(e.x, e.y, player.x, player.y);
      e.shootCd -= dt;
      if (d < COMBAT.enemyRange) {
        e.state = 'attack';
        e.angle = angleTo(e.x, e.y, player.x, player.y);
        if (d > 130) {
          e.x += Math.cos(e.angle) * e.speed * dt;
          e.y += Math.sin(e.angle) * e.speed * dt;
          resolveBuildings(city, e, 12);
        }
        if (e.shootCd <= 0) {
          e.shootCd = COMBAT.enemyShootCooldown + range(random, -0.3, 0.3);
          fireBullet(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20, e.angle + range(random, -0.12, 0.12), false);
          events |= EVENT_SHOT;
        }
      } else {
        e.state = 'guard';
      }
    }
    return events;
  }

  function stepBullets(dt, events) {
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || hitsBuilding(city, b.x, b.y, 2) || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) {
        if (b.life > 0) burst(b.x, b.y, '#ffd23e', 4, 90, 3);
        b.active = false;
        continue;
      }
      if (b.friendly) {
        for (let i = enemies.length - 1; i >= 0; i -= 1) {
          const e = enemies[i];
          if (dist(b.x, b.y, e.x, e.y) < 20) {
            e.health -= COMBAT.bulletDamage;
            burst(b.x, b.y, '#e5534b', 6, 130, 4);
            b.active = false;
            break;
          }
        }
        if (!b.active) continue;
        for (const ped of peds) {
          if (ped.down > 0) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.down = 3;
            burst(b.x, b.y, '#e5534b', 6, 130, 4);
            events = addWanted(WANTED.shoot, events);
            b.active = false;
            break;
          }
        }
      } else if (dist(b.x, b.y, player.x, player.y) < (player.onFoot ? 16 : 26)) {
        events = damagePlayer(COMBAT.bulletDamage, events);
        burst(b.x, b.y, '#e5534b', 6, 130, 4);
        b.active = false;
      }
    }
    return events;
  }

  function stepCarCollisions(dt, events) {
    // Player car vs traffic: a hard hit is a crime and slows both cars.
    if (!player.onFoot && player.car) {
      for (const car of cars) {
        if (car === player.car || car.kind === 'police') continue;
        if (dist(player.x, player.y, car.x, car.y) < 52 && Math.abs(player.car.speed) > 120) {
          car.speed = -car.speed * 0.3;
          player.car.speed *= 0.6;
          burst((player.x + car.x) / 2, (player.y + car.y) / 2, '#ffb020', 8, 140, 4);
          events = addWanted(WANTED.hitCar, events);
        }
      }
    }
    // Gentle separation so cars never overlap each other.
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0.1 && d < 48) {
          const push = (48 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          if (a.driver !== 'player') { a.x -= nx * push; a.y -= ny * push; }
          if (b.driver !== 'player') { b.x += nx * push; b.y += ny * push; }
        }
      }
    }
    return events;
  }

  function stepMissions(dt, events) {
    const stage = currentStage();
    if (!stage || state.won) return events;
    const place = city.places[stage.place];
    if (stage.timed) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.missionTimer = stage.timed;
        say('Too slow! The client is angry — heat is up.');
        events = addWanted(1, events);
      }
    }
    const d = place ? dist(player.x, player.y, place.x, place.y) : Infinity;
    if (stage.kind === 'goto') {
      if (d < 70) {
        events = completeStage(events);
        burst(player.x, player.y, '#39d353', 16, 180, 5);
      }
    } else if (stage.kind === 'steal') {
      // Completes the moment the player drives the mission coupe.
      if (player.car && player.car.missionCar) {
        events = completeStage(events);
      }
    } else if (stage.kind === 'escape') {
      if (state.wanted === 0 && d < 90) events = completeStage(events);
    } else if (stage.kind === 'fight') {
      if (enemies.length === 0) events = completeStage(events);
    }
    return events;
  }

  function stepPickups(dt) {
    for (const pk of pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
        continue;
      }
      if (dist(player.x, player.y, pk.x, pk.y) < 34) {
        pk.taken = true;
        pk.respawn = 25;
        if (pk.kind === 'health') {
          state.health = Math.min(PLAYER.health, state.health + 40);
          say('Health +40');
        } else {
          state.ammo += COMBAT.ammoPickup;
          say(`Ammo +${COMBAT.ammoPickup}`);
        }
        burst(pk.x, pk.y, '#39d353', 10, 140, 4);
      }
    }
  }

  function stepParticles(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
  }

  function stepWanted(dt) {
    if (state.wanted === 0) return;
    state.wantedTimer += dt;
    // One star fades every decayEvery seconds after the delay, while no cop is close.
    let nearCop = false;
    for (const car of cars) {
      if (car.kind === 'police' && dist(car.x, car.y, player.x, player.y) < 420) { nearCop = true; break; }
    }
    if (!nearCop && state.wantedTimer >= WANTED.decayDelay) {
      state.wantedTimer = 0;
      state.wanted = Math.max(0, state.wanted - 1);
      if (state.wanted === 0) say('You lost the heat. Lay low.');
    }
  }

  function stepCamera(dt) {
    const tx = clamp(player.x, VIEW.width / 2, WORLD.width - VIEW.width / 2);
    const ty = clamp(player.y, VIEW.height / 2, WORLD.height - VIEW.height / 2);
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
  }

  /** One fixed step. `input` carries the held keys and one-shot presses. */
  function step(dt, input) {
    let events = 0;
    if (state.dead || state.won) return events;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.health < PLAYER.health && state.wanted === 0) {
      state.health = Math.min(PLAYER.health, state.health + dt * 1.5);
    }
    stepPlayer(dt, input);
    stepTraffic(dt);
    events = stepPolice(dt, events);
    events = stepPeds(dt, events);
    events = stepEnemies(dt, events);
    events = stepBullets(dt, events);
    events = stepCarCollisions(dt, events);
    events = stepMissions(dt, events);
    stepPickups(dt);
    stepParticles(dt);
    stepWanted(dt);
    stepCamera(dt);
    return events;
  }

  reset();
  return {
    state, reset, step, enterExitCar, jumpToMission, nextRoadPoint,
    currentStage, currentPlace,
    addWanted, say,
  };
}
