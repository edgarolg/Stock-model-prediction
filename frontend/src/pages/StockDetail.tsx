import { useParams } from 'react-router-dom';
import { ArrowUpRight, BrainCircuit, Activity, BookOpen, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

// --- DATOS DE PRUEBA (MOCKS) ---
// Simulamos datos históricos y futuros (predicción)
const chartData = [
  { date: 'Jun 10', price: 175.50, prediction: null },
  { date: 'Jun 11', price: 178.20, prediction: null },
  { date: 'Jun 12', price: 177.80, prediction: null },
  { date: 'Jun 13', price: 180.10, prediction: null },
  { date: 'Jun 14', price: 182.40, prediction: null },
  { date: 'Jun 15', price: 181.90, prediction: null },
  { date: 'Jun 16', price: 185.00, prediction: null },
  { date: 'Jun 17', price: 187.30, prediction: null },
  { date: 'Jun 18', price: 189.43, prediction: 189.43 }, // Punto de conexión (Hoy)
  { date: 'Jun 19', price: null, prediction: 191.20 },
  { date: 'Jun 20', price: null, prediction: 194.50 },
  { date: 'Jun 21', price: null, prediction: 193.80 },
  { date: 'Jun 22', price: null, prediction: 197.10 },
  { date: 'Jun 23', price: null, prediction: 199.50 }, // Predicción a 5 días
];

const newsContext = [
  { id: 1, source: 'Bloomberg', time: '2 hours ago', title: 'Apple announces new AI integration in upcoming iOS 18 update.', sentiment: 'Positivo' },
  { id: 2, source: 'Reuters', time: '5 hours ago', title: 'Tech stocks rally as inflation cools down faster than expected.', sentiment: 'Positivo' },
  { id: 3, source: 'Wall Street Journal', time: '1 day ago', title: 'Supply chain constraints slightly impact iPhone production in Asia.', sentiment: 'Negativo' },
];

export default function StockDetail() {
  const { ticker } = useParams(); // Lee el ticker desde la URL (ej. AAPL)
  
  // En la vida real, haríamos un fetch a tu backend dependiendo del `ticker`.
  // Por ahora, asumiremos que es Apple (AAPL).
  const currentTicker = ticker || 'AAPL';

  return (
    <div className="space-y-6 pb-10">
      
      {/* ==========================================
          HEADER DEL STOCK
      ========================================== */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold text-xl">
              {currentTicker.charAt(0)}
            </div>
            <h1 className="text-3xl font-bold text-white tracking-wide">{currentTicker}</h1>
            <span className="text-gray-400 text-lg mt-1">Apple Inc.</span>
          </div>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-bold text-white">$189.43</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium mb-1 bg-emerald-400/10 px-2 py-0.5 rounded">
              <ArrowUpRight className="w-5 h-5" /> +2.34% Today
            </span>
          </div>
        </div>
        
        <button className="bg-[#141415] border border-gray-800 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-xl transition-colors flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          Forzar Re-Análisis
        </button>
      </div>

      {/* ==========================================
          GRÁFICO PRINCIPAL (HISTÓRICO VS IA)
      ========================================== */}
      <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="text-indigo-400" /> Price Action & AI Forecast (7 Days)
          </h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
              <span className="text-gray-400">Precio Real</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
              <span className="text-gray-400">Predicción Híbrida</span>
            </div>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" stroke="#6b7280" tick={{fill: '#6b7280'}} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke="#6b7280" tick={{fill: '#6b7280'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#1f2937', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              
              {/* Línea del precio real hasta hoy */}
              <Line type="monotone" dataKey="price" stroke="#10B981" strokeWidth={3} dot={false} activeDot={{ r: 8 }} />
              
              {/* Línea punteada de la predicción hacia el futuro */}
              <Line type="monotone" dataKey="prediction" stroke="#818cf8" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }} activeDot={{ r: 8 }} />
              
              {/* Marcador del día de hoy */}
              <ReferenceDot x="Jun 18" y={189.43} r={6} fill="#10B981" stroke="#0a0a0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ==========================================
          COLUMNAS INFERIORES: IA Y NOTICIAS
      ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel Izquierdo: Cerebro IA */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          {/* Efecto de luz de fondo */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 blur-3xl rounded-full pointer-events-none"></div>

          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <BrainCircuit className="text-indigo-400" /> Hybrid AI Analysis
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#0a0a0b] p-4 rounded-xl border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">Target Price (7d)</p>
              <p className="text-2xl font-bold text-indigo-400">$199.50</p>
            </div>
            <div className="bg-[#0a0a0b] p-4 rounded-xl border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">Confidence Score</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-white">85%</p>
                <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                  <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-5">
            <h4 className="text-indigo-400 font-semibold mb-2 text-sm flex items-center gap-2">
              Llama 3 Reasoning <ChevronRight className="w-4 h-4" />
            </h4>
            <p className="text-gray-300 text-sm leading-relaxed">
              Basado en el modelo XGBoost, la tendencia matemática es alcista con un crecimiento esperado del 3.5%. El análisis de sentimiento de noticias valida este escenario, destacando la adopción agresiva de IA en los nuevos productos de Apple. Se recomienda una posición de <strong className="text-emerald-400">COMPRA FUERTE</strong>.
            </p>
          </div>
        </div>

        {/* Panel Derecho: Noticias Analizadas */}
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <BookOpen className="text-gray-400" /> News Context Fetched
          </h3>
          
          <div className="space-y-4">
            {newsContext.map((news) => (
              <div key={news.id} className="p-4 rounded-xl bg-[#0a0a0b] border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-500 font-medium">{news.source} • {news.time}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    news.sentiment === 'Positivo' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 
                    'bg-rose-400/10 text-rose-400 border border-rose-400/20'
                  }`}>
                    {news.sentiment}
                  </span>
                </div>
                <p className="text-sm text-gray-300 line-clamp-2">{news.title}</p>
              </div>
            ))}
          </div>
          
          <button className="w-full mt-4 py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
            Ver todas las fuentes procesadas
          </button>
        </div>

      </div>
    </div>
  );
}