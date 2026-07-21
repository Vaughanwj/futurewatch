import { C, sans, NavBar, Footer, FROKKLE_URL, GITHUB_URL } from './futurewatch_dashboard.jsx';

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

export default function AboutPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <NavBar active="about" />

        <Panel>
          <H2>About FutureWatch</H2>
          <P>
            FutureWatch is a public reading of progress toward AGI, built from peer-reviewed frameworks and
            live public data. One scale: 0 marks the 2019 frontier (GPT-2 era), 100 marks the AGI line
            (cognitive versatility and proficiency of a well-educated adult), with the ASI zone marked beyond.
          </P>
          <P>
            <strong>Not a prediction. A reading.</strong> Every score on the page derives from public data,
            normalized against written anchor tables — not from a model of the future. Forecast content
            (median AGI-arrival estimates from the Forecasting Research Institute's LEAP panel of AI experts
            and superforecasters) is shown separately and never enters the composite.
          </P>
        </Panel>

        <Panel>
          <H2>How the composite is built</H2>
          <P>
            The composite blends three pillars: <strong>Capability</strong> (45%) — how the frontier
            performs on hard benchmarks and novel problems; <strong>Autonomy</strong> (35%) — how long and
            how independently frontier systems can act; and <strong>Deployment</strong> (20%) — how much
            real economic work is already flowing through them. When an indicator is missing for a given
            run, its pillar's weight is renormalized over what's present, and the page reports coverage
            honestly rather than silently filling the gap.
          </P>
          <P>
            Full methodology, per-indicator sources, and the anchor tables used to normalize raw data onto
            the 0–100 scale are public: {' '}
            <a href={GITHUB_URL} style={{ color: C.blue }}>github.com/Vaughanwj/futurewatch</a>.
          </P>
        </Panel>

        <Panel>
          <H2>A Frokkle production</H2>
          <P>
            FutureWatch is one of a small index of focused public instruments built and maintained by{' '}
            <a href={FROKKLE_URL} style={{ color: C.blue }}>Frokkle</a>. See the rest of the index at{' '}
            <a href={FROKKLE_URL} style={{ color: C.blue }}>frokkle.com</a>.
          </P>
        </Panel>

        <Footer />
      </div>
    </div>
  );
}
