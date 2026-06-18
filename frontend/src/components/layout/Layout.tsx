import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#101012] text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8">
          {/* Aquí se inyectarán las pantallas dinámicas */}
          <Outlet /> 
        </main>
      </div>
    </div>
  );
}