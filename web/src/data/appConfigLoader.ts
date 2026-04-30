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
    output_roles: {},
    baseline_activity_anchors: {},
    demand_growth_presets: {},
    commodity_price_presets: {},
    carbon_price_presets: {},
    explanation_tag_rules: parseJsonObject(
      explanationTagRulesText,
      'explanation_tag_rules.json',
    ),
  };
}
