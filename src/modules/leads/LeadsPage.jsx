import React, { useState, useEffect } from 'react';
import {
    CalendarDays, Clock, StickyNote, Plus,
    ChevronRight, ChevronLeft, CheckCircle, Phone,
    AlertCircle, FileText, Target, RefreshCw,
    Trash2, Edit2, X, Tag, DollarSign, UserCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
    collection, onSnapshot, addDoc, updateDoc, deleteDoc,
    doc, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
    buscarOuInicializarPlanos,
    calcularCronogramaComissao,
    registrarVendaUnificada
} from '../../utils/comissaoEngine';

// ============================================================================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO
// ============================================================================
function formatarMoeda(valor) {
    const apenasDigitos = String(valor).replace(/\D/g, '');
    if (!apenasDigitos) return '';
    const numero = Number(apenasDigitos) / 100;
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function moedaParaNumero(valorFormatado) {
    if (!valorFormatado) return 0;
    const limpo = String(valorFormatado).replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
}

function formatarTelefone(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function formatarCPF(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function limparDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function formatarDataBR(dataISO) {
    if (!dataISO) return '--/--/----';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export default function LeadsPage() {
    const { user } = useAuthStore();
    const dataHojeISO = new Date().toISOString().split('T')[0];

    const [leads, setLeads] = useState([]);
    const [reunioes, setReunioes] = useState([]);
    const [anotacoes, setAnotacoes] = useState([]);
    const [clientesExistentes, setClientesExistentes] = useState([]);
    const [planosComissao, setPlanosComissao] = useState([]);
    const [carregando, setCarregando] = useState(true);

    // Formulário de Novo Lead (suporta novo lead ou recompra rápida de cliente ativo)
    const [novoLead, setNovoLead] = useState({
        nome: '',
        telefone: '',
        dataChegada: dataHojeISO,
        origem: 'Network',
        clienteExistenteId: ''
    });

    const [novaAnotacao, setNovaAnotacao] = useState('');

    // Controles dos Modais
    const [modalAtivo, setModalAtivo] = useState(null); // 'contato' | 'proposta' | 'fechado' | 'converter' | 'reuniaoManual'
    const [leadSelecionado, setLeadSelecionado] = useState(null);

    const [dadosContato, setDadosContato] = useState({ data: dataHojeISO, hora: '' });
    const [valorNegociadoInput, setValorNegociadoInput] = useState('');

    // Modal 3: Fechamento + Dados Complementares do Cliente
    const [dadosFechamento, setDadosFechamento] = useState({
        valorFechado: '',
        nomeCompleto: '',
        telefone: '',
        cpf: '',
        dataNascimento: '',
        clienteExistenteId: ''
    });

    const [formReuniaoManual, setFormReuniaoManual] = useState({
        titulo: '',
        participante: '',
        data: dataHojeISO,
        hora: ''
    });

    // Modal 4: Registro Final da Venda & Comissionamento
    const [formConversao, setFormConversao] = useState({
        nomeCompleto: '',
        telefone: '',
        cpf: '',
        dataNascimento: '',
        clienteExistenteId: '',
        tipoCarta: 'Imobiliária',
        valorTotalCarta: '',
        dataVenda: dataHojeISO,
        grupo: '',
        cota: '',
        planoComissaoId: ''
    });

    // ========================================================================
    // BUSCA EM TEMPO REAL + CARREGAMENTO DOS PLANOS DE COMISSÃO
    // ========================================================================
    useEffect(() => {
        if (!user?.uid) return;

        buscarOuInicializarPlanos(user.uid).then((listaPlanos) => {
            setPlanosComissao(listaPlanos);
        });

        const qLeads = query(collection(db, 'leads'), where('responsavelId', '==', user.uid));
        const unsubLeads = onSnapshot(qLeads, (snapshot) => {
            const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setLeads(lista);
            setCarregando(false);
        });

        const qAnotacoes = query(collection(db, 'anotacoes'), where('responsavelId', '==', user.uid));
        const unsubAnotacoes = onSnapshot(qAnotacoes, (snapshot) => {
            const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setAnotacoes(lista);
        });

        const qReunioes = query(collection(db, 'reunioes'), where('responsavelId', '==', user.uid));
        const unsubReunioes = onSnapshot(qReunioes, (snapshot) => {
            const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
            setReunioes(lista);
        });

        const qClientes = query(collection(db, 'clientes'), where('userId', '==', user.uid));
        const unsubClientes = onSnapshot(qClientes, (snapshot) => {
            setClientesExistentes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubLeads();
            unsubAnotacoes();
            unsubReunioes();
            unsubClientes();
        };
    }, [user?.uid]);

    // ========================================================================
    // CRUD DE LEADS (COM SUPORTE A RECOMPRA DE CLIENTE ATIVO)
    // ========================================================================
    const handleSelecionarClienteRecompraNoTopo = (clienteId) => {
        if (!clienteId) {
            setNovoLead({ ...novoLead, clienteExistenteId: '' });
            return;
        }
        const cli = clientesExistentes.find(c => c.id === clienteId);
        if (cli) {
            setNovoLead({
                ...novoLead,
                nome: cli.nomeCompleto,
                telefone: cli.telefone || '',
                origem: 'Recompra',
                clienteExistenteId: cli.id
            });
        }
    };

    const handleAddLead = async (e) => {
        e.preventDefault();
        if (!novoLead.nome.trim() || !novoLead.telefone.trim() || !novoLead.dataChegada || !novoLead.origem) {
            return toast.error('Preencha Nome, Telefone, Data de Chegada e Origem.');
        }

        const cliVinculado = novoLead.clienteExistenteId
            ? clientesExistentes.find(c => c.id === novoLead.clienteExistenteId)
            : null;

        try {
            await addDoc(collection(db, 'leads'), {
                nome: novoLead.nome.trim(),
                nomeCompleto: cliVinculado ? cliVinculado.nomeCompleto : novoLead.nome.trim(),
                telefone: novoLead.telefone,
                cpf: cliVinculado?.cpf || '',
                dataNascimento: cliVinculado?.dataNascimento || '',
                clienteExistenteId: cliVinculado?.id || '',
                dataChegada: novoLead.dataChegada,
                origem: novoLead.origem,
                status: 'novo',
                dataReuniao: '',
                horaReuniao: '',
                valorNegociado: '',
                valorFechado: '',
                createdAt: serverTimestamp(),
                responsavelId: user.uid
            });

            setNovoLead({
                nome: '',
                telefone: '',
                dataChegada: dataHojeISO,
                origem: 'Network',
                clienteExistenteId: ''
            });
            toast.success(cliVinculado ? 'Oportunidade de recompra adicionada!' : 'Novo Lead cadastrado!');
        } catch (error) {
            toast.error('Erro ao cadastrar lead.');
        }
    };

    const editarLead = async (lead) => {
        const novoNome = window.prompt('Editar nome do Lead:', lead.nome);
        if (novoNome && novoNome.trim() !== '') {
            await updateDoc(doc(db, 'leads', lead.id), {
                nome: novoNome.trim(),
                nomeCompleto: novoNome.trim()
            });
            toast.success('Nome atualizado!');
        }
    };

    const excluirLead = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este Lead?')) {
            await deleteDoc(doc(db, 'leads', id));
            toast.success('Lead removido!');
        }
    };

    // ========================================================================
    // TRAVAS DE AVANÇO DO FUNIL
    // ========================================================================
    const iniciarMovimentoLead = async (lead, direcao) => {
        const estagios = ['novo', 'contato', 'proposta', 'fechado'];
        const indexAtual = estagios.indexOf(lead.status);

        if (direcao === 'tras') {
            const indexAnterior = Math.max(indexAtual - 1, 0);
            if (estagios[indexAnterior] !== lead.status) {
                await updateDoc(doc(db, 'leads', lead.id), { status: estagios[indexAnterior] });
                toast('Lead retornado para etapa anterior.');
            }
            return;
        }

        setLeadSelecionado(lead);

        if (lead.status === 'novo') {
            setDadosContato({ data: lead.dataReuniao || dataHojeISO, hora: lead.horaReuniao || '' });
            setModalAtivo('contato');
        } else if (lead.status === 'contato') {
            setValorNegociadoInput(lead.valorNegociado || '');
            setModalAtivo('proposta');
        } else if (lead.status === 'proposta') {
            // Se já tiver cliente vinculado, puxa os dados dele automaticamente
            const cliVinculado = lead.clienteExistenteId
                ? clientesExistentes.find(c => c.id === lead.clienteExistenteId)
                : null;

            setDadosFechamento({
                valorFechado: lead.valorFechado || lead.valorNegociado || '',
                nomeCompleto: cliVinculado?.nomeCompleto || lead.nomeCompleto || lead.nome || '',
                telefone: cliVinculado?.telefone || lead.telefone || '',
                cpf: cliVinculado?.cpf || lead.cpf || '',
                dataNascimento: cliVinculado?.dataNascimento || lead.dataNascimento || '',
                clienteExistenteId: cliVinculado?.id || lead.clienteExistenteId || ''
            });
            setModalAtivo('fechado');
        }
    };

    const confirmarAvancoContato = async (e) => {
        e.preventDefault();
        if (!dadosContato.data || !dadosContato.hora) {
            return toast.error('Data e horário da reunião são obrigatórios!');
        }

        try {
            await addDoc(collection(db, 'reunioes'), {
                titulo: 'Reunião de Contato',
                cliente: leadSelecionado.nome,
                data: dadosContato.data,
                hora: dadosContato.hora,
                createdAt: serverTimestamp(),
                responsavelId: user.uid
            });

            await updateDoc(doc(db, 'leads', leadSelecionado.id), {
                status: 'contato',
                dataReuniao: dadosContato.data,
                horaReuniao: dadosContato.hora
            });

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success('Reunião agendada e Lead movido para Em Contato!');
        } catch (error) {
            toast.error('Erro ao salvar reunião.');
        }
    };

    const confirmarAvancoProposta = async (e) => {
        e.preventDefault();
        if (moedaParaNumero(valorNegociadoInput) <= 0) {
            return toast.error('Informe um valor negociado válido!');
        }

        try {
            await updateDoc(doc(db, 'leads', leadSelecionado.id), {
                status: 'proposta',
                valorNegociado: valorNegociadoInput
            });

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success('Proposta registrada e Lead avançado!');
        } catch (error) {
            toast.error('Erro ao salvar valor negociado.');
        }
    };

    // Ao digitar CPF no Modal 3, verifica se já pertence a um cliente existente
    const handleCpfFechamentoChange = (valorDigitado) => {
        const cpfFormatado = formatarCPF(valorDigitado);
        const digitos = limparDigitos(cpfFormatado);

        if (digitos.length === 11) {
            const clienteEncontrado = clientesExistentes.find(
                c => limparDigitos(c.cpf) === digitos
            );
            if (clienteEncontrado) {
                setDadosFechamento({
                    ...dadosFechamento,
                    cpf: cpfFormatado,
                    nomeCompleto: clienteEncontrado.nomeCompleto,
                    telefone: clienteEncontrado.telefone || dadosFechamento.telefone,
                    dataNascimento: clienteEncontrado.dataNascimento || dadosFechamento.dataNascimento,
                    clienteExistenteId: clienteEncontrado.id
                });
                toast.success(`Cliente "${clienteEncontrado.nomeCompleto}" reconhecido! Modo recompra ativado.`);
                return;
            }
        }

        setDadosFechamento({
            ...dadosFechamento,
            cpf: cpfFormatado,
            clienteExistenteId: digitos.length < 11 ? '' : dadosFechamento.clienteExistenteId
        });
    };

    const handleSelecionarClienteNoModalFechamento = (clienteId) => {
        if (!clienteId) {
            setDadosFechamento({ ...dadosFechamento, clienteExistenteId: '' });
            return;
        }
        const cli = clientesExistentes.find(c => c.id === clienteId);
        if (cli) {
            setDadosFechamento({
                ...dadosFechamento,
                clienteExistenteId: cli.id,
                nomeCompleto: cli.nomeCompleto,
                telefone: cli.telefone || dadosFechamento.telefone,
                cpf: cli.cpf || '',
                dataNascimento: cli.dataNascimento || ''
            });
        }
    };

    /** Confirma Etapa 3 -> 4 (Exige Valor Fechado + Dados Complementares do Cliente) */
    const confirmarAvancoFechado = async (e) => {
        e.preventDefault();
        if (moedaParaNumero(dadosFechamento.valorFechado) <= 0) {
            return toast.error('Informe o valor fechado para concluir!');
        }
        if (
            !dadosFechamento.nomeCompleto.trim() ||
            !dadosFechamento.telefone.trim() ||
            limparDigitos(dadosFechamento.cpf).length !== 11 ||
            !dadosFechamento.dataNascimento
        ) {
            return toast.error('Preencha Nome Completo, Telefone, CPF válido e Data de Nascimento.');
        }

        try {
            await updateDoc(doc(db, 'leads', leadSelecionado.id), {
                status: 'fechado',
                nome: dadosFechamento.nomeCompleto.trim(),
                nomeCompleto: dadosFechamento.nomeCompleto.trim(),
                telefone: dadosFechamento.telefone,
                cpf: dadosFechamento.cpf,
                dataNascimento: dadosFechamento.dataNascimento,
                clienteExistenteId: dadosFechamento.clienteExistenteId || '',
                valorFechado: dadosFechamento.valorFechado
            });

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success('Negócio fechado e dados do cliente salvos! Clique em "Registrar Venda".');
        } catch (error) {
            toast.error('Erro ao fechar negócio.');
        }
    };

    // ========================================================================
    // CONVERSÃO FINAL NA COLUNA FECHADOS (CRIA/ATUALIZA CLIENTE + REGISTRA VENDA)
    // ========================================================================
    const abrirModalConversao = (lead) => {
        setLeadSelecionado(lead);
        setFormConversao({
            nomeCompleto: lead.nomeCompleto || lead.nome || '',
            telefone: lead.telefone || '',
            cpf: lead.cpf || '',
            dataNascimento: lead.dataNascimento || '',
            clienteExistenteId: lead.clienteExistenteId || '',
            tipoCarta: 'Imobiliária',
            valorTotalCarta: lead.valorFechado || '',
            dataVenda: dataHojeISO,
            grupo: '',
            cota: '',
            planoComissaoId: planosComissao[0]?.id || ''
        });
        setModalAtivo('converter');
    };

    const confirmarConversaoClienteEVenda = async (e) => {
        e.preventDefault();
        const valorCartaNum = moedaParaNumero(formConversao.valorTotalCarta);
        const planoEscolhido = planosComissao.find(p => p.id === formConversao.planoComissaoId);

        if (!formConversao.nomeCompleto || !formConversao.cpf || !formConversao.telefone || !formConversao.dataNascimento) {
            return toast.error('Confira os dados pessoais do cliente.');
        }
        if (valorCartaNum <= 0 || !formConversao.grupo || !formConversao.cota || !planoEscolhido) {
            return toast.error('Preencha todos os dados da venda e selecione o comissionamento.');
        }

        try {
            // 1. Verifica se é cliente existente (pelo ID vinculado ou pelo CPF) para NÃO duplicar
            const cpfLimpo = limparDigitos(formConversao.cpf);
            const clienteJaCadastrado = formConversao.clienteExistenteId
                ? clientesExistentes.find(c => c.id === formConversao.clienteExistenteId)
                : clientesExistentes.find(c => limparDigitos(c.cpf) === cpfLimpo);

            let clienteIdFinal = '';

            if (clienteJaCadastrado?.id) {
                // Atualiza os dados do cliente existente (Recompra)
                clienteIdFinal = clienteJaCadastrado.id;
                await updateDoc(doc(db, 'clientes', clienteIdFinal), {
                    nomeCompleto: formConversao.nomeCompleto.trim(),
                    telefone: formConversao.telefone,
                    cpf: formConversao.cpf,
                    dataNascimento: formConversao.dataNascimento
                });
            } else {
                // Cria um novo cliente na coleção 'clientes'
                const clienteRef = await addDoc(collection(db, 'clientes'), {
                    nomeCompleto: formConversao.nomeCompleto.trim(),
                    telefone: formConversao.telefone,
                    cpf: formConversao.cpf,
                    dataNascimento: formConversao.dataNascimento,
                    dataCadastro: new Date(),
                    userId: user.uid
                });
                clienteIdFinal = clienteRef.id;
            }

            // 2. Registra a Venda + Parcelas pelo motor unificado
            await registrarVendaUnificada({
                userId: user.uid,
                clienteId: clienteIdFinal,
                valorTotalCarta: valorCartaNum,
                tipoCarta: formConversao.tipoCarta,
                grupo: formConversao.grupo,
                cota: formConversao.cota,
                dataVendaISO: formConversao.dataVenda,
                plano: planoEscolhido
            });

            // 3. Remove o Lead do funil
            await deleteDoc(doc(db, 'leads', leadSelecionado.id));

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success(
                clienteJaCadastrado
                    ? 'Nova compra registrada para o cliente existente!'
                    : 'Cliente cadastrado e Venda registrada com sucesso!'
            );
        } catch (error) {
            console.error(error);
            toast.error('Erro ao registrar venda.');
        }
    };

    const planoSelecionadoAtual = planosComissao.find(p => p.id === formConversao.planoComissaoId);
    const valorCartaPreview = moedaParaNumero(formConversao.valorTotalCarta);
    const simulacaoPreview =
        planoSelecionadoAtual && valorCartaPreview > 0 && formConversao.dataVenda
            ? calcularCronogramaComissao(valorCartaPreview, formConversao.dataVenda, planoSelecionadoAtual)
            : null;

    // ========================================================================
    // ANOTAÇÕES E AGENDAMENTO MANUAL
    // ========================================================================
    const handleAddAnotacao = async (e) => {
        if (e.key === 'Enter' && novaAnotacao.trim()) {
            await addDoc(collection(db, 'anotacoes'), {
                texto: novaAnotacao.trim(),
                concluido: false,
                createdAt: serverTimestamp(),
                responsavelId: user.uid
            });
            setNovaAnotacao('');
        }
    };

    const toggleAnotacao = async (id, statusAtual) => {
        await updateDoc(doc(db, 'anotacoes', id), { concluido: !statusAtual });
    };

    const editarAnotacao = async (anotacao, e) => {
        e.stopPropagation();
        const novoTexto = window.prompt('Edite sua anotação:', anotacao.texto);
        if (novoTexto && novoTexto.trim() !== '') {
            await updateDoc(doc(db, 'anotacoes', anotacao.id), { texto: novoTexto.trim() });
        }
    };

    const excluirAnotacao = async (id, e) => {
        e.stopPropagation();
        await deleteDoc(doc(db, 'anotacoes', id));
    };

    const handleAgendarReuniaoManual = async (e) => {
        e.preventDefault();
        if (!formReuniaoManual.participante) {
            return toast.error('Selecione um Lead ou Cliente.');
        }
        try {
            await addDoc(collection(db, 'reunioes'), {
                titulo: formReuniaoManual.titulo,
                cliente: formReuniaoManual.participante,
                data: formReuniaoManual.data,
                hora: formReuniaoManual.hora,
                createdAt: serverTimestamp(),
                responsavelId: user.uid
            });
            setModalAtivo(null);
            setFormReuniaoManual({ titulo: '', participante: '', data: dataHojeISO, hora: '' });
            toast.success('Reunião agendada!');
        } catch (error) {
            toast.error('Erro ao agendar reunião.');
        }
    };

    const excluirReuniao = async (id) => {
        if (window.confirm('Cancelar e apagar esta reunião?')) {
            await deleteDoc(doc(db, 'reunioes', id));
            toast.success('Reunião removida!');
        }
    };

    const leadsNovo = leads.filter(l => l.status === 'novo');
    const leadsContato = leads.filter(l => l.status === 'contato');
    const leadsProposta = leads.filter(l => l.status === 'proposta');
    const leadsFechado = leads.filter(l => l.status === 'fechado');

    return (
        <div className="p-4 md:p-8 animate-in fade-in duration-300 relative">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white">
                    Gestão de <span className="text-red-600">Leads</span>
                </h1>
                <p className="text-gray-400 mt-2">
                    Avance seus leads cumprindo cada etapa comercial até o registro da venda.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* PIPELINE DE VENDAS */}
                <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
                    <div className="bg-dark-card border border-dark-border p-6 rounded-3xl shadow-lg flex flex-col min-h-150 lg:h-[calc(100vh-140px)]">
                        <div className="flex flex-col gap-4 mb-6 border-b border-white/5 pb-5 shrink-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Target size={20} className="text-red-600" /> Pipeline de Vendas
                                </h3>

                                {/* Atalho rápido para iniciar recompra de um cliente ativo */}
                                {clientesExistentes.length > 0 && (
                                    <select
                                        value={novoLead.clienteExistenteId}
                                        onChange={(e) => handleSelecionarClienteRecompraNoTopo(e.target.value)}
                                        className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs text-emerald-300 font-bold outline-none"
                                    >
                                        <option value="">+ Novo Lead ou Recompra de Cliente...</option>
                                        {clientesExistentes.map(cli => (
                                            <option key={cli.id} value={cli.id} className="bg-dark-bg text-white">
                                                Recompra: {cli.nomeCompleto}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <form onSubmit={handleAddLead} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                                <input
                                    type="text"
                                    required
                                    placeholder="Nome do Lead *"
                                    value={novoLead.nome}
                                    onChange={(e) => setNovoLead({ ...novoLead, nome: e.target.value })}
                                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                />
                                <input
                                    type="text"
                                    required
                                    placeholder="Telefone (00) 00000-0000 *"
                                    value={novoLead.telefone}
                                    onChange={(e) => setNovoLead({ ...novoLead, telefone: formatarTelefone(e.target.value) })}
                                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                />
                                <input
                                    type="date"
                                    required
                                    title="Data de Chegada"
                                    value={novoLead.dataChegada}
                                    onChange={(e) => setNovoLead({ ...novoLead, dataChegada: e.target.value })}
                                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                />
                                <select
                                    required
                                    value={novoLead.origem}
                                    onChange={(e) => setNovoLead({ ...novoLead, origem: e.target.value })}
                                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                >
                                    <option value="Network">Network</option>
                                    <option value="Rede Social">Rede Social</option>
                                    <option value="Indicação">Indicação</option>
                                    <option value="Recompra">Recompra</option>
                                    <option value="Outro">Outro</option>
                                </select>
                                <button
                                    type="submit"
                                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                                >
                                    <Plus size={16} /> Adicionar Lead
                                </button>
                            </form>
                        </div>

                        <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
                            {carregando ? (
                                <div className="flex justify-center items-center h-full text-red-500 animate-pulse font-bold">
                                    Carregando pipeline...
                                </div>
                            ) : (
                                <div className="flex gap-4 h-full min-w-225">
                                    {renderKanbanColumn('Novos Leads', leadsNovo, 'blue', iniciarMovimentoLead, abrirModalConversao, editarLead, excluirLead)}
                                    {renderKanbanColumn('Em Contato', leadsContato, 'amber', iniciarMovimentoLead, abrirModalConversao, editarLead, excluirLead)}
                                    {renderKanbanColumn('Proposta', leadsProposta, 'purple', iniciarMovimentoLead, abrirModalConversao, editarLead, excluirLead)}
                                    {renderKanbanColumn('Fechados', leadsFechado, 'emerald', iniciarMovimentoLead, abrirModalConversao, editarLead, excluirLead)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* BARRA LATERAL */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 sticky top-25">
                    <div className="bg-dark-card border border-dark-border p-6 rounded-3xl shadow-lg flex flex-col max-h-[45vh]">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 shrink-0">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <CalendarDays size={20} className="text-red-600" /> Reuniões
                            </h3>
                            <span className="bg-red-600/20 text-red-500 border border-red-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
                                {reunioes.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
                            {reunioes.length === 0 ? (
                                <p className="text-sm text-gray-500 italic text-center py-6">Nenhum compromisso.</p>
                            ) : (
                                reunioes.map(r => (
                                    <div key={r.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-2 group relative">
                                        <button onClick={() => excluirReuniao(r.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                        <h4 className="text-sm font-bold text-white pr-4">{r.titulo}</h4>
                                        <p className="text-xs text-gray-400 font-bold uppercase">{r.cliente}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-white/5 text-gray-300 text-[10px] font-black px-2 py-1 rounded">{formatarDataBR(r.data)}</span>
                                            <span className="bg-white/5 text-gray-300 text-[10px] font-black px-2 py-1 rounded">{r.hora}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => setModalAtivo('reuniaoManual')}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm font-bold py-2.5 rounded-xl transition-all mt-4 flex justify-center items-center gap-2 hover:text-white shrink-0"
                        >
                            <Plus size={16} /> Agendar Reunião
                        </button>
                    </div>

                    <div className="bg-dark-card border border-dark-border p-6 rounded-3xl shadow-lg flex flex-col flex-1 max-h-[45vh]">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 border-b border-white/5 pb-4 shrink-0">
                            <StickyNote className="text-red-600" size={20} /> Lembretes Rápidos
                        </h3>
                        <div className="mb-4 relative shrink-0">
                            <input
                                type="text"
                                value={novaAnotacao}
                                onChange={(e) => setNovaAnotacao(e.target.value)}
                                onKeyDown={handleAddAnotacao}
                                placeholder="Nova anotação e Enter..."
                                className="block w-full bg-black/50 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-red-500 transition-colors"
                            />
                            <Plus size={16} className="absolute left-3 top-2.5 text-gray-500" />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2">
                            {anotacoes.map(anot => (
                                <div
                                    key={anot.id}
                                    onClick={() => toggleAnotacao(anot.id, anot.concluido)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2 shrink-0 group relative ${anot.concluido ? 'bg-black/20 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-red-500/30'}`}
                                >
                                    <CheckCircle size={16} className={`mt-0.5 shrink-0 ${anot.concluido ? 'text-gray-600' : 'text-red-500'}`} />
                                    <p className={`text-sm flex-1 pr-12 ${anot.concluido ? 'line-through text-gray-500' : 'text-gray-300'}`}>{anot.texto}</p>
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => editarAnotacao(anot, e)} className="p-1 text-gray-500 hover:text-white bg-black/40 rounded"><Edit2 size={12} /></button>
                                        <button onClick={(e) => excluirAnotacao(anot.id, e)} className="p-1 text-gray-500 hover:text-red-500 bg-black/40 rounded"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL 1: CONTATO */}
            {modalAtivo === 'contato' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-md relative">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <CalendarDays className="text-amber-400" /> Agendar Contato
                        </h2>
                        <p className="text-xs text-gray-400 mb-6">
                            Para mover <strong className="text-white">{leadSelecionado.nome}</strong> para <em>Em Contato</em>, defina a data e horário da reunião.
                        </p>
                        <form onSubmit={confirmarAvancoContato} className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Data da Reunião *</label>
                                    <input required type="date" value={dadosContato.data} onChange={e => setDadosContato({ ...dadosContato, data: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Horário *</label>
                                    <input required type="time" value={dadosContato.hora} onChange={e => setDadosContato({ ...dadosContato, hora: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-amber-500" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors">
                                Confirmar Reunião e Avançar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: PROPOSTA */}
            {modalAtivo === 'proposta' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-md relative">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <DollarSign className="text-purple-400" /> Valor da Proposta
                        </h2>
                        <p className="text-xs text-gray-400 mb-6">
                            Informe o valor de crédito negociado com <strong className="text-white">{leadSelecionado.nome}</strong> para avançar.
                        </p>
                        <form onSubmit={confirmarAvancoProposta} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Valor Negociado *</label>
                                <input required type="text" placeholder="R$ 0,00" value={valorNegociadoInput} onChange={e => setValorNegociadoInput(formatarMoeda(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-lg font-bold outline-none focus:border-purple-500" />
                            </div>
                            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors">
                                Salvar Proposta e Avançar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: FECHADO + DADOS COMPLEMENTARES DO CLIENTE */}
            {modalAtivo === 'fechado' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-lg relative my-8">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <CheckCircle className="text-emerald-400" /> Fechar Negócio & Dados do Cliente
                        </h2>
                        <p className="text-xs text-gray-400 mb-5">
                            Confirme o valor fechado e preencha os dados complementares de <strong className="text-white">{leadSelecionado.nome}</strong>.
                        </p>

                        <form onSubmit={confirmarAvancoFechado} className="flex flex-col gap-4">
                            {/* Valor Fechado */}
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl">
                                <label className="block text-xs font-bold text-emerald-400 mb-1">Valor Fechado *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="R$ 0,00"
                                    value={dadosFechamento.valorFechado}
                                    onChange={e => setDadosFechamento({ ...dadosFechamento, valorFechado: formatarMoeda(e.target.value) })}
                                    className="w-full bg-black/50 border border-emerald-500/30 rounded-lg p-3 text-emerald-400 text-lg font-bold outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Seletor opcional caso seja cliente já cadastrado (Recompra) */}
                            {clientesExistentes.length > 0 && (
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Já é cliente cadastrado? (Opcional - Recompra)</label>
                                    <select
                                        value={dadosFechamento.clienteExistenteId}
                                        onChange={e => handleSelecionarClienteNoModalFechamento(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Novo cliente (cadastrar agora)</option>
                                        {clientesExistentes.map(c => (
                                            <option key={c.id} value={c.id}>{c.nomeCompleto} — CPF: {c.cpf}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {dadosFechamento.clienteExistenteId && (
                                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg font-bold">
                                    <UserCheck size={15} /> Cliente existente vinculado (nova venda será somada ao cadastro atual).
                                </div>
                            )}

                            {/* Dados Complementares do Cliente */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs text-gray-400 mb-1">Nome Completo *</label>
                                    <input
                                        required
                                        type="text"
                                        value={dadosFechamento.nomeCompleto}
                                        onChange={e => setDadosFechamento({ ...dadosFechamento, nomeCompleto: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">CPF *</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="000.000.000-00"
                                        value={dadosFechamento.cpf}
                                        onChange={e => handleCpfFechamentoChange(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Telefone *</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="(00) 00000-0000"
                                        value={dadosFechamento.telefone}
                                        onChange={e => setDadosFechamento({ ...dadosFechamento, telefone: formatarTelefone(e.target.value) })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs text-gray-400 mb-1">Data de Nascimento *</label>
                                    <input
                                        required
                                        type="date"
                                        value={dadosFechamento.dataNascimento}
                                        onChange={e => setDadosFechamento({ ...dadosFechamento, dataNascimento: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors">
                                Salvar Dados e Mover para Fechados
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: CONVERSÃO FINAL (REGISTRAR VENDA & COMISSÃO) */}
            {modalAtivo === 'converter' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-2xl relative my-8">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <RefreshCw className="text-emerald-400" />
                            {formConversao.clienteExistenteId ? 'Registrar Nova Venda (Recompra)' : 'Converter em Cliente & Registrar Venda'}
                        </h2>
                        <p className="text-xs text-gray-400 mb-6">
                            Confira os dados do cliente e informe os detalhes da carta vendida para <strong className="text-white">{formConversao.nomeCompleto}</strong>.
                        </p>

                        <form onSubmit={confirmarConversaoClienteEVenda} className="flex flex-col gap-5">
                            {/* Seção 1: Resumo Editável do Cliente (já preenchido na etapa anterior) */}
                            <div className="bg-black/30 border border-white/5 p-4 rounded-2xl">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-red-500">1. Dados do Cliente</h3>
                                    {formConversao.clienteExistenteId && (
                                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                            Cliente Existente
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Nome Completo *</label>
                                        <input required type="text" value={formConversao.nomeCompleto} onChange={e => setFormConversao({ ...formConversao, nomeCompleto: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-red-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Telefone *</label>
                                        <input required type="text" value={formConversao.telefone} onChange={e => setFormConversao({ ...formConversao, telefone: formatarTelefone(e.target.value) })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-red-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">CPF *</label>
                                        <input required type="text" value={formConversao.cpf} onChange={e => setFormConversao({ ...formConversao, cpf: formatarCPF(e.target.value) })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-red-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Data de Nascimento *</label>
                                        <input required type="date" value={formConversao.dataNascimento} onChange={e => setFormConversao({ ...formConversao, dataNascimento: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-red-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Seção 2: Venda & Plano de Comissão */}
                            <div className="bg-black/30 border border-white/5 p-4 rounded-2xl">
                                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-3">2. Registro da Venda & Comissionamento</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Tipo de Carta *</label>
                                        <select value={formConversao.tipoCarta} onChange={e => setFormConversao({ ...formConversao, tipoCarta: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500">
                                            <option value="Imobiliária">Imobiliária</option>
                                            <option value="Automotiva">Automotiva</option>
                                            <option value="Serviços">Serviços</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Valor da Carta *</label>
                                        <input required type="text" value={formConversao.valorTotalCarta} onChange={e => setFormConversao({ ...formConversao, valorTotalCarta: formatarMoeda(e.target.value) })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Data da Venda *</label>
                                        <input required type="date" value={formConversao.dataVenda} onChange={e => setFormConversao({ ...formConversao, dataVenda: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Grupo *</label>
                                        <input required type="text" placeholder="Ex: 1050" value={formConversao.grupo} onChange={e => setFormConversao({ ...formConversao, grupo: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Cota *</label>
                                        <input required type="text" placeholder="Ex: 12A" value={formConversao.cota} onChange={e => setFormConversao({ ...formConversao, cota: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-emerald-400 font-bold mb-1">Comissionamento *</label>
                                        <select
                                            required
                                            value={formConversao.planoComissaoId}
                                            onChange={e => setFormConversao({ ...formConversao, planoComissaoId: e.target.value })}
                                            className="w-full bg-black/50 border border-emerald-500/40 rounded-lg p-2.5 text-sm text-white font-medium outline-none focus:border-emerald-500"
                                        >
                                            {planosComissao.map(plano => (
                                                <option key={plano.id} value={plano.id}>{plano.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {simulacaoPreview && (
                                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-wrap justify-between items-center gap-2 text-xs">
                                        <span className="text-gray-300">
                                            Comissão Total: <strong className="text-emerald-400 text-sm">{simulacaoPreview.valorComissaoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                                        </span>
                                        <span className="text-gray-400">
                                            1º Recebimento (regra dia 15): <strong className="text-white">{simulacaoPreview.parcelas[0]?.mesAnoReferencia}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors">
                                Finalizar e Registrar Venda
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: AGENDAR REUNIÃO MANUAL */}
            {modalAtivo === 'reuniaoManual' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-md relative">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <CalendarDays className="text-red-600" /> Agendar Nova Reunião
                        </h2>
                        <form onSubmit={handleAgendarReuniaoManual} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Título / Assunto *</label>
                                <input required type="text" value={formReuniaoManual.titulo} onChange={e => setFormReuniaoManual({ ...formReuniaoManual, titulo: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-red-500" placeholder="Ex: Apresentação de Proposta" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Selecione o Lead ou Cliente *</label>
                                <select required value={formReuniaoManual.participante} onChange={e => setFormReuniaoManual({ ...formReuniaoManual, participante: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-red-500">
                                    <option value="" disabled>Escolha na lista...</option>
                                    {leads.length > 0 && (
                                        <optgroup label="Leads no Funil">
                                            {leads.map(l => <option key={`lead-${l.id}`} value={l.nome}>{l.nome} ({l.origem})</option>)}
                                        </optgroup>
                                    )}
                                    {clientesExistentes.length > 0 && (
                                        <optgroup label="Clientes Cadastrados">
                                            {clientesExistentes.map(c => <option key={`cli-${c.id}`} value={c.nomeCompleto}>{c.nomeCompleto}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Data *</label>
                                    <input required type="date" value={formReuniaoManual.data} onChange={e => setFormReuniaoManual({ ...formReuniaoManual, data: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-red-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Hora *</label>
                                    <input required type="time" value={formReuniaoManual.hora} onChange={e => setFormReuniaoManual({ ...formReuniaoManual, hora: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-red-500" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl mt-4 transition-colors">
                                Confirmar Agendamento
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// COMPONENTE DA COLUNA DO KANBAN
// ============================================================================
function renderKanbanColumn(titulo, listaLeads, cor, iniciarMovimentoLead, abrirModalConversao, editarLead, excluirLead) {
    const corConfig = {
        blue: { bgHeader: 'bg-blue-500/10', text: 'text-blue-400', icon: <AlertCircle size={16} /> },
        amber: { bgHeader: 'bg-amber-500/10', text: 'text-amber-400', icon: <Phone size={16} /> },
        purple: { bgHeader: 'bg-purple-500/10', text: 'text-purple-400', icon: <FileText size={16} /> },
        emerald: { bgHeader: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircle size={16} /> },
    };
    const config = corConfig[cor];

    return (
        <div className="flex-1 min-w-55 bg-black/20 rounded-2xl border border-white/5 flex flex-col overflow-hidden">
            <div className={`p-4 border-b border-white/5 flex justify-between items-center ${config.bgHeader}`}>
                <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${config.text}`}>
                    {config.icon} {titulo}
                </h4>
                <span className="bg-black/50 text-gray-300 text-[11px] font-bold px-2 py-1 rounded-md">
                    {listaLeads.length}
                </span>
            </div>

            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                {listaLeads.map(lead => (
                    <div key={lead.id} className="bg-dark-card border border-dark-border hover:border-red-500/30 p-4 rounded-xl shadow-md transition-all group flex flex-col gap-2 relative">
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => editarLead(lead)} title="Editar Nome" className="p-1.5 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                                <Edit2 size={12} />
                            </button>
                            <button onClick={() => excluirLead(lead.id)} title="Excluir Lead" className="p-1.5 text-gray-500 hover:text-red-500 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                                <Trash2 size={12} />
                            </button>
                        </div>

                        <div className="pr-12">
                            <h5 className="text-sm font-bold text-white leading-tight">{lead.nome}</h5>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                                    <Tag size={10} className="text-red-500" /> {lead.origem || 'Outro'}
                                </span>
                                {lead.clienteExistenteId && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                        Recompra
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="text-[11px] text-gray-400 flex flex-col gap-1 mt-1">
                            {lead.telefone && (
                                <span className="flex items-center gap-1.5">
                                    <Phone size={11} className="text-gray-500" /> {lead.telefone}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <CalendarDays size={11} className="text-gray-500" /> Chegada: {formatarDataBR(lead.dataChegada)}
                            </span>
                            {lead.dataReuniao && (
                                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                                    <Clock size={11} /> Reunião: {formatarDataBR(lead.dataReuniao)} às {lead.horaReuniao}
                                </span>
                            )}
                        </div>

                        <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5 gap-2">
                            {lead.status === 'fechado' ? (
                                <div className="flex flex-col gap-1.5 w-full">
                                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-fit">
                                        Fechado: {lead.valorFechado}
                                    </span>
                                    <div className="flex justify-between items-center">
                                        <button
                                            onClick={() => abrirModalConversao(lead)}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow"
                                        >
                                            <RefreshCw size={12} /> {lead.clienteExistenteId ? 'Registrar Venda' : 'Virar Cliente'}
                                        </button>
                                        <button
                                            onClick={() => iniciarMovimentoLead(lead, 'tras')}
                                            title="Voltar etapa"
                                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded truncate">
                                        {lead.status === 'proposta' && lead.valorNegociado
                                            ? `Proposta: ${lead.valorNegociado}`
                                            : lead.status === 'contato'
                                                ? 'Em negociação'
                                                : 'Novo Lead'}
                                    </span>

                                    <div className="flex gap-1 shrink-0">
                                        {lead.status !== 'novo' && (
                                            <button
                                                onClick={() => iniciarMovimentoLead(lead, 'tras')}
                                                title="Etapa anterior"
                                                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => iniciarMovimentoLead(lead, 'frente')}
                                            title="Avançar etapa"
                                            className="p-1.5 bg-white/5 hover:bg-red-600 rounded-lg text-gray-400 hover:text-white transition-colors"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
