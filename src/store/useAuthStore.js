// src/store/useAuthStore.js
import { create } from 'zustand';
import { auth, db } from '../config/firebase'; 
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const useAuthStore = create((set) => ({
  user: null, 
  isLoading: true, 

  // Inicia o observador de login
  initializeAuth: () => {
    onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Busca os dados adicionais do usuário (como o cargo/role) no Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let userData = {
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName,
          photoURL: currentUser.photoURL,
          role: 'user' // Cargo padrão
        };

        if (userDocSnap.exists()) {
          // Se o usuário já existe no banco, mescla os dados (pega o role real dele)
          userData = { ...userData, ...userDocSnap.data() };
        } else {
          // Se é o primeiro login, salva o usuário novo no banco de dados
          await setDoc(userDocRef, userData);
        }

        set({ user: userData, isLoading: false });
      } else {
        set({ user: null, isLoading: false });
      }
    });
  },

  // Função para Login com Google
  loginWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // O onAuthStateChanged (acima) vai detectar o sucesso e redirecionar automaticamente
    } catch (error) {
      console.error("Erro no login com Google:", error);
      throw error; // Lança o erro para a tela exibir o aviso
    }
  },

  // Função para deslogar
  logout: async () => {
    await signOut(auth);
    set({ user: null });
  },
}));
