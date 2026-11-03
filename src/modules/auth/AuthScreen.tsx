import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';

export default function AuthScreen() {
  const { loginWithGoogle } = useAuthStore();
  
  // Estados para controlar o aspeto visual durante a tentativa de login
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null); // Limpa erros anteriores
    
    try {
      await loginWithGoogle();
      // Se tiver sucesso, o próprio Zustand (onAuthStateChanged) 
      // deteta o utilizador e muda o ecrã automaticamente.
    } catch (error: any) {
      // Captura a mensagem amigável que definimos no Zustand
      setErrorMessage(error.message);
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Elementos decorativos de fundo (Efeito visual moderno) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-600/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-red-900/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Cartão de Login */}
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-8 relative z-10 backdrop-blur-sm">
        
        {/* Cabeçalho do Login */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <Shield className="text-red-500" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
            My<span className="text-red-600">HUB</span>
          </h1>
          <p className="text-gray-400 text-sm">
            Portal exclusivo para gestão de clientes.
          </p>
        </div>

        {/* Área de Mensagem de Erro */}
        {errorMessage && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-200">{errorMessage}</p>
          </div>
        )}

        {/* Botão de Ação */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className={`w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3.5 px-4 rounded-xl transition-all duration-300 ${
            isLoggingIn 
              ? 'opacity-70 cursor-not-allowed' 
              : 'hover:bg-gray-200 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98]'
          }`}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="animate-spin text-black" size={20} />
              Autenticando...
            </>
          ) : (
            <>
              {/* Ícone SVG oficial do Google */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Entrar com Google
            </>
          )}
        </button>

        {/* Rodapé do Cartão */}
        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
            Acesso Restrito
          </p>
          <p className="text-xs text-gray-600">
            Apenas Consultores Autorizados Ademicon.
          </p>
        </div>
        
      </div>
    </div>
  );
}
