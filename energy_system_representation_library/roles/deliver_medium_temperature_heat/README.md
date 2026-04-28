# Deliver medium temperature heat

## What the role represents

This role covers `medium_temperature_heat` in sector `generic_industrial_heat` / subsector `medium_temperature_heat` for region `AUS`. The canonical balance type is `required_service`, with output measured in `GJ_useful_heat`. Generic industrial heat is split into three useful-heat service bands:

## Output/service definition

- Role id: `medium_temperature_heat`
- Output/service name: `medium_temperature_heat`
- Output unit: `GJ_useful_heat`
- Output quantity basis: One GJ of useful industrial heat delivered within the specified temperature band.
- Default incumbent method id: `generic_industrial_heat__medium_temperature_heat__fossil`

## Method inventory

- generic_industrial_heat__medium_temperature_heat__electrified — Medium-temperature electrified heat
- generic_industrial_heat__medium_temperature_heat__fossil — Medium-temperature incumbent mixed-fuel heat
- generic_industrial_heat__medium_temperature_heat__low_carbon_fuels — Medium-temperature low-carbon fuels

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

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

## Why the current method set is sufficient

The Phase 1 package keeps 3 method ids for this role so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The method option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this role internally consistent.

## Known caveats

- Fuel mix re-tuned in the balance-ready pack to reduce 2025 coal overstatement and improve national commodity closure. Treat as a calibration-oriented incumbent rather than a literal subsector average.
- Balance-ready incumbent. Use as a calibration-oriented national average, not a plant-specific archetype.
- Fuel-switch method retained because some Australian planning studies constrain electrification by subsector.
- The achievable share remains uncertain and should be stress-tested.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-industrial-heat-efficiency-research.md`.
- `autonomous_efficiency_tracks.csv` now authors `industrial_heat__medium_temperature__background_thermal_drift` for the fossil incumbent method only.
- `efficiency_packages.csv` now authors `industrial_heat__medium_temperature__thermal_system_retrofit` and `industrial_heat__medium_temperature__controls_tuning`, sharing the same role-local non-stacking group.
- The fossil incumbent row is rebaselined so the explicit background drift is visible as an autonomous track rather than implied inside the method table.
- Electrified and low-carbon-fuel methods remain free of portable packages in v1 so route-change methods stay conceptually clean.

## Expansion path

- Replace with subsector/process-specific service or process methods (e.g., food boilers, alumina calciners, chemical steam, minerals kilns).

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
