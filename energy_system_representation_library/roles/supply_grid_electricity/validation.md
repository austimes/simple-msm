# Supply electricity

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 0
- Unit: `MWh`
- Anchor status: `synthetic_migrated`
- Default incumbent method id: `electricity__grid_supply__incumbent_thermal_mix`
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

- 2025 electricity intensity nudged to the official benchmark average so that default incumbent generation activity reproduces the national 2025 electricity emissions total.
- Electricity-sector coal and gas inputs are generation fuels, not end-use final energy. Use baseline_electricity_balance.csv for generation-output closure and baseline_commodity_balance.csv for final electricity closure.
- 2030 cost anchored to CSIRO GenCost whole-system estimate (~A$91/MWh incl. transmission) and 2050 deep-clean emissions intensity consistent with CSIRO benchmark range.
- Intended as the declining incumbent benchmark. In Phase 1 this is a national average, not a method-specific dispatch profile.
- Represents an efficient but more conservatively firmed near-zero electricity method. Useful as a sensitivity method when the model values residual emissions reduction more highly than system cost.

## What is intentionally approximate or excluded

- This role remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity` values across the role: true.
- `would_expand_to_process_chain` values across the role: false.
- Contributors should treat the current role as the canonical authored unit and use the shared ledgers plus role-local notes for traceability.

## Efficiency Checks

- `efficiency_packages.csv` must contain one row per milestone year for `electricity__grid_supply__thermal_auxiliary_load_tuning`.
- The electricity auxiliary-load package must apply only to `electricity__grid_supply__incumbent_thermal_mix`.
- No electricity `autonomous_efficiency_tracks.csv` file should be authored in v1.
- No accepted electricity package should apply to `electricity__grid_supply__policy_frontier` or `electricity__grid_supply__deep_clean_firmed`.
- The package must remain a low-single-digit direct-fuel wedge and should reduce direct energy emissions proportionally with the affected coal and gas inputs.
