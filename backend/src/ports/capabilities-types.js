/**
 * Port contracts for Four Capabilities Watch. JSDoc only — no runtime code.
 * Adapted to this repo's existing static-pipeline architecture: there is no
 * database or running API server, so CapabilityRepositoryPort,
 * EvidenceReviewRepositoryPort, and SourceHealthRepositoryPort here are
 * fulfilled by JSON-file-backed implementations (see
 * domain/capabilities/*, adapters/capabilities/*, and the pipeline in
 * app-capabilities.js) rather than a live database. The shapes below are
 * still worth defining explicitly so a future move to a real backend has a
 * contract to implement against — see research/capabilities-methodology.md
 * "known limitations."
 */

/**
 * @typedef {Object} SourceCursor
 * @property {string} [after] opaque cursor token from a previous fetchUpdates call
 */

/**
 * @typedef {Object} RawSourceBatch
 * @property {Array} candidates raw, source-shaped records — not yet normalized
 * @property {number} fetchMs
 * @property {string[]} errors
 * @property {boolean} [pending] true if this source has no live integration yet
 * @property {string} [pendingReason]
 */

/**
 * @typedef {Object} CapabilitySourcePort
 * @property {() => string} sourceName
 * @property {(cursor?: SourceCursor) => Promise<RawSourceBatch>} fetch
 */

/**
 * @typedef {Object} CapabilityObservationCandidate
 * Raw candidate shape consumed by domain/capabilities/observation.js
 * normalizeObservation() — see that module for the full field list.
 */

/**
 * @typedef {Object} CapabilityNormalizerPort
 * @property {(batch: RawSourceBatch) => Promise<CapabilityObservationCandidate[]>} normalize
 */

/**
 * @typedef {Object} CapabilityRepositoryPort
 * @property {(observation: object) => Promise<void>} saveObservation
 * @property {(hash: string) => Promise<object|null>} findBySourceHash
 * @property {(metric: string) => Promise<object|null>} getLatestByMetric
 */

/**
 * @typedef {Object} EvidenceReviewRepositoryPort
 * @property {(candidate: object) => Promise<void>} enqueue
 * @property {(id: string, reviewer: string, notes?: string) => Promise<void>} approve
 * @property {(id: string, reviewer: string, reason: string) => Promise<void>} reject
 */

/**
 * @typedef {Object} SourceHealthRepositoryPort
 * @property {(source: string, at: Date, metadata?: unknown) => Promise<void>} recordSuccess
 * @property {(source: string, at: Date, error: string) => Promise<void>} recordFailure
 */

export {};
