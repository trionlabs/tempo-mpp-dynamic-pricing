<script>
  import precomputedData from './precomputed.json';

  let { scenarios = [], activeItemId, currentStats = null, simulatedSeconds = 0, config } = $props();

  const precomputed = Object.fromEntries(precomputedData.map(d => [d.id, d]));

  let activeTab = $state('all');

  // Build tab definitions from scenario data
  let tabs = $derived.by(() => {
    const result = [{ id: 'all', label: 'All' }];

    const hasPrimitives = scenarios.some(s => s.type === 'primitive');
    if (hasPrimitives) {
      result.push({ id: 'patterns', label: 'Patterns' });
    }

    // Collect unique durations from scenarios, sorted
    const durations = new Map();
    for (const s of scenarios) {
      if (s.type === 'scenario') {
        const dur = s.simulatedDuration;
        const label = dur >= 3600 ? `${dur / 3600}h` : `${dur / 60}m`;
        if (!durations.has(dur)) {
          durations.set(dur, { id: `dur-${dur}`, label, count: 0 });
        }
        durations.get(dur).count++;
      }
    }

    const sorted = [...durations.values()].sort((a, b) => {
      const aDur = parseInt(a.id.split('-')[1]);
      const bDur = parseInt(b.id.split('-')[1]);
      return aDur - bDur;
    });

    for (const d of sorted) {
      result.push(d);
    }

    return result;
  });

  // Filter scenarios based on active tab
  let filteredItems = $derived.by(() => {
    if (activeTab === 'all') return scenarios;
    if (activeTab === 'patterns') return scenarios.filter(s => s.type === 'primitive');

    // Duration tab: "dur-3600" etc
    const durSeconds = parseInt(activeTab.split('-')[1]);
    return scenarios.filter(s => s.type === 'scenario' && s.simulatedDuration === durSeconds);
  });

  // Format helpers
  const fmtRev = (n) => {
    if (n == null) return '-';
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(6)}`;
  };
  const fmtPct = (n) => n != null ? `${n > 0 ? '+' : ''}${n.toFixed(0)}%` : '-';

  function getElasticityLabel(e) {
    if (e === 0) return 'None';
    if (e <= 0.5) return 'Low';
    if (e <= 1.0) return 'Med';
    if (e <= 1.2) return 'High';
    return 'V.High';
  }

  function getElasticityLevel(e) {
    if (e === 0) return 'none';
    if (e >= 1.0) return 'high';
    return 'low';
  }
</script>

<div class="analysis-panel">
  <div class="panel-header">
    <h3>Simulation Laboratory</h3>
    <p class="subtitle">Revenue analysis across all scenarios</p>
  </div>

  <div class="tab-bar">
    {#each tabs as tab}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        onclick={() => activeTab = tab.id}
      >
        {tab.label}
        {#if tab.count}<span class="tab-count">{tab.count}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th class="col-name" data-tip="Traffic pattern and simulated duration">Scenario</th>
          <th class="col-tag" data-tip="Price sensitivity of users. E>1 = elastic (users leave when price rises). E<1 = sticky (users tolerate higher prices). E=0 = bots (price-insensitive).">Elasticity</th>
          <th class="col-metric" data-tip="Revenue with dynamic pricing AND market elasticity. Users leave as price rises, reducing realized demand.">Dynamic + El</th>
          <th class="col-metric col-primary" data-tip="Revenue with dynamic pricing but NO elasticity. All potential demand is served. This is the theoretical maximum for dynamic pricing.">Dynamic Pricing</th>
          <th class="col-metric" data-tip="Revenue if price stayed flat at base price ($0.001). All potential demand served at fixed rate.">Static Pricing</th>
          <th class="col-metric" data-tip="Average price paid per request. Percentage shows how much higher than the base price.">Avg Price</th>
          <th class="col-metric" data-tip="Percentage difference between Dynamic+El revenue and Static Pricing revenue.">Revenue Change</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredItems as item (item.id)}
          {@const isActive = item.id === activeItemId}
          {@const pre = precomputed[item.id]}
          {@const live = isActive && currentStats}

          {@const sRev = live ? currentStats.staticRev : pre.staticRev}
          {@const dRev = live ? currentStats.dynamicRev : pre.dynamicRev}
          {@const gRev = live ? currentStats.potentialRev : pre.potentialRev}
          {@const reqs = live ? currentStats.requests : pre.requests}

          {@const avgPrice = reqs > 0 ? dRev / reqs : 0}
          {@const avgPricePct = (reqs > 0 && config.basePrice > 0) ? ((avgPrice - config.basePrice) / config.basePrice) * 100 : 0}
          {@const perfPct = sRev > 0 ? ((dRev - sRev) / sRev) * 100 : 0}
          {@const e = item.marketProfile?.baseElasticity ?? 0}

          <tr class:active-row={isActive}>
            <td class="col-name">
              {#if isActive}<span class="indicator">●</span>{/if}
              {item.name}
              {#if item.type === 'scenario'}
                <span class="duration-badge">{item.simulatedDuration >= 3600 ? `${item.simulatedDuration/3600}h` : `${item.simulatedDuration/60}m`}</span>
              {/if}
            </td>

            <td class="col-tag">
              <span class="tag" data-level={getElasticityLevel(e)}>
                {getElasticityLabel(e)} ({e})
              </span>
            </td>

            <td class="col-metric muted">
              {fmtRev(dRev)}
            </td>

            <td class="col-metric col-primary-cell bold">
              {fmtRev(gRev)}
            </td>

            <td class="col-metric dim">
              {fmtRev(sRev)}
            </td>

            <td class="col-metric highlight">
              {fmtRev(avgPrice)}
              <span class="avg-price-pct" class:text-green={avgPricePct > 0} class:text-red={avgPricePct < 0}>
                ({fmtPct(avgPricePct)})
              </span>
            </td>

            <td class="col-metric bold" class:text-green={perfPct > 0} class:text-red={perfPct < 0}>
              {fmtPct(perfPct)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .analysis-panel {
    margin-top: 0.5rem;
    background: var(--bg-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius);
    padding: 0.6rem 0.8rem;
    font-family: var(--font-ui);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 0.55rem;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .panel-header .subtitle {
    margin: 0.1rem 0 0;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
  }

  /* ===== Tab Bar ===== */
  .tab-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.5rem 0 0.45rem;
    border-bottom: 0.5px solid var(--border);
    margin-bottom: 0;
  }

  .tab {
    font-family: var(--font-ui);
    font-size: 0.45rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
    background: transparent;
    border: 0.5px solid transparent;
    border-radius: var(--radius-sm);
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    transition: all var(--transition);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .tab:hover {
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border-color: var(--border);
  }

  .tab.active {
    color: var(--accent-light);
    background: var(--bg-elevated);
    border-color: var(--border-hover);
    font-weight: 600;
  }

  .tab-count {
    font-family: var(--font-mono);
    font-size: 0.38rem;
    color: var(--text-muted);
    font-weight: 400;
  }

  .tab.active .tab-count {
    color: var(--accent-dim);
  }

  /* ===== Table ===== */
  .table-container { overflow-x: auto; }

  table { width: 100%; border-collapse: collapse; }

  th {
    text-align: right;
    padding: 0.4rem 0.6rem;
    color: var(--text-dim);
    font-size: 0.45rem;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
    border-bottom: 0.5px solid var(--border);
    white-space: nowrap;
  }
  th.col-name, th.col-tag { text-align: left; }

  /* Primary column header emphasis */
  th.col-primary {
    color: var(--accent);
    font-weight: 700;
  }

  /* CSS Tooltips */
  th[data-tip] {
    position: relative;
    cursor: help;
  }
  th[data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-elevated);
    border: 0.5px solid var(--border-hover);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.5rem;
    font-size: 0.45rem;
    font-weight: 400;
    color: var(--text-secondary);
    white-space: normal;
    width: max-content;
    max-width: 200px;
    z-index: 10;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--transition);
    text-transform: none;
    letter-spacing: normal;
    line-height: 1.4;
  }
  th[data-tip]:hover::after {
    opacity: 1;
  }

  td {
    padding: 0.35rem 0.6rem;
    border-bottom: 0.5px solid var(--border);
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  td.col-name {
    text-align: left;
    font-family: var(--font-ui);
    color: var(--text);
    font-weight: 500;
    font-size: 0.55rem;
    white-space: nowrap;
  }
  td.col-tag { text-align: left; }

  tr:last-child td { border-bottom: none; }

  /* Active Row */
  tr.active-row td {
    background: var(--bg-card-alt);
    border-top: 0.5px solid var(--border-active);
    border-bottom: 0.5px solid var(--border-active);
  }

  .indicator {
    color: var(--accent);
    margin-right: 4px;
    font-size: 0.5rem;
    animation: pulse 1.5s infinite;
  }

  .duration-badge {
    font-size: 0.4rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    margin-left: 4px;
  }

  .bold { font-weight: 600; }
  .muted { opacity: 0.4; }
  .dim { opacity: 0.5; }
  .highlight { color: var(--accent-light); }

  /* Primary column cell emphasis */
  .col-primary-cell {
    color: var(--accent);
  }

  .avg-price-pct {
    font-size: 0.45rem;
    margin-left: 2px;
    opacity: 0.8;
  }

  .text-green { color: #98a886; }
  .text-red { color: #f87171; }

  .tag {
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.42rem;
    background: var(--bg-elevated);
    border: 0.5px solid var(--border);
    font-family: var(--font-ui);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: inline-block;
    min-width: 30px;
    text-align: center;
  }
  .tag[data-level="none"] { color: var(--text-dim); opacity: 0.7; }
  .tag[data-level="high"] { color: var(--accent); border-color: var(--border-hover); }

  @keyframes pulse {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
  }
</style>
