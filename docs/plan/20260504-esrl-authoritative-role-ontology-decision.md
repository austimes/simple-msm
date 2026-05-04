## ESRL Authoritative Role Ontology Decision

Date: 2026-05-04

Status: accepted for `esrl-ontology-v2`

Follow-up epic: `simple-msm-f759` (`[esrl-ontology-v2 00] Epic: Make roles authoritative and collapse residual layering`)

## Decision

The canonical ESRL ontology is role-first.

- **Role** is the authoritative coverage object.
- **Representation** is how a role is modeled.
- **Method** is a selectable option inside a direct representation.
- **Topology** is derived from roles plus lightweight grouping metadata where grouping is genuinely useful.

Residual is no longer a first-class type repeated across roles, methods, and physical nodes. Residual placeholder semantics live at the representation layer through `representation_kind = residual_stub`.

Physical nodes that exist only as 1:1 wrappers around roles are not canonical ontology. They must be removed or reduced to grouping-only navigation data.

## Problem

The current library allows the same conceptual object to appear as:

- a physical node in `shared/physical_system_nodes.csv`
- a role in `shared/roles.csv`
- a representation in `shared/representations.csv`
- a method in `roles/<role_id>/methods.csv`

This is most visible for residual coverage, where the same fact is currently encoded in multiple places at once, including:

- `node_kind = residual_anchor`
- `membership_kind = residual_role`
- `role_kind = residual`
- `balance_type = residual_accounting`
- `coverage_obligation = explicit_residual_top_level`
- `direct_method_kind = residual`
- `method_kind = residual`
- `is_residual = true`

That layering makes users ask which object is authoritative. In many cases the practical answer is "the role, plus several duplicate wrappers," which is not acceptable as a canonical model.

## Target Model

### Roles

A role is the thing the system must cover, supply, convert, remove, or account for.

Roles remain first-class because they carry:

- semantic meaning
- units
- topology position
- activation rules

Roles are authoritative even when the current implementation is a coarse placeholder.

Examples:

- `move_passengers_by_rail` remains a rail mobility role even if it is currently modeled as a stub.
- `supply_domestic_gas` remains a gas-supply role even if it is currently modeled as a stub.
- `account_grid_losses_and_own_use` remains an accounting role because the obligation itself is accounting-shaped.

### Representations

A representation is one available way to model an active role.

Canonical representation kinds are:

- `pathway_bundle`
- `technology_bundle`
- `role_decomposition`
- `residual_stub`

`residual_stub` means the role exists as a real coverage obligation, but the current modeling is an explicit placeholder rather than a richer pathway or technology representation.

Residual is therefore a modeling choice, not a separate species of role or physical node.

### Methods

A method remains a selectable option inside a direct representation.

Methods do not carry independent residual ontology. If a direct representation is a `residual_stub`, the residual semantics come from the representation, not from duplicated method typing.

### Topology And Grouping

Role topology remains canonical.

Separate topology or navigation data may still exist, but only for genuinely non-role grouping nodes such as broad navigation clusters. Grouping data must not create a competing ontology of role anchors.

If a node corresponds 1:1 with a role and exists only to host that role in a tree, it should not survive as a separate first-class node.

## True Accounting Exceptions

Not every current residual-shaped role should be converted into a service or supply role.

Some obligations are genuinely accounting-oriented and should remain roles with accounting semantics. Examples include:

- grid losses and own use
- fugitive emissions
- land carbon stock change
- other explicit reconciliation or inventory obligations with no physical service/supply interpretation

The rule is:

- if the underlying obligation is physically or functionally meaningful, keep a semantic role and model it with `residual_stub` when needed
- if the underlying obligation is inherently accounting or reconciliation, keep it as an accounting role

"Residual" is not the test. The nature of the obligation is the test.

## Canonical Field Changes

### Roles

`shared/roles.csv` should move toward:

- keeping `role_id`, `role_label`, `description`, topology placement, output unit, and role semantics
- removing `role_kind`
- replacing residual-specific activation terminology with neutral activation terminology
- using a general accounting balance type for true accounting roles rather than a residual-only category used as a placeholder marker

Recommended direction:

| Current field | Current problem | Target direction |
| --- | --- | --- |
| `role_kind` | mixes ontology with model maturity | remove |
| `coverage_obligation = explicit_residual_top_level` | leaks residual semantics into activation | replace with neutral activation class such as `top_level` |
| `balance_type = residual_accounting` | often means "placeholder" rather than true accounting | reserve accounting balance types for genuine accounting roles only |
| `default_representation_kind` | duplicates representation defaults | remove when downstream code can derive the default from `representations.csv` |

### Representations

`shared/representations.csv` becomes the authoritative place for residual placeholder semantics.

| Current field | Current problem | Target direction |
| --- | --- | --- |
| `representation_kind` | lacks a residual placeholder concept | add `residual_stub` |
| `direct_method_kind` | duplicates the representation kind and leaks residual typing | remove |

### Methods

`roles/<role_id>/methods.csv` should keep method metadata, evidence, and presentation order, but stop repeating role or representation ontology.

| Current field | Current problem | Target direction |
| --- | --- | --- |
| `method_kind` | duplicates representation semantics | remove |
| `is_residual` | repeats residualness already implied by the representation | remove |

### Physical Nodes

`shared/physical_system_nodes.csv` must stop acting as a parallel ontology.

| Current field | Current problem | Target direction |
| --- | --- | --- |
| `node_kind = role_anchor` | duplicates roles | remove role-anchor semantics |
| `node_kind = residual_anchor` | duplicates residual semantics | remove residual-anchor semantics |
| `node_kind = intermediate_anchor` / `export_anchor` | often still role wrappers | keep only if they remain genuinely grouping-only, otherwise derive from roles |

If the surviving file becomes grouping-only, it should be treated as navigation metadata and may be renamed in a later cleanup to reflect that narrower purpose.

## Modeling Rules

1. Roles are the authoritative coverage ontology.
2. Every active role has exactly one active representation.
3. Direct representations expose methods.
4. Decomposition representations activate child roles and do not expose direct methods.
5. Residual placeholder semantics live at the representation layer.
6. Methods do not duplicate representation ontology.
7. Grouping data does not create or redefine coverage obligations.
8. Compatibility umbrella roles with no calibrated quantity should be removed rather than retained as visible ontology.

## Naming Guidance

When a role is a real coverage object, prefer names that describe the obligation rather than the placeholder treatment.

Examples:

- keep or move toward names like `move_passengers_by_rail` and `supply_domestic_gas`
- reserve `account_*` names for true accounting roles
- remove or rename umbrella rows whose only purpose is compatibility after richer split-outs land

## Migration Sequence

### Phase 1: Publish The Decision

Publish this note and use it as the contract for follow-on implementation.

### Phase 2: Simplify Shared Schemas

Update shared schemas to:

- remove role-level residual typing
- add `representation_kind = residual_stub`
- remove representation-level and method-level residual duplication
- reduce physical-node schema to grouping-only semantics if the file remains

### Phase 3: Migrate Shared Data

Reclassify current roles into three buckets:

- real coverage roles with placeholder modeling
- true accounting roles
- compatibility umbrellas to remove

Real coverage roles should keep their semantic role identity and move placeholder treatment to `residual_stub` representations.

### Phase 4: Migrate Method Data And Validation

Remove duplicated method residual fields and update validation to enforce the new invariants.

### Phase 5: Collapse Physical Anchors

Remove 1:1 anchor nodes that mirror roles. Keep only grouping/navigation nodes that are genuinely non-authoritative.

### Phase 6: Cut Over The UI

Present roles as the primary tree and show representation choice explicitly through labels such as:

- Pathway bundle
- Technology bundle
- Decomposition
- Residual stub

### Phase 7: Remove Compatibility Debris

Delete obsolete compatibility rows, transforms, and explanations once the migrated ontology is live.

## Examples

### Example: Placeholder Transport Role

Current pattern:

- role is typed as residual
- representation is typed as pathway bundle with residual direct method kind
- method is typed as residual and flagged `is_residual = true`

Target pattern:

- role remains `move_passengers_by_rail`
- role keeps transport semantics and transport unit
- default representation becomes `move_passengers_by_rail__residual_stub`
- representation kind is `residual_stub`
- method row contains only ordinary method metadata

### Example: True Accounting Role

Current and target intent for something like grid losses should stay accounting-shaped:

- role remains an explicit accounting obligation
- role uses accounting semantics because the obligation is genuinely accounting-oriented
- representation may still be a `residual_stub` if the modeling is placeholder, but the role is not relabeled as a service or supply role that it is not

## Alternatives Considered

### Keep Residual As A First-Class Role Kind

Rejected.

This preserves the main conceptual bug: it makes model maturity look like ontology. A rail role, gas-supply role, or water-service role should not become a different kind of system object merely because it is currently modeled coarsely.

### Keep Physical Nodes As A Parallel First-Class Layer

Rejected as the default.

The current data shows many physical nodes are effectively 1:1 wrappers around roles. Keeping both layers first-class would preserve the source-of-truth ambiguity the project is trying to remove. If future topology diverges in a meaningful way, it can be reintroduced deliberately with a clearer contract, not preserved implicitly through duplicated anchors.

## Consequences

This decision intentionally favors a clearer public ontology over preserving current schema shape.

Expected consequences:

- smaller and clearer shared schemas
- less residual-specific duplication across the library
- cleaner UI framing
- some data and validator churn during migration
- likely deletion or renaming of compatibility artifacts that no longer carry meaning

The library should treat that churn as acceptable. The project is still discovering the right abstraction and does not need to preserve the current overlapping ontology.

## Update Note (2026-05-04)

The cluster navigation layer (`shared/physical_system_nodes.csv`,
`shared/role_memberships.csv`, and the parallel physical-edge data) was
removed in the `esrl-clusters-v1` epic (merge commit `747ff8c`).

After that landing:

- Roles in `shared/roles.csv` are the sole authoritative ontology.
- Browse grouping is driven by `topology_area_id` and
  `topology_area_label` columns on roles, not by a separate cluster
  layer.
- The migration phases above that called for collapsing 1:1 anchor
  nodes are effectively complete for the cluster surface; remaining
  ontology work focuses on residual / representation cleanup rather
  than physical-node removal.
