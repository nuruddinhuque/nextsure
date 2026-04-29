// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXhfBmVjh--qFtwcMjWMR5TRu80hOe5wc",
  authDomain: "nextsure-admin.firebaseapp.com",
  projectId: "nextsure-admin",
  storageBucket: "nextsure-admin.firebasestorage.app",
  messagingSenderId: "736664254101",
  appId: "1:736664254101:web:32c59df3ea8cca168b0d9c",
  measurementId: "G-ZS2MWTK52K"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const analytics = getAnalytics(firebase.app());

document.getElementById('loginBtn').onclick=()=>{
  const email=document.getElementById('email').value;
  const pass=document.getElementById('pass').value;
  signInWithEmailAndPassword(auth,email,pass)
  .then(()=> location.href="dashboard.html")
  .catch(e=> alert(e.message));
};
