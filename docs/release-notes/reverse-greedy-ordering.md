# Reverse-greedy additionality ordering

## Summary

The additionality analysis now uses a **reverse-greedy** ordering algorithm instead of the previous forward-greedy approach. This changes the order in which atoms appear in additionality results, reflecting their importance to the final optimised (target) state rather than their marginal impact when added from the base state.

## What changed

| | Forward-greedy (old) | Reverse-greedy (new) |
|---|---|---|
| **Direction** | Base → target | Target → base (reversed for display) |
| **Selection** | At each step, enable the atom with the **largest** objective delta | At each step, remove the atom with the **smallest** objective delta |
| **Result** | Atoms ordered by marginal impact when added to the base | Atoms ordered by importance to the target state |

Previously, the algorithm started from the base configuration and greedily enabled the atom producing the largest change at each step (forward-greedy, largest delta first).

Now, the algorithm starts from the fully optimised target configuration and iteratively removes the atom whose absence has the least impact on the objective (reverse-greedy, smallest delta removed first). The removal sequence is then reversed and actions inverted to produce the final presentation order.

The same configuration pair may now produce a **different atom order** than before.

## Why

Forward-greedy ordering is sensitive to interaction effects between atoms: an atom that appears unimportant when added early (on top of a sparse base) may actually be critical in the context of the fully built target. Reverse-greedy avoids this problem by evaluating each atom in the context of the target state where all interactions are already present. Atoms that matter most to the final optimised configuration naturally sort to the top.

## Impact

- **Analysts** will see atoms in a different order in additionality results for the same base/target pair. This is expected behaviour, not a regression.
- The total set of atoms and their individual deltas remain the same — only the presentation order changes.
- No user action is required.

## Migration

- **No schema migration required.** The ordering change is purely computational; no persisted data structures changed.
- **No UI state migration required.** There is no mode toggle or user-facing setting associated with this change.
