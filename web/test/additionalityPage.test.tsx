import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdditionalityPageView } from '../src/pages/AdditionalityPage.tsx';

function buildProps(overrides: Record<string, any> = {}) {
  const analysisState = overrides.analysisState ?? {
    phase: 'idle',
    report: null,
    progress: { completed: 0, totalExpected: 0 },
    error: null,
    validationIssues: [],
  };
  const defaults = {
    baseConfigId: 'reference-baseline',
    commodityOptions: [
      { id: 'electricity', label: 'Electricity' },
      { id: 'natural_gas', label: 'Natural gas' },
    ],
    commoditySelections: {
      electricity: 'high',
      natural_gas: 'medium',
    },
    configurations: [
      { id: 'reference-baseline', label: 'reference-baseline' },
      { id: 'reference-efficiency-open', label: 'reference-efficiency-open' },
    ],
    method: 'reverse_greedy_target_context',
    onBaseConfigChange: () => {},
    onCommoditySelectionChange: () => {},
    onFocusConfigChange: () => {},
    onMethodChange: () => {},
    onRecalculate: () => {},
    onShapleySampleCountChange: () => {},
    recalculateDisabled: false,
    scenarios: [
      {
        analysisState,
        focusConfigId: 'reference-efficiency-open',
        focusLabel: 'reference-efficiency-open',
        slotIndex: 0,
      },
    ],
    selectedFocusConfigIds: ['reference-efficiency-open'],
    shapleySampleCount: 32,
  };

  return {
    ...defaults,
    ...overrides,
    scenarios: overrides.scenarios ?? defaults.scenarios,
  };
}

describe('AdditionalityPage', () => {
  test('renders validation issues above the results area', () => {
    const html = renderToStaticMarkup(
      <AdditionalityPageView
        {...buildProps({
          analysisState: {
            phase: 'validation',
            report: null,
            progress: { completed: 0, totalExpected: 0 },
            error: null,
            validationIssues: [
              {
                code: 'solver_options_mismatch',
                message: 'Base and target must match on solver_options.',
              },
            ],
          },
        })}
      />,
    );

    assert.match(html, /Unsupported pair/);
    assert.match(html, /Base and target must match on solver_options\./);
    assert.match(html, />Re-calculate</);
  });

  test('renders the empty state when no state deltas remain after validation', () => {
    const html = renderToStaticMarkup(
      <AdditionalityPageView
        {...buildProps({
          analysisState: {
            phase: 'empty',
            report: null,
            progress: { completed: 0, totalExpected: 0 },
            error: null,
            validationIssues: [],
          },
        })}
      />,
    );

    assert.match(html, /No attributable differences/);
    assert.match(html, /no supported state, efficiency-package, or autonomous-efficiency atoms differ/i);
    assert.match(html, />Re-calculate</);
  });

  test('renders the chart, summary cards, and step table on success', () => {
    const html = renderToStaticMarkup(
      <AdditionalityPageView
        {...buildProps({
          analysisState: {
            phase: 'success',
            progress: { completed: 5, totalExpected: 5 },
            error: null,
            validationIssues: [],
            report: {
              orderingMethod: 'reverse_greedy_target_context',
              sequenceComplete: true,
              baseConfigId: 'reference-baseline',
              targetConfigId: 'reference-efficiency-open',
              baseMetrics: {
                cost: 12_980_000_000,
                emissions: 842_110_000,
                fuelEnergy: 378.05,
                byYear: {},
              },
              targetMetrics: {
                cost: 12_340_000_000,
                emissions: 799_230_000,
                fuelEnergy: 292.52,
                byYear: {},
              },
              totalDelta: {
                cost: -640_000_000,
                emissions: -42_880_000,
                fuelEnergy: -85.53,
                byYear: {},
              },
              totalObjectiveDelta: -640_000_000,
              atomCount: 2,
              solveCount: 5,
              methodMetadata: {
                method: 'reverse_greedy_target_context',
                solveCount: 5,
              },
              sequence: [
                {
                  step: 1,
                  atom: {
                    key: 'passenger',
                    kind: 'state',
                    category: 'fuel_switching',
                    outputId: 'passenger_road_transport',
                    outputLabel: 'Passenger road transport',
                    stateId: 'road_transport__passenger_road__bev',
                    stateLabel: 'Battery-electric passenger road fleet',
                    label: 'Enable Battery-electric passenger road fleet',
                    action: 'enable',
                  },
                  metricsBefore: {
                    cost: 12_980_000_000,
                    emissions: 842_110_000,
                    fuelEnergy: 378.05,
                    byYear: {},
                  },
                  metricsAfter: {
                    cost: 12_580_000_000,
                    emissions: 822_110_000,
                    fuelEnergy: 338.05,
                    byYear: {},
                  },
                  metricsDeltaFromCurrent: {
                    cost: -400_000_000,
                    emissions: -20_000_000,
                    fuelEnergy: -40,
                    byYear: {},
                  },
                  absCostDelta: 400_000_000,
                  skippedCandidateCount: 0,
                },
                {
                  step: 2,
                  atom: {
                    key: 'heat',
                    kind: 'state',
                    category: 'fuel_switching',
                    outputId: 'low_temperature_heat',
                    outputLabel: 'Low-temperature heat',
                    stateId: 'generic_industrial_heat__low_temperature_heat__electrified',
                    stateLabel: 'Low-temperature electrified heat',
                    label: 'Enable Low-temperature electrified heat',
                    action: 'enable',
                  },
                  metricsBefore: {
                    cost: 12_580_000_000,
                    emissions: 822_110_000,
                    fuelEnergy: 338.05,
                    byYear: {},
                  },
                  metricsAfter: {
                    cost: 12_340_000_000,
                    emissions: 799_230_000,
                    fuelEnergy: 292.52,
                    byYear: {},
                  },
                  metricsDeltaFromCurrent: {
                    cost: -240_000_000,
                    emissions: -22_880_000,
                    fuelEnergy: -45.53,
                    byYear: {},
                  },
                  absCostDelta: 240_000_000,
                  skippedCandidateCount: 1,
                },
              ],
              skippedCandidates: [
                {
                  step: 2,
                  atom: {
                    key: 'skip',
                    kind: 'state',
                    category: 'other_state_change',
                    outputId: 'land_sequestration',
                    outputLabel: 'Land sequestration',
                    stateId: 'removals_negative_emissions__land_sequestration__biological_sink',
                    stateLabel: 'Biological land sequestration',
                    label: 'Enable Biological land sequestration',
                    action: 'enable',
                  },
                  message: 'Forced failure',
                },
              ],
              validationIssues: [],
            },
          },
        })}
      />,
    );

    assert.match(html, /Cost savings attribution/);
    assert.match(html, /Emissions savings attribution/);
    assert.match(html, /Fuel\/energy savings attribution/);
    assert.match(html, /Attribution atoms reference/);
    assert.doesNotMatch(html, /additionality-step-list/);
    assert.match(html, /--chart-height:180px/);
    assert.match(html, /Wedges are shown as Base minus Focus savings/);
    assert.match(html, /Reverse-greedy target-context ordering/);
    assert.match(html, /Base total/);
    assert.match(html, /Focus total/);
    assert.match(html, /\$12\.98B/);
    assert.match(html, /\$12\.34B/);
    assert.match(html, /\+\$0\.64B/);
    assert.match(html, /Base \$12\.98B/);
    assert.match(html, /Focus 799\.23 MtCO2e/);
    assert.match(html, /Focus 292\.52 PJ/);
    assert.match(html, /\+\$0\.40B/);
    assert.match(html, /\+20\.00 MtCO2e/);
    assert.match(html, /\+40\.00 PJ/);
    assert.doesNotMatch(html, /Attribution atoms reference legend/);
    assert.doesNotMatch(html, /Base 0\.00/);
    assert.match(html, /Atom kind/);
    assert.match(html, /Cost savings \(\$B\)/);
    assert.match(html, /Emissions savings \(MtCO2e\)/);
    assert.match(html, /Fuel\/energy savings \(PJ\)/);
    assert.match(html, /Passenger road transport: Enable Battery-electric passenger road fleet/);
    assert.match(html, /Battery-electric passenger road fleet/);
    assert.match(html, /data-interaction-key="passenger"/);
    assert.match(html, /data-interaction-key="heat"/);
    assert.match(html, /Skipped candidates: 1/);
    assert.match(html, /Scenario savings attribution/);
    assert.match(html, />Re-calculate</);
    assert.match(
      html,
      /attribute cost, emissions, and fuel\/energy savings to supported UI-level changes\./i,
    );
  });

  test('renders partial analysis without waterfall or table', () => {
    const html = renderToStaticMarkup(
      <AdditionalityPageView
        {...buildProps({
          analysisState: {
            phase: 'partial',
            progress: { completed: 3, totalExpected: 5 },
            error: 'Stopped at step 2 because every remaining candidate solve failed.',
            validationIssues: [],
            report: {
              orderingMethod: 'reverse_greedy_target_context',
              sequenceComplete: false,
              baseConfigId: 'reference-baseline',
              targetConfigId: 'reference-efficiency-open',
              baseMetrics: {
                cost: 12_980_000_000,
                emissions: 842_110_000,
                fuelEnergy: 378.05,
                byYear: {},
              },
              targetMetrics: {
                cost: 12_340_000_000,
                emissions: 799_230_000,
                fuelEnergy: 292.52,
                byYear: {},
              },
              totalDelta: {
                cost: -640_000_000,
                emissions: -42_880_000,
                fuelEnergy: -85.53,
                byYear: {},
              },
              totalObjectiveDelta: -640_000_000,
              atomCount: 2,
              solveCount: 3,
              methodMetadata: {
                method: 'reverse_greedy_target_context',
                solveCount: 3,
              },
              sequence: [],
              skippedCandidates: [],
              validationIssues: [],
            },
          },
        })}
      />,
    );

    assert.match(html, /Partial analysis/);
    assert.match(html, /could not reconstruct a full base-to-focus ordering/);
    assert.match(html, /Base total/);
    assert.match(html, /Focus total/);
    assert.match(html, /Solves/);
    assert.doesNotMatch(html, /Cost savings attribution/);
    assert.doesNotMatch(html, /Atom kind/);
    assert.doesNotMatch(html, /additionality-table/);
    assert.match(html, />Re-calculate</);
  });

  test('renders loading progress and the current price scenario summary', () => {
    const html = renderToStaticMarkup(
      <AdditionalityPageView
        {...buildProps({
          analysisState: {
            phase: 'loading',
            report: null,
            progress: { completed: 7, totalExpected: 47 },
            error: null,
            validationIssues: [],
          },
          recalculateDisabled: true,
        })}
      />,
    );

    assert.match(html, /Running attribution: 7\/47 evaluations completed\./);
    assert.match(html, /Price scenario: Electricity: high \| Natural gas: medium/);
    assert.match(html, />Re-calculating\.\.\.</);
    assert.match(html, /disabled=""/);
  });

  test('renders multiple focus slots and Shapley sample controls', () => {
    const html = renderToStaticMarkup(
      <AdditionalityPageView
        {...buildProps({
          configurations: [
            { id: 'reference-baseline', label: 'reference-baseline' },
            { id: 'reference-efficiency-open', label: 'reference-efficiency-open' },
            { id: 'demo-buildings-efficiency', label: 'demo-buildings-efficiency' },
          ],
          method: 'shapley_permutation_sample',
          scenarios: [
            {
              analysisState: {
                phase: 'idle',
                report: null,
                progress: { completed: 0, totalExpected: 0 },
                error: null,
                validationIssues: [],
              },
              focusConfigId: 'reference-efficiency-open',
              focusLabel: 'reference-efficiency-open',
              slotIndex: 0,
            },
            {
              analysisState: {
                phase: 'loading',
                report: null,
                progress: { completed: 2, totalExpected: 10 },
                error: null,
                validationIssues: [],
              },
              focusConfigId: 'demo-buildings-efficiency',
              focusLabel: 'demo-buildings-efficiency',
              slotIndex: 1,
            },
          ],
          selectedFocusConfigIds: ['reference-efficiency-open', 'demo-buildings-efficiency'],
          shapleySampleCount: 64,
        })}
      />,
    );

    assert.match(html, /Focus scenario 1/);
    assert.match(html, /Focus scenario 2/);
    assert.match(html, /Focus scenario 3/);
    assert.match(html, /Shapley sample/);
    assert.match(html, /Samples/);
    assert.match(html, /value="64" selected/);
    assert.match(html, /Focus 1/);
    assert.match(html, /Focus 2/);
    assert.match(html, /Running attribution: 2\/10 evaluations completed\./);
  });

  test('renders an analysis-blocked message while keeping the recalculate control', () => {
    const html = renderToStaticMarkup(
      <AdditionalityPageView
        {...buildProps({
          analysisState: {
            phase: 'error',
            report: null,
            progress: { completed: 0, totalExpected: 47 },
            error: 'Solver failed for the selected pair.',
            validationIssues: [],
          },
        })}
      />,
    );

    assert.match(html, /Analysis blocked/);
    assert.match(html, /Solver failed for the selected pair\./);
    assert.match(html, />Re-calculate</);
  });
});
