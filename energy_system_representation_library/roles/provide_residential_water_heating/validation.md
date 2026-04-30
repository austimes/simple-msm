# Provide residential water heating

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 119250000.0
- Unit: `GJ_hot_water_service`
- Anchor status: `derived_proxy`
- Default incumbent method id: `buildings__residential_water_heating__incumbent_mixed_fuels`
- Source role: `docs/plan/20260430-residential-water-heating-role-boundary.md`
- Coverage note: Derived as 25% of the aggregate residential building service-equivalent anchor.

## What must reconcile at incumbent/default settings

- The default incumbent method must exist in `method_years.csv` for every milestone year.
- The pathway representation must expose at least incumbent, transition, and near-zero direct-emissions pathway methods.
- The technology bundle must expose gas, resistive electric, electric heat-pump, and solar/boosted methods.
- The role metric should use the linked parent activity anchor and incumbent direct-emissions intensity until an end-use-specific hot-water dataset replaces the proxy.
- Scenario configurations must avoid activating this role additively on top of the full aggregate residential building-services role.

## Validation tolerances

- Activity anchor reproduction within 0.5%.
- Method-year rows for each method across 2025, 2030, 2035, 2040, 2045, and 2050.
- Incumbent pathway direct-emissions metric within rounding tolerance of the method-year coefficient multiplied by 119250000.0 `GJ_hot_water_service`.

## Known deviations

- Activity and method coefficients are exploratory because the current library does not yet carry a separate Australian hot-water service series.
- Rollout limits are availability envelopes, not a housing-stock turnover model.

## What is intentionally approximate or excluded

- Technology-specific appliance rows are deferred to `simple-msm-techrep-1.3`.
- The 2025 technology-bundle incumbent shares must sum to `1.0`: gas storage `0.48`, resistive electric `0.32`, electric heat pump `0.12`, and solar boosted `0.08`.
- `would_expand_to_explicit_capacity` values across the role: false.
- `would_expand_to_process_chain` values across the role: false.
