import type { StackedChartData } from '../../results/chartData';

interface DivergingStackedBarChartProps {
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
const NET_LINE_COLOR = '#111827';

function defaultFormatter(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toPrecision(3)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toPrecision(3)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toPrecision(3)}K`;
  return value.toPrecision(3);
}

export default function DivergingStackedBarChart({
  data,
  valueFormatter = defaultFormatter,
  height = 300,
}: DivergingStackedBarChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const chartHeight = height;
  const xSpan = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const ySpan = chartHeight - PADDING_TOP - PADDING_BOTTOM;

  const hasAnyNonZero = series.some((s) => s.values.some((v) => v.value !== 0));
  if (series.length === 0 || years.length === 0 || !hasAnyNonZero) {
    return <p className="stacked-chart-empty">No data available for this chart.</p>;
  }

  // Pre-compute value matrix: valueMatrix[seriesIdx][yearIdx]
  const valueMatrix = series.map((s) => {
    const byYear = new Map(s.values.map((v) => [v.year, v.value]));
    return years.map((year) => byYear.get(year) ?? 0);
  });

  // Compute positive/negative totals and net per year
  const positiveTotals = new Array(years.length).fill(0);
  const negativeTotals = new Array(years.length).fill(0);
  const netValues = new Array(years.length).fill(0);

  for (let j = 0; j < years.length; j++) {
    for (let i = 0; i < series.length; i++) {
      const v = valueMatrix[i][j];
      netValues[j] += v;
      if (v > 0) positiveTotals[j] += v;
      else if (v < 0) negativeTotals[j] += v;
    }
  }

  // Domain spans both positive and negative, always includes zero
  const maxPositive = Math.max(0, ...positiveTotals, ...netValues);
  const minNegative = Math.min(0, ...negativeTotals, ...netValues);
  const topPad = maxPositive > 0 ? maxPositive * 0.08 : 0;
  const bottomPad = minNegative < 0 ? Math.abs(minNegative) * 0.08 : 0;
  const domainMax = maxPositive + topPad;
  const domainMin = minNegative - bottomPad;
  const domainSpan = domainMax - domainMin || 1;

  const xForIndex = (index: number) => {
    if (years.length === 1) return PADDING_LEFT + xSpan / 2;
    return PADDING_LEFT + (xSpan * index) / (years.length - 1);
  };

  const yForValue = (value: number) =>
    PADDING_TOP + ((domainMax - value) / domainSpan) * ySpan;

  // Bar width: fraction of the spacing between year ticks
  const barWidth = years.length > 1
    ? (xSpan / (years.length - 1)) * 0.5
    : xSpan * 0.3;

  // Tick values spanning the full domain
  const tickValues = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    domainMax - ((domainMax - domainMin) * i) / TICK_COUNT,
  );

  // Build rects for each year using diverging cursors
  const rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    seriesIdx: number;
  }> = [];

  for (let j = 0; j < years.length; j++) {
    let posCursor = 0;
    let negCursor = 0;
    const barX = xForIndex(j) - barWidth / 2;

    for (let i = 0; i < series.length; i++) {
      const value = valueMatrix[i][j];
      if (value === 0) continue;

      let lower: number;
      let upper: number;

      if (value > 0) {
        lower = posCursor;
        upper = posCursor + value;
        posCursor = upper;
      } else {
        upper = negCursor;
        lower = negCursor + value;
        negCursor = lower;
      }

      const rectY = yForValue(upper);
      const rectH = yForValue(lower) - yForValue(upper);

      rects.push({
        x: barX,
        y: rectY,
        width: barWidth,
        height: Math.max(rectH, 0.5),
        color: series[i].color,
        seriesIdx: i,
      });
    }
  }

  // Net line points
  const netPoints = years
    .map((_, j) => `${xForIndex(j)},${yForValue(netValues[j])}`)
    .join(' ');

  const hasNegatives = minNegative < 0;

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

        {/* Zero line when domain spans both sides */}
        {hasNegatives && (
          <line
            x1={PADDING_LEFT}
            x2={CHART_WIDTH - PADDING_RIGHT}
            y1={yForValue(0)}
            y2={yForValue(0)}
            stroke="#334155"
            strokeWidth={1.5}
          />
        )}

        {/* Stacked bars */}
        {rects.map((rect, idx) => (
          <rect
            key={idx}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.color}
            opacity={0.82}
          />
        ))}

        {/* Net emissions line */}
        <polyline
          points={netPoints}
          fill="none"
          stroke={NET_LINE_COLOR}
          strokeWidth={2.5}
          strokeDasharray="6 4"
        />
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
        <span className="stacked-chart-legend-item">
          <span
            className="stacked-chart-legend-swatch"
            style={{
              backgroundColor: 'transparent',
              borderTop: `2.5px dashed ${NET_LINE_COLOR}`,
              borderRadius: 0,
              height: 0,
              alignSelf: 'center',
            }}
          />
          <span>Net</span>
        </span>
      </div>
    </div>
  );
}
