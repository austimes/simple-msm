import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type NodeTypes,
  type XYPosition,
} from '@xyflow/react';

void React;

export interface GraphCanvasShellProps<
  TNode extends Node = Node,
  TEdge extends Edge = Edge,
> {
  className: string;
  nodes: TNode[];
  edges: TEdge[];
  nodeTypes: NodeTypes;
  edgeTypes?: EdgeTypes;
  isLoading?: boolean;
  loadingLabel?: string;
  fitViewKey?: string;
  fitViewPadding?: number;
  minZoom?: number;
  maxZoom?: number;
  fitViewMaxZoom?: number;
  /**
   * Controls when the viewport auto-fits.
   * - 'keyed' (default): re-fits whenever fitViewKey changes.
   * - 'initial': fits only on the first non-empty render and when fitViewKey changes
   *   to a value that represents a brand-new graph identity (e.g. filter changes).
   *   Callers that want to suppress auto-fit on local mutations (expand/collapse)
   *   should keep fitViewKey stable across those mutations.
   */
  autoFitMode?: 'keyed' | 'initial';
}

function GraphCanvasShellInner<
  TNode extends Node = Node,
  TEdge extends Edge = Edge,
>({
  className,
  nodes: layoutNodes,
  edges,
  nodeTypes,
  edgeTypes,
  isLoading = false,
  loadingLabel = 'Laying out graph',
  fitViewKey = '',
  fitViewPadding = 0.16,
  minZoom = 0.32,
  maxZoom = 1.6,
  fitViewMaxZoom = 0.82,
  autoFitMode = 'keyed',
}: GraphCanvasShellProps<TNode, TEdge>) {
  const { fitView } = useReactFlow<TNode, TEdge>();
  const [manualPositions, setManualPositions] = useState(() => new Map<string, XYPosition>());
  const nodes = useMemo<TNode[]>(() => layoutNodes.map((node) => {
    const cachedPosition = manualPositions.get(node.id);
    return cachedPosition
      ? {
          ...node,
          position: cachedPosition,
        }
      : node;
  }), [layoutNodes, manualPositions]);

  const onNodesChange = useCallback((changes: NodeChange<TNode>[]) => {
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

  const lastFitViewKeyRef = useRef<string | null>(null);
  const layoutNodesRef = useRef(layoutNodes);
  layoutNodesRef.current = layoutNodes;

  useEffect(() => {
    if (layoutNodes.length === 0) {
      return;
    }

    if (autoFitMode === 'initial' && lastFitViewKeyRef.current === fitViewKey) {
      return;
    }

    lastFitViewKeyRef.current = fitViewKey;

    const animationFrame = window.requestAnimationFrame(() => {
      const currentNodes = layoutNodesRef.current;
      const focusNodes = currentNodes.filter((node) => !node.parentId);

      fitView({
        nodes: focusNodes.length > 0 ? focusNodes.map((node) => ({ id: node.id })) : undefined,
        padding: fitViewPadding,
        minZoom,
        maxZoom: fitViewMaxZoom,
        duration: 240,
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [autoFitMode, fitView, fitViewKey, fitViewMaxZoom, fitViewPadding, layoutNodes, minZoom]);

  return (
    <div className={className}>
      {isLoading ? (
        <div className="system-flow-graph__loading">{loadingLabel}</div>
      ) : null}
      <ReactFlow<TNode, TEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        nodesDraggable
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: fitViewPadding, minZoom, maxZoom: fitViewMaxZoom }}
        minZoom={minZoom}
        maxZoom={maxZoom}
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

export default function GraphCanvasShell<
  TNode extends Node = Node,
  TEdge extends Edge = Edge,
>(props: GraphCanvasShellProps<TNode, TEdge>) {
  return (
    <ReactFlowProvider>
      <GraphCanvasShellInner {...props} />
    </ReactFlowProvider>
  );
}
