import { parseCsv } from './parseCsv.ts';
import type {
  AssumptionLedgerEntry,
  PackageCompanionDoc,
  PackageEnrichment,
  PackageSchemaField,
  PackageSchemaInfo,
  SourceLedgerEntry,
} from './types.ts';

interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
}

interface JsonSchemaDocument {
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
}

const PACKAGE_IMPORT_PREFIX = '../../../aus_phase1_sector_state_library/';

function titleizeSegment(value: string): string {
  return value
    .replace(/\.md$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function extractMarkdownTitle(path: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || titleizeSegment(path.split('/').pop() ?? path);
}

function parseOptionalJsonObject<T>(
  raw: string | undefined,
  path: string,
  warnings: string[],
): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown parse failure';
    warnings.push(`Skipped optional companion ${path}: ${detail}`);
    return null;
  }
}

function formatSchemaType(type: string | string[] | undefined): string {
  if (Array.isArray(type)) {
    return type.join(' | ');
  }

  return type ?? 'unspecified';
}

function toSourceLedgerEntry(row: Record<string, string>): SourceLedgerEntry {
  return {
    sourceId: row['source_id'],
    citation: row['citation'],
    publicationDate: row['publication_date'],
    institution: row['institution'],
    location: row['url_or_document_location'],
    parametersInformed: row['parameters_informed'],
    qualityNotes: row['quality_authority_notes'],
  };
}

function toAssumptionLedgerEntry(row: Record<string, string>): AssumptionLedgerEntry {
  return {
    assumptionId: row['assumption_id'],
    statement: row['assumption_statement'],
    rationale: row['rationale'],
    affectedScope: row['affected_sectors_parameters'],
    sensitivityImportance: row['sensitivity_importance'],
    validationRoute: row['proposed_validation_route'],
  };
}

function toSchemaInfo(raw: string | undefined, warnings: string[]): PackageSchemaInfo | null {
  const document = parseOptionalJsonObject<JsonSchemaDocument>(
    raw,
    'data/sector_states_schema.json',
    warnings,
  );

  if (!document) {
    return null;
  }

  const requiredFields = Array.isArray(document.required)
    ? document.required.filter((value): value is string => typeof value === 'string')
    : [];
  const fields: PackageSchemaField[] = Object.entries(document.properties ?? {})
    .map(([name, property]) => ({
      name,
      type: formatSchemaType(property.type),
      description: property.description ?? '',
      required: requiredFields.includes(name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    title: document.title ?? 'Sector states schema',
    description: document.description ?? '',
    requiredFields,
    propertyCount: fields.length,
    fields,
  };
}

function toCompanionDoc(path: string, content: string): PackageCompanionDoc {
  return {
    key: path.split('/').pop()?.replace(/\.md$/i, '') ?? path,
    path,
    title: extractMarkdownTitle(path, content),
    content,
  };
}

export function normalizePackageTextFiles(rawFiles: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(rawFiles)
      .map(([path, content]) => [path.startsWith(PACKAGE_IMPORT_PREFIX) ? path.slice(PACKAGE_IMPORT_PREFIX.length) : path, content])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function buildPackageEnrichment(textFiles: Record<string, string>): PackageEnrichment {
  const warnings: string[] = [];
  const sectorDerivations = Object.fromEntries(
    Object.entries(textFiles)
      .filter(([path]) => path.startsWith('docs/sector_derivations/') && path.endsWith('.md') && path !== 'docs/sector_derivations/README.md')
      .map(([path, content]) => {
        const doc = toCompanionDoc(path, content);
        return [doc.key, doc];
      }),
  );

  return {
    availablePaths: Object.keys(textFiles).sort((left, right) => left.localeCompare(right)),
    warnings,
    readme: textFiles['README.md'] ?? '',
    phase2Memo: textFiles['docs/phase2_recommendations.md'] ?? '',
    methodsOverview: textFiles['docs/methods_overview.md'] ?? '',
    calibrationValidation: textFiles['docs/calibration_validation.md'] ?? '',
    uncertaintyConfidence: textFiles['docs/uncertainty_confidence.md'] ?? '',
    sourceLedger: textFiles['data/source_ledger.csv']
      ? parseCsv(textFiles['data/source_ledger.csv']).map(toSourceLedgerEntry)
      : [],
    assumptionsLedger: textFiles['data/assumptions_ledger.csv']
      ? parseCsv(textFiles['data/assumptions_ledger.csv']).map(toAssumptionLedgerEntry)
      : [],
    sectorStatesSchema: toSchemaInfo(textFiles['data/sector_states_schema.json'], warnings),
    sectorDerivations,
  };
}
