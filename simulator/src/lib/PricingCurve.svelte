<script>
  let { tiers = [], basePrice = 0.001, currentDemand = 0, currentPrice = 0, tierColors = [] } = $props();

  const W = 400;
  const H = 280;
  const PAD = { top: 22, right: 15, bottom: 30, left: 55 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top - PAD.bottom;

  const tierNames = ['Base', 'Normal', 'Elevated', 'High', 'Surge'];

  let maxThreshold = $derived((tiers[tiers.length - 1]?.threshold || 5000) * 1.2);
  let maxMultiplier = $derived(tiers[tiers.length - 1]?.multiplier || 10);
  let maxPriceVal = $derived(basePrice * maxMultiplier * 1.15);

  function xScale(demand) {
    return PAD.left + (demand / maxThreshold) * PW;
  }

  function yScale(price) {
    return PAD.top + PH - (price / maxPriceVal) * PH;
  }

  let curvePath = $derived.by(() => {
    if (tiers.length === 0) return '';
    const pts = tiers.map((t, i) =>
      `${i === 0 ? 'M' : 'L'}${xScale(t.threshold).toFixed(1)},${yScale(basePrice * t.multiplier).toFixed(1)}`
    );
    pts.push(`L${xScale(maxThreshold).toFixed(1)},${yScale(basePrice * maxMultiplier).toFixed(1)}`);
    return pts.join(' ');
  });

  let tierRegions = $derived.by(() => {
    return tiers.map((tier, i) => {
      const nextThreshold = i < tiers.length - 1 ? tiers[i + 1].threshold : maxThreshold;
      return {
        x: xScale(tier.threshold),
        width: xScale(nextThreshold) - xScale(tier.threshold),
        color: tierColors[i] || '#666',
        name: tierNames[i],
      };
    });
  });

  let dotX = $derived(xScale(Math.min(currentDemand, maxThreshold)));
  let dotY = $derived(yScale(Math.min(currentPrice, maxPriceVal)));
</script>

<svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
  <!-- Tier background regions -->
  {#each tierRegions as region}
    <rect
      x={region.x}
      y={PAD.top}
      width={region.width}
      height={PH}
      fill={region.color}
      opacity="0.06"
    />
    <text
      x={region.x + region.width / 2}
      y={PAD.top + 14}
      text-anchor="middle"
      fill={region.color}
      class="tier-name"
    >
      {region.name}
    </text>
  {/each}

  <!-- Tier boundary dashes -->
  {#each tiers.slice(1) as tier, i}
    <line
      x1={xScale(tier.threshold)}
      y1={PAD.top}
      x2={xScale(tier.threshold)}
      y2={PAD.top + PH}
      stroke={tierColors[i + 1]}
      stroke-dasharray="3,4"
      opacity="0.2"
    />
  {/each}

  <!-- Horizontal grid -->
  {#each [1, 2, 3] as n}
    <line
      x1={PAD.left}
      y1={PAD.top + (n / 4) * PH}
      x2={W - PAD.right}
      y2={PAD.top + (n / 4) * PH}
      class="grid-line"
    />
  {/each}

  <!-- Pricing curve -->
  <path d={curvePath} fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linejoin="round" />

  <!-- Current demand vertical -->
  {#if currentDemand > 0}
    <line
      x1={dotX}
      y1={PAD.top}
      x2={dotX}
      y2={PAD.top + PH}
      stroke="#00d4aa"
      stroke-dasharray="2,3"
      opacity="0.35"
    />
  {/if}

  <!-- Current position dot -->
  <circle cx={dotX} cy={dotY} r="10" fill="none" stroke="#00d4aa" opacity="0.25" stroke-width="1" />
  <circle cx={dotX} cy={dotY} r="5" fill="#00d4aa" stroke="#0a0a12" stroke-width="2" />

  <!-- X-axis threshold labels -->
  {#each tiers as tier}
    {#if tier.threshold > 0}
      <text
        x={xScale(tier.threshold)}
        y={PAD.top + PH + 14}
        text-anchor="middle"
        class="axis-text"
      >
        {tier.threshold >= 1000 ? `${tier.threshold / 1000}k` : tier.threshold}
      </text>
    {/if}
  {/each}

  <!-- Y-axis price labels -->
  {#each [0, 0.25, 0.5, 0.75, 1] as frac}
    <text
      x={PAD.left - 8}
      y={yScale(frac * maxPriceVal) + 3.5}
      text-anchor="end"
      class="axis-text"
    >
      ${(frac * maxPriceVal).toFixed(3)}
    </text>
  {/each}

  <!-- Axis title -->
  <text x={PAD.left + PW / 2} y={H - 3} text-anchor="middle" class="axis-title">demand (req/window)</text>
</svg>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .grid-line {
    stroke: rgba(255, 255, 255, 0.04);
    stroke-width: 1;
  }
  .tier-name {
    font-size: 9px;
    font-weight: 500;
    font-family: -apple-system, system-ui, sans-serif;
  }
  .axis-text {
    font-size: 9px;
    fill: rgba(255, 255, 255, 0.35);
    font-family: -apple-system, system-ui, sans-serif;
  }
  .axis-title {
    font-size: 9px;
    fill: rgba(255, 255, 255, 0.2);
    font-family: -apple-system, system-ui, sans-serif;
  }
</style>
