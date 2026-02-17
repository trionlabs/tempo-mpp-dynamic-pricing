import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { PricingEngine } from './pricing-engine.js';

// Configuration

const PORT = process.env.PORT || 4021;
const EVM_ADDRESS = process.env.EVM_ADDRESS;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.x402.org';
const NETWORK = process.env.NETWORK || 'eip155:84532'; // Base Sepolia testnet

if (!EVM_ADDRESS) {
  console.error('EVM_ADDRESS is required. Copy .env.example to .env and fill in your address.');
  process.exit(1);
}

// Initialize pricing engine
const pricingEngine = new PricingEngine();

// Initialize x402
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// Express app
const app = express();
app.use(express.json());

// CORS for simulator
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Record demand on every request to /api/* before x402 payment check.
app.use('/api', (req, res, next) => {
  pricingEngine.recordRequest();
  next();
});

// x402 payment middleware with dynamic pricing callback
app.use(
  paymentMiddleware(
    {
      'GET /api/data': {
        accepts: {
          scheme: 'exact',
          network: NETWORK,
          payTo: EVM_ADDRESS,
          price: () => pricingEngine.getFormattedPrice(),
        },
        description: 'Dynamic-priced API endpoint',
        mimeType: 'application/json',
      },
    },
    resourceServer,
  ),
);

// Routes

// The paywalled resource
app.get('/api/data', (req, res) => {
  res.json({
    data: { message: 'Premium content', timestamp: Date.now() },
    pricing: pricingEngine.getTierInfo(),
  });
});

// Free: pricing status for monitoring/dashboards
app.get('/pricing/status', (req, res) => {
  res.json(pricingEngine.getStatus());
});

// Free: health check
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Start 
app.listen(PORT, () => {
  console.log(`x402 dynamic pricing server listening on :${PORT}`);
  console.log(`  Paywalled endpoint: GET /api/data`);
  console.log(`  Pricing status:     GET /pricing/status`);
  console.log(`  Health check:       GET /health`);
});
