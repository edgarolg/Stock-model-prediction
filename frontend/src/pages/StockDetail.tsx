import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BrainCircuit, Activity, BookOpen, ChevronRight, Loader2, AlertCircle, BarChart3, TrendingUp, TrendingDown, DollarSign, Target, History } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, AreaChart, Area } from 'recharts';
import { APIStockInfo, APIStockHistoryPoint, APIInvestment, APIAnalysisRecord } from '../types';


type Timeframe = '1mo' | '3mo' | '6mo' | '1y';

export default function StockDetail() {
  const { ticker } = useParams(); 
  const currentTicker = ticker ? ticker.toUpperCase() : 'AAPL';

  // --- ESTADOS: MERCADO ---
  const [marketInfo, setMarketInfo] = useState<APIStockInfo | null>(null);
  const [allChartData, setAllChartData] = useState<APIStockHistoryPoint[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('3mo'); 
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  // --- ESTADOS: PORTAFOLIO ---
  const [userInvestment, setUserInvestment] = useState<APIInvestment | null>(null);
  
  // --- ESTADOS: INTELIGENCIA ARTIFICIAL ---
  const [aiAnalysis, setAiAnalysis] = useState<APIAnalysisRecord | null>(null);
  const [aiHistory, setAiHistory] = useState<APIAnalysisRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSource, setAnalysisSource] = useState('');

  // 1. CARGA INICIAL MAESTRA
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingMarket(true);
      setChartError(null);
      
      try {
        // A. Info General y Fundamentales
        const infoRes = await fetch(`http://localhost:8000/stocks/${currentTicker}/info`);
        if (infoRes.ok) setMarketInfo(await infoRes.json());
        
        // B. Inversiones del Usuario
        const portfolioRes = await fetch(`http://localhost:8000/portfolio/investments/active`);
        if (portfolioRes.ok) {
          const portfolioData = await portfolioRes.json();
          const investmentsArray = Array.isArray(portfolioData) ? portfolioData : (portfolioData.data || []);
          setUserInvestment(investmentsArray.find((inv: APIInvestment) => inv.ticker === currentTicker));
        }

        // C. Precios e Indicadores Técnicos (Usamos el endpoint de indicadores que ya calcula RSI, MACD, etc)
        const historyRes = await fetch(`http://localhost:8000/stocks/${currentTicker}/indicators?period=1y`);
        if (historyRes.ok) {
          const rawData = await historyRes.json();
          setAllChartData(rawData); 
        } else {
          setChartError("Error 500: Límite de API o fallo en cálculo de indicadores.");
        }

        // D. Análisis de IA (Actual e Histórico)
        const aiHistoryRes = await fetch(`http://localhost:8000/analysis/history/${currentTicker}`);
        if (aiHistoryRes.ok) {
          const historyList = await aiHistoryRes.json();
          const records = historyList.data || [];
          
          if (records.length > 0) {
            // Guardamos el historial para la gráfica de la IA
            const formattedAiHistory = records.map((r:any) => ({
              date: new Date(r.execution_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              targetPrice: r.final_price_target
            })).reverse(); // Invertimos para que vaya del pasado al presente
            setAiHistory(formattedAiHistory);

            // Verificamos si el más reciente es de hoy
            const latest = records[0];
            const today = new Date().toDateString();
            if (new Date(latest.execution_date).toDateString() === today) {
              setAiAnalysis(latest);
              setAnalysisSource('Recuperado del caché (Análisis de Hoy)');
            }
          }
        }
      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setIsLoadingMarket(false);
      }
    };

    fetchInitialData();
  }, [currentTicker]);

  // 2. FILTRADO INTELIGENTE (MEMORIA)
  const displayedChartData = useMemo(() => {
    if (allChartData.length === 0) return [];
    if (timeframe === '1y') return allChartData;

    const referenceDate = new Date(allChartData[allChartData.length - 1].date);
    const  monthsToSubtract = timeframe === '1mo' ? 1 : timeframe === '3mo' ? 3 : 6;
    
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToSubtract);

    return allChartData.filter(item => new Date(item.date) >= cutoffDate);
  }, [allChartData, timeframe]);

  // 3. PIPELINE DE IA (MANUAL)
  const runFullPipeline = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`http://localhost:8000/analysis/run/full-pipeline/${currentTicker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error("Fallo al ejecutar el pipeline");
      const data = await response.json();
      
      setAiAnalysis({
        final_price_target: data.resumen_ejecutivo.precio_final_ajustado_ia,
        ai_confidence_score: data.resumen_ejecutivo.confianza_del_modelo,
        ai_justification: data.justificacion_llm,
        recommendation: data.resumen_ejecutivo.recomendacion_final,
        portfolio_context: data.portfolio_context
      });
      setAnalysisSource('Análisis en vivo generado exitosamente');
    } catch (error) {
      alert("Hubo un error al generar el análisis de IA. Revisa la consola.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- CÁLCULOS DERIVADOS ---
  const currentPrice = marketInfo?.currentPrice || allChartData[allChartData.length - 1]?.close || 0;
  
  // Cálculo de P&L (Ganancias/Pérdidas no realizadas)
  let pnl = 0, pnlPercent = 0;
  if (userInvestment && currentPrice > 0) {
    pnl = (currentPrice - userInvestment.entry_price) * userInvestment.shares_quantity;
    pnlPercent = ((currentPrice - userInvestment.entry_price) / userInvestment.entry_price) * 100;
  }

  // Formateador de números (Ej: 2.5B, 1.2M)
  const formatCompact = (num: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);

  if (isLoadingMarket) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-indigo-400 space-y-4 pt-32">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-gray-400 font-medium">Cargando Terminal para {currentTicker}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      
      {/* ==========================================
          HEADER: PRECIO Y PORTAFOLIO (CON P&L)
      ========================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 w-full">
        <div className="flex-1 w-full"> 
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold text-xl">
              {currentTicker.charAt(0)}
            </div>
            <div className='flex items-center gap-3'>
              <h1 className="text-3xl font-bold text-white tracking-wide">{currentTicker}</h1>
              <p className="text-gray-400 text-sm mt-1">{marketInfo?.shortName || 'Equities'}</p>
            </div>
          </div>

          <div className="flex justify-between items-end w-full">
            <span className="text-5xl font-bold text-white">
              ${Number(currentPrice).toFixed(2)}
            </span>
            
            {userInvestment && (
              <div className="flex gap-4 items-end">
                {/* Bloque P&L */}
                <div className={`px-4 py-2 rounded-xl text-sm flex flex-col items-end border ${pnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                  <span className="text-xs opacity-80 uppercase tracking-wider font-semibold mb-0.5">Retorno (P&L)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">${Math.abs(pnl).toFixed(2)}</span>
                    <span className="flex items-center text-xs font-bold">
                      {pnl >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {Math.abs(pnlPercent).toFixed(2)}%
                    </span>
                  </div>
                </div>
                {/* Bloque Info Compra */}
                <div className="bg-gray-800/50 border border-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm flex flex-col items-end">
                   <span className="font-semibold text-white">{userInvestment.shares_quantity} Acciones</span>
                   <span className="text-xs text-gray-400">Entrada: ${userInvestment.entry_price}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {aiAnalysis && (
          <button 
            onClick={runFullPipeline} disabled={isAnalyzing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <BrainCircuit className="w-4 h-4 text-white" />}
            {isAnalyzing ? 'Analizando...' : 'Re-Analizar con IA'}
          </button>
        )}
      </div>

      {/* ==========================================
          DATOS FUNDAMENTALES (CARDS)
      ========================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#141415] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-gray-800 rounded-lg text-gray-400"><DollarSign className="w-5 h-5"/></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Market Cap</p>
            <p className="text-white font-bold">{marketInfo?.marketCap ? `$${formatCompact(marketInfo.marketCap)}` : 'N/A'}</p>
          </div>
        </div>
        <div className="bg-[#141415] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-gray-800 rounded-lg text-gray-400"><BarChart3 className="w-5 h-5"/></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">PE Ratio</p>
            <p className="text-white font-bold">{marketInfo?.trailingPE ? marketInfo.trailingPE.toFixed(2) : 'N/A'}</p>
          </div>
        </div>
        <div className="bg-[#141415] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-gray-800 rounded-lg text-gray-400"><Activity className="w-5 h-5"/></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">EPS (Ganancia)</p>
            <p className="text-white font-bold">{marketInfo?.trailingEps ? `$${marketInfo.trailingEps}` : 'N/A'}</p>
          </div>
        </div>
        <div className="bg-[#141415] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-gray-800 rounded-lg text-gray-400"><Target className="w-5 h-5"/></div>
          <div className="w-full">
            <p className="text-xs text-gray-500 uppercase font-semibold">Rango 52 Semanas</p>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mt-1">
              <span>{marketInfo?.fiftyTwoWeekLow ? `$${marketInfo.fiftyTwoWeekLow.toFixed(0)}` : '-'}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                 {/* Visualizador de dónde está el precio actual en el rango del año */}
                 <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, ((currentPrice - (marketInfo?.fiftyTwoWeekLow || 0)) / ((marketInfo?.fiftyTwoWeekHigh || 1) - (marketInfo?.fiftyTwoWeekLow || 0))) * 100))}%` }}></div>
              </div>
              <span>{marketInfo?.fiftyTwoWeekHigh ? `$${marketInfo.fiftyTwoWeekHigh.toFixed(0)}` : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          GRÁFICA TÉCNICA PRINCIPAL (PRECIO + VOLUMEN + SMAs)
      ========================================== */}
      <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="text-indigo-400" /> Technical Analysis (Price, Vol, SMA)
          </h3>
          <div className="flex gap-1 bg-[#0a0a0b] p-1 rounded-xl border border-gray-800">
            {(['1mo', '3mo', '6mo', '1y'] as const).map((range) => (
              <button
                key={range} onClick={() => setTimeframe(range)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  timeframe === range ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-[400px] w-full flex flex-col gap-4">
          {chartError ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-400"><AlertCircle className="w-8 h-8 mb-2" /><p>{chartError}</p></div>
          ) : (
            <>
              {/* GRÁFICA PRINCIPAL COMPUESTA */}
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={displayedChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 12}} axisLine={false} tickLine={false} minTickGap={30} />
                    
                    {/* Eje Y para el Precio */}
                    <YAxis yAxisId="price" domain={['auto', 'auto']} stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    {/* Eje Y invisible para el Volumen */}
                    <YAxis yAxisId="volume" orientation="right" domain={[0, 'dataMax * 4']} hide />
                    
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#1f2937', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }} labelStyle={{ color: '#9ca3af' }}
                    />
                    
                    {/* Capas de visualización */}
                    <Bar yAxisId="volume" dataKey="volume" fill="#374151" opacity={0.3} maxBarSize={20} />
                    <Line yAxisId="price" type="monotone" dataKey="sma_50" stroke="#f59e0b" strokeWidth={1} dot={false} name="SMA 50" />
                    <Line yAxisId="price" type="monotone" dataKey="sma_20" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="SMA 20" />
                    <Line yAxisId="price" type="monotone" dataKey="close" stroke="#10B981" strokeWidth={2.5} dot={false} name="Price" activeDot={{ r: 6, fill: '#10B981', stroke: '#0a0a0b', strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* GRÁFICA SECUNDARIA: RSI (Oscilador) */}
              <div className="h-[100px] border-t border-gray-800 pt-4 relative">
                <span className="absolute top-4 left-0 text-xs font-bold text-gray-500">RSI (14)</span>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayedChartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    {/* Líneas de sobrecompra (70) y sobreventa (30) */}
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} horizontalPoints={[30, 70]} />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#1f2937', borderRadius: '8px' }} labelFormatter={() => ''} />
                    <Area type="monotone" dataKey="rsi" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ==========================================
          ZONA DE INTELIGENCIA HÍBRIDA (LLAMA 3)
      ========================================== */}
      {isAnalyzing ? (
        <div className="bg-[#141415] border border-indigo-500/30 rounded-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/5 animate-pulse"></div>
          <BrainCircuit className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-bounce" />
          <h3 className="text-xl font-bold text-white mb-2">Llama 3 está evaluando el mercado...</h3>
          <p className="text-gray-400 text-sm">Leyendo noticias, calculando indicadores y calculando target de precio.</p>
        </div>
      ) : !aiAnalysis ? (
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-12 text-center">
          <BrainCircuit className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Sin Análisis de Inteligencia Híbrida</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-lg mx-auto">
            Ejecuta nuestro pipeline cuantitativo y cualitativo para obtener una recomendación de Wall Street basada en LLMs.
          </p>
          <button onClick={runFullPipeline} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2 mx-auto">
            <BrainCircuit className="w-5 h-5" /> Generar Análisis Completo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* Panel Izquierdo: Cerebro IA (Ocupa 3 columnas) */}
          <div className="lg:col-span-3 bg-[#141415] border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_15px_rgba(79,70,229,0.1)]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BrainCircuit className="text-indigo-400" /> Veredicto Híbrido Llama 3
              </h3>
              <span className={`px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider ${
                aiAnalysis.recommendation === 'INVERTIR' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                aiAnalysis.recommendation === 'VENDER' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {aiAnalysis.recommendation || 'ESPERAR'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#0a0a0b] p-5 rounded-xl border border-gray-800 flex flex-col justify-center">
                <p className="text-sm text-gray-400 mb-1">Target Price Proyectado</p>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold text-indigo-400">
                    ${Number(aiAnalysis.final_price_target).toFixed(2)}
                  </p>
                  {/* Flechita que indica si la IA espera que suba o baje respecto a hoy */}
                  {Number(aiAnalysis.final_price_target) > currentPrice ? 
                    <span className="text-emerald-400 text-sm flex items-center font-bold bg-emerald-400/10 px-2 py-1 rounded"><TrendingUp className="w-3 h-3 mr-1"/> Alcista</span> : 
                    <span className="text-rose-400 text-sm flex items-center font-bold bg-rose-400/10 px-2 py-1 rounded"><TrendingDown className="w-3 h-3 mr-1"/> Bajista</span>
                  }
                </div>
              </div>
              <div className="bg-[#0a0a0b] p-5 rounded-xl border border-gray-800">
                <p className="text-sm text-gray-400 mb-2">Confianza de IA (Confluencia)</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{(Number(aiAnalysis.ai_confidence_score) * 100).toFixed(0)}%</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${Number(aiAnalysis.ai_confidence_score) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-5">
              <h4 className="text-indigo-400 font-semibold mb-2 text-sm flex items-center gap-2">
                Justificación Cualitativa <ChevronRight className="w-4 h-4" />
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed italic">
                "{aiAnalysis.ai_justification}"
              </p>
            </div>
            <p className="text-xs text-right text-gray-500 mt-4">{analysisSource}</p>
          </div>

          {/* Panel Derecho: Historial de la IA (Ocupa 2 columnas) */}
          <div className="lg:col-span-2 bg-[#141415] border border-gray-800 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <History className="text-gray-400 w-5 h-5" /> Evolución Target IA
            </h3>
            <p className="text-xs text-gray-500 mb-6">Precio objetivo calculado por el modelo en ejecuciones pasadas.</p>
            
            <div className="flex-1 w-full min-h-[200px]">
              {aiHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aiHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 10}} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 10}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val.toFixed(0)}`} width={40} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#4f46e5', borderRadius: '8px', fontSize: '12px' }} />
                    <Line type="stepAfter" dataKey="targetPrice" stroke="#4f46e5" strokeWidth={2} dot={{r: 4, fill: '#4f46e5', stroke: '#0a0a0b'}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-600">
                  <Activity className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm text-center px-4">Necesitas ejecutar múltiples análisis en diferentes días para ver la evolución.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}