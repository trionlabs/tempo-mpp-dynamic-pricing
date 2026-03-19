# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dynamic pricing project built on the Modular Payment Protocol (MPP), developed for the Tempo hackathon.

**Use Case: AI Agent API Gateway** — "Machine Payments Protocol, used by machines to pay for machine intelligence."

Cloudflare Workers AI provides LLM inference as a built-in binding. The Worker gates access to AI models behind MPP payments with dynamic surge pricing. As more agents/users request completions simultaneously, the price climbs.

## Architecture

```
mpp-dynamic-pricing/
├── proxy/              # Cloudflare Worker (submodule: trionlabs/dynamic-pricing-mpp-proxy)
│   ├── src/
│   │   ├── index.ts         # Main Hono app, routes, AI handlers
│   │   ├── auth.ts          # MPP payment middleware + dynamic pricing integration
│   │   ├── env.ts           # Environment types
│   │   ├── pricing/
│   │   │   ├── config.ts        # Tier config, defaults
│   │   │   ├── pricing-engine.ts # Core pricing algorithm (sliding window, EMA, tiers)
│   │   │   └── engine.ts        # Durable Object wrapper
│   │   └── api/
│   │       └── routes.ts    # /__mpp/api/* pricing endpoints
│   ├── wrangler.jsonc       # Worker config (DO, AI binding, protected patterns)
│   ├── .dev.vars            # Local secrets (MPP_SECRET_KEY, JWT_SECRET)
│   └── test-client.ts       # End-to-end MPP payment flow test
├── simulator/          # Svelte 5 + Vite visualization dashboard
│   └── src/
│       ├── App.svelte       # Main app with local pricing simulation
│       └── lib/             # Charts, controls, scenarios, analysis
├── src/                # Standalone JS pricing engine (used by simulator)
│   ├── config.js
│   └── pricing-engine.js
└── CLAUDE.md
```

## Key Endpoints

- `GET /__mpp/health` — Health check (always public)
- `GET /__mpp/api/prices` — Current dynamic prices for all routes
- `GET /__mpp/api/status` — Full status with demand, tier, config
- `GET /__mpp/api/ws/:pattern` — WebSocket for live pricing stream
- `POST /api/chat` — AI chat completion (protected, dynamic pricing)
- `POST /api/embeddings` — Text embeddings (protected, dynamic pricing)

## Development

```bash
# Proxy (Cloudflare Worker)
cd proxy && npm install
npm run dev                    # Local dev with Miniflare (DOs work locally)
npx wrangler deploy            # Deploy to Cloudflare

# Simulator
cd simulator && pnpm install
pnpm dev                       # Svelte dashboard at localhost:5173

# Test MPP payment flow
cd proxy
PRIVATE_KEY=0x... npm run test:client

# Secrets (already set for deployed worker)
npx wrangler secret put MPP_SECRET_KEY
npx wrangler secret put JWT_SECRET
```

## Deployed URL

https://mpp-dynamic-pricing.0x471.workers.dev

## Reference Links

- MPP specification: https://mpp.dev
- Tempo hackathon: https://hackathon.tempo.xyz/
- Hackathon ideas: https://hackathon.tempo.xyz/ideas
- Tempo: https://tempo.xyz
- Cloudflare MPP Proxy (reference implementation): https://github.com/cloudflare/mpp-proxy
- Our proxy fork: https://github.com/trionlabs/dynamic-pricing-mpp-proxy
- Main repo: https://github.com/trionlabs/tempo-mpp-dynamic-pricing

## Verification

1. `curl https://mpp-dynamic-pricing.0x471.workers.dev/__mpp/health` → OK
2. `curl https://mpp-dynamic-pricing.0x471.workers.dev/__mpp/api/prices` → dynamic prices
3. `POST /api/chat` → 402 with dynamic surge price
4. Rapid requests → prices climb
5. `cd simulator && pnpm dev` → dashboard shows pricing curves
6. `PRIVATE_KEY=0x... npm run test:client` → full MPP payment flow
