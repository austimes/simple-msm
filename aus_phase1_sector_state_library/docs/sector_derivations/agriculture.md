# Agriculture derivation

## Output definition

Agriculture is represented using two coarse output bundles:

1. livestock output bundle
2. cropping and horticulture output bundle

Output unit: `A$m_output_2024`

## Why this representation was used

Agriculture is too important to omit entirely, but a full process-rich agricultural representation would exceed Phase 1 scope.

The bundle approach preserves:

- coarse liquid-fuel and electricity demand,
- major direct and non-CO2 emissions,
- and at least one aggregate mitigation wedge

while being explicit that this is not yet a commodity-rich agricultural model.

## Evidence used

Main source IDs:

- `S001`, `S002` for official agriculture energy totals and fuel splits
- `S006` for official agriculture emissions total
- `S027`, `S028`, `S029` for ABS output-value anchors

## How the bundle coefficients were built

The two agricultural bundles were sized using ABS output values.

Official agriculture energy and emissions totals were then allocated across the bundles using explicit assumptions (`A018`). This allowed the baseline conventional states to reproduce the national agriculture totals almost exactly.

## Why the cost field is weak

The agriculture `output_cost_per_unit` field is not a full production cost. It is a **placeholder incremental non-energy supply/abatement cost** (`A019`).

That is the weakest cost field in the whole package and should be treated accordingly.

## What is captured and not captured

Captured in Phase 1:

- coarse farm energy use,
- direct process emissions at bundle level,
- simple mitigation wedge placeholders.

Not captured well:

- commodity detail,
- land competition,
- herd dynamics,
- fertiliser and soil process detail,
- separate methane and nitrous oxide process modules,
- regional and climate heterogeneity.

## Expandability

Agriculture should eventually expand into:

- cattle, sheep, dairy and other livestock categories
- broadacre crops and horticulture
- fertiliser and soils
- manure management
- land competition and sequestration interactions
