# Produce livestock output

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 31134.94
- Unit: `A$m_output_2024`
- Anchor status: `synthetic_inherited`
- Default incumbent method id: `agriculture__livestock__conventional`
- Source role: Phase 1 reference scenario v0.2
- Coverage note: Inherited coarse agricultural output-bundle anchor from the Phase 1 calibration build.

## What must reconcile at incumbent/default settings

- The default incumbent method for this role must exist in `method_years.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this role in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the role rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after residual role closure unless explicitly documented otherwise.

## Known deviations

- Highly simplified mitigation method. Use for coarse sensitivity only until a proper agricultural abatement supply model is built.
- This is a coarse residual sector block intended to preserve agriculture in national emissions accounting, not a farm-system model.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: false.
- `would_expand_to_process_chain` values across the role: true.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.

## Efficiency Checks

- No `autonomous_efficiency_tracks.csv` file should be authored for this role in v1.
- No `efficiency_packages.csv` file should be authored for this role in v1.
- Current direct-energy improvements remain embodied in `agriculture__livestock__mitigated` until the role boundary is split further.
