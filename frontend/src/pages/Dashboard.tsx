import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// --- DATOS DE PRUEBA (MOCKS) BASADOS EN TU DISEÑO ---
const stockCards = [
  { ticker: 'AAPL', name: 'Apple Inc.', price: '$189.43', change: '+2.34%', isUp: true, data: [10, 12, 11, 14, 15, 14, 17] },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: '$214.20', change: '-1.15%', isUp: false, data: [20, 19, 21, 18, 17, 16, 15] },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: '$875.28', change: '+4.56%', isUp: true, data: [30, 35, 33, 40, 45, 50, 55] },
  { ticker: 'MSFT', name: 'Microsoft', price: '$405.12', change: '+0.89%', isUp: true, data: [20, 21, 21, 22, 22, 23, 24] },
];

const aiDistribution = [
  { name: 'Comprar', value: 45, color: '#10B981' }, // Verde
  { name: 'Esperar', value: 35, color: '#F59E0B' }, // Amarillo
  { name: 'Vender', value: 20, color: '#EF4444' },  // Rojo
];

const recentMovements = [
  { date: '2026-06-18', asset: 'NVDA', type: 'Buy', amount: '$4,376.40', shares: '5 shares' },
  { date: '2026-06-15', asset: 'AAPL', type: 'Sell', amount: '$1,894.30', shares: '10 shares' },
  { date: '2026-06-12', asset: 'BTC', type: 'Buy', amount: '$2,500.00', shares: '0.038 BTC' },
];

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-10">
      
      {/* ==========================================
          COLUMNA IZQUIERDA (Principal)
      ========================================== */}
      <div className="xl:col-span-2 space-y-8">
        
        {/* Encabezado */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Welcome back, Trader</h1>
          <p className="text-gray-400 mt-1">Here's your market overview powered by AI.</p>
        </div>

        {/* Grid de Tarjetas de Acciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stockCards.map((stock) => (
            <div key={stock.ticker} className="bg-[#141415] border border-gray-800 rounded-2xl p-5 hover:border-gray-600 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{stock.ticker}</h3>
                  <p className="text-xs text-gray-500">{stock.name}</p>
                </div>
                <span className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md ${stock.isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                  {stock.isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {stock.change}
                </span>
              </div>
              
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-white">{stock.price}</span>
                {/* Mini Gráfica (Sparkline) */}
                <div className="h-12 w-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stock.data.map((val, i) => ({ value: val, index: i }))}>
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={stock.isUp ? '#10B981' : '#EF4444'} 
                        strokeWidth={2} 
                        dot={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla de Movimientos */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ResponsiveContainer width={20} height={20}><LineChart><Line stroke="#6366f1"/></LineChart></ResponsiveContainer>
              Recent Movements
            </h3>
            <button className="text-sm text-gray-400 hover:text-white transition-colors">View All</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Asset</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 text-right font-medium">Amount</th>
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
          COLUMNA DERECHA (Panel IA y Acciones)
      ========================================== */}
      <div className="space-y-6">
        
        {/* Panel de Balance y Dona */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-1">Total Balance</p>
            <h2 className="text-4xl font-bold text-white mb-2">$124,562.80</h2>
            <p className="text-sm text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" /> +12.4% All Time
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-4">Acciones Sugeridas (IA)</p>
            
            {/* Gráfica de Dona */}
            <div className="h-48 relative mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aiDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {aiDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#1f2937', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400">Acciones</span>
                <span className="text-2xl font-bold text-white">5</span>
              </div>
            </div>

            {/* Leyenda de la Dona */}
            <div className="space-y-3">
              {aiDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-white font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="space-y-3">
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/20">
            Registrar Inversión
          </button>
          <button className="w-full bg-[#141415] border border-gray-800 hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            <ResponsiveContainer width={20} height={20}><LineChart><Line stroke="#a78bfa"/></LineChart></ResponsiveContainer>
            Ejecutar Análisis
          </button>
        </div>

      </div>
    </div>
  );
}