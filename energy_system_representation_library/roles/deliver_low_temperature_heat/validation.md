# Deliver low temperature heat

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 120000000.0
- Unit: `GJ_useful_heat`
- Anchor status: `synthetic_inherited`
- Default incumbent method id: `generic_industrial_heat__low_temperature_heat__fossil`
- Source role: Phase 1 reference scenario v0.2
- Coverage note: Inherited low-temperature useful-heat anchor from the synthetic Phase 1 calibration build; broad manufacturing proxy.

## What must reconcile at incumbent/default settings

- The default incumbent method for this role must exist in `method_years.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this role in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the role rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after residual role closure unless explicitly documented otherwise.

## Known deviations

- Broadly reflects the high efficiency potential of heat pumps for low-temperature process heat.
- Exploratory flexibility method for users who need a fuel-switch option where electrification is judged infeasible.
- Useful generic representation for low-temperature industrial heat; not a substitute for food, paper or chemical subsector models.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: false.
- `would_expand_to_process_chain` values across the role: false.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `industrial_heat__low_temperature__background_thermal_drift` and it must apply only to `generic_industrial_heat__low_temperature_heat__fossil`.
- `efficiency_packages.csv` must contain one row per milestone year for both `industrial_heat__low_temperature__thermal_system_retrofit` and `industrial_heat__low_temperature__controls_tuning`.
- Both accepted low-temperature packages must apply only to `generic_industrial_heat__low_temperature_heat__fossil`.
- The low-temperature packages must share the same role-local non-stacking group.
- The fossil `method_years.csv` gas coefficient and direct-combustion emissions should stay flat at the de-embedded base level; the explicit autonomous track should carry the later-year background improvement instead.
- Electrified and low-carbon-fuel methods should not receive this role's portable efficiency artifacts in v1.
