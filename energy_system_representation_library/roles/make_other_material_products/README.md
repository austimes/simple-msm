# Make other material products

Residual role split from the former manufacturing and IPPU residual calibration layer. The role has one route, `Residual incumbent`, and a 2025 demand anchor of `1 residual_activity`.

Commodity quantities, direct energy emissions, and process emissions are carried by normal role-method fields so solver balances and charts treat other material transformation as explicit physical coverage rather than hiding it in aggregate manufacturing or IPPU residual buckets.

The 2025 incumbent fuel coefficients now also include the other-materials share of the retired generic industrial heat baseline. Approximately 60% of the 120 PJ low-temperature, 50% of the 140 PJ medium-temperature, and the 170 PJ high-temperature useful-heat anchor (about 312 PJ_useful_heat in total, with cement kiln heat separately accounted by `generate_cement_kiln_heat`) was folded into this role's natural gas, coal and biomass coefficients using the 2025 fossil heat fuel mix, contributing approximately 13.47 Mt CO2e of energy emissions. The closure-preserving fold is documented in `validation/baseline_emissions_balance.csv` and the host-specific decomposition route remains a future enhancement that would expose explicit `generate_materials_process_heat_*` children for finer-grained fuel-switch dynamics.

Growth proxy: make_crude_steel, make_cement_equivalent. Confidence: low.
