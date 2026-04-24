import React, { useEffect, useMemo, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
  type NodeProps,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import type {
  SystemFlowGraphData,
  SystemFlowViewMode,
} from '../../results/systemFlowGraph.ts';
import {
  SYSTEM_FLOW_EDGE_TYPE,
  SYSTEM_FLOW_ROUTE_NODE_TYPE,
  SYSTEM_FLOW_SEGMENT_NODE_TYPE,
  SYSTEM_FLOW_TERMINAL_NODE_TYPE,
  layoutSystemFlowDiagram,
  type SystemFlowDiagramEdge,
  type SystemFlowDiagramEdgeData,
  type SystemFlowDiagramLayout,
  type SystemFlowDiagramNode,
} from './systemFlowGraphLayout.ts';

void React;

export interface SystemFlowGraphCanvasProps {
  collapsedSegmentIds: Set<string>;
  data: SystemFlowGraphData;
  onToggleSegment: (segmentId: string) => void;
  viewMode: SystemFlowViewMode;
}

function SystemFlowSegmentNode({ data }: NodeProps<SystemFlowDiagramNode>) {
  const segmentId = data.segmentId;
  const collapsed = Boolean(data.collapsed);

  return (
    <div
      className={`system-flow-segment-node${collapsed ? ' system-flow-segment-node--collapsed' : ''}${data.muted ? ' system-flow-node--muted' : ''}`}
      style={{ '--system-flow-node-color': data.color } as React.CSSProperties}
    >
      {collapsed ? <Handle type="target" position={Position.Left} /> : null}
      <div className="system-flow-segment-node__header">
        <div>
          <span className="system-flow-segment-node__label">{data.label}</span>
          <span className="system-flow-segment-node__role">{data.role}</span>
        </div>
        {segmentId ? (
          <button
            type="button"
            className="system-flow-segment-node__toggle nodrag nopan"
            onClick={(event) => {
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
      {collapsed ? <Handle type="source" position={Position.Right} /> : null}
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
      <Handle type="target" position={Position.Left} />
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
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SystemFlowTerminalNode({ data }: NodeProps<SystemFlowDiagramNode>) {
  return (
    <div
      className={`system-flow-diagram-node system-flow-diagram-node--terminal system-flow-diagram-node--${data.role}${data.selected ? ' system-flow-diagram-node--selected' : ''}${data.muted ? ' system-flow-node--muted' : ''}`}
      style={{ '--system-flow-node-color': data.color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} />
      <div className="system-flow-diagram-node__body">
        <span className="system-flow-diagram-node__label">{data.label}</span>
        <span className="system-flow-diagram-node__metrics">{data.metric}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SystemFlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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
  };
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        className={`system-flow-diagram-edge${edgeData.selected ? ' system-flow-diagram-edge--selected' : ''}${edgeData.muted ? ' system-flow-diagram-edge--muted' : ''}`}
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
  [SYSTEM_FLOW_SEGMENT_NODE_TYPE]: SystemFlowSegmentNode,
  [SYSTEM_FLOW_ROUTE_NODE_TYPE]: SystemFlowRouteNode,
  [SYSTEM_FLOW_TERMINAL_NODE_TYPE]: SystemFlowTerminalNode,
} satisfies NodeTypes;

const EDGE_TYPES = {
  [SYSTEM_FLOW_EDGE_TYPE]: SystemFlowEdge,
} satisfies EdgeTypes;

function useSystemFlowLayout(data: SystemFlowGraphData, viewMode: SystemFlowViewMode) {
  const [layout, setLayout] = useState<SystemFlowDiagramLayout>(() => ({
    nodes: [],
    edges: [],
  }));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    layoutSystemFlowDiagram(data, viewMode)
      .then((nextLayout) => {
        if (cancelled) {
          return;
        }

        setLayout(nextLayout);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        console.error('Failed to layout system flow graph', error);
        setLayout({ nodes: [], edges: [] });
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data, viewMode]);

  return { layout, isLoading };
}

function SystemFlowCanvasInner({
  data,
  viewMode,
  collapsedSegmentIds,
  onToggleSegment,
}: SystemFlowGraphCanvasProps) {
  const { fitView } = useReactFlow<SystemFlowDiagramNode, SystemFlowDiagramEdge>();
  const { layout, isLoading } = useSystemFlowLayout(data, viewMode);
  const nodes = useMemo<SystemFlowDiagramNode[]>(() => {
    return layout.nodes.map((node) => {
      if (node.type !== SYSTEM_FLOW_SEGMENT_NODE_TYPE) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          onToggleSegment,
        },
      };
    });
  }, [layout.nodes, onToggleSegment]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const focusNodes = nodes.filter((node) => {
        return node.data.selected && (node.type !== SYSTEM_FLOW_SEGMENT_NODE_TYPE || Boolean(node.data.collapsed));
      });

      fitView({
        nodes: focusNodes.length > 0 ? focusNodes.map((node) => ({ id: node.id })) : undefined,
        padding: 0.16,
        minZoom: 0.42,
        maxZoom: 0.82,
        duration: 240,
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [collapsedSegmentIds, fitView, nodes, viewMode]);

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
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: 0.42, maxZoom: 0.82 }}
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
