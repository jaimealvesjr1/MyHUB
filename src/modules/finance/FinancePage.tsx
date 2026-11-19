import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  Edit2,
  CheckCircle2,
  RotateCcw,
  Filter,
  Plus,
  X,
  Search,
  Wallet,
  Clock,
  TrendingUp,
  FileText,
  Calendar,
  Layers,
  Tag,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { VendaConsorcio, Cliente, ParcelaComissao } from '../../types/models';
import {
  buscarVendasDoBanco,
  buscarParcelasDoBanco,
  excluirVendaDoBanco,
  alternarConfirmacaoParcela,
  isParcelaConfirmada,
} from '../../services/vendasService';
import { buscarClientes } from '../../services/clienteService';
import FormularioVenda from './FormularioVenda';

export default function FinancePage() {
  const navigate = useNavigate();

  // ============================================================================
  // 1. ESTADOS DE DADOS (Vindos do Firebase)
  // ============================================================================
  const [vendas, setVendas] = useState<VendaConsorcio[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaComissao[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);

  // ============================================================================
  // 2. ESTADOS DE NAVEGAÇÃO, MODAL E BUSCA GLOBAL
  // ============================================================================
  const [abaAtiva, setAbaAtiva] = useState<'VENDAS' | 'PARCELAS'>('VENDAS');
  const [modalFormularioAberto, setModalFormularioAberto] = useState(false);
  const [vendaEmEdicao, setVendaEmEdicao] = useState<VendaConsorcio | null>(null);
  const [buscaTexto, setBuscaTexto] = useState('');

  // ============================================================================
  // 3. ESTADOS DOS FILTROS DO HISTÓRICO DE VENDAS
  // ============================================================================
  const [mesVendaFiltro, setMesVendaFiltro] = useState<string>('TODOS');
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>('');
  const [dataFimFiltro, setDataFimFiltro] = useState<string>('');
  const [tipoCartaFiltro, setTipoCartaFiltro] = useState<string>('TODOS');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('TODOS');

  // ============================================================================
  // 4. ESTADOS DOS FILTROS DO CONTROLE DE PARCELAS (>= 2ª)
  // ============================================================================
  const [mesParcelaFiltro, setMesParcelaFiltro] = useState<string>('TODOS');
  const [statusFiltro, setStatusFiltro] = useState<'PENDENTES' | 'CONFIRMADAS' | 'TODAS'>('PENDENTES');
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  // ============================================================================
  // 5. CARREGAMENTO DOS DADOS DO BANCO
  // ============================================================================
  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [dadosVendas, dadosParcelas, dadosClientes] = await Promise.all([
        buscarVendasDoBanco(),
        buscarParcelasDoBanco(),
        buscarClientes(),
      ]);

      const clientesOrdenados = [...dadosClientes].sort((a, b) =>
        a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR')
      );

      setVendas(dadosVendas);
      setParcelas(dadosParcelas);
      setClientes(clientesOrdenados);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
      toast.error('Não foi possível carregar os dados de vendas e parcelas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ============================================================================
  // 6. FUNÇÕES AUXILIARES DE DATA, MOEDA E CLIENTE
  // ============================================================================
  const getNomeCliente = (id: string) => {
    const clienteEncontrado = clientes.find((cli) => cli.id === id);
    return clienteEncontrado ? clienteEncontrado.nomeCompleto : 'Cliente não encontrado';
  };

  const getInfoVenda = (vendaId: string) => {
    return vendas.find((v) => v.id === vendaId);
  };

  const formatarValorParaExibicao = (valor: number) => {
    return (Number.isFinite(valor) ? valor : 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const converterParaDate = (dataVenda: any): Date | null => {
    if (!dataVenda) return null;
    if (dataVenda instanceof Date) {
      return isNaN(dataVenda.getTime()) ? null : dataVenda;
    }
    if (typeof dataVenda === 'object' && typeof dataVenda.toDate === 'function') {
      const d = dataVenda.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof dataVenda === 'object' && typeof dataVenda.seconds === 'number') {
      const d = new Date(dataVenda.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof dataVenda === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataVenda)) {
      const [ano, mes, dia] = dataVenda.split('-').map(Number);
      return new Date(ano, mes - 1, dia, 12, 0, 0);
    }
    const d = new Date(dataVenda);
    return isNaN(d.getTime()) ? null : d;
  };

  const extrairDataISO = (dataVenda: any): string => {
    const d = converterParaDate(dataVenda);
    if (!d) return '';
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const extrairMesAno = (dataVenda: any): string => {
    const d = converterParaDate(dataVenda);
    if (!d) return '';
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${mes}/${ano}`;
  };

  const formatarDataVenda = (dataVenda: any) => {
    const d = converterParaDate(dataVenda);
    if (!d) return '-';
    return d.toLocaleDateString('pt-BR');
  };

  // Retorna o mês/ano da nota fiscal em que a venda entrou (ex: "Nota 11/2026")
  const obterRotuloNotaVenda = (venda: VendaConsorcio): string => {
    const d = converterParaDate(venda.dataVenda);
    if (!d) return '';
    const compSalva = (venda as any).competenciaNota;
    const entraNoMesAtual = compSalva ? compSalva === 'ATUAL' : d.getDate() <= 15;
    const dataNota = new Date(d.getFullYear(), d.getMonth() + (entraNoMesAtual ? 0 : 1), 1);
    const mes = String(dataNota.getMonth() + 1).padStart(2, '0');
    return `Nota ${mes}/${dataNota.getFullYear()}`;
  };

  // ============================================================================
  // 7. AÇÕES DE FORMULÁRIO E EXCLUSÃO
  // ============================================================================
  const handleAbrirNovaVenda = () => {
    setVendaEmEdicao(null);
    setModalFormularioAberto(true);
  };

  const handleEditarVenda = (venda: VendaConsorcio) => {
    setVendaEmEdicao(venda);
    setModalFormularioAberto(true);
  };

  const handleFecharModalFormulario = () => {
    setModalFormularioAberto(false);
    setVendaEmEdicao(null);
  };

  const handleExcluirVenda = async (venda: VendaConsorcio) => {
    if (!venda.id) return;
    const nomeCli = getNomeCliente(venda.clienteId);
    const confirmou = window.confirm(
      `Deseja realmente excluir esta venda de ${nomeCli} (${formatarValorParaExibicao(
        venda.valorTotalCarta
      )})?\n\nTodas as parcelas de comissão vinculadas a ela também serão apagadas.`
    );

    if (!confirmou) return;

    try {
      await excluirVendaDoBanco(venda.id);
      if (vendaEmEdicao?.id === venda.id) {
        handleFecharModalFormulario();
      }
      toast.success('Venda e parcelas removidas com sucesso!');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      toast.error('Erro ao excluir a venda.');
    }
  };

  const handleConfirmarParcela = async (parcela: ParcelaComissao, confirmar: boolean) => {
    if (!parcela.id) return;
    setProcessandoId(parcela.id);
    try {
      await alternarConfirmacaoParcela(parcela.id, confirmar);
      setParcelas((prev) =>
        prev.map((p) =>
          p.id === parcela.id
            ? {
                ...p,
                clientePagou: confirmar,
                status: confirmar ? 'CONFIRMADA' : 'AGUARDANDO_CLIENTE',
              }
            : p
        )
      );
      toast.success(
        confirmar
          ? `Parcela ${parcela.numeroParcela} confirmada como PAGA (${parcela.mesAnoReferencia})!`
          : `Confirmação da parcela ${parcela.numeroParcela} desfeita.`
      );
    } catch (error) {
      console.error('Erro ao atualizar parcela:', error);
      toast.error('Erro ao atualizar parcela.');
    } finally {
      setProcessandoId(null);
    }
  };

  // ============================================================================
  // 8. OPÇÕES DINÂMICAS E FILTRAGEM DO HISTÓRICO DE VENDAS
  // ============================================================================
  const mesesVendaDisponiveis = useMemo(() => {
    const unicos = Array.from(new Set(vendas.map((v) => extrairMesAno(v.dataVenda)).filter(Boolean)));
    return unicos.sort((a, b) => {
      const [mesA, anoA] = a.split('/').map(Number);
      const [mesB, anoB] = b.split('/').map(Number);
      return anoB !== anoA ? anoB - anoA : mesB - mesA;
    });
  }, [vendas]);

  const tiposCartaDisponiveis = useMemo(() => {
    const unicos = Array.from(
      new Set(vendas.map((v) => (v.tipoCarta || '').trim()).filter(Boolean))
    );
    return unicos.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [vendas]);

  const gruposDisponiveis = useMemo(() => {
    const unicos = Array.from(new Set(vendas.map((v) => (v.grupo || '').trim()).filter(Boolean)));
    return unicos.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [vendas]);

  const vendasFiltradas = useMemo(() => {
    const termo = buscaTexto.trim().toLowerCase();

    return vendas.filter((v) => {
      if (mesVendaFiltro !== 'TODOS' && extrairMesAno(v.dataVenda) !== mesVendaFiltro) {
        return false;
      }

      const dataISO = extrairDataISO(v.dataVenda);
      if (dataInicioFiltro && (!dataISO || dataISO < dataInicioFiltro)) {
        return false;
      }
      if (dataFimFiltro && (!dataISO || dataISO > dataFimFiltro)) {
        return false;
      }

      if (tipoCartaFiltro !== 'TODOS' && (v.tipoCarta || '').trim() !== tipoCartaFiltro) {
        return false;
      }

      if (grupoFiltro !== 'TODOS' && (v.grupo || '').trim() !== grupoFiltro) {
        return false;
      }

      if (termo) {
        const nomeCli = getNomeCliente(v.clienteId).toLowerCase();
        const grupo = (v.grupo || '').toLowerCase();
        const cota = (v.cota || '').toLowerCase();
        const tipo = (v.tipoCarta || '').toLowerCase();
        if (
          !nomeCli.includes(termo) &&
          !grupo.includes(termo) &&
          !cota.includes(termo) &&
          !tipo.includes(termo)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    vendas,
    mesVendaFiltro,
    dataInicioFiltro,
    dataFimFiltro,
    tipoCartaFiltro,
    grupoFiltro,
    buscaTexto,
    clientes,
  ]);

  const temFiltroVendaAtivo =
    mesVendaFiltro !== 'TODOS' ||
    dataInicioFiltro !== '' ||
    dataFimFiltro !== '' ||
    tipoCartaFiltro !== 'TODOS' ||
    grupoFiltro !== 'TODOS' ||
    buscaTexto.trim() !== '';

  const limparFiltrosVendas = () => {
    setMesVendaFiltro('TODOS');
    setDataInicioFiltro('');
    setDataFimFiltro('');
    setTipoCartaFiltro('TODOS');
    setGrupoFiltro('TODOS');
    setBuscaTexto('');
  };

  // ============================================================================
  // 9. SOMATÓRIAS DINÂMICAS
  // ============================================================================
  const somatoriasVendasFiltradas = useMemo(() => {
    const quantidade = vendasFiltradas.length;
    const volumeCartas = vendasFiltradas.reduce((acc, v) => acc + (v.valorTotalCarta || 0), 0);
    const comissaoTotal = vendasFiltradas.reduce((acc, v) => acc + (v.valorComissaoTotal || 0), 0);
    const ticketMedio = quantidade > 0 ? volumeCartas / quantidade : 0;

    return {
      quantidade,
      volumeCartas,
      comissaoTotal,
      ticketMedio,
    };
  }, [vendasFiltradas]);

  const resumoParcelasGeral = useMemo(() => {
    const parcelasRecorrentesLista = parcelas.filter((p) => p.numeroParcela >= 2);
    const parcelasPendentesLista = parcelasRecorrentesLista.filter((p) => !isParcelaConfirmada(p));
    const valorPendente = parcelasPendentesLista.reduce((acc, p) => acc + (p.valorReceber || 0), 0);

    const valorConfirmadoTotal = parcelas
      .filter((p) => isParcelaConfirmada(p))
      .reduce((acc, p) => acc + (p.valorReceber || 0), 0);

    return {
      qtdPendentes: parcelasPendentesLista.length,
      valorPendente,
      valorConfirmadoTotal,
    };
  }, [parcelas]);

  // ============================================================================
  // 10. LÓGICA DA ABA DE CONTROLE DE PARCELAS (>= 2ª)
  // ============================================================================
  const parcelasRecorrentes = useMemo(
    () => parcelas.filter((p) => p.numeroParcela >= 2),
    [parcelas]
  );

  const mesesParcelasDisponiveis = useMemo(() => {
    const unicos = Array.from(new Set(parcelasRecorrentes.map((p) => p.mesAnoReferencia)));
    return unicos.sort((a, b) => {
      const [mesA, anoA] = a.split('/').map(Number);
      const [mesB, anoB] = b.split('/').map(Number);
      return anoA !== anoB ? anoA - anoB : mesA - mesB;
    });
  }, [parcelasRecorrentes]);

  const parcelasFiltradas = useMemo(() => {
    const termo = buscaTexto.trim().toLowerCase();

    return parcelasRecorrentes.filter((p) => {
      if (mesParcelaFiltro !== 'TODOS' && p.mesAnoReferencia !== mesParcelaFiltro) return false;

      const confirmada = isParcelaConfirmada(p);
      if (statusFiltro === 'PENDENTES' && confirmada) return false;
      if (statusFiltro === 'CONFIRMADAS' && !confirmada) return false;

      if (termo) {
        const venda = getInfoVenda(p.vendaId);
        const nomeCli = getNomeCliente(p.clienteId || venda?.clienteId || '').toLowerCase();
        const grupo = (venda?.grupo || '').toLowerCase();
        const cota = (venda?.cota || '').toLowerCase();
        if (!nomeCli.includes(termo) && !grupo.includes(termo) && !cota.includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [parcelasRecorrentes, mesParcelaFiltro, statusFiltro, buscaTexto, vendas, clientes]);

  // ============================================================================
  // 11. RENDERIZAÇÃO DA INTERFACE
  // ============================================================================
  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300 w-full">
      {/* CABEÇALHO PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">Gestão de Vendas & Fechamentos</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Analise suas vendas por período, grupo ou tipo de carta e controle os recebimentos mensais.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAbrirNovaVenda}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 shrink-0"
        >
          <Plus size={18} /> Nova Venda
        </button>
      </div>

      {/* CARDS DE RESUMO (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {temFiltroVendaAtivo ? 'Volume Vendido (Filtrado)' : 'Volume Total Vendido'}
            </p>
            <p className="text-2xl font-black text-white mt-1">
              {formatarValorParaExibicao(somatoriasVendasFiltradas.volumeCartas)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {somatoriasVendasFiltradas.quantidade}{' '}
              {somatoriasVendasFiltradas.quantidade === 1 ? 'contrato' : 'contratos'}
              {temFiltroVendaAtivo ? ` de ${vendas.length} no total` : ''}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {temFiltroVendaAtivo ? 'Comissão Gerada (Filtrada)' : 'Comissões Confirmadas'}
            </p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {formatarValorParaExibicao(
                temFiltroVendaAtivo
                  ? somatoriasVendasFiltradas.comissaoTotal
                  : resumoParcelasGeral.valorConfirmadoTotal
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {temFiltroVendaAtivo
                ? `Ticket médio: ${formatarValorParaExibicao(somatoriasVendasFiltradas.ticketMedio)}`
                : '1ªs parcelas + mensalidades pagas'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wallet size={22} />
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Aguardando Pagamento (2ª+)
            </p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              {formatarValorParaExibicao(resumoParcelasGeral.valorPendente)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {resumoParcelasGeral.qtdPendentes}{' '}
              {resumoParcelasGeral.qtdPendentes === 1 ? 'parcela pendente' : 'parcelas pendentes'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* BARRA DE ABAS + PESQUISA RÁPIDA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="inline-flex bg-dark-card p-1.5 rounded-2xl border border-dark-border w-fit">
          <button
            type="button"
            onClick={() => setAbaAtiva('VENDAS')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              abaAtiva === 'VENDAS'
                ? 'bg-red-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText size={16} />
            Histórico de Vendas
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-black ${
                abaAtiva === 'VENDAS' ? 'bg-black/30 text-white' : 'bg-white/10 text-gray-300'
              }`}
            >
              {vendasFiltradas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('PARCELAS')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              abaAtiva === 'PARCELAS'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckCircle2 size={16} />
            Controle de Parcelas
            {resumoParcelasGeral.qtdPendentes > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-black ${
                  abaAtiva === 'PARCELAS'
                    ? 'bg-black/30 text-white'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {resumoParcelasGeral.qtdPendentes}
              </span>
            )}
          </button>
        </div>

        <div className="relative w-full lg:w-80">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar cliente, grupo ou cota..."
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-dark-card border border-dark-border rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-red-500 transition-colors"
          />
          {buscaTexto && (
            <button
              type="button"
              onClick={() => setBuscaTexto('')}
              title="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================
          ABA 1: HISTÓRICO DE VENDAS COM FILTROS E SOMATÓRIAS
      ======================================================================== */}
      {abaAtiva === 'VENDAS' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-lg animate-in fade-in duration-200">
          <div className="flex flex-col gap-4 mb-6 border-b border-white/5 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">Histórico de Vendas</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Filtre por mês, intervalo de datas, tipo de carta ou grupo para calcular as somatórias.
                </p>
              </div>

              {temFiltroVendaAtivo && (
                <button
                  type="button"
                  onClick={limparFiltrosVendas}
                  className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <X size={14} /> Limpar Filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-gray-400 mb-1">
                  <Calendar size={12} className="text-red-400" /> Mês da Venda
                </label>
                <select
                  value={mesVendaFiltro}
                  onChange={(e) => setMesVendaFiltro(e.target.value)}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none"
                >
                  <option value="TODOS" className="bg-dark-bg">
                    Todos os Meses
                  </option>
                  {mesesVendaDisponiveis.map((mes) => (
                    <option key={mes} value={mes} className="bg-dark-bg">
                      {mes}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-gray-400 mb-1">
                  <Calendar size={12} className="text-blue-400" /> Período (De)
                </label>
                <input
                  type="date"
                  value={dataInicioFiltro}
                  onChange={(e) => setDataInicioFiltro(e.target.value)}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none scheme-dark"
                />
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-gray-400 mb-1">
                  <Calendar size={12} className="text-blue-400" /> Período (Até)
                </label>
                <input
                  type="date"
                  value={dataFimFiltro}
                  onChange={(e) => setDataFimFiltro(e.target.value)}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none scheme-dark"
                />
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-gray-400 mb-1">
                  <Tag size={12} className="text-emerald-400" /> Tipo de Carta
                </label>
                <select
                  value={tipoCartaFiltro}
                  onChange={(e) => setTipoCartaFiltro(e.target.value)}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none"
                >
                  <option value="TODOS" className="bg-dark-bg">
                    Todos os Tipos
                  </option>
                  {tiposCartaDisponiveis.map((tipo) => (
                    <option key={tipo} value={tipo} className="bg-dark-bg">
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-gray-400 mb-1">
                  <Layers size={12} className="text-amber-400" /> Grupo
                </label>
                <select
                  value={grupoFiltro}
                  onChange={(e) => setGrupoFiltro(e.target.value)}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none"
                >
                  <option value="TODOS" className="bg-dark-bg">
                    Todos os Grupos
                  </option>
                  {gruposDisponiveis.map((grupo) => (
                    <option key={grupo} value={grupo} className="bg-dark-bg">
                      Grupo {grupo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div className="bg-black/50 border border-white/5 rounded-xl px-4 py-2.5">
                <span className="text-[11px] uppercase font-bold text-gray-400 block">
                  Vendas no Filtro
                </span>
                <strong className="text-base font-black text-white">
                  {somatoriasVendasFiltradas.quantidade}{' '}
                  {somatoriasVendasFiltradas.quantidade === 1 ? 'venda' : 'vendas'}
                </strong>
              </div>

              <div className="bg-black/50 border border-blue-500/15 rounded-xl px-4 py-2.5">
                <span className="text-[11px] uppercase font-bold text-gray-400 block">
                  Soma das Cartas
                </span>
                <strong className="text-base font-black text-blue-400">
                  {formatarValorParaExibicao(somatoriasVendasFiltradas.volumeCartas)}
                </strong>
              </div>

              <div className="bg-black/50 border border-emerald-500/15 rounded-xl px-4 py-2.5">
                <span className="text-[11px] uppercase font-bold text-gray-400 block">
                  Soma das Comissões
                </span>
                <strong className="text-base font-black text-emerald-400">
                  {formatarValorParaExibicao(somatoriasVendasFiltradas.comissaoTotal)}
                </strong>
              </div>

              <div className="bg-black/50 border border-white/5 rounded-xl px-4 py-2.5">
                <span className="text-[11px] uppercase font-bold text-gray-400 block">
                  Ticket Médio
                </span>
                <strong className="text-base font-black text-gray-200">
                  {formatarValorParaExibicao(somatoriasVendasFiltradas.ticketMedio)}
                </strong>
              </div>
            </div>
          </div>

          {carregando ? (
            <p className="text-orange-400 text-center py-10 animate-pulse">Carregando vendas...</p>
          ) : vendasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm font-medium">
                Nenhuma venda encontrada para os filtros selecionados.
              </p>
              {temFiltroVendaAtivo && (
                <button
                  type="button"
                  onClick={limparFiltrosVendas}
                  className="mt-3 text-xs text-red-400 hover:underline font-bold"
                >
                  Limpar filtros e exibir todas as vendas
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/60 text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Data / Competência</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tipo / Grupo / Cota</th>
                    <th className="px-4 py-3">Valor da Carta</th>
                    <th className="px-4 py-3">Comissão Total</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {vendasFiltradas.map((venda) => (
                    <tr key={venda.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                        <span className="text-gray-300 font-bold block">
                          {formatarDataVenda(venda.dataVenda)}
                        </span>
                        <span className="text-[10px] text-amber-400/90 font-semibold">
                          {obterRotuloNotaVenda(venda)}
                        </span>
                      </td>
                      <td
                        onClick={() => navigate(`/clientes/${venda.clienteId}`)}
                        className="px-4 py-3.5 font-bold text-white hover:text-red-400 cursor-pointer transition-colors"
                      >
                        {getNomeCliente(venda.clienteId)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-gray-200 block">{venda.tipoCarta}</span>
                        <span className="text-xs text-gray-500">
                          Gr: {venda.grupo} | Cota: {venda.cota}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-blue-400 whitespace-nowrap">
                        {formatarValorParaExibicao(venda.valorTotalCarta)}
                      </td>
                      <td className="px-4 py-3.5 font-black text-emerald-400 whitespace-nowrap">
                        {formatarValorParaExibicao(venda.valorComissaoTotal)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditarVenda(venda)}
                            title="Editar Venda"
                            className="text-orange-400 hover:text-orange-300 font-bold text-xs bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Edit2 size={13} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirVenda(venda)}
                            title="Excluir Venda"
                            className="text-red-400 hover:text-red-300 font-bold text-xs bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 size={13} /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          ABA 2: CONTROLE DE PARCELAS (>= 2ª PARCELA)
      ======================================================================== */}
      {abaAtiva === 'PARCELAS' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-lg animate-in fade-in duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="text-emerald-400" size={20} />
                Confirmação de Parcelas (A partir da 2ª)
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                A 1ª parcela já nasce confirmada no fechamento. Clique em{' '}
                <strong className="text-emerald-400">"Pago"</strong> quando o cliente quitar a
                mensalidade.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={mesParcelaFiltro}
                  onChange={(e) => setMesParcelaFiltro(e.target.value)}
                  className="bg-transparent text-xs text-white font-bold outline-none"
                >
                  <option value="TODOS" className="bg-dark-bg">
                    Todos os Fechamentos
                  </option>
                  {mesesParcelasDisponiveis.map((m) => (
                    <option key={m} value={m} className="bg-dark-bg">
                      Fechamento {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex bg-black/50 p-1 rounded-xl border border-white/10">
                {(
                  [
                    { id: 'PENDENTES', label: 'Aguardando' },
                    { id: 'CONFIRMADAS', label: 'Confirmadas' },
                    { id: 'TODAS', label: 'Todas' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFiltro(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      statusFiltro === tab.id
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {carregando ? (
            <p className="text-gray-400 text-center py-10 animate-pulse">Carregando parcelas...</p>
          ) : parcelasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm font-medium">
                Nenhuma parcela encontrada para os filtros selecionados.
              </p>
              {(mesParcelaFiltro !== 'TODOS' || statusFiltro !== 'TODAS' || buscaTexto) && (
                <button
                  type="button"
                  onClick={() => {
                    setMesParcelaFiltro('TODOS');
                    setStatusFiltro('TODAS');
                    setBuscaTexto('');
                  }}
                  className="mt-3 text-xs text-emerald-400 hover:underline font-bold"
                >
                  Limpar filtros e mostrar todas
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/60 text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Fechamento</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Contrato (Grupo / Cota)</th>
                    <th className="px-4 py-3">Parcela</th>
                    <th className="px-4 py-3">Comissão do Mês</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Status / Confirmação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {parcelasFiltradas.map((p) => {
                    const venda = getInfoVenda(p.vendaId);
                    const clienteIdReal = p.clienteId || venda?.clienteId || '';
                    const confirmada = isParcelaConfirmada(p);
                    const carregandoItem = processandoId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3.5 font-black text-white whitespace-nowrap">
                          {p.mesAnoReferencia}
                        </td>
                        <td
                          onClick={() => clienteIdReal && navigate(`/clientes/${clienteIdReal}`)}
                          className="px-4 py-3.5 font-bold text-white hover:text-red-400 cursor-pointer transition-colors"
                        >
                          {getNomeCliente(clienteIdReal)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400">
                          {venda ? (
                            <span>
                              <strong className="text-gray-300">{venda.tipoCarta}</strong> • Gr:{' '}
                              {venda.grupo} | Cota: {venda.cota}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="bg-white/10 text-gray-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                            {p.numeroParcela}ª parcela
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-black text-emerald-400 whitespace-nowrap">
                          {formatarValorParaExibicao(p.valorReceber)}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {confirmada ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                <CheckCircle2 size={13} /> Confirmada
                              </span>
                              <button
                                type="button"
                                disabled={carregandoItem}
                                onClick={() => handleConfirmarParcela(p, false)}
                                className="text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-colors"
                              >
                                <RotateCcw size={12} /> Desfazer
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={carregandoItem}
                              onClick={() => handleConfirmarParcela(p, true)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow"
                            >
                              <CheckCircle2 size={14} />
                              {carregandoItem ? 'Salvando...' : 'Pago'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          MODAL DO FORMULÁRIO DE NOVA VENDA / EDIÇÃO
      ======================================================================== */}
      {modalFormularioAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl my-auto">
            <button
              type="button"
              onClick={handleFecharModalFormulario}
              title="Fechar formulário"
              className="absolute -top-3 -right-3 z-10 bg-dark-card border border-white/15 hover:border-red-500 text-gray-300 hover:text-white p-2 rounded-full shadow-xl transition-colors"
            >
              <X size={18} />
            </button>

            <FormularioVenda
              onVendaSalva={() => {
                carregarDados();
                handleFecharModalFormulario();
              }}
              vendaEditando={vendaEmEdicao}
              onCancelarEdicao={handleFecharModalFormulario}
            />
          </div>
        </div>
      )}
    </div>
  );
}
