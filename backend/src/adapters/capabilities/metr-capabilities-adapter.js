/**
 * METR capabilities adapter — reshapes the same METR fits used for the
 * scored metrTimeHorizon indicator into operational_autonomy capability
 * observations, at two success rates (50% "frontier", 80% "reliable").
 *
 * Reuses fetchMetrSource() from ../metr-adapter.js so this never issues a
 * second set of HTTP requests for the same two files.
 */
import { fetchMetrSource } from '../metr-adapter.js';
import { horizonAtSuccessRate } from '../../domain/metr-fit.js';
import { computeSourceHash } from '../../domain/capabilities/observation.js';

const SOURCE_NAME = 'METR eval-analysis-public';
const SOURCE_URL = 'https://github.com/METR/eval-analysis-public';

function buildObservation({ metric, model, minutes, suite, observedAt }) {
  return {
    capability: 'operational_autonomy',
    metric,
    model,
    modelProvider: null,
    value: minutes,
    unit: 'minutes',
    environment: 'controlled_lab',
    goalOrigin: 'externally_assigned',
    scaffold: null,
    observedAt,
    publishedAt: null,
    sourceKind: 'benchmark',
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    sourceHash: computeSourceHash({
      sourceName: SOURCE_NAME, sourceVersion: suite, model, metric, observedAt, value: minutes, unit: 'minutes',
    }),
    confidence: 'high',
    evidenceLevel: 2,
    notes: 'METR task horizons are the human-expert duration of tasks at a given model success probability — not literal uninterrupted agent runtime.',
    extra: { suite },
  };
}

export function createMetrCapabilitiesAdapter(fetchSource = fetchMetrSource) {
  return {
    sourceName: () => 'metr-capabilities',
    async fetch() {
      const t0 = Date.now();
      const { series, models, suite, errors } = await fetchSource();
      const frontierPoint = series.length > 0 ? series[series.length - 1] : null;

      if (!frontierPoint) {
        return { candidates: [], fetchMs: Date.now() - t0, errors };
      }

      const frontierModel = models.find((m) => m.alias === frontierPoint.alias);
      const candidates = [
        buildObservation({
          metric: 'metr_task_horizon_50pct', model: frontierPoint.alias, minutes: frontierPoint.value,
          suite, observedAt: frontierPoint.date,
        }),
      ];

      if (frontierModel && Number.isFinite(frontierModel.a) && Number.isFinite(frontierModel.b)) {
        const p80 = horizonAtSuccessRate(frontierModel.a, frontierModel.b, 0.8);
        if (p80 !== null) {
          candidates.push(
            buildObservation({
              metric: 'metr_task_horizon_80pct', model: frontierPoint.alias, minutes: p80,
              suite, observedAt: frontierPoint.date,
            })
          );
        }
      }

      return { candidates, fetchMs: Date.now() - t0, errors };
    },
  };
}

export const metrCapabilitiesAdapter = createMetrCapabilitiesAdapter();
