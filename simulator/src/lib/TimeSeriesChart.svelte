<script>
  let { history = [], theme = 'dark' } = $props();

  let wrapper;
  let canvas;

  let W = $state(900);
  let H = $state(320);
  const S = 2;

  const PAD_L = 52, PAD_R = 68, PAD_T = 12, PAD_B = 24;
  const GRID = 4;
  const TWO_PI = Math.PI * 2;

  const FONT_AXIS = "500 9.5px 'DM Mono','SF Mono',monospace";
  const FONT_LEGEND = "500 9px 'DM Mono','SF Mono',monospace";

  // Dynamic colors state
  let colors = $state({
    potential: 'rgba(130,128,140,0.35)',
    potFillTop: 'rgba(130,128,140,0.10)',
    potFillBot: 'rgba(130,128,140,0.01)',
    demand: 'rgba(176,165,148,0.65)',
    demFillTop: 'rgba(176,165,148,0.18)',
    demFillBot: 'rgba(176,165,148,0.01)',
    price: '#e8dfd2',
    priceGlow: 'rgba(232,223,210,0.08)',
    priceFillTop: 'rgba(232,223,210,0.07)',
    priceFillBot: 'rgba(232,223,210,0.01)',
    grid: 'rgba(176,165,148,0.04)',
    axisL: 'rgba(176,165,148,0.40)',
    axisR: 'rgba(232,223,210,0.40)',
    legendText: 'rgba(130,128,140,0.50)',
    legendText2: 'rgba(176,165,148,0.50)',
    legendText3: 'rgba(232,223,210,0.40)'
  });

  function getVar(name) {
    if (typeof getComputedStyle === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function updateThemeColors() {
    colors = {
      potential: getVar('--clr-potential') || 'rgba(130,128,140,0.35)',
      potFillTop: getVar('--clr-potential-fill') || 'rgba(130,128,140,0.10)',
      potFillBot: 'rgba(130,128,140,0.01)', // Keep subtle
      demand: getVar('--clr-demand') || 'rgba(176,165,148,0.65)',
      demFillTop: getVar('--clr-demand-fill') || 'rgba(176,165,148,0.18)',
      demFillBot: 'rgba(176,165,148,0.01)',
      price: getVar('--clr-price') || '#e8dfd2',
      priceGlow: getVar('--clr-price-glow') || 'rgba(232,223,210,0.08)',
      priceFillTop: getVar('--clr-price-fill') || 'rgba(232,223,210,0.07)',
      priceFillBot: 'rgba(232,223,210,0.01)',
      grid: getVar('--clr-grid') || 'rgba(176,165,148,0.04)',
      axisL: getVar('--clr-axis') || 'rgba(176,165,148,0.40)',
      axisR: getVar('--clr-axis') || 'rgba(232,223,210,0.40)',
      legendText: getVar('--text-dim') || '#5e5c57',
      legendText2: getVar('--text-secondary') || '#908d86',
      legendText3: getVar('--text') || '#d0cdc7'
    };
    cachedCtx = null; // Force gradient rebuild
  }

  $effect(() => {
    // Depend on theme to trigger update
    const t = theme;
    // Tiny delay to ensure DOM update happened if triggered by toggle
    requestAnimationFrame(() => updateThemeColors());
  });

  let bufs = null;
  let bufLen = 0;
  function ensureBufs(n) {
    if (bufLen >= n) return;
    const sz = Math.max(n, 300);
    bufs = { xs: new Float64Array(sz), yds: new Float64Array(sz), yps: new Float64Array(sz), ypots: new Float64Array(sz) };
    bufLen = sz;
  }

  let cachedCtx = null;
  let cachedW = 0, cachedH = 0;
  let dGrad, pGrad, potGrad;

  function rebuildGradients(ctx, bottom) {
    if (cachedCtx === ctx && cachedW === W && cachedH === H) return;
    cachedCtx = ctx; cachedW = W; cachedH = H;
    
    potGrad = ctx.createLinearGradient(0, PAD_T, 0, bottom);
    potGrad.addColorStop(0, colors.potFillTop); 
    potGrad.addColorStop(1, colors.potFillBot);
    
    dGrad = ctx.createLinearGradient(0, PAD_T, 0, bottom);
    dGrad.addColorStop(0, colors.demFillTop); 
    dGrad.addColorStop(1, colors.demFillBot);
    
    pGrad = ctx.createLinearGradient(0, PAD_T, 0, bottom);
    pGrad.addColorStop(0, colors.priceFillTop); 
    pGrad.addColorStop(1, colors.priceFillBot);
  }

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

  // Draw
  $effect(() => {
    if (!canvas || W < 100 || H < 50) return;

    // Depend on colors so we redraw when they change
    const c = colors; 

    const PW = W - PAD_L - PAD_R;
    const PH = H - PAD_T - PAD_B;
    const BOTTOM = PAD_T + PH;
    const RIGHT = W - PAD_R;

    canvas.width = W * S;
    canvas.height = H * S;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.clearRect(0, 0, W, H);
    rebuildGradients(ctx, BOTTOM);

    const len = history.length;

    // Grid
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
      const y = PAD_T + (i / GRID) * PH;
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(RIGHT, y); ctx.stroke();
    }

    // Peaks
    let peakD = 0, peakP = 0;
    for (let i = 0; i < len; i++) {
      const d = history[i].demand;
      const pot = history[i].potential || d;
      const p = history[i].price;
      if (d > peakD) peakD = d;
      if (pot > peakD) peakD = pot;
      if (p > peakP) peakP = p;
    }
    const mxD = Math.max(100, peakD * 1.15);
    const mxP = Math.max(0.001, peakP * 1.15);

    if (len >= 2) {
      ensureBufs(len);
      const { xs, yds, yps, ypots } = bufs;
      const xStep = PW / (len - 1);
      const scaleD = PH / mxD;
      const scaleP = PH / mxP;

      for (let i = 0; i < len; i++) {
        xs[i] = PAD_L + i * xStep;
        yds[i] = BOTTOM - history[i].demand * scaleD;
        yps[i] = BOTTOM - history[i].price * scaleP;
        const pot = history[i].potential !== undefined ? history[i].potential : history[i].demand;
        ypots[i] = BOTTOM - pot * scaleD;
      }

      // 1. Potential area
      ctx.fillStyle = potGrad;
      ctx.beginPath(); ctx.moveTo(xs[0], BOTTOM);
      for (let i = 0; i < len; i++) ctx.lineTo(xs[i], ypots[i]);
      ctx.lineTo(xs[len - 1], BOTTOM); ctx.closePath(); ctx.fill();

      // 2. Potential line (dashed)
      ctx.save(); ctx.setLineDash([3, 4]);
      ctx.lineJoin = 'round'; ctx.strokeStyle = c.potential; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xs[0], ypots[0]);
      for (let i = 1; i < len; i++) ctx.lineTo(xs[i], ypots[i]);
      ctx.stroke(); ctx.restore();

      // 3. Demand area
      ctx.fillStyle = dGrad;
      ctx.beginPath(); ctx.moveTo(xs[0], BOTTOM);
      for (let i = 0; i < len; i++) ctx.lineTo(xs[i], yds[i]);
      ctx.lineTo(xs[len - 1], BOTTOM); ctx.closePath(); ctx.fill();

      // 4. Price area
      ctx.fillStyle = pGrad;
      ctx.beginPath(); ctx.moveTo(xs[0], BOTTOM);
      for (let i = 0; i < len; i++) ctx.lineTo(xs[i], yps[i]);
      ctx.lineTo(xs[len - 1], BOTTOM); ctx.closePath(); ctx.fill();

      // 5. Demand line
      ctx.lineJoin = 'round'; ctx.strokeStyle = c.demand; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(xs[0], yds[0]);
      for (let i = 1; i < len; i++) ctx.lineTo(xs[i], yds[i]);
      ctx.stroke();

      // 6. Price glow
      ctx.strokeStyle = c.priceGlow; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(xs[0], yps[0]);
      for (let i = 1; i < len; i++) ctx.lineTo(xs[i], yps[i]);
      ctx.stroke();

      // 7. Price line
      ctx.strokeStyle = c.price; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xs[0], yps[0]);
      for (let i = 1; i < len; i++) ctx.lineTo(xs[i], yps[i]);
      ctx.stroke();

      // Endpoints
      const lx = xs[len - 1], ldy = yds[len - 1], lpy = yps[len - 1];
      ctx.fillStyle = c.demand; ctx.beginPath(); ctx.arc(lx, ldy, 2.8, 0, TWO_PI); ctx.fill();
      
      // Halo around price dot (border-hover color usually)
      ctx.strokeStyle = c.priceGlow; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(lx, lpy, 9, 0, TWO_PI); ctx.stroke();
      
      ctx.fillStyle = c.price; ctx.strokeStyle = getVar('--bg-card') || '#18181e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(lx, lpy, 3.5, 0, TWO_PI); ctx.fill(); ctx.stroke();
    }

    // Y-axis labels
    ctx.textBaseline = 'middle'; ctx.font = FONT_AXIS;
    for (let i = 0; i <= GRID; i++) {
      const y = PAD_T + (i / GRID) * PH;
      ctx.fillStyle = c.axisL; ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(mxD * (1 - i / GRID))), PAD_L - 8, y + 1);
      ctx.fillStyle = c.axisR; ctx.textAlign = 'left';
      ctx.fillText('$' + (mxP * (1 - i / GRID)).toFixed(4), RIGHT + 8, y + 1);
    }

    // Legend
    const ly = H - 9; ctx.font = FONT_LEGEND;
    ctx.save(); ctx.setLineDash([2, 2]); ctx.strokeStyle = c.potential; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, ly); ctx.lineTo(PAD_L + 12, ly); ctx.stroke(); ctx.restore();
    ctx.fillStyle = c.legendText; ctx.textAlign = 'left';
    ctx.fillText('Potential', PAD_L + 16, ly + 1);
    
    const dLx = PAD_L + 72;
    ctx.strokeStyle = c.demand; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(dLx, ly); ctx.lineTo(dLx + 12, ly); ctx.stroke();
    ctx.fillStyle = c.legendText2; ctx.fillText('Realized', dLx + 16, ly + 1);
    
    const pLx = dLx + 72;
    ctx.strokeStyle = c.price; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pLx, ly); ctx.lineTo(pLx + 12, ly); ctx.stroke();
    ctx.fillStyle = c.legendText3; ctx.fillText('Price', pLx + 16, ly + 1);
  });
</script>

<div class="wrapper" bind:this={wrapper}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .wrapper {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
