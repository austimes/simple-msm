export interface SystemFlowPortEdgePathInput {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  laneIndex: number;
  laneCount: number;
}

export interface SystemFlowPortEdgePath {
  path: string;
  labelX: number;
  labelY: number;
}

const FORWARD_MIN_GAP = 56;
const BACKWARD_GUTTER = 88;
const LANE_SPACING = 14;

function formatCoordinate(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(3).replace(/\.?0+$/, '');
}

function laneOffset(laneIndex: number, laneCount: number): number {
  if (laneCount <= 1) {
    return 0;
  }

  return (laneIndex - (laneCount - 1) / 2) * LANE_SPACING;
}

function compactPoints(points: Array<[number, number]>): Array<[number, number]> {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous[0] !== point[0] || previous[1] !== point[1];
  });
}

function horizontalLabelPoint(points: Array<[number, number]>): [number, number] {
  let bestStart = points[0] ?? [0, 0];
  let bestEnd = points[points.length - 1] ?? bestStart;
  let bestLength = -1;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];

    if (!start || !end) {
      continue;
    }

    if (start[1] !== end[1]) {
      continue;
    }

    const length = Math.abs(end[0] - start[0]);

    if (length > bestLength) {
      bestLength = length;
      bestStart = start;
      bestEnd = end;
    }
  }

  return [
    (bestStart[0] + bestEnd[0]) / 2,
    bestStart[1],
  ];
}

function pointsToPath(points: Array<[number, number]>): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${formatCoordinate(x)} ${formatCoordinate(y)}`)
    .join(' ');
}

export function getSystemFlowPortEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  laneIndex,
  laneCount,
}: SystemFlowPortEdgePathInput): SystemFlowPortEdgePath {
  const offset = laneOffset(laneIndex, laneCount);
  const forwardGap = targetX - sourceX;
  const points = forwardGap >= FORWARD_MIN_GAP
    ? compactPoints([
      [sourceX, sourceY],
      [sourceX + forwardGap / 2 + offset, sourceY],
      [sourceX + forwardGap / 2 + offset, targetY],
      [targetX, targetY],
    ])
    : compactPoints([
      [sourceX, sourceY],
      [Math.max(sourceX, targetX) + BACKWARD_GUTTER + laneIndex * LANE_SPACING, sourceY],
      [Math.max(sourceX, targetX) + BACKWARD_GUTTER + laneIndex * LANE_SPACING, targetY],
      [targetX, targetY],
    ]);
  const [labelX, labelY] = horizontalLabelPoint(points);

  return {
    path: pointsToPath(points),
    labelX,
    labelY: labelY - 10,
  };
}
