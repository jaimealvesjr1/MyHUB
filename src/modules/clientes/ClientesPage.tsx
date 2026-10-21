// Arquivo: src/modules/clientes/ClientesPage.tsx
import React, { useState, useEffect } from 'react';
import { Cliente } from '../../types/models';
import { salvarClienteNoBanco, buscarClientes, atualizarClienteNoBanco } from '../../services/clienteService';
import { mascaraCPF, mascaraTelefone } from '../../utils/mascaras';

export default function ClientesPage() {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estado para controlar qual cliente está sendo editado
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);

  const carregarLista = async () => {
    setCarregando(true);
    const dados = await buscarClientes();
    setClientes(dados);
    setCarregando(false);
  };

  useEffect(() => {
    carregarLista();
  }, []);

  // Preenche o formulário ao clicar em Editar
  const iniciarEdicao = (cli: Cliente) => {
    setClienteEditando(cli);
    setNomeCompleto(cli.nomeCompleto);
    setCpf(cli.cpf);
    setTelefone(cli.telefone);
    
    // Tratamento seguro para a data de nascimento
    let dataFormatada = '';
    if (cli.dataNascimento) {
      const d = cli.dataNascimento instanceof Date 
        ? cli.dataNascimento 
        : new Date((cli.dataNascimento as any).seconds ? (cli.dataNascimento as any).seconds * 1000 : cli.dataNascimento);
      if (!isNaN(d.getTime())) {
        dataFormatada = d.toISOString().split('T')[0];
      }
    }
    setDataNascimento(dataFormatada);
  };

  const cancelarEdicao = () => {
    setClienteEditando(null);
    setNomeCompleto(''); setCpf(''); setDataNascimento(''); setTelefone('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nomeCompleto || !cpf || !dataNascimento || !telefone) {
      alert('Preencha todos os campos.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (clienteEditando && clienteEditando.id) {
        // Atualiza cliente existente
        await atualizarClienteNoBanco(clienteEditando.id, {
          nomeCompleto, cpf, telefone, dataNascimento
        });
        alert('Cliente atualizado com sucesso!');
      } else {
        // Cadastra novo cliente
        const novoCliente: Cliente = {
          nomeCompleto, cpf, dataNascimento, telefone, dataCadastro: new Date(),
        };
        await salvarClienteNoBanco(novoCliente);
        alert('Cliente cadastrado com sucesso!');
      }
      
      cancelarEdicao();
      await carregarLista(); 
    } catch (error) {
      alert('Erro ao salvar os dados do cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white">Carteira de Clientes</h1>
        <p className="text-gray-400 mt-2">Cadastre e edite a base de clientes do seu consórcio.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Formulário de Cadastro / Edição */}
        <div className={`xl:col-span-1 p-6 border rounded-xl shadow-lg h-fit transition-colors ${clienteEditando ? 'bg-blue-900/20 border-blue-500/50' : 'bg-dark-card border-dark-border'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
              {clienteEditando ? 'Editar Cliente' : 'Novo Cadastro'}
            </h2>
            {clienteEditando && (
              <button type="button" onClick={cancelarEdicao} className="text-xs text-gray-400 hover:text-white">
                Cancelar
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nome Completo</label>
              <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} disabled={isSubmitting} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">CPF</label>
              <input type="text" value={cpf} onChange={(e) => setCpf(mascaraCPF(e.target.value))} disabled={isSubmitting} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Telefone</label>
              <input type="text" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} disabled={isSubmitting} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Data de Nascimento</label>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} disabled={isSubmitting} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-orange-500 outline-none" />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 text-white font-bold py-3 rounded-md hover:bg-orange-700 transition mt-2">
              {isSubmitting ? 'Salvando...' : clienteEditando ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </form>
        </div>

        {/* Tabela de Listagem com Ação de Editar */}
        <div className="xl:col-span-2 bg-dark-card p-6 border border-dark-border rounded-xl shadow-lg">
          <h2 className="text-xl font-bold text-white mb-6">Clientes Cadastrados</h2>
          {carregando ? (
            <p className="text-gray-400 text-center py-10">Buscando clientes...</p>
          ) : clientes.length === 0 ? (
            <p className="text-gray-400 text-center py-10">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/60 text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">CPF</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clientes.map(cli => (
                    <tr key={cli.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{cli.nomeCompleto}</td>
                      <td className="px-4 py-3">{cli.cpf}</td>
                      <td className="px-4 py-3">{cli.telefone}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => iniciarEdicao(cli)}
                          className="text-blue-400 hover:text-blue-300 font-bold text-xs bg-blue-500/10 px-3 py-1 rounded transition-colors"
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
    </div>
  );
}
