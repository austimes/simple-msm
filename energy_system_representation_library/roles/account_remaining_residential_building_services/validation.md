# Account residual residential buildings

- Decomposition child of `serve_residential_building_occupants`; activates only under the `serve_residential_building_occupants__end_use_decomposition` representation as a required residual companion alongside `provide_residential_water_heating`.
- Activity driver: `linked_parent_activity` with `parent_role_id=serve_residential_building_occupants` and `parent_activity_coefficient=0.75` (placeholder; final coefficient to be calibrated against the prior baseline residual coverage so the decomposition remains baseline-preserving against the default representation).
- Default direct method: `residential_other__residual_incumbent`.
- Residual quantities are mechanically migrated from the prior overlay calibration table.
- This is a residual stub, not an explicit technology or subsector model.
