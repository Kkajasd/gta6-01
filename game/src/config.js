// Tuning and constants for Vireo Bay: the city grid, the golden-hour sun,
// the districts, the jobs and the controls. Every other module reads from
// here so the whole game can be retuned in one place.
export const TILE = 64;
export const ROAD_W = 64;
export const BLOCK_W = 320;
export const BLOCK_H = 240;
export const COLS = 6;
export const ROWS = 5;
export const WORLD_W = COLS * (BLOCK_W + ROAD_W) + ROAD_W;
export const WORLD_H = ROWS * (BLOCK_H + ROAD_W) + ROAD_W;
export const STEP = 1 / 60;

// Where the sun sits for the golden hour: low, warm, from the south-west.
export const SUN = { x: 0.72, y: 0.18, angle: Math.PI * 0.78, length: 34 };

// The golden-hour palette: warm sky, deep asphalt, sun-bleached blocks.
export const PALETTE = {
  skyTop: '#ff9a5c',
  skyMid: '#ffb37a',
  skyLow: '#ffd9a0',
  road: '#3a3230',
  roadEdge: '#54443c',
  sidewalk: '#8f8578',
  curb: '#6e675c',
  sand: '#e8c98a',
  water: '#2e7f9e',
  waterDeep: '#1f5f7d',
  grass: '#7fae5a',
  grassDark: '#6a9a4a',
  plaza: '#b7a98f',
  wood: '#8a6a45',
  woodDark: '#6f5436',
};

export const BEST_KEY = 'vireo-bay-best';
export const WANTED_MAX = 5;
export const DEBT = 5000;

// The four jobs, in story order. Each pays cash and raises the heat.
export const JOBS = [
  {
    id: 0,
    name: 'First Fare',
    short: 'Job 1 — First Fare',
    brief: 'Pick up the fare at Sol Plaza',
    reward: 250,
    wanted: 1,
  },
  {
    id: 1,
    name: 'The Package Run',
    short: 'Job 2 — The Package Run',
    brief: 'Grab the package, lose the tail',
    reward: 600,
    wanted: 2,
  },
  {
    id: 2,
    name: 'The Getaway',
    short: 'Job 3 — The Getaway',
    brief: 'Lose the cops, then reach the Hideout',
    reward: 1200,
    wanted: 3,
  },
  {
    id: 3,
    name: 'Payoff',
    short: 'Job 4 — Payoff',
    brief: 'Clear the rival crew at the Harbor Docks',
    reward: 3500,
    wanted: 4,
  },
];

// Named places the HUD and the missions point at.
export const PLACES = {
  hideout: { name: 'Hideout', x: 0, y: 0 },
  plaza: { name: 'Sol Plaza', x: 0, y: 0 },
  docks: { name: 'Harbor Docks', x: 0, y: 0 },
  marina: { name: 'Marina', x: 0, y: 0 },
  beach: { name: 'Palmetto Beach', x: 0, y: 0 },
};

// Street names for the HUD pill, one per road line.
export const STREETS_X = ['Bayfront Ave', 'Coral St', 'Neon Blvd', 'Sunset Dr', 'Harbor Way'];
export const STREETS_Y = ['Ocean Row', 'Palm Court', 'Vice St', 'Tropic Ln', 'Pier Rd', 'Dune Ave'];

// Neon signs painted on building faces.
export const NEON_SIGNS = ['TACOS', 'MOTEL', 'DINER', 'GYM', 'HOTEL', 'BAR'];

// Player tuning.
export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 250,
  radius: 13,
  punchRange: 34,
  punchArc: 1.1,
  shootCooldown: 0.22,
  startAmmo: 48,
  maxHealth: 100,
};

// Car tuning.
export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 520,
  maxReverse: 140,
  turnRate: 2.6,
  grip: 3.2,
  length: 46,
  width: 22,
};

// Traffic tuning.
export const TRAFFIC = {
  count: 14,
  speedMin: 90,
  speedMax: 150,
  pedCount: 22,
};

// Police tuning.
export const POLICE = {
  accel: 470,
  maxSpeed: 560,
  turnRate: 3.0,
  ramDamage: 8,
  bustRange: 26,
  spawnDistance: 420,
};
