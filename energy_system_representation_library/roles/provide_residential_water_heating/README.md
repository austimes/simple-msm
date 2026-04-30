# Provide residential water heating

## What the role represents

This role covers useful domestic hot-water service delivered to Australian residential occupants. It is an end-use child of `serve_residential_building_occupants`, with activity measured in `GJ_hot_water_service`.

Boundary details are recorded in `docs/plan/20260430-residential-water-heating-role-boundary.md`. The role excludes space conditioning, cooking, appliances, upstream fuel supply, grid-electricity generation, and commercial or institutional hot-water systems.

## Role definition

- Role id: `provide_residential_water_heating`
- Parent role: `serve_residential_building_occupants`
- Balance type: `service_demand`
- Output unit: `GJ_hot_water_service`
- Output quantity basis: useful hot-water service, calibrated as 25% of the aggregate 2025 residential building service-equivalent anchor for this v1 comparison pilot
- Default incumbent method id: `buildings__residential_water_heating__incumbent_mixed_fuels`

## Method inventory

- buildings__residential_water_heating__incumbent_mixed_fuels - Incumbent mixed-fuel residential water heating
- buildings__residential_water_heating__heat_pump_transition - Heat-pump transition residential water heating
- buildings__residential_water_heating__near_zero_electric - Near-zero electric residential water heating

All method ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Representation notes

The default representation is `provide_residential_water_heating__pathway_bundle`. It is intentionally aggregate so fast whole-system runs can compare against the later `technology_bundle` representation without treating each appliance technology as a separate method yet.


## Technology Bundle

The non-default `provide_residential_water_heating__technology_bundle` representation exposes individual technology methods that directly satisfy `GJ_hot_water_service`:

- buildings__residential_water_heating__gas_storage - Gas storage water heater
- buildings__residential_water_heating__resistive_electric - Resistive electric water heater
- buildings__residential_water_heating__electric_heat_pump - Electric heat-pump water heater
- buildings__residential_water_heating__solar_boosted - Solar boosted water heater

The technology bundle carries calibrated 2025 incumbent shares: gas storage `0.48`, resistive electric `0.32`, electric heat pump `0.12`, and solar boosted `0.08`. These shares sum to `1.0` and provide the base-year mix for technology-bundle comparisons.

## Main sources used

- `S001` - see `shared/source_ledger.csv`
- `S002` - see `shared/source_ledger.csv`
- `S018` - see `shared/source_ledger.csv`
- `S019` - see `shared/source_ledger.csv`
- `S020` - see `shared/source_ledger.csv`
- `S032` - see `shared/source_ledger.csv`

## Main assumptions used

- `A002` - see `shared/assumptions_ledger.csv`
- `A003` - see `shared/assumptions_ledger.csv`
- `A004` - see `shared/assumptions_ledger.csv`
- `A005` - see `shared/assumptions_ledger.csv`
- `A022` - see `shared/assumptions_ledger.csv`
- `A023` - see `shared/assumptions_ledger.csv`

## Known caveats

- The 2025 activity anchor is a v1 proxy derived from aggregate residential building service demand, not an independently sourced hot-water service series.
- Method costs, fuel shares, and rollout limits are exploratory pathway values designed for representation comparison.
- The role should be activated as a replacement for the water-heating share of aggregate residential building services, not as an additive overlay.

## Maintainer and reviewer

- Maintainer: Core Library Team (`core_library_team`)
- Reviewer: Core Model Review (`core_model_review`)
