// Vireo Bay — the renderer. Golden-hour top-down canvas art: warm low sun,
// long shadows, paneled rooftops, neon signs, a glittering bay, and a city
// you can read at a glance. Everything is drawn from the world state; nothing
// here keeps its own time except the clock the caller passes in.
import { WORLD, AVENUES, STREETS, AVENUE_NAMES, STREET_NAMES, PALETTE, SUN, HIDEOUT, SYNDICATE } from './config.js';
import { districtAt, isWater } from './city.js';
import { JOBS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Camera: follows the player, clamped to the world, at a fixed view width.
 * The view is tighter than the screen (1024 world units across 1280 pixels)
 * so cars, roofs and signs read big in the dossier screenshots. */
export function cameraFor(canvas, focusX, focusY) {
  const scale = canvas.width / 1024;
  const viewW = canvas.width / scale;
  const viewH = canvas.height / scale;
  let x = focusX - viewW / 2;
  let y = focusY - viewH / 2;
  x = Math.max(0, Math.min(WORLD.width - viewW, x));
  y = Math.max(0, Math.min(WORLD.height - viewH, y));
  return { x, y, scale, viewW, viewH };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function groundAt(city, x, y) {
  const d = districtAt(x, y);
  if (d === 'ocean' || d === 'marina') return PALETTE.ocean;
  if (d === 'beach') return PALETTE.sand;
  return PALETTE.ground;
}

export function render(ctx, world, screen) {
  const canvas = ctx.canvas;
  const { width, height } = canvas;
  const focus = world.shotCam || { x: world.player.x, y: world.player.y };
  const cam = cameraFor(canvas, focus.x, focus.y);
  const t = world.time;

  ctx.save();
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  drawGround(ctx, world, cam, t);
  drawRoads(ctx, world, cam);
  drawParksAndNature(ctx, world, cam, t);
  drawPort(ctx, world, cam);
  drawBuildings(ctx, world, cam, t);
  drawPickups(ctx, world, cam, t);
  drawCars(ctx, world, cam, t);
  drawPeds(ctx, world, cam, t);
  drawBullets(ctx, world, cam);
  drawParticles(ctx, world, cam);
  drawObjectiveMarker(ctx, world, cam, t);

  ctx.restore();

  // Golden-hour wash: a warm glow from the low sun, over the whole frame.
  const glow = ctx.createRadialGradient(
    width * SUN.x, height * SUN.y, 40,
    width * SUN.x, height * SUN.y, Math.max(width, height) * 0.85,
  );
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.28)');
  glow.addColorStop(0.55, 'rgba(255, 150, 70, 0.10)');
  glow.addColorStop(1, 'rgba(255, 120, 60, 0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  if (screen === SCREEN_TITLE) drawTitle(ctx, world, width, height);
  else if (screen === SCREEN_PAUSED) drawPaused(ctx, world, width, height);
  else if (screen === SCREEN_OVER) drawOver(ctx, world, width, height);
  else drawHUD(ctx, world, width, height);
}

function drawGround(ctx, world, cam, t) {
  const { x, y, viewW, viewH } = cam;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(WORLD.width, Math.ceil(x + viewW));
  const y1 = Math.min(WORLD.height, Math.ceil(y + viewH));

  // Ocean and marina: deep gradient with slow moving wave lines.
  const oceanGrad = ctx.createLinearGradient(0, 0, 320, 0);
  oceanGrad.addColorStop(0, PALETTE.oceanDeep);
  oceanGrad.addColorStop(1, PALETTE.ocean);
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(x0, y0, 160 - x0 > 0 ? Math.min(160, x1) - x0 : 0, y1 - y0);
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, 2440), x1 - Math.max(x0, 0), y1 - Math.max(y0, 2440));
  ctx.strokeStyle = 'rgba(234, 246, 242, 0.35)';
  ctx.lineWidth = 2;
  for (let wy = 200; wy < 2440; wy += 120) {
    if (wy < y0 - 20 || wy > y1 + 20) continue;
    const phase = Math.sin(t * 0.7 + wy * 0.02) * 14;
    ctx.beginPath();
    ctx.moveTo(20, wy + phase);
    ctx.quadraticCurveTo(80, wy + phase - 10, 150, wy + phase);
    ctx.stroke();
  }
  // Shoreline foam where the sea meets the sand.
  ctx.strokeStyle = 'rgba(234, 246, 242, 0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(160, Math.max(y0, 0));
  ctx.lineTo(160, Math.min(y1, 2440));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(234, 246, 242, 0.35)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(164 + Math.sin(t * 0.9) * 3, Math.max(y0, 0));
  ctx.lineTo(164 + Math.sin(t * 0.9) * 3, Math.min(y1, 2440));
  ctx.stroke();

  // Land: warm ground, sand on the beach, wet sand by the water.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(Math.max(x0, 160), y0, x1 - Math.max(x0, 160), Math.min(y1, 2440) - y0);
  const sandGrad = ctx.createLinearGradient(160, 0, 640, 0);
  sandGrad.addColorStop(0, PALETTE.sandWet);
  sandGrad.addColorStop(0.25, PALETTE.sand);
  sandGrad.addColorStop(1, PALETTE.sand);
  ctx.fillStyle = sandGrad;
  ctx.fillRect(Math.max(x0, 160), y0, Math.min(x1, 640) - Math.max(x0, 160), Math.min(y1, 2440) - y0);
}

function drawRoads(ctx, world, cam) {
  const { x, y, viewW, viewH } = cam;
  const x0 = x - 20;
  const y0 = y - 20;
  const x1 = x + viewW + 20;
  const y1 = y + viewH + 20;

  // Sidewalks: pale strips hugging every road.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of AVENUES) {
    if (ax < x0 || ax > x1) continue;
    ctx.fillRect(ax - 64, Math.max(y0, 120), 128, Math.min(y1, 2440) - Math.max(y0, 120));
  }
  for (const sy of STREETS) {
    if (sy < y0 || sy > y1) continue;
    ctx.fillRect(Math.max(x0, 120), sy - 64, Math.min(x1, 3720) - Math.max(x0, 120), 128);
  }
  // Asphalt.
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) {
    if (ax < x0 || ax > x1) continue;
    ctx.fillRect(ax - 48, Math.max(y0, 120), 96, Math.min(y1, 2440) - Math.max(y0, 120));
  }
  for (const sy of STREETS) {
    if (sy < y0 || sy > y1) continue;
    ctx.fillRect(Math.max(x0, 120), sy - 48, Math.min(x1, 3720) - Math.max(x0, 120), 96);
  }
  // Edge lines and golden centre dashes.
  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = 3;
  for (const ax of AVENUES) {
    if (ax < x0 || ax > x1) continue;
    ctx.beginPath(); ctx.moveTo(ax - 46, Math.max(y0, 120)); ctx.lineTo(ax - 46, Math.min(y1, 2440)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + 46, Math.max(y0, 120)); ctx.lineTo(ax + 46, Math.min(y1, 2440)); ctx.stroke();
  }
  for (const sy of STREETS) {
    if (sy < y0 || sy > y1) continue;
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 120), sy - 46); ctx.lineTo(Math.min(x1, 3720), sy - 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 120), sy + 46); ctx.lineTo(Math.min(x1, 3720), sy + 46); ctx.stroke();
  }
  ctx.strokeStyle = PALETTE.laneDash;
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 30]);
  for (const ax of AVENUES) {
    if (ax < x0 || ax > x1) continue;
    ctx.beginPath(); ctx.moveTo(ax, Math.max(y0, 120)); ctx.lineTo(ax, Math.min(y1, 2440)); ctx.stroke();
  }
  for (const sy of STREETS) {
    if (sy < y0 || sy > y1) continue;
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 120), sy); ctx.lineTo(Math.min(x1, 3720), sy); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const ax of AVENUES) {
    if (ax < x0 || ax > x1) continue;
    for (const sy of STREETS) {
      if (sy < y0 || sy > y1) continue;
      for (let s = -40; s <= 40; s += 16) {
        ctx.fillRect(ax - 44 + s, sy - 44, 8, 88);
      }
      for (let s = -40; s <= 40; s += 16) {
        ctx.fillRect(ax - 44, sy - 44 + s, 88, 8);
      }
    }
  }
  // Readable street labels, right on the asphalt, on a dark pill so the
  // lane dashes never strike through the text.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < AVENUES.length; i += 1) {
    const ax = AVENUES[i];
    if (ax < x0 || ax > x1) continue;
    for (let j = 1; j < STREETS.length - 1; j += 2) {
      const sy = STREETS[j];
      if (sy < y0 || sy > y1) continue;
      const cy = (STREETS[j] + STREETS[j + 1]) / 2;
      const w = ctx.measureText(AVENUE_NAMES[i]).width + 16;
      ctx.save();
      ctx.translate(ax, cy);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(10, 14, 22, 0.5)';
      roundRect(ctx, -w / 2, -11, w, 22, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(232, 228, 216, 0.9)';
      ctx.fillText(AVENUE_NAMES[i], 0, 0);
      ctx.restore();
    }
  }
  for (let j = 0; j < STREETS.length; j += 1) {
    const sy = STREETS[j];
    if (sy < y0 || sy > y1) continue;
    for (let i = 1; i < AVENUES.length - 1; i += 2) {
      const ax = AVENUES[i];
      if (ax < x0 || ax > x1) continue;
      const cx = (AVENUES[i] + AVENUES[i + 1]) / 2;
      const w = ctx.measureText(STREET_NAMES[j]).width + 16;
      ctx.fillStyle = 'rgba(10, 14, 22, 0.5)';
      roundRect(ctx, cx - w / 2, sy - 11, w, 22, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(232, 228, 216, 0.9)';
      ctx.fillText(STREET_NAMES[j], cx, sy);
    }
  }
}

function drawParksAndNature(ctx, world, cam, t) {
  const { city } = world;
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(park.x0, park.y0 + (park.y1 - park.y0) / 2 - 6, park.x1 - park.x0, 12);
    ctx.fillRect((park.x0 + park.x1) / 2 - 6, park.y0, 12, park.y1 - park.y0);
  }
  // Round trees: dark canopy, warm rim, long shadow.
  for (const tree of city.trees) {
    const sx = Math.cos(SUN.angle) * 10;
    const sy = Math.sin(SUN.angle) * 10;
    ctx.fillStyle = 'rgba(30, 20, 10, 0.25)';
    ctx.beginPath(); ctx.ellipse(tree.x + sx, tree.y + sy, tree.r, tree.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.grassDark;
    ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 220, 140, 0.35)';
    ctx.beginPath(); ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  // Palms: trunk + six fronds, swaying gently with the clock.
  for (const palm of city.palms) {
    const sway = Math.sin(t * 0.8 + palm.x * 0.01) * 3;
    ctx.strokeStyle = '#8a6b46';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y + 14); ctx.lineTo(palm.x + sway, palm.y - 6); ctx.stroke();
    ctx.strokeStyle = PALETTE.grassDark;
    ctx.lineWidth = 4;
    for (let f = 0; f < 6; f += 1) {
      const a = (f / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(palm.x + sway, palm.y - 6);
      ctx.quadraticCurveTo(palm.x + sway + Math.cos(a) * 14, palm.y - 6 + Math.sin(a) * 14 - 6, palm.x + sway + Math.cos(a) * 22, palm.y - 6 + Math.sin(a) * 22 + 8);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30, 20, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(palm.x + 8, palm.y + 12, 16, 6, 0.4, 0, Math.PI * 2); ctx.fill();
  }
  // Beach umbrellas: striped parasols with a warm shadow.
  for (const um of city.umbrellas) {
    ctx.fillStyle = 'rgba(30, 20, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(um.x + 8, um.y + 8, 18, 7, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = um.color;
    ctx.beginPath(); ctx.arc(um.x, um.y, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath(); ctx.moveTo(um.x, um.y); ctx.arc(um.x, um.y, 17, -0.6, 0.6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(um.x, um.y); ctx.arc(um.x, um.y, 17, Math.PI - 0.6, Math.PI + 0.6); ctx.closePath(); ctx.fill();
  }
  // Boats: hull, cabin, and a pale reflection streak on the water.
  for (const boat of city.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(-26, 10, 52, 8);
    ctx.fillStyle = boat.color;
    roundRect(ctx, -26, -9, 52, 18, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(30, 50, 70, 0.75)';
    roundRect(ctx, -8, -5, 18, 10, 3);
    ctx.fill();
    ctx.restore();
  }
  // Docks: wooden piers reaching into the marina.
  for (const dock of city.docks) {
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2;
    for (let py = dock.y + 12; py < dock.y + dock.h; py += 14) {
      ctx.beginPath(); ctx.moveTo(dock.x, py); ctx.lineTo(dock.x + dock.w, py); ctx.stroke();
    }
  }
}

function drawPort(ctx, world, cam) {
  for (const c of world.city.containers) {
    ctx.fillStyle = 'rgba(30, 20, 10, 0.25)';
    ctx.fillRect(c.x + 5, c.y + 6, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    for (let rx = c.x + 10; rx < c.x + c.w - 4; rx += 12) {
      ctx.beginPath(); ctx.moveTo(rx, c.y + 2); ctx.lineTo(rx, c.y + c.h - 2); ctx.stroke();
    }
  }
}

function drawBuildings(ctx, world, cam, t) {
  const sx = Math.cos(SUN.angle);
  const sy = Math.sin(SUN.angle);
  for (const b of world.city.buildings) {
    const shadowLen = SUN.length * b.hgt;
    // Long golden-hour shadow, cast down-left from the roof.
    ctx.fillStyle = 'rgba(40, 20, 8, 0.28)';
    ctx.beginPath();
    ctx.moveTo(b.x + sx * shadowLen, b.y + sy * shadowLen);
    ctx.lineTo(b.x + b.w + sx * shadowLen, b.y + sy * shadowLen);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
    // Sun-facing wall: a sliver of facade below the roof.
    ctx.fillStyle = PALETTE.buildingWall[b.roof];
    ctx.fillRect(b.x + 4, b.y + b.h - 6, b.w - 8, 10);
    // Lit windows along the wall, flickering on as the sun drops.
    ctx.fillStyle = PALETTE.windowLit;
    for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 22) {
      if (((wx * 7 + b.y) % 3) === 0) ctx.fillRect(wx, b.y + b.h - 4, 12, 6);
    }
    // The roof: paneled, not flat — a grid of panels with a parapet edge.
    ctx.fillStyle = PALETTE.buildingRoof[b.roof];
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 2;
    const panel = b.kind === 'tower' ? 28 : 24;
    for (let px = b.x + panel; px < b.x + b.w - 2; px += panel) {
      ctx.beginPath(); ctx.moveTo(px, b.y + 3); ctx.lineTo(px, b.y + b.h - 3); ctx.stroke();
    }
    for (let py = b.y + panel; py < b.y + b.h - 2; py += panel) {
      ctx.beginPath(); ctx.moveTo(b.x + 3, py); ctx.lineTo(b.x + b.w - 3, py); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    // Rooftop clutter: AC units and vents, casting their own tiny shadows.
    const units = b.kind === 'tower' ? 4 : 2;
    for (let u = 0; u < units; u += 1) {
      const ux = b.x + 14 + ((u * 37 + b.y) % Math.max(20, b.w - 40));
      const uy = b.y + 12 + ((u * 53) % Math.max(20, b.h - 40));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(ux + 3, uy + 3, 16, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillRect(ux, uy, 16, 12);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(ux + 3, uy + 3, 10, 7);
    }
    // Towers get a helipad ring on the roof.
    if (b.kind === 'tower') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2);
    }
    // Neon sign: glowing text floating over the roof.
    if (b.sign) {
      const neon = PALETTE.neon[(b.x + b.y) % PALETTE.neon.length];
      const pulse = 0.75 + Math.sin(t * 2.4 + b.x * 0.01) * 0.25;
      ctx.save();
      ctx.shadowColor = neon;
      ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = neon;
      ctx.font = `bold ${b.kind === 'tower' ? 26 : 19}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 - (b.kind === 'tower' ? 0 : 0));
      ctx.restore();
    }
  }
}

function drawPickups(ctx, world, cam, t) {
  const m = world.mission;
  if (m.phase !== 'active') return;
  const job = JOBS[m.job];
  if (!job || job.kind !== 'collect') return;
  // Mission packages: glowing amber crates, bobbing gently.
  for (const pkg of job.packages) {
    if (pkg.taken) continue;
    const bob = Math.sin(t * 3 + pkg.x * 0.01) * 3;
    ctx.fillStyle = 'rgba(30, 18, 8, 0.3)';
    ctx.beginPath(); ctx.ellipse(pkg.x + 4, pkg.y + 6, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(pkg.x - 12, pkg.y - 12 + bob, 24, 24);
    ctx.strokeStyle = '#8a6420';
    ctx.lineWidth = 2;
    ctx.strokeRect(pkg.x - 12, pkg.y - 12 + bob, 24, 24);
    ctx.beginPath(); ctx.moveTo(pkg.x - 12, pkg.y + bob); ctx.lineTo(pkg.x + 12, pkg.y + bob); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', pkg.x, pkg.y + bob);
  }
}

function drawCars(ctx, world, cam, t) {
  const all = [...world.cars, ...world.cops];
  for (const car of all) {
    const isPlayer = car.kind === 'player';
    const isCop = car.kind === 'police';
    // Shadow under the car, stretched by the low sun.
    ctx.fillStyle = 'rgba(30, 18, 8, 0.35)';
    ctx.save();
    ctx.translate(car.x + Math.cos(SUN.angle) * 10, car.y + Math.sin(SUN.angle) * 10);
    ctx.rotate(car.angle);
    roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 8);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Body with a warm roof highlight.
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    roundRect(ctx, -car.length / 2 + 3, -car.width / 2 + 2, car.length - 6, 8, 4);
    ctx.fill();
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(20, 40, 60, 0.85)';
    roundRect(ctx, car.length / 2 - 16, -car.width / 2 + 3, 9, car.width - 6, 3);
    ctx.fill();
    roundRect(ctx, -car.length / 2 + 7, -car.width / 2 + 3, 8, car.width - 6, 3);
    ctx.fill();
    if (isCop) {
      // PD livery: white doors, black hood, flashing light bar.
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-6, -car.width / 2, 14, car.width);
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(-car.length / 2, -car.width / 2, 10, car.width);
      const flash = Math.sin(t * 10 + (car.flash || 0) * 6) > 0;
      ctx.fillStyle = flash ? '#ff2e4d' : '#2e7dff';
      ctx.beginPath(); ctx.arc(0, -car.width / 2 + 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#2e7dff' : '#ff2e4d';
      ctx.beginPath(); ctx.arc(0, car.width / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PD', 2, 0);
    }
    if (isPlayer) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DANA', 0, 0);
    }
    // Headlights ahead, brake lights when slowing.
    ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
    ctx.beginPath(); ctx.arc(car.length / 2, -car.width / 2 + 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(car.length / 2, car.width / 2 - 5, 3, 0, Math.PI * 2); ctx.fill();
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2e4d';
      ctx.beginPath(); ctx.arc(-car.length / 2, -car.width / 2 + 5, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-car.length / 2, car.width / 2 - 5, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // The player on foot: a small figure with a warm shadow.
  const p = world.player;
  if (p.onFoot) {
    ctx.fillStyle = 'rgba(30, 18, 8, 0.35)';
    ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 8, 12, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath(); ctx.arc(4, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(8, -4, 6, 8);
    ctx.restore();
  }
}

function drawPeds(ctx, world, cam, t) {
  for (const ped of world.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(30, 18, 8, 0.3)';
      ctx.beginPath(); ctx.ellipse(2, 3, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(30, 18, 8, 0.3)';
      ctx.beginPath(); ctx.ellipse(3, 4, 9, 4, 0.4, 0, Math.PI * 2); ctx.fill();
      const bob = Math.sin(t * 9 + ped.x * 0.05) * 1.5;
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, bob * 0.3, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath(); ctx.arc(0, bob * 0.3, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawBullets(ctx, world, cam) {
  ctx.fillStyle = '#ffe14d';
  for (const b of world.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 225, 77, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14); ctx.stroke();
  }
}

function drawParticles(ctx, world, cam) {
  for (const part of world.particles) {
    ctx.globalAlpha = Math.max(0, part.life * 1.6);
    ctx.fillStyle = part.color;
    ctx.beginPath(); ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawObjectiveMarker(ctx, world, cam, t) {
  const job = world.objective;
  if (!job || world.mission.phase !== 'active') return;
  const pulse = 0.6 + Math.sin(t * 4) * 0.4;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 215, 94, ${0.5 + pulse * 0.5})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(job.x, job.y, 30 + pulse * 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.moveTo(job.x, job.y - 46 - pulse * 6);
  ctx.lineTo(job.x + 10, job.y - 30);
  ctx.lineTo(job.x - 10, job.y - 30);
  ctx.closePath();
  ctx.fill();
  // The place name on a dark pill, so the objective reads at a glance.
  ctx.font = 'bold 16px system-ui, sans-serif';
  const w = ctx.measureText(job.label).width + 28;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  roundRect(ctx, job.x - w / 2, job.y - 84 - pulse * 6, w, 28, 9);
  ctx.fill();
  ctx.fillStyle = '#ffd75e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`◆ ${job.label}`, job.x, job.y - 70 - pulse * 6);
  ctx.restore();
}

function drawHUD(ctx, world, width, height) {
  const p = world.player;
  const m = world.mission;
  // Top-left: cash, health, ammo.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
  roundRect(ctx, 16, 14, 240, 92, 12);
  ctx.fill();
  ctx.fillStyle = PALETTE.cash;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${world.cash.toLocaleString('en-US')}`, 30, 38);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('CASH', 30, 60);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  roundRect(ctx, 30, 72, 150, 10, 5);
  ctx.fill();
  ctx.fillStyle = PALETTE.health;
  roundRect(ctx, 30, 72, Math.max(0, 150 * (p.health / 100)), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`AMMO ${p.ammo}`, 190, 77);
  // Top-center: the mission banner.
  const banner = world.message || (m.phase === 'brief' ? 'Press Space to start Job 1' : '');
  if (banner) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    const bw = ctx.measureText(banner).width + 36;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
    roundRect(ctx, width / 2 - bw / 2, 14, bw, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.textAlign = 'center';
    ctx.fillText(banner, width / 2, 35);
  }
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
  roundRect(ctx, width - 196, 14, 180, 40, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WANTED', width - 184, 35);
  for (let s = 0; s < 5; s += 1) {
    ctx.fillStyle = s < world.wanted ? PALETTE.wanted : 'rgba(255, 255, 255, 0.25)';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('★', width - 118 + s * 20, 35);
  }
  // Bottom-left: speed and the current street.
  const street = streetLabel(world);
  ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
  roundRect(ctx, 16, height - 66, 320, 50, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(p.speed * 0.36)} km/h`, 30, height - 40);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText(street, 150, height - 40);
  // Bottom-center: the objective line.
  if (world.objective && m.phase === 'active') {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const ow = ctx.measureText(world.objective.text).width + 32;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.55)';
    roundRect(ctx, width / 2 - ow / 2, height - 52, ow, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(world.objective.text, width / 2, height - 34);
  }
  drawMinimap(ctx, world, width, height);
}

function streetLabel(world) {
  const p = world.player;
  let bestA = null;
  let bestS = null;
  for (let i = 0; i < AVENUES.length; i += 1) {
    const d = Math.abs(p.x - AVENUES[i]);
    if (bestA === null || d < bestA.d) bestA = { d, i };
  }
  for (let j = 0; j < STREETS.length; j += 1) {
    const d = Math.abs(p.y - STREETS[j]);
    if (bestS === null || d < bestS.d) bestS = { d, j };
  }
  if (bestA.d < bestS.d) return AVENUE_NAMES[bestA.i];
  return STREET_NAMES[bestS.j];
}

function drawMinimap(ctx, world, width, height) {
  const mw = 230;
  const mh = 154;
  const mx = width - mw - 16;
  const my = height - mh - 16;
  const sx = mw / WORLD.width;
  const sy = mh / WORLD.height;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.7)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  // Ocean and beach on the west edge, ground elsewhere.
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(mx, my, 160 * sx, mh);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(mx + 160 * sx, my, (640 - 160) * sx, mh);
  ctx.fillStyle = 'rgba(232, 201, 143, 0.9)';
  ctx.fillRect(mx + 640 * sx, my, mw - 640 * sx, mh);
  // Roads as thin lines.
  ctx.strokeStyle = 'rgba(61, 65, 78, 0.9)';
  ctx.lineWidth = 1.5;
  for (const ax of AVENUES) {
    ctx.beginPath(); ctx.moveTo(mx + ax * sx, my); ctx.lineTo(mx + ax * sx, my + mh); ctx.stroke();
  }
  for (const sy2 of STREETS) {
    ctx.beginPath(); ctx.moveTo(mx, my + sy2 * sy); ctx.lineTo(mx + mw, my + sy2 * sy); ctx.stroke();
  }
  // The objective: a pulsing gold dot.
  const job = world.objective;
  if (job && world.mission.phase === 'active') {
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath(); ctx.arc(mx + job.x * sx, my + job.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 94, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx + job.x * sx, my + job.y * sy, 8, 0, Math.PI * 2); ctx.stroke();
  }
  // Cops as blue dots, the player as a white ring.
  ctx.fillStyle = '#2e7dff';
  for (const cop of world.cops) {
    ctx.beginPath(); ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VIREO BAY', mx + 2, my - 12);
}

function dimScreen(ctx, width, height) {
  ctx.fillStyle = 'rgba(10, 10, 24, 0.55)';
  ctx.fillRect(0, 0, width, height);
}

function drawTitle(ctx, world, width, height) {
  // A golden sky over the city, then the big title.
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, 'rgba(255, 154, 61, 0.88)');
  sky.addColorStop(0.5, 'rgba(255, 126, 95, 0.72)');
  sky.addColorStop(1, 'rgba(254, 180, 123, 0.55)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  // The low sun, glowing over the bay.
  const sun = ctx.createRadialGradient(width * 0.72, height * 0.2, 10, width * 0.72, height * 0.2, 220);
  sun.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  sun.addColorStop(0.4, 'rgba(255, 200, 110, 0.5)');
  sun.addColorStop(1, 'rgba(255, 200, 110, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#fff';
  ctx.font = '900 96px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VIREO BAY', width / 2, height * 0.3);
  ctx.restore();
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('GTA 6 · A Vice City story', width / 2, height * 0.3 + 62);
  ctx.fillStyle = '#fff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Dana Voss owes the Bay Syndicate $5,000. Four jobs. One fast car.', width / 2, height * 0.46);
  ctx.fillText('Steal cars, lose the cops, run the jobs, pay the debt.', width / 2, height * 0.46 + 28);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('WASD drive & walk · E enter / steal a car · Space punch · F shoot · P pause', width / 2, height * 0.58);
  if (world.best > 0) {
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`Best haul yet: $${world.best.toLocaleString('en-US')}`, width / 2, height * 0.64);
  }
  const blink = Math.sin(world.time * 3) > -0.2;
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('Press Space or click to start', width / 2, height * 0.74);
  }
}

function drawPaused(ctx, world, width, height) {
  dimScreen(ctx, width, height);
  ctx.fillStyle = '#fff';
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', width / 2, height / 2 - 30);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('Press P to keep driving', width / 2, height / 2 + 20);
}

function drawOver(ctx, world, width, height) {
  dimScreen(ctx, width, height);
  const won = world.won;
  ctx.fillStyle = won ? '#7dff5e' : '#ff5e5e';
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(won ? 'DEBT PAID' : 'BUSTED', width / 2, height / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(
    won ? 'Vireo Bay is yours, Dana.' : 'The cops caught up with Dana.',
    width / 2, height / 2 + 8,
  );
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffd75e';
  ctx.fillText(`Haul: $${world.cash.toLocaleString('en-US')}`, width / 2, height / 2 + 48);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Press Space to play again', width / 2, height / 2 + 88);
}
