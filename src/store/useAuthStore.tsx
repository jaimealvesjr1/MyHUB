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
    onAuthStateChanged(auth, async (currentUser: FirebaseUser | null) => {
      if (currentUser) {
        // Criamos o objeto básico do utilizador com os dados do Google
        let userData: UserData = {
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName,
          photoURL: currentUser.photoURL,
          role: 'user' // Cargo padrão
        };

        try {
          // TENTATIVA: Busca os dados adicionais do usuário no Firestore
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            // Se o usuário já existe no banco, mescla os dados
            userData = { ...userData, ...userDocSnap.data() } as UserData;
          } else {
            // Se é o primeiro login, salva o usuário novo no banco de dados
            await setDoc(userDocRef, userData);
          }

          set({ user: userData, isLoading: false });
          
        } catch (error) {
          // PROTEÇÃO: Se falhar (ex: sem internet ou sem permissão nas regras), 
          // não quebramos a app! Logamos o utilizador apenas com os dados básicos.
          console.warn("Aviso: Não foi possível sincronizar o perfil com o Firestore. Entrando em modo básico.", error);
          set({ user: userData, isLoading: false });
        }
        
      } else {
        set({ user: null, isLoading: false });
      }
    });
  },

  // Função para Login com Google
  loginWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' }); 
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Erro detalhado do Firebase Auth:", error);
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          throw new Error('O login foi cancelado antes de ser concluído.');
        case 'auth/popup-blocked':
          throw new Error('O seu navegador bloqueou a janela de login. Por favor, desative o bloqueador de pop-ups.');
        case 'auth/network-request-failed':
          throw new Error('Falha na ligação à internet. Verifique a sua rede e tente novamente.');
        // NOVA LINHA ADICIONADA AQUI:
        case 'auth/internal-error':
          throw new Error('Erro interno de comunicação. Verifique se o seu navegador ou antivírus está a bloquear o pop-up de login.');
        default:
          throw new Error('Ocorreu um erro ao tentar iniciar sessão. Tente novamente mais tarde.');
      }
    }
  },

  // Função para deslogar
  logout: async () => {
    await signOut(auth);
    set({ user: null });
  },
}));
