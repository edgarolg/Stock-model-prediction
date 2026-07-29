import { useState, useEffect } from 'react';
import { BrainCircuit, Activity, Database, Plus, TrendingUp, TrendingDown, RefreshCw, DollarSign, Layers, X, Loader2, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import type { DashboardPipelineFeed, RecentMovement, APIInvestment, APIAnalysisRecord, APIStrategy } from '../types';

const API_BASE_URL = 'http://localhost:8000';

// Tipo adaptado para tus tarjetas con datos locales puros
interface LocalStockCard {
  ticker: string;
  shares: number;
  entryPrice: string;
  totalInvested: string;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // --- DATA STATES ---
  const [stockCards, setStockCards] = useState<LocalStockCard[]>([]);
  const [aiPipelineFeed, setAiPipelineFeed] = useState<DashboardPipelineFeed[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [availableStrategies, setAvailableStrategies] = useState<APIStrategy[]>([]);
  
  const [aiDistribution, setAiDistribution] = useState([
    { name: 'Buy', value: 0, color: '#10B981' }, 
    { name: 'Hold', value: 0, color: '#F59E0B' },         
    { name: 'Sell', value: 0, color: '#EF4444' }, 
  ]);

  // --- MODAL & ACTION STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // Nuevo estado para el escaneo masivo
  
  const [formData, setFormData] = useState({
    ticker: '',
    shares_quantity: '',
    entry_price: '',
    strategy_id: ''
  });

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setApiStatus('checking');
    }

    try {
      // 0. HEALTH CHECK
      try {
        const healthRes = await fetch(`${API_BASE_URL}/`);
        if (healthRes.ok) {
          setApiStatus('online');
        } else {
          setApiStatus('offline');
        }
      } catch {
        setApiStatus('offline');
      }

      // 1. Load Active Portfolio & Map Local Cards
      const portfolioRes = await fetch(`${API_BASE_URL}/portfolio/investments/active`);
      if (portfolioRes.ok) {
        const portfolioData = await portfolioRes.json();
        const investmentsArray = portfolioData.data || portfolioData;
        
        const movements = investmentsArray.map((inv: APIInvestment) => ({
          date: new Date().toISOString().split('T')[0], 
          asset: inv.ticker,
          type: 'Buy', 
          amount: `$${(inv.entry_price * inv.shares_quantity).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          shares: `${inv.shares_quantity} shares`,
          totalValue: inv.entry_price * inv.shares_quantity
        }));
        setRecentMovements(movements);
        
        const balance = movements.reduce((acc: number, curr: RecentMovement) => acc + curr.totalValue, 0);
        setTotalBalance(balance);

        const localCards = investmentsArray.map((inv: APIInvestment) => ({
          ticker: inv.ticker,
          shares: inv.shares_quantity,
          entryPrice: `$${inv.entry_price.toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          totalInvested: `$${(inv.entry_price * inv.shares_quantity).toLocaleString('en-US', {minimumFractionDigits: 2})}`
        }));
        setStockCards(localCards);
      }

      // 1.5 Load Strategies for the Modal Dropdown
      const stratRes = await fetch(`${API_BASE_URL}/portfolio/strategies`);
      if (stratRes.ok) {
        const stratData = await stratRes.json();
        setAvailableStrategies(stratData.data || stratData);
      }

      // 2. Load Hybrid AI Analysis History
      const historyRes = await fetch(`${API_BASE_URL}/analysis/history/all?limit=20`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const historyArray = historyData.data || [];
        
        const feed = historyArray.map((record: APIAnalysisRecord) => ({
          id: record.id,
          ticker: record.ticker,
          lstm_base: record.pred_base_lstm > (record.last_real_close || 0) ? 'Bullish' : 'Bearish',
          sentiment: 'AI Eval',
          verdict: record.recomendacion?.toUpperCase() || 'HOLD',
          confidence: Math.round(record.confianza_analisis * 100) || 85,
          time: new Date(record.execution_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }));
        setAiPipelineFeed(feed);

        let buyCount = 0, holdCount = 0, sellCount = 0;
        historyArray.forEach((r: APIAnalysisRecord) => {
          const rec = r.recomendacion?.toUpperCase();
          if (rec === 'BUY' || rec === 'INVERTIR') buyCount++;
          else if (rec === 'HOLD' || rec === 'ESPERAR') holdCount++;
          else sellCount++;
        });
        
        const total = buyCount + holdCount + sellCount || 1; 
        setAiDistribution([
          { name: 'Buy', value: Math.round((buyCount/total)*100), color: '#10B981' }, 
          { name: 'Hold', value: Math.round((holdCount/total)*100), color: '#F59E0B' },         
          { name: 'Sell', value: Math.round((sellCount/total)*100), color: '#EF4444' }
        ]);
      }

    } catch (error) {
      console.error("FastAPI Sync Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- MASIVE PIPELINE HANDLER (Scan Portfolio) ---
  const handleRunPortfolioPipeline = async () => {
    if (stockCards.length === 0) {
      alert("No tienes acciones en tu portafolio para analizar.");
      return;
    }

    setIsScanning(true); 

    try {
      // Extraemos todos los tickers guardados en la DB
      const tickersToAnalyze = stockCards.map(stock => stock.ticker);
      
      // Ejecutamos el pipeline de FastAPI para cada acción una por una
      for (const ticker of tickersToAnalyze) {
        console.log(`Analizando ${ticker}...`);
        await fetch(`${API_BASE_URL}/analysis/run/full-pipeline/${ticker}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Al terminar todas, refrescamos el dashboard para que la tabla y la dona se actualicen
      fetchDashboardData(true);
      alert("¡Análisis de portafolio completado!");

    } catch (error) {
      console.error("Error analizando portafolio:", error);
      alert("Hubo un error al ejecutar el pipeline masivo.");
    } finally {
      setIsScanning(false);
    }
  };

  // --- MODAL HANDLERS ---
  const handleOpenCreate = () => {
    setFormData({ ticker: '', shares_quantity: '', entry_price: '', strategy_id: '' });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const payload = {
        ticker: formData.ticker.toUpperCase(),
        shares_quantity: Number(formData.shares_quantity),
        entry_price: Number(formData.entry_price),
        strategy_id: Number(formData.strategy_id)
      };

      const response = await fetch(`${API_BASE_URL}/portfolio/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchDashboardData(true); // Refresca el dashboard para mostrar la nueva inversión al instante
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || 'Fallo al guardar la inversión'}`);
      }
    } catch (error) {
      console.error("Error saving investment:", error);
      alert("Hubo un error de conexión al guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-10 pt-10">
        <div className="flex justify-center items-center w-full col-span-3">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-10">
      <div className="col-span-1 xl:col-span-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3.5 text-amber-200/90 shadow-lg">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed">
          <p className="font-semibold text-amber-300 mb-0.5">
            Important Notice & Legal Disclaimer
          </p>
          <p className="text-amber-200/80">
            The information and projections generated by this system are strictly for informational and demonstrative purposes, and therefore <strong className="text-amber-300 font-semibold">do not guarantee the accuracy, completeness, or reliability of the data</strong>, nor do they constitute financial or investment advice. The use of this platform is entirely at your own risk and responsibility. The developer and owner disclaim all liability for any losses, damages, or operational decisions executed by the user based on the content of this application.
          </p>
        </div>
      </div>
      {/* ==========================================
          LEFT COLUMN (Main 2/3)
      ========================================== */}
      <div className="xl:col-span-2 space-y-8">
        
        {/* Header and Engine Status */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide">Welcome back, Trader</h1>
            <p className="text-gray-400 mt-1">Your hybrid intelligence and portfolio management terminal.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <div className="flex items-center gap-2 bg-[#141415] border border-gray-800 px-4 py-2 rounded-xl group relative cursor-help">
              <span className="relative flex h-3 w-3">
                {apiStatus !== 'offline' && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    apiStatus === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  apiStatus === 'online' ? 'bg-emerald-500' : 
                  apiStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-500'
                }`}></span>
              </span>
              <span className="text-sm font-medium text-gray-300">
                FastAPI Backend:{' '}
                <span className={`font-bold ${
                  apiStatus === 'online' ? 'text-emerald-400' : 
                  apiStatus === 'offline' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Checking...'}
                </span>
              </span>
              <div className="absolute right-0 top-full mt-2 w-56 p-2 bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                Checks the connection status to your Python/FastAPI backend and SQLite database.
              </div>
            </div>
          </div>
        </div>

        {/* 1. Quick Tracking Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stockCards.map((stock) => (
            <div key={stock.ticker} className="bg-[#141415] border border-gray-800 rounded-2xl p-4 hover:border-gray-600 transition-colors cursor-pointer group relative">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">{stock.ticker}</h3>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">DB Stored</span>
              </div>
              
              <div className="space-y-1.5 mt-3">
                <div className="flex justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-indigo-400" /> Shares:</span>
                  <span className="font-bold text-white">{stock.shares}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-400" /> Avg Entry:</span>
                  <span className="font-semibold text-gray-200">{stock.entryPrice}</span>
                </div>
                <div className="border-t border-gray-800/80 my-1.5 pt-1.5 flex justify-between text-xs">
                  <span className="text-gray-400 font-medium">Total Cost:</span>
                  <span className="font-bold text-emerald-400">{stock.totalInvested}</span>
                </div>
              </div>
            </div>
          ))}
          {stockCards.length === 0 && (
            <div className="col-span-4 text-center py-6 border border-dashed border-gray-700 rounded-xl text-gray-500">
              No active assets in your database. Use the "Register Buy" button below.
            </div>
          )}
        </div>

        {/* 2. Hybrid Predictions Feed (Live Pipeline) con Sticky Table y Scroll */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 shadow-lg shadow-black/20">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BrainCircuit className="text-indigo-400 w-5 h-5" /> Live AI Pipeline Feed
              </h3>
            </div>
          </div>
          
          <div className="max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left text-sm relative">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-[#141415] z-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
                <tr>
                  <th className="pb-3 pt-1 font-medium">Asset</th>
                  <th className="pb-3 pt-1 font-medium">LSTM Model</th>
                  <th className="pb-3 pt-1 font-medium">AI Sentiment</th>
                  <th className="pb-3 pt-1 font-medium">Final Verdict</th>
                  <th className="pb-3 pt-1 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {aiPipelineFeed.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-4">
                      <div className="font-bold text-white">{row.ticker}</div>
                      <div className="text-[10px] text-gray-500">{row.time}</div>
                    </td>
                    <td className="py-4 text-gray-300">
                      {row.lstm_base === 'Bullish' ? <span className="flex items-center text-emerald-400 gap-1"><TrendingUp className="w-3 h-3"/> Bullish</span> : 
                       row.lstm_base === 'Bearish' ? <span className="flex items-center text-rose-400 gap-1"><TrendingDown className="w-3 h-3"/> Bearish</span> : 
                       <span className="flex items-center text-gray-400 gap-1"><Activity className="w-3 h-3"/> Neutral</span>}
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border bg-gray-700/50 text-gray-300 border-gray-600`}>
                        {row.sentiment}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`font-bold ${
                        row.verdict === 'BUY' || row.verdict === 'INVERTIR' ? 'text-emerald-400' :
                        row.verdict === 'HOLD' || row.verdict === 'ESPERAR' ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {row.verdict}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${row.confidence >= 80 ? 'bg-emerald-500' : row.confidence >= 60 ? 'bg-indigo-500' : row.confidence >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${row.confidence}%` }}></div>
                        </div>
                        <span className="font-bold text-white w-8">{row.confidence}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {aiPipelineFeed.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No analysis history found. Run the FastAPI pipeline first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Recent Portfolio Movements */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="text-gray-400 w-5 h-5" /> Recent Movements
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Asset</th>
                  <th className="pb-3 font-medium">Action</th>
                  <th className="pb-3 text-right font-medium">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentMovements.map((move, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/20 transition-colors">
                    <td className="py-4 text-gray-400">{move.date}</td>
                    <td className="py-4 font-bold text-white">{move.asset}</td>
                    <td className="py-4">
                      <span className="px-2 py-1 rounded-md text-xs font-medium text-emerald-400 bg-emerald-400/10">
                        {move.type}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="font-bold text-white">{move.amount}</div>
                      <div className="text-xs text-gray-500">{move.shares}</div>
                    </td>
                  </tr>
                ))}
                {recentMovements.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No active positions in your SQLite database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ==========================================
          RIGHT COLUMN (Side Panel 1/3)
      ========================================== */}
      <div className="space-y-6">
        
        {/* Block 1: Financial Summary */}
        <div className="bg-gradient-to-br from-[#141415] to-[#0a0a0b] border border-gray-800 rounded-2xl p-6 relative">
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-24 h-24 text-indigo-500"/>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1 relative z-10">
            <p className="text-sm text-gray-400">Total Invested</p>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2 relative z-10">
            ${totalBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}
          </h2>
          <p className="text-sm text-emerald-400 flex items-center gap-1 font-medium relative z-10">
            Synced with SQLite
          </p>
        </div>

        {/* Block 2: Market Stance (Donut Chart) */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-white">Historical Distribution</h3>
          </div>
          
          <div className="h-48 relative mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={aiDistribution} innerRadius={65} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {aiDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#1f2937', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-400">Analyzed</span>
              <span className="text-2xl font-bold text-white">{aiPipelineFeed.length}</span>
            </div>
          </div>

          <div className="space-y-3">
            {aiDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-400">{item.name}</span>
                </div>
                <span className="text-white font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Block 3: Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Botón de Escaneo Masivo */}
          <button 
            onClick={handleRunPortfolioPipeline}
            disabled={isScanning || stockCards.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
            {isScanning ? 'Escaneando Portafolio...' : 'Scan Portfolio AI'}
          </button>

          {/* Botón de Registrar Inversión */}
          <button 
            onClick={handleOpenCreate} 
            className="w-full bg-[#141415] border border-gray-800 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            Register Buy
          </button>
        </div>

      </div>

      {/* ==========================================
          MODAL DE REGISTRO DE INVERSIÓN
      ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#141415] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                Log New Investment
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Asset Ticker</label>
                <input 
                  required type="text" name="ticker" placeholder="e.g. AAPL"
                  value={formData.ticker} onChange={handleInputChange}
                  className="w-full bg-[#0a0a0b] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 uppercase transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Shares</label>
                  <input 
                    required type="number" step="any" min="0" name="shares_quantity" placeholder="0.00"
                    value={formData.shares_quantity} onChange={handleInputChange}
                    className="w-full bg-[#0a0a0b] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Entry Price ($)</label>
                  <input 
                    required type="number" step="any" min="0" name="entry_price" placeholder="0.00"
                    value={formData.entry_price} onChange={handleInputChange}
                    className="w-full bg-[#0a0a0b] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Associated Strategy</label>
                <select 
                  required name="strategy_id"
                  value={formData.strategy_id} onChange={handleInputChange}
                  className="w-full bg-[#0a0a0b] border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  <option value="" disabled>Select a Strategy</option>
                  {availableStrategies.map((strat) => (
                    <option key={strat.id} value={strat.id}>
                      {strat.name} ({strat.risk_profile})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-transparent border border-gray-700 hover:bg-gray-800 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
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