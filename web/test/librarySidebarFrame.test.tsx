import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LibrarySidebarFrame from '../src/pages/library/LibrarySidebarFrame.tsx';

describe('LibrarySidebarFrame', () => {
  test('renders an expanded sidebar with a title, visible body, and collapse control', () => {
    const html = renderToStaticMarkup(
      <LibrarySidebarFrame
        collapsed={false}
        onToggle={() => {}}
        title="Scope"
        bodyId="library-sidebar-body"
      >
        <div>Filter content</div>
      </LibrarySidebarFrame>,
    );

    assert.match(html, /class="library-sidebar"/);
    assert.match(html, />Scope</);
    assert.match(html, /aria-label="Collapse scope sidebar"/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /id="library-sidebar-body"/);
    assert.doesNotMatch(html, /workspace-sidebar/);
    assert.match(html, /Filter content/);
  });

  test('renders a collapsed rail control and hidden body when collapsed', () => {
    const html = renderToStaticMarkup(
      <LibrarySidebarFrame
        collapsed={true}
        onToggle={() => {}}
        title="Scope"
        bodyId="library-sidebar-body"
      >
        <div>Filter content</div>
      </LibrarySidebarFrame>,
    );

    assert.match(html, /library-sidebar library-sidebar--collapsed/);
    assert.match(html, /class="library-sidebar__rail"/);
    assert.match(html, /aria-label="Expand scope sidebar"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /id="library-sidebar-body" class="library-sidebar__body" hidden="" aria-hidden="true"/);
    assert.match(html, /Filter content/);
  });
});
