/**
 * Factory for sources with no verified live public integration in this
 * codebase yet. Per the implementation brief: "where official source access
 * remains uncertain, isolate the adapter behind a port, provide fixtures and
 * tests, and mark the live integration as pending rather than pretending it
 * works." Each of these conforms to the same CapabilitySourcePort shape as a
 * working adapter (sourceName/fetch) so the pipeline can wire them in
 * uniformly and swap in a real implementation later without touching the
 * orchestrator.
 */

/**
 * @param {string} name
 * @param {string} pendingReason human-readable explanation of what's missing
 * @returns {import('../../ports/capabilities-types.js').CapabilitySourcePort}
 */
export function makePendingAdapter(name, pendingReason) {
  return {
    sourceName: () => name,
    async fetch() {
      return { candidates: [], fetchMs: 0, errors: [], pending: true, pendingReason };
    },
  };
}
