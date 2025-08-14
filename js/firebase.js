<script type="module">
// ==== あなたのFirebase設定に置き換えてください ====
// Firebaseコンソール → プロジェクト設定 → SDK設定と構成 → 構成
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com" // Realtime DBを使う場合はこれも
};

// Firestoreで実装（推奨）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);
await signInAnonymously(auth);

// コレクション参照
export const colEmployees = collection(db, "employees"); // {id,name,createdAt}
export const colShifts    = collection(db, "shifts");    // {id,empId,date,fromHour,toHour,note}

// ラッパ関数
export { db, doc, setDoc, addDoc, deleteDoc, onSnapshot, query, where, orderBy };
</script>
