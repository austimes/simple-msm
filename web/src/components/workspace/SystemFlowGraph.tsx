import React, { Suspense, lazy, useCallback, useMemo } from 'react';
import type {
  SystemFlowGraphData,
  SystemFlowViewMode,
} from '../../results/systemFlowGraph.ts';

void React;

const SystemFlowGraphCanvas = lazy(() => import('./SystemFlowGraphCanvas.tsx'));

interface SystemFlowGraphProps {
  availableYears: number[];
  data: SystemFlowGraphData;
  selectedYear: number;
  viewMode: SystemFlowViewMode;
  onCollapsedSegmentIdsChange: (segmentIds: string[]) => void;
  onViewModeChange: (mode: SystemFlowViewMode) => void;
  onYearChange: (year: number) => void;
}

const VIEW_MODES: Array<{ label: string; mode: SystemFlowViewMode }> = [
  { label: 'Both', mode: 'both' },
  { label: 'Topology', mode: 'topology' },
  { label: 'Solved', mode: 'solved' },
];

export default function SystemFlowGraph({
  availableYears,
  data,
  selectedYear,
  viewMode,
  onCollapsedSegmentIdsChange,
  onViewModeChange,
  onYearChange,
}: SystemFlowGraphProps) {
  const collapsedSegmentIds = useMemo(
    () => new Set(data.segments.filter((segment) => segment.collapsed).map((segment) => segment.id)),
    [data.segments],
  );
  const toggleSegment = useCallback((segmentId: string) => {
    const next = new Set(collapsedSegmentIds);

    if (next.has(segmentId)) {
      next.delete(segmentId);
    } else {
      next.add(segmentId);
    }

    onCollapsedSegmentIdsChange(Array.from(next).sort());
  }, [collapsedSegmentIds, onCollapsedSegmentIdsChange]);

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

      <Suspense
        fallback={(
          <div className={`system-flow-graph system-flow-graph--${viewMode}`}>
            <div className="system-flow-graph__loading">Loading system flow renderer</div>
          </div>
        )}
      >
        <SystemFlowGraphCanvas
          collapsedSegmentIds={collapsedSegmentIds}
          data={data}
          onToggleSegment={toggleSegment}
          viewMode={viewMode}
        />
      </Suspense>

      <div className="system-flow-summary" aria-label="System flow summary">
        <span>{data.summary.selectedEdgeCount} active flows</span>
        <span>{data.summary.zeroActivityRouteCount} zero-activity routes visible</span>
        <span>{data.summary.externalDemandEdgeCount} residual demand edges</span>
      </div>
    </section>
  );
}
