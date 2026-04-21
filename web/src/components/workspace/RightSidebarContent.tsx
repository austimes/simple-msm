import React from 'react';
import {
  RIGHT_SIDEBAR_STATUS_LEGEND,
} from './rightSidebarStatus';
import type { RightSidebarSectorNode } from './rightSidebarTree';
import { formatWorkspacePillLabel } from './workspacePillLabel';

function formatSectorName(sector: string): string {
  return sector.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEfficiencyPackageClassification(classification: string): string {
  return classification === 'pure_efficiency_overlay' ? 'Pure' : 'Operational';
}

function formatMaxShareByYear(maxShareByYear: Record<string, number | null>): string {
  const entries = Object.entries(maxShareByYear);
  if (entries.length === 0) {
    return '';
  }

  return entries
    .map(([year, share]) => `${year}: ${share == null ? 'uncapped' : `${Math.round(share * 100)}%`}`)
    .join(', ');
}

export interface RightSidebarContentProps {
  tree: RightSidebarSectorNode[];
  onToggleExpandedSector: (sector: string) => void;
  onToggleExpandedSubsector: (outputId: string) => void;
  onToggleStateActive: (outputId: string, stateId: string) => void;
  onSetAutonomousEfficiencyForOutput: (outputId: string, mode: 'baseline' | 'off') => void;
  onSetEfficiencyPackageEnabled: (packageId: string, enabled: boolean) => void;
  onSetAllEfficiencyPackagesForOutput: (outputId: string, enabled: boolean) => void;
}

export default function RightSidebarContent({
  tree,
  onToggleExpandedSector,
  onToggleExpandedSubsector,
  onToggleStateActive,
  onSetAutonomousEfficiencyForOutput,
  onSetEfficiencyPackageEnabled,
  onSetAllEfficiencyPackagesForOutput,
}: RightSidebarContentProps) {
  return (
    <React.Fragment>
      {tree.map((sectorEntry) => (
        <div
          key={sectorEntry.sector}
          className={`workspace-sector-group${sectorEntry.isExcluded ? ' workspace-sector-group--dimmed' : ''}`}
        >
          <div className="workspace-sector-header">
            <div
              className={`workspace-sector-title${sectorEntry.isExcluded ? ' workspace-sector-title--clickable' : ''}`}
              onClick={sectorEntry.isExcluded ? () => onToggleExpandedSector(sectorEntry.sector) : undefined}
            >
              {formatSectorName(sectorEntry.sector)}
            </div>
            {sectorEntry.isExcluded && (
              <div className="workspace-sector-meta">
                <span className="workspace-mode-badge workspace-mode-badge--muted">
                  Excluded from this run
                </span>
                <button
                  type="button"
                  className="workspace-mode-toggle"
                  onClick={() => onToggleExpandedSector(sectorEntry.sector)}
                >
                  {sectorEntry.isCollapsed ? 'Show sub-sectors' : 'Hide sub-sectors'}
                </button>
              </div>
            )}
          </div>
          {!sectorEntry.isCollapsed && sectorEntry.subsectors.map((sub) => {
            const activeStateIdSet = new Set(sub.activeStateIds);
            const pathwaysInactive = sub.pathwaysInactive;
            const outOfScope = sub.outOfScope;
            const isCollapsed = sub.isCollapsed;
            const badges = sub.badges;
            const efficiencyControls = sub.efficiencyControls;
            const hasEfficiencyControls = efficiencyControls?.hasControls === true;
            const autonomousEnabled = efficiencyControls?.autonomousTracks.some((track) => track.enabled) ?? false;
            const embodiedStateIdSet = new Set(efficiencyControls?.embodiedStateIds ?? []);

            return (
              <div
                key={sub.outputId}
                className={`workspace-subsector-group${outOfScope ? ' workspace-subsector-group--dimmed' : ''}`}
              >
                <div
                  className={`workspace-subsector-title${sub.canCollapse ? ' workspace-subsector-title--clickable' : ''}`}
                  onClick={sub.canCollapse ? () => onToggleExpandedSubsector(sub.outputId) : undefined}
                >
                  {sub.outputLabel}
                </div>
                {badges.length > 0 && (
                  <div className="workspace-subsector-meta">
                    {badges.map((badge) => (
                      <span
                        key={badge.key}
                        className={`workspace-mode-badge workspace-mode-badge--${badge.tone}`}
                        title={sub.presentation.detail}
                      >
                        {badge.label}
                      </span>
                    ))}
                    {sub.canCollapse && (
                      <button
                        type="button"
                        className="workspace-mode-toggle"
                        onClick={() => onToggleExpandedSubsector(sub.outputId)}
                      >
                        {isCollapsed ? 'Show states' : 'Hide states'}
                      </button>
                    )}
                  </div>
                )}
                {pathwaysInactive && (
                  <div className="workspace-subsector-detail">{sub.presentation.detail}</div>
                )}
                {!isCollapsed && (
                  <div className="workspace-state-chips">
                    {sub.states.map((state) => {
                      const isActive = !pathwaysInactive && activeStateIdSet.has(state.stateId);
                      const chipClass = pathwaysInactive
                        ? 'workspace-state-chip--inactive'
                        : isActive
                          ? 'workspace-state-chip--on'
                          : 'workspace-state-chip--off';
                      const chipLabel = formatWorkspacePillLabel(state.stateLabel);
                      const hasEmbodiedEfficiency = embodiedStateIdSet.has(state.stateId);
                      const chipTitle = pathwaysInactive
                        ? `${state.stateLabel}. ${sub.presentation.detail}`
                        : hasEmbodiedEfficiency
                          ? `${state.stateLabel}. Embodied efficiency pathway.`
                          : state.stateLabel;

                      return (
                        <button
                          key={state.stateId}
                          type="button"
                          className={`workspace-state-chip ${chipClass}${outOfScope ? ' workspace-state-chip--dimmed' : ''}`}
                          onClick={() =>
                            onToggleStateActive(sub.outputId, state.stateId)
                          }
                          aria-pressed={!pathwaysInactive && isActive}
                          disabled={pathwaysInactive}
                          title={chipTitle}
                        >
                          <span className="workspace-pill-label">{chipLabel}</span>
                          {hasEmbodiedEfficiency && (
                            <span className="workspace-state-chip-badge">Embodied</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!isCollapsed && hasEfficiencyControls && efficiencyControls && (
                  <div className="workspace-efficiency-controls">
                    <div className="workspace-efficiency-heading">Efficiency</div>
                    {efficiencyControls.autonomousTracks.length > 0 && (
                      <button
                        type="button"
                        className={`workspace-efficiency-toggle${autonomousEnabled ? ' workspace-efficiency-toggle--on' : ''}`}
                        aria-pressed={autonomousEnabled}
                        onClick={() => onSetAutonomousEfficiencyForOutput(
                          sub.outputId,
                          autonomousEnabled ? 'off' : 'baseline',
                        )}
                        title={efficiencyControls.autonomousTracks.map((track) => track.label).join(', ')}
                      >
                        <span>Autonomous</span>
                        <span className={`workspace-mode-badge workspace-mode-badge--${autonomousEnabled ? 'success' : 'muted'}`}>
                          {autonomousEnabled ? 'On' : 'Off'}
                        </span>
                      </button>
                    )}
                    {efficiencyControls.packages.length > 0 && (
                      <div className="workspace-efficiency-package-stack">
                        {efficiencyControls.packages.length > 1 && (
                          <div className="workspace-efficiency-package-actions">
                            <button
                              type="button"
                              className="workspace-mode-toggle"
                              onClick={() => onSetAllEfficiencyPackagesForOutput(sub.outputId, true)}
                            >
                              All packages on
                            </button>
                            <button
                              type="button"
                              className="workspace-mode-toggle"
                              onClick={() => onSetAllEfficiencyPackagesForOutput(sub.outputId, false)}
                            >
                              All packages off
                            </button>
                          </div>
                        )}
                        {efficiencyControls.packages.map((pkg) => {
                          const maxShareTitle = formatMaxShareByYear(pkg.maxShareByYear);
                          const metadataTitle = [
                            pkg.nonStackingGroup ? `Non-stacking group: ${pkg.nonStackingGroup}` : null,
                            maxShareTitle || null,
                          ].filter(Boolean).join('. ');

                          return (
                            <button
                              key={pkg.packageId}
                              type="button"
                              className={`workspace-efficiency-package${pkg.enabled ? ' workspace-efficiency-package--on' : ''}`}
                              aria-pressed={pkg.enabled}
                              onClick={() => onSetEfficiencyPackageEnabled(pkg.packageId, !pkg.enabled)}
                              title={metadataTitle || pkg.label}
                            >
                              <span className="workspace-efficiency-package-label">{pkg.label}</span>
                              <span className="workspace-efficiency-package-meta">
                                <span className="workspace-mode-badge workspace-mode-badge--info">
                                  {formatEfficiencyPackageClassification(pkg.classification)}
                                </span>
                                {pkg.nonStackingGroup && (
                                  <span
                                    className="workspace-mode-badge workspace-mode-badge--muted"
                                    title={`Non-stacking group: ${pkg.nonStackingGroup}`}
                                  >
                                    Group
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {efficiencyControls.embodiedStateIds.length > 0 && (
                      <div className="workspace-efficiency-readonly">
                        <span className="workspace-mode-badge workspace-mode-badge--muted">
                          Embodied
                        </span>
                        <span className="workspace-efficiency-readonly-text">
                          Controlled by pathway state
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="workspace-state-legend" role="note" aria-label="State selector status legend">
        <p className="workspace-state-legend-copy">
          Outputs with active pathways participate in the solve. Outputs whose pathways are all
          deactivated are excluded. Dependencies like electricity are auto-included when needed.
        </p>
        <div className="workspace-state-legend-items">
          {RIGHT_SIDEBAR_STATUS_LEGEND.map((item) => (
            <div key={item.key} className="workspace-state-legend-item">
              <span className={`workspace-mode-badge workspace-mode-badge--${item.tone}`}>
                {item.label}
              </span>
              <span className="workspace-state-legend-text">{item.description}</span>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}
