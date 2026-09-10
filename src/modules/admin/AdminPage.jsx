import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Shield, ShieldAlert, User as UserIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Busca todos os usuários na coleção 'users' do Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersList);
      } catch (error) {
        toast.error("Erro ao carregar usuários.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Altera o cargo (role) do usuário no banco de dados
  const handleRoleChange = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      
      // Atualiza a tela localmente
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("Acesso atualizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar o acesso.");
    }
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="text-orange-500" size={24} /> 
          Painel de Administração
        </h1>
        <p className="text-gray-400 text-sm mt-1">Gerencie os acessos e permissões dos usuários do MyHUB.</p>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-black/40 border-b border-dark-border text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 font-semibold">Usuário</th>
                <th className="p-4 font-semibold">E-mail</th>
                <th className="p-4 font-semibold">Nível de Acesso</th>
                <th className="p-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">Carregando usuários...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white">
                            <UserIcon size={14} />
                          </div>
                        )}
                        <span className="font-bold text-white text-sm">{user.name || 'Sem nome'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">{user.email}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider border ${
                        user.role === 'admin' 
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' 
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}>
                        {user.role === 'admin' ? 'Administrador' : 'Usuário Padrão'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {user.role === 'admin' ? (
                        <button 
                          onClick={() => handleRoleChange(user.id, 'user')}
                          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 py-1.5 px-3 rounded-lg transition-colors"
                        >
                          Tirar Admin
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleRoleChange(user.id, 'admin')}
                          className="text-xs bg-orange-600/20 hover:bg-orange-600/40 border border-orange-500/30 text-orange-300 py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                        >
                          <ShieldAlert size={14} /> Tornar Admin
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
