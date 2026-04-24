import type { Edge, Node } from '@xyflow/react';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type ElkConstructor from 'elkjs/lib/elk.bundled.js';
import { getPresentation } from '../../data/chartPresentation.ts';
import type {
  SystemFlowEdge,
  SystemFlowGraphData,
  SystemFlowNode,
  SystemFlowSegment,
  SystemFlowViewMode,
} from '../../results/systemFlowGraph.ts';

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

export interface SystemFlowRouteVariant {
  id: string;
  label: string;
  metric: string;
  selected: boolean;
}

export interface SystemFlowDiagramNodeData extends Record<string, unknown> {
  kind: 'segment' | 'route' | 'terminal';
  label: string;
  role: string;
  color: string;
  selected: boolean;
  muted: boolean;
  segmentId?: string;
  collapsed?: boolean;
  hiddenCount?: number;
  metric?: string;
  shareLabel?: string | null;
  variants?: SystemFlowRouteVariant[];
  variantOverflow?: number;
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
}

export type SystemFlowDiagramNode = Node<
  SystemFlowDiagramNodeData,
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

type ElkInstance = InstanceType<typeof ElkConstructor>;

let elk: ElkInstance | null = null;

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

function routeDiagramNodeId(groupId: string): string {
  return `system-flow-route:${groupId}`;
}

function terminalDiagramNodeId(nodeId: string): string {
  return `system-flow-node:${nodeId}`;
}

function nodeColor(node: SystemFlowNode): string {
  if (node.kind === 'commodity' && node.commodityId) {
    return getPresentation('commodity', node.commodityId, node.label).color;
  }

  if (node.kind === 'route') {
    return getPresentation('state', node.baseStateId ?? node.stateId ?? node.id, node.label).color;
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

function routeNodeHeight(variantCount: number): number {
  if (variantCount <= 0) {
    return 78;
  }

  return 94 + Math.min(variantCount, VISIBLE_VARIANT_LIMIT) * 20 + (variantCount > VISIBLE_VARIANT_LIMIT ? 14 : 0);
}

function routeLabel(primary: SystemFlowNode): string {
  return primary.variantOfBaseRoute ? primary.baseStateLabel ?? primary.label : primary.label;
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
      draggable: false,
      selectable: false,
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
        draggable: false,
        selectable: false,
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

function buildDiagramEdges(
  data: SystemFlowGraphData,
  sourceNodeToDiagramNode: Map<string, string>,
  viewMode: SystemFlowViewMode,
): SystemFlowDiagramEdge[] {
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

  for (const edge of aggregatedEdges) {
    const key = edge.commodityId ?? edge.label;
    maxByCommodity.set(key, Math.max(maxByCommodity.get(key) ?? 0, Math.abs(edge.solvedValue)));
  }

  return aggregatedEdges.map((edge) => {
    const max = maxByCommodity.get(edge.commodityId ?? edge.label) ?? 0;
    const relativeValue = max > 0 ? Math.abs(edge.solvedValue) / max : 0;
    const showLabel = viewMode !== 'topology' && edge.selected && relativeValue >= (viewMode === 'solved' ? 0.22 : 0.34);

    return {
      id: edge.id,
      type: SYSTEM_FLOW_EDGE_TYPE,
      source: edge.source,
      target: edge.target,
      data: {
        label: edge.label,
        metric: formatSystemFlowActivity(edge.solvedValue, edge.unit),
        color: edgeColor(edge),
        selected: edge.selected,
        muted: viewMode === 'solved' ? !edge.selected : viewMode !== 'topology' && !edge.selected,
        width: edgeWidth(edge, maxByCommodity, viewMode),
        showLabel,
      },
      selectable: false,
      focusable: false,
      interactionWidth: 18,
    };
  });
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
  const itemsBySegment = new Map<string, DiagramItem[]>();
  const sourceNodeToDiagramNode = new Map<string, string>();

  for (const item of items) {
    const segmentItems = itemsBySegment.get(item.segmentId) ?? [];
    segmentItems.push(item);
    itemsBySegment.set(item.segmentId, segmentItems);

    for (const sourceNodeId of item.sourceNodeIds) {
      sourceNodeToDiagramNode.set(sourceNodeId, item.id);
    }
  }

  const diagramNodes: SystemFlowDiagramNode[] = [];

  for (const segment of data.segments) {
    const segmentItems = itemsBySegment.get(segment.id) ?? [];
    const groupNodeId = segmentNodeId(segment.id);

    if (segment.collapsed) {
      const selected = segmentItems.some((item) => item.node.data.selected);
      diagramNodes.push({
        id: groupNodeId,
        type: SYSTEM_FLOW_SEGMENT_NODE_TYPE,
        position: { x: 0, y: 0 },
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
        draggable: false,
        selectable: false,
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
      draggable: false,
      selectable: false,
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

  return {
    nodes: diagramNodes,
    edges: buildDiagramEdges(data, sourceNodeToDiagramNode, viewMode),
  };
}

function elkNodeForDiagramNode(node: SystemFlowDiagramNode): ElkNode {
  return {
    id: node.id,
    width: Number(node.width ?? node.style?.width ?? TERMINAL_NODE_WIDTH),
    height: Number(node.height ?? node.style?.height ?? TERMINAL_NODE_HEIGHT),
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

  const children = topLevelNodes.map((node) => {
    const nestedChildren = childrenByParent.get(node.id);

    if (!nestedChildren) {
      return elkNodeForDiagramNode(node);
    }

    return {
      id: node.id,
      children: nestedChildren.map(elkNodeForDiagramNode),
      layoutOptions: {
        'elk.padding': '[top=54,left=18,bottom=18,right=18]',
        'elk.spacing.nodeNode': '18',
      },
    };
  });
  const edges: ElkExtendedEdge[] = layout.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
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

function applyElkLayout(layout: SystemFlowDiagramLayout, elkGraph: ElkNode): SystemFlowDiagramLayout {
  const elkNodesById = new Map<string, ElkNode>();
  collectElkNodes(elkGraph, elkNodesById);

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
  const elkGraph = await (await getElk()).layout(toElkGraph(layoutInput));
  return applyElkLayout(layoutInput, elkGraph);
}
