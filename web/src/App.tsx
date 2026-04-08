import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ScenarioWorkspacePage from './pages/ScenarioWorkspacePage';
import ScenarioPage from './pages/ScenarioPage';
import ResultsPage from './pages/ResultsPage';
import ComparePage from './pages/ComparePage';
import LibraryPage from './pages/LibraryPage';
import MethodsPage from './pages/MethodsPage';
import ConfigurationsPage from './pages/ConfigurationsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<ScenarioWorkspacePage />} />
          <Route path="configurations" element={<ConfigurationsPage />} />
          <Route path="results" element={<Navigate to="/" replace />} />
          <Route path="legacy/scenario" element={<ScenarioPage />} />
          <Route path="legacy/results" element={<ResultsPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="methods" element={<MethodsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
