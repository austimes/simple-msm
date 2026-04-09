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
- `src/app_config/reference_scenario.json` and `src/data/scenarioLoader.ts` still use the historical `scenario` name for the JSON schema and shared TypeScript model. In user-facing docs and product language, treat that document as a configuration.
- If you add a built-in configuration, keep it as a complete document with explicit demand tables and metadata. Do not rely on reference-document inheritance or overlays.
