import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConfigurationWorkspaceShell from '../src/components/workspace/ConfigurationWorkspaceShell.tsx';

describe('ConfigurationWorkspaceShell', () => {
  test('renders expanded sidebars with titles and collapse controls', () => {
    const html = renderToStaticMarkup(
      <ConfigurationWorkspaceShell
        leftCollapsed={false}
        rightCollapsed={false}
        onToggleLeft={() => {}}
        onToggleRight={() => {}}
        leftSidebar={<div>Left content</div>}
        center={<main>Center content</main>}
        rightSidebar={<div>Right content</div>}
      />,
    );

    assert.match(html, /class="workspace-layout"/);
    assert.match(html, />Controls</);
    assert.match(html, />State Selector</);
    assert.match(html, /aria-label="Collapse controls sidebar"/);
    assert.match(html, /aria-label="Collapse state selector sidebar"/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /id="workspace-left-sidebar-body"/);
    assert.match(html, /id="workspace-right-sidebar-body"/);
  });

  test('renders hidden sidebar bodies and expand controls when collapsed', () => {
    const html = renderToStaticMarkup(
      <ConfigurationWorkspaceShell
        leftCollapsed={true}
        rightCollapsed={true}
        onToggleLeft={() => {}}
        onToggleRight={() => {}}
        leftSidebar={<div>Left content</div>}
        center={<main>Center content</main>}
        rightSidebar={<div>Right content</div>}
      />,
    );

    assert.match(html, /workspace-layout workspace-layout--left-collapsed workspace-layout--right-collapsed/);
    assert.match(html, /aria-label="Expand controls sidebar"/);
    assert.match(html, /aria-label="Expand state selector sidebar"/);
    assert.match(html, /id="workspace-left-sidebar-body" class="workspace-sidebar__body" hidden="" aria-hidden="true"/);
    assert.match(html, /id="workspace-right-sidebar-body" class="workspace-sidebar__body" hidden="" aria-hidden="true"/);
    assert.equal((html.match(/workspace-sidebar__rail/g) ?? []).length, 2);
    assert.match(html, /Left content/);
    assert.match(html, /Right content/);
  });
});
