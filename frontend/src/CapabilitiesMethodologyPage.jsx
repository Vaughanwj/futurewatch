import { C, sans, NavBar, Footer, GITHUB_URL } from './futurewatch_dashboard.jsx';

function Panel({ children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: '20px 22px' }}>
      {children}
    </div>
  );
}

function H2({ children }) {
  return (
    <div style={{ fontFamily: sans, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function P({ children }) {
  return (
    <p style={{ fontFamily: sans, fontSize: '0.92rem', color: C.text, lineHeight: 1.65, margin: '0 0 12px' }}>
      {children}
    </p>
  );
}

function Li({ children }) {
  return <li style={{ fontFamily: sans, fontSize: '0.88rem', color: C.text, lineHeight: 1.6, marginBottom: 6 }}>{children}</li>;
}

export default function CapabilitiesMethodologyPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <NavBar active="capabilities-methodology" />

        <Panel>
          <H2>Four Capabilities Watch — Methodology</H2>
          <P>
            This panel tracks precursor evidence for four capabilities associated, in the AI safety literature,
            with autonomous self-expansion: <strong>AI Improvement</strong>, <strong>Goal Autonomy</strong>,{' '}
            <strong>Operational Autonomy</strong>, and <strong>Resource Acquisition</strong>. It is deliberately
            separate from the composite meter on the home page and is never averaged into it — the evidence
            types here are too heterogeneous (benchmark scores, evidence ladders, qualitative reports) to combine
            into one honest number.
          </P>
          <P>
            <strong>Core principle:</strong> we do not claim that recursive self-improvement, genuinely
            self-originated goals, autonomous replication in the wild, or autonomous resource accumulation have
            occurred unless the source evidence directly supports that conclusion. Most currently available
            evidence measures precursor capabilities under controlled conditions — a result on a benchmark, not a
            behavior in the wild.
          </P>
        </Panel>

        <Panel>
          <H2>What this interface distinguishes</H2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <Li>Simulated versus real-world activity</Li>
            <Li>Externally assigned goals versus apparently self-generated goals</Li>
            <Li>One-shot improvement versus sustained recursive improvement</Li>
            <Li>Benchmark performance versus deployed behavior</Li>
            <Li>Ability to acquire resources versus actual independent resource ownership</Li>
            <Li>Controlled replication tasks versus uncontrolled self-replication</Li>
          </ul>
        </Panel>

        <Panel>
          <H2>The four capabilities</H2>
          <P>
            <strong>AI Improvement</strong> — whether a system can improve another model, improve AI-development
            processes, or contribute to its own future development. We track a separate{' '}
            <em>recursive loop status</em> (none observed / single cycle / repeated human-supervised cycles /
            repeated AI-directed cycles / sustained autonomous loop) that defaults to "none observed" unless
            direct evidence supports otherwise. Ordinary coding performance is never labeled recursive
            self-improvement.
          </P>
          <P>
            <strong>Goal Autonomy</strong> — not a percentage. We use a five-level evidence ladder (0: executes
            only immediate instructions, through 4: originates and durably pursues a novel goal not supplied by
            the operator, evaluator, training setup, or scenario). Automated ingestion may propose a level, but
            levels 2 through 4 always require human review before publication.
          </P>
          <P>
            <strong>Operational Autonomy</strong> — how long and how reliably an agent performs meaningful work
            unsupervised. Primary source: METR's task-horizon evaluations. <strong>Important:</strong> METR task
            horizons represent the human-expert duration of tasks at a given model success probability — they do
            not necessarily represent literal uninterrupted agent runtime.
          </P>
          <P>
            <strong>Resource Acquisition</strong> — whether an AI can acquire, expand, manage, or preserve
            resources. Tracked separately: economic accumulation, account/compute/credential acquisition,
            financial transactions, independent deployment, persistence, replication, and resource retention.
            Simulated currency is never presented as real income, and units are always shown alongside the value.
          </P>
        </Panel>

        <Panel>
          <H2>Sources</H2>
          <P>
            <strong>Live, automated:</strong> METR's public eval-analysis-public data (task horizons at 50% and
            80% success), reused from the same fit already powering the home page's autonomy pillar.
          </P>
          <P>
            <strong>Manual, human-reviewed:</strong> Vending-Bench 2 (Andon Labs) — the leaderboard is a
            client-rendered page with no public export we could find, so results are periodically re-checked by
            hand and entered with full source attribution. AI Improvement and Goal Autonomy currently have no
            populated entries — we did not find a specific, dated, actually-measured (not forecast) result we
            were confident citing at launch. See{' '}
            <a href={`${GITHUB_URL}/blob/main/backend/data/capabilities-manual.json`} style={{ color: C.blue }}>
              capabilities-manual.json
            </a>{' '}
            for the exact pending notes.
          </P>
          <P>
            <strong>Not yet implemented (pending):</strong> Epoch AI benchmark data, live Vending-Bench 2 scraping,
            GitHub release monitoring, and automated monitoring of official publications (UK AI Security
            Institute, METR, Apollo Research, Anthropic, OpenAI, Google DeepMind). Each has a defined interface
            and fixture tests but no live integration — see{' '}
            <a href={`${GITHUB_URL}/blob/main/research/capabilities-methodology.md`} style={{ color: C.blue }}>
              known limitations
            </a>.
          </P>
        </Panel>

        <Panel>
          <H2>Review process</H2>
          <P>
            Any candidate observation containing a high-risk phrase (e.g. "recursive self-improvement",
            "self-replicated", "escaped", "obtained real money", "removed oversight") or a proposed Goal Autonomy
            level of 2 or higher is held out of the public cards — shown only as a pending count — until a human
            reviews the source directly. Full workflow:{' '}
            <a href={`${GITHUB_URL}/blob/main/research/capabilities-review-workflow.md`} style={{ color: C.blue }}>
              capabilities-review-workflow.md
            </a>.
          </P>
        </Panel>

        <Footer />
      </div>
    </div>
  );
}
