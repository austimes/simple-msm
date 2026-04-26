import type {
  CommoditySolveMode,
  NormalizedSolverRow,
  SolveRequest,
  SolveResult,
  SolveStateShareSummary,
} from '../solver/contract.ts';
import type {
  SystemStructureGroupRow,
  SystemStructureMemberRow,
} from '../data/types.ts';

export type SystemFlowViewMode = 'both' | 'topology' | 'solved';

export type SystemFlowSegmentRole =
  | 'exogenous_supply'
  | 'conversion'
  | 'end_use'
  | 'optional_activity';

export type SystemFlowNodeKind = 'commodity' | 'route' | 'demand' | 'output';

export interface SystemFlowGraphData {
  year: number;
  segments: SystemFlowSegment[];
  nodes: SystemFlowNode[];
  edges: SystemFlowEdge[];
  summary: SystemFlowSummary;
}

export interface SystemFlowSegment {
  id: string;
  label: string;
  role: SystemFlowSegmentRole;
  collapsed: boolean;
  systemGroupId?: string;
  systemGroupLabel?: string;
  systemGroupOrder?: number;
}

export interface SystemFlowNode {
  id: string;
  segmentId: string;
  kind: SystemFlowNodeKind;
  label: string;
  outputId?: string;
  stateId?: string;
  rowId?: string;
  commodityId?: string;
  role: string;
  activity: number;
  share: number | null;
  unit?: string;
  selected: boolean;
  baseStateId?: string;
  baseStateLabel?: string;
  variantGroupId?: string;
  variantOfBaseRoute?: boolean;
  sortKey?: string;
}

export interface SystemFlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  commodityId?: string;
  label: string;
  unit: string;
  possible: boolean;
  solvedValue: number;
  selected: boolean;
  kind?: 'input' | 'route_output' | 'external_demand';
}

export interface SystemFlowSummary {
  routeCount: number;
  selectedRouteCount: number;
  zeroActivityRouteCount: number;
  edgeCount: number;
  selectedEdgeCount: number;
  externalDemandEdgeCount: number;
  totalRouteActivity: number;
  commodityModesById: Record<string, CommoditySolveMode>;
}

interface RouteActivity {
  activity: number;
  share: number | null;
}

interface SystemFlowStructureGroup {
  id: string;
  label: string;
  order: number;
}

const EPSILON = 1e-9;
const EXOGENOUS_SEGMENT_ID = 'segment:exogenous_supply';
const EXTERNAL_DEMAND_SEGMENT_ID = 'segment:external_commodity_demand';

function yearKey(year: number): string {
  return String(year);
}

function formatFallbackLabel(id: string): string {
  return id
    .replaceAll('__', ' ')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function rowSortKey(row: NormalizedSolverRow): string {
  return [
    row.stateSortKey ?? '',
    row.stateOptionRank == null ? '' : String(row.stateOptionRank).padStart(4, '0'),
    row.stateDisplayLabel ?? row.stateLabel,
    row.rowId,
  ].join('::');
}

function routeNodeId(row: NormalizedSolverRow): string {
  return `route:${row.rowId}`;
}

function routeGroupId(row: NormalizedSolverRow): string {
  return [
    'route-group',
    row.outputId,
    String(row.year),
    row.provenance?.baseStateId ?? row.stateId,
  ].join(':');
}

function conversionSegmentId(outputId: string): string {
  return `segment:conversion:${outputId}`;
}

function endUseSegmentId(outputId: string): string {
  return `segment:end_use:${outputId}`;
}

function optionalSegmentId(outputId: string): string {
  return `segment:optional_activity:${outputId}`;
}

function outputNodeId(outputId: string): string {
  return `output:${outputId}`;
}

function demandNodeId(outputId: string): string {
  return `demand:${outputId}`;
}

function externalDemandNodeId(commodityId: string): string {
  return `demand:external:${commodityId}`;
}

function exogenousCommodityNodeId(commodityId: string): string {
  return `commodity:exogenous:${commodityId}`;
}

function buildCommodityModeLookup(result: SolveResult, year: number): Map<string, CommoditySolveMode> {
  const lookup = new Map<string, CommoditySolveMode>();

  for (const balance of result.reporting.commodityBalances) {
    if (balance.year === year) {
      lookup.set(balance.commodityId, balance.mode);
    }
  }

  return lookup;
}

function buildStateShareLookup(stateShares: SolveStateShareSummary[]): {
  byRowId: Map<string, RouteActivity>;
  byOutputYearState: Map<string, RouteActivity>;
} {
  const byRowId = new Map<string, RouteActivity>();
  const byOutputYearState = new Map<string, RouteActivity>();

  for (const stateShare of stateShares) {
    const activity = {
      activity: stateShare.activity,
      share: stateShare.share,
    };

    if (stateShare.rowId) {
      byRowId.set(stateShare.rowId, activity);
    }

    byOutputYearState.set(
      [stateShare.outputId, String(stateShare.year), stateShare.stateId].join('::'),
      activity,
    );
  }

  return { byRowId, byOutputYearState };
}

function buildSystemGroupLookup(
  groups: SystemStructureGroupRow[] | undefined,
  members: SystemStructureMemberRow[] | undefined,
): Map<string, SystemFlowStructureGroup> {
  const groupsById = new Map((groups ?? []).map((group) => [group.group_id, group]));
  const lookup = new Map<string, SystemFlowStructureGroup>();

  for (const member of members ?? []) {
    const group = groupsById.get(member.group_id);
    if (!group) {
      continue;
    }

    lookup.set(member.family_id, {
      id: group.group_id,
      label: group.group_label,
      order: group.display_order,
    });
  }

  return lookup;
}

function resolveRouteActivity(
  row: NormalizedSolverRow,
  lookup: ReturnType<typeof buildStateShareLookup>,
): RouteActivity {
  return lookup.byRowId.get(row.rowId)
    ?? lookup.byOutputYearState.get([row.outputId, String(row.year), row.stateId].join('::'))
    ?? { activity: 0, share: null };
}

function groupRowsByOutputYear(rows: NormalizedSolverRow[]): Map<string, NormalizedSolverRow[]> {
  const groups = new Map<string, NormalizedSolverRow[]>();

  for (const row of rows) {
    const key = [row.outputId, String(row.year)].join('::');
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return groups;
}

function isRowEnabled(
  row: NormalizedSolverRow,
  rowsByOutputYear: Map<string, NormalizedSolverRow[]>,
  request: SolveRequest,
): boolean {
  const control = request.configuration.controlsByOutput[row.outputId]?.[yearKey(row.year)];

  if (control?.mode === 'externalized') {
    return false;
  }

  if (!control?.activeStateIds) {
    return true;
  }

  const activeStateIds = new Set(control.activeStateIds);
  const rows = rowsByOutputYear.get([row.outputId, String(row.year)].join('::')) ?? [row];
  const directlyEnabled = activeStateIds.has(row.stateId);

  if (directlyEnabled) {
    return true;
  }

  if (row.provenance?.kind === 'efficiency_package') {
    return activeStateIds.has(row.provenance.baseStateId);
  }

  return rows.length === 0;
}

function resolveRouteRole(
  row: NormalizedSolverRow,
  activity: number,
  rowsByOutputYear: Map<string, NormalizedSolverRow[]>,
  request: SolveRequest,
): string {
  const control = request.configuration.controlsByOutput[row.outputId]?.[yearKey(row.year)];

  if (row.outputRole === 'endogenous_supply_commodity' && control?.mode === 'externalized') {
    return 'bypassed';
  }

  if (activity > EPSILON) {
    return 'solved';
  }

  if (!isRowEnabled(row, rowsByOutputYear, request)) {
    return 'inactive';
  }

  if (row.bounds.maxShare === 0 || row.bounds.maxActivity === 0) {
    return 'capped';
  }

  return 'available';
}

function inferExternalDemandUnit(request: SolveRequest, commodityId: string): string {
  const priceUnit = request.configuration.commodityPriceByCommodity[commodityId]?.unit;
  const denominator = priceUnit?.split('/').slice(1).join('/').trim();

  if (denominator) {
    return denominator;
  }

  return formatFallbackLabel(commodityId);
}

function segmentOrder(segment: SystemFlowSegment): number {
  switch (segment.role) {
    case 'exogenous_supply':
      return 0;
    case 'conversion':
      return 1;
    case 'end_use':
      return 2;
    case 'optional_activity':
      return 3;
  }
}

function nodeKindOrder(node: SystemFlowNode): number {
  switch (node.kind) {
    case 'commodity':
      return 0;
    case 'route':
      return 1;
    case 'output':
      return 2;
    case 'demand':
      return 3;
  }
}

export function buildSystemFlowGraphData(
  request: SolveRequest,
  result: SolveResult,
  options: {
    year: number;
    collapsedSegmentIds?: ReadonlySet<string>;
    systemStructureGroups?: SystemStructureGroupRow[];
    systemStructureMembers?: SystemStructureMemberRow[];
  },
): SystemFlowGraphData {
  const collapsedSegmentIds = options.collapsedSegmentIds ?? new Set<string>();
  const systemGroupByOutputId = buildSystemGroupLookup(
    options.systemStructureGroups,
    options.systemStructureMembers,
  );
  const commodityModes = buildCommodityModeLookup(result, options.year);
  const shareLookup = buildStateShareLookup(result.reporting.stateShares);
  const rowsForYear = request.rows.filter((row) => row.year === options.year);
  const rowsByOutputYear = groupRowsByOutputYear(request.rows);
  const segments = new Map<string, SystemFlowSegment>();
  const nodes = new Map<string, SystemFlowNode>();
  const edges: SystemFlowEdge[] = [];

  function ensureSegment(
    id: string,
    label: string,
    role: SystemFlowSegmentRole,
    outputId?: string,
  ): SystemFlowSegment {
    const existing = segments.get(id);

    if (existing) {
      const systemGroup = outputId ? systemGroupByOutputId.get(outputId) : undefined;
      if (systemGroup && !existing.systemGroupId) {
        existing.systemGroupId = systemGroup.id;
        existing.systemGroupLabel = systemGroup.label;
        existing.systemGroupOrder = systemGroup.order;
      }
      return existing;
    }

    const systemGroup = outputId ? systemGroupByOutputId.get(outputId) : undefined;
    const segment = {
      id,
      label,
      role,
      collapsed: collapsedSegmentIds.has(id),
      ...(systemGroup
        ? {
            systemGroupId: systemGroup.id,
            systemGroupLabel: systemGroup.label,
            systemGroupOrder: systemGroup.order,
          }
        : {}),
    };
    segments.set(id, segment);
    return segment;
  }

  function upsertNode(node: SystemFlowNode): SystemFlowNode {
    const existing = nodes.get(node.id);

    if (!existing) {
      nodes.set(node.id, node);
      return node;
    }

    existing.activity = Math.max(existing.activity, node.activity);
    existing.selected = existing.selected || node.selected;
    existing.share = existing.share ?? node.share;
    return existing;
  }

  function ensureExogenousCommodityNode(commodityId: string): string {
    ensureSegment(EXOGENOUS_SEGMENT_ID, 'Exogenous commodities', 'exogenous_supply');
    const id = exogenousCommodityNodeId(commodityId);
    upsertNode({
      id,
      segmentId: EXOGENOUS_SEGMENT_ID,
      kind: 'commodity',
      label: formatFallbackLabel(commodityId),
      commodityId,
      role: 'exogenous supply',
      activity: 0,
      share: null,
      selected: false,
      sortKey: formatFallbackLabel(commodityId),
    });
    return id;
  }

  function ensureSupplyOutputNode(row: NormalizedSolverRow): string {
    const segmentId = conversionSegmentId(row.outputId);
    ensureSegment(segmentId, row.outputLabel, 'conversion', row.outputId);
    const id = outputNodeId(row.outputId);
    upsertNode({
      id,
      segmentId,
      kind: 'output',
      label: row.outputLabel,
      outputId: row.outputId,
      commodityId: row.outputId,
      role: 'commodity output',
      activity: 0,
      share: null,
      selected: false,
      sortKey: `zz:${row.outputLabel}`,
    });
    return id;
  }

  function ensureRequiredDemandNode(row: NormalizedSolverRow): string {
    const segmentId = endUseSegmentId(row.outputId);
    ensureSegment(segmentId, row.outputLabel, 'end_use', row.outputId);
    const demand = request.configuration.serviceDemandByOutput[row.outputId]?.[yearKey(options.year)] ?? 0;
    const id = demandNodeId(row.outputId);
    upsertNode({
      id,
      segmentId,
      kind: 'demand',
      label: `${row.outputLabel} demand`,
      outputId: row.outputId,
      role: 'required demand',
      activity: demand,
      share: null,
      unit: row.outputUnit,
      selected: demand > EPSILON,
      sortKey: `zz:${row.outputLabel}`,
    });
    return id;
  }

  function ensureOptionalOutputNode(row: NormalizedSolverRow): string {
    const segmentId = optionalSegmentId(row.outputId);
    ensureSegment(segmentId, row.outputLabel, 'optional_activity', row.outputId);
    const id = outputNodeId(row.outputId);
    upsertNode({
      id,
      segmentId,
      kind: 'output',
      label: row.outputLabel,
      outputId: row.outputId,
      role: 'optional output',
      activity: 0,
      share: null,
      unit: row.outputUnit,
      selected: false,
      sortKey: `zz:${row.outputLabel}`,
    });
    return id;
  }

  function ensureExternalDemandNode(commodityId: string): string {
    ensureSegment(EXTERNAL_DEMAND_SEGMENT_ID, 'External commodity demand', 'end_use');
    const id = externalDemandNodeId(commodityId);
    upsertNode({
      id,
      segmentId: EXTERNAL_DEMAND_SEGMENT_ID,
      kind: 'demand',
      label: `${formatFallbackLabel(commodityId)} demand`,
      commodityId,
      role: 'external demand',
      activity: 0,
      share: null,
      unit: inferExternalDemandUnit(request, commodityId),
      selected: false,
      sortKey: formatFallbackLabel(commodityId),
    });
    return id;
  }

  function resolveCommoditySourceNode(commodityId: string, consumingRow: NormalizedSolverRow): string {
    const mode = commodityModes.get(commodityId);

    if (mode === 'endogenous' && consumingRow.outputId !== commodityId) {
      const supplyRow = rowsForYear.find((row) => {
        return row.outputRole === 'endogenous_supply_commodity' && row.outputId === commodityId;
      });

      if (supplyRow) {
        return ensureSupplyOutputNode(supplyRow);
      }
    }

    return ensureExogenousCommodityNode(commodityId);
  }

  for (const row of rowsForYear) {
    let segmentId: string;

    if (row.outputRole === 'endogenous_supply_commodity') {
      segmentId = conversionSegmentId(row.outputId);
      ensureSegment(segmentId, row.outputLabel, 'conversion', row.outputId);
      ensureSupplyOutputNode(row);
    } else if (row.outputRole === 'optional_activity') {
      segmentId = optionalSegmentId(row.outputId);
      ensureSegment(segmentId, row.outputLabel, 'optional_activity', row.outputId);
    } else {
      segmentId = endUseSegmentId(row.outputId);
      ensureSegment(segmentId, row.outputLabel, 'end_use', row.outputId);
    }

    const routeActivity = resolveRouteActivity(row, shareLookup);
    const role = resolveRouteRole(row, routeActivity.activity, rowsByOutputYear, request);
    const baseStateId = row.provenance?.baseStateId ?? row.stateId;
    const nodeId = routeNodeId(row);

    upsertNode({
      id: nodeId,
      segmentId,
      kind: 'route',
      label: row.stateDisplayLabel ?? row.stateLabel,
      outputId: row.outputId,
      stateId: row.stateId,
      rowId: row.rowId,
      role,
      activity: routeActivity.activity,
      share: routeActivity.share,
      unit: row.outputUnit,
      selected: routeActivity.activity > EPSILON,
      baseStateId,
      baseStateLabel: row.provenance?.baseStateLabel ?? row.stateLabel,
      variantGroupId: routeGroupId(row),
      variantOfBaseRoute: baseStateId !== row.stateId || row.provenance?.kind === 'efficiency_package',
      sortKey: rowSortKey(row),
    });

    row.inputs.forEach((input, index) => {
      const sourceId = resolveCommoditySourceNode(input.commodityId, row);
      const solvedValue = routeActivity.activity * input.coefficient;
      edges.push({
        id: `edge:input:${row.rowId}:${input.commodityId}:${index}`,
        sourceId,
        targetId: nodeId,
        commodityId: input.commodityId,
        label: formatFallbackLabel(input.commodityId),
        unit: input.unit,
        possible: true,
        solvedValue,
        selected: solvedValue > EPSILON,
        kind: 'input',
      });
    });

    if (row.outputRole === 'endogenous_supply_commodity') {
      const targetId = ensureSupplyOutputNode(row);
      edges.push({
        id: `edge:output:${row.rowId}`,
        sourceId: nodeId,
        targetId,
        commodityId: row.outputId,
        label: row.outputLabel,
        unit: row.outputUnit,
        possible: true,
        solvedValue: routeActivity.activity,
        selected: routeActivity.activity > EPSILON,
        kind: 'route_output',
      });
    } else if (row.outputRole === 'optional_activity') {
      const targetId = ensureOptionalOutputNode(row);
      edges.push({
        id: `edge:output:${row.rowId}`,
        sourceId: nodeId,
        targetId,
        commodityId: row.outputId,
        label: row.outputLabel,
        unit: row.outputUnit,
        possible: true,
        solvedValue: routeActivity.activity,
        selected: routeActivity.activity > EPSILON,
        kind: 'route_output',
      });
    } else {
      const targetId = ensureRequiredDemandNode(row);
      edges.push({
        id: `edge:output:${row.rowId}`,
        sourceId: nodeId,
        targetId,
        commodityId: row.outputId,
        label: row.outputLabel,
        unit: row.outputUnit,
        possible: true,
        solvedValue: routeActivity.activity,
        selected: routeActivity.activity > EPSILON,
        kind: 'route_output',
      });
    }
  }

  for (const [commodityId, demandByYear] of Object.entries(request.configuration.externalCommodityDemandByCommodity)) {
    const demand = demandByYear[yearKey(options.year)] ?? 0;

    if (demand <= EPSILON) {
      continue;
    }

    const sourceId = commodityModes.get(commodityId) === 'endogenous'
      ? (() => {
          const supplyRow = rowsForYear.find((row) => {
            return row.outputRole === 'endogenous_supply_commodity' && row.outputId === commodityId;
          });
          return supplyRow ? ensureSupplyOutputNode(supplyRow) : ensureExogenousCommodityNode(commodityId);
        })()
      : ensureExogenousCommodityNode(commodityId);
    const targetId = ensureExternalDemandNode(commodityId);
    const target = nodes.get(targetId);

    if (target) {
      target.activity = demand;
      target.selected = true;
    }

    edges.push({
      id: `edge:external-demand:${commodityId}`,
      sourceId,
      targetId,
      commodityId,
      label: `${formatFallbackLabel(commodityId)} demand`,
      unit: inferExternalDemandUnit(request, commodityId),
      possible: true,
      solvedValue: demand,
      selected: true,
      kind: 'external_demand',
    });
  }

  for (const edge of edges) {
    const source = nodes.get(edge.sourceId);
    const target = nodes.get(edge.targetId);

    if (source?.kind === 'commodity') {
      source.activity += edge.solvedValue;
      source.selected = source.selected || edge.selected;
    }

    if (target?.kind === 'output') {
      target.activity += edge.solvedValue;
      target.selected = target.selected || edge.selected;
    }
  }

  const sortedSegments = Array.from(segments.values()).sort((left, right) => {
    return segmentOrder(left) - segmentOrder(right)
      || left.label.localeCompare(right.label)
      || left.id.localeCompare(right.id);
  });
  const segmentIndex = new Map(sortedSegments.map((segment, index) => [segment.id, index]));
  const sortedNodes = Array.from(nodes.values()).sort((left, right) => {
    return (segmentIndex.get(left.segmentId) ?? 0) - (segmentIndex.get(right.segmentId) ?? 0)
      || nodeKindOrder(left) - nodeKindOrder(right)
      || (left.variantGroupId ?? left.id).localeCompare(right.variantGroupId ?? right.id)
      || (left.sortKey ?? left.label).localeCompare(right.sortKey ?? right.label)
      || left.id.localeCompare(right.id);
  });
  const routeNodes = sortedNodes.filter((node) => node.kind === 'route');
  const commodityModesById = Object.fromEntries(
    Array.from(commodityModes.entries()).sort(([left], [right]) => left.localeCompare(right)),
  );

  return {
    year: options.year,
    segments: sortedSegments,
    nodes: sortedNodes,
    edges: [...edges].sort((left, right) => left.id.localeCompare(right.id)),
    summary: {
      routeCount: routeNodes.length,
      selectedRouteCount: routeNodes.filter((node) => node.selected).length,
      zeroActivityRouteCount: routeNodes.filter((node) => node.activity <= EPSILON).length,
      edgeCount: edges.length,
      selectedEdgeCount: edges.filter((edge) => edge.selected).length,
      externalDemandEdgeCount: edges.filter((edge) => edge.kind === 'external_demand').length,
      totalRouteActivity: routeNodes.reduce((total, node) => total + node.activity, 0),
      commodityModesById,
    },
  };
}
