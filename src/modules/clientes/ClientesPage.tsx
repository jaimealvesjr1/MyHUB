import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Edit2, ArrowUpRight, X } from 'lucide-react';
import { Cliente } from '../../types/models';
import { buscarClientes, atualizarClienteNoBanco } from '../../services/clienteService';
import { mascaraCPF, mascaraTelefone } from '../../utils/mascaras';

export default function ClientesPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  // Estados apenas para edição de cliente existente
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    const dadosClientes = await buscarClientes();
    setClientes(dadosClientes);
    setCarregando(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const iniciarEdicao = (cli: Cliente) => {
    setClienteEditando(cli);
    setNomeCompleto(cli.nomeCompleto);
    setCpf(cli.cpf);
    setTelefone(cli.telefone);

    let dataFmt = '';
    if (cli.dataNascimento) {
      const d =
        (cli.dataNascimento as any) instanceof Date
          ? (cli.dataNascimento as any)
          : new Date(
              (cli.dataNascimento as any).seconds
                ? (cli.dataNascimento as any).seconds * 1000
                : cli.dataNascimento
            );
      if (!isNaN(d.getTime())) dataFmt = d.toISOString().split('T')[0];
    }
    setDataNascimento(dataFmt);
  };

  const cancelarEdicao = () => {
    setClienteEditando(null);
    setNomeCompleto('');
    setCpf('');
    setTelefone('');
    setDataNascimento('');
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteEditando?.id) return;

    setIsSubmitting(true);
    try {
      await atualizarClienteNoBanco(clienteEditando.id, {
        nomeCompleto,
        cpf,
        telefone,
        dataNascimento,
      });
      cancelarEdicao();
      await carregarDados();
    } catch (error) {
      alert('Erro ao atualizar cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      (c.cpf && c.cpf.includes(busca))
  );

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Users className="text-red-600" size={30} /> Carteira de <span className="text-red-600">Clientes</span>
          </h1>
          <p className="text-gray-400 mt-2">
            Novos clientes são cadastrados automaticamente ao converter um Lead fechado no funil.
          </p>
        </div>

        <button
          onClick={() => navigate('/leads')}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-colors flex items-center gap-2 w-fit"
        >
          Ir para Funil de Leads <ArrowUpRight size={18} />
        </button>
      </div>

      <div className="bg-dark-card p-6 border border-dark-border rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-white">
            Clientes Ativos ({clientesFiltrados.length})
          </h2>

          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-red-500"
            />
          </div>
        </div>

        {carregando ? (
          <p className="text-gray-400 text-center py-10 animate-pulse">Buscando clientes...</p>
        ) : clientesFiltrados.length === 0 ? (
          <p className="text-gray-400 text-center py-10">Nenhum cliente encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/60 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Nome Completo</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Nascimento</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clientesFiltrados.map((cli) => (
                  <tr key={cli.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{cli.nomeCompleto}</td>
                    <td className="px-4 py-3">{cli.cpf || '-'}</td>
                    <td className="px-4 py-3">{cli.telefone || '-'}</td>
                    <td className="px-4 py-3">
                      {cli.dataNascimento ? cli.dataNascimento.split('-').reverse().join('/') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => iniciarEdicao(cli)}
                        className="text-red-400 hover:text-red-300 font-bold text-xs bg-red-500/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                      >
                        <Edit2 size={12} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição de Cliente Existente */}
      {clienteEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-md relative">
            <button
              onClick={cancelarEdicao}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Editar Dados do Cliente</h2>

            <form onSubmit={handleSalvarEdicao} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome Completo</label>
                <input
                  required
                  type="text"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">CPF</label>
                <input
                  required
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(mascaraCPF(e.target.value))}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Telefone</label>
                <input
                  required
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data de Nascimento</label>
                <input
                  required
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
