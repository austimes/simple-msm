# Australia Phase 1 sector state library

This repository contains a first operational **Australia-specific Phase 1 sector state library** for a fast reduced-form multi-sector decarbonisation model.

It is designed to be:

- scientifically reviewable,
- traceable back to source families and explicit assumptions,
- good enough for an MVP that couples economy-wide decarbonisation pressure with the electricity sector,
- and easy to expand later into more explicit **VedaLang / TIMES** process representations.

## What is included

The Phase 1 package covers:

- electricity supply,
- buildings (residential and commercial),
- road transport (passenger and freight),
- generic industrial heat / industrial energy services,
- steel,
- cement / clinker on a cement-equivalent basis,
- coarse agriculture bundles,
- removals / negative emissions (biological and engineered, both clearly caveated).

The core machine-readable dataset contains **228 state-year rows** across the required milestone years 2025, 2030, 2035, 2040, 2045 and 2050.

### Rows by sector

| sector                      |   rows |
|:----------------------------|-------:|
| agriculture                 |     24 |
| buildings                   |     36 |
| cement_clinker              |     18 |
| electricity_supply          |     18 |
| generic_industrial_heat     |     54 |
| removals_negative_emissions |     12 |
| road_transport              |     42 |
| steel                       |     24 |

### Rows by confidence rating

| confidence_rating   |   rows |
|:--------------------|-------:|
| Exploratory         |     48 |
| High                |      6 |
| Low                 |     78 |
| Medium              |     96 |

## Directory structure

- `data/sector_states.csv` — main state library dataset
- `data/sector_states_schema.json` — JSON schema for the CSV rows
- `data/source_ledger.csv` — source ledger with authority notes
- `data/assumptions_ledger.csv` — explicit assumptions ledger
- `data/calibration_summary.csv` — baseline calibration checks
- `data/uncertainty_summary.csv` — uncertainty / confidence summary
- `data/commodity_taxonomy.csv` — Phase 1 commodity taxonomy
- `docs/methods_overview.md` — package-wide methods note
- `docs/sector_derivations/` — sector-by-sector derivation notes
- `docs/calibration_validation.md` — calibration and validation pack
- `docs/uncertainty_confidence.md` — uncertainty and confidence pack
- `docs/phase2_recommendations.md` — recommendation memo for Phase 2

## Core modelling conventions

### 1. Cost convention

`output_cost_per_unit` is defined as a **real-2024 non-commodity conversion/supply cost** unless explicitly noted otherwise.

That means the value generally **excludes** the purchase cost of explicitly modelled input commodities such as electricity, gas, coal, refined liquid fuels, hydrogen, biomass, scrap, iron ore and sequestration service. This makes the library easier to connect to a reduced-form model in which commodity prices can vary endogenously or by scenario.

The main exception is removals, where the cost is intended as a **full marginal removal supply cost** because the operational commodity inputs are only a small part of the total removal cost.

### 2. Emissions convention

For end-use sectors, `energy_emissions_by_pollutant` represents **direct on-site scope-1 emissions only**.

Electricity-related emissions are **not** included in end-use rows. They are represented in the electricity-supply states instead. This is deliberate and avoids double counting.

### 3. Array fields in the CSV

Several CSV columns are stored as **JSON-encoded arrays** for portability:

- `input_commodities`
- `input_coefficients`
- `input_units`
- `energy_emissions_by_pollutant`
- `process_emissions_by_pollutant`
- `source_ids`
- `assumption_ids`

### 4. Phase 1 boundaries

This package is **not** a facility-level model, not a transmission model, and not a complete material-balance representation of the Australian economy.

It is strongest where Australia has robust official or planning evidence at sector level. It is weakest where the sector needs process-chain detail to be represented credibly.

## Short guidance on use

For a first reduced-form national model:

1. Use the **2025 incumbent states** plus official or scenario demand/activity levels for baseline runs.
2. Add commodity price assumptions separately.
3. Use `max_share` and `max_activity` only as **soft upper envelopes** unless you have a stronger stock-turnover or rollout module.
4. Treat **generic industrial heat, agriculture mitigation, steel CCS/H2 routes, and DACCS** as sensitivity states rather than base-case anchors.
5. Read `docs/phase2_recommendations.md` before deciding what to hard-wire into a production model.

## Main Phase 1 strengths

- Electricity is strong enough for a first national reduced-form model.
- Buildings are credible at aggregate residential/commercial service-bundle level.
- Passenger road and freight road are adequate for MVP whole-economy interactions.
- Cement is one of the best-supported hard-to-abate sectors in the Phase 1 package.

## Main Phase 1 weaknesses

- Generic industrial heat is intentionally broad and should not be over-interpreted.
- Steel is useful as a representative hard-to-abate process chain, but still low-confidence.
- Agriculture is deliberately coarse and emissions-focused.
- DACCS is exploratory and should not be activated by default.

## License / provenance note

This package is a synthetic research build created from the source families listed in `data/source_ledger.csv`. It does **not** reproduce any source workbook verbatim. The intent is traceable synthesis for modelling, not republication of the source documents.
