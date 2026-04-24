// ============================================================
// VV-TEAM.js — CEO Central Intelligence Panel
// Arhitectură: Vanilla JS + Firebase v8 (compat)
// Colecții: users, missions, contracts, transactions,
//           talent_pool, audit_log, config, feedback,
//           pulse_events, vvhi_dataset
// ============================================================

const db = firebase.firestore();
const auth = firebase.auth();

// ── CONSTANTE ──
const COIN_REWARD_DEFAULT = 10;
const RANKS = ['Neofit', 'Explorer', 'Trainer', 'Master', 'Fondator'];

// ── STARE GLOBALĂ ──
let currentCEO = null;
let currentSection = 'missions';
let lightboxImages = [];
let lightboxIndex = 0;

// ============================================================
// 1. AUTENTIFICARE & AUTH GUARD
// ============================================================

firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists && userDoc.data().role === 'ceo') {
      currentCEO = { uid: user.uid, ...userDoc.data() };
      console.log('VV CEO Panel: Acces autorizat.');
      buildInterface();
      initDashboard();
    } else {
      console.warn('Rol insuficient.');
      window.location.href = 'login.html';
    }
  } catch (e) {
    console.error('Auth check error:', e);
    window.location.href = 'login.html';
  }
});

async function handleLogin(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error('Login error:', error.message);
    const btn = document.querySelector('.login-btn');
    if (btn) { btn.textContent = 'ACCES REFUZAT'; setTimeout(() => btn.textContent = 'INTRĂ', 2000); }
  }
}

function handleLogout() {
  auth.signOut().then(() => window.location.href = 'login.html');
}

// ============================================================
// 2. CONSTRUIRE INTERFAȚĂ (injectare HTML în #app-container)
// ============================================================

function buildInterface() {
  const app = document.getElementById('app-container');
  if (!app) return;

  app.innerHTML = `
    <!-- LOGIN SCREEN -->
    <div id="login-screen" style="display:none">
      <div class="logo-box">VV</div>
      <div class="logo-sub">CEO COMMAND CENTER</div>
      <input class="login-input" id="login-email" type="email" placeholder="Email CEO" autocomplete="username">
      <input class="login-input" id="login-pass" type="password" placeholder="Parolă" autocomplete="current-password">
      <button class="login-btn" onclick="handleLogin(document.getElementById('login-email').value, document.getElementById('login-pass').value)">INTRĂ</button>
    </div>

    <!-- SIDEBAR -->
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">VV TEAM</div>
        <div class="sidebar-subtitle">CEO PANEL</div>
      </div>
      <div class="system-money-box">
        <div class="money-label">VV Coins în sistem</div>
        <div class="money-value" id="total-coins">— VVC</div>
      </div>
      <div class="nav-item active" onclick="showSection('missions')" id="nav-missions">
        <i>🎯</i> <span>Misiuni</span>
        <span class="nav-badge" id="badge-missions"></span>
      </div>
      <div class="nav-item" onclick="showSection('contracts')" id="nav-contracts">
        <i>📋</i> <span>Contracte</span>
        <span class="nav-badge" id="badge-contracts"></span>
      </div>
      <div class="nav-item" onclick="showSection('feedback')" id="nav-feedback">
        <i>💬</i> <span>Feedback</span>
        <span class="nav-badge" id="badge-feedback"></span>
      </div>
      <div class="nav-item" onclick="showSection('talent')" id="nav-talent">
        <i>👥</i> <span>Talent Pool</span>
      </div>
      <div class="nav-item" onclick="showSection('leaderboard')" id="nav-leaderboard">
        <i>🏆</i> <span>Leaderboard</span>
      </div>
      <div class="nav-item" onclick="showSection('keys')" id="nav-keys">
        <i>🔑</i> <span>Chei Beta</span>
      </div>
      <div class="nav-item" onclick="showSection('config')" id="nav-config">
        <i>⚙️</i> <span>Config Live</span>
      </div>
      <div class="nav-item" onclick="showSection('audit')" id="nav-audit">
        <i>📜</i> <span>Audit Log</span>
      </div>
      <div class="nav-item" onclick="showSection('map')" id="nav-map">
        <i>🗺</i> <span>Harta Misiuni</span>
      </div>
      <div class="nav-item" onclick="showSection('vvhi')" id="nav-vvhi">
        <i>🤖</i> <span>VVhi Shadow</span>
      </div>
      <div class="nav-item logout-btn" onclick="handleLogout()">
        <i>🚪</i> <span>Deconectare</span>
      </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="main-content" id="main-content">

      <!-- MISIUNI -->
      <div class="section active" id="section-missions">
        <div class="section-header-row">
          <div>
            <div class="section-title">Galerie Misiuni</div>
            <div class="section-desc">Validează misiunile trimise de Insideri. Aprobare = VV Coins automat.</div>
          </div>
          <button class="btn-delete-all" onclick="deleteAllRejected()">🗑 Șterge respinse</button>
        </div>
        <div id="missions-tabs" style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
          <button class="btn-tab active" onclick="loadMissions('pending')" id="tab-pending">⏳ În așteptare</button>
          <button class="btn-tab" onclick="loadMissions('approved')" id="tab-approved">✅ Aprobate</button>
          <button class="btn-tab" onclick="loadMissions('rejected')" id="tab-rejected">❌ Respinse</button>
        </div>
        <div class="grid-container" id="missions-grid">
          <div style="color:var(--text-muted);padding:20px">Se încarcă misiunile...</div>
        </div>
      </div>

      <!-- CONTRACTE -->
      <div class="section" id="section-contracts">
        <div class="section-header-row">
          <div>
            <div class="section-title">Contracte Active</div>
            <div class="section-desc">Gestionează contractele lansate de utilizatori.</div>
          </div>
        </div>
        <div id="contracts-list">
          <div style="color:var(--text-muted);padding:20px">Se încarcă contractele...</div>
        </div>
      </div>

      <!-- FEEDBACK -->
      <div class="section" id="section-feedback">
        <div class="section-header-row">
          <div>
            <div class="section-title">Feedback & Suport</div>
            <div class="section-desc">Bug reports și mesaje de la utilizatori.</div>
          </div>
          <button class="btn-delete-all" onclick="deleteAllFeedback()">🗑 Șterge rezolvate</button>
        </div>
        <div id="feedback-list">
          <div style="color:var(--text-muted);padding:20px">Se încarcă feedback-ul...</div>
        </div>
      </div>

      <!-- TALENT POOL -->
      <div class="section" id="section-talent">
        <div class="section-header-row">
          <div>
            <div class="section-title">Talent Pool</div>
            <div class="section-desc">Gestionează rangurile utilizatorilor în ecosistem.</div>
          </div>
        </div>
        <div id="talent-list">
          <div style="color:var(--text-muted);padding:20px">Se încarcă talent pool-ul...</div>
        </div>
      </div>

      <!-- LEADERBOARD -->
      <div class="section" id="section-leaderboard">
        <div class="section-header-row">
          <div>
            <div class="section-title">Leaderboard VV Onyx</div>
            <div class="section-desc">Top utilizatori după VV Coins acumulate.</div>
          </div>
        </div>
        <table class="vv-table">
          <thead>
            <tr>
              <th>#</th><th>Utilizator</th><th>Rang</th><th>VV Coins</th><th>Misiuni</th>
            </tr>
          </thead>
          <tbody id="leaderboard-body">
            <tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:20px">Se încarcă...</td></tr>
          </tbody>
        </table>
      </div>

      <!-- CHEI BETA -->
      <div class="section" id="section-keys">
        <div class="section-header-row">
          <div>
            <div class="section-title">Chei Beta</div>
            <div class="section-desc">Generează și gestionează cheile de acces VV Beta.</div>
          </div>
        </div>
        <div class="key-generator-card">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:15px">Generează o nouă cheie de acces unică pentru un utilizator.</div>
          <button class="btn-primary" onclick="generateKey()">🔑 Generează cheie nouă</button>
          <div id="keys-list"></div>
        </div>
      </div>

      <!-- CONFIG LIVE -->
      <div class="section" id="section-config">
        <div class="section-header-row">
          <div>
            <div class="section-title">Config Live</div>
            <div class="section-desc">Modifică setările ecosistemului în timp real.</div>
          </div>
        </div>
        <div id="config-panel" style="display:flex;flex-direction:column;gap:15px;max-width:500px">
          <div class="key-generator-card">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Kill Switch</div>
            <div style="display:flex;gap:10px">
              <button class="btn-approve" onclick="setKillSwitch(true)">🟢 Activează Site</button>
              <button class="btn-reject" onclick="setKillSwitch(false)">🔴 Pune în Mentenanță</button>
            </div>
          </div>
          <div class="key-generator-card">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Valoare VV Coin per misiune</div>
            <div style="display:flex;gap:10px;align-items:center">
              <input id="coin-value-input" type="number" value="10" min="1" max="100" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:10px 15px;border-radius:8px;color:#fff;font-size:16px;width:100px;outline:none">
              <button class="btn-approve" onclick="updateCoinValue()">Salvează</button>
            </div>
          </div>
          <div class="key-generator-card">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Mesajul zilei (afișat în hub)</div>
            <textarea id="daily-message-input" style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:10px 15px;border-radius:8px;color:#fff;font-size:14px;outline:none;resize:none;min-height:80px" placeholder="Scrie mesajul zilei..."></textarea>
            <button class="btn-approve" style="margin-top:10px;width:100%" onclick="updateDailyMessage()">Publică mesajul</button>
          </div>
        </div>
      </div>

      <!-- AUDIT LOG -->
      <div class="section" id="section-audit">
        <div class="section-header-row">
          <div>
            <div class="section-title">Audit Log</div>
            <div class="section-desc">Toate acțiunile tale înregistrate pentru securitate.</div>
          </div>
        </div>
        <table class="vv-table">
          <thead>
            <tr><th>Acțiune</th><th>Detalii</th><th>Data</th></tr>
          </thead>
          <tbody id="audit-log-body">
            <tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:20px">Se încarcă log-ul...</td></tr>
          </tbody>
        </table>
      </div>

      <!-- HARTA MISIUNI -->
      <div class="section" id="section-map">
        <div class="section-header-row">
          <div>
            <div class="section-title">Harta Misiuni</div>
            <div class="section-desc">Vizualizare geografică a activității din ecosistem.</div>
          </div>
        </div>
        <div id="ceo-map" style="width:100%;height:500px;border-radius:16px;border:1px solid var(--glass-border)"></div>
      </div>

      <!-- VVHI SHADOW MODE -->
      <div class="section" id="section-vvhi">
        <div class="section-header-row">
          <div>
            <div class="section-title">VVhi Shadow Mode</div>
            <div class="section-desc">Dataset-ul tău de decizii CEO — antrenează AI-ul viitor.</div>
          </div>
        </div>
        <div id="vvhi-stats" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;margin-bottom:25px"></div>
        <table class="vv-table">
          <thead>
            <tr><th>Acțiune</th><th>Context</th><th>Decizie</th><th>Data</th></tr>
          </thead>
          <tbody id="vvhi-body">
            <tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:20px">Se încarcă dataset-ul VVhi...</td></tr>
          </tbody>
        </table>
      </div>

    </div><!-- end main-content -->

    <!-- LIGHTBOX -->
    <div id="lightbox" onclick="closeLightbox()">
      <span class="lb-close">✕</span>
      <span class="lb-nav lb-prev" onclick="event.stopPropagation();lightboxNav(-1)">‹</span>
      <img id="lb-img" src="" alt="">
      <span class="lb-nav lb-next" onclick="event.stopPropagation();lightboxNav(1)">›</span>
    </div>
  `;

  // Inject tab styles
  const style = document.createElement('style');
  style.textContent = `
    .btn-tab{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:0.2s}
    .btn-tab.active{background:rgba(10,132,255,0.15);border-color:rgba(10,132,255,0.4);color:var(--vv-blue)}
    .btn-tab:hover{color:#fff}
    .contract-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:18px;margin-bottom:12px}
    .feedback-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:18px;margin-bottom:12px}
    .feedback-card.bug{border-color:rgba(255,59,48,0.2)}
    .talent-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:15px;flex-wrap:wrap}
    .rank-select{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;outline:none;cursor:pointer}
    .vvhi-stat-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:18px;text-align:center}
    .vvhi-stat-val{font-size:28px;font-weight:800;color:var(--gold)}
    .vvhi-stat-lbl{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:5px}
  `;
  document.head.appendChild(style);
}

// ============================================================
// 3. NAVIGARE SECȚIUNI
// ============================================================

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  const nav = document.getElementById('nav-' + name);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');
  currentSection = name;

  // Lazy load per sezione
  if (name === 'missions') loadMissions('pending');
  if (name === 'contracts') loadContracts();
  if (name === 'feedback') loadFeedback();
  if (name === 'talent') loadTalentPool();
  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'keys') loadKeys();
  if (name === 'audit') loadAuditLog();
  if (name === 'map') initCEOMap();
  if (name === 'vvhi') loadVVhi();
  if (name === 'config') loadConfig();

  logCEOAction('NAV', 'Navigat la secțiunea: ' + name);
}

// ============================================================
// 4. INIT DASHBOARD
// ============================================================

async function initDashboard() {
  loadMissions('pending');
  loadBadgeCounts();
  loadTotalCoins();
}

async function loadBadgeCounts() {
  try {
    const pending = await db.collection('missions').where('status', '==', 'pending').get();
    const contracts = await db.collection('contracts').where('status', '==', 'pending').get();
    const feedback = await db.collection('feedback').where('status', '==', 'nou').get();
    setBadge('missions', pending.size);
    setBadge('contracts', contracts.size);
    setBadge('feedback', feedback.size);
  } catch (e) { console.error(e); }
}

function setBadge(name, count) {
  const el = document.getElementById('badge-' + name);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'inline-block' : 'none';
}

async function loadTotalCoins() {
  try {
    const snap = await db.collection('users').get();
    let total = 0;
    snap.forEach(d => { total += (d.data().vvCoins || 0); });
    const el = document.getElementById('total-coins');
    if (el) el.textContent = total + ' VVC';
  } catch (e) {}
}

// ============================================================
// 5. MISIUNI
// ============================================================

async function loadMissions(status) {
  // Update tab activ
  ['pending','approved','rejected'].forEach(s => {
    const t = document.getElementById('tab-' + s);
    if (t) t.classList.toggle('active', s === status);
  });

  const grid = document.getElementById('missions-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';

  try {
    const snap = await db.collection('missions').where('status', '==', status).orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      grid.innerHTML = '<div style="color:var(--text-muted);padding:20px">Nicio misiune cu statusul: ' + status + '</div>';
      return;
    }
    grid.innerHTML = '';
    snap.forEach(doc => {
      const m = { id: doc.id, ...doc.data() };
      grid.appendChild(buildMissionCard(m));
    });
  } catch (e) {
    grid.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>';
  }
}

function buildMissionCard(m) {
  const div = document.createElement('div');
  div.className = 'photo-card';
  div.id = 'mission-' + m.id;

  const imgSrc = m.photoURL || m.imageUrl || '';
  const userName = m.userName || m.userId || 'Anonim';
  const reward = m.reward || COIN_REWARD_DEFAULT;
  const date = m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleDateString('ro') : '—';

  div.innerHTML = `
    ${imgSrc ? `<img class="photo-img" src="${imgSrc}" alt="Misiune" onclick="openLightbox('${imgSrc}')">` : '<div style="height:120px;background:#111;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px">Fără imagine</div>'}
    <div class="photo-info">
      ${m.status === 'rejected' ? '<span class="flag-badge">RESPINSĂ</span>' : ''}
      <div class="photo-msg">${m.description || m.message || 'Fără descriere'}</div>
      <div class="photo-meta">
        <span>👤 ${userName}</span>
        <span>📅 ${date}</span>
      </div>
      <div class="photo-meta" style="margin-top:6px">
        <span>🪙 Reward: <b style="color:var(--gold)">${reward} VVC</b></span>
        <span>📍 ${m.location || '—'}</span>
      </div>
      ${m.status === 'pending' ? `
      <div class="action-row">
        <button class="btn-approve" onclick="approveMission('${m.id}', '${m.userId}', ${reward})">✅ Aprobă</button>
        <button class="btn-reject" onclick="rejectMission('${m.id}')">❌ Respinge</button>
      </div>` : ''}
      ${m.status === 'approved' ? '<div style="color:var(--safe-green);font-size:12px;margin-top:10px;font-weight:700">✅ Aprobată · +' + reward + ' VVC distribuit</div>' : ''}
    </div>
  `;
  return div;
}

async function approveMission(missionId, userId, rewardAmount) {
  if (!confirm('Aprobi misiunea și distribui ' + rewardAmount + ' VV Coins?')) return;
  const batch = db.batch();
  try {
    batch.update(db.collection('missions').doc(missionId), {
      status: 'approved',
      validatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      validatedBy: currentCEO?.uid || 'ceo'
    });
    if (userId && userId !== 'undefined') {
      batch.update(db.collection('users').doc(userId), {
        vvCoins: firebase.firestore.FieldValue.increment(rewardAmount),
        missionsApproved: firebase.firestore.FieldValue.increment(1)
      });
      batch.set(db.collection('transactions').doc(), {
        userId, amount: rewardAmount, type: 'mission_reward',
        missionId, timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();

    // VVhi Shadow Mode log
    logVVhi('APPROVE_MISSION', { missionId, userId, reward: rewardAmount });
    logCEOAction('APPROVE_MISSION', 'Misiune aprobată: ' + missionId + ' | +' + rewardAmount + ' VVC → ' + userId);

    // Pulse event
    db.collection('pulse_events').add({
      type: 'mission', action: 'approba', icon: '🎯',
      message: 'O misiune a fost <b>validată</b> de CEO · +' + rewardAmount + ' VVC',
      tagClass: 'tag-beta', tagText: 'BETA',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Rimuovi card
    const card = document.getElementById('mission-' + missionId);
    if (card) card.remove();
    showNotif('✅ Misiune aprobată! +' + rewardAmount + ' VVC distribuit.');
    loadBadgeCounts();
  } catch (e) {
    showNotif('Eroare: ' + e.message, true);
  }
}

async function rejectMission(missionId) {
  if (!confirm('Respingi această misiune?')) return;
  try {
    await db.collection('missions').doc(missionId).update({
      status: 'rejected',
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectedBy: currentCEO?.uid || 'ceo'
    });
    logVVhi('REJECT_MISSION', { missionId });
    logCEOAction('REJECT_MISSION', 'Misiune respinsă: ' + missionId);
    const card = document.getElementById('mission-' + missionId);
    if (card) card.remove();
    showNotif('Misiune respinsă.');
    loadBadgeCounts();
  } catch (e) {
    showNotif('Eroare la anulare: ' + e.message, true);
  }
}

async function deleteAllRejected() {
  if (!confirm('Ștergi toate misiunile respinse?')) return;
  try {
    const snap = await db.collection('missions').where('status', '==', 'rejected').get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    logCEOAction('DELETE_REJECTED', 'Șterse ' + snap.size + ' misiuni respinse');
    showNotif('🗑 ' + snap.size + ' misiuni șterse.');
    loadMissions('rejected');
  } catch (e) { showNotif('Eroare: ' + e.message, true); }
}

// ============================================================
// 6. CONTRACTE
// ============================================================

async function loadContracts() {
  const list = document.getElementById('contracts-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';
  try {
    const snap = await db.collection('contracts').orderBy('createdAt', 'desc').limit(50).get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Niciun contract.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => {
      const c = { id: doc.id, ...doc.data() };
      const date = c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('ro') : '—';
      const div = document.createElement('div');
      div.className = 'contract-card';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:15px;font-weight:700;margin-bottom:5px">${c.title || 'Contract fără titlu'}</div>
            <div style="font-size:13px;color:var(--text-muted)">${c.description || '—'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px">👤 ${c.userId || 'Anonim'} · 📅 ${date} · 🪙 ${c.reward || 0} VVC</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <span style="background:${c.status === 'pending' ? 'rgba(255,149,0,0.1)' : c.status === 'active' ? 'rgba(52,199,89,0.1)' : 'rgba(255,255,255,0.05)'};color:${c.status === 'pending' ? '#ff9500' : c.status === 'active' ? 'var(--safe-green)' : 'var(--text-muted)'};border:1px solid currentColor;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700">${(c.status || 'unknown').toUpperCase()}</span>
            ${c.status === 'pending' ? `<button class="btn-approve" style="padding:6px 12px;font-size:11px" onclick="activateContract('${c.id}')">Activează</button>` : ''}
            <button class="btn-reject" style="padding:6px 12px;font-size:11px" onclick="deleteContract('${c.id}')">Șterge</button>
          </div>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (e) { list.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>'; }
}

async function activateContract(contractId) {
  try {
    await db.collection('contracts').doc(contractId).update({ status: 'active' });
    logCEOAction('ACTIVATE_CONTRACT', contractId);
    showNotif('Contract activat!');
    loadContracts();
  } catch (e) { showNotif('Eroare: ' + e.message, true); }
}

async function deleteContract(contractId) {
  if (!confirm('Ștergi contractul?')) return;
  try {
    await db.collection('contracts').doc(contractId).delete();
    logCEOAction('DELETE_CONTRACT', contractId);
    showNotif('Contract șters.');
    loadContracts();
  } catch (e) { showNotif('Eroare: ' + e.message, true); }
}

// ============================================================
// 7. FEEDBACK & BUG REPORTS
// ============================================================

async function loadFeedback() {
  const list = document.getElementById('feedback-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';
  try {
    const snap = await db.collection('feedback').orderBy('timestamp', 'desc').limit(50).get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Niciun feedback.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => {
      const f = { id: doc.id, ...doc.data() };
      const date = f.timestamp ? new Date(f.timestamp.seconds * 1000).toLocaleString('ro') : '—';
      const isBug = f.type === 'bug_report';
      const div = document.createElement('div');
      div.className = 'feedback-card' + (isBug ? ' bug' : '');
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px">
          <div>
            ${isBug ? '<span class="flag-badge">BUG REPORT</span>' : ''}
            <div style="font-size:13px;color:#fff;margin-top:5px">${f.message || '—'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px">👤 ${f.alias || f.uid || 'Anonim'} · 📅 ${date} · Sursă: ${f.source || '—'}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-reply" onclick="replyFeedback('${f.id}', '${(f.alias||'utilizator').replace(/'/g,"\\'")}')">💬 Răspunde</button>
            <button class="btn-reject" style="padding:6px 12px;font-size:11px" onclick="resolveFeedback('${f.id}')">✓ Rezolvat</button>
          </div>
        </div>
        ${f.reply ? `<div style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.2);border-radius:8px;padding:10px;font-size:12px;color:rgba(255,255,255,0.6)">💬 Răspuns tău: ${f.reply}</div>` : ''}
      `;
      list.appendChild(div);
    });
  } catch (e) { list.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>'; }
}

function replyFeedback(feedbackId, alias) {
  const reply = prompt('Răspuns pentru ' + alias + ':');
  if (!reply) return;
  db.collection('feedback').doc(feedbackId).update({ reply, repliedAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'rezolvat' })
    .then(() => { showNotif('Răspuns salvat!'); logCEOAction('REPLY_FEEDBACK', feedbackId); loadFeedback(); })
    .catch(e => showNotif('Eroare: ' + e.message, true));
}

async function resolveFeedback(feedbackId) {
  try {
    await db.collection('feedback').doc(feedbackId).update({ status: 'rezolvat' });
    logCEOAction('RESOLVE_FEEDBACK', feedbackId);
    showNotif('Marcat ca rezolvat.');
    loadFeedback();
  } catch (e) { showNotif('Eroare: ' + e.message, true); }
}

async function deleteAllFeedback() {
  if (!confirm('Ștergi tot feedback-ul rezolvat?')) return;
  try {
    const snap = await db.collection('feedback').where('status', '==', 'rezolvat').get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    showNotif('🗑 ' + snap.size + ' feedback-uri șterse.');
    loadFeedback();
  } catch (e) { showNotif('Eroare: ' + e.message, true); }
}

// ============================================================
// 8. TALENT POOL
// ============================================================

async function loadTalentPool() {
  const list = document.getElementById('talent-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';
  try {
    const snap = await db.collection('talent_pool').orderBy('appliedAt', 'desc').get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Niciun aplicant.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => {
      const u = { id: doc.id, ...doc.data() };
      const div = document.createElement('div');
      div.className = 'talent-card';
      div.innerHTML = `
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700">${u.name || u.userId || 'Anonim'}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${u.skills || '—'} · 🪙 ${u.vvCoins || 0} VVC</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${u.bio || ''}</div>
        </div>
        <select class="rank-select" onchange="updateUserRank('${u.userId || u.id}', this.value)">
          ${RANKS.map(r => `<option value="${r}" ${u.rank === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <button class="btn-reject" style="padding:8px 12px;font-size:11px;min-height:36px" onclick="removeTalent('${u.id}')">✕</button>
      `;
      list.appendChild(div);
    });
  } catch (e) { list.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>'; }
}

async function updateUserRank(userId, newRank) {
  try {
    await db.collection('users').doc(userId).update({ rank: newRank });
    await db.collection('talent_pool').where('userId', '==', userId).get()
      .then(snap => snap.forEach(d => d.ref.update({ rank: newRank })));
    logCEOAction('UPDATE_RANK', userId + ' → ' + newRank);
    showNotif('Rang actualizat: ' + newRank);
  } catch (e) { showNotif('Eroare: ' + e.message, true); }
}

async function removeTalent(talentId) {
  if (!confirm('Elimini din Talent Pool?')) return;
  try {
    await db.collection('talent_pool').doc(talentId).delete();
    logCEOAction('REMOVE_TALENT', talentId);
    showNotif('Eliminat din Talent Pool.');
    loadTalentPool();
  } catch (e) { showNotif('Eroare: ' + e.message, true); }
}

// ============================================================
// 9. LEADERBOARD
// ============================================================

async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  try {
    const snap = await db.collection('users').orderBy('vvCoins', 'desc').limit(20).get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Niciun utilizator.</td></tr>'; return; }
    let html = '';
    let i = 1;
    snap.forEach(doc => {
      const u = doc.data();
      html += `<tr>
        <td class="${i <= 3 ? 'rank-gold' : ''}">${i === 1 ? '🥇' : i === 2 ? '🥈' : i === 3 ? '🥉' : '#' + i}</td>
        <td>${u.name || u.email || doc.id.slice(0,8)}</td>
        <td><span class="badge-onyx">${u.rank || 'Neofit'}</span></td>
        <td style="color:var(--gold);font-weight:700">${u.vvCoins || 0} VVC</td>
        <td>${u.missionsApproved || 0}</td>
      </tr>`;
      i++;
    });
    tbody.innerHTML = html;
  } catch (e) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</td></tr>'; }
}

// ============================================================
// 10. CHEI BETA
// ============================================================

async function loadKeys() {
  const list = document.getElementById('keys-list');
  if (!list) return;
  try {
    const snap = await db.collection('keys').orderBy('createdAt', 'desc').limit(20).get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);margin-top:15px">Nicio cheie generată.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => {
      const k = doc.data();
      const div = document.createElement('div');
      div.className = 'key-item';
      div.innerHTML = `
        <span>${k.key || doc.id}</span>
        <span class="key-status">${k.status === 'used' ? '🔴 FOLOSITĂ' : '🟢 LIBERĂ'}</span>
      `;
      list.appendChild(div);
    });
  } catch (e) {}
}

function generateKey() {
  const key = 'VV-BETA-' + Math.random().toString(36).substr(2, 4).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  db.collection('keys').add({ key, status: 'free', createdAt: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => { showNotif('🔑 Cheie generată: ' + key); logCEOAction('GEN_KEY', key); loadKeys(); })
    .catch(e => showNotif('Eroare: ' + e.message, true));
}

// ============================================================
// 11. REMOTE CONFIG
// ============================================================

async function loadConfig() {
  try {
    const snap = await db.collection('config').doc('global').get();
    if (snap.exists) {
      const d = snap.data();
      const coinInput = document.getElementById('coin-value-input');
      const msgInput = document.getElementById('daily-message-input');
      if (coinInput && d.coinValue) coinInput.value = d.coinValue;
      if (msgInput && d.dailyMessage) msgInput.value = d.dailyMessage;
    }
  } catch (e) {}
}

function setKillSwitch(isLive) {
  db.collection('config').doc('maintenance').set({ isLive }, { merge: true })
    .then(() => { showNotif(isLive ? '🟢 Site activ!' : '🔴 Site în mentenanță!'); logCEOAction('KILLSWITCH', isLive ? 'ON' : 'OFF'); })
    .catch(e => showNotif('Eroare: ' + e.message, true));
}

function updateCoinValue() {
  const val = parseInt(document.getElementById('coin-value-input')?.value) || 10;
  db.collection('config').doc('global').set({ coinValue: val }, { merge: true })
    .then(() => { showNotif('🪙 Valoare VV Coin: ' + val); logCEOAction('CONFIG_COIN', val); })
    .catch(e => showNotif('Eroare: ' + e.message, true));
}

function updateDailyMessage() {
  const msg = document.getElementById('daily-message-input')?.value || '';
  if (!msg) return;
  db.collection('config').doc('global').set({ dailyMessage: msg }, { merge: true })
    .then(() => { showNotif('📢 Mesaj publicat!'); logCEOAction('CONFIG_MSG', msg.slice(0, 50)); })
    .catch(e => showNotif('Eroare: ' + e.message, true));
}

// ============================================================
// 12. AUDIT LOG
// ============================================================

function logCEOAction(action, details = '') {
  if (!currentCEO) return;
  db.collection('audit_log').add({
    action, details,
    ceoUid: currentCEO.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

async function loadAuditLog() {
  const tbody = document.getElementById('audit-log-body');
  if (!tbody) return;
  try {
    const snap = await db.collection('audit_log').orderBy('timestamp', 'desc').limit(50).get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">Nicio acțiune înregistrată.</td></tr>'; return; }
    let html = '';
    snap.forEach(doc => {
      const l = doc.data();
      const date = l.timestamp ? new Date(l.timestamp.seconds * 1000).toLocaleString('ro') : '—';
      html += `<tr><td style="font-weight:700;color:var(--gold)">${l.action}</td><td>${l.details || '—'}</td><td style="white-space:nowrap">${date}</td></tr>`;
    });
    tbody.innerHTML = html;
  } catch (e) { tbody.innerHTML = '<tr><td colspan="3" style="color:var(--danger)">Eroare: ' + e.message + '</td></tr>'; }
}

// ============================================================
// 13. HARTA CEO (LEAFLET)
// ============================================================

let ceoMapInstance = null;

function initCEOMap() {
  if (ceoMapInstance) return;
  if (typeof L === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => { buildCEOMap(); };
    document.head.appendChild(s);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
  } else {
    buildCEOMap();
  }
}

function buildCEOMap() {
  const el = document.getElementById('ceo-map');
  if (!el || ceoMapInstance) return;
  ceoMapInstance = L.map('ceo-map', { center: [44.4268, 26.1025], zoom: 12, zoomControl: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(ceoMapInstance);

  db.collection('missions').where('status', '==', 'pending').get().then(snap => {
    snap.forEach(doc => {
      const m = doc.data();
      if (m.lat && m.lng) {
        L.circleMarker([m.lat, m.lng], { radius: 8, color: '#D4AF37', fillColor: '#D4AF37', fillOpacity: 0.8 })
          .addTo(ceoMapInstance)
          .bindPopup(`<div class="ceo-popup" style="padding:12px;min-width:180px"><b style="color:#D4AF37">${m.userName || 'Anonim'}</b><br><span style="font-size:12px;color:rgba(255,255,255,0.6)">${m.description || '—'}</span></div>`, { className: 'ceo-popup' });
      }
    });
  }).catch(() => {});
}

// ============================================================
// 14. VVHI SHADOW MODE
// ============================================================

function logVVhi(action, context) {
  db.collection('vvhi_dataset').add({
    action, context,
    ceoUid: currentCEO?.uid || 'ceo',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

async function loadVVhi() {
  const tbody = document.getElementById('vvhi-body');
  const statsEl = document.getElementById('vvhi-stats');
  if (!tbody) return;
  try {
    const snap = await db.collection('vvhi_dataset').orderBy('timestamp', 'desc').limit(100).get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Nicio decizie înregistrată încă.</td></tr>'; return; }

    // Stats
    let approvals = 0, rejections = 0;
    snap.forEach(d => {
      if (d.data().action === 'APPROVE_MISSION') approvals++;
      if (d.data().action === 'REJECT_MISSION') rejections++;
    });
    if (statsEl) statsEl.innerHTML = `
      <div class="vvhi-stat-card"><div class="vvhi-stat-val" style="color:var(--safe-green)">${approvals}</div><div class="vvhi-stat-lbl">Aprobări</div></div>
      <div class="vvhi-stat-card"><div class="vvhi-stat-val" style="color:var(--danger)">${rejections}</div><div class="vvhi-stat-lbl">Respingeri</div></div>
      <div class="vvhi-stat-card"><div class="vvhi-stat-val">${snap.size}</div><div class="vvhi-stat-lbl">Total decizii</div></div>
      <div class="vvhi-stat-card"><div class="vvhi-stat-val" style="color:var(--gold)">${approvals > 0 ? Math.round((approvals/(approvals+rejections))*100) : 0}%</div><div class="vvhi-stat-lbl">Rata aprobare</div></div>
    `;

    let html = '';
    snap.forEach(doc => {
      const v = doc.data();
      const date = v.timestamp ? new Date(v.timestamp.seconds * 1000).toLocaleString('ro') : '—';
      const ctx = typeof v.context === 'object' ? JSON.stringify(v.context) : (v.context || '—');
      html += `<tr>
        <td style="font-weight:700;color:${v.action.includes('APPROVE') ? 'var(--safe-green)' : v.action.includes('REJECT') ? 'var(--danger)' : 'var(--gold)'}">${v.action}</td>
        <td style="font-size:11px;color:var(--text-muted)">${ctx.slice(0, 80)}</td>
        <td style="color:#fff;font-weight:600">${v.action.includes('APPROVE') ? '✅ Aprobat' : v.action.includes('REJECT') ? '❌ Respins' : '📝 Acțiune'}</td>
        <td style="white-space:nowrap;font-size:11px">${date}</td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (e) { tbody.innerHTML = '<tr><td colspan="4" style="color:var(--danger)">Eroare: ' + e.message + '</td></tr>'; }
}

// ============================================================
// 15. LIGHTBOX
// ============================================================

function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lb-img');
  if (!lb || !img) return;
  img.src = src;
  lb.style.display = 'flex';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.style.display = 'none';
}

function lightboxNav(dir) {
  // Extinde cu array de imagini dacă ai nevoie
}

// ============================================================
// 16. NOTIFICĂRI
// ============================================================

function showNotif(msg, isError = false) {
  let notif = document.getElementById('vv-notif');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'vv-notif';
    notif.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(20,20,22,0.96);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:12px 20px;font-size:14px;color:#fff;z-index:99999;transition:opacity 0.3s;white-space:nowrap;font-family:inherit';
    document.body.appendChild(notif);
  }
  notif.textContent = msg;
  notif.style.borderColor = isError ? 'rgba(255,59,48,0.4)' : 'rgba(52,199,89,0.3)';
  notif.style.opacity = '1';
  clearTimeout(notif._timer);
  notif._timer = setTimeout(() => { notif.style.opacity = '0'; }, 3000);
}
