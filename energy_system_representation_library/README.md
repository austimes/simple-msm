# Energy system representation library

`energy_system_representation_library/` is the canonical authored package at the center of `simple-msm`. It is a role-topology library for representing pieces of Australia's energy and emissions system with reusable, interchangeable methods.

The package keeps role data, explanation, evidence hooks, and validation material together so model results can be inspected and challenged. It is still a working shape, not a stable compatibility contract.

## What Is Included

- 28 authored roles in `roles/<role_id>/`
- 52 distinct methods
- 312 method-year rows across milestone years 2025, 2030, 2035, 2040, 2045, and 2050
- Shared role topology, representation choices, reporting allocations, ledgers, commodity taxonomy, growth curves, price curves, carbon price curves, schemas, and validation diagnostics

## Core Modelling Conventions

### Roles

A role is the system function being covered: produce, supply, deliver, remove, or account for something. `shared/roles.csv` is the role registry and topology surface. It defines each `role_id`, role kind, balance type, output unit, coverage obligation, and default representation kind.

Roles are the model-structure ontology. Reporting labels such as sector and subsector are kept out of role topology and live only in `shared/reporting_allocations.csv`.

### Representations

`shared/representations.csv` defines the available ways to model each role. The initial representation kinds are:

- `pathway_bundle`
- `technology_bundle`
- `role_decomposition`

Every active role must have exactly one active representation. Direct bundle representations expose methods. Decomposition representations activate child roles through `shared/role_decomposition_edges.csv`.

### Methods

Each `roles/<role_id>/methods.csv` file lists the selectable methods for a direct representation bundle. Each `roles/<role_id>/method_years.csv` file holds the numeric method-year rows: costs, inputs, emissions, rollout limits, evidence, assumptions, and validation notes.

Residual coverage is explicit. It is represented as residual roles and residual methods rather than hidden sidecars.

### Demand And Efficiency

Each role owns its demand anchor in `roles/<role_id>/demand.csv`. Shared growth curves live in `shared/demand_growth_curves.csv`.

Role-local efficiency artifacts live beside the methods they affect:

- `roles/<role_id>/autonomous_efficiency_tracks.csv`
- `roles/<role_id>/efficiency_packages.csv`

Those files use `role_id` and `applicable_method_ids`; they do not retain the pre-ESRL family/state columns.

## Package Layout

- `shared/roles.csv` — role registry and topology surface
- `shared/representations.csv` — default and optional representation choices for each role
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

Structural validation expects every role listed in `shared/roles.csv` to have a matching folder containing `methods.csv`, `method_years.csv`, `demand.csv`, `README.md`, and `validation.md`. Ledger validation expects every referenced source, assumption, and curve id to resolve in the shared package tables.

The package intentionally does not retain a compatibility copy of the old family/state layout. Downstream consumers should load the role, representation, and method surfaces directly.
