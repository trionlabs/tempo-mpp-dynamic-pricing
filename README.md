# x402 Dynamic Pricing

Demand-based surge pricing for the [x402](https://github.com/coinbase/x402) payment protocol. Built on x402 V2's dynamic pricing callback. Instead of a static `amount` in payment requirements, V2 lets the server provide a function evaluated per-request. This project plugs a real-time demand tracker into that callback.

## How it works

A sliding window (60 seconds, ring buffer of 1-second buckets) counts incoming requests. The count maps to a 5-tier piecewise pricing curve with linear interpolation between tier boundaries. An EMA smoother prevents price jitter from short bursts.

| Tier | Demand threshold | Multiplier | Price at $0.001 base |
|------|----------------:|----------:|--------------------:|
| Base | 0 | 1.0x | $0.001000 |
| Normal | 50 | 1.5x | $0.001500 |
| Elevated | 200 | 2.5x | $0.002500 |
| High | 1,000 | 5.0x | $0.005000 |
| Surge | 5,000 | 10.0x | $0.010000 |

Between tiers, the multiplier is linearly interpolated. At 125 requests (midpoint of normal-elevated), the multiplier is 2.0x, giving $0.002000. All thresholds, multipliers, and the base price are configurable.

## Quick start

Requires Node >= 18.

### Server

```bash
pnpm install
cp .env.example .env
# Edit .env: set EVM_ADDRESS to your wallet
pnpm start
```

### Simulator

```bash
cd simulator
pnpm install
pnpm dev
```

Opens a dashboard at `localhost:5173` with demand pattern controls (organic, spike, flood, decay), live time-series charts, pricing curve visualization, and adjustable tier thresholds.

![Super Bowl Simulation](./superbowl-simulation.webp)

The simulator runs its own `PricingEngine` instance with synthetic demand, it doesn't connect to the live server. Use `GET /pricing/status` for production monitoring.

## The x402 integration point

This is the key mechanism. Instead of a static price string, the x402 middleware receives a function:

```js
'GET /api/data': {
  accepts: {
    scheme: 'exact',
    network: NETWORK,
    payTo: EVM_ADDRESS,
    price: () => pricingEngine.getFormattedPrice(),
  },
},
```

Every 402 response evaluates `getFormattedPrice()` at that instant. The client sees `maxAmountRequired` as the ceiling but pays the current dynamic price.

Demand is recorded before the payment check, both initial requests (that get 402'd) and retries with payment count as demand signals.

## API

| Endpoint | Auth | Response |
|----------|------|----------|
| `GET /api/data` | x402 (402 -> pay -> 200) | Paywalled resource. Price reflects current demand. |
| `GET /pricing/status` | None | Full snapshot: demand, raw/smoothed price, tier, config. |
| `GET /health` | None | `{ ok: true, uptime }` |

## Pricing engine API

```js
import { PricingEngine } from './src/pricing-engine.js';

const engine = new PricingEngine(config);

engine.recordRequest(count);     // Feed demand signal
engine.getDemand();              // Requests currently in the sliding window
engine.getCurrentPrice();        // EMA-smoothed price,  main integration API
engine.getRawPrice();            // Unsmoothed instantaneous price
engine.getFormattedPrice();      // "$0.001234"
engine.getTierInfo();            // { level, name, threshold, multiplier, demand }
engine.getStatus();              // Full snapshot (all of the above + config)
engine.reset();                  // Clear demand history and EMA state
```

Constructor accepts an optional config object. Any omitted fields fall back to defaults in `src/config.js`.

## Configuration

**Pricing parameters** (`src/config.js`):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `windowSize` | `60` | Sliding window duration in seconds |
| `bucketSize` | `1` | Seconds per ring buffer bucket |
| `basePrice` | `0.001` | Base price in dollars |
| `smoothingAlpha` | `0.3` | EMA factor per second (0 = frozen, 1 = no smoothing) |
| `tiers` | See table above | Array of `{ threshold, multiplier }` objects |

**Environment variables** (`.env`):

| Variable | Required | Default |
|----------|----------|---------|
| `EVM_ADDRESS` | Yes | — |
| `FACILITATOR_URL` | No | `https://facilitator.x402.org` |
| `PORT` | No | `4021` |
| `NETWORK` | No | `eip155:84532` (Base Sepolia) |

## Tests

```bash
pnpm test
```

26 tests across 5 suite for demand tracking, tier interpolation, EMA smoothing, output formats, and edge cases. Uses Node's built-in `node:test`, no test framework dependency.

## Current Limitations

- Single-node only: The sliding window lives in process memory. Multiple server instances behind a load balancer track demand independently. Distributed deployment needs a shared counter (Redis or similar).

- No "gaming" protection: An actor who knows the tier boundaries can time requests to stay just below a threshold. Highly recommended to pair with rate limiting in production.

- EMA lag is by design: After a demand spike, the smoothed price takes several seconds to converge to the raw price. After demand drops, it takes several seconds to decay. This prevents jitter but means the paid price lags the "true" instantaneous price.