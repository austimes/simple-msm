# Make direct reduced iron

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 0
- Unit: `t_dri`
- Anchor status: `derived_intermediate_pilot`

## Validation intent

- Every DRI technology method must have rows for all milestone years.
- The role must resolve as a required child of `make_crude_steel__h2_dri_decomposition`.
- Downstream topology validation should balance `direct_reduced_iron` output against melt/refine input when the decomposition is selected.

## Known limitations

The method rows are reduced-form pilot data split from aggregate H2 DRI steel evidence. They should be replaced by route-specific process evidence before using the decomposition for decision-grade analysis.
