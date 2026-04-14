import { getConfigurationId } from '../data/configurationLoader.ts';
import type { ConfigurationDocument } from '../data/types.ts';

export function selectInitialAdditionalityPair(
  configurations: ConfigurationDocument[],
): { baseConfigId: string | null; targetConfigId: string | null } {
  const ids = configurations
    .map((configuration) => getConfigurationId(configuration))
    .filter((id): id is string => id != null);

  if (ids.includes('the-base-case') && ids.includes('the-full-monty')) {
    return {
      baseConfigId: 'the-base-case',
      targetConfigId: 'the-full-monty',
    };
  }

  return {
    baseConfigId: ids[0] ?? null,
    targetConfigId: ids.find((id) => id !== ids[0]) ?? ids[0] ?? null,
  };
}
