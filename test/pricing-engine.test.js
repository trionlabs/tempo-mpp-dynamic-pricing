import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PricingEngine } from '../src/pricing-engine.js';

/**
 * Helper: creates a PricingEngine with a controllable clock.
 * Returns `{ engine, advance(ms) }` where `advance()` moves time forward.
 */
function createEngine(config = {}) {
  let time = 0;
  const now = () => time;
  const engine = new PricingEngine({ now, ...config });
  return {
    engine,
    advance(ms) { time += ms; },
    setTime(t) { time = t; },
  };
}

// Ring buffer/demand tracking
describe('PricingEngine – demand tracking', () => {
  it('starts with zero demand', () => {
    const { engine } = createEngine();
    assert.equal(engine.getDemand(), 0);
  });

  it('records a single request', () => {
    const { engine } = createEngine();
    engine.recordRequest();
    assert.equal(engine.getDemand(), 1);
  });

  it('records multiple requests at once', () => {
    const { engine } = createEngine();
    engine.recordRequest(10);
    assert.equal(engine.getDemand(), 10);
  });

  it('accumulates requests within the same bucket', () => {
    const { engine } = createEngine();
    engine.recordRequest(3);
    engine.recordRequest(7);
    assert.equal(engine.getDemand(), 10);
  });

  it('spreads requests across buckets as time advances', () => {
    const { engine, advance } = createEngine();
    engine.recordRequest(5);
    advance(1000); // next bucket
    engine.recordRequest(3);
    assert.equal(engine.getDemand(), 8);
  });

  it('expires requests after the window passes', () => {
    const { engine, advance } = createEngine({ windowSize: 5, bucketSize: 1 });
    engine.recordRequest(10);
    advance(6000); // 6s > 5s window
    assert.equal(engine.getDemand(), 0);
  });

  it('partially expires — keeps recent requests', () => {
    const { engine, advance } = createEngine({ windowSize: 5, bucketSize: 1 });
    engine.recordRequest(10); // t=0
    advance(3000);
    engine.recordRequest(7);  // t=3s
    advance(3000);            // t=6s, first batch expired, second still live
    assert.equal(engine.getDemand(), 7);
  });

  it('handles large time gaps (> window) gracefully', () => {
    const { engine, advance } = createEngine({ windowSize: 10 });
    engine.recordRequest(100);
    advance(60_000); // 60s >> 10s window
    assert.equal(engine.getDemand(), 0);
  });

  it('reset clears all state', () => {
    const { engine } = createEngine();
    engine.recordRequest(50);
    engine.reset();
    assert.equal(engine.getDemand(), 0);
    assert.equal(engine.smoothedPrice, null);
  });
});

// Tier interpolation
describe('PricingEngine – tier interpolation', () => {
  const tiers = [
    { threshold: 0,   multiplier: 1.0 },
    { threshold: 100, multiplier: 2.0 },
    { threshold: 200, multiplier: 4.0 },
  ];
  const basePrice = 1.0;

  it('returns base multiplier at zero demand', () => {
    const { engine } = createEngine({ tiers, basePrice });
    assert.equal(engine.getRawPrice(), 1.0);
  });

  it('returns exact multiplier at tier boundary', () => {
    const { engine } = createEngine({ tiers, basePrice });
    engine.recordRequest(100);
    assert.equal(engine.getRawPrice(), 2.0);
  });

  it('linearly interpolates between tiers', () => {
    const { engine } = createEngine({ tiers, basePrice });
    engine.recordRequest(50); // midpoint of [0,100]
    assert.equal(engine.getRawPrice(), 1.5);
  });

  it('interpolates in upper tier', () => {
    const { engine } = createEngine({ tiers, basePrice });
    engine.recordRequest(150); // midpoint of [100,200]
    assert.equal(engine.getRawPrice(), 3.0);
  });

  it('caps at max multiplier above highest tier', () => {
    const { engine } = createEngine({ tiers, basePrice });
    engine.recordRequest(9999);
    assert.equal(engine.getRawPrice(), 4.0);
  });

  it('respects basePrice scaling', () => {
    const { engine } = createEngine({ tiers, basePrice: 0.5 });
    engine.recordRequest(100);
    assert.equal(engine.getRawPrice(), 1.0); // 0.5 * 2.0
  });
});

// EMA smoothingz
describe('PricingEngine – EMA smoothing', () => {
  it('first call returns raw price (cold start)', () => {
    const { engine } = createEngine({ basePrice: 1.0, smoothingAlpha: 0.5 });
    engine.recordRequest(100); // at default tiers: multiplier ~2.0
    const price = engine.getCurrentPrice();
    assert.equal(price, engine.getRawPrice());
  });

  it('smoothed price lags behind raw price changes', () => {
    const { engine, advance } = createEngine({
      basePrice: 1.0,
      smoothingAlpha: 0.3,
      tiers: [
        { threshold: 0, multiplier: 1.0 },
        { threshold: 100, multiplier: 10.0 },
      ],
    });

    // Warm up at base price
    engine.getCurrentPrice(); // initializes smoothedPrice to basePrice (1.0)
    advance(1000);

    // Spike demand
    engine.recordRequest(100);
    const smoothed = engine.getCurrentPrice();
    const raw = engine.getRawPrice();
    assert.ok(smoothed > 1.0, 'smoothed should rise above base');
    assert.ok(smoothed < raw, 'smoothed should lag behind raw after spike');
  });

  it('converges toward raw price over time', () => {
    const { engine, advance } = createEngine({
      basePrice: 1.0,
      smoothingAlpha: 0.5,
      tiers: [
        { threshold: 0, multiplier: 1.0 },
        { threshold: 100, multiplier: 5.0 },
      ],
      windowSize: 120, // long window so demand doesn't expire
    });

    engine.getCurrentPrice(); // init at base
    advance(100);
    engine.recordRequest(100);

    // Sample over many seconds, price should converge to 5.0
    let price;
    for (let i = 0; i < 30; i++) {
      advance(1000);
      price = engine.getCurrentPrice();
    }
    assert.ok(Math.abs(price - 5.0) < 0.01, `expected ~5.0, got ${price}`);
  });

  it('smoothingAlpha=1 gives no smoothing (instant)', () => {
    const { engine, advance } = createEngine({
      basePrice: 1.0,
      smoothingAlpha: 1.0,
      tiers: [
        { threshold: 0, multiplier: 1.0 },
        { threshold: 100, multiplier: 3.0 },
      ],
    });

    engine.getCurrentPrice(); // init
    advance(1000);
    engine.recordRequest(100);
    const price = engine.getCurrentPrice();
    assert.equal(price, 3.0);
  });
});

// Formatted price & status

describe('PricingEngine – output formats', () => {
  it('getFormattedPrice returns dollar-prefixed string', () => {
    const { engine } = createEngine({ basePrice: 0.001 });
    const formatted = engine.getFormattedPrice();
    assert.ok(formatted.startsWith('$'));
    assert.ok(formatted.includes('0.001'));
  });

  it('getTierInfo returns correct level and name', () => {
    const { engine } = createEngine();
    engine.recordRequest(300);
    const info = engine.getTierInfo();
    assert.equal(info.name, 'Elevated');
    assert.equal(info.level, 2);
    assert.ok(info.multiplier > 2.0);
  });

  it('getStatus contains all expected fields', () => {
    const { engine } = createEngine();
    const status = engine.getStatus();
    assert.ok('demand' in status);
    assert.ok('rawPrice' in status);
    assert.ok('smoothedPrice' in status);
    assert.ok('formattedPrice' in status);
    assert.ok('tier' in status);
    assert.ok('config' in status);
  });
});

// Edge cases
describe('PricingEngine – edge cases', () => {
  it('handles rapid sequential calls without time advancing', () => {
    const { engine } = createEngine();
    for (let i = 0; i < 100; i++) {
      engine.recordRequest();
    }
    assert.equal(engine.getDemand(), 100);
  });

  it('handles custom tier configuration', () => {
    const { engine } = createEngine({
      basePrice: 10,
      tiers: [
        { threshold: 0, multiplier: 1 },
        { threshold: 10, multiplier: 100 },
      ],
    });
    engine.recordRequest(10);
    assert.equal(engine.getRawPrice(), 1000);
  });

  it('single-tier config always returns that multiplier', () => {
    const { engine } = createEngine({
      basePrice: 5,
      tiers: [{ threshold: 0, multiplier: 2 }],
    });
    engine.recordRequest(9999);
    assert.equal(engine.getRawPrice(), 10);
  });

  it('demand never goes negative', () => {
    const { engine, advance } = createEngine({ windowSize: 5 });
    engine.recordRequest(1);
    advance(100_000); // way past window
    assert.ok(engine.getDemand() >= 0);
  });
});
