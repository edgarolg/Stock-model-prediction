import { Plus, TrendingUp, TrendingDown, MoreHorizontal, Wallet, PieChart as PieChartIcon, Activity } from 'lucide-react';

// --- DATOS DE PRUEBA (MOCKS) QUE SIMULAN TU BASE DE DATOS ---
const portfolioData = [
  { id: 1, ticker: 'NVDA', name: 'NVIDIA Corp', date: '2026-05-10', shares: 5, entryPrice: 650.00, currentPrice: 875.28, strategy: 'Agresivo' },
  { id: 2, ticker: 'AAPL', name: 'Apple Inc.', date: '2026-06-01', shares: 15, entryPrice: 175.50, currentPrice: 189.43, strategy: 'Moderado' },
  { id: 3, ticker: 'MSFT', name: 'Microsoft', date: '2026-03-15', shares: 10, entryPrice: 390.00, currentPrice: 405.12, strategy: 'Conservador' },
  { id: 4, ticker: 'TSLA', name: 'Tesla Inc.', date: '2026-06-10', shares: 8, entryPrice: 240.00, currentPrice: 214.20, strategy: 'Agresivo' },
];

export default function Portfolio() {
  // Cálculos rápidos para los widgets superiores
  const totalInvested = portfolioData.reduce((acc, item) => acc + (item.shares * item.entryPrice), 0);
  const currentValue = portfolioData.reduce((acc, item) => acc + (item.shares * item.currentPrice), 0);
  const totalROI = ((currentValue - totalInvested) / totalInvested) * 100;
  const isTotalPositive = totalROI >= 0;

  // Función para dar color a la etiqueta de estrategia
  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'Conservador': return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'Moderado': return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      case 'Agresivo': return 'bg-fuchsia-400/10 text-fuchsia-400 border-fuchsia-400/20';
      default: return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* ==========================================
          HEADER Y BOTÓN DE ACCIÓN
      ========================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Mis Inversiones</h1>
          <p className="text-gray-400 mt-1">Gestiona tu portafolio y monitorea el rendimiento real.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20">
          <Plus className="w-5 h-5" />
          Registrar Compra
        </button>
      </div>

      {/* ==========================================
          WIDGETS DE RESUMEN
      ========================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Capital Invertido</p>
            <h3 className="text-2xl font-bold text-white">${totalInvested.toLocaleString('en-US', {minimumFractionDigits: 2})}</h3>
          </div>
        </div>

        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <PieChartIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Valor Actual Proyectado</p>
            <h3 className="text-2xl font-bold text-white">${currentValue.toLocaleString('en-US', {minimumFractionDigits: 2})}</h3>
          </div>
        </div>

        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isTotalPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Retorno Total (ROI)</p>
            <h3 className={`text-2xl font-bold flex items-center gap-2 ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTotalPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {isTotalPositive ? '+' : ''}{totalROI.toFixed(2)}%
            </h3>
          </div>
        </div>
      </div>

      {/* ==========================================
          TABLA PRINCIPAL DE PORTAFOLIO
      ========================================== */}
      <div className="bg-[#141415] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Posiciones Activas</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="text-xs text-gray-500 uppercase bg-[#0a0a0b]/50">
              <tr>
                <th className="px-6 py-4 font-medium">Activo</th>
                <th className="px-6 py-4 font-medium">Fecha Compra</th>
                <th className="px-6 py-4 font-medium">Estrategia</th>
                <th className="px-6 py-4 font-medium text-right">Cant. Acciones</th>
                <th className="px-6 py-4 font-medium text-right">Precio Entrada</th>
                <th className="px-6 py-4 font-medium text-right">Precio Actual</th>
                <th className="px-6 py-4 font-medium text-right">Retorno (ROI)</th>
                <th className="px-6 py-4 font-medium text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {portfolioData.map((item) => {
                // Calcular el ROI individual
                const itemROI = ((item.currentPrice - item.entryPrice) / item.entryPrice) * 100;
                const isPositive = itemROI >= 0;

                return (
                  <tr key={item.id} className="hover:bg-gray-800/20 transition-colors">
                    {/* Ticker y Nombre */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-xs text-white">
                          {item.ticker.substring(0, 1)}
                        </div>
                        <div>
                          <div className="font-bold text-white">{item.ticker}</div>
                          <div className="text-xs text-gray-500">{item.name}</div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Fecha */}
                    <td className="px-6 py-4 text-gray-400">{item.date}</td>
                    
                    {/* Estrategia (Badge de color) */}
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStrategyColor(item.strategy)}`}>
                        {item.strategy}
                      </span>
                    </td>
                    
                    {/* Cantidad */}
                    <td className="px-6 py-4 text-right text-gray-300 font-medium">{item.shares}</td>
                    
                    {/* Precios */}
                    <td className="px-6 py-4 text-right text-gray-400">${item.entryPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-white font-medium">${item.currentPrice.toFixed(2)}</td>
                    
                    {/* ROI */}
                    <td className="px-6 py-4 text-right">
                      <div className={`font-bold flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {isPositive ? '+' : ''}{itemROI.toFixed(2)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {isPositive ? '+' : '-'}${Math.abs((item.currentPrice - item.entryPrice) * item.shares).toFixed(2)}
                      </div>
                    </td>

                    {/* Botón de opciones */}
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}