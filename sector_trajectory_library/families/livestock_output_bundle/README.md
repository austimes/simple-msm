# livestock_output_bundle

## What the family represents

This family covers `livestock_output_bundle` in sector `agriculture` / subsector `livestock` for region `AUS`. The canonical output role is `required_service`, with output measured in `A$m_output_2024`. Agriculture is represented using two coarse output bundles:

## Output/service definition

- Family id: `livestock_output_bundle`
- Output/service name: `livestock_output_bundle`
- Output unit: `A$m_output_2024`
- Output quantity basis: One million 2024 Australian dollars of farm-gate output in the named coarse agricultural bundle.
- Default incumbent state id: `agriculture__livestock__conventional`

## State inventory

- agriculture__livestock__conventional — Conventional livestock output bundle
- agriculture__livestock__mitigated — Mitigated livestock output bundle

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — see `shared/source_ledger.csv`
- `S002` — see `shared/source_ledger.csv`
- `S006` — see `shared/source_ledger.csv`
- `S027` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A018` — see `shared/assumptions_ledger.csv`
- `A019` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

The Phase 1 package keeps 2 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- Highly simplified mitigation state. Use for coarse sensitivity only until a proper agricultural abatement supply model is built.
- This is a coarse residual sector block intended to preserve agriculture in national emissions accounting, not a farm-system model.

## Expansion path

- Split into cattle, sheep, dairy, broadacre crops, horticulture, fertiliser and manure management submodules.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
