import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Lock, Mail } from 'lucide-react';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setUser } = useAuthStore();

  const handleLogin = (e) => {
    e.preventDefault();
    if (email && password) {
      setUser({ nome: 'Gestor', email: email, role: 'Admin' });
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dark-card border border-dark-border p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tighter">
            My<span className="text-orange-500">HUB</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">Acesse seu ambiente integrado</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="email" 
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-dark-border text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-orange-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="password" 
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-dark-border text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-orange-500 transition-colors"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(234,88,12,0.4)] hover:shadow-[0_0_25px_rgba(234,88,12,0.6)]"
          >
            Entrar no Sistema
          </button>
        </form>
      </div>
    </div>
  );
}
