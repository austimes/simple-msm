import {
  CHART_PRESENTATION_MAP,
  getSeriesColor as getChartSeriesColor,
  type ChartPresentationNamespace,
} from './chartPresentation.ts';

export type SeriesColorNamespace = ChartPresentationNamespace;

export const SERIES_COLOR_MAP = Object.fromEntries(
  Object.entries(CHART_PRESENTATION_MAP).map(([namespace, registry]) => [
    namespace,
    Object.fromEntries(
      Object.entries(registry).map(([key, presentation]) => [key, presentation.color]),
    ),
  ]),
) as Record<SeriesColorNamespace, Record<string, string>>;

export function getSeriesColor(namespace: SeriesColorNamespace, key: string): string {
  return getChartSeriesColor(namespace, key);
}
