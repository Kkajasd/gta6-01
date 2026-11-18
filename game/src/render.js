// Drawing only: the world's state and the current screen in, pixels out. The camera
// shows a 1280x720 window of the city, scaled to fit the browser window. Flat shapes,
// canvas text for the HUD and panels, and a live minimap of the whole city. Text that
// holds a number is rebuilt only when the number changes, so a frame allocates nothing.

import { CAR, FONT, PALETTE, PLAYER, ROAD, VIEW, WORLD } from './config.js';
import { MISSION_DEFS, objectiveText } from './missions.js';
import { ROAD_XS, ROAD_YS } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = { width: 230, height: 172, margin: 14 };
const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const moneyLabel = cachedLabel('$');
  const healthLabel = cachedLabel('');
  const ammoLabel = cachedLabel('');
  const speedLabel = cachedLabel('');
  const missionLabel = cachedLabel('');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.dpr = ratio;
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size + 1000)) fonts.set(size + 1000, `${size}px ${FONT}`);
    context.font = fonts.get(size + 1000);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  /** Screen pixels -> world coordinates, for aiming with the mouse. */
  function screenToWorld(sx, sy, camera) {
    const wx = (sx * view.dpr - view.x) / view.scale + camera.x - VIEW.width / 2;
    const wy = (sy * view.dpr - view.y) / view.scale + camera.y - VIEW.height / 2;
    return { x: wx, y: wy };
  }

  function drawGround(city, state) {
    // Grass base for the whole city.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach and water along the south shore: a gradient sea, two rows of
    // drifting wave lines, sand speckle, umbrellas, towels and palms.
    const sea = context.createLinearGradient(0, city.water.y, 0, city.water.y + city.water.height);
    sea.addColorStop(0, PALETTE.water);
    sea.addColorStop(1, PALETTE.waterDeep);
    context.fillStyle = PALETTE.sand;
    context.fillRect(city.beach.x, city.beach.y, city.beach.width, city.beach.height);
    context.fillStyle = 'rgba(120, 90, 40, 0.25)';
    if (city.beachProps) {
      for (const dot of city.beachProps.sand) {
        context.beginPath();
        context.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.fillStyle = sea;
    context.fillRect(city.water.x, city.water.y, city.water.width, city.water.height);
    // Wave lines that drift with time, in two rows plus sparkle near the shore.
    const wave = (state.elapsed * 22) % 60;
    for (let row = 0; row < 2; row += 1) {
      context.strokeStyle = `rgba(255,255,255,${0.5 - row * 0.18})`;
      context.lineWidth = 3;
      const wy = city.water.y + 34 + row * 26;
      for (let x = -60 + wave + row * 30; x < WORLD.width; x += 60) {
        context.beginPath();
        context.moveTo(x, wy);
        context.quadraticCurveTo(x + 15, wy - 8, x + 30, wy);
        context.stroke();
      }
    }
    if (city.boats) {
      for (const boat of city.boats) {
        context.save();
        context.translate(boat.x, boat.y);
        context.rotate(boat.angle);
        context.fillStyle = boat.color;
        context.beginPath();
        context.moveTo(-22, 0);
        context.lineTo(22, 0);
        context.lineTo(14, 12);
        context.lineTo(-14, 12);
        context.closePath();
        context.fill();
        context.strokeStyle = '#5a4632';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -20);
        context.stroke();
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.moveTo(0, -20);
        context.lineTo(0, -2);
        context.lineTo(13, -2);
        context.closePath();
        context.fill();
        context.restore();
      }
    }
    if (city.beachProps) {
      for (const towel of city.beachProps.towels) {
        context.save();
        context.translate(towel.x, towel.y);
        context.rotate(towel.angle);
        context.fillStyle = towel.color;
        context.fillRect(-14, -7, 28, 14);
        context.restore();
      }
      for (const umb of city.beachProps.umbrellas) {
        context.fillStyle = '#7a5b33';
        context.fillRect(umb.x - 1, umb.y - 4, 3, 16);
        context.fillStyle = umb.color;
        context.beginPath();
        context.arc(umb.x, umb.y - 2, 16, Math.PI, 0);
        context.closePath();
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.55)';
        context.beginPath();
        context.arc(umb.x, umb.y - 2, 16, Math.PI * 1.25, Math.PI * 1.6);
        context.closePath();
        context.fill();
      }
      for (const palm of city.beachProps.palms) {
        drawPalm(palm.x, palm.y);
      }
    }
    // Parks: darker green, a footpath, a pond, and seeded trees of varied size.
    for (let pi = 0; pi < city.parks.length; pi += 1) {
      const park = city.parks[pi];
      const detail = city.parkDetails ? city.parkDetails[pi] : null;
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.width, park.height);
      if (detail && detail.path) {
        context.strokeStyle = 'rgba(230, 210, 160, 0.8)';
        context.lineWidth = 12;
        context.beginPath();
        context.moveTo(park.x, park.y + park.height / 2);
        context.lineTo(park.x + park.width, park.y + park.height / 2);
        context.stroke();
        context.beginPath();
        context.moveTo(park.x + park.width / 2, park.y);
        context.lineTo(park.x + park.width / 2, park.y + park.height);
        context.stroke();
      }
      if (detail && detail.pond) {
        context.fillStyle = '#3f8fc4';
        context.beginPath();
        context.ellipse(detail.pond.x, detail.pond.y, detail.pond.rx, detail.pond.ry, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255,255,255,0.5)';
        context.lineWidth = 2;
        context.beginPath();
        context.ellipse(detail.pond.x, detail.pond.y, detail.pond.rx - 8, detail.pond.ry - 6, 0, 0, Math.PI * 2);
        context.stroke();
      }
      if (detail) {
        for (const t of detail.trees) drawTree(t.x, t.y, t.r);
      } else {
        context.fillStyle = '#4e7d38';
        const cols = Math.max(1, Math.floor(park.width / 90));
        const rows = Math.max(1, Math.floor(park.height / 90));
        for (let i = 0; i < cols; i += 1) {
          for (let j = 0; j < rows; j += 1) {
            context.beginPath();
            context.arc(park.x + 45 + i * 90, park.y + 45 + j * 90, 24, 0, Math.PI * 2);
            context.fill();
          }
        }
      }
    }
    // Plazas: pale paving with a tile grid and a fountain in the middle.
    for (let pi = 0; pi < city.plazas.length; pi += 1) {
      const plaza = city.plazas[pi];
      context.fillStyle = PALETTE.plaza;
      context.fillRect(plaza.x, plaza.y, plaza.width, plaza.height);
      context.strokeStyle = 'rgba(90, 80, 60, 0.25)';
      context.lineWidth = 2;
      for (let x = plaza.x + 48; x < plaza.x + plaza.width; x += 48) {
        context.beginPath();
        context.moveTo(x, plaza.y);
        context.lineTo(x, plaza.y + plaza.height);
        context.stroke();
      }
      for (let y = plaza.y + 48; y < plaza.y + plaza.height; y += 48) {
        context.beginPath();
        context.moveTo(plaza.x, y);
        context.lineTo(plaza.x + plaza.width, y);
        context.stroke();
      }
      const f = city.fountains ? city.fountains[pi] : null;
      if (f) {
        context.fillStyle = '#8d8578';
        context.beginPath();
        context.arc(f.x, f.y, f.r + 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#4aa3d8';
        context.beginPath();
        context.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#7cc4ec';
        context.beginPath();
        context.arc(f.x, f.y, f.r * 0.45, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.8)';
        for (let a = 0; a < 6; a += 1) {
          const ang = (a / 6) * Math.PI * 2 + (state.elapsed * 0.4) % 1;
          context.beginPath();
          context.arc(f.x + Math.cos(ang) * f.r * 0.7, f.y + Math.sin(ang) * f.r * 0.7, 3, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    // The docks: wooden pier with clear planks, stacked colourful containers.
    context.fillStyle = PALETTE.pier;
    context.fillRect(city.docks.x, city.docks.y, city.docks.width, city.docks.height);
    context.strokeStyle = '#6b4f33';
    context.lineWidth = 4;
    for (let y = city.docks.y + 30; y < city.docks.y + city.docks.height; y += 60) {
      context.beginPath();
      context.moveTo(city.docks.x, y);
      context.lineTo(city.docks.x + city.docks.width, y);
      context.stroke();
    }
    context.strokeStyle = 'rgba(107, 79, 51, 0.6)';
    context.lineWidth = 2;
    for (let x = city.docks.x + 30; x < city.docks.x + city.docks.width; x += 30) {
      context.beginPath();
      context.moveTo(x, city.docks.y);
      context.lineTo(x, city.docks.y + city.docks.height);
      context.stroke();
    }
    if (city.containers) {
      for (const c of city.containers) {
        context.fillStyle = c.color;
        context.fillRect(c.x, c.y, c.w, c.h);
        context.strokeStyle = 'rgba(0,0,0,0.35)';
        context.lineWidth = 2;
        context.strokeRect(c.x, c.y, c.w, c.h);
        context.strokeStyle = 'rgba(255,255,255,0.25)';
        context.beginPath();
        context.moveTo(c.x + 6, c.y + 6);
        context.lineTo(c.x + c.w - 6, c.y + 6);
        context.stroke();
      }
    }
    // Sidewalks, then roads, then lane dashes, crosswalks and tile seams.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROAD_XS) context.fillRect(rx - ROAD.width / 2 - 22, 0, ROAD.width + 44, WORLD.height);
    for (const ry of ROAD_YS) context.fillRect(0, ry - ROAD.width / 2 - 22, WORLD.width, ROAD.width + 44);
    context.strokeStyle = 'rgba(60, 60, 60, 0.18)';
    context.lineWidth = 2;
    for (const rx of ROAD_XS) {
      for (let y = 0; y < WORLD.height; y += 44) {
        context.beginPath();
        context.moveTo(rx - ROAD.width / 2 - 22, y);
        context.lineTo(rx + ROAD.width / 2 + 22, y);
        context.stroke();
      }
    }
    for (const ry of ROAD_YS) {
      for (let x = 0; x < WORLD.width; x += 44) {
        context.beginPath();
        context.moveTo(x, ry - ROAD.width / 2 - 22);
        context.lineTo(x, ry + ROAD.width / 2 + 22);
        context.stroke();
      }
    }
    context.fillStyle = PALETTE.road;
    for (const rx of ROAD_XS) context.fillRect(rx - ROAD.width / 2, 0, ROAD.width, WORLD.height);
    for (const ry of ROAD_YS) context.fillRect(0, ry - ROAD.width / 2, WORLD.width, ROAD.width);
    // Zebra crossings at every intersection, in both directions.
    context.fillStyle = 'rgba(255,255,255,0.5)';
    for (const rx of ROAD_XS) {
      for (const ry of ROAD_YS) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(rx + i * 16 - 5, ry - ROAD.width / 2 - 4, 10, 18);
          context.fillRect(rx + i * 16 - 5, ry + ROAD.width / 2 - 14, 10, 18);
          context.fillRect(rx - ROAD.width / 2 - 4, ry + i * 16 - 5, 18, 10);
          context.fillRect(rx + ROAD.width / 2 - 14, ry + i * 16 - 5, 18, 10);
        }
      }
    }
    context.fillStyle = PALETTE.lane;
    for (const rx of ROAD_XS) {
      for (let y = 0; y < WORLD.height; y += 64) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROAD_YS) {
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, ry - 2, 30, 4);
    }
    // Street trees along the sidewalks, then lamps at the corners.
    if (city.trees) for (const t of city.trees) drawTree(t.x, t.y, t.r);
    if (city.lamps) {
      for (const lamp of city.lamps) {
        context.strokeStyle = '#3a3f46';
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(lamp.x, lamp.y);
        context.lineTo(lamp.x, lamp.y - 18);
        context.stroke();
        context.fillStyle = '#ffe9a8';
        context.beginPath();
        context.arc(lamp.x, lamp.y - 20, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Buildings: a diagonal drop shadow first, then roof, inner edge and the
    // seeded roof detail (AC units, vents, skylight, garden, pool, helipad).
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 10, b.y + 14, b.width, b.height);
      context.fillStyle = PALETTE.buildingEdge;
      context.fillRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.width, b.height);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 2;
      context.strokeRect(b.x + 7, b.y + 7, b.width - 14, b.height - 14);
      context.fillStyle = `rgba(0,0,0,${(1 - b.shade) * 0.45})`;
      context.fillRect(b.x, b.y, b.width, 14);
      if (b.roof) {
        for (const d of b.roof) {
          if (d.kind === 'ac') {
            context.fillStyle = '#c8ccd0';
            context.fillRect(d.x, d.y, d.s, d.s);
            context.fillStyle = '#8a9096';
            context.fillRect(d.x + 2, d.y + 2, d.s - 4, 4);
          } else if (d.kind === 'vent') {
            context.fillStyle = '#5a6068';
            context.beginPath();
            context.arc(d.x, d.y, d.s, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = '#9aa0a6';
            context.beginPath();
            context.arc(d.x, d.y, d.s * 0.5, 0, Math.PI * 2);
            context.fill();
          } else if (d.kind === 'sky') {
            context.fillStyle = 'rgba(170, 220, 245, 0.85)';
            context.fillRect(d.x, d.y, d.w, d.h);
            context.strokeStyle = 'rgba(0,0,0,0.3)';
            context.lineWidth = 2;
            context.strokeRect(d.x, d.y, d.w, d.h);
          } else if (d.kind === 'garden') {
            context.fillStyle = '#4e8a3e';
            context.fillRect(d.x, d.y, d.w, d.h);
            context.fillStyle = '#6da34e';
            context.beginPath();
            context.arc(d.x + d.w * 0.3, d.y + d.h * 0.4, 12, 0, Math.PI * 2);
            context.arc(d.x + d.w * 0.7, d.y + d.h * 0.6, 10, 0, Math.PI * 2);
            context.fill();
          } else if (d.kind === 'pool') {
            context.fillStyle = '#3f8fc4';
            context.fillRect(d.x, d.y, d.w, d.h);
            context.fillStyle = 'rgba(255,255,255,0.5)';
            context.fillRect(d.x + 4, d.y + 4, d.w - 8, 3);
          } else if (d.kind === 'heli') {
            context.fillStyle = 'rgba(0,0,0,0.25)';
            context.beginPath();
            context.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = '#ffffff';
            context.lineWidth = 3;
            context.beginPath();
            context.arc(d.x, d.y, d.r * 0.75, 0, Math.PI * 2);
            context.stroke();
            plainText('H', d.x, d.y, Math.round(d.r), '#ffffff', 'center', 'middle');
          }
        }
      }
      context.fillStyle = 'rgba(255,255,255,0.16)';
      context.fillRect(b.x + 10, b.y + 22, b.width - 20, 6);
      context.fillRect(b.x + 10, b.y + 44, b.width - 20, 6);
    }
  }

  function drawTree(x, y, r) {
    // Soft shadow, then two greens so the canopy has depth.
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.beginPath();
    context.ellipse(x + 4, y + 6, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#5a4632';
    context.fillRect(x - 2, y - 2, 4, 10);
    context.fillStyle = PALETTE.tree;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.treeLight;
    context.beginPath();
    context.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, Math.PI * 2);
    context.fill();
  }

  function drawPalm(x, y) {
    context.strokeStyle = PALETTE.palmTrunk;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + 4, y - 16, x + 2, y - 30);
    context.stroke();
    context.fillStyle = PALETTE.palmLeaf;
    for (let a = 0; a < 5; a += 1) {
      const ang = (a / 5) * Math.PI * 2 + 0.4;
      context.beginPath();
      context.ellipse(x + 2 + Math.cos(ang) * 12, y - 30 + Math.sin(ang) * 8, 13, 5, ang, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCar(car, isPlayer) {
    // Round 3: an ellipse shadow under the car grounds it on the road, and a
    // police car's flashing bar throws a soft coloured glow around the car.
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.beginPath();
    context.ellipse(car.x + 4, car.y + 7, CAR.length / 2 + 2, CAR.width / 2 + 2, car.angle, 0, Math.PI * 2);
    context.fill();
    if (car.kind === 'police') {
      const on = Math.floor(car.siren) % 2 === 0;
      context.fillStyle = on ? 'rgba(255,59,48,0.22)' : 'rgba(47,123,255,0.22)';
      context.beginPath();
      context.arc(car.x, car.y, 52, 0, Math.PI * 2);
      context.fill();
    }
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Wheels.
    context.fillStyle = '#15181c';
    context.fillRect(-18, -CAR.width / 2 - 3, 16, 7);
    context.fillRect(8, -CAR.width / 2 - 3, 16, 7);
    context.fillRect(-18, CAR.width / 2 - 4, 16, 7);
    context.fillRect(8, CAR.width / 2 - 4, 16, 7);
    // Body.
    context.fillStyle = car.color;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    // Windshield and roof, with a bright edge so the glass reads at a glance.
    context.fillStyle = 'rgba(20, 30, 44, 0.85)';
    context.fillRect(6, -CAR.width / 2 + 4, 10, CAR.width - 8);
    context.fillStyle = 'rgba(255,255,255,0.22)';
    context.fillRect(-8, -CAR.width / 2 + 4, 12, CAR.width - 8);
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fillRect(6, -CAR.width / 2 + 4, 2, CAR.width - 8);
    context.fillRect(-8, -CAR.width / 2 + 4, 2, CAR.width - 8);
    // Headlights and brake lights.
    context.fillStyle = '#fff6b0';
    context.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 9, 3, 6);
    context.fillStyle = car.brake ? '#ff2d20' : '#a02020';
    context.fillRect(-CAR.length / 2 - 1, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(-CAR.length / 2 - 1, CAR.width / 2 - 9, 3, 6);
    if (car.kind === 'police') {
      // Flashing light bar.
      const on = Math.floor(car.siren) % 2 === 0;
      context.fillStyle = on ? '#ff3b30' : '#2f7bff';
      context.fillRect(-6, -CAR.width / 2 + 2, 12, 7);
      context.fillStyle = on ? '#2f7bff' : '#ff3b30';
      context.fillRect(-6, CAR.width / 2 - 9, 12, 7);
      plainText('PD', -8, 5, 13, '#ffffff', 'center', 'middle');
    }
    if (car.missionCar) {
      context.fillStyle = '#ffd23e';
      context.font = `bold 13px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('★', 0, 0);
    }
    context.restore();
    if (isPlayer) {
      // A soft ring marks the car the player drives.
      context.strokeStyle = 'rgba(255,210,62,0.85)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(car.x, car.y, 36, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawPerson(x, y, angle, color, radius, armed) {
    // Round 3: a small ground shadow under every walker.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(x + 2, y + 5, radius * 0.9, radius * 0.45, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.arc(x - 3, y - 3, radius * 0.45, 0, Math.PI * 2);
    context.fill();
    // Facing tick so the direction reads at a glance.
    context.strokeStyle = 'rgba(0,0,0,0.55)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * (radius + 6), y + Math.sin(angle) * (radius + 6));
    context.stroke();
    if (armed) {
      context.strokeStyle = '#222';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      context.lineTo(x + Math.cos(angle) * (radius + 14), y + Math.sin(angle) * (radius + 14));
      context.stroke();
    }
  }

  function drawWorld(state, city) {
    drawGround(city, state);
    // Mission marker: a bouncing diamond and a light column at the target.
    const place = state.missionPlace;
    if (place && !state.won) {
      const bounce = Math.sin(state.elapsed * 4) * 6;
      context.fillStyle = 'rgba(255,207,61,0.18)';
      context.fillRect(place.x - 8, place.y - 160, 16, 160);
      context.save();
      context.translate(place.x, place.y - 44 + bounce);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.marker;
      context.fillRect(-13, -13, 26, 26);
      context.strokeStyle = '#7a5b00';
      context.lineWidth = 3;
      context.strokeRect(-13, -13, 26, 26);
      context.restore();
      plainText(place.label || '', place.x, place.y - 78 + bounce, 17, '#ffffff', 'center', 'middle');
    }
    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const pulse = 1 + Math.sin(state.elapsed * 5) * 0.12;
      context.save();
      context.translate(pk.x, pk.y);
      context.scale(pulse, pulse);
      context.fillStyle = pk.kind === 'health' ? '#43d17c' : '#39c5d3';
      context.beginPath();
      context.arc(0, 0, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      if (pk.kind === 'health') {
        context.fillRect(-3, -9, 6, 18);
        context.fillRect(-9, -3, 18, 6);
      } else {
        plainText('A', 0, 1, 15, '#ffffff', 'center', 'middle');
      }
      context.restore();
    }
    // Parked and traffic cars, then the police, then the player's car on top.
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      drawCar(car, false);
    }
    for (const car of state.cars) {
      if (car.kind === 'player') drawCar(car, true);
    }
    // Pedestrians (lying flat when knocked down).
    for (const ped of state.peds) {
      if (ped.down > 0) {
        context.fillStyle = ped.color;
        context.beginPath();
        context.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
        context.fill();
      } else {
        drawPerson(ped.x, ped.y, ped.angle, ped.color, 10, false);
      }
    }
    // Enemies, with a health bar.
    for (const e of state.enemies) {
      drawPerson(e.x, e.y, e.angle, '#8e2f2f', 12, true);
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(e.x - 16, e.y - 26, 32, 6);
      context.fillStyle = '#e5534b';
      context.fillRect(e.x - 16, e.y - 26, 32 * Math.max(0, e.health / 60), 6);
    }
    // Bullets.
    context.strokeStyle = PALETTE.bullet;
    context.lineWidth = 3;
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.beginPath();
      context.moveTo(b.x, b.y);
      context.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // The player on foot: a yellow figure with a dark outline.
    if (state.player.onFoot) {
      const p = state.player;
      const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
      if (!blink) {
        context.fillStyle = 'rgba(0,0,0,0.35)';
        context.beginPath();
        context.ellipse(p.x, p.y + 8, 12, 5, 0, 0, Math.PI * 2);
        context.fill();
        drawPerson(p.x, p.y, p.angle, PALETTE.player, PLAYER.radius, false);
        context.strokeStyle = '#7a5b00';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(p.x, p.y, PLAYER.radius + 1, 0, Math.PI * 2);
        context.stroke();
      }
      if (p.punchTimer > 0.2) {
        context.strokeStyle = '#ffd23e';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(p.x, p.y, 26, p.angle - 0.7, p.angle + 0.7);
        context.stroke();
      }
    }
  }

  function drawMinimap(state, city) {
    const mx = VIEW.width - MINIMAP.width - MINIMAP.margin;
    const my = VIEW.height - MINIMAP.height - MINIMAP.margin;
    const sx = MINIMAP.width / WORLD.width;
    const sy = MINIMAP.height / WORLD.height;
    context.fillStyle = PALETTE.hudPanel;
    roundRect(mx - 6, my - 6, MINIMAP.width + 12, MINIMAP.height + 12, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(mx, my, MINIMAP.width, MINIMAP.height);
    context.clip();
    // Round 3: the minimap is a real miniature of the city — grass, beach and
    // water, darker parks, pale plazas, the brown docks, grey roads and the
    // coloured roof of every building — instead of a flat green grid.
    context.fillStyle = PALETTE.grass;
    context.fillRect(mx, my, MINIMAP.width, MINIMAP.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(mx, my + city.beach.y * sy, MINIMAP.width, city.beach.height * sy);
    context.fillStyle = PALETTE.water;
    context.fillRect(mx, my + city.water.y * sy, MINIMAP.width, city.water.height * sy + 2);
    context.fillStyle = PALETTE.park;
    for (const park of city.parks) context.fillRect(mx + park.x * sx, my + park.y * sy, Math.max(2, park.width * sx), Math.max(2, park.height * sy));
    context.fillStyle = PALETTE.plaza;
    for (const plaza of city.plazas) context.fillRect(mx + plaza.x * sx, my + plaza.y * sy, Math.max(2, plaza.width * sx), Math.max(2, plaza.height * sy));
    context.fillStyle = PALETTE.pier;
    context.fillRect(mx + city.docks.x * sx, my + city.docks.y * sy, Math.max(2, city.docks.width * sx), Math.max(2, city.docks.height * sy));
    for (const b of city.buildings) {
      context.fillStyle = b.color;
      context.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.5, b.width * sx), Math.max(1.5, b.height * sy));
    }
    context.strokeStyle = '#6b7076';
    context.lineWidth = 3;
    for (const rx of ROAD_XS) {
      context.beginPath();
      context.moveTo(mx + rx * sx, my);
      context.lineTo(mx + rx * sx, my + MINIMAP.height);
      context.stroke();
    }
    for (const ry of ROAD_YS) {
      context.beginPath();
      context.moveTo(mx, my + ry * sy);
      context.lineTo(mx + MINIMAP.width, my + ry * sy);
      context.stroke();
    }
    const place = state.missionPlace;
    if (place && !state.won) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + place.x * sx, my + place.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = '#4d9fff';
      context.beginPath();
      context.arc(mx + car.x * sx, my + car.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    // The player: a yellow arrow pointing where they face.
    context.save();
    context.translate(mx + state.player.x * sx, my + state.player.y * sy);
    context.rotate(state.player.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 1;
    context.strokeRect(mx, my, MINIMAP.width, MINIMAP.height);
    plainText('VIREO BAY', mx + 6, my + 14, 12, '#ffffff', 'left', 'top');
  }

  function drawHud(state, city) {
    // Top-left panel: money, health bar, ammo.
    context.fillStyle = PALETTE.hudPanel;
    roundRect(12, 12, 250, 92, 10);
    context.fill();
    text(moneyLabel(state.money), 26, 34, 26, '#7ee787', 'left', 'top');
    plainText('CASH', 26, 62, 13, PALETTE.hudMuted, 'left', 'top');
    const hw = 150;
    context.fillStyle = 'rgba(0,0,0,0.6)';
    context.fillRect(96, 56, hw, 12);
    context.fillStyle = state.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(96, 56, hw * Math.max(0, state.health / 100), 12);
    text(healthLabel(Math.round(state.health)), 96, 84, 15, PALETTE.hudText, 'left', 'top');
    plainText('AMMO', 170, 84, 13, PALETTE.hudMuted, 'left', 'top');
    text(ammoLabel(state.ammo), 222, 84, 15, PALETTE.hudText, 'left', 'top');
    // Top-center: the current job and its objective.
    const def = MISSION_DEFS[state.missionIndex];
    context.fillStyle = PALETTE.hudPanel;
    roundRect(VIEW.width / 2 - 300, 12, 600, 64, 10);
    context.fill();
    if (def) {
      text(missionLabel(def.title), VIEW.width / 2, 30, 20, PALETTE.title, 'center', 'top');
      plainText(objectiveText(state.missionIndex, state.stageIndex), VIEW.width / 2, 54, 16, PALETTE.hudText, 'center', 'top');
      if (state.missionTimer > 0) {
        text(`⏱ ${Math.ceil(state.missionTimer)}s`, VIEW.width / 2 + 268, 30, 18, '#ffb020', 'right', 'top');
      }
    } else {
      text('ALL JOBS DONE — DEBT PAID!', VIEW.width / 2, 30, 20, PALETTE.title, 'center', 'top');
      plainText('Vireo Bay is yours. Keep driving.', VIEW.width / 2, 54, 16, PALETTE.hudText, 'center', 'top');
    }
    // Top-right: wanted stars.
    context.fillStyle = PALETTE.hudPanel;
    roundRect(VIEW.width - 244, 12, 232, 52, 10);
    context.fill();
    plainText('WANTED', VIEW.width - 230, 30, 14, PALETTE.hudMuted, 'left', 'top');
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 144 + i * 22, 26, 26, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'left', 'top');
    }
    // Speed, bottom-left, while driving.
    if (!state.player.onFoot) {
      const kmh = Math.round(Math.abs(state.player.speed) * 0.36);
      text(speedLabel(kmh), 26, VIEW.height - 30, 30, PALETTE.hudText, 'left', 'alphabetic');
      plainText('km/h', 26, VIEW.height - 58, 13, PALETTE.hudMuted, 'left', 'alphabetic');
      plainText('E — get out    F — shoot', 26, VIEW.height - 84, 14, PALETTE.hudMuted, 'left', 'alphabetic');
    } else {
      plainText('WASD — move    E — enter car    Space — punch    F — shoot', 26, VIEW.height - 30, 14, PALETTE.hudMuted, 'left', 'alphabetic');
    }
    drawMinimap(state, city);
    // Transient message, centre-bottom.
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = PALETTE.hudPanel;
      const w = Math.min(760, 40 + state.message.length * 9);
      roundRect(VIEW.width / 2 - w / 2, VIEW.height - 118, w, 40, 10);
      context.fill();
      plainText(state.message, VIEW.width / 2, VIEW.height - 91, 17, PALETTE.hudText, 'center', 'middle');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, PANEL.width, height, 14);
    context.fill();
    context.strokeStyle = 'rgba(255,210,62,0.5)';
    context.lineWidth = 2;
    roundRect(x, y, PANEL.width, height, 14);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 82, 52, PALETTE.title, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      plainText(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.hudMuted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, '#f2c94c', 'center');
  }

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, city, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0d1117';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = state.camera;
    const ox = VIEW.width / 2 - cam.x;
    const oy = VIEW.height / 2 - cam.y;
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Clip to the 1280x720 view so nothing draws into the letterbox.
    context.save();
    context.beginPath();
    context.rect(0, 0, VIEW.width, VIEW.height);
    context.clip();
    context.translate(ox, oy);
    drawWorld(state, city);
    context.restore();
    // Round 3: golden-hour — a very thin warm tint plus a soft vignette over
    // the world only, so the HUD and its text stay crisp and un-tinted.
    const warm = context.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
      VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.75,
    );
    warm.addColorStop(0, 'rgba(255, 176, 80, 0.045)');
    warm.addColorStop(0.7, 'rgba(255, 160, 60, 0.06)');
    warm.addColorStop(1, 'rgba(40, 20, 60, 0.14)');
    context.fillStyle = warm;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(8, 10, 18, 0.45)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('VIREO BAY', [
        'An open-world crime game in a sun-soaked bay city.',
        'Dana Voss owes the Bay Syndicate $5,000. Four jobs. One fast car.',
        'Steal cars, lose the cops, run the jobs, pay the debt.',
        'WASD drive & walk · E enter / steal a car · Space punch · F shoot · P pause',
        `Best haul yet: $${best}`,
      ], 'Press Space or click to start');
      return;
    }
    drawHud(state, city);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(8, 10, 18, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('Paused', ['The city waits for you.', `Cash $${state.money} · Jobs done ${state.stats.delivered} / 4`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      context.fillStyle = 'rgba(8, 10, 18, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      if (state.won || state.endReason === 'won') {
        drawPanel('DEBT PAID!', [`Dana cleared the $5,000 and kept $${state.money}.`, `Jobs done: ${state.stats.delivered} · Cars stolen: ${state.stats.stolen}`], 'Press Space to play again');
      } else if (state.endReason === 'busted') {
        drawPanel('BUSTED', ['The Vireo Bay PD caught up with Dana.', 'Bail cost $100. The jobs are still waiting.'], 'Press Space to try again');
      } else {
        drawPanel('WASTED', ['Dana went down in Vireo Bay.', `Cash kept: $${state.money}`], 'Press Space to try again');
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
