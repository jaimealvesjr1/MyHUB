import { collection, addDoc, getDocs, QueryDocumentSnapshot, DocumentData, doc, updateDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../config/firebase'; // Importamos o auth para saber quem está logado
import { VendaConsorcio, ParcelaComissao } from '../types/models';

/**
 * Função responsável por salvar a venda e suas parcelas no banco de dados em nuvem.
 * O comando "async" indica que esta função vai demorar um tempo (tempo da internet).
 */
export async function salvarVendaNoBanco(venda: VendaConsorcio, parcelas: ParcelaComissao[]) {
  // 1. Verificamos quem é o usuário logado no momento
  const user = auth.currentUser;
  
  // Se não houver sessão, bloqueamos a ação imediatamente
  if (!user) {
    throw new Error("Operação negada: Usuário não autenticado.");
  }

  try {
    // 2. Carimbamos a venda com o ID do corretor antes de enviar para o banco
    const vendaComDono = {
      ...venda,
      userId: user.uid
    };

    // 3. Aponta para a coleção 'vendas' no Firebase e adiciona o documento
    const vendaRef = await addDoc(collection(db, 'vendas'), vendaComDono);

    // 4. Salvar as parcelas garantindo que elas também pertençam ao corretor
    for (const parcela of parcelas) {
      const parcelaComDono = {
        ...parcela,
        vendaId: vendaRef.id, // Amarra a parcela à venda gerada
        userId: user.uid      // Amarra a parcela ao usuário logado
      };
      
      // Salva a parcela na coleção 'parcelas'
      await addDoc(collection(db, 'parcelas'), parcelaComDono);
    }

    return true;
    
  } catch (erro) {
    console.error("Erro ao salvar no banco de dados:", erro);
    throw new Error("Não foi possível salvar a venda. Tente novamente.");
  }
}

/**
 * Busca todas as parcelas de comissão salvas na coleção 'parcelas' que pertencem ao usuário logado.
 */
export async function buscarParcelasDoBanco(): Promise<ParcelaComissao[]> {
  const user = auth.currentUser;
  if (!user) return []; // Retorna lista vazia se não estiver logado

  try {
    // Criamos uma consulta (query) filtrando apenas as parcelas do usuário ativo
    const q = query(
      collection(db, 'parcelas'),
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    const listaParcelas: ParcelaComissao[] = [];

    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      listaParcelas.push({
        id: doc.id,
        ...doc.data()
      } as ParcelaComissao);
    });

    return listaParcelas;
  } catch (erro) {
    console.error("Erro ao buscar as parcelas:", erro);
    return [];
  }
}

/**
 * Busca o histórico completo de vendas do usuário logado para gerar as métricas do Dashboard.
 */
export async function buscarVendasDoBanco(): Promise<VendaConsorcio[]> {
  const user = auth.currentUser;
  if (!user) return []; // Retorna lista vazia por segurança

  try {
    // Consulta restrita: traz apenas as vendas onde o campo userId corresponde ao usuário atual
    const q = query(
      collection(db, 'vendas'),
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    const listaVendas: VendaConsorcio[] = [];

    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      listaVendas.push({
        id: doc.id,
        ...doc.data()
      } as VendaConsorcio);
    });

    return listaVendas;
  } catch (erro) {
    console.error("Erro ao buscar as vendas:", erro);
    return [];
  }
}

/**
 * Atualiza os dados de uma venda existente no Firebase.
 * Restrição Educativa: Neste momento, estamos atualizando apenas os dados cadastrais da venda (Cota, Grupo, etc).
 */
export async function atualizarVendaNoBanco(idVenda: string, dadosAtualizados: Partial<VendaConsorcio>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  try {
    // Aponta especificamente para o documento que tem este ID dentro da coleção 'vendas'
    const vendaRef = doc(db, 'vendas', idVenda);
    
    // Envia apenas os dados que foram modificados.
    // As regras de segurança do Firebase (backend) irão bloquear a ação se este documento não pertencer ao usuário.
    await updateDoc(vendaRef, dadosAtualizados);
  } catch (erro) {
    console.error("Erro ao atualizar a venda:", erro);
    throw new Error("Não foi possível atualizar os dados da venda.");
  }
}
