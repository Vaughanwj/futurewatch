import { C, mono, sans, NavBar, Footer, PAYPAL_DONATE_URL } from './futurewatch_dashboard.jsx';

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
    <p style={{ fontFamily: sans, fontSize: '0.92rem', color: C.text, lineHeight: 1.65, margin: '0 0 16px' }}>
      {children}
    </p>
  );
}

export default function DonatePage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <NavBar active="donate" />

        <Panel>
          <H2>Support FutureWatch</H2>
          <P>
            FutureWatch is free, ad-free, and independently run — no sponsorships, no paywall. If the meter
            is useful to you, a donation helps cover hosting and the ongoing work of maintaining the data
            pipeline and anchor tables.
          </P>
          <a
            href={PAYPAL_DONATE_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              fontFamily: mono,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: C.bg,
              background: C.orange,
              padding: '11px 22px',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Donate via PayPal →
          </a>
        </Panel>

        <Footer />
      </div>
    </div>
  );
}
