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
        onSetResidualOverlayIncluded={() => {}}
        onSetResidualOverlayGroupIncluded={() => {}}
      />,
    );

    assert.ok(
      html.indexOf(firstOutputLabel) < html.indexOf('aria-label="System structure status legend"'),
      'expected legend to render after the first real system structure card',
    );
    assert.doesNotMatch(html, /<h2>System Structure<\/h2>/);
  });

  test('renders route pills without visible active or inactive suffixes', () => {
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
        onSetResidualOverlayIncluded={() => {}}
        onSetResidualOverlayGroupIncluded={() => {}}
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
      onSetResidualOverlayIncluded: () => {},
      onSetResidualOverlayGroupIncluded: () => {},
    };
    const element = <RightSidebarContent {...props} />;
    const html = renderToStaticMarkup(element);

    assert.equal(html.match(/workspace-efficiency-controls/g)?.length, 1);
    assert.match(html, /Autonomous/);
    assert.match(html, /Shell retrofit/);
    assert.match(html, /Pure efficiency package/);
    assert.match(html, /Embodied/);
    assert.match(html, /Controlled by route/);

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

  test('renders residual groups separately from route chips and wires toggles', () => {
    const tree: RightSidebarSectorNode[] = [
      {
        sector: 'buildings',
        label: 'Buildings',
        subsectors: [
          {
            subsector: 'residential',
            outputId: 'residential_building_services',
            outputLabel: 'Residential buildings',
            states: [
              {
                stateId: 'buildings__residential__incumbent_mixed_fuels',
                stateLabel: 'Incumbent mixed fuels',
              },
            ],
            status: undefined,
            presentation: {
              detail: 'Has active routes and participates in this solve.',
              badges: [],
              isDimmed: false,
              isDisabled: false,
              arePathwaysInactive: false,
            },
            badges: [],
            activeStateIds: ['buildings__residential__incumbent_mixed_fuels'],
            allDisabled: false,
            pathwaysInactive: false,
            outOfScope: false,
            canCollapse: false,
            isCollapsed: false,
          },
        ],
        residualOverlayIds: ['residential_other'],
        residualGroup: {
          groupId: 'buildings',
          label: 'Residuals',
          includedCount: 1,
          totalCount: 1,
          allIncluded: true,
          allExcluded: false,
          residuals: [
            {
              overlayId: 'residential_other',
              overlayLabel: 'Residual residential other',
              overlayDomain: 'energy_residual',
              officialAccountingBucket: 'Residential',
              commodityCount: 2,
              totalEnergyPJ: 12,
              totalEmissionsMt: 0.8,
              totalCostM: 4,
              defaultInclude: true,
              proxyOutputIds: ['residential_building_services'],
              proxyOutputLabels: ['Residential buildings'],
              included: true,
            },
          ],
        },
        isExcluded: false,
        isCollapsed: false,
      },
    ];
    let residualToggle;
    let groupToggle;
    const props = {
      tree,
      onToggleExpandedSector: () => {},
      onToggleExpandedSubsector: () => {},
      onToggleStateActive: () => {},
      onSetAutonomousEfficiencyForOutput: () => {},
      onSetEfficiencyPackageEnabled: () => {},
      onSetAllEfficiencyPackagesForOutput: () => {},
      onSetResidualOverlayIncluded: (overlayId: string, included: boolean) => {
        residualToggle = { overlayId, included };
      },
      onSetResidualOverlayGroupIncluded: (overlayIds: string[], included: boolean) => {
        groupToggle = { overlayIds, included };
      },
    };
    const html = renderToStaticMarkup(<RightSidebarContent {...props} />);

    assert.match(html, /Residuals/);
    assert.match(html, /Residual residential other/);
    assert.match(html, /Energy residual/);
    assert.match(html, /Proxy-linked outputs: Residential buildings/);
    assert.equal(html.match(/class="workspace-state-chip /g)?.length, 1);

    const residualOffButton = findElement(RightSidebarContent(props), (candidate) =>
      candidate.type === 'button'
      && candidate.props.onClick
      && typeof candidate.props.className === 'string'
      && candidate.props.className.includes('workspace-chip')
      && renderToStaticMarkup(candidate).includes('Off'),
    );
    assert.ok(residualOffButton);
    residualOffButton.props.onClick();
    assert.deepEqual(residualToggle, {
      overlayId: 'residential_other',
      included: false,
    });

    const allOffButton = findElement(RightSidebarContent(props), (candidate) =>
      candidate.type === 'button'
      && candidate.props.onClick
      && renderToStaticMarkup(candidate).includes('All Off'),
    );
    assert.ok(allOffButton);
    allOffButton.props.onClick();
    assert.deepEqual(groupToggle, {
      overlayIds: ['residential_other'],
      included: false,
    });
  });
});
