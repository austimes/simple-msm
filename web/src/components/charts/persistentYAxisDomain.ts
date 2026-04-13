import { useEffect, useSyncExternalStore } from 'react';

type ChartDomain = [number, number];

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const WORKSPACE_Y_AXIS_STORAGE_PREFIX = 'simple-msm.workspace-y-axis.v1.';
const memoryStorageFallback = new Map<string, string>();
const domainSubscribers = new Map<string, Set<() => void>>();

function isFiniteDomain(value: unknown): value is ChartDomain {
  return Array.isArray(value)
    && value.length === 2
    && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
    && value[0] <= value[1];
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }

  return getBrowserStorage();
}

export function buildWorkspaceYAxisStorageKey(chartKey: string): string {
  return `${WORKSPACE_Y_AXIS_STORAGE_PREFIX}${chartKey}`;
}

export function parseStoredDomain(raw: string | null | undefined): ChartDomain | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return isFiniteDomain(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeRememberedDomain(
  storedDomain: ChartDomain | null | undefined,
  autoDomain: ChartDomain,
): ChartDomain {
  if (!isFiniteDomain(storedDomain)) {
    return autoDomain;
  }

  return [
    Math.min(storedDomain[0], autoDomain[0]),
    Math.max(storedDomain[1], autoDomain[1]),
  ];
}

export function domainsEqual(
  left: ChartDomain | null | undefined,
  right: ChartDomain | null | undefined,
): boolean {
  return isFiniteDomain(left)
    && isFiniteDomain(right)
    && left[0] === right[0]
    && left[1] === right[1];
}

export function loadStoredYAxisDomain(
  chartKey: string,
  storage?: StorageLike | null,
): ChartDomain | null {
  return parseStoredDomain(loadStoredYAxisDomainRaw(chartKey, storage));
}

function loadStoredYAxisDomainRaw(
  chartKey: string,
  storage?: StorageLike | null,
): string | null {
  const storageKey = buildWorkspaceYAxisStorageKey(chartKey);
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return memoryStorageFallback.get(storageKey) ?? null;
  }

  try {
    return resolvedStorage.getItem(storageKey);
  } catch {
    return memoryStorageFallback.get(storageKey) ?? null;
  }
}

export function persistStoredYAxisDomain(
  chartKey: string,
  domain: ChartDomain,
  storage?: StorageLike | null,
): void {
  if (!isFiniteDomain(domain)) {
    return;
  }

  const storageKey = buildWorkspaceYAxisStorageKey(chartKey);
  const serializedDomain = JSON.stringify(domain);
  const resolvedStorage = resolveStorage(storage);

  memoryStorageFallback.set(storageKey, serializedDomain);

  if (!resolvedStorage) {
    return;
  }

  try {
    resolvedStorage.setItem(storageKey, serializedDomain);
  } catch {
    // Fall back to in-memory persistence for the current runtime.
  }
}

export function resetStoredYAxisDomain(
  chartKey: string,
  autoDomain: ChartDomain,
  storage?: StorageLike | null,
): void {
  persistStoredYAxisDomain(chartKey, autoDomain, storage);
}

function subscribeToStoredYAxisDomain(
  chartKey: string,
  listener: () => void,
): () => void {
  let listeners = domainSubscribers.get(chartKey);
  if (!listeners) {
    listeners = new Set();
    domainSubscribers.set(chartKey, listeners);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      domainSubscribers.delete(chartKey);
    }
  };
}

function notifyStoredYAxisDomainChange(chartKey: string): void {
  const listeners = domainSubscribers.get(chartKey);
  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener();
  }
}

interface UsePersistentYAxisDomainOptions {
  chartKey?: string | null;
  autoDomain: ChartDomain;
}

export function usePersistentYAxisDomain({
  chartKey,
  autoDomain,
}: UsePersistentYAxisDomainOptions) {
  const activeChartKey = chartKey ?? null;
  const storedDomainRaw = useSyncExternalStore(
    (onStoreChange) => (
      activeChartKey ? subscribeToStoredYAxisDomain(activeChartKey, onStoreChange) : () => {}
    ),
    () => (activeChartKey ? loadStoredYAxisDomainRaw(activeChartKey) : null),
    () => null,
  );
  const storedDomain = parseStoredDomain(storedDomainRaw);

  const effectiveDomain = activeChartKey
    ? mergeRememberedDomain(storedDomain, autoDomain)
    : autoDomain;
  const effectiveDomainMin = effectiveDomain[0];
  const effectiveDomainMax = effectiveDomain[1];

  useEffect(() => {
    if (!activeChartKey) {
      return;
    }

    const nextDomain: ChartDomain = [effectiveDomainMin, effectiveDomainMax];
    const currentStoredDomain = parseStoredDomain(storedDomainRaw);
    if (domainsEqual(currentStoredDomain, nextDomain)) {
      return;
    }

    persistStoredYAxisDomain(activeChartKey, nextDomain);
    notifyStoredYAxisDomainChange(activeChartKey);
  }, [activeChartKey, effectiveDomainMax, effectiveDomainMin, storedDomainRaw]);

  function resetDomain() {
    if (!activeChartKey) {
      return;
    }

    if (domainsEqual(storedDomain, autoDomain)) {
      return;
    }

    resetStoredYAxisDomain(activeChartKey, autoDomain);
    notifyStoredYAxisDomainChange(activeChartKey);
  }

  return {
    effectiveDomain,
    resetDomain,
    isPersistent: activeChartKey != null,
  };
}
