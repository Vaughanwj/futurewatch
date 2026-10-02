/**
 * Epoch AI benchmark archive — fetch, unzip, parse. Shared by the scored
 * indicators (epoch-adapter.js), the METR horizon series (metr-adapter.js),
 * and the Four Capabilities Watch cards (capabilities/epoch-capabilities-
 * adapter.js), so one pipeline run never downloads the 2 MB ZIP more than
 * once per process.
 *
 * Source: https://epoch.ai/data/benchmark_data.zip — CC-BY 4.0, refreshed
 * daily, no key. Credit: "Epoch AI, 'Capabilities & benchmarking'", per the
 * licence in the archive's README.
 */
import axios from 'axios';
import { unzipSync, strFromU8 } from 'fflate';
import { parseCsv } from '../domain/csv.js';
import { BASKET_MEMBERS, CAPABILITY_SOURCES } from '../domain/epoch-extract.js';

export const EPOCH_ZIP_URL = 'https://epoch.ai/data/benchmark_data.zip';
const ECI_PATH = 'epoch_capabilities_index/eci_scores.csv';

// Only these entries are inflated — the archive holds ~100 CSVs we don't use.
const WANTED = new Set([
  ECI_PATH,
  'model_metadata.csv',
  'metr_time_horizons_external.csv',
  ...BASKET_MEMBERS.map((m) => m.file),
  ...CAPABILITY_SOURCES.map((c) => c.file),
]);

async function defaultGetBuffer(url) {
  const { data } = await axios.get(url, { timeout: 120000, responseType: 'arraybuffer' });
  return new Uint8Array(data);
}

/**
 * @param {{getBuffer?: (url:string)=>Promise<Uint8Array>}} [deps]
 * @returns {Promise<{tables: Object<string, Array<Object>>, errors: string[]}>}
 *   tables keyed by archive path ("gpqa_diamond.csv", "epoch_capabilities_index/eci_scores.csv", …)
 */
export async function fetchEpochArchive({ getBuffer = defaultGetBuffer } = {}) {
  let bytes;
  try {
    bytes = await getBuffer(EPOCH_ZIP_URL);
  } catch (err) {
    return { tables: {}, errors: [`epoch: download failed: ${err.message}`] };
  }

  let files;
  try {
    files = unzipSync(bytes, { filter: (f) => WANTED.has(f.name) });
  } catch (err) {
    return { tables: {}, errors: [`epoch: archive is not a readable ZIP: ${err.message}`] };
  }

  const tables = {};
  const errors = [];
  for (const [name, data] of Object.entries(files)) {
    try {
      tables[name] = parseCsv(strFromU8(data));
    } catch (err) {
      errors.push(`epoch: could not parse ${name}: ${err.message}`);
    }
  }
  return { tables, errors };
}

/**
 * Memoizing wrapper: the first call downloads, later calls in the same
 * process reuse the result (including a failed one — a retry within the same
 * run would only repeat the same outage).
 */
export function createCachedEpochFetcher(fetchArchive = fetchEpochArchive) {
  let pending = null;
  return () => {
    if (!pending) pending = fetchArchive();
    return pending;
  };
}

export const getEpochArchive = createCachedEpochFetcher();
