// The city of Vireo Bay: a road grid, the buildings inside each block, the park, the
// beach along the south shore and the docks on the west edge. Generation is seeded, so
// the same seed always builds the same city. Collision is a list of solid rectangles;
// anything that needs "is this point on a road?" asks the helpers here.
// Round 6: re-written live under the recording; no generation change.

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
    // Round 3: seeded roof detail — AC units, vents, a skylight, and on some
    // roofs a garden, a pool, or (on the biggest blocks) a helipad. All of it
    // is fixed at generation time, so the same seed draws the same roofs.
    const roof = [];
    const big = w > 200 && h > 200;
    const nAc = Math.floor(rnd() * 3);
    for (let i = 0; i < nAc; i += 1) {
      roof.push({ kind: 'ac', x: x + 16 + rnd() * Math.max(10, w - 44), y: y + 16 + rnd() * Math.max(10, h - 44), s: 12 + rnd() * 6 });
    }
    const nVent = Math.floor(rnd() * 3);
    for (let i = 0; i < nVent; i += 1) {
      roof.push({ kind: 'vent', x: x + 16 + rnd() * Math.max(10, w - 44), y: y + 16 + rnd() * Math.max(10, h - 44), s: 6 + rnd() * 4 });
    }
    if (rnd() < 0.6) {
      roof.push({ kind: 'sky', x: x + w * 0.3, y: y + h * 0.3, w: w * 0.4, h: h * 0.3 });
    }
    const roll = rnd();
    if (big && roll < 0.14) {
      roof.push({ kind: 'heli', x: x + w / 2, y: y + h / 2, r: Math.min(w, h) * 0.28 });
    } else if (roll < 0.3) {
      roof.push({ kind: 'garden', x: x + w * 0.18, y: y + h * 0.18, w: w * 0.64, h: h * 0.64 });
    } else if (roll < 0.42) {
      roof.push({ kind: 'pool', x: x + w * 0.25, y: y + h * 0.28, w: w * 0.5, h: h * 0.36 });
    }
    return {
      x, y, width: w, height: h,
      color: pick(rnd, PALETTE.buildingRoof),
      shade: 0.55 + rnd() * 0.3,
      roof,
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

  // Round 3: street furniture and shore props, all precomputed here from the
  // seeded RNG so the renderer only draws them. Trees sit on sidewalks (never
  // on a road, inside a building, or blocking an intersection); lamps stand at
  // intersection corners; the beach gets umbrellas, towels, palms and sand
  // speckle; the docks get stacked containers and boats in the south water.
  const trees = [];
  const lamps = [];
  const inRect = (x, y, r, m) => x > r.x - m && x < r.x + r.width + m && y > r.y - m && y < r.y + r.height + m;
  const clearOfBuildings = (x, y, m) => {
    for (const b of buildings) if (inRect(x, y, b, m)) return false;
    return true;
  };
  const nearCrossing = (x, y, d) => {
    for (const rx of ROAD_XS) for (const ry of ROAD_YS) {
      if (Math.abs(x - rx) < d && Math.abs(y - ry) < d) return true;
    }
    return false;
  };
  for (const rx of ROAD_XS) {
    for (let y = 140; y < WORLD.height - 140; y += 170) {
      for (const side of [-1, 1]) {
        const tx = rx + side * (HALF + 11);
        const ty = y + range(random, -40, 40);
        if (ty > beach.y - 30) continue;
        if (nearCrossing(tx, ty, 110)) continue;
        if (!clearOfBuildings(tx, ty, 16)) continue;
        if (random() < 0.45) continue;
        trees.push({ x: tx, y: ty, r: 13 + random() * 8, palm: false });
      }
    }
  }
  for (const ry of ROAD_YS) {
    for (let x = 140; x < WORLD.width - 140; x += 170) {
      for (const side of [-1, 1]) {
        const tx = x + range(random, -40, 40);
        const ty = ry + side * (HALF + 11);
        if (ty > beach.y - 30) continue;
        if (nearCrossing(tx, ty, 110)) continue;
        if (!clearOfBuildings(tx, ty, 16)) continue;
        if (random() < 0.45) continue;
        trees.push({ x: tx, y: ty, r: 13 + random() * 8, palm: false });
      }
    }
  }
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      if (ry > beach.y - 40) continue;
      lamps.push({ x: rx + HALF + 8, y: ry - HALF - 8 });
      lamps.push({ x: rx - HALF - 8, y: ry + HALF + 8 });
    }
  }
  const beachProps = { umbrellas: [], towels: [], palms: [], sand: [] };
  for (let i = 0; i < 16; i += 1) {
    beachProps.umbrellas.push({
      x: 80 + random() * (WORLD.width - 160),
      y: beach.y + 14 + random() * 46,
      color: pick(random, ['#e8452c', '#2f7fb8', '#ffd23e', '#c27ba0', '#39d353']),
    });
  }
  for (let i = 0; i < 12; i += 1) {
    beachProps.towels.push({
      x: 80 + random() * (WORLD.width - 160),
      y: beach.y + 12 + random() * 56,
      color: pick(random, ['#ff8fa3', '#7fb3d5', '#ffd23e', '#8bc34a']),
      angle: (random() - 0.5) * 0.6,
    });
  }
  for (let i = 0; i < 9; i += 1) {
    beachProps.palms.push({ x: 120 + random() * (WORLD.width - 240), y: beach.y + 16 + random() * 30 });
  }
  for (let i = 0; i < 140; i += 1) {
    beachProps.sand.push({ x: random() * WORLD.width, y: beach.y + random() * beach.height, r: 1 + random() * 2 });
  }
  const containers = [];
  const containerColors = ['#e8452c', '#2f7fb8', '#f0a35e', '#39d353', '#c27ba0', '#ffd23e'];
  for (let row = 0; row < 4; row += 1) {
    const cy = docks.y + 30 + row * 96;
    const stack = 1 + Math.floor(random() * 2);
    for (let s = 0; s < stack; s += 1) {
      containers.push({
        x: docks.x + 22 + random() * 30, y: cy - s * 30, w: 96 + random() * 40, h: 26,
        color: pick(random, containerColors),
      });
    }
  }
  const boats = [];
  for (let i = 0; i < 5; i += 1) {
    boats.push({
      x: 260 + i * 620 + random() * 120, y: water.y + 34 + random() * 36,
      angle: (random() - 0.5) * 0.5, color: pick(random, ['#f2f4f6', '#ffd23e', '#e8452c']),
    });
  }
  // Parks: a pond and a footpath in most, plus trees at seeded spots with
  // varied sizes instead of a fixed grid.
  const parkDetails = parks.map((park) => {
    const parkTrees = [];
    const n = Math.max(3, Math.floor((park.width * park.height) / 26000));
    for (let i = 0; i < n; i += 1) {
      parkTrees.push({
        x: park.x + 30 + random() * Math.max(10, park.width - 60),
        y: park.y + 30 + random() * Math.max(10, park.height - 60),
        r: 14 + random() * 12,
      });
    }
    return {
      pond: random() < 0.6
        ? { x: park.x + park.width * (0.3 + random() * 0.3), y: park.y + park.height * (0.3 + random() * 0.3), rx: 34 + random() * 22, ry: 24 + random() * 16 }
        : null,
      path: random() < 0.5,
      trees: parkTrees,
    };
  });
  const fountains = plazas.map((plaza) => ({
    x: plaza.x + plaza.width / 2, y: plaza.y + plaza.height / 2,
    r: Math.min(plaza.width, plaza.height) * 0.2,
  }));

  return { buildings, parks, plazas, beach, water, docks, places, trees, lamps, beachProps, containers, boats, parkDetails, fountains };
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
