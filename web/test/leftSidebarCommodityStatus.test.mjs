import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { getCommodityPriceLevel } from '../src/data/configurationWorkspaceModel.ts';
import { getCommodityPriceSelectorPresentation } from '../src/components/workspace/leftSidebarCommodityStatus.ts';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { loadPkg } from './solverTestUtils.mjs';

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

    assert.equal(presentation.controlModeLabel, 'externalized');
    assert.equal(presentation.selectorEnabled, true);
    assert.equal(presentation.activeLevel, activeLevel);
    assert.match(presentation.detail, /price selection is active/i);
  });

  test('leaves non-endogenous commodity selectors unchanged', () => {
    const configuration = readJson('../src/configurations/reference.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const activeLevel = getCommodityPriceLevel(configuration, 'natural_gas');
    const presentation = getCommodityPriceSelectorPresentation(
      statuses.natural_gas,
      activeLevel,
    );

    assert.equal(presentation.controlModeLabel, null);
    assert.equal(presentation.selectorEnabled, true);
    assert.equal(presentation.activeLevel, activeLevel);
    assert.equal(presentation.detail, null);
  });
});
