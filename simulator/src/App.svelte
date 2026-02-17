<script>
  import { PricingEngine } from '@engine/pricing-engine.js';
  import { DEFAULT_CONFIG } from '@engine/config.js';
  import Controls from './lib/Controls.svelte';
  import TimeSeriesChart from './lib/TimeSeriesChart.svelte';
  import PricingCurve from './lib/PricingCurve.svelte';
  import './app.css';

  const TICK_MS = 200;
  const MAX_POINTS = 300;
  const TIER_COLORS = ['#00d4aa', '#38bdf8', '#f59e0b', '#f97316', '#f43f5e'];

  const patterns = {
    organic(t) {
      return Math.max(0, Math.round(1.5 + 1.5 * Math.sin(t / 4000) + (Math.random() - 0.5) * 3));
    },
    spike(t) {
      const cycle = t % 15000;
      if (cycle > 6000 && cycle < 9000) return Math.floor(40 + Math.random() * 60);
      return Math.floor(Math.random() * 3);
    },
    flood() {
      return Math.floor(60 + Math.random() * 80);
    },
    decay(t) {
      return Math.max(0, Math.floor(120 * Math.exp(-t / 8000) + Math.random() * 2));
    },
  };

  let config = $state(structuredClone(DEFAULT_CONFIG));
  let engine = new PricingEngine(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  let running = $state(true);
  let pattern = $state('organic');
  let history = $state([]);
  let status = $state(engine.getStatus());
  let elapsed = 0;

  function tick() {
    elapsed += TICK_MS;
    const reqs = patterns[pattern](elapsed);
    engine.recordRequest(reqs);
    status = engine.getStatus();

    history.push({
      time: elapsed,
      demand: status.demand,
      price: status.smoothedPrice,
      rawPrice: status.rawPrice,
      tierLevel: status.tier.level,
      reqs,
    });

    if (history.length > MAX_POINTS) {
      history = history.slice(-MAX_POINTS);
    }
  }

  $effect(() => {
    if (running) {
      const id = setInterval(tick, TICK_MS);
      return () => clearInterval(id);
    }
  });

  function handlePatternChange(p) {
    pattern = p;
    elapsed = 0;
  }

  function handleReset() {
    engine.reset();
    history = [];
    elapsed = 0;
    status = engine.getStatus();
  }

  function handleConfigChange(newConfig) {
    config = newConfig;
    engine = new PricingEngine(JSON.parse(JSON.stringify(newConfig)));
    history = [];
    elapsed = 0;
    status = engine.getStatus();
  }

  let currentTierColor = $derived(TIER_COLORS[status.tier.level] || TIER_COLORS[0]);
</script>

<main>
  <header>
    <h1>x402 Dynamic Pricing</h1>
    <p class="subtitle">Real-time demand-based surge pricing simulator</p>
  </header>

  <section class="stats">
    <div class="stat-card">
      <span class="stat-label">Current Price</span>
      <span class="stat-value price">{status.formattedPrice}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Demand</span>
      <span class="stat-value demand">{status.demand.toLocaleString()}</span>
      <span class="stat-unit">req / {config.windowSize}s window</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Tier</span>
      <span class="stat-value" style="color: {currentTierColor}">{status.tier.name}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Multiplier</span>
      <span class="stat-value">{status.tier.multiplier.toFixed(2)}x</span>
    </div>
  </section>

  <Controls
    {pattern}
    {running}
    {config}
    onPatternChange={handlePatternChange}
    onToggle={() => running = !running}
    onReset={handleReset}
    onConfigChange={handleConfigChange}
  />

  <section class="charts">
    <div class="chart-container">
      <h2>Demand & Price</h2>
      <TimeSeriesChart {history} tierColors={TIER_COLORS} />
    </div>
    <div class="chart-container">
      <h2>Pricing Curve</h2>
      <PricingCurve
        tiers={config.tiers}
        basePrice={config.basePrice}
        currentDemand={status.demand}
        currentPrice={status.smoothedPrice}
        tierColors={TIER_COLORS}
      />
    </div>
  </section>
</main>
