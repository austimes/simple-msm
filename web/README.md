# Web App

`web/` is the standalone front end for `simple-msm`. It loads the checked-in Phase 1 sector-state library, restores one active configuration document, builds a normalized solve request, and runs the LP solve in-browser.

## Configuration Model

The app is configuration-first.

- Built-in configurations live in `src/configurations/*.json` and are full solve documents.
- Imported JSON uses that same document shape.
- Browser autosave persists that same full document as the active working document.
- The solver consumes that same document after demand resolution and optional output scoping.

There is no separate user-facing base-scenario-plus-overlay workflow.

## Run It

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Quality Checks

```bash
npm run lint
npm run build
npx tsx --test test/*.test.mjs
```

## Main Folders

- `src/configurations/` — built-in full configuration documents.
- `src/components/workspace/` — configuration workspace UI, including import/export and metadata editing.
- `src/data/` — package loading, configuration loading, browser persistence, and demand resolution.
- `src/solver/` — normalized solve-request construction, worker bridge, and LP adapter.
- `src/compare/` — heuristic compare planning and reporting.
- `test/` — regression coverage for configuration documents, demand resolution, solves, compare flows, and package companions.

## Contributor Notes

- `public/app_config/` contains app-owned registries and defaults such as output roles, demand presets, commodity-price presets, and explanation rules.
- `src/app_config/reference_scenario.json` and `src/data/scenarioLoader.ts` still use the historical `scenario` name at the compatibility boundary. The shared TypeScript model now exposes configuration-named primary exports with scenario-named aliases for older callers.
- If you add a built-in configuration, keep it as a complete document with explicit demand tables and metadata. Do not rely on reference-document inheritance or overlays.

## Scenario Compatibility Policy

Use configuration terminology in product copy, docs, and new code. The remaining `scenario` names below are compatibility boundaries, not permission to keep expanding the old term.

| Surface | Current examples | Policy | Follow-up expectation |
| --- | --- | --- | --- |
| Public app-owned asset filenames | `public/app_config/reference_scenario.json`, `public/app_config/scenario_schema.json`, versioned `*_v02` copies | Temporary compatibility shim. Treat these filenames as published asset paths that may already be referenced by tests, docs, or external consumers. Do not rename them in place. | Issue `1iw.6` should dual-ship configuration-named aliases first, update internal callers, then remove the old filenames only after the compatibility window is intentionally closed. |
| Browser-local draft storage keys | `simple-msm.scenario-draft.v2` | Temporary compatibility shim. Existing browser drafts must survive terminology cleanup. Do not replace this key with a configuration-named key without an additive read-old/write-new migration. | A future migration may introduce a configuration-named key, but it must continue reading the old key and clear it only after a successful transfer. |
| Legacy persisted fields | `baseConfigurationScenario`, `app_metadata.included_output_ids` | Read-only compatibility shim. Keep accepting these legacy fields when loading saved data, but do not emit them from canonical documents or new saves. | Downstream cleanup can delete the shim only after persisted documents and browser state are known to have been migrated. |
| Internal raw solver artifact naming | `raw.kind = "scenario_lp"` | Not an external compatibility boundary. This is an internal diagnostic label with in-repo test coverage, not a user-facing persistence surface. | Safe to rename directly when solver terminology cleanup happens, as long as the contract, producer, and tests move together in one change. |
| Archival PRD documents | `docs/prd/**` | Exempt from bulk terminology cleanup. Those files are historical artifacts and may intentionally preserve older language. | Only edit archival PRDs when doing substantive document maintenance, and preserve historical wording where accuracy matters. |

Practical rule: if a `scenario` name crosses a browser-storage boundary, a checked-in public asset path, or a backward-compatibility parser, treat it as a migration. Otherwise, treat it as an internal rename target.
