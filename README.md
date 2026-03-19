# MPP Dynamic Pricing

**[Tempo Hackathon](https://hackathon.tempo.xyz/) submission** | **[Live Demo](https://mpp-dynamic-pricing.0x471.workers.dev)**

An AI inference gateway where machines pay machines for intelligence. Cloudflare Workers AI serves LLM completions and embeddings behind [MPP](https://mpp.dev) payments with real-time demand-based surge pricing. More agents requesting completions simultaneously? The price climbs.

## How it works

```
Agent ──POST /api/chat──▶ Worker ──402 + surge price──▶ Agent pays via Tempo
                                                              │
Agent ◀──AI completion + Payment-Receipt──◀ Workers AI ◀──────┘
```

1. Agent requests `/api/chat` with messages
2. Worker returns `402 Payment Required` with the current surge price
3. Agent's wallet signs a Tempo payment at the dynamic price
4. Worker runs inference via Workers AI (Llama, Mistral, etc.)
5. Response includes `Payment-Receipt` + JWT cookie for 1-hour repeat access
6. Every request is recorded — more agents = higher price

## Pricing engine

A Durable Object tracks demand per route with a sliding window and 5-tier piecewise pricing curve. EMA smoothing prevents price jitter.

| Tier | Demand threshold | Multiplier | Price at $0.001 base |
|------|----------------:|----------:|--------------------:|
| Base | 0 | 1.0x | $0.001000 |
| Normal | 50 | 1.5x | $0.001500 |
| Elevated | 200 | 2.5x | $0.002500 |
| High | 1,000 | 5.0x | $0.005000 |
| Surge | 5,000 | 10.0x | $0.010000 |

Between tiers, the multiplier is linearly interpolated. All thresholds, multipliers, and the base price are configurable per route.

## Architecture

```
├── proxy/              # Cloudflare Worker (fork of cloudflare/mpp-proxy)
│   ├── src/
│   │   ├── index.ts              # Hono app, AI handlers, routing
│   │   ├── auth.ts               # MPP payment middleware + surge pricing
│   │   ├── pricing/
│   │   │   ├── pricing-engine.ts # Sliding window, tiers, EMA smoothing
│   │   │   └── engine.ts         # Durable Object wrapper + WebSocket
│   │   └── api/routes.ts         # /__mpp/api/* pricing endpoints
│   └── wrangler.jsonc            # DO, Workers AI, protected patterns
├── simulator/          # Svelte 5 + Vite visualization dashboard
│   └── src/
│       ├── App.svelte            # Charts, scenarios, controls
│       └── lib/                  # Canvas/SVG charts, traffic scenarios
└── src/                # Standalone JS pricing engine (used by simulator)
```

## Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/chat` | MPP payment | AI chat completion (dynamic pricing) |
| `POST /api/embeddings` | MPP payment | Text embeddings (separate pricing tier) |
| `GET /__mpp/api/prices` | Public | Current dynamic prices for all routes |
| `GET /__mpp/api/status` | Public | Full status: demand, tier, config |
| `GET /__mpp/api/ws/:pattern` | Public | WebSocket live pricing stream |
| `GET /__mpp/health` | Public | Health check |

## Quick start

### Worker (proxy)

```bash
cd proxy
npm install
echo "JWT_SECRET=$(openssl rand -hex 32)" > .dev.vars
echo "MPP_SECRET_KEY=$(openssl rand -hex 32)" >> .dev.vars
npm run dev
```

```bash
# Health check
curl http://localhost:8787/__mpp/health

# See dynamic prices
curl http://localhost:8787/__mpp/api/prices

# Trigger 402 with surge pricing
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'

# Watch prices climb
for i in {1..50}; do
  curl -s -o /dev/null -X POST http://localhost:8787/api/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"x"}]}'
done
curl http://localhost:8787/__mpp/api/prices
```

### Simulator

```bash
cd simulator
pnpm install
pnpm dev
```

Dashboard at `localhost:5173` with traffic scenarios (Super Bowl, DDoS, Black Friday), real-time charts, pricing curve visualization, and revenue analysis.

### End-to-end payment test

```bash
cd proxy
PRIVATE_KEY=0x... npm run test:client
```

## Deploy

```bash
cd proxy
npx wrangler login
npx wrangler deploy
npx wrangler secret put MPP_SECRET_KEY
npx wrangler secret put JWT_SECRET
```

Live at: https://mpp-dynamic-pricing.0x471.workers.dev

## Why this wins

1. **On-theme**: MPP is for machine payments — machines paying for AI inference
2. **Real utility**: AI agents with wallets can actually use this as an API gateway
3. **All Cloudflare**: Worker + Durable Object + Workers AI = single platform, zero infra
4. **Visual demo**: Simulator shows prices climbing as agents flood the endpoint
5. **Surge pricing is novel**: No other MPP implementation does demand-based dynamic pricing

## Stack

- [Cloudflare Workers](https://workers.cloudflare.com) + [Durable Objects](https://developers.cloudflare.com/durable-objects/) + [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [MPP](https://mpp.dev) + [mppx SDK](https://mpp.dev/sdk/typescript) + [Tempo](https://tempo.xyz)
- [Hono](https://hono.dev) (routing)
- [Svelte 5](https://svelte.dev) + [Vite](https://vite.dev) (simulator)

## Links

- [MPP specification](https://mpp.dev)
- [Tempo hackathon](https://hackathon.tempo.xyz/)
- [Cloudflare MPP Proxy (upstream)](https://github.com/cloudflare/mpp-proxy)
- [Our proxy fork](https://github.com/trionlabs/dynamic-pricing-mpp-proxy)

Built by [trionlabs](https://trionlabs.dev)
