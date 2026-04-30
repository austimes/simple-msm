import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  applyAdditionalityAtom,
  deriveAdditionalityAtoms,
  runAdditionalityAnalysis,
  validateAdditionalityPair,
} from '../src/additionality/additionalityAnalysis.ts';
import { materializeServiceControlsFromRoleControls } from './roleControlTestUtils.mjs';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildAllContributionRows } from '../src/results/resultContributions.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';
import { loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();
const METHOD_OPEN_TARGET_ID = 'reference-method-open';

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: expected ${expected}, got ${actual}`);
}

function assertFiniteMetrics(snapshot) {
  assert.equal(Number.isFinite(snapshot.cost), true);
  assert.equal(Number.isFinite(snapshot.emissions), true);
  assert.equal(Number.isFinite(snapshot.fuelEnergy), true);
  assert.ok(snapshot.byYear);
}

function assertConsistentDelta(entry) {
  assertClose(
    entry.metricsDeltaFromCurrent.cost,
    entry.metricsAfter.cost - entry.metricsBefore.cost,
    'cost delta stays internally consistent',
  );
  assertClose(
    entry.metricsDeltaFromCurrent.emissions,
    entry.metricsAfter.emissions - entry.metricsBefore.emissions,
    'emissions delta stays internally consistent',
  );
  assertClose(
    entry.metricsDeltaFromCurrent.fuelEnergy,
    entry.metricsAfter.fuelEnergy - entry.metricsBefore.fuelEnergy,
    'fuel/energy delta stays internally consistent',
  );
}

function assertMetricVectorMatchesContributions(vector, contributions, label) {
  const totals = {
    cost: 0,
    emissions: 0,
    fuelEnergy: 0,
  };

  for (const row of contributions) {
    if (row.metric === 'cost') totals.cost += row.value;
    if (row.metric === 'emissions') totals.emissions += row.value;
    if (row.metric === 'fuel') totals.fuelEnergy += row.value;
  }

  assertClose(vector.cost, totals.cost, `${label} cost matches contribution rows`);
  assertClose(vector.emissions, totals.emissions, `${label} emissions matches contribution rows`);
  assertClose(vector.fuelEnergy, totals.fuelEnergy, `${label} fuel/energy matches contribution rows`);
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
    if (
      control?.mode === 'optimize'
      && Array.isArray(control.active_state_ids)
      && control.active_state_ids.length > 0
    ) {
      control.active_state_ids = null;
    }
  }

  return configuration;
}

function rowUnitCost(request, row) {
  const conversion = row.conversionCostPerUnit ?? 0;
  const commodity = row.inputs.reduce((total, input) => {
    const price = request.configuration.commodityPriceByCommodity[input.commodityId]
      ?.valuesByYear[String(row.year)] ?? 0;
    return total + input.coefficient * price;
  }, 0);
  const emissions = row.directEmissions.reduce((total, entry) => total + entry.value, 0);
  const carbonPrice = request.configuration.carbonPriceByYear[String(row.year)] ?? 0;
  return conversion + commodity + emissions * carbonPrice;
}

function buildMockMethodSharesForObjective(request, objectiveValue) {
  if (objectiveValue === 0) {
    return [];
  }

  const row = request.rows.find((candidate) => Math.abs(rowUnitCost(request, candidate)) > 1e-9)
    ?? request.rows[0];
  const unitCost = rowUnitCost(request, row) || 1;

  return [
    {
      outputId: row.outputId,
      outputLabel: row.outputLabel,
      year: row.year,
      rowId: row.rowId,
      methodId: row.methodId,
      methodLabel: row.methodLabel,
      pathwayMethodId: row.provenance?.baseMethodId ?? row.methodId,
      pathwayMethodLabel: row.provenance?.baseMethodLabel ?? row.methodLabel,
      provenance: row.provenance,
      activity: objectiveValue / unitCost,
      share: null,
      rawMaxShare: null,
      effectiveMaxShare: null,
    },
  ];
}

function buildSolvedResult(request, objectiveValue) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: request.requestId,
    status: 'solved',
    engine: {
      name: 'yalps',
      worker: true,
    },
    summary: {
      rowCount: request.rows.length,
      yearCount: request.configuration.years.length,
      outputCount: Object.keys(request.configuration.controlsByOutput).length,
      serviceDemandOutputCount: Object.keys(request.configuration.serviceDemandByOutput).length,
      externalCommodityCount: Object.keys(request.configuration.externalCommodityDemandByCommodity).length,
    },
    reporting: {
      commodityBalances: [],
      methodShares: buildMockMethodSharesForObjective(request, objectiveValue),
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: {
      kind: 'configuration_lp',
      objectiveDirection: 'minimize',
      objectiveKey: 'configuration_cost',
      variableCount: request.rows.length,
      constraintCount: request.rows.length,
      notes: [],
      solutionStatus: 'optimal',
      objectiveValue,
      variables: request.rows.map((row) => ({
        id: `activity:${row.rowId}`,
        value: 1,
      })),
    },
    diagnostics: [],
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
}

function buildErroredResult(request, message) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: request.requestId,
    status: 'error',
    engine: {
      name: 'yalps',
      worker: true,
    },
    summary: {
      rowCount: request.rows.length,
      yearCount: request.configuration.years.length,
      outputCount: Object.keys(request.configuration.controlsByOutput).length,
      serviceDemandOutputCount: Object.keys(request.configuration.serviceDemandByOutput).length,
      externalCommodityCount: Object.keys(request.configuration.externalCommodityDemandByCommodity).length,
    },
    reporting: {
      commodityBalances: [],
      methodShares: [],
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: {
      kind: 'configuration_lp',
      objectiveDirection: 'minimize',
      objectiveKey: 'configuration_cost',
      variableCount: request.rows.length,
      constraintCount: request.rows.length,
      notes: [],
      solutionStatus: 'infeasible',
      objectiveValue: null,
      variables: [],
    },
    diagnostics: [
      {
        code: 'forced_failure',
        severity: 'error',
        message,
      },
    ],
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
}

function hasActiveState(request, outputId, methodId) {
  const controlsByYear = request.configuration.controlsByOutput[outputId] ?? {};
  return Object.values(controlsByYear).some((control) => (control.activeMethodIds ?? []).includes(methodId));
}

describe('additionality analysis', () => {
  test('derives the expected method-toggle atoms for reference-baseline vs synthetic state-open target', () => {
    const atoms = deriveAdditionalityAtoms(buildBaseCase(), buildStateOpenCase(), pkg);

    assert.equal(atoms.length, 24);
    assert.deepEqual(
      atoms.map((atom) => `${atom.outputLabel}|${atom.methodLabel}|${atom.action}`),
      [
        'Deliver commercial building services|Deep electrification and efficiency commercial services|enable',
        'Deliver commercial building services|Electrified efficient commercial services|enable',
        'Deliver freight road transport|Battery-electric road freight|enable',
        'Deliver freight road transport|Efficient diesel road freight|enable',
        'Deliver freight road transport|Hydrogen fuel-cell road freight|enable',
        'Deliver high temperature heat|High-temperature electrified heat|enable',
        'Deliver high temperature heat|High-temperature low-carbon fuels|enable',
        'Deliver low temperature heat|Low-temperature electrified heat|enable',
        'Deliver low temperature heat|Low-temperature low-carbon fuels|enable',
        'Deliver medium temperature heat|Medium-temperature electrified heat|enable',
        'Deliver medium temperature heat|Medium-temperature low-carbon fuels|enable',
        'Deliver passenger road transport|Battery-electric passenger road fleet|enable',
        'Deliver passenger road transport|Hybrid-heavy passenger road fleet|enable',
        'Deliver residential building services|Deep-electric residential services|enable',
        'Deliver residential building services|Electrified efficient residential services|enable',
        'Produce cement equivalent|Deep-abatement cement with CCS|enable',
        'Produce cement equivalent|Low-clinker and alternative-fuels cement|enable',
        'Produce cropping and horticulture output|Mitigated cropping and horticulture bundle|enable',
        'Produce crude steel|CCS-influenced BF-BOF steel|enable',
        'Produce crude steel|Hydrogen DRI-electric steel|enable',
        'Produce crude steel|Scrap EAF steel|enable',
        'Produce livestock output|Mitigated livestock output bundle|enable',
        'Supply electricity|Deep-clean firmed grid supply|enable',
        'Supply electricity|Policy frontier grid supply|enable',
      ],
    );
  });

  test('derives package and autonomous atoms from canonical efficiency controls', () => {
    const packageIds = Array.from(new Set(pkg.efficiencyPackages.map((entry) => entry.package_id))).sort();
    assert.ok(packageIds.length > 2, 'expected package fixtures');

    const base = buildBaseCase();
    base.efficiency_controls = {
      autonomous_mode: 'off',
      package_mode: 'off',
      package_ids: [],
    };

    const allowTarget = clone(base);
    allowTarget.efficiency_controls = {
      autonomous_mode: 'baseline',
      package_mode: 'allow_list',
      package_ids: [packageIds[0]],
    };

    const allowAtoms = deriveAdditionalityAtoms(base, allowTarget, pkg);
    assert.equal(
      allowAtoms.some((atom) => atom.kind === 'efficiency_package' && atom.packageId === packageIds[0] && atom.action === 'enable'),
      true,
    );
    assert.equal(
      allowAtoms.some((atom) => atom.kind === 'autonomous_efficiency' && atom.action === 'enable'),
      true,
    );

    const allTarget = clone(base);
    allTarget.efficiency_controls = {
      autonomous_mode: 'off',
      package_mode: 'all',
      package_ids: [],
    };
    const allPackageAtoms = deriveAdditionalityAtoms(base, allTarget, pkg)
      .filter((atom) => atom.kind === 'efficiency_package');
    assert.equal(allPackageAtoms.length, packageIds.length);

    const denyTarget = clone(base);
    denyTarget.efficiency_controls = {
      autonomous_mode: 'off',
      package_mode: 'deny_list',
      package_ids: [packageIds[0]],
    };
    const denyPackageAtoms = deriveAdditionalityAtoms(base, denyTarget, pkg)
      .filter((atom) => atom.kind === 'efficiency_package');
    assert.equal(denyPackageAtoms.length, packageIds.length - 1);
    assert.equal(
      denyPackageAtoms.some((atom) => atom.packageId === packageIds[0]),
      false,
    );
    assert.deepEqual(
      denyPackageAtoms.map((atom) => atom.key),
      deriveAdditionalityAtoms(base, denyTarget, pkg)
        .filter((atom) => atom.kind === 'efficiency_package')
        .map((atom) => atom.key),
      'package atom ordering stays deterministic',
    );
  });

  test('validation rejects mode differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_controls.electricity.mode = 'externalized';

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_control_mode_mismatch'));
  });

  test('validation rejects target_value differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_controls.passenger_road_transport.target_value = 123;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_control_target_value_mismatch'));
  });

  test('validation rejects year override differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_controls.passenger_road_transport.year_overrides = {
      2030: {
        active_state_ids: ['road_transport__passenger_road__bev'],
      },
    };

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_control_year_overrides_mismatch'));
  });

  test('validation rejects demand differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_demands.passenger_road_transport['2050'] += 1;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_demands_mismatch'));
  });

  test('validation rejects carbon-price differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.carbon_price['2050'] += 5;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'carbon_price_mismatch'));
  });

  test('validation ignores presentation-only residual overlay display mode changes', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.presentation_options = {
      ...(target.presentation_options ?? {}),
      residual_overlay_display_mode: 'individual',
    };

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.deepEqual(issues, []);
  });

  test('validation rejects solver-option differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.solver_options = clone(target.solver_options);
    target.solver_options.soft_constraints = true;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'solver_options_mismatch'));
  });

  test('applying method atoms updates active selections and collapses fully active outputs to null', () => {
    const base = buildBaseCase();
    const first = applyAdditionalityAtom(
      base,
      {
        key: 'residential-1',
        kind: 'method',
        category: 'efficiency',
        outputId: 'residential_building_services',
        outputLabel: 'Residential building services',
        methodId: 'buildings__residential__electrified_efficiency',
        methodLabel: 'Electrified efficient residential services',
        label: 'Enable Electrified efficient residential services',
        action: 'enable',
      },
      pkg,
    );

    assert.deepEqual(first.service_controls.residential_building_services.active_state_ids, [
      'buildings__residential__electrified_efficiency',
      'buildings__residential__incumbent_mixed_fuels',
    ]);

    const second = applyAdditionalityAtom(
      first,
      {
        key: 'residential-2',
        kind: 'method',
        category: 'efficiency',
        outputId: 'residential_building_services',
        outputLabel: 'Residential building services',
        methodId: 'buildings__residential__deep_electric',
        methodLabel: 'Deep-electric residential services',
        label: 'Enable Deep-electric residential services',
        action: 'enable',
      },
      pkg,
    );

    assert.equal(second.service_controls.residential_building_services.active_state_ids, null);
  });

  test('applying package and autonomous atoms materializes explicit efficiency controls', () => {
    const packageId = Array.from(new Set(pkg.efficiencyPackages.map((entry) => entry.package_id))).sort()[0];
    const base = buildBaseCase();
    base.efficiency_controls = {
      autonomous_mode: 'baseline',
      package_mode: 'off',
      package_ids: [],
    };

    const withPackage = applyAdditionalityAtom(
      base,
      {
        key: `efficiency_package::${packageId}::enable`,
        kind: 'efficiency_package',
        category: 'efficiency',
        action: 'enable',
        label: `Enable ${packageId}`,
        outputId: null,
        outputLabel: null,
        packageId,
        packageLabel: packageId,
      },
      pkg,
    );

    assert.equal(withPackage.efficiency_controls.package_mode, 'allow_list');
    assert.deepEqual(withPackage.efficiency_controls.package_ids, [packageId]);

    const withAutonomousOff = applyAdditionalityAtom(
      withPackage,
      {
        key: 'autonomous_efficiency::residential_building_services::disable',
        kind: 'autonomous_efficiency',
        category: 'efficiency',
        action: 'disable',
        label: 'Disable autonomous efficiency',
        outputId: 'residential_building_services',
        outputLabel: 'Residential building services',
      },
      pkg,
    );

    assert.equal(
      withAutonomousOff.efficiency_controls.autonomous_modes_by_role.residential_building_services,
      'off',
    );
  });

  test('greedy analysis reaches the target cost after all selected atoms are applied', async () => {
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'reference-baseline',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildStateOpenCase(),
        targetConfigId: METHOD_OPEN_TARGET_ID,
      },
      {
        solve: async (request) => solveWithLpAdapter(request),
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(analysis.report);
    assertFiniteMetrics(analysis.report.baseMetrics);
    assertFiniteMetrics(analysis.report.targetMetrics);
    assert.equal(analysis.report.sequence.length, analysis.report.atomCount);
    for (const entry of analysis.report.sequence) {
      assertFiniteMetrics(entry.metricsBefore);
      assertFiniteMetrics(entry.metricsAfter);
      assertFiniteMetrics(entry.metricsDeltaFromCurrent);
      assertConsistentDelta(entry);
    }
    assertClose(
      analysis.report.sequence[analysis.report.sequence.length - 1].metricsAfter.cost,
      analysis.report.targetMetrics.cost,
      'final greedy cost reaches the target cost',
    );
  });

  test('metric totals reconcile with solve contribution rows', async () => {
    const solveCalls = [];
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'reference-baseline',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildStateOpenCase(),
        targetConfigId: METHOD_OPEN_TARGET_ID,
      },
      {
        buildRequest: (pkgArg, configuration) => {
          const request = buildSolveRequest(pkgArg, configuration);
          solveCalls.push({ configuration, request, result: null });
          return request;
        },
        solve: async (request) => {
          const result = await solveWithLpAdapter(request);
          const call = solveCalls.find((entry) => entry.request.requestId === request.requestId);
          if (call) {
            call.result = result;
          }
          return result;
        },
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(analysis.report);
    assert.ok(solveCalls.length >= 2);

    assertMetricVectorMatchesContributions(
      analysis.report.baseMetrics,
      buildAllContributionRows(
        solveCalls[0].request,
        solveCalls[0].result,
        pkg.residualOverlays2025,
        solveCalls[0].configuration,
      ),
      'base',
    );
    assertMetricVectorMatchesContributions(
      analysis.report.targetMetrics,
      buildAllContributionRows(
        solveCalls[1].request,
        solveCalls[1].result,
        pkg.residualOverlays2025,
        solveCalls[1].configuration,
      ),
      'focus',
    );
  });

  test('reverse greedy fixes misleading forward-greedy ordering', async () => {
    // Atom A = electrified_efficiency, Atom B = deep_electric
    // Forward greedy from base: A first (delta=10 vs delta=6)
    // Reverse greedy from target=7: remove A → |7-6|=1, remove B → |7-10|=3
    // A removed first (least impact), B removed second. Reversed: B first, A second.
    function mockSolverForReverseGreedyProof(request) {
      const hasA = hasActiveState(request, 'residential_building_services', 'buildings__residential__electrified_efficiency');
      const hasB = hasActiveState(request, 'residential_building_services', 'buildings__residential__deep_electric');
      if (hasA && hasB) return buildSolvedResult(request, 7);
      if (hasA && !hasB) return buildSolvedResult(request, 10);
      if (!hasA && hasB) return buildSolvedResult(request, 6);
      return buildSolvedResult(request, 0);
    }

    const base = buildBaseCase();
    const target = clone(base);
    target.service_controls.residential_building_services.active_state_ids = null;

    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: base,
        baseConfigId: 'reverse-greedy-base',
        commoditySelections: {},
        pkg,
        targetConfiguration: target,
        targetConfigId: 'reverse-greedy-target',
      },
      {
        solve: async (request) => mockSolverForReverseGreedyProof(request),
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.equal(analysis.report.sequence.length, 2);
    assert.ok(
      analysis.report.sequence[0].atom.methodLabel.includes('Deep-electric'),
      `expected first atom to contain "Deep-electric", got "${analysis.report.sequence[0].atom.methodLabel}"`,
    );
    assert.ok(
      analysis.report.sequence[1].atom.methodLabel.includes('Electrified efficient'),
      `expected second atom to contain "Electrified efficient", got "${analysis.report.sequence[1].atom.methodLabel}"`,
    );
    for (const entry of analysis.report.sequence) {
      assert.equal(entry.atom.action, 'enable');
    }
  });

  test('first sequence entry starts from base metrics and last entry reaches target metrics', async () => {
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'reference-baseline',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildStateOpenCase(),
        targetConfigId: METHOD_OPEN_TARGET_ID,
      },
      {
        solve: async (request) => solveWithLpAdapter(request),
      },
    );

    assert.equal(analysis.phase, 'success');
    assertClose(
      analysis.report.sequence[0].metricsBefore.cost,
      analysis.report.baseMetrics.cost,
      'first sequence entry starts from the base cost',
    );
    assertClose(
      analysis.report.sequence.at(-1).metricsAfter.cost,
      analysis.report.targetMetrics.cost,
      'last sequence entry reaches the target cost',
    );
  });

  test('disable-action atoms when target restricts methods relative to base', async () => {
    function mockSolverForDisableTest(request) {
      const hasA = hasActiveState(request, 'residential_building_services', 'buildings__residential__electrified_efficiency');
      const hasB = hasActiveState(request, 'residential_building_services', 'buildings__residential__deep_electric');
      if (hasA && hasB) return buildSolvedResult(request, 7);
      if (hasA && !hasB) return buildSolvedResult(request, 10);
      if (!hasA && hasB) return buildSolvedResult(request, 6);
      return buildSolvedResult(request, 0);
    }

    const base = buildBaseCase();
    base.service_controls.residential_building_services.active_state_ids = null;
    const target = clone(base);
    target.service_controls.residential_building_services.active_state_ids = [
      'buildings__residential__incumbent_mixed_fuels',
    ];

    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: base,
        baseConfigId: 'disable-base',
        commoditySelections: {},
        pkg,
        targetConfiguration: target,
        targetConfigId: 'disable-target',
      },
      {
        solve: async (request) => mockSolverForDisableTest(request),
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(
      analysis.report.sequence.some((entry) => entry.atom.action === 'disable'),
      'at least one atom should have action=disable',
    );
    for (const entry of analysis.report.sequence) {
      assertConsistentDelta(entry);
    }
  });

  test('deterministic tie-breaking when atoms have identical cost deltas', async () => {
    function mockSolverForTieBreak(request) {
      const hasA = hasActiveState(request, 'residential_building_services', 'buildings__residential__electrified_efficiency');
      const hasB = hasActiveState(request, 'residential_building_services', 'buildings__residential__deep_electric');
      if (hasA && hasB) return buildSolvedResult(request, 10);
      if (hasA || hasB) return buildSolvedResult(request, 5);
      return buildSolvedResult(request, 0);
    }

    const base = buildBaseCase();
    const target = clone(base);
    target.service_controls.residential_building_services.active_state_ids = null;

    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: base,
        baseConfigId: 'tiebreak-base',
        commoditySelections: {},
        pkg,
        targetConfiguration: target,
        targetConfigId: 'tiebreak-target',
      },
      {
        solve: async (request) => mockSolverForTieBreak(request),
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.equal(analysis.report.sequence.length, 2);
    // Both have same absCostDelta, tie-break is alphabetical by methodLabel.
    // During removal: "Deep-electric" < "Electrified efficient" alphabetically,
    // so Deep-electric is removed first. After presentation reversal:
    // Electrified efficient appears first, Deep-electric second.
    assert.ok(
      analysis.report.sequence[0].atom.methodLabel.includes('Electrified efficient'),
      `expected first atom to be "Electrified efficient", got "${analysis.report.sequence[0].atom.methodLabel}"`,
    );
    assert.ok(
      analysis.report.sequence[1].atom.methodLabel.includes('Deep-electric'),
      `expected second atom to be "Deep-electric", got "${analysis.report.sequence[1].atom.methodLabel}"`,
    );
    // Verify determinism by checking the deltas are actually tied
    assertClose(
      analysis.report.sequence[0].absCostDelta,
      analysis.report.sequence[1].absCostDelta,
      'both atoms should have identical absCostDelta',
    );
  });

  test('sampled Shapley is deterministic and matches an additive mock model', async () => {
    function mockSolverForAdditiveShapley(request) {
      const activeResidentialMethodIds = new Set(request.__activeResidentialMethodIds ?? []);
      const hasEfficiency = activeResidentialMethodIds.has('buildings__residential__electrified_efficiency');
      const hasDeepElectric = activeResidentialMethodIds.has('buildings__residential__deep_electric');

      return buildSolvedResult(
        request,
        (hasEfficiency ? 10 : 0) + (hasDeepElectric ? 5 : 0),
      );
    }

    const base = buildBaseCase();
    const target = clone(base);
    target.service_controls.residential_building_services.active_state_ids = null;

    const options = {
      baseConfiguration: base,
      baseConfigId: 'shapley-base',
      commoditySelections: {},
      method: 'shapley_permutation_sample',
      pkg,
      shapleySampleCount: 16,
      targetConfiguration: target,
      targetConfigId: 'shapley-target',
    };
    const residentialMethodIds = Array.from(new Set(
      pkg.resolvedMethodYears
        .filter((row) => row.service_or_output_name === 'residential_building_services')
        .map((row) => row.state_id),
    ));
    const buildAdditiveMockRequest = (pkgArg, configuration) => {
      const request = buildSolveRequest(pkgArg, configuration);
      const row = request.rows[0];
      const activeResidentialMethodIds = configuration
        .service_controls
        .residential_building_services
        .active_state_ids ?? residentialMethodIds;
      return {
        ...request,
        __activeResidentialMethodIds: activeResidentialMethodIds,
        rows: [
          {
            ...row,
            rowId: 'mock-row',
            inputs: [],
            directEmissions: [],
            conversionCostPerUnit: 1,
          },
        ],
      };
    };
    const first = await runAdditionalityAnalysis(options, {
      buildRequest: buildAdditiveMockRequest,
      solve: async (request) => mockSolverForAdditiveShapley(request),
    });
    const second = await runAdditionalityAnalysis(options, {
      buildRequest: buildAdditiveMockRequest,
      solve: async (request) => mockSolverForAdditiveShapley(request),
    });

    assert.equal(first.phase, 'success');
    assert.equal(first.report.orderingMethod, 'shapley_permutation_sample');
    assert.equal(first.report.methodMetadata.requestedPermutations, 16);
    assert.equal(first.report.methodMetadata.completedPermutations, 16);
    assert.deepEqual(
      first.report.sequence.map((entry) => [entry.atom.key, entry.metricsDeltaFromCurrent.cost]),
      second.report.sequence.map((entry) => [entry.atom.key, entry.metricsDeltaFromCurrent.cost]),
    );
    assert.deepEqual(
      first.report.sequence.map((entry) => entry.atom.methodId),
      [
        'buildings__residential__electrified_efficiency',
        'buildings__residential__deep_electric',
      ],
    );
    assert.deepEqual(
      first.report.sequence.map((entry) => entry.absCostDelta),
      [10, 5],
    );
    assertClose(
      first.report.sequence[0].metricsBefore.cost,
      first.report.baseMetrics.cost,
      'Shapley sequence starts from base cost',
    );
    assertClose(
      first.report.sequence.at(-1).metricsAfter.cost,
      first.report.targetMetrics.cost,
      'Shapley sequence reaches target cost',
    );

    const costByState = Object.fromEntries(
      first.report.sequence.map((entry) => [entry.atom.methodId, entry.metricsDeltaFromCurrent.cost]),
    );
    assertClose(
      costByState.buildings__residential__electrified_efficiency,
      10,
      'efficiency method Shapley cost equals additive marginal',
    );
    assertClose(
      costByState.buildings__residential__deep_electric,
      5,
      'deep-electric method Shapley cost equals additive marginal',
    );
  });

  test('records skipped intermediate candidates and continues when other candidates remain solvable', async () => {
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'reference-baseline',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildStateOpenCase(),
        targetConfigId: METHOD_OPEN_TARGET_ID,
      },
      {
        solve: async (request) => {
          const commercialDeepElectricOn = hasActiveState(
            request,
            'commercial_building_services',
            'buildings__commercial__deep_electric',
          );
          const commercialEfficiencyOn = hasActiveState(
            request,
            'commercial_building_services',
            'buildings__commercial__electrified_efficiency',
          );

          if (commercialDeepElectricOn && !commercialEfficiencyOn) {
            return buildErroredResult(
              request,
              'Forced candidate failure while deep-electric commercial services are enabled without the efficient commercial pathway.',
            );
          }

          const score = [
            ['cement_equivalent', 'cement_clinker__cement_equivalent__ccs_deep', 5],
            ['cement_equivalent', 'cement_clinker__cement_equivalent__low_clinker_alt_fuels', 4],
            ['commercial_building_services', 'buildings__commercial__deep_electric', 1],
            ['commercial_building_services', 'buildings__commercial__electrified_efficiency', 4],
            ['cropping_horticulture_output_bundle', 'agriculture__cropping_horticulture__mitigated', 4],
            ['crude_steel', 'steel__crude_steel__bf_bof_ccs_transition', 6],
            ['crude_steel', 'steel__crude_steel__h2_dri_electric', 9],
            ['crude_steel', 'steel__crude_steel__scrap_eaf', 7],
            ['electricity', 'electricity__grid_supply__deep_clean_firmed', 8],
            ['electricity', 'electricity__grid_supply__policy_frontier', 7],
            ['freight_road_transport', 'road_transport__freight_road__bev', 6],
            ['freight_road_transport', 'road_transport__freight_road__efficient_diesel', 3],
            ['freight_road_transport', 'road_transport__freight_road__fcev_h2', 5],
            ['high_temperature_heat', 'generic_industrial_heat__high_temperature_heat__electrified', 7],
            ['high_temperature_heat', 'generic_industrial_heat__high_temperature_heat__low_carbon_fuels', 4],
            ['livestock_output_bundle', 'agriculture__livestock__mitigated', 3],
            ['low_temperature_heat', 'generic_industrial_heat__low_temperature_heat__electrified', 8],
            ['low_temperature_heat', 'generic_industrial_heat__low_temperature_heat__low_carbon_fuels', 4],
            ['medium_temperature_heat', 'generic_industrial_heat__medium_temperature_heat__electrified', 3],
            ['medium_temperature_heat', 'generic_industrial_heat__medium_temperature_heat__low_carbon_fuels', 2],
            ['passenger_road_transport', 'road_transport__passenger_road__bev', 10],
            ['passenger_road_transport', 'road_transport__passenger_road__hybrid_transition', 3],
            ['residential_building_services', 'buildings__residential__deep_electric', 1],
            ['residential_building_services', 'buildings__residential__electrified_efficiency', 2],
          ].reduce((sum, [outputId, methodId, weight]) => (
            sum + (hasActiveState(request, outputId, methodId) ? weight : 0)
          ), 100);

          return buildSolvedResult(request, score);
        },
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(analysis.report);
    assert.equal(analysis.report.sequenceComplete, true);
    assert.equal(analysis.report.orderingMethod, 'reverse_greedy_target_context');
    assert.ok(analysis.report.skippedCandidates.length >= 1);
    assert.ok(analysis.report.sequence.some((entry) => entry.skippedCandidateCount >= 1));
    for (const entry of analysis.report.sequence) {
      assertFiniteMetrics(entry.metricsBefore);
      assertFiniteMetrics(entry.metricsAfter);
      assertFiniteMetrics(entry.metricsDeltaFromCurrent);
      assertConsistentDelta(entry);
    }
  });
});
