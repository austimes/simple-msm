# international_shipping

## What the family represents

This family covers international maritime bunker fuel consumed in Australian ports for international voyages as a single national-average technology family for region `AUS`. The service output is international shipping activity in million tonne-kilometres (million_tkm), representing the cargo transport task associated with Australian-bunkered international shipping — predominantly bulk export carriers (iron ore, coal, LNG, grain) and containerised trade.

**Scope boundary:** The model covers fuel physically loaded in Australian ports for international voyages, consistent with NGGI international maritime bunker accounting (IPCC guidelines, Category 1A3d international navigation). Fuel loaded in foreign ports for voyages serving Australia is excluded.

The family captures three main levers aligned with IMO 2050 decarbonisation strategy:

- LNG as a lower-carbon transition fuel (MARPOL Annex VI compliance bridge)
- Zero-emission marine fuels (green ammonia, green methanol, green hydrogen) for long-haul bulk trade
- Vessel speed, route, and loading optimisation

## Output/service definition

- Family id: `international_shipping`
- Output/service name: `international_maritime_freight`
- Output unit: `million_tkm`
- Output quantity basis: One million tonne-kilometres of international shipping associated with Australian bunkering. Calibrated to AES 2023-24 international maritime bunker fuel (65 PJ); service volume is an estimated 200,000 million_tkm based on a ~0.3 MJ/tkm energy intensity consistent with large ocean bulk carriers.
- Demand trajectory: `growing__international_shipping` (+1.5%/yr 2025–2035, +0.5%/yr 2035–2050; driven by Australian commodity export growth moderating as IMO decarbonisation targets reshape demand)
- 2025 demand anchor: 200,000 million_tkm
- Default incumbent state id: `international_shipping__conventional_hfo`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `international_shipping__conventional_hfo` | Conventional HFO/MDO | Incumbent | Heavy fuel oil and marine diesel oil mix for large ocean-going bulk carriers, tankers, and container ships. Energy intensity consistent with large vessel Capesize/Panamax performance (~0.3 MJ/tkm). 2025 max_share = 1.00. |
| `international_shipping__lng_transition` | LNG transition fuel | Ambition 1 | LNG dual-fuel vessels as bridge fuel; lower CO2 per GJ than HFO (~30% reduction), but higher energy per tkm due to dual-fuel engine efficiency penalty. Applicable under IMO CII ratings. 2025 max_share = 0.01 → 0.30 by 2050. |
| `international_shipping__zero_emission_fuel` | Zero-emission marine fuel | Ambition 2 | Green ammonia (representative of the zero-emission marine fuel class, which includes green methanol and green H2). Available from 2030 as first commercial deployments begin. 2025 max_share = 0.00 → 0.25 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2023-24 (international maritime bunker fuel 65 PJ). See `shared/source_ledger.csv`
- `S013` — BITRE freight linehaul / transport yearbook (international shipping activity reference). See `shared/source_ledger.csv`
- `S032` — NGA Factors 2024 (HFO 78.9 kgCO2e/GJ; MDO 74.4 kgCO2e/GJ). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded. See `shared/assumptions_ledger.csv`
- `A022` — Feasibility bounds are indicative upper bounds. See `shared/assumptions_ledger.csv`
- `A023` — Cost paths smoothed across milestone years. See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses three technology states (one incumbent, two transition pathways) to represent the main decarbonisation options for international shipping consistent with IMO strategy.

The incumbent (`conventional_hfo`) anchors to AES 2023-24 bunker energy at national scale. LNG (`lng_transition`) represents the commercially available near-term lower-carbon option already deployed in new builds for Australian LNG trade routes. The zero-emission fuel state (`zero_emission_fuel`) captures the long-run IMO 2050 pathway; green ammonia is used as the representative commodity since it is the leading contender for Australian bulk trade routes given Australia's green hydrogen and ammonia export ambitions. Together these three states span the credible technology range without requiring vessel-type or flag-of-registry detail.

## Known caveats

### Estimated service volume
The 200,000 million_tkm service anchor is an estimate derived from the AES bunker energy and an assumed energy intensity of ~0.3 MJ/tkm consistent with large bulk carrier operations. BITRE does not publish a comprehensive Australian international shipping tonne-km series. The energy anchor (65 PJ) is robust; the tonne-km denominator carries substantial uncertainty. Users should treat energy CO2e per tonne-km coefficients as indicative rather than precise.

### LNG methane slip
The LNG state uses CO2e emission factors per GJ of LNG consumed. Methane slip from dual-fuel engines (uncombusted methane venting at low load) can be significant (1–2% of fuel mass) and is not fully captured in the NGA combustion factor. Full lifecycle CH4 accounting for LNG vessels may reduce or eliminate the apparent CO2e advantage over HFO when slip is included.

### Zero-emission fuel availability
Green ammonia and green methanol at scale for international shipping do not yet exist commercially in 2025. The `zero_emission_fuel` state is not available until 2030 in the model. Cost trajectories carry Low confidence and depend strongly on global green hydrogen market development.

### Bunker boundary complexity
International shipping bunkers as reported in NGGI represent fuel loaded in Australian ports, regardless of the vessel's flag, route origin, or cargo destination. This means the NGGI and AES data capture the Australian port bunkering market, not Australia's attributable share of global shipping emissions for its trade. The two differ materially because many LNG tankers and iron ore carriers refuel in Singapore or other hubs.

## Efficiency artifacts

### Autonomous efficiency tracks

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background MARPOL/CII fleet efficiency compliance | `conventional_hfo`, `lng_transition` | IMO Carbon Intensity Indicator (CII) ratings driving fleet renewal; energy efficiency design index (EEDI) for new builds; waste-heat recovery on main engines | ~10% (multiplier: 1.000 → 0.905) |

### Efficiency packages

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Vessel speed optimisation and route planning | operational_efficiency_overlay | `conventional_hfo`, `lng_transition` | HFO, MDO, LNG | 0.88 (−12%; slow steaming from ~15 to ~12 knots; well-documented for large bulk carriers) |
| Wind-assist technology (Flettner rotors / rigid sails) | pure_efficiency_overlay | `conventional_hfo`, `lng_transition` | HFO, MDO | 0.92 (−8%; Flettner rotor and wing-sail evidence from Vale and Cargill trials) |

Evidence basis: Vale, Cargill, and MOL have operated Flettner rotor vessels reporting 5–10% fuel savings; IMO and classification societies report slow steaming can reduce fuel consumption 10–20% for large bulk carriers.

## Expansion path

- **Phase 2:** Disaggregate by vessel type (Capesize bulk carrier for iron ore/coal, LNG tanker, Panamax container, general cargo) and route (Asia, Europe, Americas, Pacific) to recover cargo-specific and route-specific energy intensity and technology applicability.
- Separate Australian-flagged vessel bunkers from foreign-vessel bunkers if BITRE or AMSA data become available.
- Add methane slip penalty to LNG state as a process CO2e component once Australian-specific dual-fuel engine data are available.
- Model shore power at major Australian ports (Fremantle, Port Kembla, Botany Bay) as a small efficiency package for port dwell time.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (conventional_hfo, 200,000 million_tkm)

| Commodity | Coefficient (GJ/million_tkm) | Total at anchor |
|---|---|---|
| Heavy fuel oil | 195 | 39.0 PJ |
| Marine diesel oil | 130 | 26.0 PJ |
| **Total energy** | **325** | **65.0 PJ** |

| Emission stream | Coefficient | Total at anchor | Reference |
|---|---|---|---|
| Energy CO2e (scope 1, NGGI international bunkers) | 25.1 tCO2e/million_tkm | 5.0 MtCO2e | NGGI international maritime bunkers ~3–5 MtCO2e |
| Process CO2e | 0 | 0 | — |

AES bunker energy coverage: 65.0 PJ modelled vs 65 PJ AES 2023-24 = **100.0%**.

Emission factors (NGA 2024, AR5 GWP100): HFO 78.9 kgCO2e/GJ; MDO 74.4 kgCO2e/GJ.  
Blended energy CO2e: (195×78.9 + 130×74.4)/1000 = 25.1 tCO2e/million_tkm ✓

### Conventional HFO state trajectory

| Year | HFO (GJ/million_tkm) | MDO (GJ/million_tkm) | Energy CO2e (tCO2e/million_tkm) |
|---|---|---|---|
| 2025 | 195 | 130 | 25.1 |
| 2030 | 188 | 125 | 24.2 |
| 2035 | 181 | 120 | 23.3 |
| 2040 | 174 | 116 | 22.4 |
| 2045 | 169 | 112 | 21.7 |
| 2050 | 165 | 110 | 21.3 |

### Zero-emission fuel state at 2050 (indicative best-case)

| Commodity | Coefficient (GJ/million_tkm) | Scope 1 CO2e |
|---|---|---|
| Ammonia | 320 | 0 (green ammonia; no fossil CO2) |

The zero-emission fuel state achieves **100% reduction in scope 1 energy CO2e** relative to the 2025 conventional baseline.
