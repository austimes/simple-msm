# rail_freight validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 700.0
- Unit: `billion_tkm`
- Anchor status: `calibrated`
- Default incumbent state id: `rail_freight__diesel_electric`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Anchored to BITRE freight linehaul statistics (700 billion_tkm, predominantly iron ore Pilbara and coal Hunter Valley) and AES 2025 Table F1 rail diesel freight share (49.0 PJ, 2023-24).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 700 billion_tkm × 70,000 GJ/billion_tkm = 49.0 PJ (AES 2025 Table F1 reference: 49.0 PJ rail diesel freight share, coverage = 100%).
- Scope 1 CO2e (diesel combustion only): 4,893 tCO2e/billion_tkm × 700 / 1e6 = 3.43 MtCO2e (NGA 2025 diesel EF 69.9 kgCO2e/GJ; NGGI 2025 rail freight ✓).
- 100% diesel by energy (rail electricity is allocated to passenger urban metro service); intensity 0.070 MJ/tkm reflects efficient heavy-haul operations.
- AES does not separately report freight vs passenger rail energy. The total rail figure (sector 47 = 64.9 PJ in 2023-24) is allocated 49 PJ to freight (diesel residual after assigning 12.9 PJ electricity and 3.1 PJ regional diesel to passenger).

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Green hydrogen combustion CO2 = 0 per NGA accounting convention.
- Phase 2: obtain direct NGERS freight rail reporting and disaggregate into heavy-haul (Pilbara, Hunter Valley), intermodal, and grain rail sub-families.
