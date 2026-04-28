# Produce crude steel

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 5700000.0
- Unit: `t_crude_steel`
- Anchor status: `synthetic_inherited`
- Default incumbent method id: `steel__crude_steel__bf_bof_conventional`
- Source role: Phase 1 reference scenario v0.2
- Coverage note: Inherited crude steel output anchor from the Phase 1 calibration build.

## What must reconcile at incumbent/default settings

- The default incumbent method for this role must exist in `method_years.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this role in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the role rows must remain visible in the generated validation summary.

## Representation checks

- `produce_crude_steel__pathway_bundle` must remain the default aggregate representation.
- `produce_crude_steel__h2_dri_decomposition` must remain a non-default `role_decomposition` representation with no direct methods on the parent role.
- The decomposition must activate `produce_crude_steel_non_h2_dri_residual`, `produce_direct_reduced_iron`, and `melt_refine_dri_crude_steel` as required child roles.
- The child roles must carry complete milestone-year method data so crude-steel coverage is preserved when the decomposition is selected.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after residual role closure unless explicitly documented otherwise.

## Known deviations

- For 2025 benchmark commodity closure, BF-BOF coal is mapped 40% to final-energy coal and 60% to process_reductant_coal. Gross model input demand still retains 100% of the coal input for pricing and process representation.
- Best-supported low-emissions steel method in Phase 1, but scrap availability limits its maximum national share.
- Included because CCS remains a plausible transitional primary steel option, but Australian evidence is sparse and route economics are highly project-specific.
- Route intensity is consistent with conventional primary steel benchmarks rather than a plant-specific Australian reconciliation.
- This is the main Australian near-zero primary-steel sensitivity method. Costs are especially sensitive to hydrogen and power price assumptions.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: true.
- `would_expand_to_process_chain` values across the role: true.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `steel__crude_steel__bf_bof_background_drift`.
- The crude-steel autonomous track must apply only to `steel__crude_steel__bf_bof_conventional` and `steel__crude_steel__bf_bof_ccs_transition`.
- `efficiency_packages.csv` must contain one row per milestone year for `steel__crude_steel__bf_bof_bof_gas_recovery`, `steel__crude_steel__scrap_eaf_scrap_preheating`, and `steel__crude_steel__advanced_process_control`.
- `steel__crude_steel__bf_bof_bof_gas_recovery` must apply only to the two BF-BOF methods.
- `steel__crude_steel__scrap_eaf_scrap_preheating` must apply only to `steel__crude_steel__scrap_eaf`.
- No accepted steel package should alter `iron_ore`, `scrap_steel`, `hydrogen`, or `capture_service`, and no accepted steel package should apply to `steel__crude_steel__h2_dri_electric` in v1.
- All accepted steel packages must share the same non-stacking group until richer interaction handling exists.
