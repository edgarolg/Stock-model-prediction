import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, BrainCircuit, Activity, Database, ShieldAlert, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// --- DATOS DE PRUEBA (MOCKS) ---

// 1. Tarjetas Superiores (Sparklines)
const stockCards = [
  { ticker: 'AAPL', name: 'Apple Inc.', price: '$189.43', change: '+2.34%', isUp: true, data: [10, 12, 11, 14, 15, 14, 17] },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: '$214.20', change: '-1.15%', isUp: false, data: [20, 19, 21, 18, 17, 16, 15] },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: '$875.28', change: '+4.56%', isUp: true, data: [30, 35, 33, 40, 45, 50, 55] },
  { ticker: 'MSFT', name: 'Microsoft', price: '$405.12', change: '+0.89%', isUp: true, data: [20, 21, 21, 22, 22, 23, 24] },
];

// 2. Feed del Pipeline de IA (Simulando lo que devolverá FastAPI)
const aiPipelineFeed = [
  { id: 1, ticker: 'NVDA', lstm_base: 'Alcista', sentiment: 'Muy Positivo', verdict: 'Invertir (Alta Confianza)', confidence: 92, time: 'Hace 10 min' },
  { id: 2, ticker: 'AAPL', lstm_base: 'Lateral', sentiment: 'Positivo', verdict: 'Invertir (Riesgo Moderado)', confidence: 75, time: 'Hace 45 min' },
  { id: 3, ticker: 'TSLA', lstm_base: 'Bajista', sentiment: 'Mixto', verdict: 'Esperar (Observar)', confidence: 54, time: 'Hace 2 horas' },
  { id: 4, ticker: 'META', lstm_base: 'Bajista', sentiment: 'Negativo', verdict: 'No Invertir / Vender', confidence: 88, time: 'Hace 3 horas' },
];

// 3. Movimientos Recientes del Usuario
const recentMovements = [
  { date: '2026-06-18', asset: 'NVDA', type: 'Buy', amount: '$4,376.40', shares: '5 shares' },
  { date: '2026-06-15', asset: 'AAPL', type: 'Sell', amount: '$1,894.30', shares: '10 shares' },
];

// 4. Distribución del Mercado (Para la gráfica de Dona)
const aiDistribution = [
  { name: 'Invertir (Alta Confianza)', value: 35, color: '#10B981' }, 
  { name: 'Invertir (Riesgo Moderado)', value: 25, color: '#6366F1' }, 
  { name: 'Esperar (Observar)', value: 25, color: '#F59E0B' },         
  { name: 'No Invertir / Riesgo', value: 15, color: '#EF4444' },       
];

export default function Dashboard() {
  const [activeRisk, setActiveRisk] = useState('Moderado'); // Estado del Perfil de Riesgo

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-10">
      
      {/* ==========================================
          COLUMNA IZQUIERDA (Principal 2/3)
      ========================================== */}
      <div className="xl:col-span-2 space-y-8">
        
        {/* Encabezado y Status del Motor */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide">Welcome back, Trader</h1>
            <p className="text-gray-400 mt-1">Tu terminal de inteligencia híbrida y gestión de portafolio.</p>
          </div>
          <div className="flex items-center gap-2 bg-[#141415] border border-gray-800 px-4 py-2 rounded-xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-gray-300">StockIntel Engine: <span className="text-emerald-400 font-bold">Online</span></span>
          </div>
        </div>

        {/* 1. Tarjetas de Rastreo Rápido */}
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
                  <LineChart data={stock.data.map((val, i) => ({ value: val, index: i }))}>
                    <Line type="monotone" dataKey="value" stroke={stock.isUp ? '#10B981' : '#EF4444'} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        {/* 2. Feed de Predicciones Híbridas (Live Pipeline) */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 shadow-lg shadow-black/20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BrainCircuit className="text-indigo-400 w-5 h-5" /> Live AI Pipeline Feed
            </h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-md">Últimos análisis guardados</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-medium">Activo</th>
                  <th className="pb-3 font-medium">Modelo LSTM</th>
                  <th className="pb-3 font-medium">Sentimiento RAG</th>
                  <th className="pb-3 font-medium">Veredicto Final</th>
                  <th className="pb-3 text-right font-medium">Confianza</th>
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
                      {row.lstm_base === 'Alcista' ? <span className="flex items-center text-emerald-400 gap-1"><TrendingUp className="w-3 h-3"/> Alcista</span> : 
                       row.lstm_base === 'Bajista' ? <span className="flex items-center text-rose-400 gap-1"><TrendingDown className="w-3 h-3"/> Bajista</span> : 
                       <span className="flex items-center text-gray-400 gap-1"><Activity className="w-3 h-3"/> Lateral</span>}
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        row.sentiment.includes('Positivo') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        row.sentiment.includes('Negativo') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-gray-700/50 text-gray-300 border border-gray-600'
                      }`}>
                        {row.sentiment}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`font-bold ${
                        row.verdict.includes('Alta Confianza') ? 'text-emerald-400' :
                        row.verdict.includes('Moderado') ? 'text-indigo-400' :
                        row.verdict.includes('Esperar') ? 'text-amber-400' : 'text-rose-400'
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
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Tabla de Movimientos Recientes (Portafolio) */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="text-gray-400 w-5 h-5" /> Movimientos Recientes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium">Activo</th>
                  <th className="pb-3 font-medium">Operación</th>
                  <th className="pb-3 text-right font-medium">Monto</th>
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
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ==========================================
          COLUMNA DERECHA (Panel Lateral 1/3)
      ========================================== */}
      <div className="space-y-6">
        
        {/* Bloque 1: Resumen Financiero */}
        <div className="bg-gradient-to-br from-[#141415] to-[#0a0a0b] border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-24 h-24 text-indigo-500"/></div>
          <p className="text-sm text-gray-400 mb-1 relative z-10">Total Balance</p>
          <h2 className="text-4xl font-bold text-white mb-2 relative z-10">$124,562.80</h2>
          <p className="text-sm text-emerald-400 flex items-center gap-1 font-medium relative z-10">
            <ArrowUpRight className="w-4 h-4" /> +12.4% All Time
          </p>
        </div>

        {/* Bloque 2: Configuración de Riesgo */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-white">Perfil de Riesgo IA</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-1.5 rounded-xl">
            {['Conservador', 'Moderado', 'Agresivo'].map((risk) => (
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

        {/* Bloque 3: Postura del Mercado (Gráfica Dona) */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">Distribución de Predicciones</h3>
          
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
              <span className="text-xs text-gray-400">Analizados</span>
              <span className="text-2xl font-bold text-white">100%</span>
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

        {/* Bloque 4: Botones de Acción */}
        <div className="space-y-3 pt-2">
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
            <BrainCircuit className="w-5 h-5" />
            Ejecutar Pipeline Global
          </button>
          <button className="w-full bg-[#141415] border border-gray-800 hover:bg-gray-800 text-white font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            Registrar Operación Manual
          </button>
        </div>

      </div>
    </div>
  );
}