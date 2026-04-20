# high_temperature_heat validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 170000000.0
- Unit: `GJ_useful_heat`
- Anchor status: `synthetic_inherited`
- Default incumbent state id: `generic_industrial_heat__high_temperature_heat__fossil`
- Source family: Phase 1 reference scenario v0.2
- Coverage note: Inherited high-temperature useful-heat anchor from the synthetic Phase 1 calibration build; broad manufacturing proxy.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Fuel mix re-tuned in the balance-ready pack to reduce 2025 coal overstatement and improve national commodity closure. Treat as a calibration-oriented incumbent rather than a literal subsector average.
- Balance-ready incumbent. Use as a calibration-oriented national average, not a plant-specific archetype.
- Retained because hydrogen is often treated as a candidate for the hardest high-temperature heat niches.
- Useful sensitivity state, but evidence for aggregate national high-temperature electrification remains thin.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `industrial_heat__high_temperature__background_thermal_drift` and it must apply only to `generic_industrial_heat__high_temperature_heat__fossil`.
- `efficiency_packages.csv` must contain one row per milestone year for both `industrial_heat__high_temperature__combustion_heat_recovery` and `industrial_heat__high_temperature__controls_tuning`.
- Both accepted high-temperature packages must apply only to `generic_industrial_heat__high_temperature_heat__fossil`.
- The high-temperature packages must share the same family-local non-stacking group.
- Any accepted high-temperature package should remain a small wedge relative to route-switch uncertainty and should not target `__electrified` or `__low_carbon_fuels` states.
- The fossil incumbent row should be rebaselined so the explicit autonomous track, not `family_states.csv`, carries the accepted background drift.
