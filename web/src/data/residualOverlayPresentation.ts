import type {
  ConfigurationDocument,
  ResidualOverlayDisplayMode,
  ResidualOverlayDomain,
} from './types.ts';

export const DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE: ResidualOverlayDisplayMode = 'aggregated_non_sink';
export const AGGREGATED_RESIDUAL_OVERLAY_ID = 'unmodelled_residuals';
export const AGGREGATED_RESIDUAL_OVERLAY_LABEL = 'Unmodelled residuals';

interface ResidualOverlayDisplayBucketInput {
  overlayId: string;
  overlayDomain: ResidualOverlayDomain;
  overlayLabel: string;
}

interface ResidualOverlayDisplayBucket {
  overlayId: string;
  overlayLabel: string;
}

export function getResidualOverlayDisplayMode(
  configuration: Pick<ConfigurationDocument, 'presentation_options'> | null | undefined,
): ResidualOverlayDisplayMode {
  return configuration?.presentation_options?.residual_overlay_display_mode
    ?? DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE;
}

export function isAggregatableResidualOverlay(domain: ResidualOverlayDomain): boolean {
  return domain !== 'net_sink';
}

export function getResidualOverlayDisplayBucket(
  overlay: ResidualOverlayDisplayBucketInput,
  displayMode: ResidualOverlayDisplayMode,
): ResidualOverlayDisplayBucket {
  if (
    displayMode === 'aggregated_non_sink'
    && isAggregatableResidualOverlay(overlay.overlayDomain)
  ) {
    return {
      overlayId: AGGREGATED_RESIDUAL_OVERLAY_ID,
      overlayLabel: AGGREGATED_RESIDUAL_OVERLAY_LABEL,
    };
  }

  return {
    overlayId: overlay.overlayId,
    overlayLabel: overlay.overlayLabel,
  };
}
