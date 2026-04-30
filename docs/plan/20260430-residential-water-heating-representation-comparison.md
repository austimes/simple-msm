# Residential Water Heating Representation Comparison

Date: 2026-04-30

Status: validation evidence for `simple-msm-techrep-1.5`

Related context:

- [20260430-residential-water-heating-role-boundary.md](./20260430-residential-water-heating-role-boundary.md)

## Purpose

This artifact records a comparison shape for evaluating the residential water-heating aggregate pathway representation against the technology-bundle representation. The numeric rows live in `energy_system_representation_library/validation/residential_water_heating_representation_comparison.csv`.

The comparison is validation evidence only. It should not rewrite authored pathway coefficients without a separate modelling decision.

## Captured Fields

Each row captures activity, cost per service unit, input commodity coefficients, direct emissions, rollout constraints, technology method shares, and deltas between the technology bundle and the selected pathway method.

## Rows Authored

- `2025` incumbent pathway versus calibrated technology incumbent mix.
- `2050` near-zero pathway versus a single active heat-pump technology proxy.

The second row is a proxy for the future solve/reporting work in `simple-msm-techrep-1.6`; it is not labelled as an optimized result.
