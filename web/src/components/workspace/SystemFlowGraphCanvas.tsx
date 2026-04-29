import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeProps,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type EdgeTypes,
  type XYPosition,
} from '@xyflow/react';
import { getSystemFlowPortEdgePath } from './systemFlowGraphEdges.ts';
import type {
  SystemFlowGraphData,
  SystemFlowViewMode,
} from '../../results/systemFlowGraph.ts';
import {
  SYSTEM_FLOW_EDGE_TYPE,
  SYSTEM_FLOW_ROUTE_NODE_TYPE,
  SYSTEM_FLOW_SECTOR_NODE_TYPE,
  SYSTEM_FLOW_SEGMENT_NODE_TYPE,
  SYSTEM_FLOW_TERMINAL_NODE_TYPE,
  layoutSystemFlowDiagram,
  type SystemFlowDiagramEdge,
  type SystemFlowDiagramEdgeData,
  type SystemFlowDiagramLayout,
  type SystemFlowDiagramNode,
  type SystemFlowDiagramPort,
} from './systemFlowGraphLayout.ts';

void React;

export interface SystemFlowGraphCanvasProps {
  collapsedSegmentIds: Set<string>;
  data: SystemFlowGraphData;
  onToggleSegment: (segmentId: string) => void;
  viewMode: SystemFlowViewMode;
}

function stopGraphInteraction(event: React.PointerEvent | React.MouseEvent) {
  event.stopPropagation();
}

function SystemFlowNodePorts({ ports }: { ports?: SystemFlowDiagramPort[] }) {
  if (!ports || ports.length === 0) {
    return null;
  }

  const portCountsBySide = ports.reduce((counts, port) => {
    counts.set(port.side, (counts.get(port.side) ?? 0) + 1);
    return counts;
  }, new Map<SystemFlowDiagramPort['side'], number>());

  return (
    <>
      {ports.map((port) => {
        const sideCount = portCountsBySide.get(port.side) ?? 1;
        const fallbackTop = `${((port.index + 1) / (sideCount + 1)) * 100}%`;

        return (
          <Handle
            key={port.id}
            id={port.id}
            type={port.side === 'left' ? 'target' : 'source'}
            position={port.side === 'left' ? Position.Left : Position.Right}
            isConnectable={false}
            className={`system-flow-port${port.selected ? ' system-flow-port--selected' : ''}${port.muted ? ' system-flow-port--muted' : ''}`}
            style={{
              '--system-flow-port-color': port.color,
              top: port.offsetY == null ? fallbackTop : `${port.offsetY}px`,
            } as React.CSSProperties}
            aria-label={port.label}
          />
        );
      })}
    </>
  );
}

function SystemFlowSectorNode({ data }: NodeProps<SystemFlowDiagramNode>) {
  return (
    <div
      className={`system-flow-sector-node${data.selected ? ' system-flow-sector-node--selected' : ''}${data.muted ? ' system-flow-node--muted' : ''}`}
      style={{ '--system-flow-node-color': data.color } as React.CSSProperties}
    >
      <div className="system-flow-sector-node__header">
        <span className="system-flow-sector-node__label">{data.label}</span>
        <span className="system-flow-sector-node__meta">
          {data.hiddenCount ?? 0} segments
        </span>
      </div>
    </div>
  );
}

function SystemFlowSegmentNode({ data }: NodeProps<SystemFlowDiagramNode>) {
  const segmentId = data.segmentId;
  const collapsed = Boolean(data.collapsed);

  return (
    <div
      className={`system-flow-segment-node${collapsed ? ' system-flow-segment-node--collapsed' : ''}${data.muted ? ' system-flow-node--muted' : ''}`}
      style={{ '--system-flow-node-color': data.color } as React.CSSProperties}
    >
      <SystemFlowNodePorts ports={collapsed ? data.ports : undefined} />
      <div className="system-flow-segment-node__header">
        <div>
          <span className="system-flow-segment-node__label">{data.label}</span>
          <span className="system-flow-segment-node__role">{data.role}</span>
        </div>
        {segmentId ? (
          <button
            type="button"
            className="system-flow-segment-node__toggle nodrag nopan"
            onPointerDown={stopGraphInteraction}
            onMouseDown={stopGraphInteraction}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              data.onToggleSegment?.(segmentId);
            }}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${data.label}`}
          >
            {collapsed ? '+' : '-'}
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <div className="system-flow-segment-node__meta">
          {data.hiddenCount ?? 0} objects hidden
        </div>
      ) : null}
    </div>
  );
}

function SystemFlowRouteNode({ data }: NodeProps<SystemFlowDiagramNode>) {
  const variants = data.variants ?? [];
  const variantOverflow = Number(data.variantOverflow ?? 0);

  return (
    <div
      className={`system-flow-diagram-node system-flow-diagram-node--route${data.selected ? ' system-flow-diagram-node--selected' : ''}${data.muted ? ' system-flow-node--muted' : ''}`}
      style={{ '--system-flow-node-color': data.color } as React.CSSProperties}
    >
      <SystemFlowNodePorts ports={data.ports} />
      <div className="system-flow-diagram-node__body">
        <div className="system-flow-diagram-node__topline">
          <span className="system-flow-diagram-node__label">{data.label}</span>
          <span className="system-flow-diagram-node__role">{data.role}</span>
        </div>
        <div className="system-flow-diagram-node__metrics">
          <span>{data.metric}</span>
          {data.shareLabel ? <span>{data.shareLabel}</span> : null}
        </div>
        {variants.length > 0 ? (
          <div className="system-flow-diagram-node__variants" aria-label={`${data.label} variants`}>
            {variants.map((variant) => (
              <div
                key={variant.id}
                className={`system-flow-diagram-node__variant${variant.selected ? ' system-flow-diagram-node__variant--selected' : ''}`}
              >
                <span>{variant.label}</span>
                <span>{variant.metric}</span>
              </div>
            ))}
            {variantOverflow > 0 ? (
              <div className="system-flow-diagram-node__variant">
                <span>{variantOverflow} more variants</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SystemFlowTerminalNode({ data }: NodeProps<SystemFlowDiagramNode>) {
  return (
    <div
      className={`system-flow-diagram-node system-flow-diagram-node--terminal system-flow-diagram-node--${data.role}${data.selected ? ' system-flow-diagram-node--selected' : ''}${data.muted ? ' system-flow-node--muted' : ''}`}
      style={{ '--system-flow-node-color': data.color } as React.CSSProperties}
    >
      <SystemFlowNodePorts ports={data.ports} />
      <div className="system-flow-diagram-node__body">
        <span className="system-flow-diagram-node__label">{data.label}</span>
        <span className="system-flow-diagram-node__metrics">{data.metric}</span>
      </div>
    </div>
  );
}

function SystemFlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<SystemFlowDiagramEdge>) {
  const edgeData: SystemFlowDiagramEdgeData = data ?? {
    label: '',
    metric: '',
    color: '#64748b',
    selected: false,
    muted: false,
    width: 1.2,
    showLabel: false,
    sourcePortId: '',
    targetPortId: '',
    laneIndex: 0,
    laneCount: 1,
  };
  const { path: edgePath, labelX, labelY } = getSystemFlowPortEdgePath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    laneIndex: edgeData.laneIndex,
    laneCount: edgeData.laneCount,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        className={`system-flow-diagram-edge system-flow-diagram-edge--port-routed${edgeData.selected ? ' system-flow-diagram-edge--selected' : ''}${edgeData.muted ? ' system-flow-diagram-edge--muted' : ''}`}
        style={{
          stroke: edgeData.color,
          strokeWidth: edgeData.width,
        }}
        interactionWidth={18}
      />
      {edgeData.showLabel ? (
        <EdgeLabelRenderer>
          <div
            className="system-flow-diagram-edge__label"
            aria-hidden="true"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {edgeData.metric}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = {
  [SYSTEM_FLOW_SECTOR_NODE_TYPE]: SystemFlowSectorNode,
  [SYSTEM_FLOW_SEGMENT_NODE_TYPE]: SystemFlowSegmentNode,
  [SYSTEM_FLOW_ROUTE_NODE_TYPE]: SystemFlowRouteNode,
  [SYSTEM_FLOW_TERMINAL_NODE_TYPE]: SystemFlowTerminalNode,
} satisfies NodeTypes;

const EDGE_TYPES = {
  [SYSTEM_FLOW_EDGE_TYPE]: SystemFlowEdge,
} satisfies EdgeTypes;

const EMPTY_SYSTEM_FLOW_LAYOUT: SystemFlowDiagramLayout = {
  nodes: [],
  edges: [],
};

interface SystemFlowLayoutState {
  data: SystemFlowGraphData | null;
  layout: SystemFlowDiagramLayout;
  viewMode: SystemFlowViewMode | null;
}

function useSystemFlowLayout(data: SystemFlowGraphData, viewMode: SystemFlowViewMode) {
  const [layoutState, setLayoutState] = useState<SystemFlowLayoutState>(() => ({
    data: null,
    layout: EMPTY_SYSTEM_FLOW_LAYOUT,
    viewMode: null,
  }));

  useEffect(() => {
    let cancelled = false;

    layoutSystemFlowDiagram(data, viewMode)
      .then((nextLayout) => {
        if (cancelled) {
          return;
        }

        setLayoutState({ data, layout: nextLayout, viewMode });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        console.error('Failed to layout system flow graph', error);
        setLayoutState({ data, layout: EMPTY_SYSTEM_FLOW_LAYOUT, viewMode });
      });

    return () => {
      cancelled = true;
    };
  }, [data, viewMode]);

  return {
    layout: layoutState.layout,
    isLoading: layoutState.data !== data || layoutState.viewMode !== viewMode,
  };
}

function SystemFlowCanvasInner({
  data,
  viewMode,
  collapsedSegmentIds,
  onToggleSegment,
}: SystemFlowGraphCanvasProps) {
  const { fitView } = useReactFlow<SystemFlowDiagramNode, SystemFlowDiagramEdge>();
  const { layout, isLoading } = useSystemFlowLayout(data, viewMode);
  const [manualPositions, setManualPositions] = useState(() => new Map<string, XYPosition>());
  const nodes = useMemo<SystemFlowDiagramNode[]>(() => {
    return layout.nodes.map((node) => {
      const cachedPosition = manualPositions.get(node.id);
      const nextNode = cachedPosition
        ? {
          ...node,
          position: cachedPosition,
        }
        : node;

      if (node.type !== SYSTEM_FLOW_SEGMENT_NODE_TYPE) {
        return nextNode;
      }

      return {
        ...nextNode,
        data: {
          ...nextNode.data,
          onToggleSegment,
        },
      };
    });
  }, [layout.nodes, manualPositions, onToggleSegment]);

  const onNodesChange = useCallback((changes: NodeChange<SystemFlowDiagramNode>[]) => {
    setManualPositions((currentPositions) => {
      let nextPositions: Map<string, XYPosition> | null = null;

      for (const change of changes) {
        if (change.type !== 'position' || !change.position) {
          continue;
        }

        nextPositions ??= new Map(currentPositions);
        nextPositions.set(change.id, change.position);
      }

      return nextPositions ?? currentPositions;
    });
  }, []);

  useEffect(() => {
    if (layout.nodes.length === 0) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const focusNodes = layout.nodes.filter((node) => !node.parentId);

      fitView({
        nodes: focusNodes.length > 0 ? focusNodes.map((node) => ({ id: node.id })) : undefined,
        padding: 0.16,
        minZoom: 0.32,
        maxZoom: 0.82,
        duration: 240,
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [collapsedSegmentIds, fitView, layout.nodes, viewMode]);

  return (
    <div className={`system-flow-graph system-flow-graph--${viewMode}`}>
      {isLoading ? (
        <div className="system-flow-graph__loading">Laying out system flow</div>
      ) : null}
      <ReactFlow<SystemFlowDiagramNode, SystemFlowDiagramEdge>
        nodes={nodes}
        edges={layout.edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        nodesDraggable
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: 0.32, maxZoom: 0.82 }}
        minZoom={0.32}
        maxZoom={1.6}
        panOnScroll
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={28} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function SystemFlowGraphCanvas(props: SystemFlowGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <SystemFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
