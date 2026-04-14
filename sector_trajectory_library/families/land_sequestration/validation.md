# land_sequestration validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 0
- Unit: `tCO2_removed`
- Anchor status: `synthetic_migrated`
- Default incumbent state id: `removals_negative_emissions__land_sequestration__biological_sink`
- Source family: Migrated family default
- Coverage note: Migrated from the Phase 1 package without changing anchor semantics.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Retained as an exploratory land-removal supply state, not as a complete land-use model.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: true.
- `would_expand_to_process_chain?` values across the family: true.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.
