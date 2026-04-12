import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Run' },
  { to: '/compare', label: 'Compare' },
  { to: '/library', label: 'Library' },
  { to: '/state-schema', label: 'State Schema' },
  { to: '/methods', label: 'Methods' },
] as const;

export default function AppLayout(): React.JSX.Element {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-title">Phase 1 Sector State Explorer</div>
        <nav className="app-nav">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-link${isActive ? ' nav-link--active' : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
