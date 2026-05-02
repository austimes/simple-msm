# oil_and_gas_extraction validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 6100.0
- Unit: `PJ_gas`
- Anchor status: `calibrated`
- Default incumbent state id: `oil_and_gas_extraction__conventional`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Total Australian gas production (Geoscience Australia AECR 2025): 6,100 PJ_gas. Includes LNG exports (~4,509 PJ, 74%) and domestic/pipeline supply (~1,591 PJ, 26%).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 6,100 PJ_gas × 77,200 GJ/PJ_gas = 471.0 PJ (AES 2023-24 reference: 471 PJ, coverage = 100.1% ✓).
- Energy CO2e: 3,610 tCO2e/PJ_gas × 6,100 / 1e6 = 22.0 MtCO2e (NGGI 2023-24 Cat 1A2 = 22.0 MtCO2e ✓).
- Fugitive CO2e: 3,610 tCO2e/PJ_gas × 6,100 / 1e6 = 22.0 MtCO2e (NGGI 2023-24 Cat 1B2b = 22.0 MtCO2e ✓).
- AES-derived combustion CO2e (23.7 MtCO2e) is 1.7 MtCO2e higher than NGGI 1A2 (22 MtCO2e); the difference represents routine flaring/venting gas classified as fugitive in NGGI methodology.
- AES energy figure excludes LNG liquefaction own-use (classified as energy transformation in AES, not final energy consumption).

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Per-PJ coefficient is a national average combining onshore CSG (lower intensity) with offshore LNG facilities (higher gas turbine load).
- Phase 2: disaggregate into QLD CSG, WA/NT onshore conventional, and LNG sub-families.
