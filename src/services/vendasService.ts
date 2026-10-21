import { collection, addDoc, getDocs, QueryDocumentSnapshot, DocumentData, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { VendaConsorcio, ParcelaComissao } from '../types/models';

/**
 * Função responsável por salvar a venda e suas parcelas no banco de dados em nuvem.
 * O comando "async" indica que esta função vai demorar um tempo (tempo da internet).
 */
export async function salvarVendaNoBanco(venda: VendaConsorcio, parcelas: ParcelaComissao[]) {
  try {
    // 1. Aponta para a coleção 'vendas' no Firebase e adiciona o documento
    // O Firebase vai gerar um ID único automaticamente para esta venda
    const vendaRef = await addDoc(collection(db, 'vendas'), venda);

    // 2. Agora precisamos salvar as 13 parcelas. 
    // Usamos um laço de repetição para salvar uma por uma.
    for (const parcela of parcelas) {
      // Carimbamos a parcela com o ID da venda que o Firebase acabou de criar.
      // Assim, saberemos exatamente de qual venda essa comissão veio!
      parcela.vendaId = vendaRef.id;
      
      // Salva a parcela na coleção 'parcelas'
      await addDoc(collection(db, 'parcelas'), parcela);
    }

    // Se chegar até aqui, tudo deu certo
    return true;
    
  } catch (erro) {
    // Se a internet cair ou o banco rejeitar, capturamos o erro aqui
    console.error("Erro ao salvar no banco de dados:", erro);
    throw new Error("Não foi possível salvar a venda. Tente novamente.");
  }
}

/**
 * Busca todas as parcelas de comissão salvas na coleção 'parcelas'.
 */
export async function buscarParcelasDoBanco(): Promise<ParcelaComissao[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'parcelas'));
    const listaParcelas: ParcelaComissao[] = [];

    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      listaParcelas.push({
        id: doc.id,
        ...doc.data()
      } as ParcelaComissao);
    });

    // Opcional: Aqui poderíamos ordenar as parcelas por data, 
    // mas o Firebase já as retorna na ordem em que foram salvas.
    return listaParcelas;
  } catch (erro) {
    console.error("Erro ao buscar as parcelas:", erro);
    return [];
  }
}

/**
 * Busca o histórico completo de vendas para gerar as métricas do Dashboard.
 */
export async function buscarVendasDoBanco(): Promise<VendaConsorcio[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'vendas'));
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
 * Alterar o valor exigiria recalcular e reescrever as 13 parcelas no banco.
 */
export async function atualizarVendaNoBanco(idVenda: string, dadosAtualizados: Partial<VendaConsorcio>): Promise<void> {
  try {
    // Aponta especificamente para o documento que tem este ID dentro da coleção 'vendas'
    const vendaRef = doc(db, 'vendas', idVenda);
    
    // Envia apenas os dados que foram modificados
    await updateDoc(vendaRef, dadosAtualizados);
  } catch (erro) {
    console.error("Erro ao atualizar a venda:", erro);
    throw new Error("Não foi possível atualizar os dados da venda.");
  }
}
