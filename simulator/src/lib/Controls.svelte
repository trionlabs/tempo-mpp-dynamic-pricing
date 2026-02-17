<script>
  let { pattern, running, config, onPatternChange, onToggle, onReset, onConfigChange } = $props();

  let showThresholds = $state(false);

  const patternOptions = [
    { id: 'organic', label: 'Organic', desc: 'Low, wavy demand with gentle oscillation' },
    { id: 'spike', label: 'Spike', desc: 'Periodic demand bursts every ~15 seconds' },
    { id: 'flood', label: 'Flood', desc: 'Sustained high-volume traffic' },
    { id: 'decay', label: 'Decay', desc: 'Starts high, exponentially decreases' },
  ];

  const tierNames = ['Normal', 'Elevated', 'High', 'Surge'];

  function updateThreshold(index, value) {
    const newTiers = config.tiers.map((t, i) =>
      i === index ? { ...t, threshold: Number(value) } : { ...t }
    );
    onConfigChange({ ...config, tiers: newTiers });
  }
</script>

<section class="controls">
  <div class="control-row">
    <div class="pattern-buttons">
      {#each patternOptions as opt}
        <button
          class="pattern-btn"
          class:active={pattern === opt.id}
          onclick={() => onPatternChange(opt.id)}
          title={opt.desc}
        >
          {opt.label}
        </button>
      {/each}
    </div>
    <div class="action-buttons">
      <button class="action-btn" onclick={onToggle}>
        {running ? 'Pause' : 'Play'}
      </button>
      <button class="action-btn" onclick={onReset}>
        Reset
      </button>
      <button
        class="action-btn"
        class:active={showThresholds}
        onclick={() => showThresholds = !showThresholds}
      >
        Thresholds
      </button>
    </div>
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
