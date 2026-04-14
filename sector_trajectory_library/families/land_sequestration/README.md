# land_sequestration

## What the family represents

This family covers `land_sequestration` in sector `removals_negative_emissions` / subsector `land_sequestration` for region `AUS`. The canonical output role is `required_service`, with output measured in `tCO2_removed`. - biological land sequestration
- engineered removals (DACCS)

## Output/service definition

- Family id: `land_sequestration`
- Output/service name: `land_sequestration`
- Output unit: `tCO2_removed`
- Output quantity basis: One tonne of CO2-equivalent durably removed from the atmosphere at the reduced-form sector boundary.
- Default incumbent state id: `removals_negative_emissions__land_sequestration__biological_sink`

## State inventory

- removals_negative_emissions__land_sequestration__biological_sink — Biological land sequestration

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S007` — see `shared/source_ledger.csv`
- `S030` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A020` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

The Phase 1 package keeps 1 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- Retained as an exploratory land-removal supply state, not as a complete land-use model.

## Expansion path

- Land-use competition, permanence, reversal risk and MRV modules for biological sinks; explicit DAC process chain and storage network for DACCS.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
