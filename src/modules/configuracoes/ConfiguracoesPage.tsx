import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Percent, Calendar, Sparkles } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { PlanoComissao } from '../../types/models';
import { buscarOuInicializarPlanos } from '../../utils/comissaoEngine';

export default function ConfiguracoesPage() {
  const { user } = useAuthStore();
  const [planos, setPlanos] = useState<PlanoComissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados do formulário de novo plano
  const [nome, setNome] = useState('');
  const [percentualBase, setPercentualBase] = useState('');
  const [parcelasBase, setParcelasBase] = useState('13');
  const [temBonus, setTemBonus] = useState(false);
  const [percentualBonus, setPercentualBonus] = useState('');
  const [parcelaBonus, setParcelaBonus] = useState('15');

  const carregarPlanos = async () => {
    if (!user?.uid) return;
    setCarregando(true);
    const lista = await buscarOuInicializarPlanos(user.uid);
    setPlanos(lista);
    setCarregando(false);
  };

  useEffect(() => {
    carregarPlanos();
  }, [user?.uid]);

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
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirPlano = async (id?: string) => {
    if (!id) return;
    if (planos.length <= 1) {
      return toast.error('Você precisa manter pelo menos um plano ativo.');
    }
    if (window.confirm('Deseja remover este modelo de comissionamento?')) {
      await deleteDoc(doc(db, 'planos_comissao', id));
      toast.success('Plano removido!');
      await carregarPlanos();
    }
  };

  const formatarMoeda = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Settings className="text-red-600" size={30} /> Configurações de <span className="text-red-600">Comissão</span>
        </h1>
        <p className="text-gray-400 mt-2">
          Cadastre as tabelas de comissionamento disponíveis para selecionar no fechamento de cada venda.
        </p>
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
                const baseTotal = exemploCarta * (plano.percentualBase / 100);
                const parcelaMensal = baseTotal / plano.parcelasBase;
                const bonusTotal =
                  plano.temBonus && plano.percentualBonus
                    ? exemploCarta * (plano.percentualBonus / 100)
                    : 0;

                return (
                  <div
                    key={plano.id}
                    className="bg-black/40 border border-white/10 hover:border-red-500/40 p-5 rounded-2xl flex flex-col justify-between gap-4 relative group transition-all"
                  >
                    <button
                      onClick={() => handleExcluirPlano(plano.id)}
                      title="Excluir regra"
                      className="absolute top-4 right-4 text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div>
                      <h3 className="text-base font-bold text-white pr-8">{plano.nome}</h3>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-bold">
                          <Percent size={12} /> Base: {plano.percentualBase}%
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs bg-white/5 text-gray-300 border border-white/10 px-2.5 py-1 rounded-lg font-bold">
                          <Calendar size={12} /> {plano.parcelasBase}x
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
                        <span>Parcela mensal (1ª à {plano.parcelasBase}ª):</span>
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
