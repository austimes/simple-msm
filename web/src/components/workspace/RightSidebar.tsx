import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import {
  buildStateCatalog,
} from '../../data/configurationWorkspaceModel';
import { buildEfficiencyControlCatalog } from '../../data/efficiencyControlModel';
import { deriveOutputRunStatusesForConfiguration } from '../../solver/solveScope.ts';
import { buildSystemStructureCatalog, deriveRightSidebarTree } from './rightSidebarTree';
import RightSidebarContent from './RightSidebarContent';

export default function RightSidebar() {
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const appConfig = usePackageStore((s) => s.appConfig);
  const autonomousEfficiencyTracks = usePackageStore((s) => s.autonomousEfficiencyTracks);
  const efficiencyPackages = usePackageStore((s) => s.efficiencyPackages);
  const residualOverlays2025 = usePackageStore((s) => s.residualOverlays2025);
  const systemStructureGroups = usePackageStore((s) => s.systemStructureGroups);
  const systemStructureMembers = usePackageStore((s) => s.systemStructureMembers);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const toggleStateActive = usePackageStore((s) => s.toggleStateActive);
  const setAutonomousEfficiencyForOutput = usePackageStore((s) => s.setAutonomousEfficiencyForOutput);
  const setEfficiencyPackageEnabled = usePackageStore((s) => s.setEfficiencyPackageEnabled);
  const setAllEfficiencyPackagesForOutput = usePackageStore((s) => s.setAllEfficiencyPackagesForOutput);
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
    () => buildStateCatalog(sectorStates, appConfig),
    [sectorStates, appConfig],
  );

  const catalog = useMemo(
    () => buildSystemStructureCatalog(
      rawCatalog,
      residualOverlays2025,
      systemStructureGroups,
      systemStructureMembers,
    ),
    [rawCatalog, residualOverlays2025, systemStructureGroups, systemStructureMembers],
  );

  const outputStatuses = useMemo(
    () => deriveOutputRunStatusesForConfiguration(
      { sectorStates, appConfig, autonomousEfficiencyTracks, efficiencyPackages },
      currentConfiguration,
    ),
    [sectorStates, appConfig, autonomousEfficiencyTracks, efficiencyPackages, currentConfiguration],
  );

  const efficiencyControls = useMemo(
    () => buildEfficiencyControlCatalog(
      currentConfiguration,
      sectorStates,
      autonomousEfficiencyTracks,
      efficiencyPackages,
    ),
    [currentConfiguration, sectorStates, autonomousEfficiencyTracks, efficiencyPackages],
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
    ),
    [
      catalog,
      outputStatuses,
      expandedSubsectors,
      expandedSectors,
      efficiencyControls,
      residualOverlays2025,
      currentConfiguration.residual_overlays?.controls_by_overlay_id,
    ],
  );

  return (
    <RightSidebarContent
      tree={tree}
      onToggleExpandedSector={toggleExpandedSector}
      onToggleExpandedSubsector={toggleExpandedSubsector}
      onToggleStateActive={toggleStateActive}
      onSetAutonomousEfficiencyForOutput={setAutonomousEfficiencyForOutput}
      onSetEfficiencyPackageEnabled={setEfficiencyPackageEnabled}
      onSetAllEfficiencyPackagesForOutput={setAllEfficiencyPackagesForOutput}
      onSetResidualOverlayIncluded={setResidualOverlayIncluded}
      onSetResidualOverlayGroupIncluded={setResidualOverlayGroupIncluded}
    />
  );
}
