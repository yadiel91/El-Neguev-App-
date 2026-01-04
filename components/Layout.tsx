
import React from 'react';
import { AppRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  role: AppRole;
  setRole: (role: AppRole) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, role, setRole }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-orange-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-utensils text-2xl"></i>
            <span className="text-xl font-bold uppercase tracking-wider">El Neguev</span>
          </div>
          <nav className="hidden md:flex space-x-4">
            <button 
              onClick={() => setRole('CLIENT')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${role === 'CLIENT' ? 'bg-white text-orange-600' : 'hover:bg-orange-500'}`}
            >
              Cliente
            </button>
            <button 
              onClick={() => setRole('ADMIN')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${role === 'ADMIN' ? 'bg-white text-orange-600' : 'hover:bg-orange-500'}`}
            >
              Admin
            </button>
            <button 
              onClick={() => setRole('DELIVERY')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${role === 'DELIVERY' ? 'bg-white text-orange-600' : 'hover:bg-orange-500'}`}
            >
              Repartidor
            </button>
          </nav>
          <div className="md:hidden">
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="bg-orange-700 text-white border-none text-sm rounded-md"
            >
              <option value="CLIENT">Cliente</option>
              <option value="ADMIN">Admin</option>
              <option value="DELIVERY">Repartidor</option>
            </select>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-6">
        {children}
      </main>

      <footer className="bg-stone-800 text-stone-400 py-8 px-4 text-center">
        <p className="text-sm">© 2024 El Neguev - Comida Criolla Dominicana</p>
        <p className="text-xs mt-2 italic">Sabor real, entregado con amor.</p>
      </footer>
    </div>
  );
};

export default Layout;
