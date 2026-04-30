# Generate cement kiln heat

## What the role represents

This child role is activated by `make_cement_equivalent__clinker_decomposition` and covers generate host-specific kiln heat for decomposed clinker production.

## Method inventory

- `cement__kiln_heat__mixed_fossil` - Mixed fossil kiln heat
- `cement__kiln_heat__alt_fuels` - Alternative-fuels kiln heat
- `cement__kiln_heat__hydrogen_electric` - Hydrogen and electric kiln heat

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Decomposition boundary

The child inherits activity from `make_cement_equivalent` when the cement decomposition representation is selected. Parent aggregate pathway methods are inactive in that structure. Boundary ownership follows `validation/cement_decomposition_boundary.csv`.
