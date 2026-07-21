/**
 * Metaculus adapter — community forecast dates for the Expectation panel.
 * Never enters the composite (methodology §3).
 *
 * The api2 response shape has changed across Metaculus versions, so extraction
 * is defensive: it walks known paths and reports which one hit. Run
 * `npm run probe` locally to dump raw responses if extraction breaks.
 */
import axios from 'axios';

const QUESTIONS = [
  { key: 'weakAgi', id: 3479, label: 'Weakly general AI (Metaculus Q3479)' },
  { key: 'fullAgi', id: 5121, label: 'Full AGI, four conditions (Metaculus Q5121)' },
];

const API = (id) => `https://www.metaculus.com/api2/questions/${id}/`;

/** Try known locations of the community median for date questions. */
function extractMedianDate(q) {
  const paths = [
    q?.question?.aggregations?.recency_weighted?.latest?.centers?.[0],
    q?.aggregations?.recency_weighted?.latest?.centers?.[0],
    q?.community_prediction?.full?.q2,
    q?.question?.community_prediction?.full?.q2,
  ];
  for (const v of paths) {
    if (v === undefined || v === null) continue;
    // Values may be an ISO string, epoch seconds, or a 0–1 fraction of the
    // question's [openTime, resolveTime] range.
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return v.slice(0, 10);
    if (typeof v === 'number') {
      if (v > 1e9) return new Date(v * 1000).toISOString().slice(0, 10);
      if (v >= 0 && v <= 1) {
        const open = Date.parse(q?.question?.open_time ?? q?.open_time);
        const close = Date.parse(
          q?.question?.scheduled_resolve_time ?? q?.scheduled_resolve_time ?? q?.resolve_time
        );
        if (Number.isFinite(open) && Number.isFinite(close)) {
          return new Date(open + v * (close - open)).toISOString().slice(0, 10);
        }
      }
    }
  }
  return null;
}

export const metaculusAdapter = {
  async fetch() {
    const t0 = Date.now();
    const errors = [];
    const indicators = {};

    const token = process.env.METACULUS_API_KEY;
    const headers = { Accept: 'application/json', 'User-Agent': 'futurewatch-meter/0.1' };
    if (token) headers.Authorization = `Token ${token}`;

    for (const { key, id, label } of QUESTIONS) {
      try {
        const { data } = await axios.get(API(id), { timeout: 15000, headers });
        const median = extractMedianDate(data);
        if (!median) {
          errors.push(`metaculus ${id}: response fetched but median not found (run npm run probe)`);
          continue;
        }
        indicators[key] = {
          value: null, // Expectation is displayed, never scored
          raw: { medianDate: median, questionId: id },
          asOf: new Date().toISOString().slice(0, 10),
          source: `${label} — metaculus.com/questions/${id}`,
          confidence: 'verified',
        };
      } catch (err) {
        errors.push(`metaculus ${id}: ${err.message}`);
      }
    }

    return { indicators, fetchMs: Date.now() - t0, errors };
  },
};
