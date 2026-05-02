# rail_freight validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 700.0
- Unit: `billion_tkm`
- Anchor status: `calibrated`
- Default incumbent state id: `rail_freight__diesel_electric`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Anchored to BITRE freight linehaul statistics (700 billion_tkm, predominantly iron ore Pilbara and coal Hunter Valley) and AES 2023-24 estimated rail freight energy (25.0 PJ).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 700 billion_tkm × 35,715 GJ/billion_tkm = 25.0 PJ (AES 2023-24 estimate: 25.0 PJ).
- Scope 1 CO2e (diesel combustion only): 2,371.6 tCO2e/billion_tkm × 700 / 1e6 = 1.66 MtCO2e (NGA 2025 diesel EF 69.9 kgCO2e/GJ; NGGI rail freight 1.5–2.0 MtCO2e ✓).
- Predominantly diesel-electric (95% diesel, 5% electricity by energy) with very low intensity (0.036 MJ/tkm) reflecting efficient heavy-haul operations.
- AES does not separately report freight vs passenger rail energy; the 25 PJ estimate is derived by subtracting estimated passenger energy (8 PJ) from total rail.

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Green hydrogen combustion CO2 = 0 per NGA accounting convention.
- Phase 2: obtain direct NGERS freight rail reporting and disaggregate into heavy-haul (Pilbara, Hunter Valley), intermodal, and grain rail sub-families.
