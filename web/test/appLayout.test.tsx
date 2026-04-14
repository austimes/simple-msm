import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../src/layouts/AppLayout.tsx';

test('AppLayout includes the Explorer, State Schema, Methods, and Model Formulation nav items in the top-level order', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/model-formulation']}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="state-schema" element={<div>Schema page</div>} />
          <Route path="model-formulation" element={<div>Model formulation page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  const explorerIndex = html.indexOf('>Explorer<');
  const compareIndex = html.indexOf('>Compare<');
  const libraryIndex = html.indexOf('>Library<');
  const stateSchemaIndex = html.indexOf('>State Schema<');
  const methodsIndex = html.indexOf('>Methods<');
  const modelFormulationIndex = html.indexOf('>Model Formulation<');

  assert.ok(explorerIndex >= 0, 'expected Explorer nav item');
  assert.ok(compareIndex > explorerIndex, 'expected Compare after Explorer');
  assert.ok(libraryIndex > compareIndex, 'expected Library after Compare');
  assert.ok(stateSchemaIndex > libraryIndex, 'expected State Schema after Library');
  assert.ok(methodsIndex > stateSchemaIndex, 'expected Methods after State Schema');
  assert.ok(modelFormulationIndex > methodsIndex, 'expected Model Formulation after Methods');
  assert.match(html, /href="\/state-schema"/);
  assert.match(html, /href="\/model-formulation"/);
});
