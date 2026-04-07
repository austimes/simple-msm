# Generic industrial heat derivation

## Output definition

Generic industrial heat is split into three useful-heat service bands:

- low-temperature heat
- medium-temperature heat
- high-temperature heat

Output unit: `GJ_useful_heat`

## Why this output was chosen

The industrial sector needed at least one Phase 1 representation of fuel-switching and electrification outside explicit steel and cement process chains.

A temperature-band useful-heat service is the most compact way to preserve:

- gas demand,
- coal demand,
- electrification potential,
- hydrogen/biomass switching potential,
- and industrial emissions response

without building a full industrial process library immediately.

## State family used

For each temperature band:

1. fossil heat
2. electrified heat
3. low-carbon fuels heat

## Why this representation is weak

This is one of the weakest parts of the package because real industrial processes differ in:

- temperature requirement,
- heat-transfer medium,
- retrofitability,
- process integration,
- and non-thermal equipment needs.

A temperature-band model therefore has limited explanatory power compared with a process-specific industrial representation.

## Evidence used

Main source IDs:

- `S002` for broad Australian industrial fuel-mix context
- `S021` for planning evidence on industrial efficiency/electrification direction
- `S030` for hydrogen / low-carbon fuel context
- `S032` for combustion factors

## Interpretation guidance

This sector should be treated as an **industrial service wedge**, not as a literal industrial production sector.

It is useful for:

- economy-wide commodity demand,
- broad industrial decarbonisation sensitivity,
- fast scenario testing.

It is not robust for:

- subsector ranking,
- facility planning,
- technology selection for a specific industry.

## Expandability

This sector is a prime Phase 2 candidate for process-specific expansion, especially into:

- food and beverage steam / hot water
- chemicals process heat
- alumina
- non-ferrous minerals
- paper and pulp
- kiln and calciner classes
