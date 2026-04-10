import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { getCommodityPriceLevel } from '../src/data/configurationWorkspaceModel.ts';
import {
  formatSharePercent,
  getCommodityPriceSelectorPresentation,
  sumFixedShares,
} from '../src/components/workspace/leftSidebarCommodityStatus.ts';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { buildConfiguration, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('getCommodityPriceSelectorPresentation', () => {
  test('disables endogenous commodity price selectors when supply stays in model', () => {
    const configuration = readJson('../src/configurations/buildings-endogenous.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const presentation = getCommodityPriceSelectorPresentation(
      statuses.electricity,
      getCommodityPriceLevel(configuration, 'electricity'),
    );

    assert.equal(presentation.badgeLabel, 'in model');
    assert.equal(presentation.badgeTone, 'modeled');
    assert.equal(presentation.controlModeLabel, 'optimize');
    assert.equal(presentation.selectorEnabled, false);
    assert.equal(presentation.activeLevel, null);
    assert.match(presentation.detail, /inactive/i);
  });

  test('keeps externalized endogenous commodity price selectors active', () => {
    const configuration = readJson('../src/configurations/buildings-externalized.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const activeLevel = getCommodityPriceLevel(configuration, 'electricity');
    const presentation = getCommodityPriceSelectorPresentation(
      statuses.electricity,
      activeLevel,
    );

    assert.equal(presentation.badgeLabel, 'externalized');
    assert.equal(presentation.badgeTone, 'externalized');
    assert.equal(presentation.controlModeLabel, 'externalized');
    assert.equal(presentation.selectorEnabled, true);
    assert.equal(presentation.activeLevel, activeLevel);
    assert.match(presentation.detail, /price selection is active/i);
  });

  test('reports exact-share endogenous supply as in model', () => {
    const electricityStateId = pkg.sectorStates.find(
      (row) => row.service_or_output_name === 'electricity',
    )?.state_id;

    assert.ok(electricityStateId, 'expected an electricity state');

    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Electricity exact shares',
      serviceControls: {
        electricity: {
          mode: 'fixed_shares',
          fixed_shares: { [electricityStateId]: 1 },
        },
      },
    });
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const presentation = getCommodityPriceSelectorPresentation(
      statuses.electricity,
      getCommodityPriceLevel(configuration, 'electricity'),
    );

    assert.equal(presentation.badgeLabel, 'in model');
    assert.equal(presentation.controlModeLabel, 'exact shares');
    assert.equal(presentation.selectorEnabled, false);
  });

  test('leaves non-endogenous commodity selectors unchanged', () => {
    const configuration = readJson('../src/configurations/reference.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const activeLevel = getCommodityPriceLevel(configuration, 'natural_gas');
    const presentation = getCommodityPriceSelectorPresentation(
      statuses.natural_gas,
      activeLevel,
    );

    assert.equal(presentation.badgeLabel, null);
    assert.equal(presentation.controlModeLabel, null);
    assert.equal(presentation.selectorEnabled, true);
    assert.equal(presentation.activeLevel, activeLevel);
    assert.equal(presentation.detail, null);
  });

  test('formats fixed-share totals for the inline editor summary', () => {
    assert.equal(sumFixedShares({ grid_a: 0.25, grid_b: 0.75 }), 1);
    assert.equal(formatSharePercent(1), '100%');
    assert.equal(formatSharePercent(0.375), '37.5%');
  });
});
