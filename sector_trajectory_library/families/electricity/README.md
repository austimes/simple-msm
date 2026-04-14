# electricity

## What the family represents

This family covers `electricity` in sector `electricity_supply` / subsector `grid_supply` for region `AUS`. The canonical output role is `endogenous_supply_commodity`, with output measured in `MWh`. - **Output**: `electricity`
- **Unit**: `MWh`
- **Region in Phase 1**: `AUS`

## Output/service definition

- Family id: `electricity`
- Output/service name: `electricity`
- Output unit: `MWh`
- Output quantity basis: One MWh of delivered grid electricity at national-average reduced-form system boundary.
- Default incumbent state id: `electricity__grid_supply__incumbent_thermal_mix`

## State inventory

- electricity__grid_supply__deep_clean_firmed — Deep-clean firmed grid supply
- electricity__grid_supply__incumbent_thermal_mix — Incumbent thermal-heavy grid mix
- electricity__grid_supply__policy_frontier — Policy frontier grid supply

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — see `shared/source_ledger.csv`
- `S003` — see `shared/source_ledger.csv`
- `S006` — see `shared/source_ledger.csv`
- `S007` — see `shared/source_ledger.csv`
- `S008` — see `shared/source_ledger.csv`
- `S009` — see `shared/source_ledger.csv`
- `S010` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`

## Main assumptions used

- `A001` — see `shared/assumptions_ledger.csv`
- `A002` — see `shared/assumptions_ledger.csv`
- `A011` — see `shared/assumptions_ledger.csv`
- `A012` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

The Phase 1 package keeps 3 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- 2025 electricity intensity nudged to the official benchmark average so that default incumbent generation activity reproduces the national 2025 electricity emissions total.
- Electricity-sector coal and gas inputs are generation fuels, not end-use final energy. Use baseline_electricity_balance.csv for generation-output closure and baseline_commodity_balance.csv for final electricity closure.
- 2030 cost anchored to CSIRO GenCost whole-system estimate (~A$91/MWh incl. transmission) and 2050 deep-clean emissions intensity consistent with CSIRO benchmark range.
- Intended as the declining incumbent benchmark. In Phase 1 this is a national average, not a state-specific dispatch profile.
- Represents an efficient but more conservatively firmed near-zero electricity state. Useful as a sensitivity state when the model values residual emissions reduction more highly than system cost.

## Expansion path

- Split into state/NEM region supply curves, renewable classes, storage classes, and explicit thermal backup processes.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
