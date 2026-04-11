import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RightSidebarSectorNode } from '../src/components/workspace/rightSidebarTree.ts';
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
        onToggleStateActive={() => {}}
      />,
    );

    assert.ok(
      html.indexOf(firstOutputLabel) < html.indexOf('aria-label="State selector status legend"'),
      'expected legend to render after the first real state selector card',
    );
  });

  test('renders pathway pills without visible active or inactive suffixes', () => {
    const tree: RightSidebarSectorNode[] = [
      {
        sector: 'electricity_supply',
        subsectors: [
          {
            subsector: 'electricity_supply',
            outputId: 'electricity_supply',
            outputLabel: 'Electricity supply',
            states: [
              {
                stateId: 'incumbent_thermal_heavy_grid_mix',
                stateLabel: 'Incumbent thermal-heavy grid mix',
              },
              {
                stateId: 'deep_clean_firmed_grid_supply',
                stateLabel: 'Deep-clean firmed grid supply',
              },
            ],
            status: undefined,
            presentation: {
              summary: 'Has active pathways and participates in this solve.',
              detail: 'Has active pathways and participates in this solve.',
              badges: [],
              isDimmed: false,
              arePathwaysInactive: false,
            },
            badges: [],
            activeStateIds: ['incumbent_thermal_heavy_grid_mix'],
            allDisabled: false,
            pathwaysInactive: false,
            outOfScope: false,
            canCollapse: false,
            isCollapsed: false,
          },
        ],
        isExcluded: false,
        isCollapsed: false,
      },
    ];

    const html = renderToStaticMarkup(
      <RightSidebarContent
        tree={tree}
        onToggleExpandedSector={() => {}}
        onToggleExpandedSubsector={() => {}}
        onToggleStateActive={() => {}}
      />,
    );

    assert.match(html, /Incumbent thermal-heavy grid mix/);
    assert.match(html, /Deep-clean firmed grid supply/);
    assert.doesNotMatch(html, />Active</);
    assert.doesNotMatch(html, />Inactive</);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /aria-pressed="false"/);
  });
});
