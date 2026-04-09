export interface ConfigurationSaveActionState {
  canSave: boolean;
  disabledReason: string | null;
}

export interface ConfigurationSaveActionInputs {
  activeConfigurationId: string | null;
  activeConfigurationReadonly: boolean;
  isConfigurationDirty: boolean;
}

export function getConfigurationSaveActionState({
  activeConfigurationId,
  activeConfigurationReadonly,
  isConfigurationDirty,
}: ConfigurationSaveActionInputs): ConfigurationSaveActionState {
  if (!activeConfigurationId) {
    return {
      canSave: false,
      disabledReason: 'Save is available after you load or create a named user configuration.',
    };
  }

  if (activeConfigurationReadonly) {
    return {
      canSave: false,
      disabledReason: isConfigurationDirty
        ? 'Built-in configurations can only be stored with Save As.'
        : 'Change this configuration and use Save As to create a user copy.',
    };
  }

  if (!isConfigurationDirty) {
    return {
      canSave: false,
      disabledReason: 'Change this user configuration to enable Save.',
    };
  }

  return {
    canSave: true,
    disabledReason: null,
  };
}
