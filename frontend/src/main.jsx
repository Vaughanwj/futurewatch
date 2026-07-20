import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import FuturewatchDashboard, { C } from './futurewatch_dashboard.jsx';
import AboutPage from './AboutPage.jsx';
import DonatePage from './DonatePage.jsx';

function Home() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/futurewatch.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setSnapshot)
      .catch((e) => setError(e.message));
  }, []);

  const center = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.bg, color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.9rem',
  };

  if (error) return <div style={center}>meter data unavailable ({error}) — try again shortly</div>;
  if (!snapshot) return <div style={center}>reading the meter…</div>;
  return <FuturewatchDashboard snapshot={snapshot} />;
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/about') return <AboutPage />;
  if (path === '/donate') return <DonatePage />;
  return <Home />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
