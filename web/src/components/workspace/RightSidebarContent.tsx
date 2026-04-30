import React from 'react';
import {
  RIGHT_SIDEBAR_STATUS_LEGEND,
} from './rightSidebarStatus';
import type { RightSidebarAreaNode } from './rightSidebarTree';
import { formatWorkspacePillLabel } from './workspacePillLabel';
import type { RepresentationKind } from '../../data/types';

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

function formatRepresentationKind(kind: RepresentationKind): string {
  switch (kind) {
    case 'pathway_bundle':
      return 'Pathway bundle';
    case 'technology_bundle':
      return 'Technology bundle';
    case 'role_decomposition':
      return 'Role decomposition';
    default:
      return kind;
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
  tree: RightSidebarAreaNode[];
  onToggleExpandedSector: (sector: string) => void;
  onToggleExpandedSubsector: (outputId: string) => void;
  onToggleStateActive: (outputId: string, methodId: string) => void;
  onSetRoleRepresentation: (roleId: string, representationId: string) => void;
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
  onSetRoleRepresentation,
  onSetAutonomousEfficiencyForOutput,
  onSetEfficiencyPackageEnabled,
  onSetAllEfficiencyPackagesForOutput,
  onSetResidualOverlayIncluded,
  onSetResidualOverlayGroupIncluded,
}: RightSidebarContentProps) {
  function renderRoleNode(
    sub: RightSidebarAreaNode['subsectors'][number],
  ): React.ReactNode {
    const activeMethodIdSet = new Set(sub.activeMethodIds);
    const methodsInactive = sub.pathwaysInactive;
    const outOfScope = sub.outOfScope;
    const isCollapsed = sub.isCollapsed;
    const badges = sub.badges;
    const efficiencyControls = sub.efficiencyControls;
    const hasEfficiencyControls = efficiencyControls?.hasControls === true;
    const autonomousEnabled = efficiencyControls?.autonomousTracks.some((track) => track.enabled) ?? false;
    const embodiedMethodIdSet = new Set(efficiencyControls?.embodiedMethodIds ?? []);
    const isResidualStub = sub.familyResolution === 'residual_stub';
    const isDecomposition = sub.selectedRepresentationKind === 'role_decomposition';
    const hasRepresentationControls = sub.representationOptions.length > 0;
    const hasMethodControls = !isDecomposition && sub.states.length > 0;

    return (
      <React.Fragment key={sub.roleId}>
        <div
          className={`workspace-subsector-group${outOfScope ? ' workspace-subsector-group--dimmed' : ''}${sub.isDecompositionChild ? ' workspace-subsector-group--child-role' : ''}`}
        >
          <div
            className={`workspace-subsector-title${sub.canCollapse ? ' workspace-subsector-title--clickable' : ''}`}
            onClick={sub.canCollapse ? () => onToggleExpandedSubsector(sub.outputId) : undefined}
          >
            {sub.roleLabel || sub.outputLabel}
          </div>
          {(badges.length > 0 || isResidualStub || sub.status || sub.canCollapse) && (
            <div className="workspace-subsector-meta">
              {isResidualStub && (
                <span
                  className="workspace-mode-badge workspace-mode-badge--warning"
                  title={sub.coverageScopeLabel ?? sub.roleLabel}
                >
                  Residual role
                </span>
              )}
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  className={`workspace-mode-badge workspace-mode-badge--${badge.tone}`}
                  title={sub.presentation.detail}
                >
                  {badge.label}
                </span>
              ))}
              {sub.status && (
                <span className="workspace-mode-badge workspace-mode-badge--muted">
                  Mode: {formatControlMode(sub.status.controlMode)}
                </span>
              )}
              {sub.canCollapse && (
                <button
                  type="button"
                  className="workspace-mode-toggle"
                  onClick={() => onToggleExpandedSubsector(sub.outputId)}
                >
                  {isCollapsed ? 'Show methods' : 'Hide methods'}
                </button>
              )}
            </div>
          )}

          {hasRepresentationControls && (
            <div className="workspace-representation-control">
              <div className="workspace-representation-summary">
                {sub.selectedRepresentationKind && (
                  <span className="workspace-mode-badge workspace-mode-badge--info">
                    {formatRepresentationKind(sub.selectedRepresentationKind)}
                  </span>
                )}
                <span className="workspace-representation-label">
                  {sub.selectedRepresentationLabel ?? 'No representation selected'}
                </span>
              </div>
              {sub.representationOptions.length > 1 && (
                <div
                  className="workspace-representation-options"
                  role="group"
                  aria-label={`${sub.roleLabel} representation`}
                >
                  {sub.representationOptions.map((option) => (
                    <button
                      key={option.representationId}
                      type="button"
                      className={`workspace-representation-option${option.isSelected ? ' workspace-representation-option--selected' : ''}`}
                      aria-pressed={option.isSelected}
                      onClick={() => onSetRoleRepresentation(sub.roleId, option.representationId)}
                      title={option.description}
                    >
                      <span className="workspace-pill-label">{option.label}</span>
                      <span className="workspace-mode-badge workspace-mode-badge--muted">
                        {formatRepresentationKind(option.representationKind)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {isDecomposition && (
                <div className="workspace-subsector-detail">
                  {sub.activeChildRoleIds.length} child {sub.activeChildRoleIds.length === 1 ? 'role' : 'roles'} active
                  under this representation.
                </div>
              )}
            </div>
          )}

          {methodsInactive && (
            <div className="workspace-subsector-detail">{sub.presentation.detail}</div>
          )}
          {!isCollapsed && hasMethodControls && (
            <div className="workspace-method-chips">
              {sub.states.map((state) => {
                const isActive = !methodsInactive && activeMethodIdSet.has(state.methodId);
                const chipClass = methodsInactive
                  ? 'workspace-method-chip--inactive'
                  : isActive
                    ? 'workspace-method-chip--on'
                    : 'workspace-method-chip--off';
                const chipLabel = formatWorkspacePillLabel(state.methodLabel);
                const hasEmbodiedEfficiency = embodiedMethodIdSet.has(state.methodId);
                const chipTitle = methodsInactive
                  ? `${state.methodLabel}. ${sub.presentation.detail}`
                  : hasEmbodiedEfficiency
                    ? `${state.methodLabel}. Embodied efficiency method.`
                    : state.methodLabel;

                return (
                  <button
                    key={`${state.representationId}:${state.methodId}`}
                    type="button"
                    className={`workspace-method-chip ${chipClass}${outOfScope ? ' workspace-method-chip--dimmed' : ''}`}
                    onClick={() =>
                      onToggleStateActive(sub.outputId, state.methodId)
                    }
                    aria-pressed={!methodsInactive && isActive}
                    disabled={methodsInactive}
                    title={chipTitle}
                  >
                    <span className="workspace-pill-label">{chipLabel}</span>
                    {hasEmbodiedEfficiency && (
                      <span className="workspace-method-chip-badge">Embodied</span>
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
              {efficiencyControls.embodiedMethodIds.length > 0 && (
                <div className="workspace-efficiency-readonly">
                  <span className="workspace-mode-badge workspace-mode-badge--muted">
                    Embodied
                  </span>
                  <span className="workspace-efficiency-readonly-text">
                    Controlled by method
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        {sub.childRoles.length > 0 && (
          <div className="workspace-child-role-stack" role="group" aria-label={`${sub.roleLabel} child roles`}>
            {sub.childRoles.map((childRole) => renderRoleNode(childRole))}
          </div>
        )}
      </React.Fragment>
    );
  }

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
                  {sectorEntry.isCollapsed ? 'Show roles' : 'Hide roles'}
                </button>
              </div>
            )}
          </div>
          {!sectorEntry.isCollapsed && sectorEntry.subsectors.map((sub) => renderRoleNode(sub))}
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
      <div className="workspace-state-legend" role="note" aria-label="Role representation status legend">
        <p className="workspace-state-legend-copy">
          Roles with active methods participate in the solve. Roles whose methods are all
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
