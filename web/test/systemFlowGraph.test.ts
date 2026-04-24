import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SYSTEM_FLOW_ROUTE_NODE_TYPE,
  buildSystemFlowDiagramLayoutInput,
} from '../src/components/workspace/systemFlowGraphLayout.ts';
import { buildSystemFlowGraphData } from '../src/results/systemFlowGraph.ts';
import { SOLVER_CONTRACT_VERSION, type SolveRequest, type SolveResult } from '../src/solver/contract.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';

function createRow({
  rowId,
  outputId,
  year = 2030,
  stateId,
  cost,
  outputRole = 'required_service',
  inputs = [],
  maxShare = null,
  provenance = undefined,
}: {
  rowId: string;
  outputId: string;
  year?: number;
  stateId: string;
  cost: number;
  outputRole?: 'required_service' | 'endogenous_supply_commodity' | 'optional_activity';
  inputs?: Array<{ commodityId: string; coefficient: number; unit: string }>;
  maxShare?: number | null;
  provenance?: SolveRequest['rows'][number]['provenance'];
}): SolveRequest['rows'][number] {
  return {
    rowId,
    outputId,
    outputRole,
    outputLabel: outputId === 'electricity' ? 'Electricity' : outputId,
    year,
    stateId,
    stateLabel: stateId,
    sector: 'test',
    subsector: 'test',
    region: 'national',
    outputUnit: outputId === 'electricity' ? 'MWh' : 'unit',
    conversionCostPerUnit: cost,
    inputs,
    directEmissions: [],
    provenance,
    bounds: {
      minShare: null,
      maxShare,
      maxActivity: null,
    },
  };
}

function buildElectricityRequest(electricityMode: 'optimize' | 'externalized'): SolveRequest {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: `system-flow-${electricityMode}`,
    rows: [
      createRow({
        rowId: 'process_fossil::2030',
        outputId: 'process',
        stateId: 'process_fossil',
        cost: 5,
        maxShare: electricityMode === 'externalized' ? 1 : 0,
        inputs: [{ commodityId: 'natural_gas', coefficient: 1, unit: 'GJ/unit' }],
      }),
      createRow({
        rowId: 'process_electric::2030',
        outputId: 'process',
        stateId: 'process_electric',
        cost: 1,
        maxShare: electricityMode === 'externalized' ? 1 : 1,
        inputs: [{ commodityId: 'electricity', coefficient: 2, unit: 'MWh/unit' }],
      }),
      createRow({
        rowId: 'grid_clean::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        stateId: 'grid_clean',
        cost: 1,
        maxShare: 0.25,
        inputs: [{ commodityId: 'natural_gas', coefficient: 0.2, unit: 'GJ/MWh' }],
      }),
      createRow({
        rowId: 'grid_firmed::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        stateId: 'grid_firmed',
        cost: 1,
        maxShare: 0.75,
        inputs: [{ commodityId: 'natural_gas', coefficient: 0.3, unit: 'GJ/MWh' }],
      }),
    ],
    configuration: {
      name: `System flow ${electricityMode}`,
      description: null,
      years: [2025, 2030],
      controlsByOutput: {
        process: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: electricityMode,
            activeStateIds: null,
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        process: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {
        electricity: { 2030: 50 },
      },
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 4 },
        },
        natural_gas: {
          unit: 'AUD/GJ',
          valuesByYear: { 2030: 1 },
        },
      },
      carbonPriceByYear: { 2030: 0 },
      options: {
        respectMaxShare: true,
        respectMaxActivity: true,
        softConstraints: false,
        shareSmoothing: {
          enabled: false,
          maxDeltaPp: null,
        },
      },
    },
    objectiveCost: {
      currency: 'AUD',
      costBasisYear: 2024,
    },
  };
}

function assertClose(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, received ${actual}`);
}

test('buildSystemFlowGraphData includes all possible routes for the selected year, including zero-activity routes', () => {
  const request = buildElectricityRequest('optimize');
  const result = solveWithLpAdapter(request);
  const graph = buildSystemFlowGraphData(request, result, { year: 2030 });
  const routeNodes = graph.nodes.filter((node) => node.kind === 'route');
  const zeroFossil = routeNodes.find((node) => node.rowId === 'process_fossil::2030');

  assert.equal(result.status, 'solved');
  assert.equal(routeNodes.length, request.rows.filter((row) => row.year === 2030).length);
  assert.ok(zeroFossil);
  assert.equal(zeroFossil.activity, 0);
  assert.equal(zeroFossil.selected, false);
});

test('buildSystemFlowGraphData sets solved input edge values to activity times coefficient', () => {
  const request = buildElectricityRequest('optimize');
  const result = solveWithLpAdapter(request);
  const graph = buildSystemFlowGraphData(request, result, { year: 2030 });
  const edge = graph.edges.find((entry) => entry.id === 'edge:input:process_electric::2030:electricity:0');

  assert.ok(edge);
  assertClose(edge.solvedValue, 200, 'electricity input edge');
});

test('endogenous electricity routes consuming edges through the electricity segment', () => {
  const request = buildElectricityRequest('optimize');
  const result = solveWithLpAdapter(request);
  const graph = buildSystemFlowGraphData(request, result, { year: 2030 });
  const edge = graph.edges.find((entry) => entry.id === 'edge:input:process_electric::2030:electricity:0');

  assert.equal(graph.summary.commodityModesById.electricity, 'endogenous');
  assert.equal(edge?.sourceId, 'output:electricity');
});

test('externalized electricity routes consuming edges from exogenous electricity and bypasses supply routes', () => {
  const request = buildElectricityRequest('externalized');
  const result = solveWithLpAdapter(request);
  const graph = buildSystemFlowGraphData(request, result, { year: 2030 });
  const edge = graph.edges.find((entry) => entry.id === 'edge:input:process_electric::2030:electricity:0');
  const supplyRoutes = graph.nodes.filter((node) => {
    return node.kind === 'route' && node.outputId === 'electricity';
  });

  assert.equal(graph.summary.commodityModesById.electricity, 'externalized');
  assert.equal(edge?.sourceId, 'commodity:exogenous:electricity');
  assert.equal(supplyRoutes.length, 2);
  assert.ok(supplyRoutes.every((node) => node.role === 'bypassed'));
  assert.ok(supplyRoutes.every((node) => node.activity === 0));
});

test('external commodity demand appears as a separate residual demand edge', () => {
  const request = buildElectricityRequest('optimize');
  const result = solveWithLpAdapter(request);
  const graph = buildSystemFlowGraphData(request, result, { year: 2030 });
  const edge = graph.edges.find((entry) => entry.id === 'edge:external-demand:electricity');

  assert.ok(edge);
  assert.equal(edge.kind, 'external_demand');
  assert.equal(edge.targetId, 'demand:external:electricity');
  assert.equal(edge.sourceId, 'output:electricity');
  assertClose(edge.solvedValue, 50, 'external electricity demand edge');
});

test('efficiency package derived rows are grouped as variants under the base route', () => {
  const baseProvenance = {
    kind: 'base_state' as const,
    familyId: 'heat',
    baseStateId: 'heat_fossil',
    baseStateLabel: 'Heat fossil',
    baseRowId: 'heat_fossil::2030',
    autonomousTrackIds: [],
  };
  const packageProvenance = {
    kind: 'efficiency_package' as const,
    familyId: 'heat',
    baseStateId: 'heat_fossil',
    baseStateLabel: 'Heat fossil',
    baseRowId: 'heat_fossil::2030',
    autonomousTrackIds: [],
    packageId: 'retrofit',
    packageClassification: 'pure_efficiency_overlay' as const,
  };
  const request: SolveRequest = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'system-flow-efficiency-variants',
    rows: [
      createRow({
        rowId: 'heat_fossil::2030',
        outputId: 'heat',
        stateId: 'heat_fossil',
        cost: 2,
        provenance: baseProvenance,
      }),
      createRow({
        rowId: 'effpkg:heat_fossil:retrofit::2030',
        outputId: 'heat',
        stateId: 'effpkg:heat_fossil:retrofit',
        cost: 1,
        inputs: [{ commodityId: 'natural_gas', coefficient: 0.8, unit: 'GJ/unit' }],
        provenance: packageProvenance,
      }),
    ],
    configuration: {
      name: 'System flow efficiency variants',
      description: null,
      years: [2030],
      controlsByOutput: {
        heat: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        heat: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {
        natural_gas: {
          unit: 'AUD/GJ',
          valuesByYear: { 2030: 1 },
        },
      },
      carbonPriceByYear: { 2030: 0 },
      options: {
        respectMaxShare: true,
        respectMaxActivity: true,
        softConstraints: false,
        shareSmoothing: {
          enabled: false,
          maxDeltaPp: null,
        },
      },
    },
  };
  const result: SolveResult = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: request.requestId,
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: request.rows.length,
      yearCount: 1,
      outputCount: 1,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [
        {
          outputId: 'heat',
          outputLabel: 'heat',
          year: 2030,
          rowId: 'heat_fossil::2030',
          stateId: 'heat_fossil',
          stateLabel: 'Heat fossil',
          pathwayStateId: 'heat_fossil',
          pathwayStateLabel: 'Heat fossil',
          provenance: baseProvenance,
          activity: 0,
          share: 0,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'heat',
          outputLabel: 'heat',
          year: 2030,
          rowId: 'effpkg:heat_fossil:retrofit::2030',
          stateId: 'effpkg:heat_fossil:retrofit',
          stateLabel: 'Heat fossil + retrofit',
          pathwayStateId: 'heat_fossil',
          pathwayStateLabel: 'Heat fossil',
          provenance: packageProvenance,
          activity: 100,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
      ],
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: null,
    diagnostics: [],
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
  const graph = buildSystemFlowGraphData(request, result, { year: 2030 });
  const baseNode = graph.nodes.find((node) => node.rowId === 'heat_fossil::2030');
  const packageNode = graph.nodes.find((node) => node.rowId === 'effpkg:heat_fossil:retrofit::2030');

  assert.ok(baseNode);
  assert.ok(packageNode);
  assert.equal(packageNode.variantOfBaseRoute, true);
  assert.equal(packageNode.baseStateId, 'heat_fossil');
  assert.equal(packageNode.variantGroupId, baseNode.variantGroupId);

  const diagram = buildSystemFlowDiagramLayoutInput(graph, 'both');
  const routeNodes = diagram.nodes.filter((node) => node.type === SYSTEM_FLOW_ROUTE_NODE_TYPE);
  const routeNode = routeNodes[0];

  assert.ok(routeNode);

  const routeOutputEdges = diagram.edges.filter((edge) => {
    return edge.source === routeNode.id && edge.target.includes('demand:heat');
  });

  assert.equal(routeNodes.length, 1);
  assert.equal(routeNode.data.metric, '100 unit');
  assert.equal(routeNode.data.variants?.length, 2);
  assert.equal(routeOutputEdges.length, 1);
  assert.equal(routeOutputEdges[0].data?.metric, '100 unit');
});
