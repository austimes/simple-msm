# Melt and refine DRI crude steel

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 0
- Unit: `t_crude_steel`
- Anchor status: `derived_intermediate_pilot`

## Validation intent

- Every finishing technology method must have rows for all milestone years.
- The role must resolve as a required child of `produce_crude_steel__h2_dri_decomposition`.
- Downstream topology validation should balance `direct_reduced_iron` input against DRI production when the decomposition is selected.

## Known limitations

The method rows are reduced-form pilot data split from aggregate H2 DRI steel evidence. They should be replaced by route-specific process evidence before using the decomposition for decision-grade analysis.
