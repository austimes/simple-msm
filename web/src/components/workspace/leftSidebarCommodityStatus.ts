import type { PriceLevel, ScenarioControlMode } from '../../data/types';
import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';

export type CommodityModeBadgeTone = 'externalized' | 'modeled';

export interface CommodityPriceSelectorPresentation {
  badgeLabel: string | null;
  badgeTone: CommodityModeBadgeTone | null;
  controlModeLabel: string | null;
  detail: string | null;
  selectorEnabled: boolean;
  activeLevel: PriceLevel | null;
}

export function formatControlModeLabel(mode: ScenarioControlMode): string {
  switch (mode) {
    case 'fixed_shares':
      return 'exact shares';
    default:
      return mode.replaceAll('_', ' ');
  }
}

export function formatSharePercent(share: number): string {
  const percent = share * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function sumFixedShares(fixedShares: Record<string, number> | null | undefined): number {
  return Object.values(fixedShares ?? {}).reduce((total, share) => total + share, 0);
}

export function getCommodityPriceSelectorPresentation(
  status: DerivedOutputRunStatus | undefined,
  activeLevel: PriceLevel,
): CommodityPriceSelectorPresentation {
  if (!status || status.outputRole !== 'endogenous_supply_commodity') {
    return {
      badgeLabel: null,
      badgeTone: null,
      controlModeLabel: null,
      detail: null,
      selectorEnabled: true,
      activeLevel,
    };
  }

  if (status.controlMode === 'externalized') {
    return {
      badgeLabel: 'externalized',
      badgeTone: 'externalized',
      controlModeLabel: 'externalized',
      detail: 'Current supply mode: externalized. Scenario price selection is active.',
      selectorEnabled: true,
      activeLevel,
    };
  }

  const controlModeLabel = formatControlModeLabel(status.controlMode);
  return {
    badgeLabel: 'in model',
    badgeTone: 'modeled',
    controlModeLabel,
    detail: `Current supply mode: ${controlModeLabel}. Scenario price selection is inactive while supply stays in model.`,
    selectorEnabled: false,
    activeLevel: null,
  };
}
