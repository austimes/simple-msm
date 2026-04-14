import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';

const ConfigurationWorkspacePage = lazy(() => import('./pages/ConfigurationWorkspacePage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const ModelFormulationPage = lazy(() => import('./pages/ModelFormulationPage'));
const MethodsPage = lazy(() => import('./pages/MethodsPage'));
const StateSchemaPage = lazy(() => import('./pages/StateSchemaPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<ConfigurationWorkspacePage />} />
            <Route path="configurations" element={<Navigate to="/" replace />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="state-schema" element={<StateSchemaPage />} />
            <Route path="methods" element={<MethodsPage />} />
            <Route path="model-formulation" element={<ModelFormulationPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
