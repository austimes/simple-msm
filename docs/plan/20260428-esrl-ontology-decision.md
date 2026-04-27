# ESRL Role-Topology Ontology Decision

Date: 2026-04-28

Status: accepted for `simple-msm-esrl-1.1`

Parent plan: [20260428-esrl-role-topology-plan.md](./20260428-esrl-role-topology-plan.md)

## Decision

The canonical public library ontology is role-topology based.

The primary system pieces are **roles**. A role is modeled by exactly one active **representation** in any selected model structure. Direct representations expose selectable **methods**; decomposition representations activate child roles that must each be represented in turn.

The canonical package name is:

```text
energy_system_representation_library
```

This replaces `sector_trajectory_library` as the target authored package name for ESRL 1.0. Existing `family` and `state` terms are implementation history only. They must not remain canonical schema, package, UI, or public documentation terms after migration.

## Scope

This decision locks terminology and package naming. It does not rename the checked-in package yet. The migration, schemas, topology files, and web cutover are handled by later ESRL issues.

There is no backward-compatibility requirement for the final ESRL 1.0 library shape. The implementation should migrate cleanly to the canonical ontology instead of retaining permanent aliases such as `family_id`, `state_id`, family, state, segment, or sector-state.

## Glossary

| Term | Canonical meaning |
| --- | --- |
| Role | The primary system object. A role is a function the system must produce, supply, deliver, remove, or account for. A role has a stable `role_id`, coverage requirements, an output or accounting unit, and a position in the role topology. |
| Role topology | The graph of roles and subroles that defines physical and accounting coverage obligations. It answers which roles are required, which roles can be decomposed, which child roles become active under a decomposition, and where explicit residual coverage exists. |
| Representation | The selected way an active role is modeled. Every active role has exactly one active representation. Canonical representation kinds are `pathway_bundle`, `technology_bundle`, and `role_decomposition`. |
| Pathway bundle | A direct representation of a role using aggregate pathway methods. A pathway may represent a mixed fleet, policy frontier, aggregate technology mix, or other reduced-form route that directly satisfies the role. |
| Technology bundle | A direct representation of a role using technology or route methods that each directly satisfy the same role. It is a representation-level bundle, not a process-chain decomposition. |
| Role decomposition | A representation that satisfies a parent role by activating child roles. While decomposition is active, the parent role has no direct methods; each active child role must be represented by its own bundle or further decomposition. |
| Method | One selectable option inside a direct representation bundle. Method-year rows carry numeric inputs, outputs, costs, emissions, limits, evidence, assumptions, and validation notes. Canonical method kinds are `pathway`, `technology`, and `residual`. |
| Residual | Explicit coverage for activity, emissions, removals, or other accounting requirements that are not yet represented in richer detail. A residual is either a residual method in a bundle or a residual role in the topology. It is not hidden overlay logic. |
| Reporting allocation | A mapping from role or method activity to external reporting categories such as sector, subsector, NGA bucket, display group, or other accounting contexts. Reporting allocations do not create physical coverage, remove physical coverage, or define the role topology. |

## Canonical Names

| Previous term | Canonical term |
| --- | --- |
| `sector_trajectory_library` | `energy_system_representation_library` |
| `family_id` | `role_id` |
| `state_id` | `method_id` |
| `family_states.csv` | `method_years.csv` |
| `service_controls` | `role_controls` |
| `active_state_ids` | `active_method_ids` |
| `output_role` | `balance_type` |
| `SectorState` | `MethodYear` |

`sector` and `subsector` are not physical structure semantics in the canonical model. They may appear only as reporting or accounting categories through reporting allocations.

## Model Rules

1. Roles are the model-structure ontology.
2. A selected model structure must cover every required active role exactly once.
3. Every active role must have exactly one active representation.
4. A direct representation exposes methods for the active role and leaves child roles inactive.
5. A role-decomposition representation deactivates parent direct methods and activates required child roles.
6. Residual coverage must be explicit in the topology or method set.
7. Reporting allocations must not define topology or physical coverage.
8. The final ESRL 1.0 package must not expose `family_id`, `state_id`, sector, or subsector as canonical physical-structure fields.

## Consequences

The next ESRL library issues should use this decision as the naming contract:

- `simple-msm-esrl-1.2` defines role topology and reporting mappings with sector and subsector kept in reporting allocation data only.
- `simple-msm-esrl-1.3` defines representation and method schemas using `role_id`, `representation_id`, `method_id`, and method-year terminology.
- `simple-msm-esrl-1.4` migrates current library data without preserving final compatibility aliases for family or state terminology.
