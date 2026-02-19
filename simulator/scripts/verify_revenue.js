import { PricingEngine } from '../../src/pricing-engine.js';
import { SCENARIOS, PLAYBACK_SECONDS } from '../src/lib/scenarios.js';
import { setSeed } from '../src/lib/random.js';

// Configuration mirroring App.svelte
const TICK_MS = 200;
const DEFAULT_CONFIG = {
    windowSize: 60,
    bucketSize: 1,
    basePrice: 0.001,
    tiers: [
        { threshold: 0, multiplier: 1.0 },    // Tier 1: Base
        { threshold: 50, multiplier: 1.5 },   // Tier 2: Normal
        { threshold: 200, multiplier: 2.5 },  // Tier 3: Elevated
        { threshold: 1000, multiplier: 5.0 }, // Tier 4: High
        { threshold: 5000, multiplier: 25.0 } // Tier 5: Surge
    ],
    smoothingAlpha: 0.05
};

function calculateRealizedDemand(potential, price, profile, basePrice) {
    if (!profile || profile.baseElasticity === 0) return potential;
    if (price <= 0) return potential; // Safety

    const referencePrice = basePrice;
    const priceRatio = price / referencePrice;

    // Demand curve: D = D0 * (P/P0)^-E
    let demandMultiplier = Math.pow(priceRatio, -profile.baseElasticity);

    // Clamp multiplier: Max 1.5x boost, Min 0.05x
    demandMultiplier = Math.max(0.05, Math.min(demandMultiplier, 1.5));

    return Math.round(potential * demandMultiplier);
}

console.log("Starting Verification Simulation...\n");
console.log(`${"Scenario".padEnd(20)} | ${"Profile".padEnd(10)} | ${"Static Rev".padEnd(12)} | ${"Dyn (Real)".padEnd(12)} | ${"Dyn (Ghost)".padEnd(12)} | ${"Rev Change %".padEnd(12)}`);
console.log("-".repeat(90));

SCENARIOS.forEach(scenario => {
    // Reset Simulation State
    setSeed(123456789);
    let simulatedClockMs = 0;
    let totalRevenue = 0;       // Realized Dynamic Revenue
    let potentialRevenue = 0;   // Ghost/Potential Dynamic Revenue
    let staticRevenue = 0;      // Static Revenue

    // Setup Engines
    // Logic from App.svelte createEngine:
    let timeScale = scenario.simulatedDuration / PLAYBACK_SECONDS;
    let adjustedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    const simMsPerTick = TICK_MS * timeScale;
    const ticksInWindow = (adjustedConfig.windowSize * 1000) / simMsPerTick;

    if (ticksInWindow < 5) {
        const newWindowS = (5 * simMsPerTick) / 1000;
        adjustedConfig.windowSize = newWindowS;
        adjustedConfig.bucketSize = Math.max(1, Math.ceil(newWindowS / 60));
    }

    // Mock 'now' function for engine
    const nowFn = () => simulatedClockMs;

    const engine = new PricingEngine({ ...adjustedConfig, now: nowFn });
    const potentialEngine = new PricingEngine({ ...adjustedConfig, now: nowFn });

    // Simulation Loop
    let running = true;
    while (running) {
        let progress = Math.min(1, simulatedClockMs / (scenario.simulatedDuration * 1000));

        // Advance time
        simulatedClockMs += TICK_MS * timeScale;

        if (progress >= 1.0) {
            running = false;
            break;
        }

        // Get Traffic
        const potentialReqs = scenario.traffic(progress);

        // 1. Calculate Realized (Elastic)
        const currentPrice = engine.getCurrentPrice();
        const realizedReqs = calculateRealizedDemand(potentialReqs, currentPrice, scenario.marketProfile, DEFAULT_CONFIG.basePrice);

        engine.recordRequest(realizedReqs);
        const s = engine.getStatus();
        totalRevenue += realizedReqs * s.smoothedPrice;

        // 2. Calculate Potential (Ghost/Inelastic)
        potentialEngine.recordRequest(potentialReqs);
        const ps = potentialEngine.getStatus();
        potentialRevenue += potentialReqs * ps.smoothedPrice;

        // 3. Calculate Static
        staticRevenue += potentialReqs * DEFAULT_CONFIG.basePrice;
    }

    // Metrics
    const revenueChangePct = staticRevenue > 0 ? ((potentialRevenue - staticRevenue) / staticRevenue) * 100 : 0;

    console.log(
        `${scenario.name.padEnd(20)} | ` +
        `${(scenario.marketProfile?.baseElasticity || 0).toString().padEnd(10)} | ` +
        `$${staticRevenue.toFixed(2).padEnd(11)} | ` +
        `$${totalRevenue.toFixed(2).padEnd(11)} | ` +
        `$${potentialRevenue.toFixed(2).padEnd(11)} | ` +
        `${(revenueChangePct >= 0 ? "+" : "")}${revenueChangePct.toFixed(2)}%`
    );
});

console.log("\nVerification Complete.");
