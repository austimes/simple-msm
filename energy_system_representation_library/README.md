# Energy system representation library

`energy_system_representation_library/` is the canonical authored package at the center of `simple-msm`. It is a role-topology library for representing pieces of Australia's energy and emissions system with reusable, interchangeable methods.

The package keeps role data, explanation, evidence hooks, and validation material together so model results can be inspected and challenged. It is still a working shape, not a stable compatibility contract.

## What Is Included

- 31 authored roles in `roles/<role_id>/`
- 60 distinct methods
- 360 method-year rows across milestone years 2025, 2030, 2035, 2040, 2045, and 2050
- Shared role topology, physical node graph, activity drivers, representation choices, representation incumbents, reporting allocations, ledgers, commodity taxonomy, growth curves, price curves, carbon price curves, schemas, and validation diagnostics
- A crude-steel role-decomposition pilot that keeps the aggregate pathway bundle available while testing a granular H2 DRI process-chain branch

## Public Ontology

### Roles

A role is the system function being covered: produce, supply, deliver, remove, or account for something. `shared/roles.csv` is the role registry and topology surface. It defines each `role_id`, label, description, topology area, parent role, role kind, balance type, output unit, coverage obligation, and default representation kind.

Roles are the model-structure ontology. Reporting labels such as sector and subsector are kept out of role topology and live only in `shared/reporting_allocations.csv`. A role can be a top-level coverage obligation or a child activated by a decomposition representation.

### Role Topology

The role topology records which coverage obligations exist and how decompositions activate child roles. A selected model structure must cover every required active role exactly once. Residual coverage is explicit: residual roles and residual methods are named rows, not hidden overlays.

### Activity Drivers

`shared/role_activity_drivers.csv` generalizes role demand into a role activity source. The initial driver kinds cover service or product demand, baseline scale factors for residual roles, linked parent activity for decomposition children, and exogenous series for scenario-driven activity.

The legacy role-local `demand.csv` files remain in the package while the solver and UI migrate. New logic should prefer activity drivers when it needs to understand why a role is active or how its base-year activity is anchored.

### Physical System Graph

`shared/physical_system_nodes.csv` defines the physical navigation hierarchy. `shared/role_memberships.csv` maps roles onto that hierarchy. `shared/physical_edges.csv` describes physical-flow context between nodes such as energy-carrier supply, intermediate material supply, host-owned heat services, captured-CO2 flows, and export-gate resource preparation.

The physical graph is separate from reporting allocations. Reporting categories can group results, but they do not create parent-child hierarchy, activate roles, or define physical-flow edges.

### Representations

`shared/representations.csv` defines the available ways to model each role. The initial representation kinds are:

- `pathway_bundle`
- `technology_bundle`
- `role_decomposition`

Every active role must have exactly one active representation. Direct bundle representations expose methods. Decomposition representations activate child roles through `shared/role_decomposition_edges.csv`. When a decomposition is selected, the parent role's direct methods are inactive and the child roles must each be represented in turn.

`shared/representation_incumbents.csv` records the base-year incumbent method or method mix for each direct representation. Pathway and residual representations usually have one incumbent row with share `1.0`. Technology bundles can author multiple incumbent rows as a calibrated mix. Validation requires incumbent methods to belong to the same direct representation and incumbent shares to sum to `1.0` for each representation and anchor year.

The current pilot is `produce_crude_steel`. Its default representation remains the aggregate `pathway_bundle`, while the optional `role_decomposition` representation activates:

- `produce_crude_steel_non_h2_dri_residual`
- `produce_direct_reduced_iron`
- `melt_refine_dri_crude_steel`

That pilot proves the package can keep complete crude-steel coverage without making every steel route process-chain detailed at once.

### Methods

Each `roles/<role_id>/methods.csv` file lists the selectable methods for a direct representation bundle. Each `roles/<role_id>/method_years.csv` file holds the numeric method-year rows: costs, inputs, emissions, rollout limits, evidence, assumptions, and validation notes.

Residual coverage is explicit. It is represented as residual roles and residual methods rather than hidden sidecars.

### Reporting Allocations

`shared/reporting_allocations.csv` maps role activity to external accounting contexts: sector, subsector, reporting bucket, reporting system, allocation basis, and allocation share. Reporting allocations explain how results should be grouped, but they do not create topology and cannot add or remove physical coverage.

### Demand And Efficiency

Each role owns its demand anchor in `roles/<role_id>/demand.csv`. Shared growth curves live in `shared/demand_growth_curves.csv`.

Role-local efficiency artifacts live beside the methods they affect:

- `roles/<role_id>/autonomous_efficiency_tracks.csv`
- `roles/<role_id>/efficiency_packages.csv`

Those files use `role_id` and `applicable_method_ids` so efficiency effects attach directly to canonical role methods.

## Package Layout

- `shared/roles.csv` — role registry and topology surface
- `shared/role_activity_drivers.csv` — role activity anchors and driver kinds
- `shared/physical_system_nodes.csv` — physical navigation hierarchy using doing-word node names
- `shared/role_memberships.csv` — role-to-physical-node mapping surface
- `shared/physical_edges.csv` — physical-flow context between physical nodes
- `shared/representations.csv` — default and optional representation choices for each role
- `shared/representation_incumbents.csv` — base-year incumbent method or method mix for each direct representation
- `shared/role_decomposition_edges.csv` — child-role activation edges for decomposition representations
- `shared/reporting_allocations.csv` — mappings from roles to reporting sectors, subsectors, and buckets
- `roles/<role_id>/methods.csv` — method registry for each direct role representation
- `roles/<role_id>/method_years.csv` — numeric rows for each role method and milestone year
- `roles/<role_id>/demand.csv` — role anchor and linked growth curve
- `roles/<role_id>/README.md` — role context and caveats
- `roles/<role_id>/validation.md` — role validation expectations
- `schema/*.json` — JSON-schema companions for the authored CSV surfaces
- `shared/*.csv` — ledgers, owners, commodities, growth, price, carbon, topology, representation, and reporting tables
- `validation/*.csv` — baseline validation diagnostics using role/method terminology

## Validation Structure

Structural validation expects every role listed in `shared/roles.csv` to have a matching folder containing `methods.csv`, `method_years.csv`, `demand.csv`, `README.md`, and `validation.md`.

The package structure test checks:

- topology integrity: parent roles resolve, decomposition edges point at decomposition representations, required children point back to their parent role, and the role graph is acyclic;
- activity driver integrity: every role has an activity driver, driver kinds are canonical, residual roles use baseline scale factors, and linked child drivers resolve to their parent roles;
- physical graph integrity: physical parent nodes resolve, the physical hierarchy is acyclic, every role has one primary physical node membership, and physical edge endpoints resolve to physical nodes;
- representation exclusivity: every role has exactly one default representation, direct representations expose methods, decomposition representations expose child edges, and decomposition representations do not carry direct methods;
- incumbent consistency: every direct representation has anchor-year incumbent rows, incumbent methods resolve inside the same representation, and incumbent shares sum to full coverage;
- method-year completeness: every method resolves to a direct representation for the same role and has one row for each milestone year from 2025 through 2050;
- reporting allocation resolution: every allocation resolves to a role, every role has reporting coverage, and allocation shares resolve to full coverage within each reporting system;
- schema alignment: each JSON-schema companion exposes the same ordered fields as the authored CSV it documents.

The package intentionally exposes only the role, representation, method, demand, efficiency, reporting, and ledger surfaces documented above. Downstream consumers should load those surfaces directly.
