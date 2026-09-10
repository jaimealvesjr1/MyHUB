import { create } from 'zustand';
import { db } from '../config/firebase'; // Importa a conexão do nosso banco
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'; // Ferramentas do Firestore

export const useDataStore = create((set) => ({
  stores: [], // Aqui ficarão guardadas todas as nossas lojas/clientes
  isLoadingData: true, // Controle de carregamento

  // Função para "escutar" o banco de dados em tempo real
  listenToStores: () => {
    // Apontamos para a coleção chamada "stores" no Firebase
    const storesRef = collection(db, "stores");

    // O onSnapshot fica observando. Se você adicionar uma loja pelo celular, a tela do computador atualiza sozinha!
    const unsubscribe = onSnapshot(storesRef, (snapshot) => {
      // Pega todos os documentos que vieram do banco e transforma num formato de lista (Array)
      const storesData = snapshot.docs.map(doc => doc.data());
      
      // Organiza a lista para que a loja mais recente (maior ID) fique no topo
      storesData.sort((a, b) => b.id - a.id);
      
      // Salva a lista na nossa memória global
      set({ stores: storesData, isLoadingData: false });
    });

    // Retornamos essa função para que o React possa "desligar" o observador se mudarmos de tela
    return unsubscribe;
  },

  // Função para adicionar uma nova loja
  addStore: async (newStore) => {
    try {
      // Criamos uma referência. O nome do documento no banco será o ID da loja convertido em texto
      const storeRef = doc(db, "stores", newStore.id.toString());
      
      // setDoc grava a informação lá na nuvem
      await setDoc(storeRef, newStore);
    } catch (error) {
      console.error("Erro ao adicionar loja:", error);
    }
  }
}));
