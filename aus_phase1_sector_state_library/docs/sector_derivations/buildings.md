# Buildings derivation

## Output definition

Buildings are represented as **aggregate service bundles** rather than explicit end-use processes.

- residential: `residential_building_services`
- commercial: `commercial_building_services`
- output unit: `GJ_service_eq`

## Why this output was chosen

The Phase 1 objective is to support whole-economy interaction with electricity, gas and fuels. A compact service-bundle metric is enough to represent:

- electrification,
- direct gas exit,
- aggregate efficiency improvements,
- and changing exposure to the power sector.

A detailed end-use decomposition was deferred because it would materially expand the data-assembly burden without being necessary for the MVP.

## State family used

For both residential and commercial buildings, three states were retained:

1. incumbent mixed-fuels service bundle
2. electrified efficient service bundle
3. deep-electric service bundle

These states are approximately non-dominated because they span distinct trade-offs between:

- non-energy conversion cost,
- total final-energy intensity,
- direct combustion emissions,
- and electricity dependence.

## Evidence used

Main source IDs:

- `S001`, `S002` for official residential and commercial fuel splits
- `S018`, `S019`, `S020` for electrification direction and feasibility
- `S032` for direct combustion factors

## Baseline calibration logic

The 2025 incumbent states were calibrated directly to official Australian final-energy fuel shares:

- residential: electricity, gas, liquids and biomass
- commercial: electricity, gas and liquids

This is why the package can reproduce official residential and commercial final-energy mixes almost exactly when service demand is set equal to the official final-energy total.

## Efficiency and electrification logic

Future states reduce total final-energy input per unit service because:

- heat pumps outperform combustion heating for many loads,
- electric hot water and appliance efficiency improve,
- and fossil end uses decline.

These improvements are stylised and national-average. They should not be interpreted as a climate-zone or building-stock engineering model.

## Key caveat

Buildings are one of the stronger Phase 1 sectors, but the current representation still compresses several distinct end uses into one service bundle.

Main Phase 2 split:

- space conditioning
- water heating
- cooking
- appliances / miscellaneous
- new build versus retrofit
