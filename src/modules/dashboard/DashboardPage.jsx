import React, { useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { Plus, Briefcase } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DashboardPage() {
  // Puxamos as lojas, o estado de carregamento e as funções da nossa memória global
  const { stores, isLoadingData, listenToStores, addStore } = useDataStore();

  // O useEffect roda assim que a tela abre, ligando o "observador" do banco de dados
  useEffect(() => {
    const unsubscribe = listenToStores();
    
    // Quando saímos da tela, ele desliga o observador para economizar internet/memória
    return () => unsubscribe();
  }, [listenToStores]);

  // Função para criar uma loja de teste
  const handleCreateTestStore = () => {
    const fakeStore = {
      id: Date.now(), // Gera um ID único baseado na data e hora atual
      client: "Cliente Teste",
      store: "Loja Exemplo",
      marketplace: "MERCADO LIVRE",
      currentRevenue: 15000,
      createdAt: new Date().toISOString()
    };

    addStore(fakeStore);
    toast.success("Loja de teste adicionada com sucesso!");
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      
      {/* Cabeçalho da Página */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="text-orange-500" size={24} /> 
            Portfólio de Lojas
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie os resultados dos seus clientes.</p>
        </div>

        {/* Botão de Adicionar Loja (Apenas para teste inicial) */}
        <button 
          onClick={handleCreateTestStore}
          className="bg-orange-600 hover:bg-orange-500 text-white py-2 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md"
        >
          <Plus size={16} /> <span className="hidden md:inline">Nova Loja Teste</span>
        </button>
      </div>

      {/* Área de Listagem das Lojas */}
      {isLoadingData ? (
        <div className="flex justify-center items-center py-20 text-orange-400">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : stores.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-10 text-center">
          <p className="text-gray-400">Nenhuma loja cadastrada ainda.</p>
          <p className="text-sm text-gray-500 mt-2">Clique no botão acima para adicionar a primeira.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Mapeia a lista de lojas e cria um "Card" para cada uma */}
          {stores.map((store) => (
            <div key={store.id} className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-sm hover:border-orange-500/50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{store.store}</h3>
                  <p className="text-xs text-orange-400 font-bold uppercase tracking-wider">{store.client}</p>
                </div>
                <span className="bg-black/50 border border-white/10 text-gray-300 text-[10px] px-2 py-1 rounded-lg">
                  {store.marketplace}
                </span>
              </div>
              <div className="pt-4 border-t border-dark-border">
                <p className="text-xs text-gray-500 mb-1">Faturamento Atual</p>
                {/* Formatação simples de moeda */}
                <p className="text-xl font-black text-white">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(store.currentRevenue)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
