# Account residual commercial buildings

- Decomposition child of `serve_commercial_building_occupants`; activates only under the `serve_commercial_building_occupants__end_use_decomposition` representation as a required residual companion until explicit commercial end-use children are authored.
- Activity driver: `linked_parent_activity` with `parent_role_id=serve_commercial_building_occupants` and `parent_activity_coefficient=1.0` (placeholder; final coefficient to be calibrated against the prior baseline residual coverage so the decomposition remains baseline-preserving against the default representation, and reduced as explicit end-use children land).
- Default direct method: `commercial_other__residual_incumbent`.
- Residual quantities are mechanically migrated from the prior overlay calibration table.
- This is a residual stub, not an explicit technology or subsector model.
