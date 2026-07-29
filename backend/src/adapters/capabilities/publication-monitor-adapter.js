/**
 * Official-publication monitoring (UK AISI, METR, Apollo Research,
 * Anthropic, OpenAI, Google DeepMind) — pending. This is Phase 3 in the
 * implementation brief: automatically collecting narrative publications
 * (system cards, research reports, incident reports) and extracting
 * candidate evidence from them. Building a claim-extraction step reliable
 * enough not to mischaracterize high-stakes claims — exactly the failure
 * mode this project's methodology exists to prevent — is a substantial
 * undertaking on its own (NLP extraction, source-excerpt fidelity,
 * confidence scoring) and isn't included in this implementation. Qualitative
 * evidence currently enters the system only through the human-curated
 * review queue (capabilities-review-queue.json / capabilities-manual.json),
 * which already enforces the review-required rules in policies.js.
 */
import { makePendingAdapter } from './pending-adapter.js';

export const publicationMonitorAdapter = makePendingAdapter(
  'publication-monitor',
  'Automated evidence extraction from narrative publications is not implemented; qualitative evidence enters only via the manual review queue.'
);
