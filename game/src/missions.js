// Vireo Bay — the story and the four jobs. Dana Voss owes the Bay Syndicate
// $5,000. Four jobs, one fast car, and the debt is paid — or the cops get her.
import { HIDEOUT, SYNDICATE, BEACH_DROP } from './config.js';

export const STORY = 'Dana Voss owes the Bay Syndicate $5,000. Four jobs. One fast car.';

export const JOBS = [
  {
    id: 1,
    title: 'First Fare',
    brief: 'Pick up the client on Neon Ave and drive her to the beach.',
    kind: 'drive',
    target: { x: BEACH_DROP.x, y: BEACH_DROP.y, label: BEACH_DROP.label },
    reward: 800,
    timer: 100,
    wanted: 0,
  },
  {
    id: 2,
    title: 'The Package Run',
    brief: 'Collect 3 packages stashed around Midtown. Mind the patrols.',
    kind: 'collect',
    target: { x: 1440, y: 1120, label: 'Package stash' },
    packages: [
      { x: 1120, y: 800, taken: false },
      { x: 1760, y: 1440, taken: false },
      { x: 2400, y: 800, taken: false },
    ],
    reward: 1200,
    timer: 130,
    wanted: 1,
  },
  {
    id: 3,
    title: 'The Getaway',
    brief: 'Lose the cops, then reach the Hideout.',
    kind: 'escape',
    target: { x: HIDEOUT.x, y: HIDEOUT.y, label: HIDEOUT.label },
    reward: 1500,
    timer: 160,
    wanted: 3,
  },
  {
    id: 4,
    title: 'The Payoff',
    brief: 'Deliver $5,000 to the Syndicate tower downtown. Bring heat.',
    kind: 'deliver',
    target: { x: SYNDICATE.x, y: SYNDICATE.y, label: SYNDICATE.label },
    reward: 2000,
    timer: 190,
    wanted: 4,
  },
];

/** A fresh mission state for a new game. */
export function createMission() {
  return { job: 0, phase: 'brief', timer: 0, collected: 0, done: false, won: false, failed: false };
}

/** Start job `index` (0-based): set its target, timer and opening wanted level. */
export function startJob(world, index) {
  const job = JOBS[index];
  world.mission.job = index;
  world.mission.phase = 'active';
  world.mission.timer = job.timer;
  world.mission.collected = 0;
  world.mission.failed = false;
  if (job.packages) for (const p of job.packages) p.taken = false;
  if (job.wanted > world.wanted) world.wanted = job.wanted;
  world.message = `Job ${job.id} — ${job.title}: ${job.brief}`;
  world.announce = world.message;
}

/** The current objective: where the marker sits and what it says. */
export function jobObjective(world) {
  const m = world.mission;
  if (m.phase === 'brief') return { x: world.player.x, y: world.player.y, label: 'Press Space to start', text: STORY };
  const job = JOBS[m.job];
  if (m.phase === 'done') return { x: world.player.x, y: world.player.y, label: 'Job done', text: `${job.title} complete — $${job.reward} earned.` };
  if (job.kind === 'collect') {
    const left = job.packages.find((p) => !p.taken);
    if (!left) return { x: job.target.x, y: job.target.y, label: 'All packages', text: 'All packages collected.' };
    return { x: left.x, y: left.y, label: `Package ${m.collected + 1}/3`, text: `${job.title}: ${3 - m.collected} packages left.` };
  }
  return { x: job.target.x, y: job.target.y, label: job.target.label, text: `${job.title}: ${job.brief}` };
}

/** Advance the mission clock and check the objective. Returns an event mask. */
export function updateMission(world, dt) {
  const m = world.mission;
  if (m.phase !== 'active') return 0;
  const job = JOBS[m.job];
  m.timer -= dt;
  if (m.timer <= 0) {
    m.phase = 'brief';
    m.failed = true;
    world.message = `${job.title} failed — out of time. Press Space to retry.`;
    world.announce = world.message;
    return 0;
  }
  const p = world.player;
  if (job.kind === 'collect') {
    for (const pkg of job.packages) {
      if (!pkg.taken && Math.hypot(p.x - pkg.x, p.y - pkg.y) < 80) {
        pkg.taken = true;
        m.collected += 1;
        world.cash += 150;
        world.message = `Package ${m.collected}/3 collected.`;
        world.announce = world.message;
        if (m.collected >= 3) return finishJob(world);
      }
    }
    return 0;
  }
  if (job.kind === 'escape') {
    const d = Math.hypot(p.x - job.target.x, p.y - job.target.y);
    if (world.wanted === 0 && d < HIDEOUT.radius) return finishJob(world);
    return 0;
  }
  const d = Math.hypot(p.x - job.target.x, p.y - job.target.y);
  if (d < 110) return finishJob(world);
  return 0;
}

function finishJob(world) {
  const m = world.mission;
  const job = JOBS[m.job];
  world.cash += job.reward;
  world.score += job.reward;
  m.phase = 'done';
  world.message = `Job ${job.id} complete — $${job.reward} earned.`;
  world.announce = world.message;
  if (m.job >= JOBS.length - 1) {
    m.won = true;
    m.done = true;
    world.message = 'Debt paid. Vireo Bay is yours, Dana.';
    world.announce = world.message;
  }
  return 4; // EVENT_JOB
}

/** Move to the next job after a done one, or restart the failed one. */
export function advanceMission(world) {
  const m = world.mission;
  if (m.phase === 'done' && !m.won) {
    startJob(world, m.job + 1);
  } else if (m.failed || m.phase === 'brief') {
    startJob(world, m.job);
  }
}
