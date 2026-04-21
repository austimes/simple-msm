import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildModelFormulationViewModel,
  MODEL_FORMULATION_PREFERRED_DEMAND_OUTPUT_ID,
  MODEL_FORMULATION_PREFERRED_OBJECTIVE_ROW_ID,
} from '../src/pages/modelFormulationModel.ts';
import { loadFormulationFixtureData } from './solverTestUtils.mjs';

describe('modelFormulationModel', () => {
  test('builds the preferred residential demand example from anchor plus growth', () => {
    const fixture = loadFormulationFixtureData();
    const model = buildModelFormulationViewModel(fixture);

    assert.equal(model.liveExamplesWarning, null);
    assert.ok(model.demandExample, 'expected a worked demand example');
    assert.equal(model.demandExample.outputId, MODEL_FORMULATION_PREFERRED_DEMAND_OUTPUT_ID);
    assert.equal(model.demandExample.anchorYear, 2025);
    assert.equal(model.demandExample.targetYear, 2030);
    assert.equal(model.demandExample.anchorValue, 477000000);
    assert.equal(model.demandExample.growthRatePctPerYear, 0.6);
    assert.equal(model.demandExample.formulaValue, 491482753);
    assert.equal(model.demandExample.resolvedValue, 491482753);
    assert.equal(model.demandExample.yearOverrideApplied, false);
  });

  test('includes exogenous commodity prices in the worked objective example when electricity is externalized', () => {
    const fixture = loadFormulationFixtureData();
    fixture.currentConfiguration = {
      ...fixture.currentConfiguration,
      service_controls: {
        ...fixture.currentConfiguration.service_controls,
        electricity: {
          mode: 'externalized',
        },
      },
    };
    const model = buildModelFormulationViewModel(fixture);

    assert.ok(model.objectiveExample, 'expected a worked objective example');
    assert.equal(model.objectiveExample.rowId, MODEL_FORMULATION_PREFERRED_OBJECTIVE_ROW_ID);

    const electricityContribution = model.objectiveExample.commodityContributions.find(
      (entry) => entry.commodityId === 'electricity',
    );

    assert.ok(electricityContribution, 'expected electricity contribution in the preferred row');
    assert.equal(electricityContribution.includedInObjective, true);
    assert.ok(electricityContribution.contribution > 0, 'expected positive electricity cost contribution');
  });

  test('excludes endogenous commodity prices from the worked objective example when electricity is optimized in-model', () => {
    const fixture = loadFormulationFixtureData();

    const model = buildModelFormulationViewModel(fixture);

    assert.ok(model.objectiveExample, 'expected a worked objective example');

    const electricityContribution = model.objectiveExample.commodityContributions.find(
      (entry) => entry.commodityId === 'electricity',
    );

    assert.ok(electricityContribution, 'expected electricity contribution in the preferred row');
    assert.equal(electricityContribution.includedInObjective, false);
    assert.equal(electricityContribution.contribution, 0);
    assert.match(model.objectiveExample.note, /double counting/i);
  });

  test('keeps overlay totals and overlay source mapping explicitly outside LP inputs', () => {
    const fixture = loadFormulationFixtureData();
    const model = buildModelFormulationViewModel(fixture);

    assert.ok(model.overlaySummary.totalResidualEnergyPj > 0);
    assert.ok(model.overlaySummary.totalResidualNonEnergyEmissions > 0);

    const overlayMapping = model.sourceMapping.find(
      (row) => row.source === 'overlays/residual_overlays.csv',
    );

    assert.ok(overlayMapping, 'expected residual overlay source mapping row');
    assert.match(overlayMapping.mapsTo, /not LP variables/i);
    assert.match(overlayMapping.howItEnters, /outside buildSolveRequest\.ts and lpAdapter\.ts/i);
  });
});
