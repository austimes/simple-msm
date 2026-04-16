import type {
  AdditionalityMetricSnapshot,
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

export type AdditionalityWaterfallMetric = keyof AdditionalityMetricSnapshot;

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
  objective: createCurrencyPresentation(
    'objective',
    BILLION,
    {
      delta: 'Cost Δ ($B)',
      before: 'Cost before ($B)',
      after: 'Cost after ($B)',
    },
  ),
  cumulativeEmissions: createSuffixedPresentation(
    'cumulativeEmissions',
    'MtCO2e',
    MILLION,
    {
      delta: 'Emissions Δ (MtCO2e)',
      before: 'Emissions before (MtCO2e)',
      after: 'Emissions after (MtCO2e)',
    },
  ),
  electricityDemand2050: createSuffixedPresentation(
    'electricityDemand2050',
    'TWh',
    MILLION,
    {
      delta: 'Electricity Δ (TWh)',
      before: 'Electricity 2050 before (TWh)',
      after: 'Electricity 2050 after (TWh)',
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
      label: labels[index] ?? entry.atom.stateLabel,
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
    label: labels[index] ?? entry.atom.stateLabel,
    delta: 0,
    cumulativeBefore: 0,
    cumulativeAfter: 0,
  }));
}
