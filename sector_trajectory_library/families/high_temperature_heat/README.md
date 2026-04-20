# high_temperature_heat

## What the family represents

This family covers `high_temperature_heat` in sector `generic_industrial_heat` / subsector `high_temperature_heat` for region `AUS`. The canonical output role is `required_service`, with output measured in `GJ_useful_heat`. Generic industrial heat is split into three useful-heat service bands:

## Output/service definition

- Family id: `high_temperature_heat`
- Output/service name: `high_temperature_heat`
- Output unit: `GJ_useful_heat`
- Output quantity basis: One GJ of useful industrial heat delivered within the specified temperature band.
- Default incumbent state id: `generic_industrial_heat__high_temperature_heat__fossil`

## State inventory

- generic_industrial_heat__high_temperature_heat__electrified — High-temperature electrified heat
- generic_industrial_heat__high_temperature_heat__fossil — High-temperature incumbent mixed-fuel heat
- generic_industrial_heat__high_temperature_heat__low_carbon_fuels — High-temperature low-carbon fuels

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S002` — see `shared/source_ledger.csv`
- `S021` — see `shared/source_ledger.csv`
- `S030` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A009` — see `shared/assumptions_ledger.csv`
- `A010` — see `shared/assumptions_ledger.csv`
- `A013` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

The Phase 1 package keeps 3 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- Fuel mix re-tuned in the balance-ready pack to reduce 2025 coal overstatement and improve national commodity closure. Treat as a calibration-oriented incumbent rather than a literal subsector average.
- Balance-ready incumbent. Use as a calibration-oriented national average, not a plant-specific archetype.
- Retained because hydrogen is often treated as a candidate for the hardest high-temperature heat niches.
- Useful sensitivity state, but evidence for aggregate national high-temperature electrification remains thin.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-industrial-heat-efficiency-research.md`.
- `autonomous_efficiency_tracks.csv` now authors `industrial_heat__high_temperature__background_thermal_drift` for the fossil incumbent state only.
- `efficiency_packages.csv` now authors `industrial_heat__high_temperature__combustion_heat_recovery` and `industrial_heat__high_temperature__controls_tuning`, sharing the same family-local non-stacking group.
- The fossil incumbent row is rebaselined so the explicit background drift is visible rather than hidden in the state table.
- Only a deliberately small combustion-side package is accepted at the current family boundary; broader savings need future subsector-specific modelling.
- Electrified and low-carbon-fuel states remain free of portable packages in v1 so route-change states stay clean.

## Expansion path

- Replace with subsector/process-specific service or process states (e.g., food boilers, alumina calciners, chemical steam, minerals kilns).

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
