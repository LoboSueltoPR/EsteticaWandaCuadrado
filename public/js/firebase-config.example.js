/* ============================================================
   Firebase — Configuración e inicialización (SDK Compat / CDN)

   ⚠️  ESTE ES UN ARCHIVO TEMPLATE — no tiene credenciales reales.

   Para desarrollo local:
     1. Copiá este archivo: cp firebase-config.example.js firebase-config.js
     2. Completá los valores con los de tu Firebase Console
        (Project Settings → General → Your apps → SDK setup)
     3. firebase-config.js está en .gitignore → nunca se sube a GitHub

   En producción (GitHub Pages):
     Las credenciales se inyectan automáticamente desde
     GitHub → Settings → Secrets and variables → Actions
   ============================================================ */

const firebaseConfig = {
  apiKey:            "${FIREBASE_API_KEY}",
  authDomain:        "${FIREBASE_AUTH_DOMAIN}",
  projectId:         "${FIREBASE_PROJECT_ID}",
  storageBucket:     "${FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${FIREBASE_MESSAGING_SENDER_ID}",
  appId:             "${FIREBASE_APP_ID}"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias globales usadas en todos los módulos
const auth = firebase.auth();
const db   = firebase.firestore();

// ─── Cache persistente en IndexedDB ───
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('[firestore] Persistencia no habilitada: otra pestaña sin soporte está abierta.');
  } else if (err.code === 'unimplemented') {
    console.warn('[firestore] Persistencia no soportada en este navegador.');
  }
});

// Idioma de errores en español
auth.languageCode = 'es';
