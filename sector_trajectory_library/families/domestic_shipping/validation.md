# domestic_shipping validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 30000.0
- Unit: `million_tkm`
- Anchor status: `calibrated`
- Default incumbent state id: `domestic_shipping__conventional_diesel`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Anchored to BITRE coastal freight statistics (30,000 million_tkm = 30 billion tkm) and AES 2023-24 (30.0 PJ domestic water transport).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 30,000 million_tkm × 1,000 GJ/million_tkm = 30 PJ (AES 2023-24 reference: 30.0 PJ, coverage = 100%).
- Total CO2e: 76.0 tCO2e/million_tkm × 30,000 / 1e6 = 2.28 MtCO2e (NGGI domestic navigation ~2.2 MtCO2e ✓).
- Fuel split: 65% MDO, 35% HFO reflects vessel type mix (smaller coastal vessels predominantly MDO; bulk carriers use HFO).

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Ammonia combustion CO2 = 0 (green ammonia assumed per NGA accounting convention).
- Phase 2: disaggregate into bulk carriers, ro-ro ferries, and offshore supply vessels.
