/**
 * Port contracts for the FutureWatch pipeline. JSDoc only — no runtime code.
 * Mirrors the Frokkle adapter contract: adapters return { indicators, fetchMs, errors }.
 */

/**
 * @typedef {Object} IndicatorReading
 * @property {number|null} value      Normalized 0–100 score (null if unscoreable)
 * @property {*}           raw        Raw source value(s) before normalization
 * @property {string}      asOf       ISO date the underlying data refers to
 * @property {string}      source     Human-readable source label with URL
 * @property {'verified'|'provisional'|'judgment'} confidence
 */

/**
 * @typedef {Object} AdapterResult
 * @property {Object<string, IndicatorReading>} indicators
 * @property {number}   fetchMs   Wall-clock fetch duration
 * @property {string[]} errors    Collected errors (never thrown)
 */

/**
 * @typedef {Object} PillarScore
 * @property {string} name
 * @property {number} weight     Share of composite (0–1)
 * @property {number|null} score Level component, 0–100
 * @property {number} coverage   Fraction of pillar indicators with a value
 * @property {Array<{slug:string, score:number|null, weight:number}>} indicators
 */

/**
 * @typedef {Object} FuturewatchSnapshot
 * @property {number} schemaVersion
 * @property {string} generatedAt
 * @property {{value:number|null, coverage:number}} composite
 * @property {Object<string, PillarScore>} pillars
 * @property {Object} expectation  Forecast panel data (never in composite)
 * @property {Object} safety       Divergence panel data (never in composite)
 * @property {Object} trajectory   Frontier time-horizon series + doubling stats
 * @property {Array}  stories      Curated feed items
 * @property {Array}  sourceHealth Per-source status
 * @property {string[]} errors
 */

export {};
