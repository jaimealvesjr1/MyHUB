import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  Percent,
  Calendar,
  Sparkles,
  Star,
  CheckCircle2
} from 'lucide-react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { PlanoComissao } from '../../types/models';
import { buscarOuInicializarPlanos } from '../../utils/comissaoEngine';

type PlanoComissaoEstendido = PlanoComissao & {
  isPadrao?: boolean;
};

export default function ConfiguracoesPage() {
  const { user } = useAuthStore();
  const [planos, setPlanos] = useState<PlanoComissaoEstendido[]>([]);
  const [planoPadraoId, setPlanoPadraoId] = useState<string>('');
  const [salvandoPadrao, setSalvandoPadrao] = useState<boolean>(false);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Estados do formulário de novo plano
  const [nome, setNome] = useState('');
  const [percentualBase, setPercentualBase] = useState('');
  const [parcelasBase, setParcelasBase] = useState('13');
  const [temBonus, setTemBonus] = useState(false);
  const [percentualBonus, setPercentualBonus] = useState('');
  const [parcelaBonus, setParcelaBonus] = useState('15');

  // Marca o plano escolhido como padrão na própria coleção 'planos_comissao' e no localStorage
  const persistirPlanoPadrao = async (
    novoPlanoId: string,
    listaReferencia?: PlanoComissaoEstendido[],
    exibirToast = true
  ) => {
    if (!user?.uid || !novoPlanoId) return;

    setSalvandoPadrao(true);
    setPlanoPadraoId(novoPlanoId);
    localStorage.setItem(`plano_padrao_crm_${user.uid}`, novoPlanoId);

    const baseLista = listaReferencia || planos;
    setPlanos(
      baseLista.map((p) => ({
        ...p,
        isPadrao: p.id === novoPlanoId
      }))
    );

    try {
      // Atualiza a flag isPadrao nos documentos da coleção planos_comissao
      const atualizacoes = baseLista
        .filter((p) => p.id && (p.id === novoPlanoId || p.isPadrao))
        .map((p) =>
          updateDoc(doc(db, 'planos_comissao', p.id!), {
            isPadrao: p.id === novoPlanoId
          })
        );

      await Promise.all(atualizacoes);

      if (exibirToast) {
        toast.success('Plano padrão atualizado para as previsões da Tela Inicial!');
      }
    } catch (error) {
      // Mantém funcionando via localStorage caso a regra de update no Firestore esteja restrita
      console.warn('Preferência salva localmente (verifique permissão de update em planos_comissao):', error);
      if (exibirToast) {
        toast.success('Plano padrão atualizado neste navegador!');
      }
    } finally {
      setSalvandoPadrao(false);
    }
  };

  // Carrega os planos cadastrados e identifica qual está definido como padrão
  const carregarPlanos = async () => {
    if (!user?.uid) return;
    setCarregando(true);

    try {
      const lista = (await buscarOuInicializarPlanos(user.uid)) as PlanoComissaoEstendido[];
      setPlanos(lista);

      // 1º: Verifica se algum plano no Firestore já está marcado com isPadrao: true
      const marcadoNoBanco = lista.find((p) => p.isPadrao && p.id);
      if (marcadoNoBanco?.id) {
        setPlanoPadraoId(marcadoNoBanco.id);
        localStorage.setItem(`plano_padrao_crm_${user.uid}`, marcadoNoBanco.id);
        return;
      }

      // 2º: Verifica se há um ID válido salvo no localStorage
      const idLocal = localStorage.getItem(`plano_padrao_crm_${user.uid}`) || '';
      const validoLocal = lista.find((p) => p.id === idLocal);
      if (validoLocal?.id) {
        await persistirPlanoPadrao(validoLocal.id, lista, false);
        return;
      }

      // 3º: Define automaticamente o primeiro plano da lista como padrão
      if (lista.length > 0 && lista[0].id) {
        await persistirPlanoPadrao(lista[0].id, lista, false);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPlanos();
  }, [user?.uid]);

  // Cria um novo modelo de comissão no Firestore
  const handleCriarPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    const baseNum = parseFloat(percentualBase.replace(',', '.'));
    const parcelasNum = parseInt(parcelasBase, 10);
    const bonusNum = temBonus ? parseFloat(percentualBonus.replace(',', '.')) : 0;
    const parcelaBonusNum = temBonus ? parseInt(parcelaBonus, 10) : 0;

    if (!nome.trim() || isNaN(baseNum) || baseNum <= 0 || isNaN(parcelasNum) || parcelasNum <= 0) {
      return toast.error('Preencha o nome, percentual base e quantidade de parcelas.');
    }

    if (temBonus && (isNaN(bonusNum) || bonusNum <= 0 || isNaN(parcelaBonusNum) || parcelaBonusNum <= 0)) {
      return toast.error('Preencha o percentual bônus e o número da parcela bônus.');
    }

    setSalvando(true);
    try {
      await addDoc(collection(db, 'planos_comissao'), {
        userId: user.uid,
        nome: nome.trim(),
        percentualBase: baseNum,
        parcelasBase: parcelasNum,
        temBonus,
        percentualBonus: bonusNum,
        parcelaBonus: parcelaBonusNum,
        isPadrao: planos.length === 0
      });

      setNome('');
      setPercentualBase('');
      setParcelasBase('13');
      setTemBonus(false);
      setPercentualBonus('');
      setParcelaBonus('15');

      toast.success('Plano de comissionamento salvo!');
      await carregarPlanos();
    } catch (error) {
      console.error('Erro ao salvar plano de comissão:', error);
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSalvando(false);
    }
  };

  // Exclui um modelo de comissão (mantendo sempre pelo menos 1 ativo)
  const handleExcluirPlano = async (id?: string) => {
    if (!id) return;
    if (planos.length <= 1) {
      return toast.error('Você precisa manter pelo menos um plano ativo.');
    }
    if (window.confirm('Deseja remover este modelo de comissionamento?')) {
      await deleteDoc(doc(db, 'planos_comissao', id));
      toast.success('Plano removido!');

      if (id === planoPadraoId) {
        const restantes = planos.filter((p) => p.id !== id);
        if (restantes[0]?.id) {
          await persistirPlanoPadrao(restantes[0].id, restantes, false);
        }
      }

      await carregarPlanos();
    }
  };

  const formatarMoeda = (val: number) =>
    (Number.isFinite(val) ? val : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const planoPadraoSelecionado = planos.find((p) => p.id === planoPadraoId);

  return (
    <div className="w-full p-4 md:p-8 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Settings className="text-red-600" size={30} /> Configurações de <span className="text-red-600">Comissão</span>
        </h1>
        <p className="text-gray-400 mt-2">
          Cadastre suas tabelas de comissionamento e defina qual regra será usada como padrão nas previsões da Tela Inicial.
        </p>
      </div>

      {/* BLOCO DE DESTAQUE: SELETOR DE COMISSÃO PADRÃO PARA O DASHBOARD */}
      <div className="bg-dark-card border border-amber-500/30 rounded-2xl p-6 shadow-lg mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full mb-2">
            <Star size={12} /> Previsão Assertiva no Dashboard
          </span>
          <h2 className="text-lg font-bold text-white">
            Comissionamento Padrão Pré-Selecionado
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Esta regra será aplicada automaticamente sobre o <strong className="text-gray-200">Dinheiro na Mesa</strong> para calcular seu potencial de comissão mensal na Tela Inicial.
          </p>
        </div>

        <div className="w-full lg:w-96 shrink-0">
          <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
            Regra Padrão Ativa {salvandoPadrao ? '(Salvando...)' : ''}
          </label>
          <select
            disabled={carregando || salvandoPadrao || planos.length === 0}
            value={planoPadraoId}
            onChange={(e) => persistirPlanoPadrao(e.target.value, planos, true)}
            className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-amber-400 transition-colors"
          >
            {planos.map((plano) => (
              <option key={plano.id} value={plano.id} className="bg-dark-bg">
                {plano.nome} ({plano.percentualBase}% em {plano.parcelasBase}x)
              </option>
            ))}
          </select>
          {planoPadraoSelecionado && (
            <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
              <CheckCircle2 size={12} /> Ativo nas projeções: {planoPadraoSelecionado.nome}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* COLUNA ESQUERDA: Formulário de Novo Plano */}
        <div className="xl:col-span-1 bg-dark-card border border-dark-border p-6 rounded-2xl shadow-lg h-fit">
          <h2 className="text-xl font-bold text-white mb-6">Novo Modelo de Comissão</h2>

          <form onSubmit={handleCriarPlano} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Nome da Regra *</label>
              <input
                type="text"
                required
                placeholder="Ex: 2% em 13x + 0,3% na 15ª"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Comissão Base (%) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1,66"
                  value={percentualBase}
                  onChange={(e) => setPercentualBase(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Nº de Parcelas *</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  required
                  value={parcelasBase}
                  onChange={(e) => setParcelasBase(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Opção de Parcela Bônus */}
            <div className="p-4 bg-black/30 border border-white/5 rounded-xl flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-200">
                <input
                  type="checkbox"
                  checked={temBonus}
                  onChange={(e) => setTemBonus(e.target.checked)}
                  className="accent-red-600 w-4 h-4"
                />
                <Sparkles size={15} className="text-amber-400" /> Incluir parcela bônus extra
              </label>

              {temBonus && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Bônus (%) *</label>
                    <input
                      type="text"
                      placeholder="Ex: 0,3"
                      value={percentualBonus}
                      onChange={(e) => setPercentualBonus(e.target.value)}
                      className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Na Parcela Nº *</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="Ex: 15"
                      value={parcelaBonus}
                      onChange={(e) => setParcelaBonus(e.target.value)}
                      className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              <Plus size={18} /> {salvando ? 'Salvando...' : 'Adicionar Regra'}
            </button>
          </form>
        </div>

        {/* COLUNA DIREITA: Regras Cadastradas + Simulação */}
        <div className="xl:col-span-2 bg-dark-card border border-dark-border p-6 rounded-2xl shadow-lg h-fit">
          <h2 className="text-xl font-bold text-white mb-2">Modelos Ativos</h2>
          <p className="text-xs text-gray-400 mb-6">
            Simulação automática baseada em uma carta de <strong className="text-white">R$ 100.000,00</strong>:
          </p>

          {carregando ? (
            <p className="text-gray-400 text-center py-10 animate-pulse">Carregando configurações...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {planos.map((plano) => {
                const exemploCarta = 100000;
                const percBase = Number(plano.percentualBase || 0);
                const qtdParcelas = Math.max(1, Number(plano.parcelasBase || 1));
                const baseTotal = exemploCarta * (percBase / 100);
                const parcelaMensal = baseTotal / qtdParcelas;
                const bonusTotal =
                  plano.temBonus && plano.percentualBonus
                    ? exemploCarta * (Number(plano.percentualBonus) / 100)
                    : 0;
                const ehPadrao = plano.id === planoPadraoId;

                return (
                  <div
                    key={plano.id}
                    className={`bg-black/40 border p-5 rounded-2xl flex flex-col justify-between gap-4 relative group transition-all ${
                      ehPadrao
                        ? 'border-amber-500/60 shadow-lg shadow-amber-500/5'
                        : 'border-white/10 hover:border-red-500/40'
                    }`}
                  >
                    <button
                      onClick={() => handleExcluirPlano(plano.id)}
                      title="Excluir regra"
                      className="absolute top-4 right-4 text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 pr-8">
                        <h3 className="text-base font-bold text-white">{plano.nome}</h3>
                      </div>

                      {/* Badge ou Botão de Plano Padrão */}
                      <div className="mt-2">
                        {ehPadrao ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                            <Star size={10} /> Padrão da Tela Inicial
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => plano.id && persistirPlanoPadrao(plano.id, planos, true)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-amber-300 bg-white/5 hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/30 px-2.5 py-0.5 rounded-full transition-colors"
                          >
                            <Star size={10} /> Definir como Padrão
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-bold">
                          <Percent size={12} /> Base: {percBase}%
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs bg-white/5 text-gray-300 border border-white/10 px-2.5 py-1 rounded-lg font-bold">
                          <Calendar size={12} /> {qtdParcelas}x
                        </span>
                        {plano.temBonus && (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg font-bold">
                            <Sparkles size={12} /> +{plano.percentualBonus}% na {plano.parcelaBonus}ª
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/5 text-xs text-gray-400 flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>Parcela mensal (1ª à {qtdParcelas}ª):</span>
                        <strong className="text-white">{formatarMoeda(parcelaMensal)}</strong>
                      </div>
                      {plano.temBonus && (
                        <div className="flex justify-between text-amber-400">
                          <span>Bônus na {plano.parcelaBonus}ª parcela:</span>
                          <strong>{formatarMoeda(bonusTotal)}</strong>
                        </div>
                      )}
                      <div className="flex justify-between text-emerald-400 font-bold pt-1">
                        <span>Total na carta de 100k:</span>
                        <span>{formatarMoeda(baseTotal + bonusTotal)}</span>
                      </div>
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
