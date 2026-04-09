import type { LineChartData } from '../../results/chartData';

interface LineChartProps {
  data: LineChartData;
  valueFormatter?: (value: number) => string;
  height?: number;
}

const CHART_WIDTH = 720;
const PADDING_LEFT = 92;
const PADDING_RIGHT = 20;
const PADDING_TOP = 40;
const PADDING_BOTTOM = 42;
const AXIS_TITLE_X = 22;
const TICK_LABEL_OFFSET = 10;
const TICK_LABEL_BASELINE = 4;
const YEAR_LABEL_OFFSET = 12;
const TICK_COUNT = 4;

function defaultFormatter(value: number): string {
  return `${value.toFixed(0)}%`;
}

export default function LineChart({
  data,
  valueFormatter = defaultFormatter,
  height = 300,
}: LineChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const chartHeight = height;
  const xSpan = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const ySpan = chartHeight - PADDING_TOP - PADDING_BOTTOM;

  if (series.length === 0 || years.length === 0) {
    return <p className="stacked-chart-empty">No data available for this chart.</p>;
  }

  // Compute domain from all values
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const s of series) {
    for (const v of s.values) {
      if (v.value < minVal) minVal = v.value;
      if (v.value > maxVal) maxVal = v.value;
    }
  }

  // Add some padding to domain
  const range = maxVal - minVal || 1;
  const domainMin = Math.floor((minVal - range * 0.08) / 5) * 5;
  const domainMax = Math.ceil((maxVal + range * 0.08) / 5) * 5;

  const xForIndex = (index: number) => {
    if (years.length === 1) return PADDING_LEFT + xSpan / 2;
    return PADDING_LEFT + (xSpan * index) / (years.length - 1);
  };

  const yForValue = (value: number) =>
    PADDING_TOP + ((domainMax - value) / (domainMax - domainMin)) * ySpan;

  const tickValues = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    domainMin + ((domainMax - domainMin) * (TICK_COUNT - i)) / TICK_COUNT,
  );

  // Build polyline points for each series
  const linePaths = series.map((s) => {
    const points = s.values.map(
      (v, j) => `${xForIndex(j)},${yForValue(v.value)}`,
    );
    return points.join(' ');
  });

  return (
    <div className="stacked-chart-shell">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
        role="img"
        aria-label={title}
        className="stacked-chart-svg"
      >
        <text
          x={CHART_WIDTH / 2}
          y={24}
          textAnchor="middle"
          className="stacked-chart-title"
        >
          {title}
        </text>

        {yAxisLabel ? (
          <text
            x={AXIS_TITLE_X}
            y={PADDING_TOP + ySpan / 2}
            textAnchor="middle"
            className="stacked-chart-axis-title"
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
                className="stacked-chart-grid-line"
              />
              <text
                x={PADDING_LEFT - TICK_LABEL_OFFSET}
                y={y + TICK_LABEL_BASELINE}
                textAnchor="end"
                className="stacked-chart-axis-label"
              >
                {valueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        {years.map((year, index) => (
          <text
            key={year}
            x={xForIndex(index)}
            y={chartHeight - YEAR_LABEL_OFFSET}
            textAnchor="middle"
            className="stacked-chart-axis-label"
          >
            {year}
          </text>
        ))}

        {series.map((entry, i) => (
          <polyline
            key={entry.key}
            points={linePaths[i]}
            fill="none"
            stroke={entry.color}
            strokeWidth={2.5}
          />
        ))}
      </svg>

      <div className="stacked-chart-legend">
        {series.map((entry) => (
          <span key={entry.key} className="stacked-chart-legend-item">
            <span
              className="stacked-chart-legend-swatch"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
