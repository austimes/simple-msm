# Account residual transport

Compatibility residual role retained from the former residual role calibration layer. The role has one route, `Transport residual compatibility incumbent`, and a 2025 demand anchor of `1 residual_activity`, but the calibrated residual quantities have moved to explicit non-road transport roles:

- `move_passengers_by_rail`
- `move_freight_by_rail`
- `move_passengers_by_air`
- `move_freight_by_marine`
- `account_other_non_road_transport_activity`

This role should no longer be used as an opaque transport residual bucket. It remains only so older configuration surfaces that reference `transport_other` continue to resolve while the library shape evolves.
