/* ============================================================
   Firebase — Configuración e inicialización (SDK Compat / CDN)
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDmXCQUoK7Yb_3umOYBE_uHZ_j8H7diySw",
  authDomain: "esteticawandacuadrado.firebaseapp.com",
  projectId: "esteticawandacuadrado",
  storageBucket: "esteticawandacuadrado.firebasestorage.app",
  messagingSenderId: "429537751825",
  appId: "1:429537751825:web:660d0c5347bb86c45412b0"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias globales usadas en todos los módulos
const auth = firebase.auth();
const db = firebase.firestore();

// Idioma de errores en español
auth.languageCode = 'es';
