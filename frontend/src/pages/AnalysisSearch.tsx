import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Search, ArrowRight } from 'lucide-react';

export default function AnalysisSearch() {
  const [ticker, setTicker] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    
    // Redirige dinámicamente a la pantalla de detalle del Ticker ingresado en mayúsculas
    navigate(`/analysis/${ticker.trim().toUpperCase()}`);
  };

  const popularTickers = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD', 'AMZN'];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141415] border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/40 text-center relative overflow-hidden">
        
        {/* Efecto de luz de fondo sutil estilo IA */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="inline-flex p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl mb-4 text-indigo-400">
          <BrainCircuit className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-wide mb-2">
          AI Hybrid Intelligence Terminal
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          Enter a stock ticker symbol to launch the mathematical and qualitative analysis engine.
        </p>

        {/* Formulario de búsqueda */}
        <form onSubmit={handleSearch} className="relative mb-6">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Search ticker (e.g., NVDA, TSLA)..."
              className="w-full bg-gray-900/50 border border-gray-800 text-white placeholder-gray-500 pl-12 pr-14 py-3.5 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono uppercase tracking-wider"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Sugerencias Rápidas */}
        <div className="pt-2">
          <span className="text-xs text-gray-500 block mb-3">Popular Assets</span>
          <div className="flex flex-wrap gap-2 justify-center">
            {popularTickers.map((popTicker) => (
              <button
                key={popTicker}
                onClick={() => navigate(`/analysis/${popTicker}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:border-gray-600 transition-all font-mono"
              >
                {popTicker}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}