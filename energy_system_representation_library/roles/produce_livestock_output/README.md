# Produce livestock output

## What the role represents

This role covers `livestock_output_bundle` in sector `agriculture` / subsector `livestock` for region `AUS`. The canonical balance type is `required_service`, with output measured in `A$m_output_2024`. Agriculture is represented using two coarse output bundles:

## Output/service definition

- Role id: `livestock_output_bundle`
- Output/service name: `livestock_output_bundle`
- Output unit: `A$m_output_2024`
- Output quantity basis: One million 2024 Australian dollars of farm-gate output in the named coarse agricultural bundle.
- Default incumbent method id: `agriculture__livestock__conventional`

## Method inventory

- agriculture__livestock__conventional — Conventional livestock output bundle
- agriculture__livestock__mitigated — Mitigated livestock output bundle

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

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

## Why the current method set is sufficient

The Phase 1 package keeps 2 method ids for this role so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The method option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this role internally consistent.

## Known caveats

- Highly simplified mitigation method. Use for coarse sensitivity only until a proper agricultural abatement supply model is built.
- This is a coarse residual sector block intended to preserve agriculture in national emissions accounting, not a farm-system model.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-agriculture-electricity-efficiency-research.md`.
- This role is an explicit `no_material_v1` case in the canonical efficiency inventory.
- Do not author `autonomous_efficiency_tracks.csv` or `efficiency_packages.csv` rows for this role in v1.
- The limited direct-energy improvement that exists today remains bundled into `agriculture__livestock__mitigated` until the role is split into narrower livestock subfamilies.

## Expansion path

- Split into cattle, sheep, dairy, broadacre crops, horticulture, fertiliser and manure management submodules.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
