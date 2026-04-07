
# PRD / Technical Specification — Australia Phase 1 Sector State Explorer

Version: 0.1  
Date: 2026-04-06  
Status: draft for implementation  
Primary input package: `aus_phase1_sector_state_library.zip`

## 1. Product summary

Build a **stand-alone web application** that turns the Australia Phase 1 sector-state library into a fast, inspectable reduced-form scenario explorer.

The app should let a user:

1. inspect every sector state, including provenance, assumptions, confidence, uncertainty, and derivation context,
2. define scenarios that range from **fully exogenous** state selection to **mixed** and **fully endogenous** state allocation,
3. set **commodity prices** and a **carbon price**,
4. run a **generalized solver** that allocates activity across state-year rows subject to demand, share caps, activity caps, and supply balances,
5. compare scenarios and clearly explain **why** results changed: electrification, fuel switching, efficiency, process-abatement, removals, and constraint effects.

The application must be **completely standalone from VedaLang/Vita**. It should be a small, opinionated explorer built only around the data and documentation already present in the Phase 1 package.

## 2. Product goal

Create the smallest useful application that makes the library:

- runnable,
- reviewable,
- explainable,
- and easy to iterate.

The app is not a dispatch model, not a TIMES clone, and not a facility-level industrial model. It is a **fast scenario workbench** for the Phase 1 reduced-form state library.

## 3. Inputs the app must consume

The app should load and use the following existing artifacts directly:

| File | Purpose in app |
|---|---|
| `data/sector_states.csv` | Core state-year rows used by explorer and solver |
| `data/sector_states_schema.json` | Validation and field documentation |
| `data/source_ledger.csv` | Source/provenance view |
| `data/assumptions_ledger.csv` | Assumption/provenance view |
| `data/calibration_summary.csv` | Baseline validation tab and default demand anchors |
| `data/uncertainty_summary.csv` | Uncertainty tab and sensitivity hints |
| `data/commodity_taxonomy.csv` | Commodity definitions and canonical units |
| `docs/methods_overview.md` | Global methods page |
| `docs/sector_derivations/*.md` | Sector explainer pages |
| `docs/calibration_validation.md` | Calibration page |
| `docs/uncertainty_confidence.md` | Uncertainty page |
| `docs/phase2_recommendations.md` | Caveats and expansion-path page |

## 4. Key product assumptions

These assumptions are already implicit in the library and should remain explicit in the app:

### 4.1 Cost convention
`output_cost_per_unit` is primarily a **real-2024 non-commodity conversion/supply cost**. For most sectors it excludes the purchase cost of explicitly modeled input commodities. The app therefore must calculate **fully loaded cost** by adding commodity purchases and carbon costs at scenario runtime.

### 4.2 Emissions convention
For end-use sectors, `energy_emissions_by_pollutant` captures **direct on-site emissions only**. Electricity-related emissions are represented in the electricity-supply states, not in end-use rows. The app must preserve that boundary and avoid double counting.

### 4.3 Endogeneity in v1
In this spec, “endogenous” means **endogenous allocation of activity across available states**.  
It does **not** mean endogenous demand for service outputs. Demand remains scenario input.

### 4.4 Library-driven, not sector-coded
The solver should be **generic**. It should not contain one-off optimization code for buildings vs transport vs steel. The only app-owned metadata outside the library should be:

1. output role classification,
2. canonical unit conversions,
3. default activity paths,
4. commodity price presets,
5. optional explanation tag rules.

## 5. Users

### 5.1 Analyst / modeler
Wants to run quick national scenarios, inspect fuel and emissions shifts, and identify which assumptions matter.

### 5.2 Technical reviewer
Wants to click into each state and inspect sources, assumptions, confidence, calibration context, and derivation notes.

### 5.3 Decision-maker / sponsor
Wants simple scenario compare views, big-number results, and plain-language explanations of what drove the differences.

## 6. Goals

### Must-have
- Run scenarios from fully pinned sector states to optimized state allocation.
- Support carbon price and editable commodity prices.
- Show emissions, fuel demand, electricity use/supply, costs, and state shares.
- Show confidence, uncertainty, sources, assumptions, and derivation context for every state.
- Explain results in plain language using driver tags like electrification, efficiency, fuel switching, hydrogen, CCS, clinker reduction, scrap shift, removals.
- Stay lightweight and standalone.

### Nice-to-have
- Save/load scenario JSON files.
- Share scenario compare reports.
- Soft-constraint mode for testing infeasibility and bound pressure.
- Sensitivity templates from the uncertainty pack.

## 7. Non-goals

This app should **not** attempt to do the following in v1:

- dispatch or intra-year temporal modeling,
- power-flow or transmission modeling,
- endogenous capacity expansion with vintaging,
- facility-level steel/cement process modeling,
- detailed refinery/petrochemical chains,
- land-use competition,
- elastic demand or macroeconomic feedback,
- VedaLang/Vita integration.

## 8. Core concepts in the application

### 8.1 State family
A `state_id` repeated across milestone years.  
Example: `buildings__residential__electrified_efficiency`.

### 8.2 Service/output family
A unique `service_or_output_name` within a sector/subsector context, such as:

- `electricity`
- `residential_building_services`
- `passenger_road_transport`
- `crude_steel`

### 8.3 Commodity
An item that appears in `input_commodities`, such as:

- electricity
- natural_gas
- coal
- refined_liquid_fuels
- hydrogen
- biomass
- scrap_steel
- iron_ore
- sequestration_service

### 8.4 Scenario
A bundle of:
- selected years,
- demand/activity paths,
- commodity prices,
- carbon price path,
- control mode per service/output,
- optional state share overrides,
- solver settings.

### 8.5 Control mode
How a service/output is handled in the run:

- **Pinned single state** — 100% assigned to one state family
- **Fixed shares** — user enters a share mix
- **Optimize** — solver chooses shares subject to bounds
- **Externalized** — for supply commodities like electricity, bypass endogenous supply and use exogenous price instead
- **Off / target / optimize** — optional-output mode for removals

## 9. Output role classification

The raw library does not contain an explicit “role” field, so the app should ship with a small config that classifies each output into one of three roles.

### 9.1 Required service/output
Must meet exogenous demand exactly.

Use this role for:
- residential_building_services
- commercial_building_services
- passenger_road_transport
- freight_road_transport
- low_temperature_heat
- medium_temperature_heat
- high_temperature_heat
- crude_steel
- cement_equivalent
- livestock_output_bundle
- cropping_horticulture_output_bundle

### 9.2 Endogenous supply commodity
Can supply an intermediate commodity used by other sectors.

Use this role for:
- electricity

### 9.3 Optional supply / optional removals
May be disabled, targeted, or allowed to enter the solution if economically justified.

Use this role for:
- land_sequestration
- engineered_removals

This role scheme is generic and future-proof: if later state libraries add hydrogen supply or fuel production, they can use the same machinery.

## 10. Functional requirements

## 10.1 Library explorer

The app must provide a searchable, filterable state explorer.

### Required filters
- sector
- subsector
- service/output
- year
- confidence rating
- region
- state family / label
- source ID
- assumption ID

### Required list columns
- year
- sector
- subsector
- state label
- confidence
- output unit
- output cost per unit
- direct energy emissions
- process emissions
- max share
- max activity

### State detail drawer/page must show
- state label and description
- sector/subsector/service/year
- output cost and cost basis
- input commodity table
- emissions split table
- availability / bounds
- evidence summary
- derivation method
- confidence rating
- review notes
- candidate expansion pathway
- source ledger entries
- assumption ledger entries
- relevant sector derivation markdown
- relevant uncertainty summary entries
- relevant calibration entries

### Required “difference from incumbent/reference” panel
For a selected year/service, show the selected state versus the reference incumbent/conventional state for that same service/year:
- cost delta
- input deltas by commodity
- direct energy emissions delta
- process emissions delta
- max share delta
- confidence comparison

## 10.2 Scenario builder

The scenario builder is the heart of the app.

### Required structure
The builder should present one row per service/output family, grouped by sector.

Each row must allow:
- control mode selection
- state family selection if pinned
- share editor if fixed-share mode
- enable/disable state families
- optional year-specific overrides
- visibility of max-share trajectory across years
- quick link to state details

### Demand/activity inputs
The user must be able to specify:
- absolute demand/activity for each required output,
- either by milestone year table,
- or by 2025 anchor + simple growth rule,
- with optional “flat from 2025” default.

### Commodity price inputs
The user must be able to specify:
- one preset or custom path by year,
- per commodity,
- in canonical units,
- with clear distinction between endogenous-supply and external-price treatment.

### Carbon price inputs
The user must be able to specify:
- flat value across years,
- milestone-year path,
- or one of a few simple presets.

### Electricity mode
Electricity must be switchable between:
- **endogenous supply mode** using electricity sector states and balance constraints,
- **external price mode** using a user-entered electricity price and no endogenous electricity sector.

### Removals mode
Removals must support:
- off
- fixed annual removal target
- endogenous optimization up to max activity

## 10.3 Model runner / generalized solver

The solver must support:
- fully exogenous runs,
- mixed runs,
- fully endogenous state allocation,
- year-by-year runs,
- optional multi-year coupled runs with smoothing.

The core solve should be linear and transparent.

## 10.4 Results explorer

The app must show at minimum:

### Overview KPIs
- total system cost
- gross direct emissions
- net emissions after removals
- carbon payments / credits
- electricity supplied
- average electricity cost
- average electricity emissions intensity
- commodity demand by commodity
- activity by sector/service

### Charts
- state-share stacked area or stacked bars by service over time
- emissions by sector over time
- gross vs net emissions over time
- commodity demand by commodity over time
- electricity supply mix over time
- cost decomposition over time
- constraint saturation chart (solved share vs max share)
- frontier chart: fully loaded cost vs direct emissions for any service/year
- scenario A vs B delta waterfall for emissions, fuel, and cost

### Tables
- activity by state and year
- commodity balance by year
- sector/service summary by year
- constraint report
- state ranking by fully loaded cost for selected year/service
- “why not chosen” alternatives table

## 10.5 Explainability engine

Explainability is a first-class requirement, not decoration.

The app must generate plain-language summaries for both individual states and scenario results.

### State-level explanation requirements
For any state row, provide:
- what changed relative to the incumbent/reference
- why the state is cheaper/more expensive
- why emissions are lower/higher
- what fuels/materials changed
- what makes the state high/medium/low/exploratory confidence
- what main assumptions support it
- what upgrade path is implied

### Scenario-level explanation requirements
For any solved scenario, provide:
- which states were chosen
- which constraints were binding
- which sectors drove emissions change
- which sectors drove electricity demand change
- which sectors drove fuel switching
- which sectors depend on low-confidence or exploratory states

### Required explanation tags
These tags should be inferred by simple rules over coefficients, labels, and notes:
- electrification
- efficiency improvement
- fossil-to-gas switch
- fossil-to-biomass switch
- fossil-to-hydrogen switch
- CCS / sequestration
- clinker reduction / material substitution
- scrap-EAF shift
- removals
- incumbent lock-in
- rollout cap binding
- exploratory dependence

## 10.6 Calibration and methods pages

The app must include a Methods / Trust section that exposes the supporting documentation:

- methods overview
- calibration and validation note
- uncertainty note
- phase 2 recommendation note
- sector derivations
- source ledger
- assumptions ledger

There should also be a Calibration page that:
- renders `calibration_summary.csv`,
- shows the reference baseline scenario used by the app,
- and highlights where the baseline is exact, close, or only order-of-magnitude.

## 10.7 Compare mode

A user must be able to compare two saved scenarios side-by-side.

### Required compare outputs
- KPI deltas
- emissions delta by sector/year
- commodity demand delta by commodity/year
- electricity demand and supply delta
- state-share delta
- cost decomposition delta
- confidence exposure delta
- generated narrative summary

## 10.8 Export / import

The app must support:
- export scenario config as JSON
- import scenario JSON
- export core results as CSV
- export compare results as CSV
- export a markdown or HTML summary report

## 11. Data normalization requirements

The loader must normalize the CSV into internal tables.

### 11.1 Parse JSON-encoded array columns
The following columns must be parsed from JSON strings:
- `input_commodities`
- `input_coefficients`
- `input_units`
- `energy_emissions_by_pollutant`
- `process_emissions_by_pollutant`
- `source_ids`
- `assumption_ids`

### 11.2 Build normalized internal tables
Recommended internal shapes:

- `states`
- `state_inputs`
- `state_emissions`
- `state_sources`
- `state_assumptions`
- `sources`
- `assumptions`
- `calibration_items`
- `uncertainty_items`
- `docs`

### 11.3 Canonical commodity units
The app must choose one canonical unit per commodity:

| Commodity | Canonical unit |
|---|---|
| electricity | MWh |
| natural_gas | GJ |
| coal | GJ |
| refined_liquid_fuels | GJ |
| hydrogen | GJ |
| biomass | GJ |
| scrap_steel | t |
| iron_ore | t |
| sequestration_service | tCO2 stored |

### 11.4 Unit conversion rules
The app must convert input coefficients into canonical commodity units.

Required conversions:
- electricity `GJ -> MWh` using `1 MWh = 3.6 GJ`
- all fuel inputs already expressed in `GJ/...`
- material inputs in `t/...`
- sequestration service in `tCO2 stored/...`

The solver should always work on normalized coefficients.

## 12. Default app-owned configuration

The following files are not part of the research library proper, but should be bundled with the app and versioned separately.

### 12.1 `app_config/output_roles.json`
Maps each output/service to:
- role
- display group
- whether it participates in commodity balance
- whether demand is required

### 12.2 `app_config/default_activity_paths.json`
Contains default 2025 anchors and a rule for future years.

Recommended default rule:
- **flat from 2025 across milestone years**, unless user edits.

Recommended 2025 anchors derived from the existing package:

| Output/service | 2025 default | Unit | Basis |
|---|---:|---|---|
| residential_building_services | 477,000,000 | GJ_service_eq | Sum of residential final-energy calibration items under baseline-normalized service convention |
| commercial_building_services | 314,000,000 | GJ_service_eq | Sum of commercial final-energy calibration items under baseline-normalized service convention |
| passenger_road_transport | 293,414,730,000 | pkm | Calibration benchmark |
| freight_road_transport | 249,000,000,000 | tkm | Calibration benchmark |
| low_temperature_heat | 120,000,000 | GJ_useful_heat | Illustrative heat anchor in calibration pack |
| medium_temperature_heat | 140,000,000 | GJ_useful_heat | Illustrative heat anchor in calibration pack |
| high_temperature_heat | 170,000,000 | GJ_useful_heat | Illustrative heat anchor in calibration pack |
| crude_steel | 5,700,000 | t_crude_steel | Calibration benchmark |
| cement_equivalent | 9,600,000 | t_cement_equivalent | Calibration benchmark |
| livestock_output_bundle | 31,134.94 | A$m_output_2024 | Derived bundle value reproducing agriculture totals |
| cropping_horticulture_output_bundle | 36,576.29 | A$m_output_2024 | Derived bundle value reproducing agriculture totals |
| electricity_residual_external_demand | 144,018,720 | MWh | Residual electricity demand after covered-sector baseline electricity use is netted from national generation |

### 12.3 `app_config/commodity_price_presets.json`
Should include at minimum:
- `central_placeholder_2024aud`
- `fossil_shock`
- `cheap_clean_energy`

Important rule: these presets must be clearly labeled as **app defaults**, not research-library evidence.

### 12.4 `app_config/reference_scenarios.json`
Should ship with a few built-in scenarios:

1. **Reference calibration 2025**  
   - uses library-aligned 2025 activities
   - uses a fixed-share electricity blend consistent with the calibration pack
   - removals off

2. **Flat incumbent path**  
   - incumbent/conventional states pinned across all years
   - flat activity path
   - electricity either externalized or pinned to incumbent

3. **Auto least-cost under carbon price**  
   - all required services optimized
   - electricity endogenous
   - removals off by default

4. **Review-central**  
   - optimize stronger sectors
   - pin or constrain weaker sectors like DACCS/agriculture mitigation unless user enables them

## 13. Solver specification

## 13.1 Decision variables

For each selected year and state row:
- `x[s, y] >= 0` = activity supplied by that state row in output units

Optional variables:
- slack variables for soft constraint mode
- share variables only if needed for presentation; not required mathematically

## 13.2 Objective

Minimize total system cost:

`total_cost = conversion_cost + external_commodity_cost + carbon_cost + soft_constraint_penalties`

Where:

- `conversion_cost = Σ x_i * output_cost_per_unit_i`
- `external_commodity_cost = Σ x_i * coeff(i,c) * external_price(c,y)` for commodities not endogenously supplied in the active scenario
- `carbon_cost = Σ x_i * (energy_emissions_i + process_emissions_i) * carbon_price_y`
- negative process emissions reduce net emissions and therefore reduce carbon cost if removals are enabled
- if a commodity is endogenously supplied, its cost is represented by the supplying sector activities, not by an external price term

## 13.3 Constraints

### A. Required output demand
For each required service/output `o` in year `y`:

`Σ x_i over states producing o = demand(o,y)`

### B. Endogenous commodity balance
For each endogenous-supply commodity `c` in year `y`:

`Σ x_i over states producing c = external_residual_demand(c,y) + Σ coeff(j,c) * x_j over all consuming states`

In Phase 1, this is most important for electricity.

### C. Fixed single-state mode
If a service/output is pinned to one state family:

`x_selected = demand(o,y)`  
`x_other_states = 0`

### D. Fixed-share mode
If a service/output has user-entered shares:

`x_i = share_i(o,y) * demand(o,y)`

### E. Max share
For required outputs:

`x_i <= max_share_i * demand(o,y)`

For endogenous-supply commodities like electricity:

`x_i <= max_share_i * total_supply(o,y)`

This remains linear because `total_supply(o,y)` is the sum of state activities for that output.

### F. Min share
If `min_share` is present, mirror the same pattern:
- relative to demand for required outputs
- relative to total supply for supply commodities

### G. Max activity
If `max_activity` is present:

`x_i <= max_activity_i`

### H. Disabled states
If a state family is manually disabled, set activity to zero.

### I. Optional removals
If removals are off:
`x_removal = 0`

If removals are target-driven:
`Σ x_removal_states = target(y)`

If removals are endogenous:
`0 <= x_removal_states <= max_activity / share caps`

## 13.4 Optional multi-year smoothing
This should be optional and off by default.

If enabled, apply a generic change-rate rule on shares by state family:

`share(i,y) - share(i,y_prev) <= delta_max`

This is not sourced from the current library and should be clearly labeled as an app-level heuristic, not a research value.

## 13.5 Soft-constraint mode
The app should optionally support soft max-share/max-activity constraints with a large penalty cost and a violation report.  
Use this for exploratory diagnostics, not as the default.

## 13.6 Infeasibility diagnostics
If the solve is infeasible, the app must return a useful diagnosis.

At minimum it should identify:
- outputs where the sum of available state caps is below demand
- states unavailable in the selected year
- missing commodity price inputs in externalized mode
- electricity balance failures
- removal targets above available activity caps

## 13.7 Solver technology recommendation

Preferred v1 solver stack:
- **HiGHS** via Python bindings (`highspy`) or SciPy/HiGHS
- deterministic LP
- expose duals / reduced costs where feasible for explainability

## 14. Result calculations

The app must calculate and expose the following derived outputs.

### 14.1 Per-state/year
- activity
- share of service/output
- conversion cost
- external commodity cost
- carbon cost
- total fully loaded cost
- direct energy emissions
- process emissions
- total direct emissions
- dominant input commodities
- binding status of constraints

### 14.2 Per-sector/year
- total activity
- total cost
- energy emissions
- process emissions
- net emissions
- commodity demand by commodity
- average fully loaded cost per output

### 14.3 Whole-system/year
- total gross emissions
- removals
- net emissions
- commodity demand totals
- electricity supply total
- electricity emissions intensity
- average electricity cost
- carbon payments / credits
- confidence exposure summary

## 15. Explainability specification

## 15.1 Fully loaded cost decomposition
For every state and scenario result, show:

- non-commodity conversion cost
- commodity purchase cost
- carbon cost
- total fully loaded cost

This should be shown both numerically and as a stacked bar.

## 15.2 Emissions decomposition
Show:
- direct energy emissions
- process emissions
- gross emissions
- removals
- net emissions

## 15.3 Constraint explanation
For any selected service/year, show:
- chosen state mix
- max-share trajectory
- which caps bind
- which alternatives were cheaper but unavailable
- which alternatives were cleaner but more expensive

## 15.4 “Why this state?” output
For optimized outputs, the app should produce a short sentence like:

> “Battery-electric passenger road was chosen up to its share cap in 2040 because it delivered lower fully loaded cost at the selected electricity and carbon prices, while the ICE state remained available only as residual supply.”

The sentence should be templated from:
- selected mode
- fully loaded cost ranking
- emissions ranking
- binding constraints
- explanation tags

## 15.5 Confidence exposure
The app must show scenario reliance by confidence class.

At minimum include:
- activity share by confidence class
- cost share by confidence class
- emissions or abatement share by confidence class

This avoids hiding dependence on low-confidence and exploratory states.

## 15.6 Scenario-difference narratives
Compare mode must produce short structured narratives such as:

- “Most of the emissions reduction comes from electrified buildings and passenger-road BEV uptake.”
- “Electricity demand rises mainly because residential/commercial services and road transport switch from direct fuel use to grid electricity.”
- “The scenario relies materially on low-confidence industrial heat and steel-hydrogen states after 2040.”

## 16. Required visualizations

## 16.1 State frontier plot
For any selected service/year:
- x-axis = direct emissions coefficient
- y-axis = fully loaded cost
- point size = max share or max activity
- point label = state
- point marker/badge = confidence

This is the single most useful trade-off plot in the app.

## 16.2 State-share over time
Stacked bars or stacked area for solved shares by service.

## 16.3 Commodity demand over time
Lines for:
- electricity
- natural gas
- coal
- refined liquid fuels
- hydrogen
- biomass
- scrap steel
- iron ore
- sequestration service

## 16.4 Emissions over time
- by sector
- gross vs net
- energy vs process

## 16.5 Electricity view
If electricity is endogenous, show:
- supply mix by electricity state
- total supply
- total residual external demand
- average cost
- emissions intensity

## 16.6 Compare waterfall
For A vs B, show:
- emissions delta waterfall
- commodity delta waterfall
- cost delta waterfall

## 17. UX / information architecture

Recommended top-level navigation:

1. **Scenario**
2. **Results**
3. **Compare**
4. **Library**
5. **Methods**

### 17.1 Scenario page layout
- left sidebar: years, price preset, carbon price, global toggles
- main table: one row per service/output family
- right panel: quick scenario summary and warnings

### 17.2 Results page tabs
- Overview
- State Mix
- Fuels / Commodities
- Emissions
- Costs
- Constraints
- Confidence
- Explanations

### 17.3 Library page layout
- filter pane
- table/list of states
- detail drawer
- related sources/assumptions/docs tabs

### 17.4 Methods page layout
- Overview
- Calibration
- Uncertainty
- Sector derivations
- Source ledger
- Assumptions ledger
- Phase 2 notes

## 18. Technical architecture recommendation

## 18.1 Preferred v1 stack
Because the data volume is tiny and the main complexity is the solver, the simplest recommended stack is:

- **Python**
- **Streamlit** for the web UI
- **Pandas or Polars** for data wrangling
- **HiGHS** for optimization
- **Plotly** or Altair for charts
- markdown rendering for docs

Why this is the preferred v1:
- one codebase
- one deployment unit
- easy file-based data loading
- easy solver integration
- fast delivery for a “little explorer”

## 18.2 Acceptable alternative
If a more polished UI is desired from day one:
- React/Vite frontend
- FastAPI backend
- same solver/data modules behind the API

But that is not required for the first useful version.

## 18.3 Storage
No database is required in v1.  
Use in-memory dataframes and file-based configs.

Scenario save/load can use:
- local browser storage, and/or
- exported JSON files.

## 18.4 Suggested project structure

```text
app/
  main.py
  pages/
    scenario.py
    results.py
    compare.py
    library.py
    methods.py
  core/
    loader.py
    normalize.py
    units.py
    roles.py
    solver.py
    explain.py
    compare.py
    exports.py
  data/
    sector_states.csv
    source_ledger.csv
    assumptions_ledger.csv
    calibration_summary.csv
    uncertainty_summary.csv
    commodity_taxonomy.csv
    docs/...
  app_config/
    output_roles.json
    default_activity_paths.json
    commodity_price_presets.json
    reference_scenarios.json
```

## 19. Acceptance criteria

The v1 app is acceptable only if all of the following are true.

### Data / trust
- Loads all Phase 1 data and docs without manual editing.
- Every state card shows sources, assumptions, confidence, and derivation context.
- Methods and calibration pages render correctly.

### Modeling
- Supports pinned, fixed-share, optimize, and externalized modes.
- Supports electricity as either endogenous supply or external price.
- Supports carbon price.
- Supports max-share and max-activity constraints.
- Solves all default reference scenarios without error.

### Results
- Displays cost, emissions, commodity demand, and state shares by year.
- Can compare two scenarios directly.
- Shows at least one plain-language explanation per major changed sector.

### Explainability
- Can show fully loaded cost breakdown for any state.
- Can identify binding caps in optimized runs.
- Can show confidence exposure for the solved scenario.

### Robustness
- Infeasible runs produce human-readable diagnostics.
- Scenario JSON export/import round-trips cleanly.

## 20. Performance targets

Given the library size, v1 should feel instantaneous.

Targets:
- initial data load under 2 seconds locally
- single multi-year solve under 3 seconds
- scenario compare under 1 second after results are cached
- state detail open under 0.5 seconds

## 21. Risks and mitigation

### Risk 1: demand defaults are not in the raw library
Mitigation: ship explicit `default_activity_paths.json`, clearly labeled as app-owned config derived from the calibration pack.

### Risk 2: commodity price presets are not source-backed in the library
Mitigation: keep them in separate app config and label them as editable defaults, not evidence claims.

### Risk 3: users misunderstand “full endogenous”
Mitigation: label clearly that demand is exogenous and only state allocation is optimized in v1.

### Risk 4: electricity double counting
Mitigation: enforce a clean electricity mode toggle and never include scope-2 electricity emissions in end-use rows.

### Risk 5: low-confidence sectors dominate optimization
Mitigation: show confidence exposure prominently and ship a “review-central” scenario that keeps weak sectors conservative by default.

## 22. Delivery plan

### Phase A — data and trust shell
- load and normalize data
- build library explorer
- build methods/calibration/uncertainty pages
- no solver yet

### Phase B — scenario builder + core solver
- implement scenario schema
- implement demand inputs, prices, carbon price
- implement LP solver
- implement overview results

### Phase C — explainability + compare
- binding-constraint reporting
- state frontier plot
- scenario compare
- generated narratives
- confidence exposure

### Phase D — polish
- export/import
- soft-constraint mode
- reference scenarios
- residual electricity and default activity helpers

## 23. Main implementation decision taken in this spec

The biggest modeling decision in this spec is:

> **v1 endogeneity means endogenous allocation of activity across sector states, while service/output demand remains exogenous.**

That keeps the app faithful to the current Phase 1 data package and avoids inventing demand elasticities or macro relationships that are not in the library.

## 24. Decisions to confirm

These do not block the spec, but they are the first decisions worth confirming before build starts.

1. **Default future demand path**  
   This spec assumes flat 2025 activity across later milestone years unless the user edits it.

2. **Removals default**  
   This spec assumes land sequestration and DACCS are off by default unless explicitly enabled or targeted.

3. **App-owned commodity price presets**  
   This spec assumes price presets are acceptable as editable app defaults even though they are not part of the research library itself.

## 25. Bottom line

This app should be a **small, trustable, generalized sector-state explorer**:

- library-driven rather than sector-coded,
- simple enough to ship fast,
- strong on transparency,
- and good enough to support the first serious reduced-form scenario work around electricity, end-use electrification, industry, emissions, and removals.

If built to this spec, it will make the Phase 1 library immediately usable for review, scenario analysis, and iteration without pulling VedaLang/Vita into the loop.
