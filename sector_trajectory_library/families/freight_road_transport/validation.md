# freight_road_transport validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 249000000000.0
- Unit: `tkm`
- Anchor status: `official_direct`
- Default incumbent state id: `road_transport__freight_road__diesel`
- Source family: BITRE Yearbook 2024 freight chapter
- Coverage note: Anchored to 2023–24 road freight task (~249 billion tonne-km).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- 2025 coefficient reproduces roughly 36 MtCO2e road-freight emissions when combined with BITRE road tonne-km.
- Coefficient is a nationalised average across heterogeneous freight tasks; should be refined with payload class splits in Phase 2.
- Transitional state capturing the abatement that can be obtained without full drivetrain switch.
- Useful as a freight sensitivity state where battery range or charging-infrastructure limits bind.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `road_transport__freight_road__background_diesel_efficiency_drift`.
- The freight-road autonomous track must apply only to `road_transport__freight_road__diesel`.
- `efficiency_packages.csv` must contain one row per milestone year for `road_transport__freight_road__fleet_telematics_eco_driving`.
- The freight operational package must apply only to `road_transport__freight_road__diesel`.
- No accepted freight package should apply to `road_transport__freight_road__efficient_diesel`, `road_transport__freight_road__bev`, or `road_transport__freight_road__fcev_h2`.
- The freight operational package must remain materially smaller than the diesel-to-efficient-diesel state gap in every milestone year.
