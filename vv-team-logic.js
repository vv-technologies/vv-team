// ================= FIREBASE CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyDGv4kEClO0RHCLvXVLOT-vyPHw6bsxYVc",
    authDomain: "vv-ep-beta.firebaseapp.com",
    projectId: "vv-ep-beta",
    storageBucket: "vv-ep-beta.firebasestorage.app"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const authCEO = firebase.auth();

let isFirstDisputeLoad = true;
let audioContext = null;
let currentFeedPhotos = [];
let currentDisputePhotos = [];
let activeGalleryArray = [];
let activeGalleryIndex = 0;

// ================= LIGHTBOX =================
function openLightbox(arrayType, index) {
    if(arrayType === 'feed') activeGalleryArray = currentFeedPhotos;
    else if (arrayType === 'dispute') activeGalleryArray = currentDisputePhotos;
    if(activeGalleryArray.length === 0) return;
    activeGalleryIndex = index;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
    document.getElementById('lightbox').style.display = 'flex';
}
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }
function lbNext(event) {
    event.stopPropagation();
    if(!activeGalleryArray.length) return;
    activeGalleryIndex = (activeGalleryIndex + 1) % activeGalleryArray.length;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
}
function lbPrev(event) {
    event.stopPropagation();
    if(!activeGalleryArray.length) return;
    activeGalleryIndex = (activeGalleryIndex - 1 + activeGalleryArray.length) % activeGalleryArray.length;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
}

// ================= AUDIO =================
function playAlertSound() {
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.start(); osc.stop(audioContext.currentTime + 0.4);
    } catch(e) {}
}

// ================= CEO TOAST (înlocuiește toate alert-urile) =================
function showCEOToast(msg, color) {
    color = color || 'green';
    var old = document.getElementById('ceo-toast');
    if (old) old.remove();
    var colors = {
        green: { bg:'rgba(52,199,89,0.15)', border:'rgba(52,199,89,0.35)', text:'#34c759' },
        red:   { bg:'rgba(255,59,48,0.15)',  border:'rgba(255,59,48,0.35)',  text:'#ff3b30' },
        blue:  { bg:'rgba(10,132,255,0.15)', border:'rgba(10,132,255,0.35)', text:'#0A84FF' },
        gold:  { bg:'rgba(212,175,55,0.15)', border:'rgba(212,175,55,0.35)', text:'#D4AF37' }
    };
    var c = colors[color] || colors.green;
    var t = document.createElement('div');
    t.id = 'ceo-toast';
    t.style.cssText = 'position:fixed;top:calc(20px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:999999;background:' + c.bg + ';backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid ' + c.border + ';border-radius:16px;padding:14px 22px;font-size:13px;font-weight:700;color:' + c.text + ';max-width:90vw;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.4);font-family:-apple-system,sans-serif;white-space:nowrap;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { if(t.parentNode) { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(function(){ t.remove(); }, 300); } }, 3500);
}

// ================= AUDIT LOG =================
var auditLog = JSON.parse(localStorage.getItem('vv_audit_log') || '[]');

function addAuditEntry(action) {
    var entry = {
        ts: Date.now(),
        action: action,
        time: new Date().toLocaleString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    };
    auditLog.unshift(entry);
    if (auditLog.length > 100) auditLog = auditLog.slice(0, 100);
    localStorage.setItem('vv_audit_log', JSON.stringify(auditLog));
    renderAuditLog();
}

function renderAuditLog() {
    var container = document.getElementById('audit-log-body');
    if (!container) return;
    container.innerHTML = '';
    if (auditLog.length === 0) {
        container.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:20px;">Nicio acțiune înregistrată.</td></tr>';
        return;
    }
    auditLog.slice(0, 50).forEach(function(e) {
        container.innerHTML += '<tr><td style="color:rgba(255,255,255,0.3);font-size:11px;white-space:nowrap;font-family:monospace;padding:10px 14px 10px 0;">' + e.time + '</td><td style="font-size:13px;color:rgba(255,255,255,0.75);padding:10px 0;">' + e.action + '</td></tr>';
    });
}

function clearAuditLog() {
    if (!confirm('Ștergi tot log-ul de audit?')) return;
    auditLog = [];
    localStorage.removeItem('vv_audit_log');
    renderAuditLog();
    showCEOToast('Log de audit șters.', 'blue');
}

// ================= LOGIN CEO =================
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(function() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user && !user.isAnonymous) {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            var ls = document.getElementById('login-screen');
            if (ls) { ls.style.opacity = '0'; setTimeout(function() { ls.style.display = 'none'; initDashboard(); }, 200); }
        } else if (user && user.isAnonymous) {
            firebase.auth().signOut();
            document.getElementById('login-screen').style.display = 'flex';
        } else {
            document.getElementById('login-screen').style.display = 'flex';
        }
    });
}).catch(function(err) {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user && !user.isAnonymous) { document.getElementById('login-screen').style.display = 'none'; initDashboard(); }
        else { document.getElementById('login-screen').style.display = 'flex'; }
    });
});

function checkLogin() {
    var email = document.getElementById('ceo-email').value.trim();
    var pass = document.getElementById('ceo-pass').value.trim();
    var btn = document.getElementById('login-btn');
    var errMsg = document.getElementById('login-error');
    if (!email || !pass) { errMsg.textContent = 'Completează email și parolă.'; errMsg.style.display = 'block'; return; }
    btn.textContent = 'SE AUTENTIFICĂ...'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';
    errMsg.style.display = 'none';
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(function() { return firebase.auth().signInWithEmailAndPassword(email, pass); })
        .then(function() {
            btn.textContent = 'BINE AI VENIT ✓';
            var ls = document.getElementById('login-screen');
            ls.style.opacity = '0';
            setTimeout(function() { ls.style.display = 'none'; initDashboard(); }, 400);
        })
        .catch(function(err) {
            btn.textContent = 'INTRĂ ÎN SISTEM'; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
            if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') errMsg.textContent = 'Email sau parolă incorectă.';
            else if (err.code === 'auth/invalid-email') errMsg.textContent = 'Email invalid.';
            else if (err.code === 'auth/too-many-requests') errMsg.textContent = 'Prea multe încercări. Așteaptă 1 minut.';
            else if (err.code === 'auth/network-request-failed') errMsg.textContent = 'Fără conexiune.';
            else { errMsg.textContent = 'Se reîncearcă...'; setTimeout(function() { checkLogin(); }, 2000); return; }
            errMsg.style.display = 'block';
        });
}

document.addEventListener('DOMContentLoaded', function() {
    var ei = document.getElementById('ceo-email');
    var pi = document.getElementById('ceo-pass');
    if (ei) ei.addEventListener('keypress', function(e) { if(e.key==='Enter') checkLogin(); });
    if (pi) pi.addEventListener('keypress', function(e) { if(e.key==='Enter') checkLogin(); });
    renderAuditLog();
});

function logoutCEO() { secureLogoutCEO(); }

function secureLogoutCEO() {
    addAuditEntry('🔐 CEO Logout securizat');
    firebase.auth().signOut().then(function() { location.reload(); });
}

// ================= NAVIGATIE =================
function switchSection(id, element) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById(id + '-section').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
    element.classList.add('active');
    if (id === 'audit') renderAuditLog();
}

function initDashboard() {
    loadGlobalFeed();
    loadDisputes();
    loadLeaderboard();
    loadFeedback();
    loadKeys();
    loadTalentPool();
}

// ================= 1. GLOBAL FEED 24H =================
function loadGlobalFeed() {
    var cutoff24h = Date.now() - (24 * 60 * 60 * 1000);
    db.collection('photos').orderBy('timestamp', 'desc').onSnapshot(function(snap) {
        var container = document.getElementById('feed-container');
        container.innerHTML = '';
        currentFeedPhotos = [];
        var imgIndex = 0, count = 0;
        if (snap.empty) { container.innerHTML = '<div style="color:var(--text-muted);">Nicio captură în ultimele 24h.</div>'; return; }
        snap.forEach(function(doc) {
            var d = doc.data();
            if (d.timestamp < cutoff24h) return;
            count++;
            currentFeedPhotos.push(d.url);
            var date = new Date(d.timestamp).toLocaleString('ro-RO', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' });
            var gpsStr = d.gpsLat ? d.gpsLat.toFixed(4) + ', ' + d.gpsLng.toFixed(4) : 'GPS N/A';
            var flagHtml = d.flagged ? '<div class="flag-badge"><i class="fas fa-exclamation-triangle"></i> ALERTAT</div>' : '';
            var safeAlias = (d.alias || 'INSIDER').replace(/'/g, "\\'");
            var idx = imgIndex;
            container.innerHTML += '<div class="photo-card"><div style="position:relative;"><img src="' + d.url + '" class="photo-img" onclick="openLightbox(\'feed\',' + idx + ')" title="Click Zoom"><div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:8px 12px;"><div style="font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;">VV PROOF</div><div style="font-size:11px;color:rgba(255,255,255,0.7);">📍 ' + gpsStr + '</div></div></div><div class="photo-info">' + flagHtml + '<div class="photo-msg">"' + (d.message || 'Captură VV') + '"</div><div class="photo-meta"><span><i class="fas fa-clock"></i> ' + date + '</span><span style="cursor:pointer;color:var(--vv-blue);" onclick="openInsiderProfile(\'' + (d.agentId||'') + '\',\'' + safeAlias + '\')">' + (d.alias||'INSIDER').substring(0,8) + ' ›</span></div><div style="display:flex;gap:8px;margin-top:12px;"><button onclick="approvePhotoCEO(\'' + doc.id + '\',\'' + (d.agentId||'') + '\')" style="flex:1;padding:14px;border:none;border-radius:12px;background:rgba(52,199,89,0.15);color:#34c759;border:1px solid rgba(52,199,89,0.3);font-weight:800;font-size:13px;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;">✓ APROBĂ</button><button onclick="rejectWithDSA(\'' + doc.id + '\',\'' + (d.agentId||'') + '\')" style="flex:1;padding:14px;border:none;border-radius:12px;background:rgba(255,59,48,0.15);color:#ff3b30;border:1px solid rgba(255,59,48,0.3);font-weight:800;font-size:13px;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;">✕ RESPINGE</button></div></div></div>';
            imgIndex++;
        });
        if (count === 0) container.innerHTML = '<div style="color:var(--text-muted);">Nicio captură în ultimele 24h.</div>';
    });
}

async function approvePhotoCEO(photoId, agentId) {
    try {
        var photoDoc = await db.collection('photos').doc(photoId).get();
        var reward = photoDoc.data()?.reward || 0;
        var alias = photoDoc.data()?.alias || 'INSIDER';
        if (reward > 0 && agentId) await db.collection('users').doc(agentId).update({ balance: firebase.firestore.FieldValue.increment(reward) });
        await db.collection('photos').doc(photoId).update({ approved: true, flagged: false });
        addAuditEntry('✅ Dovadă aprobată — ' + alias + ' +' + reward + ' VV');
        showCEOToast('✅ Aprobat! ' + alias + ' +' + reward + ' VV.', 'green');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================= DSA REJECT =================
var selectedDSAReason = null;

function rejectWithDSA(photoId, agentId) {
    selectedDSAReason = null;
    var existing = document.getElementById('dsa-reject-modal');
    if (existing) existing.remove();
    var reasons = [
        { code:'blur', label:'📷 Poză neclară / calitate insuficientă' },
        { code:'location', label:'📍 Nu se confirmă locația din GPS' },
        { code:'inappropriate', label:'🚫 Conținut inadecvat sau ofensator' },
        { code:'fake', label:'⚠️ Dovadă manipulată sau falsificată' },
        { code:'duplicate', label:'🔁 Duplicat — poză deja trimisă' },
        { code:'other', label:'❓ Alt motiv' }
    ];
    var modal = document.createElement('div');
    modal.id = 'dsa-reject-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);display:flex;align-items:flex-end;justify-content:center;';
    var reasonsBtns = reasons.map(function(r) {
        return '<button onclick="selectDSAReason(\'' + r.code + '\',this)" data-code="' + r.code + '" style="padding:14px 16px;border-radius:14px;text-align:left;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;width:100%;">' + r.label + '</button>';
    }).join('');
    modal.innerHTML = '<div style="background:rgba(10,10,16,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:28px 28px 0 0;padding:28px 22px calc(36px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;overflow-y:auto;max-height:85vh;"><div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 22px;"></div><div style="font-size:10px;color:rgba(255,59,48,0.7);letter-spacing:3px;font-weight:700;margin-bottom:8px;">MOTIVUL RESPINGERII — DSA COMPLIANT</div><div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:18px;">Selectează motivul</div><div id="dsa-reason-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">' + reasonsBtns + '</div><textarea id="dsa-custom-reason" placeholder="Detalii suplimentare (opțional)..." style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;color:#fff;font-size:13px;font-family:-apple-system,sans-serif;outline:none;resize:none;height:70px;margin-bottom:12px;"></textarea><button id="dsa-confirm-btn" onclick="confirmDSAReject(\'' + photoId + '\',\'' + agentId + '\')" style="width:100%;padding:16px;border:none;border-radius:16px;background:rgba(255,59,48,0.15);color:#ff3b30;border:1px solid rgba(255,59,48,0.3);font-weight:800;font-size:14px;cursor:pointer;min-height:52px;font-family:-apple-system,sans-serif;opacity:0.5;pointer-events:none;">RESPINGE CU NOTIFICARE DSA</button><button onclick="document.getElementById(\'dsa-reject-modal\').remove()" style="width:100%;padding:14px;border:none;border-radius:14px;background:transparent;color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.07);font-weight:600;font-size:13px;cursor:pointer;margin-top:8px;min-height:44px;font-family:-apple-system,sans-serif;">ANULEAZĂ</button></div>';
    modal.addEventListener('click', function(e) { if(e.target===modal) modal.remove(); });
    document.body.appendChild(modal);
}

function selectDSAReason(code, btn) {
    selectedDSAReason = code;
    document.querySelectorAll('#dsa-reason-list button').forEach(function(b) { b.style.background='rgba(255,255,255,0.04)'; b.style.borderColor='rgba(255,255,255,0.08)'; b.style.color='rgba(255,255,255,0.7)'; });
    btn.style.background='rgba(255,59,48,0.12)'; btn.style.borderColor='rgba(255,59,48,0.4)'; btn.style.color='#ff3b30';
    var cb = document.getElementById('dsa-confirm-btn'); cb.style.opacity='1'; cb.style.pointerEvents='auto';
}

async function confirmDSAReject(photoId, agentId) {
    if (!selectedDSAReason) return;
    var customReason = document.getElementById('dsa-custom-reason').value.trim();
    var labels = { blur:'Poză neclară', location:'GPS neconfirmat', inappropriate:'Conținut inadecvat', fake:'Dovadă falsificată', duplicate:'Duplicat', other:'Alt motiv' };
    var reasonText = labels[selectedDSAReason] + (customReason ? ': ' + customReason : '');
    try {
        await db.collection('photos').doc(photoId).update({ approved:false, flagged:true, rejectReason:reasonText });
        await db.collection('inbox').add({ to:agentId, from:'VVTeam', type:'rejection_dsa', message:'❌ Dovada ta a fost respinsă. Motiv: ' + reasonText + '. Poți retrimite o dovadă nouă.', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry('❌ Dovadă respinsă (DSA) — ' + reasonText);
        document.getElementById('dsa-reject-modal')?.remove();
        showCEOToast('❌ Respins. Insider notificat (DSA).', 'red');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================= 2. DISPUTE =================
function loadDisputes() {
    db.collection('missions').where('status','==','disputed').onSnapshot(function(snap) {
        var container = document.getElementById('disputes-container');
        var badge = document.getElementById('dispute-badge');
        container.innerHTML = ''; currentDisputePhotos = []; var imgIndex = 0;
        if(snap.size > 0) { badge.style.display='inline-block'; badge.innerText=snap.size; }
        else { badge.style.display='none'; container.innerHTML='<div style="color:var(--text-muted);">Nicio dispută activă.</div>'; }
        if (!isFirstDisputeLoad) { var hasNew=false; snap.docChanges().forEach(function(c){ if(c.type==='added') hasNew=true; }); if(hasNew) playAlertSound(); }
        isFirstDisputeLoad = false;
        snap.forEach(function(doc) {
            var m = doc.data(); currentDisputePhotos.push(m.photoUrl); var idx=imgIndex;
            container.innerHTML += '<div class="photo-card" style="border-color:var(--danger);"><img src="' + m.photoUrl + '" class="photo-img" onclick="openLightbox(\'dispute\',' + idx + ')"><div class="photo-info"><div class="flag-badge">DISPUTĂ DESCHISĂ</div><div class="photo-msg" style="color:var(--text-muted);font-size:12px;">Cerere: <span style="color:#fff;">' + m.description + '</span></div><div class="photo-meta" style="margin-top:10px;"><span>Recompensă: <strong style="color:var(--gold);">' + m.reward + ' VV</strong></span></div><div class="action-row"><button class="btn-approve" onclick="resolveDispute(\'' + doc.id + '\',\'' + m.solverId + '\',' + m.reward + ',true)">POZĂ OK</button><button class="btn-reject" onclick="resolveDispute(\'' + doc.id + '\',\'' + m.creatorId + '\',' + m.reward + ',false)">FAKE (Retur BANI)</button></div></div></div>';
            imgIndex++;
        });
    });
}

async function resolveDispute(missionId, targetUserId, amount, isApprove) {
    if(!confirm(isApprove ? 'Plătești AGENTULUI?' : 'Returnezi banii CLIENTULUI?')) return;
    try {
        await db.collection('users').doc(targetUserId).update({ balance:firebase.firestore.FieldValue.increment(amount) });
        await db.collection('missions').doc(missionId).update({ status:isApprove?'completed':'cancelled_fraud' });
        addAuditEntry('⚖️ Dispută rezolvată: ' + (isApprove?'Aprobat':'Fraud') + ' — ' + amount + ' VV');
        showCEOToast('Dispută rezolvată.', isApprove?'green':'red');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================= 3. LEADERBOARD =================
function loadLeaderboard() {
    db.collection('users').onSnapshot(function(snap) {
        var users = [], totalBank = 0;
        snap.forEach(function(doc) { var d=doc.data(); d.uid=doc.id; users.push(d); totalBank+=(d.balance||0); });
        document.getElementById('total-vv-bank').innerText = totalBank.toLocaleString() + ' VV';
        users.sort(function(a,b){ return (b.balance||0)-(a.balance||0); });
        var tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        if(!users.length) { tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Niciun agent.</td></tr>'; return; }
        users.forEach(function(u, i) {
            var rankHtml = i===0 ? '<span class="rank-gold">#1</span>' : i===1 ? '<span style="color:#C0C0C0;font-weight:bold;">#2</span>' : i===2 ? '<span style="color:#CD7F32;font-weight:bold;">#3</span>' : '#'+(i+1);
            var shortId = u.uid.substring(0,5).toUpperCase();
            var avgStars = u.totalRatings > 0 ? (u.ratingSum/u.totalRatings).toFixed(1) : '—';
            var statusHtml = u.banned ? '<span style="color:#ff3b30;font-size:11px;font-weight:700;">🚫 BANAT</span>' : (u.balance||0)>=1000 ? '<span class="badge-onyx"><i class="fas fa-check-circle"></i> ELIGIBIL ONYX</span>' : '<span style="color:var(--text-muted);font-size:11px;">ÎN PROGRES</span>';
            var safeAlias = (u.alias||'Agent').replace(/'/g,"\\'");
            tbody.innerHTML += '<tr style="cursor:pointer;" onclick="openInsiderProfile(\'' + u.uid + '\',\'' + safeAlias + '\')"><td>' + rankHtml + '</td><td><strong style="color:' + (u.banned?'#ff3b30':'#fff') + ';">' + (u.alias||'Agent') + '</strong> <span style="color:#555;font-size:10px;margin-left:5px;">(' + shortId + ')</span></td><td style="color:var(--safe-green);font-family:monospace;font-size:16px;">' + (u.balance||0) + ' VV</td><td><div style="display:flex;flex-direction:column;gap:3px;">' + statusHtml + '<span style="font-size:10px;color:rgba(212,175,55,0.5);">★ ' + avgStars + ' (' + (u.totalRatings||0) + ' eval.)</span></div></td></tr>';
        });
    });
}

// ================= 4. FEEDBACK & SUPORT =================
function loadFeedback() {
    db.collection('feedback').orderBy('createdAt','desc').onSnapshot(function(snap) {
        var tbody = document.getElementById('feedback-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td><strong style="color:#fff;">Sistem Beta</strong></td><td style="color:rgba(255,255,255,0.6);">Niciun mesaj încă.</td><td><span style="color:var(--safe-green);font-size:11px;font-weight:bold;">ONLINE</span></td><td>—</td></tr>';
            return;
        }
        snap.forEach(function(doc) {
            var d = doc.data();
            var date = d.createdAt?.toDate().toLocaleString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) || '—';
            var safeAlias = (d.alias||'INSIDER').replace(/'/g,"\\'");
            tbody.innerHTML += '<tr><td><div style="font-weight:700;color:#fff;">' + (d.alias||'INSIDER') + '</div><div style="font-size:10px;color:var(--text-muted);font-family:monospace;">' + (d.uid||'').substring(0,8) + '</div><div style="font-size:10px;color:var(--text-muted);">' + date + '</div></td><td style="color:rgba(255,255,255,0.75);max-width:300px;">' + (d.message||'—') + '</td><td><span style="color:' + (d.resolved?'var(--text-muted)':'var(--safe-green)') + ';font-size:11px;font-weight:bold;letter-spacing:1px;">' + (d.resolved?'REZOLVAT':'NOU') + '</span></td><td>' + (!d.resolved ? '<button onclick="markFeedbackResolved(\'' + doc.id + '\',\'' + safeAlias + '\',\'' + (d.uid||'') + '\')" class="btn-reply">✓ REZOLVAT</button>' : '—') + '</td></tr>';
        });
    });
}

async function markFeedbackResolved(docId, alias, uid) {
    try {
        await db.collection('feedback').doc(docId).update({ resolved:true });
        if (uid) await db.collection('inbox').add({ to:uid, from:'VVTeam', type:'support_resolved', message:'✅ Mesajul tău de suport a fost preluat și rezolvat de echipa VV. Mulțumim!', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry('📩 Suport rezolvat — ' + alias);
        showCEOToast('✅ Marcat rezolvat. Insider notificat.', 'green');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================= WIPE DATABASE =================
async function deleteAllBetaData() {
    var word = prompt('ATENȚIE: Șterge TOATE pozele și misiunile! Scrie: RESET');
    if(word !== 'RESET') { showCEOToast('Procedură anulată.', 'blue'); return; }
    try {
        var photos = await db.collection('photos').get();
        photos.forEach(function(doc) { doc.ref.delete(); });
        var missions = await db.collection('missions').get();
        missions.forEach(function(doc) { doc.ref.delete(); });
        addAuditEntry('🗑️ CEO a șters TOATE datele Beta (RESET)');
        showCEOToast('Sistem curățat complet!', 'gold');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================= TALENT POOL =================
function loadTalentPool() {
    db.collection('talent_pool').orderBy('createdAt','desc').onSnapshot(function(snap) {
        var container = document.getElementById('talent-container');
        if (!container) return;
        container.innerHTML = '';
        if (snap.empty) { container.innerHTML='<div style="color:var(--text-muted);">Nicio aplicație încă.</div>'; return; }
        snap.forEach(function(doc) {
            var d = doc.data();
            var date = d.createdAt?.toDate().toLocaleString('ro-RO') || '—';
            var safeAlias = (d.alias||'').replace(/'/g,"\\'");
            container.innerHTML += '<div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:14px;font-weight:800;color:#fff;">' + (d.alias||'INSIDER') + '</span><span style="font-size:10px;color:var(--text-muted);">' + date + '</span></div><div style="font-size:13px;color:rgba(255,255,255,0.7);"><strong style="color:rgba(255,255,255,0.5);">Skills:</strong> ' + d.skill + '</div>' + (d.portfolio && d.portfolio!=='N/A' ? '<a href="' + d.portfolio + '" target="_blank" style="font-size:12px;color:var(--vv-blue);text-decoration:none;font-weight:600;"><i class="fas fa-link"></i> ' + d.portfolio + '</a>' : '') + '<div style="display:flex;gap:8px;margin-top:4px;"><button onclick="updateTalentStatus(\'' + doc.id + '\',\'contacted\',\'' + safeAlias + '\')" style="flex:1;padding:12px;border:none;border-radius:10px;background:rgba(10,132,255,0.15);color:#0A84FF;border:1px solid rgba(10,132,255,0.3);font-weight:700;font-size:11px;cursor:pointer;min-height:44px;">CONTACTEAZĂ</button><button onclick="updateTalentStatus(\'' + doc.id + '\',\'rejected\',\'' + safeAlias + '\')" style="flex:1;padding:12px;border:none;border-radius:10px;background:rgba(255,59,48,0.1);color:#ff3b30;border:1px solid rgba(255,59,48,0.25);font-weight:700;font-size:11px;cursor:pointer;min-height:44px;">RESPINGE</button></div></div>';
        });
    });
}

async function updateTalentStatus(docId, status, alias) {
    try {
        await db.collection('talent_pool').doc(docId).update({ status:status });
        addAuditEntry('👤 Talent: ' + alias + ' → ' + (status==='contacted'?'CONTACTAT':'RESPINS'));
        showCEOToast(status==='contacted'?'✅ Marcat Contactat!':'❌ Respins.', status==='contacted'?'green':'red');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================= 5. CHEI =================
function loadKeys() {
    db.collection('access_keys').orderBy('createdAt','desc').onSnapshot(function(snap) {
        var list = document.getElementById('keys-list');
        var dashboard = document.getElementById('keys-dashboard');
        if (!list) return;
        var total=0, active=0, used=0, userGen=0;
        list.innerHTML = '';
        snap.forEach(function(doc) {
            var d = doc.data(); total++;
            if(d.active) active++;
            if(d.used) used++;
            if(d.generatedBy) userGen++;
            var sColor = d.active?'var(--safe-green)':'#ff3b30';
            var sTxt = d.active?'ACTIV':'DEZACTIVAT';
            var src = d.generatedBy ? '<span style="font-size:10px;color:rgba(255,255,255,0.3);">de '+(d.generatedByAlias||'INSIDER')+'</span>' : '<span style="font-size:10px;color:rgba(255,255,255,0.3);">CEO</span>';
            var date = d.createdAt?.toDate().toLocaleString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) || '—';
            list.innerHTML += '<div class="key-item" style="flex-wrap:wrap;gap:8px;"><div style="display:flex;flex-direction:column;gap:2px;"><span style="font-family:monospace;font-size:15px;letter-spacing:2px;">' + d.key + '</span><div style="display:flex;gap:8px;align-items:center;">' + src + '<span style="font-size:10px;color:rgba(255,255,255,0.2);">' + date + '</span></div></div><div style="display:flex;align-items:center;gap:8px;margin-left:auto;"><span style="font-size:11px;font-weight:700;color:' + sColor + ';">' + sTxt + '</span><button onclick="toggleKeyCEO(\'' + doc.id + '\',' + d.active + ',\'' + d.key + '\')" style="background:' + (d.active?'rgba(255,59,48,0.12)':'rgba(52,199,89,0.12)') + ';border:1px solid ' + (d.active?'rgba(255,59,48,0.25)':'rgba(52,199,89,0.25)') + ';color:' + (d.active?'#ff3b30':'#34c759') + ';padding:8px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;min-height:44px;">' + (d.active?'REVOKE':'ACTIVEAZĂ') + '</button></div></div>';
        });
        if (dashboard) dashboard.innerHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px;"><div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#fff;">' + total + '</div><div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:2px;">TOTAL CHEI</div></div><div style="background:rgba(52,199,89,0.06);border:1px solid rgba(52,199,89,0.2);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#34c759;">' + active + '</div><div style="font-size:10px;color:rgba(52,199,89,0.5);letter-spacing:1px;margin-top:2px;">ACTIVE</div></div><div style="background:rgba(10,132,255,0.06);border:1px solid rgba(10,132,255,0.2);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#0A84FF;">' + userGen + '</div><div style="font-size:10px;color:rgba(10,132,255,0.5);letter-spacing:1px;margin-top:2px;">DE INSIDERI</div></div><div style="background:rgba(255,149,0,0.06);border:1px solid rgba(255,149,0,0.2);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#ff9500;">' + (total-active) + '</div><div style="font-size:10px;color:rgba(255,149,0,0.5);letter-spacing:1px;margin-top:2px;">REVOCATE</div></div></div>';
    });
}

async function generateKey() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var newKey = '';
    for(var i=0;i<6;i++) newKey += chars.charAt(Math.floor(Math.random()*chars.length));
    try {
        await db.collection('access_keys').add({ key:newKey, active:true, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry('🔑 CEO a generat cheia: ' + newKey);
        showCEOToast('🔑 Cheie generată: ' + newKey, 'gold');
    } catch(e) { showCEOToast('Eroare generare cheie.', 'red'); }
}

async function toggleKey(docId, currentState) { await toggleKeyCEO(docId, currentState, '—'); }

async function toggleKeyCEO(docId, currentState, keyCode) {
    try {
        await db.collection('access_keys').doc(docId).update({ active:!currentState });
        var action = currentState ? 'REVOCATĂ' : 'ACTIVATĂ';
        addAuditEntry('🔑 Cheie ' + keyCode + ' ' + action);
        showCEOToast('Cheie ' + keyCode + ' ' + action.toLowerCase() + '.', currentState?'red':'green');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================= PROFIL INSIDER DETALIAT =================
function openInsiderProfile(uid, alias) {
    if (!uid) { showCEOToast('UID lipsă.', 'red'); return; }
    db.collection('users').doc(uid).get().then(function(doc) {
        if (!doc.exists) { showCEOToast('Insider negăsit.', 'red'); return; }
        var u = doc.data();
        var ex = document.getElementById('insider-profile-modal');
        if (ex) ex.remove();
        var avgStars = u.totalRatings > 0 ? (u.ratingSum/u.totalRatings).toFixed(1) : '—';
        var starsHtml = u.totalRatings > 0 ? [1,2,3,4,5].map(function(i){ return '<span style="color:' + (i<=Math.round(u.ratingSum/u.totalRatings)?'#D4AF37':'rgba(255,255,255,0.15)') + ';font-size:20px;">★</span>'; }).join('') : '<span style="color:rgba(255,255,255,0.3);font-size:12px;">Nicio evaluare</span>';
        var safeAlias = (u.alias||alias||'INSIDER').replace(/'/g,"\\'");
        var modal = document.createElement('div');
        modal.id = 'insider-profile-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);display:flex;align-items:flex-end;justify-content:center;';
        modal.innerHTML = '<div style="background:rgba(10,10,16,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:28px 28px 0 0;padding:28px 22px calc(40px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;overflow-y:auto;max-height:90vh;"><div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 22px;"></div><div style="font-size:10px;color:rgba(212,175,55,0.6);letter-spacing:3px;font-weight:700;margin-bottom:6px;">PROFIL INSIDER</div><div style="font-size:24px;font-weight:900;color:' + (u.banned?'#ff3b30':'#fff') + ';margin-bottom:20px;">' + (u.alias||alias||'INSIDER') + (u.banned?' 🚫':'') + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;"><div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);border-radius:14px;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#D4AF37;">' + (u.balance||0) + '</div><div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:2px;">VV COINS</div></div><div style="background:rgba(52,199,89,0.06);border:1px solid rgba(52,199,89,0.15);border-radius:14px;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#34c759;">' + (u.totalRatings||0) + '</div><div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:2px;">MISIUNI</div></div></div><div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;margin-bottom:14px;text-align:center;"><div style="margin-bottom:6px;">' + starsHtml + '</div><div style="font-size:12px;color:rgba(255,255,255,0.3);">Media: <strong style="color:#fff;">' + avgStars + '</strong> stele · ' + (u.totalRatings||0) + ' evaluări</div></div><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;margin-bottom:16px;"><div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:4px;">DEVICE / UID</div><div style="font-size:11px;color:rgba(255,255,255,0.4);font-family:monospace;word-break:break-all;">' + uid + '</div></div><div style="background:rgba(212,175,55,0.05);border:1px solid rgba(212,175,55,0.15);border-radius:16px;padding:16px;margin-bottom:12px;"><div style="font-size:10px;color:rgba(212,175,55,0.55);letter-spacing:2px;margin-bottom:10px;">CEO OVERRIDE — AJUSTARE BALANȚĂ</div><div style="display:flex;gap:8px;"><input id="balance-adjust-val" type="number" placeholder="±VV (ex: 50 sau -20)" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:12px 14px;color:#fff;font-size:14px;outline:none;font-family:monospace;min-height:44px;"><button onclick="adjustBalanceCEO(\'' + uid + '\',\'' + safeAlias + '\')" style="padding:12px 16px;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;min-height:44px;font-family:-apple-system,sans-serif;">APLICĂ</button></div></div><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"><button onclick="warnInsiderCEO(\'' + uid + '\',\'' + safeAlias + '\')" style="width:100%;padding:15px;border-radius:14px;background:rgba(10,132,255,0.1);color:#0A84FF;border:1px solid rgba(10,132,255,0.25);font-weight:700;font-size:13px;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;text-align:left;"><i class="fas fa-bell" style="margin-right:10px;"></i>Trimite Avertisment Oficial</button>' + (!u.banned ? '<button onclick="banInsiderCEO(\'' + uid + '\',\'' + safeAlias + '\')" style="width:100%;padding:15px;border-radius:14px;background:rgba(255,59,48,0.1);color:#ff3b30;border:1px solid rgba(255,59,48,0.25);font-weight:700;font-size:13px;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;text-align:left;"><i class="fas fa-ban" style="margin-right:10px;"></i>SUSPENDĂ ACCESUL (BAN)</button>' : '<button onclick="unbanInsider(\'' + uid + '\',\'' + safeAlias + '\')" style="width:100%;padding:15px;border-radius:14px;background:rgba(52,199,89,0.1);color:#34c759;border:1px solid rgba(52,199,89,0.25);font-weight:700;font-size:13px;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;text-align:left;"><i class="fas fa-unlock" style="margin-right:10px;"></i>RIDICĂ BAN</button>') + '</div><button onclick="document.getElementById(\'insider-profile-modal\').remove()" style="width:100%;padding:14px;border:none;border-radius:14px;background:transparent;color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.07);font-weight:600;font-size:13px;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;">ÎNCHIDE</button></div>';
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
        document.body.appendChild(modal);
    }).catch(function(e){ showCEOToast('Eroare: ' + e.message, 'red'); });
}

async function adjustBalanceCEO(uid, alias) {
    var val = parseInt(document.getElementById('balance-adjust-val').value);
    if (isNaN(val)||val===0) { showCEOToast('Introdu o valoare validă.', 'red'); return; }
    if (!confirm('Ajustezi balanța lui ' + alias + ' cu ' + (val>0?'+':'')+val + ' VV?')) return;
    try {
        await db.collection('users').doc(uid).update({ balance:firebase.firestore.FieldValue.increment(val) });
        addAuditEntry('💰 CEO Ajustare ' + alias + ': ' + (val>0?'+':'')+val + ' VV');
        showCEOToast('✅ Balanța ' + alias + ' ajustată cu ' + (val>0?'+':'')+val + ' VV!', 'gold');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function warnInsiderCEO(uid, alias) {
    try {
        await db.collection('inbox').add({ to:uid, from:'VVTeam', type:'official_warning', message:'⚠️ Ai primit un avertisment oficial de la VVTeam. Respectă regulamentul platformei VV. La next incident, contul va fi suspendat.', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry('⚠️ Avertisment oficial trimis lui ' + alias);
        showCEOToast('⚠️ Avertisment trimis lui ' + alias + '.', 'blue');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function banInsiderCEO(uid, alias) {
    if (!confirm('ATENȚIE: Suspendezi definitiv accesul lui ' + alias + '?\n\nAcest dispozitiv nu va mai putea accesa platforma VV.')) return;
    try {
        await db.collection('users').doc(uid).update({ banned:true, bannedAt:firebase.firestore.FieldValue.serverTimestamp() });
        await db.collection('inbox').add({ to:uid, from:'VVTeam', type:'ban_notice', message:'🚫 Contul tău VV a fost suspendat. Dacă crezi că e o eroare, contactează echipa VV.', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry('🚫 BAN aplicat lui ' + alias + ' (' + uid.substring(0,8) + ')');
        showCEOToast('🚫 ' + alias + ' suspendat.', 'red');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function unbanInsider(uid, alias) {
    if (!confirm('Ridici banul lui ' + alias + '?')) return;
    try {
        await db.collection('users').doc(uid).update({ banned:false });
        await db.collection('inbox').add({ to:uid, from:'VVTeam', type:'unban_notice', message:'✅ Accesul tău pe platforma VV a fost restaurat. Bine ai revenit!', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry('✅ Ban ridicat pentru ' + alias);
        showCEOToast('✅ Acces restaurat pentru ' + alias + '.', 'green');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}
