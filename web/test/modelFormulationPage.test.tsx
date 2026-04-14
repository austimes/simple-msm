import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ModelFormulationPageContent from '../src/pages/ModelFormulationPageContent.tsx';
import { buildModelFormulationViewModel } from '../src/pages/modelFormulationModel.ts';
import { loadFormulationFixtureData } from './solverTestUtils.mjs';

test('ModelFormulationPageContent renders the formulation, source references, and overlay callout', () => {
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
  assert.match(html, /shared\/families\.csv/);
  assert.match(html, /families\/\*\/family_states\.csv/);
  assert.match(html, /overlays\/residual_overlays\.csv/);
  assert.match(html, /shared\/commodity_price_curves\.csv/);
  assert.match(html, /carbon_price/);
  assert.match(html, /Overlays are not part of the LP core/);
  assert.match(html, /not included in `buildSolveRequest\.ts`/);
  assert.match(html, /not solved in `lpAdapter\.ts`/);
  assert.match(html, /href="\/methods"/);
  assert.match(html, /href="\/state-schema"/);
});
