# Remove CO2 through engineered removals

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 0
- Unit: `tCO2_removed`
- Anchor status: `synthetic_migrated`
- Default incumbent method id: `removals_negative_emissions__engineered_removals__daccs`
- Source role: Migrated role default
- Coverage note: Migrated from the Phase 1 package without changing anchor semantics.

## What must reconcile at incumbent/default settings

- The default incumbent method for this role must exist in `method_years.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this role in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the role rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after residual role closure unless explicitly documented otherwise.

## Known deviations

- Not recommended for core MVP runs without explicit scenario review. Included to preserve an engineered-removal placeholder in the library.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: true.
- `would_expand_to_process_chain` values across the role: true.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.
