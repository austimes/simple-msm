# Supply grid electricity

## What the role represents

This role covers delivered grid `electricity` in reporting sector `electricity_supply` / subsector `grid_supply` for region `AUS`. The canonical balance type is `commodity_supply`, with output measured in `MWh`.

- **Output**: `electricity`
- **Unit**: `MWh`
- **Region in Phase 1**: `AUS`

## Role definition

- Role id: `supply_grid_electricity`
- Balance type: `commodity_supply`
- Output unit: `MWh`
- Output quantity basis: One MWh of delivered grid electricity at national-average reduced-form system boundary.
- Default incumbent method id: `electricity__grid_supply__incumbent_thermal_mix`

## Method inventory

- electricity__grid_supply__deep_clean_firmed — Deep-clean firmed grid supply
- electricity__grid_supply__incumbent_thermal_mix — Incumbent thermal-heavy grid mix
- electricity__grid_supply__policy_frontier — Policy frontier grid supply

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

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

## Why the current method set is sufficient

The Phase 1 package keeps 3 method ids for this role so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The method option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this role internally consistent.

## Known caveats

- 2025 electricity intensity nudged to the official benchmark average so that default incumbent generation activity reproduces the national 2025 electricity emissions total.
- Electricity-sector coal and gas inputs are generation fuels, not end-use final energy. Use baseline_electricity_balance.csv for generation-output closure and baseline_commodity_balance.csv for final electricity closure.
- 2030 cost anchored to CSIRO GenCost whole-system estimate (~A$91/MWh incl. transmission) and 2050 deep-clean emissions intensity consistent with CSIRO benchmark range.
- Intended as the declining incumbent benchmark. In Phase 1 this is a national average, not a method-specific dispatch profile.
- Represents an efficient but more conservatively firmed near-zero electricity method. Useful as a sensitivity method when the model values residual emissions reduction more highly than system cost.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-agriculture-electricity-efficiency-research.md`.
- `efficiency_packages.csv` now authors `electricity__grid_supply__thermal_auxiliary_load_tuning` on `electricity__grid_supply__incumbent_thermal_mix` only.
- No autonomous electricity efficiency track is authored in v1. Network losses, transmission buildout, and broader supply-pathway change remain outside the current role-local efficiency path.
- The accepted package is intentionally a low-single-digit operational wedge on incumbent thermal generation fuel use. It is not a proxy for generation-mix change or transmission expansion.

## Expansion path

- Split into method/NEM region supply curves, renewable classes, storage classes, and explicit thermal backup processes.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
