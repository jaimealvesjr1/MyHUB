import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null, // Guardará os dados do usuário logado (email, nome)
  isLoading: true, // Começa carregando para verificarmos o Firebase
  
  // Ações para alterar o estado
  setUser: (userData) => set({ user: userData, isLoading: false }),
  logout: () => set({ user: null, isLoading: false }),
}));
