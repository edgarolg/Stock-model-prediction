import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, BrainCircuit, Activity, Database, ShieldAlert, Plus, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { DashboardStockCard, DashboardPipelineFeed, RecentMovement, DistributionItem, APIInvestment, APIAnalysisRecord, APIStockHistoryPoint } from '../types';


const API_BASE_URL = 'http://localhost:8000';
const DEFAULT_WATCHLIST = ['AAPL', 'NVDA', 'TSLA', 'MSFT'];

export default function Dashboard() {
  const [activeRisk, setActiveRisk] = useState('Moderate');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Data states
  const [stockCards, setStockCards] = useState<DashboardStockCard[]>([]);
  const [aiPipelineFeed, setAiPipelineFeed] = useState<DashboardPipelineFeed[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [aiDistribution, setAiDistribution] = useState([
    { name: 'Buy', value: 0, color: '#10B981' }, 
    { name: 'Hold', value: 0, color: '#F59E0B' },         
    { name: 'Sell', value: 0, color: '#EF4444' }, 
  ]);
  const [totalBalance, setTotalBalance] = useState(0);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    setApiStatus('checking');
    
    try {
      // 0. HEALTH CHECK
      try {
        const healthRes = await fetch(`${API_BASE_URL}/`);
        if (healthRes.ok) {
          setApiStatus('online');
        } else {
          setApiStatus('offline');
        }
      } catch (error) {
        setApiStatus('offline');
      }

      // 1. Load Active Portfolio
      const portfolioRes = await fetch(`${API_BASE_URL}/portfolio/investments/active`);
      if (portfolioRes.ok) {
        const portfolioData = await portfolioRes.json();
        const movements = portfolioData.data.map((inv: APIInvestment) => ({
          date: new Date().toISOString().split('T')[0], 
          asset: inv.ticker,
          type: 'Buy', 
          amount: `$${(inv.entry_price * inv.shares_quantity).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          shares: `${inv.shares_quantity} shares`,
          totalValue: inv.entry_price * inv.shares_quantity
        }));
        setRecentMovements(movements);
        
        // Calculate total balance
        const balance = movements.reduce((acc: number, curr: any) => acc + curr.totalValue, 0);
        setTotalBalance(balance);
      }

      // 2. Load Hybrid AI Analysis History
      const historyRes = await fetch(`${API_BASE_URL}/analysis/history/all?limit=20`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        
        // Map to table feed (Translating Spanish DB strings to English)
        const feed = historyData.data.map((record: APIAnalysisRecord) => ({
          id: record.id,
          ticker: record.ticker,
          lstm_base: record.pred_base_lstm > record.last_real_close ? 'Bullish' : 'Bearish',
          sentiment: 'AI Eval',
          verdict: record.recomendacion === 'INVERTIR' ? 'BUY' : record.recomendacion === 'ESPERAR' ? 'HOLD' : 'SELL',
          confidence: Math.round(record.confianza_analisis * 100) || 85,
          time: new Date(record.execution_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }));
        setAiPipelineFeed(feed);

        // Map to distribution chart
        let inv = 0, esp = 0, no_inv = 0;
        historyData.data.forEach((r: APIAnalysisRecord) => {
          if (r.recomendacion === 'INVERTIR') inv++;
          else if (r.recomendacion === 'ESPERAR') esp++;
          else no_inv++;
        });
        
        const total = inv + esp + no_inv || 1; 
        setAiDistribution([
          { name: 'Buy', value: Math.round((inv/total)*100), color: '#10B981' }, 
          { name: 'Hold', value: Math.round((esp/total)*100), color: '#F59E0B' },         
          { name: 'Sell', value: Math.round((no_inv/total)*100), color: '#EF4444' }
        ]);
      }

      // 3. Load Market Data (Sparklines)
      const cardsPromises = DEFAULT_WATCHLIST.map(async (ticker) => {
        try {
          const res = await fetch(`${API_BASE_URL}/stocks/${ticker}/history?period=1mo`);
          if (!res.ok) return null;
          const hist = await res.json();
          
          if (!hist.data || hist.data.length < 2) return null;
          
          const latestClose = hist.data[hist.data.length - 1].close;
          const previousClose = hist.data[hist.data.length - 2].close;
          const pctChange = ((latestClose - previousClose) / previousClose) * 100;
          
          return {
            ticker: ticker,
            name: ticker,
            price: `$${latestClose.toLocaleString('en-US', {minimumFractionDigits: 2})}`,
            change: `${pctChange > 0 ? '+' : ''}${pctChange.toFixed(2)}%`,
            isUp: pctChange >= 0,
            data: hist.data.slice(-10).map((d: APIStockHistoryPoint) => d.close) 
          };
        } catch (e) {
          console.error(`Error fetching ${ticker}`, e);
          return null;
        }
      });

      const resolvedCards = (await Promise.all(cardsPromises)).filter(c => c !== null);
      if(resolvedCards.length > 0) setStockCards(resolvedCards);

    } catch (error) {
      console.error("FastAPI Sync Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-10">
        <div className="xl:col-span-2 space-y-8 animate-pulse">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="space-y-3 w-full">
              <div className="h-8 bg-gray-800 rounded-lg w-64"></div>
              <div className="h-4 bg-gray-800 rounded-lg w-96 max-w-full"></div>
            </div>
            <div className="h-10 bg-gray-800 rounded-xl w-48"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#141415] border border-gray-800 rounded-2xl h-32"></div>
            ))}
          </div>
          <div className="bg-[#141415] border border-gray-800 rounded-2xl h-64"></div>
          <div className="bg-[#141415] border border-gray-800 rounded-2xl h-64"></div>
        </div>
        <div className="space-y-6 animate-pulse">
          <div className="bg-[#141415] border border-gray-800 rounded-2xl h-32"></div>
          <div className="bg-[#141415] border border-gray-800 rounded-2xl h-24"></div>
          <div className="bg-[#141415] border border-gray-800 rounded-2xl h-80"></div>
          <div className="space-y-3 pt-2">
            <div className="bg-[#141415] border border-gray-800 rounded-xl h-12"></div>
            <div className="bg-[#141415] border border-gray-800 rounded-xl h-12"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-10">
      
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
              onClick={fetchDashboardData}
              disabled={refreshing}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <div className="flex items-center gap-2 bg-[#141415] border border-gray-800 px-4 py-2 rounded-xl">
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
            </div>
          </div>
        </div>

        {/* 1. Quick Tracking Cards (Sparklines) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stockCards.map((stock) => (
            <div key={stock.ticker} className="bg-[#141415] border border-gray-800 rounded-2xl p-4 hover:border-gray-600 transition-colors cursor-pointer group">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">{stock.ticker}</h3>
                <span className={`flex items-center text-xs font-bold ${stock.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stock.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stock.change}
                </span>
              </div>
              <p className="text-xl font-bold text-white mb-2">{stock.price}</p>
              <div className="h-8 w-full opacity-70 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stock.data.map((val: any, i: number) => ({ value: val, index: i }))}>
                    <Line type="monotone" dataKey="value" stroke={stock.isUp ? '#10B981' : '#EF4444'} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
          {stockCards.length === 0 && (
            <div className="col-span-4 text-center py-6 border border-dashed border-gray-700 rounded-xl text-gray-500">
              Could not load yfinance data. Check your connection.
            </div>
          )}
        </div>

        {/* 2. Hybrid Predictions Feed (Live Pipeline) */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 shadow-lg shadow-black/20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BrainCircuit className="text-indigo-400 w-5 h-5" /> Live AI Pipeline Feed
            </h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-md">Latest DB queries</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-medium">Asset</th>
                  <th className="pb-3 font-medium">LSTM Model</th>
                  <th className="pb-3 font-medium">AI Sentiment</th>
                  <th className="pb-3 font-medium">Final Verdict</th>
                  <th className="pb-3 text-right font-medium">Confidence</th>
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
                        row.verdict === 'BUY' ? 'text-emerald-400' :
                        row.verdict === 'HOLD' ? 'text-amber-400' : 'text-rose-400'
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
          <div className="flex justify-between items-center mb-6">
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
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${move.type === 'Buy' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
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
        <div className="bg-gradient-to-br from-[#141415] to-[#0a0a0b] border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-24 h-24 text-indigo-500"/></div>
          <p className="text-sm text-gray-400 mb-1 relative z-10">Total Invested</p>
          <h2 className="text-4xl font-bold text-white mb-2 relative z-10">
            ${totalBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}
          </h2>
          <p className="text-sm text-emerald-400 flex items-center gap-1 font-medium relative z-10">
            Synced with SQLite
          </p>
        </div>

        {/* Block 2: Risk Configuration */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-white">Active Risk Profile</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-1.5 rounded-xl">
            {['Conservative', 'Moderate', 'Aggressive'].map((risk) => (
              <button
                key={risk}
                onClick={() => setActiveRisk(risk)}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeRisk === risk 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {risk}
              </button>
            ))}
          </div>
        </div>

        {/* Block 3: Market Stance (Donut Chart) */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">Historical Distribution</h3>
          
          <div className="h-48 relative mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={aiDistribution} innerRadius={65} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {aiDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#1f2937', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
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

        {/* Block 4: Action Buttons */}
        <div className="space-y-3 pt-2">
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
            <BrainCircuit className="w-5 h-5" />
            Run Full Pipeline (/run/full-pipeline)
          </button>
          <button className="w-full bg-[#141415] border border-gray-800 hover:bg-gray-800 text-white font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            Log Investment (/portfolio/investments)
          </button>
        </div>

      </div>
    </div>
  );
}