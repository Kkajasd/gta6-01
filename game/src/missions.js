// The story of Vireo Bay: four jobs for Dana Voss, a courier who owes the wrong
// people money and drives her way out of it. Each mission is a chain of stages; a
// stage names its objective text, its map marker and what completes it. The world
// reads the stages, never the story text, so a stage can be re-staged for a screenshot
// without changing the rules.
// Round 3: no mission change — the polish is visual only.
// Round 6: re-written live under the recording; no mission change.

import { MISSIONS } from './config.js';

export const STORY = {
  hero: 'Dana Voss',
  city: 'Vireo Bay',
  intro: 'Dana Voss owes the Bay Syndicate $5,000. Four jobs. One fast car. Pay it off.',
};

export const MISSION_DEFS = [
  {
    title: 'Job 1 — First Delivery',
    brief: 'Pick up the sealed crate at the Harbor Docks and drop it at Cafe Lumen. Keep it clean.',
    stages: [
      { kind: 'goto', place: 'docks', text: 'Pick up the crate at the Harbor Docks', hint: 'Drive or walk to the yellow marker' },
      { kind: 'goto', place: 'cafe', text: 'Deliver the crate to Cafe Lumen', hint: 'The client waits at the cafe' },
    ],
  },
  {
    title: 'Job 2 — Hot Wheels',
    brief: 'The Syndicate wants a fast car, not yours. Borrow the red coupe by Sol Plaza — no questions.',
    stages: [
      { kind: 'steal', place: 'plaza', text: 'Take the red coupe at Sol Plaza', hint: 'Press E near the coupe to take it' },
      { kind: 'goto', place: 'market', text: 'Deliver the coupe to Bay Market', hint: 'Fast, but the cops notice stolen cars', timed: 75 },
    ],
  },
  {
    title: 'Job 3 — The Getaway',
    brief: 'The pickup went loud. Lose the police, then lay low at the Hideout until the heat dies.',
    stages: [
      { kind: 'escape', place: 'hideout', text: 'Lose the cops, then reach the Hideout', hint: 'Wanted stars must be gone when you arrive' },
    ],
  },
  {
    title: 'Job 4 — The Last Drop',
    brief: 'One last crate, one rival crew waiting at the docks. Settle it, then bring the crate home.',
    stages: [
      { kind: 'fight', place: 'docks', text: 'Clear the rival crew at the Harbor Docks', hint: 'Punch with Space, shoot with F or click' },
      { kind: 'goto', place: 'home', text: 'Bring the crate to Voss Garage', hint: 'Debt paid. Drive home.' },
    ],
  },
];

export function missionReward(index) {
  return MISSIONS.reward[index] ?? 300;
}

/** The objective line the HUD shows for the current stage. */
export function objectiveText(missionIndex, stageIndex) {
  const def = MISSION_DEFS[missionIndex];
  if (!def) return 'All jobs done — Vireo Bay is yours.';
  const stage = def.stages[stageIndex];
  return stage ? stage.text : def.title;
}
