// Seeded random numbers for Vireo Bay: deterministic worlds and shots.
// Every random choice in the game flows from these helpers so a fixed seed
// always rebuilds the same city, the same traffic and the same screenshots.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small hash of a string into a 32-bit seed, so named places get stable draws.
export function seedFromText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Pick one item from a list with the given random function.
export function pick(rnd, list) {
  return list[Math.floor(rnd() * list.length)];
}

// An integer in [min, max] inclusive.
export function intBetween(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

// A float in [min, max).
export function floatBetween(rnd, min, max) {
  return min + rnd() * (max - min);
}

// Shuffle a copy of the list in place order.
export function shuffled(rnd, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Clamp a number into [min, max].
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Linear interpolation between a and b at t in [0, 1].
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Wrap an angle into (-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

// Shortest signed turn from angle a toward angle b.
export function angleDelta(a, b) {
  return wrapAngle(b - a);
}

// Euclidean distance between two points.
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
