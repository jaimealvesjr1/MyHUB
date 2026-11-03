import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Proposta } from '../types/models';

/**
 * Busca todas as propostas ativas e finalizadas do usuário logado.
 */
export const buscarPropostas = async (): Promise<Proposta[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'propostas'),
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    const propostas: Proposta[] = [];
    
    querySnapshot.forEach((doc) => {
      propostas.push({ id: doc.id, ...doc.data() } as Proposta);
    });
    
    // Opcional: ordenar as propostas da mais recente para a mais antiga
    return propostas.sort((a, b) => b.dataCriacao - a.dataCriacao);
  } catch (error) {
    console.error("Erro ao buscar propostas:", error);
    return [];
  }
};

/**
 * Salva uma nova proposta no Firebase.
 */
export const salvarProposta = async (dadosProposta: Omit<Proposta, 'id' | 'userId' | 'dataCriacao'>) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');

  // Injetamos a identidade do usuário e a data atual automaticamente
  const propostaComDono = {
    ...dadosProposta,
    userId: user.uid,
    dataCriacao: new Date()
  };

  try {
    const docRef = await addDoc(collection(db, 'propostas'), propostaComDono);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao salvar proposta:", error);
    throw error;
  }
};

/**
 * Atualiza o status ou os dados de uma proposta existente (ex: Mover de "Enviada" para "Ganho").
 */
export const atualizarProposta = async (idProposta: string, dadosAtualizados: Partial<Proposta>) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  try {
    const propostaRef = doc(db, 'propostas', idProposta);
    await updateDoc(propostaRef, dadosAtualizados);
  } catch (error) {
    console.error("Erro ao atualizar a proposta:", error);
    throw new Error("Não foi possível atualizar a proposta.");
  }
};

/**
 * Exclui uma proposta (caso tenha sido criada por engano).
 */
export const excluirProposta = async (idProposta: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  try {
    const propostaRef = doc(db, 'propostas', idProposta);
    await deleteDoc(propostaRef);
  } catch (error) {
    console.error("Erro ao excluir a proposta:", error);
    throw new Error("Não foi possível excluir a proposta.");
  }
};
