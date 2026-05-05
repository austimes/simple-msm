# ESRL Role-Topology Plan

Date: 2026-04-28

Status: implementation plan for beads epics `simple-msm-esrl-1` and `simple-msm-esrl-2`

Ontology decision: [20260428-esrl-ontology-decision.md](./20260428-esrl-ontology-decision.md)

Physical role graph refinement:
[20260430-physical-doing-word-role-graph.md](./20260430-physical-doing-word-role-graph.md)

## Purpose

This plan records the target direction for the Energy System Representation Library (ESRL) work. It exists because the short bead descriptions are not enough context for implementers. The repository is library-first: the web app is a demonstration and validation layer around the library, not the product boundary.

The goal is to define and maintain a public-quality library of energy-system components at different levels of fidelity. Those components must be swappable depending on the modeling question while preserving complete coverage, clear accounting, and no double-counting.

This plan intentionally rejects backward compatibility as a requirement. The implementation should migrate the canonical model cleanly instead of carrying permanent `family` or `state` aliases.

## Current Problem

The current library uses `family_id`, `service_or_output_name`, `sector`, `subsector`, and `state_id` as overlapping concepts:

- `family_id` currently behaves partly like a physical/economic system piece.
- `service_or_output_name` currently behaves partly like a role to be met.
- `sector` and `subsector` are accounting/reporting ideas but are also used for grouping model structure.
- `state_id` currently mixes aggregate pathways, technology routes, residual stubs, and future process-chain expansion hints.

That naming works for the Phase 1 reduced-form explorer, but it is not clear enough for a public library that must support multiple fidelity levels.

The new ontology must separate:

- what the system must do,
- how that requirement is represented,
- which method is chosen inside a representation,
- and how results map to reporting/accounting categories.

## Target Ontology

### Role

A role is the primary system object. A role is a function the system must produce, supply, deliver, remove, or account for.

Use verb/object names:

- `produce_crude_steel`
- `supply_electricity`
- `deliver_residential_building_services`
- `account_energy_system_fugitive_emissions`
- `remove_co2_land_sequestration`

A role has:

- a stable `role_id`,
- a label and description,
- a balance type,
- an output or accounting unit,
- a parent or child position in the role topology,
- a default representation,
- and coverage requirements.

Roles replace "segments" as the model-structure ontology. A role is the system piece because the useful question is what function the system is covering, not which accounting sector label it sits under.

### Role Topology

The role topology is the graph of roles and subroles. It is usually tree-like, but the implementation should not rely on reporting sector trees as the source of truth.

The topology answers:

- Which roles are top-level coverage obligations?
- Which roles can be decomposed into child roles?
- Which child roles are required when a decomposition is active?
- Which roles are residual coverage placeholders?

Completeness is a topology property. A valid selected model structure covers every required active role exactly once.

### Representation

A representation is the selected way to model an active role.

Each active role must have exactly one active representation. The initial representation kinds are:

- `pathway_bundle`
- `technology_bundle`
- `role_decomposition`

Do not use "detailed representation" as a canonical schema term. "Detailed" is a user-facing description only. In the library, the representation is either a direct bundle or a role decomposition.

### Pathway Bundle

A pathway bundle is a direct representation of a role using aggregate pathway methods.

This is how most of the current library works. A pathway method may represent a mixed fleet, a policy frontier, or an aggregate technology mix. It does not have to be a single physical technology.

Examples:

- electricity incumbent thermal mix,
- electricity policy frontier,
- crude-steel aggregate H2-DRI electric pathway,
- residential deep-electric building-services pathway,
- freight efficient-diesel pathway.

### Technology Bundle

A technology bundle is a direct representation of a role using technology or route methods that each directly satisfy the same role.

Examples:

- coal generation, gas generation, wind, solar, hydro, storage-backed supply methods for `supply_electricity`,
- BF-BOF, scrap EAF, H2-DRI-EAF methods for `produce_crude_steel`,
- heat pump, electric boiler, gas boiler methods for a heating role.

"Technology bundle" is preferred over "technology route set" because it parallels "pathway bundle" and keeps the concept at the representation level.

### Role Decomposition

A role decomposition is a representation that satisfies a parent role by activating child roles.

The parent role does not use direct methods while a decomposition representation is active. Its child roles must each be represented by their own pathway bundle, technology bundle, or further role decomposition.

This is the canonical way to express process chains.

Example:

`produce_crude_steel` can be represented by a role decomposition that activates:

- `produce_crude_steel_non_h2_dri_residual`
- `produce_direct_reduced_iron`
- `melt_refine_dri_crude_steel`

The DRI and melt/refine child roles then use direct bundles of methods. The decomposition itself is not a method and is not a process row. It is a topology selection.

### Method

A method is one selectable option inside a direct representation bundle. Method-year rows hold the numeric data currently carried by state-year rows:

- inputs,
- outputs,
- cost,
- energy emissions,
- process emissions,
- limits,
- evidence,
- assumptions,
- validation notes.

Initial method kinds:

- `pathway`
- `technology`
- `residual`

A residual is not a separate top-level ontology. It is either a residual method in a bundle or, where useful, a residual role whose only initial method is residual.

### Reporting Allocation

Reporting allocations map roles and method activity to accounting/reporting categories.

Reporting categories include sector, subsector, NGA bucket, display group, or any other external reporting context. They must not define the physical system topology.

## Canonical Naming

The canonical package should be renamed from `sector_trajectory_library` to:

```text
energy_system_representation_library
```

Recommended canonical renames:

| Current term | Canonical term |
| --- | --- |
| `family_id` | `role_id` |
| `state_id` | `method_id` |
| `family_states.csv` | `method_years.csv` |
| `service_controls` | `role_controls` |
| `active_state_ids` | `active_method_ids` |
| `output_role` | `balance_type` |
| `SectorState` | `MethodYear` |

The old terms should not survive as canonical schema, UI, or documentation language.

## Canonical File Shape

Target library files:

```text
energy_system_representation_library/
  README.md
  manifest.json
  shared/
    roles.csv
    representations.csv
    role_decomposition_edges.csv
    reporting_allocations.csv
    commodities.csv
    commodity_price_curves.csv
    demand_growth_curves.csv
    carbon_price_curves.csv
    source_ledger.csv
    assumptions_ledger.csv
    owners.csv
  roles/
    <role_id>/
      methods.csv
      method_years.csv
      demand.csv
      autonomous_efficiency_tracks.csv
      efficiency_packages.csv
      README.md
      validation.md
  schema/
    roles.schema.json
    representations.schema.json
    role_decomposition_edges.schema.json
    reporting_allocations.schema.json
    methods.schema.json
    method_years.schema.json
```

The implementation may land this incrementally inside the existing repo, but the final canonical structure should not preserve the old layout as a compatibility surface.

## Model-Structure Rules

For every active required role:

1. Exactly one representation is selected.
2. If the representation is `pathway_bundle` or `technology_bundle`, direct methods are available and child roles are inactive.
3. If the representation is `role_decomposition`, direct methods are inactive and child roles are activated.
4. Each required active child role must itself satisfy these rules.
5. Residual coverage is valid only when explicit in the role topology or method set.
6. Reporting allocation cannot create or remove physical coverage.
7. A selected model structure must not double-cover the same role.

These rules are the basis for both library validation and demonstration optimizer validation.

## Top-Level Role Topology

The initial topology below is the ESRL migration sketch from 2026-04-28. For the
physical role graph sequence, use the later doing-word refinement as the target
shape: [20260430-physical-doing-word-role-graph.md](./20260430-physical-doing-word-role-graph.md).
That refinement keeps sector-style area labels out of the physical node graph,
moves process heat under host roles, and adds Australian export-gate resource
supply roles.

The first canonical topology should migrate the current modeled and residual coverage into roles. The exact IDs can change during implementation, but the coverage must be complete.

Initial top-level areas:

- buildings
  - `deliver_residential_building_services`
  - `deliver_commercial_building_services`
  - residential residual coverage
  - commercial residual coverage
- transport
  - `deliver_passenger_road_transport`
  - `deliver_freight_road_transport`
  - transport residual coverage
- industrial heat and production
  - low-, medium-, and high-temperature heat roles
  - `produce_crude_steel`
  - `produce_cement_equivalent`
  - manufacturing residual coverage
  - residual IPPU coverage
- energy supply
  - `supply_electricity`
  - electricity grid losses and own-use
  - mining residual coverage
  - residual fugitive emissions
- agriculture
  - livestock output bundle
  - cropping and horticulture output bundle
  - residual agriculture coverage
- construction residual coverage
- water and waste residual coverage
- other residual coverage
- removals and land
  - land sequestration
  - engineered removals
  - residual LULUCF sink

Completeness can be achieved through residual roles and residual methods. Residuals should be explicit, named, and documented rather than hidden as overlays.

## Crude-Steel Pilot

The pilot should prove that a role can be represented at an aggregate pathway level or through a decomposed process-chain topology.

Parent role:

- `produce_crude_steel`

Representation option 1:

- `crude_steel__pathway_bundle`
- kind: `pathway_bundle`
- methods migrated from the current aggregate crude-steel options:
  - conventional BF-BOF pathway,
  - scrap EAF pathway,
  - BF-BOF CCS pathway,
  - aggregate H2-DRI electric pathway.

Representation option 2:

- `crude_steel__h2_dri_decomposition`
- kind: `role_decomposition`
- child roles:
  - `produce_crude_steel_non_h2_dri_residual`
  - `produce_direct_reduced_iron`
  - `melt_refine_dri_crude_steel`

The non-H2 residual/aggregate child preserves complete crude-steel coverage while only one branch becomes granular. This avoids forcing the whole steel system to become process-chain detailed in the first pilot.

The DRI child role can use a technology bundle such as:

- H2 shaft-furnace DRI,
- gas DRI,
- imported DRI residual.

The melt/refine child role can use a technology bundle such as:

- EAF finishing,
- electric smelter finishing.

## Electricity Example

The same ontology should support electricity at different fidelity levels.

Role:

- `supply_electricity`

Pathway bundle:

- incumbent thermal mix,
- policy frontier,
- deep clean firmed.

Technology bundle:

- coal generation,
- gas generation,
- wind,
- solar,
- hydro,
- batteries or firming proxy.

Role decomposition:

- `generate_electricity`,
- `firm_store_electricity`,
- `deliver_grid_electricity`,
- `account_losses_own_use`.

The demonstration optimizer does not need to implement all of this immediately. The library ontology should make it possible.

## Buildings Example

Role:

- `deliver_residential_building_services`

Pathway bundle:

- incumbent mixed fuels,
- electrified efficiency,
- deep electric.

Potential decomposition:

- `deliver_residential_space_conditioning`,
- `deliver_residential_water_heating`,
- `deliver_residential_cooking`,
- `deliver_residential_appliance_services`,
- `account_residential_other`.

The residual child role keeps coverage complete until more detailed end-use data exists.

## Configuration Semantics

Target configuration structure:

```json
{
  "representation_by_role": {
    "produce_crude_steel": "crude_steel__pathway_bundle"
  },
  "role_controls": {
    "produce_crude_steel": {
      "mode": "optimize",
      "active_method_ids": ["..."]
    }
  }
}
```

The resolver determines active roles and active methods from `representation_by_role`.

Direct bundle representation:

- active role exposes direct methods,
- child roles inactive.

Role decomposition representation:

- parent direct methods inactive,
- child roles active,
- each child role resolves its own selected representation.

## Demonstration Optimizer Implications

The web optimizer must become a role-topology solver, not only a flat role/method solver.

Required capabilities:

- load canonical role topology,
- resolve selected representations into active role/method sets,
- validate no double coverage,
- support intermediate role outputs as inputs to other active roles,
- balance decomposed process-chain roles,
- report infeasibility when a decomposition activates child roles that cannot be covered,
- compare aggregate pathway results against decomposed results.

The crude-steel DRI pilot is the first acceptance test for intermediate role balancing.

## Epic 1: Library

Epic:

- `simple-msm-esrl-1`: ESRL 1.0: Canonical role-topology library

Scope:

- ontology,
- canonical file shape,
- migration from family/state terminology,
- role topology,
- representation and method schemas,
- crude-steel decomposition pilot,
- library validation and documentation.

Child issues:

- `simple-msm-esrl-1.1`: Lock role-topology ontology and package naming.
- `simple-msm-esrl-1.2`: Define canonical role topology and reporting mappings.
- `simple-msm-esrl-1.3`: Define representation and method schemas.
- `simple-msm-esrl-1.4`: Migrate current library data to role/method terminology.
- `simple-msm-esrl-1.5`: Author crude-steel role-decomposition pilot.
- `simple-msm-esrl-1.6`: Update library documentation and validation.

Implementation constraints:

- no backward compatibility layer as a final deliverable,
- no canonical family/state terminology,
- reporting categories stay separate from physical role topology,
- residuals must be explicit.

## Epic 2: Demonstration Optimizer

Epic:

- `simple-msm-esrl-2`: ESRL 2.0: Role-topology demonstration optimizer

Scope:

- web loader,
- representation resolver,
- generalized optimizer balances,
- role representation UI,
- built-in configuration conversion,
- end-to-end terminology cutover.

Child issues:

- `simple-msm-esrl-2.1`: Load canonical role-topology library in the web app.
- `simple-msm-esrl-2.2`: Resolve active role structure from representation selections.
- `simple-msm-esrl-2.3`: Generalize optimizer balances for decomposed roles.
- `simple-msm-esrl-2.4`: Update role representation UI.
- `simple-msm-esrl-2.5`: Convert built-in configurations to role controls.
- `simple-msm-esrl-2.6`: End-to-end validation and terminology cutover.

Implementation constraints:

- the optimizer is a demonstration layer,
- it must be generic across roles,
- it must handle role decompositions as process chains,
- no canonical UI text should use state/family semantics after cutover.

## Dependency Shape

Expected ordering:

1. `simple-msm-esrl-1.1`
2. `simple-msm-esrl-1.2` and `simple-msm-esrl-1.3`
3. `simple-msm-esrl-1.4`
4. `simple-msm-esrl-1.5`
5. `simple-msm-esrl-1.6`
6. `simple-msm-esrl-2.1`
7. `simple-msm-esrl-2.2`
8. `simple-msm-esrl-2.3`, with UI/config work following as appropriate
9. `simple-msm-esrl-2.6`

Epic 2 is conceptually Part II and depends on Epic 1. Some web design exploration can start after schemas are stable, but implementation should not retain compatibility with the old data shape.

## Acceptance For The Whole Plan

The work is complete when:

- the canonical library is role-topology based,
- every active role has exactly one representation,
- aggregate pathway and decomposed representations are mutually exclusive,
- crude steel can be solved as either aggregate pathways or a decomposed DRI process chain,
- residual coverage is explicit and validated,
- reporting mappings are separate from role topology,
- public docs explain the ontology without relying on internal history,
- and the web demonstration uses role, representation, and method terminology end to end.
