# rail_passenger validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 22000.0
- Unit: `million_pkm`
- Anchor status: `calibrated`
- Default incumbent state id: `rail_passenger__conventional_mixed`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Anchored to BITRE Rail Summary Data (22,000 million_pkm, urban metro + regional) and AES 2023-24 estimated rail passenger share (8.0 PJ).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 22,000 million_pkm × 364 GJ/million_pkm = 8.0 PJ (AES 2023-24 estimate: 8.0 PJ).
- Scope 1 CO2e (diesel combustion only): 12.7 tCO2e/million_pkm × 22,000 / 1e6 = 0.28 MtCO2e (NGA 2025 diesel EF 69.9 kgCO2e/GJ; NGGI rail ~0.3 MtCO2e ✓).
- National average ~50% electric, 50% diesel by energy content (2025); urban metro/suburban systems predominantly electric, regional and interstate services diesel.
- The AES total rail figure includes both passenger and freight; 8 PJ for passenger is an estimate derived by subtracting estimated freight share.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Green hydrogen combustion CO2 = 0 per NGA accounting convention.
- 50/50 energy split is a national average; state-level electric shares vary significantly (NSW high electric; QLD/WA high diesel regional).
- Phase 2: disaggregate into urban electric, suburban electric, regional diesel, and intercity diesel sub-families.
