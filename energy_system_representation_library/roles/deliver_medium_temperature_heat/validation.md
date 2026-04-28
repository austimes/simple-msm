# Deliver medium temperature heat

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 140000000.0
- Unit: `GJ_useful_heat`
- Anchor status: `synthetic_inherited`
- Default incumbent method id: `generic_industrial_heat__medium_temperature_heat__fossil`
- Source role: Phase 1 reference scenario v0.2
- Coverage note: Inherited medium-temperature useful-heat anchor from the synthetic Phase 1 calibration build; broad manufacturing proxy.

## What must reconcile at incumbent/default settings

- The default incumbent method for this role must exist in `method_years.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this role in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the role rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after residual role closure unless explicitly documented otherwise.

## Known deviations

- Fuel mix re-tuned in the balance-ready pack to reduce 2025 coal overstatement and improve national commodity closure. Treat as a calibration-oriented incumbent rather than a literal subsector average.
- Balance-ready incumbent. Use as a calibration-oriented national average, not a plant-specific archetype.
- Fuel-switch method retained because some Australian planning studies constrain electrification by subsector.
- The achievable share remains uncertain and should be stress-tested.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: false.
- `would_expand_to_process_chain` values across the role: false.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `industrial_heat__medium_temperature__background_thermal_drift` and it must apply only to `generic_industrial_heat__medium_temperature_heat__fossil`.
- `efficiency_packages.csv` must contain one row per milestone year for both `industrial_heat__medium_temperature__thermal_system_retrofit` and `industrial_heat__medium_temperature__controls_tuning`.
- Both accepted medium-temperature packages must apply only to `generic_industrial_heat__medium_temperature_heat__fossil`.
- The medium-temperature packages must share the same role-local non-stacking group.
- Package multipliers must scale the fossil-method direct thermal fuel coefficients proportionally so the authored fuel mix stays intact.
- Electrified and low-carbon-fuel methods should not receive this role's portable efficiency artifacts in v1.
