# Melt and refine DRI crude steel

## What the role represents

This child role converts direct reduced iron into crude steel for the decomposed H2 DRI branch. It tests whether an intermediate material from one child role can be consumed by another child role while the parent crude-steel role remains an interchangeable representation choice.

## Method inventory

- `steel__dri_melt_refine__eaf_finishing` - EAF DRI finishing
- `steel__dri_melt_refine__electric_smelter` - electric smelter finishing

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Decomposition role

This role is activated by `produce_crude_steel__h2_dri_decomposition` and consumes `direct_reduced_iron` from `produce_direct_reduced_iron`. The current data is a pilot split from aggregate crude-steel route archetypes, not a plant-level engineering model.
