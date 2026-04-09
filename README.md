# simple-msm

`simple-msm` packages an Australia-focused Phase 1 sector-state library together with a standalone web explorer for inspecting, solving, and comparing reduced-form decarbonisation configurations.

The repository has two halves:

- `aus_phase1_sector_state_library/` contains the checked-in research package.
- `web/` contains a Vite + React + TypeScript app that loads that package directly, turns one active configuration document into a normalized solve request, and runs solves in-browser with `yalps` inside a web worker.

## Why This Exists

The Phase 1 library is meant to be scientifically reviewable, traceable back to explicit evidence and assumptions, useful for fast whole-economy MVP analysis, and expandable into more explicit future representations.

This repo adds the thinnest possible application layer around that package so an analyst or reviewer can:

- inspect sector states, assumptions, evidence summaries, and confidence ratings,
- load a built-in configuration or import a JSON configuration document,
- apply app-owned demand, price, and carbon assumptions,
- run a generic LP solve across milestone years,
- and compare how configuration changes affect cost, direct emissions, commodity demand, electricity balance, and state shares.

## Canonical Model

The app now uses one canonical configuration model everywhere.

- Every built-in configuration in `web/src/configurations/*.json` is a full solve document.
- Imported JSON uses that same full-document shape.
- Browser autosave stores that same full document as the active working document.
- The solver receives that same document after demand resolution and output scoping.

There is no separate user-facing split between a base scenario and a configuration overlay. A built-in configuration is already the thing you edit, save, solve, and compare.

Some internal TypeScript types and schema filenames still use the historical `scenario` name because they describe the same JSON shape. Contributor guidance in this repo uses `configuration` for the user-facing concept.

## What Is In The Repo

### Data package

`aus_phase1_sector_state_library/` is the checked-in Phase 1 package. Its main artifacts are:

- `data/sector_states.csv` — the core state-year dataset consumed by the app and solver.
- `data/sector_states_schema.json` — schema for the sector-state rows.
- `data/source_ledger.csv` and `data/assumptions_ledger.csv` — traceability metadata.
- `data/calibration_summary.csv`, `data/uncertainty_summary.csv`, and `data/commodity_taxonomy.csv` — companion reference tables.
- `docs/` — methods, derivations, calibration notes, uncertainty notes, and Phase 2 recommendations.
- `README.md` — package-level methods, conventions, strengths, and caveats.
- `manifest.json` — package manifest including milestone years and row counts.

The current package contains 228 state-year rows across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

### Web explorer

`web/` exposes four main surfaces:

- `Configuration` — inspect the active working document, import/export JSON, reset to the packaged reference configuration, edit metadata, scope outputs, and solve in place.
- `Compare` — run built-in counterfactual solves derived from the active configuration and summarize deltas heuristically.
- `Library` — browse state-year rows, evidence, constraints, and coefficients.
- `Methods` — surface the package README and companion docs inside the app.

## How It Works

The app follows a straightforward pipeline:

1. Load the checked-in package directly.
   Vite raw-imports Markdown, CSV, and JSON files from `aus_phase1_sector_state_library/`. The app expects that folder to exist in this repo; it is not a generic package uploader.
2. Normalize the package.
   The loader parses `sector_states.csv` into typed sector-state rows, converts JSON-encoded array columns into usable arrays, and loads companion ledgers and docs when present.
3. Load app-owned registries and configuration documents.
   The app reads `web/public/app_config/` for output-role metadata, baseline anchors, demand presets, commodity-price presets, explanation rules, and the JSON schema. It also loads full built-in configurations from `web/src/configurations/`.
4. Restore one active working document.
   On startup, the app restores the most recent browser-local configuration document when available; otherwise it loads the packaged reference configuration.
5. Resolve demand and scope.
   The active configuration is validated, demand tables are materialized into explicit milestone-year values, and optional output scoping is applied from the document metadata.
6. Build a generic solve request.
   The app maps each sector-state row into a normalized solver row with output role, inputs, direct emissions, and numeric bounds so the LP logic stays generic rather than sector-specific.
7. Run the solve in-browser.
   A web worker runs the LP adapter with `yalps`, keeping the UI responsive while returning status, diagnostics, constraint summaries, commodity balances, and state-share reporting.
8. Reuse the same active configuration across the app.
   The Configuration, Compare, Library, and Methods pages all stay anchored to the same working document and package data.

## Quickstart

There is no root-level `package.json`, so run app commands from `web/`.

```bash
cd web
npm install
npm run dev
```

Open the local URL printed by Vite.

### Other supported commands

```bash
cd web
npm run build
npm run preview
npm run lint
npx tsx --test test/*.test.mjs
```

## How To Use It

### Configuration workspace

Start on the `Configuration` page. The app loads the packaged reference configuration by default, restores a browser-local document if one exists, and lets you:

- inspect document metadata,
- import or export a validated JSON configuration document,
- edit the current document name and description,
- save new named configurations from the sidebar,
- scope the working document to a subset of outputs,
- and reset back to the packaged reference configuration.

Autosave stores the active working document in browser storage. The UI is configuration-first: you stay on one document as you edit, solve, and compare.

### Solve and compare workflow

The solve output is shown directly from the Configuration workspace. The app rebuilds the normalized request from the current document, runs the worker-backed LP, and surfaces timings, diagnostics, electricity balance reporting, charts, and active-state summaries.

Open `Compare` to evaluate the active configuration against built-in counterfactual variants. Compare mode is heuristic: it is designed to explain likely drivers of change, not to claim exact causal decomposition.

### Library and methods workflow

Use `Library` to browse and filter state-year rows, inspect inputs and emissions, review assumptions and source IDs, and compare a selected row against a reference row for the same service, region, and year.

Use `Methods` to read the package README, Phase 2 memo, methods overview, and sector derivation notes from inside the app.

## Key Modeling Conventions

The repo still separates library-owned research content from app-owned convenience registries.

- Library-owned content includes sector-state rows, evidence summaries, review notes, source IDs, assumptions, and companion docs.
- App-owned content includes output roles, baseline anchors, demand presets, commodity-price presets, explanation rules, and built-in configuration documents.

That distinction matters when interpreting results.

- Built-in demand-growth presets are convenience defaults, not research evidence from the package.
- Commodity price presets are app defaults used at solve time, not values embedded in the sector-state rows.
- `output_cost_per_unit` is generally a real-2024 non-commodity conversion or supply cost; the app adds explicit commodity purchases and carbon-price effects during the solve.
- For end-use sectors, direct emissions in the rows are scope-1 style on-site emissions only. Electricity-related emissions are represented through electricity supply states and should not be double counted.
- Several CSV fields are stored as JSON-encoded arrays, including `input_commodities`, `input_coefficients`, `input_units`, `energy_emissions_by_pollutant`, `process_emissions_by_pollutant`, `source_ids`, and `assumption_ids`.

For the full package-specific conventions and caveats, start with `aus_phase1_sector_state_library/README.md`.

## Current Limits

- The app is intentionally standalone and browser-based; it is not a backend solve service.
- The app currently expects the checked-in `aus_phase1_sector_state_library/` folder and imports it directly.
- The configuration workspace is strongest for import/export, scoping, and solve workflows; it is not yet a full bespoke form editor for every document field.
- Compare mode is explanatory and heuristic.
- The root repo does not define shared scripts; app commands live under `web/package.json`.

## Repo Map

```text
.
├── aus_phase1_sector_state_library/
│   ├── README.md
│   ├── manifest.json
│   ├── data/
│   └── docs/
├── docs/
│   └── prd/
└── web/
    ├── package.json
    ├── public/app_config/
    ├── src/
    │   ├── configurations/
    │   └── data/
    └── test/
```

## Further Reading

- `aus_phase1_sector_state_library/README.md` — package-specific methods and caveats.
- `docs/prd/phase1_sector_state_explorer_prd_v02.md` — historical product and technical specification for the explorer.
- `web/src/configurations/` — built-in full configuration documents.
- `web/public/app_config/` — app-owned registries and defaults.
- `web/src/` — application code for loading, solving, comparison, and trust views.
