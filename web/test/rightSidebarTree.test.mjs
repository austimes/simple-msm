import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildSystemStructureCatalog,
  deriveRightSidebarTree,
} from '../src/components/workspace/rightSidebarTree.ts';

function buildStatus(outputId, overrides = {}) {
  const activeStateIds = overrides.activeStateIds ?? ['pathway-a'];
  const isExcludedFromRun = overrides.isExcludedFromRun ?? false;
  const inRun = overrides.inRun ?? !isExcludedFromRun;
  const isDisabled = overrides.isDisabled ?? activeStateIds.length === 0;

  return {
    outputId,
    outputRole: overrides.outputRole ?? 'required_service',
    controlMode: overrides.controlMode ?? 'optimize',
    activeStateIds,
    activeStateCount: overrides.activeStateCount ?? activeStateIds.length,
    isDisabled,
    inRun,
    runParticipation: overrides.runParticipation ?? (isExcludedFromRun ? 'excluded_from_run' : 'active_pathways'),
    demandParticipation: overrides.demandParticipation ?? (isExcludedFromRun ? 'excluded_from_run' : 'active_in_run'),
    supplyParticipation: overrides.supplyParticipation ?? 'not_applicable',
    hasPositiveDemandInRun: overrides.hasPositiveDemandInRun ?? inRun,
    isDirectlyActive: overrides.isDirectlyActive ?? !isExcludedFromRun,
    isAutoIncludedDependency: overrides.isAutoIncludedDependency ?? false,
    isExcludedFromRun,
  };
}

function buildSubsector(outputId, label = outputId) {
  return {
    subsector: outputId,
    outputId,
    outputLabel: label,
    states: [{ stateId: `${outputId}-state`, stateLabel: `${label} state` }],
  };
}

describe('deriveRightSidebarTree', () => {
  test('collapses excluded subsectors without collapsing mixed sectors', () => {
    const catalog = [
      {
        sector: 'industry',
        subsectors: [
          buildSubsector('cement', 'Cement'),
          buildSubsector('steel', 'Steel'),
        ],
      },
    ];
    const statuses = {
      cement: buildStatus('cement', { isExcludedFromRun: true }),
      steel: buildStatus('steel'),
    };

    const [industry] = deriveRightSidebarTree(catalog, statuses, new Set(), new Set());
    const cement = industry.subsectors.find((subsector) => subsector.outputId === 'cement');
    const steel = industry.subsectors.find((subsector) => subsector.outputId === 'steel');

    assert.equal(industry.isExcluded, false);
    assert.equal(industry.isCollapsed, false);
    assert.equal(cement?.outOfScope, true);
    assert.equal(cement?.isCollapsed, true);
    assert.equal(steel?.outOfScope, false);
    assert.equal(steel?.isCollapsed, false);
  });

  test('collapses fully excluded sectors and respects manual expansion overrides', () => {
    const catalog = [
      {
        sector: 'transport',
        subsectors: [
          buildSubsector('passenger_road_transport', 'Passenger road transport'),
          buildSubsector('freight_road_transport', 'Freight road transport'),
        ],
      },
    ];
    const statuses = {
      passenger_road_transport: buildStatus('passenger_road_transport', { isExcludedFromRun: true }),
      freight_road_transport: buildStatus('freight_road_transport', { isExcludedFromRun: true }),
    };

    const [collapsedSector] = deriveRightSidebarTree(catalog, statuses, new Set(), new Set());
    assert.equal(collapsedSector.isExcluded, true);
    assert.equal(collapsedSector.isCollapsed, true);

    const [expandedSector] = deriveRightSidebarTree(
      catalog,
      statuses,
      new Set(['passenger_road_transport']),
      new Set(['transport']),
    );
    const passenger = expandedSector.subsectors.find((subsector) => subsector.outputId === 'passenger_road_transport');
    const freight = expandedSector.subsectors.find((subsector) => subsector.outputId === 'freight_road_transport');

    assert.equal(expandedSector.isCollapsed, false);
    assert.equal(passenger?.isCollapsed, false);
    assert.equal(freight?.isCollapsed, true);
  });

  test('preserves the existing default collapse for disabled subsectors', () => {
    const catalog = [
      {
        sector: 'removals_negative_emissions',
        subsectors: [buildSubsector('land_sequestration', 'Land sequestration')],
      },
    ];
    const statuses = {
      land_sequestration: buildStatus('land_sequestration', {
        activeStateIds: [],
        activeStateCount: 0,
        isDisabled: true,
        demandParticipation: 'not_applicable',
        outputRole: 'required_service',
      }),
    };

    const [sector] = deriveRightSidebarTree(catalog, statuses, new Set(), new Set());

    assert.equal(sector.isExcluded, false);
    assert.equal(sector.isCollapsed, false);
    assert.equal(sector.subsectors[0].allDisabled, true);
    assert.equal(sector.subsectors[0].isCollapsed, true);
    assert.deepEqual(sector.subsectors[0].activeStateIds, []);
  });

  test('attaches efficiency controls to matching subsectors', () => {
    const catalog = [
      {
        sector: 'buildings',
        subsectors: [
          buildSubsector('residential_building_services', 'Residential buildings'),
          buildSubsector('commercial_building_services', 'Commercial buildings'),
        ],
      },
    ];
    const statuses = {
      residential_building_services: buildStatus('residential_building_services'),
      commercial_building_services: buildStatus('commercial_building_services'),
    };
    const efficiencyControls = [
      {
        outputId: 'residential_building_services',
        hasControls: true,
        autonomousTracks: [],
        packages: [],
        embodiedStateIds: ['buildings__residential__deep_electric'],
      },
    ];

    const [sector] = deriveRightSidebarTree(
      catalog,
      statuses,
      new Set(),
      new Set(),
      efficiencyControls,
    );

    assert.equal(sector.subsectors[0].efficiencyControls?.outputId, 'residential_building_services');
    assert.equal(sector.subsectors[1].efficiencyControls, undefined);
  });

  test('builds explicit system structure groups with residual-only groups', () => {
    const catalog = [
      {
        sector: 'buildings',
        subsectors: [
          buildSubsector('residential_building_services', 'Residential buildings'),
          buildSubsector('commercial_building_services', 'Commercial buildings'),
        ],
      },
      {
        sector: 'road_transport',
        subsectors: [
          buildSubsector('passenger_road_transport', 'Passenger road'),
        ],
      },
    ];
    const residualRows = [
      { overlay_id: 'residential_other' },
      { overlay_id: 'construction_other' },
    ];

    const systemCatalog = buildSystemStructureCatalog(catalog, residualRows);

    assert.equal(systemCatalog[0].sector, 'buildings');
    assert.equal(systemCatalog[0].label, 'Buildings');
    assert.deepEqual(
      systemCatalog[0].subsectors.map((subsector) => subsector.outputId),
      ['residential_building_services', 'commercial_building_services'],
    );
    assert.deepEqual(systemCatalog[0].residualOverlayIds, ['residential_other']);
    assert.equal(
      systemCatalog.find((entry) => entry.sector === 'construction')?.label,
      'Construction',
    );
  });

  test('uses library-owned system structure rows when provided', () => {
    const catalog = [
      {
        sector: 'source_sector',
        subsectors: [
          buildSubsector('electricity', 'Electricity supply'),
          buildSubsector('electricity_grid_losses_own_use', 'Grid losses and own-use'),
        ],
      },
    ];

    const systemCatalog = buildSystemStructureCatalog(
      catalog,
      [],
      [
        {
          group_id: 'energy_supply',
          group_label: 'Energy supply',
          display_order: 40,
          notes: '',
        },
      ],
      [
        {
          group_id: 'energy_supply',
          family_id: 'electricity',
          display_order: 10,
          notes: '',
        },
        {
          group_id: 'energy_supply',
          family_id: 'electricity_grid_losses_own_use',
          display_order: 20,
          notes: '',
        },
      ],
    );

    assert.equal(systemCatalog.length, 1);
    assert.equal(systemCatalog[0].sector, 'energy_supply');
    assert.equal(systemCatalog[0].label, 'Energy supply');
    assert.deepEqual(
      systemCatalog[0].subsectors.map((subsector) => subsector.outputId),
      ['electricity', 'electricity_grid_losses_own_use'],
    );
    assert.deepEqual(systemCatalog[0].residualOverlayIds, []);
  });

  test('attaches residual groups without turning them into route nodes', () => {
    const catalog = buildSystemStructureCatalog(
      [
        {
          sector: 'buildings',
          subsectors: [buildSubsector('residential_building_services', 'Residential buildings')],
        },
      ],
      [
        {
          overlay_id: 'residential_other',
          overlay_label: 'Residual residential other',
          overlay_domain: 'energy_residual',
          official_accounting_bucket: 'Residential',
          final_energy_pj_2025: 2,
          direct_energy_emissions_mtco2e_2025: 0.4,
          other_emissions_mtco2e_2025: 0,
          default_total_cost_ex_carbon_audm_2024: 3,
          default_include: true,
        },
      ],
    );
    const [buildings] = deriveRightSidebarTree(
      catalog,
      {
        residential_building_services: buildStatus('residential_building_services'),
      },
      new Set(),
      new Set(),
      [],
      [
        {
          overlay_id: 'residential_other',
          overlay_label: 'Residual residential other',
          overlay_domain: 'energy_residual',
          official_accounting_bucket: 'Residential',
          year: 2025,
          commodity: 'electricity',
          final_energy_pj_2025: 2,
          native_unit: 'MWh',
          native_quantity_2025: 10,
          direct_energy_emissions_mtco2e_2025: 0.4,
          other_emissions_mtco2e_2025: 0,
          carbon_billable_emissions_mtco2e_2025: 0.4,
          default_price_basis: 'reference',
          default_price_per_native_unit_aud_2024: null,
          default_commodity_cost_audm_2024: 1,
          default_fixed_noncommodity_cost_audm_2024: 2,
          default_total_cost_ex_carbon_audm_2024: 3,
          default_include: true,
          allocation_method: '',
          cost_basis_note: '',
          notes: '',
        },
      ],
      {
        residential_other: { included: false },
      },
    );

    assert.equal(buildings.subsectors.length, 1);
    assert.equal(buildings.residualGroup?.residuals.length, 1);
    assert.equal(buildings.residualGroup?.residuals[0].overlayId, 'residential_other');
    assert.equal(buildings.residualGroup?.residuals[0].included, false);
    assert.deepEqual(buildings.subsectors.map((subsector) => subsector.outputId), ['residential_building_services']);
  });
});
