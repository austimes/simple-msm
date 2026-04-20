import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEfficiencyArtifacts } from '../src/data/packageLoader.ts';

const AUTONOMOUS_HEADER = [
  'family_id',
  'track_id',
  'year',
  'track_label',
  'track_description',
  'applicable_state_ids',
  'affected_input_commodities',
  'input_multipliers',
  'delta_output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'double_counting_guardrail',
  'review_notes',
].join(',');

const PACKAGE_HEADER = [
  'family_id',
  'package_id',
  'year',
  'package_label',
  'package_description',
  'classification',
  'applicable_state_ids',
  'affected_input_commodities',
  'input_multipliers',
  'delta_output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'max_share',
  'rollout_limit_notes',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'review_notes',
  'non_stacking_group',
].join(',');

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

test('efficiency artifact loader parses valid rows and fails fast on bad applicability references', () => {
  const context = {
    sourceIds: new Set(['S001']),
    assumptionIds: new Set(['A001']),
    stateIdsByFamilyId: new Map([
      ['test_family', new Set(['baseline_state', 'retrofit_state'])],
    ]),
  };

  const valid = loadEfficiencyArtifacts(
    {
      'families/test_family/autonomous_efficiency_tracks.csv': [
        AUTONOMOUS_HEADER,
        [
          'test_family',
          'background_drift',
          '2030',
          'Background drift',
          'Slow background gains.',
          csvCell('["baseline_state"]'),
          csvCell('["electricity"]'),
          csvCell('[0.98]'),
          '-0.5',
          '2024',
          'AUD_2024',
          csvCell('["S001"]'),
          csvCell('["A001"]'),
          'Evidence summary',
          'Derived from benchmark trend',
          'Medium',
          'Guard against double counting with retrofit packages.',
          'Reviewer note',
        ].join(','),
      ].join('\n'),
      'families/test_family/efficiency_packages.csv': [
        PACKAGE_HEADER,
        [
          'test_family',
          'motor_retrofit',
          '2035',
          'Motor retrofit',
          'Upgrade motors and drives.',
          'pure_efficiency_overlay',
          csvCell('["baseline_state","retrofit_state"]'),
          csvCell('["electricity"]'),
          csvCell('[0.9]'),
          '1.2',
          '2024',
          'AUD_2024',
          '0.35',
          'Only retrofit-eligible plants.',
          csvCell('["S001"]'),
          csvCell('["A001"]'),
          'Evidence summary',
          'Vendor synthesis',
          'Low',
          'Reviewer note',
          'motor_group',
        ].join(','),
      ].join('\n'),
    },
    context,
  );

  assert.equal(valid.autonomousEfficiencyTracks.length, 1);
  assert.deepEqual(valid.autonomousEfficiencyTracks[0].applicable_state_ids, ['baseline_state']);
  assert.equal(valid.autonomousEfficiencyTracks[0].year, 2030);
  assert.equal(valid.efficiencyPackages.length, 1);
  assert.equal(valid.efficiencyPackages[0].classification, 'pure_efficiency_overlay');
  assert.deepEqual(valid.efficiencyPackages[0].applicable_state_ids, ['baseline_state', 'retrofit_state']);

  assert.throws(
    () => loadEfficiencyArtifacts(
      {
        'families/test_family/autonomous_efficiency_tracks.csv': [
          AUTONOMOUS_HEADER,
          [
            'test_family',
            'broken_track',
            '2030',
            'Broken track',
            'Bad applicability.',
            csvCell('["missing_state"]'),
            csvCell('["electricity"]'),
            csvCell('[0.98]'),
            '-0.5',
            '2024',
            'AUD_2024',
            csvCell('["S001"]'),
            csvCell('["A001"]'),
            'Evidence summary',
            'Derived from benchmark trend',
            'Medium',
            'Guardrail',
            'Reviewer note',
          ].join(','),
        ].join('\n'),
      },
      context,
    ),
    /Unknown state_id/, 
  );
});
