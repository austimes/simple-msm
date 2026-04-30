# Grind and blend cement equivalent

## What the role represents

This child role is activated by `make_cement_equivalent__clinker_decomposition` and covers grind clinker and blend supplementary materials into cement-equivalent output.

## Method inventory

- `cement__finish__ordinary_blend` - Ordinary cement blend
- `cement__finish__low_clinker_scm_blend` - Low-clinker SCM blend

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Decomposition boundary

The child inherits activity from `make_cement_equivalent` when the cement decomposition representation is selected. Parent aggregate pathway methods are inactive in that structure. Boundary ownership follows `validation/cement_decomposition_boundary.csv`.
