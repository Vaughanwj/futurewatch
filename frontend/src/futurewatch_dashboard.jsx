/**
 * FutureWatch Meter — front page.
 * Triptych: how far / what's left / how fast, per methodology-draft.md §5.
 * Reads /data/futurewatch.json (weekly pipeline output).
 */
import { useMemo } from 'react';

// ── Palette (Frokkle-adjacent dark terminal) ─────────────────────────────────
export const C = {
  bg: '#0b0e14',
  panel: '#11151f',
  panelEdge: '#1c2230',
  text: '#d7dce6',
  textDim: '#8a93a6',
  textLow: '#5a6375',
  orange: '#f5923e',
  red: '#e5484d',
  yellow: '#e2b93d',
  green: '#46a758',
  blue: '#4e9cf5',
  track: '#1a2030',
};

export const mono = "'IBM Plex Mono', ui-monospace, monospace";
export const sans = "'Inter', system-ui, sans-serif";

const PLAIN = {
  selfLearning: 'Learning on the fly from experience',
  realTimeEngagement: 'Holding its own in live group conversation',
  arcGap: 'Handling truly novel situations',
  hendrycksAgiScore: 'Matching a well-educated adult across the board',
  epochBenchmarks: 'Expert-level scores on the hardest benchmarks',
  metrTimeHorizon: 'Working unsupervised for long stretches',
  agenticAutonomyLevel: 'Acting independently on open-ended goals',
  anthropicEconIndex: 'Doing real economic work at scale',
  aiIndexEconomy: 'Showing up across the wider economy',
};

// Concise labels for compact rows (pillar detail cards) — PLAIN above is the
// longer narrative phrasing used in the "what's missing" triptych panel.
const INDICATOR_LABELS = {
  hendrycksAgiScore: 'AGI Definition Score',
  epochBenchmarks: 'Epoch Benchmarks',
  arcGap: 'ARC-AGI Gap',
  selfLearning: 'Self-Learning Gain',
  realTimeEngagement: 'Real-Time Engagement',
  metrTimeHorizon: 'METR Time Horizon',
  agenticAutonomyLevel: 'Agentic Autonomy',
  anthropicEconIndex: 'Anthropic Econ Index',
  aiIndexEconomy: 'AI Index Economy',
};

const PILLAR_LABELS = { capability: 'Capability', autonomy: 'Autonomy', deployment: 'Deployment' };

// Single decimal everywhere a score is displayed, so the page never mixes
// "12", "12.75", and "30" in the same list.
function fmt1(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : (v ?? '—');
}

// Fallback for standalone previews (artifact runners, storybooks) that render
// the component without props. Production always passes the fetched snapshot.
// Values mirror the first real pipeline run, 2026-07-20.
const SAMPLE_SNAPSHOT = {
  schemaVersion: 1,
  generatedAt: '2026-07-20T12:00:00Z',
  composite: { value: 46.3, coverage: 1 },
  pillars: {
    capability: {
      name: 'capability', weight: 0.45, score: 34.6, coverage: 1,
      indicators: [
        { slug: 'hendrycksAgiScore', score: 58, weight: 0.2 },
        { slug: 'epochBenchmarks', score: 60, weight: 0.2 },
        { slug: 'arcGap', score: 12.8, weight: 0.2 },
        { slug: 'selfLearning', score: 12, weight: 0.2 },
        { slug: 'realTimeEngagement', score: 30, weight: 0.2 },
      ],
    },
    autonomy: {
      name: 'autonomy', weight: 0.35, score: 67.7, coverage: 1,
      indicators: [
        { slug: 'metrTimeHorizon', score: 71, weight: 0.7 },
        { slug: 'agenticAutonomyLevel', score: 60, weight: 0.3 },
      ],
    },
    deployment: {
      name: 'deployment', weight: 0.2, score: 35.3, coverage: 1,
      indicators: [
        { slug: 'anthropicEconIndex', score: 28.1, weight: 0.5 },
        { slug: 'aiIndexEconomy', score: 42.5, weight: 0.5 },
      ],
    },
  },
  expectation: { weakAgi: '2028-06-20', fullAgi: '2033-01-15' },
  safety: { score: 42.5, existentialGrade: 'C-', overallBestGpa: 2.66, bestLab: 'Anthropic' },
  trajectory: {
    metrDoublingDaysSince2023: 131,
    frontierSeries: [
      { date: '2019-02-14', value: 0.067, alias: 'GPT-2' },
      { date: '2020-05-28', value: 0.7, alias: 'GPT-3' },
      { date: '2023-03-14', value: 3.5, alias: 'GPT-4' },
      { date: '2024-12-05', value: 50, alias: 'o1' },
      { date: '2025-08-07', value: 214, alias: 'GPT-5' },
      { date: '2025-11-24', value: 320, alias: 'Claude Opus 4.5' },
    ],
  },
  indicators: {
    hendrycksAgiScore: { confidence: 'provisional' },
    epochBenchmarks: { confidence: 'judgment' },
    arcGap: { confidence: 'provisional' },
    selfLearning: { confidence: 'judgment' },
    realTimeEngagement: { confidence: 'judgment' },
    metrTimeHorizon: { confidence: 'verified', raw: { p50Minutes: 320, suite: 'TH1.1' } },
    agenticAutonomyLevel: { confidence: 'judgment' },
    anthropicEconIndex: { confidence: 'provisional' },
    aiIndexEconomy: { confidence: 'judgment' },
  },
  stories: [
    { title: 'Time Horizon 1.1', link: 'https://metr.org/blog/2026-1-29-time-horizon-1-1/', feed: 'metr.org' },
    { title: 'ARC-AGI-3 remains unbeaten by frontier agents', link: 'https://arcprize.org', feed: 'arcprize.org' },
  ],
  sourceHealth: [
    { source: 'metr', ok: true }, { source: 'metaculus', ok: true },
    { source: 'manual', ok: true }, { source: 'rss', ok: true },
  ],
  errors: [],
};

function scoreColor(v) {
  if (v === null || v === undefined) return C.textLow;
  if (v < 25) return C.red;
  if (v < 50) return C.yellow;
  if (v < 75) return C.orange;
  return C.green;
}

function humanizeMinutes(min) {
  if (!Number.isFinite(min)) return '—';
  if (min < 1) return `${Math.round(min * 60)} seconds`;
  if (min < 90) return `${Math.round(min)} minutes`;
  const hours = min / 60;
  if (hours < 7) return `${hours.toFixed(1)} hours`;
  if (hours < 10) return 'most of a working day';
  const days = hours / 8;
  if (days < 15) return `${Math.round(days)} working days`;
  return `${Math.round(days / 21)} working months`;
}

function fmtDoubling(days) {
  if (!Number.isFinite(days)) return null;
  const months = days / 30.44;
  return months < 1.5 ? `~${Math.round(days)} days` : `~${Math.round(months)} months`;
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Panel({ children, style }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: '18px 20px', ...style }}>
      {children}
    </div>
  );
}

function PanelTitle({ children }) {
  return (
    <div style={{ fontFamily: sans, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function Bar({ value, color, height = 8 }) {
  return (
    <div style={{ background: C.track, borderRadius: height / 2, height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, height, background: color, borderRadius: height / 2 }} />
    </div>
  );
}

// ── Hero: HOW FAR ────────────────────────────────────────────────────────────

function Hero({ snapshot }) {
  const v = snapshot.composite?.value;
  const coverage = snapshot.composite?.coverage;
  // The visual track runs 0..120: AGI line at 100, ASI zone beyond.
  const AGI_AT = 100 / 120;
  return (
    <Panel style={{ padding: '26px 26px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: mono, fontSize: '3.6rem', fontWeight: 600, color: C.orange, lineHeight: 1 }}>
          {fmt1(v)}
        </span>
        <span style={{ fontFamily: sans, color: C.textDim, fontSize: '1rem' }}>of 100 on the road to AGI</span>
        <span style={{ fontFamily: mono, fontSize: '0.72rem', color: C.textLow, marginLeft: 'auto' }}>
          scored on {Math.round((coverage ?? 0) * 100)}% of indicators · v0.1 provisional
        </span>
      </div>
      <div style={{ position: 'relative', marginTop: 18, height: 14 }}>
        <div style={{ position: 'absolute', inset: 0, background: C.track, borderRadius: 7 }} />
        <div style={{ position: 'absolute', left: `${AGI_AT * 100}%`, right: 0, top: 0, bottom: 0, background: 'repeating-linear-gradient(45deg, #232b3d 0 6px, transparent 6px 12px)', borderRadius: '0 7px 7px 0' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((v ?? 0) / 120) * 100}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.orange})`, borderRadius: 7 }} />
        <div style={{ position: 'absolute', left: `calc(${AGI_AT * 100}% - 1px)`, top: -5, bottom: -5, width: 2, background: C.text }} />
      </div>
      <div style={{ display: 'flex', fontFamily: mono, fontSize: '0.7rem', color: C.textLow, marginTop: 8 }}>
        <span>2019 · GPT-2 era</span>
        <span style={{ marginLeft: 'auto', marginRight: '8%' }}>AGI line</span>
        <span>ASI zone →</span>
      </div>
    </Panel>
  );
}

// ── Triptych ─────────────────────────────────────────────────────────────────

function WhatsLeft({ snapshot }) {
  const deficits = useMemo(() => {
    const rows = snapshot.pillars?.capability?.indicators ?? [];
    return rows
      .filter((r) => r.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [snapshot]);
  return (
    <Panel>
      <PanelTitle>What's still missing</PanelTitle>
      {deficits.map((d) => (
        <div key={d.slug} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: sans, fontSize: '0.88rem', color: C.text, marginBottom: 4 }}>
            {PLAIN[d.slug] ?? d.slug}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}><Bar value={d.score} color={scoreColor(d.score)} height={5} /></div>
            <span style={{ fontFamily: mono, fontSize: '0.72rem', color: scoreColor(d.score), minWidth: 32, textAlign: 'right' }}>{fmt1(d.score)}</span>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function HowFast({ snapshot }) {
  const doubling = fmtDoubling(snapshot.trajectory?.metrDoublingDaysSince2023);
  const frontier = snapshot.indicators?.metrTimeHorizon?.raw;
  return (
    <Panel>
      <PanelTitle>How fast</PanelTitle>
      <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 600, color: C.text }}>{doubling ?? '—'}</div>
      <div style={{ fontFamily: sans, fontSize: '0.82rem', color: C.textDim, marginTop: 6, lineHeight: 1.45 }}>
        to double how long AI can work unsupervised
        {frontier?.p50Minutes ? <> — currently {humanizeMinutes(frontier.p50Minutes)}</> : null}
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textLow, marginTop: 10 }}>
        METR 50% time horizon{frontier?.suite ? ` · ${frontier.suite}` : ''}
      </div>
    </Panel>
  );
}

function Forecasters({ snapshot }) {
  const { weakAgi, fullAgi } = snapshot.expectation ?? {};
  const yr = (d) => (d ? d.slice(0, 4) : null);
  const range = yr(weakAgi) && yr(fullAgi) ? `${yr(weakAgi)}–${yr(fullAgi)}` : yr(weakAgi) ?? yr(fullAgi) ?? '—';
  return (
    <Panel>
      <PanelTitle>Forecasters say</PanelTitle>
      <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 600, color: C.text }}>{range}</div>
      <div style={{ fontFamily: sans, fontSize: '0.82rem', color: C.textDim, marginTop: 6, lineHeight: 1.45 }}>
        weakly-general to full AGI, community median
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.yellow, marginTop: 10 }}>
        forecast, not a measurement · Metaculus
      </div>
    </Panel>
  );
}

// ── Road from 2019 (frontier series, log scale) ──────────────────────────────

function RoadChart({ snapshot }) {
  const series = snapshot.trajectory?.frontierSeries ?? [];
  const path = useMemo(() => {
    if (series.length < 2) return null;
    const t0 = Date.parse('2019-01-01');
    const t1 = Date.now();
    const ys = series.map((p) => Math.log2(p.value));
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const W = 560;
    const H = 120;
    const pts = series.map((p, i) => {
      const x = 10 + ((Date.parse(p.date) - t0) / (t1 - t0)) * (W - 20);
      const y = H - 14 - ((ys[i] - yMin) / (yMax - yMin || 1)) * (H - 28);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { line: pts.join(' '), last: pts[pts.length - 1].split(',') };
  }, [series]);

  if (!path) return null;
  return (
    <Panel>
      <PanelTitle>The road from 2019 — autonomous task horizon (log scale)</PanelTitle>
      <svg viewBox="0 0 560 120" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <polyline points={path.line} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={path.last[0]} cy={path.last[1]} r="4" fill={C.orange} />
        <text x="10" y="117" fill={C.textLow} fontSize="9" fontFamily={mono}>2019</text>
        <text x="530" y="117" fill={C.textLow} fontSize="9" fontFamily={mono}>now</text>
      </svg>
      <div style={{ fontFamily: sans, fontSize: '0.75rem', color: C.textLow, marginTop: 6 }}>
        Each point is a frontier model's 50% time horizon at release. Source: METR (public data).
      </div>
    </Panel>
  );
}

// ── Divergence: capability vs safety ─────────────────────────────────────────

function Divergence({ snapshot }) {
  const cap = snapshot.composite?.value;
  const safety = snapshot.safety ?? {};
  if (!Number.isFinite(safety.score)) return null;
  return (
    <Panel>
      <PanelTitle>Capability vs. safety practice</PanelTitle>
      {[
        { label: 'Capability', v: cap, color: C.blue },
        { label: 'Safety', v: safety.score, color: C.yellow },
      ].map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: sans, fontSize: '0.8rem', color: C.textDim, width: 78 }}>{row.label}</span>
          <div style={{ flex: 1 }}><Bar value={row.v} color={row.color} /></div>
          <span style={{ fontFamily: mono, fontSize: '0.75rem', color: row.color, minWidth: 34, textAlign: 'right' }}>{fmt1(row.v)}</span>
        </div>
      ))}
      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textLow, marginTop: 8 }}>
        best lab existential-safety grade: {safety.existentialGrade ?? '—'} · FLI AI Safety Index
      </div>
    </Panel>
  );
}

// ── Pillar detail cards ──────────────────────────────────────────────────────

function PillarCard({ name, pillar, indicators }) {
  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: mono, fontSize: '1.9rem', fontWeight: 600, color: scoreColor(pillar.score) }}>
          {fmt1(pillar.score)}
        </span>
        <span style={{ fontFamily: sans, fontSize: '0.95rem', color: C.text, fontWeight: 600 }}>{PILLAR_LABELS[name]}</span>
        <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textLow, marginLeft: 'auto' }}>
          {Math.round(pillar.weight * 100)}% of composite
        </span>
      </div>
      <div style={{ margin: '10px 0 12px' }}><Bar value={pillar.score} color={scoreColor(pillar.score)} height={6} /></div>
      {pillar.indicators.map((row) => {
        const meta = indicators?.[row.slug];
        return (
          <div key={row.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <span style={{ fontFamily: sans, fontSize: '0.78rem', color: C.textDim, flex: 1 }}>{INDICATOR_LABELS[row.slug] ?? row.slug}</span>
            {meta?.confidence && meta.confidence !== 'verified' && (
              <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.yellow, border: `1px solid ${C.yellow}44`, borderRadius: 3, padding: '0 4px' }}>
                {meta.confidence}
              </span>
            )}
            <span style={{ fontFamily: mono, fontSize: '0.75rem', color: scoreColor(row.score), minWidth: 38, textAlign: 'right' }}>
              {row.score === null || row.score === undefined ? 'n/a' : fmt1(row.score)}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

// ── Stories + source health ──────────────────────────────────────────────────

function Stories({ snapshot }) {
  const stories = (snapshot.stories ?? []).slice(0, 6);
  if (!stories.length) return null;
  return (
    <Panel>
      <PanelTitle>Watching this week</PanelTitle>
      {stories.map((s, i) => (
        <div key={i} style={{ padding: '5px 0', borderBottom: i < stories.length - 1 ? `1px solid ${C.panelEdge}` : 'none' }}>
          <a href={s.link} target="_blank" rel="noreferrer" style={{ fontFamily: sans, fontSize: '0.85rem', color: C.text, textDecoration: 'none' }}>
            {s.title}
          </a>
          <span style={{ fontFamily: mono, fontSize: '0.65rem', color: C.textLow, marginLeft: 8 }}>· {s.feed}</span>
        </div>
      ))}
    </Panel>
  );
}

function SourceHealth({ snapshot }) {
  const sources = snapshot.sourceHealth ?? [];
  if (!sources.length) return null;
  const okPct = Math.round((sources.filter((s) => s.ok).length / sources.length) * 100);
  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: mono, fontSize: '1.4rem', fontWeight: 600, color: okPct >= 75 ? C.green : okPct >= 50 ? C.yellow : C.red }}>
          {okPct}%
        </span>
        <span style={{ fontFamily: sans, fontSize: '0.85rem', color: C.textDim }}>sources healthy this run</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {sources.map((s) => (
          <span key={s.source} style={{ fontFamily: mono, fontSize: '0.7rem', color: s.ok ? C.green : C.red, marginRight: 14 }}>
            {s.ok ? '●' : '○'} {s.source}
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ── Shared nav + footer (also used by the About/Donate pages) ───────────────

export const PAYPAL_DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=RDHPCCG8WABRN';
export const FROKKLE_URL = 'https://frokkle.com';
export const GITHUB_URL = 'https://github.com/Vaughanwj/futurewatch';

export function NavBar({ active, meta }) {
  const linkStyle = (key) => ({
    fontFamily: mono,
    fontSize: '0.75rem',
    letterSpacing: '0.06em',
    textDecoration: 'none',
    color: active === key ? C.orange : C.textDim,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
      <a href="/" style={{ fontFamily: mono, fontWeight: 600, fontSize: '1.05rem', letterSpacing: '0.14em', color: C.text, textDecoration: 'none' }}>
        FUTUREWATCH
      </a>
      <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.textDim }}>· the meter</span>
      <a href="/about" style={linkStyle('about')}>about</a>
      <a href="/donate" style={linkStyle('donate')}>donate</a>
      {meta && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textLow, marginLeft: 'auto' }}>{meta}</span>}
    </div>
  );
}

export function Footer() {
  return (
    <div style={{ fontFamily: sans, fontSize: '0.72rem', color: C.textLow, lineHeight: 1.6, marginTop: 8 }}>
      Not a prediction. A reading. Scores derive from public data normalized against written anchor tables;
      forecast content is labeled and never enters the composite. Methodology and per-indicator sources:
      {' '}<a href={GITHUB_URL} style={{ color: C.textDim }}>github.com/Vaughanwj/futurewatch</a>.
      {' '}A FutureWatch presentation · a <a href={FROKKLE_URL} style={{ color: C.textDim }}>Frokkle</a> production.
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FuturewatchDashboard({ snapshot = SAMPLE_SNAPSHOT }) {
  if (!snapshot) snapshot = SAMPLE_SNAPSHOT;
  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 };
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <NavBar active="home" meta={`reading ${snapshot.generatedAt?.slice(0, 10)} · not a prediction, a reading`} />

        <Hero snapshot={snapshot} />

        <div style={grid3}>
          <WhatsLeft snapshot={snapshot} />
          <HowFast snapshot={snapshot} />
          <Forecasters snapshot={snapshot} />
        </div>

        <RoadChart snapshot={snapshot} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {Object.entries(snapshot.pillars ?? {}).map(([name, pillar]) => (
            <PillarCard key={name} name={name} pillar={pillar} indicators={snapshot.indicators} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <Divergence snapshot={snapshot} />
          <SourceHealth snapshot={snapshot} />
        </div>

        <Stories snapshot={snapshot} />

        <Footer />
      </div>
    </div>
  );
}
