import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConfigurationDocument, PackageData, PriceLevel } from '../data/types.ts';
import {
  type AdditionalityAnalysisState,
  type AdditionalityPreparation,
  isAdditionalityCancelledError,
  prepareAdditionalityAnalysis,
  runAdditionalityAnalysis,
} from '../additionality/additionalityAnalysis.ts';
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
  pkg: Pick<PackageData, 'appConfig' | 'sectorStates'>;
  targetConfiguration: ConfigurationDocument | null;
  targetConfigId: string | null;
}

interface AsyncAdditionalityState {
  key: string | null;
  progress: AdditionalityAnalysisState['progress'];
  result: AdditionalityAnalysisState | null;
}

function buildPreparedKey(
  prepared: AdditionalityPreparation | null,
  baseConfigId: string | null,
  targetConfigId: string | null,
  commoditySelections: Record<string, PriceLevel>,
): string | null {
  if (!prepared || !baseConfigId || !targetConfigId) {
    return null;
  }

  return JSON.stringify({
    atoms: prepared.atoms.map((atom) => atom.key),
    baseConfigId,
    commoditySelections,
    targetConfigId,
    totalExpected: prepared.totalExpected,
    validationIssues: prepared.validationIssues.map((issue) => `${issue.code}:${issue.outputId ?? ''}`),
  });
}

export function useAdditionalityAnalysis(
  options: UseAdditionalityAnalysisOptions,
): AdditionalityAnalysisState {
  const [asyncState, setAsyncState] = useState<AsyncAdditionalityState>({
    key: null,
    progress: { completed: 0, totalExpected: 0 },
    result: null,
  });
  const runVersionRef = useRef(0);
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
      pkg: options.pkg,
      targetConfiguration: options.targetConfiguration,
      targetConfigId: options.targetConfigId,
    });
  }, [
    options.baseConfigId,
    options.baseConfiguration,
    options.commoditySelections,
    options.pkg,
    options.targetConfigId,
    options.targetConfiguration,
  ]);
  const preparedKey = useMemo(
    () => buildPreparedKey(prepared, options.baseConfigId, options.targetConfigId, options.commoditySelections),
    [options.baseConfigId, options.commoditySelections, options.targetConfigId, prepared],
  );

  useEffect(() => {
    const baseConfigId = options.baseConfigId;
    const targetConfigId = options.targetConfigId;

    if (
      !prepared
      || !preparedKey
      || !baseConfigId
      || !targetConfigId
      || prepared.validationIssues.length > 0
      || prepared.atoms.length === 0
    ) {
      return;
    }

    const runVersion = runVersionRef.current + 1;
    runVersionRef.current = runVersion;

    void runAdditionalityAnalysis(
      {
        baseConfiguration: prepared.baseConfiguration,
        baseConfigId,
        commoditySelections: options.commoditySelections,
        pkg: options.pkg,
        targetConfiguration: prepared.targetConfiguration,
        targetConfigId,
      },
      {
        isCancelled: () => runVersionRef.current !== runVersion,
        onProgress: (progress) => {
          if (runVersionRef.current !== runVersion) {
            return;
          }

          setAsyncState({
            key: preparedKey,
            progress,
            result: null,
          });
        },
        solve: (request) => runSolveInWorker(request),
      },
    )
      .then((nextState) => {
        if (runVersionRef.current !== runVersion) {
          return;
        }

        setAsyncState({
          key: preparedKey,
          progress: nextState.progress,
          result: nextState,
        });
      })
      .catch((error) => {
        if (runVersionRef.current !== runVersion || isAdditionalityCancelledError(error)) {
          return;
        }

        setAsyncState({
          key: preparedKey,
          progress: { completed: 0, totalExpected: prepared.totalExpected },
          result: {
            phase: 'error',
            report: null,
            progress: { completed: 0, totalExpected: prepared.totalExpected },
            error: error instanceof Error ? error.message : 'Additionality analysis failed.',
            validationIssues: [],
          },
        });
      });
  }, [
    options.baseConfigId,
    options.commoditySelections,
    options.pkg,
    options.targetConfigId,
    prepared,
    preparedKey,
  ]);

  return useMemo(() => {
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

    if (asyncState.key === preparedKey && asyncState.result) {
      return asyncState.result;
    }

    return {
      phase: 'loading',
      report: null,
      progress: asyncState.key === preparedKey
        ? asyncState.progress
        : { completed: 0, totalExpected: prepared.totalExpected },
      error: null,
      validationIssues: [],
    };
  }, [asyncState, prepared, preparedKey]);
}
