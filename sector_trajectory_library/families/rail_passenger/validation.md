# rail_passenger validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 22000.0
- Unit: `million_pkm`
- Anchor status: `calibrated`
- Default incumbent state id: `rail_passenger__conventional_mixed`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Anchored to BITRE Rail Summary Data (22,000 million_pkm, urban metro + regional) and AES 2025 Table F1 rail share allocated to passenger (16.0 PJ = 12.9 PJ electricity + 3.1 PJ regional diesel, 2023-24).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 22,000 million_pkm × 727 GJ/million_pkm = 16.0 PJ (AES 2025 Table F1 reference: 16.0 PJ rail passenger share, coverage = 100%).
- Scope 1 CO2e (diesel combustion only): 9.9 tCO2e/million_pkm × 22,000 / 1e6 = 0.22 MtCO2e (NGA 2025 diesel EF 69.9 kgCO2e/GJ; NGGI 2025 rail passenger ✓).
- National average ~80% electric (urban metro), ~20% diesel (regional) by energy content (2025); urban metro/suburban systems predominantly electric, regional services diesel.
- The AES total rail figure (sector 47 = 64.9 PJ in 2023-24) is allocated 16 PJ to passenger and 49 PJ to freight; AES does not publish a passenger/freight split.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Green hydrogen combustion CO2 = 0 per NGA accounting convention.
- 50/50 energy split is a national average; state-level electric shares vary significantly (NSW high electric; QLD/WA high diesel regional).
- Phase 2: disaggregate into urban electric, suburban electric, regional diesel, and intercity diesel sub-families.
