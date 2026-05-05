# Account remaining residential building services

Required residual companion of `serve_residential_building_occupants` that activates only when the residential end-use decomposition representation (`serve_residential_building_occupants__end_use_decomposition`) is selected. The role absorbs residential building activity not represented by explicit end-use children (currently the water-heating child) so the decomposition preserves full residential building coverage.

When the default reduced-form `serve_residential_building_occupants__pathway_bundle` representation is active, this child is inactive and residential coverage flows through the parent's pathway bundle. The role still has one direct method, `Residual incumbent`, used when it is activated; commodity quantities, direct emissions, and residual costs are carried by the normal role-method fields.

Activity is now driven by `linked_parent_activity` from `serve_residential_building_occupants` with a placeholder coefficient of `0.75` (residential service-equivalent activity not allocated to the existing 0.25 hot-water share). The final coefficient is to be calibrated against the prior baseline residual coverage.

Growth proxy: residential_building_services. Confidence: low.
