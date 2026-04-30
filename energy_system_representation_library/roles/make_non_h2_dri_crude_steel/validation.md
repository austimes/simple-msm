# Make non-H2 DRI crude steel

## Expected baseline anchor

- Anchor year: 2025
- Anchor value: 5700000.0
- Unit: `t_crude_steel`
- Anchor status: `pilot_decomposition_child`

## Validation intent

- The three non-H2 methods must remain complete across every milestone year.
- This role preserves crude-steel coverage when the H2 DRI branch is decomposed.
- A topology resolver should activate this role only through `make_crude_steel__h2_dri_decomposition`.

## Known limitations

The anchor mirrors parent crude-steel demand until child-role demand allocation and intermediate balancing are implemented in ESRL 2.
