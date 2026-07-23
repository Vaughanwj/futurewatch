/**
 * FutureWatch Meter — front page.
 * Triptych: how far / what's left / how fast, per methodology-draft.md §5.
 * Reads /data/futurewatch.json (weekly pipeline output).
 */
import { useMemo, useState, useRef, useLayoutEffect } from 'react';

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

// ── Tooltips — every measure explains itself ─────────────────────────────────

const TIPS = {
  composite:
    'A weighted blend of three evidence pillars: Capability 45%, Autonomy 35%, Deployment 20%. 0 is the 2019 frontier (GPT-2); 100 is the AGI line — the cognitive versatility and proficiency of a well-educated adult, with the ASI zone beyond. Forecasts and safety grades are shown separately and never counted in this number.',
  whatsLeft:
    'The three lowest-scoring capability measures right now — the plainest statement of what separates today’s AI from the AGI line. These update automatically as the data moves.',
  howFast:
    'How quickly the unsupervised-work horizon doubles, from METR’s published data. The horizon is the longest task (in human working time) the best AI completes with 50% reliability.',
  forecasters:
    'Median predictions from the Forecasting Research Institute’s LEAP panel of experts and superforecasters. This is expectation, not measurement — it never enters the meter.',
  road:
    'Each dot is a new record: the longest task, measured in the time it takes a skilled human, that the best AI of the day could complete unsupervised at 50% reliability. Log scale — each gridline is a multiple of the one below.',
  divergence:
    'The meter reading (capability) beside how seriously frontier labs take existential safety — the best grade any lab earned in the Future of Life Institute’s independent Safety Index, converted to 0–100. The gap is the point.',
  sourceHealth:
    'How many of the meter’s data sources responded on schedule in the latest run. Published so you can judge how fresh the reading is — a meter that hides its own failures isn’t worth trusting.',
  capability:
    'What frontier AI can do cognitively — knowledge, reasoning, novel problem-solving, learning, social interaction. Averaged over five measures. 45% of the composite.',
  autonomy:
    'How long and how independently AI works without a human — the time horizon of unsupervised work, plus how much real deployments trust it. 35% of the composite.',
  deployment:
    'Whether AI is doing real economic work in the wild, not just passing tests. Deliberately the smallest weight — it confirms progress rather than predicts it. 20% of the composite.',
  hendrycksAgiScore:
    'Published score from a large research consortium (Hendrycks, Bengio and others): how much of a well-educated adult’s cognitive versatility the best AI matches, across ten domains of human cognition. 100 = fully matches.',
  epochBenchmarks:
    'Frontier performance on a basket of the hardest public benchmarks — graduate-level science, competition math, real software fixes — as a fraction of expert-human level. Data: Epoch AI. Currently a provisional estimate.',
  arcGap:
    'How close AI comes to ordinary humans on ARC-AGI puzzles: tasks built to be unlike anything in training data. Humans solve nearly all of them; AI still fails most, especially the interactive version.',
  selfLearning:
    'Whether AI improves from its own accumulated experience, measured against the same system running with no memory (CL-Bench). Near zero today: models don’t yet learn on the job.',
  realTimeEngagement:
    'Our own five-milestone rubric for live, multi-person interaction: real-time voice, group conversation, unprompted contributions, remembering people across sessions, and holding a valued role in a human group for weeks. Criteria published in the repo.',
  metrTimeHorizon:
    'The longest task — in human working time — the best AI completes unsupervised with 50% reliability (METR). Log scale from ~4 seconds (GPT-2, 2019) to one working month, the point we treat as the autonomy Rubicon.',
  agenticAutonomyLevel:
    'How independently AI routinely operates in real deployments, on DeepMind’s published ladder: tool → consultant → collaborator → expert → autonomous agent.',
  anthropicEconIndex:
    'How much real economic work AI performs: the breadth of occupations using it materially, combined with the share of total work it does. From Anthropic’s Economic Index.',
  aiIndexEconomy:
    'A cross-check from Stanford’s AI Index: business adoption of AI and AI’s share of job postings, scaled so 2019 counts as zero.',
};

const CONFIDENCE_TIPS = {
  provisional: 'From a published source we haven’t re-verified this cycle.',
  judgment: 'Scored by our published rubric — a documented judgment call, not a measured feed.',
};

const TOOLTIP_WIDTH = 250;
const TOOLTIP_GUTTER = 10;

// Positioned in viewport (fixed) coordinates computed from the button's own
// getBoundingClientRect, then clamped to stay fully on-screen — a binary
// left/right anchor choice isn't enough, since several Info dots sit on
// dynamic content (e.g. WhatsLeft's lowest-scoring indicators) whose on-screen
// position varies with the data, and a button near the middle of a narrow
// viewport can be too far from *both* edges for either fixed anchor to fit.
function Info({ tip }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = document.documentElement.clientWidth;
    const left = Math.max(
      TOOLTIP_GUTTER,
      Math.min(rect.left, viewportWidth - TOOLTIP_WIDTH - TOOLTIP_GUTTER)
    );
    setPos({ top: rect.bottom + 7, left });
  }, [open]);

  if (!tip) return null;
  return (
    <span
      ref={anchorRef}
      style={{ position: 'relative', display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="About this measure"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        style={{
          all: 'unset', boxSizing: 'border-box', cursor: 'help', width: 14, height: 14,
          borderRadius: '50%', border: `1px solid ${C.textLow}`, color: C.textLow,
          fontSize: '0.58rem', fontFamily: sans, fontStyle: 'italic', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >
        i
      </button>
      {open && pos && (
        <span
          role="tooltip"
          style={{
            position: 'fixed', zIndex: 30, top: pos.top, left: pos.left, boxSizing: 'border-box',
            width: TOOLTIP_WIDTH, maxWidth: `calc(100vw - ${TOOLTIP_GUTTER * 2}px)`, background: '#161b28',
            border: `1px solid ${C.panelEdge}`, borderRadius: 8, padding: '10px 12px',
            fontFamily: sans, fontSize: '0.75rem', fontWeight: 400, fontStyle: 'normal',
            lineHeight: 1.55, color: C.text,
            textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {tip}
        </span>
      )}
    </span>
  );
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
  expectation: { superforecasterAgi: 2047, expertAgi: 2050 },
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
    { source: 'metr', ok: true }, { source: 'manual', ok: true }, { source: 'rss', ok: true },
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

function PanelTitle({ children, tip }) {
  return (
    <div style={{ fontFamily: sans, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, marginBottom: 12 }}>
      {children}
      {tip && <Info tip={tip} />}
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
        <span style={{ fontFamily: sans, color: C.textDim, fontSize: '1rem' }}>
          of 100 on the road to AGI
          <Info tip={TIPS.composite} />
        </span>
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
      <PanelTitle tip={TIPS.whatsLeft}>What's still missing</PanelTitle>
      {deficits.map((d) => (
        <div key={d.slug} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: sans, fontSize: '0.88rem', color: C.text, marginBottom: 4 }}>
            {PLAIN[d.slug] ?? d.slug}
            <Info tip={TIPS[d.slug]} />
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
      <PanelTitle tip={TIPS.howFast}>How fast</PanelTitle>
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
  const { superforecasterAgi, expertAgi } = snapshot.expectation ?? {};
  const range =
    superforecasterAgi && expertAgi
      ? `${superforecasterAgi}–${expertAgi}`
      : superforecasterAgi ?? expertAgi ?? '—';
  return (
    <Panel>
      <PanelTitle tip={TIPS.forecasters}>Forecasters say</PanelTitle>
      <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 600, color: C.text }}>{range}</div>
      <div style={{ fontFamily: sans, fontSize: '0.82rem', color: C.textDim, marginTop: 6, lineHeight: 1.45 }}>
        median AGI year, superforecasters to experts
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.yellow, marginTop: 10 }}>
        forecast, not a measurement · FRI LEAP panel, cf. Samotsvety
      </div>
    </Panel>
  );
}

// ── The road so far (frontier series, log scale) ─────────────────────────────

// Round time-horizon values (in minutes) to use as log-scale gridlines —
// only the ones that fall inside the actual data range get drawn.
const GRID_ANCHORS = [
  { min: 1, label: '1 min' },
  { min: 5, label: '5 min' },
  { min: 15, label: '15 min' },
  { min: 60, label: '1 hr' },
  { min: 240, label: '4 hr' },
  { min: 480, label: '8 hr' },
  { min: 1440, label: '1 day' },
  { min: 10080, label: '1 wk' },
  { min: 43200, label: '1 mo' },
  { min: 129600, label: '3 mo' },
  { min: 259200, label: '6 mo' },
];

function RoadChart({ snapshot }) {
  const series = snapshot.trajectory?.frontierSeries ?? [];
  const chart = useMemo(() => {
    if (series.length < 2) return null;
    // Start the axis at the first point we actually have data for — METR's
    // public eval suite only covers frontier models from ~GPT-4 onward, so
    // anchoring to a fixed earlier date would draw a misleading flat run-up.
    const t0 = Date.parse(series[0].date);
    const t1 = Date.now();
    const ys = series.map((p) => Math.log2(p.value));
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const W = 560;
    const H = 130;
    const padTop = 16;
    const padBottom = 24;
    const toX = (date) => 10 + ((Date.parse(date) - t0) / (t1 - t0 || 1)) * (W - 20);
    const toY = (y) => H - padBottom - ((y - yMin) / (yMax - yMin || 1)) * (H - padBottom - padTop);

    const points = series.map((p, i) => ({ x: toX(p.date), y: toY(ys[i]), alias: p.alias }));
    const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const gridlines = GRID_ANCHORS
      .map((g) => ({ ...g, y: toY(Math.log2(g.min)) }))
      .filter((g) => g.y >= padTop - 2 && g.y <= H - padBottom + 2);

    // Callout the single biggest jump between consecutive releases, plus the
    // current frontier — everything else stays an unlabeled vertex.
    let jumpIdx = 1;
    let jumpSize = -Infinity;
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] - ys[i - 1] > jumpSize) { jumpSize = ys[i] - ys[i - 1]; jumpIdx = i; }
    }
    const lastIdx = points.length - 1;
    const callouts = jumpIdx === lastIdx ? [lastIdx] : [jumpIdx, lastIdx];

    return {
      W, H, line, points, gridlines, callouts,
      firstYear: new Date(series[0].date).getFullYear(),
    };
  }, [series]);

  if (!chart) return null;
  const { W, H, line, points, gridlines, callouts, firstYear } = chart;
  const last = points[points.length - 1];
  return (
    <Panel>
      <PanelTitle tip={TIPS.road}>The road so far — autonomous task horizon (log scale)</PanelTitle>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {gridlines.map((g) => (
          <g key={g.label}>
            <line x1="0" y1={g.y} x2={W} y2={g.y} stroke={C.panelEdge} strokeWidth="1" />
            <text x={W - 4} y={g.y - 3} fill={C.textLow} fontSize="8" fontFamily={mono} textAnchor="end">{g.label}</text>
          </g>
        ))}
        <polyline points={line} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2} fill={i === points.length - 1 ? C.orange : C.blue} />
        ))}
        {callouts.map((i) => (
          <text
            key={i}
            x={Math.min(Math.max(points[i].x, 40), W - 4)}
            y={Math.max(points[i].y - 9, 10)}
            fill={C.text}
            fontSize="9"
            fontFamily={mono}
            textAnchor="middle"
          >
            {points[i].alias}
          </text>
        ))}
        <text x="10" y={H - 4} fill={C.textLow} fontSize="9" fontFamily={mono}>{firstYear}</text>
        <text x={W - 10} y={H - 4} fill={C.textLow} fontSize="9" fontFamily={mono} textAnchor="end">now</text>
      </svg>
      <div style={{ fontFamily: sans, fontSize: '0.75rem', color: C.textLow, marginTop: 6 }}>
        Each point is a frontier model's 50% time horizon at release, since METR's earliest covered model ({points[0].alias}, {firstYear}). Source: METR (public data).
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
      <PanelTitle tip={TIPS.divergence}>Capability vs. safety practice</PanelTitle>
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
        <span style={{ fontFamily: sans, fontSize: '0.95rem', color: C.text, fontWeight: 600 }}>
          {PILLAR_LABELS[name]}
          <Info tip={TIPS[name]} />
        </span>
        <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textLow, marginLeft: 'auto' }}>
          {Math.round(pillar.weight * 100)}% of composite
        </span>
      </div>
      <div style={{ margin: '10px 0 12px' }}><Bar value={pillar.score} color={scoreColor(pillar.score)} height={6} /></div>
      {pillar.indicators.map((row) => {
        const meta = indicators?.[row.slug];
        return (
          <div key={row.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <span style={{ fontFamily: sans, fontSize: '0.78rem', color: C.textDim, flex: 1 }}>
              {INDICATOR_LABELS[row.slug] ?? row.slug}
              <Info tip={TIPS[row.slug]} />
            </span>
            {meta?.confidence && meta.confidence !== 'verified' && (
              <span
                title={CONFIDENCE_TIPS[meta.confidence]}
                style={{ fontFamily: mono, fontSize: '0.6rem', color: C.yellow, border: `1px solid ${C.yellow}44`, borderRadius: 3, padding: '0 4px', cursor: 'help' }}
              >
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
        <span style={{ fontFamily: sans, fontSize: '0.85rem', color: C.textDim }}>
          sources healthy this run
          <Info tip={TIPS.sourceHealth} />
        </span>
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
