import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps, type NodeTypes } from '@xyflow/react';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type ElkConstructor from 'elkjs/lib/elk.bundled.js';
import GraphCanvasShell from '../graph/GraphCanvasShell.tsx';
import type {
  RoleLibraryGraphData,
  RoleLibraryGraphNode as RoleLibraryGraphModelNode,
} from '../../data/roleLibraryModel.ts';

void React;

const ROLE_NODE_TYPE = 'libraryRole';
const REPRESENTATION_NODE_TYPE = 'libraryRepresentation';
const METHOD_NODE_TYPE = 'libraryMethod';

interface LibraryRoleGraphNodeData extends Record<string, unknown>, RoleLibraryGraphModelNode {
  onToggle: (nodeId: string) => void;
  onSelect: (node: RoleLibraryGraphModelNode) => void;
}

type LibraryRoleGraphNode = Node<
  LibraryRoleGraphNodeData,
  typeof ROLE_NODE_TYPE | typeof REPRESENTATION_NODE_TYPE | typeof METHOD_NODE_TYPE
>;

type LibraryRoleGraphEdge = {
  id: string;
  source: string;
  target: string;
  type?: 'default';
};

interface LibraryRoleGraphLayout {
  nodes: LibraryRoleGraphNode[];
  edges: LibraryRoleGraphEdge[];
}

interface LibraryRoleGraphCanvasProps {
  data: RoleLibraryGraphData;
  expandedNodeIds: Set<string>;
  onToggleNode: (nodeId: string) => void;
  onSelectNode: (node: RoleLibraryGraphModelNode) => void;
}

type ElkInstance = InstanceType<typeof ElkConstructor>;

let elk: ElkInstance | null = null;

async function getElk(): Promise<ElkInstance> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  elk ??= new ELK();
  return elk;
}

function nodeSize(node: RoleLibraryGraphModelNode): { width: number; height: number } {
  if (node.kind === 'role') {
    return { width: 248, height: 106 };
  }
  if (node.kind === 'representation') {
    return { width: 226, height: 92 };
  }
  return { width: 204, height: 78 };
}

function nodeType(
  node: RoleLibraryGraphModelNode,
):
  | typeof ROLE_NODE_TYPE
  | typeof REPRESENTATION_NODE_TYPE
  | typeof METHOD_NODE_TYPE {
  if (node.kind === 'role') return ROLE_NODE_TYPE;
  if (node.kind === 'representation') return REPRESENTATION_NODE_TYPE;
  return METHOD_NODE_TYPE;
}

const ELK_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '42',
  'elk.layered.spacing.nodeNodeBetweenLayers': '72',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
} as const;

async function layoutFullGraph(
  data: RoleLibraryGraphData,
): Promise<Map<string, { x: number; y: number }>> {
  const elkInstance = await getElk();
  const elkNodes: ElkNode[] = data.nodes.map((node) => {
    const size = nodeSize(node);
    return { id: node.id, width: size.width, height: size.height };
  });
  const elkEdges: ElkExtendedEdge[] = data.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));
  const graph = await elkInstance.layout({
    id: 'library-role-graph',
    layoutOptions: { ...ELK_LAYOUT_OPTIONS },
    children: elkNodes,
    edges: elkEdges,
  });
  return new Map((graph.children ?? []).map((node) => [
    node.id,
    { x: node.x ?? 0, y: node.y ?? 0 },
  ] as const));
}

async function layoutSubtreeAnchored(
  data: RoleLibraryGraphData,
  previousPositions: Map<string, { x: number; y: number }>,
  anchorNodeId: string,
  addedNodeIds: ReadonlySet<string>,
): Promise<Map<string, { x: number; y: number }>> {
  const elkInstance = await getElk();
  const subgraphNodeIds = new Set<string>([anchorNodeId, ...addedNodeIds]);
  const elkNodes: ElkNode[] = data.nodes
    .filter((node) => subgraphNodeIds.has(node.id))
    .map((node) => {
      const size = nodeSize(node);
      return { id: node.id, width: size.width, height: size.height };
    });
  const elkEdges: ElkExtendedEdge[] = data.edges
    .filter((edge) => subgraphNodeIds.has(edge.source) && subgraphNodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));
  const graph = await elkInstance.layout({
    id: 'library-role-graph-incremental',
    layoutOptions: { ...ELK_LAYOUT_OPTIONS },
    children: elkNodes,
    edges: elkEdges,
  });
  const subPositions = new Map((graph.children ?? []).map((node) => [
    node.id,
    { x: node.x ?? 0, y: node.y ?? 0 },
  ] as const));

  const anchorBefore = previousPositions.get(anchorNodeId) ?? { x: 0, y: 0 };
  const anchorAfter = subPositions.get(anchorNodeId) ?? { x: 0, y: 0 };
  const dx = anchorBefore.x - anchorAfter.x;
  const dy = anchorBefore.y - anchorAfter.y;

  const merged = new Map(previousPositions);
  for (const id of addedNodeIds) {
    const pos = subPositions.get(id);
    if (pos) {
      merged.set(id, { x: pos.x + dx, y: pos.y + dy });
    }
  }
  return merged;
}

function stopGraphInteraction(event: React.PointerEvent | React.MouseEvent) {
  event.stopPropagation();
}

function LibraryGraphNode({ data }: NodeProps<LibraryRoleGraphNode>) {
  const expandable = data.kind !== 'method';
  const metricClass = data.kind === 'role' && data.emissionsImportanceBand
    ? ` library-role-node--emissions-${data.emissionsImportanceBand}`
    : '';
  return (
    <button
      type="button"
      className={`library-role-node library-role-node--${data.kind}${data.expanded ? ' library-role-node--expanded' : ''}${data.isDefault ? ' library-role-node--default' : ''}${metricClass}`}
      onClick={() => data.onSelect(data)}
      style={{ textAlign: 'left' }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
      <span className="library-role-node__label">{data.label}</span>
      <span className="library-role-node__meta">{data.meta}</span>
      {data.kind === 'role' ? (
        <span className="library-role-node__counts">
          {data.representationCount ?? 0} reps · {data.methodCount ?? 0} methods
        </span>
      ) : null}
      {data.kind === 'representation' && data.isDefault ? (
        <span className="library-role-node__badge">Default</span>
      ) : null}
      {expandable ? (
        <span
          role="button"
          tabIndex={0}
          className="library-role-node__toggle nodrag nopan"
          onPointerDown={stopGraphInteraction}
          onMouseDown={stopGraphInteraction}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data.onToggle(data.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              data.onToggle(data.id);
            }
          }}
          aria-label={`${data.expanded ? 'Collapse' : 'Expand'} ${data.label}`}
        >
          {data.expanded ? '-' : '+'}
        </span>
      ) : null}
    </button>
  );
}

const NODE_TYPES = {
  [ROLE_NODE_TYPE]: LibraryGraphNode,
  [REPRESENTATION_NODE_TYPE]: LibraryGraphNode,
  [METHOD_NODE_TYPE]: LibraryGraphNode,
} satisfies NodeTypes;

function buildLayout(
  data: RoleLibraryGraphData,
  positions: Map<string, { x: number; y: number }>,
): LibraryRoleGraphLayout {
  return {
    nodes: data.nodes.map((node) => ({
      id: node.id,
      type: nodeType(node),
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: {
        ...node,
        onToggle: () => undefined,
        onSelect: () => undefined,
      },
    })),
    edges: data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

export default function LibraryRoleGraphCanvas({
  data,
  expandedNodeIds,
  onToggleNode,
  onSelectNode,
}: LibraryRoleGraphCanvasProps) {
  // fitViewKey tracks only the *identity* of the visible graph, not which
  // nodes are expanded. That way expand/collapse does not trigger an
  // auto-fit (combined with autoFitMode="initial").
  const fitViewKey = useMemo(() => {
    // Use the set of top-level role nodes as the identity. This changes only
    // when filters/search change, not when the user expands.
    return data.nodes
      .filter((node) => node.kind === 'role' && node.activationClass === 'top_level')
      .map((node) => node.id)
      .sort()
      .join('|');
  }, [data.nodes]);

  // A key that uniquely identifies the desired graph state. The layout effect
  // updates `appliedKey` when it has finished computing positions for that
  // exact state. `isLoading` is derived during render rather than via a
  // setState-in-effect, which avoids cascading renders.
  const desiredKey = useMemo(
    () => `${data.nodes.map((node) => node.id).sort().join('|')}::${Array.from(expandedNodeIds).sort().join('|')}`,
    [data.nodes, expandedNodeIds],
  );
  const [layoutState, setLayoutState] = useState<{
    nodes: LibraryRoleGraphNode[];
    edges: LibraryRoleGraphEdge[];
    appliedKey: string;
  }>({ nodes: [], edges: [], appliedKey: '' });
  const isLoading = layoutState.appliedKey !== desiredKey;

  const positionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const previousNodeIdsRef = useRef<Set<string>>(new Set());
  const previousExpandedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const currentNodeIds = new Set(data.nodes.map((node) => node.id));
    const previousNodeIds = previousNodeIdsRef.current;
    const previousExpanded = previousExpandedRef.current;

    const addedNodeIds = new Set<string>();
    for (const id of currentNodeIds) {
      if (!previousNodeIds.has(id)) {
        addedNodeIds.add(id);
      }
    }
    const removedNodeIds = new Set<string>();
    for (const id of previousNodeIds) {
      if (!currentNodeIds.has(id)) {
        removedNodeIds.add(id);
      }
    }

    // Detect expand vs collapse vs full refresh.
    const newlyExpanded: string[] = [];
    const newlyCollapsed: string[] = [];
    for (const id of expandedNodeIds) {
      if (!previousExpanded.has(id)) newlyExpanded.push(id);
    }
    for (const id of previousExpanded) {
      if (!expandedNodeIds.has(id)) newlyCollapsed.push(id);
    }

    const isFirstLayout = positionCacheRef.current.size === 0;
    const isPureCollapse =
      !isFirstLayout
      && newlyCollapsed.length > 0
      && newlyExpanded.length === 0
      && addedNodeIds.size === 0;
    const isPureExpand =
      !isFirstLayout
      && newlyExpanded.length === 1
      && newlyCollapsed.length === 0
      && addedNodeIds.size > 0
      && removedNodeIds.size === 0
      && currentNodeIds.has(newlyExpanded[0])
      && positionCacheRef.current.has(newlyExpanded[0]);

    function commit(positions: Map<string, { x: number; y: number }>): void {
      // Drop cached positions for nodes that are no longer visible so the
      // cache does not grow unbounded across many filter changes.
      const trimmed = new Map<string, { x: number; y: number }>();
      for (const [id, pos] of positions) {
        if (currentNodeIds.has(id)) {
          trimmed.set(id, pos);
        }
      }
      positionCacheRef.current = trimmed;
      previousNodeIdsRef.current = currentNodeIds;
      previousExpandedRef.current = new Set(expandedNodeIds);
      const built = buildLayout(data, trimmed);
      setLayoutState({ ...built, appliedKey: desiredKey });
    }

    function commitEmptyOnError(): void {
      positionCacheRef.current = new Map();
      previousNodeIdsRef.current = currentNodeIds;
      previousExpandedRef.current = new Set(expandedNodeIds);
      setLayoutState({ nodes: [], edges: [], appliedKey: desiredKey });
    }

    if (isPureCollapse) {
      // Keep existing positions, no ELK call needed.
      commit(positionCacheRef.current);
      return () => {
        cancelled = true;
      };
    }

    if (isPureExpand) {
      const anchorId = newlyExpanded[0];
      layoutSubtreeAnchored(data, positionCacheRef.current, anchorId, addedNodeIds)
        .then((merged) => {
          if (!cancelled) commit(merged);
        })
        .catch((error: unknown) => {
          console.error('Failed incremental role graph layout', error);
          if (!cancelled) {
            // Fall back to full layout on error.
            layoutFullGraph(data)
              .then((positions) => {
                if (!cancelled) commit(positions);
              })
              .catch((fullError: unknown) => {
                console.error('Failed full role graph layout fallback', fullError);
                if (!cancelled) commitEmptyOnError();
              });
          }
        });
      return () => {
        cancelled = true;
      };
    }

    // Default path: full layout (first render, filter changes, or other
    // structural changes that aren't a clean single expand/collapse).
    layoutFullGraph(data)
      .then((positions) => {
        if (!cancelled) commit(positions);
      })
      .catch((error: unknown) => {
        console.error('Failed to layout library role graph', error);
        if (!cancelled) commitEmptyOnError();
      });

    return () => {
      cancelled = true;
    };
  }, [data, desiredKey, expandedNodeIds]);

  const nodes = useMemo(() => layoutState.nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onToggle: onToggleNode,
      onSelect: onSelectNode,
    },
  })), [layoutState.nodes, onSelectNode, onToggleNode]);

  return (
    <GraphCanvasShell<LibraryRoleGraphNode, LibraryRoleGraphEdge>
      className="library-role-graph-canvas"
      nodes={nodes}
      edges={layoutState.edges}
      nodeTypes={NODE_TYPES}
      isLoading={isLoading}
      loadingLabel="Laying out role graph"
      fitViewKey={fitViewKey}
      fitViewPadding={0.2}
      fitViewMaxZoom={0.95}
      autoFitMode="initial"
    />
  );
}
