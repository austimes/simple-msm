import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ConfigurationWorkspacePage from './pages/ConfigurationWorkspacePage';
import ComparePage from './pages/ComparePage';
import LibraryPage from './pages/LibraryPage';
import MethodsPage from './pages/MethodsPage';
import StateSchemaPage from './pages/StateSchemaPage';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<ConfigurationWorkspacePage />} />
          <Route path="configurations" element={<Navigate to="/" replace />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="state-schema" element={<StateSchemaPage />} />
          <Route path="methods" element={<MethodsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
