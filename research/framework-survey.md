# FutureWatch Meter — Framework Survey

**Purpose:** Survey of peer-reviewed and institutional frameworks for defining and measuring progress toward AGI/ASI. Input to the FutureWatch methodology decision. Nothing here is locked.

**Date:** 2026-07-20
**Status:** Draft for discussion

Confidence key: **[V]** = verified against primary source this session. **[S]** = from search results citing the primary source; primary not independently fetched. **[U]** = secondary-source claim, unverified — do not build on without checking.

---

## 1. Definition frameworks (what AGI *is*)

### 1.1 DeepMind — Levels of AGI (Morris et al., ICML 2024) [S]

- Paper: [arXiv:2311.02462](https://arxiv.org/abs/2311.02462), published [ICML 2024](https://proceedings.mlr.press/v235/morris24b.html). Authors incl. Shane Legg (who coined "AGI" usage in its modern sense).
- Two axes: **performance** (depth) × **generality** (breadth). Six performance tiers: No AI → Emerging → Competent → Expert → Virtuoso → Superhuman, each for Narrow and General systems.
- Separately rates **autonomy** levels (AI as tool → consultant → collaborator → expert → agent), which decouples capability from deployment risk.
- Explicitly modeled on SAE self-driving levels: a shared vocabulary, not a benchmark.
- **Dashboard relevance:** the natural *y-axis of the headline meter*. "Where is the frontier on the Levels-of-AGI grid?" is a defensible, citable headline claim. ASI = the "Superhuman-General" cell, so AGI and ASI live on one scale — answering our earlier open question.

### 1.2 Hendrycks et al. — A Definition of AGI (Oct 2025) [S]

- Paper: [arXiv:2510.18212](https://arxiv.org/abs/2510.18212), site: [agidefinition.ai](https://www.agidefinition.ai/). Large author list incl. Dan Hendrycks, Yoshua Bengio.
- Defines AGI as **matching the cognitive versatility and proficiency of a well-educated adult**, operationalized via Cattell-Horn-Carroll (CHC) theory — the most empirically validated model of human cognitive structure.
- Ten cognitive domains (reasoning, memory, perception, etc.), scored with adapted human psychometric batteries. Produces a **single AGI percentage score**.
- Reported scores: **GPT-4 = 27%, GPT-5 = 58%** [S]. Finds a "jagged" profile: strong on knowledge, critical deficits in **long-term memory storage** — directly relevant to Vaughan's "self-learning" factor.
- **Dashboard relevance:** the closest thing in the literature to a peer-authored "AGI-o-meter needle position." A published number, updated as new models are scored.

### 1.3 DeepMind — Measuring Progress Toward AGI: A Cognitive Framework (Mar 2026) [S]

- Paper: [arXiv:2605.28405](https://arxiv.org/pdf/2605.28405), [Google blog](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/measuring-agi-cognitive-framework/), [PDF](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/measuring-progress-toward-agi/measuring-progress-toward-agi-a-cognitive-framework.pdf).
- Ten cognitive faculties: perception, generation, attention, learning, memory, reasoning, metacognition, executive function, problem solving, **social cognition**.
- Launched with a $200K Kaggle hackathon (through Apr 2026) to crowdsource the benchmarks — meaning per-faculty eval results should start existing publicly.
- **Dashboard relevance:** convergent with 1.2 — the field's two heavyweight groups independently landed on ~10-domain cognitive taxonomies. That convergence is our license to structure pillars this way. "Social cognition" and "learning/memory" faculties map directly onto Vaughan's spontaneous-conversation and self-learning factors.

### 1.4 Chollet — On the Measure of Intelligence / ARC (2019–present)

- Founding argument: intelligence = **skill-acquisition efficiency**, not skill. Benchmarks measuring skill get saturated and gamed; measure generalization to genuinely novel tasks instead.
- ARC-AGI-2 ([arXiv:2505.11831](https://arxiv.org/pdf/2505.11831)) [S]: static novel-reasoning grid tasks. ARC Prize 2025 top private-eval score: **24%** ([ARC Prize 2025 Technical Report, arXiv:2601.10904](https://arxiv.org/html/2601.10904v1)) [S]. (One secondary blog claims a meta-system hit 97.9% by Apr 2026 [U] — verify at [arcprize.org](https://arcprize.org) before using.)
- ARC-AGI-3 ([arXiv:2603.24621](https://arxiv.org/abs/2603.24621)) [S]: **interactive** game environments, zero instructions — agents must explore, learn goals and controls in real time. Humans: 100% of environments. Frontier systems as of early 2026: **under 1%** [S].
- **Dashboard relevance:** ARC-AGI-3 is the single sharpest human–AI gap still standing, and it's precisely a *self-learning in real-time interaction* test — Vaughan's factors, benchmarked. The human/machine gap on ARC-class tests is a natural "distance remaining" indicator.

### 1.5 OpenAI — Five Levels (2024, reported) [S]

- Never formally published; reported by [Bloomberg](https://www.bloomberg.com/news/articles/2024-07-11/openai-sets-levels-to-track-progress-toward-superintelligent-ai) and analyzed academically ([ResearchGate](https://www.researchgate.net/publication/383395776_The_Path_to_Superintelligence_A_Critical_Analysis_of_OpenAI's_Five_Levels_of_AI_Progression)).
- L1 Chatbots → L2 Reasoners → L3 Agents → L4 Innovators → L5 Organizations (AI running an entire org autonomously).
- **Dashboard relevance:** useful narrative shorthand, weak as methodology (not peer-reviewed, self-interested source). Cite as context, don't score against it.

### 1.6 ASI framing

- Convention across the literature ([From AGI to ASI, arXiv:2606.12683](https://arxiv.org/pdf/2606.12683); [Superalignment survey, arXiv:2412.16468](https://arxiv.org/html/2412.16468v1)) [S]: AGI ≈ median-human-level general intelligence; **ASI = broadly, far beyond human-level general intelligence** — not superhuman in narrow domains (chess already qualifies).
- A survey of **self-evolving agents** explicitly frames recursive self-improvement as the ASI path ([arXiv:2507.21046](https://arxiv.org/pdf/2507.21046)) [S].
- **Dashboard relevance:** supports one scale, two marked thresholds (AGI line, ASI line) rather than two meters. Morris et al.'s Superhuman-General cell gives the ASI line a citable definition.

---

## 2. Quantitative trackers (live, automatable signals)

### 2.1 METR time horizon [V — primary source fetched]

- [Time Horizon 1.1, Jan 29 2026](https://metr.org/blog/2026-1-29-time-horizon-1-1/): 50%-success time horizon of frontier models on a 228-task suite.
- Verified figures: **Claude Opus 4.5 = 320 min** [CI 170–729]; GPT-5 = 214 min. Doubling time: **196 days** full-period, **131 days** post-2023, **89 days** post-2024 — i.e., the trend is *accelerating*.
- Public data repo: [METR/eval-analysis-public](https://github.com/METR/eval-analysis-public) — **fetchable by adapter**. Original methodology: [Kwa et al., arXiv:2503.14499](https://arxiv.org/abs/2503.14499).
- **Dashboard relevance:** the single best *trajectory* indicator in existence. An extrapolable exponential with published CIs. A "task horizon" gauge (minutes → hours → days → weeks of human-equivalent work) is intuitive for lay visitors.

### 2.2 Epoch AI Benchmarking Hub [S]

- [epoch.ai/benchmarks](https://epoch.ai/benchmarks), [data access](https://epoch.ai/benchmarks/use-this-data): CSV download + API via Python client (`pip install epochai`). **CC-BY licensed.** Updated continuously (LLM benchmark data updated July 7, 2026).
- Also tracks compute, model counts, training costs across 3,500+ models ([epoch.ai/data](https://epoch.ai/data)).
- **Dashboard relevance:** primary automated feed for benchmark-level indicators. The FRED of AI capability data.

### 2.3 Turing test — passed (Jones & Bergen, 2025) [S]

- [arXiv:2503.23674](https://arxiv.org/abs/2503.23674), published in PNAS: first rigorous three-party Turing test pass. **GPT-4.5 judged human 73%** of the time — *more* often than actual humans.
- **Dashboard relevance:** the canonical "spontaneous conversation" milestone — and it's already behind us. Milestone indicators need a settled/achieved state; this is the template.

### 2.4 Continual learning / self-learning [S]

- [CL-Bench, arXiv:2606.05661](https://arxiv.org/abs/2606.05661): measures **Gain** — performance improvement attributable to accumulated experience vs. a stateless baseline, across six domains. Finding: memory systems largely *don't work yet*; naive in-context learning beats dedicated memory managers.
- [SkillLearnBench, arXiv:2604.20087](https://arxiv.org/html/2604.20087): first benchmark for agents generating and reusing new skills from experience.
- Consistent with Hendrycks et al.'s finding that long-term memory is the critical deficit.
- **Dashboard relevance:** Vaughan's "self-learning" factor has real benchmarks as of 2026. Currently near the floor — which makes it a high-information indicator (movement means something).

### 2.5 Multi-agent / real-time engagement [S]

- [GPTNT, arXiv:2606.28514](https://arxiv.org/pdf/2606.28514): real-time collaboration between multimodal agents (Keep Talking and Nobody Explodes). [DEBATE (NeurIPS 2025)](https://neurips.cc/virtual/2025/124579): authenticity of multi-agent group dynamics vs. 2,000+ humans. [H2HMem, arXiv:2606.09461](https://arxiv.org/pdf/2606.09461): memory in human-human-style interaction.
- Field consensus: single-agent alignment does not produce authentic group dynamics; current setups feel unnatural.
- **Dashboard relevance:** the thinnest, youngest literature of the survey — Vaughan's "multi-user real-time engagement" factor is ahead of the benchmarks. Candidate for a hand-scored rubric indicator (like Frokkle's `nistPqc`) until the field settles.

### 2.6 Forecast aggregation — Metaculus [S]

- [Weakly general AI](https://www.metaculus.com/questions/3479/date-weakly-general-ai-is-publicly-known/): community estimate **June 2028**. [Full AGI (four conditions incl. robotics)](https://www.metaculus.com/questions/5121/when-will-the-first-general-ai-system-be-devised-tested-and-publicly-announced/): **~Jan 2033**; 25% by 2029, 50% by 2033. ~2,000 forecasters, continuously updated since 2020. Timelines moved *later* during 2025→2026.
- Metaculus has a public API — **fetchable by adapter**.
- **Dashboard relevance:** "when does the crowd of calibrated forecasters think it lands" is a distinct and honest signal class — expectation, not capability. Auto-updating.

### 2.7 Annual institutional reports [S]

- [Stanford HAI AI Index 2026](https://hai.stanford.edu/ai-index/2026-ai-index-report): nine chapters, public downloadable dataset, annual (~April). Already used in Frokkle (`stanfordAiIndex`).
- [FLI AI Safety Index, Summer 2026](https://futureoflife.org/ai-safety-index-summer-2026/): nine labs × 37 indicators × six domains, expert-panel graded, semiannual. Best overall grade: **C+ (Anthropic, 2.66/4.0)**; no lab above C− on existential safety; several labs weakened earlier pause commitments.
- [Anthropic Economic Index](https://www.anthropic.com/economic-index): AI's real-work footprint by occupation/geography; 77% of API traffic shows automation patterns. Ongoing reports (Jan/Mar/Jun 2026).
- **Dashboard relevance:** annual/semiannual manual-adapter indicators, exactly like Frokkle's `foundations-manual.json` maintenance cycle. The FLI index is the strongest citable basis for a **safety-progress pillar**; the Anthropic Economic Index anchors a **real-world deployment** indicator (OpenAI's own charter defines AGI in economic-work terms).

---

## 3. Convergences the meter can stand on

1. **~10-domain cognitive taxonomy.** DeepMind (2026) and Hendrycks et al. (2025) independently converge on ten-faculty decompositions grounded in psychometrics. → Pillar structure has peer-reviewed cover.
2. **Jaggedness is the story.** Every framework finds superhuman peaks next to sub-child troughs (long-term memory, continual learning, interactive novel environments). → A single needle *must* be accompanied by a profile view, or it misleads.
3. **Level + trajectory.** Published point-scores (AGI % score, Levels grid position) + published exponentials (METR doubling, Epoch trends) map exactly onto Frokkle's level-component / trajectory-component pattern. → Architecture reuse is not just convenient, it's methodologically apt.
4. **One scale, two thresholds.** AGI = median-human general; ASI = far-beyond-human general (Superhuman-General cell). → One meter, AGI and ASI as marked lines, not two products.
5. **Capability vs. safety divergence.** Capability trackers accelerate (89-day doubling) while the FLI index shows safety practice flat-to-retreating. → The Frokkle Divergence tab has a direct analogue, and it may be the most important number on the site.
6. **Vaughan's three factors are covered — unevenly.** Spontaneous conversation: benchmarked and *passed* (Turing 2025). Self-learning: benchmarked, near floor (CL-Bench). Multi-user real-time: pre-benchmark, needs a rubric indicator.

---

## 4. Automation matrix (Frokkle adapter pattern)

| Signal | Source | Cadence | Adapter type |
| --- | --- | --- | --- |
| METR time horizon | GitHub repo (public data) | per release | automated |
| Benchmark suite (incl. ARC) | Epoch AI CSV/API (CC-BY) | continuous | automated |
| Metaculus AGI forecasts | Metaculus API | continuous | automated |
| ARC-AGI leaderboards | arcprize.org | per release | automated (scrape) or manual |
| Hendrycks AGI score | agidefinition.ai / papers | per model gen | manual |
| Levels-of-AGI grid position | judgment vs. published criteria | per model gen | manual rubric |
| CL-Bench / SkillLearnBench | papers/leaderboards | sporadic | manual |
| Multi-user real-time engagement | rubric (constructed) | quarterly | manual rubric |
| FLI AI Safety Index | futureoflife.org PDF | semiannual | manual |
| Stanford AI Index | hai.stanford.edu | annual | manual |
| Anthropic Economic Index | anthropic.com | ~quarterly | manual |
| Curated stories panel | YouTube/arXiv/lab RSS | daily | automated |

Roughly the same automated/manual split Frokkle already sustains.

---

## 5. Open questions for discussion (not yet decided)

1. **Headline number:** Hendrycks-style single AGI % (citable, simple, but one team's number) vs. our own composite over pillars (ours to defend, Frokkle-style) vs. both (their number as one indicator inside our composite)?
2. **Pillar cut:** by cognitive faculty (the 10-domain taxonomies collapsed to ~4–5 pillars) vs. by signal class (Capability / Autonomy / Deployment / Expectation / Safety)?
3. **Does safety live inside the meter or beside it** as a divergence view? (Survey suggests beside — mixing "how close" with "how safe" muddies both.)
4. **ASI line placement:** Superhuman-General per Morris et al. is citable, but operationalizing "far beyond human" needs a rule.
5. **Manual-rubric governance:** who scores the judgment indicators and against what written criteria (Frokkle's decision-log discipline applies).

---

## 6. Source log

All arXiv IDs, URLs and figures above carry [V]/[S]/[U] confidence tags. [U] items must be verified before entering methodology. Primary verification this session: METR Time Horizon 1.1 (full text fetched 2026-07-20).
