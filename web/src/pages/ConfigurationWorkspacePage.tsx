import React from 'react';
import { useConfigurationSolve } from '../hooks/useConfigurationSolve';
import LeftSidebar from '../components/workspace/LeftSidebar';
import RightSidebar from '../components/workspace/RightSidebar';
import ConfigurationWorkspaceCenter from '../components/workspace/ConfigurationWorkspaceCenter';
import ConfigurationWorkspaceShell from '../components/workspace/ConfigurationWorkspaceShell';
import { useAppUiStore } from '../data/appUiStore.ts';

void React;

export default function ConfigurationWorkspacePage() {
  const solveState = useConfigurationSolve();
  const { leftCollapsed, rightCollapsed } = useAppUiStore((state) => state.workspace);
  const updateWorkspaceUi = useAppUiStore((state) => state.updateWorkspaceUi);

  return (
    <ConfigurationWorkspaceShell
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      onToggleLeft={() => updateWorkspaceUi({ leftCollapsed: !leftCollapsed })}
      onToggleRight={() => updateWorkspaceUi({ rightCollapsed: !rightCollapsed })}
      leftSidebar={<LeftSidebar />}
      center={<ConfigurationWorkspaceCenter {...solveState} />}
      rightSidebar={<RightSidebar />}
    />
  );
}
