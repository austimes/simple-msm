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
    baseConfigId: 'the-base-case',
    commodityOptions: [
      { id: 'electricity', label: 'Electricity' },
      { id: 'natural_gas', label: 'Natural gas' },
    ],
    commoditySelections: {
      electricity: 'high',
      natural_gas: 'medium',
    },
    configurations: [
      { id: 'the-base-case', label: 'The Base Case' },
      { id: 'the-full-monty', label: 'The Full Monty' },
    ],
    onBaseConfigChange: () => {},
    onCommoditySelectionChange: () => {},
    onTargetConfigChange: () => {},
    targetConfigId: 'the-full-monty',
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
              baseConfigId: 'the-base-case',
              targetConfigId: 'the-full-monty',
              baseObjective: 100,
              targetObjective: 118,
              totalDelta: 18,
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
                  objectiveBefore: 100,
                  objectiveAfter: 110,
                  deltaFromCurrent: 10,
                  absDelta: 10,
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
                  objectiveBefore: 110,
                  objectiveAfter: 118,
                  deltaFromCurrent: 8,
                  absDelta: 8,
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

    assert.match(html, /Greedy additionality sequence/);
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
