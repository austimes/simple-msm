import { useCallback, useEffect, useMemo } from 'react';
import {
  type AdditionalityAnalysisState,
  type AdditionalityOrderingMethod,
  type AdditionalityPackageData,
  type AdditionalityPreparation,
  applyAdditionalityCommoditySelections,
  canonicalizeAdditionalityConfiguration,
  DEFAULT_ADDITIONALITY_METHOD,
  DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT,
  isAdditionalityCancelledError,
  prepareAdditionalityAnalysis,
  runAdditionalityAnalysis,
} from '../additionality/additionalityAnalysis.ts';
import {
  type AdditionalityRuntimeEntry,
  useAppUiStore,
} from '../data/appUiStore.ts';
import type { ConfigurationDocument, PriceLevel } from '../data/types.ts';
import { runSolveInWorker } from '../solver/solverClient.ts';

const IDLE_STATE: AdditionalityAnalysisState = {
  phase: 'idle',
  report: null,
  progress: { completed: 0, totalExpected: 0 },
  error: null,
  validationIssues: [],
};

interface UseAdditionalityAnalysisOptions {
  baseConfiguration: ConfigurationDocument | null;
  baseConfigId: string | null;
  commoditySelections: Record<string, PriceLevel>;
  method?: AdditionalityOrderingMethod;
  pkg: AdditionalityPackageData;
  shapleySampleCount?: number;
  targetConfiguration: ConfigurationDocument | null;
  targetConfigId: string | null;
}

interface AdditionalityAnalysisCacheKeyOptions {
  appliedBaseConfiguration: ConfigurationDocument;
  baseConfigId: string;
  commoditySelections: Record<string, PriceLevel>;
  method: AdditionalityOrderingMethod;
  appliedTargetConfiguration: ConfigurationDocument;
  shapleySampleCount: number;
  targetConfigId: string;
}

interface AdditionalityRunStartDecisionOptions {
  force: boolean;
  prepared: AdditionalityPreparation | null;
  preparedKey: string | null;
  runtimeEntry: AdditionalityRuntimeEntry | null;
}

export interface UseAdditionalityAnalysisResult {
  analysisState: AdditionalityAnalysisState;
  recalculate: () => void;
}

function normalizeAdditionalityCacheValue(
  value: unknown,
  parentKey: string | null = null,
): unknown {
  if (Array.isArray(value)) {
    const normalizedItems = value.map((entry) => normalizeAdditionalityCacheValue(entry));

    if (parentKey === 'active_state_ids') {
      return [...normalizedItems].sort((left, right) => String(left).localeCompare(String(right)));
    }

    return normalizedItems;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [
          key,
          normalizeAdditionalityCacheValue(nestedValue, key),
        ]),
    );
  }

  return value;
}

export function buildAdditionalityAnalysisCacheKey(
  options: AdditionalityAnalysisCacheKeyOptions,
): string {
  return JSON.stringify(
    normalizeAdditionalityCacheValue({
      appliedBaseConfiguration: options.appliedBaseConfiguration,
      appliedTargetConfiguration: options.appliedTargetConfiguration,
      baseConfigId: options.baseConfigId,
      commoditySelections: options.commoditySelections,
      method: options.method,
      shapleySampleCount: options.shapleySampleCount,
      targetConfigId: options.targetConfigId,
    }),
  );
}

function buildImmediateAdditionalityState(
  prepared: AdditionalityPreparation | null,
): AdditionalityAnalysisState | null {
  if (!prepared) {
    return IDLE_STATE;
  }

  if (prepared.validationIssues.length > 0) {
    return {
      phase: 'validation',
      report: null,
      progress: { completed: 0, totalExpected: 0 },
      error: null,
      validationIssues: prepared.validationIssues,
    };
  }

  if (prepared.atoms.length === 0) {
    return {
      phase: 'empty',
      report: null,
      progress: { completed: 0, totalExpected: 0 },
      error: null,
      validationIssues: [],
    };
  }

  return null;
}

function buildLoadingAdditionalityState(
  prepared: AdditionalityPreparation,
  runtimeEntry: AdditionalityRuntimeEntry | null,
): AdditionalityAnalysisState {
  return {
    phase: 'loading',
    report: runtimeEntry?.state.report ?? null,
    progress: runtimeEntry?.state.phase === 'loading'
      ? runtimeEntry.state.progress
      : { completed: 0, totalExpected: prepared.totalExpected },
    error: null,
    validationIssues: [],
  };
}

export function shouldStartAdditionalityRun({
  force,
  prepared,
  preparedKey,
  runtimeEntry,
}: AdditionalityRunStartDecisionOptions): boolean {
  if (!prepared || !preparedKey || prepared.validationIssues.length > 0 || prepared.atoms.length === 0) {
    return false;
  }

  if (runtimeEntry?.inFlight) {
    return false;
  }

  if (force) {
    return true;
  }

  return runtimeEntry == null;
}

export function useAdditionalityAnalysis(
  options: UseAdditionalityAnalysisOptions,
): UseAdditionalityAnalysisResult {
  const method = options.method ?? DEFAULT_ADDITIONALITY_METHOD;
  const shapleySampleCount = options.shapleySampleCount ?? DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT;
  const prepared = useMemo(() => {
    if (
      !options.baseConfiguration
      || !options.targetConfiguration
      || !options.baseConfigId
      || !options.targetConfigId
    ) {
      return null;
    }

    return prepareAdditionalityAnalysis({
      baseConfiguration: options.baseConfiguration,
      baseConfigId: options.baseConfigId,
      commoditySelections: options.commoditySelections,
      method,
      pkg: options.pkg,
      shapleySampleCount,
      targetConfiguration: options.targetConfiguration,
      targetConfigId: options.targetConfigId,
    });
  }, [
    options.baseConfigId,
    options.baseConfiguration,
    options.commoditySelections,
    method,
    options.pkg,
    shapleySampleCount,
    options.targetConfigId,
    options.targetConfiguration,
  ]);

  const preparedKey = useMemo(() => {
    const baseConfigId = options.baseConfigId;
    const targetConfigId = options.targetConfigId;

    if (!prepared || !baseConfigId || !targetConfigId) {
      return null;
    }

    return buildAdditionalityAnalysisCacheKey({
      appliedBaseConfiguration: prepared.baseConfiguration,
      baseConfigId,
      commoditySelections: options.commoditySelections,
      method,
      appliedTargetConfiguration: prepared.targetConfiguration,
      shapleySampleCount,
      targetConfigId,
    });
  }, [
    options.baseConfigId,
    options.commoditySelections,
    method,
    shapleySampleCount,
    options.targetConfigId,
    prepared,
  ]);

  const runtimeEntry = useAppUiStore((state) => {
    if (!preparedKey) {
      return null;
    }

    return state.additionalityRuntime.entriesByKey[preparedKey] ?? null;
  });
  const beginAdditionalityRun = useAppUiStore((state) => state.beginAdditionalityRun);
  const updateAdditionalityRunProgress = useAppUiStore((state) => state.updateAdditionalityRunProgress);
  const finishAdditionalityRun = useAppUiStore((state) => state.finishAdditionalityRun);

  const startAnalysis = useCallback((force: boolean) => {
    const baseConfigId = options.baseConfigId;
    const targetConfigId = options.targetConfigId;

    const currentRuntimeEntry = preparedKey
      ? useAppUiStore.getState().additionalityRuntime.entriesByKey[preparedKey] ?? null
      : null;

    if (
      !prepared
      || !preparedKey
      || !baseConfigId
      || !targetConfigId
      || !shouldStartAdditionalityRun({
        force,
        prepared,
        preparedKey,
        runtimeEntry: currentRuntimeEntry,
      })
    ) {
      return;
    }

    const loadingState = buildLoadingAdditionalityState(prepared, currentRuntimeEntry);
    const runToken = beginAdditionalityRun(preparedKey, loadingState);

    const getCurrentRuntimeEntry = (): AdditionalityRuntimeEntry | null => {
      return useAppUiStore.getState().additionalityRuntime.entriesByKey[preparedKey] ?? null;
    };

    void runAdditionalityAnalysis(
      {
        baseConfiguration: prepared.baseConfiguration,
        baseConfigId,
        commoditySelections: options.commoditySelections,
        method,
        pkg: options.pkg,
        shapleySampleCount,
        targetConfiguration: prepared.targetConfiguration,
        targetConfigId,
      },
      {
        isCancelled: () => {
          const currentEntry = getCurrentRuntimeEntry();
          return !currentEntry || currentEntry.runToken !== runToken || !currentEntry.inFlight;
        },
        onProgress: (progress) => {
          updateAdditionalityRunProgress(preparedKey, runToken, progress);
        },
        solve: (request) => runSolveInWorker(request),
      },
    )
      .then((nextState) => {
        finishAdditionalityRun(preparedKey, runToken, nextState);
      })
      .catch((error) => {
        if (isAdditionalityCancelledError(error)) {
          return;
        }

        const retainedReport = getCurrentRuntimeEntry()?.state.report ?? null;
        finishAdditionalityRun(preparedKey, runToken, {
          phase: 'error',
          report: retainedReport,
          progress: { completed: 0, totalExpected: prepared.totalExpected },
          error: error instanceof Error ? error.message : 'Additionality analysis failed.',
          validationIssues: [],
        });
      });
  }, [
    beginAdditionalityRun,
    finishAdditionalityRun,
    options.baseConfigId,
    options.commoditySelections,
    method,
    options.pkg,
    shapleySampleCount,
    options.targetConfigId,
    prepared,
    preparedKey,
    updateAdditionalityRunProgress,
  ]);

  useEffect(() => {
    startAnalysis(false);
  }, [startAnalysis]);

  const analysisState = useMemo(() => {
    const immediateState = buildImmediateAdditionalityState(prepared);

    if (immediateState) {
      return immediateState;
    }

    if (runtimeEntry) {
      return runtimeEntry.state;
    }

    return buildLoadingAdditionalityState(prepared as AdditionalityPreparation, null);
  }, [prepared, runtimeEntry]);

  const recalculate = useCallback(() => {
    startAnalysis(true);
  }, [startAnalysis]);

  return {
    analysisState,
    recalculate,
  };
}

export function buildAdditionalityAnalysisCacheKeyFromSelections(
  options: Omit<
    AdditionalityAnalysisCacheKeyOptions,
    'appliedBaseConfiguration' | 'appliedTargetConfiguration' | 'method' | 'shapleySampleCount'
  > & {
    baseConfiguration: ConfigurationDocument;
    method?: AdditionalityOrderingMethod;
    pkg: AdditionalityPackageData;
    shapleySampleCount?: number;
    targetConfiguration: ConfigurationDocument;
  },
): string {
  const method = options.method ?? DEFAULT_ADDITIONALITY_METHOD;
  const shapleySampleCount = options.shapleySampleCount ?? DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT;

  return buildAdditionalityAnalysisCacheKey({
    appliedBaseConfiguration: canonicalizeAdditionalityConfiguration(
      applyAdditionalityCommoditySelections(
        options.baseConfiguration,
        options.commoditySelections,
      ),
      options.pkg,
    ),
    baseConfigId: options.baseConfigId,
    commoditySelections: options.commoditySelections,
    method,
    appliedTargetConfiguration: canonicalizeAdditionalityConfiguration(
      applyAdditionalityCommoditySelections(
        options.targetConfiguration,
        options.commoditySelections,
      ),
      options.pkg,
    ),
    shapleySampleCount,
    targetConfigId: options.targetConfigId,
  });
}
