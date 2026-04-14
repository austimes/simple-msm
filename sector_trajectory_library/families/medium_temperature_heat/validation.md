# medium_temperature_heat validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 140000000.0
- Unit: `GJ_useful_heat`
- Anchor status: `synthetic_inherited`
- Default incumbent state id: `generic_industrial_heat__medium_temperature_heat__fossil`
- Source family: Phase 1 reference scenario v0.2
- Coverage note: Inherited medium-temperature useful-heat anchor from the synthetic Phase 1 calibration build; broad manufacturing proxy.

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
- Fuel-switch state retained because some Australian planning studies constrain electrification by subsector.
- The achievable share remains uncertain and should be stress-tested.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.
