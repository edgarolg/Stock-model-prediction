import axios from 'axios';

// Creamos la instancia principal de Axios apuntando a tu FastAPI
const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// Centralizamos todas las llamadas a la base de datos y al LLM
export const apiService = {
  
  // ==========================================
  // HISTORIAL Y ANÁLISIS (IA)
  // ==========================================
  
  // Trae el historial general (Para el Dashboard)
  getAllHistory: async (limit = 50) => {
    const response = await api.get(`/analysis/history/all?limit=${limit}`);
    return response.data;
  },

  // Trae el análisis más reciente de un ticker (Para StockDetail)
  getLatestAnalysis: async (ticker: string) => {
    const response = await api.get(`/analysis/history/${ticker}/latest`);
    return response.data;
  },

  // Fuerza a Llama 3 y XGBoost a recalcular todo
  runFullPipeline: async (ticker: string) => {
    const response = await api.post(`/run/full-pipeline/${ticker}`);
    return response.data;
  },

  // ==========================================
  // GESTIÓN DE PORTAFOLIO
  // ==========================================
  
  // Ver compras activas
  getActiveInvestments: async () => {
    const response = await api.get('/portfolio/investments/active');
    return response.data;
  },

  // Registrar nueva compra
  addInvestment: async (investmentData: { ticker: string, shares_quantity: number, entry_price: number, strategy_id?: number }) => {
    const response = await api.post('/portfolio/investments', investmentData);
    return response.data;
  },

  // Traer las estrategias (Conservador, etc.) para el formulario
  getStrategies: async () => {
    const response = await api.get('/portfolio/strategies');
    return response.data;
  }
};