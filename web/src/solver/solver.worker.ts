import {
  SOLVER_CONTRACT_VERSION,
  type SolveDiagnostic,
  type SolveRequest,
  type SolveResult,
  type SolverWorkerRequestMessage,
  type SolverWorkerResponseMessage,
} from './contract.ts';
import { solveWithLpAdapter } from './lpAdapter';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<SolverWorkerRequestMessage>) => void) | null;
  postMessage: (message: SolverWorkerResponseMessage) => void;
};

function buildErrorResult(request: SolveRequest, diagnostics: SolveDiagnostic[]): SolveResult {
  return {
    contractVersion: request.contractVersion,
    requestId: request.requestId,
    status: 'error',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: request.rows.length,
      yearCount: request.configuration.years.length,
      outputCount: new Set(request.rows.map((row) => row.outputId)).size,
      serviceDemandOutputCount: Object.keys(request.configuration.serviceDemandByOutput).length,
      externalCommodityCount: Object.keys(request.configuration.externalCommodityDemandByCommodity).length,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [],
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: null,
    diagnostics,
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
}

workerScope.onmessage = (event: MessageEvent<SolverWorkerRequestMessage>) => {
  const message = event.data;

  if (message.type !== 'solve') {
    return;
  }

  const request = message.request;

  let result: SolveResult;
  if (request.contractVersion !== SOLVER_CONTRACT_VERSION) {
    result = buildErrorResult(request, [
      {
        code: 'unsupported_contract_version',
        severity: 'error',
        message: `Expected solver contract version ${SOLVER_CONTRACT_VERSION} but received ${request.contractVersion}.`,
      },
    ]);
  } else {
    try {
      result = solveWithLpAdapter(request);
    } catch (error) {
      result = buildErrorResult(request, [
        {
          code: 'worker_exception',
          severity: 'error',
          message: error instanceof Error ? error.message : 'Unknown worker failure.',
        },
      ]);
    }
  }

  const response: SolverWorkerResponseMessage = {
    type: 'solve:result',
    result,
  };
  workerScope.postMessage(response);
};

export {};
