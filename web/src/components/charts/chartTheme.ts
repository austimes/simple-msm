import type { CSSProperties } from 'react';

export const CHART_BASE_WIDTH = 720;
export const WORKSPACE_CHART_HEIGHT = 320;
export const LIBRARY_CHART_HEIGHT = 280;

export const WORKSPACE_CHART_MARGIN = {
  top: 12,
  right: 18,
  bottom: 12,
  left: 28,
};

export const LIBRARY_CHART_MARGIN = {
  top: 12,
  right: 18,
  bottom: 12,
  left: 28,
};

export const CHART_GRID_STROKE = 'rgba(148, 163, 184, 0.42)';
export const CHART_GRID_DASHARRAY = '4 3';
export const CHART_AXIS_TICK_STYLE = {
  fill: '#64748b',
  fontSize: 11,
  fontWeight: 600,
};
export const CHART_AXIS_TITLE_STYLE = {
  fill: '#475569',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.02em',
};
export const CHART_NET_LINE_COLOR = '#111827';

export function buildChartShellStyle(height: number): CSSProperties {
  return {
    '--chart-height': `${height}px`,
  } as CSSProperties;
}

export function buildResponsiveContainerProps(height: number) {
  return {
    width: '100%' as const,
    height: '100%' as const,
    minWidth: 0,
    initialDimension: {
      width: CHART_BASE_WIDTH,
      height,
    },
  };
}
