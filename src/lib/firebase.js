// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// PEGA AQUÍ TUS CREDENCIALES (Las que te dio la consola en el Paso 2)
// Ojo: En un proyecto real usaríamos variables de entorno (.env), 
// pero para este MVP rápido pégalas directo aquí.
const firebaseConfig = {
  apiKey: "AIzaSyDaWoJsiGi18UmfRIj7kb4jFydbt9r7Nng",
  authDomain: "datamind-mvp.firebaseapp.com",
  projectId: "datamind-mvp",
  storageBucket: "datamind-mvp.firebasestorage.app",
  messagingSenderId: "194709820010",
  appId: "1:194709820010:web:442c5854624c25e8b47013"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Exportamos las herramientas que usaremos
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);