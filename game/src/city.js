// Vireo Bay — the city itself: a coastal grid of avenues and streets, five
// districts, and everything the renderer draws. Generated once from a seed, so
// the same seed always builds the same city.
import { AVENUES, STREETS, ROAD_WIDTH, WORLD, PALETTE } from './config.js';

const BLOCK = 224;
const HALF_ROAD = ROAD_WIDTH / 2;

export function districtAt(x, y) {
  if (x < 160) return 'ocean';
  if (y > 2440) return 'marina';
  if (x < 640) return 'beach';
  if (y > 2240) return 'port';
  if (x >= 1280 && x < 2560 && y >= 320 && y < 1280) return 'downtown';
  if (x >= 2880) return 'suburbs';
  return 'midtown';
}

export function isWater(x, y) {
  return x < 160 || y > 2440;
}

export function isRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < HALF_ROAD) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < HALF_ROAD) return true;
  return false;
}

/** The nearest road centreline to a point, and how far away it is. */
export function nearestRoad(x, y) {
  let best = null;
  for (let i = 0; i < AVENUES.length; i += 1) {
    const d = Math.abs(x - AVENUES[i]);
    if (best === null || d < best.dist) best = { kind: 'v', index: i, center: AVENUES[i], dist: d };
  }
  for (let j = 0; j < STREETS.length; j += 1) {
    const d = Math.abs(y - STREETS[j]);
    if (d < best.dist) best = { kind: 'h', index: j, center: STREETS[j], dist: d };
  }
  return best;
}

export function streetName(x, y) {
  const road = nearestRoad(x, y);
  return road;
}

function blockBounds(i, j) {
  return {
    x0: AVENUES[i] + HALF_ROAD,
    y0: STREETS[j] + HALF_ROAD,
    x1: AVENUES[i + 1] - HALF_ROAD,
    y1: STREETS[j + 1] - HALF_ROAD,
  };
}

const NEON_SIGNS = ['VIREO', 'NEON', 'BAY HOTEL', '24H TACOS', 'CASINO', 'PALMS', 'SUNSET', 'MARINA'];

/** Build the whole city from the seed: buildings, parks, palms, boats, docks. */
export function createCity(random) {
  const buildings = [];
  const parks = [];
  const palms = [];
  const trees = [];
  const umbrellas = [];
  const boats = [];
  const docks = [];
  const containers = [];

  // Four park blocks, picked by seed, spread across the map.
  const parkKeys = new Set();
  while (parkKeys.size < 4) {
    parkKeys.add(`${random.int(2, 9)}:${random.int(1, 5)}`);
  }

  for (let i = 0; i < AVENUES.length - 1; i += 1) {
    for (let j = 0; j < STREETS.length - 1; j += 1) {
      const b = blockBounds(i, j);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      const district = districtAt(cx, cy);
      if (district === 'ocean' || district === 'marina') continue;

      if (parkKeys.has(`${i}:${j}`)) {
        parks.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: random.range(b.x0 + 20, b.x1 - 20), y: random.range(b.y0 + 20, b.y1 - 20), r: random.range(14, 24) });
        }
        continue;
      }

      if (district === 'beach') {
        // Boardwalk shops along the east edge of the beach, palms and umbrellas west.
        buildings.push({
          x: b.x1 - 58, y: b.y0 + 18, w: 46, h: 60, hgt: 1,
          roof: random.int(0, 5), sign: random.chance(0.6) ? random.pick(['TACOS', 'SURF', 'BAR']) : null,
          kind: 'shop',
        });
        for (let p = 0; p < 3; p += 1) {
          palms.push({ x: random.range(b.x0 + 24, b.x0 + 120), y: random.range(b.y0 + 24, b.y1 - 24) });
        }
        for (let u = 0; u < 2; u += 1) {
          umbrellas.push({ x: random.range(b.x0 + 30, b.x0 + 150), y: random.range(b.y0 + 30, b.y1 - 30), color: random.pick(PALETTE.neon) });
        }
        continue;
      }

      if (district === 'port') {
        for (let c = 0; c < 4; c += 1) {
          containers.push({
            x: random.range(b.x0 + 10, b.x1 - 70), y: random.range(b.y0 + 10, b.y1 - 30),
            w: random.range(48, 64), h: 22, color: random.pick(['#c0392b', '#2980b9', '#27ae60', '#f39c12']),
          });
        }
        continue;
      }

      if (district === 'downtown') {
        const tower = {
          x: b.x0 + 26, y: b.y0 + 26, w: 172, h: 172, hgt: random.int(2, 3),
          roof: random.int(0, 5), sign: random.chance(0.55) ? random.pick(NEON_SIGNS) : null,
          kind: 'tower',
        };
        buildings.push(tower);
        continue;
      }

      if (district === 'suburbs') {
        for (let h = 0; h < 2; h += 1) {
          buildings.push({
            x: b.x0 + 20 + h * 104, y: b.y0 + 30 + random.range(-8, 60), w: 78, h: 64, hgt: 1,
            roof: random.int(0, 5), sign: null, kind: 'house',
          });
        }
        for (let t = 0; t < 3; t += 1) {
          trees.push({ x: random.range(b.x0 + 16, b.x1 - 16), y: random.range(b.y0 + 16, b.y1 - 16), r: random.range(12, 20) });
        }
        continue;
      }

      // Midtown: a shop and an office block.
      buildings.push({
        x: b.x0 + 16, y: b.y0 + 20, w: 96, h: 74, hgt: 1,
        roof: random.int(0, 5), sign: random.chance(0.4) ? random.pick(['DINER', 'MOTEL', 'GYM']) : null,
        kind: 'shop',
      });
      buildings.push({
        x: b.x0 + 118, y: b.y0 + 96, w: 88, h: 104, hgt: 2,
        roof: random.int(0, 5), sign: null, kind: 'office',
      });
      for (let t = 0; t < 2; t += 1) {
        trees.push({ x: random.range(b.x0 + 16, b.x1 - 16), y: random.range(b.y0 + 16, b.y1 - 16), r: random.range(11, 17) });
      }
    }
  }

  // Marina docks reaching into the water, with boats moored beside them.
  for (let d = 0; d < 4; d += 1) {
    const x = 560 + d * 620;
    docks.push({ x, y: 2400, w: 26, h: 130 });
    for (let s = 0; s < 2; s += 1) {
      boats.push({ x: x + (s === 0 ? -34 : 34), y: 2470 + random.range(0, 60), angle: random.range(-0.2, 0.2), color: random.pick(['#ecf0f1', '#e74c3c', '#3498db']) });
    }
  }
  // Ocean boats further out, drifting.
  for (let s = 0; s < 5; s += 1) {
    boats.push({ x: random.range(30, 130), y: random.range(200, 2300), angle: random.range(-0.4, 0.4), color: random.pick(['#ecf0f1', '#f1c40f', '#1abc9c']) });
  }
  // Palms lining the beach road.
  for (let y = 220; y < 2400; y += 180) {
    palms.push({ x: 210 + random.range(-14, 14), y });
  }

  return { buildings, parks, palms, trees, umbrellas, boats, docks, containers };
}

/** True when a circle of radius r at (x, y) touches a building or water. */
export function blockedAt(city, x, y, r) {
  if (isWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  }
  return false;
}

/** Push a circle out of buildings and water; returns the corrected position. */
export function resolveCircle(city, x, y, r) {
  if (x < 160 + r) x = 160 + r;
  if (y > 2440 - r) y = 2440 - r;
  if (x > WORLD.width - r) x = WORLD.width - r;
  if (y > WORLD.height - r) y = WORLD.height - r;
  if (x < r) x = r;
  if (y < r) y = r;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.001) {
        // Dead centre: push out along the smallest penetration axis.
        const left = x - (b.x - r);
        const right = (b.x + b.w + r) - x;
        const top = y - (b.y - r);
        const bottom = (b.y + b.h + r) - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      } else {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      }
    }
  }
  return { x, y };
}

/** A random point on a road (used for traffic and pedestrian spawns). */
export function randomRoadPoint(random) {
  if (random.chance(0.5)) {
    const ax = random.pick(AVENUES);
    return { x: ax + random.range(-24, 24), y: random.range(160, 2400) };
  }
  const sy = random.pick(STREETS);
  return { x: random.range(160, 3680), y: sy + random.range(-24, 24) };
}
