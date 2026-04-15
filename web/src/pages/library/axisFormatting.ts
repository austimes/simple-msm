import { computeDomain } from '../../components/charts/rechartsAdapters';

const COMPACT_AXIS_NUMBER_FORMATTER = new Intl.NumberFormat('en-AU', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const DEFAULT_PADDING_RATIO = 0.12;
const DEFAULT_TICK_INTERVAL_COUNT = 4;

interface AdaptiveAxisNumberFormatterOptions {
  minDomain?: number;
  paddingRatio?: number;
}

function normalizeAxisValue(value: number, fractionDigits: number): number {
  const threshold = fractionDigits > 0 ? 10 ** (-(fractionDigits + 1)) : 1e-9;
  return Math.abs(value) < threshold ? 0 : value;
}

export function calculateAdaptiveAxisFractionDigits(
  values: readonly number[],
  options: AdaptiveAxisNumberFormatterOptions = {},
): number {
  const {
    minDomain,
    paddingRatio = DEFAULT_PADDING_RATIO,
  } = options;

  const numericValues = values.filter((value) => Number.isFinite(value));
  if (numericValues.length === 0) {
    return 0;
  }

  const [domainMin, domainMax] = computeDomain(numericValues, {
    paddingRatio,
    minDomain,
  });
  const domainSpan = Math.abs(domainMax - domainMin);

  if (!Number.isFinite(domainSpan) || domainSpan === 0) {
    return 0;
  }

  const approximateTickStep = domainSpan / DEFAULT_TICK_INTERVAL_COUNT;
  if (!Number.isFinite(approximateTickStep) || approximateTickStep <= 0) {
    return 0;
  }

  return Math.min(6, Math.max(0, 1 - Math.floor(Math.log10(approximateTickStep))));
}

export function buildAdaptiveAxisNumberFormatter(
  values: readonly number[],
  options: AdaptiveAxisNumberFormatterOptions = {},
): (value: number) => string {
  const fractionDigits = calculateAdaptiveAxisFractionDigits(values, options);
  const numericValues = values.filter((value) => Number.isFinite(value));

  if (numericValues.length === 0) {
    return (value) => String(value);
  }

  const maxAbsValue = numericValues.reduce((currentMax, value) => Math.max(currentMax, Math.abs(value)), 0);
  const formatter = maxAbsValue >= 1000
    ? COMPACT_AXIS_NUMBER_FORMATTER
    : new Intl.NumberFormat('en-AU', {
        maximumFractionDigits: fractionDigits,
      });

  return (value: number) => formatter.format(normalizeAxisValue(value, fractionDigits));
}
