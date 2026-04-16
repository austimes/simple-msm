import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdditionalityPageView } from '../src/pages/AdditionalityPage.tsx';

function buildProps(overrides = {}) {
  return {
    analysisState: {
      phase: 'idle',
      report: null,
      progress: { completed: 0, totalExpected: 0 },
      error: null,
      validationIssues: [],
    },
    baseConfigId: 'reference-base',
    commodityOptions: [
      { id: 'electricity', label: 'Electricity' },
      { id: 'natural_gas', label: 'Natural gas' },
    ],
    commoditySelections: {
      electricity: 'high',
      natural_gas: 'medium',
    },
    configurations: [
      { id: 'reference-base', label: 'reference-base' },
      { id: 'reference-all', label: 'reference-all' },
    ],
    onBaseConfigChange: () => {},
    onCommoditySelectionChange: () => {},
    onTargetConfigChange: () => {},
    targetConfigId: 'reference-all',
    ...overrides,
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

    assert.match(html, /No state deltas/);
    assert.match(html, /do not differ on any active pathway states/i);
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
              baseConfigId: 'reference-base',
              targetConfigId: 'reference-all',
              baseMetrics: {
                objective: 12_340_000_000,
                cumulativeEmissions: 842_110_000,
                electricityDemand2050: 292_523_236.87,
              },
              targetMetrics: {
                objective: 12_980_000_000,
                cumulativeEmissions: 799_230_000,
                electricityDemand2050: 378_053_448.99,
              },
              totalObjectiveDelta: 640_000_000,
              atomCount: 2,
              solveCount: 5,
              sequence: [
                {
                  step: 1,
                  atom: {
                    key: 'passenger',
                    outputId: 'passenger_road_transport',
                    outputLabel: 'Passenger road transport',
                    stateId: 'road_transport__passenger_road__bev',
                    stateLabel: 'Battery-electric passenger road fleet',
                    action: 'enable',
                  },
                  metricsBefore: {
                    objective: 12_340_000_000,
                    cumulativeEmissions: 842_110_000,
                    electricityDemand2050: 292_523_236.87,
                  },
                  metricsAfter: {
                    objective: 12_740_000_000,
                    cumulativeEmissions: 822_110_000,
                    electricityDemand2050: 332_523_236.87,
                  },
                  metricsDeltaFromCurrent: {
                    objective: 400_000_000,
                    cumulativeEmissions: -20_000_000,
                    electricityDemand2050: 40_000_000,
                  },
                  absObjectiveDelta: 400_000_000,
                  skippedCandidateCount: 0,
                },
                {
                  step: 2,
                  atom: {
                    key: 'heat',
                    outputId: 'low_temperature_heat',
                    outputLabel: 'Low-temperature heat',
                    stateId: 'generic_industrial_heat__low_temperature_heat__electrified',
                    stateLabel: 'Low-temperature electrified heat',
                    action: 'enable',
                  },
                  metricsBefore: {
                    objective: 12_740_000_000,
                    cumulativeEmissions: 822_110_000,
                    electricityDemand2050: 332_523_236.87,
                  },
                  metricsAfter: {
                    objective: 12_980_000_000,
                    cumulativeEmissions: 799_230_000,
                    electricityDemand2050: 378_053_448.99,
                  },
                  metricsDeltaFromCurrent: {
                    objective: 240_000_000,
                    cumulativeEmissions: -22_880_000,
                    electricityDemand2050: 45_530_212.12,
                  },
                  absObjectiveDelta: 240_000_000,
                  skippedCandidateCount: 1,
                },
              ],
              skippedCandidates: [
                {
                  step: 2,
                  atom: {
                    key: 'skip',
                    outputId: 'land_sequestration',
                    outputLabel: 'Land sequestration',
                    stateId: 'removals_negative_emissions__land_sequestration__biological_sink',
                    stateLabel: 'Biological land sequestration',
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

    assert.match(html, /Objective delta waterfall/);
    assert.match(html, /Cumulative emissions delta waterfall/);
    assert.match(html, /2050 electricity demand delta waterfall/);
    assert.match(html, /Ordered steps reference/);
    assert.doesNotMatch(html, /additionality-step-list/);
    assert.match(html, /--chart-height:180px/);
    assert.match(
      html,
      /These waterfalls are sequence-based and path-dependent: each step shows the incremental change from the prior greedy state, and the full sequence sums to the base-to-target delta\./,
    );
    assert.match(html, /Base objective/);
    assert.match(html, /Target objective/);
    assert.match(html, /\$12\.34B/);
    assert.match(html, /\$12\.98B/);
    assert.match(html, /\+\$0\.64B/);
    assert.match(html, /Base \$12\.34B/);
    assert.match(html, /Target 799\.23 MtCO2e/);
    assert.match(html, /Target 378\.05 TWh/);
    assert.match(html, /\+\$0\.12B/);
    assert.match(html, /-21\.44 MtCO2e/);
    assert.match(html, /\+42\.77 TWh/);
    assert.doesNotMatch(html, /Ordered steps reference legend/);
    assert.doesNotMatch(html, /Base 0\.00/);
    assert.match(html, /Ordered steps/);
    assert.match(html, /Cost Δ \(\$B\)/);
    assert.match(html, /Cost before \(\$B\)/);
    assert.match(html, /Cost after \(\$B\)/);
    assert.match(html, /Emissions Δ \(MtCO2e\)/);
    assert.match(html, /Emissions before \(MtCO2e\)/);
    assert.match(html, /Emissions after \(MtCO2e\)/);
    assert.match(html, /Electricity Δ \(TWh\)/);
    assert.match(html, /Electricity 2050 before \(TWh\)/);
    assert.match(html, /Electricity 2050 after \(TWh\)/);
    assert.match(html, /Passenger road transport: Enable Battery-electric passenger road fleet/);
    assert.match(html, /Battery-electric passenger road fleet/);
    assert.match(html, /data-interaction-key="passenger"/);
    assert.match(html, /data-interaction-key="heat"/);
    assert.match(html, /Skipped candidates: 1/);
    assert.match(html, /State-toggle delta decomposition/);
    assert.match(
      html,
      /trace how the greedy transition sequence builds the difference between the base and target configurations\./i,
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
              baseConfigId: 'reference-base',
              targetConfigId: 'reference-all',
              baseMetrics: {
                objective: 12_340_000_000,
                cumulativeEmissions: 842_110_000,
                electricityDemand2050: 292_523_236.87,
              },
              targetMetrics: {
                objective: 12_980_000_000,
                cumulativeEmissions: 799_230_000,
                electricityDemand2050: 378_053_448.99,
              },
              totalObjectiveDelta: 640_000_000,
              atomCount: 2,
              solveCount: 3,
              sequence: [],
              skippedCandidates: [],
              validationIssues: [],
            },
          },
        })}
      />,
    );

    assert.match(html, /Partial analysis/);
    assert.match(html, /could not reconstruct a full base→target ordering/);
    assert.match(html, /Base objective/);
    assert.match(html, /Target objective/);
    assert.match(html, /Completed solves/);
    assert.doesNotMatch(html, /Objective delta waterfall/);
    assert.doesNotMatch(html, /Ordered steps/);
    assert.doesNotMatch(html, /additionality-table/);
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
        })}
      />,
    );

    assert.match(html, /Running additionality analysis: 7\/47 evaluations completed\./);
    assert.match(html, /Price scenario: Electricity: high \| Natural gas: medium/);
  });
});
