import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchUserConfigurations,
  getConfigurationId,
  loadBuiltinConfigurations,
  loadUserConfigurations,
} from '../data/configurationLoader.ts';
import type { ConfigurationDocument } from '../data/types.ts';

export interface AvailableConfigurationsState {
  configurations: ConfigurationDocument[];
  configurationsById: Record<string, ConfigurationDocument>;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

function dedupeConfigurations(configurations: ConfigurationDocument[]): ConfigurationDocument[] {
  const deduped = new Map<string, ConfigurationDocument>();

  for (const configuration of configurations) {
    const id = getConfigurationId(configuration) ?? configuration.name;
    deduped.set(id, configuration);
  }

  return Array.from(deduped.values())
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function useAvailableConfigurations(): AvailableConfigurationsState {
  const builtinConfigurations = useMemo(() => loadBuiltinConfigurations(), []);
  const [userConfigurations, setUserConfigurations] = useState(() => loadUserConfigurations());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      setUserConfigurations(await fetchUserConfigurations());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const configurations = useMemo(
    () => dedupeConfigurations([...builtinConfigurations, ...userConfigurations]),
    [builtinConfigurations, userConfigurations],
  );
  const configurationsById = useMemo(
    () => Object.fromEntries(
      configurations.map((configuration) => [
        getConfigurationId(configuration) ?? configuration.name,
        configuration,
      ]),
    ),
    [configurations],
  );

  return {
    configurations,
    configurationsById,
    isRefreshing,
    refresh,
  };
}
