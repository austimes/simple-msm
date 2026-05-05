# international_shipping validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 200000.0
- Unit: `million_tkm`
- Anchor status: `estimated`
- Default incumbent state id: `international_shipping__conventional_hfo`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: AES 2025 Table F1 (29.5 PJ international maritime bunkers, 2023-24). Service volume 200,000 million_tkm is an estimate — direct Australian bunker-to-tkm statistic not published.

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 200,000 million_tkm × 147.5 GJ/million_tkm = 29.5 PJ (AES 2025 Table F1 reference: 29.5 PJ, coverage = 100%).
- Total CO2e: 11.4 tCO2e/million_tkm × 200,000 / 1e6 = 2.3 MtCO2e (NGGI 2025 international shipping bunkers ✓).
- Fuel split: 60% HFO (large bulk/container ships), 40% MDO (smaller/coastal feeders).
- International bunker data has allocation uncertainty (where fuel is purchased vs where voyage occurs).

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Service volume anchor (200,000 million_tkm) is an estimate — no direct published Australian statistic.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Green ammonia combustion CO2 = 0 per NGA accounting convention.
- Phase 2: disaggregate by vessel type (bulk, container, tanker, LNG carrier) and cross-check with ICAO/IMO official bunker data.
