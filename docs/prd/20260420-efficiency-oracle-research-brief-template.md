# Efficiency Research Oracle Brief Template

This document is the shared brief for Oracle-assisted research that supports the efficiency expansion proposed in [20260420-sector_state_library_efficiency_expansion_proposal.md](./20260420-sector_state_library_efficiency_expansion_proposal.md).

Use this template when opening a separate Oracle thread for a sector cluster, family, or specific efficiency measure.

## Purpose

Produce research outputs that are directly usable for authored additions to the canonical sector trajectory library. Each Oracle run should determine which efficiency effects should be modeled as:

- autonomous efficiency tracks,
- endogenous pure efficiency packages,
- endogenous operational efficiency packages,
- embodied efficiency within pathway states, or
- rejected / deferred candidates.

The output must be specific to the current repository structure and current family/state definitions.

## Repo Context

The Oracle should ground its work in these repo artifacts:

- `docs/prd/20260420-sector_state_library_efficiency_expansion_proposal.md`
- `sector_trajectory_library/README.md`
- the relevant family folders under `sector_trajectory_library/families/<family_id>/`
- the relevant `family_states.csv`, `README.md`, and `validation.md` files

If the research is intended to inform implementation details, the Oracle may also read:

- `web/src/data/types.ts`
- `web/src/data/packageLoader.ts`
- `web/public/app_config/configuration_schema.json`

## Scope Rules

The Oracle must classify candidates using these rules:

1. Treat a measure as an autonomous efficiency track only if it is an exogenous background improvement that should apply without an optimization choice.
2. Treat a measure as an endogenous pure efficiency package only if it reduces inputs per unit of service/output without changing the principal carrier or process route.
3. Treat a measure as an endogenous operational efficiency package only if it mainly improves performance through controls, utilization, scheduling, management, tuning, or operations.
4. Treat a measure as embodied in pathway states if the efficiency effect is inseparable from technology switching, fuel switching, or process-route change.
5. Reject or defer measures that are really structural demand change, product mix change, mode shift, CCS, methane capture, removals, or other non-efficiency abatement.

## Prototype Constraints

The repository is still a prototype. Research outputs must respect these design constraints:

1. Do not preserve backward compatibility with old prototype machinery unless the current shipped repo still depends on it.
2. Do not propose parallel old/new data shapes for efficiency.
3. Do not rely on residual overlays for efficiency modeling.
4. Keep v1 simple: no package stacking engine unless the case is overwhelming.
5. Prefer measures that can fit a reduced-form row-based LP by applying multipliers or additive deltas to existing state coefficients.

## Screening Rubric

For each candidate measure, score and discuss:

1. Materiality at the Australia sector/subsector scale.
2. Evidence quality and source coverage.
3. Separability from route-switching or structural change.
4. Adoptability, including any realistic rollout or turnover limit.
5. Comparability against other measures in the modeled choice set.
6. Attributability in reporting.

If the candidate fails on separability or attributability, it should usually be classified as embodied in pathway states or rejected.

## Required Output Structure

Each Oracle response should use the following sections.

### 1. Recommendation Summary

Provide a short summary of:

- accepted autonomous tracks,
- accepted pure efficiency packages,
- accepted operational efficiency packages,
- effects that should remain embodied in pathway states,
- rejected or deferred candidates.

### 2. Applicability Mapping

Map every accepted item to the current repo structure:

- `family_id`
- specific `state_id`s if the measure is not family-wide
- any excluded states and why they are excluded

Avoid vague statements like "applies to buildings" if the repo contains more specific family or state boundaries.

### 3. Candidate Register

For each candidate, provide a row or subsection containing:

- `candidate_name`
- `classification`
- `family_ids`
- `state_ids` or `all_states_in_family`
- `affected_inputs`
- `affected_cost_fields`
- `affected_process_emissions` if relevant
- `suggested_years`
- `effect_size` or multiplier / delta range
- `cost_basis`
- `rollout_limit_logic`
- `sources`
- `confidence`
- `rationale`

### 4. Rejected Or Deferred Items

For each rejected or deferred candidate, include:

- `candidate_name`
- `reason_code`
- `explanation`
- `if_deferred`, what future modeling capability would be needed

Recommended reason codes:

- `embodied_route_change`
- `structural_demand_change`
- `non_efficiency_abatement`
- `insufficient_evidence`
- `not_material_for_v1`
- `requires_interaction_engine`

### 5. Draft Authoring Guidance

Provide concrete guidance for how the accepted items should be authored into the package, including:

- proposed `track_id` or `package_id`
- whether the item should be family-local
- the likely fields needed in `autonomous_efficiency_tracks.csv` or `efficiency_packages.csv`
- suggested notes for family `README.md`
- suggested checks for family `validation.md`

### 6. Open Questions

List only the questions that block authoring or materially affect model behavior.

## Output Quality Bar

The Oracle output is only complete if it is:

1. grounded in the current repo family/state structure,
2. explicit about what is modeled versus excluded,
3. source-backed,
4. specific enough that a follow-on implementation issue can author the rows without redoing the research.

## Copy-Paste Oracle Prompt Template

Replace the bracketed fields before use.

```text
Review the efficiency expansion proposal and the current repo family definitions for [SECTOR CLUSTER OR MEASURE]. Develop a research recommendation for which efficiency effects should be modeled in the prototype library.

Read at minimum:
- docs/prd/20260420-sector_state_library_efficiency_expansion_proposal.md
- sector_trajectory_library/README.md
- [RELEVANT FAMILY FILES]

Optional implementation context if useful:
- web/src/data/types.ts
- web/src/data/packageLoader.ts
- web/public/app_config/configuration_schema.json

Use the following classification buckets:
- autonomous efficiency track
- endogenous pure efficiency package
- endogenous operational efficiency package
- embodied in pathway state
- rejected/deferred

Hard constraints:
- this is a prototype, so do not preserve old machinery for compatibility
- do not use residual overlays for efficiency
- prefer measures that can fit a reduced-form row-based LP without a package stacking engine
- do not classify structural demand change, product-mix change, CCS, methane capture, removals, or route-switching effects as portable efficiency packages

For each candidate, assess:
- materiality
- evidence quality
- separability
- adoptability / rollout limits
- comparability
- attributability

Return your answer with these sections:
1. Recommendation summary
2. Applicability mapping to current family_id/state_id structure
3. Candidate register with effect sizes, costs, rollout logic, sources, confidence, and rationale
4. Rejected or deferred items with reason codes
5. Draft authoring guidance for autonomous_efficiency_tracks.csv / efficiency_packages.csv and README/validation notes
6. Open questions

Be explicit about which measures remain embodied in pathway states rather than being modeled as packages.
```
