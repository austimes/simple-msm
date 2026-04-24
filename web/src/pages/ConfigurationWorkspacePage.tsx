import React, { useMemo } from 'react';
import { useConfigurationSolve } from '../hooks/useConfigurationSolve';
import { useAvailableConfigurations } from '../hooks/useAvailableConfigurations.ts';
import LeftSidebar from '../components/workspace/LeftSidebar';
import RightSidebar from '../components/workspace/RightSidebar';
import ConfigurationWorkspaceCenter from '../components/workspace/ConfigurationWorkspaceCenter';
import ConfigurationWorkspaceShell from '../components/workspace/ConfigurationWorkspaceShell';
import { resolveWorkspacePair } from '../data/configurationPairModel.ts';
import { useAppUiStore } from '../data/appUiStore.ts';
import { usePackageStore } from '../data/packageStore.ts';

void React;

export default function ConfigurationWorkspacePage() {
  const currentConfiguration = usePackageStore((state) => state.currentConfiguration);
  const activeConfigurationId = usePackageStore((state) => state.activeConfigurationId);
  const appConfig = usePackageStore((state) => state.appConfig);
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const autonomousEfficiencyTracks = usePackageStore((state) => state.autonomousEfficiencyTracks);
  const efficiencyPackages = usePackageStore((state) => state.efficiencyPackages);
  const residualOverlays2025 = usePackageStore((state) => state.residualOverlays2025);
  const focusSolve = useConfigurationSolve(currentConfiguration);
  const { configurations, configurationsById } = useAvailableConfigurations();
  const { leftCollapsed, rightCollapsed, comparison, systemFlow } = useAppUiStore((state) => state.workspace);
  const updateWorkspaceUi = useAppUiStore((state) => state.updateWorkspaceUi);
  const workspacePair = useMemo(
    () => resolveWorkspacePair({
      activeConfigurationId,
      baseSelectionMode: comparison.baseSelectionMode,
      configurationsById,
      focusConfiguration: currentConfiguration,
      focusConfigId: activeConfigurationId,
      packageData: {
        appConfig,
        sectorStates,
        autonomousEfficiencyTracks,
        efficiencyPackages,
        residualOverlays2025,
      },
      selectedBaseConfigId: comparison.selectedBaseConfigId,
    }),
    [
      activeConfigurationId,
      appConfig,
      autonomousEfficiencyTracks,
      comparison.baseSelectionMode,
      comparison.selectedBaseConfigId,
      configurationsById,
      currentConfiguration,
      efficiencyPackages,
      residualOverlays2025,
      sectorStates,
    ],
  );
  const baseSolve = useConfigurationSolve(workspacePair.base?.configuration ?? null);

  return (
    <ConfigurationWorkspaceShell
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      onToggleLeft={() => updateWorkspaceUi({ leftCollapsed: !leftCollapsed })}
      onToggleRight={() => updateWorkspaceUi({ rightCollapsed: !rightCollapsed })}
      leftSidebar={<LeftSidebar />}
      center={(
        <ConfigurationWorkspaceCenter
          baseConfigId={workspacePair.baseConfigId}
          baseSelectionMode={workspacePair.baseSelectionMode}
          baseSolve={baseSolve}
          commonComparisonYears={workspacePair.commonYears}
          comparisonEnabled={workspacePair.comparisonEnabled}
          efficiencyAttributionSafe={workspacePair.efficiencyAttributionSafe}
          configurationOptions={configurations.map((configuration) => ({
            id: configuration.app_metadata?.id ?? configuration.name,
            label: configuration.name,
          }))}
          focusConfigurationLabel={workspacePair.focus.label}
          focusSolve={focusSolve}
          fuelSwitchBasis={comparison.fuelSwitchBasis}
          onBaseConfigChange={(configId) => updateWorkspaceUi({
            comparison: {
              ...comparison,
              selectedBaseConfigId: configId,
            },
          })}
          onBaseSelectionModeChange={(mode) => updateWorkspaceUi({
            comparison: {
              ...comparison,
              baseSelectionMode: mode,
            },
          })}
          onFuelSwitchBasisChange={(basis) => updateWorkspaceUi({
            comparison: {
              ...comparison,
              fuelSwitchBasis: basis,
            },
          })}
          onFuelSwitchYearChange={(year) => updateWorkspaceUi({
            comparison: {
              ...comparison,
              selectedFuelSwitchYear: year,
            },
          })}
          onSystemFlowChange={(updates) => updateWorkspaceUi({
            systemFlow: {
              ...systemFlow,
              ...updates,
            },
          })}
          selectedFuelSwitchYear={comparison.selectedFuelSwitchYear}
          systemFlow={systemFlow}
        />
      )}
      rightSidebar={<RightSidebar />}
    />
  );
}
