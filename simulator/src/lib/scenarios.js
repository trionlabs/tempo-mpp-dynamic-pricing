import { random, setSeed } from './random.js';

/** Playback duration in wall-clock seconds for scenario mode. */
export const PLAYBACK_SECONDS = 60;

/**
 * Format simulated seconds into human-readable time.
 * @param {number} seconds
 * @returns {string} e.g. "3h 45m", "12m 30s"
 */
export function formatSimulatedTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Format a duration in seconds to a short label.
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const h = seconds / 3600;
  if (h >= 1) return `${h}h`;
  const m = seconds / 60;
  return `${m}m`;
}

// ─── Primitives ──────────────────────────────────────────────────────
// Basic traffic shapes that loop forever. No simulated time, no auto-pause.
// traffic(elapsed) takes wall-clock elapsed ms, returns request count per tick.
//
// Window math: 60s window / 200ms tick = 300 ticks in window.
// Tier thresholds: Base 0, Normal 50, Elevated 200, High 1000, Surge 5000
// So req/tick targets: Base <0.17, Normal ~0.17, Elevated ~0.67, High ~3.3, Surge ~16.7

export const PRIMITIVES = [
  {
    id: 'organic',
    type: 'primitive',
    name: 'Organic',
    description: 'Low, wavy demand with gentle oscillation. Good for observing base-tier pricing behavior.',
    icon: 'M1 7Q3.5 2,6 6Q8.5 10,11 5',
    marketProfile: { baseElasticity: 1.2 },
    traffic(t) {
      // ~0-0.3 req/tick → 0-90 req/window → Base/Normal
      return Math.max(0, Math.round(0.15 + 0.15 * Math.sin(t / 4000) + (random() - 0.5) * 0.3));
    },
  },
  {
    id: 'spike',
    type: 'primitive',
    name: 'Spike',
    description: 'Periodic demand bursts every ~15 seconds. Tests how pricing responds to intermittent load.',
    icon: 'M1 9L5 9L6 2L7 9L11 9',
    marketProfile: { baseElasticity: 0.5 },
    traffic(t) {
      // Idle: 0-0.1 req/tick, Burst: 4-8 req/tick → ~1200-2400 burst window → High
      const cycle = t % 15000;
      if (cycle > 6000 && cycle < 9000) return Math.floor(4 + random() * 4);
      return random() < 0.1 ? 1 : 0;
    },
  },
  {
    id: 'flood',
    type: 'primitive',
    name: 'Flood',
    description: 'Sustained high-volume traffic at maximum intensity. Pushes pricing into surge tiers.',
    icon: 'M1 5L3 3L4.5 5L6 3L7.5 5L9 3L11 4',
    marketProfile: { baseElasticity: 0.5 },
    traffic() {
      // ~18-25 req/tick → 5400-7500 req/window → Surge
      return Math.floor(18 + random() * 7);
    },
  },
  {
    id: 'decay',
    type: 'primitive',
    name: 'Decay',
    description: 'Starts at peak volume and exponentially decreases. Shows how smoothing delays price recovery.',
    icon: 'M1 2.5Q4 3,6 6Q8 8.5,11 9',
    marketProfile: { baseElasticity: 0.8 },
    traffic(t) {
      // Starts ~30 req/tick → 9000 window (Surge), decays to 0 (Base)
      return Math.max(0, Math.floor(30 * Math.exp(-t / 8000) + random() * 0.5));
    },
  },
];

// ─── Scenarios ───────────────────────────────────────────────────────
// Real-world named events compressed into ~60s playback.
// traffic(progress) takes 0→1, returns request count per tick.
//
// Long scenarios get window scaling (5 ticks/window) in createEngine().
// Tier thresholds: Base 0, Normal 50, Elevated 200, High 1000, Surge 5000
// With 5 ticks/window: Normal ~10/tick, Elevated ~40/tick, High ~200/tick, Surge ~1000/tick

export const SCENARIOS = [
  {
    id: 'superbowl',
    type: 'scenario',
    name: 'Super Bowl Ad',
    label: 'Super Bowl',
    description: 'Simulates 1 hour. Your ad just aired during the Super Bowl — massive burst to your API endpoint as viewers flood in.',
    icon: 'M1 9L3 9L4 1L5 3L7 7L11 9',
    simulatedDuration: 3600, // 1h
    marketProfile: { baseElasticity: 0.8 },
    details: {
      peak: 'First 5 minutes',
      shape: 'Explosive spike → rapid decay',
      peakTier: 'Surge',
      phases: ['0–5m: massive inbound spike', '5–15m: rapid exponential decay', '15m+: long tail near baseline'],
    },
    traffic(progress) {
      // Peak ~1200 req/tick → x5 = 6000 → Surge
      if (progress < 0.08) {
        const ramp = progress / 0.08;
        return Math.round(1200 * Math.pow(ramp, 0.5) + random() * 150);
      }
      const decay = Math.exp(-((progress - 0.08) / 0.15) * 3);
      return Math.max(0, Math.round(decay * 1000 + random() * 20));
    },
  },
  {
    id: 'hackernews',
    type: 'scenario',
    name: 'Hacker News #1',
    label: 'HN #1',
    description: 'Simulates 24 hours. You hit #1 on Hacker News — sharp initial spike, sustained plateau through the workday, then a long overnight tail.',
    icon: 'M1 9L2.5 2L4 3.5L7 3.5L9 6L11 9',
    simulatedDuration: 86400, // 24h
    marketProfile: { baseElasticity: 1.2 },
    details: {
      peak: 'First 45 minutes',
      shape: 'Sharp spike → 6h plateau → long tail',
      peakTier: 'High',
      phases: ['0–45m: spike as post climbs rankings', '45m–6h: plateau while on front page', '6–24h: gradual tail-off overnight'],
    },
    traffic(progress) {
      // Peak ~250 req/tick → x5 = 1250 → High
      if (progress < 0.03) {
        const ramp = progress / 0.03;
        return Math.round(250 * Math.pow(ramp, 0.7) + random() * 30);
      }
      if (progress < 0.25) {
        return Math.round(180 + Math.sin(progress * 40) * 40 + random() * 25);
      }
      const tailDecay = Math.exp(-((progress - 0.25) / 0.5) * 2);
      return Math.max(0, Math.round(tailDecay * 120 + random() * 10));
    },
  },
  {
    id: 'producthunt',
    type: 'scenario',
    name: 'Product Hunt Launch',
    label: 'PH Launch',
    description: 'Simulates 12 hours. Launch day on Product Hunt — morning ramp as voters arrive, midday peak during voting hours, evening decay.',
    icon: 'M1 9Q3 9,5.5 2Q8 9,11 9',
    simulatedDuration: 43200, // 12h
    marketProfile: { baseElasticity: 1.2 },
    details: {
      peak: 'Midday (~5h in)',
      shape: 'Morning ramp → bell-curve peak → evening decay',
      peakTier: 'Elevated',
      phases: ['0–2h: early morning trickle', '2–5h: ramp as voting opens', '5–8h: peak voting hours', '8–12h: evening wind-down'],
    },
    traffic(progress) {
      // Peak ~50 req/tick → x5 = 250 → Elevated
      const bell = Math.exp(-Math.pow((progress - 0.4) / 0.18, 2));
      const morning = progress < 0.15 ? progress / 0.15 : 1;
      return Math.max(0, Math.round(bell * morning * 50 + random() * 5));
    },
  },
  {
    id: 'blackfriday',
    type: 'scenario',
    name: 'Black Friday Sale',
    label: 'Black Friday',
    description: 'Simulates 12 hours. Black Friday traffic — sustained high baseline with periodic mega-spikes from hourly flash deals.',
    icon: 'M1 5L2.5 2L4 5L5.5 2L7 5L8.5 2L10 5',
    simulatedDuration: 43200, // 12h
    marketProfile: { baseElasticity: 1.5 },
    details: {
      peak: 'Periodic throughout',
      shape: 'High baseline + repeating mega-spikes',
      peakTier: 'Surge',
      phases: ['Constant elevated baseline', 'Flash deal spikes every ~2h push into surge tier', 'No calm period — relentless demand'],
    },
    traffic(progress) {
      // Base ~30 req/tick (x5=150, Normal), spikes to ~1100 (x5=5500, Surge)
      const base = 30 + Math.sin(progress * 8) * 8;
      const spikePhase = (progress * 5) % 1;
      const spike = spikePhase < 0.15 ? Math.sin(spikePhase / 0.15 * Math.PI) * 1070 : 0;
      return Math.max(0, Math.round(base + spike + random() * 5));
    },
  },
  {
    id: 'viraltweet',
    type: 'scenario',
    name: 'Viral Tweet',
    label: 'Viral',
    description: 'Simulates 6 hours. Your tweet is going viral — accelerating growth as retweets compound, sharp peak, then gradual fade.',
    icon: 'M1 9Q4 9,6 2Q8 9,11 9',
    simulatedDuration: 21600, // 6h
    marketProfile: { baseElasticity: 0.8 },
    details: {
      peak: '~2 hours in',
      shape: 'Accelerating growth → sharp peak → long tail',
      peakTier: 'High',
      phases: ['0–2h: accelerating growth from retweet chains', '~2h: peak virality', '2–6h: gradual fade as feed moves on'],
    },
    traffic(progress) {
      // Peak ~300 req/tick → x5 = 1500 → High
      if (progress < 0.3) {
        const growth = Math.pow(progress / 0.3, 2.5);
        return Math.round(growth * 300 + random() * 25);
      }
      const decay = Math.exp(-((progress - 0.3) / 0.35) * 2);
      return Math.max(0, Math.round(decay * 300 + random() * 15));
    },
  },
  {
    id: 'ddos',
    type: 'scenario',
    name: 'DDoS Attack',
    label: 'DDoS',
    description: 'Simulates 2 hours. Sudden DDoS attack — near-instant ramp to maximum flood, sustained for the full duration.',
    icon: 'M1 9L2 9L2.5 2L11 2.5',
    simulatedDuration: 7200, // 2h
    marketProfile: { baseElasticity: 0.0 },
    details: {
      peak: 'Instant (~first 2 min)',
      shape: 'Step function → sustained max',
      peakTier: 'Surge',
      phases: ['0–2m: instant ramp to max capacity', '2m–2h: sustained flood with variance', 'No natural decay — attack continues'],
    },
    traffic(progress) {
      // Peak ~1500 req/tick → x5 = 7500 → Surge
      if (progress < 0.02) {
        return Math.round((progress / 0.02) * 1500 + random() * 150);
      }
      return Math.round(1300 + random() * 300 + Math.sin(progress * 50) * 150);
    },
  },
];

/** All items combined for lookup. */
export const ALL_TRAFFIC_ITEMS = [...PRIMITIVES, ...SCENARIOS];
