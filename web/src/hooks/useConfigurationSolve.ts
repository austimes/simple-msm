import { useCallback, useEffect, useRef, useState } from 'react';
import { usePackageStore } from '../data/packageStore';
import { buildSolveRequest } from '../solver/buildSolveRequest';
import type { SolveRequest, SolveResult } from '../solver/contract';
import {
  buildConfigurationBuildFailure,
  buildConfigurationSolveFailure,
  type ConfigurationSolveFailure,
} from '../solver/configurationSolveFailure.ts';
import { runSolveInWorker } from '../solver/solverClient';

export type SolvePhase = 'idle' | 'solving' | 'solved' | 'error';

export interface SolveState {
  phase: SolvePhase;
  result: SolveResult | null;
  request: SolveRequest | null;
  error: string | null;
  failure: ConfigurationSolveFailure | null;
  solve: () => void;
}

export function useConfigurationSolve(): SolveState {
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const appConfig = usePackageStore((state) => state.appConfig);
  const currentConfiguration = usePackageStore((state) => state.currentConfiguration);

  const [phase, setPhase] = useState<SolvePhase>('solving');
  const [result, setResult] = useState<SolveResult | null>(null);
  const [request, setRequest] = useState<SolveRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<ConfigurationSolveFailure | null>(null);

  const cancelledRef = useRef(0);

  const solve = useCallback(() => {
    const solveId = ++cancelledRef.current;

    let builtRequest: SolveRequest;
    try {
      builtRequest = buildSolveRequest({ sectorStates, appConfig }, currentConfiguration);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to build solve request.';
      setPhase('error');
      setError(message);
      setFailure(buildConfigurationBuildFailure(message));
      return;
    }

    setPhase('solving');
    setError(null);
    setFailure(null);

    void runSolveInWorker(builtRequest)
      .then((workerResult) => {
        if (cancelledRef.current !== solveId) {
          return;
        }

        if (workerResult.status === 'error') {
          const solveFailure = buildConfigurationSolveFailure(workerResult);
          setPhase('error');
          setError(solveFailure.headline);
          setFailure(solveFailure);
          return;
        }

        setRequest(builtRequest);
        setResult(workerResult);
        setError(null);
        setPhase('solved');
        setFailure(null);
      })
      .catch((err) => {
        if (cancelledRef.current !== solveId) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Unknown solve failure.';
        setPhase('error');
        setError(message);
        setFailure({
          stage: 'solve',
          headline: message,
          detailLines: [],
          diagnostics: [],
          result: null,
        });
      });
  }, [sectorStates, appConfig, currentConfiguration]);

  // Auto-solve whenever the active document changes.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      solve();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [solve]);

  return {
    phase,
    result,
    request,
    error,
    failure,
    solve,
  };
}
