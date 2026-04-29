import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ModelFormulationPageContent from '../src/pages/ModelFormulationPageContent.tsx';
import { buildModelFormulationViewModel } from '../src/pages/modelFormulationModel.ts';
import { loadFormulationFixtureData } from './solverTestUtils.mjs';

test('ModelFormulationPageContent renders the formulation, source references, and residual role callout', () => {
  const model = buildModelFormulationViewModel(loadFormulationFixtureData());
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <ModelFormulationPageContent model={model} />
    </MemoryRouter>,
  );

  assert.match(html, />Model Formulation</);
  assert.match(html, />LP objective</);
  assert.match(html, />Service demand resolution</);
  assert.match(html, />Commodity balance logic</);
  assert.match(
    html,
    /resolved_value_y = anchor \* \(1 \+ growth_rate_pct_per_year \/ 100\)\^\(y - anchor_year\)/,
  );
  assert.match(html, /shared\/roles\.csv/);
  assert.match(html, /roles\/\*\/method_years\.csv/);
  assert.match(html, /residual roles/);
  assert.match(html, /shared\/commodity_price_curves\.csv/);
  assert.match(html, /carbon_price/);
  assert.match(html, /Residual stubs are first-class role methods/);
  assert.match(html, /same solve request as/);
  assert.match(html, /commodity balances/);
  assert.match(html, /href="\/methods"/);
  assert.doesNotMatch(html, /href="\/state-schema"/);
});
