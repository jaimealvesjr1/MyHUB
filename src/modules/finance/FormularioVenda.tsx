// Arquivo: src/modules/finance/FormularioVenda.tsx
import React, { useState, useEffect } from 'react';
import { VendaConsorcio, TipoCartaConsorcio, Cliente } from '../../types/models';
import { gerarParcelas } from '../../utils/calculadora';
import { salvarVendaNoBanco, atualizarVendaNoBanco } from '../../services/vendasService';
import { buscarClientes } from '../../services/clienteService';
import { mascaraMoeda } from '../../utils/mascaras';

interface FormularioVendaProps {
  onVendaSalva?: () => void; 
  vendaEditando?: VendaConsorcio | null;
  onCancelarEdicao?: () => void;
}

export default function FormularioVenda({ onVendaSalva, vendaEditando, onCancelarEdicao }: FormularioVendaProps) {
  const [cliente, setCliente] = useState('');
  const [valorCarta, setValorCarta] = useState('');
  const [dataVenda, setDataVenda] = useState('');
  const [cota, setCota] = useState('');
  const [grupo, setGrupo] = useState('');
  const [tipoCarta, setTipoCarta] = useState<TipoCartaConsorcio | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listaClientes, setListaClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    const carregarClientes = async () => {
      const clientesDoBanco = await buscarClientes();
      setListaClientes(clientesDoBanco);
    };
    carregarClientes();
  }, []);

  useEffect(() => {
    if (vendaEditando) {
      setCliente(vendaEditando.clienteId);
      setValorCarta(mascaraMoeda(vendaEditando.valorTotalCarta.toFixed(2).replace('.', '')));
      
      let dataFormatada = '';
      if (vendaEditando.dataVenda) {
        const d = vendaEditando.dataVenda instanceof Date 
          ? vendaEditando.dataVenda 
          : new Date((vendaEditando.dataVenda as any).seconds ? (vendaEditando.dataVenda as any).seconds * 1000 : vendaEditando.dataVenda);
        
        if (!isNaN(d.getTime())) {
          dataFormatada = d.toISOString().split('T')[0];
        }
      }
      
      setDataVenda(dataFormatada);
      setCota(vendaEditando.cota);
      setGrupo(vendaEditando.grupo);
      setTipoCarta(vendaEditando.tipoCarta);
    }
  }, [vendaEditando]);

  const limparFormulario = () => {
    setCliente(''); setValorCarta(''); setDataVenda('');
    setCota(''); setGrupo(''); setTipoCarta('');
    if (onCancelarEdicao) onCancelarEdicao();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valorLimpo = valorCarta.replace(/[R$\s.]/g, '').replace(',', '.');
    const valorTotalNumber = parseFloat(valorLimpo);

    if (!cliente || isNaN(valorTotalNumber) || !dataVenda || !cota || !grupo || !tipoCarta) {
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
          tipoCarta
        });
        alert('Venda atualizada com sucesso!');
      } else {
        const taxaComissaoAtual = 1.5; 
        const valorComissaoCalculada = valorTotalNumber * (taxaComissaoAtual / 100);

        const novaVenda: VendaConsorcio = {
          userId: 'id_do_usuario_logado_aqui',
          clienteId: cliente,
          valorTotalCarta: valorTotalNumber,
          cota, grupo, tipoCarta,
          dataVenda: new Date(dataVenda),
          taxaAplicadaNaVenda: taxaComissaoAtual,
          valorComissaoTotal: valorComissaoCalculada,
        };

        const parcelasGeradas = gerarParcelas(novaVenda);
        await salvarVendaNoBanco(novaVenda, parcelasGeradas);
        alert('Venda registrada com sucesso!');
      }

      limparFormulario();
      if (onVendaSalva) onVendaSalva();
      
    } catch (error) {
      alert('Ocorreu um erro ao salvar a venda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full mx-auto p-6 md:p-8 border rounded-xl shadow-lg transition-colors ${vendaEditando ? 'bg-red-900/20 border-red-500/50' : 'bg-dark-card border-dark-border'}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          {vendaEditando ? 'Editando Venda' : 'Registrar Nova Venda'}
        </h2>
        {vendaEditando && (
          <button type="button" onClick={limparFormulario} className="text-sm text-gray-400 hover:text-white transition-colors">
            Cancelar Edição
          </button>
        )}
      </div>
      
      {/* 
        AQUI ESTÁ A MÁGICA DO LAYOUT:
        Alteramos para grid-cols-1 (mobile) e md:grid-cols-6 (telas maiores) 
      */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-5">
        
        {/* Cliente: Ocupa as 6 colunas (100%) */}
        <div className="md:col-span-6">
          <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
          <select
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="" disabled>Selecione um cliente...</option>
            {listaClientes.map((cli) => (
              <option key={cli.id} value={cli.id}>{cli.nomeCompleto} - CPF: {cli.cpf}</option>
            ))}
          </select>
        </div>

        {/* Tipo de Carta: Ocupa 3 colunas (50%) */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Tipo de Carta</label>
          <select
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none"
            value={tipoCarta}
            onChange={(e) => setTipoCarta(e.target.value as TipoCartaConsorcio)}
            disabled={isSubmitting}
          >
            <option value="" disabled>Selecione...</option>
            <option value="Imobiliária">Imobiliária</option>
            <option value="Automotiva">Automotiva</option>
            <option value="Serviços">Serviços</option>
          </select>
        </div>

        {/* Valor da Carta: Ocupa 3 colunas (50%) */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Valor da Carta</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none disabled:opacity-50"
            value={valorCarta}
            onChange={(e) => setValorCarta(mascaraMoeda(e.target.value))}
            disabled={isSubmitting || !!vendaEditando}
            placeholder="R$ 0,00"
          />
        </div>

        {/* Data da Venda: Ocupa 2 colunas (33.3%) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Data da Venda</label>
          <input
            type="date"
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none disabled:opacity-50"
            value={dataVenda}
            onChange={(e) => setDataVenda(e.target.value)}
            disabled={isSubmitting || !!vendaEditando}
          />
        </div>

        {/* Grupo: Ocupa 2 colunas (33.3%) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Grupo</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none" 
            value={grupo} 
            onChange={(e) => setGrupo(e.target.value)} 
            disabled={isSubmitting} 
            placeholder="Ex: 1050"
          />
        </div>

        {/* Cota: Ocupa 2 colunas (33.3%) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Cota</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-md text-white focus:border-red-500 outline-none" 
            value={cota} 
            onChange={(e) => setCota(e.target.value)} 
            disabled={isSubmitting} 
            placeholder="Ex: 12A"
          />
        </div>

        {/* Botão Salvar: Ocupa as 6 colunas (100%) */}
        <div className="md:col-span-6 mt-2">
          <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-bold py-3 rounded-md hover:bg-red-700 transition">
            {isSubmitting ? 'Processando...' : vendaEditando ? 'Salvar Alterações' : 'Registrar Venda e Projetar Comissões'}
          </button>
        </div>
      </form>
    </div>
  );
}
