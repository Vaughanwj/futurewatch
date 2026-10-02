/**
 * Pipeline orchestrator — wires adapters to domain via DI.
 * Escalation rule (methodology §7): if the composite moves >5 pts vs. the
 * previous snapshot, the run is flagged; the workflow surfaces it rather than
 * silently publishing.
 */
import { buildSnapshot } from './domain/snapshot-builder.js';
import { carryForward } from './domain/carry-forward.js';
import { resolveRebaseline } from './domain/rebaseline.js';

export function createPipeline({ adapters, now = () => new Date(), rebaselines = [] }) {
  return {
    async run(previousSnapshot = null) {
      const results = {};
      for (const [name, adapter] of Object.entries(adapters)) {
        try {
          results[name] = await adapter.fetch();
        } catch (err) {
          // Adapters shouldn't throw, but the pipeline survives if one does.
          results[name] = { indicators: {}, fetchMs: null, errors: [`${name} threw: ${err.message}`] };
        }
      }

      const present = Object.assign({}, ...Object.values(results).map((r) => r.indicators ?? {}));
      const carried = carryForward(present, previousSnapshot);
      const snapshot = buildSnapshot({ results, carried, now: now() });

      const prev = previousSnapshot?.composite?.value;
      const curr = snapshot.composite?.value;
      const escalation =
        Number.isFinite(prev) && Number.isFinite(curr) && Math.abs(curr - prev) > 5
          ? { flagged: true, previous: prev, current: curr, note: 'Composite moved >5 pts — review before publishing (methodology §7).' }
          : { flagged: false };

      // A move this large is only accepted if it was declared in advance
      // (config/rebaselines.json) — see domain/rebaseline.js.
      const resolved = resolveRebaseline({
        declared: rebaselines, previous: previousSnapshot, escalation, generatedAt: snapshot.generatedAt,
      });
      snapshot.escalation = resolved.escalation;
      snapshot.rebaselines = resolved.rebaselines;

      return snapshot;
    },
  };
}
