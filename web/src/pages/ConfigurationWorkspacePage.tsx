import { useConfigurationSolve } from '../hooks/useConfigurationSolve';
import LeftSidebar from '../components/workspace/LeftSidebar';
import RightSidebar from '../components/workspace/RightSidebar';
import ConfigurationWorkspaceCenter from '../components/workspace/ConfigurationWorkspaceCenter';

export default function ConfigurationWorkspacePage() {
  const solveState = useConfigurationSolve();

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar workspace-sidebar--left">
        <LeftSidebar />
      </aside>

      <ConfigurationWorkspaceCenter {...solveState} />

      <aside className="workspace-sidebar workspace-sidebar--right">
        <RightSidebar />
      </aside>
    </div>
  );
}
