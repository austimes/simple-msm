# crude_steel

## What the family represents

This family covers `crude_steel` in sector `steel` / subsector `crude_steel` for region `AUS`. The canonical output role is `required_service`, with output measured in `t_crude_steel`. - output: `crude_steel`
- unit: `t_crude_steel`

## Output/service definition

- Family id: `crude_steel`
- Output/service name: `crude_steel`
- Output unit: `t_crude_steel`
- Output quantity basis: One tonne of crude steel at plant gate, reduced-form national average route archetype.
- Default incumbent state id: `steel__crude_steel__bf_bof_conventional`

## State inventory

- steel__crude_steel__bf_bof_ccs_transition — CCS-influenced BF-BOF steel
- steel__crude_steel__bf_bof_conventional — Conventional BF-BOF steel
- steel__crude_steel__h2_dri_electric — Hydrogen DRI-electric steel
- steel__crude_steel__scrap_eaf — Scrap EAF steel

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S009` — see `shared/source_ledger.csv`
- `S022` — see `shared/source_ledger.csv`
- `S023` — see `shared/source_ledger.csv`
- `S024` — see `shared/source_ledger.csv`
- `S030` — see `shared/source_ledger.csv`
- `S032` — see `shared/source_ledger.csv`
- `S033` — see `shared/source_ledger.csv`

## Main assumptions used

- `A002` — see `shared/assumptions_ledger.csv`
- `A003` — see `shared/assumptions_ledger.csv`
- `A009` — see `shared/assumptions_ledger.csv`
- `A014` — see `shared/assumptions_ledger.csv`
- `A015` — see `shared/assumptions_ledger.csv`
- `A022` — see `shared/assumptions_ledger.csv`
- `A023` — see `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

The Phase 1 package keeps 4 state ids for this family so the explorer and solver can distinguish the incumbent baseline from the main transition options without expanding straight to a process-chain model. The state option metadata carries standardized ordering, default-incumbent selection, and pathway codes so downstream tooling can keep this family internally consistent.

## Known caveats

- For 2025 benchmark commodity closure, BF-BOF coal is mapped 40% to final-energy coal and 60% to process_reductant_coal. Gross model input demand still retains 100% of the coal input for pricing and process representation.
- Best-supported low-emissions steel state in Phase 1, but scrap availability limits its maximum national share.
- Included because CCS remains a plausible transitional primary steel option, but Australian evidence is sparse and route economics are highly project-specific.
- Route intensity is consistent with conventional primary steel benchmarks rather than a plant-specific Australian reconciliation.
- This is the main Australian near-zero primary-steel sensitivity state. Costs are especially sensitive to hydrogen and power price assumptions.

## Expansion path

- Split into explicit BF-coke sinter-hot metal-BOF chain; scrap-EAF chain; DRI shaft furnace + EAF or electric smelter chain; capture, compression and storage modules.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
