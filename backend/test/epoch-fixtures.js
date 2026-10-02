// Fixture builders for Epoch's archive shapes — small, but with the real
// column names and the real quirks (undated rows, variant rows per model,
// blank scores). Not a test file: node --test only runs *.test.js.
import { zipSync, strToU8 } from 'fflate';

const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function toCsv(columns, rows) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

/** n synthetic rows with scores rising 0.30→top, one every 12 days from 2025-01-01. */
export function scoreRows(n, top, { scoreCol = 'mean_score', extra = {} } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    'Model version': `model-${i}_high`,
    [scoreCol]: (0.3 + ((top - 0.3) * i) / (n - 1)).toFixed(4),
    'Release date': new Date(Date.UTC(2025, 0, 1) + i * 12 * 86400000).toISOString().slice(0, 10),
    Organization: 'TestOrg',
    ...extra,
  }));
}

export function eciRows({ gpt5 = 150.0, gpt4 = 125.89, top = 167.35, n = 60 } = {}) {
  const rows = Array.from({ length: n }, (_, i) => ({
    Model: `Filler ${i}`,
    'Display name': `Filler ${i}`,
    eci: (100 + i * 0.5).toFixed(2),
    eci_ci_low: '',
    eci_ci_high: '',
    date: `2025-0${(i % 9) + 1}-15`,
  }));
  rows.push({ Model: 'GPT-5', 'Display name': 'GPT-5', eci: gpt5, eci_ci_low: '', eci_ci_high: '', date: '2025-08-07' });
  rows.push({ Model: 'GPT-4 (Mar 2023)', 'Display name': 'GPT-4 (Mar 2023)', eci: gpt4, eci_ci_low: '', eci_ci_high: '', date: '2023-03-14' });
  rows.push({ Model: 'Top Model', 'Display name': 'Top Model', eci: top, eci_ci_low: '164', eci_ci_high: '172', date: '2026-09-22' });
  return rows;
}
export const ECI_COLS = ['Model', 'Display name', 'eci', 'eci_ci_low', 'eci_ci_high', 'date'];

/** Every file the adapters read, as CSV text. Override (or null out) pieces per test. */
export function buildArchiveFiles(overrides = {}) {
  return {
    'epoch_capabilities_index/eci_scores.csv': toCsv(ECI_COLS, eciRows()),
    'model_metadata.csv': toCsv(['model_version', 'display_name'], [
      { model_version: 'm-b', display_name: 'Model B (Early)' },
      { model_version: 'm-a', display_name: 'Model A (unknown thinking)' },
    ]),
    'gpqa_diamond.csv': toCsv(['Model version', 'mean_score', 'Release date'], scoreRows(30, 0.95)),
    'swe_bench_verified.csv': toCsv(['Model version', 'mean_score', 'Release date'], scoreRows(30, 0.83)),
    'frontiermath_tiers_1_3_v2.csv': toCsv(['Model version', 'mean_score', 'Release date'], scoreRows(30, 0.85)),
    'hle_external.csv': toCsv(['Model version', 'Accuracy', 'Release date'], scoreRows(30, 0.55, { scoreCol: 'Accuracy' })),
    'vending_bench_2_external.csv': toCsv(
      ['Model version', 'Score', 'Release date', 'Name', 'Organization'],
      scoreRows(6, 0.3).map((r, i) => ({ ...r, Score: 1000 * (i + 1), Name: `Vend ${i}` }))
    ),
    'posttrainbench_external.csv': toCsv(
      ['Model version', 'Scaffold', 'Average (%)', 'Release date', 'Organization'],
      scoreRows(6, 0.42, { scoreCol: 'Average (%)', extra: { Scaffold: 'Claude Code' } })
    ),
    'os_world_external.csv': toCsv(['Model version', 'Score', 'Release date'], [
      { 'Model version': '', Score: '65.4', 'Release date': '' }, // agent-only row, undated
      { 'Model version': 'a', Score: '50.0', 'Release date': '2025-06-01' },
      { 'Model version': 'b', Score: '72.1', 'Release date': '2026-02-17' },
    ]),
    'terminalbench_external.csv': toCsv(['Model version', 'Agent', 'Accuracy mean', 'Release date', 'Name'], [
      { 'Model version': 'm1_unknown', Agent: 'A1', 'Accuracy mean': '0.50', 'Release date': '2025-09-01', Name: 'M1' },
      { 'Model version': 'm1_unknown', Agent: 'A2', 'Accuracy mean': '0.60', 'Release date': '2025-09-01', Name: 'M1' },
      { 'Model version': 'm2_unknown', Agent: 'A1', 'Accuracy mean': '0.847', 'Release date': '2026-04-23', Name: 'M2' },
    ]),
    'metr_time_horizons_external.csv': toCsv(
      ['Model version', 'Time horizon', 'Release date', 'CI_high', 'CI_low', 'Time Horizon (80%)', 'METR version'],
      [
        { 'Model version': 'gpt2-xl', 'Time horizon': '0.07', 'Release date': '2019-11-05', 'METR version': 'METR-Horizon-v1.0' },
        { 'Model version': 'm-a_unknown', 'Time horizon': '300', 'Release date': '2026-02-05', CI_high: '900', CI_low: '100', 'Time Horizon (80%)': '60', 'METR version': 'METR-Horizon-v1.1' },
        { 'Model version': 'm-a_unknown', 'Time horizon': '310', 'Release date': '2026-02-05', 'METR version': '' },
        { 'Model version': 'm-b', 'Time horizon': '1044.78', 'Release date': '2026-04-07', CI_high: '3304', CI_low: '508', 'Time Horizon (80%)': '185.9', 'METR version': 'METR-Horizon-v1.1' },
        { 'Model version': 'undated', 'Time horizon': '5000', 'Release date': '', 'METR version': 'METR-Horizon-v1.1' },
      ]
    ),
    ...overrides,
  };
}

export function buildArchiveZip(overrides = {}) {
  const entries = {};
  for (const [name, content] of Object.entries(buildArchiveFiles(overrides))) {
    if (content !== null) entries[name] = strToU8(content);
  }
  entries['README.md'] = strToU8('unused'); // proves the filter ignores unlisted entries
  return zipSync(entries);
}
