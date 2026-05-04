import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { prepareAdditionalityAnalysis } from '../src/additionality/additionalityAnalysis.ts';
import { materializeServiceControlsFromRoleControls } from './roleControlTestUtils.mjs';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import {
  buildAdditionalityAnalysisCacheKeyFromSelections,
  shouldStartAdditionalityRun,
} from '../src/hooks/useAdditionalityAnalysis.ts';
import { loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();
const STATE_OPEN_TARGET_ID = 'reference-state-open';

function readJson(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function buildBaseCase() {
  return materializeServiceControlsFromRoleControls(
    resolveConfigurationDocument(
      readJson('../src/configurations/reference-baseline.json'),
      pkg.appConfig,
      'reference-baseline',
    ),
    { resolvedMethodYears: pkg.resolvedMethodYears },
  );
}

function buildStateOpenCase() {
  const configuration = buildBaseCase();

  for (const control of Object.values(configuration.service_controls)) {
    if (control?.mode === 'optimize' && 'active_state_ids' in control) {
      control.active_state_ids = null;
    }
  }

  return configuration;
}

function buildCommoditySelections(): Record<string, 'high' | 'low'> {
  const commodityIds = Object.keys(pkg.appConfig.commodity_price_presets).sort();
  assert.ok(commodityIds.length >= 2, 'expected at least two commodity presets');

  return {
    [commodityIds[0]]: 'high',
    [commodityIds[1]]: 'low',
  };
}

function buildEquivalentConfigurationsWithReorderedActiveMethodIds() {
  const outputMethodIds = new Map<string, string[]>();

  for (const row of pkg.resolvedMethodYears) {
    const current = outputMethodIds.get(row.output_id) ?? [];
    if (!current.includes(row.method_id)) {
      current.push(row.method_id);
      outputMethodIds.set(row.output_id, current);
    }
  }

  const candidateEntry = Array.from(outputMethodIds.entries())
    .find(([, methodIds]) => methodIds.length >= 2);

  assert.ok(candidateEntry, 'expected at least one output with multiple states');

  const [outputId, methodIds] = candidateEntry;
  const orderedMethodIds = methodIds.slice(0, 2);
  const reversedMethodIds = [...orderedMethodIds].reverse();
  const leftConfiguration = buildStateOpenCase();
  const rightConfiguration = buildStateOpenCase();

  leftConfiguration.service_controls[outputId] = {
    ...(leftConfiguration.service_controls[outputId] ?? { mode: 'optimize' as const }),
    active_state_ids: orderedMethodIds,
  };
  rightConfiguration.service_controls[outputId] = {
    ...(rightConfiguration.service_controls[outputId] ?? { mode: 'optimize' as const }),
    active_state_ids: reversedMethodIds,
  };

  return {
    leftConfiguration,
    rightConfiguration,
  };
}

describe('useAdditionalityAnalysis', () => {
  test('builds the same cache key for equivalent normalized inputs', () => {
    const baseConfiguration = buildBaseCase();
    const { leftConfiguration, rightConfiguration } = buildEquivalentConfigurationsWithReorderedActiveMethodIds();
    const selections = buildCommoditySelections();
    const reversedSelections = Object.fromEntries(Object.entries(selections).reverse());

    const leftKey = buildAdditionalityAnalysisCacheKeyFromSelections({
      baseConfiguration,
      baseConfigId: 'reference-baseline',
      commoditySelections: selections,
      pkg,
      targetConfiguration: leftConfiguration,
      targetConfigId: STATE_OPEN_TARGET_ID,
    });
    const rightKey = buildAdditionalityAnalysisCacheKeyFromSelections({
      baseConfiguration,
      baseConfigId: 'reference-baseline',
      commoditySelections: reversedSelections,
      pkg,
      targetConfiguration: rightConfiguration,
      targetConfigId: STATE_OPEN_TARGET_ID,
    });

    assert.equal(leftKey, rightKey);
  });

  test('changes the cache key when effective configuration content or commodity selections change', () => {
    const baseConfiguration = buildBaseCase();
    const targetConfiguration = buildStateOpenCase();
    const selections = buildCommoditySelections();
    const commodityIds = Object.keys(selections);
    const baselineKey = buildAdditionalityAnalysisCacheKeyFromSelections({
      baseConfiguration,
      baseConfigId: 'reference-baseline',
      commoditySelections: selections,
      pkg,
      targetConfiguration,
      targetConfigId: STATE_OPEN_TARGET_ID,
    });

    const changedTarget = structuredClone(targetConfiguration);
    changedTarget.service_demands.passenger_road_transport['2050'] += 1;

    const changedCommoditySelections = {
      ...selections,
      [commodityIds[0]]: selections[commodityIds[0]] === 'high' ? 'low' : 'high',
    };

    assert.notEqual(
      buildAdditionalityAnalysisCacheKeyFromSelections({
        baseConfiguration,
        baseConfigId: 'reference-baseline',
        commoditySelections: selections,
        pkg,
        targetConfiguration: changedTarget,
        targetConfigId: STATE_OPEN_TARGET_ID,
      }),
      baselineKey,
    );
    assert.notEqual(
      buildAdditionalityAnalysisCacheKeyFromSelections({
        baseConfiguration,
        baseConfigId: 'reference-baseline',
        commoditySelections: changedCommoditySelections,
        pkg,
        targetConfiguration,
        targetConfigId: STATE_OPEN_TARGET_ID,
      }),
      baselineKey,
    );
    assert.notEqual(
      buildAdditionalityAnalysisCacheKeyFromSelections({
        baseConfiguration,
        baseConfigId: 'reference-baseline',
        commoditySelections: selections,
        method: 'shapley_permutation_sample',
        pkg,
        shapleySampleCount: 32,
        targetConfiguration,
        targetConfigId: STATE_OPEN_TARGET_ID,
      }),
      baselineKey,
    );
    assert.notEqual(
      buildAdditionalityAnalysisCacheKeyFromSelections({
        baseConfiguration,
        baseConfigId: 'reference-baseline',
        commoditySelections: selections,
        method: 'shapley_permutation_sample',
        pkg,
        shapleySampleCount: 64,
        targetConfiguration,
        targetConfigId: STATE_OPEN_TARGET_ID,
      }),
      buildAdditionalityAnalysisCacheKeyFromSelections({
        baseConfiguration,
        baseConfigId: 'reference-baseline',
        commoditySelections: selections,
        method: 'shapley_permutation_sample',
        pkg,
        shapleySampleCount: 32,
        targetConfiguration,
        targetConfigId: STATE_OPEN_TARGET_ID,
      }),
    );
  });

  test('starts automatically only for uncached valid prepared runs and force-reruns cached results', () => {
    const baseConfiguration = buildBaseCase();
    const targetConfiguration = buildStateOpenCase();
    const selections = buildCommoditySelections();
    const prepared = prepareAdditionalityAnalysis({
      baseConfiguration,
      baseConfigId: 'reference-baseline',
      commoditySelections: selections,
      pkg,
      targetConfiguration,
      targetConfigId: STATE_OPEN_TARGET_ID,
    });

    assert.equal(prepared.validationIssues.length, 0);
    assert.ok(prepared.atoms.length > 0);

    assert.equal(
      shouldStartAdditionalityRun({
        force: false,
        prepared,
        preparedKey: 'valid-key',
        runtimeEntry: null,
      }),
      true,
    );
    assert.equal(
      shouldStartAdditionalityRun({
        force: false,
        prepared,
        preparedKey: 'valid-key',
        runtimeEntry: {
          inFlight: false,
          runToken: 1,
          state: {
            phase: 'success',
            report: null,
            progress: { completed: 5, totalExpected: 5 },
            error: null,
            validationIssues: [],
          },
        },
      }),
      false,
    );
    assert.equal(
      shouldStartAdditionalityRun({
        force: false,
        prepared,
        preparedKey: 'valid-key',
        runtimeEntry: {
          inFlight: true,
          runToken: 2,
          state: {
            phase: 'loading',
            report: null,
            progress: { completed: 1, totalExpected: 5 },
            error: null,
            validationIssues: [],
          },
        },
      }),
      false,
    );
    assert.equal(
      shouldStartAdditionalityRun({
        force: true,
        prepared,
        preparedKey: 'valid-key',
        runtimeEntry: {
          inFlight: false,
          runToken: 1,
          state: {
            phase: 'success',
            report: null,
            progress: { completed: 5, totalExpected: 5 },
            error: null,
            validationIssues: [],
          },
        },
      }),
      true,
    );
    assert.equal(
      shouldStartAdditionalityRun({
        force: true,
        prepared,
        preparedKey: 'valid-key',
        runtimeEntry: {
          inFlight: true,
          runToken: 2,
          state: {
            phase: 'loading',
            report: null,
            progress: { completed: 1, totalExpected: 5 },
            error: null,
            validationIssues: [],
          },
        },
      }),
      false,
    );
  });

  test('never starts async runs for validation-blocked or empty preparations', () => {
    const baseConfiguration = buildBaseCase();
    const targetConfiguration = buildStateOpenCase();
    const selections = buildCommoditySelections();

    const validationBlockedTarget = structuredClone(targetConfiguration);
    validationBlockedTarget.carbon_price['2050'] += 5;

    const validationPrepared = prepareAdditionalityAnalysis({
      baseConfiguration,
      baseConfigId: 'reference-baseline',
      commoditySelections: selections,
      pkg,
      targetConfiguration: validationBlockedTarget,
      targetConfigId: STATE_OPEN_TARGET_ID,
    });
    const emptyPrepared = prepareAdditionalityAnalysis({
      baseConfiguration,
      baseConfigId: 'reference-baseline',
      commoditySelections: selections,
      pkg,
      targetConfiguration: structuredClone(baseConfiguration),
      targetConfigId: 'reference-baseline-copy',
    });

    assert.ok(validationPrepared.validationIssues.length > 0);
    assert.equal(emptyPrepared.atoms.length, 0);

    assert.equal(
      shouldStartAdditionalityRun({
        force: false,
        prepared: validationPrepared,
        preparedKey: 'validation-key',
        runtimeEntry: null,
      }),
      false,
    );
    assert.equal(
      shouldStartAdditionalityRun({
        force: false,
        prepared: emptyPrepared,
        preparedKey: 'empty-key',
        runtimeEntry: null,
      }),
      false,
    );
  });
});
