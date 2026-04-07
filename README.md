# simple-msm

`simple-msm` packages an Australia-focused Phase 1 sector-state library together with a small standalone web explorer for running and inspecting reduced-form decarbonisation scenarios. The repository exists to make the Phase 1 library both reviewable and runnable: the checked-in data package captures sector-state assumptions, evidence, and caveats, while the web app turns those rows into an inspectable scenario explorer without requiring a backend service or a VedaLang/Vita stack.

At a high level, the repo has two halves:

- `aus_phase1_sector_state_library/` contains the research package.
- `web/` contains a Vite + React + TypeScript app that loads that package directly, resolves scenarios from app-owned config, builds a generic LP solve request, and runs solves in-browser with `yalps` inside a web worker.

## Why This Exists

The underlying Phase 1 library is meant to be:

- scientifically reviewable,
- traceable back to source families and explicit assumptions,
- good enough for a fast reduced-form MVP that captures whole-economy pressure and electricity interactions,
- and expandable later into more explicit process or TIMES-style representations.

This repo adds a thin application layer around that package so an analyst or reviewer can:

- inspect sector states, assumptions, evidence summaries, and confidence ratings,
- work from a packaged reference scenario or import a scenario JSON document,
- apply app-owned demand, price, and carbon assumptions,
- run a generic LP solve across milestone years,
- and compare the effect of scenario changes on cost, direct emissions, commodity demand, electricity balance, and state shares.

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

`web/` is a small standalone application with pages for:

- `Scenario` — load, inspect, import, export, and reset the active scenario draft.
- `Results` — build the normalized request, solve it in a worker, and inspect diagnostics and balance outputs.
- `Compare` — run built-in counterfactual solves and summarize deltas heuristically.
- `Library` — browse every state-year row and inspect evidence, constraints, and coefficients.
- `Methods` — surface the package README and companion docs inside the app.

## How It Works

The app follows a straightforward pipeline:

1. Load the checked-in package directly.
   Vite raw-imports Markdown, CSV, and JSON files from `aus_phase1_sector_state_library/`. The current app is coupled to that folder being present in this repo; it is not a generic package uploader.
2. Normalize the package.
   The loader parses `sector_states.csv` into typed sector-state rows, converts JSON-encoded array columns into usable arrays, and loads companion ledgers and docs when present.
3. Load app-owned configuration.
   The app reads `web/public/app_config/` for output-role metadata, baseline activity anchors, demand-growth presets, commodity-price presets, explanation rules, a reference scenario, and the scenario JSON schema.
4. Resolve the active scenario.
   The packaged reference scenario or an imported JSON document is validated, then demand tables and year overrides are materialized into the shape the solver expects.
5. Build a generic solve request.
   The app maps every sector-state row into a normalized solver row with output role, inputs, direct emissions, and numeric bounds so the solver logic can stay generic rather than sector-specific.
6. Run the solve in-browser.
   A web worker runs the LP adapter with `yalps`, keeping the UI responsive while returning status, diagnostics, constraint summaries, commodity balances, and state-share reporting.
7. Render inspection and comparison views.
   The app uses the same normalized data for the Results, Compare, Library, and Methods pages so scenario outputs and trust views stay aligned with the underlying package.

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
```

## How To Use It

### Scenario workflow

Start on the `Scenario` page. The app loads a packaged reference scenario by default, restores a browser draft if one exists, and lets you:

- inspect scenario metadata,
- import a validated JSON scenario,
- export the active scenario draft,
- and reset back to the packaged reference scenario.

Scenario drafts autosave in the browser. The current UI is strongest for working from the packaged reference scenario plus JSON import/export; it is not yet a full in-browser scenario authoring system.

### Results workflow

Open `Results` to build the normalized solve request and run the worker-backed LP. The page surfaces:

- solve status and timings,
- normalized input counts,
- electricity balance reporting,
- binding constraints,
- soft-constraint violations when enabled,
- and raw diagnostics from the LP adapter.

### Compare workflow

Open `Compare` to evaluate the active scenario against built-in counterfactual variants. This mode summarizes KPI deltas, commodity shifts, electricity deltas, confidence exposure, and state-share changes.

Compare mode is heuristic. It is designed to explain likely drivers of change, not to claim exact causal decomposition.

### Library and methods workflow

Use `Library` to browse and filter state-year rows, inspect inputs and emissions, review assumptions and source IDs, and compare a selected row against a reference row for the same service, region, and year.

Use `Methods` to read the package README, Phase 2 memo, methods overview, and sector derivation notes from inside the app.

## Key Modeling Conventions

The repo intentionally separates library-owned research content from app-owned convenience configuration.

Library-owned content includes sector-state rows, evidence summaries, review notes, source IDs, assumptions, and companion docs. App-owned content includes output roles, baseline anchors, demand-growth presets, commodity-price presets, explanation rules, and the reference scenario scaffolding.

That distinction matters when interpreting results.

- Built-in growth presets are convenience defaults, not research evidence from the package.
- Commodity price presets are app defaults used at solve time, not values embedded in the sector-state rows.
- `output_cost_per_unit` is generally a real-2024 non-commodity conversion or supply cost; the app adds explicit commodity purchases and carbon-price effects during the solve.
- For end-use sectors, direct emissions in the rows are scope-1 style on-site emissions only. Electricity-related emissions are represented through electricity supply states and should not be double counted.
- Several CSV fields are stored as JSON-encoded arrays, including `input_commodities`, `input_coefficients`, `input_units`, `energy_emissions_by_pollutant`, `process_emissions_by_pollutant`, `source_ids`, and `assumption_ids`.

For the full package-specific conventions and caveats, start with `aus_phase1_sector_state_library/README.md`.

## Current Limits

- The app is intentionally standalone and browser-based; it is not a backend solve service.
- The app currently expects the checked-in `aus_phase1_sector_state_library/` folder and imports it directly.
- The Scenario page supports packaged/reference and imported JSON workflows well, but does not yet expose every scenario authoring capability directly in the UI.
- Compare mode is explanatory and heuristic.
- The root repo does not currently define shared scripts; app commands live under `web/package.json`.

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
    └── test/
```

## Further Reading

- `aus_phase1_sector_state_library/README.md` — package-specific methods and caveats.
- `docs/prd/phase1_sector_state_explorer_prd_v02.md` — product and technical specification for the explorer.
- `web/public/app_config/` — app-owned scenario metadata and defaults.
- `web/src/` — application code for loading, solving, comparison, and trust views.
