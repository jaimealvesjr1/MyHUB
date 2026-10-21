import { collection, addDoc, getDocs, QueryDocumentSnapshot, DocumentData, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Cliente } from '../types/models';

/**
 * Função responsável por salvar um novo cliente no banco de dados.
 */
export async function salvarClienteNoBanco(cliente: Cliente): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'clientes'), cliente);
    return docRef.id;
  } catch (erro) {
    console.error("Erro ao salvar o cliente:", erro);
    throw new Error("Não foi possível salvar o cliente no momento.");
  }
}

/**
 * Busca todos os clientes cadastrados na coleção 'clientes' do Firebase.
 */
export async function buscarClientes(): Promise<Cliente[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    const listaClientes: Cliente[] = [];

    // Tipamos o 'doc' explicitamente para resolver o erro 7006
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      listaClientes.push({
        id: doc.id,
        ...doc.data()
      } as Cliente);
    });

    return listaClientes;
  } catch (erro) {
    console.error("Erro ao buscar clientes:", erro);
    return [];
  }
}

/**
 * Atualiza os dados de um cliente existente no Firebase.
 */
export async function atualizarClienteNoBanco(idCliente: string, dadosAtualizados: Partial<Cliente>): Promise<void> {
  try {
    const clienteRef = doc(db, 'clientes', idCliente);
    await updateDoc(clienteRef, dadosAtualizados);
  } catch (erro) {
    console.error("Erro ao atualizar o cliente:", erro);
    throw new Error("Não foi possível atualizar os dados do cliente.");
  }
}