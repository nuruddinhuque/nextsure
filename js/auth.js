// --------------------------------------------------
// 1) Initialize Firebase App FIRST
// --------------------------------------------------
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

// --------------------------------------------------
// 2) NOW Initialize Auth
// --------------------------------------------------
const auth = firebase.auth();

// Helper message
function showMsg(msg){
  const el = document.getElementById("auth-msg");
  if(el) el.innerText = msg;
}

/* ---------------- EMAIL LOGIN ---------------- */
async function emailSignIn(email, password){
  try{
    const res = await auth.signInWithEmailAndPassword(email, password);
    localStorage.setItem("ns_user", res.user.uid);
    window.location.href = "dashboard.html";
  }catch(err){
    console.error(err);
    showMsg(err.message);
  }
}

/* ---------------- GOOGLE LOGIN ---------------- */
const googleProvider = new firebase.auth.GoogleAuthProvider();

async function googleSignIn(){
  try{
    const res = await auth.signInWithPopup(googleProvider);
    localStorage.setItem("ns_user", res.user.uid);
    window.location.href = "dashboard.html";
  }catch(err){
    console.error(err);
    showMsg(err.message);
  }
}

/* ---------------- PHONE OTP ---------------- */
function setupRecaptcha(){
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
    size: "invisible",
    callback: function(){
      console.log("reCAPTCHA solved");
    }
  });
}

async function phoneSendOTP(phone){
  try{
    if(!window.recaptchaVerifier) setupRecaptcha();
    
    const confirmationResult = await auth.signInWithPhoneNumber(
      phone,
      window.recaptchaVerifier
    );

    window._confirmationResult = confirmationResult;
    showMsg("OTP sent successfully.");
  }catch(err){
    console.error(err);
    showMsg(err.message);
  }
}

async function phoneVerifyOTP(code){
  try{
    const res = await window._confirmationResult.confirm(code);
    localStorage.setItem("ns_user", res.user.uid);
    window.location.href = "dashboard.html";
  }catch(err){
    console.error(err);
    showMsg(err.message);
  }
}

/* ---------------- SIGN OUT ---------------- */
function signOut(){
  auth.signOut();
  localStorage.removeItem("ns_user");
  window.location.href = "login.html";
}

/* ---------------- PROTECT DASHBOARD ---------------- */
function requireAuth(){
  auth.onAuthStateChanged(function(user){
    if(!user){
      window.location.href = "login.html";
    }
  });
}
