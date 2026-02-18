<script>
  let {
    tiers = [],
    basePrice = 0.001,
    currentDemand = 0,
    currentPrice = 0,
    tierColors = [],
    activeTierLevel = 0,
    theme = 'dark'
  } = $props();

  let wrapper;
  let W = $state(900);
  let H = $state(320);

  const PAD = { top: 28, right: 22, bottom: 32, left: 60 };
  const tierNames = ['Base', 'Normal', 'Elevated', 'High', 'Surge'];
  const tierOpacities = [0.035, 0.055, 0.085, 0.12, 0.17];

  let maxMultiplier = $derived(tiers[tiers.length - 1]?.multiplier || 10);
  let maxPriceVal = $derived(basePrice * maxMultiplier * 1.15);
  let PW = $derived(W - PAD.left - PAD.right);
  let PH = $derived(H - PAD.top - PAD.bottom);
  let numSegments = $derived(tiers.length);
  let segWidth = $derived(PW / numSegments);

  // Resize observer
  $effect(() => {
    if (!wrapper) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      if (r.width > 0 && r.height > 0) { W = Math.round(r.width); H = Math.round(r.height); }
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  });

  function xScale(demand) {
    if (tiers.length === 0) return PAD.left;
    for (let i = 0; i < tiers.length - 1; i++) {
      if (demand <= tiers[i + 1].threshold) {
        const span = tiers[i + 1].threshold - tiers[i].threshold;
        const frac = span > 0 ? (demand - tiers[i].threshold) / span : 0;
        return PAD.left + i * segWidth + frac * segWidth;
      }
    }
    const last = tiers[tiers.length - 1].threshold;
    const over = last > 0 ? Math.min(1, (demand - last) / (last * 0.2)) : 0;
    return PAD.left + (tiers.length - 1) * segWidth + over * segWidth;
  }

  function yScale(price) { return PAD.top + PH - (price / maxPriceVal) * PH; }

  function getMultiplier(demand) {
    if (tiers.length === 0) return 1;
    if (demand <= tiers[0].threshold) return tiers[0].multiplier;
    if (demand >= tiers[tiers.length - 1].threshold) return tiers[tiers.length - 1].multiplier;
    for (let i = 0; i < tiers.length - 1; i++) {
      if (demand >= tiers[i].threshold && demand < tiers[i + 1].threshold) {
        const span = tiers[i + 1].threshold - tiers[i].threshold;
        const frac = span > 0 ? (demand - tiers[i].threshold) / span : 0;
        return tiers[i].multiplier + frac * (tiers[i + 1].multiplier - tiers[i].multiplier);
      }
    }
    return tiers[tiers.length - 1].multiplier;
  }

  let curvePath = $derived.by(() => {
    if (tiers.length === 0 || PW < 10) return '';
    const pts = [];
    const steps = 200;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const segIdx = Math.min(Math.floor(t * numSegments), numSegments - 1);
      const segFrac = (t * numSegments) - segIdx;
      let demand;
      if (segIdx < tiers.length - 1) {
        demand = tiers[segIdx].threshold + segFrac * (tiers[segIdx + 1].threshold - tiers[segIdx].threshold);
      } else {
        demand = tiers[tiers.length - 1].threshold + segFrac * tiers[tiers.length - 1].threshold * 0.2;
      }
      const price = basePrice * getMultiplier(demand);
      pts.push(`${s === 0 ? 'M' : 'L'}${(PAD.left + t * PW).toFixed(1)},${yScale(price).toFixed(1)}`);
    }
    return pts.join(' ');
  });

  let areaPath = $derived.by(() => {
    if (!curvePath) return '';
    return curvePath + ` L${(PAD.left + PW).toFixed(1)},${(PAD.top + PH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + PH).toFixed(1)} Z`;
  });

  let tierGeometry = $derived.by(() => {
    return tiers.map((_, i) => ({
      x: PAD.left + i * segWidth,
      width: segWidth,
      color: tierColors[i] || 'var(--text-dim)',
      name: tierNames[i],
      baseOpacity: tierOpacities[i],
    }));
  });

  let xTicks = $derived.by(() => {
    return tiers.map((tier, i) => ({
      x: PAD.left + i * segWidth,
      label: tier.threshold >= 1000 ? `${tier.threshold / 1000}k` : String(tier.threshold),
    }));
  });

  let dotX = $derived(xScale(currentDemand));
  let dotY = $derived(yScale(Math.min(currentPrice, maxPriceVal)));
</script>

<div class="wrapper" bind:this={wrapper}>
  <svg viewBox="0 0 {W} {H}" width={W} height={H}>
    <defs>
      <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--clr-price-fill)" />
        <stop offset="100%" stop-color="var(--clr-price-fill)" stop-opacity="0.1" />
      </linearGradient>
    </defs>

    {#each tierGeometry as region, i}
      {@const isActive = i === activeTierLevel}
      {@const opacity = isActive ? region.baseOpacity + 0.06 : region.baseOpacity}
      <rect x={region.x} y={PAD.top} width={region.width} height={PH} fill={region.color} {opacity} />
      <rect x={region.x} y={PAD.top + PH - 1.5} width={region.width} height="1.5" fill={region.color} opacity={opacity * 2.2} />
      {#if isActive}
        <rect x={region.x} y={PAD.top} width={region.width} height="1.5" fill={region.color} opacity="0.45" />
      {/if}
      <text x={region.x + region.width / 2} y={PAD.top + 14} text-anchor="middle" fill={region.color}
        class="tier-label" opacity={isActive ? 0.85 : 0.30} font-weight={isActive ? '600' : '400'}>
        {region.name}
      </text>
    {/each}

    {#each tiers as tier, i}
      {#if i > 0}
        <line x1={PAD.left + i * segWidth} y1={PAD.top} x2={PAD.left + i * segWidth} y2={PAD.top + PH}
          stroke={tierColors[i]} stroke-dasharray="3,6" opacity="0.18" />
      {/if}
    {/each}

    {#each [1, 2, 3] as n}
      <line x1={PAD.left} y1={PAD.top + (n / 4) * PH} x2={W - PAD.right} y2={PAD.top + (n / 4) * PH} class="grid-line" />
    {/each}

    <path d={areaPath} fill="url(#pcFill)" />
    <path d={curvePath} fill="none" stroke="var(--clr-axis)" stroke-width="1.5" stroke-linejoin="round" />

    {#if currentDemand > 0}
      <line x1={dotX} y1={PAD.top} x2={dotX} y2={PAD.top + PH} stroke="var(--border-active)" stroke-dasharray="2,4" />
      <line x1={PAD.left} y1={dotY} x2={dotX} y2={dotY} stroke="var(--border-active)" stroke-dasharray="2,4" />
    {/if}

    <circle cx={dotX} cy={dotY} r="13" fill="none" stroke="var(--clr-price-glow)" stroke-width="0.5" />
    <circle cx={dotX} cy={dotY} r="7.5" fill="none" stroke="var(--clr-price-glow)" stroke-width="0.8" />
    <circle cx={dotX} cy={dotY} r="4" fill="var(--text)" stroke="var(--bg-card)" stroke-width="1.5" />

    {#each xTicks as tick}
      <text x={tick.x} y={PAD.top + PH + 14} text-anchor="middle" class="axis-text">{tick.label}</text>
    {/each}

    {#each [0, 0.25, 0.5, 0.75, 1] as frac}
      <text x={PAD.left - 7} y={yScale(frac * maxPriceVal) + 3.5} text-anchor="end" class="axis-text">
        ${(frac * maxPriceVal).toFixed(3)}
      </text>
    {/each}

    <text x={PAD.left + PW / 2} y={H - 5} text-anchor="middle" class="axis-title">demand (req/window)</text>
  </svg>
</div>

<style>
  .wrapper { flex: 1; min-height: 0; position: relative; overflow: hidden; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .grid-line { stroke: var(--clr-grid); stroke-width: 0.5; }
  .tier-label { font-size: 10px; font-family: 'Outfit', -apple-system, system-ui, sans-serif; }
  .axis-text { font-size: 9.5px; font-weight: 500; fill: var(--text-dim); font-family: 'DM Mono', 'SF Mono', monospace; font-variant-numeric: tabular-nums; }
  .axis-title { font-size: 9px; fill: var(--text-dim); font-family: 'Outfit', -apple-system, system-ui, sans-serif; letter-spacing: 0.03em; }
</style>
