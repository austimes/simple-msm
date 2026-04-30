# Make cement equivalent

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 9600000.0
- Unit: `t_cement_equivalent`
- Anchor status: `synthetic_inherited`
- Default incumbent method id: `cement_clinker__cement_equivalent__conventional`
- Source role: Phase 1 reference scenario v0.2
- Coverage note: Inherited cement-equivalent output anchor from the Phase 1 calibration build.

## What must reconcile at incumbent/default settings

- The default incumbent method for this role must exist in `method_years.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this role in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the role rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after residual role closure unless explicitly documented otherwise.

## Known deviations

- Incumbent kiln fuel mix re-tuned in the balance-ready pack to improve 2025 commodity closure while preserving the conventional cement route.
- Balance-ready incumbent cement method. Intended for national reduced-form calibration, not plant-level replication.
- CCS is probably necessary for very low clinker-sector emissions, but the Australian cost and rollout evidence is much weaker than for clinker-factor and fuel-switch changes.
- This is the strongest non-CCS abatement method for Australian cement in Phase 1 because it is directly anchored to CIF pathway ratios and fuel-switch assumptions.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: true.
- `would_expand_to_process_chain` values across the role: true.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `cement__cement_equivalent__background_kiln_grinding_drift`.
- The cement autonomous track must apply only to `cement_clinker__cement_equivalent__conventional` and `cement_clinker__cement_equivalent__low_clinker_alt_fuels`.
- `efficiency_packages.csv` must contain one row per milestone year for `cement__cement_equivalent__grinding_system_upgrade` and `cement__cement_equivalent__kiln_ai_process_optimisation`.
- No accepted cement package should apply to `cement_clinker__cement_equivalent__ccs_deep`.
- `cement__cement_equivalent__grinding_system_upgrade` should affect electricity only and stay within the accepted narrow grinding-efficiency range.
- No accepted cement efficiency package should alter process-emissions coefficients or implicitly recreate clinker-factor change.
- The two accepted cement packages must share the same non-stacking group until richer interaction handling exists.
