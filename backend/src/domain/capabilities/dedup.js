/**
 * Deduplication — a scheduled job reprocessing unchanged source data must
 * not create duplicate observations. Pure; no I/O (the set of already-known
 * hashes is passed in by the caller, which owns persistence).
 */

/**
 * @param {Iterable<string>} knownHashes hashes already persisted
 * @param {Array<{sourceHash:string}>} candidates normalized observations
 * @returns {{fresh:Array, duplicates:Array}}
 */
export function partitionNewObservations(knownHashes, candidates) {
  const known = knownHashes instanceof Set ? knownHashes : new Set(knownHashes);
  const fresh = [];
  const duplicates = [];
  const seenThisBatch = new Set();

  for (const c of candidates) {
    if (known.has(c.sourceHash) || seenThisBatch.has(c.sourceHash)) {
      duplicates.push(c);
    } else {
      seenThisBatch.add(c.sourceHash);
      fresh.push(c);
    }
  }

  return { fresh, duplicates };
}
