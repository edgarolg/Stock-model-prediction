import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BrainCircuit, Activity, ChevronRight, Loader2, AlertCircle, TrendingUp, TrendingDown, History, Sparkles, Eye, EyeOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, AreaChart, Area } from 'recharts';
import type { APIStockHistoryPoint, APIInvestment, APIAnalysisRecord } from '../types';               

type Timeframe = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';

interface FormattedHistoryPoint {
  date: string;
  targetPrice: number;
}

type ExtendedChartPoint = Partial<APIStockHistoryPoint> & {
  date: string;
  predicted_close?: number;
};


export default function StockDetail() {
  const { ticker } = useParams(); 
  const currentTicker = ticker ? ticker.toUpperCase() : 'AAPL';

  // --- STATES: MARKET ---
  const [allChartData, setAllChartData] = useState<APIStockHistoryPoint[]>([]); 
  const [timeframe, setTimeframe] = useState<Timeframe>('3mo'); 
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  // --- STATES: CHART TOGGLES ---
  const [showSma20, setShowSma20] = useState(false);
  const [showSma50, setShowSma50] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);

  // --- STATES: PORTFOLIO ---
  const [userInvestment, setUserInvestment] = useState<APIInvestment | null>(null);
  // --- STATES: AI ---
  const [mathPrediction, setMathPrediction] = useState<number | null>(null);
  const [isRunningMath, setIsRunningMath] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<APIAnalysisRecord | null>(null);
  const [aiHistory, setAiHistory] = useState<FormattedHistoryPoint[]>([]); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSource, setAnalysisSource] = useState('');

  // 1. MASTER INITIAL LOAD
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingMarket(true);
      setChartError(null);
      
      try {
        const portfolioRes = await fetch(`http://localhost:8000/portfolio/investments/active`);
        if (portfolioRes.ok) {
          const portfolioData = await portfolioRes.json();
          const investmentsArray = Array.isArray(portfolioData) ? portfolioData : (portfolioData.data || []);
          setUserInvestment(investmentsArray.find((inv: APIInvestment) => inv.ticker === currentTicker) || null);
        }

        const historyRes = await fetch(`http://localhost:8000/stocks/${currentTicker}/indicators?period=5y`);
        if (historyRes.ok) {
          const rawData = await historyRes.json();
          const chartArray = rawData.history ? rawData.history : (Array.isArray(rawData) ? rawData : []);
          setAllChartData(chartArray); 
        } else {
          setChartError("Error 500: API limit reached or indicator calculation failed.");
        }

        const aiHistoryRes = await fetch(`http://localhost:8000/analysis/history/${currentTicker}`);
        if (aiHistoryRes.ok) {
          const historyList = await aiHistoryRes.json();
          const records = historyList.data || [];
          
          if (records.length > 0) {
            const formattedAiHistory = records.map((r: APIAnalysisRecord) => ({
              date: new Date(r.execution_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              targetPrice: r.final_price_target || 0
            })).reverse(); 
            setAiHistory(formattedAiHistory);

            const latest = records[0];
            const today = new Date().toDateString();
            if (new Date(latest.execution_date).toDateString() === today) {
              setAiAnalysis(latest);
              setAnalysisSource('Retrieved from cache (Today\'s Analysis)');
            }
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setChartError("Network error checking connection.");
      } finally {
        setIsLoadingMarket(false);
      }
    };

    fetchInitialData();
  }, [currentTicker]);

  // 2. SMART FILTERING (MEMORY)
  const displayedChartData = useMemo(() => {
    if (!Array.isArray(allChartData) || allChartData.length === 0) return [];
    
    // Le decimos a TS que este arreglo usará nuestro nuevo tipo extendido
    let filteredData: ExtendedChartPoint[] = allChartData;
    
    if (timeframe !== '5y') {
      const lastItem = allChartData[allChartData.length - 1];
      if (lastItem && lastItem.date) {
        const referenceDate = new Date(lastItem.date);
        const cutoffDate = new Date(referenceDate);

        if (timeframe === '1mo') cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        else if (timeframe === '3mo') cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        else if (timeframe === '6mo') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        else if (timeframe === '1y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        else if (timeframe === '2y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

        filteredData = allChartData.filter(item => new Date(item.date) >= cutoffDate);
      }
    }

    // AI PREDICTION INJECTION
    const activeTargetPrice = aiAnalysis?.final_price_target || mathPrediction;

    if (showPrediction && activeTargetPrice && filteredData.length > 0) {
      // dataWithPrediction ahora acepta predicted_close y close: undefined
      const dataWithPrediction: ExtendedChartPoint[] = [...filteredData];
      const lastValidPoint = dataWithPrediction[dataWithPrediction.length - 1];
      
      dataWithPrediction[dataWithPrediction.length - 1] = {
        ...lastValidPoint,
        predicted_close: lastValidPoint.close 
      };

      const futureDate = new Date(lastValidPoint.date);
      futureDate.setDate(futureDate.getDate() + 30);

      dataWithPrediction.push({
        date: futureDate.toISOString().split('T')[0],
        predicted_close: activeTargetPrice,
        close: undefined, 
      });

      return dataWithPrediction;
    }

    return filteredData;
  }, [allChartData, timeframe, showPrediction, aiAnalysis, mathPrediction]);

// 3. PIPELINE A: ONLY MATH MODELS (LSTM + XGBoost)
  const runMathModelOnly = async () => {
    setIsRunningMath(true);
    try {
      const response = await fetch(`http://localhost:8000/analysis/run/quantitative/${currentTicker}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error("Failed to execute math model");
      
      const data = await response.json();
      
      // ¡Aquí está la magia! Agregamos pred_base_lstm
      const targetPrice = data.pred_base_lstm || data.precio_base || data.prediction || data.target; 
      
      console.log("Precio matemático recibido:", targetPrice); // Para que lo veas en F12
      
      setMathPrediction(targetPrice);
      setShowPrediction(true);
    } catch (error) {
      console.error("Detalle del error en runMathModelOnly:", error);
      alert("Error running LSTM/XGBoost models. Check if the endpoint /analysis/run/math/{ticker} exists in backend.");
    } finally {
      setIsRunningMath(false);
    }
  };
  // 4. AI PIPELINE (MANUAL)
  const runFullPipeline = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`http://localhost:8000/analysis/run/full-pipeline/${currentTicker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error("Failed to execute pipeline");
      const data = await response.json();
      
      setAiAnalysis({
        final_price_target: data.resumen_ejecutivo.precio_final_ajustado_ia,
        confianza_analisis: data.resumen_ejecutivo.confianza_del_modelo,
        justificacion_llm: data.justificacion_llm,
        recomendacion: data.resumen_ejecutivo.recomendacion_final,
        portfolio_context: data.portfolio_context
      } as APIAnalysisRecord);
      setAnalysisSource('Live analysis generated successfully');
      setShowPrediction(true); // Auto-mostrar predicción al generar
    } catch {
      alert("There was an error generating the AI analysis. Check the console.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- DERIVED CALCULATIONS ---
  // Corrección del precio: Buscar el último precio válido (ignorando puntos proyectados de IA)
  const lastValidPricePoint = displayedChartData.slice().reverse().find(d => d.close !== undefined);
  const currentPrice = Number(lastValidPricePoint?.close || 0);
  
  let pnl = 0, pnlPercent = 0;
  if (userInvestment && currentPrice > 0) {
    pnl = (currentPrice - userInvestment.entry_price) * userInvestment.shares_quantity;
    pnlPercent = ((currentPrice - userInvestment.entry_price) / userInvestment.entry_price) * 100;
  }

  const getUIRecommendation = (rec: string | undefined) => {
    if (!rec) return 'HOLD';
    if (rec === 'INVERTIR') return 'BUY';
    if (rec === 'VENDER') return 'SELL';
    if (rec === 'ESPERAR') return 'HOLD';
    return rec;
  };

  if (isLoadingMarket) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-indigo-400 space-y-4 pt-32">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-gray-400 font-medium">Loading Terminal for {currentTicker}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 w-full">
        <div className="flex-1 w-full"> 
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold text-xl">
              {currentTicker.charAt(0)}
            </div>
            <div className='flex items-center gap-3'>
              <h1 className="text-3xl font-bold text-white tracking-wide">{currentTicker}</h1>
              <p className="text-gray-400 text-sm mt-1">Equities</p>
            </div>
          </div>

          <p className="text-gray-400 text-sm mt-1 text-left">Current Price:</p>
          <div className="flex justify-between items-end w-full">
            <span className="text-5xl font-bold text-white">
              ${currentPrice > 0 ? currentPrice.toFixed(2) : '---'}
            </span>
            
            {userInvestment && (
              <div className="flex gap-4 items-end">
                <div className={`px-4 py-2 rounded-xl text-sm flex flex-col items-end border ${pnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                  <span className="text-xs opacity-80 uppercase tracking-wider font-semibold mb-0.5">Return (P&L)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">${Math.abs(pnl).toFixed(2)}</span>
                    <span className="flex items-center text-xs font-bold">
                      {pnl >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {Math.abs(pnlPercent).toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm flex flex-col items-end">
                   <span className="font-semibold text-white">{userInvestment.shares_quantity} Shares</span>
                   <span className="text-xs text-gray-400">Entry: ${userInvestment.entry_price}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* BOTONES DE ACCIÓN */}
        <div className="flex gap-3">
          {/* Botón: Solo Modelo Matemático (Usa isRunningMath) */}
          <button 
            onClick={runMathModelOnly} 
            disabled={isRunningMath || isAnalyzing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
          >
            {isRunningMath ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Activity className="w-4 h-4 text-white" />}
            {isRunningMath ? 'Calculando...' : 'Proyección Rápida (Math)'}
          </button>

          {/* Botón: Full Pipeline Llama 3 (Usa isAnalyzing) */}
          {aiAnalysis ? (
            <button 
              onClick={runFullPipeline} disabled={isAnalyzing || isRunningMath}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <BrainCircuit className="w-4 h-4 text-white" />}
              {isAnalyzing ? 'Analizando...' : 'Re-Analizar con IA'}
            </button>
          ) : (
            <button 
              onClick={runFullPipeline} disabled={isAnalyzing || isRunningMath}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
              {isAnalyzing ? 'Ejecutando Pipeline...' : 'Análisis Híbrido Completo'}
            </button>
          )}
        </div>
      </div>


      {/* MAIN TECHNICAL CHART */}
      <div className="bg-[#141415] border border-gray-800 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="text-indigo-400" /> Price Action & Indicators
          </h3>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* TOGGLES PARA SMAs Y PREDICCION */}
            <div className="flex gap-2 mr-4 border-r border-gray-800 pr-4">
              <button onClick={() => setShowSma20(!showSma20)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showSma20 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#0a0a0b] text-gray-500 border border-gray-800 hover:text-gray-300'}`}>
                {showSma20 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} SMA 20
              </button>
              <button onClick={() => setShowSma50(!showSma50)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showSma50 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[#0a0a0b] text-gray-500 border border-gray-800 hover:text-gray-300'}`}>
                {showSma50 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} SMA 50
              </button>
              {(aiAnalysis || mathPrediction) && (
                <button onClick={() => setShowPrediction(!showPrediction)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showPrediction ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[#0a0a0b] text-gray-500 border border-gray-800 hover:text-gray-300'}`}>
                  <Sparkles className="w-3 h-3" /> Projection
                </button>
              )}
            </div>

            {/* TIME FRAME */}
            <div className="flex gap-1 bg-[#0a0a0b] p-1 rounded-xl border border-gray-800">
              {(['1mo', '3mo', '6mo', '1y', '2y', '5y'] as const).map((range) => (
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
        </div>
        
        <div className="h-[400px] w-full flex flex-col gap-4">
          {chartError ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-400"><AlertCircle className="w-8 h-8 mb-2" /><p>{chartError}</p></div>
          ) : displayedChartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500"><p>No data available to display chart.</p></div>
          ) : (
            <>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={displayedChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 12}} axisLine={false} tickLine={false} minTickGap={30} />
                    
                    <YAxis yAxisId="price" domain={['auto', 'auto']} stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <YAxis yAxisId="volume" orientation="right" domain={[0, 'dataMax * 4']} hide />
                    
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0b', borderColor: '#1f2937', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }} labelStyle={{ color: '#9ca3af' }}
                    />
                    
                    <Bar yAxisId="volume" dataKey="volume" fill="#374151" opacity={0.3} maxBarSize={20} />
                    
                    {/* TOGGLEABLE LINES */}
                    {showSma50 && <Line yAxisId="price" type="monotone" dataKey="sma_50" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="SMA 50" />}
                    {showSma20 && <Line yAxisId="price" type="monotone" dataKey="sma_20" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="SMA 20" />}
                    
                    {/* BASE PRICE */}
                    <Line yAxisId="price" connectNulls type="monotone" dataKey="close" stroke="#10B981" strokeWidth={2.5} dot={false} name="Actual Price" activeDot={{ r: 6, fill: '#10B981', stroke: '#0a0a0b', strokeWidth: 2 }} />
                    
                    {/* PREDICTIVE AI LINE */}
                    {showPrediction && <Line yAxisId="price" connectNulls type="monotone" dataKey="predicted_close" stroke="#a855f7" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4, fill: '#a855f7', stroke: '#0a0a0b' }} name="Model Prediction" activeDot={{ r: 8, fill: '#a855f7' }} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[100px] border-t border-gray-800 pt-4 relative">
                <span className="absolute top-4 left-0 text-xs font-bold text-gray-500">RSI (14)</span>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayedChartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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

      {/* HYBRID AI ZONE (LLAMA 3) */}
      {isAnalyzing ? (
        <div className="bg-[#141415] border border-indigo-500/30 rounded-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/5 animate-pulse"></div>
          <BrainCircuit className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-bounce" />
          <h3 className="text-xl font-bold text-white mb-2">Llama 3 is evaluating the market...</h3>
          <p className="text-gray-400 text-sm">Reading news, calculating indicators, and projecting target price.</p>
        </div>
      ) : !aiAnalysis ? (
        <div className="bg-[#141415] border border-gray-800 rounded-2xl p-12 text-center">
          <BrainCircuit className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Hybrid Intelligence Analysis</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-lg mx-auto">
            Run our quantitative and qualitative pipeline to get a Wall Street recommendation powered by LLMs.
          </p>
          <button onClick={runFullPipeline} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2 mx-auto">
            <BrainCircuit className="w-5 h-5" /> Generate Full Analysis
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-[#141415] border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_15px_rgba(79,70,229,0.1)]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BrainCircuit className="text-indigo-400" /> Llama 3 Hybrid Verdict
              </h3>
              <span className={`px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider ${
                getUIRecommendation(aiAnalysis.recomendacion) === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                getUIRecommendation(aiAnalysis.recomendacion) === 'SELL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {getUIRecommendation(aiAnalysis.recomendacion)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#0a0a0b] p-5 rounded-xl border border-gray-800 flex flex-col justify-center">
                <p className="text-sm text-gray-400 mb-1">Projected Target Price</p>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold text-indigo-400">
                    ${Number(aiAnalysis.final_price_target).toFixed(2)}
                  </p>
                  {Number(aiAnalysis.final_price_target) > currentPrice ? 
                    <span className="text-emerald-400 text-sm flex items-center font-bold bg-emerald-400/10 px-2 py-1 rounded"><TrendingUp className="w-3 h-3 mr-1"/> Bullish</span> : 
                    <span className="text-rose-400 text-sm flex items-center font-bold bg-rose-400/10 px-2 py-1 rounded"><TrendingDown className="w-3 h-3 mr-1"/> Bearish</span>
                  }
                </div>
              </div>
              <div className="bg-[#0a0a0b] p-5 rounded-xl border border-gray-800">
                <p className="text-sm text-gray-400 mb-2">AI Confidence (Confluence)</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{(Number(aiAnalysis.confianza_analisis) * 100).toFixed(0)}%</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${Number(aiAnalysis.confianza_analisis) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-5">
              <h4 className="text-indigo-400 font-semibold mb-2 text-sm flex items-center gap-2">
                Qualitative Justification <ChevronRight className="w-4 h-4" />
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed italic">
                "{aiAnalysis.justificacion_llm}"
              </p>
            </div>
            <p className="text-xs text-right text-gray-500 mt-4">{analysisSource}</p>
          </div>

          <div className="lg:col-span-2 bg-[#141415] border border-gray-800 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <History className="text-gray-400 w-5 h-5" /> AI Target Evolution
            </h3>
            <p className="text-xs text-gray-500 mb-6">Target price calculated by the model in past executions.</p>
            
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
                  <p className="text-sm text-center px-4">You need to run multiple analyses on different days to see the evolution.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}