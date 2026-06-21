import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User } from 'lucide-react';

export default function Topbar() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue al dar Enter
    
    if (searchTerm.trim()) {
      const ticker = searchTerm.trim().toUpperCase();
      // Cambia la ruta según como la tengas en tu App.tsx (ej. /stock/AAPL o /analysis/AAPL)
      navigate(`/analysis/${ticker}`); 
      setSearchTerm(''); 
    }
  };

  return (
    <header className="h-20 flex items-center justify-between px-8 bg-[#0a0a0b] border-b border-gray-800">
      
      {/* Envolvemos el buscador en un form para habilitar la búsqueda con la tecla "Enter" */}
      <form onSubmit={handleSearch} className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search Tickers (e.g. AAPL, TSLA)..." 
          className="w-full bg-[#141415] border border-gray-800 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </form>

      <div className="hidden flex items-center gap-4">
        <button className="p-2 text-gray-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white">
          <User className="w-5 h-5" />
        </div>
      </div>
      
    </header>
  );
}