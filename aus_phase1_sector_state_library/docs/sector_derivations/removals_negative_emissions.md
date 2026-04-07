# Removals and negative emissions derivation

## Output definition

- biological land sequestration
- engineered removals (DACCS)

Output unit: `tCO2_removed`

## Why removals were included at all

The brief explicitly asked for a recommendation on whether removals should be included now or deferred.

The package therefore includes removals as **explicit but clearly caveated** supply states so that:

- users can test them if needed,
- they remain separable from core production sectors,
- and the package preserves a clean pathway to explicit negative-emissions modelling later.

## State family used

1. biological land sequestration
2. direct air capture with storage (DACCS)

## Evidence used

Main source IDs:

- `S007` for official Australian land-sector sink projection context
- `S030` for Australian sequestration / land constraint and planning context
- `S031` for international DAC cost evidence

## Why these states are weak

### Biological removals

The state is not a land-use competition model. It does not capture:

- land opportunity cost endogenously,
- permanence/reversal risk in detail,
- biodiversity interactions,
- regional establishment constraints.

### DACCS

DACCS remains highly uncertain in cost, timing and infrastructure treatment in Australia. The Phase 1 DACCS state is therefore intentionally marked `Exploratory`.

## Recommended use

- Land sequestration can be kept in the library, but should be used cautiously.
- DACCS should remain **disabled by default** in core MVP runs unless the scenario explicitly studies engineered removals.

## Expandability

Likely Phase 2 expansion:

- explicit land-use competition
- permanence and reversal treatment
- MRV and policy layering
- storage network and sequestration-service representation
- DAC process chain with explicit heat and electricity requirements
