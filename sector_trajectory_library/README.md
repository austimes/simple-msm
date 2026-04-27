# Sector trajectory library

`sector_trajectory_library/` is the current canonical authored form of the evolving, explainable trajectory library that sits at the center of `simple-msm`. The package is where the repository keeps the trajectories themselves together with the context, evidence hooks, and validation material needed to explain and challenge them.

## Why This Package Exists

The package exists to hold family-scoped trajectories for meaningful parts of Australia's economy. Each `family_id` is intended to represent an option set for some sector, subsector, or narrower economic slice where energy, cost, emissions, and rollout trade-offs matter.

It is designed to keep data, explanation, and validation together rather than splitting them across disconnected artifacts. The exact package shape is still expected to change while the right authored form for explainable trajectories is being worked out.

## What Is Included

- 14 authored families in `families/<family_id>/`
- 38 distinct state ids
- 228 state-year rows across milestone years 2025, 2030, 2035, 2040, 2045, 2050
- Shared ledgers, commodity taxonomy, growth curves, price curves, carbon price curves, overlays, validation outputs, and legacy exports

## Core Modelling Conventions

### Role topology preview

ESRL 1.0 introduces role-first topology metadata beside the current family-scoped package. `shared/roles.csv` defines the initial top-level role coverage and does not carry reporting `sector` or `subsector` fields. `shared/representations.csv` defines the default representation for each active role. `shared/role_decomposition_edges.csv` defines child-role activation for decomposition representations. `shared/reporting_allocations.csv` maps role activity to reporting labels such as sector and subsector.

This is a pre-migration surface for the role-topology cutover. The current `families/` package remains the runtime source until later ESRL migration issues move authored data to role and method terminology. Once migrated, each `roles/<role_id>/` directory will own `methods.csv` and `method_years.csv` using the schema companions in `schema/methods.schema.json` and `schema/method_years.schema.json`.

### Family-scoped authoring

Each `family_id` owns its state table, demand anchor, README, and validation note together in one folder. Shared ledgers, the family registry, and shared curve tables live under `shared/`.

The same family-local rule applies to first-class efficiency authoring. When efficiency artifacts are added, they belong in `families/<family_id>/autonomous_efficiency_tracks.csv` and `families/<family_id>/efficiency_packages.csv`, with family-specific caveats kept in the same folder's `README.md` and `validation.md`. Do not author efficiency effects in `overlays/` or `exports/legacy/`; those are residual or generated surfaces rather than canonical efficiency inputs.

### State table structure

`families/<family_id>/family_states.csv` is the canonical authored trajectory table. Inputs, emissions, source ids, assumption ids, and rollout limits stay embedded in that table for contributor ergonomics and explainability. Family-level metadata such as sector, subsector, region, output unit, and the default incumbent state remain in `shared/families.csv` rather than being duplicated into every state row.

### Demand and curve structure

Demand is authored as an anchor plus a named shared growth-curve id. Commodity price paths and carbon price paths are authored as named shared milestone-year curves.

### Generated artifacts

The `validation/` and `exports/legacy/` folders hold generated compatibility and diagnostics outputs. They are committed for migration continuity and should be treated as regenerated artifacts rather than hand-authored sources. `exports/legacy/` exists to bridge current consumers while the canonical package structure continues to mature.

## Package Layout

- `shared/families.csv` — canonical family registry
- `shared/roles.csv` — ESRL role-first top-level coverage
- `shared/representations.csv` — default and optional representation choices for each role
- `shared/role_decomposition_edges.csv` — child-role activation edges for decomposition representations
- `shared/reporting_allocations.csv` — mappings from roles to reporting sectors, subsectors, and buckets
- `roles/<role_id>/methods.csv` — target ESRL method registry for each migrated role
- `roles/<role_id>/method_years.csv` — target ESRL numeric rows for each role method and milestone year
- `families/<family_id>/family_states.csv` — authored state-year rows
- `families/<family_id>/demand.csv` — family anchor and linked growth curve
- `families/<family_id>/README.md` — family context and caveats
- `families/<family_id>/validation.md` — family validation expectations
- `schema/*.json` — JSON-schema companions for the family registry and row tables
- `shared/*.csv` — ledgers, owners, commodities, growth, price, carbon, and external commodity demand tables
- `overlays/residual_overlays.csv` — package-owned residual closure layer
- `validation/*.csv` — baseline validation outputs
- `exports/legacy/*.csv` — compatibility exports for the current app and external consumers

## Validation Structure

Structural validation expects every family listed in `shared/families.csv` to have a matching folder containing `family_states.csv`, `demand.csv`, `README.md`, and `validation.md`. Ledger validation expects every referenced source, assumption, owner, and curve id to resolve in the shared package tables.

## Web App Relationship

The web explorer and solver should load `shared/families.csv`, the shared ledgers and curves, each family-local `family_states.csv`, each family-local `demand.csv`, the schema companions used for documentation, the overlay table, and the committed generated diagnostics / legacy exports needed for compatibility.
