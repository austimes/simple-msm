import { useState } from 'react';
import { useConfigurationSolve } from '../hooks/useConfigurationSolve';
import LeftSidebar from '../components/workspace/LeftSidebar';
import RightSidebar from '../components/workspace/RightSidebar';
import ConfigurationWorkspaceCenter from '../components/workspace/ConfigurationWorkspaceCenter';
import ConfigurationWorkspaceShell from '../components/workspace/ConfigurationWorkspaceShell';

export default function ConfigurationWorkspacePage() {
  const solveState = useConfigurationSolve();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <ConfigurationWorkspaceShell
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      onToggleLeft={() => setLeftCollapsed((collapsed) => !collapsed)}
      onToggleRight={() => setRightCollapsed((collapsed) => !collapsed)}
      leftSidebar={<LeftSidebar />}
      center={<ConfigurationWorkspaceCenter {...solveState} />}
      rightSidebar={<RightSidebar />}
    />
  );
}
