<script>
  let { history = [], tierColors = [] } = $props();

  const W = 800;
  const H = 280;
  const PAD = { top: 10, right: 70, bottom: 22, left: 55 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top - PAD.bottom;
  const GRID_LINES = 4;

  let maxDemand = $derived.by(() => {
    if (history.length === 0) return 100;
    const peak = Math.max(...history.map(h => h.demand));
    return Math.max(100, peak * 1.15);
  });

  let maxPrice = $derived.by(() => {
    if (history.length === 0) return 0.002;
    const peak = Math.max(...history.map(h => h.price));
    return Math.max(0.001, peak * 1.15);
  });

  function px(i) {
    if (history.length <= 1) return PAD.left;
    return PAD.left + (i / (history.length - 1)) * PW;
  }

  function yD(d) {
    return PAD.top + PH - (d / maxDemand) * PH;
  }

  function yP(p) {
    return PAD.top + PH - (p / maxPrice) * PH;
  }

  let demandPath = $derived.by(() => {
    if (history.length < 2) return '';
    return history
      .map((h, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${yD(h.demand).toFixed(1)}`)
      .join(' ');
  });

  let demandArea = $derived.by(() => {
    if (history.length < 2) return '';
    const bottom = PAD.top + PH;
    const pts = history.map((h, i) => `${px(i).toFixed(1)},${yD(h.demand).toFixed(1)}`);
    return `M${px(0).toFixed(1)},${bottom} L${pts.join(' L')} L${px(history.length - 1).toFixed(1)},${bottom} Z`;
  });

  let pricePath = $derived.by(() => {
    if (history.length < 2) return '';
    return history
      .map((h, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${yP(h.price).toFixed(1)}`)
      .join(' ');
  });

  let priceArea = $derived.by(() => {
    if (history.length < 2) return '';
    const bottom = PAD.top + PH;
    const pts = history.map((h, i) => `${px(i).toFixed(1)},${yP(h.price).toFixed(1)}`);
    return `M${px(0).toFixed(1)},${bottom} L${pts.join(' L')} L${px(history.length - 1).toFixed(1)},${bottom} Z`;
  });

  let gridYs = $derived(
    Array.from({ length: GRID_LINES + 1 }, (_, i) => PAD.top + (i / GRID_LINES) * PH)
  );

  let demandLabels = $derived(
    Array.from({ length: GRID_LINES + 1 }, (_, i) => ({
      y: gridYs[i],
      value: Math.round(maxDemand * (1 - i / GRID_LINES)),
    }))
  );

  let priceLabels = $derived(
    Array.from({ length: GRID_LINES + 1 }, (_, i) => ({
      y: gridYs[i],
      value: (maxPrice * (1 - i / GRID_LINES)).toFixed(4),
    }))
  );

  let last = $derived(history.length > 0 ? history[history.length - 1] : null);
</script>

<svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
  <!-- Grid -->
  {#each gridYs as gy}
    <line x1={PAD.left} y1={gy} x2={W - PAD.right} y2={gy} class="grid-line" />
  {/each}

  <!-- Area fills -->
  {#if history.length >= 2}
    <path d={demandArea} fill="rgba(99, 102, 241, 0.08)" />
    <path d={priceArea} fill="rgba(0, 212, 170, 0.06)" />
  {/if}

  <!-- Lines -->
  {#if history.length >= 2}
    <path d={demandPath} fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linejoin="round" />
    <path d={pricePath} fill="none" stroke="#00d4aa" stroke-width="2" stroke-linejoin="round" />
  {/if}

  <!-- Latest value indicators -->
  {#if last}
    <circle cx={px(history.length - 1)} cy={yD(last.demand)} r="3" fill="#6366f1" />
    <circle cx={px(history.length - 1)} cy={yP(last.price)} r="4" fill="#00d4aa" />
  {/if}

  <!-- Y-axis: demand (left) -->
  {#each demandLabels as lbl}
    <text x={PAD.left - 8} y={lbl.y + 3.5} text-anchor="end" class="axis-text demand-text">
      {lbl.value}
    </text>
  {/each}

  <!-- Y-axis: price (right) -->
  {#each priceLabels as lbl}
    <text x={W - PAD.right + 8} y={lbl.y + 3.5} text-anchor="start" class="axis-text price-text">
      ${lbl.value}
    </text>
  {/each}

  <!-- Legend -->
  <rect x={PAD.left} y={H - 14} width="8" height="8" rx="1" fill="#6366f1" />
  <text x={PAD.left + 12} y={H - 7} class="legend-text">Demand</text>
  <rect x={PAD.left + 75} y={H - 14} width="8" height="8" rx="1" fill="#00d4aa" />
  <text x={PAD.left + 87} y={H - 7} class="legend-text">Price</text>
</svg>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .grid-line {
    stroke: rgba(255, 255, 255, 0.05);
    stroke-width: 1;
  }
  .axis-text {
    font-size: 9px;
    font-family: -apple-system, system-ui, sans-serif;
  }
  .demand-text {
    fill: rgba(99, 102, 241, 0.5);
  }
  .price-text {
    fill: rgba(0, 212, 170, 0.5);
  }
  .legend-text {
    font-size: 10px;
    fill: rgba(255, 255, 255, 0.4);
    font-family: -apple-system, system-ui, sans-serif;
  }
</style>
