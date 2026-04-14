# cement_equivalent validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 9600000.0
- Unit: `t_cement_equivalent`
- Anchor status: `synthetic_inherited`
- Default incumbent state id: `cement_clinker__cement_equivalent__conventional`
- Source family: Phase 1 reference scenario v0.2
- Coverage note: Inherited cement-equivalent output anchor from the Phase 1 calibration build.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Incumbent kiln fuel mix re-tuned in the balance-ready pack to improve 2025 commodity closure while preserving the conventional cement route.
- Balance-ready incumbent cement state. Intended for national reduced-form calibration, not plant-level replication.
- CCS is probably necessary for very low clinker-sector emissions, but the Australian cost and rollout evidence is much weaker than for clinker-factor and fuel-switch changes.
- This is the strongest non-CCS abatement state for Australian cement in Phase 1 because it is directly anchored to CIF pathway ratios and fuel-switch assumptions.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: true.
- `would_expand_to_process_chain?` values across the family: true.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.
