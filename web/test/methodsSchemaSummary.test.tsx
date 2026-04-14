import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MethodsSchemaSummaryCard from '../src/pages/MethodsSchemaSummaryCard.tsx';

test('Methods schema summary renders counts without a dedicated State Schema link', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <MethodsSchemaSummaryCard
        schemaInfo={{
          title: 'Sector states schema',
          description: 'Schema for rows.',
          requiredFields: ['sector', 'state_id'],
          propertyCount: 37,
          fields: [],
        }}
      />
    </MemoryRouter>,
  );

  assert.match(html, /Schema fields/);
  assert.match(html, /Required fields/);
  assert.match(html, /dedicated State Schema page has been removed/);
  assert.doesNotMatch(html, /href="\/state-schema"/);
  assert.doesNotMatch(html, /Why it matters here/);
});
