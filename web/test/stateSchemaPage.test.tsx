import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPackageEnrichment } from '../src/data/packageCompanions.ts';
import StateSchemaPageContent from '../src/pages/StateSchemaPageContent.tsx';
import { loadPkg } from './solverTestUtils.mjs';

function readText(relativePath: string): string {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

test('StateSchemaPageContent renders documentation guidance, milestone years, and field names', () => {
  const schema = buildPackageEnrichment({
    'data/sector_states_schema.json': readText('../../aus_phase1_sector_state_library/data/sector_states_schema.json'),
  }).sectorStatesSchema;
  const pkg = loadPkg();
  const html = renderToStaticMarkup(
    <StateSchemaPageContent schema={schema} sectorStates={pkg.sectorStates} />,
  );

  assert.match(html, />State Schema</);
  assert.match(html, /Documentation only/);
  assert.match(html, /does not provide a submission form/i);
  assert.match(html, /2050/);
  assert.match(html, /state_id/);
  assert.match(html, /input_commodities/);
  assert.match(html, /confidence_rating/);
  assert.match(html, /Representative CSV-style row snippet/);
});
