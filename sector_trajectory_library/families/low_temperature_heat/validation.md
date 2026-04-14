# low_temperature_heat validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 120000000.0
- Unit: `GJ_useful_heat`
- Anchor status: `synthetic_inherited`
- Default incumbent state id: `generic_industrial_heat__low_temperature_heat__fossil`
- Source family: Phase 1 reference scenario v0.2
- Coverage note: Inherited low-temperature useful-heat anchor from the synthetic Phase 1 calibration build; broad manufacturing proxy.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Broadly reflects the high efficiency potential of heat pumps for low-temperature process heat.
- Exploratory flexibility state for users who need a fuel-switch option where electrification is judged infeasible.
- Useful generic representation for low-temperature industrial heat; not a substitute for food, paper or chemical subsector models.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.
