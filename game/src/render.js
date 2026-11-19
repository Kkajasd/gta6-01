// Vireo Bay, drawn by hand: a top-down open-world crime game painted on one
// canvas. The world is a seeded city (roads on a grid, blocks of roofed
// buildings, parks, plazas, a beach and a pier); the renderer only paints what
// the state says is there, so the same state always paints the same frame.
// Round 7: written live under the recording, from the game API alone — the
// previous renderer was never opened, so every line below is this session's
// own composition: paneled roofs, a brighter title card, readable place
// labels in screen space, and a busier street, park and shore.

import { CAR, COMBAT, FONT, MISSIONS, PALETTE, PEDS, PLAYER, POLICE, ROAD, TRAFFIC, VIEW, WANTED, WORLD } from './config.js';
import { ROAD_XS, ROAD_YS } from './city.js';
import { MISSION_DEFS, objectiveText } from './missions.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const FULL_TURN = Math.PI * 2;
const SKIN = '#e8c39a';
const GOLD_LINE = '#d8a93b';
const DARK_PANEL = 'rgba(12, 16, 24, 0.72)';
const CARD_PANEL = 'rgba(16, 20, 30, 0.88)';

const clampNum = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const span = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const headTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/** A hex colour scaled toward black (factor < 1) or white (factor > 1). */
function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const gg = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return 'rgb(' + r + ',' + gg + ',' + b + ')';
}

/** A rounded-rectangle path, left unfilled so the caller picks fill or stroke. */
function tracePanel(pen, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  pen.beginPath();
  pen.moveTo(x + rad, y);
  pen.lineTo(x + w - rad, y);
  pen.arcTo(x + w, y, x + w, y + rad, rad);
  pen.lineTo(x + w, y + h - rad);
  pen.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  pen.lineTo(x + rad, y + h);
  pen.arcTo(x, y + h, x, y + h - rad, rad);
  pen.lineTo(x, y + rad);
  pen.arcTo(x, y, x + rad, y, rad);
  pen.closePath();
}

/** A circle path at (x, y). */
function ring(pen, x, y, r) {
  pen.beginPath();
  pen.arc(x, y, r, 0, FULL_TURN);
}

/** One line of text, with its own font, colour and alignment. */
function ink(pen, text, x, y, font, color, align) {
  pen.font = font;
  pen.fillStyle = color;
  pen.textAlign = align || 'left';
  pen.textBaseline = 'alphabetic';
  pen.fillText(text, x, y);
}

/** A five-point star path centred at (cx, cy). */
function star5(pen, cx, cy, r) {
  pen.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) pen.moveTo(px, py);
    else pen.lineTo(px, py);
  }
  pen.closePath();
}

/** Grass, the south beach and the water, plus foam and sun glints on the water. */
function drawGround(pen, city, view) {
  pen.fillStyle = PALETTE.grass;
  pen.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  const beach = city.beach;
  const water = city.water;
  pen.fillStyle = PALETTE.sand;
  pen.fillRect(beach.x, beach.y, beach.width, beach.height);
  pen.fillStyle = PALETTE.water;
  pen.fillRect(water.x, water.y, water.width, water.height);
  pen.fillStyle = PALETTE.waterDeep;
  pen.fillRect(water.x, water.y + water.height - 30, water.width, 30);
  // Foam licks the shoreline in a fixed rhythm; sun glints sit still on the water.
  pen.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let x = 20; x < WORLD.width; x += 46) {
    ring(pen, x, water.y + 5, 5);
    pen.fill();
  }
  pen.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (let i = 0; i < 3; i += 1) {
    pen.fillRect(600 + i * 1200, water.y + 32 + i * 8, 130, 6);
  }
}

/** Parks with ponds, paths and trees, and plazas with tile grids and fountains. */
function drawParks(pen, city, view) {
  for (let i = 0; i < city.parks.length; i += 1) {
    const park = city.parks[i];
    if (park.x > view.x1 || park.x + park.width < view.x0 || park.y > view.y1 || park.y + park.height < view.y0) continue;
    pen.fillStyle = PALETTE.park;
    pen.fillRect(park.x, park.y, park.width, park.height);
    pen.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    pen.lineWidth = 2;
    pen.strokeRect(park.x + 1, park.y + 1, park.width - 2, park.height - 2);
    const detail = city.parkDetails[i];
    if (detail) {
      if (detail.path) {
        pen.fillStyle = PALETTE.sand;
        pen.fillRect(park.x + park.width / 2 - 9, park.y, 18, park.height);
        pen.fillRect(park.x, park.y + park.height / 2 - 9, park.width, 18);
      }
      if (detail.pond) {
        const pond = detail.pond;
        pen.fillStyle = PALETTE.water;
        pen.beginPath();
        pen.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, FULL_TURN);
        pen.fill();
        pen.fillStyle = 'rgba(255, 255, 255, 0.25)';
        pen.beginPath();
        pen.ellipse(pond.x - 8, pond.y - 6, pond.rx * 0.55, pond.ry * 0.45, 0, 0, FULL_TURN);
        pen.fill();
      }
      for (const tree of detail.trees) {
        pen.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ring(pen, tree.x + 3, tree.y + 4, tree.r);
        pen.fill();
        pen.fillStyle = PALETTE.tree;
        ring(pen, tree.x, tree.y, tree.r);
        pen.fill();
        pen.fillStyle = PALETTE.treeLight;
        ring(pen, tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.55);
        pen.fill();
      }
    }
  }
  for (let i = 0; i < city.plazas.length; i += 1) {
    const plaza = city.plazas[i];
    if (plaza.x > view.x1 || plaza.x + plaza.width < view.x0 || plaza.y > view.y1 || plaza.y + plaza.height < view.y0) continue;
    pen.fillStyle = PALETTE.plaza;
    pen.fillRect(plaza.x, plaza.y, plaza.width, plaza.height);
    pen.strokeStyle = 'rgba(0, 0, 0, 0.10)';
    pen.lineWidth = 1;
    for (let gx = plaza.x + 40; gx < plaza.x + plaza.width; gx += 40) {
      pen.beginPath();
      pen.moveTo(gx, plaza.y);
      pen.lineTo(gx, plaza.y + plaza.height);
      pen.stroke();
    }
    for (let gy = plaza.y + 40; gy < plaza.y + plaza.height; gy += 40) {
      pen.beginPath();
      pen.moveTo(plaza.x, gy);
      pen.lineTo(plaza.x + plaza.width, gy);
      pen.stroke();
    }
    const fountain = city.fountains[i];
    if (fountain) {
      pen.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ring(pen, fountain.x + 3, fountain.y + 4, fountain.r + 4);
      pen.fill();
      pen.fillStyle = PALETTE.water;
      ring(pen, fountain.x, fountain.y, fountain.r);
      pen.fill();
      pen.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ring(pen, fountain.x, fountain.y, fountain.r * 0.55);
      pen.fill();
      pen.fillStyle = '#ffffff';
      ring(pen, fountain.x - fountain.r * 0.4, fountain.y - fountain.r * 0.3, 3);
      pen.fill();
      ring(pen, fountain.x + fountain.r * 0.35, fountain.y + fountain.r * 0.25, 3);
      pen.fill();
    }
  }
}

/** Asphalt, sidewalks, lane dashes, checkered crossings, edge lines, manholes. */
function drawRoads(pen, city, view) {
  const half = ROAD.width / 2;
  for (let i = 0; i < ROAD_XS.length; i += 1) {
    const rx = ROAD_XS[i];
    if (rx < view.x0 - 120 || rx > view.x1 + 120) continue;
    pen.fillStyle = PALETTE.sidewalk;
    pen.fillRect(rx - half - 22, 0, 22, WORLD.height);
    pen.fillRect(rx + half, 0, 22, WORLD.height);
    pen.fillStyle = PALETTE.road;
    pen.fillRect(rx - half, 0, ROAD.width, WORLD.height);
    pen.fillStyle = 'rgba(255, 255, 255, 0.35)';
    pen.fillRect(rx - half + 4, 0, 3, WORLD.height);
    pen.fillRect(rx + half - 7, 0, 3, WORLD.height);
    pen.fillStyle = PALETTE.lane;
    for (let y = 0; y < WORLD.height; y += 56) {
      let nearCross = false;
      for (let j = 0; j < ROAD_YS.length; j += 1) {
        if (Math.abs(y - ROAD_YS[j]) < 80) { nearCross = true; break; }
      }
      if (!nearCross) pen.fillRect(rx - 2, y, 4, 28);
    }
  }
  for (let j = 0; j < ROAD_YS.length; j += 1) {
    const ry = ROAD_YS[j];
    if (ry < view.y0 - 120 || ry > view.y1 + 120) continue;
    pen.fillStyle = PALETTE.sidewalk;
    pen.fillRect(0, ry - half - 22, WORLD.width, 22);
    pen.fillRect(0, ry + half, WORLD.width, 22);
    pen.fillStyle = PALETTE.road;
    pen.fillRect(0, ry - half, WORLD.width, ROAD.width);
    pen.fillStyle = 'rgba(255, 255, 255, 0.35)';
    pen.fillRect(0, ry - half + 4, WORLD.width, 3);
    pen.fillRect(0, ry + half - 7, WORLD.width, 3);
    pen.fillStyle = PALETTE.lane;
    for (let x = 0; x < WORLD.width; x += 56) {
      let nearCross = false;
      for (let i = 0; i < ROAD_XS.length; i += 1) {
        if (Math.abs(x - ROAD_XS[i]) < 80) { nearCross = true; break; }
      }
      if (!nearCross) pen.fillRect(x, ry - 2, 28, 4);
    }
  }
  // Checkered crossings: white squares ringing each intersection.
  pen.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < ROAD_XS.length; i += 1) {
    for (let j = 0; j < ROAD_YS.length; j += 1) {
      const rx = ROAD_XS[i];
      const ry = ROAD_YS[j];
      if (rx < view.x0 - 120 || rx > view.x1 + 120 || ry < view.y0 - 120 || ry > view.y1 + 120) continue;
      for (let k = -2; k <= 2; k += 1) {
        pen.fillRect(rx + k * 24 - 6, ry - half - 12, 12, 10);
        pen.fillRect(rx + k * 24 - 6, ry + half + 2, 12, 10);
        pen.fillRect(rx - half - 12, ry + k * 24 - 6, 10, 12);
        pen.fillRect(rx + half + 2, ry + k * 24 - 6, 10, 12);
      }
      if ((i + j) % 3 === 0) {
        pen.fillStyle = '#2c2f36';
        ring(pen, rx + 34, ry + 34, 7);
        pen.fill();
        pen.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        pen.lineWidth = 1.5;
        ring(pen, rx + 34, ry + 34, 7);
        pen.stroke();
        pen.fillStyle = 'rgba(255, 255, 255, 0.85)';
      }
    }
  }
}

/** The pier, stacked containers, bollards and the boats in the south water. */
function drawPier(pen, city, view) {
  const docks = city.docks;
  if (docks.x + docks.width >= view.x0 && docks.x <= view.x1 && docks.y + docks.height >= view.y0 && docks.y <= view.y1) {
    pen.fillStyle = 'rgba(0, 0, 0, 0.20)';
    pen.fillRect(docks.x + 4, docks.y + 5, docks.width, docks.height);
    pen.fillStyle = PALETTE.pier;
    pen.fillRect(docks.x, docks.y, docks.width, docks.height);
    pen.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    pen.lineWidth = 1;
    for (let y = docks.y + 18; y < docks.y + docks.height; y += 18) {
      pen.beginPath();
      pen.moveTo(docks.x, y);
      pen.lineTo(docks.x + docks.width, y);
      pen.stroke();
    }
    pen.strokeStyle = PALETTE.buildingEdge;
    pen.lineWidth = 3;
    pen.strokeRect(docks.x + 1, docks.y + 1, docks.width - 2, docks.height - 2);
    pen.fillStyle = '#2c2f36';
    for (let y = docks.y + 30; y < docks.y + docks.height; y += 60) {
      ring(pen, docks.x + docks.width - 8, y, 5);
      pen.fill();
    }
  }
  for (const box of city.containers) {
    if (box.x > view.x1 || box.x + box.w < view.x0 || box.y > view.y1 || box.y + box.h < view.y0) continue;
    pen.fillStyle = 'rgba(0, 0, 0, 0.20)';
    pen.fillRect(box.x + 3, box.y + 3, box.w, box.h);
    pen.fillStyle = box.color;
    pen.fillRect(box.x, box.y, box.w, box.h);
    pen.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    pen.lineWidth = 2;
    pen.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
    pen.fillStyle = 'rgba(255, 255, 255, 0.30)';
    pen.fillRect(box.x + 2, box.y + 2, box.w - 4, 3);
  }
  for (const boat of city.boats) {
    if (boat.x < view.x0 - 80 || boat.x > view.x1 + 80 || boat.y < view.y0 - 80 || boat.y > view.y1 + 80) continue;
    pen.save();
    pen.translate(boat.x, boat.y);
    pen.rotate(boat.angle);
    pen.fillStyle = boat.color;
    tracePanel(pen, -34, -11, 68, 22, 9);
    pen.fill();
    pen.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    pen.lineWidth = 2;
    tracePanel(pen, -34, -11, 68, 22, 9);
    pen.stroke();
    pen.fillStyle = 'rgba(255, 255, 255, 0.75)';
    pen.fillRect(-8, -6, 16, 12);
    pen.strokeStyle = '#2c2f36';
    pen.lineWidth = 2;
    pen.beginPath();
    pen.moveTo(0, -6);
    pen.lineTo(0, -26);
    pen.stroke();
    pen.restore();
  }
}

/** Sand speckle, towels, umbrellas and palms on the beach. */
function drawBeachBits(pen, city, view) {
  const props = city.beachProps;
  pen.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (const grain of props.sand) {
    if (grain.x < view.x0 || grain.x > view.x1 || grain.y < view.y0 || grain.y > view.y1) continue;
    ring(pen, grain.x, grain.y, grain.r);
    pen.fill();
  }
  for (const towel of props.towels) {
    if (towel.x < view.x0 - 30 || towel.x > view.x1 + 30 || towel.y < view.y0 - 30 || towel.y > view.y1 + 30) continue;
    pen.save();
    pen.translate(towel.x, towel.y);
    pen.rotate(towel.angle);
    pen.fillStyle = towel.color;
    pen.fillRect(-16, -9, 32, 18);
    pen.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    pen.lineWidth = 2;
    pen.strokeRect(-16, -9, 32, 18);
    pen.restore();
  }
  for (const shadeSpot of props.umbrellas) {
    if (shadeSpot.x < view.x0 - 40 || shadeSpot.x > view.x1 + 40 || shadeSpot.y < view.y0 - 40 || shadeSpot.y > view.y1 + 40) continue;
    pen.fillStyle = 'rgba(0, 0, 0, 0.20)';
    ring(pen, shadeSpot.x + 4, shadeSpot.y + 14, 20);
    pen.fill();
    pen.fillStyle = shadeSpot.color;
    pen.beginPath();
    pen.arc(shadeSpot.x, shadeSpot.y, 20, Math.PI, 0);
    pen.closePath();
    pen.fill();
    pen.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    pen.lineWidth = 2;
    pen.beginPath();
    pen.arc(shadeSpot.x, shadeSpot.y, 20, Math.PI, 0);
    pen.stroke();
    pen.strokeStyle = '#5a4632';
    pen.lineWidth = 3;
    pen.beginPath();
    pen.moveTo(shadeSpot.x, shadeSpot.y);
    pen.lineTo(shadeSpot.x, shadeSpot.y + 16);
    pen.stroke();
  }
  for (const palm of props.palms) {
    if (palm.x < view.x0 - 40 || palm.x > view.x1 + 40 || palm.y < view.y0 - 40 || palm.y > view.y1 + 40) continue;
    pen.strokeStyle = PALETTE.palmTrunk;
    pen.lineWidth = 5;
    pen.beginPath();
    pen.moveTo(palm.x, palm.y + 12);
    pen.lineTo(palm.x + 4, palm.y - 12);
    pen.stroke();
    pen.strokeStyle = PALETTE.palmLeaf;
    pen.lineWidth = 4;
    for (let f = 0; f < 5; f += 1) {
      const ang = -Math.PI / 2 + (f - 2) * 0.55;
      pen.beginPath();
      pen.moveTo(palm.x + 4, palm.y - 12);
      pen.lineTo(palm.x + 4 + Math.cos(ang) * 20, palm.y - 12 + Math.sin(ang) * 14);
      pen.stroke();
    }
  }
}

/** One building: parapet, paneled roof, seams, rivets, edges and furniture. */
function drawRoofs(pen, city, view) {
  for (const hall of city.buildings) {
    if (hall.x > view.x1 || hall.x + hall.width < view.x0 || hall.y > view.y1 || hall.y + hall.height < view.y0) continue;
    pen.fillStyle = 'rgba(0, 0, 0, 0.18)';
    pen.fillRect(hall.x + 5, hall.y + 6, hall.width, hall.height);
    pen.fillStyle = PALETTE.buildingEdge;
    pen.fillRect(hall.x, hall.y, hall.width, hall.height);
    const roofTone = shade(hall.color, 0.72 + hall.shade * 0.35);
    pen.fillStyle = roofTone;
    pen.fillRect(hall.x + 4, hall.y + 4, hall.width - 8, hall.height - 8);
    // Inset panel: a lighter slab inside the parapet, with bands and seams.
    const inX = hall.x + 16;
    const inY = hall.y + 16;
    const inW = hall.width - 32;
    const inH = hall.height - 32;
    if (inW > 10 && inH > 10) {
      pen.fillStyle = shade(hall.color, (0.72 + hall.shade * 0.35) * 1.12);
      pen.fillRect(inX, inY, inW, inH);
      pen.strokeStyle = shade(hall.color, (0.72 + hall.shade * 0.35) * 0.72);
      pen.lineWidth = 2;
      pen.strokeRect(inX + 1, inY + 1, inW - 2, inH - 2);
      pen.fillStyle = 'rgba(0, 0, 0, 0.10)';
      for (let by = inY + 44; by < inY + inH - 6; by += 44) {
        pen.fillRect(inX, by, inW, 3);
      }
      pen.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let bx = inX + 48; bx < inX + inW - 6; bx += 48) {
        pen.fillRect(bx, inY, 3, inH);
      }
      pen.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ring(pen, inX + 8, inY + 8, 3);
      pen.fill();
      ring(pen, inX + inW - 8, inY + 8, 3);
      pen.fill();
      ring(pen, inX + 8, inY + inH - 8, 3);
      pen.fill();
      ring(pen, inX + inW - 8, inY + inH - 8, 3);
      pen.fill();
    }
    pen.fillStyle = 'rgba(255, 255, 255, 0.28)';
    pen.fillRect(hall.x + 4, hall.y + 4, hall.width - 8, 3);
    pen.fillStyle = 'rgba(0, 0, 0, 0.25)';
    pen.fillRect(hall.x + 4, hall.y + hall.height - 7, hall.width - 8, 3);
    for (const gear of hall.roof) {
      if (gear.kind === 'ac') {
        pen.fillStyle = '#c8ccd2';
        pen.fillRect(gear.x, gear.y, gear.s, gear.s);
        pen.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        pen.lineWidth = 2;
        pen.strokeRect(gear.x + 1, gear.y + 1, gear.s - 2, gear.s - 2);
        pen.fillStyle = '#5a6068';
        ring(pen, gear.x + gear.s / 2, gear.y + gear.s / 2, gear.s * 0.28);
        pen.fill();
      } else if (gear.kind === 'vent') {
        pen.fillStyle = '#3a3f46';
        ring(pen, gear.x, gear.y, gear.s / 2);
        pen.fill();
        pen.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        pen.lineWidth = 2;
        ring(pen, gear.x, gear.y, gear.s / 2);
        pen.stroke();
      } else if (gear.kind === 'sky') {
        pen.fillStyle = 'rgba(190, 225, 245, 0.9)';
        pen.fillRect(gear.x, gear.y, gear.w, gear.h);
        pen.strokeStyle = '#ffffff';
        pen.lineWidth = 2;
        pen.strokeRect(gear.x + 1, gear.y + 1, gear.w - 2, gear.h - 2);
        pen.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        pen.beginPath();
        pen.moveTo(gear.x + 4, gear.y + gear.h - 4);
        pen.lineTo(gear.x + gear.w - 4, gear.y + 4);
        pen.stroke();
      } else if (gear.kind === 'heli') {
        pen.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ring(pen, gear.x, gear.y, gear.r);
        pen.fill();
        pen.strokeStyle = '#ffffff';
        pen.lineWidth = 3;
        ring(pen, gear.x, gear.y, gear.r * 0.8);
        pen.stroke();
        ink(pen, 'H', gear.x, gear.y + gear.r * 0.42, 'bold ' + Math.round(gear.r) + 'px ' + FONT, '#ffffff', 'center');
      } else if (gear.kind === 'garden') {
        pen.fillStyle = PALETTE.tree;
        pen.fillRect(gear.x, gear.y, gear.w, gear.h);
        pen.fillStyle = PALETTE.treeLight;
        ring(pen, gear.x + gear.w * 0.3, gear.y + gear.h * 0.35, 9);
        pen.fill();
        ring(pen, gear.x + gear.w * 0.7, gear.y + gear.h * 0.6, 11);
        pen.fill();
      } else if (gear.kind === 'pool') {
        pen.fillStyle = PALETTE.water;
        pen.fillRect(gear.x, gear.y, gear.w, gear.h);
        pen.fillStyle = 'rgba(255, 255, 255, 0.35)';
        pen.fillRect(gear.x + 5, gear.y + 5, gear.w - 10, gear.h * 0.3);
        pen.strokeStyle = '#ffffff';
        pen.lineWidth = 2;
        pen.strokeRect(gear.x + 1, gear.y + 1, gear.w - 2, gear.h - 2);
      }
    }
  }
}

/** Street trees and lamps along the roads. */
function drawGreenery(pen, city, view) {
  for (const tree of city.trees) {
    if (tree.x < view.x0 - 30 || tree.x > view.x1 + 30 || tree.y < view.y0 - 30 || tree.y > view.y1 + 30) continue;
    pen.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ring(pen, tree.x + 3, tree.y + 4, tree.r);
    pen.fill();
    pen.fillStyle = PALETTE.tree;
    ring(pen, tree.x, tree.y, tree.r);
    pen.fill();
    pen.fillStyle = PALETTE.treeLight;
    ring(pen, tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.55);
    pen.fill();
    pen.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ring(pen, tree.x - tree.r * 0.15, tree.y - tree.r * 0.45, tree.r * 0.2);
    pen.fill();
  }
  for (const lamp of city.lamps) {
    if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
    pen.strokeStyle = '#2c2f36';
    pen.lineWidth = 3;
    pen.beginPath();
    pen.moveTo(lamp.x, lamp.y);
    pen.lineTo(lamp.x, lamp.y - 12);
    pen.stroke();
    pen.fillStyle = '#ffd23e';
    ring(pen, lamp.x, lamp.y - 13, 4);
    pen.fill();
  }
}

/** Health and ammo pickups, with a slow glow ring from the clock. */
function drawPickups(pen, state, view) {
  const pulse = 20 + 3 * Math.sin(state.elapsed * 3);
  for (const bonus of state.pickups) {
    if (bonus.taken) continue;
    if (bonus.x < view.x0 - 40 || bonus.x > view.x1 + 40 || bonus.y < view.y0 - 40 || bonus.y > view.y1 + 40) continue;
    pen.fillStyle = bonus.kind === 'health' ? 'rgba(57, 211, 83, 0.25)' : 'rgba(47, 127, 184, 0.25)';
    ring(pen, bonus.x, bonus.y, pulse);
    pen.fill();
    if (bonus.kind === 'health') {
      pen.fillStyle = PALETTE.pickup;
      ring(pen, bonus.x, bonus.y, 15);
      pen.fill();
      pen.strokeStyle = '#ffffff';
      pen.lineWidth = 2;
      ring(pen, bonus.x, bonus.y, 15);
      pen.stroke();
      pen.fillStyle = '#ffffff';
      pen.fillRect(bonus.x - 3, bonus.y - 9, 6, 18);
      pen.fillRect(bonus.x - 9, bonus.y - 3, 18, 6);
    } else {
      pen.fillStyle = PALETTE.water;
      ring(pen, bonus.x, bonus.y, 15);
      pen.fill();
      pen.strokeStyle = '#ffffff';
      pen.lineWidth = 2;
      ring(pen, bonus.x, bonus.y, 15);
      pen.stroke();
      pen.fillStyle = '#ffffff';
      pen.fillRect(bonus.x - 3, bonus.y - 8, 6, 12);
      pen.beginPath();
      pen.moveTo(bonus.x - 3, bonus.y - 8);
      pen.lineTo(bonus.x, bonus.y - 14);
      pen.lineTo(bonus.x + 3, bonus.y - 8);
      pen.closePath();
      pen.fill();
    }
  }
}

/** The mission beam: a gold column over the goal and a breathing ground ring. */
function drawBeam(pen, state, view) {
  const place = state.missionPlace;
  if (!place || state.missionDone) return;
  if (place.x < view.x0 - 60 || place.x > view.x1 + 60 || place.y < view.y0 - 300 || place.y > view.y1 + 60) return;
  const breathe = 0.10 + 0.05 * Math.sin(state.elapsed * 2);
  const grad = pen.createLinearGradient(0, place.y - 280, 0, place.y);
  grad.addColorStop(0, 'rgba(255, 207, 61, 0)');
  grad.addColorStop(1, 'rgba(255, 207, 61, ' + breathe.toFixed(3) + ')');
  pen.fillStyle = grad;
  pen.fillRect(place.x - 16, place.y - 280, 32, 280);
  pen.strokeStyle = 'rgba(255, 207, 61, 0.7)';
  pen.lineWidth = 3;
  ring(pen, place.x, place.y, 30 + 5 * Math.sin(state.elapsed * 2.5));
  pen.stroke();
}

/** All cars: traffic, parked, police and the player's ride. */
function drawCars(pen, state, view) {
  for (const ride of state.cars) {
    if (ride.x < view.x0 - 80 || ride.x > view.x1 + 80 || ride.y < view.y0 - 80 || ride.y > view.y1 + 80) continue;
    if (ride.kind === 'police') {
      pen.fillStyle = 'rgba(47, 111, 208, 0.14)';
      ring(pen, ride.x, ride.y, 58);
      pen.fill();
    }
    pen.fillStyle = 'rgba(0, 0, 0, 0.25)';
    pen.beginPath();
    pen.ellipse(ride.x + 2, ride.y + 4, 30, 16, ride.angle, 0, FULL_TURN);
    pen.fill();
    pen.save();
    pen.translate(ride.x, ride.y);
    pen.rotate(ride.angle);
    pen.fillStyle = ride.color;
    tracePanel(pen, -27, -13, 54, 26, 7);
    pen.fill();
    pen.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    pen.lineWidth = 2;
    tracePanel(pen, -27, -13, 54, 26, 7);
    pen.stroke();
    pen.fillStyle = shade(ride.color, 1.18);
    tracePanel(pen, -12, -9, 22, 18, 4);
    pen.fill();
    pen.fillStyle = '#2c3a4a';
    pen.fillRect(13, -10, 6, 20);
    pen.fillRect(-20, -10, 5, 20);
    pen.fillStyle = 'rgba(0, 0, 0, 0.5)';
    pen.fillRect(-2, -8, 10, 5);
    pen.fillStyle = '#1c1f24';
    pen.fillRect(-20, -16, 10, 5);
    pen.fillRect(-20, 11, 10, 5);
    pen.fillRect(14, -16, 10, 5);
    pen.fillRect(14, 11, 10, 5);
    pen.fillStyle = '#ffe14d';
    ring(pen, 26, -8, 2.5);
    pen.fill();
    ring(pen, 26, 8, 2.5);
    pen.fill();
    if (ride.brake) {
      pen.fillStyle = '#ff3b30';
      ring(pen, -26, -8, 3);
      pen.fill();
      ring(pen, -26, 8, 3);
      pen.fill();
    }
    if (ride.kind === 'police') {
      const flash = Math.sin(ride.siren) > 0;
      pen.fillStyle = flash ? '#ff3b30' : '#2f6fd0';
      pen.fillRect(-6, -11, 12, 5);
      pen.fillStyle = flash ? '#2f6fd0' : '#ff3b30';
      pen.fillRect(-6, 6, 12, 5);
      ink(pen, 'PD', 2, 4, 'bold 11px ' + FONT, '#ffffff', 'center');
    }
    if (ride.missionCar) {
      pen.strokeStyle = PALETTE.marker;
      pen.lineWidth = 2.5;
      tracePanel(pen, -29, -15, 58, 30, 8);
      pen.stroke();
    }
    pen.restore();
    if (ride.kind === 'player') {
      pen.strokeStyle = PALETTE.marker;
      pen.lineWidth = 3;
      ring(pen, ride.x, ride.y, 42);
      pen.stroke();
    }
  }
}

/** Pedestrians: bigger bodies, dark outlines, heads turned to their walk. */
function drawWalkers(pen, state, view) {
  for (const walker of state.peds) {
    if (walker.x < view.x0 - 30 || walker.x > view.x1 + 30 || walker.y < view.y0 - 30 || walker.y > view.y1 + 30) continue;
    if (walker.down > 0) {
      pen.fillStyle = 'rgba(0, 0, 0, 0.25)';
      pen.beginPath();
      pen.ellipse(walker.x, walker.y, 13, 7, walker.angle, 0, FULL_TURN);
      pen.fill();
      pen.fillStyle = '#8a8f96';
      pen.beginPath();
      pen.ellipse(walker.x, walker.y, 12, 6, walker.angle, 0, FULL_TURN);
      pen.fill();
      continue;
    }
    pen.fillStyle = 'rgba(0, 0, 0, 0.22)';
    pen.beginPath();
    pen.ellipse(walker.x + 2, walker.y + 3, 12, 6, 0, 0, FULL_TURN);
    pen.fill();
    pen.fillStyle = walker.color;
    ring(pen, walker.x, walker.y, 12);
    pen.fill();
    pen.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    pen.lineWidth = 2;
    ring(pen, walker.x, walker.y, 12);
    pen.stroke();
    pen.fillStyle = SKIN;
    ring(pen, walker.x + Math.cos(walker.angle) * 4, walker.y + Math.sin(walker.angle) * 4, 5);
    pen.fill();
    if (walker.state === 'flee') {
      pen.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      pen.lineWidth = 2;
      pen.beginPath();
      pen.moveTo(walker.x - Math.cos(walker.angle) * 14, walker.y - Math.sin(walker.angle) * 14);
      pen.lineTo(walker.x - Math.cos(walker.angle) * 22, walker.y - Math.sin(walker.angle) * 22);
      pen.stroke();
    }
  }
}

/** Rival crew: dark-red figures with a health bar and a gun line. */
function drawRivals(pen, state, view) {
  for (const rival of state.enemies) {
    if (rival.x < view.x0 - 30 || rival.x > view.x1 + 30 || rival.y < view.y0 - 30 || rival.y > view.y1 + 30) continue;
    pen.fillStyle = 'rgba(0, 0, 0, 0.22)';
    pen.beginPath();
    pen.ellipse(rival.x + 2, rival.y + 3, 12, 6, 0, 0, FULL_TURN);
    pen.fill();
    pen.fillStyle = PALETTE.enemy;
    ring(pen, rival.x, rival.y, 13);
    pen.fill();
    pen.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    pen.lineWidth = 2;
    ring(pen, rival.x, rival.y, 13);
    pen.stroke();
    pen.strokeStyle = '#1c1f24';
    pen.lineWidth = 4;
    pen.beginPath();
    pen.moveTo(rival.x + Math.cos(rival.angle) * 10, rival.y + Math.sin(rival.angle) * 10);
    pen.lineTo(rival.x + Math.cos(rival.angle) * 24, rival.y + Math.sin(rival.angle) * 24);
    pen.stroke();
    pen.fillStyle = SKIN;
    ring(pen, rival.x + Math.cos(rival.angle) * 4, rival.y + Math.sin(rival.angle) * 4, 5);
    pen.fill();
    const frac = clampNum(rival.health / COMBAT.enemyHealth, 0, 1);
    pen.fillStyle = 'rgba(0, 0, 0, 0.55)';
    pen.fillRect(rival.x - 14, rival.y - 24, 28, 5);
    pen.fillStyle = frac > 0.5 ? PALETTE.health : PALETTE.healthLow;
    pen.fillRect(rival.x - 13, rival.y - 23, 26 * frac, 3);
  }
}

/** Bullets as short bright streaks along their flight. */
function drawShots(pen, state, view) {
  pen.strokeStyle = PALETTE.bullet;
  pen.lineWidth = 3;
  pen.lineCap = 'round';
  for (const slug of state.bullets) {
    if (!slug.active) continue;
    if (slug.x < view.x0 - 20 || slug.x > view.x1 + 20 || slug.y < view.y0 - 20 || slug.y > view.y1 + 20) continue;
    pen.beginPath();
    pen.moveTo(slug.x, slug.y);
    pen.lineTo(slug.x - slug.vx * 0.03, slug.y - slug.vy * 0.03);
    pen.stroke();
  }
  pen.lineCap = 'butt';
}

/** Impact and exhaust sparks, fading with their remaining life. */
function drawSparks(pen, state, view) {
  for (const spark of state.particles) {
    if (!spark.active) continue;
    if (spark.x < view.x0 - 20 || spark.x > view.x1 + 20 || spark.y < view.y0 - 20 || spark.y > view.y1 + 20) continue;
    const frac = clampNum(spark.life / spark.max, 0, 1);
    pen.globalAlpha = frac;
    pen.fillStyle = spark.color;
    ring(pen, spark.x, spark.y, Math.max(1, spark.size * frac));
    pen.fill();
  }
  pen.globalAlpha = 1;
}

/** Dana on foot: gold figure, white ring, and a punch arc while swinging. */
function drawHero(pen, state, view) {
  const hero = state.player;
  if (!hero.onFoot) return;
  if (hero.x < view.x0 - 40 || hero.x > view.x1 + 40 || hero.y < view.y0 - 40 || hero.y > view.y1 + 40) return;
  pen.fillStyle = 'rgba(0, 0, 0, 0.25)';
  pen.beginPath();
  pen.ellipse(hero.x + 2, hero.y + 4, 13, 6, 0, 0, FULL_TURN);
  pen.fill();
  pen.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  pen.lineWidth = 2;
  ring(pen, hero.x, hero.y, 19);
  pen.stroke();
  pen.fillStyle = PALETTE.player;
  ring(pen, hero.x, hero.y, 13);
  pen.fill();
  pen.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  pen.lineWidth = 2.5;
  ring(pen, hero.x, hero.y, 13);
  pen.stroke();
  pen.fillStyle = SKIN;
  ring(pen, hero.x + Math.cos(hero.angle) * 5, hero.y + Math.sin(hero.angle) * 5, 5.5);
  pen.fill();
  if (hero.punchTimer > 0) {
    pen.strokeStyle = 'rgba(255, 210, 62, ' + (hero.punchTimer / PLAYER.punchCooldown).toFixed(2) + ')';
    pen.lineWidth = 5;
    pen.beginPath();
    pen.arc(hero.x, hero.y, 30, hero.angle - 0.6, hero.angle + 0.6);
    pen.stroke();
  }
}

/** The gold goal diamond over the mission place, breathing with the clock. */
function drawGoal(pen, state, view) {
  const place = state.missionPlace;
  if (!place || state.missionDone) return;
  if (place.x < view.x0 - 80 || place.x > view.x1 + 80 || place.y < view.y0 - 80 || place.y > view.y1 + 80) return;
  const pulse = 34 + 6 * Math.sin(state.elapsed * 2.5);
  pen.strokeStyle = 'rgba(255, 207, 61, 0.5)';
  pen.lineWidth = 3;
  ring(pen, place.x, place.y, pulse);
  pen.stroke();
  pen.save();
  pen.translate(place.x, place.y);
  pen.rotate(Math.PI / 4);
  pen.fillStyle = PALETTE.marker;
  pen.fillRect(-15, -15, 30, 30);
  pen.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  pen.lineWidth = 2.5;
  pen.strokeRect(-15, -15, 30, 30);
  pen.fillStyle = '#ffffff';
  pen.fillRect(-6, -6, 12, 12);
  pen.restore();
}

/** The minimap: the whole city shrunk, with the player and the goal on it. */
function drawMinimap(pen, state, city) {
  const mx = 1052;
  const my = 528;
  const mw = 216;
  const mh = 180;
  pen.fillStyle = 'rgba(10, 14, 20, 0.85)';
  pen.fillRect(mx, my, mw, mh);
  pen.strokeStyle = GOLD_LINE;
  pen.lineWidth = 3;
  pen.strokeRect(mx + 1, my + 1, mw - 2, mh - 2);
  ink(pen, 'VIREO BAY', mx + 10, my + 18, 'bold 11px ' + FONT, '#ffffff', 'left');
  const ix = mx + 4;
  const iy = my + 26;
  const iw = mw - 8;
  const ih = mh - 30;
  const sx = iw / WORLD.width;
  const sy = ih / WORLD.height;
  pen.fillStyle = PALETTE.water;
  pen.fillRect(ix, iy + (city.water.y - 0) * sy, iw, city.water.height * sy);
  pen.fillStyle = PALETTE.sand;
  pen.fillRect(ix, iy + city.beach.y * sy, iw, (city.beach.height - city.water.height) * sy);
  for (const hall of city.buildings) {
    pen.fillStyle = hall.color;
    pen.fillRect(ix + hall.x * sx, iy + hall.y * sy, Math.max(2, hall.width * sx), Math.max(2, hall.height * sy));
  }
  for (const ride of state.cars) {
    if (ride.kind !== 'police') continue;
    pen.fillStyle = PALETTE.police;
    ring(pen, ix + ride.x * sx, iy + ride.y * sy, 3);
    pen.fill();
  }
  const place = state.missionPlace;
  if (place && !state.missionDone) {
    pen.fillStyle = PALETTE.marker;
    pen.save();
    pen.translate(ix + place.x * sx, iy + place.y * sy);
    pen.rotate(Math.PI / 4);
    pen.fillRect(-4, -4, 8, 8);
    pen.restore();
  }
  const hero = state.player;
  pen.fillStyle = '#ffffff';
  ring(pen, ix + hero.x * sx, iy + hero.y * sy, 4);
  pen.fill();
  pen.strokeStyle = PALETTE.marker;
  pen.lineWidth = 1.5;
  ring(pen, ix + hero.x * sx, iy + hero.y * sy, 5.5);
  pen.stroke();
  const cam = state.camera;
  pen.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  pen.lineWidth = 1;
  pen.strokeRect(ix + (cam.x - VIEW.width / 2) * sx, iy + (cam.y - VIEW.height / 2) * sy, VIEW.width * sx, VIEW.height * sy);
}

/** Cash, job, wanted, minimap, speed, hints and the spoken message. */
function drawHud(pen, state, city, best) {
  const hero = state.player;
  tracePanel(pen, 12, 12, 246, 96, 12);
  pen.fillStyle = DARK_PANEL;
  pen.fill();
  pen.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  pen.lineWidth = 1;
  tracePanel(pen, 12, 12, 246, 96, 12);
  pen.stroke();
  ink(pen, '$' + state.money, 28, 44, 'bold 30px ' + FONT, PALETTE.health, 'left');
  ink(pen, 'CASH', 28, 66, '11px ' + FONT, PALETTE.hudMuted, 'left');
  pen.fillStyle = 'rgba(0, 0, 0, 0.5)';
  tracePanel(pen, 96, 26, 132, 16, 6);
  pen.fill();
  const healthFrac = clampNum(state.health / PLAYER.health, 0, 1);
  pen.fillStyle = healthFrac > 0.3 ? PALETTE.health : PALETTE.healthLow;
  tracePanel(pen, 96, 26, 132 * healthFrac, 16, 6);
  pen.fill();
  ink(pen, '' + Math.round(state.health), 96, 68, 'bold 16px ' + FONT, PALETTE.hudText, 'left');
  ink(pen, 'AMMO ' + state.ammo, 244, 68, 'bold 16px ' + FONT, PALETTE.hudText, 'right');

  const def = MISSION_DEFS[state.missionIndex];
  tracePanel(pen, 340, 12, 600, 66, 12);
  pen.fillStyle = DARK_PANEL;
  pen.fill();
  pen.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  pen.lineWidth = 1;
  tracePanel(pen, 340, 12, 600, 66, 12);
  pen.stroke();
  ink(pen, def ? def.title : 'Vireo Bay', 640, 40, 'bold 22px ' + FONT, PALETTE.title, 'center');
  ink(pen, objectiveText(state.missionIndex, state.stageIndex), 640, 64, '17px ' + FONT, PALETTE.hudText, 'center');
  const stage = def ? def.stages[state.stageIndex] : null;
  if (stage && stage.timed && state.missionTimer > 0) {
    ink(pen, Math.ceil(state.missionTimer) + 's', 924, 40, 'bold 18px ' + FONT, PALETTE.title, 'right');
  }

  tracePanel(pen, 1062, 12, 206, 56, 12);
  pen.fillStyle = DARK_PANEL;
  pen.fill();
  pen.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  pen.lineWidth = 1;
  tracePanel(pen, 1062, 12, 206, 56, 12);
  pen.stroke();
  ink(pen, 'WANTED', 1078, 46, 'bold 15px ' + FONT, PALETTE.hudText, 'left');
  for (let i = 0; i < WANTED.max; i += 1) {
    star5(pen, 1184 + i * 20, 40, 11);
    pen.fillStyle = i < state.wanted ? PALETTE.star : PALETTE.starEmpty;
    pen.fill();
  }

  drawMinimap(pen, state, city);

  if (!hero.onFoot) {
    ink(pen, 'km/h', 28, 656, '13px ' + FONT, PALETTE.hudText, 'left');
    ink(pen, '' + Math.round(Math.abs(hero.speed) * 0.36), 26, 690, 'bold 36px ' + FONT, PALETTE.hudText, 'left');
    ink(pen, 'E — get out    F — shoot', 26, 632, '14px ' + FONT, PALETTE.hudText, 'left');
  } else {
    ink(pen, 'WASD — move    E — enter car    Space — punch    F — shoot', 26, 694, '14px ' + FONT, PALETTE.hudText, 'left');
  }

  if (state.messageTimer > 0 && state.message) {
    pen.font = '17px ' + FONT;
    const tw = pen.measureText(state.message).width;
    const pw = tw + 44;
    tracePanel(pen, 640 - pw / 2, 588, pw, 36, 12);
    pen.fillStyle = DARK_PANEL;
    pen.fill();
    ink(pen, state.message, 640, 612, '17px ' + FONT, PALETTE.hudText, 'center');
  }
}

/** The mission place label, in screen space after the HUD, kept off the minimap. */
function drawPlaceChip(pen, state, city) {
  const place = state.missionPlace;
  if (!place || state.missionDone) return;
  const cam = state.camera;
  const vx = place.x - (cam.x - VIEW.width / 2);
  const vy = place.y - (cam.y - VIEW.height / 2);
  pen.font = 'bold 17px ' + FONT;
  const tw = pen.measureText(place.label).width;
  const w = tw + 46;
  const h = 34;
  let px = vx - w / 2;
  let py = vy - 78;
  px = clampNum(px, 10, 1270 - w);
  py = clampNum(py, 96, 500);
  tracePanel(pen, px, py, w, h, 10);
  pen.fillStyle = 'rgba(12, 16, 24, 0.88)';
  pen.fill();
  pen.strokeStyle = 'rgba(255, 207, 61, 0.5)';
  pen.lineWidth = 1.5;
  tracePanel(pen, px, py, w, h, 10);
  pen.stroke();
  pen.save();
  pen.translate(px + 18, py + 17);
  pen.rotate(Math.PI / 4);
  pen.fillStyle = PALETTE.marker;
  pen.fillRect(-6, -6, 12, 12);
  pen.restore();
  ink(pen, place.label, px + 32, py + 23, 'bold 17px ' + FONT, PALETTE.hudText, 'left');
}

/** The title card over a living city, dimmed just enough to read. */
function drawTitleCard(pen, best) {
  pen.fillStyle = 'rgba(8, 12, 20, 0.28)';
  pen.fillRect(0, 0, VIEW.width, VIEW.height);
  tracePanel(pen, 310, 168, 660, 390, 18);
  pen.fillStyle = CARD_PANEL;
  pen.fill();
  pen.strokeStyle = GOLD_LINE;
  pen.lineWidth = 2;
  tracePanel(pen, 310, 168, 660, 390, 18);
  pen.stroke();
  ink(pen, 'VIREO BAY', 640, 252, 'bold 64px ' + FONT, PALETTE.title, 'center');
  ink(pen, 'An open-world crime game in a sun-soaked bay city.', 640, 316, '20px ' + FONT, PALETTE.hudText, 'center');
  ink(pen, 'Dana Voss owes the Bay Syndicate $5,000. Four jobs. One fast car.', 640, 348, '20px ' + FONT, PALETTE.hudText, 'center');
  ink(pen, 'Steal cars, lose the cops, run the jobs, pay the debt.', 640, 380, '20px ' + FONT, PALETTE.hudText, 'center');
  ink(pen, 'WASD drive & walk · E enter / steal a car · Space punch · F shoot · P pause', 640, 412, '19px ' + FONT, PALETTE.hudMuted, 'center');
  ink(pen, 'Best haul yet: $' + best, 640, 444, '20px ' + FONT, PALETTE.hudText, 'center');
  ink(pen, 'Press Space or click to start', 640, 516, 'bold 24px ' + FONT, PALETTE.title, 'center');
}

/** The pause card. */
function drawPausedCard(pen) {
  pen.fillStyle = 'rgba(8, 12, 20, 0.5)';
  pen.fillRect(0, 0, VIEW.width, VIEW.height);
  tracePanel(pen, 490, 280, 300, 160, 16);
  pen.fillStyle = CARD_PANEL;
  pen.fill();
  pen.strokeStyle = GOLD_LINE;
  pen.lineWidth = 2;
  tracePanel(pen, 490, 280, 300, 160, 16);
  pen.stroke();
  ink(pen, 'PAUSED', 640, 348, 'bold 40px ' + FONT, PALETTE.title, 'center');
  ink(pen, 'Press P to resume', 640, 392, '18px ' + FONT, PALETTE.hudText, 'center');
}

/** The end card: debt paid, busted, or wasted. */
function drawOverCard(pen, state, best) {
  pen.fillStyle = 'rgba(8, 12, 20, 0.55)';
  pen.fillRect(0, 0, VIEW.width, VIEW.height);
  tracePanel(pen, 390, 220, 500, 280, 16);
  pen.fillStyle = CARD_PANEL;
  pen.fill();
  pen.strokeStyle = GOLD_LINE;
  pen.lineWidth = 2;
  tracePanel(pen, 390, 220, 500, 280, 16);
  pen.stroke();
  const reason = state.endReason || 'dead';
  const headline = reason === 'won' ? 'DEBT PAID!' : reason === 'busted' ? 'BUSTED' : 'WASTED';
  const headColor = reason === 'dead' ? PALETTE.healthLow : PALETTE.title;
  ink(pen, headline, 640, 296, 'bold 44px ' + FONT, headColor, 'center');
  const kept = reason === 'won'
    ? 'You kept $' + state.money + '. Best haul $' + best + '.'
    : reason === 'busted'
      ? 'Bail cost $100. Back at Voss Garage.'
      : 'Cash kept $' + state.money + '. Best haul $' + best + '.';
  ink(pen, kept, 640, 348, '20px ' + FONT, PALETTE.hudText, 'center');
  ink(pen, 'Jobs delivered: ' + state.stats.delivered + ' of ' + MISSIONS.reward.length, 640, 384, '20px ' + FONT, PALETTE.hudText, 'center');
  ink(pen, 'Press Space to play again', 640, 452, 'bold 22px ' + FONT, PALETTE.title, 'center');
}

export function createRenderer(canvas) {
  const pen = canvas.getContext('2d');
  let viewScale = 1;
  let viewOX = 0;
  let viewOY = 0;

  /** Fit the 1280x720 view into the canvas, letterboxed, and return the pixel ratio. */
  function fitView() {
    const w = canvas.clientWidth || VIEW.width;
    const h = canvas.clientHeight || VIEW.height;
    const dpr = window.devicePixelRatio || 1;
    const wantW = Math.round(w * dpr);
    const wantH = Math.round(h * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }
    viewScale = Math.min(w / VIEW.width, h / VIEW.height);
    viewOX = (w - VIEW.width * viewScale) / 2;
    viewOY = (h - VIEW.height * viewScale) / 2;
    return dpr;
  }

  /** Paint one frame: the world, then the HUD, then the screen card. */
  function draw(state, city, screen, best) {
    const dpr = fitView();
    const cam = state.camera;
    const view = {
      x0: cam.x - VIEW.width / 2,
      y0: cam.y - VIEW.height / 2,
      x1: cam.x + VIEW.width / 2,
      y1: cam.y + VIEW.height / 2,
    };
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    pen.fillStyle = '#0d1117';
    pen.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    pen.setTransform(
      dpr * viewScale, 0, 0, dpr * viewScale,
      dpr * (viewOX - view.x0 * viewScale),
      dpr * (viewOY - view.y0 * viewScale),
    );
    drawGround(pen, city, view);
    drawParks(pen, city, view);
    drawRoads(pen, city, view);
    drawPier(pen, city, view);
    drawBeachBits(pen, city, view);
    drawRoofs(pen, city, view);
    drawGreenery(pen, city, view);
    drawPickups(pen, state, view);
    drawBeam(pen, state, view);
    drawCars(pen, state, view);
    drawWalkers(pen, state, view);
    drawRivals(pen, state, view);
    drawShots(pen, state, view);
    drawSparks(pen, state, view);
    drawHero(pen, state, view);
    drawGoal(pen, state, view);
    if (screen === SCREEN_TITLE) {
      pen.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * viewOX, dpr * viewOY);
      drawTitleCard(pen, best);
      return;
    }
    pen.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * viewOX, dpr * viewOY);
    drawHud(pen, state, city, best);
    drawPlaceChip(pen, state, city);
    if (screen === SCREEN_PAUSED) drawPausedCard(pen);
    else if (screen === SCREEN_OVER) drawOverCard(pen, state, best);
  }

  /** Screen pixels (from the mouse) back into world coordinates. */
  function screenToWorld(x, y, camera) {
    fitView();
    return {
      x: camera.x - VIEW.width / 2 + (x - viewOX) / viewScale,
      y: camera.y - VIEW.height / 2 + (y - viewOY) / viewScale,
    };
  }

  return { draw, screenToWorld };
}
