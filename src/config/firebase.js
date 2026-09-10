import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Substitua estas chaves com as configurações do seu projeto Firebase futuramente
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta a Autenticação e o Banco de Dados para usarmos nos módulos
export const auth = getAuth(app);
export const db = getFirestore(app);
