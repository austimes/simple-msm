import { useCallback, useEffect, useRef, useState } from 'react';
import { getIncludedOutputIds } from '../data/configurationLoader';
import { usePackageStore } from '../data/packageStore';
import { buildSolveRequest } from '../solver/buildSolveRequest';
import type { SolveRequest, SolveResult } from '../solver/contract';
import { runSolveInWorker } from '../solver/solverClient';

export type SolvePhase = 'idle' | 'solving' | 'solved' | 'error';

export interface SolveState {
  phase: SolvePhase;
  result: SolveResult | null;
  request: SolveRequest | null;
  error: string | null;
  solve: () => void;
}

export function useScenarioSolve(): SolveState {
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const appConfig = usePackageStore((state) => state.appConfig);
  const currentConfiguration = usePackageStore((state) => state.currentConfiguration);
  const includedOutputIds = getIncludedOutputIds(currentConfiguration);

  const [phase, setPhase] = useState<SolvePhase>('idle');
  const [result, setResult] = useState<SolveResult | null>(null);
  const [request, setRequest] = useState<SolveRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(0);

  const solve = useCallback(() => {
    const solveId = ++cancelledRef.current;

    let builtRequest: SolveRequest;
    try {
      builtRequest = buildSolveRequest(
        {
          sectorStates,
          appConfig,
          defaultConfiguration: currentConfiguration,
        },
        currentConfiguration,
        includedOutputIds ? { includedOutputIds } : {},
      );
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to build solve request.');
      setResult(null);
      setRequest(null);
      return;
    }

    setPhase('solving');
    setError(null);
    setRequest(builtRequest);

    void runSolveInWorker(builtRequest)
      .then((workerResult) => {
        if (cancelledRef.current !== solveId) {
          return;
        }

        setPhase('solved');
        setResult(workerResult);
        setRequest(builtRequest);
      })
      .catch((err) => {
        if (cancelledRef.current !== solveId) {
          return;
        }

        setPhase('error');
        setError(err instanceof Error ? err.message : 'Unknown solve failure.');
        setResult(null);
      });
  }, [sectorStates, appConfig, currentConfiguration, includedOutputIds]);

  // Auto-solve whenever the scenario changes
  useEffect(() => {
    const timer = setTimeout(() => {
      solve();
    }, 0)

    return () => {
      clearTimeout(timer)
    }
  }, [solve]);

  return {
    phase,
    result,
    request,
    error,
    solve,
  };
}
