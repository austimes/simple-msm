# Move passengers by rail

## What the role represents

This role makes domestic passenger rail visible as a physical non-road transport role. It is currently represented by one residual incumbent method rather than explicit rail technologies.

## Role definition

- Role id: `move_passengers_by_rail`
- Balance type: `service_demand`
- Output unit: `residual_activity`
- Output quantity basis: One residual activity unit carrying the passenger rail share of the former transport-other calibration.
- Default incumbent method id: `transport_rail_passenger__residual_incumbent`

## Expansion path

Replace the residual method with explicit urban rail, regional rail, and intercity rail service pathways when passenger-km, energy, and fleet evidence is authored.
