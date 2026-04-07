# Calibration and validation pack

## Purpose

The goal of calibration in Phase 1 was not exact replication of every Australian national account. It was to show that the reduced-form state library can be anchored credibly to observed Australian energy and emissions patterns.

## Summary table

| calibration_item                                                                                                          |   official_value |   library_value | unit           |   deviation_pct | notes                                                                                                                                                                                                   | source_ids                               | assumption_ids           |
|:--------------------------------------------------------------------------------------------------------------------------|-----------------:|----------------:|:---------------|----------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------|:-------------------------|
| Electricity generation (2024 national baseline activity)                                                                  |       283920     |     283920      | GWh            |            0    | Library baseline uses official national generation activity directly; electricity states are intensity states rather than demand states.                                                                | ["S003"]                                 | ["A001", "A011", "A012"] |
| Electricity renewable share (2024 national blend used for baseline illustration)                                          |           36     |         36      | %              |            0    | Calibration blend uses 64% incumbent thermal mix + 36% policy-frontier supply, matching official 2024 renewable share.                                                                                  | ["S003"]                                 | ["A011", "A012"]         |
| Electricity direct emissions (illustrative national 2025 blend)                                                           |          151.7   |        137.19   | MtCO2e         |           -9.56 | Library blend is below the 2023 electricity sector inventory because the 2024 baseline uses a stronger renewable share and a national reduced-form blend rather than a one-year sector-inventory total. | ["S003", "S006"]                         | ["A001", "A011", "A012"] |
| Residential final energy — electricity                                                                                    |          252     |        252.278  | PJ             |            0.11 | Incumbent residential state is normalised to reproduce official 2023–24 fuel split exactly when service demand is set to official residential final energy.                                             | ["S001", "S002"]                         | ["A004", "A005"]         |
| Residential final energy — natural_gas                                                                                    |          140     |        139.995  | PJ             |           -0    | Incumbent residential state is normalised to reproduce official 2023–24 fuel split exactly when service demand is set to official residential final energy.                                             | ["S001", "S002"]                         | ["A004", "A005"]         |
| Residential final energy — refined_liquid_fuels                                                                           |           15     |         14.8118 | PJ             |           -1.25 | Incumbent residential state is normalised to reproduce official 2023–24 fuel split exactly when service demand is set to official residential final energy.                                             | ["S001", "S002"]                         | ["A004", "A005"]         |
| Residential final energy — biomass                                                                                        |           70     |         69.7588 | PJ             |           -0.34 | Incumbent residential state is normalised to reproduce official 2023–24 fuel split exactly when service demand is set to official residential final energy.                                             | ["S001", "S002"]                         | ["A004", "A005"]         |
| Commercial final energy — electricity                                                                                     |          231     |        231.251  | PJ             |            0.11 | Incumbent commercial state is normalised to reproduce official 2023–24 fuel split exactly when service demand is set to official commercial final energy.                                               | ["S001", "S002"]                         | ["A004", "A005"]         |
| Commercial final energy — natural_gas                                                                                     |           50     |         49.9578 | PJ             |           -0.08 | Incumbent commercial state is normalised to reproduce official 2023–24 fuel split exactly when service demand is set to official commercial final energy.                                               | ["S001", "S002"]                         | ["A004", "A005"]         |
| Commercial final energy — refined_liquid_fuels                                                                            |           33     |         32.991  | PJ             |           -0.03 | Incumbent commercial state is normalised to reproduce official 2023–24 fuel split exactly when service demand is set to official commercial final energy.                                               | ["S001", "S002"]                         | ["A004", "A005"]         |
| Buildings direct on-site emissions (residential + commercial)                                                             |          nan     |         13.0865 | MtCO2e         |          nan    | Not compared directly to the official 'built environment' sector because library coefficients exclude electricity scope 2 emissions and some non-building activities.                                   | ["S006"]                                 | ["A003", "A004", "A005"] |
| Passenger road service activity (cars + buses)                                                                            |          293.415 |        293.415  | billion pkm    |            0    | Official BITRE passenger road activity benchmark used directly.                                                                                                                                         | ["S012"]                                 | ["A006", "A007"]         |
| Freight road service activity                                                                                             |          249     |        249      | billion tkm    |            0    | Official BITRE road freight task used directly.                                                                                                                                                         | ["S013"]                                 | ["A008"]                 |
| Road transport final energy (passenger ICE + freight diesel baseline states)                                              |         1263     |       1261.59   | PJ             |           -0.11 | Passenger-road and freight-road incumbent states jointly reproduce official road-energy demand.                                                                                                         | ["S001", "S012", "S013"]                 | ["A006", "A007", "A008"] |
| Road freight direct emissions (diesel baseline state)                                                                     |           36     |         35.109  | MtCO2e         |           -2.47 | Compared with Australian road-freight decarbonisation evidence (~36 MtCO2 annually).                                                                                                                    | ["S016"]                                 | ["A008"]                 |
| Agriculture final energy                                                                                                  |          110.9   |        111      | PJ             |            0.09 | Livestock and cropping bundles exactly reproduce official agriculture fuel totals by construction.                                                                                                      | ["S001", "S002", "S027", "S028", "S029"] | ["A018", "A019"]         |
| Agriculture direct + process emissions                                                                                    |           82.2   |         82.2    | MtCO2e         |           -0    | Livestock and cropping bundles reproduce official agriculture emissions by construction at a coarse-bundle level.                                                                                       | ["S006"]                                 | ["A018", "A019"]         |
| Cement thermal energy at 9.6 Mt cement-equivalent output                                                                  |           21     |         23.04   | PJ             |            9.71 | Conventional cement state is close to current Australian industry thermal use; remaining difference is acceptable at Phase 1 granularity.                                                               | ["S025"]                                 | ["A016", "A017"]         |
| Cement electricity use at 9.6 Mt cement-equivalent output                                                                 |            0.88  |          0.96   | TWh            |            9.09 | Conventional cement state is close to current Australian electricity use for cement manufacturing.                                                                                                      | ["S025"]                                 | ["A016", "A017"]         |
| Steel crude output used for order-of-magnitude check                                                                      |            5.7   |          5.7    | Mt crude steel |            0    | Indicative current Australian crude steel scale from industry context.                                                                                                                                  | ["S033"]                                 | ["A014"]                 |
| Conventional steel direct emissions at 5.7 Mt output                                                                      |          nan     |         11.4    | MtCO2e         |          nan    | Order-of-magnitude check only. No authoritative Australian plant-level route inventory was assembled in Phase 1.                                                                                        | ["S022", "S024", "S033"]                 | ["A014", "A015"]         |
| Illustrative generic industrial heat fossil-energy coverage (low+medium+high heat states with 120/140/170 PJ useful heat) |          749     |        630.574  | PJ             |          -15.81 | Shows that generic industrial heat + cement + steel can be tuned into the vicinity of official manufacturing final energy, while leaving a residual for omitted non-heat industrial uses.               | ["S002", "S025", "S033"]                 | ["A013", "A014", "A016"] |

## Interpretation

### Strong calibration areas

The strongest calibration areas are:

- residential and commercial buildings,
- road transport,
- agriculture,
- cement sector energy use.

These sectors are strong because the Phase 1 service/output definitions can be tied directly to official or transparent Australian totals.

### Electricity

Electricity is represented as a **state library of supply intensities**, not as a single fixed historical mix. For baseline illustration, a 2024 national blend using the official renewable share was used. The resulting implied direct emissions are slightly below the 2023 electricity inventory total because the baseline blend reflects stronger renewable penetration than the earlier inventory year and is intentionally reduced-form.

### Buildings

Buildings are calibrated by construction. If the model sets 2025 activity equal to official 2023–24 final energy:

- the incumbent residential state reproduces the official residential fuel split,
- the incumbent commercial state reproduces the official commercial fuel split.

This is one reason buildings are credible enough for an MVP reduced-form model.

### Road transport

Passenger-road and freight-road incumbent states jointly reproduce official Australian road-energy demand to within roughly one tenth of one per cent using official BITRE passenger-km and tonne-km activity.

This is a core credibility check because transport is one of the sectors most likely to drive electricity-demand change under decarbonisation pressure.

### Agriculture

The two coarse agriculture bundles reproduce official agriculture energy and emissions totals almost exactly by construction. That should not be mistaken for high process detail; it simply means the residual sector block is correctly anchored at national scale.

### Cement

The conventional cement state is close to current Australian industry energy use at roughly current Australian production scale. That gives reasonable confidence that the cement state family is not radically mis-scaled.

### Steel

Steel calibration is intentionally weaker. The package only performs an order-of-magnitude route check using indicative current Australian crude steel output. This is acceptable for Phase 1 because the purpose of steel here is to preserve one representative hard-to-abate process chain in the MVP model, not to substitute for a plant model.

### Generic industrial heat

Generic industrial heat is not strictly calibrated to an official service total because its service definition is artificial by design. The validation check instead asks whether plausible activity levels can bring generic industrial heat plus steel and cement into the vicinity of Australian manufacturing final-energy demand. They can, but only coarsely. This confirms that generic industrial heat is useful for MVP sensitivity work but remains a Phase 2 priority for refinement.

## Main deviations that matter

1. **Electricity direct emissions** are somewhat lower than the earlier official inventory benchmark when the baseline blend uses more recent renewable penetration.
2. **Cement energy use** is about 9–10% above one recent Australian benchmark under the chosen conventional state, which is acceptable at Phase 1 granularity.
3. **Generic industrial heat** is intentionally partial and should not be used to claim exact manufacturing-sector calibration.

## Overall calibration judgement

The package passes a reasonable Phase 1 calibration threshold for a reduced-form national model because:

- baseline sector energy structure is strong in electricity, buildings, road transport and agriculture,
- cement is acceptably anchored,
- and the weaker sectors are clearly marked as weak rather than hidden behind false precision.
