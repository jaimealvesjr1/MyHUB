// Arquivo: src/modules/finance/FinancePage.tsx
import React, { useState, useEffect } from 'react';
import { VendaConsorcio, Cliente } from '../../types/models';
import { buscarVendasDoBanco } from '../../services/vendasService';
import { buscarClientes } from '../../services/clienteService'; // Importação do serviço de clientes
import FormularioVenda from './FormularioVenda';

export default function FinancePage() {
  const [vendas, setVendas] = useState<VendaConsorcio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]); // Novo estado para guardar os clientes
  const [carregando, setCarregando] = useState(true);
  const [vendaEmEdicao, setVendaEmEdicao] = useState<VendaConsorcio | null>(null);

  // Busca vendas e clientes ao mesmo tempo para cruzar os dados
  const carregarDados = async () => {
    setCarregando(true);
    // Promise.all executa as duas buscas no Firebase simultaneamente, ganhando tempo
    const [dadosVendas, dadosClientes] = await Promise.all([
      buscarVendasDoBanco(),
      buscarClientes()
    ]);
    
    setVendas(dadosVendas);
    setClientes(dadosClientes);
    setCarregando(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleEditarVenda = (venda: VendaConsorcio) => {
    setVendaEmEdicao(venda);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  // Função educacional: Procura o ID do cliente na lista e retorna o nome completo
  const getNomeCliente = (id: string) => {
    const clienteEncontrado = clientes.find((cli) => cli.id === id);
    return clienteEncontrado ? clienteEncontrado.nomeCompleto : 'Cliente não encontrado';
  };

  // Função educacional: Formata números para R$ sem alterar o valor original
  const formatarValorParaExibicao = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white">Gestão de Vendas</h1>
        <p className="text-gray-400 mt-2">Registre, acompanhe e edite o seu histórico de cartas de consórcio.</p>
      </div>

      <div className="mb-10">
        <FormularioVenda 
          onVendaSalva={carregarDados} 
          vendaEditando={vendaEmEdicao} 
          onCancelarEdicao={() => setVendaEmEdicao(null)} 
        />
      </div>

      <div className="bg-dark-card border border-dark-border rounded-xl shadow-lg overflow-hidden p-6">
        <h2 className="text-xl font-bold text-white mb-6">Histórico de Vendas</h2>
        
        {carregando ? (
          <p className="text-orange-400 text-center py-10 animate-pulse">Carregando vendas...</p>
        ) : vendas.length === 0 ? (
          <p className="text-gray-400 text-center py-10">Nenhuma venda registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/60 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Cliente</th> {/* Nova Coluna */}
                  <th className="px-4 py-3">Tipo / Grupo / Cota</th>
                  <th className="px-4 py-3">Valor da Carta</th>
                  <th className="px-4 py-3">Comissão Total</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {vendas.map((venda) => (
                  <tr key={venda.id} className="hover:bg-white/5 transition-colors">
                    
                    {/* Renderização do Nome do Cliente cruzado com o ID */}
                    <td className="px-4 py-3 font-medium text-white">
                      {getNomeCliente(venda.clienteId)}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-300 block">{venda.tipoCarta}</span>
                      <span className="text-xs text-gray-500">Gr: {venda.grupo} | Cota: {venda.cota}</span>
                    </td>
                    
                    {/* Renderização dos Valores com formatação segura nativa */}
                    <td className="px-4 py-3 font-medium text-blue-400">
                      {formatarValorParaExibicao(venda.valorTotalCarta)}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-400">
                      {formatarValorParaExibicao(venda.valorComissaoTotal)}
                    </td>
                    
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => handleEditarVenda(venda)}
                        className="text-orange-500 hover:text-orange-400 font-bold text-xs bg-orange-500/10 px-3 py-1 rounded transition-colors"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
