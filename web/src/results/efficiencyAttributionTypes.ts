export type EfficiencyAttributionCategory =
  | 'autonomous_efficiency'
  | 'pure_efficiency_package'
  | 'operational_efficiency_package'
  | 'embodied_efficiency';

export type EfficiencyAttributionComponentMap =
  Partial<Record<EfficiencyAttributionCategory, number>>;
