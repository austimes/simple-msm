import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../src/layouts/AppLayout.tsx';

test('AppLayout includes the State Schema nav item in the top-level order', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/state-schema']}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="state-schema" element={<div>Schema page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  const runIndex = html.indexOf('>Run<');
  const compareIndex = html.indexOf('>Compare<');
  const libraryIndex = html.indexOf('>Library<');
  const stateSchemaIndex = html.indexOf('>State Schema<');
  const methodsIndex = html.indexOf('>Methods<');

  assert.ok(runIndex >= 0, 'expected Run nav item');
  assert.ok(compareIndex > runIndex, 'expected Compare after Run');
  assert.ok(libraryIndex > compareIndex, 'expected Library after Compare');
  assert.ok(stateSchemaIndex > libraryIndex, 'expected State Schema after Library');
  assert.ok(methodsIndex > stateSchemaIndex, 'expected Methods after State Schema');
  assert.match(html, /href="\/state-schema"/);
});
