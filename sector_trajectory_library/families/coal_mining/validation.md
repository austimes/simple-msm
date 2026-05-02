# coal_mining validation

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 420000.0
- Unit: `kt_coal`
- Anchor status: `calibrated`
- Default incumbent state id: `coal_mining__conventional`
- Source family: Phase 1 reference scenario v0.1
- Coverage note: Total Australian coal production (Geoscience Australia 2023-24): 420,000 kt. Includes export coal (~330,000 kt, 79%) and domestic coal (~90,000 kt, 21%).

## What must reconcile at incumbent/default settings

- The default incumbent state for this family must exist in `family_states.csv` and remain selectable at every milestone year.
- Baseline validation outputs must include this family in the 2025 package checks whenever it contributes activity, commodity use, emissions, or electricity demand.
- Any balance notes embedded in the family rows must remain visible in the generated validation summary.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Commodity, emissions, and electricity closure within 0.1% after overlays unless explicitly documented otherwise.

## Known deviations

- Energy at anchor: 420,000 kt × 406 GJ/kt = 170.5 PJ (AES 2023-24 reference: 174.0 PJ, coverage = 98.0%).
- Energy CO2e at anchor: 420,000 kt × 22.4 tCO2e/kt = 9.41 MtCO2e (NGA 2025 diesel EF 69.9 kgCO2e/GJ; NGGI 2023-24 Cat 1A2 mining component ✓).
- Fugitive CO2e at anchor: 420,000 kt × 69 tCO2e/kt = 29.0 MtCO2e (NGGI Cat 1B1a = 29 MtCO2e, coverage = 99.9% ✓).
- National average fugitive intensity (69 tCO2e/kt) is heavily influenced by underground export mines; open-cut mines have much lower intensity (~15 tCO2e/kt).

## What is intentionally approximate or excluded

- This family remains a reduced-form Phase 1 representation.
- `would_expand_to_explicit_capacity?` values across the family: false.
- `would_expand_to_process_chain?` values across the family: false.
- Electricity upstream (scope 2) excluded; captured by the electricity supply family.
- Per-kt coefficient is a national average across all mine types (open-cut vs underground) and coal types (thermal vs coking).
- Phase 2: disaggregate into Victorian brown coal, NSW thermal, and Qld coking coal sub-families with separate open-cut and underground mine types.
