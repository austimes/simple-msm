# Make cement equivalent

## What the role represents

This role covers `cement_equivalent` in sector `cement_clinker` / subsector `cement_equivalent` for region `AUS`. The canonical balance type is `service_demand`, with output measured in `t_cement_equivalent`. - output: `cement_equivalent`
- unit: `t_cement_equivalent`

## Role definition

- Role id: `make_cement_equivalent`
- Balance type: `service_demand`
- Output unit: `t_cement_equivalent`
- Output quantity basis: One tonne of cement-equivalent product at plant gate, represented on a blended cement basis rather than pure clinker.
- Default incumbent method id: `cement_clinker__cement_equivalent__conventional`

## Method inventory

- cement_clinker__cement_equivalent__ccs_deep — Deep-abatement cement with CCS
- cement_clinker__cement_equivalent__conventional — Incumbent cement with current clinker ratio
- cement_clinker__cement_equivalent__low_clinker_alt_fuels — Low-clinker and alternative-fuels cement

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S025` — see `shared/source_ledger.csv`
- `S026` — see `shared/source_ledger.csv`
- `S030` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A009` — see `shared/assumptions_ledger.csv`
- `A010` — see `shared/assumptions_ledger.csv`
- `A016` — see `shared/assumptions_ledger.csv`
- `A017` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current method set is sufficient

The Phase 1 package keeps 3 method ids for this role so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The method option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this role internally consistent.

## Aggregate Representation Boundary

`make_cement_equivalent__pathway_bundle` is the default direct pathway representation for cement-equivalent output. While it is selected, each method owns the integrated cement plant boundary: clinker kiln heat and fuels, grinding electricity, clinker substitution, and cement-equivalent calcination process emissions.

This aggregate representation should not also activate the high-temperature industrial heat coefficients folded into `make_other_material_products` for the same cement output. Host-specific kiln heat remains inside the cement pathway rows until the planned `make_cement_equivalent__clinker_decomposition` representation is selected.

The CCS pathway uses `capture_service` as a bundled proxy for captured cement CO2. It is not yet the decomposed capture/transport/storage chain, so downstream comparisons should treat its capture quantity as internal to the aggregate cement method.

## Known caveats

- Incumbent kiln fuel mix re-tuned in the balance-ready pack to improve 2025 commodity closure while preserving the conventional cement route.
- Balance-ready incumbent cement method. Intended for national reduced-form calibration, not plant-level replication.
- CCS is probably necessary for very low clinker-sector emissions, but the Australian cost and rollout evidence is much weaker than for clinker-factor and fuel-switch changes.
- This is the strongest non-CCS abatement method for Australian cement in Phase 1 because it is directly anchored to CIF pathway ratios and fuel-switch assumptions.

## Efficiency Artifacts

- Research note: see `docs/prd/20260420-steel-cement-efficiency-research.md`.
- `autonomous_efficiency_tracks.csv` now authors `cement__cement_equivalent__background_kiln_grinding_drift` on the conventional and low-clinker methods only.
- `efficiency_packages.csv` now authors `cement__cement_equivalent__grinding_system_upgrade` and `cement__cement_equivalent__kiln_ai_process_optimisation`, sharing the same cement non-stacking group.
- Portable cement efficiency remains intentionally narrow: grinding efficiency and operational kiln/process optimisation only.
- Clinker-factor reduction, alternative-fuel substitution, and CCS remain embodied in the pathway methods rather than being relabeled as portable efficiency packages.

## Expansion path

- Split to clinker kiln, SCM supply, cement grinding and CCS modules, with explicit clinker-to-cement material balances.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
