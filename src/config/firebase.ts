import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAiiv7Z5_jy_IbIu0opChYaAnFOwCNli9A",
  authDomain: "my-personalhub.firebaseapp.com",
  projectId: "my-personalhub",
  storageBucket: "my-personalhub.firebasestorage.app",
  messagingSenderId: "54519128482",
  appId: "1:54519128482:web:b45e1698bd68af4b90d2fb"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app); 
export const auth = getAuth(app);
