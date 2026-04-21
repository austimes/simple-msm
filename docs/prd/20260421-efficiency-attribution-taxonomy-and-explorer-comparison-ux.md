# Efficiency Attribution Taxonomy And Explorer Comparison UX

This note closes `2x23.1` and is the source of truth for `2x23.2`, `2x23.3`, `2x23.4`, and `2x23.5`.

Use it to keep Explorer and Library on one efficiency story without introducing a second analysis mode.

## 1. Decision Summary

- Explorer and Library share one canonical efficiency taxonomy.
- Explorer keeps the existing Base-plus-Focus comparison workflow in the workspace. There is no separate efficiency page, tab, or mode.
- Library shows efficiency as first-class family artifacts plus explicit embodied-efficiency annotations on pathway states.
- Explorer only shows efficiency attribution charts when the Base and Focus pair is attribution-safe.
- Existing explanation tags remain heuristic explanatory language. They are not the canonical efficiency taxonomy.

## 2. Shared Canonical Taxonomy

Use the same four user-facing categories everywhere efficiency is surfaced in the product.

| canonical inventory status | Explorer and Library label | what it means | canonical source |
| --- | --- | --- | --- |
| `autonomous_efficiency_track` | `Autonomous efficiency` | Background exogenous drift that applies automatically to the same pathway choice. | `autonomous_efficiency_tracks.csv` rows and the canonical inventory accepted list. |
| `pure_efficiency_overlay` | `Pure efficiency package` | Endogenous carrier-preserving retrofit, recovery, or equipment-side package. | `efficiency_packages.csv` rows with `classification=pure_efficiency_overlay`. |
| `operational_efficiency_overlay` | `Operational efficiency package` | Endogenous controls, tuning, scheduling, or management-side package. | `efficiency_packages.csv` rows with `classification=operational_efficiency_overlay`. |
| `embodied_in_pathway_state` | `Embodied efficiency in pathway choice` | Efficiency gain that only exists because the pathway state itself changes technology, carrier, or process route. | Section 3 of [20260420-canonical-efficiency-inventory.md](./20260420-canonical-efficiency-inventory.md). |

The following canonical inventory statuses are scope decisions, not Explorer comparison categories:

- `no_material_v1`
- `deferred_or_not_modeled_v1`

Those two statuses can appear in Library copy, search, or future filters, but they must not appear as Explorer attribution buckets.

## 3. Mapping Rules For Implementation

### 3.1 Explorer Mapping Rules

- `NormalizedSolverRowProvenance.autonomousTrackIds` is the canonical signal for `Autonomous efficiency`.
- `NormalizedSolverRowProvenance.kind === 'efficiency_package'` plus `packageClassification === 'pure_efficiency_overlay'` maps to `Pure efficiency package`.
- `NormalizedSolverRowProvenance.kind === 'efficiency_package'` plus `packageClassification === 'operational_efficiency_overlay'` maps to `Operational efficiency package`.
- `Embodied efficiency in pathway choice` must come from a small machine-readable registry derived from Section 3 of [20260420-canonical-efficiency-inventory.md](./20260420-canonical-efficiency-inventory.md). Do not infer it from generic explanation heuristics.

### 3.2 What Is Not Canonical

The rules in `web/src/app_config/explanation_tag_rules.json` are useful descriptive heuristics, but they are not the category taxonomy for this feature.

Specifically:

- `efficiency_improvement` is too broad to stand in for the canonical efficiency categories.
- `electrification`, `fossil_to_*_switch`, `ccs_or_sequestration`, and similar tags remain secondary explanatory language, not primary efficiency buckets.
- `rollout_cap_binding`, `incumbent_lock_in`, and `exploratory_dependence` remain diagnostics, not attribution categories.

### 3.3 Solver Rows Versus Residual Overlays

The v1 efficiency attribution surface should use solver-side contribution rows only.

Residual overlay rows stay out of the efficiency taxonomy because:

- they are not authored as efficiency artifacts,
- matching residual-overlay settings are part of the attribution-safe comparison rule,
- and identical overlay settings should imply zero overlay delta in supported comparisons.

Absolute Explorer charts can continue to show the existing full totals. The new efficiency attribution section should stay focused on solver-side pathway and package effects.

## 4. Attribution-Safe Explorer Pairs

Explorer supports two levels of comparison.

### 4.1 Descriptive Comparison

Any solved Base-plus-Focus pair can keep using the current absolute charts and generic differencing context.

This is the existing Explorer comparison behavior and should remain available.

### 4.2 Efficiency Attribution Comparison

The dedicated efficiency attribution section is only available when Base and Focus share the same non-efficiency scenario backbone.

In v1, the pair is attribution-safe only when the two configuration documents match after removing:

- `name`
- `description`
- `efficiency_controls`
- `app_metadata`

That means the pair must match on:

- `years`
- `service_controls`
- `service_demands`
- `demand_generation`
- `external_commodity_demands`
- `commodity_pricing`
- `carbon_price`
- `residual_overlays`
- `presentation_options`
- `solver_options`

This deliberately matches the backbone discipline already locked for the reference comparison trio in [20260421-builtin-configuration-replacement-matrix.md](./20260421-builtin-configuration-replacement-matrix.md) and tested in `web/test/referenceEfficiencyConfigs.test.mjs`.

The practical reading is:

- changing efficiency controls is allowed,
- changing the saved scenario backbone is not,
- and arbitrary user-edited Base-versus-Focus pairs remain descriptive only.

## 5. Minimum Explorer Comparison Views

### 5.1 Placement In The Existing Workspace

- Keep the current Base-plus-Focus hero panel in `web/src/components/workspace/ConfigurationWorkspaceCenter.tsx`.
- Keep the current absolute demand, emissions, fuel, pathway, removals, and fuel-switching surfaces.
- Add one follow-on `Efficiency attribution` section inside the same page when the pair is attribution-safe.

### 5.2 Required Metric Views

The minimum v1 section contains three year-by-year comparison views, all using `Focus - Base` deltas and the same four taxonomy categories:

- `Fuel delta by efficiency attribution` in `PJ`
- `Emissions delta by efficiency attribution` in `tCO2e`
- `Cost delta by efficiency attribution` in `AUD`

The cost view may aggregate total cost deltas in the main chart. If a per-component split is needed, it should live in hover or a compact detail table rather than a fourth headline chart.

### 5.3 Relationship To Fuel Switching

`Fuel switching by fuel pair` stays as a supplementary comparison diagnostic.

It is still useful because it answers a different question:

- efficiency attribution asks which canonical efficiency category moved fuel, emissions, or cost,
- fuel-switching asks which fuels replaced which other fuels.

Do not replace the fuel-switching chart with efficiency buckets, and do not treat fuel-switch pairs as the canonical taxonomy.

### 5.4 Empty And Unsupported States

When Base comparison is disabled or unsolved, keep today’s behavior and show no efficiency attribution section.

When the pair is solved but not attribution-safe:

- keep the absolute Explorer charts,
- hide the efficiency attribution section,
- show a short status message that the pair supports descriptive differencing only because the scenario backbone differs.

## 6. Library Surface Rules

Library should use the same taxonomy, but it presents artifacts rather than pairwise deltas.

### 6.1 Family Detail Structure

Add one `Efficiency artifacts` section to the existing family detail flow on `web/src/pages/LibraryPage.tsx`.

That section should show, in this order:

1. Autonomous efficiency tracks
2. Pure efficiency packages
3. Operational efficiency packages
4. Embodied-efficiency notes on relevant pathway states

### 6.2 Artifact Presentation Rules

- Autonomous tracks and efficiency packages are first-class objects with their own year coverage, applicability, affected commodities, evidence, confidence, and rollout notes.
- Embodied efficiency is never shown as a package card.
- Embodied efficiency is shown on the relevant pathway states as a badge, note, or callout linked to the canonical embodied concept.
- The same labels used in Explorer must appear in Library copy so users do not have to translate between surfaces.

## 7. Explicit Non-Goals

- No second Explorer interaction model for efficiency.
- No reuse of heuristic explanation tags as the canonical taxonomy.
- No attempt to make arbitrary Base-versus-Focus edits look causally attributable in v1.
- No relabeling of fuel switching, CCS, removals, or structural change as efficiency categories.
- No fake package objects for embodied pathway-state effects.

## 8. Follow-On Issue Guidance

- `2x23.2` should implement the attribution-safe pair check, the shared category reducer, the embodied-state registry, and the three comparison views defined above.
- `2x23.3` should implement the Library `Efficiency artifacts` section using the same taxonomy and the same embodied-state registry.
- `2x23.4` should extend search and filters using the same artifact classes rather than inventing new filter-only names.
- `2x23.5` should remove or downgrade legacy explanation language that conflicts with this taxonomy.
