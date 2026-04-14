import outputRolesText from '../app_config/output_roles.json?raw';
import baselineActivityAnchorsText from '../app_config/baseline_activity_anchors.json?raw';
import demandGrowthPresetsText from '../app_config/demand_growth_presets.json?raw';
import commodityPricePresetsText from '../app_config/commodity_price_presets.json?raw';
import carbonPricePresetsText from '../app_config/carbon_price_presets.json?raw';
import explanationTagRulesText from '../app_config/explanation_tag_rules.json?raw';
import type { AppConfigRegistry } from './types.ts';

function parseJsonObject<T>(raw: unknown, label: string): T {
  if (raw && typeof raw === 'object') {
    return raw as T;
  }

  try {
    return JSON.parse(String(raw)) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown parse failure';
    throw new Error(`Failed to parse ${label}: ${detail}`);
  }
}

export function loadAppConfig(): AppConfigRegistry {
  return {
    output_roles: parseJsonObject(outputRolesText, 'output_roles.json'),
    baseline_activity_anchors: parseJsonObject(
      baselineActivityAnchorsText,
      'baseline_activity_anchors.json',
    ),
    demand_growth_presets: parseJsonObject(
      demandGrowthPresetsText,
      'demand_growth_presets.json',
    ),
    commodity_price_presets: parseJsonObject(
      commodityPricePresetsText,
      'commodity_price_presets.json',
    ),
    carbon_price_presets: parseJsonObject(
      carbonPricePresetsText,
      'carbon_price_presets.json',
    ),
    explanation_tag_rules: parseJsonObject(
      explanationTagRulesText,
      'explanation_tag_rules.json',
    ),
  };
}
