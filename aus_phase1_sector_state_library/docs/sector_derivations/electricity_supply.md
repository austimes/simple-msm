# Electricity supply derivation

## Output definition

- **Output**: `electricity`
- **Unit**: `MWh`
- **Region in Phase 1**: `AUS`

### Why this output was chosen

A reduced-form multi-sector model needs a compact electricity supply representation that can deliver:

- a cost per MWh,
- a direct emissions intensity,
- indicative fuel dependence,
- and a frontier that can respond to carbon pressure.

A single national electricity output is therefore sufficient for Phase 1, even though a full Australian model would eventually want at least **NEM / non-NEM**, and likely state-level, differentiation.

## State family used

Three state families were retained:

1. **Incumbent thermal-heavy grid mix**
2. **Policy frontier grid supply**
3. **Deep-clean firmed grid supply**

This set was chosen because each state plays a distinct role:

- incumbent: lower conversion cost but high emissions,
- policy frontier: central least-cost decarbonising system benchmark,
- deep-clean firmed: higher-cost lower-emissions sensitivity state.

No separate nuclear state was included in Phase 1 because the MVP objective is not to enumerate every technology option; it is to represent the national frontier compactly.

## Evidence used

Main source IDs:

- `S001`, `S003` for latest official generation and renewable share context
- `S006`, `S007` for recent and projected electricity-sector emissions context
- `S008`, `S009` for CSIRO GenCost cost and deep-decarbonisation intensity benchmarks
- `S010` for AEMO 2024 ISP system-design direction

## How direct emissions were derived

Direct emissions were **not** derived from fuel coefficients alone.

That would have been misleading for a reduced-form grid state because system-average emissions depend on:

- the renewable share,
- storage and curtailment,
- coal retirement timing,
- gas backup utilisation,
- and other system features that are not visible in a single heat-rate coefficient.

Instead, the state intensities were calibrated to recent Australian intensity context plus official forward trajectory direction (`A012`).

## How costs were derived

The policy-frontier 2030 and 2050 points were anchored to CSIRO GenCost whole-system values (`S008`), then smoothed across the required milestone years.

The deep-clean firmed state was set above the policy-frontier cost path to represent a system that achieves lower residual emissions intensity with more firming and/or curtailment discipline.

The incumbent state uses a lower conversion cost because the state excludes explicit fossil-fuel purchases in the `output_cost_per_unit` field (`A002`).

## Why a national frontier was retained

The package deliberately uses one national frontier (`A011`) because:

- the MVP is national,
- a national frontier is enough to drive economy-electricity interaction,
- and the evidence for a single current national reduced-form frontier is stronger than the evidence for a clean, compact state-level frontier library in Phase 1.

This is one of the first recommended upgrades for Phase 2.

## Expandability

This sector has one of the cleanest upgrade paths in the whole package.

Likely Phase 2 expansion:

- NEM / non-NEM split
- state or regional nodes
- explicit renewable, storage, gas-peaker and transmission proxy technologies
- time-slice structure
- capacity vintaging
