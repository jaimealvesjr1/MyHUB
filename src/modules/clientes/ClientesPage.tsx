import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  ArrowUpRight,
  Eye,
  Wallet,
  Repeat,
  Cake,
  Phone,
  FileText,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { Cliente, VendaConsorcio } from '../../types/models';
import { buscarClientes } from '../../services/clienteService';
import { buscarVendasDoBanco } from '../../services/vendasService';

// Tipo auxiliar que combina o cadastro do cliente com o resumo das suas compras
interface ClienteComResumo extends Cliente {
  qtdContratos: number;
  volumeTotal: number;
  ehAniversarianteMes: boolean;
}

export default function ClientesPage() {
  const navigate = useNavigate();

  // Estados de dados
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<VendaConsorcio[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados de busca, filtro e ordenação
  const [busca, setBusca] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState<'TODOS' | 'RECOMPRA' | 'ANIVERSARIANTES'>('TODOS');
  const [ordenacao, setOrdenacao] = useState<'ALFABETICA' | 'MAIOR_VOLUME' | 'MAIS_CONTRATOS'>('ALFABETICA');

  const mesAtualNumero = new Date().getMonth() + 1; // 1 (Janeiro) a 12 (Dezembro)

  // ============================================================================
  // 1. CARREGAMENTO PARALELO DE CLIENTES E VENDAS
  // ============================================================================
  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [dadosClientes, dadosVendas] = await Promise.all([
        buscarClientes(),
        buscarVendasDoBanco(),
      ]);
      setClientes(dadosClientes);
      setVendas(dadosVendas);
    } catch (error) {
      console.error('Erro ao carregar carteira de clientes:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ============================================================================
  // 2. FUNÇÕES AUXILIARES DE FORMATAÇÃO
  // ============================================================================
  const formatarMoeda = (valor: number) =>
    (Number.isFinite(valor) ? valor : 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const gerarLinkWhatsApp = (telefone?: string) => {
    if (!telefone) return '';
    const apenasDigitos = telefone.replace(/\D/g, '');
    if (!apenasDigitos) return '';
    const comDDI = apenasDigitos.startsWith('55') ? apenasDigitos : `55${apenasDigitos}`;
    return `https://wa.me/${comDDI}`;
  };

  const obterIniciais = (nome: string) => {
    const partes = nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
  };

  // ============================================================================
  // 3. ENRIQUECIMENTO DOS CLIENTES COM DADOS DE VENDAS E ANIVERSÁRIO
  // ============================================================================
  const clientesEnriquecidos: ClienteComResumo[] = useMemo(() => {
    return clientes.map((cli) => {
      const vendasDoCliente = vendas.filter((v) => v.clienteId === cli.id);
      const qtdContratos = vendasDoCliente.length;
      const volumeTotal = vendasDoCliente.reduce((acc, v) => acc + (v.valorTotalCarta || 0), 0);

      let ehAniversarianteMes = false;
      if (cli.dataNascimento && cli.dataNascimento.includes('-')) {
        const mesNasc = Number(cli.dataNascimento.split('-')[1]);
        ehAniversarianteMes = mesNasc === mesAtualNumero;
      }

      return {
        ...cli,
        qtdContratos,
        volumeTotal,
        ehAniversarianteMes,
      };
    });
  }, [clientes, vendas, mesAtualNumero]);

  // ============================================================================
  // 4. INDICADORES GERAIS DA CARTEIRA (KPIs)
  // ============================================================================
  const indicadoresCarteira = useMemo(() => {
    const totalClientes = clientesEnriquecidos.length;
    const volumeCarteira = clientesEnriquecidos.reduce((acc, c) => acc + c.volumeTotal, 0);
    const totalContratos = clientesEnriquecidos.reduce((acc, c) => acc + c.qtdContratos, 0);
    const clientesRecompra = clientesEnriquecidos.filter((c) => c.qtdContratos >= 2).length;
    const aniversariantesMes = clientesEnriquecidos.filter((c) => c.ehAniversarianteMes).length;

    return {
      totalClientes,
      volumeCarteira,
      totalContratos,
      clientesRecompra,
      aniversariantesMes,
    };
  }, [clientesEnriquecidos]);

  // ============================================================================
  // 5. FILTRAGEM E ORDENAÇÃO DINÂMICA
  // ============================================================================
  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const filtrados = clientesEnriquecidos.filter((c) => {
      if (filtroSegmento === 'RECOMPRA' && c.qtdContratos < 2) return false;
      if (filtroSegmento === 'ANIVERSARIANTES' && !c.ehAniversarianteMes) return false;

      if (termo) {
        const nomeMatch = c.nomeCompleto.toLowerCase().includes(termo);
        const cpfMatch = c.cpf && c.cpf.includes(termo);
        const telMatch = c.telefone && c.telefone.includes(termo);
        if (!nomeMatch && !cpfMatch && !telMatch) return false;
      }

      return true;
    });

    return filtrados.sort((a, b) => {
      if (ordenacao === 'MAIOR_VOLUME') {
        return b.volumeTotal - a.volumeTotal;
      }
      if (ordenacao === 'MAIS_CONTRATOS') {
        return b.qtdContratos - a.qtdContratos;
      }
      return a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR');
    });
  }, [clientesEnriquecidos, filtroSegmento, busca, ordenacao]);

  // ============================================================================
  // 6. RENDERIZAÇÃO DA INTERFACE
  // ============================================================================
  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300 max-w-[1600px] mx-auto">
      {/* CABEÇALHO PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Users className="text-red-600" size={30} /> Carteira de{' '}
            <span className="text-red-600">Clientes</span>
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Gerencie sua base ativa, acompanhe o volume de créditos adquiridos e identifique oportunidades de recompra.
          </p>
        </div>

        <button
          onClick={() => navigate('/leads')}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center gap-2 w-fit shadow-lg shadow-red-600/20"
        >
          Ir para Funil de Leads <ArrowUpRight size={18} />
        </button>
      </div>

      {/* CARDS DE RESUMO DA CARTEIRA (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div
          onClick={() => setFiltroSegmento('TODOS')}
          className={`cursor-pointer bg-dark-card border p-5 rounded-2xl flex items-center justify-between transition-all ${
            filtroSegmento === 'TODOS'
              ? 'border-red-500/50'
              : 'border-dark-border hover:border-white/20'
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Clientes Ativos
            </p>
            <p className="text-2xl font-black text-white mt-1">
              {indicadoresCarteira.totalClientes}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {indicadoresCarteira.totalContratos}{' '}
              {indicadoresCarteira.totalContratos === 1 ? 'cota ativa' : 'cotas ativas'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Volume da Carteira
            </p>
            <p className="text-2xl font-black text-blue-400 mt-1">
              {formatarMoeda(indicadoresCarteira.volumeCarteira)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Soma total em cartas vendidas</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Wallet size={22} />
          </div>
        </div>

        <div
          onClick={() =>
            setFiltroSegmento(filtroSegmento === 'RECOMPRA' ? 'TODOS' : 'RECOMPRA')
          }
          className={`cursor-pointer bg-dark-card border p-5 rounded-2xl flex items-center justify-between transition-all ${
            filtroSegmento === 'RECOMPRA'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-dark-border hover:border-emerald-500/40'
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Clientes Recorrentes
            </p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {indicadoresCarteira.clientesRecompra}
            </p>
            <p className="text-xs text-gray-500 mt-1">2 ou mais cartas adquiridas</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Repeat size={22} />
          </div>
        </div>

        <div
          onClick={() =>
            setFiltroSegmento(
              filtroSegmento === 'ANIVERSARIANTES' ? 'TODOS' : 'ANIVERSARIANTES'
            )
          }
          className={`cursor-pointer bg-dark-card border p-5 rounded-2xl flex items-center justify-between transition-all ${
            filtroSegmento === 'ANIVERSARIANTES'
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-dark-border hover:border-amber-500/40'
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Aniversariantes do Mês
            </p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              {indicadoresCarteira.aniversariantesMes}
            </p>
            <p className="text-xs text-gray-500 mt-1">Oportunidade de relacionamento</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Cake size={22} />
          </div>
        </div>
      </div>

      {/* PAINEL PRINCIPAL DA TABELA DE CLIENTES */}
      <div className="bg-dark-card p-6 border border-dark-border rounded-2xl shadow-lg">
        {/* Barra de Filtros, Ordenação e Pesquisa */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 border-b border-white/5 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'TODOS', label: `Todos (${indicadoresCarteira.totalClientes})` },
                { id: 'RECOMPRA', label: `Com Recompra (${indicadoresCarteira.clientesRecompra})` },
                { id: 'ANIVERSARIANTES', label: `Aniversariantes (${indicadoresCarteira.aniversariantesMes})` },
              ] as const
            ).map((aba) => (
              <button
                key={aba.id}
                type="button"
                onClick={() => setFiltroSegmento(aba.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                  filtroSegmento === aba.id
                    ? 'bg-red-600 text-white shadow'
                    : 'bg-black/40 text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-3 py-2">
              <ArrowUpDown size={14} className="text-gray-400" />
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as any)}
                className="bg-transparent text-xs text-white font-bold outline-none"
              >
                <option value="ALFABETICA" className="bg-dark-bg">
                  Ordem Alfabética (A–Z)
                </option>
                <option value="MAIOR_VOLUME" className="bg-dark-bg">
                  Maior Volume Comprado
                </option>
                <option value="MAIS_CONTRATOS" className="bg-dark-bg">
                  Mais Contratos Ativos
                </option>
              </select>
            </div>

            {/* Campo de Pesquisa */}
            <div className="relative flex-1 sm:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-8 text-sm text-white outline-none focus:border-red-500"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabela de Clientes */}
        {carregando ? (
          <p className="text-gray-400 text-center py-10 animate-pulse">Buscando clientes...</p>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm font-medium">
              Nenhum cliente encontrado para os filtros selecionados.
            </p>
            {(filtroSegmento !== 'TODOS' || busca) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroSegmento('TODOS');
                  setBusca('');
                }}
                className="mt-3 text-xs text-red-400 hover:underline font-bold"
              >
                Limpar filtros e mostrar todos
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/60 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Cliente</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Telefone / WhatsApp</th>
                  <th className="px-4 py-3">Nascimento</th>
                  <th className="px-4 py-3">Contratos & Volume</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clientesFiltrados.map((cli) => {
                  const linkWhats = gerarLinkWhatsApp(cli.telefone);

                  return (
                    <tr
                      key={cli.id}
                      onClick={() => navigate(`/clientes/${cli.id}`)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      {/* Avatar + Nome + Badges */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-red-600/15 border border-red-500/30 flex items-center justify-center text-xs font-black text-red-400 shrink-0">
                            {obterIniciais(cli.nomeCompleto)}
                          </div>
                          <div>
                            <span className="font-bold text-white group-hover:text-red-400 transition-colors block">
                              {cli.nomeCompleto}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {cli.qtdContratos >= 2 && (
                                <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                  Recompra ({cli.qtdContratos}x)
                                </span>
                              )}
                              {cli.ehAniversarianteMes && (
                                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                                  <Cake size={10} /> Aniversariante
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                        {cli.cpf || '-'}
                      </td>

                      {/* Telefone com atalho WhatsApp */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {cli.telefone ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-gray-300">{cli.telefone}</span>
                            {linkWhats && (
                              <a
                                href={linkWhats}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 transition-colors"
                              >
                                <Phone size={12} />
                              </a>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Data de Nascimento */}
                      <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                        {cli.dataNascimento
                          ? cli.dataNascimento.split('-').reverse().join('/')
                          : '-'}
                      </td>

                      {/* Resumo de Contratos e Volume */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {cli.qtdContratos > 0 ? (
                          <div>
                            <span className="font-black text-blue-400 block">
                              {formatarMoeda(cli.volumeTotal)}
                            </span>
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                              <FileText size={11} /> {cli.qtdContratos}{' '}
                              {cli.qtdContratos === 1 ? 'contrato' : 'contratos'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Sem contratos</span>
                        )}
                      </td>

                      {/* Botão Ver Créditos */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/clientes/${cli.id}`);
                          }}
                          className="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 font-bold text-xs px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Eye size={13} /> Ver Créditos
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
