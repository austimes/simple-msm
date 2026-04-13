import type { ConfigurationDocument } from './types.ts';

type ConfigurationIdCarrier = Pick<ConfigurationDocument, 'app_metadata'> & {
  id?: unknown;
};

export function getConfigurationDocumentId(configuration: ConfigurationIdCarrier): string | null {
  const appMetadataId = configuration.app_metadata?.id;
  if (typeof appMetadataId === 'string' && appMetadataId.trim()) {
    return appMetadataId.trim();
  }

  if (typeof configuration.id === 'string' && configuration.id.trim()) {
    return configuration.id.trim();
  }

  return null;
}
