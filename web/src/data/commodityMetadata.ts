export type CommodityKind = 'fuel' | 'material' | 'service';

export type CommodityCanonicalUnit = 'GJ' | 'MWh' | 'PJ' | 't' | 'tCO2_stored';

export interface CommodityMetadata {
  id: string;
  label: string;
  kind: CommodityKind;
  canonicalUnit: CommodityCanonicalUnit;
}

export interface UnitRatio {
  numerator: string;
  denominator: string | null;
}

export interface NormalizedCommodityInput {
  coefficient: number;
  unit: string;
  canonicalUnit: CommodityCanonicalUnit;
}

const GJ_PER_MWH = 3.6;
const GJ_PER_PJ = 1_000_000;

export const COMMODITY_METADATA: Record<string, CommodityMetadata> = {
  coal: {
    id: 'coal',
    label: 'Coal',
    kind: 'fuel',
    canonicalUnit: 'GJ',
  },
  natural_gas: {
    id: 'natural_gas',
    label: 'Natural gas',
    kind: 'fuel',
    canonicalUnit: 'GJ',
  },
  electricity: {
    id: 'electricity',
    label: 'Electricity',
    kind: 'fuel',
    canonicalUnit: 'MWh',
  },
  refined_liquid_fuels: {
    id: 'refined_liquid_fuels',
    label: 'Refined liquid fuels',
    kind: 'fuel',
    canonicalUnit: 'GJ',
  },
  biomass: {
    id: 'biomass',
    label: 'Biomass',
    kind: 'fuel',
    canonicalUnit: 'GJ',
  },
  hydrogen: {
    id: 'hydrogen',
    label: 'Hydrogen',
    kind: 'fuel',
    canonicalUnit: 'GJ',
  },
  scrap_steel: {
    id: 'scrap_steel',
    label: 'Scrap steel',
    kind: 'material',
    canonicalUnit: 't',
  },
  iron_ore: {
    id: 'iron_ore',
    label: 'Iron ore',
    kind: 'material',
    canonicalUnit: 't',
  },
  capture_service: {
    id: 'capture_service',
    label: 'Capture service',
    kind: 'service',
    canonicalUnit: 'tCO2_stored',
  },
};

export const FUEL_COMMODITY_IDS = Object.values(COMMODITY_METADATA)
  .filter((commodity) => commodity.kind === 'fuel')
  .map((commodity) => commodity.id);

export function getCommodityMetadata(commodityId: string): CommodityMetadata {
  const metadata = COMMODITY_METADATA[commodityId];

  if (!metadata) {
    throw new Error(`Missing commodity metadata for ${JSON.stringify(commodityId)}.`);
  }

  return metadata;
}

export function parseUnitRatio(unit: string): UnitRatio {
  const trimmed = unit.trim();

  if (!trimmed) {
    throw new Error('Commodity input unit is required.');
  }

  const [numeratorRaw, ...rest] = trimmed.split('/');
  const numerator = numeratorRaw.trim();

  if (!numerator) {
    throw new Error(`Malformed commodity input unit ${JSON.stringify(unit)}.`);
  }

  if (rest.length === 0) {
    return { numerator, denominator: null };
  }

  const denominator = rest.join('/').trim();

  if (!denominator) {
    throw new Error(`Malformed commodity input unit ${JSON.stringify(unit)}.`);
  }

  return { numerator, denominator };
}

export function formatUnitRatio(ratio: UnitRatio): string {
  return ratio.denominator ? `${ratio.numerator}/${ratio.denominator}` : ratio.numerator;
}

function normalizeUnitToken(unit: string): string {
  return unit.trim().replaceAll(' ', '_');
}

function normalizeCommodityNumeratorUnit(
  commodityId: string,
  numeratorUnit: string,
): CommodityCanonicalUnit | 'GJ' | 'MWh' | 'PJ' | 't' {
  const normalized = normalizeUnitToken(numeratorUnit);

  if (commodityId === 'capture_service' && normalized === 't') {
    return 'tCO2_stored';
  }

  if (normalized === 'tCO2_stored') {
    return 'tCO2_stored';
  }

  if (normalized === 'GJ' || normalized === 'MWh' || normalized === 'PJ' || normalized === 't') {
    return normalized;
  }

  throw new Error(
    `Unsupported commodity numerator unit ${JSON.stringify(numeratorUnit)} for ${JSON.stringify(commodityId)}.`,
  );
}

function toGj(value: number, unit: 'GJ' | 'MWh' | 'PJ'): number {
  switch (unit) {
    case 'GJ':
      return value;
    case 'MWh':
      return value * GJ_PER_MWH;
    case 'PJ':
      return value * GJ_PER_PJ;
  }
}

function fromGj(value: number, unit: 'GJ' | 'MWh' | 'PJ'): number {
  switch (unit) {
    case 'GJ':
      return value;
    case 'MWh':
      return value / GJ_PER_MWH;
    case 'PJ':
      return value / GJ_PER_PJ;
  }
}

export function convertUnitQuantity(
  value: number,
  fromUnit: CommodityCanonicalUnit | 'GJ' | 'MWh' | 'PJ' | 't',
  toUnit: CommodityCanonicalUnit,
): number {
  if (fromUnit === toUnit) {
    return value;
  }

  if (
    (fromUnit === 'GJ' || fromUnit === 'MWh' || fromUnit === 'PJ')
    && (toUnit === 'GJ' || toUnit === 'MWh' || toUnit === 'PJ')
  ) {
    return fromGj(toGj(value, fromUnit), toUnit);
  }

  throw new Error(`Unsupported unit conversion from ${fromUnit} to ${toUnit}.`);
}

export function normalizeCommodityInput(
  commodityId: string,
  coefficient: number,
  unit: string,
): NormalizedCommodityInput {
  const metadata = getCommodityMetadata(commodityId);
  const ratio = parseUnitRatio(unit);
  const fromUnit = normalizeCommodityNumeratorUnit(commodityId, ratio.numerator);
  const normalizedCoefficient = convertUnitQuantity(coefficient, fromUnit, metadata.canonicalUnit);

  return {
    coefficient: normalizedCoefficient,
    unit: formatUnitRatio({
      numerator: metadata.canonicalUnit,
      denominator: ratio.denominator,
    }),
    canonicalUnit: metadata.canonicalUnit,
  };
}
