/**
 * Four Capabilities Watch pipeline orchestrator — wires source adapters to
 * domain/capabilities via DI, same pattern as app.js. A broken adapter must
 * not prevent the others from running, so each fetch is individually
 * try/caught.
 */
import { randomUUID } from 'node:crypto';
import { normalizeObservation } from './domain/capabilities/observation.js';
import { partitionNewObservations } from './domain/capabilities/dedup.js';
import { buildCapabilityCards } from './domain/capabilities/card-service.js';

export function createCapabilitiesPipeline({ adapters, now = () => new Date() }) {
  return {
    async run(previousSnapshot = null) {
      const errors = [];
      const sourceHealth = [];
      const allCandidates = [];

      for (const [name, adapter] of Object.entries(adapters)) {
        try {
          const result = await adapter.fetch();
          const candidates = result.candidates ?? [];
          const fetchErrors = result.errors ?? [];
          errors.push(...fetchErrors);
          sourceHealth.push({
            source: name,
            ok: fetchErrors.length === 0,
            fetchMs: result.fetchMs ?? null,
            candidateCount: candidates.length,
            pending: result.pending ?? false,
            pendingReason: result.pendingReason ?? null,
          });
          allCandidates.push(...candidates);
        } catch (err) {
          // Adapters shouldn't throw, but the pipeline survives if one does —
          // a single broken source must never take down the others.
          errors.push(`${name} threw: ${err.message}`);
          sourceHealth.push({ source: name, ok: false, fetchMs: null, candidateCount: 0, pending: false, pendingReason: null });
        }
      }

      const normalized = [];
      let quarantined = 0;
      for (const candidate of allCandidates) {
        const { observation, errors: normErrors } = normalizeObservation(candidate);
        if (observation) {
          normalized.push(observation);
        } else {
          quarantined += 1;
          errors.push(...normErrors.map((e) => `normalize ${candidate.metric ?? candidate.capability ?? '?'}: ${e}`));
        }
      }

      const previousObservations = previousSnapshot?.observations ?? [];
      const knownHashes = new Set(previousObservations.map((o) => o.sourceHash));
      const { fresh, duplicates } = partitionNewObservations(knownHashes, normalized);
      const withIds = fresh.map((o) => ({ ...o, id: o.id ?? randomUUID() }));

      const allObservations = previousObservations.concat(withIds);
      const cards = buildCapabilityCards(allObservations);

      const newlyPending = withIds.filter((o) => o.reviewStatus === 'pending' || o.reviewStatus === 'needs_more_evidence');

      return {
        schemaVersion: 1,
        generatedAt: now().toISOString(),
        cards,
        observations: allObservations,
        newlyPending,
        sourceHealth,
        errors,
        recordsSeen: allCandidates.length,
        recordsNormalized: normalized.length,
        recordsSaved: withIds.length,
        recordsDeduplicated: duplicates.length,
        recordsQuarantined: quarantined,
      };
    },
  };
}
