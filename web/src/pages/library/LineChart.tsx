export interface LineChartSeries {
  key: string;
  label: string;
  color: string;
  values: Array<{
    year: number;
    value: number | null;
  }>;
  dashArray?: string;
  active?: boolean;
}

type LineChartLegendMode = 'full' | 'compact' | 'hidden';

interface LineChartProps {
  ariaLabel: string;
  years: number[];
  series: LineChartSeries[];
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  yAxisLabel?: string;
  emptyMessage?: string;
  onSelectSeries?: (series: LineChartSeries) => void;
  minDomain?: number;
  legendMode?: LineChartLegendMode;
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 280;
const PADDING_LEFT = 92;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 42;
const AXIS_TITLE_X = 22;
const TICK_COUNT = 4;

function splitIntoSegments(
  values: Array<{
    x: number;
    y: number | null;
  }>,
) {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  values.forEach(({ x, y }) => {
    if (y == null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }

    current.push({ x, y });
  });

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export default function LineChart({
  ariaLabel,
  years,
  series,
  valueFormatter,
  axisFormatter,
  yAxisLabel,
  emptyMessage = 'No values available for this chart.',
  onSelectSeries,
  minDomain,
  legendMode = 'full',
}: LineChartProps) {
  const xSpan = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const ySpan = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const activeSeriesPresent = series.some((entry) => entry.active);
  const showLegend = legendMode !== 'hidden';
  const compactLegend = legendMode === 'compact';
  const seriesValues = series.flatMap((entry) => entry.values.map((point) => point.value).filter((value): value is number => value != null));

  if (series.length === 0 || seriesValues.length === 0 || years.length === 0) {
    return <p className="library-chart-empty">{emptyMessage}</p>;
  }

  const rawMin = Math.min(...seriesValues);
  const rawMax = Math.max(...seriesValues);
  let domainMin = minDomain != null ? Math.min(minDomain, rawMin) : rawMin;
  let domainMax = rawMax;

  if (domainMin === domainMax) {
    const pad = Math.abs(domainMin) * 0.12 || 1;
    domainMin -= pad;
    domainMax += pad;
  } else {
    const pad = (domainMax - domainMin) * 0.12;
    domainMin -= pad;
    domainMax += pad;
  }

  const xForYear = (year: number) => {
    if (years.length === 1) {
      return PADDING_LEFT + xSpan / 2;
    }

    const index = years.indexOf(year);
    return PADDING_LEFT + (xSpan * index) / (years.length - 1);
  };

  const yForValue = (value: number) => PADDING_TOP + ((domainMax - value) / (domainMax - domainMin)) * ySpan;
  const tickFormatter = axisFormatter ?? valueFormatter;
  const tickValues = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
    return domainMin + ((domainMax - domainMin) * (TICK_COUNT - index)) / TICK_COUNT;
  });

  return (
    <div className="library-chart-shell">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        className="library-chart-svg"
      >
        {yAxisLabel ? (
          <text
            x={AXIS_TITLE_X}
            y={PADDING_TOP + ySpan / 2}
            textAnchor="middle"
            className="library-chart-axis-title"
            transform={`rotate(-90 ${AXIS_TITLE_X} ${PADDING_TOP + ySpan / 2})`}
          >
            {yAxisLabel}
          </text>
        ) : null}

        {tickValues.map((tickValue) => {
          const y = yForValue(tickValue);
          return (
            <g key={tickValue}>
              <line
                x1={PADDING_LEFT}
                x2={CHART_WIDTH - PADDING_RIGHT}
                y1={y}
                y2={y}
                className="library-chart-grid-line"
              />
              <text x={PADDING_LEFT - 10} y={y + 4} textAnchor="end" className="library-chart-axis-label">
                {tickFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        {years.map((year) => (
          <text
            key={year}
            x={xForYear(year)}
            y={CHART_HEIGHT - 12}
            textAnchor="middle"
            className="library-chart-axis-label"
          >
            {year}
          </text>
        ))}

        {series.map((entry) => {
          const points = years.map((year) => {
            const yearPoint = entry.values.find((value) => value.year === year);
            return {
              x: xForYear(year),
              y: yearPoint?.value != null ? yForValue(yearPoint.value) : null,
            };
          });
          const segments = splitIntoSegments(points);
          const opacity = activeSeriesPresent ? (entry.active ? 1 : 0.24) : 0.82;

          return (
            <g key={entry.key}>
              {segments.map((segment, index) => {
                const path = buildPath(segment);
                return (
                  <g key={`${entry.key}:${index}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke={entry.color}
                      strokeWidth={entry.active ? 4 : 3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={entry.dashArray}
                      opacity={opacity}
                    />
                    {onSelectSeries ? (
                      <path
                        d={path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        onClick={() => onSelectSeries(entry)}
                        className="library-chart-hit-area"
                      />
                    ) : null}
                  </g>
                );
              })}

              {points.map((point, index) => {
                if (point.y == null) {
                  return null;
                }

                return (
                  <circle
                    key={`${entry.key}:point:${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={entry.active ? 4.5 : 3.5}
                    fill={entry.color}
                    opacity={opacity}
                    onClick={onSelectSeries ? () => onSelectSeries(entry) : undefined}
                    className={onSelectSeries ? 'library-chart-hit-area' : undefined}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {showLegend ? (
        <div className={`library-chart-legend${compactLegend ? ' library-chart-legend--compact' : ''}`}>
          {series.map((entry) => {
            const itemClassName = [
              'library-chart-legend-item',
              compactLegend ? 'library-chart-legend-item--compact' : '',
              entry.active ? 'library-chart-legend-item--active' : '',
              onSelectSeries ? '' : 'library-chart-legend-item--static',
            ]
              .filter(Boolean)
              .join(' ');
            const content = (
              <>
                <span
                  className="library-chart-legend-swatch"
                  style={{
                    backgroundColor: entry.color,
                    opacity: activeSeriesPresent ? (entry.active ? 1 : 0.35) : 0.8,
                  }}
                >
                  {entry.dashArray ? <span className="library-chart-legend-swatch--dash" /> : null}
                </span>
                <span>{entry.label}</span>
              </>
            );

            return onSelectSeries ? (
              <button
                key={entry.key}
                type="button"
                className={itemClassName}
                onClick={() => onSelectSeries(entry)}
              >
                {content}
              </button>
            ) : (
              <span key={entry.key} className={itemClassName}>
                {content}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
