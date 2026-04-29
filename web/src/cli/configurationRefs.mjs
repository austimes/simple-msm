import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getConfigurationId,
  isReadonlyConfiguration,
  loadBuiltinConfigurations,
  loadUserConfigurations,
} from '../data/configurationLoader.ts'
import {
  materializeEfficiencyConfiguration,
  materializeResidualOverlayConfiguration,
  parseConfigurationDocument,
} from '../data/configurationDocumentLoader.ts'
import { materializeServiceControlsFromRoleControls } from '../data/configurationRoleControls.ts'

function cloneConfiguration(configuration) {
  return structuredClone(configuration)
}

function looksLikeConfigPath(rawRef) {
  return rawRef.endsWith('.json') || rawRef.includes('/') || rawRef.includes('\\') || rawRef.startsWith('.')
}

function builtinConfigPath(configId) {
  return fileURLToPath(new URL(`../configurations/${configId}.json`, import.meta.url))
}

function userConfigPath(configId) {
  return fileURLToPath(new URL(`../configurations/user/${configId}.json`, import.meta.url))
}

function resolveKnownSourcePath(sourceKind, configId) {
  if (!configId) {
    return null
  }

  const candidate = sourceKind === 'builtin' ? builtinConfigPath(configId) : userConfigPath(configId)
  return existsSync(candidate) ? candidate : null
}

function buildCatalogEntry(configuration, sourceKind) {
  const configId = getConfigurationId(configuration)
  return {
    requestedRef: sourceKind === 'user' && configId ? `user:${configId}` : configId ?? configuration.name,
    canonicalRef: sourceKind === 'user' && configId ? `user:${configId}` : configId ?? configuration.name,
    sourceKind,
    configId,
    readonly: isReadonlyConfiguration(configuration),
    sourcePath: resolveKnownSourcePath(sourceKind, configId),
    configuration: cloneConfiguration(configuration),
  }
}

export function listCliConfigurations() {
  const builtins = loadBuiltinConfigurations().map((configuration) => buildCatalogEntry(configuration, 'builtin'))
  const userConfigurations = loadUserConfigurations().map((configuration) => buildCatalogEntry(configuration, 'user'))
  return [...builtins, ...userConfigurations]
}

function findBuiltinConfiguration(rawRef) {
  const normalizedRef = rawRef.startsWith('builtin:') ? rawRef.slice('builtin:'.length) : rawRef
  return listCliConfigurations().find(
    (entry) => entry.sourceKind === 'builtin' && entry.configId === normalizedRef,
  ) ?? null
}

function findUserConfiguration(rawRef) {
  const normalizedRef = rawRef.startsWith('user:') ? rawRef.slice('user:'.length) : rawRef
  return listCliConfigurations().find(
    (entry) => entry.sourceKind === 'user' && entry.configId === normalizedRef,
  ) ?? null
}

function loadFileConfiguration(rawRef) {
  const sourcePath = resolvePath(process.cwd(), rawRef)
  if (!existsSync(sourcePath)) {
    throw new Error(`Config file not found: ${rawRef}`)
  }

  const configuration = parseConfigurationDocument(
    readFileSync(sourcePath, 'utf8'),
    undefined,
    `config ${rawRef}`,
  )
  const configId = getConfigurationId(configuration)
  return {
    requestedRef: rawRef,
    canonicalRef: rawRef,
    sourceKind: 'file',
    configId,
    readonly: false,
    sourcePath,
    configuration,
  }
}

export function resolveCliConfigurationReference(rawRef) {
  if (rawRef.startsWith('user:')) {
    const match = findUserConfiguration(rawRef)
    if (!match) {
      throw new Error(`Unknown user config ${JSON.stringify(rawRef)}. Run "bun run msm list" to see available configs.`)
    }
    return match
  }

  if (rawRef.startsWith('builtin:')) {
    const match = findBuiltinConfiguration(rawRef)
    if (!match) {
      throw new Error(`Unknown built-in config ${JSON.stringify(rawRef)}. Run "bun run msm list" to see available configs.`)
    }
    return match
  }

  if (looksLikeConfigPath(rawRef)) {
    return loadFileConfiguration(rawRef)
  }

  const builtinMatch = findBuiltinConfiguration(rawRef)
  if (builtinMatch) {
    return {
      ...builtinMatch,
      requestedRef: rawRef,
    }
  }

  const userMatch = findUserConfiguration(rawRef)
  if (userMatch) {
    return {
      ...userMatch,
      requestedRef: rawRef,
    }
  }

  throw new Error(`Unknown config ${JSON.stringify(rawRef)}. Run "bun run msm list" to see available configs.`)
}

export function materializeConfigurationForRuntime(configuration, pkg) {
  return materializeEfficiencyConfiguration(
    materializeResidualOverlayConfiguration(
      materializeServiceControlsFromRoleControls(configuration, { sectorStates: pkg.sectorStates }),
      pkg.residualOverlays2025,
    ),
    pkg.autonomousEfficiencyTracks,
    pkg.efficiencyPackages,
  )
}
