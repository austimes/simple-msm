# residential_building_services

## What the family represents

This family covers `residential_building_services` in sector `buildings` / subsector `residential` for region `AUS`. The canonical output role is `required_service`, with output measured in `GJ_service_eq`. Buildings are represented as **aggregate service bundles** rather than explicit end-use processes.

## Output/service definition

- Family id: `residential_building_services`
- Output/service name: `residential_building_services`
- Output unit: `GJ_service_eq`
- Output quantity basis: Baseline-normalised building service bundle. One unit approximates the useful service delivered by one GJ of incumbent 2025 final-energy use in this subsector.
- Default incumbent state id: `buildings__residential__incumbent_mixed_fuels`

## State inventory

- buildings__residential__deep_electric — Deep-electric residential services
- buildings__residential__electrified_efficiency — Electrified efficient residential services
- buildings__residential__incumbent_mixed_fuels — Incumbent mixed-fuel residential services

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

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

## Why the current state set is sufficient

The Phase 1 package keeps 3 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- Baseline fuel shares reproduce official residential final-energy mix in 2023–24 when combined with service demand equal to 477.8 PJ_service_eq.
- Energy intensity falls because the state represents a more efficient service package; direct on-site emissions collapse as gas exits.
- Represents the high-electrification/efficiency end of the residential service frontier. Useful as the near-zero direct-emissions building state.

## Draft Efficiency Extension Guidance

- Research note: see `docs/prd/20260420-buildings-efficiency-research.md`.
- The current family boundary supports one portable v1 pure-efficiency candidate: a thermal-shell retrofit bundle covering insulation, draught sealing and window / glazing upgrades.
- Heat-pump space heating, heat-pump hot water, induction cooking and wider electrified service-bundle effects should remain embodied in `buildings__residential__electrified_efficiency` and `buildings__residential__deep_electric` rather than becoming portable packages.
- Any future explicit autonomous track should be treated as background standards / turnover drift and must be authored carefully to avoid double counting against the existing year-varying state coefficients.

## Expansion path

- Split into space conditioning, water heating, cooking and appliances, with new-build versus retrofit variants.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
