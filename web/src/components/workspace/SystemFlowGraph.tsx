import React, { useMemo } from 'react';
import { getPresentation } from '../../data/chartPresentation.ts';
import type {
  SystemFlowEdge,
  SystemFlowGraphData,
  SystemFlowNode,
  SystemFlowSegment,
  SystemFlowViewMode,
} from '../../results/systemFlowGraph.ts';

void React;

interface SystemFlowGraphProps {
  availableYears: number[];
  data: SystemFlowGraphData;
  selectedYear: number;
  viewMode: SystemFlowViewMode;
  onCollapsedSegmentIdsChange: (segmentIds: string[]) => void;
  onViewModeChange: (mode: SystemFlowViewMode) => void;
  onYearChange: (year: number) => void;
}

interface RouteRenderItem {
  id: string;
  kind: 'route';
  segmentId: string;
  nodeIds: string[];
  primary: SystemFlowNode;
  routeNodes: SystemFlowNode[];
  activity: number;
  share: number | null;
  selected: boolean;
}

interface NodeRenderItem {
  id: string;
  kind: 'node';
  segmentId: string;
  nodeIds: string[];
  node: SystemFlowNode;
  activity: number;
  share: number | null;
  selected: boolean;
}

type RenderItem = RouteRenderItem | NodeRenderItem;

interface GraphLayout {
  itemsBySegment: Map<string, RenderItem[]>;
  nodePositions: Map<string, { x: number; y: number }>;
}

const VIEW_MODES: Array<{ label: string; mode: SystemFlowViewMode }> = [
  { label: 'Both', mode: 'both' },
  { label: 'Topology', mode: 'topology' },
  { label: 'Solved', mode: 'solved' },
];

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

function formatActivity(value: number, unit: string | undefined): string {
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
}

function formatShare(value: number | null): string | null {
  return value == null ? null : `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

function segmentColumn(segment: SystemFlowSegment): number {
  switch (segment.role) {
    case 'exogenous_supply':
      return 0;
    case 'conversion':
      return 1;
    case 'end_use':
    case 'optional_activity':
      return 2;
  }
}

function itemX(item: RenderItem, segment: SystemFlowSegment): number {
  if (segment.role === 'exogenous_supply') {
    return 8;
  }

  if (segment.role === 'conversion') {
    return item.kind === 'route' ? 42 : 55;
  }

  return item.kind === 'route' ? 78 : 94;
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

function edgeColor(edge: SystemFlowEdge): string {
  if (edge.kind === 'input' && edge.commodityId) {
    return getPresentation('commodity', edge.commodityId, edge.label).color;
  }

  if (edge.kind === 'external_demand' && edge.commodityId) {
    return getPresentation('commodity', edge.commodityId, edge.label).color;
  }

  if (edge.commodityId) {
    return getPresentation('output', edge.commodityId, edge.label).color;
  }

  return '#64748b';
}

function buildRouteRenderItems(nodes: SystemFlowNode[]): RenderItem[] {
  const routeGroups = new Map<string, SystemFlowNode[]>();
  const items: RenderItem[] = [];

  for (const node of nodes) {
    if (node.kind !== 'route') {
      items.push({
        id: `node:${node.id}`,
        kind: 'node',
        segmentId: node.segmentId,
        nodeIds: [node.id],
        node,
        activity: node.activity,
        share: node.share,
        selected: node.selected,
      });
      continue;
    }

    const groupId = node.variantGroupId ?? node.id;
    const group = routeGroups.get(groupId) ?? [];
    group.push(node);
    routeGroups.set(groupId, group);
  }

  for (const [groupId, routeNodes] of routeGroups) {
    const sortedRouteNodes = [...routeNodes].sort((left, right) => {
      if (left.variantOfBaseRoute !== right.variantOfBaseRoute) {
        return left.variantOfBaseRoute ? 1 : -1;
      }

      return (left.sortKey ?? left.label).localeCompare(right.sortKey ?? right.label)
        || left.id.localeCompare(right.id);
    });
    const primary = sortedRouteNodes.find((node) => !node.variantOfBaseRoute) ?? sortedRouteNodes[0];
    const shares = sortedRouteNodes
      .map((node) => node.share)
      .filter((share): share is number => share != null);
    const activity = sortedRouteNodes.reduce((total, node) => total + node.activity, 0);

    items.push({
      id: `route:${groupId}`,
      kind: 'route',
      segmentId: primary.segmentId,
      nodeIds: sortedRouteNodes.map((node) => node.id),
      primary,
      routeNodes: sortedRouteNodes,
      activity,
      share: shares.length > 0 ? shares.reduce((total, share) => total + share, 0) : null,
      selected: sortedRouteNodes.some((node) => node.selected),
    });
  }

  return items.sort((left, right) => {
    const leftKey = left.kind === 'route'
      ? left.primary.sortKey ?? left.primary.label
      : left.node.sortKey ?? left.node.label;
    const rightKey = right.kind === 'route'
      ? right.primary.sortKey ?? right.primary.label
      : right.node.sortKey ?? right.node.label;

    return left.segmentId.localeCompare(right.segmentId)
      || leftKey.localeCompare(rightKey)
      || left.id.localeCompare(right.id);
  });
}

function buildLayout(data: SystemFlowGraphData): GraphLayout {
  const segmentById = new Map(data.segments.map((segment) => [segment.id, segment]));
  const items = buildRouteRenderItems(data.nodes);
  const itemsBySegment = new Map<string, RenderItem[]>();
  const itemsByColumn = new Map<number, RenderItem[]>();

  for (const item of items) {
    const segment = segmentById.get(item.segmentId);

    if (!segment) {
      continue;
    }

    const segmentItems = itemsBySegment.get(item.segmentId) ?? [];
    segmentItems.push(item);
    itemsBySegment.set(item.segmentId, segmentItems);

    if (segment.collapsed) {
      continue;
    }

    const column = segmentColumn(segment);
    const columnItems = itemsByColumn.get(column) ?? [];
    columnItems.push(item);
    itemsByColumn.set(column, columnItems);
  }

  const nodePositions = new Map<string, { x: number; y: number }>();

  for (const [column, columnItems] of itemsByColumn) {
    void column;
    const itemCount = columnItems.length;

    columnItems.forEach((item, index) => {
      const segment = segmentById.get(item.segmentId);

      if (!segment) {
        return;
      }

      const position = {
        x: itemX(item, segment),
        y: ((index + 1) / (itemCount + 1)) * 100,
      };

      for (const nodeId of item.nodeIds) {
        nodePositions.set(nodeId, position);
      }
    });
  }

  return { itemsBySegment, nodePositions };
}

function shouldRenderEdge(edge: SystemFlowEdge, viewMode: SystemFlowViewMode): boolean {
  if (viewMode === 'solved') {
    return edge.selected;
  }

  return edge.possible;
}

function edgeWidth(edge: SystemFlowEdge, maxByCommodity: Map<string, number>, viewMode: SystemFlowViewMode): number {
  if (viewMode === 'topology' || !edge.selected) {
    return 1.4;
  }

  const max = maxByCommodity.get(edge.commodityId ?? edge.label) ?? 0;
  const share = max > 0 ? Math.abs(edge.solvedValue) / max : 0;
  return 2 + share * 4;
}

function renderRouteItem(item: RouteRenderItem, viewMode: SystemFlowViewMode) {
  const primary = item.primary;
  const share = formatShare(item.share);
  const routeLabel = primary.variantOfBaseRoute
    ? primary.baseStateLabel ?? primary.label
    : primary.label;
  const variants = item.routeNodes.filter((node) => {
    return item.routeNodes.length > 1 || node.variantOfBaseRoute;
  });

  return (
    <article
      key={item.id}
      className={`system-flow-route${item.selected ? ' system-flow-route--selected' : ' system-flow-route--muted'}${viewMode === 'topology' ? ' system-flow-route--topology' : ''}`}
      style={{ '--system-flow-node-color': nodeColor(primary) } as React.CSSProperties}
    >
      <div className="system-flow-route__header">
        <span className="system-flow-route__label">{routeLabel}</span>
        <span className={`system-flow-route__status system-flow-route__status--${primary.role}`}>
          {primary.role}
        </span>
      </div>
      <div className="system-flow-route__metrics">
        <span>{formatActivity(item.activity, primary.unit)}</span>
        {share ? <span>{share}</span> : null}
      </div>
      {variants.length > 0 ? (
        <div className="system-flow-route__variants" aria-label={`${primary.label} variants`}>
          {variants.map((variant) => (
            <div
              key={variant.id}
              className={`system-flow-route__variant${variant.selected ? ' system-flow-route__variant--selected' : ''}`}
            >
              <span>{variant.label}</span>
              <span>{formatActivity(variant.activity, variant.unit)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function renderNodeItem(item: NodeRenderItem) {
  const node = item.node;
  const metric = node.activity > 0 ? formatActivity(node.activity, node.unit) : node.role;

  return (
    <div
      key={item.id}
      className={`system-flow-node system-flow-node--${node.kind}${item.selected ? ' system-flow-node--selected' : ''}`}
      style={{ '--system-flow-node-color': nodeColor(node) } as React.CSSProperties}
    >
      <span className="system-flow-node__label">{node.label}</span>
      <span className="system-flow-node__metric">{metric}</span>
    </div>
  );
}

export default function SystemFlowGraph({
  availableYears,
  data,
  selectedYear,
  viewMode,
  onCollapsedSegmentIdsChange,
  onViewModeChange,
  onYearChange,
}: SystemFlowGraphProps) {
  const layout = useMemo(() => buildLayout(data), [data]);
  const maxByCommodity = useMemo(() => {
    const lookup = new Map<string, number>();

    for (const edge of data.edges) {
      const key = edge.commodityId ?? edge.label;
      lookup.set(key, Math.max(lookup.get(key) ?? 0, Math.abs(edge.solvedValue)));
    }

    return lookup;
  }, [data.edges]);
  const collapsedSegmentIds = useMemo(
    () => new Set(data.segments.filter((segment) => segment.collapsed).map((segment) => segment.id)),
    [data.segments],
  );

  function toggleSegment(segmentId: string) {
    const next = new Set(collapsedSegmentIds);

    if (next.has(segmentId)) {
      next.delete(segmentId);
    } else {
      next.add(segmentId);
    }

    onCollapsedSegmentIdsChange(Array.from(next).sort());
  }

  return (
    <section className="system-flow-panel" aria-label="System Flow">
      <div className="system-flow-panel__header">
        <div>
          <span className="configuration-badge">System Flow</span>
          <h2>System flow</h2>
          <p className="workspace-comparison-note">
            {data.summary.selectedRouteCount} solved routes of {data.summary.routeCount} possible routes in {data.year}.
          </p>
        </div>
        <div className="system-flow-controls">
          <label className="system-flow-control">
            <span>Year</span>
            <select
              className="configuration-input"
              value={selectedYear}
              onChange={(event) => onYearChange(Number(event.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <div className="system-flow-mode" role="group" aria-label="System flow view mode">
            {VIEW_MODES.map((entry) => (
              <button
                key={entry.mode}
                type="button"
                className={`system-flow-mode__button${viewMode === entry.mode ? ' system-flow-mode__button--active' : ''}`}
                onClick={() => onViewModeChange(entry.mode)}
                aria-pressed={viewMode === entry.mode}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`system-flow-graph system-flow-graph--${viewMode}`}>
        <svg className="system-flow-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {data.edges.filter((edge) => shouldRenderEdge(edge, viewMode)).map((edge) => {
            const source = layout.nodePositions.get(edge.sourceId);
            const target = layout.nodePositions.get(edge.targetId);

            if (!source || !target) {
              return null;
            }

            const controlDistance = Math.max(8, Math.abs(target.x - source.x) * 0.45);
            const path = [
              `M ${source.x} ${source.y}`,
              `C ${source.x + controlDistance} ${source.y}`,
              `${target.x - controlDistance} ${target.y}`,
              `${target.x} ${target.y}`,
            ].join(' ');
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            const showLabel = edge.selected && viewMode !== 'topology';

            return (
              <g
                key={edge.id}
                className={`system-flow-edge${edge.selected ? ' system-flow-edge--selected' : ' system-flow-edge--muted'}`}
                style={{ '--system-flow-edge-color': edgeColor(edge) } as React.CSSProperties}
              >
                <path
                  d={path}
                  pathLength={1}
                  strokeWidth={edgeWidth(edge, maxByCommodity, viewMode)}
                />
                {showLabel ? (
                  <text x={midX} y={midY}>
                    {formatActivity(edge.solvedValue, edge.unit)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <div className="system-flow-columns">
          {data.segments.map((segment) => {
            const segmentItems = layout.itemsBySegment.get(segment.id) ?? [];
            const segmentRoleLabel = segment.role.replaceAll('_', ' ');

            return (
              <section
                key={segment.id}
                className={`system-flow-segment system-flow-segment--${segment.role}${segment.collapsed ? ' system-flow-segment--collapsed' : ''}`}
                style={{ gridColumn: segmentColumn(segment) + 1 }}
              >
                <div className="system-flow-segment__header">
                  <div>
                    <h3>{segment.label}</h3>
                    <span>{segmentRoleLabel}</span>
                  </div>
                  <button
                    type="button"
                    className="system-flow-segment__toggle"
                    onClick={() => toggleSegment(segment.id)}
                    aria-expanded={!segment.collapsed}
                    aria-label={`${segment.collapsed ? 'Expand' : 'Collapse'} ${segment.label}`}
                  >
                    {segment.collapsed ? '+' : '-'}
                  </button>
                </div>
                {!segment.collapsed ? (
                  <div className="system-flow-segment__body">
                    {segmentItems.map((item) => (
                      item.kind === 'route' ? renderRouteItem(item, viewMode) : renderNodeItem(item)
                    ))}
                  </div>
                ) : (
                  <p className="system-flow-segment__collapsed-count">
                    {segmentItems.length} hidden objects
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <div className="system-flow-summary" aria-label="System flow summary">
        <span>{data.summary.selectedEdgeCount} active flows</span>
        <span>{data.summary.zeroActivityRouteCount} zero-activity routes visible</span>
        <span>{data.summary.externalDemandEdgeCount} residual demand edges</span>
      </div>
    </section>
  );
}
