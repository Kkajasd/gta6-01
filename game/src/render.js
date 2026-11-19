// Round 6 — a fresh renderer, written live in this session.
//
// The camera still shows a 1280x720 window of Vireo Bay, scaled to the
// browser. Everything below is drawn with flat canvas shapes plus HUD text
// and a live minimap. Nothing here allocates per frame except the text the
// HUD rebuilds when its number changes.
//
// What this pass adds over round 4, and re-authors from round 5:
//   - roofs that read as roofs: a parapet rim, a sunlit top edge, a shaded
//     bottom edge, an inset panel with repeating bands and seams, corner
//     rivets, and roof furniture drawn big enough to see at a glance;
//   - a brighter title screen, so the living city shows through the panel;
//   - walkers drawn a touch larger, with a dark ring so they pop off grass
//     and tarmac alike;
//   - the mission place name as a pill in screen space, after the HUD, so no
//     panel can ever cover it;
//   - more life on the ground: grass speckle, flower dots in the parks,
//     benches on the plazas, bollards and crates on the pier, foam and sun
//     glints on the water, white edge lines and manhole covers on the roads,
//     sunroofs and side stripes on the cars.
//
// Every position below is derived from the seeded city data or from fixed
// geometry, so the same seed always paints the same frame.

import { CAR, FONT, PALETTE, PLAYER, ROAD, VIEW, WORLD } from './config.js';
import { MISSION_DEFS, objectiveText } from './missions.js';
import { ROAD_XS, ROAD_YS } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

// Minimap box, bottom-right, and the centred title/pause/game-over card.
const MAP_W = 230;
const MAP_H = 172;
const MAP_M = 14;
const CARD_W = 640;
const CARD_TOP = 150;
const CARD_ROW = 32;
const CARD_FOOT = 76;

export function createRenderer(canvas) {
  const g = canvas.getContext('2d');
  const zoom = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  const faces = new Map();

  // A label that rebuilds only when its value changes.
  function sticky(head) {
    let seen = null;
    let built = '';
    return function (next) {
      if (next !== seen) {
        seen = next;
        built = head + next;
      }
      return built;
    };
  }
  const cashWord = sticky('$');
  const hpWord = sticky('');
  const ammoWord = sticky('');
  const paceWord = sticky('');
  const jobWord = sticky('');

  function fit() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    zoom.scale = Math.min(w / VIEW.width, h / VIEW.height);
    zoom.dpr = ratio;
    zoom.ox = (w - VIEW.width * zoom.scale) / 2;
    zoom.oy = (h - VIEW.height * zoom.scale) / 2;
  }

  function boldAt(words, x, y, px, ink, align, base) {
    if (!faces.has(px)) faces.set(px, `bold ${px}px ${FONT}`);
    g.font = faces.get(px);
    g.fillStyle = ink;
    g.textAlign = align || 'left';
    g.textBaseline = base || 'alphabetic';
    g.fillText(words, x, y);
  }

  function plainAt(words, x, y, px, ink, align, base) {
    const key = px + 5000;
    if (!faces.has(key)) faces.set(key, `${px}px ${FONT}`);
    g.font = faces.get(key);
    g.fillStyle = ink;
    g.textAlign = align || 'left';
    g.textBaseline = base || 'alphabetic';
    g.fillText(words, x, y);
  }

  // A rounded-rectangle path (not filled): callers fill or stroke it.
  function pill(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // One filled disc, in the current fill style.
  function disc(x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  // One stroked segment, in the current stroke style and width.
  function seg(x1, y1, x2, y2) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }

  /** Screen pixels -> world coordinates, for aiming with the mouse. */
  function screenToWorld(sx, sy, cam) {
    const wx = ((sx * zoom.dpr - zoom.ox) / zoom.scale) + cam.x - VIEW.width / 2;
    const wy = ((sy * zoom.dpr - zoom.oy) / zoom.scale) + cam.y - VIEW.height / 2;
    return { x: wx, y: wy };
  }

  function paintTree(x, y, r) {
    // A soft ground shadow, a short trunk, then two greens for depth.
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.ellipse(x + 4, y + 6, r * 0.9, r * 0.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#5a4632';
    g.fillRect(x - 2, y - 2, 4, 10);
    g.fillStyle = PALETTE.tree;
    disc(x, y, r);
    g.fillStyle = PALETTE.treeLight;
    disc(x - r * 0.3, y - r * 0.3, r * 0.55);
  }

  function paintPalm(x, y) {
    g.strokeStyle = PALETTE.palmTrunk;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 4, y - 16, x + 2, y - 30);
    g.stroke();
    g.fillStyle = PALETTE.palmLeaf;
    for (let k = 0; k < 5; k += 1) {
      const ang = (k / 5) * TAU + 0.4;
      g.beginPath();
      g.ellipse(x + 2 + Math.cos(ang) * 12, y - 30 + Math.sin(ang) * 8, 13, 5, ang, 0, TAU);
      g.fill();
    }
  }

  // The shore: sand, sea with drifting waves and sun glints, boats, towels,
  // umbrellas and palms. The foam line marks where the water meets the sand.
  function paintShore(city, t) {
    g.fillStyle = PALETTE.sand;
    g.fillRect(city.beach.x, city.beach.y, city.beach.width, city.beach.height);
    if (city.beachProps) {
      g.fillStyle = 'rgba(120, 90, 40, 0.25)';
      for (const dot of city.beachProps.sand) g.fillRect(dot.x - 1, dot.y - 1, 3, 3);
    }
    const sea = g.createLinearGradient(0, city.water.y, 0, city.water.y + city.water.height);
    sea.addColorStop(0, PALETTE.water);
    sea.addColorStop(1, PALETTE.waterDeep);
    g.fillStyle = sea;
    g.fillRect(city.water.x, city.water.y, city.water.width, city.water.height);
    // Foam where the sea laps the sand.
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(city.water.x, city.water.y, city.water.width, 3);
    // Three rows of waves drifting with time, plus fixed sun glints.
    const drift = (t * 22) % 60;
    for (let row = 0; row < 3; row += 1) {
      g.strokeStyle = `rgba(255,255,255,${0.5 - row * 0.15})`;
      g.lineWidth = 3;
      const wy = city.water.y + 30 + row * 24;
      for (let x = -60 + drift + row * 24; x < WORLD.width; x += 60) {
        g.beginPath();
        g.moveTo(x, wy);
        g.quadraticCurveTo(x + 15, wy - 8, x + 30, wy);
        g.stroke();
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.28)';
    for (let x = 200; x < WORLD.width; x += 480) g.fillRect(x, city.water.y + 52, 42, 3);
    if (city.boats) {
      for (const boat of city.boats) {
        g.save();
        g.translate(boat.x, boat.y);
        g.rotate(boat.angle);
        g.fillStyle = boat.color;
        g.beginPath();
        g.moveTo(-22, 0);
        g.lineTo(22, 0);
        g.lineTo(14, 12);
        g.lineTo(-14, 12);
        g.closePath();
        g.fill();
        g.strokeStyle = '#5a4632';
        g.lineWidth = 3;
        seg(0, 0, 0, -20);
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(0, -20);
        g.lineTo(0, -2);
        g.lineTo(13, -2);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
    if (city.beachProps) {
      for (const towel of city.beachProps.towels) {
        g.save();
        g.translate(towel.x, towel.y);
        g.rotate(towel.angle);
        g.fillStyle = towel.color;
        g.fillRect(-14, -7, 28, 14);
        g.restore();
      }
      for (const umb of city.beachProps.umbrellas) {
        g.fillStyle = '#7a5b33';
        g.fillRect(umb.x - 1, umb.y - 4, 3, 16);
        g.fillStyle = umb.color;
        g.beginPath();
        g.arc(umb.x, umb.y - 2, 16, Math.PI, 0);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.arc(umb.x, umb.y - 2, 16, Math.PI * 1.25, Math.PI * 1.6);
        g.closePath();
        g.fill();
      }
      for (const palm of city.beachProps.palms) paintPalm(palm.x, palm.y);
    }
  }

  // Parks and plazas. Parks get a pond, a footpath, seeded trees and a few
  // flower dots at fixed spots; plazas get a tile grid, a fountain and two
  // benches at opposite corners.
  function paintGreens(city, t) {
    const petals = ['#e86a9b', '#ffd23e', '#ffffff', '#c27ba0'];
    for (let pi = 0; pi < city.parks.length; pi += 1) {
      const park = city.parks[pi];
      const detail = city.parkDetails ? city.parkDetails[pi] : null;
      g.fillStyle = PALETTE.park;
      g.fillRect(park.x, park.y, park.width, park.height);
      if (detail && detail.path) {
        g.strokeStyle = 'rgba(230, 210, 160, 0.8)';
        g.lineWidth = 12;
        seg(park.x, park.y + park.height / 2, park.x + park.width, park.y + park.height / 2);
        seg(park.x + park.width / 2, park.y, park.x + park.width / 2, park.y + park.height);
      }
      if (detail && detail.pond) {
        const pond = detail.pond;
        g.fillStyle = '#3f8fc4';
        g.beginPath();
        g.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(pond.x, pond.y, pond.rx - 8, pond.ry - 6, 0, 0, TAU);
        g.stroke();
      }
      if (detail) {
        for (const tree of detail.trees) paintTree(tree.x, tree.y, tree.r);
      } else {
        g.fillStyle = '#4e7d38';
        const cols = Math.max(1, Math.floor(park.width / 90));
        const rows = Math.max(1, Math.floor(park.height / 90));
        for (let i = 0; i < cols; i += 1) {
          for (let j = 0; j < rows; j += 1) disc(park.x + 45 + i * 90, park.y + 45 + j * 90, 24);
        }
      }
      // Flower dots, same spots every time for this park.
      for (let k = 0; k < 6; k += 1) {
        const fx = park.x + park.width * (0.15 + 0.13 * k);
        const fy = park.y + park.height * (0.25 + 0.11 * ((k * 7) % 5));
        g.fillStyle = petals[k % petals.length];
        disc(fx, fy, 3.5);
      }
    }
    for (let pi = 0; pi < city.plazas.length; pi += 1) {
      const plaza = city.plazas[pi];
      g.fillStyle = PALETTE.plaza;
      g.fillRect(plaza.x, plaza.y, plaza.width, plaza.height);
      g.strokeStyle = 'rgba(90, 80, 60, 0.25)';
      g.lineWidth = 2;
      for (let x = plaza.x + 48; x < plaza.x + plaza.width; x += 48) seg(x, plaza.y, x, plaza.y + plaza.height);
      for (let y = plaza.y + 48; y < plaza.y + plaza.height; y += 48) seg(plaza.x, y, plaza.x + plaza.width, y);
      // A bench at each of two opposite corners.
      g.fillStyle = '#8a6b4a';
      g.fillRect(plaza.x + 14, plaza.y + 14, 26, 8);
      g.fillRect(plaza.x + plaza.width - 40, plaza.y + plaza.height - 22, 26, 8);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(plaza.x + 14, plaza.y + 22, 26, 2);
      g.fillRect(plaza.x + plaza.width - 40, plaza.y + plaza.height - 14, 26, 2);
      const f = city.fountains ? city.fountains[pi] : null;
      if (f) {
        g.fillStyle = '#8d8578';
        disc(f.x, f.y, f.r + 8);
        g.fillStyle = '#4aa3d8';
        disc(f.x, f.y, f.r);
        g.fillStyle = '#7cc4ec';
        disc(f.x, f.y, f.r * 0.45);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        for (let a = 0; a < 6; a += 1) {
          const ang = (a / 6) * TAU + (t * 0.4) % 1;
          disc(f.x + Math.cos(ang) * f.r * 0.7, f.y + Math.sin(ang) * f.r * 0.7, 3);
        }
      }
    }
  }

  // The docks: a wooden pier with clear planks, stacked containers, mooring
  // bollards along the top edge and a couple of crates on the boards.
  function paintPier(city) {
    g.fillStyle = PALETTE.pier;
    g.fillRect(city.docks.x, city.docks.y, city.docks.width, city.docks.height);
    g.strokeStyle = '#6b4f33';
    g.lineWidth = 4;
    for (let y = city.docks.y + 30; y < city.docks.y + city.docks.height; y += 60) {
      seg(city.docks.x, y, city.docks.x + city.docks.width, y);
    }
    g.strokeStyle = 'rgba(107, 79, 51, 0.6)';
    g.lineWidth = 2;
    for (let x = city.docks.x + 30; x < city.docks.x + city.docks.width; x += 30) {
      seg(x, city.docks.y, x, city.docks.y + city.docks.height);
    }
    g.fillStyle = '#2c2f36';
    for (let x = city.docks.x + 16; x < city.docks.x + city.docks.width; x += 60) {
      disc(x, city.docks.y + 10, 4);
    }
    // Two crates waiting on the pier, fixed to its corners.
    g.fillStyle = '#c08a3e';
    g.fillRect(city.docks.x + 24, city.docks.y + city.docks.height - 64, 30, 30);
    g.fillStyle = '#5d8a6a';
    g.fillRect(city.docks.x + 60, city.docks.y + city.docks.height - 64, 30, 30);
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 2;
    g.strokeRect(city.docks.x + 24, city.docks.y + city.docks.height - 64, 30, 30);
    g.strokeRect(city.docks.x + 60, city.docks.y + city.docks.height - 64, 30, 30);
    if (city.containers) {
      for (const c of city.containers) {
        g.fillStyle = c.color;
        g.fillRect(c.x, c.y, c.w, c.h);
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 2;
        g.strokeRect(c.x, c.y, c.w, c.h);
        g.strokeStyle = 'rgba(255,255,255,0.25)';
        seg(c.x + 6, c.y + 6, c.x + c.w - 6, c.y + 6);
      }
    }
  }

  // Sidewalks, roads, lane dashes, zebra crossings, white edge lines and
  // manhole covers at every other intersection.
  function paintStreets() {
    g.fillStyle = PALETTE.sidewalk;
    for (const rx of ROAD_XS) g.fillRect(rx - ROAD.width / 2 - 22, 0, ROAD.width + 44, WORLD.height);
    for (const ry of ROAD_YS) g.fillRect(0, ry - ROAD.width / 2 - 22, WORLD.width, ROAD.width + 44);
    // Sidewalk tile seams.
    g.strokeStyle = 'rgba(60, 60, 60, 0.18)';
    g.lineWidth = 2;
    for (const rx of ROAD_XS) {
      for (let y = 0; y < WORLD.height; y += 44) seg(rx - ROAD.width / 2 - 22, y, rx + ROAD.width / 2 + 22, y);
    }
    for (const ry of ROAD_YS) {
      for (let x = 0; x < WORLD.width; x += 44) seg(x, ry - ROAD.width / 2 - 22, x, ry + ROAD.width / 2 + 22);
    }
    g.fillStyle = PALETTE.road;
    for (const rx of ROAD_XS) g.fillRect(rx - ROAD.width / 2, 0, ROAD.width, WORLD.height);
    for (const ry of ROAD_YS) g.fillRect(0, ry - ROAD.width / 2, WORLD.width, ROAD.width);
    // White edge lines down both sides of every road.
    g.fillStyle = 'rgba(255,255,255,0.4)';
    for (const rx of ROAD_XS) {
      g.fillRect(rx - ROAD.width / 2 + 4, 0, 2, WORLD.height);
      g.fillRect(rx + ROAD.width / 2 - 6, 0, 2, WORLD.height);
    }
    for (const ry of ROAD_YS) {
      g.fillRect(0, ry - ROAD.width / 2 + 4, WORLD.width, 2);
      g.fillRect(0, ry + ROAD.width / 2 - 6, WORLD.width, 2);
    }
    // Zebra crossings at every intersection, in both directions.
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (const rx of ROAD_XS) {
      for (const ry of ROAD_YS) {
        for (let i = -3; i <= 3; i += 1) {
          g.fillRect(rx + i * 16 - 5, ry - ROAD.width / 2 - 4, 10, 18);
          g.fillRect(rx + i * 16 - 5, ry + ROAD.width / 2 - 14, 10, 18);
          g.fillRect(rx - ROAD.width / 2 - 4, ry + i * 16 - 5, 18, 10);
          g.fillRect(rx + ROAD.width / 2 - 14, ry + i * 16 - 5, 18, 10);
        }
      }
    }
    // Manhole covers on alternating crossings.
    g.fillStyle = 'rgba(0,0,0,0.35)';
    ROAD_XS.forEach((rx, xi) => {
      ROAD_YS.forEach((ry, yi) => {
        if ((xi + yi) % 2 === 0) disc(rx, ry, 5);
      });
    });
    // Yellow centre dashes.
    g.fillStyle = PALETTE.lane;
    for (const rx of ROAD_XS) {
      for (let y = 0; y < WORLD.height; y += 64) g.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROAD_YS) {
      for (let x = 0; x < WORLD.width; x += 64) g.fillRect(x, ry - 2, 30, 4);
    }
  }

  // Street trees along the sidewalks, then lamps at the corners.
  function paintTrees(city) {
    if (city.trees) for (const tree of city.trees) paintTree(tree.x, tree.y, tree.r);
    if (city.lamps) {
      for (const lamp of city.lamps) {
        g.strokeStyle = '#3a3f46';
        g.lineWidth = 4;
        seg(lamp.x, lamp.y, lamp.x, lamp.y - 18);
        g.fillStyle = '#ffe9a8';
        disc(lamp.x, lamp.y - 20, 5);
      }
    }
  }

  // One roof's seeded furniture: AC boxes, vents, skylight, garden, pool or
  // helipad. Furniture is drawn bigger than life so it reads at a glance.
  function paintRoofKit(d) {
    if (d.kind === 'ac') {
      const s = d.s * 1.4;
      g.fillStyle = '#c8ccd0';
      g.fillRect(d.x, d.y, s, s);
      g.fillStyle = '#8a9096';
      g.fillRect(d.x + 2, d.y + 2, s - 4, 4);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(d.x + 2, d.y + 2, s - 4, 2);
    } else if (d.kind === 'vent') {
      const s = d.s * 1.4;
      g.fillStyle = '#5a6068';
      disc(d.x, d.y, s);
      g.fillStyle = '#9aa0a6';
      disc(d.x, d.y, s * 0.5);
    } else if (d.kind === 'sky') {
      g.fillStyle = 'rgba(170, 220, 245, 0.85)';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 2;
      g.strokeRect(d.x, d.y, d.w, d.h);
    } else if (d.kind === 'garden') {
      g.fillStyle = '#4e8a3e';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = '#6da34e';
      disc(d.x + d.w * 0.3, d.y + d.h * 0.4, 12);
      disc(d.x + d.w * 0.7, d.y + d.h * 0.6, 10);
    } else if (d.kind === 'pool') {
      g.fillStyle = '#3f8fc4';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(d.x + 4, d.y + 4, d.w - 8, 3);
    } else if (d.kind === 'heli') {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      disc(d.x, d.y, d.r);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(d.x, d.y, d.r * 0.75, 0, TAU);
      g.stroke();
      plainAt('H', d.x, d.y, Math.round(d.r), '#ffffff', 'center', 'middle');
    }
  }

  // Buildings: a diagonal drop shadow, a dark edge, the roof colour, a
  // sunlit top edge and a shaded bottom edge for depth, a parapet rim, the
  // seeded furniture, and panel work — an inset tone, repeating bands,
  // vertical seams and corner rivets — so a roof reads as a roof and never
  // as a flat coloured slab.
  function paintBlocks(city) {
    for (const b of city.buildings) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(b.x + 10, b.y + 14, b.width, b.height);
      g.fillStyle = PALETTE.buildingEdge;
      g.fillRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6);
      g.fillStyle = b.color;
      g.fillRect(b.x, b.y, b.width, b.height);
      // Sunlit top edge, shaded bottom edge.
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(b.x, b.y, b.width, 8);
      g.fillStyle = `rgba(0,0,0,${(1 - b.shade) * 0.45})`;
      g.fillRect(b.x, b.y + b.height - 14, b.width, 14);
      // Parapet: a dark outer rim with a light inner line.
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      g.strokeRect(b.x + 7, b.y + 7, b.width - 14, b.height - 14);
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = 3;
      g.strokeRect(b.x + 4, b.y + 4, b.width - 8, b.height - 8);
      if (b.roof) for (const d of b.roof) paintRoofKit(d);
      // Inset panel, bands across the roof, seams down it, rivets in corners.
      g.fillStyle = 'rgba(0,0,0,0.07)';
      g.fillRect(b.x + 16, b.y + 16, b.width - 32, b.height - 32);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (let by = b.y + 22; by < b.y + b.height - 12; by += 44) {
        g.fillRect(b.x + 12, by, b.width - 24, 5);
      }
      g.fillStyle = 'rgba(0,0,0,0.08)';
      for (let bx = b.x + 48; bx < b.x + b.width - 12; bx += 48) {
        g.fillRect(bx, b.y + 12, 2, b.height - 24);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      disc(b.x + 16, b.y + 16, 2.5);
      disc(b.x + b.width - 16, b.y + 16, 2.5);
      disc(b.x + 16, b.y + b.height - 16, 2.5);
      disc(b.x + b.width - 16, b.y + b.height - 16, 2.5);
    }
  }

  // The whole ground layer, in paint order: grass, shore, greens, pier,
  // streets, street trees and lamps, then the buildings on top.
  function paintTerrain(city, t) {
    g.fillStyle = PALETTE.grass;
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    // Faint grass speckle on a fixed grid, for texture.
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let gx = 60; gx < WORLD.width; gx += 120) {
      for (let gy = 60; gy < WORLD.height; gy += 120) g.fillRect(gx, gy, 3, 3);
    }
    paintShore(city, t);
    paintGreens(city, t);
    paintPier(city);
    paintStreets();
    paintTrees(city);
    paintBlocks(city);
  }

  // One car: shadow, police glow, body with glass, sunroof, side stripe and
  // mirrors, lights, and the extras that mark police cars and the job coupe.
  function paintAuto(car, mine) {
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.ellipse(car.x + 4, car.y + 7, CAR.length / 2 + 2, CAR.width / 2 + 2, car.angle, 0, TAU);
    g.fill();
    if (car.kind === 'police') {
      const lit = Math.floor(car.siren) % 2 === 0;
      g.fillStyle = lit ? 'rgba(255,59,48,0.22)' : 'rgba(47,123,255,0.22)';
      disc(car.x, car.y, 52);
    }
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.angle);
    // Wheels.
    g.fillStyle = '#15181c';
    g.fillRect(-18, -CAR.width / 2 - 3, 16, 7);
    g.fillRect(8, -CAR.width / 2 - 3, 16, 7);
    g.fillRect(-18, CAR.width / 2 - 4, 16, 7);
    g.fillRect(8, CAR.width / 2 - 4, 16, 7);
    // Body with a bright edge, glass, sunroof and a side stripe.
    g.fillStyle = car.color;
    pill(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    g.fill();
    g.fillStyle = 'rgba(20, 30, 44, 0.85)';
    g.fillRect(6, -CAR.width / 2 + 4, 10, CAR.width - 8);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(-8, -CAR.width / 2 + 4, 12, CAR.width - 8);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(6, -CAR.width / 2 + 4, 2, CAR.width - 8);
    g.fillRect(-8, -CAR.width / 2 + 4, 2, CAR.width - 8);
    g.fillStyle = 'rgba(20, 30, 44, 0.6)';
    g.fillRect(-2, -CAR.width / 2 + 6, 5, CAR.width - 12);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, -CAR.width / 2 + 2, CAR.length - 12, 2);
    g.fillRect(0, CAR.width / 2 - 4, CAR.length - 12, 2);
    // Mirrors.
    g.fillStyle = '#15181c';
    g.fillRect(2, -CAR.width / 2 - 5, 4, 4);
    g.fillRect(2, CAR.width / 2 + 1, 4, 4);
    // Headlights and brake lights.
    g.fillStyle = '#fff6b0';
    g.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 3, 6);
    g.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 9, 3, 6);
    g.fillStyle = car.brake ? '#ff2d20' : '#a02020';
    g.fillRect(-CAR.length / 2 - 1, -CAR.width / 2 + 3, 3, 6);
    g.fillRect(-CAR.length / 2 - 1, CAR.width / 2 - 9, 3, 6);
    if (car.kind === 'police') {
      const lit = Math.floor(car.siren) % 2 === 0;
      g.fillStyle = lit ? '#ff3b30' : '#2f7bff';
      g.fillRect(-6, -CAR.width / 2 + 2, 12, 7);
      g.fillStyle = lit ? '#2f7bff' : '#ff3b30';
      g.fillRect(-6, CAR.width / 2 - 9, 12, 7);
      plainAt('PD', -8, 5, 13, '#ffffff', 'center', 'middle');
    }
    if (car.missionCar) {
      g.fillStyle = '#ffd23e';
      if (!faces.has(13)) faces.set(13, `bold 13px ${FONT}`);
      g.font = faces.get(13);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('★', 0, 0);
    }
    g.restore();
    if (mine) {
      // A soft gold ring marks the car the player drives.
      g.strokeStyle = 'rgba(255,210,62,0.85)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(car.x, car.y, 36, 0, TAU);
      g.stroke();
    }
  }

  // One person on foot: shadow, a body with a dark ring so they pop off any
  // ground, a facing tick, and a gun barrel when armed.
  function paintWalker(x, y, heading, color, size, gun) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(x + 2, y + 5, size * 0.9, size * 0.45, 0, 0, TAU);
    g.fill();
    g.fillStyle = color;
    disc(x, y, size);
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, size, 0, TAU);
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    disc(x - 3, y - 3, size * 0.45);
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 3;
    seg(x, y, x + Math.cos(heading) * (size + 6), y + Math.sin(heading) * (size + 6));
    if (gun) {
      g.strokeStyle = '#222222';
      g.lineWidth = 4;
      seg(
        x + Math.cos(heading) * size, y + Math.sin(heading) * size,
        x + Math.cos(heading) * (size + 14), y + Math.sin(heading) * (size + 14),
      );
    }
  }

  // The world through the camera: terrain, mission marker, pickups, cars,
  // walkers, enemies, bullets, particles and the player.
  function paintScene(state, city) {
    paintTerrain(city, state.elapsed);
    const place = state.missionPlace;
    if (place && !state.won) {
      const bob = Math.sin(state.elapsed * 4) * 6;
      // A wider gold column and a soft glow at its base, so the job marker
      // reads from across the street even when a car sits on top of it.
      g.fillStyle = 'rgba(255,207,61,0.22)';
      g.fillRect(place.x - 10, place.y - 170, 20, 170);
      g.fillStyle = 'rgba(255,207,61,0.16)';
      disc(place.x, place.y, 30);
      g.save();
      g.translate(place.x, place.y - 44 + bob);
      g.rotate(Math.PI / 4);
      g.fillStyle = PALETTE.marker;
      g.fillRect(-15, -15, 30, 30);
      g.strokeStyle = '#7a5b00';
      g.lineWidth = 3;
      g.strokeRect(-15, -15, 30, 30);
      g.restore();
    }
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const pulse = 1 + Math.sin(state.elapsed * 5) * 0.12;
      g.save();
      g.translate(pk.x, pk.y);
      g.scale(pulse, pulse);
      g.fillStyle = pk.kind === 'health' ? '#43d17c' : '#39c5d3';
      disc(0, 0, 15);
      g.fillStyle = '#ffffff';
      if (pk.kind === 'health') {
        g.fillRect(-3, -9, 6, 18);
        g.fillRect(-9, -3, 18, 6);
      } else {
        plainAt('A', 0, 1, 15, '#ffffff', 'center', 'middle');
      }
      g.restore();
    }
    for (const car of state.cars) {
      if (car.kind !== 'player') paintAuto(car, false);
    }
    for (const car of state.cars) {
      if (car.kind === 'player') paintAuto(car, true);
    }
    for (const ped of state.peds) {
      if (ped.down > 0) {
        g.fillStyle = ped.color;
        g.beginPath();
        g.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, TAU);
        g.fill();
      } else {
        // Walkers read as people at a glance: a little larger than before.
        paintWalker(ped.x, ped.y, ped.angle, ped.color, 12, false);
      }
    }
    for (const e of state.enemies) {
      paintWalker(e.x, e.y, e.angle, '#8e2f2f', 12, true);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(e.x - 16, e.y - 26, 32, 6);
      g.fillStyle = '#e5534b';
      g.fillRect(e.x - 16, e.y - 26, 32 * Math.max(0, e.health / 60), 6);
    }
    g.strokeStyle = PALETTE.bullet;
    g.lineWidth = 3;
    for (const b of state.bullets) {
      if (!b.active) continue;
      seg(b.x, b.y, b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      disc(p.x, p.y, p.size);
    }
    g.globalAlpha = 1;
    if (state.player.onFoot) {
      const p = state.player;
      const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
      if (!blink) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.ellipse(p.x, p.y + 8, 12, 5, 0, 0, TAU);
        g.fill();
        paintWalker(p.x, p.y, p.angle, PALETTE.player, PLAYER.radius, false);
        g.strokeStyle = '#7a5b00';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(p.x, p.y, PLAYER.radius + 1, 0, TAU);
        g.stroke();
      }
      if (p.punchTimer > 0.2) {
        g.strokeStyle = '#ffd23e';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(p.x, p.y, 26, p.angle - 0.7, p.angle + 0.7);
        g.stroke();
      }
    }
  }

  // The minimap, bottom-right: a real miniature of the city, with a gold
  // border, the mission marker, police dots and the player as a ringed arrow.
  function paintMap(state, city) {
    const mx = VIEW.width - MAP_W - MAP_M;
    const my = VIEW.height - MAP_H - MAP_M;
    const sx = MAP_W / WORLD.width;
    const sy = MAP_H / WORLD.height;
    g.fillStyle = PALETTE.hudPanel;
    pill(mx - 6, my - 6, MAP_W + 12, MAP_H + 12, 8);
    g.fill();
    g.strokeStyle = 'rgba(255,210,62,0.55)';
    g.lineWidth = 2;
    pill(mx - 6, my - 6, MAP_W + 12, MAP_H + 12, 8);
    g.stroke();
    g.save();
    g.beginPath();
    g.rect(mx, my, MAP_W, MAP_H);
    g.clip();
    g.fillStyle = PALETTE.grass;
    g.fillRect(mx, my, MAP_W, MAP_H);
    g.fillStyle = PALETTE.sand;
    g.fillRect(mx, my + city.beach.y * sy, MAP_W, city.beach.height * sy);
    g.fillStyle = PALETTE.water;
    g.fillRect(mx, my + city.water.y * sy, MAP_W, city.water.height * sy + 2);
    g.fillStyle = PALETTE.park;
    for (const park of city.parks) {
      g.fillRect(mx + park.x * sx, my + park.y * sy, Math.max(2, park.width * sx), Math.max(2, park.height * sy));
    }
    g.fillStyle = PALETTE.plaza;
    for (const plaza of city.plazas) {
      g.fillRect(mx + plaza.x * sx, my + plaza.y * sy, Math.max(2, plaza.width * sx), Math.max(2, plaza.height * sy));
    }
    g.fillStyle = PALETTE.pier;
    g.fillRect(mx + city.docks.x * sx, my + city.docks.y * sy, Math.max(2, city.docks.width * sx), Math.max(2, city.docks.height * sy));
    for (const b of city.buildings) {
      g.fillStyle = b.color;
      g.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.5, b.width * sx), Math.max(1.5, b.height * sy));
    }
    g.strokeStyle = '#6b7076';
    g.lineWidth = 3;
    for (const rx of ROAD_XS) seg(mx + rx * sx, my, mx + rx * sx, my + MAP_H);
    for (const ry of ROAD_YS) seg(mx, my + ry * sy, mx + MAP_W, my + ry * sy);
    const place = state.missionPlace;
    if (place && !state.won) {
      g.fillStyle = PALETTE.marker;
      disc(mx + place.x * sx, my + place.y * sy, 5);
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      g.fillStyle = '#4d9fff';
      disc(mx + car.x * sx, my + car.y * sy, 4);
    }
    g.save();
    g.translate(mx + state.player.x * sx, my + state.player.y * sy);
    g.rotate(state.player.angle);
    g.fillStyle = PALETTE.player;
    g.beginPath();
    g.moveTo(8, 0);
    g.lineTo(-6, -5);
    g.lineTo(-6, 5);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(mx + state.player.x * sx, my + state.player.y * sy, 9, 0, TAU);
    g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    g.strokeRect(mx, my, MAP_W, MAP_H);
    plainAt('VIREO BAY', mx + 6, my + 14, 12, '#ffffff', 'left', 'top');
  }

  // The mission place name, in screen space after the HUD, clamped into the
  // safe area with a dark pill behind it. It can never hide under a panel:
  // it sits above the minimap's top edge and below the mission bar.
  function paintTag(state) {
    const place = state.missionPlace;
    if (!place || state.won || !place.label) return;
    const cam = state.camera;
    let sx = (place.x - cam.x) + VIEW.width / 2;
    let sy = (place.y - 78 - cam.y) + VIEW.height / 2;
    sx = Math.max(130, Math.min(VIEW.width - 130, sx));
    sy = Math.max(128, Math.min(500, sy));
    const px = 17;
    if (!faces.has(px)) faces.set(px, `bold ${px}px ${FONT}`);
    g.font = faces.get(px);
    const w = g.measureText(place.label).width;
    const pad = 26;
    const pillW = w + pad * 2;
    g.fillStyle = 'rgba(12,16,24,0.72)';
    pill(sx - pillW / 2, sy - 25, pillW, 34, 8);
    g.fill();
    // A small gold diamond at the pill's left edge, pointing at the place.
    g.fillStyle = PALETTE.marker;
    g.save();
    g.translate(sx - pillW / 2 + 14, sy - 8);
    g.rotate(Math.PI / 4);
    g.fillRect(-5, -5, 10, 10);
    g.restore();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(place.label, sx + 6, sy - 7);
  }

  // The HUD: cash and health top-left, the job top-centre, wanted stars
  // top-right, speed and controls bottom-left, the minimap, and the transient
  // message bar at centre-bottom.
  function paintHud(state, city) {
    g.fillStyle = PALETTE.hudPanel;
    pill(12, 12, 250, 92, 10);
    g.fill();
    boldAt(cashWord(state.money), 26, 34, 26, '#7ee787', 'left', 'top');
    plainAt('CASH', 26, 62, 13, PALETTE.hudMuted, 'left', 'top');
    const hw = 150;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(96, 56, hw, 12);
    g.fillStyle = state.health > 30 ? PALETTE.health : PALETTE.healthLow;
    g.fillRect(96, 56, hw * Math.max(0, state.health / 100), 12);
    boldAt(hpWord(Math.round(state.health)), 96, 84, 15, PALETTE.hudText, 'left', 'top');
    plainAt('AMMO', 170, 84, 13, PALETTE.hudMuted, 'left', 'top');
    boldAt(ammoWord(state.ammo), 222, 84, 15, PALETTE.hudText, 'left', 'top');
    const def = MISSION_DEFS[state.missionIndex];
    g.fillStyle = PALETTE.hudPanel;
    pill(VIEW.width / 2 - 300, 12, 600, 64, 10);
    g.fill();
    if (def) {
      boldAt(jobWord(def.title), VIEW.width / 2, 30, 20, PALETTE.title, 'center', 'top');
      plainAt(objectiveText(state.missionIndex, state.stageIndex), VIEW.width / 2, 54, 16, PALETTE.hudText, 'center', 'top');
      if (state.missionTimer > 0) {
        boldAt(`⏱ ${Math.ceil(state.missionTimer)}s`, VIEW.width / 2 + 268, 30, 18, '#ffb020', 'right', 'top');
      }
    } else {
      boldAt('ALL JOBS DONE — DEBT PAID!', VIEW.width / 2, 30, 20, PALETTE.title, 'center', 'top');
      plainAt('Vireo Bay is yours. Keep driving.', VIEW.width / 2, 54, 16, PALETTE.hudText, 'center', 'top');
    }
    g.fillStyle = PALETTE.hudPanel;
    pill(VIEW.width - 244, 12, 232, 52, 10);
    g.fill();
    plainAt('WANTED', VIEW.width - 230, 30, 14, PALETTE.hudMuted, 'left', 'top');
    for (let i = 0; i < 5; i += 1) {
      boldAt('★', VIEW.width - 144 + i * 22, 26, 26, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'left', 'top');
    }
    if (!state.player.onFoot) {
      const kmh = Math.round(Math.abs(state.player.speed) * 0.36);
      boldAt(paceWord(kmh), 26, VIEW.height - 30, 30, PALETTE.hudText, 'left', 'alphabetic');
      plainAt('km/h', 26, VIEW.height - 58, 13, PALETTE.hudMuted, 'left', 'alphabetic');
      plainAt('E — get out    F — shoot', 26, VIEW.height - 84, 14, PALETTE.hudMuted, 'left', 'alphabetic');
    } else {
      plainAt('WASD — move    E — enter car    Space — punch    F — shoot', 26, VIEW.height - 30, 14, PALETTE.hudMuted, 'left', 'alphabetic');
    }
    paintMap(state, city);
    if (state.messageTimer > 0 && state.message) {
      g.fillStyle = PALETTE.hudPanel;
      const w = Math.min(760, 40 + state.message.length * 9);
      pill(VIEW.width / 2 - w / 2, VIEW.height - 118, w, 40, 10);
      g.fill();
      plainAt(state.message, VIEW.width / 2, VIEW.height - 91, 17, PALETTE.hudText, 'center', 'middle');
    }
  }

  // The centred card behind the title, pause and game-over screens.
  function paintCard(title, lines, prompt) {
    const height = CARD_TOP + lines.length * CARD_ROW + CARD_FOOT;
    const x = (VIEW.width - CARD_W) / 2;
    const y = (VIEW.height - height) / 2;
    g.fillStyle = PALETTE.panel;
    pill(x, y, CARD_W, height, 14);
    g.fill();
    g.strokeStyle = 'rgba(255,210,62,0.5)';
    g.lineWidth = 2;
    pill(x, y, CARD_W, height, 14);
    g.stroke();
    g.textBaseline = 'alphabetic';
    boldAt(title, VIEW.width / 2, y + 82, 52, PALETTE.title, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      plainAt(lines[index], VIEW.width / 2, y + CARD_TOP + index * CARD_ROW, 20, PALETTE.hudMuted, 'center');
    }
    boldAt(prompt, VIEW.width / 2, y + height - 36, 22, '#f2c94c', 'center');
  }

  /** Paint one frame: the world through the camera, then the HUD or a card. */
  function draw(state, city, screen, best) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0d1117';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const cam = state.camera;
    const ox = VIEW.width / 2 - cam.x;
    const oy = VIEW.height / 2 - cam.y;
    g.setTransform(zoom.scale, 0, 0, zoom.scale, zoom.ox, zoom.oy);
    // Clip to the 1280x720 view so nothing spills into the letterbox.
    g.save();
    g.beginPath();
    g.rect(0, 0, VIEW.width, VIEW.height);
    g.clip();
    g.translate(ox, oy);
    paintScene(state, city);
    g.restore();
    // Golden hour: a thin warm tint plus a soft vignette over the world
    // only, so the HUD and its text stay crisp and un-tinted.
    const warm = g.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
      VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.75,
    );
    warm.addColorStop(0, 'rgba(255, 176, 80, 0.045)');
    warm.addColorStop(0.7, 'rgba(255, 160, 60, 0.06)');
    warm.addColorStop(1, 'rgba(40, 20, 60, 0.15)');
    g.fillStyle = warm;
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      // A light dim, so the living city shows through behind the title card.
      g.fillStyle = 'rgba(8, 10, 18, 0.28)';
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      paintCard('VIREO BAY', [
        'An open-world crime game in a sun-soaked bay city.',
        'Dana Voss owes the Bay Syndicate $5,000. Four jobs. One fast car.',
        'Steal cars, lose the cops, run the jobs, pay the debt.',
        'WASD drive & walk · E enter / steal a car · Space punch · F shoot · P pause',
        `Best haul yet: $${best}`,
      ], 'Press Space or click to start');
      return;
    }
    paintHud(state, city);
    if (screen === SCREEN_PLAY) paintTag(state);
    if (screen === SCREEN_PAUSED) {
      g.fillStyle = 'rgba(8, 10, 18, 0.55)';
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      paintCard('Paused', ['The city waits for you.', `Cash $${state.money} · Jobs done ${state.stats.delivered} / 4`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      g.fillStyle = 'rgba(8, 10, 18, 0.55)';
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      if (state.won || state.endReason === 'won') {
        paintCard('DEBT PAID!', [`Dana cleared the $5,000 and kept $${state.money}.`, `Jobs done: ${state.stats.delivered} · Cars stolen: ${state.stats.stolen}`], 'Press Space to play again');
      } else if (state.endReason === 'busted') {
        paintCard('BUSTED', ['The Vireo Bay PD caught up with Dana.', 'Bail cost $100. The jobs are still waiting.'], 'Press Space to try again');
      } else {
        paintCard('WASTED', ['Dana went down in Vireo Bay.', `Cash kept: $${state.money}`], 'Press Space to try again');
      }
    }
  }

  fit();
  window.addEventListener('resize', fit);
  return { draw, screenToWorld };
}
