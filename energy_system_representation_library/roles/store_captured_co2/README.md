# Store captured CO2

## What the role represents

This role makes store captured co2 visible in the physical role graph as a carbon-management infrastructure placeholder. It is intentionally separate from emitting host roles and from negative-emissions crediting.

## Role definition

- Role id: `store_captured_co2`
- Balance type: `intermediate_conversion`
- Output unit: `tCO2_stored`
- Output quantity basis: One tonne of CO2-equivalent service flow at this infrastructure boundary.
- Default method id: `carbon_management__co2_storage__placeholder`

## Method inventory

- `carbon_management__co2_storage__placeholder` - CO2 storage placeholder

The method is authored for milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Known caveats

- This is a low-confidence placeholder and has a zero baseline activity anchor.
- Facility-level energy penalties, network capacity, storage basin constraints, monitoring, and liability treatment are deferred to explicit process-chain work.

## Expansion path

- Split into basin-specific storage resources, injection capacity, monitoring, reversal risk and liability constraints.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
