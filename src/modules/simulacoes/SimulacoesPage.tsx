import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  UserCheck,
  Users,
  UserPlus,
  Calendar,
  FileText,
  Layers,
  Filter
} from 'lucide-react';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/useAuthStore';

// Tipos de dados da página de Simulações
type TipoVinculo = 'avulso' | 'lead' | 'cliente';
type StatusSimulacao = 'simulacao' | 'proposta_enviada' | 'fechada' | 'descartada';

interface RegistroSimulacao {
  id?: string;
  userId: string;
  tipoVinculo: TipoVinculo;
  vinculoId?: string;
  vinculoNome: string;
  credito: number;
  categoria: string;
  prazo: number;
  parcelaCheia: number;
  parcelaReduzida: number;
  observacoes: string;
  status: StatusSimulacao;
  criadoEm: string; // ISO string para ordenação segura sem índice composto
}

interface OpcaoPessoa {
  id: string;
  nome: string;
  telefone?: string;
}

const CATEGORIAS_CONSORCIO = [
  'Imóvel',
  'Automóvel',
  'Pesados',
  'Motocicleta',
  'Serviços'
];

export default function SimulacoesPage() {
  const { user } = useAuthStore();

  // Listas carregadas do Firestore
  const [simulacoes, setSimulacoes] = useState<RegistroSimulacao[]>([]);
  const [leads, setLeads] = useState<OpcaoPessoa[]>([]);
  const [clientes, setClientes] = useState<OpcaoPessoa[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Estados do formulário de nova simulação
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>('avulso');
  const [vinculoId, setVinculoId] = useState<string>('');
  const [nomeAvulso, setNomeAvulso] = useState<string>('');
  const [credito, setCredito] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('Imóvel');
  const [prazo, setPrazo] = useState<string>('200');
  const [parcelaCheia, setParcelaCheia] = useState<string>('');
  const [parcelaReduzida, setParcelaReduzida] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [statusInicial, setStatusInicial] = useState<StatusSimulacao>('simulacao');

  // Estados de filtro do histórico
  const [busca, setBusca] = useState<string>('');
  const [filtroVinculo, setFiltroVinculo] = useState<'todos' | TipoVinculo>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Converte texto digitado (ex: "150.000,00" ou "150000") para número float seguro
  const parseMoedaInput = (valor: string): number => {
    if (!valor) return 0;
    const limpo = valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(limpo);
    return Number.isFinite(num) ? num : 0;
  };

  // Formata números para Real Brasileiro (R$)
  const formatarMoeda = (val: number) =>
    (Number.isFinite(val) ? val : 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  // Carrega Simulações, Leads e Clientes do usuário
  const carregarDados = async () => {
    if (!user?.uid) return;
    setCarregando(true);

    try {
      // 1. Busca histórico de simulações
      const qSimulacoes = query(
        collection(db, 'simulacoes'),
        where('userId', '==', user.uid)
      );
      const snapSim = await getDocs(qSimulacoes);
      const listaSim: RegistroSimulacao[] = snapSim.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RegistroSimulacao, 'id'>)
      }));

      // Ordena da mais recente para a mais antiga
      listaSim.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
      setSimulacoes(listaSim);

      // 2. Busca Leads para o seletor de vínculo
      try {
        const qLeads = query(collection(db, 'leads'), where('responsavelId', '==', user.uid));
        const snapLeads = await getDocs(qLeads);
        const listaLeads = snapLeads.docs
          .map((d) => ({
            id: d.id,
            nome: d.data().nome || d.data().clienteNome || 'Lead sem nome',
            telefone: d.data().telefone || ''
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setLeads(listaLeads);
      } catch (err) {
        console.warn('Aviso ao carregar leads para vínculo:', err);
      }

      // 3. Busca Clientes para o seletor de vínculo
      try {
        const qClientes = query(collection(db, 'clientes'), where('userId', '==', user.uid));
        const snapClientes = await getDocs(qClientes);
        const listaClientes = snapClientes.docs
          .map((d) => ({
            id: d.id,
            nome: d.data().nome || d.data().nomeCompleto || 'Cliente sem nome',
            telefone: d.data().telefone || ''
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setClientes(listaClientes);
      } catch (err) {
        console.warn('Aviso ao carregar clientes para vínculo:', err);
      }
    } catch (error) {
      console.error('Erro ao carregar simulações:', error);
      toast.error('Erro ao carregar histórico de simulações.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [user?.uid]);

  // Salva uma nova simulação no Firestore
  const handleSalvarSimulacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    const creditoNum = parseMoedaInput(credito);
    const prazoNum = parseInt(prazo, 10);
    const cheiaNum = parseMoedaInput(parcelaCheia);
    const reduzidaNum = parseMoedaInput(parcelaReduzida);

    if (creditoNum <= 0 || isNaN(prazoNum) || prazoNum <= 0 || cheiaNum <= 0) {
      return toast.error('Preencha Crédito, Prazo e Parcela Cheia com valores válidos.');
    }

    // Resolve o nome e o ID do vínculo selecionado
    let nomeFinal = 'Simulação Avulsa';
    let idFinal = '';

    if (tipoVinculo === 'lead') {
      const leadSelecionado = leads.find((l) => l.id === vinculoId);
      if (!leadSelecionado) {
        return toast.error('Selecione um Lead da lista ou mude para Simulação Avulsa.');
      }
      nomeFinal = leadSelecionado.nome;
      idFinal = leadSelecionado.id;
    } else if (tipoVinculo === 'cliente') {
      const clienteSelecionado = clientes.find((c) => c.id === vinculoId);
      if (!clienteSelecionado) {
        return toast.error('Selecione um Cliente da lista ou mude para Simulação Avulsa.');
      }
      nomeFinal = clienteSelecionado.nome;
      idFinal = clienteSelecionado.id;
    } else if (nomeAvulso.trim()) {
      nomeFinal = nomeAvulso.trim();
    }

    setSalvando(true);
    try {
      const novaSimulacao: Omit<RegistroSimulacao, 'id'> = {
        userId: user.uid,
        tipoVinculo,
        vinculoId: idFinal,
        vinculoNome: nomeFinal,
        credito: creditoNum,
        categoria,
        prazo: prazoNum,
        parcelaCheia: cheiaNum,
        parcelaReduzida: reduzidaNum,
        observacoes: observacoes.trim(),
        status: statusInicial,
        criadoEm: new Date().toISOString()
      };

      await addDoc(collection(db, 'simulacoes'), novaSimulacao);

      // Limpa os campos numéricos mantendo a categoria e o vínculo caso queira lançar outro cenário
      setCredito('');
      setParcelaCheia('');
      setParcelaReduzida('');
      setObservacoes('');

      toast.success('Simulação registrada no histórico!');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar simulação:', error);
      toast.error('Erro ao registrar simulação.');
    } finally {
      setSalvando(false);
    }
  };

  // Atualiza o status direto no card (ex: de Simulação para Proposta Enviada)
  const handleAlterarStatus = async (id: string | undefined, novoStatus: StatusSimulacao) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'simulacoes', id), { status: novoStatus });
      setSimulacoes((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: novoStatus } : item))
      );
      toast.success('Status atualizado!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Não foi possível atualizar o status.');
    }
  };

  // Exclui uma simulação do histórico
  const handleExcluirSimulacao = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Deseja remover esta simulação do histórico?')) return;

    try {
      await deleteDoc(doc(db, 'simulacoes', id));
      setSimulacoes((prev) => prev.filter((item) => item.id !== id));
      toast.success('Simulação excluída.');
    } catch (error) {
      console.error('Erro ao excluir simulação:', error);
      toast.error('Erro ao excluir simulação.');
    }
  };

  // Preenche o formulário com os dados de uma simulação existente para criar variação
  const handleDuplicarParaFormulario = (sim: RegistroSimulacao) => {
    setTipoVinculo(sim.tipoVinculo);
    setVinculoId(sim.vinculoId || '');
    setNomeAvulso(sim.tipoVinculo === 'avulso' ? sim.vinculoNome : '');
    setCredito(sim.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setCategoria(sim.categoria);
    setPrazo(String(sim.prazo));
    setParcelaCheia(sim.parcelaCheia.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setParcelaReduzida(
      sim.parcelaReduzida > 0
        ? sim.parcelaReduzida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : ''
    );
    setObservacoes(sim.observacoes || '');
    setStatusInicial(sim.status);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success('Dados carregados no formulário para edição/novo cenário!');
  };

  // Copia texto formatado pronto para colar no WhatsApp
  const handleCopiarWhatsApp = (sim: RegistroSimulacao) => {
    const linhas = [
      `📊 *SIMULAÇÃO DE CONSÓRCIO - ${sim.categoria.toUpperCase()}*`,
      sim.vinculoNome && sim.vinculoNome !== 'Simulação Avulsa'
        ? `👤 *Cliente:* ${sim.vinculoNome}`
        : null,
      `💰 *Crédito:* ${formatarMoeda(sim.credito)}`,
      `📅 *Prazo:* ${sim.prazo} meses`,
      `💳 *Parcela Cheia:* ${formatarMoeda(sim.parcelaCheia)}`,
      sim.parcelaReduzida > 0
        ? `✨ *Parcela Reduzida:* ${formatarMoeda(sim.parcelaReduzida)}`
        : null,
      sim.observacoes ? `📝 *Obs:* ${sim.observacoes}` : null
    ].filter(Boolean);

    navigator.clipboard.writeText(linhas.join('\n'));
    setCopiadoId(sim.id || null);
    toast.success('Resumo copiado para colar no WhatsApp!');
    setTimeout(() => setCopiadoId(null), 2500);
  };

  // Filtra o histórico conforme busca e filtros selecionados
  const simulacoesFiltradas = useMemo(() => {
    return simulacoes.filter((sim) => {
      const bateVinculo = filtroVinculo === 'todos' || sim.tipoVinculo === filtroVinculo;
      const bateCategoria = filtroCategoria === 'todas' || sim.categoria === filtroCategoria;
      const termo = busca.toLowerCase().trim();
      const bateBusca =
        !termo ||
        sim.vinculoNome.toLowerCase().includes(termo) ||
        sim.categoria.toLowerCase().includes(termo) ||
        (sim.observacoes || '').toLowerCase().includes(termo) ||
        String(sim.credito).includes(termo);

      return bateVinculo && bateCategoria && bateBusca;
    });
  }, [simulacoes, filtroVinculo, filtroCategoria, busca]);

  // Métricas rápidas do histórico filtrado
  const resumoMetricas = useMemo(() => {
    const total = simulacoes.length;
    const propostasAtivas = simulacoes.filter((s) => s.status === 'proposta_enviada');
    const volumePropostas = propostasAtivas.reduce((acc, cur) => acc + (cur.credito || 0), 0);
    return {
      total,
      qtdPropostas: propostasAtivas.length,
      volumePropostas
    };
  }, [simulacoes]);

  const formatarDataCurta = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full p-4 md:p-8 animate-in fade-in duration-300">
      {/* CABEÇALHO PRINCIPAL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Calculator className="text-red-600" size={30} /> Central de{' '}
            <span className="text-red-600">Simulações</span>
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Registre cenários de crédito, compare parcelas cheias e reduzidas e mantenha todo o histórico vinculado a Leads ou Clientes.
          </p>
        </div>

        {/* Mini Resumo no Topo */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-dark-card border border-dark-border px-4 py-2.5 rounded-xl">
            <p className="text-[11px] text-gray-400 uppercase font-bold">Total Registrado</p>
            <p className="text-lg font-black text-white">{resumoMetricas.total} simulações</p>
          </div>
          <div className="bg-dark-card border border-amber-500/30 px-4 py-2.5 rounded-xl">
            <p className="text-[11px] text-amber-400 uppercase font-bold">
              Propostas Enviadas ({resumoMetricas.qtdPropostas})
            </p>
            <p className="text-lg font-black text-white">
              {formatarMoeda(resumoMetricas.volumePropostas)}
            </p>
          </div>
        </div>
      </div>

      {/* GRID PRINCIPAL: FORMULÁRIO À ESQUERDA (1/3) + HISTÓRICO À DIREITA (2/3) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA: NOVA SIMULAÇÃO */}
        <div className="xl:col-span-4 bg-dark-card border border-dark-border p-6 rounded-2xl shadow-lg h-fit">
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Plus className="text-red-500" size={20} /> Nova Simulação
          </h2>

          <form onSubmit={handleSalvarSimulacao} className="flex flex-col gap-4">
            {/* SELETOR DE VÍNCULO (AVULSO, LEAD OU CLIENTE) */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2">
                Vincular Simulação a:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTipoVinculo('avulso');
                    setVinculoId('');
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    tipoVinculo === 'avulso'
                      ? 'bg-red-600/20 border-red-500 text-white'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <UserPlus size={14} /> Avulso
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTipoVinculo('lead');
                    setVinculoId('');
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    tipoVinculo === 'lead'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <Users size={14} /> Lead
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTipoVinculo('cliente');
                    setVinculoId('');
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    tipoVinculo === 'cliente'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <UserCheck size={14} /> Cliente
                </button>
              </div>
            </div>

            {/* CAMPO CONDICIONAL DO VÍNCULO */}
            {tipoVinculo === 'avulso' && (
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  Nome / Referência (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: João WhatsApp (deixe vazio p/ Avulso)"
                  value={nomeAvulso}
                  onChange={(e) => setNomeAvulso(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-red-500"
                />
              </div>
            )}

            {tipoVinculo === 'lead' && (
              <div>
                <label className="block text-xs font-bold text-amber-400 mb-1">
                  Selecione o Lead *
                </label>
                <select
                  required
                  value={vinculoId}
                  onChange={(e) => setVinculoId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-amber-500/40 rounded-xl text-sm text-white outline-none focus:border-amber-400"
                >
                  <option value="" className="bg-dark-bg">
                    -- Escolha um Lead ({leads.length}) --
                  </option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id} className="bg-dark-bg">
                      {lead.nome} {lead.telefone ? `(${lead.telefone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tipoVinculo === 'cliente' && (
              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1">
                  Selecione o Cliente *
                </label>
                <select
                  required
                  value={vinculoId}
                  onChange={(e) => setVinculoId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-emerald-500/40 rounded-xl text-sm text-white outline-none focus:border-emerald-400"
                >
                  <option value="" className="bg-dark-bg">
                    -- Escolha um Cliente ({clientes.length}) --
                  </option>
                  {clientes.map((cli) => (
                    <option key={cli.id} value={cli.id} className="bg-dark-bg">
                      {cli.nome} {cli.telefone ? `(${cli.telefone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CRÉDITO E CATEGORIA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  Valor do Crédito (R$) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 200.000,00"
                  value={credito}
                  onChange={(e) => setCredito(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  Categoria *
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-red-500"
                >
                  {CATEGORIAS_CONSORCIO.map((cat) => (
                    <option key={cat} value={cat} className="bg-dark-bg">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* PRAZO E STATUS */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  Prazo (Meses) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="360"
                  required
                  placeholder="Ex: 200"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  Situação
                </label>
                <select
                  value={statusInicial}
                  onChange={(e) => setStatusInicial(e.target.value as StatusSimulacao)}
                  className="w-full px-3 py-2.5 bg-black/60 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-red-500"
                >
                  <option value="simulacao" className="bg-dark-bg">Simulação</option>
                  <option value="proposta_enviada" className="bg-dark-bg">Proposta Enviada</option>
                  <option value="fechada" className="bg-dark-bg">Fechada</option>
                  <option value="descartada" className="bg-dark-bg">Descartada</option>
                </select>
              </div>
            </div>

            {/* PARCELA CHEIA E PARCELA REDUZIDA */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  Parcela Cheia (R$) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1.250,00"
                  value={parcelaCheia}
                  onChange={(e) => setParcelaCheia(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1">
                  Parcela Reduzida (R$)
                </label>
                <input
                  type="text"
                  placeholder="Opcional (Ex: 680,00)"
                  value={parcelaReduzida}
                  onChange={(e) => setParcelaReduzida(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-emerald-500/25 rounded-xl text-sm text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* OBSERVAÇÕES */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">
                Observações / Condições
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Grupo 1042, lance embutido 30%, meia parcela até contemplação..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-red-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 mt-1"
            >
              <Plus size={18} />
              {salvando ? 'Registrando...' : 'Registrar Simulação'}
            </button>
          </form>
        </div>

        {/* COLUNA DIREITA: HISTÓRICO COMPLETO DE SIMULAÇÕES */}
        <div className="xl:col-span-8 bg-dark-card border border-dark-border p-6 rounded-2xl shadow-lg h-fit">
          {/* BARRA DE BUSCA E FILTROS */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                placeholder="Buscar por cliente, lead, crédito ou observação..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-red-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-3">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={filtroVinculo}
                  onChange={(e) => setFiltroVinculo(e.target.value as 'todos' | TipoVinculo)}
                  className="bg-transparent py-2.5 text-xs font-bold text-gray-200 outline-none"
                >
                  <option value="todos" className="bg-dark-bg">Todos os Vínculos</option>
                  <option value="lead" className="bg-dark-bg">Apenas Leads</option>
                  <option value="cliente" className="bg-dark-bg">Apenas Clientes</option>
                  <option value="avulso" className="bg-dark-bg">Apenas Avulsos</option>
                </select>
              </div>

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-200 outline-none"
              >
                <option value="todas" className="bg-dark-bg">Todas Categorias</option>
                {CATEGORIAS_CONSORCIO.map((cat) => (
                  <option key={cat} value={cat} className="bg-dark-bg">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* LISTAGEM DE CARDS DO HISTÓRICO */}
          {carregando ? (
            <p className="text-gray-400 text-center py-12 animate-pulse">
              Carregando histórico de simulações...
            </p>
          ) : simulacoesFiltradas.length === 0 ? (
            <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl">
              <Calculator className="mx-auto text-gray-600 mb-3" size={36} />
              <p className="text-gray-300 font-bold">Nenhuma simulação encontrada</p>
              <p className="text-xs text-gray-500 mt-1">
                Preencha o formulário ao lado para registrar sua primeira simulação.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulacoesFiltradas.map((sim) => {
                const badgeVinculo =
                  sim.tipoVinculo === 'cliente'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : sim.tipoVinculo === 'lead'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-white/10 text-gray-300 border-white/15';

                const labelVinculo =
                  sim.tipoVinculo === 'cliente'
                    ? 'Cliente'
                    : sim.tipoVinculo === 'lead'
                    ? 'Lead'
                    : 'Avulso';

                return (
                  <div
                    key={sim.id}
                    className="bg-black/40 border border-white/10 hover:border-red-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all"
                  >
                    {/* Topo do Card: Pessoa vinculada + Status */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span
                            className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border mb-1.5 ${badgeVinculo}`}
                          >
                            {labelVinculo}
                          </span>
                          <h3 className="text-base font-bold text-white leading-tight">
                            {sim.vinculoNome}
                          </h3>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {formatarDataCurta(sim.criadoEm)}
                          </p>
                        </div>

                        {/* Seletor rápido de status */}
                        <select
                          value={sim.status}
                          onChange={(e) =>
                            handleAlterarStatus(sim.id, e.target.value as StatusSimulacao)
                          }
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border outline-none cursor-pointer ${
                            sim.status === 'fechada'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : sim.status === 'proposta_enviada'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : sim.status === 'descartada'
                              ? 'bg-red-500/15 text-red-400 border-red-500/25'
                              : 'bg-white/5 text-gray-300 border-white/10'
                          }`}
                        >
                          <option value="simulacao" className="bg-dark-bg">Simulação</option>
                          <option value="proposta_enviada" className="bg-dark-bg">Proposta Enviada</option>
                          <option value="fechada" className="bg-dark-bg">Fechada</option>
                          <option value="descartada" className="bg-dark-bg">Descartada</option>
                        </select>
                      </div>

                      {/* Destaque do Crédito + Categoria + Prazo */}
                      <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 my-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400">
                            <Layers size={13} /> {sim.categoria}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-300">
                            <Calendar size={13} /> {sim.prazo} meses
                          </span>
                        </div>

                        <p className="text-2xl font-black text-white">
                          {formatarMoeda(sim.credito)}
                        </p>

                        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-white/5 text-xs">
                          <div>
                            <span className="text-gray-400 block text-[11px]">Parcela Cheia</span>
                            <strong className="text-white text-sm">
                              {formatarMoeda(sim.parcelaCheia)}
                            </strong>
                          </div>

                          <div>
                            <span className="text-gray-400 block text-[11px]">Parcela Reduzida</span>
                            {sim.parcelaReduzida > 0 ? (
                              <strong className="text-emerald-400 text-sm">
                                {formatarMoeda(sim.parcelaReduzida)}
                              </strong>
                            ) : (
                              <span className="text-gray-600 text-xs">Não aplicada</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Observações */}
                      {sim.observacoes && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-300 bg-white/3 p-2.5 rounded-lg border border-white/5">
                          <FileText size={14} className="text-gray-500 shrink-0 mt-0.5" />
                          <p className="leading-relaxed">{sim.observacoes}</p>
                        </div>
                      )}
                    </div>

                    {/* Rodapé com Ações Rápidas */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopiarWhatsApp(sim)}
                        className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold py-2 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {copiadoId === sim.id ? (
                          <>
                            <Check size={14} /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Copiar WhatsApp
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicarParaFormulario(sim)}
                        title="Usar como base para novo cenário"
                        className="bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-bold py-2 px-3 rounded-lg transition-colors"
                      >
                        Clonar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExcluirSimulacao(sim.id)}
                        title="Excluir simulação"
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
