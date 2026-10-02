/**
 * ARC Prize adapter — the `arcGap` indicator from arcprize.org's public
 * leaderboard JSON. See domain/arc-extract.js for the harness policy (D6).
 *
 * Both generations must resolve: arcGap is a mean over the active
 * generations, so silently dropping one would move the number for no real
 * reason. If either is missing the indicator is withheld and the pipeline
 * carries the previous reading forward (visibly aged).
 */
import axios from 'axios';
import { extractArc2, extractArc3 } from '../domain/arc-extract.js';

export const ARC_EVALUATIONS_URL = 'https://arcprize.org/media/data/evaluations.json';
export const ARC_V3_URL = 'https://arcprize.org/media/data/leaderboard/v3.json';

async function defaultGetJson(url) {
  const { data } = await axios.get(url, { timeout: 60000 });
  return data;
}

export function createArcAdapter({ getJson = defaultGetJson } = {}) {
  return {
    async fetch() {
      const t0 = Date.now();
      const errors = [];

      async function load(url, label) {
        try {
          return await getJson(url);
        } catch (err) {
          errors.push(`arc ${label}: ${err.message}`);
          return null;
        }
      }

      const [evaluations, v3] = [await load(ARC_EVALUATIONS_URL, 'evaluations'), await load(ARC_V3_URL, 'v3')];
      const arc2 = Array.isArray(evaluations) ? extractArc2(evaluations) : null;
      const arc3 = v3 && Array.isArray(v3.evaluations) ? extractArc3(v3) : null;
      if (arc2) errors.push(...arc2.errors);
      if (arc3) errors.push(...arc3.errors);

      if (!arc2?.generation || !arc3?.generation) {
        return { indicators: {}, fetchMs: Date.now() - t0, errors };
      }

      return {
        indicators: {
          arcGap: {
            value: null, // normalized by domain
            raw: { generations: [arc2.generation, arc3.generation] },
            asOf: arc3.generatedAt ?? new Date().toISOString().slice(0, 10),
            source: 'ARC Prize leaderboard (arcprize.org/leaderboard) — ARC-AGI-2 Semi-Private, ARC-AGI-3 Standard harness',
            confidence: 'verified',
          },
        },
        fetchMs: Date.now() - t0,
        errors,
      };
    },
  };
}

export const arcAdapter = createArcAdapter();
