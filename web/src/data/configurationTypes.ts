/**
 * A SolveConfiguration bundles a scenario document with output scoping,
 * solver options overrides, and metadata. This is the unit that can be
 * saved, loaded, and run from both the web app and the CLI.
 */
import type { ScenarioControlMode, ScenarioSolverOptions } from './types';

export interface SolveConfigurationServiceControl {
  mode: ScenarioControlMode;
  state_id?: string | null;
  fixed_shares?: Record<string, number> | null;
  disabled_state_ids?: string[] | null;
}

export interface SolveConfiguration {
  /** Unique slug used as file name and lookup key. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Whether this configuration is read-only (built-in from tests). */
  readonly: boolean;
  /**
   * Output IDs to include in the scoped solve.
   * When empty or undefined, the full model is solved.
   */
  includedOutputIds?: string[];
  /**
   * Service control overrides — merged on top of the reference scenario controls.
   * Only the controls that differ from the reference need to be specified.
   */
  serviceControls: Record<string, SolveConfigurationServiceControl>;
  /** Demand growth preset to apply (overrides the reference preset). */
  demandPresetId?: string;
  /** Per-commodity price level selections (overrides reference selections). */
  commodityPriceSelections?: Partial<Record<string, import('./types').PriceLevel>>;
  /** @deprecated Legacy commodity price preset ID for migration. */
  commodityPricePresetId?: string;
  /** Solver options overrides — merged on top of the reference scenario options. */
  solverOptions?: ScenarioSolverOptions;
}
