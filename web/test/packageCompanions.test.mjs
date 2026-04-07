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
    'docs/phase2_recommendations.md': '# Phase 2\n\n## Final recommendation\n\nKeep going.',
    'docs/methods_overview.md': '# Methods overview\n\n## Cost convention\n\nUse conversion costs.',
    'docs/calibration_validation.md': '# Calibration\n\n## Overall calibration judgement\n\nGood enough for Phase 1.',
    'docs/uncertainty_confidence.md': '# Uncertainty\n\n## Bottom line\n\nKeep uncertainty visible.',
    'docs/sector_derivations/steel.md': '# Steel derivation\n\n## Why this output was chosen\n\nSteel needs an explicit hard-to-abate route.',
    'data/source_ledger.csv': [
      'source_id,citation,publication_date,institution,url_or_document_location,parameters_informed,quality_authority_notes',
      'S001,Official baseline,2025,Authority,example.com,Calibration,Primary source',
    ].join('\n'),
    'data/assumptions_ledger.csv': [
      'assumption_id,assumption_statement,rationale,affected_sectors_parameters,sensitivity_importance,proposed_validation_route',
      'A001,Keep baseline aligned,Staggered official releases,All sectors,High,Refresh next year',
    ].join('\n'),
    'data/sector_states_schema.json': JSON.stringify({
      title: 'Sector states schema',
      description: 'Schema for sector rows.',
      required: ['sector', 'source_ids'],
      properties: {
        sector: {
          type: 'string',
          description: 'Sector name.',
        },
        source_ids: {
          type: 'string',
          description: 'JSON-encoded source IDs.',
        },
      },
    }),
  });

  assert.equal(enrichment.readme.startsWith('# Package README'), true);
  assert.equal(enrichment.phase2Memo.startsWith('# Phase 2'), true);
  assert.equal(enrichment.methodsOverview.includes('Cost convention'), true);
  assert.equal(enrichment.calibrationValidation.includes('Overall calibration judgement'), true);
  assert.equal(enrichment.uncertaintyConfidence.includes('Bottom line'), true);
  assert.equal(enrichment.sourceLedger[0].sourceId, 'S001');
  assert.equal(enrichment.assumptionsLedger[0].assumptionId, 'A001');
  assert.equal(enrichment.sectorStatesSchema?.requiredFields.includes('source_ids'), true);
  assert.equal(enrichment.sectorDerivations.steel.title, 'Steel derivation');
  assert.deepEqual(enrichment.warnings, []);
});

test('normalizePackageTextFiles strips the package import prefix from glob keys', () => {
  const normalized = normalizePackageTextFiles({
    '../../../aus_phase1_sector_state_library/data/source_ledger.csv': 'x',
  });

  assert.deepEqual(normalized, {
    'data/source_ledger.csv': 'x',
  });
});
