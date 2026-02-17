export const TIER_NAMES = ['Base', 'Normal', 'Elevated', 'High', 'Surge'];

export const DEFAULT_CONFIG = {
  // Sliding window
  windowSize: 60, // seconds
  bucketSize: 1, // seconds per bucket

  // Base price in dollars
  basePrice: 0.001,

  // Demand tiers: [threshold (requests/window), multiplier]
  // Price is linearly interpolated between adjacent tiers
  tiers: [
    { threshold: 0,    multiplier: 1.0 },
    { threshold: 50,   multiplier: 1.5 },
    { threshold: 200,  multiplier: 2.5 },
    { threshold: 1000, multiplier: 5.0 },
    { threshold: 5000, multiplier: 10.0 },
  ],

  // EMA smoothing factor, per second
  // 0 = price never changes, 1 = no smoothing, instant
  smoothingAlpha: 0.3,
};
