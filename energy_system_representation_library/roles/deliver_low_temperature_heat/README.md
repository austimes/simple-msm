# Deliver low temperature heat

## What the role represents

This role covers `low_temperature_heat` in sector `generic_industrial_heat` / subsector `low_temperature_heat` for region `AUS`. The canonical balance type is `required_service`, with output measured in `GJ_useful_heat`. Generic industrial heat is split into three useful-heat service bands:

## Output/service definition

- Role id: `low_temperature_heat`
- Output/service name: `low_temperature_heat`
- Output unit: `GJ_useful_heat`
- Output quantity basis: One GJ of useful industrial heat delivered within the specified temperature band.
- Default incumbent method id: `generic_industrial_heat__low_temperature_heat__fossil`

## Method inventory

- generic_industrial_heat__low_temperature_heat__electrified — Low-temperature electrified heat
- generic_industrial_heat__low_temperature_heat__fossil — Low-temperature fossil heat
- generic_industrial_heat__low_temperature_heat__low_carbon_fuels — Low-temperature low-carbon fuels

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — see `shared/source_ledger.csv`
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

- Broadly reflects the high efficiency potential of heat pumps for low-temperature process heat.
- Exploratory flexibility method for users who need a fuel-switch option where electrification is judged infeasible.
- Useful generic representation for low-temperature industrial heat; not a substitute for food, paper or chemical subsector models.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-industrial-heat-efficiency-research.md`.
- `autonomous_efficiency_tracks.csv` authors `industrial_heat__low_temperature__background_thermal_drift` for the fossil incumbent method only.
- `efficiency_packages.csv` now authors both `industrial_heat__low_temperature__thermal_system_retrofit` and `industrial_heat__low_temperature__controls_tuning`, sharing the same role-local non-stacking group.
- The fossil `method_years.csv` rows intentionally hold the de-embedded gas coefficient and direct-combustion intensity flat so the background drift travels through the explicit autonomous track instead of staying hidden in the base rows.
- Electrified and low-carbon-fuel methods remain free of portable efficiency overlays so route changes stay cleanly separated from carrier-preserving efficiency.

## Expansion path

- Replace with subsector/process-specific service or process methods (e.g., food boilers, alumina calciners, chemical steam, minerals kilns).

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
