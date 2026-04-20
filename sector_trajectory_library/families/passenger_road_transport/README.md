# passenger_road_transport

## What the family represents

This family covers `passenger_road_transport` in sector `road_transport` / subsector `passenger_road` for region `AUS`. The canonical output role is `required_service`, with output measured in `pkm`. Road transport is split into:

## Output/service definition

- Family id: `passenger_road_transport`
- Output/service name: `passenger_road_transport`
- Output unit: `pkm`
- Output quantity basis: One pkm of delivered road transport service at national-average reduced-form boundary.
- Default incumbent state id: `road_transport__passenger_road__ice_fleet`

## State inventory

- road_transport__passenger_road__bev — Battery-electric passenger road fleet
- road_transport__passenger_road__hybrid_transition — Hybrid-heavy passenger road fleet
- road_transport__passenger_road__ice_fleet — ICE-dominated passenger road fleet

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — see `shared/source_ledger.csv`
- `S012` — see `shared/source_ledger.csv`
- `S014` — see `shared/source_ledger.csv`
- `S015` — see `shared/source_ledger.csv`
- `S020` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A006` — see `shared/assumptions_ledger.csv`
- `A007` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

The Phase 1 package keeps 3 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- 2025 coefficient is chosen so that passenger-road and freight-road incumbent states jointly reproduce official road transport energy within about 0.2% when using BITRE service volumes.
- Electricity-use coefficient is a representative fleet-average service coefficient rather than a specific model-year vehicle rating.
- Useful transitional abatement state when BEV uptake is constrained or the model values liquid-fuel compatibility.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-road-transport-efficiency-research.md`.
- `autonomous_efficiency_tracks.csv` now authors `road_transport__passenger_road__background_new_vehicle_efficiency_drift` for `road_transport__passenger_road__ice_fleet` only.
- No passenger-road portable efficiency package is authored in v1. Hybrid and BEV efficiency remain embodied in the existing pathway states.
- The ICE base rows are intentionally rebaselined upward so the accepted autonomous drift is explicit rather than hidden in the incumbent row trend.

## Expansion path

- Split by light-duty passenger, buses, vans/light commercial, medium trucks and heavy articulated trucks, with explicit stock rollover.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
