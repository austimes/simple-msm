# Grow crops and horticulture output

## What the role represents

This role covers `cropping_horticulture_output_bundle` in sector `agriculture` / subsector `cropping_horticulture` for region `AUS`. The canonical balance type is `service_demand`, with output measured in `A$m_output_2024`. Agriculture is represented using two coarse output bundles:

## Role definition

- Role id: `grow_crops_and_horticulture_output`
- Balance type: `service_demand`
- Output unit: `A$m_output_2024`
- Output quantity basis: One million 2024 Australian dollars of farm-gate output in the named coarse agricultural bundle.
- Default incumbent method id: `agriculture__cropping_horticulture__conventional`

## Method inventory

- agriculture__cropping_horticulture__conventional — Conventional cropping and horticulture bundle
- agriculture__cropping_horticulture__mitigated — Mitigated cropping and horticulture bundle

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — see `shared/source_ledger.csv`
- `S002` — see `shared/source_ledger.csv`
- `S006` — see `shared/source_ledger.csv`
- `S028` — see `shared/source_ledger.csv`
- `S029` — see `shared/source_ledger.csv`
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

- Another coarse residual sector block. Useful for whole-economy emissions and liquid-fuels demand, but not robust for commodity-level agricultural supply analysis.
- Exploratory mitigation method. Best interpreted as a coarse abatement wedge placeholder.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-agriculture-electricity-efficiency-research.md`.
- This role is an explicit `no_material_v1` case in the canonical efficiency inventory.
- Do not author `autonomous_efficiency_tracks.csv` or `efficiency_packages.csv` rows for this role in v1.
- The limited direct-energy improvement that exists today remains bundled into `agriculture__cropping_horticulture__mitigated` until the role is split into narrower agricultural roles.

## Expansion path

- Split into cattle, sheep, dairy, broadacre crops, horticulture, fertiliser and manure management submodules.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
