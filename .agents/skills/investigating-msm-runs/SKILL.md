---
name: investigating-msm-runs
description: Explains and reproduces simple-msm configuration runs with the CLI. Use when asked to investigate a model result, compare configurations, explain what changed, or suggest the next solver/debugging step.
---

# Investigating MSM Runs

Uses the first-class `msm` CLI in `web/` to reproduce the same configuration documents the UI runs.

## When To Use It

- A user asks why a configuration produced a result.
- A user wants to compare two configurations and understand what changed.
- A user wants suggestions for what to try next to unravel an infeasible or surprising solve.
- A user wants an agent to inspect a saved UI case without manually tracing the code.

## Working Directory

Run the CLI from `web/`.

```bash
bun run msm --help
```

The `prime` payload also reports `reproduce.workdir: "web"` so agents know where to run follow-up commands.

## Supported Config References

- Built-in configs: `reference-baseline`
- Repo-backed user configs: `user:full-system-base`
- JSON file paths: `./tmp/my-case.json`

Browser-local drafts are not visible to the CLI. If the user says “my current workspace” and it has not been saved, ask them to either save it as a user config or export the JSON document first.

## Core Commands

List available configs:

```bash
bun run msm list
bun run msm list --json
```

Solve one config:

```bash
bun run msm reference-baseline --json
bun run msm user:full-system-base
```

Compare two configs:

```bash
bun run msm compare reference-baseline user:full-system-base --json
```

Prime an agent with AI-oriented context:

```bash
bun run msm prime user:full-system-base
bun run msm prime user:full-system-base --base reference-baseline
```

## Recommended Workflow

1. Start with `bun run msm prime <config>`.
2. If the user is asking “compared to what?”, rerun with `--base <config>`.
3. Read `nextActions` first for solver-provided suggestions.
4. Use `solve.topDiagnostics`, `topBindingConstraints`, and `topCommodityBalanceFindings` to explain the current result.
5. If the user needs a detailed numeric diff, run `compare` as well.

## Interpreting `prime`

- `focus.configuration` is the materialized configuration the CLI actually ran.
- `solve` is the top-level run summary, including status, timings, diagnostics, binding constraints, and leading balance findings.
- `nextActions` is derived from solver diagnostic suggestions. Treat it as the best first debugging queue, not as policy advice.
- `base` is only present when `--base` is provided.
- `base.efficiencyAttributionSafe` tells you whether the two configurations share the same non-efficiency backbone closely enough for additionality-style interpretation.
- `base.validationIssues` lists mismatches that make additionality explanations unsafe or misleading.

## Relevant Code Paths

- `web/solve.mjs`
- `web/src/cli/configurationRefs.mjs`
- `web/src/data/packageLoader.ts`
- `web/src/data/configurationDocumentLoader.ts`
- `web/src/data/configurationLoader.ts`
- `web/src/results/runScenario.ts`
- `web/src/additionality/additionalityAnalysis.ts`

## Guardrails

- Prefer `prime` over ad hoc grepping when the task is to explain a run.
- Prefer `user:<id>` for saved UI cases so the source is unambiguous.
- Do not assume browser autosave is accessible from the CLI.
- Do not re-materialize residual overlays or efficiency controls by hand; the CLI already does that with the shared loaders.
