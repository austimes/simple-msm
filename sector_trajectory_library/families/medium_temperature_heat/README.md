# medium_temperature_heat

## What the family represents

This family covers `medium_temperature_heat` in sector `generic_industrial_heat` / subsector `medium_temperature_heat` for region `AUS`. The canonical output role is `required_service`, with output measured in `GJ_useful_heat`. Generic industrial heat is split into three useful-heat service bands:

## Output/service definition

- Family id: `medium_temperature_heat`
- Output/service name: `medium_temperature_heat`
- Output unit: `GJ_useful_heat`
- Output quantity basis: One GJ of useful industrial heat delivered within the specified temperature band.
- Default incumbent state id: `generic_industrial_heat__medium_temperature_heat__fossil`

## State inventory

- generic_industrial_heat__medium_temperature_heat__electrified — Medium-temperature electrified heat
- generic_industrial_heat__medium_temperature_heat__fossil — Medium-temperature incumbent mixed-fuel heat
- generic_industrial_heat__medium_temperature_heat__low_carbon_fuels — Medium-temperature low-carbon fuels

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
- Fuel-switch state retained because some Australian planning studies constrain electrification by subsector.
- The achievable share remains uncertain and should be stress-tested.

## Expansion path

- Replace with subsector/process-specific service or process states (e.g., food boilers, alumina calciners, chemical steam, minerals kilns).

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
