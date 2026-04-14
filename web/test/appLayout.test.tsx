import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../src/layouts/AppLayout.tsx';

test('AppLayout includes the Explorer, Additionality, Library, Methods, and Model Formulation nav items in the top-level order', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/additionality']}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="additionality" element={<div>Additionality page</div>} />
          <Route path="model-formulation" element={<div>Model formulation page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  const explorerIndex = html.indexOf('>Explorer<');
  const additionalityIndex = html.indexOf('>Additionality<');
  const libraryIndex = html.indexOf('>Library<');
  const methodsIndex = html.indexOf('>Methods<');
  const modelFormulationIndex = html.indexOf('>Model Formulation<');

  assert.ok(explorerIndex >= 0, 'expected Explorer nav item');
  assert.ok(additionalityIndex > explorerIndex, 'expected Additionality after Explorer');
  assert.ok(libraryIndex > additionalityIndex, 'expected Library after Additionality');
  assert.ok(methodsIndex > libraryIndex, 'expected Methods after Library');
  assert.ok(modelFormulationIndex > methodsIndex, 'expected Model Formulation after Methods');
  assert.match(html, /href="\/additionality"/);
  assert.match(html, /href="\/model-formulation"/);
  assert.doesNotMatch(html, /href="\/compare"/);
  assert.doesNotMatch(html, /href="\/state-schema"/);
});
