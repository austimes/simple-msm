# passenger_road_transport validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 293414730000.0
- Unit: `pkm`
- Anchor status: `official_direct`
- Default incumbent state id: `road_transport__passenger_road__ice_fleet`
- Source family: BITRE Yearbook 2024 Table 5.1
- Coverage note: Anchored to 2023–24 road passenger task represented by passenger cars plus buses (276.2 + 17.2 = 293.4 billion pkm).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- 2025 coefficient is chosen so that passenger-road and freight-road incumbent states jointly reproduce official road transport energy within about 0.2% when using BITRE service volumes.
- Electricity-use coefficient is a representative fleet-average service coefficient rather than a specific model-year vehicle rating.
- Useful transitional abatement state when BEV uptake is constrained or the model values liquid-fuel compatibility.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Contributors should treat the current family as the canonical authored unit and use the shared ledgers plus family-local notes for traceability.

## Efficiency Checks

- `autonomous_efficiency_tracks.csv` must contain one row per milestone year for `road_transport__passenger_road__background_new_vehicle_efficiency_drift`.
- The passenger-road autonomous track must apply only to `road_transport__passenger_road__ice_fleet`.
- No passenger-road `efficiency_packages.csv` file should be authored in v1.
- Hybrid-transition and BEV efficiency remain embodied in the pathway states and should not receive generic portable efficiency overlays.
- The ICE incumbent row should be rebaselined so the explicit autonomous track, not the base-state table, carries the accepted background fuel-intensity decline.
