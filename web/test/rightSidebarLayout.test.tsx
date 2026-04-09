import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildStateCatalog } from '../src/data/configurationWorkspaceModel.ts';
import RightSidebarContent from '../src/components/workspace/RightSidebarContent.tsx';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { deriveRightSidebarTree } from '../src/components/workspace/rightSidebarTree.ts';
import {
  buildConfiguration,
  loadPkg,
} from './solverTestUtils.mjs';

const pkg = loadPkg();

describe('RightSidebarContent', () => {
  test('renders the legend after the real state cards', () => {
    const configuration = buildConfiguration(pkg.appConfig);
    const catalog = buildStateCatalog(pkg.sectorStates, pkg.appConfig);
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const tree = deriveRightSidebarTree(catalog, statuses, new Set(), new Set());
    const firstOutputLabel = catalog[0]?.subsectors[0]?.outputLabel;

    assert.ok(firstOutputLabel, 'expected at least one state selector card');

    const html = renderToStaticMarkup(
      <RightSidebarContent
        tree={tree}
        onToggleExpandedSector={() => {}}
        onToggleExpandedSubsector={() => {}}
        onToggleStateEnabled={() => {}}
      />,
    );

    assert.ok(
      html.indexOf(firstOutputLabel) < html.indexOf('aria-label="State selector status legend"'),
      'expected legend to render after the first real state selector card',
    );
  });
});
