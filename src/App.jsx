import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';

import MainLayout from './layouts/MainLayout';
import AuthScreen from './modules/auth/AuthScreen';

const DashboardModule = lazy(() => import('./modules/dashboard/DashboardPage'));
const FinanceModule = lazy(() => import('./modules/finance/FinancePage'));
const AdminModule = lazy(() => import('./modules/admin/AdminPage'));
const TasksModule = lazy(() => import('./modules/tasks/TasksPage'));
const FitnessModule = lazy(() => import('./modules/fitness/FitnessPage'));
const APP_VERSION = '1.0';

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
            <Route path="/tarefas" element={<TasksModule />} />
            <Route path="/fitness" element={<FitnessModule />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminModule /> : <Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        <footer className="w-full border-t border-white/5 bg-black/40 py-6 mt-auto shrink-0 z-20 relative">
          <div className="w-full max-w-[2560px] mx-auto px-4 md:px-8 2xl:px-12 min-[2000px]:px-16 flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center hover:cursor-pointer group">
              <img 
                src="/ascentia-icon.png" 
                alt="Ascentia Logo" 
                className="h-5 md:h-6 w-auto opacity-50 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all duration-500 object-contain"
              />
            </div>
            
            <div className="flex flex-col items-center md:items-end text-center md:text-right">
              <span className="text-[9px] bg-white/5 border border-white/10 text-orange-400/80 px-2 py-0.5 rounded font-bold tracking-widest">
                v{APP_VERSION}
              </span>
              <p className="text-[11px] text-gray-500 font-medium">
                &copy; {new Date().getFullYear()} Ascentia Solutions. Todos os direitos reservados.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                  Desenvolvido para Performance Pessoal
                </p>
              </div>
            </div>
          </div>
        </footer>
      </Suspense>
    </BrowserRouter>
  );
}
