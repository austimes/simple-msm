# coal_mining

## What the family represents

This family covers Australian coal mining (ANZSIC 06100+06200) as a single national-average technology family for region `AUS`. The service output is total raw coal production in kilotonne (kt_coal), combining export and domestic supply on a unified production basis. The family spans all major mine types — Victorian open-cut brown coal, NSW/QLD open-cut thermal black coal, and Queensland underground export coking coal — using national-average AES 2024-25 coefficients rather than sub-sector splits.

The family captures four main emission-reduction levers available to Australian coal mines:

- Diesel fleet electrification via battery-electric haul trucks
- Hydrogen fuel cell haul trucks (emerging, long-life export mines)
- Fugitive methane abatement via coal seam gas pre-drainage and ventilation air methane (VAM) oxidation
- Integrated combination of haulage electrification and methane abatement

## Output/service definition

- Family id: `coal_mining`
- Output/service name: `coal_production`
- Output unit: `kt_coal`
- Output quantity basis: One kilotonne of total Australian raw coal production (export + domestic combined). Calibrated to AES 2023-24 Table F and Geoscience Australia 2023-24 total production statistics (467,739 kt anchor).
- Demand trajectory: `declining__coal_mining_total` (−1.1%/yr compound; weighted average of export coal −0.75%/yr and domestic coal −2.5%/yr)
- 2025 demand anchor: 467,739 kt (export ≈ 370,000 kt, 79%; domestic ≈ 98,700 kt, 21%)
- Default incumbent state id: `coal_mining__conventional`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `coal_mining__conventional` | Conventional coal mining | Incumbent | Diesel and grid-electric equipment across all operations (haulage, loading, blasting, ventilation, processing). 2025 max_share = 1.00. |
| `coal_mining__bev_haulage` | Battery-electric heavy haulage | Ambition 1 | BEV haul trucks replace primary haulage diesel. Drivetrain efficiency ~3× vs diesel ICE. Residual diesel for non-electric auxiliary plant. 2025 max_share = 0.03 → 0.38 by 2050. |
| `coal_mining__hydrogen_fcev` | Hydrogen FCEV haulage | Ambition 2 | Fuel cell haul trucks; immature H2 supply chains at present. Most applicable to long-life export mines where H2 infrastructure investment is viable. 2025 max_share = 0.01 → 0.18 by 2050. |
| `coal_mining__low_fugitive` | Low-fugitive methane abatement | Ambition 1 | CSG pre-drainage + VAM oxidation reduces fugitive CO2e by ~50% immediately, ~85% by 2050. Small electricity penalty (~8 GJ/kt) for abatement equipment. 2025 max_share = 0.04 → 0.45 by 2050. |
| `coal_mining__integrated_lc` | Integrated low-carbon | Ambition 2 | BEV haulage + full electrification + methane abatement combined. Represents the Safeguard Mechanism policy pathway for deep decarbonisation. 2025 max_share = 0.01 → 0.33 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2025 Table F (primary energy calibration basis, 174 PJ coal mining 2023-24). See `shared/source_ledger.csv`
- `S002` — NGGI 2025 Category 1B1a (fugitive coal mining emissions, 36 MtCO2e scope 1 total). See `shared/source_ledger.csv`
- `S021` — Geoscience Australia 2023-24 production statistics (total coal output anchor). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded from end-use coefficients. See `shared/assumptions_ledger.csv`
- `A009` — National-average fuel intensity applied uniformly across all mine types. See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses five technology states (one incumbent, four transition pathways) to span the main emission-abatement options for Australian coal mining without requiring a full mine-type or process-chain model.

The incumbent (`conventional`) anchors to AES 2023-24 and NGGI 2023-24 at national scale (98% energy coverage, ~100% fugitive coverage). The two haulage electrification states (`bev_haulage`, `hydrogen_fcev`) target the largest single energy-use lever: refined liquid fuels are 73% of mine energy in 2025 and haulage accounts for the majority of that diesel load. The `low_fugitive` state addresses the dominant emission stream — process (fugitive) CO2e at 69 tCO2e/kt is more than three times the energy CO2e at 22.4 tCO2e/kt in 2025, making methane abatement the highest-priority lever for total emission reduction. The `integrated_lc` state represents the Safeguard Mechanism policy pathway combining all major levers.

These five states let the solver distinguish the two distinct emission streams (energy and fugitive) and the two main technology levers (fleet electrification and methane abatement) without over-fitting to mine-type or coal-grade detail that the national-average source data does not support.

The calibration was updated in 2026 to AES 2025 (174 PJ) and NGGI 2025 (36 MtCO2e) at the 467,739 kt anchor, replacing the earlier AES 2023-24 calibration which had been applied at a lower production anchor (~420,000 kt). Fugitive intensity was updated from 69.0 tCO2e/kt to 56.5 tCO2e/kt to match the NGGI 2025 total scope 1 of 36 MtCO2e at the correct production anchor.

## Known caveats

- **National-average fugitive intensity.** The per-kt fugitive coefficient (56.5 tCO2e/kt in 2025) is a national average dominated by underground export coking mines. Open-cut mines have substantially lower fugitive intensity (~15 tCO2e/kt). The conventional state therefore overstates fugitive intensity for Victorian brown coal and most NSW thermal coal operations, and understates it for high-gas-content underground mines in Queensland. This blending cannot be resolved without Phase 2 sub-sector disaggregation.
- **No export/domestic split.** Demand is modelled as total production. Export market decline is captured implicitly via the demand trajectory; it is not disaggregated by market destination or coal type.
- **Hydrogen FCEV confidence.** The `hydrogen_fcev` state carries a Low confidence rating. H2 supply chains for remote mining operations are immature and cost trajectories are highly uncertain. This state should not be used as a primary decarbonisation pathway in core policy-optimisation runs without explicit scenario review.
- **Mine life and investment horizon.** Max_share trajectories are calibrated to national fleet-average investment cycles (~10–15 yr mine vehicle life). Individual mines nearing reserve depletion may have lower uptake ceilings than the national bound implies.

## Efficiency artifacts

### Autonomous efficiency tracks

Two background efficiency tracks apply exogenous improvement to fuel use regardless of technology state choice. These represent fleet replacement cycles and engineering advances that occur without explicit policy intervention.

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background diesel efficiency drift | `conventional`, `low_fugitive` | Fleet replacement and Tier 4/5 engine standards | ~8% (multiplier: 1.000 → 0.920) |
| Background electricity efficiency drift | `conventional`, `bev_haulage`, `low_fugitive`, `integrated_lc` | Motor efficiency improvements (IE3→IE4), pump and conveyor upgrades | ~9% (multiplier: 1.000 → 0.910) |

### Efficiency packages

Three optional overlay packages can be applied on top of base state coefficients. Packages reduce input commodity demand by the listed input multipliers.

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Haul Payload & Dispatch Optimisation | operational_efficiency_overlay | `conventional` | Refined liquid fuels | 0.93 (−7% diesel) |
| Mine Ventilation Variable-Speed Drives | pure_efficiency_overlay | `conventional`, `low_fugitive` | Electricity | 0.88 (−12% electricity on ventilation) |
| BEV Smart-Charging Load Optimisation | operational_efficiency_overlay | `bev_haulage`, `integrated_lc` | Electricity | 0.95 (−5% electricity via charge scheduling) |

Evidence basis: Australian mining telematics programmes (Wenco, Modular Mining, Komatsu DISPATCH) report 5–10% diesel savings from dispatch optimisation; Anglo American and Glencore underground mine programmes report 10–15% electricity savings from ventilation VSD retrofits; EV smart-charging pilots report 4–7% electricity savings.

## Expansion path

- **Phase 2:** Disaggregate into sub-families by mine type (open-cut vs underground) and coal type (Victorian brown coal, NSW thermal black coal, QLD export coking coal) to recover type-specific fugitive intensity, electrification cost curves, and mine-life investment horizons.
- Add explicit fleet stock-rollover constraints to model haul truck replacement cycles rather than smooth max_share trajectories.
- Link the `low_fugitive` and `integrated_lc` states to a Safeguard Mechanism baseline-tracking sub-module.
- Refine hydrogen FCEV state costs as Australian H2 supply infrastructure evidence matures.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (conventional, 467,739 kt)

| Commodity | Coefficient (GJ/kt) | Total at anchor |
|---|---|---|
| Refined liquid fuels | 277 | 129.6 PJ |
| Electricity | 72 | 33.7 PJ |
| Natural gas | 23 | 10.8 PJ |
| **Total energy** | **372** | **174.1 PJ** |

| Emission stream | Coefficient | Total at anchor | NGGI/AES reference |
|---|---|---|---|
| Energy CO2e (scope 1 combustion) | 20.5 tCO2e/kt | 9.6 MtCO2e | NGA 2025 diesel EF 69.9 kgCO2e/GJ |
| Process CO2e (fugitive, NGGI Cat 1B1a) | 56.5 tCO2e/kt | 26.4 MtCO2e | NGGI 2025: 36 MtCO2e total scope 1 |
| **Total scope 1** | **77.0 tCO2e/kt** | **36.0 MtCO2e** | — |

AES energy coverage: 174.1 PJ modelled vs 174 PJ AES 2025 (Table F, 2023-24) = **100.0%**.  
NGGI total scope 1: 36.0 MtCO2e modelled vs 36 MtCO2e NGGI 2025 = **100.0%**.

Emission factors applied (NGA 2025 DCCEEW, scope 1, AR5 GWP100): diesel/refined liquid fuels 69.9 kgCO2e/GJ; natural gas 51.4 kgCO2e/GJ.

### Conventional state fuel mix trajectory (background only, no packages)

| Year | Refined liquid fuels (GJ/kt) | Electricity (GJ/kt) | Natural gas (GJ/kt) | Energy CO2e (tCO2e/kt) | Fugitive CO2e (tCO2e/kt) |
|---|---|---|---|---|---|
| 2025 | 277 | 72 | 23 | 20.5 | 56.5 |
| 2030 | 267 | 76 | 22 | 19.8 | 52.0 |
| 2035 | 257 | 81 | 21 | 19.0 | 47.0 |
| 2040 | 248 | 86 | 20 | 18.4 | 43.0 |
| 2045 | 238 | 90 | 20 | 17.7 | 39.0 |
| 2050 | 229 | 95 | 19 | 17.0 | 35.0 |

### Integrated low-carbon state — indicative best-case at 2050

| Commodity | Coefficient (GJ/kt) |
|---|---|
| Electricity | 159 |
| Refined liquid fuels | 37 |
| Natural gas | 8 |

| Emission stream | Coefficient |
|---|---|
| Energy CO2e | 3.0 tCO2e/kt |
| Process CO2e (fugitive) | 4.5 tCO2e/kt |

The integrated low-carbon state achieves approximately **85% reduction in energy CO2e** and **92% reduction in fugitive CO2e** relative to the 2025 conventional baseline.
