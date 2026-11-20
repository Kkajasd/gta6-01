// Vireo Bay — every tuning number and colour in one place.
// The world is a fixed 3840x2560 coastal city; the renderer scales the camera
// view to the window, so no rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** World extents in world units. */
export const WORLD = { width: 3840, height: 2560 };

/** Road grid: avenues run north-south, streets east-west, every 320 units. */
export const ROAD_SPACING = 320;
export const ROAD_WIDTH = 96;
export const AVENUES = [160, 480, 800, 1120, 1440, 1760, 2080, 2400, 2720, 3040, 3360, 3680];
export const STREETS = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];

export const AVENUE_NAMES = [
  'Ocean Dr', 'Palmetto Ave', 'Neon Ave', 'Coral Way', 'Bayfront Ave', 'Harbor Blvd',
  'Sunset Strip', 'Magnolia Ave', 'Royal Palm Ave', 'Coconut Row', 'Marina Blvd', 'Tradewind Ave',
];
export const STREET_NAMES = [
  '1st St', 'Seabreeze Ln', 'Flamingo St', 'Calle Ocho', 'Sunrise Blvd',
  'Pelican Way', 'Heron St', 'Dockside Rd',
];

/** Golden-hour palette: warm low sun, long shadows, a sun-soaked bay city. */
export const PALETTE = {
  skyTop: '#ff9a3d',
  skyMid: '#ff7e5f',
  skyLow: '#feb47b',
  sunCore: '#fff3c4',
  ground: '#e8c98f',
  grass: '#7fb069',
  grassDark: '#5d9b4a',
  sand: '#f2d8a0',
  sandWet: '#e0bd7d',
  ocean: '#1d6f8e',
  oceanDeep: '#14506b',
  oceanFoam: '#eaf6f2',
  road: '#3d414e',
  roadEdge: '#2c2f3a',
  sidewalk: '#b9b3a4',
  crosswalk: '#e8e4d8',
  laneDash: '#ffd75e',
  buildingRoof: ['#c96f4a', '#8e6fb8', '#4f9d7a', '#b84a62', '#d9a441', '#5b7fa6'],
  buildingWall: ['#a85438', '#6f5394', '#3d7d60', '#96404f', '#b3822f', '#46648a'],
  windowLit: '#ffd98a',
  windowDark: '#2e3a4d',
  neon: ['#ff2e88', '#22e6ff', '#ffe14d', '#7dff5e', '#ff7a2e'],
  carPlayer: '#ff2e88',
  carPolice: '#1d2733',
  health: '#58d68d',
  cash: '#7dff5e',
  wanted: '#ffd75e',
};

/** Where the sun sits for the golden hour: low, warm, from the south-west. */
export const SUN = { x: 0.72, y: 0.18, angle: Math.PI * 0.78, length: 26 };

export const BEST_KEY = 'vireo-bay-best';
export const WANTED_MAX = 5;
export const AMMO_START = 48;
export const HEALTH_MAX = 100;

export const PLAYER = {
  walkSpeed: 235,
  radius: 13,
  carAccel: 920,
  carMax: 640,
  carReverseMax: 220,
  carBrake: 1500,
  carTurn: 3.1,
  carLength: 52,
  carWidth: 26,
};

export const TRAFFIC = { speed: 165, count: 16, colors: ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6'] };
export const PEDS = { count: 26, speed: 55 };
export const POLICE = { speed: 585, ramDamage: 9, sight: 700 };

export const HIDEOUT = { x: 3520, y: 2080, label: 'Hideout', radius: 150 };
export const SYNDICATE = { x: 1760, y: 800, label: 'Syndicate Tower' };
export const BEACH_DROP = { x: 420, y: 2080, label: 'Beach drop-off' };
