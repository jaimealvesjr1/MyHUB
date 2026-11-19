import React, { useState, useEffect, useMemo } from 'react';
import {
    CalendarDays, Clock, StickyNote, Plus,
    ChevronRight, ChevronLeft, CheckCircle, Phone,
    AlertCircle, FileText, Target, RefreshCw,
    Trash2, Edit2, X, Tag, DollarSign, UserCheck,
    MessageSquarePlus, BellRing, History, Search,
    Users, TrendingUp, Filter, Receipt,
    Layers, ExternalLink, RotateCcw
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

// Ícone SVG leve do Instagram (substitui o ícone removido das versões recentes do lucide-react)
function InstagramIcon({ size = 14, className = '' }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
    );
}

// ============================================================================
// 1. FUNÇÕES AUXILIARES DE FORMATAÇÃO E DATAS
// ============================================================================
function formatarMoeda(valor) {
    const apenasDigitos = String(valor).replace(/\D/g, '');
    if (!apenasDigitos) return '';
    const numero = Number(apenasDigitos) / 100;
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function numeroParaMoeda(numero) {
    if (!Number.isFinite(numero) || numero <= 0) return '';
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

function formatarInstagram(valor) {
    const limpo = String(valor || '').trim();
    if (!limpo) return '';
    const semUrl = limpo
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/\/.*$/, '')
        .replace(/^@+/, '')
        .trim();
    return semUrl ? `@${semUrl}` : '';
}

function gerarLinkInstagram(instagram) {
    const handle = formatarInstagram(instagram).replace(/^@/, '');
    return handle ? `https://instagram.com/${handle}` : '';
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

function adicionarDiasISO(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
}

function calcularDiasDiferenca(dataISO) {
    if (!dataISO) return 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(`${dataISO}T00:00:00`);
    return Math.floor((hoje.getTime() - alvo.getTime()) / (1000 * 60 * 60 * 24));
}

function sugerirCompetenciaNota(dataISO) {
    if (!dataISO || !dataISO.includes('-')) return 'ATUAL';
    const dia = Number(dataISO.split('-')[2]);
    return dia <= 15 ? 'ATUAL' : 'PROXIMO';
}

function obterDetalhesCompetenciaNota(dataISO) {
    if (!dataISO || !dataISO.includes('-')) {
        return {
            mesNotaAtual: 'Mês da Venda',
            mesRecebimentoAtual: 'Mês Seguinte',
            mesNotaProximo: 'Próximo Mês',
            mesRecebimentoProximo: 'Em 2 Meses'
        };
    }

    const [anoStr, mesStr] = dataISO.split('-');
    const ano = Number(anoStr);
    const mesIndex = Number(mesStr) - 1;

    const formatarMesAno = (offsetMeses) => {
        const dataRef = new Date(ano, mesIndex + offsetMeses, 1);
        const nomeMes = dataRef.toLocaleDateString('pt-BR', { month: 'long' });
        const nomeCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
        return `${nomeCapitalizado}/${dataRef.getFullYear()}`;
    };

    return {
        mesNotaAtual: formatarMesAno(0),
        mesRecebimentoAtual: formatarMesAno(1),
        mesNotaProximo: formatarMesAno(1),
        mesRecebimentoProximo: formatarMesAno(2)
    };
}

function obterListaPropostasLead(lead) {
    if (Array.isArray(lead?.propostas) && lead.propostas.length > 0) {
        return lead.propostas;
    }
    if (lead?.valorNegociado && moedaParaNumero(lead.valorNegociado) > 0) {
        return [
            {
                id: 'legado-1',
                titulo: 'Proposta Principal',
                tipoCarta: 'Imobiliária',
                valorCredito: lead.valorNegociado,
                valorParcela: '',
                prazoMeses: '',
                statusProposta: 'ATIVA',
                versao: 1,
                motivoAtualizacao: '',
                dataCriacao: lead.dataChegada || new Date().toISOString().split('T')[0],
                dataAtualizacao: lead.dataChegada || new Date().toISOString().split('T')[0],
                historicoVersoes: []
            }
        ];
    }
    return [];
}

function calcularResumoPropostasLead(listaPropostas) {
    const ativas = listaPropostas.filter((p) => p.statusProposta === 'ATIVA');
    const aprovada = listaPropostas.find((p) => p.statusProposta === 'APROVADA');
    const baseSoma = ativas.length > 0 ? ativas : aprovada ? [aprovada] : [];
    const somaCredito = baseSoma.reduce((acc, p) => acc + moedaParaNumero(p.valorCredito), 0);
    const somaParcela = baseSoma.reduce((acc, p) => acc + moedaParaNumero(p.valorParcela), 0);

    return {
        qtdTotal: listaPropostas.length,
        qtdAtivas: ativas.length,
        somaCredito,
        somaCreditoFormatado: numeroParaMoeda(somaCredito),
        somaParcela,
        somaParcelaFormatado: numeroParaMoeda(somaParcela),
        aprovada
    };
}

// ============================================================================
// 2. CONSTANTES E ATALHOS CONFIGURÁVEIS
// ============================================================================
const DIAS_ALERTA_INATIVIDADE = 3;

const ORIGENS_LEAD = ['Network', 'Rede Social', 'Indicação', 'Recompra', 'Outro'];

const GATILHOS_FOLLOWUP = [
    'Retorno agendado',
    'Aguardando melhor momento',
    'Avaliando condições',
    'Enviar simulação',
    'Reativar contato',
    'Outro gatilho'
];

const ATALHOS_CONVERSA = [
    'Enviei simulação, aguardando retorno.',
    'Conversamos por ligação; pediu para retomar em outro momento.',
    'Não atendeu hoje, tentar novamente em outro horário.',
];

export default function LeadsPage() {
    const { user } = useAuthStore();
    const dataHojeISO = new Date().toISOString().split('T')[0];

    // Estados principais vindos do Firebase
    const [leads, setLeads] = useState([]);
    const [reunioes, setReunioes] = useState([]);
    const [anotacoes, setAnotacoes] = useState([]);
    const [clientesExistentes, setClientesExistentes] = useState([]);
    const [planosComissao, setPlanosComissao] = useState([]);
    const [carregando, setCarregando] = useState(true);

    // Estados de filtros do Pipeline
    const [buscaTexto, setBuscaTexto] = useState('');
    const [origemFiltro, setOrigemFiltro] = useState('TODAS');
    const [apenasFollowUpUrgente, setApenasFollowUpUrgente] = useState(false);

    // Formulário de Novo Lead (Modal dedicado)
    const [novoLead, setNovoLead] = useState({
        nome: '',
        telefone: '',
        instagram: '',
        dataChegada: dataHojeISO,
        origem: 'Rede Social',
        clienteExistenteId: ''
    });

    // Formulário de Edição Completa do Lead
    const [formEditarLead, setFormEditarLead] = useState({
        nome: '',
        telefone: '',
        instagram: '',
        dataChegada: dataHojeISO,
        origem: 'Network'
    });

    const [novaAnotacao, setNovaAnotacao] = useState('');

    // Controles dos Modais
    const [modalAtivo, setModalAtivo] = useState(null);
    const [leadSelecionado, setLeadSelecionado] = useState(null);

    const [dadosContato, setDadosContato] = useState({ data: dataHojeISO, hora: '' });

    // Modal inicial ao mover de "Em Contato" -> "Proposta"
    const [primeiraPropostaForm, setPrimeiraPropostaForm] = useState({
        titulo: 'Proposta Principal',
        tipoCarta: 'Imobiliária',
        valorCredito: '',
        valorParcela: '',
        prazoMeses: ''
    });

    // Modal de Gestão de Múltiplas Propostas & Revisões
    const [novaPropostaTratativa, setNovaPropostaTratativa] = useState({
        titulo: '',
        tipoCarta: 'Imobiliária',
        valorCredito: '',
        valorParcela: '',
        prazoMeses: ''
    });
    const [propostaEmRevisaoId, setPropostaEmRevisaoId] = useState(null);
    const [formRevisaoProposta, setFormRevisaoProposta] = useState({
        titulo: '',
        tipoCarta: 'Imobiliária',
        valorCredito: '',
        valorParcela: '',
        prazoMeses: '',
        motivoAtualizacao: ''
    });
    const [historicoPropostaAbertoId, setHistoricoPropostaAbertoId] = useState(null);

    // Modal de Follow-up & Gatilhos
    const [formFollowUp, setFormFollowUp] = useState({
        resumoConversa: '',
        gatilho: GATILHOS_FOLLOWUP[0],
        proximoFollowUpData: adicionarDiasISO(2)
    });

    // Modal de Fechamento + Dados Complementares do Cliente
    const [dadosFechamento, setDadosFechamento] = useState({
        valorFechado: '',
        propostaAprovadaId: '',
        nomeCompleto: '',
        telefone: '',
        instagram: '',
        cpf: '',
        dataNascimento: '',
        clienteExistenteId: ''
    });

    // Modal de Reunião Manual
    const [formReuniaoManual, setFormReuniaoManual] = useState({
        titulo: '',
        participante: '',
        data: dataHojeISO,
        hora: ''
    });

    // Modal de Conversão Final
    const [formConversao, setFormConversao] = useState({
        nomeCompleto: '',
        telefone: '',
        cpf: '',
        dataNascimento: '',
        clienteExistenteId: '',
        tipoCarta: 'Imobiliária',
        valorTotalCarta: '',
        dataVenda: dataHojeISO,
        competenciaNota: sugerirCompetenciaNota(dataHojeISO),
        grupo: '',
        cota: '',
        planoComissaoId: ''
    });

    // ========================================================================
    // 3. ESCUTA EM TEMPO REAL DO FIRESTORE
    // ========================================================================
    useEffect(() => {
        if (!user?.uid) return;

        buscarOuInicializarPlanos(user.uid).then((listaPlanos) => {
            setPlanosComissao(listaPlanos);
        });

        const qLeads = query(collection(db, 'leads'), where('responsavelId', '==', user.uid));
        const unsubLeads = onSnapshot(qLeads, (snapshot) => {
            const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => (a.dataChegada || '').localeCompare(b.dataChegada || ''));
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
            lista.sort((a, b) =>
                `${a.data}T${a.hora || '00:00'}`.localeCompare(`${b.data}T${b.hora || '00:00'}`)
            );
            setReunioes(lista);
        });

        const qClientes = query(collection(db, 'clientes'), where('userId', '==', user.uid));
        const unsubClientes = onSnapshot(qClientes, (snapshot) => {
            const listaCli = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            listaCli.sort((a, b) => (a.nomeCompleto || '').localeCompare(b.nomeCompleto || '', 'pt-BR'));
            setClientesExistentes(listaCli);
        });

        return () => {
            unsubLeads();
            unsubAnotacoes();
            unsubReunioes();
            unsubClientes();
        };
    }, [user?.uid]);

    // ========================================================================
    // 4. CADASTRO E EDIÇÃO COMPLETA DE LEADS (COM INSTAGRAM E RECOMPRA)
    // ========================================================================
    const abrirModalNovoLead = () => {
        setNovoLead({
            nome: '',
            telefone: '',
            instagram: '',
            dataChegada: dataHojeISO,
            origem: 'Rede Social',
            clienteExistenteId: ''
        });
        setModalAtivo('novoLead');
    };

    const handleSelecionarClienteRecompra = (clienteId) => {
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
        const temTelefone = novoLead.telefone.trim().length > 0;
        const instaFormatado = formatarInstagram(novoLead.instagram);
        const temInstagram = instaFormatado.length > 1;

        if (!novoLead.nome.trim() || !novoLead.dataChegada || !novoLead.origem) {
            return toast.error('Preencha Nome, Data de Chegada e Origem.');
        }

        if (!temTelefone && !temInstagram) {
            return toast.error('Informe pelo menos o Telefone/WhatsApp ou o Instagram do lead.');
        }

        const cliVinculado = novoLead.clienteExistenteId
            ? clientesExistentes.find(c => c.id === novoLead.clienteExistenteId)
            : null;

        try {
            await addDoc(collection(db, 'leads'), {
                nome: novoLead.nome.trim(),
                nomeCompleto: cliVinculado ? cliVinculado.nomeCompleto : novoLead.nome.trim(),
                telefone: novoLead.telefone.trim(),
                instagram: instaFormatado,
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
                propostas: [],
                ultimoFollowUpTexto: '',
                ultimoFollowUpData: '',
                gatilhoFollowUp: '',
                proximoFollowUpData: '',
                historicoFollowUp: [],
                createdAt: serverTimestamp(),
                responsavelId: user.uid
            });

            setModalAtivo(null);
            toast.success(cliVinculado ? 'Oportunidade de recompra adicionada!' : 'Novo Lead cadastrado!');
        } catch (error) {
            console.error('Erro ao cadastrar lead:', error);
            toast.error('Erro ao cadastrar lead.');
        }
    };

    const abrirModalEditarLead = (lead) => {
        setLeadSelecionado(lead);
        setFormEditarLead({
            nome: lead.nome || '',
            telefone: lead.telefone || '',
            instagram: lead.instagram || '',
            dataChegada: lead.dataChegada || dataHojeISO,
            origem: lead.origem || 'Network'
        });
        setModalAtivo('editarLead');
    };

    const salvarEdicaoLead = async (e) => {
        e.preventDefault();
        const temTelefone = formEditarLead.telefone.trim().length > 0;
        const instaFormatado = formatarInstagram(formEditarLead.instagram);
        const temInstagram = instaFormatado.length > 1;

        if (!formEditarLead.nome.trim()) {
            return toast.error('O nome do lead é obrigatório.');
        }
        if (!temTelefone && !temInstagram) {
            return toast.error('Informe pelo menos o Telefone/WhatsApp ou o Instagram.');
        }

        try {
            await updateDoc(doc(db, 'leads', leadSelecionado.id), {
                nome: formEditarLead.nome.trim(),
                nomeCompleto: formEditarLead.nome.trim(),
                telefone: formEditarLead.telefone.trim(),
                instagram: instaFormatado,
                dataChegada: formEditarLead.dataChegada,
                origem: formEditarLead.origem
            });
            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success('Dados do lead atualizados!');
        } catch (error) {
            console.error('Erro ao editar lead:', error);
            toast.error('Erro ao salvar alterações do lead.');
        }
    };

    const excluirLead = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este Lead?')) {
            await deleteDoc(doc(db, 'leads', id));
            toast.success('Lead removido!');
        }
    };

    // ========================================================================
    // 5. CENTRAL DE PROPOSTAS & CONTROLE DE VERSÕES / ATUALIZAÇÕES
    // ========================================================================
    const abrirModalPropostasLead = (lead) => {
        setLeadSelecionado(lead);
        const existentes = obterListaPropostasLead(lead);
        setNovaPropostaTratativa({
            titulo: `Opção ${existentes.length + 1}`,
            tipoCarta: 'Imobiliária',
            valorCredito: '',
            valorParcela: '',
            prazoMeses: ''
        });
        setPropostaEmRevisaoId(null);
        setHistoricoPropostaAbertoId(null);
        setModalAtivo('propostasLead');
    };

    const persistirPropostasNoLead = async (leadAlvo, novaListaPropostas, logFollowUpTexto) => {
        const resumo = calcularResumoPropostasLead(novaListaPropostas);
        const historicoAtual = Array.isArray(leadAlvo.historicoFollowUp)
            ? leadAlvo.historicoFollowUp
            : [];

        const novoHistorico = logFollowUpTexto
            ? [
                  {
                      data: dataHojeISO,
                      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                      texto: logFollowUpTexto,
                      gatilho: 'Atualização de proposta',
                      proximoRetorno: leadAlvo.proximoFollowUpData || adicionarDiasISO(2)
                  },
                  ...historicoAtual
              ]
            : historicoAtual;

        const payloadUpdate = {
            propostas: novaListaPropostas,
            valorNegociado: resumo.somaCreditoFormatado,
            ...(logFollowUpTexto
                ? {
                      ultimoFollowUpTexto: logFollowUpTexto,
                      ultimoFollowUpData: dataHojeISO,
                      historicoFollowUp: novoHistorico
                  }
                : {})
        };

        await updateDoc(doc(db, 'leads', leadAlvo.id), payloadUpdate);
        setLeadSelecionado((prev) =>
            prev && prev.id === leadAlvo.id ? { ...prev, ...payloadUpdate } : prev
        );
    };

    const handleAdicionarNovaPropostaTratativa = async (e) => {
        e.preventDefault();
        if (moedaParaNumero(novaPropostaTratativa.valorCredito) <= 0) {
            return toast.error('Informe o valor do crédito da proposta.');
        }

        const listaAtual = obterListaPropostasLead(leadSelecionado);
        const novaProp = {
            id: `prop-${Date.now()}`,
            titulo: novaPropostaTratativa.titulo.trim() || `Opção ${listaAtual.length + 1}`,
            tipoCarta: novaPropostaTratativa.tipoCarta,
            valorCredito: novaPropostaTratativa.valorCredito,
            valorParcela: novaPropostaTratativa.valorParcela,
            prazoMeses: novaPropostaTratativa.prazoMeses.trim(),
            statusProposta: 'ATIVA',
            versao: 1,
            motivoAtualizacao: '',
            dataCriacao: dataHojeISO,
            dataAtualizacao: dataHojeISO,
            historicoVersoes: []
        };

        const atualizada = [...listaAtual, novaProp];
        const textoLog = `Nova proposta adicionada (${novaProp.titulo}): Crédito ${novaProp.valorCredito}${
            novaProp.valorParcela ? ` • Parcela ${novaProp.valorParcela}` : ''
        }.`;

        try {
            await persistirPropostasNoLead(leadSelecionado, atualizada, textoLog);
            setNovaPropostaTratativa({
                titulo: `Opção ${atualizada.length + 1}`,
                tipoCarta: 'Imobiliária',
                valorCredito: '',
                valorParcela: '',
                prazoMeses: ''
            });
            toast.success('Nova proposta adicionada à tratativa!');
        } catch (err) {
            toast.error('Erro ao adicionar proposta.');
        }
    };

    const iniciarRevisaoProposta = (proposta) => {
        setPropostaEmRevisaoId(proposta.id);
        setFormRevisaoProposta({
            titulo: proposta.titulo,
            tipoCarta: proposta.tipoCarta || 'Imobiliária',
            valorCredito: proposta.valorCredito || '',
            valorParcela: proposta.valorParcela || '',
            prazoMeses: proposta.prazoMeses || '',
            motivoAtualizacao: ''
        });
    };

    const confirmarRevisaoProposta = async (e) => {
        e.preventDefault();
        if (moedaParaNumero(formRevisaoProposta.valorCredito) <= 0) {
            return toast.error('Informe o novo valor de crédito.');
        }

        const listaAtual = obterListaPropostasLead(leadSelecionado);
        let logTexto = '';

        const atualizada = listaAtual.map((p) => {
            if (p.id !== propostaEmRevisaoId) return p;

            const versaoAnterior = Number(p.versao || 1);
            const novaVersao = versaoAnterior + 1;
            const snapshotAnterior = {
                versao: versaoAnterior,
                valorCredito: p.valorCredito,
                valorParcela: p.valorParcela,
                prazoMeses: p.prazoMeses,
                motivo: formRevisaoProposta.motivoAtualizacao.trim() || 'Reajuste de proposta',
                data: dataHojeISO
            };

            logTexto = `Proposta "${formRevisaoProposta.titulo}" refeita (v${novaVersao}): Crédito ${formRevisaoProposta.valorCredito}${
                formRevisaoProposta.valorParcela ? ` • Parcela ${formRevisaoProposta.valorParcela}` : ''
            }${
                formRevisaoProposta.motivoAtualizacao.trim()
                    ? ` (${formRevisaoProposta.motivoAtualizacao.trim()})`
                    : ''
            }.`;

            return {
                ...p,
                titulo: formRevisaoProposta.titulo.trim() || p.titulo,
                tipoCarta: formRevisaoProposta.tipoCarta,
                valorCredito: formRevisaoProposta.valorCredito,
                valorParcela: formRevisaoProposta.valorParcela,
                prazoMeses: formRevisaoProposta.prazoMeses.trim(),
                statusProposta: 'ATIVA',
                versao: novaVersao,
                motivoAtualizacao: formRevisaoProposta.motivoAtualizacao.trim(),
                dataAtualizacao: dataHojeISO,
                historicoVersoes: [snapshotAnterior, ...(p.historicoVersoes || [])]
            };
        });

        try {
            await persistirPropostasNoLead(leadSelecionado, atualizada, logTexto);
            setPropostaEmRevisaoId(null);
            toast.success('Proposta atualizada e versão anterior salva no histórico!');
        } catch (err) {
            toast.error('Erro ao atualizar proposta.');
        }
    };

    const alterarStatusProposta = async (propostaId, novoStatus) => {
        const listaAtual = obterListaPropostasLead(leadSelecionado);
        const atualizada = listaAtual.map((p) =>
            p.id === propostaId ? { ...p, statusProposta: novoStatus, dataAtualizacao: dataHojeISO } : p
        );

        try {
            await persistirPropostasNoLead(leadSelecionado, atualizada, '');
            toast.success(`Status da proposta alterado para ${novoStatus}.`);
        } catch (err) {
            toast.error('Erro ao alterar status da proposta.');
        }
    };

    const removerPropostaTratativa = async (propostaId) => {
        if (!window.confirm('Remover esta proposta da tratativa?')) return;
        const listaAtual = obterListaPropostasLead(leadSelecionado);
        const atualizada = listaAtual.filter((p) => p.id !== propostaId);
        try {
            await persistirPropostasNoLead(leadSelecionado, atualizada, '');
            toast.success('Proposta removida.');
        } catch (err) {
            toast.error('Erro ao remover proposta.');
        }
    };

    // ========================================================================
    // 6. FOLLOW-UP & GATILHOS DE RETOMADA
    // ========================================================================
    const abrirModalFollowUp = (lead) => {
        setLeadSelecionado(lead);
        setFormFollowUp({
            resumoConversa: '',
            gatilho: lead.gatilhoFollowUp || GATILHOS_FOLLOWUP[0],
            proximoFollowUpData: adicionarDiasISO(2)
        });
        setModalAtivo('followup');
    };

    const confirmarRegistroFollowUp = async (e) => {
        e.preventDefault();
        if (!formFollowUp.resumoConversa.trim()) {
            return toast.error('Descreva resumidamente o que foi conversado com o lead.');
        }

        const novoRegistro = {
            data: dataHojeISO,
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            texto: formFollowUp.resumoConversa.trim(),
            gatilho: formFollowUp.gatilho,
            proximoRetorno: formFollowUp.proximoFollowUpData
        };

        const historicoAtual = Array.isArray(leadSelecionado.historicoFollowUp)
            ? leadSelecionado.historicoFollowUp
            : [];

        try {
            await updateDoc(doc(db, 'leads', leadSelecionado.id), {
                ultimoFollowUpTexto: novoRegistro.texto,
                ultimoFollowUpData: dataHojeISO,
                gatilhoFollowUp: formFollowUp.gatilho,
                proximoFollowUpData: formFollowUp.proximoFollowUpData,
                historicoFollowUp: [novoRegistro, ...historicoAtual]
            });

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success('Follow-up e gatilho de retorno registrados!');
        } catch (error) {
            toast.error('Erro ao salvar follow-up.');
        }
    };

    // ========================================================================
    // 7. MOVIMENTAÇÃO E TRAVAS DO FUNIL KANBAN
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
            const propsExistentes = obterListaPropostasLead(lead);
            const primeira = propsExistentes[0];
            setPrimeiraPropostaForm({
                titulo: primeira?.titulo || 'Proposta Principal',
                tipoCarta: primeira?.tipoCarta || 'Imobiliária',
                valorCredito: primeira?.valorCredito || lead.valorNegociado || '',
                valorParcela: primeira?.valorParcela || '',
                prazoMeses: primeira?.prazoMeses || ''
            });
            setModalAtivo('proposta');
        } else if (lead.status === 'proposta') {
            const cliVinculado = lead.clienteExistenteId
                ? clientesExistentes.find(c => c.id === lead.clienteExistenteId)
                : null;
            const propsLead = obterListaPropostasLead(lead);
            const propAtivaPrincipal =
                propsLead.find((p) => p.statusProposta === 'APROVADA') ||
                propsLead.find((p) => p.statusProposta === 'ATIVA') ||
                propsLead[0];

            setDadosFechamento({
                valorFechado:
                    lead.valorFechado ||
                    propAtivaPrincipal?.valorCredito ||
                    lead.valorNegociado ||
                    '',
                propostaAprovadaId: propAtivaPrincipal?.id || '',
                nomeCompleto: cliVinculado?.nomeCompleto || lead.nomeCompleto || lead.nome || '',
                telefone: cliVinculado?.telefone || lead.telefone || '',
                instagram: lead.instagram || '',
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
                horaReuniao: dadosContato.hora,
                ultimoFollowUpData: dataHojeISO,
                ultimoFollowUpTexto: `Reunião agendada para ${formatarDataBR(dadosContato.data)} às ${dadosContato.hora}.`
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
        if (moedaParaNumero(primeiraPropostaForm.valorCredito) <= 0) {
            return toast.error('Informe o valor de crédito negociado!');
        }

        const propsAtuais = obterListaPropostasLead(leadSelecionado);
        const novaProposta = {
            id: `prop-${Date.now()}`,
            titulo: primeiraPropostaForm.titulo.trim() || 'Proposta Principal',
            tipoCarta: primeiraPropostaForm.tipoCarta,
            valorCredito: primeiraPropostaForm.valorCredito,
            valorParcela: primeiraPropostaForm.valorParcela,
            prazoMeses: primeiraPropostaForm.prazoMeses.trim(),
            statusProposta: 'ATIVA',
            versao: 1,
            motivoAtualizacao: '',
            dataCriacao: dataHojeISO,
            dataAtualizacao: dataHojeISO,
            historicoVersoes: []
        };

        const listaFinal = propsAtuais.length > 0 ? propsAtuais : [novaProposta];
        const resumo = calcularResumoPropostasLead(listaFinal);
        const textoLog = `Proposta apresentada: Crédito ${primeiraPropostaForm.valorCredito}${
            primeiraPropostaForm.valorParcela ? ` • Parcela ${primeiraPropostaForm.valorParcela}` : ''
        }.`;

        try {
            await updateDoc(doc(db, 'leads', leadSelecionado.id), {
                status: 'proposta',
                propostas: listaFinal,
                valorNegociado: resumo.somaCreditoFormatado || primeiraPropostaForm.valorCredito,
                ultimoFollowUpData: dataHojeISO,
                ultimoFollowUpTexto: textoLog,
                proximoFollowUpData: adicionarDiasISO(2),
                gatilhoFollowUp: 'Retorno agendado após proposta'
            });

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success('Proposta registrada e gatilho de retorno ativado!');
        } catch (error) {
            toast.error('Erro ao salvar proposta.');
        }
    };

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

        const propsLead = obterListaPropostasLead(leadSelecionado);
        const propsAtualizadas = propsLead.map((p) =>
            p.id === dadosFechamento.propostaAprovadaId
                ? { ...p, statusProposta: 'APROVADA', dataAtualizacao: dataHojeISO }
                : p
        );

        try {
            await updateDoc(doc(db, 'leads', leadSelecionado.id), {
                status: 'fechado',
                nome: dadosFechamento.nomeCompleto.trim(),
                nomeCompleto: dadosFechamento.nomeCompleto.trim(),
                telefone: dadosFechamento.telefone,
                cpf: dadosFechamento.cpf,
                dataNascimento: dadosFechamento.dataNascimento,
                clienteExistenteId: dadosFechamento.clienteExistenteId || '',
                valorFechado: dadosFechamento.valorFechado,
                propostas: propsAtualizadas
            });

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success('Negócio fechado! Clique em "Registrar Venda" para lançar grupo e cota.');
        } catch (error) {
            toast.error('Erro ao fechar negócio.');
        }
    };

    // ========================================================================
    // 8. CONVERSÃO FINAL (CLIENTE + VENDA + PARCELAS + COMPETÊNCIA DA NOTA)
    // ========================================================================
    const abrirModalConversao = (lead) => {
        setLeadSelecionado(lead);
        const propsLead = obterListaPropostasLead(lead);
        const propAprovada =
            propsLead.find((p) => p.statusProposta === 'APROVADA') ||
            propsLead.find((p) => p.statusProposta === 'ATIVA') ||
            propsLead[0];

        const planoPadraoPreferido =
            planosComissao.find((p) => p.isPadrao === true) ||
            planosComissao.find((p) => p.id === localStorage.getItem(`plano_padrao_crm_${user?.uid}`)) ||
            planosComissao[0];

        setFormConversao({
            nomeCompleto: lead.nomeCompleto || lead.nome || '',
            telefone: lead.telefone || '',
            cpf: lead.cpf || '',
            dataNascimento: lead.dataNascimento || '',
            clienteExistenteId: lead.clienteExistenteId || '',
            tipoCarta: propAprovada?.tipoCarta || 'Imobiliária',
            valorTotalCarta: lead.valorFechado || propAprovada?.valorCredito || '',
            dataVenda: dataHojeISO,
            competenciaNota: sugerirCompetenciaNota(dataHojeISO),
            grupo: '',
            cota: '',
            planoComissaoId: planoPadraoPreferido?.id || ''
        });
        setModalAtivo('converter');
    };

    const handleAlterarDataVendaConversao = (novaDataISO) => {
        setFormConversao((prev) => ({
            ...prev,
            dataVenda: novaDataISO,
            competenciaNota: sugerirCompetenciaNota(novaDataISO)
        }));
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

        const calculoTeste = calcularCronogramaComissao(
            valorCartaNum,
            formConversao.dataVenda,
            planoEscolhido,
            formConversao.competenciaNota
        );

        if (
            !calculoTeste ||
            Number.isNaN(calculoTeste.valorComissaoTotal) ||
            !Array.isArray(calculoTeste.parcelas) ||
            calculoTeste.parcelas.length === 0
        ) {
            return toast.error(
                `O plano "${planoEscolhido.nome}" está com regras incompletas. Revise-o nas Configurações.`
            );
        }

        try {
            const cpfLimpo = limparDigitos(formConversao.cpf);
            const clienteJaCadastrado = formConversao.clienteExistenteId
                ? clientesExistentes.find(c => c.id === formConversao.clienteExistenteId)
                : clientesExistentes.find(c => limparDigitos(c.cpf) === cpfLimpo);

            let clienteIdFinal = '';

            if (clienteJaCadastrado?.id) {
                clienteIdFinal = clienteJaCadastrado.id;
                await updateDoc(doc(db, 'clientes', clienteIdFinal), {
                    nomeCompleto: formConversao.nomeCompleto.trim(),
                    telefone: formConversao.telefone,
                    cpf: formConversao.cpf,
                    dataNascimento: formConversao.dataNascimento
                });
            } else {
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

            await registrarVendaUnificada({
                userId: user.uid,
                clienteId: clienteIdFinal,
                valorTotalCarta: valorCartaNum,
                tipoCarta: formConversao.tipoCarta,
                grupo: formConversao.grupo,
                cota: formConversao.cota,
                dataVendaISO: formConversao.dataVenda,
                plano: planoEscolhido,
                competenciaNota: formConversao.competenciaNota
            });

            await deleteDoc(doc(db, 'leads', leadSelecionado.id));

            setModalAtivo(null);
            setLeadSelecionado(null);
            toast.success(
                clienteJaCadastrado
                    ? 'Nova compra registrada para o cliente existente!'
                    : 'Cliente cadastrado e Venda registrada com sucesso!'
            );
        } catch (error) {
            console.error('Erro detalhado ao registrar venda:', error);
            toast.error(`Erro ao registrar venda: ${error?.message || 'verifique o console.'}`);
        }
    };

    const planoSelecionadoAtual = planosComissao.find(p => p.id === formConversao.planoComissaoId);
    const valorCartaPreview = moedaParaNumero(formConversao.valorTotalCarta);
    const detalhesNotaPreview = obterDetalhesCompetenciaNota(formConversao.dataVenda);

    const simulacaoPreview =
        planoSelecionadoAtual && valorCartaPreview > 0 && formConversao.dataVenda
            ? calcularCronogramaComissao(
                  valorCartaPreview,
                  formConversao.dataVenda,
                  planoSelecionadoAtual,
                  formConversao.competenciaNota
              )
            : null;

    // ========================================================================
    // 9. ANOTAÇÕES E REUNIÕES MANUAIS
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

    // ========================================================================
    // 10. INDICADORES (KPIs) E FILTROS DO PIPELINE
    // ========================================================================
    const precisaFollowUp = (lead) => {
        if (lead.status === 'fechado') return false;
        if (lead.proximoFollowUpData && lead.proximoFollowUpData <= dataHojeISO) return true;
        const dataRef = lead.ultimoFollowUpData || lead.dataChegada;
        return calcularDiasDiferenca(dataRef) >= DIAS_ALERTA_INATIVIDADE;
    };

    const resumoPipeline = useMemo(() => {
        const emProposta = leads.filter(l => l.status === 'proposta');
        const valorPropostas = emProposta.reduce((acc, l) => {
            const props = obterListaPropostasLead(l);
            const resumo = calcularResumoPropostasLead(props);
            return acc + (resumo.somaCredito > 0 ? resumo.somaCredito : moedaParaNumero(l.valorNegociado));
        }, 0);

        const fechadosPendentes = leads.filter(l => l.status === 'fechado');
        const valorFechados = fechadosPendentes.reduce((acc, l) => acc + moedaParaNumero(l.valorFechado), 0);

        const urgentes = leads.filter(precisaFollowUp).length;

        return {
            totalLeads: leads.length,
            qtdPropostas: emProposta.length,
            valorPropostas,
            qtdFechados: fechadosPendentes.length,
            valorFechados,
            urgentes
        };
    }, [leads, dataHojeISO]);

    const leadsFiltrados = useMemo(() => {
        const termo = buscaTexto.trim().toLowerCase();
        return leads.filter((lead) => {
            if (apenasFollowUpUrgente && !precisaFollowUp(lead)) return false;
            if (origemFiltro !== 'TODAS' && (lead.origem || 'Outro') !== origemFiltro) return false;
            if (termo) {
                const nome = (lead.nome || '').toLowerCase();
                const tel = (lead.telefone || '').toLowerCase();
                const insta = (lead.instagram || '').toLowerCase();
                if (!nome.includes(termo) && !tel.includes(termo) && !insta.includes(termo)) return false;
            }
            return true;
        });
    }, [leads, apenasFollowUpUrgente, origemFiltro, buscaTexto, dataHojeISO]);

    const leadsNovo = leadsFiltrados.filter(l => l.status === 'novo');
    const leadsContato = leadsFiltrados.filter(l => l.status === 'contato');
    const leadsProposta = leadsFiltrados.filter(l => l.status === 'proposta');
    const leadsFechado = leadsFiltrados.filter(l => l.status === 'fechado');

    const leadsOrdenadosAlfabetica = [...leads].sort((a, b) =>
        (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
    );

    // ========================================================================
    // 11. RENDERIZAÇÃO DA INTERFACE
    // ========================================================================
    return (
        <div className="p-4 md:p-8 animate-in fade-in duration-300 max-w-[1700px] mx-auto relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white">
                        Gestão de <span className="text-red-600">Leads</span>
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">
                        Acompanhe negociações no funil, gerencie propostas com parcela acordada e converta fechamentos.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={abrirModalNovoLead}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 shrink-0"
                >
                    <Plus size={18} /> Novo Lead
                </button>
            </div>

            {/* CARDS DE RESUMO DO FUNIL (KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Leads no Funil
                        </p>
                        <p className="text-2xl font-black text-white mt-1">
                            {resumoPipeline.totalLeads}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Oportunidades em andamento</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Users size={22} />
                    </div>
                </div>

                <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Volume em Proposta
                        </p>
                        <p className="text-2xl font-black text-purple-400 mt-1">
                            {resumoPipeline.valorPropostas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {resumoPipeline.qtdPropostas}{' '}
                            {resumoPipeline.qtdPropostas === 1 ? 'tratativa ativa' : 'tratativas ativas'}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <TrendingUp size={22} />
                    </div>
                </div>

                <div className="bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Fechados (Aguardando Venda)
                        </p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">
                            {resumoPipeline.valorFechados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {resumoPipeline.qtdFechados}{' '}
                            {resumoPipeline.qtdFechados === 1 ? 'contrato pronto' : 'contratos prontos'}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle size={22} />
                    </div>
                </div>

                <div
                    onClick={() => setApenasFollowUpUrgente(!apenasFollowUpUrgente)}
                    className={`cursor-pointer bg-dark-card border p-5 rounded-2xl flex items-center justify-between transition-all ${
                        apenasFollowUpUrgente
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-dark-border hover:border-amber-500/40'
                    }`}
                >
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Follow-ups Urgentes
                        </p>
                        <p className="text-2xl font-black text-amber-400 mt-1">
                            {resumoPipeline.urgentes}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {apenasFollowUpUrgente ? 'Filtro ativado (clique p/ sair)' : 'Clique para filtrar'}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <BellRing size={22} />
                    </div>
                </div>
            </div>

            {/* ÁREA PRINCIPAL: KANBAN (ESQUERDA) + AGENDA & LEMBRETES (DIREITA) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* PIPELINE KANBAN */}
                <div className="lg:col-span-8 xl:col-span-9 bg-dark-card border border-dark-border p-6 rounded-3xl shadow-lg flex flex-col min-h-160 lg:h-[calc(100vh-220px)]">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-5 border-b border-white/5 pb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Target size={20} className="text-red-600" /> Pipeline de Vendas
                            </h2>
                            <span className="text-xs bg-white/5 text-gray-300 px-2.5 py-1 rounded-full font-bold">
                                {leadsFiltrados.length} exibidos
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-56">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar nome, tel ou @insta..."
                                    value={buscaTexto}
                                    onChange={(e) => setBuscaTexto(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white outline-none focus:border-red-500"
                                />
                                {buscaTexto && (
                                    <button
                                        type="button"
                                        onClick={() => setBuscaTexto('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5">
                                <Filter size={13} className="text-gray-400" />
                                <select
                                    value={origemFiltro}
                                    onChange={(e) => setOrigemFiltro(e.target.value)}
                                    className="bg-transparent text-xs text-white font-bold outline-none"
                                >
                                    <option value="TODAS" className="bg-dark-bg">Todas as Origens</option>
                                    {ORIGENS_LEAD.map((orig) => (
                                        <option key={orig} value={orig} className="bg-dark-bg">{orig}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={() => setApenasFollowUpUrgente(!apenasFollowUpUrgente)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                                    apenasFollowUpUrgente
                                        ? 'bg-amber-600 text-white border-amber-500'
                                        : 'bg-black/50 text-gray-300 border-white/10 hover:border-amber-500/40'
                                }`}
                            >
                                <BellRing size={13} className={resumoPipeline.urgentes > 0 ? 'text-amber-400' : ''} />
                                {apenasFollowUpUrgente ? 'Ver Todos' : `Follow-up (${resumoPipeline.urgentes})`}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
                        {carregando ? (
                            <div className="flex justify-center items-center h-full text-red-500 animate-pulse font-bold">
                                Carregando pipeline...
                            </div>
                        ) : (
                            <div className="flex gap-4 h-full min-w-230">
                                {renderKanbanColumn(
                                    'Novos Leads',
                                    leadsNovo,
                                    'blue',
                                    iniciarMovimentoLead,
                                    abrirModalConversao,
                                    abrirModalFollowUp,
                                    abrirModalEditarLead,
                                    abrirModalPropostasLead,
                                    excluirLead,
                                    dataHojeISO
                                )}
                                {renderKanbanColumn(
                                    'Em Contato',
                                    leadsContato,
                                    'amber',
                                    iniciarMovimentoLead,
                                    abrirModalConversao,
                                    abrirModalFollowUp,
                                    abrirModalEditarLead,
                                    abrirModalPropostasLead,
                                    excluirLead,
                                    dataHojeISO
                                )}
                                {renderKanbanColumn(
                                    'Proposta',
                                    leadsProposta,
                                    'purple',
                                    iniciarMovimentoLead,
                                    abrirModalConversao,
                                    abrirModalFollowUp,
                                    abrirModalEditarLead,
                                    abrirModalPropostasLead,
                                    excluirLead,
                                    dataHojeISO
                                )}
                                {renderKanbanColumn(
                                    'Fechados',
                                    leadsFechado,
                                    'emerald',
                                    iniciarMovimentoLead,
                                    abrirModalConversao,
                                    abrirModalFollowUp,
                                    abrirModalEditarLead,
                                    abrirModalPropostasLead,
                                    excluirLead,
                                    dataHojeISO
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* BARRA LATERAL DIREITA: REUNIÕES + LEMBRETES RÁPIDOS */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 sticky top-6">
                    <div className="bg-dark-card border border-dark-border p-5 rounded-3xl shadow-lg flex flex-col max-h-[44vh]">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-3.5 shrink-0">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <CalendarDays size={18} className="text-red-600" /> Agenda de Reuniões
                            </h3>
                            <span className="bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {reunioes.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2.5">
                            {reunioes.length === 0 ? (
                                <p className="text-xs text-gray-500 italic text-center py-6">
                                    Nenhuma reunião agendada.
                                </p>
                            ) : (
                                reunioes.map(r => {
                                    const ehHoje = r.data === dataHojeISO;
                                    const atrasada = r.data < dataHojeISO;
                                    return (
                                        <div
                                            key={r.id}
                                            className={`bg-black/40 border p-3.5 rounded-2xl flex flex-col gap-1.5 group relative ${
                                                ehHoje
                                                    ? 'border-amber-500/40'
                                                    : atrasada
                                                        ? 'border-red-500/30 opacity-75'
                                                        : 'border-white/5'
                                            }`}
                                        >
                                            <button
                                                onClick={() => excluirReuniao(r.id)}
                                                title="Remover reunião"
                                                className="absolute top-2.5 right-2.5 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                            <h4 className="text-xs font-bold text-white pr-5">{r.titulo}</h4>
                                            <p className="text-[11px] text-gray-400 font-bold uppercase">{r.cliente}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="bg-white/5 text-gray-300 text-[10px] font-black px-2 py-0.5 rounded">
                                                    {formatarDataBR(r.data)}
                                                </span>
                                                <span className="bg-white/5 text-gray-300 text-[10px] font-black px-2 py-0.5 rounded">
                                                    {r.hora}
                                                </span>
                                                {ehHoje && (
                                                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded">
                                                        HOJE
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <button
                            onClick={() => setModalAtivo('reuniaoManual')}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-bold py-2.5 rounded-xl transition-all mt-3.5 flex justify-center items-center gap-1.5 hover:text-white shrink-0"
                        >
                            <Plus size={15} /> Agendar Reunião
                        </button>
                    </div>

                    <div className="bg-dark-card border border-dark-border p-5 rounded-3xl shadow-lg flex flex-col flex-1 max-h-[44vh]">
                        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3.5 border-b border-white/5 pb-3.5 shrink-0">
                            <StickyNote className="text-red-600" size={18} /> Lembretes Rápidos
                        </h3>

                        <div className="mb-3 relative shrink-0">
                            <input
                                type="text"
                                value={novaAnotacao}
                                onChange={(e) => setNovaAnotacao(e.target.value)}
                                onKeyDown={handleAddAnotacao}
                                placeholder="Nova anotação e Enter..."
                                className="block w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-red-500 transition-colors"
                            />
                            <Plus size={15} className="absolute left-3 top-2.5 text-gray-500" />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2">
                            {anotacoes.length === 0 ? (
                                <p className="text-xs text-gray-500 italic text-center py-4">
                                    Nenhum lembrete salvo.
                                </p>
                            ) : (
                                anotacoes.map(anot => (
                                    <div
                                        key={anot.id}
                                        onClick={() => toggleAnotacao(anot.id, anot.concluido)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2 shrink-0 group relative ${
                                            anot.concluido
                                                ? 'bg-black/20 border-white/5 opacity-50'
                                                : 'bg-white/5 border-white/10 hover:border-red-500/30'
                                        }`}
                                    >
                                        <CheckCircle
                                            size={15}
                                            className={`mt-0.5 shrink-0 ${anot.concluido ? 'text-gray-600' : 'text-red-500'}`}
                                        />
                                        <p className={`text-xs flex-1 pr-11 ${anot.concluido ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                            {anot.texto}
                                        </p>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => editarAnotacao(anot, e)}
                                                className="p-1 text-gray-500 hover:text-white bg-black/40 rounded"
                                            >
                                                <Edit2 size={11} />
                                            </button>
                                            <button
                                                onClick={(e) => excluirAnotacao(anot.id, e)}
                                                className="p-1 text-gray-500 hover:text-red-500 bg-black/40 rounded"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ====================================================================
                MODAL 0: CADASTRAR NOVO LEAD (TELEFONE OU INSTAGRAM)
            ==================================================================== */}
            {modalAtivo === 'novoLead' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-lg relative my-8 animate-in fade-in duration-200">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <Plus className="text-red-600" /> Novo Lead no Funil
                        </h2>
                        <p className="text-xs text-gray-400 mb-5">
                            Informe o nome e pelo menos um canal de contato (WhatsApp/Telefone ou Instagram).
                        </p>

                        <form onSubmit={handleAddLead} className="flex flex-col gap-4">
                            {clientesExistentes.length > 0 && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                    <label className="block text-xs font-bold text-emerald-400 mb-1">
                                        Oportunidade de Recompra? (Opcional)
                                    </label>
                                    <select
                                        value={novoLead.clienteExistenteId}
                                        onChange={(e) => handleSelecionarClienteRecompra(e.target.value)}
                                        className="w-full bg-black/50 border border-emerald-500/30 rounded-lg p-2.5 text-xs text-white outline-none"
                                    >
                                        <option value="">Não — Cadastrar novo prospecto</option>
                                        {clientesExistentes.map(cli => (
                                            <option key={cli.id} value={cli.id}>
                                                {cli.nomeCompleto} ({cli.cpf || 'Sem CPF'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Nome do Lead *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: João Silva"
                                    value={novoLead.nome}
                                    onChange={(e) => setNovoLead({ ...novoLead, nome: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">
                                        Telefone / WhatsApp
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="(00) 00000-0000"
                                        value={novoLead.telefone}
                                        onChange={(e) => setNovoLead({ ...novoLead, telefone: formatarTelefone(e.target.value) })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-pink-400 mb-1 items-center gap-1">
                                        <InstagramIcon size={12} /> Instagram (Direto)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="@usuario"
                                        value={novoLead.instagram}
                                        onChange={(e) => setNovoLead({ ...novoLead, instagram: e.target.value })}
                                        onBlur={(e) => setNovoLead({ ...novoLead, instagram: formatarInstagram(e.target.value) })}
                                        className="w-full bg-black/50 border border-pink-500/25 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-pink-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Data de Chegada *</label>
                                    <input
                                        type="date"
                                        required
                                        value={novoLead.dataChegada}
                                        onChange={(e) => setNovoLead({ ...novoLead, dataChegada: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Origem do Lead *</label>
                                    <select
                                        required
                                        value={novoLead.origem}
                                        onChange={(e) => setNovoLead({ ...novoLead, origem: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                    >
                                        {ORIGENS_LEAD.map((orig) => (
                                            <option key={orig} value={orig}>{orig}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Adicionar ao Pipeline
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ====================================================================
                MODAL 0.5: EDITAR DADOS DO LEAD + ATALHO PARA PROPOSTAS
            ==================================================================== */}
            {modalAtivo === 'editarLead' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-lg relative my-8 animate-in fade-in duration-200">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <Edit2 className="text-red-500" size={19} /> Editar Dados do Lead
                        </h2>
                        <p className="text-xs text-gray-400 mb-5">
                            Atualize contato, Instagram, origem ou abra a central de propostas desta tratativa.
                        </p>

                        <form onSubmit={salvarEdicaoLead} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Nome do Lead *</label>
                                <input
                                    type="text"
                                    required
                                    value={formEditarLead.nome}
                                    onChange={(e) => setFormEditarLead({ ...formEditarLead, nome: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Telefone / WhatsApp</label>
                                    <input
                                        type="text"
                                        placeholder="(00) 00000-0000"
                                        value={formEditarLead.telefone}
                                        onChange={(e) => setFormEditarLead({ ...formEditarLead, telefone: formatarTelefone(e.target.value) })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-pink-400 mb-1 items-center gap-1">
                                        <InstagramIcon size={12} /> Instagram
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="@usuario"
                                        value={formEditarLead.instagram}
                                        onChange={(e) => setFormEditarLead({ ...formEditarLead, instagram: e.target.value })}
                                        onBlur={(e) => setFormEditarLead({ ...formEditarLead, instagram: formatarInstagram(e.target.value) })}
                                        className="w-full bg-black/50 border border-pink-500/25 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-pink-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Data de Chegada *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formEditarLead.dataChegada}
                                        onChange={(e) => setFormEditarLead({ ...formEditarLead, dataChegada: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Origem *</label>
                                    <select
                                        value={formEditarLead.origem}
                                        onChange={(e) => setFormEditarLead({ ...formEditarLead, origem: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                    >
                                        {ORIGENS_LEAD.map((orig) => (
                                            <option key={orig} value={orig}>{orig}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-purple-500/10 border border-purple-500/25 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold text-purple-300">Propostas & Parcela Acordada</p>
                                    <p className="text-[11px] text-gray-400">
                                        Adicione opções, edite valores ou refaça propostas desta tratativa.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => abrirModalPropostasLead(leadSelecionado)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2 rounded-xl shrink-0 transition-colors"
                                >
                                    Abrir Propostas
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl mt-1 transition-colors"
                            >
                                Salvar Alterações
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ====================================================================
                MODAL 0.8: CENTRAL DE PROPOSTAS DA TRATATIVA (MÚLTIPLAS + REVISÕES)
            ==================================================================== */}
            {modalAtivo === 'propostasLead' && leadSelecionado && (() => {
                const listaPropostas = obterListaPropostasLead(leadSelecionado);
                const resumoProps = calcularResumoPropostasLead(listaPropostas);

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-3xl relative my-8 animate-in fade-in duration-200">
                            <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>

                            <div className="flex flex-wrap items-start justify-between gap-3 pr-8 mb-5 border-b border-white/5 pb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Layers className="text-purple-400" size={20} />
                                        Propostas da Tratativa — {leadSelecionado.nome}
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Adicione mais de uma opção de carta, registre a parcela acordada e controle revisões caso refaça a proposta.
                                    </p>
                                </div>

                                {resumoProps.somaCredito > 0 && (
                                    <div className="bg-purple-500/15 border border-purple-500/30 px-3.5 py-2 rounded-xl text-right">
                                        <span className="block text-[10px] uppercase font-bold text-purple-300">
                                            Total Ativo na Mesa
                                        </span>
                                        <strong className="text-sm font-black text-white">
                                            {resumoProps.somaCreditoFormatado}
                                        </strong>
                                        {resumoProps.somaParcela > 0 && (
                                            <span className="block text-[11px] text-emerald-400 font-bold">
                                                Parcela(s): {resumoProps.somaParcelaFormatado}/mês
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 mb-6 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
                                {listaPropostas.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic text-center py-6 bg-black/30 rounded-2xl border border-white/5">
                                        Nenhuma proposta cadastrada ainda. Use o formulário abaixo para lançar a primeira!
                                    </p>
                                ) : (
                                    listaPropostas.map((prop) => {
                                        const emRevisao = propostaEmRevisaoId === prop.id;
                                        const historicoAberto = historicoPropostaAbertoId === prop.id;
                                        const qtdVersoesAntigas = Array.isArray(prop.historicoVersoes)
                                            ? prop.historicoVersoes.length
                                            : 0;

                                        return (
                                            <div
                                                key={prop.id}
                                                className={`bg-black/40 border rounded-2xl p-4 transition-all ${
                                                    prop.statusProposta === 'APROVADA'
                                                        ? 'border-emerald-500/50'
                                                        : prop.statusProposta === 'RECUSADA'
                                                            ? 'border-white/5 opacity-60'
                                                            : 'border-purple-500/25'
                                                }`}
                                            >
                                                {emRevisao ? (
                                                    <form onSubmit={confirmarRevisaoProposta} className="flex flex-col gap-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                                                                <RotateCcw size={13} /> Refazendo / Atualizando Proposta (Nova v{(prop.versao || 1) + 1})
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setPropostaEmRevisaoId(null)}
                                                                className="text-xs text-gray-400 hover:text-white"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                            <div>
                                                                <label className="block text-[11px] text-gray-400 mb-1">Título</label>
                                                                <input
                                                                    type="text"
                                                                    value={formRevisaoProposta.titulo}
                                                                    onChange={(e) => setFormRevisaoProposta({ ...formRevisaoProposta, titulo: e.target.value })}
                                                                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] text-gray-400 mb-1">Segmento</label>
                                                                <select
                                                                    value={formRevisaoProposta.tipoCarta}
                                                                    onChange={(e) => setFormRevisaoProposta({ ...formRevisaoProposta, tipoCarta: e.target.value })}
                                                                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                                >
                                                                    <option value="Imobiliária">Imobiliária</option>
                                                                    <option value="Automotiva">Automotiva</option>
                                                                    <option value="Serviços">Serviços</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] text-gray-400 mb-1">Prazo (meses)</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Ex: 180"
                                                                    value={formRevisaoProposta.prazoMeses}
                                                                    onChange={(e) => setFormRevisaoProposta({ ...formRevisaoProposta, prazoMeses: e.target.value })}
                                                                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-purple-300 mb-1">Novo Valor de Crédito *</label>
                                                                <input
                                                                    required
                                                                    type="text"
                                                                    value={formRevisaoProposta.valorCredito}
                                                                    onChange={(e) => setFormRevisaoProposta({ ...formRevisaoProposta, valorCredito: formatarMoeda(e.target.value) })}
                                                                    className="w-full bg-black/60 border border-purple-500/30 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-emerald-400 mb-1">Nova Parcela Acordada</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="R$ 0,00"
                                                                    value={formRevisaoProposta.valorParcela}
                                                                    onChange={(e) => setFormRevisaoProposta({ ...formRevisaoProposta, valorParcela: formatarMoeda(e.target.value) })}
                                                                    className="w-full bg-black/60 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm font-bold text-emerald-400 outline-none focus:border-amber-500"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[11px] text-gray-400 mb-1">Motivo da Atualização (Histórico)</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Ex: Cliente pediu parcela menor; ajuste de crédito..."
                                                                value={formRevisaoProposta.motivoAtualizacao}
                                                                onChange={(e) => setFormRevisaoProposta({ ...formRevisaoProposta, motivoAtualizacao: e.target.value })}
                                                                className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                                                            />
                                                        </div>

                                                        <button
                                                            type="submit"
                                                            className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                                                        >
                                                            Salvar Nova Versão (v{(prop.versao || 1) + 1})
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <div>
                                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-white">{prop.titulo}</span>
                                                                <span className="text-[10px] font-black bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                                                                    v{prop.versao || 1}
                                                                </span>
                                                                <span className="text-[10px] font-bold bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded">
                                                                    {prop.tipoCarta || 'Imobiliária'}
                                                                </span>
                                                                <span
                                                                    className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                                                        prop.statusProposta === 'APROVADA'
                                                                            ? 'bg-emerald-500/20 text-emerald-400'
                                                                            : prop.statusProposta === 'RECUSADA'
                                                                                ? 'bg-red-500/20 text-red-400'
                                                                                : 'bg-purple-500/20 text-purple-300'
                                                                    }`}
                                                                >
                                                                    {prop.statusProposta}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => iniciarRevisaoProposta(prop)}
                                                                    className="text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-colors"
                                                                >
                                                                    <RotateCcw size={11} /> Refazer / Atualizar
                                                                </button>

                                                                {prop.statusProposta === 'ATIVA' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => alterarStatusProposta(prop.id, 'RECUSADA')}
                                                                        className="text-[11px] font-bold bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 px-2.5 py-1 rounded-lg transition-colors"
                                                                    >
                                                                        Marcar Recusada
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => alterarStatusProposta(prop.id, 'ATIVA')}
                                                                        className="text-[11px] font-bold bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-300 px-2.5 py-1 rounded-lg transition-colors"
                                                                    >
                                                                        Reativar
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => removerPropostaTratativa(prop.id)}
                                                                    title="Excluir proposta"
                                                                    className="p-1 text-gray-500 hover:text-red-400"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-4 text-xs mt-2">
                                                            <div>
                                                                <span className="text-gray-400">Crédito: </span>
                                                                <strong className="text-white text-sm">{prop.valorCredito}</strong>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Parcela Acordada: </span>
                                                                <strong className="text-emerald-400 text-sm">
                                                                    {prop.valorParcela || 'Não informada'}
                                                                </strong>
                                                            </div>
                                                            {prop.prazoMeses && (
                                                                <div>
                                                                    <span className="text-gray-400">Prazo: </span>
                                                                    <strong className="text-gray-200">{prop.prazoMeses} meses</strong>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {prop.motivoAtualizacao && (
                                                            <p className="text-[11px] text-amber-300/90 mt-1.5">
                                                                Último ajuste ({formatarDataBR(prop.dataAtualizacao)}): {prop.motivoAtualizacao}
                                                            </p>
                                                        )}

                                                        {qtdVersoesAntigas > 0 && (
                                                            <div className="mt-2.5 pt-2 border-t border-white/5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setHistoricoPropostaAbertoId(
                                                                            historicoAberto ? null : prop.id
                                                                        )
                                                                    }
                                                                    className="text-[11px] text-gray-400 hover:text-white inline-flex items-center gap-1 font-bold"
                                                                >
                                                                    <History size={12} />
                                                                    {historicoAberto
                                                                        ? 'Ocultar versões anteriores'
                                                                        : `Ver ${qtdVersoesAntigas} ${qtdVersoesAntigas === 1 ? 'versão anterior' : 'versões anteriores'}`}
                                                                </button>

                                                                {historicoAberto && (
                                                                    <div className="mt-2 flex flex-col gap-1.5 pl-2 border-l-2 border-amber-500/30">
                                                                        {prop.historicoVersoes.map((vAnt, idx) => (
                                                                            <div key={idx} className="text-[11px] text-gray-400 flex flex-wrap gap-2">
                                                                                <span className="font-bold text-gray-300">v{vAnt.versao}:</span>
                                                                                <span>Crédito {vAnt.valorCredito}</span>
                                                                                {vAnt.valorParcela && <span>• Parc. {vAnt.valorParcela}</span>}
                                                                                <span>({formatarDataBR(vAnt.data)})</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <form
                                onSubmit={handleAdicionarNovaPropostaTratativa}
                                className="bg-black/30 border border-white/10 p-4 rounded-2xl flex flex-col gap-3"
                            >
                                <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                                    <Plus size={14} /> Adicionar Nova Opção de Proposta nesta Tratativa
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-gray-400 mb-1">Identificação / Título</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Opção 2 - Parcela Menor"
                                            value={novaPropostaTratativa.titulo}
                                            onChange={(e) => setNovaPropostaTratativa({ ...novaPropostaTratativa, titulo: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-400 mb-1">Tipo de Carta</label>
                                        <select
                                            value={novaPropostaTratativa.tipoCarta}
                                            onChange={(e) => setNovaPropostaTratativa({ ...novaPropostaTratativa, tipoCarta: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                                        >
                                            <option value="Imobiliária">Imobiliária</option>
                                            <option value="Automotiva">Automotiva</option>
                                            <option value="Serviços">Serviços</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-400 mb-1">Prazo (meses)</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 180"
                                            value={novaPropostaTratativa.prazoMeses}
                                            onChange={(e) => setNovaPropostaTratativa({ ...novaPropostaTratativa, prazoMeses: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-300 mb-1">Valor do Crédito *</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="R$ 0,00"
                                            value={novaPropostaTratativa.valorCredito}
                                            onChange={(e) => setNovaPropostaTratativa({ ...novaPropostaTratativa, valorCredito: formatarMoeda(e.target.value) })}
                                            className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-emerald-400 mb-1">Parcela Acordada</label>
                                        <input
                                            type="text"
                                            placeholder="R$ 0,00"
                                            value={novaPropostaTratativa.valorParcela}
                                            onChange={(e) => setNovaPropostaTratativa({ ...novaPropostaTratativa, valorParcela: formatarMoeda(e.target.value) })}
                                            className="w-full bg-black/50 border border-emerald-500/30 rounded-xl px-3 py-2 text-sm font-bold text-emerald-400 outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Plus size={15} /> Adicionar Proposta
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* ====================================================================
                MODAL 1: FOLLOW-UP & GATILHOS DE NEGOCIAÇÃO
            ==================================================================== */}
            {modalAtivo === 'followup' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-lg relative my-8">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <MessageSquarePlus className="text-amber-400" /> Follow-up
                        </h2>
                        <p className="text-xs text-gray-400 mb-5">
                            Registre a última conversa com <strong className="text-white">{leadSelecionado.nome}</strong> e agende o próximo gatilho.
                        </p>

                        <form onSubmit={confirmarRegistroFollowUp} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5">Atalhos Rápidos:</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {ATALHOS_CONVERSA.map((atalho, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setFormFollowUp({ ...formFollowUp, resumoConversa: atalho })}
                                            className="text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-2.5 py-1 rounded-lg text-left transition-colors"
                                        >
                                            {atalho}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">O que foi conversado agora? *</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Ex: Enviei simulação de R$ 250 mil; pediu para retornar dia 05 após receber..."
                                    value={formFollowUp.resumoConversa}
                                    onChange={(e) => setFormFollowUp({ ...formFollowUp, resumoConversa: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Gatilho / Motivo *</label>
                                    <select
                                        value={formFollowUp.gatilho}
                                        onChange={(e) => setFormFollowUp({ ...formFollowUp, gatilho: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500"
                                    >
                                        {GATILHOS_FOLLOWUP.map((g) => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-amber-400 mb-1">Próximo Contato *</label>
                                    <input
                                        required
                                        type="date"
                                        value={formFollowUp.proximoFollowUpData}
                                        onChange={(e) => setFormFollowUp({ ...formFollowUp, proximoFollowUpData: e.target.value })}
                                        className="w-full bg-black/50 border border-amber-500/30 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-gray-500">Retornar em:</span>
                                {[
                                    { label: 'Amanhã', dias: 1 },
                                    { label: '+2 dias', dias: 2 },
                                    { label: '+5 dias', dias: 5 },
                                    { label: '+7 dias', dias: 7 },
                                    { label: '+15 dias', dias: 15 },
                                ].map((btn) => (
                                    <button
                                        key={btn.dias}
                                        type="button"
                                        onClick={() =>
                                            setFormFollowUp({ ...formFollowUp, proximoFollowUpData: adicionarDiasISO(btn.dias) })
                                        }
                                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 px-2 py-1 rounded font-bold"
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-colors"
                            >
                                Salvar Atualização
                            </button>
                        </form>

                        {Array.isArray(leadSelecionado.historicoFollowUp) && leadSelecionado.historicoFollowUp.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-white/10">
                                <h4 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center gap-1.5">
                                    <History size={13} /> Histórico de Interações ({leadSelecionado.historicoFollowUp.length})
                                </h4>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                                    {leadSelecionado.historicoFollowUp.map((item, i) => (
                                        <div key={i} className="bg-black/40 border border-white/5 p-2.5 rounded-xl text-xs">
                                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                                <span className="font-bold text-amber-400">{item.gatilho}</span>
                                                <span>{formatarDataBR(item.data)} {item.hora ? `às ${item.hora}` : ''}</span>
                                            </div>
                                            <p className="text-gray-200">{item.texto}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ====================================================================
                MODAL 2: AGENDAR CONTATO
            ==================================================================== */}
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

            {/* ====================================================================
                MODAL 3: REGISTRAR PROPOSTA (CRÉDITO + PARCELA ACORDADA)
            ==================================================================== */}
            {modalAtivo === 'proposta' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-lg relative">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <DollarSign className="text-purple-400" /> Registrar Proposta
                        </h2>
                        <p className="text-xs text-gray-400 mb-5">
                            Informe o crédito e a parcela acordada com <strong className="text-white">{leadSelecionado.nome}</strong>. Depois você poderá adicionar outras opções ou refazer valores.
                        </p>
                        <form onSubmit={confirmarAvancoProposta} className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Identificação</label>
                                    <input
                                        type="text"
                                        value={primeiraPropostaForm.titulo}
                                        onChange={e => setPrimeiraPropostaForm({ ...primeiraPropostaForm, titulo: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Tipo de Carta</label>
                                    <select
                                        value={primeiraPropostaForm.tipoCarta}
                                        onChange={e => setPrimeiraPropostaForm({ ...primeiraPropostaForm, tipoCarta: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none focus:border-purple-500"
                                    >
                                        <option value="Imobiliária">Imobiliária</option>
                                        <option value="Automotiva">Automotiva</option>
                                        <option value="Serviços">Serviços</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-purple-300 mb-1">Valor do Crédito *</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="R$ 0,00"
                                        value={primeiraPropostaForm.valorCredito}
                                        onChange={e => setPrimeiraPropostaForm({ ...primeiraPropostaForm, valorCredito: formatarMoeda(e.target.value) })}
                                        className="w-full bg-black/50 border border-purple-500/30 rounded-xl p-3 text-white text-base font-bold outline-none focus:border-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-emerald-400 mb-1">Parcela Acordada</label>
                                    <input
                                        type="text"
                                        placeholder="R$ 0,00"
                                        value={primeiraPropostaForm.valorParcela}
                                        onChange={e => setPrimeiraPropostaForm({ ...primeiraPropostaForm, valorParcela: formatarMoeda(e.target.value) })}
                                        className="w-full bg-black/50 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-base font-bold outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Prazo em Meses (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 180"
                                    value={primeiraPropostaForm.prazoMeses}
                                    onChange={e => setPrimeiraPropostaForm({ ...primeiraPropostaForm, prazoMeses: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none focus:border-purple-500"
                                />
                            </div>

                            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors">
                                Salvar Proposta e Avançar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ====================================================================
                MODAL 4: FECHAMENTO + SELEÇÃO DE PROPOSTA + DADOS DO CLIENTE
            ==================================================================== */}
            {modalAtivo === 'fechado' && leadSelecionado && (() => {
                const propsFechamento = obterListaPropostasLead(leadSelecionado);

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-lg relative my-8">
                            <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                <CheckCircle className="text-emerald-400" /> Fechar Negócio & Dados do Cliente
                            </h2>
                            <p className="text-xs text-gray-400 mb-5">
                                Selecione a proposta aprovada e complete os dados cadastrais de <strong className="text-white">{leadSelecionado.nome}</strong>.
                            </p>

                            <form onSubmit={confirmarAvancoFechado} className="flex flex-col gap-4">
                                {propsFechamento.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-300 mb-1.5">
                                            Qual proposta o cliente fechou?
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            {propsFechamento.map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setDadosFechamento({
                                                            ...dadosFechamento,
                                                            propostaAprovadaId: p.id,
                                                            valorFechado: p.valorCredito
                                                        })
                                                    }
                                                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                                        dadosFechamento.propostaAprovadaId === p.id
                                                            ? 'bg-emerald-500/15 border-emerald-500 text-white'
                                                            : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/25'
                                                    }`}
                                                >
                                                    <div>
                                                        <span className="text-xs font-bold block">
                                                            {p.titulo} (v{p.versao || 1})
                                                        </span>
                                                        <span className="text-[11px] text-gray-400">
                                                            {p.valorParcela ? `Parcela: ${p.valorParcela}` : p.tipoCarta}
                                                        </span>
                                                    </div>
                                                    <strong className="text-sm text-emerald-400">{p.valorCredito}</strong>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
                                        <label className="block text-xs text-gray-400 mb-1">Telefone / WhatsApp *</label>
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
                );
            })()}

            {/* ====================================================================
                MODAL 5: CONVERSÃO FINAL (REGISTRAR VENDA & COMPETÊNCIA DA NOTA)
            ==================================================================== */}
            {modalAtivo === 'converter' && leadSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-6 w-full max-w-2xl relative my-8">
                        <button onClick={() => setModalAtivo(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <RefreshCw className="text-emerald-400" />
                            {formConversao.clienteExistenteId ? 'Registrar Nova Venda (Recompra)' : 'Converter em Cliente & Registrar Venda'}
                        </h2>
                        <p className="text-xs text-gray-400 mb-6">
                            Confira os dados do cliente, informe os detalhes da carta e escolha em qual fechamento de nota a venda entrou.
                        </p>

                        <form onSubmit={confirmarConversaoClienteEVenda} className="flex flex-col gap-5">
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
                                        <input
                                            required
                                            type="date"
                                            value={formConversao.dataVenda}
                                            onChange={e => handleAlterarDataVendaConversao(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
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

                                <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl">
                                    <label className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-1.5">
                                        <Receipt size={14} className="text-amber-400" />
                                        Em qual fechamento de nota esta venda entrou? *
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setFormConversao({ ...formConversao, competenciaNota: 'ATUAL' })}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                formConversao.competenciaNota === 'ATUAL'
                                                    ? 'bg-emerald-500/15 border-emerald-500 text-white shadow'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/25'
                                            }`}
                                        >
                                            <span className="block text-xs font-black">
                                                Nota de {detalhesNotaPreview.mesNotaAtual}
                                            </span>
                                            <span className="block text-[11px] text-emerald-400 mt-0.5">
                                                1º recebimento: {detalhesNotaPreview.mesRecebimentoAtual}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setFormConversao({ ...formConversao, competenciaNota: 'PROXIMO' })}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                formConversao.competenciaNota === 'PROXIMO'
                                                    ? 'bg-amber-500/15 border-amber-500 text-white shadow'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/25'
                                            }`}
                                        >
                                            <span className="block text-xs font-black">
                                                Nota de {detalhesNotaPreview.mesNotaProximo}
                                            </span>
                                            <span className="block text-[11px] text-amber-400 mt-0.5">
                                                1º recebimento: {detalhesNotaPreview.mesRecebimentoProximo}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {simulacaoPreview && (
                                    Number.isNaN(simulacaoPreview.valorComissaoTotal) ? (
                                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-medium">
                                            Atenção: Não foi possível calcular a comissão para o plano <strong>{planoSelecionadoAtual?.nome}</strong>. Revise-o nas Configurações.
                                        </div>
                                    ) : (
                                        <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-wrap justify-between items-center gap-2 text-xs">
                                            <span className="text-gray-300">
                                                Comissão Total:{' '}
                                                <strong className="text-emerald-400 text-sm">
                                                    {simulacaoPreview.valorComissaoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </strong>
                                            </span>
                                            <span className="text-gray-300">
                                                1º Recebimento:{' '}
                                                <strong className="text-white">
                                                    {simulacaoPreview.parcelas?.[0]?.mesAnoReferencia || 'Não definido'}
                                                </strong>
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>

                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors">
                                Finalizar e Registrar Venda
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ====================================================================
                MODAL 6: AGENDAR REUNIÃO MANUAL
            ==================================================================== */}
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
                                <label className="block text-xs font-bold text-gray-400 mb-1">Selecione o Lead ou Cliente (A-Z) *</label>
                                <select required value={formReuniaoManual.participante} onChange={e => setFormReuniaoManual({ ...formReuniaoManual, participante: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-red-500">
                                    <option value="" disabled>Escolha na lista...</option>
                                    {leadsOrdenadosAlfabetica.length > 0 && (
                                        <optgroup label="Leads no Funil">
                                            {leadsOrdenadosAlfabetica.map(l => <option key={`lead-${l.id}`} value={l.nome}>{l.nome} ({l.origem})</option>)}
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
// 12. COMPONENTE DE COLUNA DO KANBAN
// ============================================================================
function renderKanbanColumn(
    titulo,
    listaLeads,
    cor,
    iniciarMovimentoLead,
    abrirModalConversao,
    abrirModalFollowUp,
    abrirModalEditarLead,
    abrirModalPropostasLead,
    excluirLead,
    dataHojeISO
) {
    const corConfig = {
        blue: { bgHeader: 'bg-blue-500/10', text: 'text-blue-400', icon: <AlertCircle size={16} /> },
        amber: { bgHeader: 'bg-amber-500/10', text: 'text-amber-400', icon: <Phone size={16} /> },
        purple: { bgHeader: 'bg-purple-500/10', text: 'text-purple-400', icon: <FileText size={16} /> },
        emerald: { bgHeader: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircle size={16} /> },
    };
    const config = corConfig[cor];

    return (
        <div className="flex-1 min-w-55 bg-black/20 rounded-2xl border border-white/5 flex flex-col overflow-hidden">
            <div className={`p-3.5 border-b border-white/5 flex justify-between items-center ${config.bgHeader}`}>
                <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${config.text}`}>
                    {config.icon} {titulo}
                </h4>
                <span className="bg-black/50 text-gray-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                    {listaLeads.length}
                </span>
            </div>

            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                {listaLeads.length === 0 ? (
                    <p className="text-[11px] text-gray-600 text-center py-8 italic">Nenhum lead nesta etapa</p>
                ) : (
                    listaLeads.map(lead => {
                        const diasParado = calcularDiasDiferenca(lead.ultimoFollowUpData || lead.dataChegada);
                        const followAtrasado =
                            lead.status !== 'fechado' &&
                            lead.proximoFollowUpData &&
                            lead.proximoFollowUpData < dataHojeISO;
                        const followHoje =
                            lead.status !== 'fechado' &&
                            lead.proximoFollowUpData === dataHojeISO;

                        const listaProps = obterListaPropostasLead(lead);
                        const resumoProps = calcularResumoPropostasLead(listaProps);
                        const propDestaque =
                            listaProps.find((p) => p.statusProposta === 'APROVADA') ||
                            listaProps.find((p) => p.statusProposta === 'ATIVA') ||
                            listaProps[0];
                        const linkInsta = gerarLinkInstagram(lead.instagram);

                        return (
                            <div
                                key={lead.id}
                                className={`bg-dark-card border p-3.5 rounded-xl shadow-md transition-all group flex flex-col gap-2 relative ${
                                    followAtrasado
                                        ? 'border-red-500/50'
                                        : followHoje
                                            ? 'border-amber-500/50'
                                            : 'border-dark-border hover:border-red-500/30'
                                }`}
                            >
                                <div className="absolute top-3 right-3 flex gap-1">
                                    <button
                                        onClick={() => abrirModalPropostasLead(lead)}
                                        title="Gerenciar Propostas & Parcelas"
                                        className="p-1.5 text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
                                    >
                                        <Layers size={13} />
                                    </button>
                                    <button
                                        onClick={() => abrirModalFollowUp(lead)}
                                        title="Registrar Follow-up / Última Conversa"
                                        className="p-1.5 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
                                    >
                                        <MessageSquarePlus size={13} />
                                    </button>
                                    <button
                                        onClick={() => abrirModalEditarLead(lead)}
                                        title="Editar Dados do Lead"
                                        className="p-1.5 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => excluirLead(lead.id)}
                                        title="Excluir Lead"
                                        className="p-1.5 text-gray-500 hover:text-red-500 bg-white/5 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                <div className="pr-24">
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
                                        {followAtrasado && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-600/25 text-red-400 border border-red-500/30">
                                                Retorno Atrasado
                                            </span>
                                        )}
                                        {followHoje && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/30">
                                                Retornar Hoje
                                            </span>
                                        )}
                                        {!followAtrasado && !followHoje && lead.status !== 'fechado' && diasParado >= DIAS_ALERTA_INATIVIDADE && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/20">
                                                Parado há {diasParado}d
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
                                    {lead.instagram && (
                                        <a
                                            href={linkInsta}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1.5 text-pink-400 hover:text-pink-300 font-semibold w-fit"
                                        >
                                            <InstagramIcon size={11} /> {formatarInstagram(lead.instagram)}
                                            <ExternalLink size={10} />
                                        </a>
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

                                {listaProps.length > 0 && (
                                    <div
                                        onClick={() => abrirModalPropostasLead(lead)}
                                        className="cursor-pointer bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/25 p-2.5 rounded-lg text-[11px] flex flex-col gap-1 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-bold text-purple-300">
                                                {resumoProps.qtdTotal > 1
                                                    ? `${resumoProps.qtdTotal} propostas (${resumoProps.qtdAtivas} ativas)`
                                                    : `${propDestaque?.titulo || 'Proposta'} • v${propDestaque?.versao || 1}`}
                                            </span>
                                            <span className="text-[10px] text-purple-300 underline">Gerenciar</span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-1 text-gray-200">
                                            <span>
                                                Crédito: <strong className="text-white">{resumoProps.somaCreditoFormatado || propDestaque?.valorCredito}</strong>
                                            </span>
                                            {(resumoProps.somaParcelaFormatado || propDestaque?.valorParcela) && (
                                                <span>
                                                    Parc: <strong className="text-emerald-400">{resumoProps.somaParcelaFormatado || propDestaque?.valorParcela}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {lead.ultimoFollowUpTexto && (
                                    <div
                                        onClick={() => abrirModalFollowUp(lead)}
                                        className="cursor-pointer bg-black/40 hover:bg-black/60 border border-white/5 p-2.5 rounded-lg text-[11px] flex flex-col gap-1 transition-colors"
                                    >
                                        <p className="text-gray-300 line-clamp-2">
                                            <strong className="text-amber-400">Última conversa:</strong> {lead.ultimoFollowUpTexto}
                                        </p>
                                        {lead.proximoFollowUpData && (
                                            <span className="text-[10px] text-gray-400">
                                                Gatilho: <strong className="text-white">{formatarDataBR(lead.proximoFollowUpData)}</strong>
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between items-center mt-2 pt-2.5 border-t border-white/5 gap-2">
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
                                            <span
                                                onClick={() => abrirModalPropostasLead(lead)}
                                                className="cursor-pointer text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded truncate"
                                            >
                                                {resumoProps.somaCreditoFormatado
                                                    ? `Proposta: ${resumoProps.somaCreditoFormatado}`
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
                        );
                    })
                )}
            </div>
        </div>
    );
}
