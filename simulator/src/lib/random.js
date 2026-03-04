// Seedable linear congruential generator (LCG) for deterministic replays.
// Uses glibc constants (a=1103515245, c=12345, m=2^31).
// Math.imul avoids float64 precision loss that normal multiplication would cause
// (1103515245 * seed can exceed Number.MAX_SAFE_INTEGER).
let _seed = 123456789;

export function setSeed(s) {
  _seed = s;
}

export function random() {
  _seed = (Math.imul(1103515245, _seed) + 12345) & 0x7fffffff;
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
