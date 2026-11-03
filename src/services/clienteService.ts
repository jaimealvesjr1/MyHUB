// Arquivo: src/services/clienteService.ts
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Cliente } from '../types/models';

/**
 * Busca todos os clientes pertencentes ao corretor logado.
 */
export const buscarClientes = async (): Promise<Cliente[]> => {
  const user = auth.currentUser;
  
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'clientes'),
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    const clientes: Cliente[] = [];
    
    querySnapshot.forEach((doc) => {
      clientes.push({ id: doc.id, ...doc.data() } as Cliente);
    });
    
    return clientes;
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    return [];
  }
};

/**
 * Cria um novo cliente, carimbando-o com o ID do corretor logado.
 */
export const salvarClienteNoBanco = async (dadosCliente: Omit<Cliente, 'id'>) => {
  const user = auth.currentUser;
  
  if (!user) throw new Error('Operação negada: Utilizador não autenticado.');

  const clienteComDono = {
    ...dadosCliente,
    userId: user.uid,
    dataCadastro: new Date()
  };

  try {
    const docRef = await addDoc(collection(db, 'clientes'), clienteComDono);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    throw error;
  }
};

/**
 * NOVA FUNÇÃO: Atualiza os dados de um cliente existente.
 * Esta era a função que estava a causar o erro no ClientesPage.tsx.
 */
export const atualizarClienteNoBanco = async (idCliente: string, dadosAtualizados: Partial<Cliente>): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  try {
    // Aponta para o documento específico do cliente na coleção 'clientes'
    const clienteRef = doc(db, 'clientes', idCliente);
    
    // As regras de segurança do Firestore garantirão que esta ação 
    // só será aceite se o 'userId' do documento for igual ao 'user.uid'
    await updateDoc(clienteRef, dadosAtualizados);
  } catch (error) {
    console.error("Erro ao atualizar o cliente:", error);
    throw new Error("Não foi possível atualizar os dados do cliente.");
  }
};
