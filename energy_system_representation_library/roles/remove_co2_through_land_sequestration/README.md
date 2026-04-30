# Remove CO2 through land sequestration

## What the role represents

This role covers `land_sequestration` in sector `removals_negative_emissions` / subsector `land_sequestration` for region `AUS`. The canonical balance type is `carbon_removal`, with output measured in `tCO2_removed`. - biological land sequestration
- engineered removals (DACCS)

## Role definition

- Role id: `remove_co2_through_land_sequestration`
- Balance type: `carbon_removal`
- Output unit: `tCO2_removed`
- Output quantity basis: One tonne of CO2-equivalent durably removed from the atmosphere at the reduced-form sector boundary.
- Default incumbent method id: `removals_negative_emissions__land_sequestration__biological_sink`

## Method inventory

- removals_negative_emissions__land_sequestration__biological_sink — Biological land sequestration

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S007` — see `shared/source_ledger.csv`
- `S030` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A020` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current method set is sufficient

The Phase 1 package keeps 1 method ids for this role so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The method option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this role internally consistent.

## Known caveats

- Retained as an exploratory land-removal supply method, not as a complete land-use model.

## Expansion path

- Land-use competition, permanence, reversal risk and MRV modules for biological sinks; explicit DAC process chain and storage network for DACCS.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
