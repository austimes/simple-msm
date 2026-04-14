import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getConfigurationSaveActionState } from '../src/components/workspace/leftSidebarSaveActions.ts';

describe('getConfigurationSaveActionState', () => {
  test('enables Save for dirty user configurations', () => {
    assert.deepEqual(
      getConfigurationSaveActionState({
        activeConfigurationId: 'user-buildings',
        activeConfigurationReadonly: false,
        isConfigurationDirty: true,
      }),
      {
        canSave: true,
        disabledReason: null,
      },
    );
  });

  test('disables Save for clean user configurations', () => {
    assert.deepEqual(
      getConfigurationSaveActionState({
        activeConfigurationId: 'user-buildings',
        activeConfigurationReadonly: false,
        isConfigurationDirty: false,
      }),
      {
        canSave: false,
        disabledReason: 'Change this user configuration to enable Save.',
      },
    );
  });

  test('disables Save for dirty built-in configurations', () => {
    assert.deepEqual(
      getConfigurationSaveActionState({
        activeConfigurationId: 'reference-base',
        activeConfigurationReadonly: true,
        isConfigurationDirty: true,
      }),
      {
        canSave: false,
        disabledReason: 'Built-in configurations can only be stored with Save As.',
      },
    );
  });

  test('disables Save when no named base configuration is active', () => {
    assert.deepEqual(
      getConfigurationSaveActionState({
        activeConfigurationId: null,
        activeConfigurationReadonly: false,
        isConfigurationDirty: true,
      }),
      {
        canSave: false,
        disabledReason: 'Save is available after you load or create a named user configuration.',
      },
    );
  });
});
