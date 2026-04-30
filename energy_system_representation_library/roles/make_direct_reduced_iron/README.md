# Make direct reduced iron

## What the role represents

This child role produces direct reduced iron as an intermediate material for the decomposed H2 DRI crude-steel branch. It tests whether the library can represent an intermediate process-chain role with interchangeable technologies.

## Method inventory

- `steel__dri__h2_shaft_furnace` - hydrogen shaft-furnace DRI
- `steel__dri__gas_shaft_furnace` - gas shaft-furnace DRI
- `steel__dri__imported_residual` - imported DRI residual

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Decomposition role

This role is activated by `make_crude_steel__h2_dri_decomposition` and supplies `direct_reduced_iron` to `melt_and_refine_dri_into_crude_steel`. The current data is a pilot split from aggregate crude-steel route archetypes, not a plant-level engineering model.
