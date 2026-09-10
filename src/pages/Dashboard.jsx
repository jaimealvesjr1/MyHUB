import React from 'react';

// Um componente simples apenas para testarmos se o roteamento e o Tailwind estão funcionando
export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] bg-dark-card border border-dark-border rounded-3xl shadow-2xl p-10 animate-in fade-in">
      <h1 className="text-4xl font-black text-white mb-4">
        Bem-vindo ao seu novo HUB! 🚀
      </h1>
      <p className="text-gray-400">
        A arquitetura modular está funcionando perfeitamente.
      </p>
    </div>
  );
}
