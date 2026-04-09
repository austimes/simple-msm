import type { SolveRequest, SolveResult, SolverWorkerResponseMessage } from './contract';

interface PendingSolve {
  resolve: (result: SolveResult) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

const pendingSolves = new Map<string, PendingSolve>();
let solverWorker: Worker | null = null;

function rejectAllPending(reason: string): void {
  for (const [requestId, pending] of pendingSolves) {
    window.clearTimeout(pending.timeoutId);
    pending.reject(new Error(reason));
    pendingSolves.delete(requestId);
  }
}

function getSolverWorker(): Worker {
  if (solverWorker) {
    return solverWorker;
  }

  solverWorker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
    type: 'module',
  });

  solverWorker.addEventListener('message', (event: MessageEvent<SolverWorkerResponseMessage>) => {
    if (event.data.type !== 'solve:result') {
      return;
    }

    const pending = pendingSolves.get(event.data.result.requestId);
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timeoutId);
    pendingSolves.delete(event.data.result.requestId);
    pending.resolve(event.data.result);
  });

  solverWorker.addEventListener('error', (event) => {
    rejectAllPending(event.message || 'The solver worker terminated unexpectedly.');
  });

  return solverWorker;
}

export function runSolveInWorker(request: SolveRequest): Promise<SolveResult> {
  const worker = getSolverWorker();

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingSolves.delete(request.requestId);
      reject(new Error(`Timed out waiting for worker solve ${request.requestId}.`));
    }, 30000);

    pendingSolves.set(request.requestId, {
      resolve,
      reject,
      timeoutId,
    });

    worker.postMessage({
      type: 'solve',
      request,
    });
  });
}
