import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ScenarioPage from './pages/ScenarioPage';
import ResultsPage from './pages/ResultsPage';
import ComparePage from './pages/ComparePage';
import LibraryPage from './pages/LibraryPage';
import MethodsPage from './pages/MethodsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<ScenarioPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="methods" element={<MethodsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
