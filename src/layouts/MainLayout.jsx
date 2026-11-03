import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, DollarSign, User, Shield, LogOut, Users, Briefcase } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function MainLayout() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  
  const { user, logout } = useAuthStore();
  const firstName = user?.name ? user.name.split(' ')[0] : '';

  return (
    <div className="min-h-screen bg-dark-bg text-gray-200 flex flex-col">
      <header className="sticky top-0 z-40 bg-dark-bg/80 backdrop-blur-xl border-b border-dark-border shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
        <div className="w-full max-w-[2560px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          
          {/* LOGO */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-white tracking-tighter flex items-center">
              My<span className="text-red-600">HUB</span>
              {firstName && (
                <span className="ml-2 pl-2 border-l border-white/20 text-xl font-black text-white tracking-tighter flex items-center">
                  {firstName}
                </span>
              )}
            </span>
          </div>

          {/* MENU DE NAVEGAÇÃO */}
          <nav className="flex items-center gap-2 bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
            <Link 
              to="/dashboard" 
              className={`p-2 md:px-4 md:py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                isActive('/dashboard') ? 'bg-red-900 text-red-100 shadow-md border border-red-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard size={18} /> 
              <span className="hidden md:inline">Início</span>
            </Link>

            <Link 
              to="/leads" 
              className={`p-2 md:px-4 md:py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                isActive('/leads') ? 'bg-purple-900 text-purple-100 shadow-md border border-purple-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Briefcase size={18} /> 
              <span className="hidden md:inline">Leads</span>
            </Link>

            <Link 
              to="/financeiro" 
              className={`p-2 md:px-4 md:py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                isActive('/financeiro') ? 'bg-emerald-900 text-emerald-100 shadow-md border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <DollarSign size={18} /> 
              <span className="hidden md:inline">Vendas</span>
            </Link>

            <Link 
              to="/clientes" 
              className={`p-2 md:px-4 md:py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                isActive('/clientes') ? 'bg-blue-900 text-blue-100 shadow-md border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users size={18} /> 
              <span className="hidden md:inline">Clientes</span>
            </Link>

            {user?.role === 'admin' && (
              <Link 
                to="/admin" 
                className={`p-2 md:px-4 md:py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                  isActive('/admin') ? 'bg-white/10 text-white shadow-md border border-white/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Shield size={18} /> 
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}
          </nav>

          {/* PERFIL E SAIR */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 p-1 pl-1 pr-4 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={`Foto de ${user?.name || 'Perfil'}`} 
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null; // Evita loop infinito se a 2ª imagem também falhar
                      const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
                      target.src = `https://ui-avatars.com/api/?name=${initial}&background=ef4444&color=fff&bold=true`;
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold border border-white/10">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              <div className="hidden md:block">
                <p className="text-[11px] font-bold text-white leading-tight truncate max-w-25">
                  {firstName || 'Visitante'}
                </p>
                <p className="text-[9px] text-red-500 uppercase tracking-widest leading-tight">
                  {user?.role === 'admin' ? 'Usuário' : 'Consultor'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={logout}
              className="p-2 bg-white/5 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 rounded-full text-gray-400 hover:text-red-400 transition-all"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>

        </div>
      </header>

      <main className="flex-1 w-full max-w-[2560px] mx-auto flex flex-col relative">
        <Outlet />
      </main>
    </div>
  );
}
