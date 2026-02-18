// A simple seedable linear congruential generator (LCG)
// Ensures scenarios are deterministic (replayable)
let _seed = 123456789;

export function setSeed(s) {
  _seed = s;
}

export function random() {
  // LCG constants (same as glibc)
  _seed = (1103515245 * _seed + 12345) % 2147483648;
  return _seed / 2147483648;
}

/**
 * Returns a deterministic random integer between min (inclusive) and max (exclusive)
 */
export function randomInt(min, max) {
  return Math.floor(random() * (max - min)) + min;
}

/**
 * Returns a deterministic random float between min and max
 */
export function randomFloat(min, max) {
  return random() * (max - min) + min;
}
