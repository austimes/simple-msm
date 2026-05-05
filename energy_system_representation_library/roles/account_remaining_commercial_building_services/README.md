# Account remaining commercial building services

Required residual companion of `serve_commercial_building_occupants` that activates only when the commercial end-use decomposition representation (`serve_commercial_building_occupants__end_use_decomposition`) is selected. The role absorbs all commercial building activity until explicit commercial end-use children are authored, so the decomposition preserves full commercial building coverage.

When the default reduced-form `serve_commercial_building_occupants__pathway_bundle` representation is active, this child is inactive and commercial coverage flows through the parent's pathway bundle. The role still has one direct method, `Residual incumbent`, used when it is activated; commodity quantities, direct emissions, and residual costs are carried by the normal role-method fields.

Activity is now driven by `linked_parent_activity` from `serve_commercial_building_occupants` with a placeholder coefficient of `1.0` (full commercial service-equivalent activity, since no commercial end-use children exist yet). The final coefficient is to be calibrated against the prior baseline residual coverage and reduced as explicit commercial end-use children land.

Growth proxy: commercial_building_services. Confidence: low.
