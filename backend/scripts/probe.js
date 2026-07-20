/**
 * Probe script — dumps raw responses from each automated source so adapter
 * parsers can be verified against reality. Run locally: `npm run probe`.
 * Output lands in backend/probe-output/ (gitignored).
 */
import axios from 'axios';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'probe-output');
await mkdir(OUT, { recursive: true });

const targets = [
  { name: 'metaculus-3479.json', url: 'https://www.metaculus.com/api2/questions/3479/' },
  { name: 'metaculus-5121.json', url: 'https://www.metaculus.com/api2/questions/5121/' },
  { name: 'metr-release-dates.yaml', url: 'https://raw.githubusercontent.com/METR/eval-analysis-public/main/data/external/release_dates.yaml' },
  { name: 'metr-runs-head.jsonl', url: 'https://raw.githubusercontent.com/METR/eval-analysis-public/main/reports/time-horizon-1-1/data/raw/runs.jsonl', headLines: 50 },
];

for (const t of targets) {
  try {
    const { data } = await axios.get(t.url, {
      timeout: 60000,
      responseType: 'text',
      headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'futurewatch-meter/0.1' },
    });
    let text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    if (t.headLines) text = text.split('\n').slice(0, t.headLines).join('\n');
    await writeFile(path.join(OUT, t.name), text);
    console.log(`ok  ${t.name} (${text.length} bytes)`);
  } catch (err) {
    console.error(`ERR ${t.name}: ${err.message}`);
  }
}
console.log(`\nWrote to ${OUT}. Diff these against adapter parser assumptions.`);
