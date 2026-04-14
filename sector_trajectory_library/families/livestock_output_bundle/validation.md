# livestock_output_bundle validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 31134.94
- Unit: `A$m_output_2024`
- Anchor status: `synthetic_inherited`
- Default incumbent state id: `agriculture__livestock__conventional`
- Source family: Phase 1 reference scenario v0.2
- Coverage note: Inherited coarse agricultural output-bundle anchor from the Phase 1 calibration build.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Highly simplified mitigation state. Use for coarse sensitivity only until a proper agricultural abatement supply model is built.
- This is a coarse residual sector block intended to preserve agriculture in national emissions accounting, not a farm-system model.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: true.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.
