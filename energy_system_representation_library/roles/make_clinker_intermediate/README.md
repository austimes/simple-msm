# Make clinker intermediate

## What the role represents

This child role is activated by `make_cement_equivalent__clinker_decomposition` and covers make clinker as an intermediate material for decomposed cement-equivalent production.

## Method inventory

- `cement__clinker__conventional` - Conventional clinker
- `cement__clinker__low_carbon_calciner` - Low-carbon clinker
- `cement__clinker__ccs_ready` - CCS-ready clinker

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Decomposition boundary

The child inherits activity from `make_cement_equivalent` when the cement decomposition representation is selected. Parent aggregate pathway methods are inactive in that structure. Boundary ownership follows `validation/cement_decomposition_boundary.csv`.
