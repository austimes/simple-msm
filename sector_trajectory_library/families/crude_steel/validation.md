# crude_steel validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 5700000.0
- Unit: `t_crude_steel`
- Anchor status: `synthetic_inherited`
- Default incumbent state id: `steel__crude_steel__bf_bof_conventional`
- Source family: Phase 1 reference scenario v0.2
- Coverage note: Inherited crude steel output anchor from the Phase 1 calibration build.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- For 2025 benchmark commodity closure, BF-BOF coal is mapped 40% to final-energy coal and 60% to process_reductant_coal. Gross model input demand still retains 100% of the coal input for pricing and process representation.
- Best-supported low-emissions steel state in Phase 1, but scrap availability limits its maximum national share.
- Included because CCS remains a plausible transitional primary steel option, but Australian evidence is sparse and route economics are highly project-specific.
- Route intensity is consistent with conventional primary steel benchmarks rather than a plant-specific Australian reconciliation.
- This is the main Australian near-zero primary-steel sensitivity state. Costs are especially sensitive to hydrogen and power price assumptions.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: true.
- `would_expand_to_process_chain?` values across the family: true.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `steel__crude_steel__bf_bof_background_drift`.
- The crude-steel autonomous track must apply only to `steel__crude_steel__bf_bof_conventional` and `steel__crude_steel__bf_bof_ccs_transition`.
- `efficiency_packages.csv` must contain one row per milestone year for `steel__crude_steel__bf_bof_bof_gas_recovery`, `steel__crude_steel__scrap_eaf_scrap_preheating`, and `steel__crude_steel__advanced_process_control`.
- `steel__crude_steel__bf_bof_bof_gas_recovery` must apply only to the two BF-BOF states.
- `steel__crude_steel__scrap_eaf_scrap_preheating` must apply only to `steel__crude_steel__scrap_eaf`.
- No accepted steel package should alter `iron_ore`, `scrap_steel`, `hydrogen`, or `capture_service`, and no accepted steel package should apply to `steel__crude_steel__h2_dri_electric` in v1.
- All accepted steel packages must share the same non-stacking group until richer interaction handling exists.
