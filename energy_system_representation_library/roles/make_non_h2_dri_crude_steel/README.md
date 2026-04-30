# Make non-H2 DRI crude steel

## What the role represents

This child role preserves aggregate crude-steel coverage for conventional BF-BOF, scrap EAF, and CCS-influenced BF-BOF routes when `make_crude_steel` is represented by the H2 DRI decomposition. It exists so the pilot can make only the H2 DRI branch granular without losing the rest of crude-steel output.

## Method inventory

- `steel__crude_steel_non_h2__bf_bof_conventional` - conventional BF-BOF steel
- `steel__crude_steel_non_h2__scrap_eaf` - scrap EAF steel
- `steel__crude_steel_non_h2__bf_bof_ccs_transition` - CCS-influenced BF-BOF steel

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Decomposition role

This role is activated by `make_crude_steel__h2_dri_decomposition` beside `make_direct_reduced_iron` and `melt_and_refine_dri_into_crude_steel`. It should not be active at the same time as the parent aggregate pathway bundle.
