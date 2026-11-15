import React, { useState, useEffect } from 'react';
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

export default function FormularioVenda({
  onVendaSalva,
  vendaEditando,
  onCancelarEdicao,
}: FormularioVendaProps) {
  const { user } = useAuthStore();
  const [cliente, setCliente] = useState('');
  const [valorCarta, setValorCarta] = useState('');
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0]);
  const [cota, setCota] = useState('');
  const [grupo, setGrupo] = useState('');
  const [tipoCarta, setTipoCarta] = useState<TipoCartaConsorcio | ''>('');
  const [planoComissaoId, setPlanoComissaoId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listaClientes, setListaClientes] = useState<Cliente[]>([]);
  const [planosComissao, setPlanosComissao] = useState<PlanoComissao[]>([]);

  useEffect(() => {
    const carregarIniciais = async () => {
      const clientesDoBanco = await buscarClientes();
      setListaClientes(clientesDoBanco);

      if (user?.uid) {
        const planos = await buscarOuInicializarPlanos(user.uid);
        setPlanosComissao(planos);
        if (planos.length > 0) setPlanoComissaoId(planos[0].id || '');
      }
    };
    carregarIniciais();
  }, [user?.uid]);

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
      setCota(vendaEditando.cota);
      setGrupo(vendaEditando.grupo);
      setTipoCarta(vendaEditando.tipoCarta);
      if (vendaEditando.planoComissaoId) setPlanoComissaoId(vendaEditando.planoComissaoId);
    }
  }, [vendaEditando]);

  const limparFormulario = () => {
    setCliente('');
    setValorCarta('');
    setDataVenda(new Date().toISOString().split('T')[0]);
    setCota('');
    setGrupo('');
    setTipoCarta('');
    if (planosComissao.length > 0) setPlanoComissaoId(planosComissao[0].id || '');
    if (onCancelarEdicao) onCancelarEdicao();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valorLimpoCarta = parseFloat(valorCarta.replace(/[R$\s.]/g, '').replace(',', '.'));
    const planoEscolhido = planosComissao.find((p) => p.id === planoComissaoId);

    if (!cliente || isNaN(valorLimpoCarta) || !dataVenda || !cota || !grupo || !tipoCarta || !planoEscolhido) {
      alert('Por favor, preencha todos os campos corretamente.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (vendaEditando && vendaEditando.id) {
        await atualizarVendaNoBanco(vendaEditando.id, {
          clienteId: cliente,
          cota,
          grupo,
          tipoCarta,
        });
        alert('Venda atualizada com sucesso!');
      } else {
        if (!user?.uid) throw new Error('Usuário não autenticado');

        await registrarVendaUnificada({
          userId: user.uid,
          clienteId: cliente,
          valorTotalCarta: valorLimpoCarta,
          tipoCarta,
          grupo,
          cota,
          dataVendaISO: dataVenda,
          plano: planoEscolhido,
        });

        alert('Venda e parcelas de comissão registradas com sucesso!');
      }

      limparFormulario();
      if (onVendaSalva) onVendaSalva();
    } catch (error) {
      alert('Ocorreu um erro ao salvar a venda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simulação em tempo real
  const planoAtual = planosComissao.find((p) => p.id === planoComissaoId);
  const valorNumero = parseFloat(valorCarta.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  const simulacao =
    !vendaEditando && planoAtual && valorNumero > 0 && dataVenda
      ? calcularCronogramaComissao(valorNumero, dataVenda, planoAtual)
      : null;

  return (
    <div
      className={`w-full mx-auto p-6 border rounded-xl shadow-lg transition-colors ${
        vendaEditando ? 'bg-red-900/20 border-red-500/50' : 'bg-dark-card border-dark-border'
      }`}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">
          {vendaEditando ? 'Editando Venda' : 'Nova Venda (Cliente Ativo)'}
        </h2>
        {vendaEditando && (
          <button
            type="button"
            onClick={limparFormulario}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Cliente *</label>
          <select
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="" disabled>
              Selecione o cliente...
            </option>
            {listaClientes.map((cli) => (
              <option key={cli.id} value={cli.id}>
                {cli.nomeCompleto}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Tipo de Carta *</label>
            <select
              className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none"
              value={tipoCarta}
              onChange={(e) => setTipoCarta(e.target.value as TipoCartaConsorcio)}
              disabled={isSubmitting}
            >
              <option value="" disabled>
                Selecione...
              </option>
              <option value="Imobiliária">Imobiliária</option>
              <option value="Automotiva">Automotiva</option>
              <option value="Serviços">Serviços</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Data da Venda *</label>
            <input
              type="date"
              className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none disabled:opacity-50"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
              disabled={isSubmitting || !!vendaEditando}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Valor da Carta *</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none disabled:opacity-50"
            value={valorCarta}
            onChange={(e) => setValorCarta(mascaraMoeda(e.target.value))}
            disabled={isSubmitting || !!vendaEditando}
            placeholder="R$ 0,00"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Grupo *</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              disabled={isSubmitting}
              placeholder="1050"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Cota *</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none"
              value={cota}
              onChange={(e) => setCota(e.target.value)}
              disabled={isSubmitting}
              placeholder="12A"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-emerald-400 mb-1">
            Comissionamento *
          </label>
          <select
            className="w-full px-4 py-2 bg-black/40 border border-emerald-500/30 rounded-md text-white focus:border-emerald-500 outline-none disabled:opacity-50"
            value={planoComissaoId}
            onChange={(e) => setPlanoComissaoId(e.target.value)}
            disabled={isSubmitting || !!vendaEditando}
          >
            {planosComissao.map((plano) => (
              <option key={plano.id} value={plano.id}>
                {plano.nome}
              </option>
            ))}
          </select>
        </div>

        {simulacao && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-gray-300 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Comissão Total:</span>
              <strong className="text-emerald-400">
                {simulacao.valorComissaoTotal.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Início do recebimento (dia 15):</span>
              <strong className="text-white">{simulacao.parcelas[0]?.mesAnoReferencia}</strong>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-red-600 text-white font-bold py-3 rounded-md hover:bg-red-700 transition mt-2"
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
