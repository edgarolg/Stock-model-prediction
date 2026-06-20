import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';

// Importa tus páginas
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import StockDetail from './pages/StockDetail';
import AnalysisSearch from './pages/AnalysisSearch';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="portfolio" element={<Portfolio />} />ç
          <Route path="/analysis" element={<AnalysisSearch />} />
          <Route path="/analysis/:ticker" element={<StockDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}