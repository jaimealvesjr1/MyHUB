import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, CreditCard, Calendar, Award,
  FileText, Edit2, Trash2, X, MessageCircle, Layers,
  CheckCircle2, Clock, RotateCcw
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import {
  excluirVendaDoBanco,
  alternarConfirmacaoParcela,
  isParcelaConfirmada
} from '../../services/vendasService';
import { mascaraCPF, mascaraTelefone } from '../../utils/mascaras';
import { Cliente, VendaConsorcio, ParcelaComissao } from '../../types/models';

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vendas, setVendas] = useState<VendaConsorcio[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaComissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processandoParcelaId, setProcessandoParcelaId] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [formEdit, setFormEdit] = useState({
    nomeCompleto: '',
    cpf: '',
    telefone: '',
    dataNascimento: '',
  });
  const [salvando, setSalvando] = useState(false);

  const extrairTimestamp = (data: any): number => {
    if (!data) return 0;
    if (data instanceof Date) return data.getTime();
    if (data.seconds) return data.seconds * 1000;
    const parsed = new Date(data).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const carregarFichaCompleta = async () => {
    if (!id || !user?.uid) return;
    setCarregando(true);

    try {
      const cliSnap = await getDoc(doc(db, 'clientes', id));
      if (!cliSnap.exists()) {
        toast.error('Cliente não encontrado.');
        navigate('/clientes');
        return;
      }

      const cliData = { id: cliSnap.id, ...(cliSnap.data() as Omit<Cliente, 'id'>) };
      setCliente(cliData);
      setFormEdit({
        nomeCompleto: cliData.nomeCompleto || '',
        cpf: cliData.cpf || '',
        telefone: cliData.telefone || '',
        dataNascimento: cliData.dataNascimento || '',
      });

      const qVendas = query(
        collection(db, 'vendas'),
        where('userId', '==', user.uid),
        where('clienteId', '==', id)
      );
      const vendasSnap = await getDocs(qVendas);
      const listaVendas = vendasSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<VendaConsorcio, 'id'>) }))
        .sort((a, b) => extrairTimestamp(b.dataVenda) - extrairTimestamp(a.dataVenda));

      setVendas(listaVendas);

      const vendaIds = new Set(listaVendas.map((v) => v.id));
      if (vendaIds.size > 0) {
        const qParcelas = query(collection(db, 'parcelas'), where('userId', '==', user.uid));
        const parcelasSnap = await getDocs(qParcelas);
        const listaParcelas = parcelasSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ParcelaComissao, 'id'>) }))
          .filter((p) => vendaIds.has(p.vendaId))
          .sort((a, b) => {
            const [mesA, anoA] = a.mesAnoReferencia.split('/').map(Number);
            const [mesB, anoB] = b.mesAnoReferencia.split('/').map(Number);
            if (anoA !== anoB) return anoA - anoB;
            if (mesA !== mesB) return mesA - mesB;
            return a.numeroParcela - b.numeroParcela;
          });
        setParcelas(listaParcelas);
      } else {
        setParcelas([]);
      }
    } catch (error) {
      toast.error('Erro ao carregar dados do cliente.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarFichaCompleta();
  }, [id, user?.uid]);

  const handleTogglePagamentoParcela = async (parcela: ParcelaComissao, confirmar: boolean) => {
    if (!parcela.id) return;
    setProcessandoParcelaId(parcela.id);
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
          ? `Parcela ${parcela.numeroParcela} marcada como PAGA! Comissão de ${parcela.mesAnoReferencia} confirmada.`
          : `Confirmação da parcela ${parcela.numeroParcela} desfeita.`
      );
    } catch (error) {
      toast.error('Erro ao atualizar status da parcela.');
    } finally {
      setProcessandoParcelaId(null);
    }
  };

  const handleSalvarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'clientes', id), {
        nomeCompleto: formEdit.nomeCompleto.trim(),
        cpf: formEdit.cpf,
        telefone: formEdit.telefone,
        dataNascimento: formEdit.dataNascimento,
      });
      toast.success('Dados do cliente atualizados!');
      setEditando(false);
      await carregarFichaCompleta();
    } catch (error) {
      toast.error('Erro ao salvar alterações.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirCredito = async (venda: VendaConsorcio) => {
    if (!venda.id) return;
    if (
      !window.confirm(
        `Remover a cota ${venda.cota} (Grupo ${venda.grupo}) no valor de ${formatarMoeda(venda.valorTotalCarta)}?`
      )
    ) {
      return;
    }
    try {
      await excluirVendaDoBanco(venda.id);
      toast.success('Carta/venda removida!');
      await carregarFichaCompleta();
    } catch (error) {
      toast.error('Erro ao excluir venda.');
    }
  };

  const formatarMoeda = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatarData = (data: any) => {
    if (!data) return '-';
    if (typeof data === 'string' && data.includes('-')) {
      return data.split('-').reverse().join('/');
    }
    const d = data instanceof Date ? data : new Date(data.seconds ? data.seconds * 1000 : data);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
  };

  const calcularIdade = (dataISO?: string) => {
    if (!dataISO) return null;
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const hoje = new Date();
    let idade = hoje.getFullYear() - ano;
    if (
      hoje.getMonth() + 1 < mes ||
      (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)
    ) {
      idade--;
    }
    return idade;
  };

  if (carregando) {
    return (
      <div className="p-8 text-center text-red-500 font-bold animate-pulse">
        Carregando ficha completa do cliente...
      </div>
    );
  }

  if (!cliente) return null;

  const totalCredito = vendas.reduce((acc, v) => acc + v.valorTotalCarta, 0);
  const totalComissao = vendas.reduce((acc, v) => acc + v.valorComissaoTotal, 0);
  const comissaoConfirmada = parcelas
    .filter((p) => isParcelaConfirmada(p))
    .reduce((acc, p) => acc + p.valorReceber, 0);
  const whatsappLimpo = (cliente.telefone || '').replace(/\D/g, '');
  const idade = calcularIdade(cliente.dataNascimento);

  const getDescricaoCarta = (vendaId: string) => {
    const v = vendas.find((item) => item.id === vendaId);
    return v ? `${v.tipoCarta} • Gr ${v.grupo} / Cota ${v.cota}` : '';
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      {/* Navegação Superior */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <button
          onClick={() => navigate('/clientes')}
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para Carteira
        </button>

        <div className="flex items-center gap-3">
          {whatsappLimpo && (
            <a
              href={`https://wa.me/55${whatsappLimpo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-4 py-2 rounded-xl transition-colors"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
          <button
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl transition-colors"
          >
            <Edit2 size={16} /> Editar Cadastro
          </button>
        </div>
      </div>

      {/* Cabeçalho do Perfil */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 mb-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-black text-2xl shrink-0">
              {cliente.nomeCompleto.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">
                {cliente.nomeCompleto}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Cliente desde {formatarData(cliente.dataCadastro)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-black/30 p-4 rounded-2xl border border-white/5">
            <div>
              <p className="text-[10px] uppercase text-gray-500 font-bold flex items-center gap-1">
                <CreditCard size={12} /> CPF
              </p>
              <p className="text-sm font-bold text-white mt-0.5">{cliente.cpf || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500 font-bold flex items-center gap-1">
                <Phone size={12} /> Telefone
              </p>
              <p className="text-sm font-bold text-white mt-0.5">{cliente.telefone || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500 font-bold flex items-center gap-1">
                <Calendar size={12} /> Nascimento
              </p>
              <p className="text-sm font-bold text-white mt-0.5">
                {formatarData(cliente.dataNascimento)}
                {idade !== null && <span className="text-xs text-gray-400 font-normal"> ({idade} anos)</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs de Créditos com a Empresa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Layers size={14} className="text-blue-400" /> Volume Total em Créditos
          </p>
          <p className="text-2xl font-black text-blue-400 mt-2">{formatarMoeda(totalCredito)}</p>
        </div>

        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <FileText size={14} className="text-white" /> Cotas Adquiridas
          </p>
          <p className="text-2xl font-black text-white mt-2">{vendas.length}</p>
        </div>

        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" /> Comissão Confirmada
          </p>
          <p className="text-2xl font-black text-emerald-400 mt-2">{formatarMoeda(comissaoConfirmada)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">De {formatarMoeda(totalComissao)} previstos</p>
        </div>

        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Award size={14} className="text-amber-400" /> Aguardando Cliente
          </p>
          <p className="text-2xl font-black text-amber-400 mt-2">
            {formatarMoeda(Math.max(totalComissao - comissaoConfirmada, 0))}
          </p>
        </div>
      </div>

      {/* Tabela de Créditos / Cartas do Cliente */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg mb-8">
        <h2 className="text-xl font-bold text-white mb-6">Créditos & Cotas Conosco</h2>

        {vendas.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum crédito registrado para este cliente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/60 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Data da Venda</th>
                  <th className="px-4 py-3">Segmento</th>
                  <th className="px-4 py-3">Grupo / Cota</th>
                  <th className="px-4 py-3">Crédito Contratado</th>
                  <th className="px-4 py-3">Regra de Comissão</th>
                  <th className="px-4 py-3">Comissão Total</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {vendas.map((v) => (
                  <tr key={v.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-xs text-gray-400">{formatarData(v.dataVenda)}</td>
                    <td className="px-4 py-3 font-bold text-white">{v.tipoCarta}</td>
                    <td className="px-4 py-3">
                      Grupo: <strong>{v.grupo}</strong> | Cota: <strong>{v.cota}</strong>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-400">
                      {formatarMoeda(v.valorTotalCarta)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {v.planoComissaoNome || `${v.qtdParcelasComissao || 13}x`}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-400">
                      {formatarMoeda(v.valorComissaoTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleExcluirCredito(v)}
                        title="Excluir carta duplicada"
                        className="text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cronograma de Parcelas & Confirmação de Pagamento ("Pago") */}
      {parcelas.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                Controle de Parcelas & Liberação de Comissão ({parcelas.length} parcelas)
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                A 1ª parcela já vem confirmada pelo fechamento do contrato. A partir da 2ª, clique em <strong className="text-emerald-400">"Pago"</strong> quando o cliente quitar a mensalidade para confirmar sua comissão.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {parcelas.map((p) => {
              const confirmada = isParcelaConfirmada(p);
              const ehPrimeira = p.numeroParcela === 1;
              const carregandoItem = processandoParcelaId === p.id;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                    confirmada
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-black/40 border-white/10 hover:border-amber-500/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-black text-white">
                        Parcela {p.numeroParcela}
                      </span>
                      <span className="text-[11px] font-bold bg-white/10 text-gray-200 px-2 py-0.5 rounded">
                        {p.mesAnoReferencia}
                      </span>
                    </div>

                    {vendas.length > 1 && (
                      <p className="text-[10px] text-gray-400 truncate mb-1">
                        {getDescricaoCarta(p.vendaId)}
                      </p>
                    )}

                    <p
                      className={`text-lg font-black ${
                        confirmada ? 'text-emerald-400' : 'text-gray-200'
                      }`}
                    >
                      {formatarMoeda(p.valorReceber)}
                    </p>
                  </div>

                  {/* Ação / Status da Parcela */}
                  {ehPrimeira ? (
                    <div className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={13} /> Contrato Fechado ✓
                    </div>
                  ) : confirmada ? (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-500/20">
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Comissão Confirmada
                      </span>
                      <button
                        type="button"
                        disabled={carregandoItem}
                        onClick={() => handleTogglePagamentoParcela(p, false)}
                        title="Desfazer confirmação"
                        className="text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded inline-flex items-center gap-1"
                      >
                        <RotateCcw size={10} /> Desfazer
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={carregandoItem}
                      onClick={() => handleTogglePagamentoParcela(p, true)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow"
                    >
                      <CheckCircle2 size={14} />
                      {carregandoItem ? 'Confirmando...' : 'Pago'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-md relative">
            <button
              onClick={() => setEditando(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Editar Dados Cadastrais</h2>

            <form onSubmit={handleSalvarDados} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome Completo *</label>
                <input
                  required
                  type="text"
                  value={formEdit.nomeCompleto}
                  onChange={(e) => setFormEdit({ ...formEdit, nomeCompleto: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">CPF *</label>
                <input
                  required
                  type="text"
                  value={formEdit.cpf}
                  onChange={(e) => setFormEdit({ ...formEdit, cpf: mascaraCPF(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Telefone *</label>
                <input
                  required
                  type="text"
                  value={formEdit.telefone}
                  onChange={(e) =>
                    setFormEdit({ ...formEdit, telefone: mascaraTelefone(e.target.value) })
                  }
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data de Nascimento *</label>
                <input
                  required
                  type="date"
                  value={formEdit.dataNascimento}
                  onChange={(e) => setFormEdit({ ...formEdit, dataNascimento: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors"
              >
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
