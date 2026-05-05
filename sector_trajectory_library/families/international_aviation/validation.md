# international_aviation validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 70000.0
- Unit: `million_pkm`
- Anchor status: `calibrated`
- Default incumbent state id: `international_aviation__conventional_jet`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Anchored to BITRE international air travel 2023-24 (70,000 million_pkm) and AES 2025 Table F1 (199.0 PJ international aviation bunkers, 2023-24).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 70,000 million_pkm × 2,843 GJ/million_pkm = 199 PJ (AES 2025 Table F1 reference: 199.0 PJ, coverage = 100%).
- Total CO2e: 203.3 tCO2e/million_pkm × 70,000 / 1e6 = 14.2 MtCO2e (NGGI international aviation bunkers ✓).
- Higher energy intensity than domestic aviation due to long-haul routes and heavier fuel loads.
- International bunker statistics have boundary uncertainty (flag-of-convenience, fuel uplifted overseas).

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- SAF biogenic CO2 and green H2 combustion excluded from scope 1 per NGA accounting convention.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Phase 2: disaggregate by destination region (Pacific, Asia, Europe, Americas) reflecting route length variation.
- Phase 2: reconcile with ICAO CORSIA fuel uplift data.
