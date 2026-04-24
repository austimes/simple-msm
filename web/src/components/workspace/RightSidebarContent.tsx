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
  return classification === 'pure_efficiency_overlay'
    ? 'Pure efficiency package'
    : 'Operational efficiency package';
}

function formatControlMode(mode: string | undefined): string {
  switch (mode) {
    case 'externalized':
      return 'Externalized';
    case 'target':
      return 'Target';
    default:
      return 'Optimize';
  }
}

function formatResidualDomain(domain: string): string {
  switch (domain) {
    case 'energy_residual':
      return 'Energy residual';
    case 'nonenergy_residual':
      return 'Non-energy residual';
    case 'net_sink':
      return 'Net sink';
    default:
      return 'Residual';
  }
}

function residualDomainTone(domain: string): 'info' | 'warning' | 'muted' {
  if (domain === 'net_sink') {
    return 'muted';
  }
  return domain === 'energy_residual' ? 'info' : 'warning';
}

function formatResidualTotals(totalEnergyPJ: number, totalEmissionsMt: number, totalCostM: number): string {
  const parts: string[] = [];

  if (totalEnergyPJ !== 0) {
    parts.push(`${Math.abs(totalEnergyPJ).toFixed(1)} PJ`);
  }
  if (totalEmissionsMt !== 0) {
    parts.push(`${totalEmissionsMt.toFixed(1)} MtCO₂e`);
  }
  if (totalCostM !== 0) {
    parts.push(`$${totalCostM.toFixed(1)}m`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'No 2025 anchor total';
}

function formatProxyOutputs(labels: string[]): string {
  return labels.length > 0
    ? `Proxy-linked outputs: ${labels.join(', ')}`
    : 'Proxy-linked to the demand preset average';
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
  onSetResidualOverlayIncluded: (overlayId: string, included: boolean) => void;
  onSetResidualOverlayGroupIncluded: (overlayIds: string[], included: boolean) => void;
}

export default function RightSidebarContent({
  tree,
  onToggleExpandedSector,
  onToggleExpandedSubsector,
  onToggleStateActive,
  onSetAutonomousEfficiencyForOutput,
  onSetEfficiencyPackageEnabled,
  onSetAllEfficiencyPackagesForOutput,
  onSetResidualOverlayIncluded,
  onSetResidualOverlayGroupIncluded,
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
              {sectorEntry.label ?? formatSectorName(sectorEntry.sector)}
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
                  {sectorEntry.isCollapsed ? 'Show segments' : 'Hide segments'}
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
                    <span className="workspace-mode-badge workspace-mode-badge--muted">
                      Mode: {formatControlMode(sub.status?.controlMode)}
                    </span>
                    {sub.canCollapse && (
                      <button
                        type="button"
                        className="workspace-mode-toggle"
                        onClick={() => onToggleExpandedSubsector(sub.outputId)}
                      >
                        {isCollapsed ? 'Show routes' : 'Hide routes'}
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
                          ? `${state.stateLabel}. Embodied efficiency route.`
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
                    <div className="workspace-efficiency-heading">Efficiency items</div>
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
                          Controlled by route
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!sectorEntry.isCollapsed && sectorEntry.residualGroup && (
            <div className="workspace-residual-group">
              <div className="workspace-residual-group-header">
                <div>
                  <div className="workspace-subsector-title">{sectorEntry.residualGroup.label}</div>
                  <div className="workspace-subsector-detail">
                    {sectorEntry.residualGroup.includedCount}/{sectorEntry.residualGroup.totalCount} residuals on
                  </div>
                </div>
                <div className="workspace-residual-actions">
                  <button
                    type="button"
                    className="workspace-mode-toggle"
                    onClick={() => onSetResidualOverlayGroupIncluded(
                      sectorEntry.residualGroup?.residuals.map((residual) => residual.overlayId) ?? [],
                      true,
                    )}
                  >
                    All On
                  </button>
                  <button
                    type="button"
                    className="workspace-mode-toggle"
                    onClick={() => onSetResidualOverlayGroupIncluded(
                      sectorEntry.residualGroup?.residuals.map((residual) => residual.overlayId) ?? [],
                      false,
                    )}
                  >
                    All Off
                  </button>
                </div>
              </div>
              {sectorEntry.residualGroup.residuals.map((residual) => (
                <div key={residual.overlayId} className="workspace-residual-item">
                  <div className="workspace-residual-item-header">
                    <div className="workspace-residual-title">{residual.overlayLabel}</div>
                    <span className={`workspace-mode-badge workspace-mode-badge--${residualDomainTone(residual.overlayDomain)}`}>
                      {formatResidualDomain(residual.overlayDomain)}
                    </span>
                  </div>
                  <div className="workspace-subsector-detail">
                    2025 anchor: {formatResidualTotals(
                      residual.totalEnergyPJ,
                      residual.totalEmissionsMt,
                      residual.totalCostM,
                    )}
                  </div>
                  <div className="workspace-subsector-detail">
                    {formatProxyOutputs(residual.proxyOutputLabels)}
                  </div>
                  <div className="workspace-chip-group workspace-chip-group--inline">
                    <button
                      type="button"
                      className={`workspace-chip${residual.included ? ' workspace-chip--active' : ''}`}
                      aria-pressed={residual.included}
                      onClick={() => onSetResidualOverlayIncluded(residual.overlayId, true)}
                    >
                      <span className="workspace-pill-label">On</span>
                    </button>
                    <button
                      type="button"
                      className={`workspace-chip${residual.included ? '' : ' workspace-chip--active'}`}
                      aria-pressed={!residual.included}
                      onClick={() => onSetResidualOverlayIncluded(residual.overlayId, false)}
                    >
                      <span className="workspace-pill-label">Off</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="workspace-state-legend" role="note" aria-label="System structure status legend">
        <p className="workspace-state-legend-copy">
          Outputs with active routes participate in the solve. Outputs whose routes are all
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
