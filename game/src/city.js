// The city of Vireo Bay: a road grid of blocks, each block a district with
// its own buildings and props. Built once from a seed so the same seed always
// draws the same city. No other module lays out the map.
import {
  BLOCK_W, BLOCK_H, ROAD_W, COLS, ROWS, WORLD_W, WORLD_H,
  STREETS_X, STREETS_Y, NEON_SIGNS, PALETTE,
} from './config.js';
import { mulberry32, pick, intBetween, floatBetween, shuffled } from './random.js';

// Centre of vertical road c (0..COLS) and horizontal road r (0..ROWS).
export function roadX(c) {
  return ROAD_W / 2 + c * (BLOCK_W + ROAD_W);
}
export function roadY(r) {
  return ROAD_W / 2 + r * (BLOCK_H + ROAD_W);
}

// Is a point on a road (with a small margin onto the sidewalk)?
export function onRoad(x, y) {
  const half = ROAD_W / 2 + 4;
  for (let c = 0; c <= COLS; c++) {
    if (Math.abs(x - roadX(c)) < half) return true;
  }
  for (let r = 0; r <= ROWS; r++) {
    if (Math.abs(y - roadY(r)) < half) return true;
  }
  return false;
}

// The nearest point on the road grid to (x, y).
export function snapToRoad(x, y) {
  let bestX = roadX(0);
  let bestD = Infinity;
  for (let c = 0; c <= COLS; c++) {
    const d = Math.abs(x - roadX(c));
    if (d < bestD) { bestD = d; bestX = roadX(c); }
  }
  let bestY = roadY(0);
  bestD = Infinity;
  for (let r = 0; r <= ROWS; r++) {
    const d = Math.abs(y - roadY(r));
    if (d < bestD) { bestD = d; bestY = roadY(r); }
  }
  return { x: bestX, y: bestY };
}

// Which block contains a point, or null on a road.
export function blockAt(x, y) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const x0 = roadX(c) + ROAD_W / 2;
      const x1 = roadX(c + 1) - ROAD_W / 2;
      const y0 = roadY(r) + ROAD_W / 2;
      const y1 = roadY(r + 1) - ROAD_W / 2;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return { c, r, x0, y0, x1, y1 };
    }
  }
  return null;
}

// Street name under a point, for the HUD pill.
export function streetAt(x, y) {
  let cx = 0;
  let cd = Infinity;
  for (let c = 0; c <= COLS; c++) {
    const d = Math.abs(x - roadX(c));
    if (d < cd) { cd = d; cx = c; }
  }
  let ry = 0;
  let rd = Infinity;
  for (let r = 0; r <= ROWS; r++) {
    const d = Math.abs(y - roadY(r));
    if (d < rd) { rd = d; ry = r; }
  }
  if (cd < rd) return STREETS_X[Math.min(cx, STREETS_X.length - 1)];
  return STREETS_Y[Math.min(ry, STREETS_Y.length - 1)];
}

// District kinds, fixed by position so the named places never move.
function districtAt(c, r) {
  if (c === 0 && r <= 1) return 'beach';
  if (c === 1 && r === 0) return 'marina';
  if (c >= 4 && r >= 3) return 'port';
  if (c === 2 && r === 1) return 'plaza';
  if (c === 1 && r === 2) return 'park';
  if (c >= 2 && c <= 3 && r <= 1) return 'downtown';
  if (r >= 3) return 'docks';
  return 'shops';
}

const ROOF_COLORS = ['#b5673f', '#7d8aa0', '#a08a6d', '#8f6f7d', '#5f7d6a', '#c08a4a', '#6a6a8f'];
const WALL_COLORS = ['#c98a5a', '#8a9ab0', '#b09a7a', '#9a7a8a', '#7a9a7a', '#d0a060', '#7a7aa0'];

export function buildCity(seed) {
  const rnd = mulberry32(seed);
  const blocks = [];
  const buildings = [];
  const props = [];
  const places = {
    hideout: { name: 'Hideout', x: 0, y: 0 },
    plaza: { name: 'Sol Plaza', x: 0, y: 0 },
    docks: { name: 'Harbor Docks', x: 0, y: 0 },
    marina: { name: 'Marina', x: 0, y: 0 },
    beach: { name: 'Palmetto Beach', x: 0, y: 0 },
  };

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const x0 = roadX(c) + ROAD_W / 2;
      const y0 = roadY(r) + ROAD_W / 2;
      const x1 = roadX(c + 1) - ROAD_W / 2;
      const y1 = roadY(r + 1) - ROAD_W / 2;
      const kind = districtAt(c, r);
      const block = { c, r, x0, y0, x1, y1, kind };
      blocks.push(block);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;

      if (kind === 'beach') {
        // Sand with a strip of water on the west edge, palms and umbrellas.
        props.push({ type: 'water', x: x0 - 6, y: y0, w: 44, h: y1 - y0 });
        const n = intBetween(rnd, 4, 6);
        for (let i = 0; i < n; i++) {
          const px = floatBetween(rnd, x0 + 40, x1 - 30);
          const py = floatBetween(rnd, y0 + 30, y1 - 30);
          props.push({ type: 'palm', x: px, y: py, s: floatBetween(rnd, 0.9, 1.3) });
        }
        for (let i = 0; i < 3; i++) {
          props.push({
            type: 'umbrella',
            x: floatBetween(rnd, x0 + 60, x1 - 50),
            y: floatBetween(rnd, y0 + 40, y1 - 40),
            color: pick(rnd, ['#ff5a7a', '#ffd23f', '#3fa7ff', '#ff8a3d']),
          });
        }
        if (c === 0 && r === 0) { places.beach.x = cx; places.beach.y = cy; }
        continue;
      }
      if (kind === 'marina') {
        // Water basin with moored boats and a wooden pier.
        props.push({ type: 'water', x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        props.push({ type: 'pier', x: x0 + 30, y: y0 + 20, w: 14, h: y1 - y0 - 40 });
        const n = intBetween(rnd, 3, 5);
        for (let i = 0; i < n; i++) {
          props.push({
            type: 'boat',
            x: floatBetween(rnd, x0 + 70, x1 - 50),
            y: floatBetween(rnd, y0 + 30, y1 - 30),
            angle: floatBetween(rnd, -0.4, 0.4),
            color: pick(rnd, ['#f2f2f2', '#ffd23f', '#ff5a7a', '#7ad0ff']),
          });
        }
        if (c === 1 && r === 0) { places.marina.x = cx; places.marina.y = cy; }
        continue;
      }
      if (kind === 'port' || kind === 'docks') {
        // Container yard: stacked boxes, cranes and a warehouse.
        const n = intBetween(rnd, 5, 8);
        for (let i = 0; i < n; i++) {
          props.push({
            type: 'container',
            x: floatBetween(rnd, x0 + 20, x1 - 60),
            y: floatBetween(rnd, y0 + 20, y1 - 30),
            w: intBetween(rnd, 40, 70),
            h: 22,
            color: pick(rnd, ['#d05a3a', '#3a7ad0', '#e0a030', '#4a9a5a', '#8a5ad0']),
          });
        }
        buildings.push({
          x: x0 + 30, y: y0 + 30, w: x1 - x0 - 60, h: 70,
          roof: '#7a6a5a', wall: '#8a7a6a', panels: 4, ac: 2,
          sign: null, helipad: false, district: kind,
        });
        if (kind === 'docks' && c === 4 && r === 4) { places.docks.x = cx; places.docks.y = cy; }
        continue;
      }
      if (kind === 'plaza') {
        // Open plaza with a fountain and benches.
        props.push({ type: 'fountain', x: cx, y: cy, r: 34 });
        for (let i = 0; i < 4; i++) {
          props.push({ type: 'bench', x: cx + (i % 2 === 0 ? -70 : 70), y: cy + (i < 2 ? -60 : 60) });
        }
        for (let i = 0; i < 3; i++) {
          props.push({ type: 'palm', x: floatBetween(rnd, x0 + 30, x1 - 30), y: floatBetween(rnd, y0 + 30, y1 - 30), s: 1 });
        }
        places.plaza.x = cx; places.plaza.y = cy;
        continue;
      }
      if (kind === 'park') {
        // Grass, pond, trees and a footpath.
        props.push({ type: 'pond', x: cx, y: cy, r: 42 });
        const n = intBetween(rnd, 5, 8);
        for (let i = 0; i < n; i++) {
          props.push({ type: 'tree', x: floatBetween(rnd, x0 + 25, x1 - 25), y: floatBetween(rnd, y0 + 25, y1 - 25), s: floatBetween(rnd, 0.8, 1.4) });
        }
        continue;
      }
      // downtown / shops / residential: one or two buildings per block.
      const tall = kind === 'downtown';
      const bw = (x1 - x0) * (tall ? 0.72 : 0.58);
      const bh = (y1 - y0) * (tall ? 0.74 : 0.6);
      const bx = x0 + (x1 - x0 - bw) / 2 + floatBetween(rnd, -14, 14);
      const by = y0 + (y1 - y0 - bh) / 2 + floatBetween(rnd, -10, 10);
      const sign = rnd() < (tall ? 0.55 : 0.3) ? pick(rnd, NEON_SIGNS) : null;
      buildings.push({
        x: bx, y: by, w: bw, h: bh,
        roof: pick(rnd, ROOF_COLORS), wall: pick(rnd, WALL_COLORS),
        panels: tall ? 6 : 4, ac: intBetween(rnd, 1, 4),
        sign, helipad: tall && c === 3 && r === 0, district: kind,
      });
      if (rnd() < 0.5) {
        buildings.push({
          x: x0 + 18, y: y1 - 62, w: 90, h: 44,
          roof: pick(rnd, ROOF_COLORS), wall: pick(rnd, WALL_COLORS),
          panels: 3, ac: 1, sign: null, helipad: false, district: kind,
        });
      }
      const nt = intBetween(rnd, 1, 3);
      for (let i = 0; i < nt; i++) {
        props.push({ type: 'tree', x: floatBetween(rnd, x0 + 20, x1 - 20), y: floatBetween(rnd, y0 + 20, y1 - 20), s: floatBetween(rnd, 0.8, 1.2) });
      }
    }
  }

  // The Hideout sits in the far south-east block, a low safehouse.
  const hb = blocks.find((b) => b.c === 5 && b.r === 2);
  places.hideout.x = (hb.x0 + hb.x1) / 2;
  places.hideout.y = (hb.y0 + hb.y1) / 2;
  props.push({ type: 'hideout', x: places.hideout.x, y: places.hideout.y });

  // Street lamps along every road.
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      props.push({ type: 'lamp', x: roadX(c) + ROAD_W / 2 - 6, y: roadY(r) + (BLOCK_H + ROAD_W) / 2 });
    }
  }

  return {
    blocks, buildings, props, places,
    w: WORLD_W, h: WORLD_H,
    palette: PALETTE,
  };
}
