# commercial_building_services validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 314000000.0
- Unit: `GJ_service_eq`
- Anchor status: `official_direct`
- Default incumbent state id: `buildings__commercial__incumbent_mixed_fuels`
- Source family: Australian Energy Update 2025 Table 5 / Table 11
- Coverage note: Aligned to 2023–24 commercial final energy use as the incumbent service-demand anchor.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Baseline coefficients reproduce official commercial final-energy fuel shares in 2023–24 when service demand equals 314.2 PJ_service_eq.
- Captures a pragmatic commercial electrification pathway without requiring full end-use disaggregation in Phase 1.
- The most aggressive near-zero-direct-emissions commercial service state in Phase 1.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `buildings__commercial__background_standards_drift`.
- `buildings__commercial__background_standards_drift` must apply only to `buildings__commercial__incumbent_mixed_fuels` and `buildings__commercial__electrified_efficiency`.
- `efficiency_packages.csv` must contain one row per milestone year for both `buildings__commercial__lighting_retrofit` and `buildings__commercial__hvac_tuning_bms`.
- Both accepted commercial packages must apply only to `buildings__commercial__incumbent_mixed_fuels` and `buildings__commercial__electrified_efficiency`.
- `buildings__commercial__lighting_retrofit` and `buildings__commercial__hvac_tuning_bms` must share the same non-stacking group.
- No accepted commercial package should apply to `buildings__commercial__deep_electric` in v1.
- The commercial base rows should be rebaselined so the autonomous standards drift is explicit rather than double counted in `family_states.csv`.
