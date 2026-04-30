# Residential Water Heating Role Boundary

Date: 2026-04-30

Status: boundary decision for `simple-msm-techrep-1.1`

Related context:

- [20260430-physical-doing-word-role-graph.md](./20260430-physical-doing-word-role-graph.md)
- [20260420-buildings-efficiency-research.md](../prd/20260420-buildings-efficiency-research.md)

## Purpose

This note defines the residential water-heating role boundary before authoring
the aggregate pathway and technology-bundle representations. The role is the
small test case for comparing a reduced-form pathway method with an explicit
technology bundle while keeping the broader residential building-services role
intact.

## Role Decision

| Field | Decision |
| --- | --- |
| Canonical role id | `provide_residential_water_heating` |
| Compatibility alias | `deliver_residential_water_heating` in older issue text refers to this same role concept. |
| Parent role | `serve_residential_building_occupants` |
| Physical node | `provide_residential_water_heating`, under `serve_residential_building_occupants` |
| Role kind | `modeled` |
| Balance type | `service_demand` |
| Output unit | `GJ_hot_water_service` |
| Coverage obligation | `required_decomposition_child` when the residential building-services role is decomposed into end uses |
| Default representation target | `pathway_bundle`, with a non-default `technology_bundle` also available |

The role covers useful domestic hot-water service delivered to Australian
residential occupants. It is an end-use child of residential building services,
not a separate top-level sector and not a supply role.

## Boundary

Included in the role:

- hot-water service for bathing, cleaning, laundry, and domestic kitchen uses in
  residential dwellings;
- water-heater conversion and storage losses that vary by technology;
- on-site electricity, gas, LPG/liquid fuel, biomass, and solar-thermal inputs
  used by water-heating equipment;
- direct on-site combustion emissions from gas, LPG/liquid fuel, or biomass
  water-heating equipment.

Excluded from the role:

- residential space heating, space cooling, cooking, refrigeration, lighting,
  appliances, plug loads, and building shell performance;
- upstream fuel supply, grid-electricity generation, and scope-2 electricity
  emissions, which remain represented by supply roles and accounting views;
- embedded equipment manufacturing emissions and household plumbing embodied
  impacts;
- commercial, institutional, and industrial hot-water systems;
- rooftop PV, batteries, tariff response, and demand shifting, which affect
  electricity supply or timing rather than the water-heating service boundary.

Where a combined appliance provides multiple services, only the activity,
energy inputs, costs, and emissions attributable to hot-water service belong in
this role. The remaining service shares stay with their own end-use roles or
with the aggregate residual residential building-services role.

## Activity Driver

The role should use linked parent activity while it is a decomposition child:

| Field | Value |
| --- | --- |
| Driver id | `provide_residential_water_heating__linked_parent` |
| Driver kind | `linked_parent_activity` |
| Parent role id | `serve_residential_building_occupants` |
| Parent activity coefficient | `0.25` `GJ_hot_water_service` per `GJ_service_eq` |
| Anchor year | `2025` |
| Implied anchor value | `119250000.0` `GJ_hot_water_service` |
| Growth curve | inherited from `residential_building_services__reference` until an end-use-specific curve is authored |

The coefficient is a v1 calibration assumption: water heating is treated as
one-quarter of the aggregate 2025 residential building service-equivalent
activity. With the current parent anchor of `477000000.0 GJ_service_eq`, that
gives a `119250000.0 GJ_hot_water_service` activity anchor for comparing the
pathway and technology representations. This value should be replaced if later
source work authors an end-use-specific Australian hot-water service series.

## Representation Requirements

Both direct representations satisfy the same role, activity driver, output unit,
and boundary:

| Representation | Purpose | Expected method shape |
| --- | --- | --- |
| `provide_residential_water_heating__pathway_bundle` | Fast whole-system runs using aggregate hot-water pathways. | At least incumbent mixed-fuel hot water and one transition/decarbonized pathway. |
| `provide_residential_water_heating__technology_bundle` | Technology comparison where active technologies directly compete to meet hot-water service. | Gas storage/instantaneous, resistive electric, electric heat pump, and solar/boosted water-heating methods where evidence permits. |

The pathway representation should remain the default until a scenario or
comparison explicitly selects the technology bundle. The technology bundle is
not a role decomposition: every technology method directly satisfies
`GJ_hot_water_service`.

## Accounting Guardrails

- The water-heating role must be activated only as a replacement for the
  water-heating portion of the aggregate residential building-services pathway,
  not as an additive overlay.
- The residual residential building-services role should carry non-water-heating
  service coverage when the end-use decomposition is active.
- Thermal-shell efficiency packages do not apply to this role unless a later
  issue explicitly authors an interaction; shell measures primarily affect space
  conditioning.
- Heat-pump water heating belongs inside this role's methods, not in a generic
  building-efficiency overlay.
- The comparison artifact should record differences between pathway and
  technology-bundle results as validation evidence rather than silently
  rewriting the aggregate pathway.

## Follow-On Authoring

`simple-msm-techrep-1.2` should author the aggregate pathway representation
against this boundary. `simple-msm-techrep-1.3` should author the technology
methods using the same `GJ_hot_water_service` unit. `simple-msm-techrep-1.4`
should replace the temporary single-incumbent assumption with calibrated 2025
technology shares that sum to `1.0`.
