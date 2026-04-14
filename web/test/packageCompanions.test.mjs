import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPackageEnrichment,
  normalizePackageTextFiles,
} from '../src/data/packageCompanions.ts';

test('optional companions can be absent without blocking package enrichment', () => {
  const enrichment = buildPackageEnrichment({});

  assert.equal(enrichment.readme, '');
  assert.equal(enrichment.phase2Memo, '');
  assert.deepEqual(enrichment.sourceLedger, []);
  assert.deepEqual(enrichment.assumptionsLedger, []);
  assert.equal(enrichment.sectorStatesSchema, null);
  assert.deepEqual(enrichment.sectorDerivations, {});
  assert.deepEqual(enrichment.warnings, []);
});

test('optional companions are parsed into enrichment data when they are present', () => {
  const enrichment = buildPackageEnrichment({
    'README.md': '# Package README\n\n## What is included\n\nCore rows only.',
    'families/steel/README.md': '# Steel family\n\n## What the family represents\n\nSteel needs an explicit hard-to-abate route.',
    'shared/source_ledger.csv': [
      'source_id,citation,publication_date,institution,url_or_document_location,parameters_informed,quality_authority_notes',
      'S001,Official baseline,2025,Authority,example.com,Calibration,Primary source',
    ].join('\n'),
    'shared/assumptions_ledger.csv': [
      'assumption_id,assumption_statement,rationale,affected_sectors_parameters,sensitivity_importance,proposed_validation_route',
      'A001,Keep baseline aligned,Staggered official releases,All sectors,High,Refresh next year',
    ].join('\n'),
    'schema/family_states.schema.json': JSON.stringify({
      title: 'Family states schema',
      description: 'Schema for sector rows.',
      required: ['family_id', 'source_ids'],
      properties: {
        family_id: {
          type: 'string',
          description: 'Family id.',
        },
        source_ids: {
          type: 'string',
          description: 'JSON-encoded source IDs.',
        },
      },
    }),
  });

  assert.equal(enrichment.readme.startsWith('# Package README'), true);
  assert.equal(enrichment.phase2Memo, '');
  assert.equal(enrichment.methodsOverview, '');
  assert.equal(enrichment.calibrationValidation, '');
  assert.equal(enrichment.uncertaintyConfidence, '');
  assert.equal(enrichment.sourceLedger[0].sourceId, 'S001');
  assert.equal(enrichment.assumptionsLedger[0].assumptionId, 'A001');
  assert.equal(enrichment.sectorStatesSchema?.requiredFields.includes('source_ids'), true);
  assert.deepEqual(
    enrichment.sectorStatesSchema?.fields.map((field) => field.name),
    ['family_id', 'source_ids'],
  );
  assert.equal(enrichment.sectorStatesSchema?.fields[0].description, 'Family id.');
  assert.equal(
    enrichment.sectorStatesSchema?.fields[1].description,
    'JSON-encoded source IDs.',
  );
  assert.equal(enrichment.sectorDerivations.steel.title, 'Steel family');
  assert.deepEqual(enrichment.warnings, []);
});

test('normalizePackageTextFiles strips the package import prefix from glob keys', () => {
  const normalized = normalizePackageTextFiles({
    '../../../sector_trajectory_library/shared/source_ledger.csv': 'x',
  });

  assert.deepEqual(normalized, {
    'shared/source_ledger.csv': 'x',
  });
});
