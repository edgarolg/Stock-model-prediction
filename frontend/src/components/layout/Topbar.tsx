import { Search, Bell, User } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="h-20 flex items-center justify-between px-8 bg-[#0a0a0b] border-b border-gray-800">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input 
          type="text" 
          placeholder="Search Tickers (e.g. AAPL, TSLA)..." 
          className="w-full bg-[#141415] border border-gray-800 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      <div className="flex items-center gap-4">
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