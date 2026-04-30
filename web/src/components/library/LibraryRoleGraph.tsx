import React, { Suspense, lazy, useMemo } from 'react';
import type {
  RoleLibraryGraphFilters,
  RoleLibraryGraphNode,
  RoleLibraryModel,
} from '../../data/roleLibraryModel.ts';
import { buildRoleLibraryGraphData } from '../../data/roleLibraryModel.ts';

void React;

const LibraryRoleGraphCanvas = lazy(() => import('./LibraryRoleGraphCanvas.tsx'));

interface LibraryRoleGraphProps {
  model: RoleLibraryModel;
  expandedNodeIds: Set<string>;
  filters: RoleLibraryGraphFilters;
  onExpandedNodeIdsChange: (nodeIds: string[]) => void;
  onSelectNode: (node: RoleLibraryGraphNode) => void;
}

export default function LibraryRoleGraph({
  model,
  expandedNodeIds,
  filters,
  onExpandedNodeIdsChange,
  onSelectNode,
}: LibraryRoleGraphProps) {
  const graphData = useMemo(
    () => buildRoleLibraryGraphData(model, expandedNodeIds, filters),
    [expandedNodeIds, filters, model],
  );

  function toggleNode(nodeId: string): void {
    const nextExpanded = new Set(expandedNodeIds);
    if (nextExpanded.has(nodeId)) {
      nextExpanded.delete(nodeId);
    } else {
      nextExpanded.add(nodeId);
    }
    onExpandedNodeIdsChange(Array.from(nextExpanded).sort());
  }

  return (
    <section className="library-role-graph" aria-label="Role library graph">
      <div className="library-role-graph__header">
        <div>
          <span className="configuration-badge">Role Graph</span>
          <h2>Roles, representations, methods</h2>
          <p>
            {graphData.nodes.filter((node) => node.kind === 'physical').length} physical nodes and {graphData.nodes.filter((node) => node.kind === 'role').length} roles visible from {model.topLevelPhysicalNodes.length} top-level physical nodes.
          </p>
        </div>
      </div>
      <Suspense
        fallback={(
          <div className="library-role-graph-canvas">
            <div className="system-flow-graph__loading">Loading role graph renderer</div>
          </div>
        )}
      >
        <LibraryRoleGraphCanvas
          data={graphData}
          expandedNodeIds={expandedNodeIds}
          onToggleNode={toggleNode}
          onSelectNode={onSelectNode}
        />
      </Suspense>
    </section>
  );
}
