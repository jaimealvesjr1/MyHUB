// Arquivo: src/store/useAuthStore.ts
import { create } from 'zustand';
import { auth, db } from '../config/firebase'; 
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// 1. Molde que define a estrutura exata do seu usuário
export interface UserData {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  role: 'user' | 'admin'; 
}

// 2. Molde que define tudo o que o Zustand guarda e as funções que ele exporta
interface AuthStore {
  user: UserData | null;
  isLoading: boolean;
  initializeAuth: () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

// 3. Aplicação da tipagem <AuthStore> na criação do estado
export const useAuthStore = create<AuthStore>((set) => ({
  user: null, 
  isLoading: true, 

  // Inicia o observador de login
  initializeAuth: () => {
    // Tipamos o currentUser com o molde nativo do Firebase (FirebaseUser)
    onAuthStateChanged(auth, async (currentUser: FirebaseUser | null) => {
      if (currentUser) {
        // Busca os dados adicionais do usuário (como o cargo/role) no Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let userData: UserData = {
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName,
          photoURL: currentUser.photoURL,
          role: 'user' // Cargo padrão
        };

        if (userDocSnap.exists()) {
          // Se o usuário já existe no banco, mescla os dados e força a tipagem com 'as UserData'
          userData = { ...userData, ...userDocSnap.data() } as UserData;
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
    } catch (error) {
      console.error("Erro no login com Google:", error);
      throw error; 
    }
  },

  // Função para deslogar
  logout: async () => {
    await signOut(auth);
    set({ user: null });
  },
}));
