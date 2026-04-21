import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RightSidebarSectorNode } from '../src/components/workspace/rightSidebarTree.ts';
import { buildStateCatalog } from '../src/data/configurationWorkspaceModel.ts';
import RightSidebarContent from '../src/components/workspace/RightSidebarContent.tsx';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { deriveRightSidebarTree } from '../src/components/workspace/rightSidebarTree.ts';
import { formatWorkspacePillLabel } from '../src/components/workspace/workspacePillLabel.ts';
import {
  buildConfiguration,
  loadPkg,
} from './solverTestUtils.mjs';

const pkg = loadPkg();

function findElement(
  element: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): React.ReactElement | null {
  if (!React.isValidElement(element)) {
    return null;
  }

  if (predicate(element)) {
    return element;
  }

  for (const child of React.Children.toArray(element.props.children)) {
    const found = findElement(child, predicate);
    if (found) {
      return found;
    }
  }

  return null;
}

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
        onSetAutonomousEfficiencyForOutput={() => {}}
        onSetEfficiencyPackageEnabled={() => {}}
        onSetAllEfficiencyPackagesForOutput={() => {}}
      />,
    );

    assert.ok(
      html.indexOf(firstOutputLabel) < html.indexOf('aria-label="State selector status legend"'),
      'expected legend to render after the first real state selector card',
    );
    assert.doesNotMatch(html, /<h2>State Selector<\/h2>/);
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
        onSetAutonomousEfficiencyForOutput={() => {}}
        onSetEfficiencyPackageEnabled={() => {}}
        onSetAllEfficiencyPackagesForOutput={() => {}}
      />,
    );

    assert.match(html, new RegExp(formatWorkspacePillLabel('Incumbent thermal-heavy grid mix')));
    assert.match(html, /title="Incumbent thermal-heavy grid mix"/);
    assert.match(html, /Deep-clean firmed grid supply/);
    assert.doesNotMatch(html, />Active</);
    assert.doesNotMatch(html, />Inactive</);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /aria-pressed="false"/);
  });

  test('renders subsector efficiency controls and wires package toggles', () => {
    const tree: RightSidebarSectorNode[] = [
      {
        sector: 'buildings',
        subsectors: [
          {
            subsector: 'residential',
            outputId: 'residential_building_services',
            outputLabel: 'Residential buildings',
            states: [
              {
                stateId: 'buildings__residential__deep_electric',
                stateLabel: 'Deep electric',
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
            activeStateIds: ['buildings__residential__deep_electric'],
            allDisabled: false,
            pathwaysInactive: false,
            outOfScope: false,
            canCollapse: false,
            isCollapsed: false,
            efficiencyControls: {
              outputId: 'residential_building_services',
              hasControls: true,
              autonomousTracks: [
                {
                  trackId: 'background',
                  label: 'Background',
                  enabled: true,
                  applicableStateIds: ['buildings__residential__deep_electric'],
                },
              ],
              packages: [
                {
                  packageId: 'shell_retrofit',
                  label: 'Shell retrofit',
                  classification: 'pure_efficiency_overlay',
                  enabled: true,
                  applicableStateIds: ['buildings__residential__deep_electric'],
                  nonStackingGroup: 'retrofit',
                  maxShareByYear: { 2030: 0.3 },
                },
              ],
              embodiedStateIds: ['buildings__residential__deep_electric'],
            },
          },
          {
            subsector: 'empty',
            outputId: 'empty_output',
            outputLabel: 'No artifacts',
            states: [{ stateId: 'empty_state', stateLabel: 'Empty state' }],
            status: undefined,
            presentation: {
              summary: 'Has active pathways and participates in this solve.',
              detail: 'Has active pathways and participates in this solve.',
              badges: [],
              isDimmed: false,
              arePathwaysInactive: false,
            },
            badges: [],
            activeStateIds: ['empty_state'],
            allDisabled: false,
            pathwaysInactive: false,
            outOfScope: false,
            canCollapse: false,
            isCollapsed: false,
            efficiencyControls: {
              outputId: 'empty_output',
              hasControls: false,
              autonomousTracks: [],
              packages: [],
              embodiedStateIds: [],
            },
          },
        ],
        isExcluded: false,
        isCollapsed: false,
      },
    ];
    let packageToggle;

    const props = {
      tree,
      onToggleExpandedSector: () => {},
      onToggleExpandedSubsector: () => {},
      onToggleStateActive: () => {},
      onSetAutonomousEfficiencyForOutput: () => {},
      onSetEfficiencyPackageEnabled: (packageId: string, enabled: boolean) => {
        packageToggle = { packageId, enabled };
      },
      onSetAllEfficiencyPackagesForOutput: () => {},
    };
    const element = <RightSidebarContent {...props} />;
    const html = renderToStaticMarkup(element);

    assert.equal(html.match(/workspace-efficiency-controls/g)?.length, 1);
    assert.match(html, /Autonomous/);
    assert.match(html, /Shell retrofit/);
    assert.match(html, /Pure/);
    assert.match(html, /Embodied/);
    assert.match(html, /Controlled by pathway state/);

    const packageButton = findElement(RightSidebarContent(props), (candidate) => {
      return candidate.type === 'button'
        && typeof candidate.props.className === 'string'
        && candidate.props.className.includes('workspace-efficiency-package');
    });
    assert.ok(packageButton, 'expected package toggle button');

    packageButton.props.onClick();
    assert.deepEqual(packageToggle, {
      packageId: 'shell_retrofit',
      enabled: false,
    });
  });
});
