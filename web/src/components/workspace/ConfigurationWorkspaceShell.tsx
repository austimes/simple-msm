import React, { type ReactNode } from 'react';

export interface ConfigurationWorkspaceShellProps {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftSidebar: ReactNode;
  center: ReactNode;
  rightSidebar: ReactNode;
}

interface WorkspaceSidebarFrameProps {
  side: 'left' | 'right';
  title: string;
  bodyId: string;
  collapsed: boolean;
  onToggle: () => void;
  collapseLabel: string;
  expandLabel: string;
  children: ReactNode;
}

function WorkspaceSidebarFrame({
  side,
  title,
  bodyId,
  collapsed,
  onToggle,
  collapseLabel,
  expandLabel,
  children,
}: WorkspaceSidebarFrameProps) {
  const isLeft = side === 'left';
  const toggleLabel = collapsed ? expandLabel : collapseLabel;
  const toggleGlyph = collapsed
    ? (isLeft ? '>' : '<')
    : (isLeft ? '<' : '>');

  return (
    <aside
      className={`workspace-sidebar workspace-sidebar--${side}${collapsed ? ' workspace-sidebar--collapsed' : ''}`}
    >
      {collapsed ? (
        <div className="workspace-sidebar__rail">
          <button
            type="button"
            className="workspace-sidebar__toggle workspace-sidebar__toggle--rail"
            aria-label={toggleLabel}
            aria-expanded={false}
            aria-controls={bodyId}
            onClick={onToggle}
            title={toggleLabel}
          >
            <span aria-hidden="true">{toggleGlyph}</span>
          </button>
        </div>
      ) : (
        <div className="workspace-sidebar__header">
          <h2 className="workspace-sidebar__title">{title}</h2>
          <button
            type="button"
            className="workspace-sidebar__toggle"
            aria-label={toggleLabel}
            aria-expanded={true}
            aria-controls={bodyId}
            onClick={onToggle}
            title={toggleLabel}
          >
            <span aria-hidden="true">{toggleGlyph}</span>
          </button>
        </div>
      )}
      <div
        id={bodyId}
        className="workspace-sidebar__body"
        hidden={collapsed}
        aria-hidden={collapsed}
      >
        {children}
      </div>
    </aside>
  );
}

export default function ConfigurationWorkspaceShell({
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  leftSidebar,
  center,
  rightSidebar,
}: ConfigurationWorkspaceShellProps) {
  return (
    <div
      className={`workspace-layout${leftCollapsed ? ' workspace-layout--left-collapsed' : ''}${rightCollapsed ? ' workspace-layout--right-collapsed' : ''}`}
    >
      <WorkspaceSidebarFrame
        side="left"
        title="Controls"
        bodyId="workspace-left-sidebar-body"
        collapsed={leftCollapsed}
        onToggle={onToggleLeft}
        collapseLabel="Collapse controls sidebar"
        expandLabel="Expand controls sidebar"
      >
        {leftSidebar}
      </WorkspaceSidebarFrame>

      <React.Fragment>{center}</React.Fragment>

      <WorkspaceSidebarFrame
        side="right"
        title="State Selector"
        bodyId="workspace-right-sidebar-body"
        collapsed={rightCollapsed}
        onToggle={onToggleRight}
        collapseLabel="Collapse state selector sidebar"
        expandLabel="Expand state selector sidebar"
      >
        {rightSidebar}
      </WorkspaceSidebarFrame>
    </div>
  );
}
