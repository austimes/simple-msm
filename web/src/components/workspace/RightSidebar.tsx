import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import {
  buildRoleAreaNavigationCatalog,
} from '../../data/configurationWorkspaceModel';
import { buildEfficiencyControlCatalog } from '../../data/efficiencyControlModel';
import { deriveOutputRunStatusesForConfiguration } from '../../solver/solveScope.ts';
import { buildSystemStructureCatalog, deriveRightSidebarTree } from './rightSidebarTree';
import RightSidebarContent from './RightSidebarContent';

export default function RightSidebar() {
  const roleMetadata = usePackageStore((s) => s.roleMetadata);
  const representations = usePackageStore((s) => s.representations);
  const roleDecompositionEdges = usePackageStore((s) => s.roleDecompositionEdges);
  const methods = usePackageStore((s) => s.methods);
  const resolvedMethodYears = usePackageStore((s) => s.resolvedMethodYears);
  const appConfig = usePackageStore((s) => s.appConfig);
  const autonomousEfficiencyTracks = usePackageStore((s) => s.autonomousEfficiencyTracks);
  const efficiencyPackages = usePackageStore((s) => s.efficiencyPackages);
  const residualOverlays2025 = usePackageStore((s) => s.residualOverlays2025);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const toggleMethodActive = usePackageStore((s) => s.toggleMethodActive);
  const setRoleRepresentation = usePackageStore((s) => s.setRoleRepresentation);
  const setAutonomousEfficiencyForRole = usePackageStore((s) => s.setAutonomousEfficiencyForRole);
  const setEfficiencyPackageEnabled = usePackageStore((s) => s.setEfficiencyPackageEnabled);
  const setAllEfficiencyPackagesForRole = usePackageStore((s) => s.setAllEfficiencyPackagesForRole);
  const setResidualOverlayIncluded = usePackageStore((s) => s.setResidualOverlayIncluded);
  const setResidualOverlayGroupIncluded = usePackageStore((s) => s.setResidualOverlayGroupIncluded);

  const [expandedSubsectors, setExpandedSubsectors] = useState<Set<string>>(new Set());
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

  const toggleExpandedSubsector = useCallback((outputId: string) => {
    setExpandedSubsectors((prev) => {
      const next = new Set(prev);
      if (next.has(outputId)) {
        next.delete(outputId);
      } else {
        next.add(outputId);
      }
      return next;
    });
  }, []);

  const toggleExpandedSector = useCallback((sector: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
  }, []);

  const rawCatalog = useMemo(
    () => buildRoleAreaNavigationCatalog(resolvedMethodYears, appConfig),
    [resolvedMethodYears, appConfig],
  );
  const roleIdByOutputId = useMemo(() => new Map(
    resolvedMethodYears.map((row) => [row.output_id, row.role_id] as const),
  ), [resolvedMethodYears]);
  const resolveRoleId = useCallback(
    (outputId: string) => roleIdByOutputId.get(outputId) ?? outputId,
    [roleIdByOutputId],
  );

  const catalog = useMemo(
    () => buildSystemStructureCatalog(
      rawCatalog,
      residualOverlays2025,
    ),
    [rawCatalog, residualOverlays2025],
  );

  const outputStatuses = useMemo(
    () => deriveOutputRunStatusesForConfiguration(
      { resolvedMethodYears, appConfig, autonomousEfficiencyTracks, efficiencyPackages },
      currentConfiguration,
    ),
    [resolvedMethodYears, appConfig, autonomousEfficiencyTracks, efficiencyPackages, currentConfiguration],
  );

  const efficiencyControls = useMemo(
    () => buildEfficiencyControlCatalog(
      currentConfiguration,
      resolvedMethodYears,
      autonomousEfficiencyTracks,
      efficiencyPackages,
    ),
    [currentConfiguration, resolvedMethodYears, autonomousEfficiencyTracks, efficiencyPackages],
  );

  const tree = useMemo(
    () => deriveRightSidebarTree(
      catalog,
      outputStatuses,
      expandedSubsectors,
      expandedSectors,
      efficiencyControls,
      residualOverlays2025,
      currentConfiguration.residual_overlays?.controls_by_overlay_id ?? {},
      {
        roleMetadata,
        representations,
        roleDecompositionEdges,
        methods,
        currentConfiguration,
      },
    ),
    [
      catalog,
      outputStatuses,
      expandedSubsectors,
      expandedSectors,
      efficiencyControls,
      residualOverlays2025,
      roleMetadata,
      representations,
      roleDecompositionEdges,
      methods,
      currentConfiguration,
    ],
  );

  return (
    <RightSidebarContent
      tree={tree}
      onToggleExpandedSector={toggleExpandedSector}
      onToggleExpandedSubsector={toggleExpandedSubsector}
      onToggleStateActive={(outputId, methodId) => toggleMethodActive(resolveRoleId(outputId), methodId)}
      onSetRoleRepresentation={setRoleRepresentation}
      onSetAutonomousEfficiencyForOutput={(outputId, mode) => setAutonomousEfficiencyForRole(resolveRoleId(outputId), mode)}
      onSetEfficiencyPackageEnabled={setEfficiencyPackageEnabled}
      onSetAllEfficiencyPackagesForOutput={(outputId, enabled) => setAllEfficiencyPackagesForRole(resolveRoleId(outputId), enabled)}
      onSetResidualOverlayIncluded={setResidualOverlayIncluded}
      onSetResidualOverlayGroupIncluded={setResidualOverlayGroupIncluded}
    />
  );
}
