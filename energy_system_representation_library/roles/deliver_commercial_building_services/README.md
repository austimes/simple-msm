# Deliver commercial building services

## What the role represents

This role covers `commercial_building_services` in sector `buildings` / subsector `commercial` for region `AUS`. The canonical balance type is `service_demand`, with output measured in `GJ_service_eq`. Buildings are represented as **aggregate service bundles** rather than explicit end-use processes.

## Role definition

- Role id: `deliver_commercial_building_services`
- Balance type: `service_demand`
- Output unit: `GJ_service_eq`
- Output quantity basis: Baseline-normalised building service bundle. One unit approximates the useful service delivered by one GJ of incumbent 2025 final-energy use in this subsector.
- Default incumbent method id: `buildings__commercial__incumbent_mixed_fuels`

## Method inventory

- buildings__commercial__deep_electric — Deep electrification and efficiency commercial services
- buildings__commercial__electrified_efficiency — Electrified efficient commercial services
- buildings__commercial__incumbent_mixed_fuels — Incumbent mixed-fuel commercial services

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — see `shared/source_ledger.csv`
- `S002` — see `shared/source_ledger.csv`
- `S018` — see `shared/source_ledger.csv`
- `S019` — see `shared/source_ledger.csv`
- `S020` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A004` — see `shared/assumptions_ledger.csv`
- `A005` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current method set is sufficient

The Phase 1 package keeps 3 method ids for this role so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The method option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this role internally consistent.

## Known caveats

- Baseline coefficients reproduce official commercial final-energy fuel shares in 2023–24 when service demand equals 314.2 PJ_service_eq.
- Captures a pragmatic commercial electrification pathway without requiring full end-use disaggregation in Phase 1.
- The most aggressive near-zero-direct-emissions commercial service method in Phase 1.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-buildings-efficiency-research.md`.
- `autonomous_efficiency_tracks.csv` now authors `buildings__commercial__background_standards_drift` for `buildings__commercial__incumbent_mixed_fuels` and `buildings__commercial__electrified_efficiency` only.
- `efficiency_packages.csv` now authors `buildings__commercial__lighting_retrofit` and `buildings__commercial__hvac_tuning_bms`, with both packages sharing the same role-local non-stacking group.
- The applicable commercial method rows are rebaselined so the autonomous standards drift is explicit rather than hidden in `method_years.csv`.
- Major HVAC electrification, gas-boiler replacement, and the broader electrified service bundle remain embodied in `buildings__commercial__electrified_efficiency` and `buildings__commercial__deep_electric` rather than becoming portable packages.

## Expansion path

- Split into space conditioning, water heating, cooking and appliances, with new-build versus retrofit variants.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
