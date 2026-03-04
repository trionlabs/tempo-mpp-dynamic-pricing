import { writeFileSync } from 'node:fs';
import { PricingEngine } from '../../src/pricing-engine.js';
import { DEFAULT_CONFIG } from '../../src/config.js';
import { ALL_TRAFFIC_ITEMS, PLAYBACK_SECONDS } from '../src/lib/scenarios.js';
import { setSeed } from '../src/lib/random.js';

const TICK_MS = 200;

function calculateRealizedDemand(potential, price, profile, basePrice, elasticityEnabled) {
    if (!elasticityEnabled) return potential;
    if (!profile || profile.baseElasticity === 0) return potential;
    if (price <= 0) return potential;

    const priceRatio = price / basePrice;
    let demandMultiplier = Math.pow(priceRatio, -profile.baseElasticity);
    demandMultiplier = Math.max(0.05, Math.min(demandMultiplier, 1.5));
    return Math.round(potential * demandMultiplier);
}

// Precomputed data matches the simulator's default: elasticity OFF
const ELASTICITY_ENABLED = false;

function simulateItem(item) {
    setSeed(123456789);

    const isScenario = item.type === 'scenario';
    const simulatedDuration = isScenario ? item.simulatedDuration : 60; // primitives: 60s wall-clock
    const timeScale = isScenario ? simulatedDuration / PLAYBACK_SECONDS : 1;

    let adjustedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    if (isScenario) {
        const simMsPerTick = TICK_MS * timeScale;
        const ticksInWindow = (adjustedConfig.windowSize * 1000) / simMsPerTick;
        if (ticksInWindow < 5) {
            const newWindowS = (5 * simMsPerTick) / 1000;
            adjustedConfig.windowSize = newWindowS;
            adjustedConfig.bucketSize = Math.max(1, Math.ceil(newWindowS / 60));
        }
    }

    let clockMs = 0;
    const nowFn = () => clockMs;

    const engine = new PricingEngine({ ...adjustedConfig, now: nowFn });
    const potentialEngine = new PricingEngine({ ...adjustedConfig, now: nowFn });

    let totalRevenue = 0;
    let potentialRevenue = 0;
    let staticRevenue = 0;
    let realizedReqsTotal = 0;
    let potentialReqsTotal = 0;

    const totalTicks = Math.ceil((PLAYBACK_SECONDS * 1000) / TICK_MS); // 300 ticks

    for (let tick = 0; tick < totalTicks; tick++) {
        // Advance clock first, then compute progress — matches App.svelte ordering
        // (Svelte $derived recomputes after state mutation, so progress uses post-increment clock)
        clockMs += TICK_MS * timeScale;

        const progress = isScenario
            ? Math.min(1, clockMs / (simulatedDuration * 1000))
            : undefined;

        if (isScenario && progress >= 1.0) break;

        const potentialReqs = isScenario ? item.traffic(progress) : item.traffic(clockMs);

        // Capture prices BEFORE recording demand — price at decision time
        const currentPrice = engine.getCurrentPrice();
        const ghostPrice = potentialEngine.getCurrentPrice();
        const realizedReqs = calculateRealizedDemand(potentialReqs, currentPrice, item.marketProfile, DEFAULT_CONFIG.basePrice, ELASTICITY_ENABLED);

        // Record demand after pricing
        engine.recordRequest(realizedReqs);
        potentialEngine.recordRequest(potentialReqs);

        totalRevenue += realizedReqs * currentPrice;
        potentialRevenue += potentialReqs * ghostPrice;
        staticRevenue += potentialReqs * DEFAULT_CONFIG.basePrice;
        realizedReqsTotal += realizedReqs;
        potentialReqsTotal += potentialReqs;
    }

    const avgPrice = realizedReqsTotal > 0 ? totalRevenue / realizedReqsTotal : 0;
    const avgPricePct = realizedReqsTotal > 0 && DEFAULT_CONFIG.basePrice > 0
        ? ((avgPrice - DEFAULT_CONFIG.basePrice) / DEFAULT_CONFIG.basePrice) * 100 : 0;
    const revChangeVsStatic = staticRevenue > 0 ? ((potentialRevenue - staticRevenue) / staticRevenue) * 100 : 0;

    return {
        id: item.id,
        name: item.name,
        type: item.type,
        simulatedDuration,
        elasticity: item.marketProfile?.baseElasticity ?? 0,
        staticRev: staticRevenue,
        dynamicRev: totalRevenue,
        potentialRev: potentialRevenue,
        requests: realizedReqsTotal,
        potentialRequests: potentialReqsTotal,
        avgPrice,
        avgPricePct,
        revChangeVsStatic,
    };
}

// Run all simulations
console.log("Simulating all traffic items...\n");

const results = ALL_TRAFFIC_ITEMS.map(item => {
    const r = simulateItem(item);
    const revPct = r.revChangeVsStatic;
    console.log(
        `${r.name.padEnd(20)} | ` +
        `E=${r.elasticity.toString().padEnd(4)} | ` +
        `Static $${r.staticRev.toFixed(2).padEnd(10)} | ` +
        `Dynamic $${r.dynamicRev.toFixed(2).padEnd(10)} | ` +
        `Potential $${r.potentialRev.toFixed(2).padEnd(10)} | ` +
        `${(revPct >= 0 ? "+" : "")}${revPct.toFixed(2)}%`
    );
    return r;
});

// Write precomputed.json
const outPath = new URL('../src/lib/precomputed.json', import.meta.url);
writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
console.log(`\nWrote ${outPath.pathname}`);
