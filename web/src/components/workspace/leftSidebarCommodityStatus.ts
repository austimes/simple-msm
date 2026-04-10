import type { PriceLevel, ConfigurationControlMode } from '../../data/types';
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

export function formatControlModeLabel(mode: ConfigurationControlMode): string {
  return mode.replaceAll('_', ' ');
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
      detail: 'Current supply mode: externalized. Configuration price selection is active.',
      selectorEnabled: true,
      activeLevel,
    };
  }

  const controlModeLabel = formatControlModeLabel(status.controlMode);
  return {
    badgeLabel: 'in model',
    badgeTone: 'modeled',
    controlModeLabel,
    detail: `Current supply mode: ${controlModeLabel}. Configuration price selection is inactive while supply stays in model.`,
    selectorEnabled: false,
    activeLevel: null,
  };
}
