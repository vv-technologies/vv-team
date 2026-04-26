// VV TEAM CEO Panel — Logic complet
// Firebase e initializat in index.html

const db  = firebase.firestore();
const auth = firebase.auth();
const COIN_DEFAULT = 10;
const RANKS = ['Neofit','Explorer','Trainer','Master','Fondator'];

let currentCEO = null;
let currentSection = 'missions';
let _pendingUnsub = null;
let _activeUnsub  = null;
let ceoMapInstance = null;

// ── SIDEBAR TOGGLE ──
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mc = document.getElementById('main-content');
  sb.classList.toggle('open');
  mc.classList.toggle('shifted');
}

// ── AUTH ──
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

auth.onAuthStateChanged(async (user) => {
  if (!user) { showLogin(); return; }
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().role === 'ceo') {
      currentCEO = { uid: user.uid, ...doc.data() };
      hideLogin();
      initDashboard();
    } else { showLogin(); }
  } catch(e) { console.error(e); showLogin(); }
});

function showLogin() { document.getElementById('login-screen').classList.remove('hidden'); }
function hideLogin() { document.getElementById('login-screen').classList.add('hidden'); }

async function handleLogin(email, password) {
  const btn = document.querySelector('.login-btn');
  if (btn) { btn.textContent = 'SE VERIFICĂ...'; btn.disabled = true; }
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch(e) {
    if (btn) { btn.textContent = 'ACCES REFUZAT'; btn.disabled = false; setTimeout(() => btn.textContent = 'INTRĂ', 2000); }
  }
}

function handleLogout() {
  if (_pendingUnsub) { _pendingUnsub(); _pendingUnsub = null; }
  if (_activeUnsub)  { _activeUnsub();  _activeUnsub  = null; }
  auth.signOut().then(() => location.reload());
}

// ── DASHBOARD ──
async function initDashboard() {
  showSection('missions');
  loadBadges();
  loadCoins();
}

async function loadBadges() {
  try {
    const [m, c, f] = await Promise.all([
      db.collection('missions').where('status','==','pending').get(),
      db.collection('contracts').where('status','==','pending').get(),
      db.collection('feedback').where('status','==','nou').get()
    ]);
    setBadge('missions', m.size);
    setBadge('contracts', c.size);
    setBadge('feedback', f.size);
  } catch(e) {}
}

function setBadge(name, count) {
  const el = document.getElementById('badge-' + name);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'inline-block' : 'none';
}

async function loadCoins() {
  try {
    const snap = await db.collection('users').get();
    let total = 0;
    snap.forEach(d => { total += (d.data().vvCoins || 0); });
    const el = document.getElementById('total-coins');
    if (el) el.textContent = total + ' VVC';
  } catch(e) {}
}

// ── NAVIGARE ──
function showSection(name) {
  if (currentSection === 'circle' && name !== 'circle') {
    if (_pendingUnsub) { _pendingUnsub(); _pendingUnsub = null; }
    if (_activeUnsub)  { _activeUnsub();  _activeUnsub  = null; }
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  const nav = document.getElementById('nav-' + name);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');

  // update titlu
  const titles = {
    missions:'Galerie Misiuni', contracts:'Contracte', feedback:'Feedback & Suport',
    talent:'Talent Pool', leaderboard:'Leaderboard', keys:'Chei Beta',
    config:'Config Live', audit:'Audit Log', map:'Harta Misiuni',
    vvhi:'VVhi Shadow Mode', circle:'⬡ Inner Circle'
  };
  const titleEl = document.getElementById('section-heading');
  if (titleEl) titleEl.textContent = titles[name] || name;

  currentSection = name;

  if (name === 'missions')    loadMissions('pending');
  if (name === 'contracts')   loadContracts();
  if (name === 'feedback')    loadFeedback();
  if (name === 'talent')      loadTalentPool();
  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'keys')        loadKeys();
  if (name === 'audit')       loadAuditLog();
  if (name === 'map')         initCEOMap();
  if (name === 'vvhi')        loadVVhi();
  if (name === 'config')      loadConfig();
  if (name === 'circle')      switchCircleTab('pending');

  logCEOAction('NAV', name);

  // inchide sidebar pe mobile dupa selectie
  const sb = document.getElementById('sidebar');
  if (sb && sb.classList.contains('open') && window.innerWidth < 768) {
    sb.classList.remove('open');
    document.getElementById('main-content').classList.remove('shifted');
  }
}

// ── MISIUNI ──
async function loadMissions(status) {
  ['pending','approved','rejected'].forEach(s => {
    const t = document.getElementById('tab-' + s);
    if (t) t.classList.toggle('active', s === status);
  });
  const grid = document.getElementById('missions-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';
  try {
    const snap = await db.collection('missions').where('status','==',status).orderBy('createdAt','desc').get();
    if (snap.empty) { grid.innerHTML = '<div style="color:var(--text-muted);padding:20px">Nicio misiune.</div>'; return; }
    grid.innerHTML = '';
    snap.forEach(doc => grid.appendChild(buildMissionCard({ id: doc.id, ...doc.data() })));
  } catch(e) { grid.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>'; }
}

function buildMissionCard(m) {
  const div = document.createElement('div');
  div.className = 'photo-card'; div.id = 'mission-' + m.id;
  const img = m.photoURL || m.imageUrl || '';
  const user = m.userName || m.userId || 'Anonim';
  const reward = m.reward || COIN_DEFAULT;
  const date = m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleDateString('ro') : '—';
  div.innerHTML = `
    ${img ? `<img class="photo-img" src="${img}" onclick="openLightbox('${img}')">` : '<div style="height:120px;background:#111;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px">Fără imagine</div>'}
    <div class="photo-info">
      ${m.status==='rejected'?'<span class="flag-badge">RESPINSĂ</span>':''}
      <div class="photo-msg">${m.description||m.message||'Fără descriere'}</div>
      <div class="photo-meta"><span>👤 ${user}</span><span>📅 ${date}</span></div>
      <div class="photo-meta" style="margin-top:6px"><span>🪙 <b style="color:var(--gold)">${reward} VVC</b></span><span>📍 ${m.location||'—'}</span></div>
      ${m.status==='pending'?`<div class="action-row"><button class="btn-approve" onclick="approveMission('${m.id}','${m.userId}',${reward})">✅ Aprobă</button><button class="btn-reject" onclick="rejectMission('${m.id}')">❌ Respinge</button></div>`:''}
      ${m.status==='approved'?`<div style="color:var(--safe-green);font-size:12px;margin-top:8px;font-weight:700">✅ Aprobată · +${reward} VVC</div>`:''}
    </div>`;
  return div;
}

async function approveMission(missionId, userId, reward) {
  if (!confirm('Aprobi misiunea și distribui ' + reward + ' VV Coins?')) return;
  try {
    const batch = db.batch();
    batch.update(db.collection('missions').doc(missionId), { status:'approved', validatedAt: firebase.firestore.FieldValue.serverTimestamp(), validatedBy: currentCEO.uid });
    if (userId && userId !== 'undefined') {
      batch.update(db.collection('users').doc(userId), { vvCoins: firebase.firestore.FieldValue.increment(reward), missionsApproved: firebase.firestore.FieldValue.increment(1) });
    }
    await batch.commit();
    logVVhi('APPROVE_MISSION', { missionId, userId, reward });
    logCEOAction('APPROVE_MISSION', missionId);
    document.getElementById('mission-' + missionId)?.remove();
    showNotif('✅ +' + reward + ' VVC distribuit!');
    loadBadges();
  } catch(e) { showNotif('Eroare: ' + e.message, true); }
}

async function rejectMission(missionId) {
  if (!confirm('Respingi această misiune?')) return;
  try {
    await db.collection('missions').doc(missionId).update({ status:'rejected', rejectedAt: firebase.firestore.FieldValue.serverTimestamp() });
    logVVhi('REJECT_MISSION', { missionId });
    logCEOAction('REJECT_MISSION', missionId);
    document.getElementById('mission-' + missionId)?.remove();
    showNotif('Misiune respinsă.');
    loadBadges();
  } catch(e) { showNotif('Eroare: ' + e.message, true); }
}

async function deleteAllRejected() {
  if (!confirm('Ștergi toate misiunile respinse?')) return;
  try {
    const snap = await db.collection('missions').where('status','==','rejected').get();
    const batch = db.batch(); snap.forEach(d => batch.delete(d.ref)); await batch.commit();
    showNotif('🗑 ' + snap.size + ' misiuni șterse.'); loadMissions('rejected');
  } catch(e) { showNotif('Eroare: ' + e.message, true); }
}

// ── CONTRACTE ──
async function loadContracts() {
  const list = document.getElementById('contracts-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';
  try {
    const snap = await db.collection('contracts').orderBy('createdAt','desc').limit(50).get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Niciun contract.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => {
      const c = { id: doc.id, ...doc.data() };
      const date = c.createdAt ? new Date(c.createdAt.seconds*1000).toLocaleDateString('ro') : '—';
      const div = document.createElement('div'); div.className = 'card';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><div style="font-size:14px;font-weight:700;margin-bottom:4px">${c.title||'Contract'}</div><div style="font-size:12px;color:var(--text-muted)">${c.description||'—'}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">👤 ${c.userId||'Anonim'} · 📅 ${date} · 🪙 ${c.reward||0} VVC</div></div><div style="display:flex;gap:8px;flex-shrink:0">${c.status==='pending'?`<button class="btn-approve" onclick="activateContract('${c.id}')">Activează</button>`:''}<button class="btn-reject" onclick="deleteContract('${c.id}')">Șterge</button></div></div>`;
      list.appendChild(div);
    });
  } catch(e) { list.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>'; }
}

async function activateContract(id) { try { await db.collection('contracts').doc(id).update({ status:'active' }); showNotif('Contract activat!'); loadContracts(); } catch(e) { showNotif('Eroare: ' + e.message, true); } }
async function deleteContract(id) { if (!confirm('Ștergi contractul?')) return; try { await db.collection('contracts').doc(id).delete(); showNotif('Contract șters.'); loadContracts(); } catch(e) { showNotif('Eroare: ' + e.message, true); } }

// ── FEEDBACK ──
async function loadFeedback() {
  const list = document.getElementById('feedback-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';
  try {
    const snap = await db.collection('feedback').orderBy('timestamp','desc').limit(50).get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Niciun feedback.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => {
      const f = { id: doc.id, ...doc.data() };
      const date = f.timestamp ? new Date(f.timestamp.seconds*1000).toLocaleString('ro') : '—';
      const div = document.createElement('div'); div.className = 'card';
      div.innerHTML = `${f.type==='bug_report'?'<span class="flag-badge">BUG REPORT</span>':''}<div style="font-size:13px;color:#fff;margin:8px 0">${f.message||'—'}</div><div style="font-size:11px;color:var(--text-muted)">👤 ${f.alias||f.uid||'Anonim'} · 📅 ${date}</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn-reply" onclick="replyFeedback('${f.id}','${(f.alias||'user').replace(/'/g,"\\'")}')">💬 Răspunde</button><button class="btn-reject" style="padding:6px 12px" onclick="resolveFeedback('${f.id}')">✓ Rezolvat</button></div>${f.reply?`<div style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.2);border-radius:8px;padding:10px;font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px">💬 ${f.reply}</div>`:''}`;
      list.appendChild(div);
    });
  } catch(e) { list.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>'; }
}

function replyFeedback(id, alias) { const r = prompt('Răspuns pentru ' + alias + ':'); if (!r) return; db.collection('feedback').doc(id).update({ reply:r, status:'rezolvat', repliedAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => { showNotif('Răspuns salvat!'); loadFeedback(); }).catch(e => showNotif('Eroare: ' + e.message, true)); }
async function resolveFeedback(id) { try { await db.collection('feedback').doc(id).update({ status:'rezolvat' }); showNotif('Rezolvat!'); loadFeedback(); } catch(e) { showNotif('Eroare: ' + e.message, true); } }
async function deleteAllFeedback() { if (!confirm('Ștergi tot feedback-ul rezolvat?')) return; try { const snap = await db.collection('feedback').where('status','==','rezolvat').get(); const batch = db.batch(); snap.forEach(d => batch.delete(d.ref)); await batch.commit(); showNotif('🗑 Șters.'); loadFeedback(); } catch(e) { showNotif('Eroare: ' + e.message, true); } }

// ── TALENT POOL ──
async function loadTalentPool() {
  const list = document.getElementById('talent-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Se încarcă...</div>';
  try {
    const snap = await db.collection('talent_pool').orderBy('appliedAt','desc').get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);padding:20px">Niciun aplicant.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => {
      const u = { id: doc.id, ...doc.data() };
      const div = document.createElement('div'); div.className = 'talent-card';
      div.innerHTML = `<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">${u.name||u.userId||'Anonim'}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${u.skills||'—'} · 🪙 ${u.vvCoins||0} VVC</div></div><select class="rank-select" onchange="updateRank('${u.userId||u.id}',this.value)">${RANKS.map(r=>`<option value="${r}" ${u.rank===r?'selected':''}>${r}</option>`).join('')}</select><button class="btn-reject" style="padding:8px 12px;font-size:11px" onclick="removeTalent('${u.id}')">✕</button>`;
      list.appendChild(div);
    });
  } catch(e) { list.innerHTML = '<div style="color:var(--danger);padding:20px">Eroare: ' + e.message + '</div>'; }
}

async function updateRank(userId, rank) { try { await db.collection('users').doc(userId).update({ rank }); showNotif('Rang: ' + rank); } catch(e) { showNotif('Eroare: ' + e.message, true); } }
async function removeTalent(id) { if (!confirm('Elimini?')) return; try { await db.collection('talent_pool').doc(id).delete(); showNotif('Eliminat.'); loadTalentPool(); } catch(e) { showNotif('Eroare: ' + e.message, true); } }

// ── LEADERBOARD ──
async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  try {
    const snap = await db.collection('users').orderBy('vvCoins','desc').limit(20).get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Niciun utilizator.</td></tr>'; return; }
    let html = '', i = 1;
    snap.forEach(doc => { const u = doc.data(); html += `<tr><td class="${i<=3?'rank-gold':''}">${i===1?'🥇':i===2?'🥈':i===3?'🥉':'#'+i}</td><td>${u.name||u.email||doc.id.slice(0,8)}</td><td><span class="badge-onyx">${u.rank||'Neofit'}</span></td><td style="color:var(--gold);font-weight:700">${u.vvCoins||0} VVC</td><td>${u.missionsApproved||0}</td></tr>`; i++; });
    tbody.innerHTML = html;
  } catch(e) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--danger)">Eroare: ' + e.message + '</td></tr>'; }
}

// ── CHEI BETA ──
async function loadKeys() {
  const list = document.getElementById('keys-list');
  if (!list) return;
  try {
    const snap = await db.collection('keys').orderBy('createdAt','desc').limit(20).get();
    if (snap.empty) { list.innerHTML = '<div style="color:var(--text-muted);margin-top:12px">Nicio cheie generată.</div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => { const k = doc.data(); const div = document.createElement('div'); div.className = 'key-item'; div.innerHTML = `<span>${k.key||doc.id}</span><span class="key-status">${k.status==='used'?'🔴 FOLOSITĂ':'🟢 LIBERĂ'}</span>`; list.appendChild(div); });
  } catch(e) {}
}

function generateKey() {
  const key = 'VV-BETA-' + Math.random().toString(36).substr(2,4).toUpperCase() + '-' + Math.random().toString(36).substr(2,4).toUpperCase();
  db.collection('keys').add({ key, status:'free', createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => { showNotif('🔑 ' + key); logCEOAction('GEN_KEY', key); loadKeys(); }).catch(e => showNotif('Eroare: ' + e.message, true));
}

// ── CONFIG ──
async function loadConfig() {
  try {
    const snap = await db.collection('config').doc('global').get();
    if (snap.exists) {
      const d = snap.data();
      const ci = document.getElementById('coin-value-input');
      const mi = document.getElementById('daily-message-input');
      if (ci && d.coinValue) ci.value = d.coinValue;
      if (mi && d.dailyMessage) mi.value = d.dailyMessage;
    }
  } catch(e) {}
}

function setKillSwitch(isLive) { db.collection('config').doc('maintenance').set({ isLive }, { merge:true }).then(() => showNotif(isLive?'🟢 Site activ!':'🔴 Mentenanță!')).catch(e => showNotif('Eroare: ' + e.message, true)); }
function updateCoinValue() { const val = parseInt(document.getElementById('coin-value-input')?.value)||10; db.collection('config').doc('global').set({ coinValue:val }, { merge:true }).then(() => showNotif('🪙 ' + val + ' VVC/misiune')).catch(e => showNotif('Eroare: ' + e.message, true)); }
function updateDailyMessage() { const msg = document.getElementById('daily-message-input')?.value||''; if (!msg) return; db.collection('config').doc('global').set({ dailyMessage:msg }, { merge:true }).then(() => showNotif('📢 Mesaj publicat!')).catch(e => showNotif('Eroare: ' + e.message, true)); }

// ── AUDIT LOG ──
function logCEOAction(action, details='') { if (!currentCEO) return; db.collection('audit_log').add({ action, details, ceoUid: currentCEO.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{}); }

async function loadAuditLog() {
  const tbody = document.getElementById('audit-log-body');
  if (!tbody) return;
  try {
    const snap = await db.collection('audit_log').orderBy('timestamp','desc').limit(50).get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">Nicio acțiune.</td></tr>'; return; }
    let html = '';
    snap.forEach(doc => { const l = doc.data(); const date = l.timestamp ? new Date(l.timestamp.seconds*1000).toLocaleString('ro') : '—'; html += `<tr><td style="font-weight:700;color:var(--gold)">${l.action}</td><td style="font-size:11px">${l.details||'—'}</td><td style="white-space:nowrap;font-size:11px">${date}</td></tr>`; });
    tbody.innerHTML = html;
  } catch(e) { tbody.innerHTML = '<tr><td colspan="3" style="color:var(--danger)">Eroare: ' + e.message + '</td></tr>'; }
}

// ── HARTA ──
function initCEOMap() {
  if (ceoMapInstance) return;
  if (typeof L === 'undefined') {
    const css = document.createElement('link'); css.rel='stylesheet'; css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload=buildCEOMap; document.head.appendChild(s);
  } else { buildCEOMap(); }
}

function buildCEOMap() {
  const el = document.getElementById('ceo-map');
  if (!el || ceoMapInstance) return;
  ceoMapInstance = L.map('ceo-map', { center:[44.4268,26.1025], zoom:12 });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom:19, subdomains:'abcd' }).addTo(ceoMapInstance);
  db.collection('missions').where('status','==','pending').get().then(snap => { snap.forEach(doc => { const m = doc.data(); if (m.lat && m.lng) L.circleMarker([m.lat,m.lng], { radius:8, color:'#D4AF37', fillColor:'#D4AF37', fillOpacity:0.8 }).addTo(ceoMapInstance).bindPopup(`<b style="color:#D4AF37">${m.userName||'Anonim'}</b><br>${m.description||'—'}`); }); }).catch(()=>{});
}

// ── VVHI ──
function logVVhi(action, context) { db.collection('vvhi_dataset').add({ action, context, ceoUid: currentCEO?.uid||'ceo', timestamp: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{}); }

async function loadVVhi() {
  const tbody = document.getElementById('vvhi-body');
  const statsEl = document.getElementById('vvhi-stats');
  if (!tbody) return;
  try {
    const snap = await db.collection('vvhi_dataset').orderBy('timestamp','desc').limit(100).get();
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Nicio decizie înregistrată.</td></tr>'; return; }
    let approvals=0, rejections=0;
    snap.forEach(d => { if (d.data().action==='APPROVE_MISSION') approvals++; if (d.data().action==='REJECT_MISSION') rejections++; });
    if (statsEl) statsEl.innerHTML = `<div class="stat-card"><div class="stat-val" style="color:var(--safe-green)">${approvals}</div><div class="stat-lbl">Aprobări</div></div><div class="stat-card"><div class="stat-val" style="color:var(--danger)">${rejections}</div><div class="stat-lbl">Respingeri</div></div><div class="stat-card"><div class="stat-val">${snap.size}</div><div class="stat-lbl">Total</div></div><div class="stat-card"><div class="stat-val" style="color:var(--gold)">${approvals>0?Math.round(approvals/(approvals+rejections)*100):0}%</div><div class="stat-lbl">Rata aprobare</div></div>`;
    let html='';
    snap.forEach(doc => { const v=doc.data(); const date=v.timestamp?new Date(v.timestamp.seconds*1000).toLocaleString('ro'):'—'; const ctx=typeof v.context==='object'?JSON.stringify(v.context):(v.context||'—'); html+=`<tr><td style="font-weight:700;color:${v.action.includes('APPROVE')?'var(--safe-green)':v.action.includes('REJECT')?'var(--danger)':'var(--gold)'}">${v.action}</td><td style="font-size:11px;color:var(--text-muted)">${ctx.slice(0,60)}</td><td>${v.action.includes('APPROVE')?'✅':v.action.includes('REJECT')?'❌':'📝'}</td><td style="white-space:nowrap;font-size:11px">${date}</td></tr>`; });
    tbody.innerHTML = html;
  } catch(e) { tbody.innerHTML = '<tr><td colspan="4" style="color:var(--danger)">Eroare: ' + e.message + '</td></tr>'; }
}

// ── LIGHTBOX ──
function openLightbox(src) { const lb=document.getElementById('lightbox'); const img=document.getElementById('lb-img'); if (!lb||!img) return; img.src=src; lb.style.display='flex'; }
function closeLightbox() { const lb=document.getElementById('lightbox'); if (lb) lb.style.display='none'; }

// ── NOTIF ──
function showNotif(msg, isError=false) {
  let n = document.getElementById('vv-notif');
  if (!n) { n=document.createElement('div'); n.id='vv-notif'; document.body.appendChild(n); }
  n.textContent = msg;
  n.style.borderColor = isError ? 'rgba(255,59,48,0.4)' : 'rgba(52,199,89,0.3)';
  n.classList.add('show');
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.remove('show'), 3000);
}

// ── INNER CIRCLE ──
var circleTab = 'pending';

function switchCircleTab(tab) {
  circleTab = tab;
  const btnP = document.getElementById('circle-tab-pending');
  const btnA = document.getElementById('circle-tab-active');
  const listP = document.getElementById('circle-pending-list');
  const listA = document.getElementById('circle-active-list');
  if (tab === 'pending') {
    if (btnP) { btnP.style.background='#fff'; btnP.style.color='#000'; }
    if (btnA) { btnA.style.background='transparent'; btnA.style.color='rgba(255,255,255,0.4)'; }
    if (listP) listP.style.display='block';
    if (listA) listA.style.display='none';
    loadCirclePending();
  } else {
    if (btnA) { btnA.style.background='#fff'; btnA.style.color='#000'; }
    if (btnP) { btnP.style.background='transparent'; btnP.style.color='rgba(255,255,255,0.4)'; }
    if (listP) listP.style.display='none';
    if (listA) listA.style.display='block';
    loadCircleActive();
  }
}

function genVVCoreId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1='', p2='';
  for (let i=0;i<4;i++) p1 += c[Math.floor(Math.random()*c.length)];
  for (let i=0;i<2;i++) p2 += c[Math.floor(Math.random()*c.length)];
  return 'VV\u00B7CORE\u00B7' + p1 + '-' + p2;
}

function loadCirclePending() {
  const list = document.getElementById('circle-pending-list');
  if (!list) return;
  if (_pendingUnsub) { _pendingUnsub(); _pendingUnsub=null; }
  list.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:13px">Se încarcă...</div>';

  _pendingUnsub = db.collection('contributors').where('status','==','pending')
    .onSnapshot(snap => {
      const badge = document.getElementById('badge-circle');
      if (badge) { badge.textContent=snap.size; badge.style.display=snap.size>0?'inline-block':'none'; }
      const stats = document.getElementById('circle-stats');
      if (stats) stats.textContent = snap.size + ' pending';
      if (snap.empty) { list.innerHTML='<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.25);font-size:13px">Nicio cerere în așteptare. 🎉</div>'; return; }
      list.innerHTML = '';
      snap.forEach(doc => {
        const d = doc.data();
        const card = document.createElement('div');
        card.className = 'circle-card';
        const dateStr = d.submittedAt ? d.submittedAt.toDate().toLocaleString('ro-RO') : '—';
        const docId = doc.id;
        const alias = (d.alias||'INSIDER').replace(/'/g,"\\'");
        card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px"><div><div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:3px">${d.alias||'INSIDER'}</div><div style="font-size:10px;color:rgba(255,255,255,0.3);font-family:monospace">${docId.substring(0,16)}...</div></div><div style="font-size:10px;color:rgba(212,175,55,0.6);text-align:right"><div style="font-weight:700">⏳ PENDING</div><div style="margin-top:2px;color:rgba(255,255,255,0.25)">${dateStr}</div></div></div><div style="display:flex;gap:8px"><button onclick="deployCircle('${docId}','${alias}',event)" style="flex:1;padding:12px;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.35);border-radius:10px;color:#D4AF37;font-weight:800;font-size:12px;cursor:pointer;min-height:44px;font-family:inherit">⬡ VERIFY & DEPLOY</button><button onclick="rejectCircle('${docId}')" style="padding:12px 14px;background:rgba(255,59,48,0.08);border:1px solid rgba(255,59,48,0.2);border-radius:10px;color:#ff3b30;font-weight:700;font-size:12px;cursor:pointer;min-height:44px;font-family:inherit">✕</button></div>`;
        list.appendChild(card);
      });
    }, err => { list.innerHTML='<div style="color:#ff3b30;padding:16px;font-size:12px">Eroare: ' + err.message + '</div>'; });
}

function loadCircleActive() {
  const list = document.getElementById('circle-active-list');
  if (!list) return;
  if (_activeUnsub) { _activeUnsub(); _activeUnsub=null; }
  _activeUnsub = db.collection('contributors').where('status','==','active')
    .onSnapshot(snap => {
      const stats = document.getElementById('circle-stats');
      if (stats) stats.textContent = snap.size + ' activi / 100';
      if (snap.empty) { list.innerHTML='<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.25);font-size:13px">Niciun contributor activ încă.</div>'; return; }
      list.innerHTML = '';
      snap.forEach(doc => {
        const d = doc.data();
        const dateStr = d.activatedAt ? d.activatedAt.toDate().toLocaleDateString('ro-RO') : '—';
        const isOnline = d.lastActive && (d.lastActive.toDate() > new Date(Date.now()-5*60*1000));
        const card = document.createElement('div');
        card.className = 'circle-active-card';
        card.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><div style="width:8px;height:8px;border-radius:50%;background:${isOnline?'#34c759':'rgba(255,255,255,0.2)'};${isOnline?'box-shadow:0 0 6px rgba(52,199,89,0.5)':''}"></div><div><div style="font-size:13px;font-weight:700;color:#fff">${d.alias||'INSIDER'}</div><div style="font-size:11px;font-family:monospace;color:#D4AF37;margin-top:2px">${d.vvCoreId||'—'}</div></div></div><div style="text-align:right"><div style="font-size:10px;color:rgba(52,199,89,0.6);font-weight:700">ACTIV</div><div style="font-size:10px;color:rgba(255,255,255,0.25);margin-top:2px">${dateStr}</div></div>`;
        list.appendChild(card);
      });
    }, err => { list.innerHTML='<div style="color:#ff3b30;padding:16px;font-size:12px">Eroare: ' + err.message + '</div>'; });
}

async function deployCircle(uid, alias, event) {
  if (!confirm('Ai verificat plata de 29 lei de la ' + alias + ' în Salt Bank?\n\nApasă OK pentru a activa identitatea VV·CORE.')) return;
  const btn = event.currentTarget;
  btn.textContent='SE DEPLOYEAZĂ...'; btn.style.opacity='0.6'; btn.style.pointerEvents='none';
  try {
    let newId = genVVCoreId();
    const existing = await db.collection('contributors').where('vvCoreId','==',newId).get();
    if (!existing.empty) newId = genVVCoreId();
    await db.collection('contributors').doc(uid).update({ status:'active', vvCoreId:newId, activatedAt: firebase.firestore.FieldValue.serverTimestamp(), activatedBy:'CEO' });
    await db.collection('inbox').add({ to:uid, type:'circle_activated', message:'⬡ Identitatea ta VV·CORE a fost activată: ' + newId + '. Bine ai venit în nucleul Universului VV.', vvCoreId:newId, read:false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    logVVhi('CIRCLE_DEPLOY', { uid, alias, vvCoreId:newId });
    logCEOAction('CIRCLE_DEPLOY', alias + ' → ' + newId);
    showNotif('✅ ' + newId + ' deploiat pentru ' + alias + '!');
  } catch(e) {
    showNotif('Eroare: ' + e.message, true);
    btn.textContent='⬡ VERIFY & DEPLOY'; btn.style.opacity='1'; btn.style.pointerEvents='auto';
  }
}

async function rejectCircle(uid) {
  if (!confirm('Respingi această cerere? Returnează banii manual din Salt Bank.')) return;
  try {
    await db.collection('contributors').doc(uid).update({ status:'rejected', rejectedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('inbox').add({ to:uid, type:'circle_rejected', message:'Cererea ta pentru VV Inner Circle nu a putut fi verificată. Contactează VV Team.', read:false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    logCEOAction('CIRCLE_REJECT', uid);
    showNotif('Cerere respinsă.');
  } catch(e) { showNotif('Eroare: ' + e.message, true); }
}
