# Canonical Efficiency Authoring Shape And V1 Non-Goals

This decision locks the v1 authored shape for first-class efficiency artifacts in the canonical package.

Use this document when authoring or reviewing efficiency implementation work. If another efficiency note proposes a different file path, row grain, applicability convention, or compatibility layer, this document wins.

## 1. Decision Summary

- Efficiency is authored only through family-local package files under `sector_trajectory_library/families/<family_id>/`.
- V1 introduces exactly two new family-local hand-authored tables:
  - `autonomous_efficiency_tracks.csv`
  - `efficiency_packages.csv`
- Both tables use one row per authored id per milestone year.
- Applicability is always an explicit list of concrete `state_id`s.
- Residual overlays, generated legacy exports, and parallel compatibility shapes are not efficiency authoring surfaces.
- V1 does not include a general package stacking engine. The only interaction primitive allowed in authored rows is an optional family-local non-stacking group.

## 2. Canonical Package Path

The canonical path from research to implementation is:

1. research notes identify candidates and deferrals,
2. [20260420-canonical-efficiency-inventory.md](./20260420-canonical-efficiency-inventory.md) decides which ids are accepted for v1,
3. accepted items are authored into `sector_trajectory_library/families/<family_id>/autonomous_efficiency_tracks.csv` or `sector_trajectory_library/families/<family_id>/efficiency_packages.csv`,
4. family `README.md` and `validation.md` files carry any family-specific caveats and checks,
5. loader, solver, validation, and any legacy export machinery consume those family-local rows.

There is no second canonical path for efficiency through `overlays/residual_overlays.csv`, `exports/legacy/*.csv`, or ad hoc global efficiency tables under `shared/`.

## 3. Filenames And Row Grain

| artifact | location | row grain | purpose |
| --- | --- | --- | --- |
| `autonomous_efficiency_tracks.csv` | `sector_trajectory_library/families/<family_id>/` | one row per `track_id` and milestone `year` | Exogenous year-specific efficiency drift that applies automatically to the listed base states. |
| `efficiency_packages.csv` | `sector_trajectory_library/families/<family_id>/` | one row per `package_id` and milestone `year` | Endogenous pure or operational package data for separable efficiency measures the model may choose. |

Use the same milestone-year set as `family_states.csv`: `2025`, `2030`, `2035`, `2040`, `2045`, `2050`.

The row grain is deliberately family-local and year-local. Do not introduce:

- one shared repo-wide efficiency table,
- a separate applicability crosswalk file,
- a separate interaction matrix,
- a separate old-shape compatibility copy of the same rows.

## 4. Required Fields

The required fields below are the v1 minimum. Keep the authored shape small and concrete.

### `autonomous_efficiency_tracks.csv`

Every row must include:

- `family_id`
- `track_id`
- `year`
- `track_label`
- `track_description`
- `applicable_state_ids` — JSON-encoded string array of explicit `state_id`s
- `affected_input_commodities` — JSON-encoded string array
- `input_multipliers` — JSON-encoded numeric array aligned to `affected_input_commodities`
- `delta_output_cost_per_unit`
- `cost_basis_year`
- `currency`
- `source_ids` — JSON-encoded string array
- `assumption_ids` — JSON-encoded string array
- `evidence_summary`
- `derivation_method`
- `confidence_rating`
- `double_counting_guardrail`
- `review_notes`

V1 assumption: a track row expresses drift relative to the de-embedded base state coefficients for that same family and year. Authoring should therefore include a neutral `2025` row rather than a separate compatibility layer.

### `efficiency_packages.csv`

Every row must include:

- `family_id`
- `package_id`
- `year`
- `package_label`
- `package_description`
- `classification` — `pure_efficiency_overlay` or `operational_efficiency_overlay`
- `applicable_state_ids` — JSON-encoded string array of explicit `state_id`s
- `affected_input_commodities` — JSON-encoded string array
- `input_multipliers` — JSON-encoded numeric array aligned to `affected_input_commodities`
- `delta_output_cost_per_unit`
- `cost_basis_year`
- `currency`
- `max_share`
- `rollout_limit_notes`
- `source_ids` — JSON-encoded string array
- `assumption_ids` — JSON-encoded string array
- `evidence_summary`
- `derivation_method`
- `confidence_rating`
- `review_notes`

The only optional interaction field allowed in v1 is:

- `non_stacking_group` — plain string used only to say that overlapping packages in the same family must not stack on the same slice of activity

Do not add `exclusive_with`, `bounded_stack`, `interaction_family`, `precomposed_bundle_id`, or any other generic interaction framework in v1.

## 5. Applicability And Naming Conventions

- `family_id` must match the folder that owns the file.
- `track_id` and `package_id` should keep the family-local ids already accepted in [20260420-canonical-efficiency-inventory.md](./20260420-canonical-efficiency-inventory.md).
- `applicable_state_ids` must be explicit. No wildcards, prefixes, regex rules, or inverse applicability such as "all states except".
- If an item applies to multiple states in one family, list every `state_id` directly in the row.
- If an item would require cross-family applicability, it is out of scope for v1 and should stay deferred.
- `affected_input_commodities` must target concrete commodities already present in the package taxonomy. If the effect cannot be explained as commodity-level multipliers on existing state rows, it should remain embodied in the pathway state or deferred.
- `background_*_drift` names are reserved for autonomous tracks.
- `*_retrofit`, `*_upgrade`, `*_recovery`, and `*_preheating` names are reserved for pure packages.
- `*_tuning`, `*_control`, `*_optimisation`, and `*_telematics_eco_driving` names are reserved for operational packages.

## 6. Explicit V1 Non-Goals

The following are explicit non-goals for v1 efficiency authoring:

- No reuse of `overlays/residual_overlays.csv` for efficiency effects.
- No hand-authored efficiency inputs under `exports/legacy/`.
- No parallel old/new efficiency shapes maintained for compatibility.
- No shared repo-wide `autonomous_efficiency_tracks.csv` or `efficiency_packages.csv` under `shared/`.
- No package stacking engine, interaction matrix, or bundle-composition subsystem.
- No cross-family package rows.
- No placeholder rows for `no_material_v1` families.
- No attempt to preserve older prototype machinery if the canonical package path can now carry the efficiency concept directly.

If a candidate measure needs any of the above, the correct v1 action is to keep it embodied in pathway states or leave it explicitly deferred.

## 7. Relationship To Existing Docs

- [20260420-sector_state_library_efficiency_expansion_proposal.md](./20260420-sector_state_library_efficiency_expansion_proposal.md) still explains the conceptual classes and attribution logic, but its more exploratory schema sketches do not override this v1 authoring decision.
- [20260420-canonical-efficiency-inventory.md](./20260420-canonical-efficiency-inventory.md) decides which ids are accepted, embodied, deferred, or intentionally blank.
- `sector_trajectory_library/README.md` should treat these family-local efficiency files the same way it treats `family_states.csv`: as canonical authored inputs rather than generated compatibility surfaces.
