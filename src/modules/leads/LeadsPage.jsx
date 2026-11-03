import React, { useState, useEffect } from 'react';
import { 
    Users, CalendarDays, Clock, StickyNote, Plus, 
    ChevronRight, ChevronLeft, CheckCircle, Phone, 
    Briefcase, AlertCircle, FileText, Bell, Target 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';

// ==========================================
// IMPORTAÇÕES DO FIREBASE (Ajuste o caminho do 'db' conforme seu projeto)
// ==========================================
import { 
    collection, onSnapshot, addDoc, updateDoc, 
    doc, query, orderBy, serverTimestamp 
} from 'firebase/firestore';
// Supondo que a sua conexão exporte 'db' da pasta config
import { db } from '../../config/firebase'; 

export default function LeadsPage() {
    const { user } = useAuthStore();
    const firstName = user?.name ? user.name.split(' ')[0] : 'Consultor';

    // ==========================================
    // 1. ESTADOS VAZIOS (Aguardando o Banco)
    // ==========================================
    const [leads, setLeads] = useState([]);
    const [reunioes, setReunioes] = useState([]);
    const [anotacoes, setAnotacoes] = useState([]);

    const [novoLeadNome, setNovoLeadNome] = useState('');
    const [novaAnotacao, setNovaAnotacao] = useState('');
    const [carregando, setCarregando] = useState(true);

    // ==========================================
    // 2. BUSCA EM TEMPO REAL (onSnapshot)
    // ==========================================
    useEffect(() => {
        // Query para Leads (Ordenado por data de criação)
        const qLeads = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
        const unsubscribeLeads = onSnapshot(qLeads, (snapshot) => {
            const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLeads(leadsData);
            setCarregando(false);
        });

        // Query para Anotações
        const qAnotacoes = query(collection(db, 'anotacoes'), orderBy('createdAt', 'desc'));
        const unsubscribeAnotacoes = onSnapshot(qAnotacoes, (snapshot) => {
            const anotacoesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAnotacoes(anotacoesData);
        });

        // Query para Reuniões (Em um app real, filtraria pela data >= hoje)
        const qReunioes = query(collection(db, 'reunioes'), orderBy('data', 'asc'));
        const unsubscribeReunioes = onSnapshot(qReunioes, (snapshot) => {
            const reunioesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReunioes(reunioesData);
        });

        // Limpeza dos listeners ao sair da tela para evitar vazamento de memória
        return () => {
            unsubscribeLeads();
            unsubscribeAnotacoes();
            unsubscribeReunioes();
        };
    }, []);

    // ==========================================
    // 3. FUNÇÕES DE MANIPULAÇÃO (Gravando no Banco)
    // ==========================================
    
    const handleAddLead = async (e) => {
        e.preventDefault();
        if (!novoLeadNome.trim()) return toast.error('Digite o nome do lead.');
        
        try {
            // Adiciona no Firebase
            await addDoc(collection(db, 'leads'), {
                nome: novoLeadNome,
                empresa: 'Nova Empresa', // Você pode abrir um modal para preencher mais tarde
                valor: 'R$ 0',
                status: 'novo',
                createdAt: serverTimestamp(),
                responsavelId: user?.uid || 'anonimo'
            });
            
            setNovoLeadNome('');
            toast.success('Lead adicionado com sucesso!');
        } catch (error) {
            console.error("Erro ao criar lead:", error);
            toast.error('Erro ao adicionar lead.');
        }
    };

    const moverLead = async (leadId, statusAtual, direcao) => {
        const estagios = ['novo', 'contato', 'proposta', 'fechado'];
        const indexAtual = estagios.indexOf(statusAtual);
        
        let novoIndex = direcao === 'frente' ? indexAtual + 1 : indexAtual - 1;
        
        // Proteção para não estourar os limites das colunas
        if (novoIndex < 0) novoIndex = 0;
        if (novoIndex > estagios.length - 1) novoIndex = estagios.length - 1;
        
        const novoStatus = estagios[novoIndex];

        // Se mudou de status, atualiza no Firebase
        if (novoStatus !== statusAtual) {
            try {
                const leadRef = doc(db, 'leads', leadId);
                await updateDoc(leadRef, { status: novoStatus });
            } catch (error) {
                console.error("Erro ao mover lead:", error);
                toast.error('Erro ao mover o card.');
            }
        }
    };

    const handleAddAnotacao = async (e) => {
        if (e.key === 'Enter' && novaAnotacao.trim()) {
            try {
                await addDoc(collection(db, 'anotacoes'), {
                    texto: novaAnotacao,
                    concluido: false,
                    createdAt: serverTimestamp(),
                    responsavelId: user?.uid || 'anonimo'
                });
                setNovaAnotacao('');
                toast.success('Anotação salva!');
            } catch (error) {
                console.error("Erro ao salvar anotação:", error);
                toast.error('Erro ao salvar.');
            }
        }
    };

    const toggleAnotacao = async (id, statusAtual) => {
        try {
            const anotacaoRef = doc(db, 'anotacoes', id);
            await updateDoc(anotacaoRef, { concluido: !statusAtual });
        } catch (error) {
            console.error("Erro ao atualizar anotação:", error);
        }
    };

    // ==========================================
    // 4. RENDERIZAÇÃO
    // ==========================================
    const leadsNovo = leads.filter(l => l.status === 'novo');
    const leadsContato = leads.filter(l => l.status === 'contato');
    const leadsProposta = leads.filter(l => l.status === 'proposta');
    const leadsFechado = leads.filter(l => l.status === 'fechado');

    return (
        <div className="p-4 md:p-8 animate-in fade-in duration-300">
            
            {/* CABEÇALHO */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white">
                    Gestão de <span className="text-red-600">Leads</span>
                </h1>
                <p className="text-gray-400 mt-2">Seu funil de vendas e acompanhamento de prospecções.</p>
            </div>

            {/* GRID PRINCIPAL: 8 Colunas p/ Kanban, 4 Colunas p/ Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* ======================================= */}
                {/* COLUNA ESQUERDA/CENTRO: KANBAN (70%)    */}
                {/* ======================================= */}
                <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
                    <div className="bg-dark-card border border-dark-border p-6 rounded-3xl shadow-lg flex flex-col min-h-150 lg:h-[calc(100vh-140px)]">
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-white/5 pb-4 shrink-0">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Target size={20} className="text-red-600" /> Pipeline de Vendas
                            </h3>
                            
                            <form onSubmit={handleAddLead} className="flex items-center gap-2 w-full sm:w-auto">
                                <input 
                                    type="text" 
                                    placeholder="Nome do Novo Lead..."
                                    value={novoLeadNome}
                                    onChange={(e) => setNovoLeadNome(e.target.value)}
                                    className="block w-full sm:w-56 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-red-500 transition-colors"
                                />
                                <button type="submit" className="bg-white/10 hover:bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition-colors border border-white/10 hover:border-red-500 flex items-center gap-1 shrink-0">
                                    <Plus size={16} /> Add Lead
                                </button>
                            </form>
                        </div>

                        <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
                            {carregando ? (
                                <div className="flex justify-center items-center h-full text-red-500 animate-pulse font-bold">
                                    Carregando Pipeline...
                                </div>
                            ) : (
                                <div className="flex gap-4 h-full min-w-225">
                                    {renderKanbanColumn('Novos Leads', leadsNovo, 'blue', moverLead)}
                                    {renderKanbanColumn('Em Contato', leadsContato, 'amber', moverLead)}
                                    {renderKanbanColumn('Proposta', leadsProposta, 'purple', moverLead)}
                                    {renderKanbanColumn('Fechados', leadsFechado, 'emerald', moverLead)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ======================================= */}
                {/* COLUNA DIREITA: SIDEBAR (30%)           */}
                {/* ======================================= */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 sticky top-25">
                    
                    {/* BLOCO 1: REUNIÕES */}
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
                                reunioes.map(reuniao => (
                                    <div key={reuniao.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-2 hover:border-red-500/30 transition-colors group cursor-pointer shrink-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-sm font-bold text-white leading-tight group-hover:text-red-400 transition-colors">
                                                {reuniao.titulo}
                                            </h4>
                                            <Bell size={14} className="text-gray-500 group-hover:text-red-400" />
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase font-bold tracking-wider">
                                            <Briefcase size={12} /> {reuniao.cliente}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="bg-white/5 text-gray-300 border border-white/10 text-[10px] font-black px-2 py-1 rounded flex items-center gap-1">
                                                <CalendarDays size={12} /> {reuniao.data}
                                            </span>
                                            <span className="bg-white/5 text-gray-300 border border-white/10 text-[10px] font-black px-2 py-1 rounded flex items-center gap-1">
                                                <Clock size={12} /> {reuniao.hora}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm font-bold py-2.5 rounded-xl transition-all mt-4 flex justify-center items-center gap-2 hover:text-white shrink-0">
                            <Plus size={16} /> Agendar
                        </button>
                    </div>

                    {/* BLOCO 2: LEMBRETES */}
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
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2 shrink-0 ${
                                        anot.concluido 
                                        ? 'bg-black/20 border-white/5 opacity-50' 
                                        : 'bg-white/5 border-white/10 hover:border-red-500/30'
                                    }`}
                                >
                                    <CheckCircle size={16} className={`mt-0.5 shrink-0 ${anot.concluido ? 'text-gray-600' : 'text-red-500'}`} />
                                    <p className={`text-sm ${anot.concluido ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                                        {anot.texto}
                                    </p>
                                </div>
                            ))}
                            {anotacoes.length === 0 && (
                                <p className="text-sm text-gray-500 italic text-center py-4">Nenhuma anotação.</p>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// ==========================================
// 4. FUNÇÃO AUXILIAR DO KANBAN
// ==========================================
// Note que agora passamos o statusAtual para o moverLead
function renderKanbanColumn(titulo, listaLeads, cor, moverLead) {
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
                    <div key={lead.id} className="bg-dark-card border border-dark-border hover:border-red-500/30 p-4 rounded-xl shadow-md transition-all group flex flex-col gap-2">
                        <div>
                            <h5 className="text-sm font-bold text-white">{lead.nome}</h5>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-1">{lead.empresa}</p>
                        </div>
                        
                        <div className="flex justify-between items-end mt-2 pt-3 border-t border-white/5">
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                                {lead.valor}
                            </span>
                            
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => moverLead(lead.id, lead.status, 'tras')}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="Voltar Etapa"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button 
                                    onClick={() => moverLead(lead.id, lead.status, 'frente')}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="Avançar Etapa"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {listaLeads.length === 0 && (
                    <div className="text-center p-6 border border-dashed border-white/10 rounded-xl text-xs text-gray-500 italic mt-2 mx-2">
                        Nenhum lead
                    </div>
                )}
            </div>
        </div>
    );
}
