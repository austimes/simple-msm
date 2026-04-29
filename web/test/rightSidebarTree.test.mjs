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

function buildSubsector(outputId, label = outputId, overrides = {}) {
  const roleId = overrides.roleId ?? outputId;
  const representationId = overrides.representationId ?? `${roleId}__pathway_bundle`;
  const methodId = overrides.methodId ?? `${outputId}-state`;
  return {
    subsector: outputId,
    outputId,
    outputLabel: label,
    roleId,
    roleLabel: label,
    parentRoleId: overrides.parentRoleId ?? null,
    defaultRepresentationKind: 'pathway_bundle',
    states: [{
      stateId: methodId,
      stateLabel: `${label} method`,
      roleId,
      representationId,
      methodId,
      methodKind: 'pathway',
    }],
    ...overrides,
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

  test('hides decomposition child roles until the parent representation activates them', () => {
    const catalog = [
      {
        sector: 'industrial_heat_and_production',
        label: 'Industrial heat and production',
        subsectors: [
          buildSubsector('crude_steel', 'Produce crude steel', {
            roleId: 'produce_crude_steel',
            representationId: 'produce_crude_steel__pathway_bundle',
            methodId: 'steel_pathway',
          }),
          buildSubsector('produce_direct_reduced_iron', 'Produce direct reduced iron', {
            parentRoleId: 'produce_crude_steel',
            roleId: 'produce_direct_reduced_iron',
            representationId: 'produce_direct_reduced_iron__technology_bundle',
            methodId: 'h2_dri',
          }),
          buildSubsector('melt_refine_dri_crude_steel', 'Melt and refine DRI crude steel', {
            parentRoleId: 'produce_crude_steel',
            roleId: 'melt_refine_dri_crude_steel',
            representationId: 'melt_refine_dri_crude_steel__technology_bundle',
            methodId: 'eaf_finishing',
          }),
        ],
      },
    ];
    const roleMetadata = [
      {
        role_id: 'produce_crude_steel',
        role_label: 'Produce crude steel',
        parent_role_id: null,
        coverage_obligation: 'required_top_level',
        default_representation_kind: 'pathway_bundle',
      },
      {
        role_id: 'produce_direct_reduced_iron',
        role_label: 'Produce direct reduced iron',
        parent_role_id: 'produce_crude_steel',
        coverage_obligation: 'required_decomposition_child',
        default_representation_kind: 'technology_bundle',
      },
      {
        role_id: 'melt_refine_dri_crude_steel',
        role_label: 'Melt and refine DRI crude steel',
        parent_role_id: 'produce_crude_steel',
        coverage_obligation: 'required_decomposition_child',
        default_representation_kind: 'technology_bundle',
      },
    ];
    const representations = [
      {
        representation_id: 'produce_crude_steel__pathway_bundle',
        role_id: 'produce_crude_steel',
        representation_kind: 'pathway_bundle',
        representation_label: 'Crude steel pathway bundle',
        description: 'Direct pathway bundle',
        is_default: true,
        direct_method_kind: 'pathway',
      },
      {
        representation_id: 'produce_crude_steel__h2_dri_decomposition',
        role_id: 'produce_crude_steel',
        representation_kind: 'role_decomposition',
        representation_label: 'Crude steel H2 DRI decomposition',
        description: 'Process-chain decomposition',
        is_default: false,
        direct_method_kind: null,
      },
      {
        representation_id: 'produce_direct_reduced_iron__technology_bundle',
        role_id: 'produce_direct_reduced_iron',
        representation_kind: 'technology_bundle',
        representation_label: 'DRI technology bundle',
        description: 'DRI technology methods',
        is_default: true,
        direct_method_kind: 'technology',
      },
      {
        representation_id: 'melt_refine_dri_crude_steel__technology_bundle',
        role_id: 'melt_refine_dri_crude_steel',
        representation_kind: 'technology_bundle',
        representation_label: 'DRI finishing technology bundle',
        description: 'Finishing technology methods',
        is_default: true,
        direct_method_kind: 'technology',
      },
    ];
    const roleDecompositionEdges = [
      {
        parent_representation_id: 'produce_crude_steel__h2_dri_decomposition',
        parent_role_id: 'produce_crude_steel',
        child_role_id: 'produce_direct_reduced_iron',
        is_required: true,
        display_order: 0,
      },
      {
        parent_representation_id: 'produce_crude_steel__h2_dri_decomposition',
        parent_role_id: 'produce_crude_steel',
        child_role_id: 'melt_refine_dri_crude_steel',
        is_required: true,
        display_order: 1,
      },
    ];
    const methods = [
      {
        role_id: 'produce_crude_steel',
        representation_id: 'produce_crude_steel__pathway_bundle',
        method_id: 'steel_pathway',
        sort_order: 0,
      },
      {
        role_id: 'produce_direct_reduced_iron',
        representation_id: 'produce_direct_reduced_iron__technology_bundle',
        method_id: 'h2_dri',
        sort_order: 0,
      },
      {
        role_id: 'melt_refine_dri_crude_steel',
        representation_id: 'melt_refine_dri_crude_steel__technology_bundle',
        method_id: 'eaf_finishing',
        sort_order: 0,
      },
    ];

    const [directSector] = deriveRightSidebarTree(
      catalog,
      { crude_steel: buildStatus('crude_steel', { activeStateIds: ['steel_pathway'] }) },
      new Set(),
      new Set(),
      [],
      [],
      {},
      {
        roleMetadata,
        representations,
        roleDecompositionEdges,
        methods,
        currentConfiguration: { representation_by_role: {} },
      },
    );

    assert.deepEqual(directSector.subsectors.map((subsector) => subsector.roleId), ['produce_crude_steel']);
    assert.equal(directSector.subsectors[0].selectedRepresentationId, 'produce_crude_steel__pathway_bundle');
    assert.equal(directSector.subsectors[0].representationOptions.length, 2);
    assert.deepEqual(directSector.subsectors[0].states.map((method) => method.methodId), ['steel_pathway']);

    const [decomposedSector] = deriveRightSidebarTree(
      catalog,
      {
        produce_direct_reduced_iron: buildStatus('produce_direct_reduced_iron', { activeStateIds: ['h2_dri'] }),
        melt_refine_dri_crude_steel: buildStatus('melt_refine_dri_crude_steel', { activeStateIds: ['eaf_finishing'] }),
      },
      new Set(),
      new Set(),
      [],
      [],
      {},
      {
        roleMetadata,
        representations,
        roleDecompositionEdges,
        methods,
        currentConfiguration: {
          representation_by_role: {
            produce_crude_steel: 'produce_crude_steel__h2_dri_decomposition',
          },
        },
      },
    );

    const [parent] = decomposedSector.subsectors;
    assert.equal(parent.roleId, 'produce_crude_steel');
    assert.equal(parent.selectedRepresentationId, 'produce_crude_steel__h2_dri_decomposition');
    assert.deepEqual(parent.states, []);
    assert.deepEqual(
      parent.childRoles.map((role) => role.roleId),
      ['produce_direct_reduced_iron', 'melt_refine_dri_crude_steel'],
    );
  });
});
