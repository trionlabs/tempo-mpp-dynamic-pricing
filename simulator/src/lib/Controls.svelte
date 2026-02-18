<script>
  let { activeItem, primitives, scenarios, progress, running, config, elasticityEnabled, onItemChange, onToggle, onReset, onConfigChange, onElasticityToggle } = $props();

  let showThresholds = $state(false);

  const tierNames = ['Normal', 'Elevated', 'High', 'Surge'];

  let isScenario = $derived(activeItem.type === 'scenario');

  let durationLabel = $derived.by(() => {
    if (!isScenario) return '';
    const h = activeItem.simulatedDuration / 3600;
    if (h >= 1) return `${h}h`;
    return `${activeItem.simulatedDuration / 60}m`;
  });

  function updateThreshold(index, value) {
    const newTiers = config.tiers.map((t, i) =>
      i === index ? { ...t, threshold: Number(value) } : { ...t }
    );
    onConfigChange({ ...config, tiers: newTiers });
  }
</script>

<section class="controls">
  <div class="control-bar">
    <!-- Scenarios (left) -->
    <div class="control-group">
      <span class="group-label">Scenario</span>
      <div class="segment-pills">
        {#each scenarios as s}
          <button
            class="segment-btn"
            class:active={activeItem.id === s.id}
            onclick={() => onItemChange(s.id)}
            title={s.description}
          >
            <svg width="0.85em" height="0.85em" viewBox="0 0 12 12"><path d={s.icon} fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {s.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="control-divider"></div>

    <!-- Primitive patterns (middle, ghost style) -->
    <div class="control-group">
      <span class="group-label">Pattern</span>
      <div class="pattern-pills">
        {#each primitives as p}
          <button
            class="pattern-btn"
            class:active={activeItem.id === p.id}
            onclick={() => onItemChange(p.id)}
            title={p.description}
          >
            <svg width="0.8em" height="0.8em" viewBox="0 0 12 12"><path d={p.icon} fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {p.name}
          </button>
        {/each}
      </div>
    </div>

    <div class="control-divider"></div>

    <!-- Playback -->
    <div class="control-group">
      <span class="group-label">Playback</span>
      <div class="playback-buttons">
        <button class="play-btn" class:paused={!running} onclick={onToggle}>
          {#if running}
            <svg width="0.85em" height="0.85em" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/><rect x="7.5" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/></svg>
          {:else}
            <svg width="0.85em" height="0.85em" viewBox="0 0 12 12"><path d="M2.5 1.5L10.5 6L2.5 10.5Z" fill="currentColor"/></svg>
          {/if}
          {running ? 'Pause' : 'Play'}
        </button>
        <button class="reset-btn" onclick={onReset}>
          <svg width="0.85em" height="0.85em" viewBox="0 0 12 12"><path d="M6 1.5A4.5 4.5 0 1 0 10.5 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M6 0.5V3L8 1.5Z" fill="currentColor"/></svg>
          Reset
        </button>
      </div>
    </div>

    <div class="control-divider"></div>

    <!-- Config (side by side) -->
    <div class="control-group">
      <span class="group-label">Config</span>
      <div class="config-buttons">
        <button
          class="config-btn"
          class:active={elasticityEnabled}
          onclick={onElasticityToggle}
        >
          <svg width="0.85em" height="0.85em" viewBox="0 0 12 12"><path d="M2 8Q4 2,6 6Q8 10,10 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Elasticity: {elasticityEnabled ? 'ON' : 'OFF'}
        </button>
        <button
          class="config-btn"
          class:active={showThresholds}
          onclick={() => showThresholds = !showThresholds}
        >
        <svg width="0.85em" height="0.85em" viewBox="0 0 12 12"><line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="1" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><circle cx="3.5" cy="3" r="1.2" fill="var(--bg-card)" stroke="currentColor" stroke-width="0.8"/><circle cx="7.5" cy="6" r="1.2" fill="var(--bg-card)" stroke="currentColor" stroke-width="0.8"/><circle cx="5" cy="9" r="1.2" fill="var(--bg-card)" stroke="currentColor" stroke-width="0.8"/></svg>
        Thresholds
        <svg class="chevron" class:open={showThresholds} width="0.75em" height="0.75em" viewBox="0 0 10 10"><path d="M3 4L5 6L7 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      </div>
    </div>
  </div>

  <!-- Description + scenario details + progress bar -->
  <div class="item-meta">
    <p class="item-description">{activeItem.description}</p>

    {#if isScenario && activeItem.details}
      <div class="scenario-details">
        <span class="detail-tag">
          <span class="detail-key">Duration</span>
          <span class="detail-val">{durationLabel}</span>
        </span>
        <span class="detail-tag">
          <span class="detail-key">Peak</span>
          <span class="detail-val">{activeItem.details.peak}</span>
        </span>
        <span class="detail-tag">
          <span class="detail-key">Shape</span>
          <span class="detail-val">{activeItem.details.shape}</span>
        </span>
        <span class="detail-tag">
          <span class="detail-key">Max Tier</span>
          <span class="detail-val">{activeItem.details.peakTier}</span>
        </span>
      </div>
      <div class="scenario-phases">
        {#each activeItem.details.phases as phase}
          <span class="phase-item">{phase}</span>
        {/each}
      </div>
    {/if}

    {#if isScenario}
      <div class="progress-bar">
        <div class="progress-fill" style="width: {Math.min(100, Math.max(0, progress * 100))}%"></div>
      </div>
    {/if}
  </div>

  {#if showThresholds}
    <div class="threshold-panel">
      {#each config.tiers.slice(1) as tier, i}
        <label class="threshold-row">
          <span class="threshold-label">
            {tierNames[i]}
            <span class="threshold-value">{tier.threshold}</span>
          </span>
          <input
            type="range"
            min={config.tiers[i].threshold + 10}
            max={i < 3 ? config.tiers[i + 2].threshold - 10 : 10000}
            value={tier.threshold}
            oninput={(e) => updateThreshold(i + 1, e.target.value)}
          />
        </label>
      {/each}
    </div>
  {/if}
</section>

<style>
  .controls {
    margin-bottom: 0.3rem;
  }

  .control-bar {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .group-label {
    font-size: 0.52rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    font-weight: 500;
    padding-left: 2px;
  }

  .control-divider {
    width: 0.5px;
    height: 1.5rem;
    background: var(--border-hover);
    align-self: flex-end;
    margin-bottom: 3px;
    flex-shrink: 0;
  }

  /* ── Scenario pills (primary, prominent) ── */
  .segment-pills {
    display: flex;
    background: var(--bg);
    border: 0.5px solid var(--border);
    border-radius: 7px;
    padding: 2px;
    gap: 1px;
  }

  .segment-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 0.28rem 0.5rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.62rem;
    font-family: var(--font-ui);
    transition: all 0.15s ease-out;
    font-weight: 400;
    white-space: nowrap;
  }

  .segment-btn svg {
    opacity: 0.45;
    flex-shrink: 0;
    transition: opacity 0.15s ease-out;
  }

  .segment-btn.active svg {
    opacity: 0.85;
  }

  .segment-btn:hover {
    color: var(--text-secondary);
    background: var(--border);
  }

  .segment-btn.active {
    background: var(--bg-card-alt);
    color: var(--accent-light);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  /* ── Pattern pills (ghost / text-link style) ── */
  .pattern-pills {
    display: flex;
    gap: 0.1rem;
    align-items: center;
  }

  .pattern-btn {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 0.28rem 0.4rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.58rem;
    font-family: var(--font-ui);
    transition: all 0.15s ease-out;
    font-weight: 300;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  .pattern-btn svg {
    opacity: 0.25;
    flex-shrink: 0;
    transition: opacity 0.15s ease-out;
  }

  .pattern-btn:hover {
    color: var(--text-dim);
  }

  .pattern-btn:hover svg {
    opacity: 0.4;
  }

  .pattern-btn.active {
    color: var(--text-secondary);
    font-weight: 400;
  }

  .pattern-btn.active svg {
    opacity: 0.6;
  }

  /* ── Item meta ── */
  .item-meta {
    margin-top: 0.45rem;
  }

  .item-description {
    font-size: 0.58rem;
    color: var(--text-dim);
    font-weight: 400;
    letter-spacing: 0.01em;
    margin-bottom: 0.3rem;
  }

  .scenario-details {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .detail-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.5rem;
    background: var(--bg-card);
    border: 0.5px solid var(--border);
    border-radius: 4px;
    padding: 0.12rem 0.4rem;
  }

  .detail-key {
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
  }

  .detail-val {
    color: var(--text-secondary);
    font-weight: 400;
  }

  .scenario-phases {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    margin-bottom: 0.3rem;
  }

  .phase-item {
    font-size: 0.48rem;
    color: var(--text-muted);
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  .phase-item + .phase-item::before {
    content: '→ ';
    color: var(--text-muted);
    opacity: 0.5;
  }

  .progress-bar {
    width: 100%;
    height: 2px;
    background: var(--border);
    border-radius: 1px;
    overflow: hidden;
    margin-top: 0.1rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-dim);
    border-radius: 1px;
    transition: width 0.2s linear;
  }

  /* ── Playback ── */
  .playback-buttons {
    display: flex;
    gap: 0.3rem;
  }

  .play-btn,
  .reset-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: var(--bg-card);
    border: 0.5px solid var(--border);
    color: var(--text-dim);
    padding: 0.28rem 0.55rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.62rem;
    font-family: var(--font-ui);
    transition: all 0.15s ease-out;
    font-weight: 400;
  }

  .play-btn:hover,
  .reset-btn:hover {
    border-color: var(--border-hover);
    color: var(--text-secondary);
    background: var(--bg-card-alt);
  }

  .play-btn.paused {
    border-color: var(--border-active);
    color: var(--accent-light);
  }

  /* ── Config ── */
  .config-buttons {
    display: flex;
    gap: 0.3rem;
  }

  .config-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: var(--bg-card);
    border: 0.5px solid var(--border);
    color: var(--text-dim);
    padding: 0.28rem 0.55rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.62rem;
    font-family: var(--font-ui);
    transition: all 0.15s ease-out;
    font-weight: 400;
  }

  .config-btn:hover {
    border-color: var(--border-hover);
    color: var(--text-secondary);
    background: var(--bg-card-alt);
  }

  .config-btn.active {
    border-color: var(--border-active);
    color: var(--accent);
    background: var(--border);
  }

  .chevron {
    transition: transform 0.2s ease-out;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  /* ── Threshold panel ── */
  .threshold-panel {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-top: 0.55rem;
    padding: 0.85rem 1rem;
    background: var(--bg-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius);
  }

  .threshold-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .threshold-label {
    font-size: 0.62rem;
    color: var(--text-dim);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .threshold-value {
    color: var(--text-secondary);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 768px) {
    .control-bar {
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .control-divider {
      display: none;
    }
    .threshold-panel {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
