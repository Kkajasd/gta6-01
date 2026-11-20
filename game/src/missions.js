// The four jobs of Vireo Bay: where each one points, what it pays, and
// what finishing it does. World.js drives the phases; this module only
// knows the jobs themselves. It imports nothing from world.js (no cycle:
// world.js imports this module).
import { JOBS, WANTED_MAX } from './config.js';
import { clamp } from './random.js';

// Point a job at its place in the city and raise the heat for it.
export function startJob(world, index) {
  const def = JOBS[index];
  if (!def) return;
  const places = world.city.places;
  let target;
  if (index === 0) target = { x: places.plaza.x, y: places.plaza.y, label: 'Sol Plaza' };
  else if (index === 1) target = { x: places.marina.x, y: places.marina.y, label: 'Marina' };
  else if (index === 2) target = { x: places.hideout.x, y: places.hideout.y, label: 'Hideout' };
  else target = { x: places.docks.x, y: places.docks.y, label: 'Harbor Docks' };
  world.job.target = target;
  world.job.phase = 'go';
  world.job.timer = 0;
  world.player.wanted = clamp(Math.max(world.player.wanted, Math.min(def.wanted, 3)), 0, WANTED_MAX);
  world.player.heat = 8;
}

// The objective marker for the HUD and the minimap.
export function jobTarget(world) {
  return world.job.target;
}

// Pay out a finished job and clear some heat.
export function jobComplete(world, index) {
  const def = JOBS[index];
  const reward = def ? def.reward : 0;
  world.player.cash += reward;
  world.player.wanted = Math.max(0, world.player.wanted - 1);
  return reward;
}

// The short label the HUD banner shows for the current job.
export function jobLabel(world) {
  const def = JOBS[world.job.index];
  if (!def) return 'Debt paid';
  return def.short + ' — ' + def.brief;
}
