import type { Edge, Node } from '@xyflow/react';
import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api';
import type ElkConstructor from 'elkjs/lib/elk.bundled.js';
import { getPresentation } from '../../data/chartPresentation.ts';
import { SYSTEM_STRUCTURE_GROUPS } from '../../data/systemStructureModel.ts';
import type {
  SystemFlowEdge,
  SystemFlowGraphData,
  SystemFlowNode,
  SystemFlowSegment,
  SystemFlowViewMode,
} from '../../results/systemFlowGraph.ts';

export const SYSTEM_FLOW_SECTOR_NODE_TYPE = 'systemFlowSector';
export const SYSTEM_FLOW_SEGMENT_NODE_TYPE = 'systemFlowSegment';
export const SYSTEM_FLOW_ROUTE_NODE_TYPE = 'systemFlowRoute';
export const SYSTEM_FLOW_TERMINAL_NODE_TYPE = 'systemFlowTerminal';
export const SYSTEM_FLOW_EDGE_TYPE = 'systemFlowEdge';

const EPSILON = 1e-9;
const ROUTE_NODE_WIDTH = 204;
const TERMINAL_NODE_WIDTH = 158;
const TERMINAL_NODE_HEIGHT = 58;
const COLLAPSED_SEGMENT_WIDTH = 238;
const COLLAPSED_SEGMENT_HEIGHT = 88;
const VISIBLE_VARIANT_LIMIT = 3;
const PORT_SIZE = 8;

export type SystemFlowPortSide = 'left' | 'right';

interface SystemFlowSectorGroup {
  id: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface SystemFlowRouteVariant {
  id: string;
  label: string;
  metric: string;
  selected: boolean;
}

export interface SystemFlowDiagramPort {
  id: string;
  side: SystemFlowPortSide;
  index: number;
  color: string;
  label: string;
  selected: boolean;
  muted: boolean;
  offsetY: number | null;
}

export interface SystemFlowDiagramNodeData extends Record<string, unknown> {
  kind: 'sector' | 'segment' | 'route' | 'terminal';
  label: string;
  role: string;
  color: string;
  selected: boolean;
  muted: boolean;
  sectorId?: string;
  segmentId?: string;
  collapsed?: boolean;
  hiddenCount?: number;
  metric?: string;
  shareLabel?: string | null;
  variants?: SystemFlowRouteVariant[];
  variantOverflow?: number;
  ports?: SystemFlowDiagramPort[];
  onToggleSegment?: (segmentId: string) => void;
}

export interface SystemFlowDiagramEdgeData extends Record<string, unknown> {
  label: string;
  metric: string;
  color: string;
  selected: boolean;
  muted: boolean;
  width: number;
  showLabel: boolean;
  sourcePortId: string;
  targetPortId: string;
  laneIndex: number;
  laneCount: number;
}

export type SystemFlowDiagramNode = Node<
  SystemFlowDiagramNodeData,
  | typeof SYSTEM_FLOW_SECTOR_NODE_TYPE
  | typeof SYSTEM_FLOW_SEGMENT_NODE_TYPE
  | typeof SYSTEM_FLOW_ROUTE_NODE_TYPE
  | typeof SYSTEM_FLOW_TERMINAL_NODE_TYPE
>;

export type SystemFlowDiagramEdge = Edge<SystemFlowDiagramEdgeData, typeof SYSTEM_FLOW_EDGE_TYPE>;

export interface SystemFlowDiagramLayout {
  nodes: SystemFlowDiagramNode[];
  edges: SystemFlowDiagramEdge[];
}

interface DiagramItem {
  id: string;
  segmentId: string;
  sourceNodeIds: string[];
  node: SystemFlowDiagramNode;
  sortKey: string;
}

interface PendingEdge {
  id: string;
  source: string;
  target: string;
  commodityId?: string;
  kind?: SystemFlowEdge['kind'];
  label: string;
  unit: string;
  possible: boolean;
  solvedValue: number;
  selected: boolean;
}

interface AggregatedEdge {
  id: string;
  source: string;
  target: string;
  commodityId?: string;
  kind?: SystemFlowEdge['kind'];
  label: string;
  unit: string;
  possible: boolean;
  solvedValue: number;
  selected: boolean;
}

interface DiagramPortsAndEdges {
  edges: SystemFlowDiagramEdge[];
  portsByNodeId: Map<string, SystemFlowDiagramPort[]>;
}

interface SystemFlowDiagramPortDraft extends SystemFlowDiagramPort {
  activeRank: number;
  commoditySortKey: string;
  edgeId: string;
  oppositeNodeSortKey: string;
}

type ElkInstance = InstanceType<typeof ElkConstructor>;

let elk: ElkInstance | null = null;

const STRUCTURE_GROUPS_BY_OUTPUT_ID = new Map<string, (typeof SYSTEM_STRUCTURE_GROUPS)[number]>();
SYSTEM_STRUCTURE_GROUPS.forEach((group) => {
  group.outputIds.forEach((outputId) => {
    STRUCTURE_GROUPS_BY_OUTPUT_ID.set(outputId, group);
  });
});

const STRUCTURE_GROUP_ORDER = new Map<string, number>();
SYSTEM_STRUCTURE_GROUPS.forEach((group, index) => {
  STRUCTURE_GROUP_ORDER.set(group.id, index * 100);
});

const SECTOR_PRESENTATION_IDS: Record<string, string> = {
  energy_supply: 'electricity_supply',
  industrial_production: 'generic_industrial_heat',
  removals_land: 'removals_negative_emissions',
};

const FALLBACK_SECTOR_GROUPS: Record<string, SystemFlowSectorGroup> = {
  supply_inputs: {
    id: 'supply_inputs',
    label: 'Supply inputs',
    color: '#64748b',
    sortOrder: -200,
  },
  external_demand: {
    id: 'external_demand',
    label: 'External demand',
    color: '#64748b',
    sortOrder: 1_000,
  },
  other_modeled_outputs: {
    id: 'other_modeled_outputs',
    label: 'Other modeled outputs',
    color: '#64748b',
    sortOrder: 900,
  },
};

async function getElk(): Promise<ElkInstance> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  elk ??= new ELK();
  return elk;
}

function formatNumber(value: number): string {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  if (absolute >= 10) {
    return value.toFixed(0);
  }

  if (absolute >= 1) {
    return value.toFixed(1).replace(/\.0$/, '');
  }

  if (absolute === 0) {
    return '0';
  }

  return value.toPrecision(2);
}

export function formatSystemFlowActivity(value: number, unit: string | undefined): string {
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
}

export function formatSystemFlowShare(value: number | null): string | null {
  return value == null ? null : `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

function segmentNodeId(segmentId: string): string {
  return `system-flow-segment:${segmentId}`;
}

function sectorNodeId(sectorId: string): string {
  return `system-flow-sector:${sectorId}`;
}

function routeDiagramNodeId(groupId: string): string {
  return `system-flow-route:${groupId}`;
}

function terminalDiagramNodeId(nodeId: string): string {
  return `system-flow-node:${nodeId}`;
}

function elkPortId(nodeId: string, portId: string): string {
  return `${nodeId}:${portId}`;
}

function sourcePortId(edgeId: string): string {
  return `source:${edgeId}`;
}

function targetPortId(edgeId: string): string {
  return `target:${edgeId}`;
}

function nodeColor(node: SystemFlowNode): string {
  if (node.kind === 'commodity' && node.commodityId) {
    return getPresentation('commodity', node.commodityId, node.label).color;
  }

  if (node.kind === 'route') {
    return getPresentation('state', node.baseMethodId ?? node.methodId ?? node.id, node.label).color;
  }

  if (node.outputId) {
    return getPresentation('output', node.outputId, node.label).color;
  }

  if (node.commodityId) {
    return getPresentation('commodity', node.commodityId, node.label).color;
  }

  return '#64748b';
}

function edgeColor(edge: Pick<SystemFlowEdge, 'kind' | 'commodityId' | 'label'>): string {
  if ((edge.kind === 'input' || edge.kind === 'external_demand') && edge.commodityId) {
    return getPresentation('commodity', edge.commodityId, edge.label).color;
  }

  if (edge.commodityId) {
    return getPresentation('output', edge.commodityId, edge.label).color;
  }

  return '#64748b';
}

function segmentColor(segment: SystemFlowSegment): string {
  if (segment.role === 'conversion' || segment.role === 'end_use' || segment.role === 'optional_activity') {
    const [, , outputId] = segment.id.split(':');

    if (outputId) {
      return getPresentation('output', outputId, segment.label).color;
    }
  }

  return '#64748b';
}

function segmentRoleLabel(segment: SystemFlowSegment): string {
  return segment.role.replaceAll('_', ' ');
}

function segmentOutputId(segment: SystemFlowSegment): string | null {
  const [, , outputId] = segment.id.split(':');
  return outputId ?? null;
}

function structureGroupColor(groupId: string, label: string): string {
  const presentationId = SECTOR_PRESENTATION_IDS[groupId] ?? groupId;
  return getPresentation('sector', presentationId, label).color;
}

function sectorGroupForSegment(segment: SystemFlowSegment): SystemFlowSectorGroup {
  if (segment.role === 'exogenous_supply') {
    return FALLBACK_SECTOR_GROUPS.supply_inputs;
  }

  if (segment.id === 'segment:external_commodity_demand') {
    return FALLBACK_SECTOR_GROUPS.external_demand;
  }

  if (segment.systemGroupId && segment.systemGroupLabel) {
    return {
      id: segment.systemGroupId,
      label: segment.systemGroupLabel,
      color: structureGroupColor(segment.systemGroupId, segment.systemGroupLabel),
      sortOrder: segment.systemGroupOrder ?? 800,
    };
  }

  const outputId = segmentOutputId(segment);
  const structureGroup = outputId ? STRUCTURE_GROUPS_BY_OUTPUT_ID.get(outputId) : undefined;

  if (!structureGroup) {
    return FALLBACK_SECTOR_GROUPS.other_modeled_outputs;
  }

  return {
    id: structureGroup.id,
    label: structureGroup.label,
    color: structureGroupColor(structureGroup.id, structureGroup.label),
    sortOrder: STRUCTURE_GROUP_ORDER.get(structureGroup.id) ?? 800,
  };
}

function routeNodeHeight(variantCount: number): number {
  if (variantCount <= 0) {
    return 78;
  }

  return 94 + Math.min(variantCount, VISIBLE_VARIANT_LIMIT) * 20 + (variantCount > VISIBLE_VARIANT_LIMIT ? 14 : 0);
}

function routeLabel(primary: SystemFlowNode): string {
  return primary.variantOfBaseRoute ? primary.baseMethodLabel ?? primary.label : primary.label;
}

function buildRouteItems(nodes: SystemFlowNode[], viewMode: SystemFlowViewMode): DiagramItem[] {
  const routeGroups = new Map<string, SystemFlowNode[]>();

  for (const node of nodes) {
    if (node.kind !== 'route') {
      continue;
    }

    const groupId = node.variantGroupId ?? node.id;
    const group = routeGroups.get(groupId) ?? [];
    group.push(node);
    routeGroups.set(groupId, group);
  }

  return Array.from(routeGroups.entries()).map(([groupId, routeNodes]) => {
    const sortedRouteNodes = [...routeNodes].sort((left, right) => {
      if (left.variantOfBaseRoute !== right.variantOfBaseRoute) {
        return left.variantOfBaseRoute ? 1 : -1;
      }

      return (left.sortKey ?? left.label).localeCompare(right.sortKey ?? right.label)
        || left.id.localeCompare(right.id);
    });
    const primary = sortedRouteNodes.find((node) => !node.variantOfBaseRoute) ?? sortedRouteNodes[0];
    const variants = sortedRouteNodes.filter((node) => {
      return sortedRouteNodes.length > 1 || node.variantOfBaseRoute;
    });
    const visibleVariants = variants.slice(0, VISIBLE_VARIANT_LIMIT).map((variant) => ({
      id: variant.id,
      label: variant.label,
      metric: formatSystemFlowActivity(variant.activity, variant.unit),
      selected: variant.selected,
    }));
    const shares = sortedRouteNodes
      .map((node) => node.share)
      .filter((share): share is number => share != null);
    const activity = sortedRouteNodes.reduce((total, node) => total + node.activity, 0);
    const selected = sortedRouteNodes.some((node) => node.selected);
    const muted = viewMode === 'solved' ? !selected : viewMode !== 'topology' && !selected;
    const node: SystemFlowDiagramNode = {
      id: routeDiagramNodeId(groupId),
      type: SYSTEM_FLOW_ROUTE_NODE_TYPE,
      position: { x: 0, y: 0 },
      width: ROUTE_NODE_WIDTH,
      height: routeNodeHeight(variants.length),
      data: {
        kind: 'route',
        label: routeLabel(primary),
        role: selected ? 'solved' : primary.role,
        color: nodeColor(primary),
        selected,
        muted,
        segmentId: primary.segmentId,
        metric: formatSystemFlowActivity(activity, primary.unit),
        shareLabel: shares.length > 0 ? formatSystemFlowShare(shares.reduce((total, share) => total + share, 0)) : null,
        variants: visibleVariants,
        variantOverflow: Math.max(0, variants.length - visibleVariants.length),
      },
      draggable: true,
      selectable: true,
      focusable: false,
    };

    return {
      id: node.id,
      segmentId: primary.segmentId,
      sourceNodeIds: sortedRouteNodes.map((routeNode) => routeNode.id),
      node,
      sortKey: [
        primary.segmentId,
        primary.sortKey ?? primary.label,
        primary.id,
      ].join('::'),
    };
  });
}

function buildTerminalItems(nodes: SystemFlowNode[], viewMode: SystemFlowViewMode): DiagramItem[] {
  return nodes
    .filter((node) => node.kind !== 'route')
    .map((sourceNode) => {
      const selected = sourceNode.selected;
      const muted = viewMode === 'solved' ? !selected : viewMode !== 'topology' && !selected;
      const metric = sourceNode.activity > EPSILON
        ? formatSystemFlowActivity(sourceNode.activity, sourceNode.unit)
        : sourceNode.role;
      const node: SystemFlowDiagramNode = {
        id: terminalDiagramNodeId(sourceNode.id),
        type: SYSTEM_FLOW_TERMINAL_NODE_TYPE,
        position: { x: 0, y: 0 },
        width: TERMINAL_NODE_WIDTH,
        height: TERMINAL_NODE_HEIGHT,
        data: {
          kind: 'terminal',
          label: sourceNode.label,
          role: sourceNode.kind,
          color: nodeColor(sourceNode),
          selected,
          muted,
          segmentId: sourceNode.segmentId,
          metric,
        },
        draggable: true,
        selectable: true,
        focusable: false,
      };

      return {
        id: node.id,
        segmentId: sourceNode.segmentId,
        sourceNodeIds: [sourceNode.id],
        node,
        sortKey: [
          sourceNode.segmentId,
          sourceNode.sortKey ?? sourceNode.label,
          sourceNode.id,
        ].join('::'),
      };
    });
}

function shouldRenderEdge(edge: SystemFlowEdge, viewMode: SystemFlowViewMode): boolean {
  if (viewMode === 'solved') {
    return edge.selected;
  }

  return edge.possible;
}

function aggregateEdges(edges: PendingEdge[]): AggregatedEdge[] {
  const byKey = new Map<string, AggregatedEdge>();

  for (const edge of edges) {
    if (edge.source === edge.target) {
      continue;
    }

    const key = [
      edge.source,
      edge.target,
      edge.commodityId ?? edge.label,
      edge.kind ?? 'flow',
      edge.unit,
    ].join('::');
    const existing = byKey.get(key);

    if (existing) {
      existing.solvedValue += edge.solvedValue;
      existing.possible = existing.possible || edge.possible;
      existing.selected = existing.selected || edge.selected;
      continue;
    }

    byKey.set(key, { ...edge, id: `system-flow-edge:${byKey.size}` });
  }

  return Array.from(byKey.values()).map((edge) => ({
    ...edge,
    selected: edge.selected || Math.abs(edge.solvedValue) > EPSILON,
  }));
}

function edgeWidth(edge: AggregatedEdge, maxByCommodity: Map<string, number>, viewMode: SystemFlowViewMode): number {
  if (viewMode === 'topology' || !edge.selected) {
    return 1.2;
  }

  const max = maxByCommodity.get(edge.commodityId ?? edge.label) ?? 0;
  const share = max > 0 ? Math.abs(edge.solvedValue) / max : 0;
  return 2 + share * 5;
}

function nodeSortKey(node: SystemFlowDiagramNode): string {
  return [
    node.parentId ?? '',
    node.data.kind,
    node.data.segmentId ?? '',
    node.data.label,
    node.id,
  ].join('::');
}

function portSideRank(side: SystemFlowPortSide): number {
  return side === 'left' ? 0 : 1;
}

function addPortDraft(
  portsByNodeId: Map<string, SystemFlowDiagramPortDraft[]>,
  nodeId: string,
  port: SystemFlowDiagramPortDraft,
) {
  const ports = portsByNodeId.get(nodeId) ?? [];
  ports.push(port);
  portsByNodeId.set(nodeId, ports);
}

function finalizePortsByNodeId(
  portDraftsByNodeId: Map<string, SystemFlowDiagramPortDraft[]>,
): Map<string, SystemFlowDiagramPort[]> {
  const portsByNodeId = new Map<string, SystemFlowDiagramPort[]>();

  for (const [nodeId, portDrafts] of portDraftsByNodeId.entries()) {
    const indexesBySide = new Map<SystemFlowPortSide, number>();
    const ports = [...portDrafts]
      .sort((left, right) => {
        return left.activeRank - right.activeRank
          || portSideRank(left.side) - portSideRank(right.side)
          || left.commoditySortKey.localeCompare(right.commoditySortKey)
          || left.oppositeNodeSortKey.localeCompare(right.oppositeNodeSortKey)
          || left.edgeId.localeCompare(right.edgeId);
      })
      .map((portDraft) => {
        const index = indexesBySide.get(portDraft.side) ?? 0;
        indexesBySide.set(portDraft.side, index + 1);

        return {
          id: portDraft.id,
          side: portDraft.side,
          index,
          color: portDraft.color,
          label: portDraft.label,
          selected: portDraft.selected,
          muted: portDraft.muted,
          offsetY: portDraft.offsetY,
        };
      });

    portsByNodeId.set(nodeId, ports);
  }

  return portsByNodeId;
}

function assignLaneIndexes(edges: AggregatedEdge[]): Map<string, { laneIndex: number; laneCount: number }> {
  const edgesByPair = new Map<string, AggregatedEdge[]>();
  const lanesByEdgeId = new Map<string, { laneIndex: number; laneCount: number }>();

  for (const edge of edges) {
    const key = `${edge.source}::${edge.target}`;
    const group = edgesByPair.get(key) ?? [];
    group.push(edge);
    edgesByPair.set(key, group);
  }

  for (const group of edgesByPair.values()) {
    const sortedGroup = [...group].sort((left, right) => {
      return (left.commodityId ?? left.label).localeCompare(right.commodityId ?? right.label)
        || (left.kind ?? '').localeCompare(right.kind ?? '')
        || left.id.localeCompare(right.id);
    });

    sortedGroup.forEach((edge, index) => {
      lanesByEdgeId.set(edge.id, {
        laneIndex: index,
        laneCount: sortedGroup.length,
      });
    });
  }

  return lanesByEdgeId;
}

function buildDiagramEdges(
  data: SystemFlowGraphData,
  sourceNodeToDiagramNode: Map<string, string>,
  viewMode: SystemFlowViewMode,
  diagramNodes: SystemFlowDiagramNode[],
): DiagramPortsAndEdges {
  const pendingEdges: PendingEdge[] = [];

  for (const edge of data.edges) {
    if (!shouldRenderEdge(edge, viewMode)) {
      continue;
    }

    const source = sourceNodeToDiagramNode.get(edge.sourceId);
    const target = sourceNodeToDiagramNode.get(edge.targetId);

    if (!source || !target) {
      continue;
    }

    pendingEdges.push({
      id: edge.id,
      source,
      target,
      commodityId: edge.commodityId,
      kind: edge.kind,
      label: edge.label,
      unit: edge.unit,
      possible: edge.possible,
      solvedValue: edge.solvedValue,
      selected: edge.selected,
    });
  }

  const aggregatedEdges = aggregateEdges(pendingEdges);
  const maxByCommodity = new Map<string, number>();
  const nodeSortKeys = new Map(diagramNodes.map((node) => [node.id, nodeSortKey(node)]));
  const portDraftsByNodeId = new Map<string, SystemFlowDiagramPortDraft[]>();
  const laneIndexes = assignLaneIndexes(aggregatedEdges);

  for (const edge of aggregatedEdges) {
    const key = edge.commodityId ?? edge.label;
    maxByCommodity.set(key, Math.max(maxByCommodity.get(key) ?? 0, Math.abs(edge.solvedValue)));
  }

  const edges: SystemFlowDiagramEdge[] = aggregatedEdges.map((edge) => {
    const max = maxByCommodity.get(edge.commodityId ?? edge.label) ?? 0;
    const relativeValue = max > 0 ? Math.abs(edge.solvedValue) / max : 0;
    const showLabel = viewMode !== 'topology' && edge.selected && relativeValue >= (viewMode === 'solved' ? 0.22 : 0.34);
    const color = edgeColor(edge);
    const muted = viewMode === 'solved' ? !edge.selected : viewMode !== 'topology' && !edge.selected;
    const sourceHandle = sourcePortId(edge.id);
    const targetHandle = targetPortId(edge.id);
    const lane = laneIndexes.get(edge.id) ?? { laneIndex: 0, laneCount: 1 };
    const commoditySortKey = [
      edge.commodityId ?? '',
      edge.label,
      edge.kind ?? '',
      edge.unit,
    ].join('::');

    addPortDraft(portDraftsByNodeId, edge.source, {
      id: sourceHandle,
      side: 'right',
      index: 0,
      color,
      label: edge.label,
      selected: edge.selected,
      muted,
      offsetY: null,
      activeRank: edge.selected ? 0 : 1,
      commoditySortKey,
      edgeId: edge.id,
      oppositeNodeSortKey: nodeSortKeys.get(edge.target) ?? edge.target,
    });
    addPortDraft(portDraftsByNodeId, edge.target, {
      id: targetHandle,
      side: 'left',
      index: 0,
      color,
      label: edge.label,
      selected: edge.selected,
      muted,
      offsetY: null,
      activeRank: edge.selected ? 0 : 1,
      commoditySortKey,
      edgeId: edge.id,
      oppositeNodeSortKey: nodeSortKeys.get(edge.source) ?? edge.source,
    });

    return {
      id: edge.id,
      type: SYSTEM_FLOW_EDGE_TYPE,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      data: {
        label: edge.label,
        metric: formatSystemFlowActivity(edge.solvedValue, edge.unit),
        color,
        selected: edge.selected,
        muted,
        width: edgeWidth(edge, maxByCommodity, viewMode),
        showLabel,
        sourcePortId: sourceHandle,
        targetPortId: targetHandle,
        laneIndex: lane.laneIndex,
        laneCount: lane.laneCount,
      },
      selectable: false,
      focusable: false,
      interactionWidth: 18,
    };
  });

  return {
    edges,
    portsByNodeId: finalizePortsByNodeId(portDraftsByNodeId),
  };
}

export function buildSystemFlowDiagramLayoutInput(
  data: SystemFlowGraphData,
  viewMode: SystemFlowViewMode,
): SystemFlowDiagramLayout {
  const items = [
    ...buildRouteItems(data.nodes, viewMode),
    ...buildTerminalItems(data.nodes, viewMode),
  ].sort((left, right) => left.sortKey.localeCompare(right.sortKey) || left.id.localeCompare(right.id));
  const segmentById = new Map(data.segments.map((segment) => [segment.id, segment]));
  const sectorGroupBySegmentId = new Map<string, SystemFlowSectorGroup>();
  const sectorGroups = new Map<string, SystemFlowSectorGroup>();
  const itemsBySegment = new Map<string, DiagramItem[]>();
  const sourceNodeToDiagramNode = new Map<string, string>();

  for (const segment of data.segments) {
    const sectorGroup = sectorGroupForSegment(segment);
    sectorGroupBySegmentId.set(segment.id, sectorGroup);
    sectorGroups.set(sectorGroup.id, sectorGroup);
  }

  for (const item of items) {
    const segmentItems = itemsBySegment.get(item.segmentId) ?? [];
    segmentItems.push(item);
    itemsBySegment.set(item.segmentId, segmentItems);

    for (const sourceNodeId of item.sourceNodeIds) {
      sourceNodeToDiagramNode.set(sourceNodeId, item.id);
    }
  }

  const diagramNodes: SystemFlowDiagramNode[] = [];
  const sortedSectorGroups = Array.from(sectorGroups.values()).sort((left, right) => {
    return left.sortOrder - right.sortOrder
      || left.label.localeCompare(right.label)
      || left.id.localeCompare(right.id);
  });

  for (const sectorGroup of sortedSectorGroups) {
    const sectorSegments = data.segments.filter((segment) => sectorGroupBySegmentId.get(segment.id)?.id === sectorGroup.id);
    const selected = sectorSegments.some((segment) => {
      return (itemsBySegment.get(segment.id) ?? []).some((item) => item.node.data.selected);
    });

    diagramNodes.push({
      id: sectorNodeId(sectorGroup.id),
      type: SYSTEM_FLOW_SECTOR_NODE_TYPE,
      position: { x: 0, y: 0 },
      data: {
        kind: 'sector',
        label: sectorGroup.label,
        role: 'system group',
        color: sectorGroup.color,
        selected,
        muted: viewMode === 'solved' ? !selected : false,
        sectorId: sectorGroup.id,
        hiddenCount: sectorSegments.length,
      },
      draggable: true,
      selectable: true,
      focusable: false,
    });
  }

  for (const segment of data.segments) {
    const segmentItems = itemsBySegment.get(segment.id) ?? [];
    const groupNodeId = segmentNodeId(segment.id);
    const sectorGroup = sectorGroupBySegmentId.get(segment.id);
    const parentId = sectorGroup ? sectorNodeId(sectorGroup.id) : undefined;

    if (segment.collapsed) {
      const selected = segmentItems.some((item) => item.node.data.selected);
      diagramNodes.push({
        id: groupNodeId,
        type: SYSTEM_FLOW_SEGMENT_NODE_TYPE,
        position: { x: 0, y: 0 },
        parentId,
        extent: parentId ? 'parent' : undefined,
        width: COLLAPSED_SEGMENT_WIDTH,
        height: COLLAPSED_SEGMENT_HEIGHT,
        data: {
          kind: 'segment',
          label: segment.label,
          role: segmentRoleLabel(segment),
          color: segmentColor(segment),
          selected,
          muted: viewMode === 'solved' ? !selected : false,
          segmentId: segment.id,
          collapsed: true,
          hiddenCount: segmentItems.length,
        },
        draggable: true,
        selectable: true,
        focusable: false,
      });

      for (const item of segmentItems) {
        for (const sourceNodeId of item.sourceNodeIds) {
          sourceNodeToDiagramNode.set(sourceNodeId, groupNodeId);
        }
      }
      continue;
    }

    diagramNodes.push({
      id: groupNodeId,
      type: SYSTEM_FLOW_SEGMENT_NODE_TYPE,
      position: { x: 0, y: 0 },
      parentId,
      extent: parentId ? 'parent' : undefined,
      data: {
        kind: 'segment',
        label: segment.label,
        role: segmentRoleLabel(segment),
        color: segmentColor(segment),
        selected: segmentItems.some((item) => item.node.data.selected),
        muted: false,
        segmentId: segment.id,
        collapsed: false,
        hiddenCount: segmentItems.length,
      },
      draggable: true,
      selectable: true,
      focusable: false,
    });

    for (const item of segmentItems) {
      diagramNodes.push({
        ...item.node,
        parentId: groupNodeId,
        extent: 'parent',
      });
    }
  }

  for (const item of items) {
    if (segmentById.get(item.segmentId)?.collapsed) {
      continue;
    }

    for (const sourceNodeId of item.sourceNodeIds) {
      sourceNodeToDiagramNode.set(sourceNodeId, item.id);
    }
  }

  const { edges, portsByNodeId } = buildDiagramEdges(data, sourceNodeToDiagramNode, viewMode, diagramNodes);

  return {
    nodes: diagramNodes.map((node) => {
      const ports = portsByNodeId.get(node.id);

      if (!ports || ports.length === 0) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          ports,
        },
      };
    }),
    edges,
  };
}

function elkPortForDiagramPort(nodeId: string, port: SystemFlowDiagramPort): ElkPort {
  return {
    id: elkPortId(nodeId, port.id),
    width: PORT_SIZE,
    height: PORT_SIZE,
    layoutOptions: {
      'org.eclipse.elk.port.side': port.side === 'left' ? 'WEST' : 'EAST',
      'org.eclipse.elk.port.index': `${port.index}`,
    },
  };
}

function elkNodeForDiagramNode(node: SystemFlowDiagramNode): ElkNode {
  const ports = node.data.ports ?? [];

  return {
    id: node.id,
    width: Number(node.width ?? node.style?.width ?? TERMINAL_NODE_WIDTH),
    height: Number(node.height ?? node.style?.height ?? TERMINAL_NODE_HEIGHT),
    ports: ports.map((port) => elkPortForDiagramPort(node.id, port)),
    layoutOptions: ports.length > 0
      ? {
        'org.eclipse.elk.portConstraints': 'FIXED_ORDER',
        'org.eclipse.elk.spacing.portPort': '10',
      }
      : undefined,
  };
}

function compoundLayoutOptions(node: SystemFlowDiagramNode): Record<string, string> {
  if (node.data.kind === 'sector') {
    return {
      'elk.padding': '[top=50,left=22,bottom=22,right=22]',
      'elk.spacing.nodeNode': '34',
      'elk.layered.spacing.nodeNodeBetweenLayers': '88',
    };
  }

  return {
    'elk.padding': '[top=54,left=18,bottom=18,right=18]',
    'elk.spacing.nodeNode': '18',
  };
}

function elkNodeForTree(
  node: SystemFlowDiagramNode,
  childrenByParent: Map<string, SystemFlowDiagramNode[]>,
): ElkNode {
  const children = childrenByParent.get(node.id);

  if (!children || children.length === 0) {
    return elkNodeForDiagramNode(node);
  }

  return {
    id: node.id,
    children: children.map((childNode) => elkNodeForTree(childNode, childrenByParent)),
    layoutOptions: compoundLayoutOptions(node),
  };
}

function toElkGraph(layout: SystemFlowDiagramLayout): ElkNode {
  const childrenByParent = new Map<string, SystemFlowDiagramNode[]>();
  const topLevelNodes: SystemFlowDiagramNode[] = [];

  for (const node of layout.nodes) {
    if (node.parentId) {
      const children = childrenByParent.get(node.parentId) ?? [];
      children.push(node);
      childrenByParent.set(node.parentId, children);
    } else {
      topLevelNodes.push(node);
    }
  }

  const children = topLevelNodes.map((node) => elkNodeForTree(node, childrenByParent));
  const edges: ElkExtendedEdge[] = layout.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.sourceHandle ? elkPortId(edge.source, edge.sourceHandle) : edge.source],
    targets: [edge.targetHandle ? elkPortId(edge.target, edge.targetHandle) : edge.target],
  }));

  return {
    id: 'system-flow-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '44',
      'elk.spacing.componentComponent': '68',
      'elk.layered.spacing.nodeNodeBetweenLayers': '128',
      'elk.layered.spacing.edgeNodeBetweenLayers': '28',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children,
    edges,
  };
}

function collectElkNodes(node: ElkNode, byId: Map<string, ElkNode>) {
  byId.set(node.id, node);

  for (const child of node.children ?? []) {
    collectElkNodes(child, byId);
  }
}

function collectElkPortOffsets(node: ElkNode, byNodePortId: Map<string, number>) {
  for (const port of node.ports ?? []) {
    const prefix = `${node.id}:`;
    const portId = port.id.startsWith(prefix) ? port.id.slice(prefix.length) : port.id;
    const portCenterY = (port.y ?? 0) + (port.height ?? PORT_SIZE) / 2;

    if (Number.isFinite(portCenterY)) {
      byNodePortId.set(`${node.id}::${portId}`, portCenterY);
    }
  }

  for (const child of node.children ?? []) {
    collectElkPortOffsets(child, byNodePortId);
  }
}

function applyElkLayout(layout: SystemFlowDiagramLayout, elkGraph: ElkNode): SystemFlowDiagramLayout {
  const elkNodesById = new Map<string, ElkNode>();
  const elkPortOffsetsByNodePortId = new Map<string, number>();
  collectElkNodes(elkGraph, elkNodesById);
  collectElkPortOffsets(elkGraph, elkPortOffsetsByNodePortId);

  return {
    nodes: layout.nodes.map((node) => {
      const elkNode = elkNodesById.get(node.id);

      if (!elkNode) {
        return node;
      }

      return {
        ...node,
        position: {
          x: elkNode.x ?? 0,
          y: elkNode.y ?? 0,
        },
        style: {
          ...node.style,
          width: elkNode.width ?? node.width,
          height: elkNode.height ?? node.height,
        },
        data: {
          ...node.data,
          ports: node.data.ports?.map((port) => ({
            ...port,
            offsetY: elkPortOffsetsByNodePortId.get(`${node.id}::${port.id}`) ?? port.offsetY,
          })),
        },
      };
    }),
    edges: layout.edges,
  };
}

function fallbackPortOffset(port: SystemFlowDiagramPort, ports: SystemFlowDiagramPort[], nodeHeight: number): number {
  const portsOnSide = ports.filter((candidate) => candidate.side === port.side);
  const index = portsOnSide.findIndex((candidate) => candidate.id === port.id);
  const resolvedIndex = index >= 0 ? index : port.index;

  return ((resolvedIndex + 1) / (portsOnSide.length + 1)) * nodeHeight;
}

function applyFallbackPortOffsets(layout: SystemFlowDiagramLayout): SystemFlowDiagramLayout {
  return {
    nodes: layout.nodes.map((node) => {
      const ports = node.data.ports;

      if (!ports || ports.length === 0) {
        return node;
      }

      const nodeHeight = Number(node.height ?? node.style?.height ?? TERMINAL_NODE_HEIGHT);

      return {
        ...node,
        data: {
          ...node.data,
          ports: ports.map((port) => ({
            ...port,
            offsetY: port.offsetY ?? fallbackPortOffset(port, ports, nodeHeight),
          })),
        },
      };
    }),
    edges: layout.edges,
  };
}

export async function layoutSystemFlowDiagram(
  data: SystemFlowGraphData,
  viewMode: SystemFlowViewMode,
): Promise<SystemFlowDiagramLayout> {
  const layoutInput = buildSystemFlowDiagramLayoutInput(data, viewMode);

  try {
    const elkGraph = await (await getElk()).layout(toElkGraph(layoutInput));
    return applyElkLayout(layoutInput, elkGraph);
  } catch {
    return applyFallbackPortOffsets(layoutInput);
  }
}
