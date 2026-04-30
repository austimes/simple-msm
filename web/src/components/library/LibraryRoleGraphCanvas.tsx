import React, { useEffect, useMemo, useState } from 'react';
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

async function layoutLibraryRoleGraph(
  data: RoleLibraryGraphData,
): Promise<LibraryRoleGraphLayout> {
  const elkInstance = await getElk();
  const elkNodes: ElkNode[] = data.nodes.map((node) => {
    const size = nodeSize(node);
    return {
      id: node.id,
      width: size.width,
      height: size.height,
    };
  });
  const elkEdges: ElkExtendedEdge[] = data.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));
  const graph = await elkInstance.layout({
    id: 'library-role-graph',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '42',
      'elk.layered.spacing.nodeNodeBetweenLayers': '72',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: elkNodes,
    edges: elkEdges,
  });
  const positionById = new Map((graph.children ?? []).map((node) => [
    node.id,
    { x: node.x ?? 0, y: node.y ?? 0 },
  ] as const));
  return {
    nodes: data.nodes.map((node) => ({
      id: node.id,
      type: node.kind === 'role'
        ? ROLE_NODE_TYPE
        : node.kind === 'representation'
          ? REPRESENTATION_NODE_TYPE
          : METHOD_NODE_TYPE,
      position: positionById.get(node.id) ?? { x: 0, y: 0 },
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

function stopGraphInteraction(event: React.PointerEvent | React.MouseEvent) {
  event.stopPropagation();
}

function LibraryGraphNode({ data }: NodeProps<LibraryRoleGraphNode>) {
  const expandable = data.kind !== 'method';
  return (
    <button
      type="button"
      className={`library-role-node library-role-node--${data.kind}${data.expanded ? ' library-role-node--expanded' : ''}${data.isDefault ? ' library-role-node--default' : ''}`}
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

export default function LibraryRoleGraphCanvas({
  data,
  expandedNodeIds,
  onToggleNode,
  onSelectNode,
}: LibraryRoleGraphCanvasProps) {
  const fitViewKey = useMemo(
    () => `${data.nodes.map((node) => node.id).join('|')}::${Array.from(expandedNodeIds).sort().join('|')}`,
    [data.nodes, expandedNodeIds],
  );
  const [layoutState, setLayoutState] = useState<{
    key: string;
    layout: LibraryRoleGraphLayout;
  }>({ key: '', layout: { nodes: [], edges: [] } });
  const isLoading = layoutState.key !== fitViewKey;
  const layout = layoutState.layout;

  useEffect(() => {
    let cancelled = false;
    layoutLibraryRoleGraph(data)
      .then((nextLayout) => {
        if (!cancelled) {
          setLayoutState({ key: fitViewKey, layout: nextLayout });
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to layout library role graph', error);
        if (!cancelled) {
          setLayoutState({ key: fitViewKey, layout: { nodes: [], edges: [] } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data, fitViewKey]);

  const nodes = useMemo(() => layout.nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onToggle: onToggleNode,
      onSelect: onSelectNode,
    },
  })), [layout.nodes, onSelectNode, onToggleNode]);

  return (
    <GraphCanvasShell<LibraryRoleGraphNode, LibraryRoleGraphEdge>
      className="library-role-graph-canvas"
      nodes={nodes}
      edges={layout.edges}
      nodeTypes={NODE_TYPES}
      isLoading={isLoading}
      loadingLabel="Laying out role graph"
      fitViewKey={fitViewKey}
      fitViewPadding={0.2}
      fitViewMaxZoom={0.95}
    />
  );
}
