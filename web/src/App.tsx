import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';

const ConfigurationWorkspacePage = lazy(() => import('./pages/ConfigurationWorkspacePage'));
const AdditionalityPage = lazy(() => import('./pages/AdditionalityPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const ModelFormulationPage = lazy(() => import('./pages/ModelFormulationPage'));
const MethodsPage = lazy(() => import('./pages/MethodsPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<ConfigurationWorkspacePage />} />
            <Route path="configurations" element={<Navigate to="/" replace />} />
            <Route path="additionality" element={<AdditionalityPage />} />
            <Route path="compare" element={<Navigate to="/" replace />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="state-schema" element={<Navigate to="/methods" replace />} />
            <Route path="methods" element={<MethodsPage />} />
            <Route path="model-formulation" element={<ModelFormulationPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
