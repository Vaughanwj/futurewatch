/**
 * ARC Prize leaderboard extractors — pure, no I/O.
 *
 * Sources (arcprize.org, no key):
 *   /media/data/evaluations.json        v1/v2 results + the 2025 human panel
 *   /media/data/leaderboard/v3.json     ARC-AGI-3 interactive results
 *
 * Decision D6: ARC-AGI-3 is scored on the **Standard harness** (the same
 * generic harness for every model). Results run through a lab's own
 * **Provider Adapter** harness are far higher and are displayed alongside,
 * never scored, because the adapter is tuned per provider and the score then
 * partly measures the harness.
 */

export const HUMAN_PANEL_ID = '2025_human_panel';
const ADAPTER_PATTERN = /provider-adapter/i;

const isoDate = (v) => String(v ?? '').slice(0, 10) || null;

function best(rows) {
  return rows.reduce((b, r) => (b === null || r.score > b.score ? r : b), null);
}

/**
 * ARC-AGI-2: the held-out Semi-Private set, best displayed model ÷ human panel.
 * @param {Array} evaluations evaluations.json
 */
export function extractArc2(evaluations) {
  const errors = [];
  const set = evaluations.filter((e) => e.datasetId === 'v2_Semi_Private');
  const human = set.find((e) => e.modelId === HUMAN_PANEL_ID);
  const models = set.filter((e) => e.modelId !== HUMAN_PANEL_ID && e.display !== false && Number.isFinite(e.score));
  if (!human || !(human.score > 0)) errors.push('arc: ARC-AGI-2 human panel baseline missing');
  if (models.length < 5) errors.push(`arc: ARC-AGI-2 has only ${models.length} scored models (expected ≥5)`);
  if (errors.length > 0) return { generation: null, errors };
  const top = best(models);
  return {
    generation: {
      name: 'ARC-AGI-2',
      dataset: 'Semi-Private',
      frontierScore: top.score,
      humanScore: human.score,
      frontierOverHuman: top.score / human.score,
      model: top.modelId,
      harness: 'standard',
    },
    errors,
  };
}

/**
 * ARC-AGI-3: Standard-harness best is scored; Provider-Adapter best is
 * carried as `adapterScore` for display. Humans are 100% by construction of
 * the ARC-AGI-3 scoring (relative human action efficiency).
 * @param {{evaluations: Array, generatedAt?: string}} v3
 */
export function extractArc3(v3) {
  const errors = [];
  const rows = (v3?.evaluations ?? []).filter(
    (e) => e.datasetId === 'v3_Semi_Private' && e.display !== false && Number.isFinite(e.score)
  );
  const standard = rows.filter((e) => !ADAPTER_PATTERN.test(e.modelId));
  const adapter = rows.filter((e) => ADAPTER_PATTERN.test(e.modelId));
  if (standard.length < 5) errors.push(`arc: ARC-AGI-3 has only ${standard.length} Standard-harness results (expected ≥5)`);
  if (errors.length > 0) return { generation: null, errors };
  const top = best(standard);
  const topAdapter = best(adapter);
  return {
    generation: {
      name: 'ARC-AGI-3',
      dataset: 'Semi-Private',
      frontierScore: top.score,
      humanScore: 1,
      frontierOverHuman: top.score,
      model: top.modelDisplayName ?? top.modelId,
      harness: 'standard',
      providerAdapter: topAdapter
        ? { score: topAdapter.score, model: topAdapter.modelDisplayName ?? topAdapter.modelId }
        : null,
    },
    generatedAt: isoDate(v3.generatedAt),
    errors,
  };
}
