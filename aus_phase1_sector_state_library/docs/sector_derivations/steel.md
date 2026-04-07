# Steel derivation

## Output definition

- output: `crude_steel`
- unit: `t_crude_steel`

Crude steel was chosen rather than finished product categories because it is the cleanest process-chain anchor for reduced-form route comparison.

## State family used

1. conventional BF-BOF
2. CCS-influenced BF-BOF
3. scrap EAF
4. hydrogen DRI-electric route

## Why this small set is defensible

This state family captures the main route classes relevant to Australian steel decarbonisation:

- incumbent coal-based primary steel,
- a transitional capture-enabled primary route,
- the best-established low-emissions recycled route,
- and a representative near-zero primary steel route.

That is enough for Phase 1 to include one major hard-to-abate process chain while keeping the library compact.

## Evidence used

Main source IDs:

- `S022`, `S023` for Australian route-transition context
- `S024` for international route intensity and cost relations
- `S033` for indicative current Australian production scale
- `S032` for combustion-factor support

## Why this sector remains low-confidence

Australian plant-level process data are not assembled here. The route states are therefore **archetypes**.

The most uncertain quantities are:

- feasible route shares,
- H2-DRI route cost and electricity intensity,
- CCS route cost and capture/storage chain treatment,
- scrap supply constraint.

## Key modelling choice

The hydrogen state deliberately aggregates more than one near-zero primary route family (`A015`). This keeps the Phase 1 state set compact while still preserving a representative hydrogen/electric route.

## Expandability

Steel is the clearest industrial candidate for explicit process-chain expansion in Phase 2:

- coke / sinter / blast furnace / BOF chain
- scrap EAF chain
- DRI shaft furnace + EAF chain
- DRI + electric smelter / finishing chain
- capture, compression and storage modules
- ore grade and scrap availability constraints
