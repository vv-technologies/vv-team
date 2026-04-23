// --- CONFIGURARE PERSISTENȚĂ SESIUNE ---
// Setăm persistența la LOCAL (token-ul rămâne stocat securizat de browser)
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log("VV Nexus: Persistență activată. Sesiune securizată.");
  })
  .catch((error) => {
    console.error("Eroare persistență:", error);
  });

// --- SESION CHECK (Auth Guard) ---
// Verificăm identitatea și rolul înainte de a încărca dashboard-ul
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    const userDoc = await db.collection("users").doc(user.uid).get();
    if (userDoc.exists && userDoc.data().role === 'ceo') {
      console.log("Acces autorizat: CEO detectat.");
      initDashboard(); // Incarcă interfața Horizon/Pulse
    } else {
      console.warn("Acces restricționat: Rol insuficient.");
      window.location.href = "login.html"; // Redirect dacă nu e CEO
    }
  } else {
    console.log("Utilizator deconectat. Redirecționare...");
    window.location.href = "login.html";
  }
});

// --- FUNCȚIE LOGIN (Actualizată) ---
async function handleLogin(email, password) {
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    // Persistența este deja setată, token-ul va fi salvat automat de Firebase
  } catch (error) {
    console.error("Eroare autentificare:", error.message);
    alert("Acces refuzat: Credențiale invalide.");
  }
}