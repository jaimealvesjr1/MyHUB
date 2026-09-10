import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, DollarSign, User } from 'lucide-react';

export default function MainLayout() {
  // useLocation nos diz em qual página o usuário está agora (ex: "/financeiro")
  const location = useLocation();
  
  // Função auxiliar para verificar se o botão atual deve ficar "aceso"
  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-dark-bg text-gray-200 flex flex-col">
      
      {/* HEADER FIXO: Efeito de vidro (backdrop-blur) igual ao Avante HUB */}
      <header className="sticky top-0 z-40 bg-dark-bg/80 backdrop-blur-xl border-b border-dark-border shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
        <div className="w-full max-w-[2560px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          
          {/* Logo da Aplicação */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white shadow-md">
              H
            </div>
            <span className="text-xl font-black text-white tracking-tighter">
              MEU<span className="text-indigo-500">HUB</span>
            </span>
          </div>

          {/* Navegação Central (Dock) */}
          <nav className="flex items-center gap-2 bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
            <Link 
              to="/dashboard" 
              className={`p-2 md:px-4 md:py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                isActive('/dashboard') ? 'bg-indigo-900 text-indigo-100 shadow-md border border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard size={18} /> 
              <span className="hidden md:inline">Dashboard</span>
            </Link>
            
            <Link 
              to="/financeiro" 
              className={`p-2 md:px-4 md:py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                isActive('/financeiro') ? 'bg-emerald-900 text-emerald-100 shadow-md border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <DollarSign size={18} /> 
              <span className="hidden md:inline">Financeiro</span>
            </Link>
          </nav>

          {/* Perfil do Usuário (Placeholder até integrarmos o Firebase) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 p-1 pl-2 pr-4 rounded-full border border-white/10 backdrop-blur-md shadow-inner cursor-pointer hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-md border border-white/20">
                <User size={16} />
              </div>
              <div className="hidden md:block">
                <p className="text-[11px] font-bold text-white leading-tight">Visitante</p>
                <p className="text-[9px] text-indigo-300 uppercase tracking-widest leading-tight">Membro</p>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* ÁREA PRINCIPAL: Onde as páginas são renderizadas */}
      <main className="flex-1 w-full max-w-[2560px] mx-auto flex flex-col relative">
        {/* O Outlet funciona como um portal. O conteúdo da rota atual aparecerá exatamente aqui. */}
        <Outlet />
      </main>
      
    </div>
  );
}
