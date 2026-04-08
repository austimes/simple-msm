import type { StackedChartData } from '../../results/chartData';

interface StackedAreaChartProps {
  data: StackedChartData;
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
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toPrecision(3)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toPrecision(3)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toPrecision(3)}K`;
  return value.toPrecision(3);
}

export default function StackedAreaChart({
  data,
  valueFormatter = defaultFormatter,
  height = 300,
}: StackedAreaChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const chartHeight = height;
  const xSpan = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const ySpan = chartHeight - PADDING_TOP - PADDING_BOTTOM;

  if (series.length === 0 || years.length === 0) {
    return <p className="stacked-chart-empty">No data available for this chart.</p>;
  }

  // Compute cumulative totals per year to check for all-zero
  const cumulativeTotals = years.map((year) =>
    series.reduce((sum, s) => {
      const point = s.values.find((v) => v.year === year);
      return sum + (point?.value ?? 0);
    }, 0),
  );

  if (cumulativeTotals.every((t) => t === 0)) {
    return <p className="stacked-chart-empty">No data available for this chart.</p>;
  }

  // Build cumulative sums per year for each series layer
  // cumulative[i][j] = sum of series[0..i] at years[j]
  const cumulative: number[][] = [];
  for (let i = 0; i < series.length; i++) {
    cumulative.push(
      years.map((year, j) => {
        const point = series[i].values.find((v) => v.year === year);
        const value = point?.value ?? 0;
        return (i > 0 ? cumulative[i - 1][j] : 0) + value;
      }),
    );
  }

  const maxCumulative = Math.max(...cumulative[cumulative.length - 1]);
  const domainMax = maxCumulative * 1.08;
  const domainMin = 0;

  const xForIndex = (index: number) => {
    if (years.length === 1) return PADDING_LEFT + xSpan / 2;
    return PADDING_LEFT + (xSpan * index) / (years.length - 1);
  };

  const yForValue = (value: number) =>
    PADDING_TOP + ((domainMax - value) / (domainMax - domainMin)) * ySpan;

  const tickValues = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    domainMin + ((domainMax - domainMin) * (TICK_COUNT - i)) / TICK_COUNT,
  );

  // Build area paths: for each series, trace top edge left-to-right, then bottom edge right-to-left
  const areaPaths = series.map((_, i) => {
    const topPoints = years.map((_, j) => `${xForIndex(j)} ${yForValue(cumulative[i][j])}`);
    const bottomPoints = years.map((_, j) => {
      const bottomValue = i > 0 ? cumulative[i - 1][j] : 0;
      return `${xForIndex(j)} ${yForValue(bottomValue)}`;
    });
    return `M ${topPoints[0]} L ${topPoints.join(' L ')} L ${bottomPoints.reverse().join(' L ')} Z`;
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
          <path
            key={entry.key}
            d={areaPaths[i]}
            fill={entry.color}
            opacity={0.82}
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
