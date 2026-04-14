import * as React from 'react';

export interface LibrarySidebarFrameProps {
  collapsed: boolean;
  onToggle: () => void;
  title: string;
  bodyId: string;
  children: React.ReactNode;
}

export default function LibrarySidebarFrame({
  collapsed,
  onToggle,
  title,
  bodyId,
  children,
}: LibrarySidebarFrameProps): React.JSX.Element {
  const normalizedTitle = title.trim().toLowerCase();
  const toggleLabel = collapsed
    ? `Expand ${normalizedTitle} sidebar`
    : `Collapse ${normalizedTitle} sidebar`;
  const toggleGlyph = collapsed ? '>' : '<';

  return (
    <aside className={`library-sidebar${collapsed ? ' library-sidebar--collapsed' : ''}`}>
      {collapsed ? (
        <div className="library-sidebar__rail">
          <button
            type="button"
            className="library-sidebar__toggle library-sidebar__toggle--rail"
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
        <div className="library-sidebar__header">
          <h2 className="library-sidebar__title">{title}</h2>
          <button
            type="button"
            className="library-sidebar__toggle"
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
        className="library-sidebar__body"
        hidden={collapsed}
        aria-hidden={collapsed}
      >
        {children}
      </div>
    </aside>
  );
}
