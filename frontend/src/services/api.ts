import axios from 'axios';
import { InvestmentPayload } from '../types'; // Ajusta la ruta si es necesario

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

export const apiService = {
  // HISTORIAL Y ANÁLISIS (IA)
  getAllHistory: async (limit = 50) => {
    const response = await api.get(`/analysis/history/all?limit=${limit}`);
    return response.data;
  },

  getLatestAnalysis: async (ticker: string) => {
    const response = await api.get(`/analysis/history/${ticker}/latest`);
    return response.data;
  },

  runFullPipeline: async (ticker: string) => {
    const response = await api.post(`/run/full-pipeline/${ticker}`);
    return response.data;
  },

  // GESTIÓN DE PORTAFOLIO
  getActiveInvestments: async () => {
    const response = await api.get('/portfolio/investments/active');
    return response.data;
  },

  addInvestment: async (investmentData: InvestmentPayload) => {
    const response = await api.post('/portfolio/investments', investmentData);
    return response.data;
  },

  getStrategies: async () => {
    const response = await api.get('/portfolio/strategies');
    return response.data;
  },

  updateInvestment: async (id: number, data: InvestmentPayload) => {
    const response = await api.put(`/portfolio/investments/${id}`, data);
    return response.data;
  },
  
  deleteInvestment: async (id: number) => {
    const response = await api.delete(`/portfolio/investments/${id}`);
    return response.data;
  }
};