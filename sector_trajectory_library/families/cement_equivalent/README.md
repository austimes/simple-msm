# cement_equivalent

## What the family represents

This family covers `cement_equivalent` in sector `cement_clinker` / subsector `cement_equivalent` for region `AUS`. The canonical output role is `required_service`, with output measured in `t_cement_equivalent`. - output: `cement_equivalent`
- unit: `t_cement_equivalent`

## Output/service definition

- Family id: `cement_equivalent`
- Output/service name: `cement_equivalent`
- Output unit: `t_cement_equivalent`
- Output quantity basis: One tonne of cement-equivalent product at plant gate, represented on a blended cement basis rather than pure clinker.
- Default incumbent state id: `cement_clinker__cement_equivalent__conventional`

## State inventory

- cement_clinker__cement_equivalent__ccs_deep — Deep-abatement cement with CCS
- cement_clinker__cement_equivalent__conventional — Incumbent cement with current clinker ratio
- cement_clinker__cement_equivalent__low_clinker_alt_fuels — Low-clinker and alternative-fuels cement

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

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

## Why the current state set is sufficient

The Phase 1 package keeps 3 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- Incumbent kiln fuel mix re-tuned in the balance-ready pack to improve 2025 commodity closure while preserving the conventional cement route.
- Balance-ready incumbent cement state. Intended for national reduced-form calibration, not plant-level replication.
- CCS is probably necessary for very low clinker-sector emissions, but the Australian cost and rollout evidence is much weaker than for clinker-factor and fuel-switch changes.
- This is the strongest non-CCS abatement state for Australian cement in Phase 1 because it is directly anchored to CIF pathway ratios and fuel-switch assumptions.

## Expansion path

- Split to clinker kiln, SCM supply, cement grinding and CCS modules, with explicit clinker-to-cement material balances.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
