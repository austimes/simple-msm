# Cement derivation

## Output definition

- output: `cement_equivalent`
- unit: `t_cement_equivalent`

A cement-equivalent basis was chosen instead of pure clinker because the Australian evidence base is strong on:

- clinker-to-cement ratio,
- specific thermal demand per tonne clinker,
- and electricity demand per tonne cement.

Using cement-equivalent output allows those pieces to be combined cleanly in one reduced-form state family.

## State family used

1. conventional cement
2. low-clinker / alternative-fuels cement
3. deep-abatement cement with CCS

## Why this is one of the stronger hard-to-abate sectors in Phase 1

Australia has unusually useful cement pathway evidence for reduced-form modelling, especially from CIF:

- clinker factor trajectories,
- alternative fuel shares,
- electricity intensity,
- thermal intensity,
- current Australian production and energy use.

That makes cement much more defensible than a generic industrial placeholder.

## Evidence used

Main source IDs:

- `S025` for the core Australian pathway and production data
- `S026` for international benchmark cross-checking
- `S032` for direct combustion-factor support
- `S030` for CCS/removals context where relevant

## How process emissions were derived

Process emissions were derived from the product of:

- clinker factor, and
- clinker process-CO2 factor

using the Australian CIF pathway evidence (`A017`).

This is transparent and easily reviewable.

## Calibration quality

The conventional 2025 state is close to current Australian sector-scale energy use when paired with about 9.6 Mt cement-equivalent output:

- thermal energy close to current Australian cement-sector thermal demand
- electricity close to current Australian electricity use for cement manufacturing

That makes cement one of the cleanest calibration stories in the package.

## Expandability

Likely Phase 2 expansion:

- explicit clinker production
- SCM / clinker substitution chain
- cement grinding
- kiln retrofits
- CCS capture, compression and storage
- imported clinker versus domestic clinker distinction
