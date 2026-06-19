import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, Activity, Loader2, X } from 'lucide-react';
import { apiService } from '../services/api';

interface Investment {
  id: number;
  ticker: string;
  name: string;
  date: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  strategy: string;
}

export default function Portfolio() {
  const navigate = useNavigate();
  const [portfolioData, setPortfolioData] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- NUEVOS ESTADOS PARA EL MODAL Y EL FORMULARIO ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableStrategies, setAvailableStrategies] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    ticker: '',
    shares_quantity: '',
    entry_price: '',
    strategy_id: ''
  });

  // Extraemos la función de carga para poder llamarla cuando guardemos una nueva compra
  const loadData = async () => {
    try {
      const [investmentsRes, strategiesRes] = await Promise.all([
        apiService.getActiveInvestments(),
        apiService.getStrategies()
      ]);

      setAvailableStrategies(strategiesRes.data); // Guardamos las estrategias para el <select>

      const strategyMap: Record<number, string> = {};
      strategiesRes.data.forEach((strat: any) => {
        strategyMap[strat.id] = strat.risk_profile;
      });

      const formattedData: Investment[] = investmentsRes.data.map((inv: any) => {
        const simulatedCurrentPrice = inv.entry_price * (1 + (Math.random() * 0.1 - 0.05));
        return {
          id: inv.id,
          ticker: inv.ticker,
          name: `${inv.ticker} Corp.`,
          date: new Date().toLocaleDateString(),
          shares: inv.shares_quantity,
          entryPrice: inv.entry_price,
          currentPrice: simulatedCurrentPrice,
          strategy: strategyMap[inv.strategy_id] || 'Sin Estrategia'
        };
      });

      setPortfolioData(formattedData);
    } catch (error) {
      console.error("Error cargando el portafolio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- FUNCIÓN PARA ENVIAR EL FORMULARIO A FASTAPI ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue
    setIsSubmitting(true);
    
    try {
      await apiService.addInvestment({
        ticker: formData.ticker,
        shares_quantity: parseFloat(formData.shares_quantity),
        entry_price: parseFloat(formData.entry_price),
        strategy_id: parseInt(formData.strategy_id)
      });
      
      // Si todo sale bien, cerramos el modal, limpiamos el formulario y recargamos la tabla
      setIsModalOpen(false);
      setFormData({ ticker: '', shares_quantity: '', entry_price: '', strategy_id: '' });
      await loadData();
      
    } catch (error) {
      console.error("Error guardando la inversión:", error);
      alert("Hubo un error al registrar la compra. Revisa la consola.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cálculos de widgets
  const totalInvested = portfolioData.reduce((acc, item) => acc + (item.shares * item.entryPrice), 0);
  const currentValue = portfolioData.reduce((acc, item) => acc + (item.shares * item.currentPrice), 0);
  const totalROI = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
  const isTotalPositive = totalROI >= 0;

  const getStrategyColor = (strategy: string) => {
    switch (strategy?.toLowerCase()) {
      case 'conservador': return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'moderado': return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      case 'agresivo': return 'bg-fuchsia-400/10 text-fuchsia-400 border-fuchsia-400/20';
      default: return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-indigo-400 space-y-4 pt-20">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-gray-400 font-medium">Conecting to local Data Base...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 relative">
      
      {/* HEADER Y BOTÓN DE ACCIÓN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide">My Investments</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} // Abrimos el modal al hacer clic
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          Register Buy
        </button>
      </div>

      {/* WIDGETS DE RESUMEN (Código sin cambios) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Total Invested</p>
            <h3 className="text-2xl font-bold text-white">${totalInvested.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
          </div>
        </div>

        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <PieChartIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Actual Value Proyected</p>
            <h3 className="text-2xl font-bold text-white">${currentValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
          </div>
        </div>

        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isTotalPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Total Return (ROI)</p>
            <h3 className={`text-2xl font-bold flex items-center gap-2 ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTotalPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {isTotalPositive ? '+' : ''}{totalROI.toFixed(2)}%
            </h3>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE PORTAFOLIO */}
      <div className="bg-[#141415] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Posiciones Activas</h3>
        </div>
        
        <div className="overflow-x-auto">
          {portfolioData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No tienes inversiones registradas todavía. ¡Haz clic en "Registrar Compra" para empezar!
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              {/* ENCABEZADOS EN INGLÉS */}
              <thead className="bg-gray-800/50 text-xs uppercase text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Ticker</th>
                  <th className="px-6 py-4 font-semibold">Strategy</th>
                  <th className="px-6 py-4 text-right font-semibold">Shares</th>
                  <th className="px-6 py-4 text-right font-semibold">Entry Price</th>
                  <th className="px-6 py-4 text-right font-semibold">Current Price</th>
                  <th className="px-6 py-4 text-right font-semibold">Return (ROI)</th>
                  <th className="px-6 py-4 text-center font-semibold">Action</th>
                </tr>
              </thead>

              {/* CUERPO DE LA TABLA */}
              <tbody className="divide-y divide-gray-800">
                {portfolioData.map((item) => {
                  const itemROI = ((item.currentPrice - item.entryPrice) / item.entryPrice) * 100;
                  const isPositive = itemROI >= 0;

                  return (
                    <tr 
                      key={item.id}
                      onClick={() => navigate(`/analysis/${item.ticker}`)} 
                      className="hover:bg-gray-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-xs text-indigo-400">
                            {item.ticker.substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-indigo-400 transition-colors">{item.ticker}</div>
                            <div className="text-xs text-gray-500">{item.date}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStrategyColor(item.strategy)}`}>
                          {/* Aquí asumo que la estrategia viene de la BD. Si la BD está en español, puedes mapearla aquí */}
                          {item.strategy === 'Bajo Riesgo' ? 'Low Risk' : 
                          item.strategy === 'Riesgo Medio' ? 'Medium Risk' : 
                          item.strategy === 'Alto Riesgo' ? 'High Risk' : item.strategy}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-300 font-medium">{item.shares}</td>
                      <td className="px-6 py-4 text-right text-gray-400">${item.entryPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-white font-medium">${item.currentPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className={`font-bold flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {isPositive ? '+' : ''}{itemROI.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {/* BOTÓN "VIEW ANALYSIS" (Siempre visible, se ilumina en hover) */}
                        <span className="inline-flex items-center gap-1.5 bg-gray-800/50 text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all duration-300">
                          Analyze <Activity className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ==========================================
          MODAL DE REGISTRO DE COMPRA
      ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#141415] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-[#0a0a0b]/50">
              <h3 className="text-xl font-bold text-white">New Shares</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ticker (Ej. AAPL)</label>
                <input 
                  required
                  type="text" 
                  value={formData.ticker}
                  onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})}
                  className="w-full bg-[#0a0a0b] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors uppercase"
                  placeholder="TSLA"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SHARES</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formData.shares_quantity}
                    onChange={(e) => setFormData({...formData, shares_quantity: e.target.value})}
                    className="w-full bg-[#0a0a0b] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="10.5"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">ENTRY PRICE ($)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formData.entry_price}
                    onChange={(e) => setFormData({...formData, entry_price: e.target.value})}
                    className="w-full bg-[#0a0a0b] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="150.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">STRATEGY</label>
                <select 
                  required
                  value={formData.strategy_id}
                  onChange={(e) => setFormData({...formData, strategy_id: e.target.value})}
                  className="w-full bg-[#0a0a0b] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  <option value="" disabled>Select an Strategy</option>
                  {availableStrategies.map((strat) => (
                    <option key={strat.id} value={strat.id}>
                      {strat.name} ({strat.risk_profile})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-transparent border border-gray-700 hover:bg-gray-800 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}