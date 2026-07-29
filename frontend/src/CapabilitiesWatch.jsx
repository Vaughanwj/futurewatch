/**
 * Four Capabilities Watch — a separate panel tracking precursor evidence for
 * four capabilities: AI Improvement, Goal Autonomy, Operational Autonomy,
 * Resource Acquisition. Deliberately never averaged into the composite meter
 * above (methodology: the evidence types are too heterogeneous to combine
 * honestly) and deliberately careful about wording — see
 * research/capabilities-methodology.md "public wording rules".
 *
 * Reads /data/capabilities.json — a separate fetch, separate file, separate
 * failure mode from the main snapshot.
 */
import { useState, useEffect } from 'react';
import { C, mono, sans, Panel, PanelTitle, Info, fmt1, humanizeMinutes, GITHUB_URL } from './futurewatch_dashboard.jsx';

const GOAL_LEVEL_LABELS = [
  'Level 0 — executes only immediate instructions.',
  'Level 1 — creates instrumental subgoals needed to complete an assigned task.',
  'Level 2 — preserves an assigned or learned goal when challenged or interrupted.',
  'Level 3 — conceals, guards, or continues pursuing a learned or assigned goal without an immediate instruction.',
  'Level 4 — originates and durably pursues a novel goal in deployment, not supplied by the operator, evaluator, training setup, or scenario.',
];

const RECURSIVE_LOOP_LABELS = {
  none_observed: 'No recursive improvement loop observed',
  partial_single_cycle: 'Single improvement cycle observed',
  repeated_human_supervised_cycles: 'Repeated cycles, human-supervised',
  repeated_ai_directed_cycles: 'Repeated cycles, AI-directed',
  sustained_autonomous_recursive_loop: 'Sustained autonomous recursive loop',
};

const RECURSIVE_LOOP_TONE = {
  none_observed: 'neutral',
  partial_single_cycle: 'neutral',
  repeated_human_supervised_cycles: 'watch',
  repeated_ai_directed_cycles: 'warn',
  sustained_autonomous_recursive_loop: 'warn',
};

function toneColor(tone) {
  if (tone === 'high' || tone === 'confirmed') return C.green;
  if (tone === 'pending' || tone === 'watch') return C.yellow;
  if (tone === 'warn') return C.red;
  return C.textDim;
}

function Badge({ children, tone = 'neutral' }) {
  const color = toneColor(tone);
  return (
    <span style={{
      fontFamily: mono, fontSize: '0.62rem', color, border: `1px solid ${color}55`,
      borderRadius: 3, padding: '1px 5px', marginRight: 6, display: 'inline-block', marginBottom: 4,
    }}>
      {children}
    </span>
  );
}

function EnvironmentBadge({ environment }) {
  if (!environment) return null;
  const isReal = environment === 'real_world' || environment === 'limited_deployment';
  const label = { simulation: 'Simulated', controlled_lab: 'Controlled lab', sandbox: 'Sandbox', limited_deployment: 'Limited deployment', real_world: 'Real-world', unknown: 'Environment unknown' }[environment] ?? environment;
  return <Badge tone={isReal ? 'watch' : 'neutral'}>{label}</Badge>;
}

function GoalOriginBadge({ goalOrigin }) {
  if (!goalOrigin || goalOrigin === 'unknown') return null;
  const selfGenerated = goalOrigin === 'apparently_self_generated';
  const label = {
    immediate_instruction: 'Immediate instruction', externally_assigned: 'Externally assigned',
    trained_preference: 'Trained preference', inferred_persistent_goal: 'Inferred subgoal',
    apparently_self_generated: 'Apparently self-generated',
  }[goalOrigin] ?? goalOrigin;
  return <Badge tone={selfGenerated ? 'warn' : 'neutral'}>{label}</Badge>;
}

function PendingNote({ count }) {
  if (!count) return null;
  return (
    <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.yellow, marginTop: 8 }}>
      {count} observation{count === 1 ? '' : 's'} awaiting human review — not yet reflected above
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ fontFamily: sans, fontSize: '0.85rem', color: C.textDim, fontStyle: 'italic' }}>{text}</div>;
}

// ── Cards ─────────────────────────────────────────────────────────────────

function AiImprovementCard({ card }) {
  const hasData = card.bestModel !== null;
  return (
    <Panel>
      <PanelTitle tip="Whether an AI system can improve another model, improve AI-development processes, or contribute to its own future development. A single improvement is not the same as a sustained, AI-directed loop — that distinction is the recursive-loop line below.">
        AI Improvement
      </PanelTitle>
      {!hasData ? (
        <EmptyState text="No verified benchmark result yet." />
      ) : (
        <>
          <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 600, color: C.text }}>{fmt1(card.currentScore)}</div>
          <div style={{ fontFamily: sans, fontSize: '0.8rem', color: C.textDim, marginTop: 2 }}>{card.benchmark} · {card.bestModel}</div>
          {card.previousScore !== null && (
            <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textLow, marginTop: 4 }}>
              previous: {fmt1(card.previousScore)} ({card.change >= 0 ? '+' : ''}{fmt1(card.change)})
            </div>
          )}
          {card.humanBaseline !== null && (
            <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textLow }}>human baseline: {fmt1(card.humanBaseline)}</div>
          )}
          <div style={{ marginTop: 8 }}>
            <Badge tone={card.improvedAnotherModel ? 'watch' : 'neutral'}>
              {card.improvedAnotherModel === true ? 'Improved another model' : card.improvedAnotherModel === false ? 'Did not improve another model' : 'Improved-another-model: unknown'}
            </Badge>
            <Badge tone={card.wasDeployed ? 'watch' : 'neutral'}>
              {card.wasDeployed === true ? 'Deployed' : card.wasDeployed === false ? 'Not deployed' : 'Deployment status unknown'}
            </Badge>
          </div>
        </>
      )}
      <div style={{
        marginTop: 10, fontFamily: mono, fontSize: '0.68rem',
        color: toneColor(RECURSIVE_LOOP_TONE[card.recursiveLoopStatus] ?? 'neutral'),
      }}>
        recursive loop status: {RECURSIVE_LOOP_LABELS[card.recursiveLoopStatus] ?? RECURSIVE_LOOP_LABELS.none_observed}
      </div>
      <PendingNote count={card.pendingCount} />
    </Panel>
  );
}

function GoalAutonomyCard({ card }) {
  const level = card.highestReviewedLevel ?? 0;
  return (
    <Panel>
      <PanelTitle tip="Not a percentage — an evidence ladder (Level 0-4). Automated ingestion may propose a level, but levels 2-4 always require human review before publication, and this card only ever reflects reviewed evidence.">
        Goal Autonomy
      </PanelTitle>
      <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 600, color: level >= 3 ? C.red : level >= 2 ? C.yellow : C.text }}>
        Level {level}
      </div>
      <div style={{ fontFamily: sans, fontSize: '0.78rem', color: C.textDim, marginTop: 4, lineHeight: 1.4 }}>
        {GOAL_LEVEL_LABELS[level]}
      </div>
      <div style={{ marginTop: 8 }}>
        {card.externallyAssigned !== null && (
          <Badge tone="neutral">{card.externallyAssigned ? 'Goal was externally assigned' : 'Goal origin not externally assigned'}</Badge>
        )}
        <Badge tone={card.persistedWithoutInstruction ? 'watch' : 'neutral'}>
          {card.persistedWithoutInstruction ? 'Persisted without immediate instruction' : 'No persistence beyond instruction observed'}
        </Badge>
      </div>
      <PendingNote count={card.pendingCount} />
    </Panel>
  );
}

function OperationalAutonomyCard({ card }) {
  const hasHorizon = card.frontierTaskHorizonMinutes !== null;
  return (
    <Panel>
      <PanelTitle tip="METR task horizons are the human-expert duration of a task at a given model success probability — not literal uninterrupted agent runtime. 80% is the stricter, more 'reliable' horizon; 50% is the more permissive 'frontier' horizon.">
        Operational Autonomy
      </PanelTitle>
      {!hasHorizon ? (
        <EmptyState text="No verified task-horizon result yet." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 18 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: '1.2rem', fontWeight: 600, color: C.text }}>
                {humanizeMinutes(card.reliableTaskHorizonMinutes)}
              </div>
              <div style={{ fontFamily: sans, fontSize: '0.68rem', color: C.textDim }}>reliable (80%) · {card.reliableTaskHorizonModel}</div>
            </div>
            <div>
              <div style={{ fontFamily: mono, fontSize: '1.2rem', fontWeight: 600, color: C.text }}>
                {humanizeMinutes(card.frontierTaskHorizonMinutes)}
              </div>
              <div style={{ fontFamily: sans, fontSize: '0.68rem', color: C.textDim }}>frontier (50%) · {card.frontierTaskHorizonModel}</div>
            </div>
          </div>
          <div style={{ fontFamily: sans, fontSize: '0.72rem', color: C.textLow, marginTop: 8, lineHeight: 1.4 }}>
            The agent completed tasks equivalent to a human expert taking about {humanizeMinutes(card.reliableTaskHorizonMinutes)}, reliably (80%).
          </div>
        </>
      )}
      <div style={{ marginTop: 8 }}>
        <Badge tone={card.computerUseSuccess !== null ? 'neutral' : 'neutral'}>
          computer-use: {card.computerUseSuccess !== null ? `${fmt1(card.computerUseSuccess)}%` : 'no data yet'}
        </Badge>
        <Badge tone="neutral">terminal-task: {card.terminalTaskSuccess !== null ? `${fmt1(card.terminalTaskSuccess)}%` : 'no data yet'}</Badge>
      </div>
      <PendingNote count={card.pendingCount} />
    </Panel>
  );
}

function ResourceAcquisitionCard({ card }) {
  const hasResult = card.bestSimulatedResult !== null;
  return (
    <Panel>
      <PanelTitle tip="Whether an AI can acquire, expand, manage, or preserve resources. A simulated balance is never the same claim as real-world resource ownership — those two fields are always shown separately here.">
        Resource Acquisition
      </PanelTitle>
      {!hasResult ? (
        <EmptyState text="No verified benchmark result yet." />
      ) : (
        <>
          <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 600, color: C.text }}>
            ${card.bestSimulatedResult.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontFamily: sans, fontSize: '0.78rem', color: C.textDim, marginTop: 2 }}>
            simulated balance · {card.bestSimulatedResultModel}
          </div>
          <Badge tone="neutral">Simulated</Badge>
        </>
      )}
      <div style={{ marginTop: 8 }}>
        <Badge tone="neutral">
          compute/account acquisition: {card.computeOrAccountAcquisition ?? 'no verified evidence yet'}
        </Badge>
      </div>
      <div style={{ marginTop: 4 }}>
        <Badge tone="neutral">
          persistence/replication: {card.persistenceOrReplicationEvidence ? `${card.persistenceOrReplicationEvidence.environment}` : 'no verified evidence yet'}
        </Badge>
      </div>
      <div style={{
        marginTop: 10, fontFamily: mono, fontSize: '0.68rem',
        color: card.realWorldResourceAcquisitionObserved ? C.red : C.green,
      }}>
        real-world resource acquisition: {card.realWorldResourceAcquisitionObserved ? 'observed (reviewed evidence)' : 'not observed'}
      </div>
      <PendingNote count={card.pendingCount} />
    </Panel>
  );
}

// ── Section ───────────────────────────────────────────────────────────────

export default function CapabilitiesWatch() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/capabilities.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setSnapshot)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return null; // a separate, non-critical panel — fail silently rather than break the page
  if (!snapshot) return null;

  const { status, cards } = snapshot;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontFamily: mono, fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.1em', color: C.text, textTransform: 'uppercase' }}>
          Four Capabilities Watch
        </span>
        <Info tip="Tracks precursor evidence for four capabilities associated with autonomous self-expansion: AI Improvement, Goal Autonomy, Operational Autonomy, Resource Acquisition. Deliberately kept separate from the composite meter above — these signals are too heterogeneous to average into one honest number." />
        <a href="/capabilities-methodology" style={{ fontFamily: mono, fontSize: '0.68rem', color: C.textDim, marginLeft: 'auto' }}>
          methodology →
        </a>
      </div>

      <Panel style={{ background: '#0d1420' }}>
        <div style={{ fontFamily: sans, fontSize: '0.9rem', color: C.text, lineHeight: 1.5 }}>
          {status?.headline ?? 'No integrated autonomous self-expansion observed. Component capabilities are advancing independently.'}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <AiImprovementCard card={cards.aiImprovement} />
        <GoalAutonomyCard card={cards.goalAutonomy} />
        <OperationalAutonomyCard card={cards.operationalAutonomy} />
        <ResourceAcquisitionCard card={cards.resourceAcquisition} />
      </div>

      <div style={{ fontFamily: sans, fontSize: '0.7rem', color: C.textLow, lineHeight: 1.55 }}>
        Not a claim of recursive self-improvement, self-originated goals, wild replication, or independent resource
        ownership — only what the cited sources directly support. Full methodology and sources:{' '}
        <a href="/capabilities-methodology" style={{ color: C.textDim }}>capabilities methodology</a>
        {' '}· <a href={GITHUB_URL} style={{ color: C.textDim }}>github.com/Vaughanwj/futurewatch</a>.
      </div>
    </div>
  );
}
