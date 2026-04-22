# Scenario Savings Attribution

The Additionality page now compares one saved Base configuration with up to
three saved Focus scenarios. The analysis attributes cost, emissions, and
fuel/energy savings to UI-level atoms:

- pathway state activation changes,
- efficiency package activation changes,
- autonomous efficiency mode changes.

The contract deliberately stays at the UI toggle level. It does not use LP
dual values or marginal prices because those explain the local optimum around
one solve, not the attribution of a saved scenario delta across mixed,
discrete UI changes. Exact Shapley is also out of scope because the number of
scenario solves grows factorially with atom count.

Two methods are available:

- Reverse greedy starts at Focus, reverts the least cost-impact remaining atom
  in the target context, then reverses that path for Base-to-Focus
  presentation. It is fast and path dependent.
- Shapley sample uses deterministic seeded permutations and averages prefix
  marginals. It is less order dependent, costs more solves, and supports 16,
  32, or 64 samples. The default is 32.

Validation only permits differences in active pathway state sets, active
efficiency package sets, and autonomous efficiency modes. It rejects changes
to years, demands, demand generation, external commodity demands, commodity
pricing, carbon price, residual overlays, solver options, service-control
mode, service-control target value, and service-control year overrides.
Presentation-only metadata is ignored.

Charts are savings stacks: Focus actual is the base layer, wedges are
Base-minus-Focus contributions, and the stack reconciles back to Base. A
positive wedge is a saving relative to Base; a negative wedge is retained and
means that atom increased cost, emissions, or fuel/energy use.
