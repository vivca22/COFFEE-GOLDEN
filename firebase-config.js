import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Pega aqui la configuracion publica de tu app web de Firebase.
// Firebase Console -> Project settings -> General -> Your apps -> Web app.
// No pegues claves privadas, archivos JSON de servicio ni secretos de servidor.
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const hasFirebaseConfig = !Object.values(firebaseConfig).some((value) =>
  value.startsWith("TU_") || value.includes("TU_PROYECTO")
);

export const firebaseReady = hasFirebaseConfig;
export const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const db = hasFirebaseConfig ? getFirestore(app) : null;
