import React, { useState, useEffect } from 'react';
import { Receipt, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { VendaConsorcio, TipoCartaConsorcio, Cliente, PlanoComissao } from '../../types/models';
import { atualizarVendaNoBanco } from '../../services/vendasService';
import { buscarClientes } from '../../services/clienteService';
import { mascaraMoeda } from '../../utils/mascaras';
import { useAuthStore } from '../../store/useAuthStore';
import {
  buscarOuInicializarPlanos,
  calcularCronogramaComissao,
  registrarVendaUnificada,
} from '../../utils/comissaoEngine';

interface FormularioVendaProps {
  onVendaSalva?: () => void;
  vendaEditando?: VendaConsorcio | null;
  onCancelarEdicao?: () => void;
}

// ============================================================================
// 1. FUNÇÕES AUXILIARES DE COMPETÊNCIA DE NOTA (REGRA DIA 15 FLEXÍVEL)
// ============================================================================
function sugerirCompetenciaNota(dataISO: string): 'ATUAL' | 'PROXIMO' {
  if (!dataISO || !dataISO.includes('-')) return 'ATUAL';
  const dia = Number(dataISO.split('-')[2]);
  return dia <= 15 ? 'ATUAL' : 'PROXIMO';
}

function obterDetalhesCompetenciaNota(dataISO: string) {
  if (!dataISO || !dataISO.includes('-')) {
    return {
      mesNotaAtual: 'Mês da Venda',
      mesRecebimentoAtual: 'Mês Seguinte',
      mesNotaProximo: 'Próximo Mês',
      mesRecebimentoProximo: 'Em 2 Meses',
    };
  }

  const [anoStr, mesStr] = dataISO.split('-');
  const ano = Number(anoStr);
  const mesIndex = Number(mesStr) - 1; // 0 = Janeiro ... 11 = Dezembro

  const formatarMesAno = (offsetMeses: number) => {
    const dataRef = new Date(ano, mesIndex + offsetMeses, 1);
    const nomeMes = dataRef.toLocaleDateString('pt-BR', { month: 'long' });
    const nomeCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
    return `${nomeCapitalizado}/${dataRef.getFullYear()}`;
  };

  return {
    mesNotaAtual: formatarMesAno(0),
    mesRecebimentoAtual: formatarMesAno(1),
    mesNotaProximo: formatarMesAno(1),
    mesRecebimentoProximo: formatarMesAno(2),
  };
}

export default function FormularioVenda({
  onVendaSalva,
  vendaEditando,
  onCancelarEdicao,
}: FormularioVendaProps) {
  const { user } = useAuthStore();
  const dataHojeISO = new Date().toISOString().split('T')[0];

  // ==========================================================================
  // 2. ESTADOS DO FORMULÁRIO
  // ==========================================================================
  const [cliente, setCliente] = useState('');
  const [valorCarta, setValorCarta] = useState('');
  const [dataVenda, setDataVenda] = useState(dataHojeISO);
  const [competenciaNota, setCompetenciaNota] = useState<'ATUAL' | 'PROXIMO'>(
    sugerirCompetenciaNota(dataHojeISO)
  );
  const [cota, setCota] = useState('');
  const [grupo, setGrupo] = useState('');
  const [tipoCarta, setTipoCarta] = useState<TipoCartaConsorcio | ''>('');
  const [planoComissaoId, setPlanoComissaoId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listaClientes, setListaClientes] = useState<Cliente[]>([]);
  const [planosComissao, setPlanosComissao] = useState<PlanoComissao[]>([]);

  // ==========================================================================
  // 3. CARREGAMENTO DE CLIENTES E PLANOS DE COMISSÃO
  // ==========================================================================
  useEffect(() => {
    const carregarIniciais = async () => {
      const clientesDoBanco = await buscarClientes();
      const clientesOrdenados = [...clientesDoBanco].sort((a, b) =>
        a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR')
      );
      setListaClientes(clientesOrdenados);

      if (user?.uid) {
        const planos = await buscarOuInicializarPlanos(user.uid);
        setPlanosComissao(planos);
        if (planos.length > 0 && !vendaEditando) {
          setPlanoComissaoId(planos[0].id || '');
        }
      }
    };
    carregarIniciais();
  }, [user?.uid, vendaEditando]);

  // ==========================================================================
  // 4. PREENCHIMENTO AUTOMÁTICO NO MODO EDIÇÃO
  // ==========================================================================
  useEffect(() => {
    if (vendaEditando) {
      setCliente(vendaEditando.clienteId);
      setValorCarta(mascaraMoeda(vendaEditando.valorTotalCarta.toFixed(2).replace('.', '')));

      let dataFormatada = '';
      if (vendaEditando.dataVenda) {
        const d =
          vendaEditando.dataVenda instanceof Date
            ? vendaEditando.dataVenda
            : new Date(
                (vendaEditando.dataVenda as any).seconds
                  ? (vendaEditando.dataVenda as any).seconds * 1000
                  : vendaEditando.dataVenda
              );
        if (!isNaN(d.getTime())) {
          dataFormatada = d.toISOString().split('T')[0];
        }
      }

      setDataVenda(dataFormatada);
      const compSalva = (vendaEditando as any).competenciaNota;
      setCompetenciaNota(
        compSalva === 'ATUAL' || compSalva === 'PROXIMO'
          ? compSalva
          : sugerirCompetenciaNota(dataFormatada)
      );
      setCota(vendaEditando.cota);
      setGrupo(vendaEditando.grupo);
      setTipoCarta(vendaEditando.tipoCarta);
      if (vendaEditando.planoComissaoId) setPlanoComissaoId(vendaEditando.planoComissaoId);
    }
  }, [vendaEditando]);

  // Atualiza a data da venda e ajusta a sugestão padrão da nota (editável logo abaixo)
  const handleAlterarDataVenda = (novaDataISO: string) => {
    setDataVenda(novaDataISO);
    setCompetenciaNota(sugerirCompetenciaNota(novaDataISO));
  };

  const limparFormulario = () => {
    const hoje = new Date().toISOString().split('T')[0];
    setCliente('');
    setValorCarta('');
    setDataVenda(hoje);
    setCompetenciaNota(sugerirCompetenciaNota(hoje));
    setCota('');
    setGrupo('');
    setTipoCarta('');
    if (planosComissao.length > 0) setPlanoComissaoId(planosComissao[0].id || '');
    if (onCancelarEdicao) onCancelarEdicao();
  };

  // ==========================================================================
  // 5. SUBMISSÃO DO FORMULÁRIO (CRIAÇÃO OU EDIÇÃO)
  // ==========================================================================
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valorLimpoCarta = parseFloat(valorCarta.replace(/[R$\s.]/g, '').replace(',', '.'));
    const planoEscolhido = planosComissao.find((p) => p.id === planoComissaoId);

    if (
      !cliente ||
      isNaN(valorLimpoCarta) ||
      valorLimpoCarta <= 0 ||
      !dataVenda ||
      !cota.trim() ||
      !grupo.trim() ||
      !tipoCarta ||
      !planoEscolhido
    ) {
      toast.error('Preencha todos os campos obrigatórios corretamente.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (vendaEditando && vendaEditando.id) {
        await atualizarVendaNoBanco(vendaEditando.id, {
          clienteId: cliente,
          cota: cota.trim(),
          grupo: grupo.trim(),
          tipoCarta,
        });
        toast.success('Venda atualizada com sucesso!');
      } else {
        if (!user?.uid) throw new Error('Usuário não autenticado');

        // Valida o cálculo antes de gravar no banco
        const calculoTeste = (calcularCronogramaComissao as any)(
          valorLimpoCarta,
          dataVenda,
          planoEscolhido,
          competenciaNota
        );

        if (
          !calculoTeste ||
          Number.isNaN(calculoTeste.valorComissaoTotal) ||
          !Array.isArray(calculoTeste.parcelas) ||
          calculoTeste.parcelas.length === 0
        ) {
          toast.error(
            `O plano "${planoEscolhido.nome}" está com regras incompletas. Revise-o nas Configurações.`
          );
          setIsSubmitting(false);
          return;
        }

        await (registrarVendaUnificada as any)({
          userId: user.uid,
          clienteId: cliente,
          valorTotalCarta: valorLimpoCarta,
          tipoCarta,
          grupo: grupo.trim(),
          cota: cota.trim(),
          dataVendaISO: dataVenda,
          plano: planoEscolhido,
          competenciaNota,
        });

        toast.success('Venda e parcelas de comissão registradas com sucesso!');
      }

      limparFormulario();
      if (onVendaSalva) onVendaSalva();
    } catch (error) {
      console.error('Erro ao salvar venda:', error);
      toast.error('Ocorreu um erro ao salvar a venda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // 6. SIMULAÇÃO EM TEMPO REAL
  // ==========================================================================
  const planoAtual = planosComissao.find((p) => p.id === planoComissaoId);
  const valorNumero = parseFloat(valorCarta.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  const detalhesNota = obterDetalhesCompetenciaNota(dataVenda);

  const simulacao =
    !vendaEditando && planoAtual && valorNumero > 0 && dataVenda
      ? (calcularCronogramaComissao as any)(
          valorNumero,
          dataVenda,
          planoAtual,
          competenciaNota
        )
      : null;

  return (
    <div
      className={`w-full mx-auto p-6 border rounded-2xl shadow-2xl transition-colors ${
        vendaEditando
          ? 'bg-dark-card border-red-500/50'
          : 'bg-dark-card border-dark-border'
      }`}
    >
      <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            {vendaEditando ? 'Editando Venda' : 'Nova Venda (Cliente Ativo)'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {vendaEditando
              ? 'Atualize os dados cadastrais do contrato.'
              : 'Preencha os dados da carta e defina em qual fechamento de nota ela entrou.'}
          </p>
        </div>
        {vendaEditando && (
          <button
            type="button"
            onClick={limparFormulario}
            className="text-xs text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* CLIENTE */}
        <div>
          <label className="block text-xs font-bold text-gray-300 mb-1">Cliente *</label>
          <select
            className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:border-red-500 outline-none"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="" disabled>
              Selecione o cliente...
            </option>
            {listaClientes.map((cli) => (
              <option key={cli.id} value={cli.id} className="bg-dark-bg">
                {cli.nomeCompleto}
              </option>
            ))}
          </select>
        </div>

        {/* TIPO DE CARTA E DATA DA VENDA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">Tipo de Carta *</label>
            <select
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:border-red-500 outline-none"
              value={tipoCarta}
              onChange={(e) => setTipoCarta(e.target.value as TipoCartaConsorcio)}
              disabled={isSubmitting}
            >
              <option value="" disabled>
                Selecione...
              </option>
              <option value="Imobiliária" className="bg-dark-bg">
                Imobiliária
              </option>
              <option value="Automotiva" className="bg-dark-bg">
                Automotiva
              </option>
              <option value="Serviços" className="bg-dark-bg">
                Serviços
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">Data da Venda *</label>
            <input
              type="date"
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:border-red-500 outline-none disabled:opacity-50 scheme-dark"
              value={dataVenda}
              onChange={(e) => handleAlterarDataVenda(e.target.value)}
              disabled={isSubmitting || !!vendaEditando}
            />
          </div>
        </div>

        {/* VALOR DA CARTA, GRUPO E COTA */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-300 mb-1">Valor da Carta *</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm font-bold text-white focus:border-red-500 outline-none disabled:opacity-50"
              value={valorCarta}
              onChange={(e) => setValorCarta(mascaraMoeda(e.target.value))}
              disabled={isSubmitting || !!vendaEditando}
              placeholder="R$ 0,00"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">Grupo *</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:border-red-500 outline-none"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              disabled={isSubmitting}
              placeholder="1050"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">Cota *</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:border-red-500 outline-none"
              value={cota}
              onChange={(e) => setCota(e.target.value)}
              disabled={isSubmitting}
              placeholder="12A"
            />
          </div>
        </div>

        {/* PLANO DE COMISSIONAMENTO */}
        <div>
          <label className="block text-xs font-bold text-emerald-400 mb-1">
            Comissionamento *
          </label>
          <select
            className="w-full px-3.5 py-2.5 bg-black/50 border border-emerald-500/30 rounded-xl text-sm text-white focus:border-emerald-500 outline-none disabled:opacity-50"
            value={planoComissaoId}
            onChange={(e) => setPlanoComissaoId(e.target.value)}
            disabled={isSubmitting || !!vendaEditando}
          >
            {planosComissao.map((plano) => (
              <option key={plano.id} value={plano.id} className="bg-dark-bg">
                {plano.nome}
              </option>
            ))}
          </select>
        </div>

        {/* SELETOR DE FECHAMENTO DE NOTA (APENAS PARA NOVA VENDA) */}
        {!vendaEditando && (
          <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl">
            <label className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-1.5">
              <Receipt size={14} className="text-amber-400" />
              Em qual fechamento de nota esta venda entrou? *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCompetenciaNota('ATUAL')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  competenciaNota === 'ATUAL'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white shadow'
                    : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/25'
                }`}
              >
                <span className="block text-xs font-black">
                  Nota de {detalhesNota.mesNotaAtual}
                </span>
                <span className="block text-[11px] text-emerald-400 mt-0.5">
                  1º recebimento: {detalhesNota.mesRecebimentoAtual}
                </span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCompetenciaNota('PROXIMO')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  competenciaNota === 'PROXIMO'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow'
                    : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/25'
                }`}
              >
                <span className="block text-xs font-black">
                  Nota de {detalhesNota.mesNotaProximo}
                </span>
                <span className="block text-[11px] text-amber-400 mt-0.5">
                  1º recebimento: {detalhesNota.mesRecebimentoProximo}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* SIMULAÇÃO EM TEMPO REAL */}
        {simulacao &&
          (Number.isNaN(simulacao.valorComissaoTotal) ? (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                Não foi possível calcular a comissão do plano <strong>{planoAtual?.nome}</strong>.
              </span>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-gray-300 flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span>Comissão Total:</span>
                <strong className="text-emerald-400 text-sm font-black">
                  {simulacao.valorComissaoTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span>1º Recebimento (Conforme Nota):</span>
                <strong className="text-white">
                  {simulacao.parcelas?.[0]?.mesAnoReferencia || 'Não definido'}
                </strong>
              </div>
            </div>
          ))}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition mt-1 shadow-lg shadow-red-600/20 disabled:opacity-50"
        >
          {isSubmitting
            ? 'Processando...'
            : vendaEditando
            ? 'Salvar Alterações'
            : 'Registrar Venda'}
        </button>
      </form>
    </div>
  );
}
