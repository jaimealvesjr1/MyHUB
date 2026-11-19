import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Target, Calendar, BarChart3, Clock, Edit2, Check,
  Gift, Briefcase, Coins, ArrowUpRight, Wallet,
  BellRing, CheckCircle2, X, SlidersHorizontal, TrendingUp
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../../config/firebase';
import {
  buscarVendasDoBanco,
  buscarParcelasDoBanco,
  alternarConfirmacaoParcela,
  isParcelaConfirmada
} from '../../services/vendasService';
import { buscarClientes } from '../../services/clienteService';
import {
  buscarOuInicializarPlanos,
  calcularCronogramaComissao,
  PlanoComissao
} from '../../utils/comissaoEngine';
import { Cliente, ParcelaComissao, VendaConsorcio } from '../../types/models';

interface ClienteComNiver extends Cliente {
  diasFaltando: number;
}

interface ProjecaoMesItem {
  mes: string;
  confirmado: number;
  aguardandoCliente: number;
}

interface MetricasPeriodo {
  volume: number;
  salario: number;
  comissaoGeral: number;
  vendas: number;
  clientes: number;
  maiorVolume: number;
  maiorSalario: number;
}

type Periodo = 'mensal' | 'trimestral' | 'semestral' | 'anual';

const METRICA_INICIAL: MetricasPeriodo = {
  volume: 0,
  salario: 0,
  comissaoGeral: 0,
  vendas: 0,
  clientes: 0,
  maiorVolume: 0,
  maiorSalario: 0,
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Corretor';

  const [carregando, setCarregando] = useState(true);
  const [periodoAtivo, setPeriodoAtivo] = useState<Periodo>('mensal');

  // Plano de comissão padrão para projeção do Dinheiro na Mesa
  const [planoPadrao, setPlanoPadrao] = useState<PlanoComissao | null>(null);

  // Fluxo de caixa e confirmações
  const [recebimentoProxConfirmado, setRecebimentoProxConfirmado] = useState(0);
  const [recebimentoProxAguardando, setRecebimentoProxAguardando] = useState(0);
  const [projecaoMensal, setProjecaoMensal] = useState<ProjecaoMesItem[]>([]);
  const [parcelasPendentes, setParcelasPendentes] = useState<ParcelaComissao[]>([]);
  const [totalParcelasPendentes, setTotalParcelasPendentes] = useState(0);
  const [confirmandoParcelaId, setConfirmandoParcelaId] = useState<string | null>(null);

  // Mapas auxiliares para exibição rápida
  const [vendasMap, setVendasMap] = useState<Record<string, VendaConsorcio>>({});
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [proximosAniversariantes, setProximosAniversariantes] = useState<ClienteComNiver[]>([]);
  const [followUpsPendentes, setFollowUpsPendentes] = useState(0);

  const [dinheiroNaMesa, setDinheiroNaMesa] = useState({
    total: 0,
    emProposta: 0,
    qtdProposta: 0,
    emFechamento: 0,
    qtdFechamento: 0,
  });

  const [acumulado, setAcumulado] = useState<Record<Periodo, MetricasPeriodo>>({
    mensal: { ...METRICA_INICIAL },
    trimestral: { ...METRICA_INICIAL },
    semestral: { ...METRICA_INICIAL },
    anual: { ...METRICA_INICIAL },
  });

  const [tempo, setTempo] = useState({
    mensal: { passados: 1, restantes: 1 },
    trimestral: { passados: 1, restantes: 1 },
    semestral: { passados: 1, restantes: 1 },
    anual: { passados: 1, restantes: 1 },
  });

  // Edição inline de metas
  const [isEditingMetas, setIsEditingMetas] = useState(false);
  const [metas, setMetas] = useState(() => {
    const saved = localStorage.getItem('metas_crm_ademicon');
    if (saved) return JSON.parse(saved);
    return {
      volume: { mensal: 1000000, trimestral: 3000000, semestral: 6000000, anual: 12000000 },
      salario: { mensal: 1153, trimestral: 3459, semestral: 6918, anual: 13836 }
    };
  });

  const salvarMetas = () => {
    localStorage.setItem('metas_crm_ademicon', JSON.stringify(metas));
    setIsEditingMetas(false);
    toast.success('Metas atualizadas!');
  };

  const formatarValor = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const moedaTextoParaNumero = (valorFormatado?: string) => {
    if (!valorFormatado) return 0;
    const limpo = String(valorFormatado).replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
  };

  const handleMudancaMeta = (
    categoria: 'volume' | 'salario',
    periodoSelecionado: Periodo,
    valorDigitado: string
  ) => {
    const apenasNumeros = valorDigitado.replace(/\D/g, '');
    const valorConvertido = Number(apenasNumeros) / 100;
    setMetas({
      ...metas,
      [categoria]: { ...metas[categoria], [periodoSelecionado]: valorConvertido }
    });
  };

  const parseDataSegura = (dataVenda: any) => {
    if (!dataVenda) return new Date(0);
    if (dataVenda instanceof Date) return dataVenda;
    if (dataVenda.seconds) return new Date(dataVenda.seconds * 1000);
    return new Date(dataVenda);
  };

  const processarDados = async () => {
    const [vendas, parcelas, clientes] = await Promise.all([
      buscarVendasDoBanco(),
      buscarParcelasDoBanco(),
      buscarClientes(),
    ]);

    const mapVendas: Record<string, VendaConsorcio> = {};
    vendas.forEach((v) => {
      if (v.id) mapVendas[v.id] = v;
    });
    setVendasMap(mapVendas);

    const mapClientes: Record<string, Cliente> = {};
    clientes.forEach((c) => {
      if (c.id) mapClientes[c.id] = c;
    });
    setClientesMap(mapClientes);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = new Date().toISOString().split('T')[0];

    // 0. Carrega o Plano de Comissão Padrão configurado pelo usuário
    if (user?.uid) {
      const qLeads = query(collection(db, 'leads'), where('responsavelId', '==', user.uid));
      const qSimulacoes = query(collection(db, 'simulacoes'), where('userId', '==', user.uid));

      const [snapLeads, snapSimulacoes] = await Promise.all([
        getDocs(qLeads),
        getDocs(qSimulacoes)
      ]);

      let emProposta = 0;
      let qtdProposta = 0;
      let emFechamento = 0;
      let qtdFechamento = 0;
      let pendentesFollow = 0;

      // Soma as simulações marcadas como "Proposta Enviada"
      snapSimulacoes.docs.forEach((docSnap) => {
        const sim = docSnap.data();
        if (sim.status === 'proposta_enviada') {
          emProposta += Number(sim.credito || 0);
          qtdProposta += 1;
        }
      });

      // Soma os leads que estão na coluna "Fechados" (aguardando registro oficial da venda)
      snapLeads.docs.forEach((docSnap) => {
        const lead = docSnap.data();

        if (lead.status === 'fechado') {
          emFechamento += moedaTextoParaNumero(lead.valorFechado || lead.valorNegociado);
          qtdFechamento += 1;
        }

        if (lead.status !== 'fechado') {
          const dataFollow = lead.proximoFollowUpData;
          const dataRefParado = lead.ultimoFollowUpData || lead.dataChegada;
          let paradoDias = 0;
          if (dataRefParado) {
            const dRef = new Date(`${dataRefParado}T00:00:00`);
            paradoDias = Math.floor((hoje.getTime() - dRef.getTime()) / (1000 * 60 * 60 * 24));
          }
          if ((dataFollow && dataFollow <= hojeISO) || paradoDias >= 3) {
            pendentesFollow++;
          }
        }
      });

      setFollowUpsPendentes(pendentesFollow);
      setDinheiroNaMesa({
        total: emProposta + emFechamento,
        emProposta,
        qtdProposta,
        emFechamento,
        qtdFechamento,
      });
    }

    // 1. Leads (Follow-ups e Dinheiro na Mesa com suporte a múltiplas propostas)
    if (user?.uid) {
      const qLeads = query(collection(db, 'leads'), where('responsavelId', '==', user.uid));
      const snapLeads = await getDocs(qLeads);

      let emProposta = 0;
      let qtdProposta = 0;
      let emFechamento = 0;
      let qtdFechamento = 0;
      let pendentesFollow = 0;

      snapLeads.docs.forEach((docSnap) => {
        const lead = docSnap.data();

        // Calcula o valor ativo considerando múltiplas propostas ou campo legado
        const propostasAtivas = Array.isArray(lead.propostas)
          ? lead.propostas.filter((p: any) => p.statusProposta === 'ATIVA')
          : [];
        const somaPropostasAtivas = propostasAtivas.reduce(
          (acc: number, p: any) => acc + moedaTextoParaNumero(p.valorCredito),
          0
        );

        if (lead.status === 'proposta') {
          const valorLead =
            propostasAtivas.length > 0
              ? somaPropostasAtivas
              : moedaTextoParaNumero(lead.valorNegociado);
          emProposta += valorLead;
          qtdProposta += 1;
        } else if (lead.status === 'fechado') {
          emFechamento += moedaTextoParaNumero(lead.valorFechado || lead.valorNegociado);
          qtdFechamento += 1;
        }

        if (lead.status !== 'fechado') {
          const dataFollow = lead.proximoFollowUpData;
          const dataRefParado = lead.ultimoFollowUpData || lead.dataChegada;
          let paradoDias = 0;
          if (dataRefParado) {
            const dRef = new Date(`${dataRefParado}T00:00:00`);
            paradoDias = Math.floor((hoje.getTime() - dRef.getTime()) / (1000 * 60 * 60 * 24));
          }
          if ((dataFollow && dataFollow <= hojeISO) || paradoDias >= 3) {
            pendentesFollow++;
          }
        }
      });

      setFollowUpsPendentes(pendentesFollow);
      setDinheiroNaMesa({
        total: emProposta + emFechamento,
        emProposta,
        qtdProposta,
        emFechamento,
        qtdFechamento,
      });
    }

    // 2. Cálculo de dias decorridos/restantes por período
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const trimestreAtual = Math.floor(mesAtual / 3);
    const semestreAtual = Math.floor(mesAtual / 6);

    const getDias = (inicio: Date, fim: Date) => {
      const passados = Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const restantes = Math.floor((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return { passados: Math.max(passados, 1), restantes: Math.max(restantes, 0) };
    };

    setTempo({
      mensal: getDias(new Date(anoAtual, mesAtual, 1), new Date(anoAtual, mesAtual + 1, 0)),
      trimestral: getDias(
        new Date(anoAtual, trimestreAtual * 3, 1),
        new Date(anoAtual, (trimestreAtual + 1) * 3, 0)
      ),
      semestral: getDias(
        new Date(anoAtual, semestreAtual * 6, 1),
        new Date(anoAtual, (semestreAtual + 1) * 6, 0)
      ),
      anual: getDias(new Date(anoAtual, 0, 1), new Date(anoAtual, 11, 31)),
    });

    // 3. Próximos Aniversariantes
    if (clientes.length > 0) {
      const niversCalculados = clientes
        .filter((cli) => cli.dataNascimento)
        .map((cli) => {
          const [, mes, dia] = cli.dataNascimento!.split('-');
          let dataNiverEsteAno = new Date(anoAtual, Number(mes) - 1, Number(dia));
          if (dataNiverEsteAno < hoje) dataNiverEsteAno.setFullYear(anoAtual + 1);
          const diffTime = dataNiverEsteAno.getTime() - hoje.getTime();
          return { ...cli, diasFaltando: Math.ceil(diffTime / (1000 * 60 * 60 * 24)) };
        })
        .sort((a, b) => a.diasFaltando - b.diasFaltando)
        .slice(0, 5);
      setProximosAniversariantes(niversCalculados);
    }

    // 4. Acumulado de Vendas por Período
    if (vendas.length > 0) {
      const criarBase = () => ({ ...METRICA_INICIAL, cliSet: new Set<string>() });
      const base = {
        mensal: criarBase(),
        trimestral: criarBase(),
        semestral: criarBase(),
        anual: criarBase(),
      };

      const acumular = (alvo: ReturnType<typeof criarBase>, v: VendaConsorcio, sal: number) => {
        alvo.volume += v.valorTotalCarta;
        alvo.salario += sal;
        alvo.comissaoGeral += v.valorComissaoTotal;
        alvo.vendas += 1;
        alvo.cliSet.add(v.clienteId);
        if (v.valorTotalCarta > alvo.maiorVolume) alvo.maiorVolume = v.valorTotalCarta;
        if (sal > alvo.maiorSalario) alvo.maiorSalario = sal;
      };

      vendas.forEach((v) => {
        const dataV = parseDataSegura(v.dataVenda);
        const salarioVenda = v.valorComissaoTotal / (v.qtdParcelasComissao || 13);

        if (dataV.getFullYear() === anoAtual) {
          acumular(base.anual, v, salarioVenda);
          if (Math.floor(dataV.getMonth() / 6) === semestreAtual) acumular(base.semestral, v, salarioVenda);
          if (Math.floor(dataV.getMonth() / 3) === trimestreAtual) acumular(base.trimestral, v, salarioVenda);
          if (dataV.getMonth() === mesAtual) acumular(base.mensal, v, salarioVenda);
        }
      });

      const finalizar = (b: ReturnType<typeof criarBase>): MetricasPeriodo => ({
        volume: b.volume,
        salario: b.salario,
        comissaoGeral: b.comissaoGeral,
        vendas: b.vendas,
        clientes: b.cliSet.size,
        maiorVolume: b.maiorVolume,
        maiorSalario: b.maiorSalario,
      });

      setAcumulado({
        mensal: finalizar(base.mensal),
        trimestral: finalizar(base.trimestral),
        semestral: finalizar(base.semestral),
        anual: finalizar(base.anual),
      });
    }

    // 5. Parcelas e Projeção de Caixa
    if (parcelas.length > 0) {
      const proxMesData = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
      const proxMesFormatado = `${String(proxMesData.getMonth() + 1).padStart(2, '0')}/${proxMesData.getFullYear()}`;

      let proxConfirmado = 0;
      let proxAguardando = 0;
      const fluxoAgrupado: Record<string, { confirmado: number; aguardandoCliente: number }> = {};

      parcelas.forEach((p) => {
        const confirmada = isParcelaConfirmada(p);

        if (!fluxoAgrupado[p.mesAnoReferencia]) {
          fluxoAgrupado[p.mesAnoReferencia] = { confirmado: 0, aguardandoCliente: 0 };
        }

        if (confirmada) {
          fluxoAgrupado[p.mesAnoReferencia].confirmado += p.valorReceber;
          if (p.mesAnoReferencia === proxMesFormatado) proxConfirmado += p.valorReceber;
        } else {
          fluxoAgrupado[p.mesAnoReferencia].aguardandoCliente += p.valorReceber;
          if (p.mesAnoReferencia === proxMesFormatado) proxAguardando += p.valorReceber;
        }
      });

      setRecebimentoProxConfirmado(proxConfirmado);
      setRecebimentoProxAguardando(proxAguardando);

      const fluxoArray: ProjecaoMesItem[] = Object.keys(fluxoAgrupado)
        .map((mes) => ({
          mes,
          confirmado: fluxoAgrupado[mes].confirmado,
          aguardandoCliente: fluxoAgrupado[mes].aguardandoCliente,
        }))
        .sort((a, b) => {
          const [mesA, anoA] = a.mes.split('/');
          const [mesB, anoB] = b.mes.split('/');
          return anoA !== anoB ? Number(anoA) - Number(anoB) : Number(mesA) - Number(mesB);
        })
        .filter((item) => {
          const [mesItem, anoItem] = item.mes.split('/');
          return (
            new Date(Number(anoItem), Number(mesItem) - 1, 1) >=
            new Date(hoje.getFullYear(), hoje.getMonth(), 1)
          );
        })
        .slice(0, 6);

      setProjecaoMensal(fluxoArray);

      const todasAguardando = parcelas.filter((p) => p.numeroParcela >= 2 && !isParcelaConfirmada(p));
      setTotalParcelasPendentes(todasAguardando.length);
      setParcelasPendentes(todasAguardando.slice(0, 6));
    } else {
      setParcelasPendentes([]);
      setTotalParcelasPendentes(0);
    }

    setCarregando(false);
  };

  useEffect(() => {
    processarDados();
  }, [user?.uid]);

  const handleConfirmarParcelaRapida = async (parcela: ParcelaComissao) => {
    if (!parcela.id) return;
    setConfirmandoParcelaId(parcela.id);
    try {
      await alternarConfirmacaoParcela(parcela.id, true);
      toast.success(`Parcela ${parcela.numeroParcela} confirmada (${parcela.mesAnoReferencia})!`);
      await processarDados();
    } catch {
      toast.error('Erro ao confirmar pagamento da parcela.');
    } finally {
      setConfirmandoParcelaId(null);
    }
  };

  // ============================================================================
  // CÁLCULO ASSERTIVO DE INCREMENTO MENSAL (GARANTIDO NO MÊS VS DINHEIRO NA MESA)
  // ============================================================================
  const hojeISORef = new Date().toISOString().split('T')[0];
  const simulacaoDinheiroNaMesa =
    planoPadrao && dinheiroNaMesa.total > 0
      ? calcularCronogramaComissao(dinheiroNaMesa.total, hojeISORef, planoPadrao)
      : null;

  const incrementoMensalGarantidoMes = acumulado.mensal.salario;
  const comissaoTotalGarantidaMes = acumulado.mensal.comissaoGeral;

  const comissaoTotalNaMesa = simulacaoDinheiroNaMesa?.valorComissaoTotal || 0;
  const incrementoMensalNaMesa = simulacaoDinheiroNaMesa?.parcelas?.[0]?.valorReceber || 0;
  // Componente limpo de Meta + Previsão + Edição Inline
  const RenderCardMeta = ({ titulo, categoria }: { titulo: string; categoria: 'volume' | 'salario' }) => {
    const atual = acumulado[periodoAtivo][categoria];
    const meta = metas[categoria][periodoAtivo];
    const { passados, restantes } = tempo[periodoAtivo];

    const mediaDiaria = atual / Math.max(passados, 1);
    const previsaoFechamento = atual + mediaDiaria * restantes;
    const faltaParaMeta = Math.max(meta - atual, 0);
    const atingido = meta > 0 ? (atual / meta) * 100 : 0;

    const ticketMedio =
      acumulado[periodoAtivo].vendas > 0 ? atual / acumulado[periodoAtivo].vendas : 0;
    const recorde =
      categoria === 'volume'
        ? acumulado[periodoAtivo].maiorVolume
        : acumulado[periodoAtivo].maiorSalario;

    const qtdTicket = faltaParaMeta > 0 && ticketMedio > 0 ? Math.ceil(faltaParaMeta / ticketMedio) : 0;
    const qtdRecorde = faltaParaMeta > 0 && recorde > 0 ? Math.ceil(faltaParaMeta / recorde) : 0;

    return (
      <div className="bg-black/25 p-5 rounded-2xl border border-white/5 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{titulo}</span>
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                atingido >= 100
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {atingido.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <p className="text-xl font-black text-white">{formatarValor(atual)}</p>
            {isEditingMetas ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Meta:</span>
                <input
                  type="text"
                  value={formatarValor(meta)}
                  onChange={(e) => handleMudancaMeta(categoria, periodoAtivo, e.target.value)}
                  className="w-32 bg-black/70 border border-red-500 rounded-lg px-2.5 py-1 text-sm font-bold text-white outline-none"
                />
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Meta: <strong className="text-gray-200">{formatarValor(meta)}</strong>
              </p>
            )}
          </div>

          <div className="w-full bg-gray-800 rounded-full h-2 mb-4 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${
                atingido >= 100 ? 'bg-emerald-500' : 'bg-red-600'
              }`}
              style={{ width: `${Math.min(atingido, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Previsão Fechamento</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {formatarValor(previsaoFechamento)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Falta p/ Meta</p>
              <p className="text-sm font-bold text-gray-300 mt-0.5">
                {faltaParaMeta === 0 ? 'Meta batida! 🎉' : formatarValor(faltaParaMeta)}
              </p>
            </div>
          </div>
        </div>

        {faltaParaMeta > 0 && ticketMedio > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 pt-2 border-t border-white/5">
            <span>
              No ticket médio: <strong className="text-white">{qtdTicket} vendas</strong>
            </span>
            <span>
              No recorde: <strong className="text-emerald-400">{qtdRecorde} vendas</strong>
            </span>
          </div>
        )}
      </div>
    );
  };

  const menuPeriodos: { id: Periodo; label: string }[] = [
    { id: 'mensal', label: 'Mensal' },
    { id: 'trimestral', label: 'Trimestral' },
    { id: 'semestral', label: 'Semestral' },
    { id: 'anual', label: 'Anual' },
  ];

  const dadosPeriodo = acumulado[periodoAtivo];
  const ticketMedioPeriodo =
    dadosPeriodo.vendas > 0 ? dadosPeriodo.volume / dadosPeriodo.vendas : 0;

  return (
    <div className="w-full p-4 md:p-8 animate-in fade-in duration-300">
      {/* 1. CABEÇALHO + ALERTA DE FOLLOW-UP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">
            Olá, <span className="text-red-600">{firstName}</span>!
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Resumo operacional, fechamentos e metas em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {followUpsPendentes > 0 && (
            <button
              onClick={() => navigate('/leads')}
              className="bg-red-600/15 border border-red-500/40 hover:border-red-400 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 transition-all text-left"
            >
              <BellRing size={18} className="text-red-400 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1">
                  Atenção nos Leads <ArrowUpRight size={12} />
                </p>
                <p className="text-sm font-black text-white">
                  {followUpsPendentes}{' '}
                  {followUpsPendentes === 1 ? 'follow-up pendente' : 'follow-ups pendentes'}
                </p>
              </div>
            </button>
          )}

          {/* Seletor de Período */}
          <div className="flex bg-dark-card border border-dark-border p-1 rounded-full">
            {menuPeriodos.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodoAtivo(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  periodoAtivo === p.id
                    ? 'bg-red-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. 4 KPIs ESSENCIAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-linear-to-br from-blue-600/15 to-dark-card border border-blue-500/30 p-5 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-blue-400 font-bold flex items-center gap-1.5">
            <Wallet size={15} /> Volume Vendido ({periodoAtivo})
          </p>
          <p className="text-2xl font-black text-white my-2">
            {carregando ? '-' : formatarValor(dadosPeriodo.volume)}
          </p>
          <p className="text-[11px] text-gray-400">
            {dadosPeriodo.vendas} {dadosPeriodo.vendas === 1 ? 'cota' : 'cotas'} • Ticket:{' '}
            <strong className="text-gray-200">{formatarValor(ticketMedioPeriodo)}</strong>
          </p>
        </div>

        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-gray-400 font-bold flex items-center gap-1.5">
            <Briefcase size={15} className="text-emerald-400" /> Salário Gerado ({periodoAtivo})
          </p>
          <p className="text-2xl font-black text-emerald-400 my-2">
            {carregando ? '-' : formatarValor(dadosPeriodo.salario)}
          </p>
          <p className="text-[11px] text-gray-400">
            Comissão total: <strong className="text-gray-200">{formatarValor(dadosPeriodo.comissaoGeral)}</strong>
          </p>
        </div>

        <div className="bg-emerald-600/10 border border-emerald-500/30 p-5 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
            <Clock size={15} /> Próximo Fechamento
          </p>
          <p className="text-2xl font-black text-emerald-400 my-2">
            {carregando ? '-' : formatarValor(recebimentoProxConfirmado)}
          </p>
          <p className="text-[11px] text-gray-300">
            Confirmado • <span className="text-amber-400">+{formatarValor(recebimentoProxAguardando)} prev.</span>
          </p>
        </div>

        <div
          onClick={() => navigate('/leads')}
          className="cursor-pointer bg-linear-to-br from-amber-500/15 to-dark-card border border-amber-500/30 hover:border-amber-400/60 p-5 rounded-2xl flex flex-col justify-between transition-all"
        >
          <p className="text-xs text-amber-400 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Coins size={15} /> Dinheiro na Mesa
            </span>
            <ArrowUpRight size={14} />
          </p>
          <p className="text-2xl font-black text-white my-2">
            {carregando ? '-' : formatarValor(dinheiroNaMesa.total)}
          </p>
          <p className="text-[11px] text-gray-400">
            {dinheiroNaMesa.qtdProposta} propostas enviadas • {dinheiroNaMesa.qtdFechamento} na coluna fechados
          </p>
        </div>
      </div>

      {/* 4. METAS & RITMO (COM EDIÇÃO INLINE) + PRÓXIMOS ANIVERSÁRIOS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="xl:col-span-2 bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="text-red-600" size={18} />
              Metas & Previsão ({periodoAtivo})
            </h2>

            {isEditingMetas ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingMetas(false)}
                  className="text-xs font-bold text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                >
                  <X size={13} /> Cancelar
                </button>
                <button
                  onClick={salvarMetas}
                  className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1"
                >
                  <Check size={13} /> Salvar Metas
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingMetas(true)}
                className="text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors"
              >
                <Target size={13} className="text-red-500" />
                <Edit2 size={12} /> Editar Metas
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RenderCardMeta titulo="Volume de Crédito" categoria="volume" />
            <RenderCardMeta titulo="Salário (Comissão Diluída)" categoria="salario" />
          </div>
        </div>

        <div className="xl:col-span-1 bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-5">
              <Gift className="text-red-500" size={18} />
              Próximos Aniversários
            </h2>

            {carregando ? (
              <p className="text-gray-500 text-sm">Buscando...</p>
            ) : proximosAniversariantes.length > 0 ? (
              <div className="space-y-2.5">
                {proximosAniversariantes.map((cli) => (
                  <div
                    key={cli.id}
                    onClick={() => cli.id && navigate(`/clientes/${cli.id}`)}
                    className="flex justify-between items-center bg-black/35 hover:bg-black/60 cursor-pointer px-3.5 py-2.5 rounded-xl border border-white/5 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-white truncate">{cli.nomeCompleto}</p>
                      <p className="text-[10px] text-gray-400">
                        {cli.dataNascimento?.split('-').reverse().join('/')}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                        cli.diasFaltando === 0
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-white/5 text-gray-300'
                      }`}
                    >
                      {cli.diasFaltando === 0 ? 'Hoje! 🎂' : `${cli.diasFaltando}d`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gift className="text-gray-600 mx-auto mb-2 opacity-50" size={28} />
                <p className="text-gray-500 text-xs">Nenhuma data de nascimento cadastrada.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2.5 PREVISÃO ASSERTIVA DE INCREMENTO MENSAL (GARANTIDO NO MÊS VS APENAS DINHEIRO NA MESA) */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-emerald-400" size={18} />
              Previsão Assertiva de Comissão Recorrente (Mês Atual)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Compare o que você já garantiu por mês no volume fechado com o potencial mensal das propostas na mesa.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/configuracoes')}
            className="text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <SlidersHorizontal size={14} className="text-amber-400" />
            <span>
              Plano Padrão: <strong className="text-white">{planoPadrao?.nome || 'Carregando...'}</strong>
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card A: Garantido com o volume deste mês */}
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full">
                  1. Garantido neste Mês
                </span>
                <p className="text-xs text-gray-300 mt-2">
                  Incremento mensal garantido pelo volume já fechado neste mês ({formatarValor(acumulado.mensal.volume)}):
                </p>
              </div>
            </div>

            <div className="my-4">
              <p className="text-3xl font-black text-emerald-400">
                {carregando ? '-' : `+${formatarValor(incrementoMensalGarantidoMes)}`}
                <span className="text-sm font-bold text-emerald-300/80"> /mês</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Comissão total garantida nas vendas do mês:{' '}
                <strong className="text-white">{formatarValor(comissaoTotalGarantidaMes)}</strong>
              </p>
            </div>

            <div className="pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs text-gray-300">
              <span>Vendas contabilizadas no mês:</span>
              <strong className="text-white">
                {acumulado.mensal.vendas} {acumulado.mensal.vendas === 1 ? 'cota' : 'cotas'}
              </strong>
            </div>
          </div>

          {/* Card B: Apenas Dinheiro na Mesa */}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full">
                  2. Dinheiro na Mesa (Em Negociação)
                </span>
                <p className="text-xs text-gray-300 mt-2">
                  Potencial mensal estimado apenas com os {formatarValor(dinheiroNaMesa.total)} ativos no funil (pelo plano padrão):
                </p>
              </div>
            </div>

            <div className="my-4">
              <p className="text-3xl font-black text-amber-400">
                {carregando ? '-' : `+${formatarValor(incrementoMensalNaMesa)}`}
                <span className="text-sm font-bold text-amber-300/80"> /mês</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Comissão total estimada nas propostas na mesa:{' '}
                <strong className="text-white">{formatarValor(comissaoTotalNaMesa)}</strong>
              </p>
            </div>

            <div className="pt-3 border-t border-amber-500/15 flex items-center justify-between text-xs text-gray-300">
              <span>Oportunidades na mesa:</span>
              <button
                type="button"
                onClick={() => navigate('/leads')}
                className="font-bold text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                {dinheiroNaMesa.qtdProposta + dinheiroNaMesa.qtdFechamento} tratativas ativas{' '}
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FLUXO DE RECEBIMENTOS (6 MESES) + CONFIRMAÇÃO RÁPIDA ("PAGO") */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="text-red-500" size={18} />
            Fluxo de Comissões (Próximos 6 Meses)
          </h2>
          <button
            onClick={() => navigate('/financeiro')}
            className="text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            Gerenciar vendas e parcelas →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {carregando ? (
            <div className="col-span-full text-center text-gray-500 py-4 text-sm">
              Calculando fluxo...
            </div>
          ) : projecaoMensal.length > 0 ? (
            projecaoMensal.map((item) => (
              <div
                key={item.mes}
                className="bg-black/35 border border-white/5 rounded-2xl p-3.5 flex flex-col items-center text-center"
              >
                <span className="text-[11px] font-bold text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full mb-2">
                  {item.mes}
                </span>
                <span className="text-base font-black text-emerald-400">
                  {formatarValor(item.confirmado)}
                </span>
                <span className="text-[10px] text-emerald-400/75 font-semibold">Confirmado</span>
                {item.aguardandoCliente > 0 && (
                  <span className="text-[10px] text-amber-400 mt-1.5 bg-amber-500/10 px-2 py-0.5 rounded">
                    +{formatarValor(item.aguardandoCliente)} prev.
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500 py-4 text-sm">
              Nenhuma comissão projetada para os próximos meses.
            </div>
          )}
        </div>

        {/* Atalho integrado de baixa de parcelas >= 2ª */}
        {parcelasPendentes.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Aguardando Pagamento do Cliente ({totalParcelasPendentes})
              </p>
              {totalParcelasPendentes > 6 && (
                <button
                  onClick={() => navigate('/financeiro')}
                  className="text-xs text-gray-400 hover:text-white underline"
                >
                  Ver todas as {totalParcelasPendentes} parcelas
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {parcelasPendentes.map((p) => {
                const venda = vendasMap[p.vendaId];
                const clienteId = p.clienteId || venda?.clienteId || '';
                const nomeCliente = clientesMap[clienteId]?.nomeCompleto || 'Cliente';

                return (
                  <div
                    key={p.id}
                    className="bg-black/40 border border-white/10 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p
                        onClick={() => clienteId && navigate(`/clientes/${clienteId}`)}
                        className="text-xs font-bold text-white truncate hover:text-red-400 cursor-pointer"
                      >
                        {nomeCliente}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {p.numeroParcela}ª parc. • {p.mesAnoReferencia} •{' '}
                        <strong className="text-emerald-400">{formatarValor(p.valorReceber)}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={confirmandoParcelaId === p.id}
                      onClick={() => handleConfirmarParcelaRapida(p)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      {confirmandoParcelaId === p.id ? '...' : 'Pago'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
