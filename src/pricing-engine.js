import { DEFAULT_CONFIG, TIER_NAMES } from './config.js';

export class PricingEngine {
  /**
   * @param {object} config
   * @param {number} config.windowSize - Sliding window in seconds
   * @param {number} config.bucketSize - Seconds per bucket
   * @param {number} config.basePrice - Base price in dollars
   * @param {Array<{threshold: number, multiplier: number}>} config.tiers
   * @param {number} config.smoothingAlpha - EMA smoothing factor (0-1)
   * @param {() => number} config.now - Injectable time source (default: `Date.now()`)
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.now = config.now || (() => Date.now());

    // Ring buffer: fixed-size array of buckets, each counting requests in a 1-second slot
    const numBuckets = Math.ceil(this.config.windowSize / this.config.bucketSize);
    this.buckets = new Array(numBuckets).fill(0);
    this.currentIndex = 0;
    this.totalRequests = 0;
    this.lastBucketTime = this.now();

    // EMA state
    this.smoothedPrice = null;
    this.lastPriceTime = this.now();
  }

  /** Record one or more incoming requests. */
  recordRequest(count = 1) {
    this._advance();
    this.buckets[this.currentIndex] += count;
    this.totalRequests += count;
  }

  /** Current request count within the sliding window. */
  getDemand() {
    this._advance();
    return this.totalRequests;
  }

  /** Raw (unsmoothed) price based on current demand. */
  getRawPrice() {
    const demand = this.getDemand();
    return this.config.basePrice * this._interpolateMultiplier(demand);
  }

  /** EMA-smoothed price, the main API for x402 integration. */
  getCurrentPrice() {
    const raw = this.getRawPrice();
    return this._smooth(raw);
  }

  /** Formatted price string for x402 (e.g. "$0.001234"). */
  getFormattedPrice() {
    return `$${this.getCurrentPrice().toFixed(6)}`;
  }

  /** Current tier information. */
  getTierInfo() {
    const demand = this.getDemand();
    const { tiers } = this.config;
    let level = 0;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (demand >= tiers[i].threshold) {
        level = i;
        break;
      }
    }
    return {
      level,
      name: TIER_NAMES[level] || `Tier ${level}`,
      threshold: tiers[level].threshold,
      multiplier: this._interpolateMultiplier(demand),
      demand,
    };
  }

  /** Full status snapshot for monitoring endpoints. */
  getStatus() {
    const demand = this.getDemand();
    const raw = this.config.basePrice * this._interpolateMultiplier(demand);
    const smoothed = this._smooth(raw);
    return {
      demand,
      rawPrice: raw,
      smoothedPrice: smoothed,
      formattedPrice: `$${smoothed.toFixed(6)}`,
      tier: this.getTierInfo(),
      config: this.config,
    };
  }

  /** Reset all state (demand history and EMA). */
  reset() {
    this.buckets.fill(0);
    this.currentIndex = 0;
    this.totalRequests = 0;
    this.lastBucketTime = this.now();
    this.smoothedPrice = null;
    this.lastPriceTime = this.now();
  }

  // Internal

  /**
   * Advance the ring buffer pointer based on elapsed time.
   * Zeroes out expired buckets and subtracts their counts from totalRequests.
   */
  _advance() {
    const now = this.now();
    const elapsed = now - this.lastBucketTime;
    const steps = Math.floor(elapsed / (this.config.bucketSize * 1000));
    if (steps <= 0) return;

    const len = this.buckets.length;
    const toAdvance = Math.min(steps, len);

    for (let i = 0; i < toAdvance; i++) {
      this.currentIndex = (this.currentIndex + 1) % len;
      this.totalRequests -= this.buckets[this.currentIndex];
      this.buckets[this.currentIndex] = 0;
    }

    this.lastBucketTime += steps * this.config.bucketSize * 1000;
  }

  /**
   * Linearly interpolate the price multiplier from the tier table.
   * Avoids discontinuous price jumps at tier boundaries.
   */
  _interpolateMultiplier(demand) {
    const { tiers } = this.config;

    if (demand <= tiers[0].threshold) return tiers[0].multiplier;
    if (demand >= tiers[tiers.length - 1].threshold) return tiers[tiers.length - 1].multiplier;

    for (let i = 0; i < tiers.length - 1; i++) {
      if (demand >= tiers[i].threshold && demand < tiers[i + 1].threshold) {
        const span = tiers[i + 1].threshold - tiers[i].threshold;
        const progress = (demand - tiers[i].threshold) / span;
        return tiers[i].multiplier + progress * (tiers[i + 1].multiplier - tiers[i].multiplier);
      }
    }

    return tiers[tiers.length - 1].multiplier;
  }

  /**
   * Time-weighted EMA smoothing.
   * The effective alpha scales with elapsed time so that smoothing behavior is consistent regardless of query frequency.
   */
  _smooth(rawPrice) {
    const now = this.now();

    if (this.smoothedPrice === null) {
      this.smoothedPrice = rawPrice;
      this.lastPriceTime = now;
      return rawPrice;
    }

    const elapsedSec = (now - this.lastPriceTime) / 1000;
    const alpha = this.config.smoothingAlpha;
    const effectiveAlpha = 1 - Math.pow(1 - alpha, elapsedSec);

    this.smoothedPrice = effectiveAlpha * rawPrice + (1 - effectiveAlpha) * this.smoothedPrice;
    this.lastPriceTime = now;
    return this.smoothedPrice;
  }
}
