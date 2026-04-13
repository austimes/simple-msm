import type { ConfigurationDocument } from '../data/types.ts';
import type { SolveRequest, SolveResult } from '../solver/contract.ts';
import type { ResultContributionRow } from './resultContributions.ts';

export interface ExecutionSnapshot {
  configId: string | null;
  configuration: ConfigurationDocument;
  request: SolveRequest;
  result: SolveResult;
  contributions: ResultContributionRow[];
}
