# Built-In Configuration Replacement Matrix For The Efficiency-Era Suite

This note closes `088.1` by deciding what happens to the current built-in configuration set once first-class efficiency controls exist.

Use this as the source of truth for `088.2`, `088.3`, and `088.4`. The goal is a smaller, clearer suite that demonstrates autonomous efficiency, endogenous packages, and efficiency-off counterfactuals without preserving prototype names for compatibility.

## 1. Decision Summary

- Do not keep the current 16-file built-in suite.
- Keep exactly one obvious default full-model baseline.
- Make the core comparison trio share the same demand, price, and service scope so efficiency attribution is interpretable.
- Keep focused demos only for sectors with implemented v1 efficiency coverage.
- Do not add a standalone electricity demo; the single accepted electricity package is better shown inside endogenous-electricity demos for buildings, industrial heat, and heavy industry.
- Delete agriculture- and removals-only built-ins from the shipped suite because they do not tell the new efficiency story.
- Delete legacy aliases and near-duplicate baseline names rather than carrying them forward.

## 2. Target Compact Built-In Suite

The target suite should contain 7 built-ins.

| target built-in | role in suite | intended semantics |
| --- | --- | --- |
| `reference-baseline` | default built-in and comparison anchor | Full-model reference case with endogenous electricity, residual overlays excluded, incumbent/default pathway scope, `autonomous_mode=baseline`, and `package_mode=off`. |
| `reference-efficiency-open` | core comparison case | Same demand, price, and service-control backbone as `reference-baseline`, but with `package_mode=all` so all accepted v1 packages can enter where applicable. |
| `reference-efficiency-off` | counterfactual for attribution | Same demand, price, and service-control backbone as `reference-baseline`, but with `autonomous_mode=off` and `package_mode=off`. This isolates the autonomous-efficiency effect. |
| `demo-buildings-efficiency` | focused sector demo | Buildings plus electricity only, with the accepted residential and commercial efficiency packages available and building-relevant transition states open. |
| `demo-freight-efficiency` | focused sector demo | Freight road only, showing the incumbent diesel case, the accepted freight efficiency controls, and the existing embodied efficient-diesel route without carrying a passenger-BEV story. |
| `demo-industrial-heat-efficiency` | focused sector demo | Low-, medium-, and high-temperature heat plus electricity, with the accepted fossil-state efficiency packages available and route-change states open only where they clarify the embodied-vs-portable boundary. |
| `demo-heavy-industry-efficiency` | focused sector demo | Steel and cement plus electricity, combining the accepted steel and cement packages into one heavy-industry demo instead of separate steel and cement smoke tests. |

## 3. Replacement Matrix For The Current Suite

| current built-in | action | target or disposition | reason |
| --- | --- | --- | --- |
| `reference-base` | replace | `reference-baseline` | This is the right conceptual default, but it needs explicit efficiency controls and a user-facing name that reflects the new comparison suite. |
| `reference-all` | replace | `reference-efficiency-open` | The current "all states available" story is too broad for efficiency attribution. Replace it with the explicit packages-on comparison case. |
| `reference` | delete | remove entirely | Legacy baseline alias. It duplicates incumbent-pinned baseline semantics and keeps the old externalized-electricity framing alive for no benefit. |
| `full-model-incumbents` | merge | fold into `reference-baseline` | Near-duplicate of the incumbent baseline. The new suite should not ship two names for the same default idea. |
| `buildings-externalized` | merge | fold into `demo-buildings-efficiency` | Externalized-electricity smoke testing is not the point anymore. The buildings slot should become an efficiency demo with endogenous electricity. |
| `buildings-endogenous` | replace | `demo-buildings-efficiency` | This already scopes to the right sector, but its purpose is still generic solve smoke testing rather than an efficiency narrative. |
| `road-transport-bev` | replace | `demo-freight-efficiency` | Passenger BEV is a route-switch demo, not an efficiency demo. The transport slot should move to the freight family, which has real v1 package coverage. |
| `freight-diesel` | replace | `demo-freight-efficiency` | The freight-only scope is still useful, but it should demonstrate autonomous and operational efficiency rather than only incumbent diesel. |
| `industrial-heat-fossil` | merge | fold into `demo-industrial-heat-efficiency` | Useful scope, but too narrow and prototype-oriented. The new demo should cover the full industrial-heat efficiency capability. |
| `industrial-heat-electrified` | merge | fold into `demo-industrial-heat-efficiency` | Pure electrified-route smoke testing should not survive as its own built-in once industrial heat has first-class efficiency artifacts. |
| `steel-incumbent` | merge | fold into `demo-heavy-industry-efficiency` | Single-sector incumbent smoke tests are too granular for the retained suite. |
| `steel-optimize` | merge | fold into `demo-heavy-industry-efficiency` | Heavy-industry coverage should collapse into one purposeful demo instead of separate steel variants. |
| `cement-only` | merge | fold into `demo-heavy-industry-efficiency` | Cement has implemented efficiency coverage, but not enough distinct user-story value to justify a standalone built-in. |
| `agriculture-only` | delete | remove entirely | The canonical efficiency inventory explicitly marks the agriculture families as `no_material_v1`, so this should not stay in the efficiency-era built-in suite. |
| `land-sequestration-only` | delete | remove entirely | Removals are outside the portable-efficiency story and do not belong in the compact retained suite. |
| `removals-both` | delete | remove entirely | Same reason as `land-sequestration-only`; it is a removals demo, not an efficiency demo. |
| `agriculture-removals-endogenous` | delete | remove entirely | This combines two areas that are out of scope for the retained efficiency-focused suite and would only reintroduce prototype clutter. |

## 4. What Should Disappear Entirely

The following names and categories should not survive `088.4` as built-in configs, aliases, or compatibility redirects.

- `reference`
- `full-model-incumbents`
- All agriculture-only built-ins
- All removals-only built-ins
- Passenger-BEV route-switch built-ins presented as transport demos
- Separate steel-only and cement-only smoke-test built-ins
- Separate externalized-versus-endogenous duplicates for the same sector story

More broadly, the suite should stop shipping configs whose only purpose was one of these prototype concerns:

- verifying auto-inclusion of electricity,
- proving a scoped solve can run,
- showing one single incumbent or electrified state in isolation,
- preserving an older default name.

Those concerns can still be covered by tests. They do not need user-facing built-in scenarios.

## 5. Implementation Guidance For Follow-On Issues

`088.2` should author the three core reference configs first and make sure they differ only where the efficiency story needs them to differ.

`088.3` should then add only the four focused demos listed above, and no additional gallery entries unless another issue explicitly expands the suite.

`088.4` should remove every superseded file from `web/src/configurations/`, rewrite `_index.json` to the 7-config target suite, and point the default entrypoint at `reference-baseline` with no compatibility aliasing.
