<script>
  import { Bot, ShoppingBag, Flame, Server, Activity, Scale, Info, ArrowRight } from 'lucide-svelte';
</script>

<div class="docs-grid">
  
  <!-- Card 1: The Protocol -->
  <div class="doc-card">
    <div class="card-header">
      <div class="icon-badge">01</div>
      <h3>The x402 Protocol</h3>
    </div>
    <div class="card-body">
      <p class="summary">
        HTTP 402 "Payment Required" enables machine-to-machine payments. 
        Instead of subscriptions, clients pay <strong>per-request</strong>.
      </p>
      
      <div class="code-block">
        <div class="code-line"><span class="key">HTTP/1.1</span> <span class="val">402 Payment Required</span></div>
        <div class="code-line"><span class="key">x-402-price:</span> <span class="lit">0.001000 USDC</span></div>
        <div class="code-line"><span class="key">x-402-address:</span> <span class="lit">0x71C...9A</span></div>
      </div>

      <div class="problem-box">
        <div class="prob-icon"><Info size="12" /></div>
        <p class="prob-text">
          <strong>Problem:</strong> Static pricing ($0.001) is inefficient. 
          It stifles growth during low traffic and fails to capture value during surges.
        </p>
      </div>
    </div>
  </div>

  <!-- Card 2: The Solution -->
  <div class="doc-card">
    <div class="card-header">
      <div class="icon-badge">02</div>
      <h3>Dynamic Engine</h3>
    </div>
    <div class="card-body">
      <p class="summary">
        A demand-based surge pricing engine acting as a load balancer.
      </p>
      
      <div class="spec-list">
        <div class="spec-item">
          <Activity size="14" class="spec-icon" />
          <div class="spec-content">
            <span class="label">Sliding Window</span>
            <span class="desc">60s rolling velocity tracker</span>
          </div>
        </div>
        <div class="spec-item">
          <Scale size="14" class="spec-icon" />
          <div class="spec-content">
            <span class="label">Piecewise Curve</span>
            <span class="desc">5-tier linear interpolation</span>
          </div>
        </div>
        <div class="spec-item">
          <Server size="14" class="spec-icon" />
          <div class="spec-content">
            <span class="label">EMA Smoothing</span>
            <span class="desc">Anti-jitter signal processing</span>
          </div>
        </div>
      </div>

      <div class="mini-viz">
        <svg viewBox="0 0 100 40" class="curve-svg">
          <path d="M5,35 Q25,35 40,20 T95,5" fill="none" stroke="var(--accent)" stroke-width="1.5" />
          <circle cx="5" cy="35" r="2" fill="var(--tier-1)" />
          <circle cx="40" cy="20" r="2" fill="var(--tier-3)" />
          <circle cx="95" cy="5" r="2" fill="var(--tier-5)" />
        </svg>
      </div>
    </div>
  </div>

  <!-- Card 3: Methodology -->
  <div class="doc-card">
    <div class="card-header">
      <div class="icon-badge">03</div>
      <h3>Methodology</h3>
    </div>
    <div class="card-body">
      <p class="summary">
        Simulation governed by <strong>Elasticity of Demand (E<sub>d</sub>)</strong>.
      </p>

      <div class="actor-list">
        <div class="actor">
          <div class="actor-icon-box"><Bot size="14" /></div>
          <div class="actor-info">
            <div class="actor-top">
              <strong>Inelastic</strong>
              <small>Bot / DDoS</small>
            </div>
            <div class="actor-math">E ≈ 0</div>
          </div>
        </div>
        <div class="actor">
          <div class="actor-icon-box"><ShoppingBag size="14" /></div>
          <div class="actor-info">
            <div class="actor-top">
              <strong>Elastic</strong>
              <small>Shopper</small>
            </div>
            <div class="actor-math">E &gt; 1.0</div>
          </div>
        </div>
        <div class="actor">
          <div class="actor-icon-box"><Flame size="14" /></div>
          <div class="actor-info">
            <div class="actor-top">
              <strong>Sticky</strong>
              <small>Viral / FOMO</small>
            </div>
            <div class="actor-math">E &lt; 1.0</div>
          </div>
        </div>
      </div>
    </div>
  </div>

</div>

<style>
  .docs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
    margin-bottom: 2rem;
  }

  .doc-card {
    background: var(--bg-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius);
    padding: 0.6rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 0.5px solid var(--border);
    padding-bottom: 0.4rem;
    margin-bottom: 0.2rem;
  }

  .icon-badge {
    font-family: var(--font-mono);
    font-size: 0.5rem;
    color: var(--accent);
    background: var(--bg-elevated);
    padding: 2px 4px;
    border-radius: 3px;
    border: 0.5px solid var(--border-hover);
  }

  h3 {
    margin: 0;
    font-size: 0.55rem;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Body Text */
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    flex: 1;
  }

  p {
    font-size: 0.5rem;
    line-height: 1.4;
    color: var(--text-secondary);
  }
  
  strong { color: var(--text); font-weight: 500; }

  .summary {
    color: var(--text);
  }

  .problem-box {
    background: var(--bg-card-alt);
    padding: 0.4rem;
    border-radius: var(--radius-sm);
    display: flex;
    gap: 0.4rem;
    align-items: flex-start;
  }
  
  .prob-icon { color: var(--tier-5); margin-top: 1px; }
  .prob-text { font-size: 0.45rem; color: var(--text-dim); }
  .prob-text strong { color: var(--text-secondary); }

  /* Code Block */
  .code-block {
    background: var(--bg-card-alt);
    padding: 0.4rem;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.45rem;
    border: 0.5px solid var(--border);
  }
  
  .code-line { margin-bottom: 2px; }
  .key { color: var(--text-dim); }
  .val { color: var(--text-secondary); }
  .lit { color: var(--accent); }

  /* Spec List */
  .spec-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .spec-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem;
    background: var(--bg-card-alt);
    border-radius: var(--radius-sm);
    border: 0.5px solid var(--border);
  }
  
  .spec-icon { color: var(--accent); opacity: 0.7; }
  
  .spec-content {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  
  .label { font-size: 0.48rem; color: var(--text); font-weight: 500; }
  .desc { font-size: 0.42rem; color: var(--text-dim); }

  /* Mini Viz */
  .mini-viz {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: auto;
  }
  .curve-svg { width: 100%; height: 100%; overflow: visible; }

  /* Actor List */
  .actor-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .actor {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-card-alt);
    padding: 0.3rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 0.5px solid var(--border);
  }

  .actor-icon-box { 
    color: var(--accent); 
    background: var(--bg-elevated);
    width: 1.4rem;
    height: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 0.5px solid var(--border-hover);
  }
  
  .actor-info {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .actor-top {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  
  .actor-top strong { font-size: 0.5rem; color: var(--text); }
  .actor-top small { font-size: 0.4rem; color: var(--text-dim); }
  
  .actor-math { 
    font-family: var(--font-mono); 
    font-size: 0.45rem; 
    color: var(--accent-dim); 
    background: var(--bg-elevated);
    padding: 1px 4px;
    border-radius: 3px;
  }


  @media (max-width: 768px) {
    .docs-grid { grid-template-columns: 1fr; }
  }
</style>
