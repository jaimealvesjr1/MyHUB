import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Suas chaves do Firebase (mantenha as que você copiou do site)
const firebaseConfig = {
  apiKey: "AIzaSyAiiv7Z5_jy_IbIu0opChYaAnFOwCNli9A",
  authDomain: "my-personalhub.firebaseapp.com",
  projectId: "my-personalhub",
  storageBucket: "my-personalhub.firebasestorage.app",
  messagingSenderId: "54519128482",
  appId: "1:54519128482:web:b45e1698bd68af4b90d2fb"
};

// 1. Inicializa o aplicativo Firebase com as suas configurações
const app = initializeApp(firebaseConfig);

// 2. Cria as ferramentas de Autenticação e Banco de Dados
// 3. O "export const" é crucial! Ele avisa ao React: "Ei, outros arquivos podem pegar essas ferramentas!"
export const auth = getAuth(app);
export const db = getFirestore(app);
