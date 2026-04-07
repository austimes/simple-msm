# Road transport derivation

## Output definition

Road transport is split into:

- passenger road transport: `pkm`
- freight road transport: `tkm`

These are the most defensible service definitions for a national reduced-form model because they can be linked directly to official BITRE service activity.

## State family used

### Passenger road

1. ICE-dominated fleet
2. hybrid transition fleet
3. battery-electric fleet

### Freight road

1. diesel freight
2. efficient diesel freight
3. battery-electric freight
4. hydrogen fuel-cell freight

## Why these states were chosen

The state family preserves the key decarbonisation choices that matter for an MVP:

- liquid fuels versus electricity versus hydrogen,
- moderate efficiency gains without full drivetrain switch,
- and distinct cost/exposure patterns for passenger and freight.

## Evidence used

Main source IDs:

- `S001` for official road-energy totals
- `S012`, `S013` for passenger-km and tonne-km
- `S014`, `S015` for passenger EV/hybrid evidence
- `S016`, `S017` for Australian freight decarbonisation evidence
- `S032` for direct fuel combustion factors

## Important methodological choice

The passenger-road incumbent coefficient is a **stock-average fleet coefficient**, not a representative new-car coefficient.

That choice was necessary because using only new-vehicle fuel-consumption values would have materially under-reproduced current aggregate road fuel demand. The reduced-form library is meant to match the current system first and then represent transitions from that system.

## Freight caveat

Freight-road transition states are less certain than passenger-road states because national freight service is heterogeneous across:

- duty class,
- range requirement,
- depot access,
- payload,
- and route utilisation.

The Phase 1 coefficients should therefore be treated as national-average service archetypes, not truck-class engineering specifications.

## Expandability

Likely Phase 2 expansion:

- passenger cars, SUVs and light commercial vehicles separately
- buses as a distinct passenger-road mode
- medium and heavy articulated freight splits
- stock turnover
- charging and hydrogen-fuelling infrastructure constraints
- occupancy / load-factor explicit treatment
