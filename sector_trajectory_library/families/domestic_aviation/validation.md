# domestic_aviation validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 75500.0
- Unit: `million_pkm`
- Anchor status: `calibrated`
- Default incumbent state id: `domestic_aviation__conventional_jet`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Anchored to BITRE Aviation Statistical Report 2023-24 (75,500 million_pkm domestic air travel) and AES 2025 Table F1 (135.3 PJ domestic aviation, 2023-24).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 75,500 million_pkm × 1,792 GJ/million_pkm = 135.3 PJ (AES 2025 Table F1 reference: 135.3 PJ, coverage = 100%).
- Total CO2e: 128.1 tCO2e/million_pkm × 75,500 / 1e6 = 9.67 MtCO2e (NGGI Cat 1A3a domestic aviation ✓).
- National average energy intensity masks heterogeneity between short-haul and long-haul domestic routes.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- SAF biogenic CO2 excluded from scope 1 per NGA accounting convention.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Phase 2: disaggregate into short-haul (<1,000 km), medium-haul, and long-haul domestic route bands.
