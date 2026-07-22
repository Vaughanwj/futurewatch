/**
 * Weighted logistic fit of P(success) on log2(human_minutes) — pure math.
 * Replicates METR's headline p50 extraction: p50 horizon = minutes where the
 * fitted curve crosses 0.5, i.e. 2^(−a/b) for logit = a + b·log2(m).
 *
 * Deliberately simple gradient ascent — data sets are small (hundreds of runs
 * per model) and determinism matters more than speed.
 */

/**
 * @param {Array<{humanMinutes:number, success:0|1, weight?:number}>} runs
 * @returns {{p50Minutes:number|null, a:number, b:number, n:number}}
 */
export function fitP50Horizon(runs) {
  const data = (runs || []).filter(
    (r) => Number.isFinite(r.humanMinutes) && r.humanMinutes > 0 && (r.success === 0 || r.success === 1)
  );
  if (data.length < 10) return { p50Minutes: null, a: 0, b: 0, n: data.length };

  const xs = data.map((r) => Math.log2(r.humanMinutes));
  const ys = data.map((r) => r.success);
  const ws = data.map((r) => (Number.isFinite(r.weight) && r.weight > 0 ? r.weight : 1));
  const wSum = ws.reduce((s, w) => s + w, 0);

  // Standardize x for stable convergence
  const mx = xs.reduce((s, x, i) => s + x * ws[i], 0) / wSum;
  const sx = Math.sqrt(xs.reduce((s, x, i) => s + ws[i] * (x - mx) ** 2, 0) / wSum) || 1;
  const zs = xs.map((x) => (x - mx) / sx);

  let a = 0;
  let b = -0.5; // prior: success falls with task length
  const lr = 0.5;
  for (let iter = 0; iter < 3000; iter++) {
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < zs.length; i++) {
      const p = 1 / (1 + Math.exp(-(a + b * zs[i])));
      const err = ys[i] - p;
      ga += ws[i] * err;
      gb += ws[i] * err * zs[i];
    }
    a += (lr * ga) / wSum;
    b += (lr * gb) / wSum;
  }

  // De-standardize: logit = a + b·(x−mx)/sx = (a − b·mx/sx) + (b/sx)·x
  const b0 = b / sx;
  const a0 = a - (b * mx) / sx;

  // A meaningful p50 requires success to decrease with length
  if (b0 >= 0) return { p50Minutes: null, a: a0, b: b0, n: data.length };
  const p50 = Math.pow(2, -a0 / b0);
  if (!Number.isFinite(p50) || p50 <= 0) return { p50Minutes: null, a: a0, b: b0, n: data.length };
  return { p50Minutes: p50, a: a0, b: b0, n: data.length };
}

/**
 * Merge model lists from two suites: primary (TH1.1) wins on alias collision;
 * legacy (TH1.0) fills in models the newer suite dropped — critically the
 * pre-2023 models (GPT-2, GPT-3) that anchor the road-from-2019 chart.
 */
export function mergeModels(primary, legacy) {
  const seen = new Set((primary ?? []).map((m) => m.alias));
  return (primary ?? []).concat((legacy ?? []).filter((m) => !seen.has(m.alias)));
}

/**
 * Frontier series: for each release date, the max p50 among models released
 * on or before it. Input: [{alias, releaseDate, p50Minutes}].
 * Output: sorted [{date, value, alias}] keeping only frontier advances.
 */
export function frontierSeries(models) {
  const dated = (models || [])
    .filter((m) => m.releaseDate && Number.isFinite(m.p50Minutes) && m.p50Minutes > 0)
    .sort((x, y) => Date.parse(x.releaseDate) - Date.parse(y.releaseDate));
  const out = [];
  let best = 0;
  for (const m of dated) {
    if (m.p50Minutes > best) {
      best = m.p50Minutes;
      out.push({ date: m.releaseDate, value: m.p50Minutes, alias: m.alias });
    }
  }
  return out;
}
