import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Importação do nosso novo Layout
import MainLayout from './layouts/MainLayout';

// Lazy loading dos módulos
const DashboardModule = lazy(() => import('./modules/dashboard/DashboardPage'));
const FinanceModule = lazy(() => import('./modules/finance/FinancePage'));

export default function App() {
  return (
    <BrowserRouter>
      {/* Sistema de Notificações Global isolado das rotas */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(11, 15, 25, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
          }
        }} 
      />

      {/* A tela de carregamento global agora engloba as rotas */}
      <Suspense fallback={
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center text-indigo-400">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-bold animate-pulse">Carregando Módulo...</p>
        </div>
      }>
        <Routes>
          {/* Todas as rotas filhas herdarão a casca do MainLayout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardModule />} />
            <Route path="/financeiro" element={<FinanceModule />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
