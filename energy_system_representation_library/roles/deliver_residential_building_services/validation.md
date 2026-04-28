# Deliver residential building services

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 477000000.0
- Unit: `GJ_service_eq`
- Anchor status: `official_direct`
- Default incumbent method id: `buildings__residential__incumbent_mixed_fuels`
- Source role: Australian Energy Update 2025 Table 5 / Table 11
- Coverage note: Aligned to 2023–24 residential final energy use as the incumbent service-demand anchor.

## What must reconcile at incumbent/default settings

- The default incumbent method for this role must exist in `method_years.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this role in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the role rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after residual role closure unless explicitly documented otherwise.

## Known deviations

- Baseline fuel shares reproduce official residential final-energy mix in 2023–24 when combined with service demand equal to 477.8 PJ_service_eq.
- Energy intensity falls because the method represents a more efficient service package; direct on-site emissions collapse as gas exits.
- Represents the high-electrification/efficiency end of the residential service frontier. Useful as the near-zero direct-emissions building method.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: false.
- `would_expand_to_process_chain` values across the role: false.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `buildings__residential__background_standards_drift`.
- `buildings__residential__background_standards_drift` must apply only to `buildings__residential__incumbent_mixed_fuels` and `buildings__residential__electrified_efficiency`.
- `efficiency_packages.csv` must contain one row per milestone year for `buildings__residential__thermal_shell_retrofit`.
- `buildings__residential__thermal_shell_retrofit` must apply only to `buildings__residential__incumbent_mixed_fuels` and `buildings__residential__electrified_efficiency`.
- Do not apply a generic portable efficiency artifact to `buildings__residential__deep_electric`; that method already embodies the role frontier.
- With efficiency controls disabled, the 2025 incumbent row must still reproduce the current baseline anchor.
- The residential base rows should be rebaselined so the autonomous track, not `method_years.csv`, carries the background standards drift.
