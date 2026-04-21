# Proposed Expansion to the Sector State Library: Efficiency Extension

## Purpose

Phase 1 established a year-indexed sector state library in which each sector state carries output cost, input coefficients, and emissions coefficients. This proposal adds an explicit treatment of **autonomous efficiency** and **endogenous efficiency** so that the model can:

1. attribute changes in energy, cost, and emissions to efficiency effects,
2. distinguish pure efficiency from technology/fuel switching,
3. support progressively richer optimization without breaking the reduced-form sector-state architecture, and
4. preserve a clean path toward later expansion into explicit TIMES / VedaLang process structure.

The consolidated first-wave accepted inventory, embodied items, and explicit v1 deferrals now live in [20260420-canonical-efficiency-inventory.md](./20260420-canonical-efficiency-inventory.md).

The canonical v1 filenames, row grain, required fields, applicability rules, and explicit non-goals now live in [20260420-efficiency-authoring-shape-decision.md](./20260420-efficiency-authoring-shape-decision.md). That decision document wins over the more exploratory schema sketches later in this proposal.

The shared Explorer and Library efficiency taxonomy plus the Base-versus-Focus comparison UX rules now live in [20260421-efficiency-attribution-taxonomy-and-explorer-comparison-ux.md](./20260421-efficiency-attribution-taxonomy-and-explorer-comparison-ux.md).

The key design decision is:

> Efficiency must not exist only as a hidden ingredient inside year-specific sector states.

Some efficiency improvement should remain embedded in baseline year-to-year state evolution, but it must also be represented explicitly enough that the model can attribute impacts to:

- autonomous efficiency,
- endogenous pure efficiency,
- operational efficiency,
- embodied efficiency within technology switching.

---

## Core design principle

For each sector, keep the existing **base sector states** as the main pathway objects, and add two new layers:

1. **Autonomous efficiency tracks**: exogenous year-by-year adjustments that apply regardless of model choice.
2. **Endogenous efficiency packages**: optional measures the model may choose, where those measures are sufficiently separable from the base state.

This yields a practical decomposition:

- **Base sector state** = main pathway / route / carrier configuration.
- **Autonomous track** = exogenous drift already assumed to happen.
- **Endogenous package** = additional efficiency the model may buy.

Some efficiency cannot be represented as a package because it is inseparable from the underlying technology choice. That class remains inside the **sector state itself** and is reported as **embodied efficiency in technology switching**.

---

## Proposed classes of efficiency and related effects

### Class A. Autonomous efficiency drift

**Definition**

Exogenous improvement in energy intensity, loss rates, or operating efficiency that is assumed to occur even if the model does not actively choose additional efficiency.

**Examples**

- residential appliance stock gradually becoming more efficient under standards and normal turnover,
- background improvement in boiler and motor efficiency in industry,
- gradual vehicle fuel economy improvement in conventional fleets,
- background reduction in network losses,
- baseline process control and housekeeping improvements already assumed in sector forecasts.

**Why it is different**

This is not chosen by the optimizer. It is a scenario assumption.

**State-library implication**

Autonomous improvement should not only be buried inside year-specific state coefficients. The library should add an explicit object that records the autonomous adjustment itself.

**Recommended representation**

Add an `autonomous_efficiency_track` entity with fields such as:

- `sector`
- `state_family` or `applicability`
- `metric_affected` (input coefficient, loss factor, process yield, etc.)
- `reference_year`
- `multiplier_by_year`
- `cost_adjustment_by_year` if material
- `source/provenance`
- `confidence`
- `notes on what is included`

This allows attribution by comparing:

- the realized scenario, versus
- an `autonomous_off` counterfactual in which the same state family is used but the autonomous multipliers are frozen at the reference year.

**Model implementation**

Autonomous efficiency is applied before endogenous choices. It is not optimized.

---

### Class B. Endogenous pure efficiency overlays

**Definition**

Measures that reduce the energy or material input required per unit of output/service **without changing the principal carrier or core process route**.

**Examples**

- residential shell retrofit,
- better windows and airtightness,
- hot-water efficiency upgrades,
- industrial insulation,
- condensate return,
- waste heat recovery,
- efficient motors and variable speed drives,
- compressed-air leak reduction,
- better grinding efficiency,
- irrigation pump efficiency.

**Why it is different**

These measures are materially modelable as endogenous because they are often:

- economically meaningful,
- supported by identifiable literature and engineering data,
- adoptable within stock/turnover constraints,
- separable enough to apply across more than one base state.

**State-library implication**

These should be represented as **overlays** rather than new pathway states, provided they are sufficiently separable.

**Recommended representation**

Add an `efficiency_package` entity with fields such as:

- `package_id`
- `sector`
- `class = pure_efficiency_overlay`
- `applicable_state_families`
- `years`
- `affected_inputs`
- `input_multipliers_by_year`
- `delta_cost_by_year`
- `delta_process_emissions_by_year` if relevant
- `max_share` / `max_activity` / `rollout_limit`
- `stock_turnover_rule`
- `interaction_family`
- `attribution_tag = endogenous_pure_efficiency`
- `sources, assumptions, confidence`

**Model implementation**

The model chooses whether to apply the overlay to part of the activity served by a base state.

---

### Class C. Endogenous operational / control efficiency overlays

**Definition**

Measures that improve performance via operation, controls, dispatch, utilization, or management rather than major equipment replacement.

**Examples**

- smart thermostat and building control optimization,
- commissioning and HVAC tuning,
- eco-driving and logistics optimization,
- industrial advanced control systems,
- maintenance regimes that improve heat rate or reduce losses,
- irrigation scheduling and smarter pumping operation.

**Why it is different**

These often have:

- lower capital intensity,
- faster rollout,
- shorter persistence or rebound risk,
- stronger dependence on behavior and management quality.

They are still materially modelable, but they should usually be a separate subclass because their uptake logic differs from capital retrofit packages.

**State-library implication**

Represent as **overlays**, but in a distinct subclass with different uptake rules and evidence handling.

**Recommended representation**

Use the same `efficiency_package` structure, but with:

- `class = operational_efficiency_overlay`
- optional `persistence_factor`
- optional `rebound_flag`
- optional `measurement_uncertainty`

**Model implementation**

Operational packages are chosen similarly to pure efficiency overlays, but with separate rollout caps, lower persistence assumptions, and potentially lower confidence.

---

### Class D. Embodied efficiency in pathway states

**Definition**

Efficiency improvement that is inseparable from changing the main technology, carrier, or process route.

**Examples**

- gas heating to heat pump,
- ICE vehicle to EV,
- conventional process route to electric or hydrogen route,
- incandescent/fluorescent lighting to LED service systems,
- resistance heating to heat pump drying,
- BF-BOF to scrap EAF or H2-DRI.

**Why it is different**

This is not a portable overlay. The efficiency improvement comes bundled with:

- a different carrier set,
- a different emissions profile,
- a different temporal load shape,
- different infrastructure dependencies,
- different feasible rollout dynamics.

**State-library implication**

These must be represented as **separate pathway states**, not overlays.

**Model implementation**

The model chooses among pathway states directly. Any efficiency gain associated with that choice is attributed to **embodied efficiency in technology/fuel switching**, not to pure efficiency overlays.

---

### Class E. Non-efficiency changes that should not be misclassified

These should be tracked, but not as efficiency packages.

#### E1. Activity / structural change

Examples:

- smaller heated floor area,
- reduced travel demand,
- freight mode shift,
- less steel demand per unit of building output,
- lower clinker demand through material substitution.

These change service or material demand composition. They are not efficiency in the narrow sense and should live in demand / structural modules.

#### E2. Emissions reduction without energy-efficiency improvement

Examples:

- CCS,
- methane capture,
- non-CO2 abatement,
- carbon removals.

These affect emissions, not service energy intensity. They require their own class.

---

## Decision rule: overlay or separate pathway state?

A measure should be an **overlay** if most of the following are true:

1. The principal output/service is unchanged.
2. The core carrier set and process route remain substantially the same.
3. The effect can be approximated as a multiplier or additive delta on existing coefficients.
4. The measure can apply across multiple base states in a reasonably consistent way.
5. Infrastructure and load-shape implications are small or second-order.
6. Adoption can be represented with package-level rollout bounds.

A measure should be a **separate pathway state** if one or more of the following are true:

1. It changes the dominant carrier or route.
2. It changes process emissions structurally.
3. It materially changes temporal load shape or flexibility.
4. It requires dedicated infrastructure or different stock accounting.
5. The interaction with the base state is strong and non-separable.
6. The effect cannot be credibly represented as a simple multiplier on coefficients.

---

## How autonomous efficiency should be represented for attribution

### Recommended approach

Do **not** rely only on year-indexed base states whose coefficients already include autonomous improvement. That is acceptable for realism, but insufficient for attribution.

Instead, decompose each affected coefficient into:

- a reference state coefficient,
- an autonomous multiplier,
- an endogenous package multiplier or delta.

Conceptually:

`final coefficient = reference coefficient × autonomous multiplier × endogenous multiplier(s)`

and

`final cost = reference cost + autonomous cost adjustment + endogenous package cost adjustment + interaction adjustments`

This does not require abandoning the existing Phase 1 library. It can be added as an expansion layer.

### Practical implementation

For each sector state family and metric, store:

- `reference_coefficient`
- `autonomous_multiplier_by_year`
- optional `autonomous_cost_adjustment_by_year`

The existing year-specific state coefficients can still be retained as the realized coefficients. The new layer simply records the decomposition needed for attribution.

### Attribution method

To attribute autonomous efficiency, run a counterfactual with:

- the same scenario,
- the same sector-state choice structure,
- autonomous multipliers frozen at the reference year.

The difference between the realized case and the frozen-autonomous counterfactual is the contribution of autonomous efficiency.

---

## Proposed additions to the state-library schema

### 1. Base sector state (existing, retained)

Keep the current Phase 1 object:

- `sector`
- `state_id`
- `state_family`
- `year`
- `output_commodity`
- `output_cost_per_unit`
- `input_coefficients`
- `energy_emissions_coefficients`
- `process_emissions_coefficients`
- `max_share` / `max_activity` as applicable
- `sources / assumptions / confidence`

### 2. Autonomous efficiency track (new)

Add:

- `track_id`
- `sector`
- `state_family` or `applicability`
- `metric_type`
- `metric_name`
- `reference_year`
- `multiplier_by_year`
- `delta_cost_by_year` if material
- `source`
- `assumption_type`
- `confidence`
- `notes`

### 3. Efficiency package (new)

Add:

- `package_id`
- `sector`
- `class` (`pure_efficiency_overlay` or `operational_efficiency_overlay`)
- `years`
- `applicable_state_families`
- `affected_metrics`
- `input_multipliers_by_year`
- `delta_cost_by_year`
- `delta_process_emissions_by_year` if any
- `max_share_by_year`
- `max_rollout_rate_by_year`
- `stock_turnover_constraint`
- `interaction_family`
- `exclusive_with`
- `attribution_tag`
- `sources`
- `confidence`

### 4. Pathway-state attribution tag (new)

For each base sector state, add tags such as:

- `embodied_efficiency = true/false`
- `embodied_efficiency_notes`
- `fuel_switching = true/false`
- `process_route_change = true/false`

This supports reporting even when efficiency is inseparable from the state choice.

### 5. Interaction rules (new)

Some packages interact. Add a simple interaction structure:

- `interaction_family`
- `stacking_rule` (`exclusive`, `additive_delta`, `bounded_stack`, `precomposed_bundle`)

This avoids hidden double counting.

---

## How to use this in the model

## Mode 1. Accounting / scenario simulator

For each sector-year:

1. choose a base sector state,
2. apply the autonomous efficiency track automatically,
3. optionally apply selected endogenous efficiency packages,
4. compute final inputs, cost, and emissions,
5. propagate intermediate commodity demands through the system.

This is ideal for a fast web app or exploratory simulator.

---

## Mode 2. Reduced-form LP / master optimization

Decision variables:

- `x[s,t,k]` = share/activity using base sector state `k`
- `z[s,t,k,p]` = share/activity of state `k` receiving efficiency package `p`

Subject to:

- service demand balance,
- state shares summing appropriately,
- package only applied where allowed,
- rollout and uptake constraints,
- emissions budget or carbon price,
- any shared fuel/resource limits.

To stay LP-friendly, represent overlay effects as additive deltas relative to the base state, for example:

- `delta_input = base_input × (multiplier - 1)`
- `delta_cost = package cost increment`

Then total system inputs and costs are:

- base contribution from `x`
- plus package deltas from `z`

This works well when packages are singly applied or when stacking is restricted. If multiple interacting packages are important, use either:

- precomposed bundles, or
- explicit interaction terms introduced carefully.

---

## Mode 3. Progressive expansion toward explicit process structure

When a sector is later expanded into explicit VedaLang / TIMES processes:

- the base sector states become high-level pathway summaries,
- pure efficiency overlays can map to explicit retrofit or efficiency processes,
- embodied efficiency stays with the technology-route choice,
- autonomous efficiency remains a scenario assumption or exogenous parameter set.

This preserves consistency across reduced-form and explicit representations.

---

## Examples by sector and class

## 1. Residential buildings

### Autonomous efficiency

- baseline building shell improvement under normal code and turnover,
- ordinary appliance efficiency improvement,
- ordinary hot-water efficiency drift.

**Representation**: autonomous track.

### Endogenous pure efficiency overlays

- additional insulation / fabric retrofit,
- glazing upgrade,
- appliance upgrade beyond baseline,
- hot-water efficiency retrofit.

**Representation**: overlay.

### Endogenous operational overlays

- smart thermostat / controls / tuning,
- optimized HVAC scheduling.

**Representation**: overlay, operational subclass.

### Embodied efficiency in pathway states

- gas space heating to reverse-cycle heat pump,
- resistance heating to heat pump.

**Representation**: separate pathway states.

### Pure vs embodied

- insulation is **pure efficiency**,
- heat pump adoption is **embodied efficiency in technology switching**.

---

## 2. Commercial buildings

### Autonomous efficiency

- baseline lighting and equipment improvement,
- ordinary chiller/HVAC replacement efficiency drift.

### Endogenous pure efficiency overlays

- building fabric retrofit,
- efficient lighting package,
- efficient fans and pumps,
- refrigeration efficiency.

### Endogenous operational overlays

- commissioning,
- BMS optimization,
- controls and occupancy scheduling.

### Embodied efficiency in pathway states

- gas heating/chiller route to electric high-efficiency route,
- major service-system redesign.

---

## 3. Road transport

### Autonomous efficiency

- background ICE fuel economy improvement from normal fleet turnover and standards.

### Endogenous pure efficiency overlays

- freight aerodynamics,
- low rolling resistance tyres,
- engine and driveline efficiency packages where separable,
- fleet maintenance efficiency packages.

### Endogenous operational overlays

- eco-driving,
- route optimization,
- logistics/load-factor improvement where kept within the transport service module.

### Embodied efficiency in pathway states

- ICE to hybrid,
- ICE to BEV,
- diesel truck to battery-electric or hydrogen truck.

### Pure vs embodied

- tyre and aero packages are **pure/operational efficiency**,
- EV transition is **embodied efficiency in technology/fuel switching**.

---

## 4. Generic industrial heat

### Autonomous efficiency

- baseline burner/boiler efficiency improvement,
- ordinary steam-system efficiency drift.

### Endogenous pure efficiency overlays

- insulation,
- condensate return,
- steam trap maintenance,
- heat recovery,
- efficient motors and drives for auxiliaries.

### Endogenous operational overlays

- process control optimization,
- steam-system scheduling,
- maintenance / tuning.

### Embodied efficiency in pathway states

- gas boiler to electric boiler,
- gas boiler to industrial heat pump,
- fossil burner to hydrogen burner.

---

## 5. Steel

### Autonomous efficiency

- ordinary improvement in BF-BOF heat integration and auxiliary systems,
- yield improvements already assumed in baseline.

### Endogenous pure efficiency overlays

- waste heat recovery,
- efficient motors and drives,
- better process control reducing energy per tonne,
- gas recovery and reuse where modeled as incremental efficiency rather than route change.

### Endogenous operational overlays

- operational optimization and advanced control.

### Embodied efficiency in pathway states

- BF-BOF to BF-BOF+CCS,
- BF-BOF to scrap EAF,
- BF-BOF to H2-DRI-EAF.

### Important note

Much of the large apparent energy-intensity change in steel is not pure efficiency; it is route change. That should remain in pathway states.

---

## 6. Cement

### Autonomous efficiency

- ordinary kiln efficiency improvement,
- ordinary grinding efficiency improvement.

### Endogenous pure efficiency overlays

- kiln heat recovery,
- grinding efficiency package,
- motor/VSD package,
- process control package.

### Embodied efficiency in pathway states

- major route change or alternative process choice.

### Important note

Clinker substitution is generally not pure energy efficiency; it is product/process composition change. Represent separately from efficiency.

---

## 7. Agriculture

### Autonomous efficiency

- background machinery efficiency drift,
- baseline irrigation equipment improvement.

### Endogenous pure efficiency overlays

- efficient irrigation pumps,
- variable speed drives,
- improved pumping systems.

### Endogenous operational overlays

- irrigation scheduling,
- precision application reducing wasted energy inputs.

### Embodied efficiency in pathway states

- diesel pump to electric pump where modeled as a route change.

---

## 8. Electricity / energy supply

### Autonomous efficiency

- baseline reduction in losses,
- ordinary heat-rate improvement assumptions in surviving thermal units.

### Endogenous pure efficiency overlays

- transmission/distribution loss reduction package,
- auxiliary load reduction package for plants if sufficiently separable.

### Embodied efficiency in pathway states

- fossil-heavy generation state to VRE/storage-heavy generation state,
- major supply-route changes.

### Important note

For electricity, most big efficiency-like system gains are embodied in the system pathway itself rather than a portable overlay.

---

## What additional efficiency measures are materially modelable as endogenous?

A measure is materially modelable as endogenous if it satisfies most of the following:

1. **Materiality**: large enough to matter at Australia sector level or major subsector level.
2. **Evidence base**: credible literature or engineering evidence exists for cost and effect size.
3. **Separability**: effect can be approximated independently enough for reduced-form use.
4. **Adoptability**: plausible uptake bounds and turnover constraints can be specified.
5. **Comparability**: the measure can reasonably compete against other options in the model.
6. **Attributability**: the model can report its energy/cost/emissions impact separately.

Measures that usually meet this test include:

- building shell retrofits,
- lighting and appliance upgrades,
- controls optimization,
- industrial heat recovery,
- motor/VSD packages,
- steam-system efficiency,
- pump/fan/compressor efficiency,
- selected freight efficiency measures.

Measures that often **do not** belong here include:

- broad structural demand reduction,
- route changes already represented as pathway states,
- emissions capture measures.

---

## Which effects are pure efficiency versus embodied in technology/fuel switching?

### Pure efficiency

Reduces energy or material input per unit of service/output **without fundamentally changing the service technology class or route**.

Examples:

- insulation,
- efficient motors,
- heat recovery,
- HVAC tuning,
- steam-system fixes,
- better grinding efficiency.

### Embodied efficiency

Efficiency gain that comes **with** changing technology/fuel/route.

Examples:

- EV instead of ICE,
- heat pump instead of gas heater,
- EAF or H2-DRI instead of BF-BOF,
- LED service system replacing an older lighting technology family.

### Why the distinction matters

If not distinguished, the model will overstate how much efficiency is available as a portable “buyable” wedge and understate how much is tied to broader technology transition.

---

## Reporting and attribution

For scenario analysis, report contributions to changes in energy, cost, and emissions under the following headings:

- activity / service demand,
- autonomous efficiency,
- endogenous pure efficiency,
- endogenous operational efficiency,
- embodied efficiency in technology switching,
- fuel switching,
- upstream supply decarbonization,
- process-emissions reduction / capture,
- structural composition change.

Some headings overlap conceptually, but this is the right reporting structure for transparency.

A practical decomposition sequence is:

1. freeze activity,
2. apply autonomous efficiency,
3. apply endogenous pure and operational packages,
4. apply technology/fuel state changes,
5. apply upstream emissions-factor changes,
6. apply process emissions and removals changes.

For higher-formality reporting, Shapley-style decomposition can be added later.

---

## Recommended implementation sequence

### Expansion 1: minimal but high-value

Add:

- autonomous efficiency tracks,
- pure efficiency overlays,
- operational efficiency overlays,
- attribution tags on pathway states.

Focus first on:

- residential buildings,
- commercial buildings,
- road transport,
- generic industrial heat,
- steel,
- cement.

### Expansion 2: add interaction handling

Add:

- stacking rules,
- exclusivity families,
- a small number of precomposed bundles.

### Expansion 3: link to explicit technology expansion

For selected sectors, map overlays and pathway states to explicit VedaLang/TIMES processes.

---

## Bottom line

The proposed expansion is:

1. keep the existing sector states as the main pathway objects,
2. add explicit autonomous efficiency tracks for attribution,
3. add endogenous efficiency overlays for separable measures,
4. keep embodied efficiency inside separate pathway states where it belongs,
5. report pure efficiency and embodied efficiency separately.

This preserves the simplicity of the sector-state library while making efficiency analytically usable, attributable, and expandable toward a fuller model.
