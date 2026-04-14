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
              baseConfigId: 'reference-base',
              targetConfigId: 'reference-all',
              baseMetrics: {
                objective: 100,
                cumulativeEmissions: 400,
                electricityDemand2050: 120,
              },
              targetMetrics: {
                objective: 118,
                cumulativeEmissions: 370,
                electricityDemand2050: 144,
              },
              totalObjectiveDelta: 18,
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
                    objective: 100,
                    cumulativeEmissions: 400,
                    electricityDemand2050: 120,
                  },
                  metricsAfter: {
                    objective: 110,
                    cumulativeEmissions: 385,
                    electricityDemand2050: 132,
                  },
                  metricsDeltaFromCurrent: {
                    objective: 10,
                    cumulativeEmissions: -15,
                    electricityDemand2050: 12,
                  },
                  absObjectiveDelta: 10,
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
                    objective: 110,
                    cumulativeEmissions: 385,
                    electricityDemand2050: 132,
                  },
                  metricsAfter: {
                    objective: 118,
                    cumulativeEmissions: 370,
                    electricityDemand2050: 144,
                  },
                  metricsDeltaFromCurrent: {
                    objective: 8,
                    cumulativeEmissions: -15,
                    electricityDemand2050: 12,
                  },
                  absObjectiveDelta: 8,
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

    assert.match(html, /Objective delta/);
    assert.match(html, /Cumulative emissions delta/);
    assert.match(html, /2050 electricity demand delta/);
    assert.match(html, /additionality-step-list/);
    assert.match(html, /1\./);
    assert.match(
      html,
      /Steps are ordered by greedy objective delta; the companion charts reuse that order for other metrics\./,
    );
    assert.match(html, /Base objective/);
    assert.match(html, /Target objective/);
    assert.match(html, /Ordered steps/);
    assert.match(html, /Battery-electric passenger road fleet/);
    assert.match(html, /Skipped candidates: 1/);
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
