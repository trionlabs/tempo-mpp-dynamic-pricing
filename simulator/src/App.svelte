<script>
  import { PricingEngine } from '@engine/pricing-engine.js';
  import { DEFAULT_CONFIG } from '@engine/config.js';
  import { ALL_TRAFFIC_ITEMS, PRIMITIVES, SCENARIOS, PLAYBACK_SECONDS, formatSimulatedTime, formatDuration } from './lib/scenarios.js';
  import { setSeed } from './lib/random.js';
  import { formatRevenue } from './utils.js';
  import Controls from './lib/Controls.svelte';
  import TimeSeriesChart from './lib/TimeSeriesChart.svelte';
  import PricingCurve from './lib/PricingCurve.svelte';
  import AnalysisTable from './lib/AnalysisTable.svelte';
  import ProjectDocs from './lib/ProjectDocs.svelte';
  import './app.css';

  const TICK_MS = 200;
  const MAX_POINTS = 300;
  // Use CSS variables for tier colors so they switch automatically
  const TIER_COLORS = [
    'var(--tier-1)',
    'var(--tier-2)',
    'var(--tier-3)',
    'var(--tier-4)',
    'var(--tier-5)'
  ];

  let config = $state(structuredClone(DEFAULT_CONFIG));
  let activeItem = $state(PRIMITIVES[0]); // current primitive or scenario
  let running = $state(true);
  let elapsed = $state(0); // wall-clock elapsed ms (used by primitives)
  let simulatedClockMs = $state(0); // simulated time ms (used by scenarios)
  let totalRevenue = $state(0);
  let stableRevenue = $state(0);
  let potentialRevenue = $state(0); // Revenue if no elasticity (Ghost Revenue)
  let accumulatedRealizedReqs = $state(0);
  let accumulatedPotentialReqs = $state(0);
  let theme = $state('dark'); // 'dark' or 'light'
  let elasticityEnabled = $state(false);
  let showExplanation = $state(false);

  let isScenario = $derived(activeItem.type === 'scenario');
  let timeScale = $derived(isScenario ? activeItem.simulatedDuration / PLAYBACK_SECONDS : 1);
  let progress = $derived(isScenario ? Math.min(1, simulatedClockMs / (activeItem.simulatedDuration * 1000)) : -1);
  let simulatedTimeFormatted = $derived(isScenario ? formatSimulatedTime(simulatedClockMs / 1000) : null);
  let simulatedDurationFormatted = $derived(isScenario ? formatDuration(activeItem.simulatedDuration) : null);
  let simulatedElapsedHours = $derived(simulatedClockMs / (3600 * 1000));
  let revenuePerHour = $derived(simulatedElapsedHours > 0.001 ? totalRevenue / simulatedElapsedHours : 0);
  let revenueDeltaPct = $derived(stableRevenue > 0 ? ((totalRevenue - stableRevenue) / stableRevenue) * 100 : 0);

  // Track effective window size for display (may be scaled for scenarios)
  let effectiveWindowSize = $state(DEFAULT_CONFIG.windowSize);

  // Engine: scenarios use simulated time, primitives use wall-clock
  let engine = createEngine(config);
  let potentialEngine = createEngine(config); // Ghost engine to track potential demand

  function createEngine(cfg) {
    let adjustedCfg = JSON.parse(JSON.stringify(cfg));

    if (isScenario) {
      const simMsPerTick = TICK_MS * timeScale;
      const ticksInWindow = (adjustedCfg.windowSize * 1000) / simMsPerTick;
      if (ticksInWindow < 5) {
        const newWindowS = (5 * simMsPerTick) / 1000;
        adjustedCfg.windowSize = newWindowS;
        adjustedCfg.bucketSize = Math.max(1, Math.ceil(newWindowS / 60));
      }
      effectiveWindowSize = adjustedCfg.windowSize;
    } else {
      effectiveWindowSize = cfg.windowSize;
    }

    const nowFn = () => isScenario ? simulatedClockMs : elapsed;
    return new PricingEngine({ ...adjustedCfg, now: nowFn });
  }

  // Ring buffer
  let ringBuf = new Array(MAX_POINTS);
  let ringHead = 0;
  let ringCount = 0;

  let history = $state.raw([]);
  let status = $state.raw(engine.getStatus());

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleExplain() {
    showExplanation = !showExplanation;
  }

  // Market Simulator Logic
  function calculateRealizedDemand(potential, price, profile) {
    if (!elasticityEnabled) return potential;
    if (!profile || profile.baseElasticity === 0) return potential;

    // Safety check
    if (price <= 0) return potential;

    const referencePrice = config.basePrice;
    const priceRatio = price / referencePrice;

    // Demand curve: D = D0 * (P/P0)^-E
    let demandMultiplier = Math.pow(priceRatio, -profile.baseElasticity);

    // Clamp multiplier: Max 1.5x boost, Min 0.05x (never truly 0 unless potential is 0)
    demandMultiplier = Math.max(0.05, Math.min(demandMultiplier, 1.5));

    return Math.round(potential * demandMultiplier);
  }

  function tick() {
    const marketProfile = activeItem.marketProfile;

    if (isScenario) {
      // Advance simulated clock
      simulatedClockMs += TICK_MS * timeScale;

      if (progress >= 1.0) {
        running = false;
        return;
      }

      const potentialReqs = activeItem.traffic(progress);

      // Capture prices BEFORE recording demand — this is the price users see at decision time
      const currentPrice = engine.getCurrentPrice();
      const ghostPrice = potentialEngine.getCurrentPrice();
      const realizedReqs = calculateRealizedDemand(potentialReqs, currentPrice, marketProfile);

      // Record demand after pricing
      engine.recordRequest(realizedReqs);
      potentialEngine.recordRequest(potentialReqs);

      const s = engine.getStatus();

      status = s;
      totalRevenue += realizedReqs * currentPrice;
      stableRevenue += potentialReqs * config.basePrice;
      potentialRevenue += potentialReqs * ghostPrice;

      accumulatedRealizedReqs += realizedReqs;
      accumulatedPotentialReqs += potentialReqs;

      pushPoint(simulatedClockMs, s, realizedReqs, potentialEngine.getDemand());
    } else {
      // Primitive mode — wall-clock elapsed, loops forever
      elapsed += TICK_MS;

      const potentialReqs = activeItem.traffic(elapsed);

      // Capture prices BEFORE recording demand
      const currentPrice = engine.getCurrentPrice();
      const ghostPrice = potentialEngine.getCurrentPrice();
      const realizedReqs = calculateRealizedDemand(potentialReqs, currentPrice, marketProfile);

      // Record demand after pricing
      engine.recordRequest(realizedReqs);
      potentialEngine.recordRequest(potentialReqs);

      const s = engine.getStatus();

      status = s;
      totalRevenue += realizedReqs * currentPrice;
      stableRevenue += potentialReqs * config.basePrice;
      potentialRevenue += potentialReqs * ghostPrice;

      accumulatedRealizedReqs += realizedReqs;
      accumulatedPotentialReqs += potentialReqs;

      pushPoint(elapsed, s, realizedReqs, potentialEngine.getDemand());
    }
  }

  function pushPoint(time, s, reqs, potentialDemand) {
    const point = {
      time,
      demand: s.demand,
      price: s.smoothedPrice,
      rawPrice: s.rawPrice,
      tierLevel: s.tier.level,
      reqs,
      potential: potentialDemand,
    };

    ringBuf[ringHead] = point;
    ringHead = (ringHead + 1) % MAX_POINTS;
    if (ringCount < MAX_POINTS) ringCount++;

    const arr = new Array(ringCount);
    const start = ringCount < MAX_POINTS ? 0 : ringHead;
    for (let i = 0; i < ringCount; i++) {
      arr[i] = ringBuf[(start + i) % MAX_POINTS];
    }
    history = arr;
  }

  // rAF loop
  $effect(() => {
    if (!running) return;
    let rafId;
    let last = performance.now();

    function frame(now) {
      if (now - last >= TICK_MS) {
        tick();
        last = now;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  });

  function handleItemChange(id) {
    activeItem = ALL_TRAFFIC_ITEMS.find(i => i.id === id) || PRIMITIVES[0];
    resetSimulation();
  }

  function resetSimulation() {
    setSeed(123456789); // Deterministic replay
    elapsed = 0;
    simulatedClockMs = 0;
    totalRevenue = 0;
    stableRevenue = 0;
    potentialRevenue = 0;
    accumulatedRealizedReqs = 0;
    accumulatedPotentialReqs = 0;
    engine = createEngine(config);
    potentialEngine = createEngine(config);
    ringHead = 0;
    ringCount = 0;
    history = [];
    status = engine.getStatus();
    running = true;
  }

  function handleReset() {
    resetSimulation();
  }

  function handleConfigChange(newConfig) {
    config = newConfig;
    elapsed = 0;
    simulatedClockMs = 0;
    totalRevenue = 0;
    stableRevenue = 0;
    potentialRevenue = 0;
    accumulatedRealizedReqs = 0;
    accumulatedPotentialReqs = 0;
    engine = createEngine(newConfig);
    potentialEngine = createEngine(newConfig);
    ringHead = 0;
    ringCount = 0;
    history = [];
    status = engine.getStatus();
  }

  function handleElasticityToggle() {
    elasticityEnabled = !elasticityEnabled;
    resetSimulation();
  }

  function formatWindowSize(ws) {
    if (ws >= 3600) return `${(ws / 3600).toFixed(1)}h`;
    if (ws >= 60) return `${Math.round(ws / 60)}m`;
    return `${Math.round(ws)}s`;
  }

  let currentTierColor = $derived(TIER_COLORS[status.tier.level] || TIER_COLORS[0]);
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<main>
  <header>
    <div class="header-left">
      <div class="header-badge"><span>x402</span></div>
      <div class="header-text">
        <h1>x402 + Dynamic Pricing</h1>
        <p class="subtitle">Pay-per-request, priced by demand</p>
      </div>
    </div>
    <button class="theme-toggle" onclick={toggleTheme} title="Toggle theme">
      {#if theme === 'dark'}
        <!-- Sun icon -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      {:else}
        <!-- Moon icon -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      {/if}
    </button>
  </header>

  <section class="top-bar">
    <div class="stat-cell price-cell">
      <span class="stat-label">Current Price</span>
      <div class="price-row">
        <span class="stat-value price">{status.formattedPrice}</span>
        <div class="tier-inline">
          <span class="tier-dot" style="background: {currentTierColor}"></span>
          <span class="tier-name" style="color: {currentTierColor}">{status.tier.name}</span>
          <span class="multiplier-badge" style="background: {currentTierColor}">
            {status.tier.multiplier.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
    <div class="stat-cell">
      <span class="stat-label">Demand</span>
      <span class="stat-value demand">{status.demand.toLocaleString()}</span>
      <span class="stat-unit">req in last {formatWindowSize(effectiveWindowSize)}</span>
    </div>
    {#if isScenario}
      <div class="stat-cell">
        <span class="stat-label">Simulated Time</span>
        <span class="stat-value time">{simulatedTimeFormatted}</span>
        <span class="stat-unit">of {simulatedDurationFormatted}</span>
      </div>
    {/if}
    <div class="stat-cell revenue-cell">
      <span class="stat-label">Revenue</span>
      <div class="revenue-row">
        <span class="stat-value revenue">{formatRevenue(totalRevenue)}</span>
        <span class="revenue-delta" class:positive={revenueDeltaPct > 0.5} class:negative={revenueDeltaPct < -0.5} class:neutral={Math.abs(revenueDeltaPct) <= 0.5}>
          {revenueDeltaPct > 0 ? '+' : ''}{Math.abs(revenueDeltaPct) >= 1 ? revenueDeltaPct.toFixed(0) : revenueDeltaPct.toFixed(1)}%
        </span>
      </div>
      <span class="stat-unit">{formatRevenue(revenuePerHour)} / hr</span>
    </div>
  </section>

  <Controls
    {activeItem}
    primitives={PRIMITIVES}
    scenarios={SCENARIOS}
    {progress}
    {running}
    {config}
    {elasticityEnabled}
    onItemChange={handleItemChange}
    onToggle={() => running = !running}
    onReset={handleReset}
    onConfigChange={handleConfigChange}
    onElasticityToggle={handleElasticityToggle}
  />

  <section class="charts">
    <div class="chart-container">
      <h2>More Traffic → Higher Price</h2>
      <TimeSeriesChart {history} {theme} />
    </div>
    <div class="chart-container">
      <h2>Pricing Curve</h2>
      <PricingCurve
        tiers={config.tiers}
        basePrice={config.basePrice}
        currentDemand={status.demand}
        currentPrice={status.smoothedPrice}
        tierColors={TIER_COLORS}
        activeTierLevel={status.tier.level}
        {theme}
      />
    </div>
  </section>

  <AnalysisTable
    scenarios={ALL_TRAFFIC_ITEMS}
    activeItemId={activeItem.id}
    simulatedSeconds={isScenario ? simulatedClockMs / 1000 : elapsed / 1000}
    {config}
    currentStats={{
      staticRev: accumulatedPotentialReqs * config.basePrice,
      dynamicRev: totalRevenue,
      potentialRev: potentialRevenue,
      requests: accumulatedRealizedReqs,
      potentialRequests: accumulatedPotentialReqs,
    }}
  />

  <ProjectDocs />

  <footer>
    <a href="https://trionlabs.dev" target="_blank" rel="noopener noreferrer" class="footer-brand">
      <svg width="12" height="12" viewBox="0 0 491 491" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M490.94 0V490.94H0V0H490.94ZM70.6396 70.7695V140.77H140.64V210.47H70.7598V350.17H140.64V420.17H210.64V350.17H140.76V210.77H210.53V280.47H280.53V210.77H350.29V350.17H280.41V420.17H350.41V350.17H420.29V210.47H350.41V140.77H420.29V70.7695H280.41V140.77H210.64V70.7695H70.6396Z" fill="currentColor"/></svg>
      <span>trionlabs</span>
    </a>
    <a href="https://github.com/trionlabs" target="_blank" rel="noopener noreferrer" class="footer-icon" aria-label="GitHub"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg></a>
    <a href="https://x.com/traborion" target="_blank" rel="noopener noreferrer" class="footer-icon" aria-label="X"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
  </footer>
</main>
