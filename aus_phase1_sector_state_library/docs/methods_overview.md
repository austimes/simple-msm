# Methods overview

## 1. Objective

The package implements a **Phase 1 Australia sector state library** for a reduced-form decarbonisation model. The objective is not to reproduce a full TIMES/Veda process-chain model immediately, but to create a reviewable intermediate representation that is:

- year indexed,
- sector specific,
- explicit about costs, inputs and emissions,
- traceable to source families,
- and expandable later.

## 2. Source hierarchy actually used

The build follows the requested evidence hierarchy:

1. **Australian official statistics and inventories** where available:
   - energy totals and fuel splits from `S001` and `S002`,
   - inventory boundary and sector emissions context from `S004`, `S005`, `S006`,
   - agriculture output values from `S027`, `S028`, `S029`,
   - BITRE transport activity from `S012`, `S013`.

2. **Australian system-planning and techno-economic sources**:
   - electricity and gas planning assumptions from `S008`, `S009`, `S010`, `S011`,
   - building and transport transition evidence from `S014`, `S018`, `S019`, `S020`, `S021`.

3. **High-quality industry and research studies** where official process data were thin:
   - steel from `S022`, `S023`, `S024`, `S033`,
   - cement from `S025`, `S026`,
   - removals from `S030`, `S031`.

## 3. Output/service definitions

The library uses output/service units chosen for reduced-form tractability:

- electricity: `MWh`
- residential and commercial buildings: `GJ_service_eq`
- passenger road: `pkm`
- freight road: `tkm`
- generic industrial heat: `GJ_useful_heat`
- steel: `t_crude_steel`
- cement: `t_cement_equivalent`
- agriculture: `A$m_output_2024`
- removals: `tCO2_removed`

### Why these output choices were used

- They are compact enough for national reduced-form modelling.
- They preserve a clean mapping to commodity inputs and direct emissions.
- They leave an obvious upgrade path to later process- or end-use-specific representations.
- They avoid pretending that Phase 1 can already support facility-level material balances everywhere.

## 4. Cost convention

The dataset uses the convention in `A002`:

> `output_cost_per_unit` is primarily a **non-commodity conversion/supply cost** in real 2024 Australian dollars.

This is important for model integration. The expectation is that a reduced-form model can add commodity input costs separately by multiplying the input coefficients by scenario commodity prices.

### Why this convention was chosen

Because the package is intended to support interactions between sectors, including electricity, hydrogen and fuels. If the full fuel/electricity cost were embedded in every output cost, commodity-price interaction would be obscured or double counted.

### Important caveat

Removals states are closer to **full marginal supply costs** than pure conversion costs because most of the cost is implicit land, MRV, capture and permanence cost rather than simply commodity purchases.

## 5. Emissions boundary

The package uses a consistent direct-emissions boundary:

- end-use sectors carry **direct on-site energy emissions** in `energy_emissions_by_pollutant`,
- process emissions, where relevant, are placed in `process_emissions_by_pollutant`,
- electricity-related emissions are excluded from end-use rows and are represented by the electricity-supply sector.

This follows `A003` and prevents routine scope-2 double counting.

## 6. How the state families were built

### Step 1 — anchor baseline sector totals

Official Australian energy and emissions totals were assembled first. This gave the package a hard baseline on:

- residential and commercial fuel use,
- road transport energy,
- agriculture energy,
- sector emissions context,
- electricity generation scale and fuel transition context.

### Step 2 — define a small set of useful states

For each sector, the state set was pruned to a small family that spans the main reduced-form decarbonisation options:

- incumbent / baseline,
- transition / moderate-abatement,
- high-abatement or deep-decarbonisation.

Where evidence supported it, distinct hydrogen and CCS states were added.

### Step 3 — derive coefficients and prune dominated options

A state was kept only if it contributed a distinct trade-off in at least one of:

- lower direct emissions,
- lower commodity-input intensity,
- different input mix exposure,
- different feasibility envelope.

The intention was not to preserve every imaginable route, but to keep a compact frontier that a reduced-form model can actually use.

## 7. Sector-by-sector derivation logic

### Electricity

Electricity is represented by three state families:

- incumbent thermal-heavy grid mix,
- policy frontier grid supply,
- deep-clean firmed grid supply.

The direct emissions trajectories were not derived from fuel coefficients alone. They were calibrated to recent Australian grid-intensity context and official sector trajectory direction (`A012`), while costs were anchored to CSIRO GenCost and AEMO planning evidence.

### Buildings

Residential and commercial buildings use baseline-normalised service bundles (`A004`, `A005`). The 2025 incumbent states reproduce official fuel splits directly. Electrified states then reduce total final-energy intensity and shift strongly toward electricity.

### Road transport

Passenger-road and freight-road baseline states were calibrated to official Australian road activity and road energy demand (`A006`, `A007`, `A008`). This is why the baseline passenger ICE coefficient is deliberately a **stock-average fleet coefficient**, not simply a new-car test value.

### Generic industrial heat

Generic industrial heat was built as three temperature bands. This is intentionally broad. The representation keeps a useful electrification/fuel-switch response in the MVP model, but explanatory power relative to a process-specific industrial model is limited.

### Steel

Steel is the most process-chain-like industrial sector in the package. The state family captures:

- conventional BF-BOF,
- CCS-influenced BF-BOF,
- scrap EAF,
- hydrogen DRI-electric route.

These are route archetypes, not Australian plant replicas.

### Cement

Cement is represented on a cement-equivalent basis, using Australian clinker-factor and energy-intensity evidence. This allows one compact state family to capture:

- current cement,
- clinker-ratio reduction plus fuel switching,
- deep-abatement cement with CCS.

### Agriculture

Agriculture is explicitly coarse. The package preserves agriculture in the MVP model as two output bundles: livestock and cropping/horticulture. It is an emissions-focused residual sector representation, not a detailed agricultural commodity or land-use model.

### Removals

Removals are kept separate from ordinary production sectors. Biological sequestration and DACCS appear as explicit negative-emissions supply states so the user can enable or disable them transparently.

## 8. Calibration philosophy

The calibration target was **credible consistency**, not spurious exactness.

Where the service definition could be tied directly to official energy totals, the library was calibrated tightly:

- buildings,
- road transport,
- agriculture.

Where the sector is inherently process-specific and the Phase 1 representation is partial, the package uses order-of-magnitude or pathway consistency checks instead:

- steel,
- cement,
- generic industrial heat,
- removals.

## 9. Confidence treatment

Each row carries one of four confidence ratings:

- `High`
- `Medium`
- `Low`
- `Exploratory`

The ratings reflect:

- source quality,
- how directly the source supports the parameter,
- how much synthesis or judgement was required,
- how robust the state is likely to be for a national reduced-form model.

## 10. Main Phase 1 modelling implications

The package is appropriate for:

- national reduced-form scenario analysis,
- commodity-demand and emissions trajectory analysis,
- fast coupling to electricity-sector decarbonisation.

It is **not** yet appropriate for:

- facility-level industrial planning,
- fully endogenous land competition,
- network or dispatch modelling,
- detailed agricultural technology competition,
- rigorous CCS infrastructure optimisation.

Those are the main upgrade pathways reserved for Phase 2.
