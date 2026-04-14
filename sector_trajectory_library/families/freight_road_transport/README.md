# freight_road_transport

## What the family represents

This family covers `freight_road_transport` in sector `road_transport` / subsector `freight_road` for region `AUS`. The canonical output role is `required_service`, with output measured in `tkm`. Road transport is split into:

## Output/service definition

- Family id: `freight_road_transport`
- Output/service name: `freight_road_transport`
- Output unit: `tkm`
- Output quantity basis: One tkm of delivered road transport service at national-average reduced-form boundary.
- Default incumbent state id: `road_transport__freight_road__diesel`

## State inventory

- road_transport__freight_road__bev — Battery-electric road freight
- road_transport__freight_road__diesel — Diesel road freight
- road_transport__freight_road__efficient_diesel — Efficient diesel road freight
- road_transport__freight_road__fcev_h2 — Hydrogen fuel-cell road freight

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — see `shared/source_ledger.csv`
- `S013` — see `shared/source_ledger.csv`
- `S016` — see `shared/source_ledger.csv`
- `S017` — see `shared/source_ledger.csv`
- `S020` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A008` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

The Phase 1 package keeps 4 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- 2025 coefficient reproduces roughly 36 MtCO2e road-freight emissions when combined with BITRE road tonne-km.
- Coefficient is a nationalised average across heterogeneous freight tasks; should be refined with payload class splits in Phase 2.
- Transitional state capturing the abatement that can be obtained without full drivetrain switch.
- Useful as a freight sensitivity state where battery range or charging-infrastructure limits bind.

## Expansion path

- Split by light-duty passenger, buses, vans/light commercial, medium trucks and heavy articulated trucks, with explicit stock rollover.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
