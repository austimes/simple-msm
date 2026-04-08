import { useCallback, useRef, useState } from 'react';
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
  isStale: boolean;
  solve: () => void;
}

export function useScenarioSolve(): SolveState {
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const appConfig = usePackageStore((state) => state.appConfig);
  const currentScenario = usePackageStore((state) => state.currentScenario);

  const [phase, setPhase] = useState<SolvePhase>('idle');
  const [result, setResult] = useState<SolveResult | null>(null);
  const [request, setRequest] = useState<SolveRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solvedScenario, setSolvedScenario] = useState<object | null>(null);

  const cancelledRef = useRef(0);

  const isStale = phase === 'solved' && solvedScenario !== currentScenario;

  const solve = useCallback(() => {
    const solveId = ++cancelledRef.current;

    let builtRequest: SolveRequest;
    try {
      builtRequest = buildSolveRequest({
        sectorStates,
        appConfig,
        defaultScenario: currentScenario,
      });
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
        setSolvedScenario(currentScenario);
      })
      .catch((err) => {
        if (cancelledRef.current !== solveId) {
          return;
        }

        setPhase('error');
        setError(err instanceof Error ? err.message : 'Unknown solve failure.');
        setResult(null);
      });
  }, [sectorStates, appConfig, currentScenario]);

  return {
    phase,
    result,
    request,
    error,
    isStale,
    solve,
  };
}
