// The city of Vireo Bay: a road grid, the buildings inside each block, the park, the
// beach along the south shore and the docks on the west edge. Generation is seeded, so
// the same seed always builds the same city. Collision is a list of solid rectangles;
// anything that needs "is this point on a road?" asks the helpers here.

import { PALETTE, ROAD, WORLD } from './config.js';
import { pick, range } from './random.js';

export const ROAD_XS = [];
export const ROAD_YS = [];
for (let x = ROAD.first; x < WORLD.width; x += ROAD.spacing) ROAD_XS.push(x);
for (let y = ROAD.first; y < WORLD.height; y += ROAD.spacing) ROAD_YS.push(y);

const HALF = ROAD.width / 2;

/** True when the point is on a road (within the road's width of a grid line). */
export function onRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= HALF) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= HALF) return true;
  return false;
}

/** The nearest point on the road grid to (x, y). */
export function nearestRoadPoint(x, y) {
  let bx = ROAD_XS[0];
  let by = ROAD_YS[0];
  for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(bx - x)) bx = rx;
  for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(by - y)) by = ry;
  return { x: bx, y: by };
}

/** True when the point is on a sidewalk (the strip just outside a road). */
export function onSidewalk(x, y) {
  for (const rx of ROAD_XS) {
    const d = Math.abs(x - rx);
    if (d > HALF && d <= HALF + 22) return true;
  }
  for (const ry of ROAD_YS) {
    const d = Math.abs(y - ry);
    if (d > HALF && d <= HALF + 22) return true;
  }
  return false;
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const plazas = [];

  // The beach is the strip along the south shore; the water starts below it.
  const beach = { x: 0, y: WORLD.height - 200, width: WORLD.width, height: 110 };
  const water = { x: 0, y: WORLD.height - 90, width: WORLD.width, height: 90 };

  // The docks: a pier strip on the west edge, north of the beach.
  const docks = { x: 0, y: ROAD_YS[2] - 60, width: 190, height: 420 };

  // One block in five is a park or a plaza instead of buildings.
  for (let bx = 0; bx < ROAD_XS.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_YS.length - 1; by += 1) {
      const x0 = ROAD_XS[bx] + HALF + 14;
      const y0 = ROAD_YS[by] + HALF + 14;
      const x1 = ROAD_XS[bx + 1] - HALF - 14;
      const y1 = ROAD_YS[by + 1] - HALF - 14;
      // Keep the docks block and the beach blocks clear of buildings.
      if (x0 < docks.width + 40 && y0 > docks.y - 80 && y0 < docks.y + docks.height + 80) continue;
      if (y1 > beach.y - 20) continue;
      const roll = random();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
        continue;
      }
      if (roll < 0.24) {
        plazas.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
        continue;
      }
      // One or two buildings per block, each with a roof colour and a height for shade.
      const split = random() < 0.5;
      if (split) {
        const cut = x0 + (x1 - x0) * range(random, 0.4, 0.6);
        buildings.push(makeBuilding(random, x0 + 8, y0 + 8, cut - x0 - 16, y1 - y0 - 16));
        buildings.push(makeBuilding(random, cut + 8, y0 + 8, x1 - cut - 16, y1 - y0 - 16));
      } else {
        buildings.push(makeBuilding(random, x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16));
      }
    }
  }

  function makeBuilding(rnd, x, y, w, h) {
    return {
      x, y, width: w, height: h,
      color: pick(rnd, PALETTE.buildingRoof),
      shade: 0.55 + rnd() * 0.3,
    };
  }

  // Named places the missions and the HUD point at. All coordinates sit on roads or
  // open ground, never inside a building.
  const places = {
    home: { x: ROAD_XS[3], y: ROAD_YS[4], label: 'Voss Garage' },
    docks: { x: 120, y: docks.y + docks.height / 2, label: 'Harbor Docks' },
    cafe: { x: ROAD_XS[5], y: ROAD_YS[1], label: 'Cafe Lumen' },
    market: { x: ROAD_XS[1], y: ROAD_YS[3], label: 'Bay Market' },
    hideout: { x: ROAD_XS[6], y: ROAD_YS[5], label: 'Hideout' },
    plaza: { x: ROAD_XS[4], y: ROAD_YS[2], label: 'Sol Plaza' },
    beach: { x: ROAD_XS[2], y: beach.y + 55, label: 'South Beach' },
  };

  return { buildings, parks, plazas, beach, water, docks, places };
}

/** True when the circle at (x, y) with radius r overlaps any solid building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.width && y + r > b.y && y - r < b.y + b.height) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns true when it was pushed. */
export function resolveBuildings(city, body, r) {
  let pushed = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.width));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.height));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    pushed = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
    } else if (body.x < b.x + b.width / 2) {
      body.x = b.x - r;
    } else {
      body.x = b.x + b.width + r;
    }
  }
  return pushed;
}
