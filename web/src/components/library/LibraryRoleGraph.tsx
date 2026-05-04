import React, { Suspense, lazy, useMemo } from 'react';
import type {
  RoleLibraryGraphFilters,
  RoleLibraryGraphNode,
  RoleLibraryModel,
} from '../../data/roleLibraryModel.ts';
import {
  buildRoleLibraryGraphData,
  listTopLevelTopologyAreas,
} from '../../data/roleLibraryModel.ts';

void React;

const LibraryRoleGraphCanvas = lazy(() => import('./LibraryRoleGraphCanvas.tsx'));

interface LibraryRoleGraphProps {
  model: RoleLibraryModel;
  expandedNodeIds: Set<string>;
  filters: RoleLibraryGraphFilters;
  onExpandedNodeIdsChange: (nodeIds: string[]) => void;
  onSelectNode: (node: RoleLibraryGraphNode) => void;
  onTopologyAreaChange: (topologyAreaId: string) => void;
}

export default function LibraryRoleGraph({
  model,
  expandedNodeIds,
  filters,
  onExpandedNodeIdsChange,
  onSelectNode,
  onTopologyAreaChange,
}: LibraryRoleGraphProps) {
  const topologyAreas = useMemo(() => listTopLevelTopologyAreas(model), [model]);
  const activeTopologyAreaId = filters.topologyAreaId?.trim() ?? '';
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

  const visibleRoleCount = graphData.nodes.filter((node) => node.kind === 'role').length;

  return (
    <section className="library-role-graph" aria-label="Role library graph">
      <div className="library-role-graph__header">
        <div>
          <span className="configuration-badge">Role Graph</span>
          <h2>Roles, representations, methods</h2>
          <p>
            {visibleRoleCount} roles visible from {model.topLevelRoles.length} top-level roles.
          </p>
        </div>
      </div>
      {topologyAreas.length > 0 ? (
        <div className="library-chip-section">
          <span className="library-chip-label">Topology area</span>
          <div className="library-chip-row" role="group" aria-label="Filter by topology area">
            <button
              type="button"
              className={`library-chip${activeTopologyAreaId === '' ? ' library-chip--active' : ''}`}
              onClick={() => onTopologyAreaChange('')}
              aria-pressed={activeTopologyAreaId === ''}
            >
              All ({model.topLevelRoles.length})
            </button>
            {topologyAreas.map((area) => (
              <button
                key={area.topologyAreaId}
                type="button"
                className={`library-chip${activeTopologyAreaId === area.topologyAreaId ? ' library-chip--active' : ''}`}
                onClick={() => onTopologyAreaChange(area.topologyAreaId)}
                aria-pressed={activeTopologyAreaId === area.topologyAreaId}
              >
                {area.topologyAreaLabel} ({area.topLevelRoleCount})
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
