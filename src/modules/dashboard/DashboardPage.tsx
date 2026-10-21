// Arquivo: src/modules/dashboard/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { DollarSign, TrendingUp, Target, Award, Calendar, BarChart3, Users, Crown, Zap, Clock } from 'lucide-react';
import { buscarVendasDoBanco, buscarParcelasDoBanco } from '../../services/vendasService';
import { mascaraMoeda } from '../../utils/mascaras';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Corretor';

  const [carregando, setCarregando] = useState(true);
  const [ticketPorVenda, setTicketPorVenda] = useState(0);
  const [volumeTotalCreditos, setVolumeTotalCreditos] = useState(0);
  const [projecaoMensal, setProjecaoMensal] = useState<{mes: string, valor: number}[]>([]);
  const [mediaComissaoMensalAtual, setMediaComissaoMensalAtual] = useState(0);

  // EXPLICAÇÃO: Lemos a meta guardada no navegador. Se não existir, usamos um valor padrão.
  const [metaSalarialMensal, setMetaSalarialMensal] = useState(() => Number(localStorage.getItem('metaSalarial')) || 15000);
  const [metaVolumeCreditos, setMetaVolumeCreditos] = useState(() => Number(localStorage.getItem('metaVolume')) || 1000000);

  const [totalClientes, setTotalClientes] = useState(0);
  const [vendasMesAtual, setVendasMesAtual] = useState(0);
  const [maiorVenda, setMaiorVenda] = useState(0);
  const [comissaoMedia, setComissaoMedia] = useState(0);
  const [recebimentoEsteMes, setRecebimentoEsteMes] = useState(0);

  useEffect(() => {
    const calcularMetricas = async () => {
      const [vendas, parcelas] = await Promise.all([buscarVendasDoBanco(), buscarParcelasDoBanco()]);
      
      const hoje = new Date();
      const mesAtualFormatado = `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

      if (vendas.length > 0) {
        const somaCartas = vendas.reduce((acc, v) => acc + v.valorTotalCarta, 0);
        const somaComissoes = vendas.reduce((acc, v) => acc + v.valorComissaoTotal, 0);
        
        setVolumeTotalCreditos(somaCartas);
        setTicketPorVenda(somaCartas / vendas.length);
        setMediaComissaoMensalAtual(somaComissoes / 13);
        setComissaoMedia(somaComissoes / vendas.length);
        setTotalClientes(new Set(vendas.map(v => v.clienteId)).size);
        setMaiorVenda(Math.max(...vendas.map(v => v.valorTotalCarta)));

        const vendasDesteMes = vendas.filter(v => {
          const dataVenda = new Date(v.dataVenda);
          return dataVenda.getMonth() === hoje.getMonth() && dataVenda.getFullYear() === hoje.getFullYear();
        });
        setVendasMesAtual(vendasDesteMes.length);
      }

      if (parcelas.length > 0) {
        const fluxoAgrupado: Record<string, number> = {};
        let recebimentoAgora = 0;
        
        parcelas.forEach(p => {
          if (p.status === 'PENDENTE') {
            fluxoAgrupado[p.mesAnoReferencia] = (fluxoAgrupado[p.mesAnoReferencia] || 0) + p.valorReceber;
            if (p.mesAnoReferencia === mesAtualFormatado) {
              recebimentoAgora += p.valorReceber;
            }
          }
        });

        setRecebimentoEsteMes(recebimentoAgora);

        // EXPLICAÇÃO: Aqui resolvemos o problema dos meses desorganizados!
        const fluxoArray = Object.keys(fluxoAgrupado)
          .map(mes => ({ mes, valor: fluxoAgrupado[mes] }))
          .sort((a, b) => {
            // Separa o "02/2026" em mes="02" e ano="2026"
            const [mesA, anoA] = a.mes.split('/');
            const [mesB, anoB] = b.mes.split('/');
            
            // 1º Compara os anos. Se um ano for maior que o outro, ele vai para a frente.
            if (anoA !== anoB) return Number(anoA) - Number(anoB);
            
            // 2º Se for o mesmo ano, compara o mês.
            return Number(mesA) - Number(mesB);
          })
          .filter(item => {
            // Opcional: Garante que não mostramos meses do passado na projeção de 6 meses
            const [mesItem, anoItem] = item.mes.split('/');
            const dataDoItem = new Date(Number(anoItem), Number(mesItem) - 1, 1);
            const dataDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            return dataDoItem >= dataDeHoje;
          })
          .slice(0, 6); // Agora sim, cortamos os primeiros 6 meses depois de tudo estar perfeitamente ordenado!
          
        setProjecaoMensal(fluxoArray);
      }
      
      setCarregando(false);
    };

    calcularMetricas();
  }, []);

  // EXPLICAÇÃO: Estas funções guardam os valores diretamente na memória assim que você digita.
  const handleMudancaMetaSalarial = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = Number(e.target.value);
    setMetaSalarialMensal(valor);
    localStorage.setItem('metaSalarial', valor.toString());
  };

  const handleMudancaMetaVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = Number(e.target.value);
    setMetaVolumeCreditos(valor);
    localStorage.setItem('metaVolume', valor.toString());
  };

  // Recálculo automático das percentagens (Reatividade)
  const porcentagemMetaVolume = metaVolumeCreditos > 0 ? ((volumeTotalCreditos / metaVolumeCreditos) * 100).toFixed(1) : 0;
  const porcentagemMetaSalario = metaSalarialMensal > 0 ? ((mediaComissaoMensalAtual / metaSalarialMensal) * 100).toFixed(1) : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">
            {getGreeting()}, <span className="text-orange-500">{firstName}</span>!
          </h1>
          <p className="text-gray-400 mt-2">Visão analítica de performance, contexto e fluxo de caixa.</p>
        </div>
        
        <div className="flex gap-4 bg-dark-card p-4 rounded-xl border border-dark-border">
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase">Meta Salarial/Mês</label>
            <input 
              type="number" 
              value={metaSalarialMensal}
              onChange={handleMudancaMetaSalarial}
              className="block w-32 bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase">Meta Volume Carta</label>
            <input 
              type="number" 
              value={metaVolumeCreditos}
              onChange={handleMudancaMetaVolume}
              className="block w-36 bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Users size={14}/> Clientes na Base</p>
          <p className="text-2xl font-black text-white mt-2">{carregando ? '-' : totalClientes}</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Zap size={14}/> Vendas este Mês</p>
          <p className="text-2xl font-black text-white mt-2">{carregando ? '-' : vendasMesAtual}</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Crown size={14}/> Recorde de Carta</p>
          <p className="text-lg font-black text-blue-400 mt-2">{carregando ? '-' : mascaraMoeda(maiorVenda.toFixed(2))}</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Award size={14}/> Comissão Média</p>
          <p className="text-lg font-black text-emerald-400 mt-2">{carregando ? '-' : mascaraMoeda(comissaoMedia.toFixed(2))}</p>
        </div>
        <div className="bg-dark-card border border-orange-500/30 p-4 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-orange-400 font-bold flex items-center gap-1"><Clock size={14}/> Receber este Mês</p>
          <p className="text-lg font-black text-orange-400 mt-2">{carregando ? '-' : mascaraMoeda(recebimentoEsteMes.toFixed(2))}</p>
        </div>
      </div>

      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Calendar className="text-orange-500" size={20}/> Comissões a Receber (Próximos 6 Meses)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-10">
        {carregando ? (
          <div className="col-span-full text-center text-gray-500">Calculando fluxo...</div>
        ) : projecaoMensal.length > 0 ? (
          projecaoMensal.map((item, index) => (
            <div key={index} className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-md flex flex-col items-center">
              <span className="text-xs font-bold text-gray-400 mb-2 bg-white/5 px-3 py-1 rounded-full">{item.mes}</span>
              <span className="text-lg font-black text-emerald-400">{mascaraMoeda(item.valor.toFixed(2))}</span>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500 bg-dark-card py-6 rounded-xl border border-dark-border">
            Nenhuma comissão projetada.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-4">
        
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg flex flex-col justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <TrendingUp className="text-blue-500" size={20}/> Volume Comercializado
          </h3>
          <div className="border-t border-white/10 pt-4">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-xs text-gray-400">Total Acumulado</p>
                <p className="text-3xl font-black text-white">{carregando ? '...' : mascaraMoeda(volumeTotalCreditos.toFixed(2))}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-gray-500 font-bold">Meta: {mascaraMoeda(metaVolumeCreditos.toFixed(2))}</p>
                <p className="text-sm font-bold text-orange-500">{porcentagemMetaVolume}%</p>
              </div>
            </div>
            <div className="w-full h-2 bg-black rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${Math.min(Number(porcentagemMetaVolume), 100)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg h-full flex flex-col justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="text-emerald-500" size={20}/> Performance e Tendência
          </h3>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-400">Média Gerada por Mês Ativo</p>
              <span className="bg-white/10 text-white text-xs font-bold px-2 py-1 rounded">Alvo: {mascaraMoeda(metaSalarialMensal.toFixed(2))}</span>
            </div>
            <div className="bg-black/40 p-4 rounded-xl border border-emerald-500/30 relative overflow-hidden">
              <p className="text-2xl font-black text-emerald-400 relative z-10">
                {carregando ? '...' : mascaraMoeda(mediaComissaoMensalAtual.toFixed(2))}
              </p>
              <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(Number(porcentagemMetaSalario), 100)}%` }}></div>
            </div>
          </div>
          <div className="bg-linear-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 p-4 rounded-xl">
            <p className="text-xs text-orange-200 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">Projeção Trimestral</p>
            <p className="text-sm text-gray-300 mb-2">Se mantiver a média atual, nos próximos 3 meses agregará:</p>
            <p className="text-3xl font-black text-white">{carregando ? '...' : mascaraMoeda((mediaComissaoMensalAtual * 3).toFixed(2))}</p>
          </div>
        </div>
        
      </div>
    </div>
  );
}
