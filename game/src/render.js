// The golden-hour renderer for Vireo Bay: a warm sun wash, long shadows,
// paneled rooftops, neon signs, beach, marina and port districts, street
// label pills, a minimap and a full HUD. Everything is canvas 2D, drawn
// fresh every frame from the world state.
import { SUN, PALETTE, JOBS, WANTED_MAX, WORLD_W, WORLD_H } from './config.js';
import { roadX, roadY, streetAt, blockAt } from './city.js';
import { jobLabel } from './missions.js';
import { clamp } from './random.js';

const VIEW_W = 1280;
const VIEW_H = 720;

// Long shadows point north-east: the sun sits low in the south-west.
const SHADOW_DX = SUN.length * 0.8;
const SHADOW_DY = -SUN.length * 0.55;

export function render(ctx, world, w, h) {
  const W = w || VIEW_W;
  const H = h || VIEW_H;
  ctx.clearRect(0, 0, W, H);
  if (world.screen === 'title') {
    drawWorld(ctx, world, W, H);
    drawSunWash(ctx, W, H);
    drawTitle(ctx, world, W, H);
    return;
  }
  drawWorld(ctx, world, W, H);
  drawSunWash(ctx, W, H);
  drawHUD(ctx, world, W, H);
  if (world.screen === 'pause') drawPause(ctx, W, H);
  if (world.over) drawEnd(ctx, world, W, H);
}

function drawWorld(ctx, world, W, H) {
  const cam = world.camera;
  ctx.save();
  ctx.translate(W / 2 - cam.x, H / 2 - cam.y);
  const vx0 = cam.x - W / 2 - 80;
  const vy0 = cam.y - H / 2 - 80;
  const vx1 = cam.x + W / 2 + 80;
  const vy1 = cam.y + H / 2 + 80;
  // Ground: warm grass base for the whole city.
  ctx.fillStyle = '#8aa864';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  const city = world.city;
  // District ground.
  for (const b of city.blocks) {
    if (b.x1 < vx0 || b.x0 > vx1 || b.y1 < vy0 || b.y0 > vy1) continue;
    if (b.kind === 'beach') {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    } else if (b.kind === 'marina') {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    } else if (b.kind === 'port' || b.kind === 'docks') {
      ctx.fillStyle = '#9a8a72';
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    } else if (b.kind === 'plaza') {
      ctx.fillStyle = PALETTE.plaza;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    } else if (b.kind === 'park') {
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    } else {
      ctx.fillStyle = '#b09872';
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
  }
  drawRoads(ctx, vx0, vy0, vx1, vy1);
  for (const b of city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    drawBuilding(ctx, b);
  }
  for (const pr of city.props) {
    if (pr.x < vx0 - 60 || pr.x > vx1 + 60 || pr.y < vy0 - 60 || pr.y > vy1 + 60) continue;
    drawProp(ctx, pr);
  }
  // Objective ring under the current job target.
  const target = world.job.target;
  if (target && !world.job.done) {
    const pulse = 1 + Math.sin(world.time * 3) * 0.12;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of world.cars) drawCar(ctx, car, car.isPlayer, false);
  for (const cop of world.police) drawCar(ctx, cop, false, true);
  for (const ped of world.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color);
  drawPlayer(ctx, world);
  for (const b of world.bullets) {
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of world.parts) {
    const a = clamp(pt.life / pt.max, 0, 1);
    if (pt.kind === 'flash') {
      ctx.fillStyle = 'rgba(255, 226, 122,' + a + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * a + 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'smoke') {
      ctx.fillStyle = 'rgba(120, 120, 120,' + (a * 0.6) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.4 - a * 0.4), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(200, 180, 140,' + (a * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawRoads(ctx, vx0, vy0, vx1, vy1) {
  // Asphalt with pale edges and dashed centre lines.
  ctx.fillStyle = PALETTE.road;
  for (let c = 0; c <= 6; c++) {
    const x = roadX(c);
    if (x < vx0 - 40 || x > vx1 + 40) continue;
    ctx.fillRect(x - 32, vy0, 64, vy1 - vy0);
  }
  for (let r = 0; r <= 5; r++) {
    const y = roadY(r);
    if (y < vy0 - 40 || y > vy1 + 40) continue;
    ctx.fillRect(vx0, y - 32, vx1 - vx0, 64);
  }
  // Sidewalk strips.
  ctx.fillStyle = PALETTE.sidewalk;
  for (let c = 0; c <= 6; c++) {
    const x = roadX(c);
    if (x < vx0 - 40 || x > vx1 + 40) continue;
    ctx.fillRect(x - 40, vy0, 8, vy1 - vy0);
    ctx.fillRect(x + 32, vy0, 8, vy1 - vy0);
  }
  for (let r = 0; r <= 5; r++) {
    const y = roadY(r);
    if (y < vy0 - 40 || y > vy1 + 40) continue;
    ctx.fillRect(vx0, y - 40, vx1 - vx0, 8);
    ctx.fillRect(vx0, y + 32, vx1 - vx0, 8);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8c85a';
  for (let c = 0; c <= 6; c++) {
    const x = roadX(c);
    if (x < vx0 - 40 || x > vx1 + 40) continue;
    for (let y = Math.floor(vy0 / 44) * 44; y < vy1; y += 44) {
      ctx.fillRect(x - 2, y, 4, 22);
    }
  }
  for (let r = 0; r <= 5; r++) {
    const y = roadY(r);
    if (y < vy0 - 40 || y > vy1 + 40) continue;
    for (let x = Math.floor(vx0 / 44) * 44; x < vx1; x += 44) {
      ctx.fillRect(x, y - 2, 22, 4);
    }
  }
}

function drawBuilding(ctx, b) {
  // Long shadow first, then the walls, then the paneled roof.
  ctx.fillStyle = 'rgba(40, 20, 10, 0.28)';
  roundRect(ctx, b.x + SHADOW_DX, b.y + SHADOW_DY, b.w, b.h, 6);
  ctx.fill();
  ctx.fillStyle = b.wall;
  roundRect(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.fill();
  ctx.fillStyle = b.roof;
  roundRect(ctx, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 3);
  ctx.fill();
  // Roof panel seams.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 2;
  const cols = Math.max(2, b.panels);
  for (let i = 1; i < cols; i++) {
    const x = b.x + 6 + ((b.w - 12) * i) / cols;
    ctx.beginPath();
    ctx.moveTo(x, b.y + 8);
    ctx.lineTo(x, b.y + b.h - 8);
    ctx.stroke();
  }
  for (let j = 1; j < 3; j++) {
    const y = b.y + 6 + ((b.h - 12) * j) / 3;
    ctx.beginPath();
    ctx.moveTo(b.x + 8, y);
    ctx.lineTo(b.x + b.w - 8, y);
    ctx.stroke();
  }
  // AC units as small grey boxes with a fan dot.
  ctx.fillStyle = '#c8c8c8';
  for (let i = 0; i < b.ac; i++) {
    const ax = b.x + 14 + i * 26;
    const ay = b.y + 14 + (i % 2) * 22;
    if (ax + 16 > b.x + b.w - 10 || ay + 14 > b.y + b.h - 10) continue;
    ctx.fillRect(ax, ay, 16, 14);
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.arc(ax + 8, ay + 7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8c8c8';
  }
  // Helipad: a ringed circle with a big H.
  if (b.helipad) {
    const hx = b.x + b.w / 2;
    const hy = b.y + b.h / 2;
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', hx, hy + 1);
  }
  // Neon sign glowing on the front face.
  if (b.sign) {
    ctx.save();
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff5aa0';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h + 14);
    ctx.restore();
  }
}

function drawProp(ctx, pr) {
  if (pr.type === 'water') {
    const g = ctx.createLinearGradient(pr.x, pr.y, pr.x, pr.y + pr.h);
    g.addColorStop(0, PALETTE.water);
    g.addColorStop(1, PALETTE.waterDeep);
    ctx.fillStyle = g;
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const wy = pr.y + 20 + i * 26;
      ctx.beginPath();
      ctx.moveTo(pr.x + 10, wy);
      ctx.lineTo(pr.x + pr.w - 10, wy);
      ctx.stroke();
    }
    return;
  }
  if (pr.type === 'pier') {
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 2;
    for (let y = pr.y + 12; y < pr.y + pr.h; y += 18) {
      ctx.beginPath();
      ctx.moveTo(pr.x, y);
      ctx.lineTo(pr.x + pr.w, y);
      ctx.stroke();
    }
    return;
  }
  if (pr.type === 'boat') {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle || 0);
    ctx.fillStyle = pr.color;
    roundRect(ctx, -26, -9, 52, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-6, -14, 12, 10);
    ctx.restore();
    return;
  }
  if (pr.type === 'container') {
    ctx.fillStyle = pr.color;
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pr.x, pr.y, pr.w, pr.h);
    ctx.beginPath();
    ctx.moveTo(pr.x + pr.w / 2, pr.y);
    ctx.lineTo(pr.x + pr.w / 2, pr.y + pr.h);
    ctx.stroke();
    return;
  }
  if (pr.type === 'palm' || pr.type === 'tree') {
    const s = pr.s || 1;
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(pr.x, pr.y);
    ctx.lineTo(pr.x + 4 * s, pr.y - 16 * s);
    ctx.stroke();
    ctx.fillStyle = pr.type === 'palm' ? '#3f9e4d' : '#4a8a3f';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(pr.x + 4 * s + Math.cos(a) * 10 * s, pr.y - 16 * s + Math.sin(a) * 6 * s, 12 * s, 5 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (pr.type === 'umbrella') {
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, 16, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pr.x, pr.y);
    ctx.lineTo(pr.x, pr.y + 16);
    ctx.stroke();
    return;
  }
  if (pr.type === 'fountain') {
    ctx.fillStyle = '#7ab8d8';
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8ecf8';
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (pr.type === 'pond') {
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (pr.type === 'bench') {
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(pr.x - 16, pr.y - 5, 32, 10);
    return;
  }
  if (pr.type === 'lamp') {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(pr.x - 2, pr.y - 10, 4, 20);
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath();
    ctx.arc(pr.x, pr.y - 12, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (pr.type === 'hideout') {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
}

function drawCar(ctx, car, isPlayer, isPolice) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(20, 10, 5, 0.3)';
  roundRect(ctx, -20 + SHADOW_DX * 0.4, -8 + SHADOW_DY * 0.4, 46, 22, 8);
  ctx.fill();
  const body = isPolice ? '#2244aa' : car.color;
  ctx.fillStyle = body;
  roundRect(ctx, -23, -11, 46, 22, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -8, -9, 16, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#cfe8ff';
  roundRect(ctx, 8, -8, 8, 16, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(21, -9, 3, 4);
  ctx.fillRect(21, 5, 3, 4);
  if (isPlayer) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DANA', 0, -16);
  }
  if (isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    // Light bar flashing.
    const on = Math.floor(Date.now() / 300) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-14, -11, 8, 4);
    ctx.fillStyle = on ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(6, -11, 8, 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20, 10, 5, 0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (p.car) return; // The car drawing already shows the player.
  drawPerson(ctx, p.x, p.y, p.angle, '#ff5a7a');
  // Punch arc flash.
  if (world.time - p.punchAt < 0.15) {
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, p.angle - 0.6, p.angle + 0.6);
    ctx.stroke();
  }
}

// Warm golden-hour wash over the whole frame.
function drawSunWash(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255, 170, 90, 0.15)');
  g.addColorStop(0.6, 'rgba(255, 150, 80, 0.08)');
  g.addColorStop(1, 'rgba(255, 120, 60, 0.20)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.78, H * 0.12, 10, W * 0.78, H * 0.12, 420);
  sun.addColorStop(0, 'rgba(255, 220, 140, 0.28)');
  sun.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
}

function drawHUD(ctx, world, W, H) {
  const p = world.player;
  // Top-left: cash, health, ammo.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  roundRect(ctx, 16, 12, 280, 64, 12);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('$' + p.cash, 30, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('CASH', 30, 58);
  ctx.fillStyle = '#222';
  roundRect(ctx, 118, 26, 120, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#4ade80' : '#ff5a5a';
  roundRect(ctx, 118, 26, 120 * clamp(p.health / 100, 0, 1), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(Math.round(p.health) + '  AMMO ' + p.ammo, 118, 58);
  // Top-centre: job banner.
  const label = jobLabel(world);
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  const bw = 460;
  roundRect(ctx, W / 2 - bw / 2, 12, bw, 56, 12);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label.split(' — ')[0], W / 2, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(label.split(' — ')[1] || '', W / 2, 58);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  roundRect(ctx, W - 216, 12, 200, 48, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WANTED', W - 202, 42);
  let stars = '';
  for (let i = 0; i < WANTED_MAX; i++) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = '#ffd23f';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(stars, W - 128, 44);
  // Bottom-left: speed and the current street.
  const street = streetAt(p.x, p.y);
  ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
  roundRect(ctx, 16, H - 66, 250, 50, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(Math.round(Math.abs(p.speed || 0) * 0.36) + ' km/h', 30, H - 40);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText(street, 130, H - 40);
  // Bottom-centre: the objective line.
  if (world.job.target && !world.job.done) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tx = '◆ ' + world.job.target.label;
    const tw = ctx.measureText(tx).width + 28;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
    roundRect(ctx, W / 2 - tw / 2, H - 60, tw, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(tx, W / 2, H - 36);
  }
  // Message line above the objective.
  if (world.message) {
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(world.message, W / 2, H - 76);
  }
  // Controls hint.
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const hint = p.car ? 'WASD — drive   E — get out   Space — handbrake' : 'WASD — move   E — enter car   Space — punch   F — shoot';
  ctx.fillText(hint, 16, H - 78);
  drawMinimap(ctx, world, W, H);
}

function drawMinimap(ctx, world, W, H) {
  const mw = 200;
  const mh = 132;
  const mx = W - mw - 16;
  const my = H - mh - 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.78)';
  roundRect(ctx, mx - 6, my - 22, mw + 12, mh + 28, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VIREO BAY', mx, my - 8);
  for (const b of world.city.blocks) {
    ctx.fillStyle = b.kind === 'beach' ? '#e8c98a' : b.kind === 'marina' ? '#2e7f9e' : b.kind === 'port' || b.kind === 'docks' ? '#8a7a5a' : b.kind === 'downtown' ? '#8a7aa0' : '#6a8a5a';
    ctx.fillRect(mx + b.x0 * sx, my + b.y0 * sy, (b.x1 - b.x0) * sx, (b.y1 - b.y0) * sy);
  }
  // Roads.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let c = 0; c <= 6; c++) ctx.fillRect(mx + roadX(c) * sx - 1, my, 2, mh);
  for (let r = 0; r <= 5; r++) ctx.fillRect(mx, my + roadY(r) * sy - 1, mw, 2);
  // Objective.
  const target = world.job.target;
  if (target && !world.job.done) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#3b82ff';
  for (const cop of world.police) {
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const p = world.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 6, 0, Math.PI * 2);
  ctx.stroke();
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  const cam = world.camera;
  ctx.strokeRect(mx + (cam.x - 640) * sx, my + (cam.y - 360) * sy, 1280 * sx, 720 * sy);
}

function drawTitle(ctx, world, W, H) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const pw = 640;
  const ph = 380;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.88)';
  roundRect(ctx, W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 18);
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3;
  roundRect(ctx, W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 18);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 74px system-ui, sans-serif';
  ctx.fillText('VIREO BAY', W / 2, H / 2 - 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('An open-world crime game in a sun-soaked bay city.', W / 2, H / 2 - 44);
  ctx.fillText('Dana Voss owes the Bay Syndicate $5,000. Four jobs. One fast car.', W / 2, H / 2 - 14);
  ctx.fillText('Steal cars, lose the cops, run the jobs, pay the debt.', W / 2, H / 2 + 16);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD drive & walk · E enter / steal a car · Space punch · F shoot · P pause', W / 2, H / 2 + 56);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Best haul yet: $' + world.player.best, W / 2, H / 2 + 86);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px system-ui, sans-serif';
  const blink = Math.floor(world.time * 2) % 2 === 0;
  if (blink) ctx.fillText('Press Space or click to start', W / 2, H / 2 + 132);
}

function drawPause(ctx, W, H) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Press P to keep playing', W / 2, H / 2 + 36);
}

function drawEnd(ctx, world, W, H) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  if (world.won) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('DEBT PAID!', W / 2, H / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Dana Voss is free. Vireo Bay is yours — $' + world.player.cash + ' hauled.', W / 2, H / 2 + 20);
  } else {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('BUSTED', W / 2, H / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('The cops got Dana. Haul: $' + world.player.cash + ' — best: $' + world.player.best, W / 2, H / 2 + 20);
  }
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Press R to play again', W / 2, H / 2 + 56);
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
