import { LayoutDashboard, Briefcase, BrainCircuit, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Portfolio', icon: Briefcase, path: '/portfolio' },
    { name: 'AI Analysis', icon: BrainCircuit, path: '/analysis/AAPL' }, // Temporalmente hardcodeado a AAPL
  ];

  return (
    <aside className="w-64 bg-[#0a0a0b] border-r border-gray-800 flex flex-col h-screen p-4">
      <div className="flex items-center gap-2 mb-10 px-2">
        <BrainCircuit className="text-indigo-500 w-8 h-8" />
        <span className="text-xl font-bold text-white tracking-wide">AInvestments</span>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-gray-800/50 text-white font-medium' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <button className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white transition-all w-full rounded-xl hover:bg-gray-800/30">
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>
    </aside>
  );
}