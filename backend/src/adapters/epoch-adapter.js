/**
 * Epoch adapter — the two scored Capability inputs that come from Epoch AI's
 * benchmark archive:
 *
 *   eciCapability   Epoch Capabilities Index of the top model (replaces the
 *                   stale hand-entered hendrycksAgiScore — decision D8)
 *   epochBenchmarks frontier basket B-2026.1 (GPQA Diamond, SWE-bench
 *                   Verified, FrontierMath T1–3 v2, HLE) — replaces the
 *                   2026-07 placeholder value
 *
 * Returns raw values; normalization happens in domain/anchors.js.
 */
import { getEpochArchive } from './epoch-source.js';
import { extractEci, extractBasket, buildDisplayNames, BASKET_ID, DAY_MS } from '../domain/epoch-extract.js';

const ECI_FILE = 'epoch_capabilities_index/eci_scores.csv';
const SOURCE = 'Epoch AI — Capabilities & benchmarking (epoch.ai/benchmarks, CC-BY 4.0)';
// A dataset whose newest model is older than this has probably stopped
// updating; refusing it lets the pipeline carry the last good reading
// forward (visibly stale) instead of re-asserting old data as current.
export const EPOCH_MAX_DATA_AGE_DAYS = 120;

export function createEpochAdapter({ fetchArchive = getEpochArchive, now = () => new Date() } = {}) {
  return {
    async fetch() {
      const t0 = Date.now();
      const { tables, errors: fetchErrors } = await fetchArchive();
      const errors = [...fetchErrors];
      const indicators = {};

      if (!tables[ECI_FILE]) {
        if (fetchErrors.length === 0) errors.push(`epoch: ${ECI_FILE} missing from archive`);
      } else {
        const eci = extractEci(tables[ECI_FILE]);
        errors.push(...eci.errors);
        if (eci.eci !== null) {
          const ageDays = (now().getTime() - Date.parse(eci.dataThrough)) / DAY_MS;
          if (ageDays > EPOCH_MAX_DATA_AGE_DAYS) {
            errors.push(`epoch: newest model in the ECI table is ${Math.round(ageDays)} days old (${eci.dataThrough}) — feed may have stopped updating`);
          } else {
            indicators.eciCapability = {
              value: null, // normalized by domain
              raw: {
                eci: eci.eci,
                model: eci.model,
                modelDate: eci.date,
                ciLow: eci.ciLow,
                ciHigh: eci.ciHigh,
                modelCount: eci.n,
              },
              asOf: eci.dataThrough,
              source: `${SOURCE} — Epoch Capabilities Index`,
              confidence: 'verified',
            };
          }
        }
      }

      if (Object.keys(tables).length > 0) {
        const basket = extractBasket(tables, { displayNames: buildDisplayNames(tables['model_metadata.csv'] ?? []) });
        errors.push(...basket.errors);
        if (basket.fractions) {
          const asOf = basket.members.reduce((d, m) => (m.date > d ? m.date : d), '0000-00-00');
          indicators.epochBenchmarks = {
            value: null,
            raw: {
              basket: BASKET_ID,
              fractions: basket.fractions,
              members: basket.members,
              saturated: basket.members.filter((m) => m.saturated).map((m) => m.label),
            },
            asOf,
            source: `${SOURCE} — frontier basket ${BASKET_ID}`,
            confidence: 'verified',
          };
        }
      }

      return { indicators, fetchMs: Date.now() - t0, errors };
    },
  };
}

export const epochAdapter = createEpochAdapter();
