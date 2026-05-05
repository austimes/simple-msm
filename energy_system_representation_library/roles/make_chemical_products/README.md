# Make chemical products

Residual role split from the former manufacturing and IPPU residual calibration layer. The role has one route, `Residual incumbent`, and a 2025 demand anchor of `1 residual_activity`.

Commodity quantities, direct energy emissions, and process emissions are carried by normal role-method fields so solver balances and charts treat chemical and petrochemical transformation as explicit physical coverage rather than hiding it in aggregate manufacturing or IPPU residual buckets.

The 2025 incumbent fuel coefficients now also include the chemicals share of the retired generic industrial heat baseline. Approximately 40% of the 120 PJ low-temperature and 50% of the 140 PJ medium-temperature useful-heat anchor (about 118 PJ_useful_heat in total) was folded into this role's natural gas, coal and biomass coefficients using the 2025 fossil heat fuel mix, contributing approximately 5.88 Mt CO2e of energy emissions. The closure-preserving fold is documented in `validation/baseline_emissions_balance.csv` and the host-specific decomposition route remains a future enhancement that would expose explicit `generate_chemical_process_heat_*` children for finer-grained fuel-switch dynamics.

Growth proxy: make_crude_steel, make_cement_equivalent. Confidence: low.
