# domestic_shipping

## What the family represents

This family covers Australian domestic coastal and intra-harbour shipping (ANZSIC 4800 domestic water transport) as a single national-average technology family for region `AUS`. The service output is freight delivered in million tonne-kilometres (million_tkm), covering coastal bulk carriers, roll-on/roll-off ferries, passenger ferries, and harbour services.

The family captures three main emission-reduction levers:

- Battery-electric propulsion for short-range coastal routes and ferries
- Green ammonia fuel for longer-range coastal bulk carriers
- Operational efficiency improvements (slow steaming, hull management)

## Output/service definition

- Family id: `domestic_shipping`
- Output/service name: `domestic_coastal_freight`
- Output unit: `million_tkm`
- Output quantity basis: One million tonne-kilometres of domestic coastal and harbour shipping service. Calibrated to AES 2023-24 Table F (30 PJ domestic water transport) and BITRE coastal freight statistics (30,000 million tkm estimated national service).
- Demand trajectory: `stable__domestic_shipping` (+0.5%/yr; modest growth reflecting coastal trade patterns)
- 2025 demand anchor: 30,000 million_tkm
- Default incumbent state id: `domestic_shipping__conventional_diesel`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `domestic_shipping__conventional_diesel` | Conventional diesel/HFO | Incumbent | Marine diesel oil and heavy fuel oil mix across coastal fleet. National-average intensity for coastal vessels (~1,000 GJ/million_tkm = 1 MJ/tkm; consistent with smaller coastal vessels vs ocean-going bulk carriers). 2025 max_share = 1.00. |
| `domestic_shipping__battery_electric_vessel` | Battery-electric vessel | Ambition 1 | Battery-electric propulsion for short coastal routes (ferries, harbour vessels, coastal tankers <200 km). Electric propulsion ~50% more energy-efficient per tkm than diesel. 2025 max_share = 0.01 → 0.25 by 2050. |
| `domestic_shipping__green_ammonia_vessel` | Green ammonia vessel | Ambition 2 | Ammonia-fuelled vessels for longer coastal routes; zero scope 1 CO2 if green ammonia. Higher volumetric fuel requirement than diesel/HFO. 2025 max_share = 0.00 → 0.20 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2023-24 Table F (30 PJ domestic water transport energy). See `shared/source_ledger.csv`
- `S013` — BITRE freight linehaul statistics (coastal freight task, million tkm). See `shared/source_ledger.csv`
- `S032` — NGA Factors 2024 (marine diesel oil 74.4 kgCO2e/GJ; heavy fuel oil 78.9 kgCO2e/GJ). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded. See `shared/assumptions_ledger.csv`
- `A022` — Feasibility bounds are indicative upper bounds. See `shared/assumptions_ledger.csv`
- `A023` — Cost paths smoothed across milestone years. See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses three technology states (one incumbent, two transition pathways) to represent the main decarbonisation options for domestic shipping.

The incumbent (`conventional_diesel`) anchors to AES 2023-24 at national scale. Battery-electric (`battery_electric_vessel`) targets the near-term electrification lever applicable to ferries and short coastal routes where shore charging infrastructure is feasible. Green ammonia (`green_ammonia_vessel`) represents the zero-emission pathway for longer coastal routes where battery energy density is insufficient, consistent with emerging IMO decarbonisation targets and Australian ammonia export ambitions. Together these three states let the solver represent the key clean fuel switch options for domestic shipping without requiring vessel-type or route-specific decomposition.

## Known caveats

- **Estimated service volume.** The 30,000 million_tkm coastal freight anchor is an estimate based on BITRE freight statistics; BITRE does not publish a single definitive coastal shipping tonne-km series comparable to road and rail. The AES 30 PJ energy anchor is more reliable than the service volume estimate. The energy intensity coefficient (1,000 GJ/million_tkm) carries Medium-Low confidence.
- **Passenger ferry exclusion.** Passenger ferries (Sydney Ferries, Trans-Tasman ferries) are service-carrying vessels measured in pkm, not tkm. This family represents freight and general cargo shipping. Passenger ferry energy is included in the AES aggregate but the service unit (tkm) undercounts their contribution per unit of social service delivered.
- **Green ammonia maturity.** No commercial-scale green ammonia marine fuel supply chain exists in Australia in 2025. The `green_ammonia_vessel` state carries a Low confidence rating and zero availability in 2025.
- **Sulphur content and MARPOL compliance.** The transition from HFO to marine diesel oil under MARPOL Annex VI (IMO 2020 sulphur cap) is captured in the fuel mix; both fuels emit similar CO2e per GJ.

## Efficiency artifacts

### Autonomous efficiency tracks

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background vessel engine efficiency improvement | `conventional_diesel` | MARPOL Tier III engine standards compliance, waste-heat recovery on new builds, auxiliary power optimisation | ~7% (multiplier: 1.000 → 0.928) |

### Efficiency packages

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Slow steaming and voyage optimisation | operational_efficiency_overlay | `conventional_diesel` | Marine diesel oil, heavy fuel oil | 0.85 (−15%; well-documented for coastal vessels; speed reduction from 15 to 12 knots) |
| Hull biofouling management and air lubrication | pure_efficiency_overlay | `conventional_diesel` | Marine diesel oil, heavy fuel oil | 0.90 (−10%; hull coating improvements and air lubrication systems) |

Evidence basis: Industry and academic literature consistently shows 10–20% fuel savings from slow steaming on coastal routes; hull biofouling management programmes report 5–15% drag reduction depending on vessel age.

## Expansion path

- **Phase 2:** Disaggregate by vessel type (bulk carrier, container/RoRo, tanker, passenger ferry) and route class (inter-port coastal, harbour/intra-port, short-sea). Passenger ferries should be modelled separately in million_pkm.
- Add liquefied natural gas (LNG) as a transition fuel state (MARPOL-compliant vessels bunkering at Australian LNG export terminals).
- Model shore power infrastructure availability at major Australian ports explicitly.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (conventional_diesel, 30,000 million_tkm)

| Commodity | Coefficient (GJ/million_tkm) | Total at anchor |
|---|---|---|
| Marine diesel oil | 650 | 19.5 PJ |
| Heavy fuel oil | 350 | 10.5 PJ |
| **Total energy** | **1,000** | **30.0 PJ** |

| Emission stream | Coefficient | Total at anchor | Reference |
|---|---|---|---|
| Energy CO2e (scope 1) | 76.0 tCO2e/million_tkm | 2.28 MtCO2e | NGGI domestic navigation ~2.2 MtCO2e |
| Process CO2e | 0 | 0 | — |

AES energy coverage: 30.0 PJ modelled vs 30 PJ AES 2023-24 = **100.0%**.

Emission factors (NGA 2024, AR5 GWP100): marine diesel oil 74.4 kgCO2e/GJ; heavy fuel oil 78.9 kgCO2e/GJ. Blended: (650×74.4 + 350×78.9)/1000 = 76.0 tCO2e/million_tkm.

### Conventional diesel state trajectory

| Year | MDO (GJ/million_tkm) | HFO (GJ/million_tkm) | Energy CO2e (tCO2e/million_tkm) |
|---|---|---|---|
| 2025 | 650 | 350 | 76.0 |
| 2030 | 625 | 335 | 73.1 |
| 2035 | 604 | 325 | 70.6 |
| 2040 | 585 | 315 | 68.3 |
| 2045 | 568 | 308 | 66.4 |
| 2050 | 580 | 310 | 67.5 |

### Green ammonia vessel state at 2050 (indicative best-case)

| Commodity | Coefficient (GJ/million_tkm) | Scope 1 CO2e |
|---|---|---|
| Ammonia | 1,000 | 0 (green ammonia; no CO2 combustion product) |

The green ammonia state achieves **100% reduction in scope 1 energy CO2e** relative to the 2025 conventional baseline.
