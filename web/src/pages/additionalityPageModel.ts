import { getConfigurationId } from '../data/configurationLoader.ts';
import type {
  AdditionalityMetricSnapshot,
  AdditionalityReport,
} from '../additionality/additionalityAnalysis.ts';
import type { ConfigurationDocument } from '../data/types.ts';

export interface AdditionalityWaterfallDatum {
  key: string;
  label: string;
  delta: number;
  cumulativeBefore: number;
  cumulativeAfter: number;
}

export type AdditionalityWaterfallMetric = keyof AdditionalityMetricSnapshot;

export function selectInitialAdditionalityPair(
  configurations: ConfigurationDocument[],
): { baseConfigId: string | null; targetConfigId: string | null } {
  const ids = configurations
    .map((configuration) => getConfigurationId(configuration))
    .filter((id): id is string => id != null);

  if (ids.includes('reference-base') && ids.includes('reference-all')) {
    return {
      baseConfigId: 'reference-base',
      targetConfigId: 'reference-all',
    };
  }

  return {
    baseConfigId: ids[0] ?? null,
    targetConfigId: ids.find((id) => id !== ids[0]) ?? ids[0] ?? null,
  };
}

export function buildAdditionalityWaterfallRows(
  sequence: AdditionalityReport['sequence'],
  metric: AdditionalityWaterfallMetric,
  labels: readonly string[] = [],
): AdditionalityWaterfallDatum[] {
  let cumulative = 0;

  return sequence.map((entry, index) => {
    const delta = entry.metricsDeltaFromCurrent[metric];
    const cumulativeBefore = cumulative;
    cumulative += delta;

    return {
      key: `${entry.atom.key}:${metric}`,
      label: labels[index] ?? entry.atom.stateLabel,
      delta,
      cumulativeBefore,
      cumulativeAfter: cumulative,
    };
  });
}
