// Every tuning number and colour for "Vireo City" in one place. The camera shows a
// 1280x720 window of a much larger city; the renderer scales the window to the browser,
// so no rule below depends on the screen size.
// Round 6: re-written live under the recording; no tuning change.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The whole city, in world units. Roads run on a 480-unit grid inside it. */
export const WORLD = { width: 3840, height: 2880 };

export const ROAD = { spacing: 480, width: 116, first: 240 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 300,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.38,
  shootCooldown: 0.22,
  invulnerable: 1.0,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 240,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.9,
  grip: 3.2,
};

export const TRAFFIC = {
  count: 24,
  cruise: 150,
  cruiseJitter: 45,
  spawnGap: 90,
};

export const PEDS = { count: 40, speed: 55, speedJitter: 25, fleeSpeed: 150 };

export const POLICE = {
  maxCars: 4,
  cruise: 330,
  ramDamage: 12,
  bustRange: 30,
  spawnDistance: 700,
};

export const WANTED = {
  max: 5,
  decayDelay: 9,
  decayEvery: 6,
  steal: 1,
  hitPed: 1,
  hitCar: 1,
  shoot: 1,
};

export const COMBAT = {
  enemyHealth: 60,
  enemyRange: 260,
  enemyShootCooldown: 1.1,
  bulletSpeed: 620,
  bulletDamage: 12,
  bulletLife: 0.9,
  startAmmo: 48,
  ammoPickup: 24,
};

export const MISSIONS = { reward: [300, 450, 700, 1200] };

export const PALETTE = {
  grass: '#7fae5a',
  park: '#6da34e',
  sand: '#e3cd8f',
  water: '#2f7fb8',
  waterDeep: '#1f5f92',
  road: '#3a3f46',
  roadEdge: '#565d66',
  lane: '#d8c95a',
  sidewalk: '#9aa0a3',
  buildingRoof: ['#b0563f', '#4f7fa8', '#8a6fb0', '#c08a3e', '#5d8a6a', '#a85a72'],
  buildingEdge: '#2c2f36',
  plaza: '#b9b3a4',
  pier: '#8a6b4a',
  // Round 3: street trees, palms and roof gardens use two greens each so a
  // canopy reads as one tree instead of a flat disc.
  tree: '#3f7a2e',
  treeLight: '#5d9c42',
  palmTrunk: '#8a6b4a',
  palmLeaf: '#3e8f3a',
  player: '#ffd23e',
  playerCar: '#e8452c',
  police: '#2f6fd0',
  policeLight: '#ff3b30',
  traffic: ['#d8d8d8', '#7fb3d5', '#c27ba0', '#f0a35e', '#8bc34a', '#9e9e9e'],
  ped: ['#e8e0d0', '#7a9cc6', '#c67b7b', '#8fce9b', '#d9c27a'],
  enemy: '#8e2f2f',
  bullet: '#ffe14d',
  pickup: '#39d353',
  marker: '#ffcf3d',
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f2f4f6',
  hudMuted: '#b9c0c9',
  star: '#ffd23e',
  starEmpty: '#5a6068',
  health: '#43d17c',
  healthLow: '#e5534b',
  title: '#ffd23e',
  panel: 'rgba(16, 20, 30, 0.88)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'vireo-city.save.v1';
