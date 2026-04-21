import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import {
  buildStateCatalog,
} from '../../data/configurationWorkspaceModel';
import { buildEfficiencyControlCatalog } from '../../data/efficiencyControlModel';
import { deriveOutputRunStatusesForConfiguration } from '../../solver/solveScope.ts';
import { deriveRightSidebarTree } from './rightSidebarTree';
import RightSidebarContent from './RightSidebarContent';

export default function RightSidebar() {
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const appConfig = usePackageStore((s) => s.appConfig);
  const autonomousEfficiencyTracks = usePackageStore((s) => s.autonomousEfficiencyTracks);
  const efficiencyPackages = usePackageStore((s) => s.efficiencyPackages);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const toggleStateActive = usePackageStore((s) => s.toggleStateActive);
  const setAutonomousEfficiencyForOutput = usePackageStore((s) => s.setAutonomousEfficiencyForOutput);
  const setEfficiencyPackageEnabled = usePackageStore((s) => s.setEfficiencyPackageEnabled);
  const setAllEfficiencyPackagesForOutput = usePackageStore((s) => s.setAllEfficiencyPackagesForOutput);

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

  const catalog = useMemo(
    () => buildStateCatalog(sectorStates, appConfig),
    [sectorStates, appConfig],
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
    ),
    [catalog, outputStatuses, expandedSubsectors, expandedSectors, efficiencyControls],
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
    />
  );
}
