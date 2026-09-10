import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { DollarSign, CheckSquare, Activity, ArrowRight, TrendingUp, Calendar, Dumbbell } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';

  // Obtém a saudação com base na hora do dia
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      
      {/* Cabeçalho de Boas-Vindas */}
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white">
          {getGreeting()}, <span className="text-orange-500">{firstName}</span>!
        </h1>
        <p className="text-gray-400 mt-2">Este é o seu ecossistema pessoal. O que vamos gerenciar hoje?</p>
      </div>

      {/* Grid com os 3 Módulos Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* 1. CARD DE FINANÇAS */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg flex flex-col h-full hover:border-emerald-500/30 transition-colors group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <DollarSign className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Finanças Pessoais</h2>
              <p className="text-xs text-gray-500">Caixa e Previsões</p>
            </div>
          </div>
          
          {/* Informações de Resumo (Dados Fixos por enquanto) */}
          <div className="flex-1 space-y-4 mb-6">
            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-1">
                <TrendingUp size={12} /> Saldo Atual
              </p>
              <p className="text-2xl font-black text-emerald-400">R$ 4.250,00</p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Entradas Previstas</span>
              <span className="text-white font-bold">+ R$ 1.500,00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Saídas Previstas</span>
              <span className="text-red-400 font-bold">- R$ 850,00</span>
            </div>
          </div>
        </div>

        {/* 2. CARD DE TAREFAS E AGENDA */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg flex flex-col h-full hover:border-blue-500/30 transition-colors group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
              <CheckSquare className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Gestão e Agenda</h2>
              <p className="text-xs text-gray-500">Tarefas e Compromissos</p>
            </div>
          </div>
          
          <div className="flex-1 space-y-4 mb-6">
            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-1">
                <Calendar size={12} /> Para Hoje
              </p>
              <p className="text-2xl font-black text-blue-400">5 <span className="text-sm font-medium text-gray-400">pendentes</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-300 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Reunião de Alinhamento (14h)</p>
              <p className="text-xs text-gray-300 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Pagar faturas (18h)</p>
            </div>
          </div>

        </div>

        {/* 3. CARD DE FITNESS E SAÚDE */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg flex flex-col h-full hover:border-red-500/30 transition-colors group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
              <Activity className="text-red-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Fitness & Saúde</h2>
              <p className="text-xs text-gray-500">Treinos e Evolução</p>
            </div>
          </div>
          
          <div className="flex-1 space-y-4 mb-6">
            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-1">
                <Dumbbell size={12} /> Treino do Dia
              </p>
              <p className="text-xl font-black text-red-400">Costas e Bíceps</p>
            </div>
            <div className="flex justify-between items-center text-sm bg-white/5 p-3 rounded-lg border border-white/5">
              <span className="text-gray-400">Dias na semana</span>
              <span className="text-white font-bold flex items-center gap-1">
                🔥 3 / 5
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
