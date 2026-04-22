import type {
  AdditionalityMetricKey,
  AdditionalityReport,
} from '../additionality/additionalityAnalysis.ts';
import { selectInitialSavedPair } from '../data/configurationPairModel.ts';
import type { ConfigurationDocument } from '../data/types.ts';

export interface AdditionalityWaterfallDatum {
  key: string;
  interactionKey: string;
  label: string;
  delta: number;
  cumulativeBefore: number;
  cumulativeAfter: number;
}

export type AdditionalityWaterfallMetric = AdditionalityMetricKey;

export interface AdditionalityMetricPresentation {
  metric: AdditionalityWaterfallMetric;
  unitLabel: string;
  convertRawToDisplay: (value: number) => number;
  formatSignedValue: (value: number) => string;
  formatAbsoluteValue: (value: number) => string;
  tableHeaders: {
    delta: string;
    before: string;
    after: string;
  };
}

const BILLION = 1_000_000_000;
const MILLION = 1_000_000;
const displayNumberFormatter = new Intl.NumberFormat('en-AU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDisplayMagnitude(
  value: number,
  formatMagnitude: (magnitude: number) => string,
): string {
  return value < 0
    ? `-${formatMagnitude(Math.abs(value))}`
    : formatMagnitude(value);
}

function formatSignedDisplayMagnitude(
  value: number,
  formatMagnitude: (magnitude: number) => string,
): string {
  if (value > 0) {
    return `+${formatMagnitude(value)}`;
  }

  return formatDisplayMagnitude(value, formatMagnitude);
}

function createCurrencyPresentation(
  metric: AdditionalityWaterfallMetric,
  scale: number,
  tableHeaders: AdditionalityMetricPresentation['tableHeaders'],
): AdditionalityMetricPresentation {
  const convertRawToDisplay = (value: number) => value / scale;
  const formatMagnitude = (magnitude: number) => `$${displayNumberFormatter.format(magnitude)}B`;

  return {
    metric,
    unitLabel: '$B',
    convertRawToDisplay,
    formatSignedValue: (value) => formatSignedDisplayMagnitude(
      convertRawToDisplay(value),
      formatMagnitude,
    ),
    formatAbsoluteValue: (value) => formatDisplayMagnitude(
      convertRawToDisplay(value),
      formatMagnitude,
    ),
    tableHeaders,
  };
}

function createSuffixedPresentation(
  metric: AdditionalityWaterfallMetric,
  unitLabel: string,
  scale: number,
  tableHeaders: AdditionalityMetricPresentation['tableHeaders'],
): AdditionalityMetricPresentation {
  const convertRawToDisplay = (value: number) => value / scale;
  const formatMagnitude = (magnitude: number) => `${displayNumberFormatter.format(magnitude)} ${unitLabel}`;

  return {
    metric,
    unitLabel,
    convertRawToDisplay,
    formatSignedValue: (value) => formatSignedDisplayMagnitude(
      convertRawToDisplay(value),
      formatMagnitude,
    ),
    formatAbsoluteValue: (value) => formatDisplayMagnitude(
      convertRawToDisplay(value),
      formatMagnitude,
    ),
    tableHeaders,
  };
}

const additionalityMetricPresentations: Record<
  AdditionalityWaterfallMetric,
  AdditionalityMetricPresentation
> = {
  cost: createCurrencyPresentation(
    'cost',
    BILLION,
    {
      delta: 'Cost Δ ($B)',
      before: 'Cost before ($B)',
      after: 'Cost after ($B)',
    },
  ),
  emissions: createSuffixedPresentation(
    'emissions',
    'MtCO2e',
    MILLION,
    {
      delta: 'Emissions Δ (MtCO2e)',
      before: 'Emissions before (MtCO2e)',
      after: 'Emissions after (MtCO2e)',
    },
  ),
  fuelEnergy: createSuffixedPresentation(
    'fuelEnergy',
    'PJ',
    1,
    {
      delta: 'Fuel/energy Δ (PJ)',
      before: 'Fuel/energy before (PJ)',
      after: 'Fuel/energy after (PJ)',
    },
  ),
};

export function getAdditionalityMetricPresentation(
  metric: AdditionalityWaterfallMetric,
): AdditionalityMetricPresentation {
  return additionalityMetricPresentations[metric];
}

export function selectInitialAdditionalityPair(
  configurations: ConfigurationDocument[],
): { baseConfigId: string | null; targetConfigId: string | null } {
  const pair = selectInitialSavedPair(configurations);
  return {
    baseConfigId: pair.baseConfigId,
    targetConfigId: pair.focusConfigId,
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
      interactionKey: entry.atom.key,
      label: labels[index] ?? entry.atom.label,
      delta,
      cumulativeBefore,
      cumulativeAfter: cumulative,
    };
  });
}

export function buildAdditionalityReferenceRows(
  sequence: AdditionalityReport['sequence'],
  labels: readonly string[] = [],
): AdditionalityWaterfallDatum[] {
  return sequence.map((entry, index) => ({
    key: `${entry.atom.key}:reference`,
    interactionKey: entry.atom.key,
    label: labels[index] ?? entry.atom.label,
    delta: 0,
    cumulativeBefore: 0,
    cumulativeAfter: 0,
  }));
}

export function buildAdditionalitySavingsStackRows(
  report: AdditionalityReport,
  metric: AdditionalityWaterfallMetric,
  labels: readonly string[] = [],
): AdditionalityWaterfallDatum[] {
  let cumulative = 0;
  const rows = report.sequence.map((entry, index) => {
    const delta = -entry.metricsDeltaFromCurrent[metric];
    const cumulativeBefore = cumulative;
    cumulative += delta;

    return {
      key: `${entry.atom.key}:${metric}:savings`,
      interactionKey: entry.atom.key,
      label: labels[index] ?? entry.atom.label,
      delta,
      cumulativeBefore,
      cumulativeAfter: cumulative,
    };
  });

  const expected = report.baseMetrics[metric] - report.targetMetrics[metric];
  const residual = expected - cumulative;
  if (Math.abs(residual) > 1e-6) {
    rows.push({
      key: `residual:${metric}:savings`,
      interactionKey: `residual:${metric}`,
      label: 'Residual',
      delta: residual,
      cumulativeBefore: cumulative,
      cumulativeAfter: cumulative + residual,
    });
  }

  return rows;
}
