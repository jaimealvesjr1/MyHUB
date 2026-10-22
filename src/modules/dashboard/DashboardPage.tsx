// Arquivo: src/modules/dashboard/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { TrendingUp, Target, Award, Calendar, BarChart3, Users, Crown, Zap, Clock, Edit2, Check, Gift, Briefcase } from 'lucide-react';
import { buscarVendasDoBanco, buscarParcelasDoBanco } from '../../services/vendasService';
import { buscarClientes } from '../../services/clienteService';
import { Cliente } from '../../types/models';

interface DadosPreditivos {
  atual: number;
  meta: number;
  mediaDiariaAtual: number;
  previsaoFechamento: number;
  faltaParaMeta: number;
}

interface ClienteComNiver extends Cliente {
  diasFaltando: number;
}

type Periodo = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Corretor';

  const [carregando, setCarregando] = useState(true);
  const [periodoAtivo, setPeriodoAtivo] = useState<Periodo>('mensal');
  
  const [maiorVenda, setMaiorVenda] = useState(0);
  const [recebimentoProximoMes, setRecebimentoProximoMes] = useState(0);
  const [projecaoMensal, setProjecaoMensal] = useState<{mes: string, valor: number}[]>([]);
  const [proximosAniversariantes, setProximosAniversariantes] = useState<ClienteComNiver[]>([]);

  const [acumulado, setAcumulado] = useState({
    mensal: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, clientes: 0, maiorVolume: 0, menorVolume: 0, maiorSalario: 0, menorSalario: 0 },
    trimestral: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, clientes: 0, maiorVolume: 0, menorVolume: 0, maiorSalario: 0, menorSalario: 0 },
    semestral: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, clientes: 0, maiorVolume: 0, menorVolume: 0, maiorSalario: 0, menorSalario: 0 },
    anual: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, clientes: 0, maiorVolume: 0, menorVolume: 0, maiorSalario: 0, menorSalario: 0 },
  });

  const [tempo, setTempo] = useState({
    mensal: { passados: 1, restantes: 1 },
    trimestral: { passados: 1, restantes: 1 },
    semestral: { passados: 1, restantes: 1 },
    anual: { passados: 1, restantes: 1 },
  });

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
  };

  const formatarValor = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleMudancaMeta = (categoria: 'volume' | 'salario', periodoSelecionado: Periodo, valorDigitado: string) => {
    const apenasNumeros = valorDigitado.replace(/\D/g, '');
    const valorConvertido = Number(apenasNumeros) / 100;
    setMetas({...metas, [categoria]: { ...metas[categoria], [periodoSelecionado]: valorConvertido }});
  };

  const parseDataSegura = (dataVenda: any) => {
    if (!dataVenda) return new Date(0);
    if (dataVenda instanceof Date) return dataVenda;
    if (dataVenda.seconds) return new Date(dataVenda.seconds * 1000);
    return new Date(dataVenda);
  };

  const calcularPreditivo = (atual: number, meta: number, diasPassados: number, diasRestantes: number): DadosPreditivos => {
    const passados = Math.max(diasPassados, 1); 
    const mediaDiariaAtual = atual / passados;
    const previsaoFechamento = atual + (mediaDiariaAtual * diasRestantes);
    const faltaParaMeta = Math.max(meta - atual, 0);
    return { atual, meta, mediaDiariaAtual, previsaoFechamento, faltaParaMeta };
  };

  useEffect(() => {
    const processarDados = async () => {
      const [vendas, parcelas, clientes] = await Promise.all([buscarVendasDoBanco(), buscarParcelasDoBanco(), buscarClientes()]);
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); 
      
      const anoAtual = hoje.getFullYear();
      const mesAtual = hoje.getMonth(); 
      const trimestreAtual = Math.floor(mesAtual / 3);
      const semestreAtual = Math.floor(mesAtual / 6);
      
      const inicioTrimestre = new Date(anoAtual, trimestreAtual * 3, 1);
      const fimTrimestre = new Date(anoAtual, (trimestreAtual + 1) * 3, 0);
      const inicioSemestre = new Date(anoAtual, semestreAtual * 6, 1);
      const fimSemestre = new Date(anoAtual, (semestreAtual + 1) * 6, 0);
      
      const getDias = (inicio: Date, fim: Date) => {
        const passados = Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const restantes = Math.floor((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return { passados: Math.max(passados, 1), restantes: Math.max(restantes, 0) };
      };

      setTempo({
        mensal: getDias(new Date(anoAtual, mesAtual, 1), new Date(anoAtual, mesAtual + 1, 0)),
        trimestral: getDias(inicioTrimestre, fimTrimestre),
        semestral: getDias(inicioSemestre, fimSemestre),
        anual: getDias(new Date(anoAtual, 0, 1), new Date(anoAtual, 11, 31)),
      });

      if (clientes.length > 0) {
        const niversCalculados = clientes
          .filter(cli => cli.dataNascimento)
          .map(cli => {
            const [ano, mes, dia] = cli.dataNascimento!.split('-');
            let dataNiverEsteAno = new Date(anoAtual, Number(mes) - 1, Number(dia));
            if (dataNiverEsteAno < hoje) dataNiverEsteAno.setFullYear(anoAtual + 1);
            const diffTime = dataNiverEsteAno.getTime() - hoje.getTime();
            return { ...cli, diasFaltando: Math.ceil(diffTime / (1000 * 60 * 60 * 24)) };
          })
          .sort((a, b) => a.diasFaltando - b.diasFaltando)
          .slice(0, 5); 
        setProximosAniversariantes(niversCalculados);
      }

      if (vendas.length > 0) {
        setMaiorVenda(Math.max(...vendas.map(v => v.valorTotalCarta)));

        const base = {
          mensal: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, cliSet: new Set(), maiorVolume: 0, menorVolume: Infinity, maiorSalario: 0, menorSalario: Infinity },
          trimestral: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, cliSet: new Set(), maiorVolume: 0, menorVolume: Infinity, maiorSalario: 0, menorSalario: Infinity },
          semestral: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, cliSet: new Set(), maiorVolume: 0, menorVolume: Infinity, maiorSalario: 0, menorSalario: Infinity },
          anual: { volume: 0, salario: 0, comissaoGeral: 0, vendas: 0, cliSet: new Set(), maiorVolume: 0, menorVolume: Infinity, maiorSalario: 0, menorSalario: Infinity },
        };

        const registrarMaxMin = (periodo: any, vol: number, sal: number) => {
          if (vol > periodo.maiorVolume) periodo.maiorVolume = vol;
          if (vol < periodo.menorVolume) periodo.menorVolume = vol;
          if (sal > periodo.maiorSalario) periodo.maiorSalario = sal;
          if (sal < periodo.menorSalario) periodo.menorSalario = sal;
        };

        vendas.forEach(v => {
          const dataV = parseDataSegura(v.dataVenda);
          const salarioVenda = v.valorComissaoTotal / 13;

          if (dataV.getFullYear() === anoAtual) {
            base.anual.volume += v.valorTotalCarta;
            base.anual.salario += salarioVenda;
            base.anual.comissaoGeral += v.valorComissaoTotal;
            base.anual.vendas++;
            base.anual.cliSet.add(v.clienteId);
            registrarMaxMin(base.anual, v.valorTotalCarta, salarioVenda);

            if (Math.floor(dataV.getMonth() / 6) === semestreAtual) {
              base.semestral.volume += v.valorTotalCarta;
              base.semestral.salario += salarioVenda;
              base.semestral.comissaoGeral += v.valorComissaoTotal;
              base.semestral.vendas++;
              base.semestral.cliSet.add(v.clienteId);
              registrarMaxMin(base.semestral, v.valorTotalCarta, salarioVenda);
            }

            if (Math.floor(dataV.getMonth() / 3) === trimestreAtual) {
              base.trimestral.volume += v.valorTotalCarta;
              base.trimestral.salario += salarioVenda;
              base.trimestral.comissaoGeral += v.valorComissaoTotal;
              base.trimestral.vendas++;
              base.trimestral.cliSet.add(v.clienteId);
              registrarMaxMin(base.trimestral, v.valorTotalCarta, salarioVenda);
            }

            if (dataV.getMonth() === mesAtual) {
              base.mensal.volume += v.valorTotalCarta;
              base.mensal.salario += salarioVenda;
              base.mensal.comissaoGeral += v.valorComissaoTotal;
              base.mensal.vendas++;
              base.mensal.cliSet.add(v.clienteId);
              registrarMaxMin(base.mensal, v.valorTotalCarta, salarioVenda);
            }
          }
        });

        const sanitizar = (p: any) => ({
          ...p,
          clientes: p.cliSet.size,
          menorVolume: p.menorVolume === Infinity ? 0 : p.menorVolume,
          menorSalario: p.menorSalario === Infinity ? 0 : p.menorSalario
        });

        setAcumulado({
          mensal: sanitizar(base.mensal),
          trimestral: sanitizar(base.trimestral),
          semestral: sanitizar(base.semestral),
          anual: sanitizar(base.anual),
        });
      }

      if (parcelas.length > 0) {
        const proxMesData = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
        const proxMesFormatado = `${String(proxMesData.getMonth() + 1).padStart(2, '0')}/${proxMesData.getFullYear()}`;
        
        let recebimentoProx = 0;
        const fluxoAgrupado: Record<string, number> = {};
        
        parcelas.forEach(p => {
          if (p.status === 'PENDENTE') {
            fluxoAgrupado[p.mesAnoReferencia] = (fluxoAgrupado[p.mesAnoReferencia] || 0) + p.valorReceber;
            if (p.mesAnoReferencia === proxMesFormatado) recebimentoProx += p.valorReceber;
          }
        });

        setRecebimentoProximoMes(recebimentoProx);

        const fluxoArray = Object.keys(fluxoAgrupado)
          .map(mes => ({ mes, valor: fluxoAgrupado[mes] }))
          .sort((a, b) => {
            const [mesA, anoA] = a.mes.split('/');
            const [mesB, anoB] = b.mes.split('/');
            return (anoA !== anoB) ? Number(anoA) - Number(anoB) : Number(mesA) - Number(mesB);
          })
          .filter(item => {
            const [mesItem, anoItem] = item.mes.split('/');
            return new Date(Number(anoItem), Number(mesItem) - 1, 1) >= new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          }).slice(0, 6); 
          
        setProjecaoMensal(fluxoArray);
      }
      setCarregando(false);
    };

    processarDados();
  }, []);

  const renderInputMeta = (categoria: 'volume' | 'salario', periodoSelecionado: Periodo) => (
    <input 
      type="text" 
      value={formatarValor(metas[categoria][periodoSelecionado])}
      onChange={(e) => handleMudancaMeta(categoria, periodoSelecionado, e.target.value)}
      className="block w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-red-500"
    />
  );

  const RenderCardPreditivo = ({ titulo, categoria }: { titulo: string, categoria: 'volume' | 'salario' }) => {
    // Cálculo do período atual normal
    const dados = calcularPreditivo(acumulado[periodoAtivo][categoria], metas[categoria][periodoAtivo], tempo[periodoAtivo].passados, tempo[periodoAtivo].restantes);
    const atingido = dados.meta > 0 ? (dados.atual / dados.meta) * 100 : 0;
    
    // NOVO: Lógica Proporcional Exata (Cota Ideal)
    // Definimos o próximo período e por quanto temos que dividir essa meta maior
    // Ex: Mensal -> Trimestral (divide por 3 meses)
    const proximoPeriodoMap: Record<Periodo, { id: Periodo, nome: string, divisor: number } | null> = {
      mensal: { id: 'trimestral', nome: 'Trimestral', divisor: 3 },
      trimestral: { id: 'semestral', nome: 'Semestral', divisor: 2 },
      semestral: { id: 'anual', nome: 'Anual', divisor: 2 },
      anual: null
    };
    
    const configProx = proximoPeriodoMap[periodoAtivo];
    
    let atingidoProxProporcional = 0;
    let faltaParaMetaProxProporcional = 0;
    let metaProporcional = 0;
    
    if (configProx) {
      const atualNestePeriodo = acumulado[periodoAtivo][categoria]; // Ex: vendi 800k neste mês
      const metaTotalDoProximoPeriodo = metas[categoria][configProx.id]; // Ex: Meta do trimestre é 3.6M
      
      // A meta que EU TENHO QUE FAZER AGORA (Cota Ideal)
      metaProporcional = metaTotalDoProximoPeriodo / configProx.divisor; // Ex: 3.6M / 3 = 1.2M por mês
      
      atingidoProxProporcional = metaProporcional > 0 ? (atualNestePeriodo / metaProporcional) * 100 : 0;
      faltaParaMetaProxProporcional = Math.max(metaProporcional - atualNestePeriodo, 0);
    }
    
    // Cálculos de Cenários de Esforço de Clientes
    const ticketMedio = acumulado[periodoAtivo][categoria] / Math.max(acumulado[periodoAtivo].clientes, 1);
    const maiorValor = acumulado[periodoAtivo][categoria === 'volume' ? 'maiorVolume' : 'maiorSalario'];
    const menorValor = acumulado[periodoAtivo][categoria === 'volume' ? 'menorVolume' : 'menorSalario'];
    
    const qtdTicket = (dados.faltaParaMeta > 0 && ticketMedio > 0) ? Math.ceil(dados.faltaParaMeta / ticketMedio) : 0;
    const qtdMaior = (dados.faltaParaMeta > 0 && maiorValor > 0) ? Math.ceil(dados.faltaParaMeta / maiorValor) : 0;
    const qtdMenor = (dados.faltaParaMeta > 0 && menorValor > 0) ? Math.ceil(dados.faltaParaMeta / menorValor) : 0;
    
    return (
      <div className="bg-black/20 p-4 rounded-xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all flex flex-col justify-between">
        <div>
          {/* BARRA PRINCIPAL */}
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{titulo}</p>
            <span className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded text-red-500">{atingido.toFixed(1)}% Atingido</span>
          </div>
          
          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
            <div className="bg-red-600 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(atingido, 100)}%` }}></div>
          </div>

          {/* BARRA SECUNDÁRIA PROPORCIONAL (Ritmo da Meta Maior) */}
          {configProx && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">
                  Ritmo p/ Meta {configProx.nome} (Cota Ideal: {formatarValor(metaProporcional)})
                </p>
                <span className="text-[9px] font-bold text-red-400">{atingidoProxProporcional.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-1 mb-1 border border-white/5">
                <div className="bg-red-800 h-1 rounded-full transition-all duration-1000" style={{ width: `${Math.min(atingidoProxProporcional, 100)}%` }}></div>
              </div>
              <p className="text-[9px] text-gray-400 text-right">Faltam {formatarValor(faltaParaMetaProxProporcional)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Previsão Fechamento</p>
              <p className="text-sm font-bold text-white">{formatarValor(dados.previsaoFechamento)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Falta p/ Meta Atual</p>
              <p className="text-sm font-bold text-gray-300">{formatarValor(dados.faltaParaMeta)}</p>
            </div>
          </div>
        </div>

        {/* CARTÃO UNIFICADO DE ESFORÇO */}
        <div className="bg-white/5 p-3 rounded-xl border border-white/10 mt-2">
          <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1">
            <Users size={12} className="text-red-500"/> Esforço Necessário
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center bg-black/20 p-2 rounded">
               <span className="text-xs text-gray-400">Pelo Ticket Médio:</span>
               <span className="text-sm font-bold text-white">{qtdTicket} <span className="text-[10px] text-gray-500 font-normal">de {formatarValor(ticketMedio)}</span></span>
            </div>
            <div className="flex justify-between items-center bg-black/20 p-2 rounded">
               <span className="text-xs text-gray-400">Pelo Crédito Recorde:</span>
               <span className="text-sm font-bold text-emerald-400">{qtdMaior} <span className="text-[10px] text-gray-500 font-normal">de {formatarValor(maiorValor)}</span></span>
            </div>
            <div className="flex justify-between items-center bg-black/20 p-2 rounded">
               <span className="text-xs text-gray-400">Pelo Menor Crédito:</span>
               <span className="text-sm font-bold text-orange-400">{qtdMenor} <span className="text-[10px] text-gray-500 font-normal">de {formatarValor(menorValor)}</span></span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const menuPeriodos: { id: Periodo, label: string }[] = [
    { id: 'mensal', label: 'Mensal' },
    { id: 'trimestral', label: 'Trimestral' },
    { id: 'semestral', label: 'Semestral' },
    { id: 'anual', label: 'Anual' }
  ];

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">
          Olá, <span className="text-red-600">{firstName}</span>!
        </h1>
        <p className="text-gray-400 mt-2">Sua central de inteligência preditiva.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/5 pb-4 overflow-x-auto">
        {menuPeriodos.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriodoAtivo(p.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors whitespace-nowrap ${
              periodoAtivo === p.id 
                ? 'bg-red-600 text-white' 
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between hover:border-gray-500/30 transition-colors">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Zap size={14}/> Vendas no Período</p>
          <p className="text-xl font-black text-white mt-2">{carregando ? '-' : acumulado[periodoAtivo].vendas}</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between hover:border-gray-500/30 transition-colors">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Users size={14}/> Ticket Médio (Cliente)</p>
          <p className="text-xl font-black text-white mt-2">
            {carregando ? '-' : formatarValor(acumulado[periodoAtivo].volume / Math.max(acumulado[periodoAtivo].clientes, 1))}
          </p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between hover:border-gray-500/30 transition-colors">
          <p className="text-xs text-gray-400 flex items-center gap-1"><TrendingUp size={14}/> Média de Volume / Dia</p>
          <p className="text-xl font-black text-white mt-2">
            {carregando ? '-' : formatarValor(acumulado[periodoAtivo].volume / tempo[periodoAtivo].passados)}
          </p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between hover:border-gray-500/30 transition-colors">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Crown size={14}/> Recorde de Carta</p>
          <p className="text-xl font-black text-gray-300 mt-2">{carregando ? '-' : formatarValor(maiorVenda)}</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between hover:border-red-500/30 transition-colors">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Award size={14}/> Comissão Acumulada</p>
          <p className="text-xl font-black text-red-500 mt-2">{carregando ? '-' : formatarValor(acumulado[periodoAtivo].comissaoGeral)}</p>
        </div>
        
        <div className="border border-red-500/30 bg-red-600/10 p-4 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-red-500 font-bold flex items-center gap-1"><Clock size={14}/> Receber Próximo Mês</p>
          <p className="text-xl font-black text-red-500 mt-2">{carregando ? '-' : formatarValor(recebimentoProximoMes)}</p>
        </div>
      </div>

      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Calendar className="text-red-500" size={20}/> Comissões a Receber (Próximos 6 Meses)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-10">
        {carregando ? (
          <div className="col-span-full text-center text-gray-500">Calculando fluxo...</div>
        ) : projecaoMensal.length > 0 ? (
          projecaoMensal.map((item, index) => (
            <div key={index} className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-md flex flex-col items-center">
              <span className="text-xs font-bold text-gray-400 mb-2 bg-white/5 px-3 py-1 rounded-full">{item.mes}</span>
              <span className="text-lg font-black text-white">{formatarValor(item.valor)}</span>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500 bg-dark-card py-6 rounded-xl border border-dark-border">
            Nenhuma comissão projetada.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-10">
        <div className="xl:col-span-3 bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <BarChart3 className="text-red-600" size={20}/> Análise Preditiva e Esforço ({periodoAtivo})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RenderCardPreditivo titulo="Volume de Crédito" categoria="volume" />
            <RenderCardPreditivo titulo="Salário (Comissão Diluída)" categoria="salario" />
          </div>
        </div>

        <div className="xl:col-span-1 bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <Gift className="text-red-500" size={20}/> Próximos Aniversários
          </h3>
          <div className="space-y-3">
            {carregando ? (
              <p className="text-gray-500 text-sm">Buscando...</p>
            ) : proximosAniversariantes.length > 0 ? (
              proximosAniversariantes.map(cli => (
                <div key={cli.id} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white">{cli.nomeCompleto}</p>
                    <p className="text-[10px] text-gray-400">{cli.dataNascimento?.split('-').reverse().join('/')}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${cli.diasFaltando === 0 ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-gray-300'}`}>
                    {cli.diasFaltando === 0 ? 'É HOJE!' : `Faltam ${cli.diasFaltando} dias`}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Gift className="text-gray-600 mx-auto mb-2 opacity-50" size={32}/>
                <p className="text-gray-500 text-sm">Sem datas cadastradas.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-dark-card p-6 rounded-3xl border border-dark-border shadow-lg mb-10">
        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Target size={20} className="text-red-600"/> Configuração de Metas ({periodoAtivo})
          </h3>
          {isEditingMetas ? (
            <button onClick={salvarMetas} className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-sm font-bold bg-emerald-500/10 px-4 py-2 rounded-full transition-colors">
              <Check size={16}/> Salvar
            </button>
          ) : (
            <button onClick={() => setIsEditingMetas(true)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-bold bg-white/5 px-4 py-2 rounded-full transition-colors">
              <Edit2 size={16}/> Editar Metas
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
            <h4 className="text-sm font-bold flex items-center gap-2 text-white"><TrendingUp size={16} className="text-red-500"/> Volume de Crédito</h4>
            {isEditingMetas ? renderInputMeta('volume', periodoAtivo) : <span className="text-lg font-bold text-white">{formatarValor(metas.volume[periodoAtivo])}</span>}
          </div>
          <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
            <h4 className="text-sm font-bold flex items-center gap-2 text-white"><Briefcase size={16} className="text-red-500"/> Salário (Mensalidade)</h4>
            {isEditingMetas ? renderInputMeta('salario', periodoAtivo) : <span className="text-lg font-bold text-white">{formatarValor(metas.salario[periodoAtivo])}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
