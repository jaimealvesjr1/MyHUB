import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';

import MainLayout from './layouts/MainLayout';
import AuthScreen from './modules/auth/AuthScreen';

const DashboardModule = lazy(() => import('./modules/dashboard/DashboardPage'));
const FinanceModule = lazy(() => import('./modules/finance/FinancePage'));
const AdminModule = lazy(() => import('./modules/admin/AdminPage'));

export default function App() {
  const { user, isLoading, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center text-orange-400">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold animate-pulse">Conectando ao banco...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <BrowserRouter>
      <Toaster 
        position="bottom-right"
        toastOptions={{ style: { background: 'rgba(11, 15, 25, 0.95)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' } }} 
      />

      <Suspense fallback={
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center text-orange-400">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-bold animate-pulse">Carregando Módulo...</p>
        </div>
      }>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardModule />} />
            <Route path="/financeiro" element={<FinanceModule />} />
            
            {/* Proteção da rota Admin */}
            <Route path="/admin" element={user?.role === 'admin' ? <AdminModule /> : <Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
