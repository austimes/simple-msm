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
    'schema/family_states.schema.json': readText('../../sector_trajectory_library/schema/family_states.schema.json'),
  }).sectorStatesSchema;
  const pkg = loadPkg();
  const html = renderToStaticMarkup(
    <StateSchemaPageContent schema={schema} sectorStates={pkg.sectorStates} />,
  );

  assert.match(html, />State Schema</);
  assert.match(html, /Documentation only/);
  assert.match(html, /does not provide a submission form/i);
  assert.match(html, /shared\/families\.csv/);
  assert.match(html, /raw row structure/i);
  assert.match(html, /2050/);
  assert.match(html, /state_id/);
  assert.match(html, /input_commodities/);
  assert.match(html, /confidence_rating/);
  assert.match(html, /Representative raw CSV row snippet/);
});
