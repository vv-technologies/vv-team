// ================================================================
// VV TEAM — Central Command Logic
// Versiune: bulletproof · .set merge:true · VVhi integrat
// ================================================================

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyDGv4kEClO0RHCLvXVLOT-vyPHw6bsxYVc",
    authDomain: "vv-ep-beta.firebaseapp.com",
    projectId: "vv-ep-beta",
    storageBucket: "vv-ep-beta.firebasestorage.app"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let isFirstDisputeLoad = true;
let audioContext = null;
let currentFeedPhotos = [];
let currentDisputePhotos = [];
let activeGalleryArray = [];
let activeGalleryIndex = 0;

// ================================================================
// VVhi — SHADOW MODE (integrat direct, fără fișier extern)
// Colectare date antrenament AI · Anonimizat strict · Non-blocking
// ================================================================
const VVhi = (function() {
    const COLLECTION   = 'vvhi_dataset';
    let   ENABLED      = true;

    // Câmpuri PII interzise absolut
    const FORBIDDEN = [
        'agentId','uid','userId','createdBy','solverId','creatorId',
        'email','alias','name','displayName','phone',
        'gpsLat','gpsLng','lat','lng','location',
        'deviceId','imei','ip','from','to'
    ];

    // Timestamp rotunjit la oră (anti re-identificare temporală)
    function hourTimestamp() {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        return d.getTime();
    }

    // Sanitizare strictă — scoate orice câmp din lista neagră
    function sanitize(raw) {
        const clean = {};
        Object.keys(raw).forEach(k => {
            if (!FORBIDDEN.includes(k)) clean[k] = raw[k];
        });
        return clean;
    }

    // Verificare finală prin regex — dacă a scăpat ceva, abortăm
    const PII_REGEX = /\b(uid|email|alias|gpsLat|gpsLng|\blat\b|\blng\b|deviceId|imei|phone)\b/i;

    function logEntry(payload) {
        if (!ENABLED) return;

        // Fire-and-forget: setTimeout 0 = după ce fluxul principal s-a terminat
        setTimeout(async () => {
            try {
                const clean = sanitize(payload);

                const packet = {
                    mission_brief:   clean.mission_brief   || null,
                    proof_image_url: clean.proof_image_url || null,
                    ceo_decision:    clean.ceo_decision    || null,
                    reject_reason:   clean.reject_reason   || null,
                    timestamp_hour:  hourTimestamp(),
                    schema_version:  '0.1',
                    source:          'vvteam_ceo'
                };

                // Verificare finală anti-PII
                if (PII_REGEX.test(JSON.stringify(packet))) {
                    console.warn('[VVhi] ABORT — PII detectat. Salvare anulată.');
                    return;
                }

                await db.collection(COLLECTION).add(packet);
                console.log('[VVhi] ✓ Logged:', packet.ceo_decision);

            } catch(e) {
                // Eșec silențios — nu blochează NICIODATĂ panoul CEO
                console.warn('[VVhi] Non-blocking fail:', e.message);
            }
        }, 0);
    }

    return {
        logApproval(photoData) {
            logEntry({
                mission_brief:   photoData.message || null,
                proof_image_url: photoData.url     || null,
                ceo_decision:    'APPROVED',
                reject_reason:   null
            });
        },
        logRejection(photoData, reason) {
            logEntry({
                mission_brief:   photoData.message || null,
                proof_image_url: photoData.url     || null,
                ceo_decision:    'REJECTED',
                reject_reason:   reason || null
            });
        },
        toggle() {
            ENABLED = !ENABLED;
            const label = document.getElementById('vvhi-status-label');
            const dot   = document.getElementById('vvhi-dot');
            if (label) label.textContent = ENABLED ? 'ACTIV' : 'OPRIT';
            if (dot) {
                dot.style.background   = ENABLED ? '#D4AF37' : 'rgba(255,255,255,0.2)';
                dot.style.boxShadow    = ENABLED ? '0 0 6px #D4AF37' : 'none';
            }
            addAuditEntry(ENABLED ? '🧠 VVhi Shadow Mode ACTIVAT' : '⚫ VVhi Shadow Mode oprit');
            showCEOToast(ENABLED ? '🧠 VVhi: Colectare activată' : '⚫ VVhi: Colectare oprită',
                         ENABLED ? 'gold' : 'blue');
        },
        isEnabled() { return ENABLED; }
    };
})();

// ================================================================
// LIGHTBOX
// ================================================================
function openLightbox(arrayType, index) {
    activeGalleryArray = arrayType === 'feed' ? currentFeedPhotos : currentDisputePhotos;
    if (!activeGalleryArray.length) return;
    activeGalleryIndex = index;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
    document.getElementById('lightbox').style.display = 'flex';
}
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }
function lbNext(e) {
    e.stopPropagation();
    if (!activeGalleryArray.length) return;
    activeGalleryIndex = (activeGalleryIndex + 1) % activeGalleryArray.length;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
}
function lbPrev(e) {
    e.stopPropagation();
    if (!activeGalleryArray.length) return;
    activeGalleryIndex = (activeGalleryIndex - 1 + activeGalleryArray.length) % activeGalleryArray.length;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
}

// ================================================================
// AUDIO PING (Dispute alert)
// ================================================================
function playAlertSound() {
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + 0.4);
    } catch(e) {}
}

// ================================================================
// CEO TOAST (înlocuiește toate alert()-urile)
// ================================================================
function showCEOToast(msg, color = 'green') {
    document.getElementById('ceo-toast')?.remove();
    const palette = {
        green: { bg:'rgba(52,199,89,0.15)',  border:'rgba(52,199,89,0.35)',  text:'#34c759' },
        red:   { bg:'rgba(255,59,48,0.15)',  border:'rgba(255,59,48,0.35)',  text:'#ff3b30' },
        blue:  { bg:'rgba(10,132,255,0.15)', border:'rgba(10,132,255,0.35)', text:'#0A84FF' },
        gold:  { bg:'rgba(212,175,55,0.15)', border:'rgba(212,175,55,0.35)', text:'#D4AF37' }
    };
    const c = palette[color] || palette.green;
    const t = document.createElement('div');
    t.id = 'ceo-toast';
    t.style.cssText = `
        position:fixed;
        top:calc(20px + env(safe-area-inset-top,0px));
        left:50%; transform:translateX(-50%);
        z-index:999999;
        background:${c.bg};
        backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
        border:1px solid ${c.border};
        border-radius:16px;
        padding:14px 22px;
        font-size:13px; font-weight:700; color:${c.text};
        max-width:90vw; text-align:center;
        box-shadow:0 4px 24px rgba(0,0,0,0.4);
        font-family:-apple-system,sans-serif;
        white-space:nowrap;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0'; t.style.transition = 'opacity 0.3s';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

// ================================================================
// AUDIT LOG (localStorage, max 100 intrări)
// ================================================================
let auditLog = JSON.parse(localStorage.getItem('vv_audit_log') || '[]');

function addAuditEntry(action) {
    auditLog.unshift({
        ts:   Date.now(),
        action,
        time: new Date().toLocaleString('ro-RO', {
            day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit'
        })
    });
    if (auditLog.length > 100) auditLog = auditLog.slice(0, 100);
    localStorage.setItem('vv_audit_log', JSON.stringify(auditLog));
    renderAuditLog();
}

function renderAuditLog() {
    const el = document.getElementById('audit-log-body');
    if (!el) return;
    if (!auditLog.length) {
        el.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:20px;">Nicio acțiune înregistrată.</td></tr>';
        return;
    }
    el.innerHTML = auditLog.slice(0, 50).map(e =>
        `<tr>
            <td style="color:rgba(255,255,255,0.3);font-size:11px;white-space:nowrap;font-family:monospace;padding:10px 14px 10px 0;">${e.time}</td>
            <td style="font-size:13px;color:rgba(255,255,255,0.75);padding:10px 0;">${e.action}</td>
        </tr>`
    ).join('');
}

function clearAuditLog() {
    if (!confirm('Ștergi tot log-ul de audit?')) return;
    auditLog = [];
    localStorage.removeItem('vv_audit_log');
    renderAuditLog();
    showCEOToast('Log de audit șters.', 'blue');
}

// ================================================================
// LOGIN CEO — Email + Parolă cu persistence LOCAL
// ================================================================
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        firebase.auth().onAuthStateChanged(user => {
            if (user && !user.isAnonymous) {
                if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const ls = document.getElementById('login-screen');
                if (ls) {
                    ls.style.opacity = '0';
                    setTimeout(() => { ls.style.display = 'none'; initDashboard(); }, 200);
                }
            } else if (user?.isAnonymous) {
                firebase.auth().signOut();
                document.getElementById('login-screen').style.display = 'flex';
            } else {
                document.getElementById('login-screen').style.display = 'flex';
            }
        });
    });

function checkLogin() {
    const email  = document.getElementById('ceo-email').value.trim();
    const pass   = document.getElementById('ceo-pass').value.trim();
    const btn    = document.getElementById('login-btn');
    const errEl  = document.getElementById('login-error');

    if (!email || !pass) {
        errEl.textContent = 'Completează email și parolă.';
        errEl.style.display = 'block'; return;
    }

    btn.textContent = 'SE AUTENTIFICĂ...';
    btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';
    errEl.style.display = 'none';
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();

    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => firebase.auth().signInWithEmailAndPassword(email, pass))
        .then(() => {
            btn.textContent = 'BINE AI VENIT ✓';
            const ls = document.getElementById('login-screen');
            ls.style.opacity = '0';
            setTimeout(() => { ls.style.display = 'none'; initDashboard(); }, 400);
        })
        .catch(err => {
            btn.textContent = 'INTRĂ ÎN SISTEM';
            btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
            const msgs = {
                'auth/wrong-password':     'Email sau parolă incorectă.',
                'auth/user-not-found':     'Email sau parolă incorectă.',
                'auth/invalid-credential': 'Email sau parolă incorectă.',
                'auth/invalid-email':      'Email invalid.',
                'auth/too-many-requests':  'Prea multe încercări. Așteaptă 1 minut.',
                'auth/network-request-failed': 'Fără conexiune. Verifică internetul.'
            };
            errEl.textContent = msgs[err.code] || 'Eroare. Se reîncearcă...';
            errEl.style.display = 'block';
            if (!msgs[err.code]) setTimeout(checkLogin, 2000);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    ['ceo-email','ceo-pass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keypress', e => { if (e.key === 'Enter') checkLogin(); });
    });
    renderAuditLog();
});

function logoutCEO() { secureLogoutCEO(); }
function secureLogoutCEO() {
    addAuditEntry('🔐 CEO Logout securizat');
    firebase.auth().signOut().then(() => location.reload());
}

// ================================================================
// NAVIGATIE — O singură definiție, include logica map
// ================================================================
let _ceoMapLoaded = false;

function switchSection(id, element) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id + '-section')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    element?.classList.add('active');

    if (id === 'audit') renderAuditLog();
    if (id === 'map') {
        if (!_ceoMapLoaded) { _ceoMapLoaded = true; setTimeout(loadMissionMap, 200); }
        else setTimeout(() => { if (ceoMap) ceoMap.invalidateSize(); }, 150);
    }
    if (id === 'sysctl') loadSysControl();
}

// ================================================================
// INIT DASHBOARD
// ================================================================
function initDashboard() {
    loadGlobalFeed();
    loadDisputes();
    loadLeaderboard();
    loadFeedback();
    loadKeys();
    loadTalentPool();
    // GC rulează 2s după login pentru a nu bloca UI-ul
    setTimeout(runGarbageCollector, 2000);
}

// ================================================================
// GARBAGE COLLECTOR — șterge poze > 5 zile (120h) · GDPR auto-cleanup
// ================================================================
async function runGarbageCollector() {
    const TTL    = 5 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - TTL;
    try {
        const snap = await db.collection('photos')
            .where('timestamp', '<', cutoff)
            .limit(50).get();
        if (snap.empty) { console.log('[VV GC] Feed curat.'); return; }
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        addAuditEntry(`🗑️ GC: ${snap.size} poze eliminate (>5 zile)`);
        if (snap.size === 50) setTimeout(runGarbageCollector, 5 * 60 * 1000);
    } catch(e) { console.warn('[VV GC]', e.message); }
}

// ================================================================
// 1. GLOBAL INTEL FEED — 24h God Mode
// ================================================================
function loadGlobalFeed() {
    const cutoff24h = Date.now() - 86400000;

    db.collection('photos').orderBy('timestamp','desc').onSnapshot(snap => {
        const container = document.getElementById('feed-container');
        container.innerHTML = '';
        currentFeedPhotos = [];
        let count = 0;

        if (snap.empty) {
            container.innerHTML = '<div style="color:var(--text-muted);">Nicio captură în ultimele 24h.</div>';
            return;
        }

        snap.forEach((doc, idx) => {
            const d = doc.data();
            if (d.timestamp < cutoff24h) return;
            count++;
            const imgIdx = currentFeedPhotos.length;
            currentFeedPhotos.push(d.url);

            const date    = new Date(d.timestamp).toLocaleString('ro-RO',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'});
            const gpsStr  = d.gpsLat ? `${d.gpsLat.toFixed(4)}, ${d.gpsLng.toFixed(4)}` : 'GPS N/A';
            const flagHtml = d.flagged ? '<div class="flag-badge"><i class="fas fa-exclamation-triangle"></i> ALERTAT</div>' : '';
            const safeAlias = (d.alias||'INSIDER').replace(/'/g,"\\'");

            const card = document.createElement('div');
            card.className = 'photo-card';
            card.innerHTML = `
                <div style="position:relative;">
                    <img src="${d.url}" class="photo-img" onclick="openLightbox('feed',${imgIdx})" title="Click Zoom">
                    <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:8px 12px;">
                        <div style="font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;">VV PROOF</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.7);">📍 ${gpsStr}</div>
                    </div>
                </div>
                <div class="photo-info">
                    ${flagHtml}
                    <div class="photo-msg">"${d.message||'Captură VV'}"</div>
                    <div class="photo-meta">
                        <span><i class="fas fa-clock"></i> ${date}</span>
                        <span style="cursor:pointer;color:var(--vv-blue);" onclick="openInsiderProfile('${d.agentId||''}','${safeAlias}')">${(d.alias||'INSIDER').substring(0,8)} ›</span>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:12px;">
                        <button onclick="approvePhotoCEO('${doc.id}','${d.agentId||''}')"
                            style="flex:1;padding:14px;border:none;border-radius:12px;background:rgba(52,199,89,0.15);color:#34c759;border:1px solid rgba(52,199,89,0.3);font-weight:800;font-size:13px;cursor:pointer;min-height:44px;">
                            ✓ APROBĂ
                        </button>
                        <button onclick="rejectWithDSA('${doc.id}','${d.agentId||''}')"
                            style="flex:1;padding:14px;border:none;border-radius:12px;background:rgba(255,59,48,0.15);color:#ff3b30;border:1px solid rgba(255,59,48,0.3);font-weight:800;font-size:13px;cursor:pointer;min-height:44px;">
                            ✕ RESPINGE
                        </button>
                    </div>
                </div>`;
            container.appendChild(card);
        });

        if (!count) container.innerHTML = '<div style="color:var(--text-muted);">Nicio captură în ultimele 24h.</div>';
    });
}

// APROBARE — + VVhi hook
async function approvePhotoCEO(photoId, agentId) {
    try {
        const snap    = await db.collection('photos').doc(photoId).get();
        const data    = snap.data() || {};
        const reward  = data.reward || 0;
        const alias   = data.alias  || 'INSIDER';

        if (reward > 0 && agentId) {
            await db.collection('users').doc(agentId).update({
                balance: firebase.firestore.FieldValue.increment(reward)
            });
        }
        await db.collection('photos').doc(photoId).update({ approved:true, flagged:false });
        addAuditEntry(`✅ Dovadă aprobată — ${alias} +${reward} VV`);
        showCEOToast(`✅ Aprobat! ${alias} +${reward} VV.`, 'green');

        // VVhi — fire-and-forget, non-blocking
        VVhi.logApproval(data);

    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================================================================
// DSA REJECT MODAL — 6 motive + câmp liber
// ================================================================
let _selectedDSAReason = null;

function rejectWithDSA(photoId, agentId) {
    _selectedDSAReason = null;
    document.getElementById('dsa-reject-modal')?.remove();

    const reasons = [
        { code:'blur',         label:'📷 Poză neclară / calitate insuficientă' },
        { code:'location',     label:'📍 Nu se confirmă locația din GPS' },
        { code:'inappropriate',label:'🚫 Conținut inadecvat sau ofensator' },
        { code:'fake',         label:'⚠️ Dovadă manipulată sau falsificată' },
        { code:'duplicate',    label:'🔁 Duplicat — poză deja trimisă' },
        { code:'other',        label:'❓ Alt motiv' }
    ];

    const modal = document.createElement('div');
    modal.id = 'dsa-reject-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);display:flex;align-items:flex-end;justify-content:center;';

    const btnsList = reasons.map(r =>
        `<button onclick="selectDSAReason('${r.code}',this)" data-code="${r.code}"
            style="padding:14px 16px;border-radius:14px;text-align:left;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;width:100%;">
            ${r.label}
        </button>`
    ).join('');

    modal.innerHTML = `
        <div style="background:rgba(10,10,16,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:28px 28px 0 0;padding:28px 22px calc(36px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;overflow-y:auto;max-height:85vh;">
            <div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 22px;"></div>
            <div style="font-size:10px;color:rgba(255,59,48,0.7);letter-spacing:3px;font-weight:700;margin-bottom:8px;">MOTIVUL RESPINGERII — DSA COMPLIANT</div>
            <div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:18px;">Selectează motivul</div>
            <div id="dsa-reason-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">${btnsList}</div>
            <textarea id="dsa-custom-reason" placeholder="Detalii suplimentare (opțional)..."
                style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;color:#fff;font-size:13px;font-family:-apple-system,sans-serif;outline:none;resize:none;height:70px;margin-bottom:12px;"></textarea>
            <button id="dsa-confirm-btn" onclick="confirmDSAReject('${photoId}','${agentId}')"
                style="width:100%;padding:16px;border:none;border-radius:16px;background:rgba(255,59,48,0.15);color:#ff3b30;border:1px solid rgba(255,59,48,0.3);font-weight:800;font-size:14px;cursor:pointer;min-height:52px;font-family:-apple-system,sans-serif;opacity:0.5;pointer-events:none;">
                RESPINGE CU NOTIFICARE DSA
            </button>
            <button onclick="document.getElementById('dsa-reject-modal').remove()"
                style="width:100%;padding:14px;border:none;border-radius:14px;background:transparent;color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.07);font-weight:600;font-size:13px;cursor:pointer;margin-top:8px;min-height:44px;font-family:-apple-system,sans-serif;">
                ANULEAZĂ
            </button>
        </div>`;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function selectDSAReason(code, btn) {
    _selectedDSAReason = code;
    document.querySelectorAll('#dsa-reason-list button').forEach(b => {
        b.style.background   = 'rgba(255,255,255,0.04)';
        b.style.borderColor  = 'rgba(255,255,255,0.08)';
        b.style.color        = 'rgba(255,255,255,0.7)';
    });
    btn.style.background  = 'rgba(255,59,48,0.12)';
    btn.style.borderColor = 'rgba(255,59,48,0.4)';
    btn.style.color       = '#ff3b30';
    const cb = document.getElementById('dsa-confirm-btn');
    cb.style.opacity = '1'; cb.style.pointerEvents = 'auto';
}

// RESPINGERE — + VVhi hook
async function confirmDSAReject(photoId, agentId) {
    if (!_selectedDSAReason) return;
    const custom = document.getElementById('dsa-custom-reason').value.trim();
    const labels = { blur:'Poză neclară', location:'GPS neconfirmat', inappropriate:'Conținut inadecvat', fake:'Dovadă falsificată', duplicate:'Duplicat', other:'Alt motiv' };
    const reason = labels[_selectedDSAReason] + (custom ? ': ' + custom : '');

    try {
        // Citim datele foto pentru VVhi ÎNAINTE de update
        const photoSnap = await db.collection('photos').doc(photoId).get();
        const photoData = photoSnap.exists ? photoSnap.data() : {};

        await db.collection('photos').doc(photoId).update({ approved:false, flagged:true, rejectReason:reason });
        await db.collection('inbox').add({
            to: agentId, from: 'VVTeam', type: 'rejection_dsa',
            message: `❌ Dovada ta a fost respinsă. Motiv: ${reason}. Poți retrimite o dovadă nouă.`,
            read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        addAuditEntry(`❌ Dovadă respinsă (DSA) — ${reason}`);
        document.getElementById('dsa-reject-modal')?.remove();
        showCEOToast('❌ Respins. Insider notificat (DSA).', 'red');

        // VVhi — fire-and-forget, non-blocking
        VVhi.logRejection(photoData, reason);

    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================================================================
// 2. DISPUTE ESCROW
// ================================================================
function loadDisputes() {
    db.collection('missions').where('status','==','disputed').onSnapshot(snap => {
        const container = document.getElementById('disputes-container');
        const badge     = document.getElementById('dispute-badge');
        container.innerHTML = ''; currentDisputePhotos = [];

        if (snap.size > 0) { badge.style.display = 'inline-block'; badge.innerText = snap.size; }
        else { badge.style.display = 'none'; container.innerHTML = '<div style="color:var(--text-muted);">Nicio dispută activă.</div>'; }

        if (!isFirstDisputeLoad) {
            let hasNew = false;
            snap.docChanges().forEach(c => { if (c.type === 'added') hasNew = true; });
            if (hasNew) playAlertSound();
        }
        isFirstDisputeLoad = false;

        snap.forEach(doc => {
            const m   = doc.data();
            const idx = currentDisputePhotos.length;
            currentDisputePhotos.push(m.photoUrl);
            container.innerHTML += `
                <div class="photo-card" style="border-color:var(--danger);">
                    <img src="${m.photoUrl}" class="photo-img" onclick="openLightbox('dispute',${idx})">
                    <div class="photo-info">
                        <div class="flag-badge">DISPUTĂ DESCHISĂ</div>
                        <div class="photo-msg" style="color:var(--text-muted);font-size:12px;">Cerere: <span style="color:#fff;">${m.description}</span></div>
                        <div class="photo-meta" style="margin-top:10px;"><span>Recompensă: <strong style="color:var(--gold);">${m.reward} VV</strong></span></div>
                        <div class="action-row">
                            <button class="btn-approve" onclick="resolveDispute('${doc.id}','${m.solverId}',${m.reward},true)">POZĂ OK</button>
                            <button class="btn-reject"  onclick="resolveDispute('${doc.id}','${m.creatorId}',${m.reward},false)">FAKE (Retur BANI)</button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

async function resolveDispute(missionId, userId, amount, approve) {
    if (!confirm(approve ? 'Plătești AGENTULUI?' : 'Returnezi banii CLIENTULUI?')) return;
    try {
        await db.collection('users').doc(userId).update({ balance: firebase.firestore.FieldValue.increment(amount) });
        await db.collection('missions').doc(missionId).update({ status: approve ? 'completed' : 'cancelled_fraud' });
        addAuditEntry(`⚖️ Dispută: ${approve ? 'Aprobat' : 'Fraud'} — ${amount} VV`);
        showCEOToast('Dispută rezolvată.', approve ? 'green' : 'red');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================================================================
// 3. LEADERBOARD — click pe row → profil detaliat
// ================================================================
function loadLeaderboard() {
    db.collection('users').onSnapshot(snap => {
        let users = [], totalBank = 0;
        snap.forEach(doc => { const d = { ...doc.data(), uid: doc.id }; users.push(d); totalBank += d.balance || 0; });
        document.getElementById('total-vv-bank').textContent = totalBank.toLocaleString() + ' VV';
        users.sort((a,b) => (b.balance||0) - (a.balance||0));

        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        if (!users.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Niciun agent.</td></tr>'; return; }

        users.forEach((u,i) => {
            const rank = i===0 ? '<span class="rank-gold">#1</span>' : i===1 ? '<span style="color:#C0C0C0;font-weight:bold;">#2</span>' : i===2 ? '<span style="color:#CD7F32;font-weight:bold;">#3</span>' : `#${i+1}`;
            const avg  = u.totalRatings > 0 ? (u.ratingSum/u.totalRatings).toFixed(1) : '—';
            const statusHtml = u.banned
                ? '<span style="color:#ff3b30;font-size:11px;font-weight:700;">🚫 BANAT</span>'
                : (u.balance||0) >= 1000
                    ? '<span class="badge-onyx"><i class="fas fa-check-circle"></i> ELIGIBIL ONYX</span>'
                    : '<span style="color:var(--text-muted);font-size:11px;">ÎN PROGRES</span>';
            const sa = (u.alias||'Agent').replace(/'/g,"\\'");
            tbody.innerHTML += `
                <tr style="cursor:pointer;" onclick="openInsiderProfile('${u.uid}','${sa}')">
                    <td>${rank}</td>
                    <td><strong style="color:${u.banned?'#ff3b30':'#fff'};">${u.alias||'Agent'}</strong> <span style="color:#555;font-size:10px;">(${u.uid.substring(0,5).toUpperCase()})</span></td>
                    <td style="color:var(--safe-green);font-family:monospace;font-size:16px;">${u.balance||0} VV</td>
                    <td>
                        <div style="display:flex;flex-direction:column;gap:3px;">
                            ${statusHtml}
                            <span style="font-size:10px;color:rgba(212,175,55,0.5);">★ ${avg} (${u.totalRatings||0} eval.)</span>
                        </div>
                    </td>
                </tr>`;
        });
    });
}

// ================================================================
// 4. FEEDBACK & SUPORT
// ================================================================
function loadFeedback() {
    db.collection('feedback').orderBy('createdAt','desc').onSnapshot(snap => {
        const tbody = document.getElementById('feedback-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (snap.empty) {
            tbody.innerHTML = '<tr><td><strong style="color:#fff;">Sistem Beta</strong></td><td style="color:rgba(255,255,255,0.6);">Niciun mesaj încă.</td><td><span style="color:var(--safe-green);font-size:11px;font-weight:bold;">ONLINE</span></td><td>—</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const d    = doc.data();
            const date = d.createdAt?.toDate().toLocaleString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) || '—';
            const sa   = (d.alias||'INSIDER').replace(/'/g,"\\'");
            tbody.innerHTML += `
                <tr>
                    <td>
                        <div style="font-weight:700;color:#fff;">${d.alias||'INSIDER'}</div>
                        <div style="font-size:10px;color:var(--text-muted);font-family:monospace;">${(d.uid||'').substring(0,8)}</div>
                        <div style="font-size:10px;color:var(--text-muted);">${date}</div>
                    </td>
                    <td style="color:rgba(255,255,255,0.75);max-width:300px;">${d.message||'—'}</td>
                    <td><span style="color:${d.resolved?'var(--text-muted)':'var(--safe-green)'};font-size:11px;font-weight:bold;">${d.resolved?'REZOLVAT':'NOU'}</span></td>
                    <td>${!d.resolved ? `<button onclick="markFeedbackResolved('${doc.id}','${sa}','${d.uid||''}')" class="btn-reply">✓ REZOLVAT</button>` : '—'}</td>
                </tr>`;
        });
    });
}

async function markFeedbackResolved(docId, alias, uid) {
    try {
        await db.collection('feedback').doc(docId).update({ resolved: true });
        if (uid) {
            await db.collection('inbox').add({
                to: uid, from: 'VVTeam', type: 'support_resolved',
                message: '✅ Mesajul tău de suport a fost preluat și rezolvat. Mulțumim!',
                read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        addAuditEntry(`📩 Suport rezolvat — ${alias}`);
        showCEOToast('✅ Marcat rezolvat. Insider notificat.', 'green');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================================================================
// WIPE DATABASE
// ================================================================
async function deleteAllBetaData() {
    if (prompt('Scrie RESET pentru a confirma ștergerea TOTALĂ:') !== 'RESET') {
        showCEOToast('Procedură anulată.', 'blue'); return;
    }
    try {
        const [p, m] = await Promise.all([db.collection('photos').get(), db.collection('missions').get()]);
        const batch  = db.batch();
        p.forEach(d => batch.delete(d.ref));
        m.forEach(d => batch.delete(d.ref));
        await batch.commit();
        addAuditEntry('🗑️ CEO RESET — toate datele Beta șterse');
        showCEOToast('Sistem curățat complet!', 'gold');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================================================================
// TALENT POOL — mini-CRM cu status pipeline + note interne
// ================================================================
const TALENT_STATUS = {
    new:       { label:'NEW',       color:'rgba(255,255,255,0.4)', bg:'rgba(255,255,255,0.06)', border:'rgba(255,255,255,0.12)' },
    contacted: { label:'CONTACTED', color:'#0A84FF',               bg:'rgba(10,132,255,0.08)', border:'rgba(10,132,255,0.25)'  },
    hired:     { label:'HIRED ✓',   color:'#34c759',               bg:'rgba(52,199,89,0.08)',  border:'rgba(52,199,89,0.25)'   },
    rejected:  { label:'REJECTED',  color:'#ff3b30',               bg:'rgba(255,59,48,0.06)',  border:'rgba(255,59,48,0.2)'    }
};

function loadTalentPool() {
    db.collection('talent_pool').orderBy('createdAt','desc').onSnapshot(snap => {
        const container = document.getElementById('talent-container');
        if (!container) return;
        container.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<div style="color:var(--text-muted);padding:20px;">Nicio aplicație încă.</div>';
            return;
        }

        snap.forEach(doc => {
            const d      = doc.data();
            const date   = d.createdAt?.toDate().toLocaleString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) || '—';
            const status = d.status || 'new';
            const st     = TALENT_STATUS[status] || TALENT_STATUS.new;

            const card = document.createElement('div');
            card.style.cssText = `background:var(--glass-bg);border:1px solid ${st.border};border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:10px;transition:border-color 0.3s;`;

            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <span style="font-size:15px;font-weight:900;color:#fff;">${d.alias||'INSIDER'}</span>
                    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                        <span style="font-size:9px;color:${st.color};background:${st.bg};border:1px solid ${st.border};padding:4px 10px;border-radius:8px;font-weight:800;letter-spacing:1px;">${st.label}</span>
                        <span style="font-size:10px;color:var(--text-muted);">${date}</span>
                    </div>
                </div>
                <div style="font-size:13px;color:rgba(255,255,255,0.65);"><strong style="color:rgba(255,255,255,0.4);">Skills:</strong> ${d.skill||'—'}</div>
                ${d.portfolio && d.portfolio!=='N/A' ? `<a href="${d.portfolio}" target="_blank" style="font-size:12px;color:var(--vv-blue);text-decoration:none;font-weight:600;">🔗 ${d.portfolio}</a>` : ''}
                <div style="background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.12);border-radius:12px;padding:12px;">
                    <div style="font-size:9px;color:rgba(212,175,55,0.5);letter-spacing:2px;font-weight:700;margin-bottom:6px;">🔒 NOTE INTERNE CEO</div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>`;

            // Textarea note (evităm string concatenare cu event handlers)
            const notesBox = card.querySelector('[style*="rgba(212,175,55,0.04)"]');
            const ta = document.createElement('textarea');
            ta.placeholder = 'Ex: I-am scris pe Insta, pare bun pe design...';
            ta.style.cssText = 'width:100%;background:transparent;border:none;color:rgba(255,255,255,0.7);font-size:12px;font-family:-apple-system,sans-serif;outline:none;resize:none;min-height:56px;line-height:1.5;';
            ta.value = d.internalNotes || '';
            ta.dataset.docid = doc.id;
            ta.addEventListener('blur', () => saveTalentNote(doc.id, ta.value));
            notesBox.appendChild(ta);

            // Butoane pipeline
            const btnGrid = card.querySelector('[style*="grid-template-columns"]');
            const makeBtn = (label, target, color, bg, border) => {
                const btn = document.createElement('button');
                btn.textContent = label;
                btn.style.cssText = `padding:11px;border:none;border-radius:10px;background:${bg};color:${color};border:1px solid ${border};font-weight:700;font-size:11px;cursor:pointer;min-height:44px;font-family:-apple-system,sans-serif;`;
                btn.addEventListener('click', () => setTalentStatus(doc.id, target, d.alias||'INSIDER'));
                return btn;
            };
            if (status !== 'contacted') btnGrid.appendChild(makeBtn('📞 CONTACTAT','contacted','#0A84FF','rgba(10,132,255,0.12)','rgba(10,132,255,0.25)'));
            else btnGrid.appendChild(document.createElement('div'));
            if (status !== 'hired')     btnGrid.appendChild(makeBtn('✅ ANGAJAT','hired','#34c759','rgba(52,199,89,0.1)','rgba(52,199,89,0.2)'));
            else btnGrid.appendChild(document.createElement('div'));
            if (status !== 'new')       btnGrid.appendChild(makeBtn('↺ RESET','new','rgba(255,255,255,0.4)','rgba(255,255,255,0.05)','rgba(255,255,255,0.1)'));
            else btnGrid.appendChild(document.createElement('div'));
            if (status !== 'rejected')  btnGrid.appendChild(makeBtn('✕ RESPINS','rejected','#ff3b30','rgba(255,59,48,0.08)','rgba(255,59,48,0.18)'));
            else btnGrid.appendChild(document.createElement('div'));

            container.appendChild(card);
        });
    });
}

async function saveTalentNote(docId, note) {
    try { await db.collection('talent_pool').doc(docId).update({ internalNotes: note }); }
    catch(e) { console.warn('Nota:', e.message); }
}

async function setTalentStatus(docId, status, alias) {
    const labels = { new:'NEW', contacted:'CONTACTAT', hired:'ANGAJAT', rejected:'RESPINS' };
    try {
        await db.collection('talent_pool').doc(docId).update({ status });
        addAuditEntry(`👤 Talent ${alias} → ${labels[status]||status}`);
        showCEOToast(`Talent: ${alias} → ${labels[status]}`, status==='hired'?'green':status==='rejected'?'red':'blue');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}
async function updateTalentStatus(d, s, a) { await setTalentStatus(d, s, a); }

// ================================================================
// 5. CHEI BETA — dashboard + generare + toggle
// ================================================================
function loadKeys() {
    db.collection('access_keys').orderBy('createdAt','desc').onSnapshot(snap => {
        const list = document.getElementById('keys-list');
        const dash = document.getElementById('keys-dashboard');
        if (!list) return;
        let total = 0, active = 0, userGen = 0;
        list.innerHTML = '';

        snap.forEach(doc => {
            const d = doc.data(); total++;
            if (d.active)       active++;
            if (d.generatedBy)  userGen++;
            const date = d.createdAt?.toDate().toLocaleString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) || '—';
            const src  = d.generatedBy ? `<span style="font-size:10px;color:rgba(255,255,255,0.3);">de ${d.generatedByAlias||'INSIDER'}</span>` : `<span style="font-size:10px;color:rgba(255,255,255,0.3);">CEO</span>`;
            list.innerHTML += `
                <div class="key-item" style="flex-wrap:wrap;gap:8px;">
                    <div style="display:flex;flex-direction:column;gap:2px;">
                        <span style="font-family:monospace;font-size:15px;letter-spacing:2px;">${d.key}</span>
                        <div style="display:flex;gap:8px;align-items:center;">${src}<span style="font-size:10px;color:rgba(255,255,255,0.2);">${date}</span></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
                        <span style="font-size:11px;font-weight:700;color:${d.active?'var(--safe-green)':'#ff3b30'};">${d.active?'ACTIV':'DEZACTIVAT'}</span>
                        <button onclick="toggleKeyCEO('${doc.id}',${d.active},'${d.key}')"
                            style="background:${d.active?'rgba(255,59,48,0.12)':'rgba(52,199,89,0.12)'};border:1px solid ${d.active?'rgba(255,59,48,0.25)':'rgba(52,199,89,0.25)'};color:${d.active?'#ff3b30':'#34c759'};padding:8px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;min-height:44px;">
                            ${d.active?'REVOKE':'ACTIVEAZĂ'}
                        </button>
                    </div>
                </div>`;
        });

        if (dash) dash.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px;">
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#fff;">${total}</div><div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:2px;">TOTAL CHEI</div></div>
                <div style="background:rgba(52,199,89,0.06);border:1px solid rgba(52,199,89,0.2);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#34c759;">${active}</div><div style="font-size:10px;color:rgba(52,199,89,0.5);letter-spacing:1px;margin-top:2px;">ACTIVE</div></div>
                <div style="background:rgba(10,132,255,0.06);border:1px solid rgba(10,132,255,0.2);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#0A84FF;">${userGen}</div><div style="font-size:10px;color:rgba(10,132,255,0.5);letter-spacing:1px;margin-top:2px;">DE INSIDERI</div></div>
                <div style="background:rgba(255,149,0,0.06);border:1px solid rgba(255,149,0,0.2);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#ff9500;">${total-active}</div><div style="font-size:10px;color:rgba(255,149,0,0.5);letter-spacing:1px;margin-top:2px;">REVOCATE</div></div>
            </div>`;
    });
}

async function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)];
    try {
        await db.collection('access_keys').add({ key, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry(`🔑 CEO a generat cheia: ${key}`);
        showCEOToast(`🔑 Cheie generată: ${key}`, 'gold');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function toggleKey(docId, cur) { await toggleKeyCEO(docId, cur, '—'); }
async function toggleKeyCEO(docId, cur, keyCode) {
    try {
        await db.collection('access_keys').doc(docId).update({ active: !cur });
        const action = cur ? 'REVOCATĂ' : 'ACTIVATĂ';
        addAuditEntry(`🔑 Cheie ${keyCode} ${action}`);
        showCEOToast(`Cheie ${keyCode} ${action.toLowerCase()}.`, cur ? 'red' : 'green');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================================================================
// PROFIL INSIDER DETALIAT — stele, misiuni, balanță, ban
// ================================================================
function openInsiderProfile(uid, alias) {
    if (!uid) { showCEOToast('UID lipsă.', 'red'); return; }
    db.collection('users').doc(uid).get().then(doc => {
        if (!doc.exists) { showCEOToast('Insider negăsit.', 'red'); return; }
        const u  = doc.data();
        document.getElementById('insider-profile-modal')?.remove();

        const avg      = u.totalRatings > 0 ? (u.ratingSum/u.totalRatings).toFixed(1) : '—';
        const stars    = u.totalRatings > 0
            ? [1,2,3,4,5].map(i => `<span style="color:${i<=Math.round(u.ratingSum/u.totalRatings)?'#D4AF37':'rgba(255,255,255,0.15)'};font-size:20px;">★</span>`).join('')
            : '<span style="color:rgba(255,255,255,0.3);font-size:12px;">Nicio evaluare</span>';
        const sa       = (u.alias||alias||'INSIDER').replace(/'/g,"\\'");

        const modal = document.createElement('div');
        modal.id = 'insider-profile-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);display:flex;align-items:flex-end;justify-content:center;';
        modal.innerHTML = `
            <div style="background:rgba(10,10,16,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:28px 28px 0 0;padding:28px 22px calc(40px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;overflow-y:auto;max-height:90vh;">
                <div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 22px;"></div>
                <div style="font-size:10px;color:rgba(212,175,55,0.6);letter-spacing:3px;font-weight:700;margin-bottom:6px;">PROFIL INSIDER</div>
                <div style="font-size:24px;font-weight:900;color:${u.banned?'#ff3b30':'#fff'};margin-bottom:20px;">${u.alias||alias||'INSIDER'}${u.banned?' 🚫':''}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                    <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);border-radius:14px;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#D4AF37;">${u.balance||0}</div><div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:2px;">VV COINS</div></div>
                    <div style="background:rgba(52,199,89,0.06);border:1px solid rgba(52,199,89,0.15);border-radius:14px;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#34c759;">${u.totalRatings||0}</div><div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:2px;">MISIUNI</div></div>
                </div>
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;margin-bottom:14px;text-align:center;">
                    <div style="margin-bottom:6px;">${stars}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.3);">Media: <strong style="color:#fff;">${avg}</strong> stele · ${u.totalRatings||0} evaluări</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;margin-bottom:16px;">
                    <div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:4px;">DEVICE / UID</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);font-family:monospace;word-break:break-all;">${uid}</div>
                </div>
                <div style="background:rgba(212,175,55,0.05);border:1px solid rgba(212,175,55,0.15);border-radius:16px;padding:16px;margin-bottom:12px;">
                    <div style="font-size:10px;color:rgba(212,175,55,0.55);letter-spacing:2px;margin-bottom:10px;">CEO OVERRIDE — AJUSTARE BALANȚĂ</div>
                    <div style="display:flex;gap:8px;">
                        <input id="balance-adjust-val" type="number" placeholder="±VV (ex: 50 sau -20)"
                            style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:12px 14px;color:#fff;font-size:14px;outline:none;font-family:monospace;min-height:44px;">
                        <button onclick="adjustBalanceCEO('${uid}','${sa}')"
                            style="padding:12px 16px;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;min-height:44px;font-family:-apple-system,sans-serif;">
                            APLICĂ
                        </button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">
                    <button onclick="warnInsiderCEO('${uid}','${sa}')"
                        style="width:100%;padding:15px;border-radius:14px;background:rgba(10,132,255,0.1);color:#0A84FF;border:1px solid rgba(10,132,255,0.25);font-weight:700;font-size:13px;cursor:pointer;min-height:44px;text-align:left;">
                        <i class="fas fa-bell" style="margin-right:10px;"></i>Trimite Avertisment Oficial
                    </button>
                    ${!u.banned
                        ? `<button onclick="banInsiderCEO('${uid}','${sa}')"
                            style="width:100%;padding:15px;border-radius:14px;background:rgba(255,59,48,0.1);color:#ff3b30;border:1px solid rgba(255,59,48,0.25);font-weight:700;font-size:13px;cursor:pointer;min-height:44px;text-align:left;">
                            <i class="fas fa-ban" style="margin-right:10px;"></i>SUSPENDĂ ACCESUL (BAN)
                           </button>`
                        : `<button onclick="unbanInsider('${uid}','${sa}')"
                            style="width:100%;padding:15px;border-radius:14px;background:rgba(52,199,89,0.1);color:#34c759;border:1px solid rgba(52,199,89,0.25);font-weight:700;font-size:13px;cursor:pointer;min-height:44px;text-align:left;">
                            <i class="fas fa-unlock" style="margin-right:10px;"></i>RIDICĂ BAN
                           </button>`
                    }
                </div>
                <button onclick="document.getElementById('insider-profile-modal').remove()"
                    style="width:100%;padding:14px;border:none;border-radius:14px;background:transparent;color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.07);font-weight:600;font-size:13px;cursor:pointer;min-height:44px;">
                    ÎNCHIDE
                </button>
            </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }).catch(e => showCEOToast('Eroare: ' + e.message, 'red'));
}

async function adjustBalanceCEO(uid, alias) {
    const val = parseInt(document.getElementById('balance-adjust-val').value);
    if (isNaN(val) || !val) { showCEOToast('Introdu o valoare validă.', 'red'); return; }
    if (!confirm(`Ajustezi balanța lui ${alias} cu ${val>0?'+':''}${val} VV?`)) return;
    try {
        await db.collection('users').doc(uid).update({ balance: firebase.firestore.FieldValue.increment(val) });
        addAuditEntry(`💰 Ajustare ${alias}: ${val>0?'+':''}${val} VV`);
        showCEOToast(`✅ ${alias} ajustat cu ${val>0?'+':''}${val} VV!`, 'gold');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function warnInsiderCEO(uid, alias) {
    try {
        await db.collection('inbox').add({ to:uid, from:'VVTeam', type:'official_warning', message:'⚠️ Ai primit un avertisment oficial de la VVTeam. Respectă regulamentul. La next incident contul va fi suspendat.', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry(`⚠️ Avertisment trimis lui ${alias}`);
        showCEOToast(`⚠️ Avertisment trimis lui ${alias}.`, 'blue');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function banInsiderCEO(uid, alias) {
    if (!confirm(`ATENȚIE: Suspendezi definitiv accesul lui ${alias}?`)) return;
    try {
        await db.collection('users').doc(uid).update({ banned:true, bannedAt:firebase.firestore.FieldValue.serverTimestamp() });
        await db.collection('inbox').add({ to:uid, from:'VVTeam', type:'ban_notice', message:'🚫 Contul tău VV a fost suspendat. Contactează echipa VV dacă crezi că e o eroare.', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry(`🚫 BAN: ${alias} (${uid.substring(0,8)})`);
        showCEOToast(`🚫 ${alias} suspendat.`, 'red');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function unbanInsider(uid, alias) {
    if (!confirm(`Ridici banul lui ${alias}?`)) return;
    try {
        await db.collection('users').doc(uid).update({ banned:false });
        await db.collection('inbox').add({ to:uid, from:'VVTeam', type:'unban_notice', message:'✅ Accesul tău pe platforma VV a fost restaurat. Bine ai revenit!', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        addAuditEntry(`✅ Ban ridicat pentru ${alias}`);
        showCEOToast(`✅ Acces restaurat pentru ${alias}.`, 'green');
        document.getElementById('insider-profile-modal')?.remove();
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

// ================================================================
// CEO MAP — Harta misiuni live (God Mode · Read-Only)
// ================================================================
let ceoMap     = null;
let ceoMarkers = {};

function loadMissionMap() {
    if (!ceoMap) {
        ceoMap = L.map('ceo-map', { center:[44.4325,26.1038], zoom:13, attributionControl:false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(ceoMap);
    }

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayTs    = todayStart.getTime();

    db.collection('missions').onSnapshot(snap => {
        Object.values(ceoMarkers).forEach(m => { try { ceoMap.removeLayer(m); } catch(e) {} });
        ceoMarkers = {};

        let open = 0, completed = 0, vvCirc = 0, todayCount = 0;
        const activeMissions = [];
        const listEl = document.getElementById('ceo-missions-list');
        if (listEl) listEl.innerHTML = '';

        snap.forEach(doc => {
            const m      = doc.data();
            const isToday = m.createdAt && m.createdAt.toMillis() >= todayTs;
            if (isToday)             todayCount++;
            if (m.status === 'open') { open++; activeMissions.push({ id:doc.id, data:m }); }
            if (m.status === 'completed') { completed++; vvCirc += m.reward||0; }
            if (!m.lat || !m.lng) return;

            const color  = m.status==='open' ? '#34c759' : m.status==='completed' ? '#0A84FF' : '#ff9500';
            const icon   = L.divIcon({ className:'', html:`<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 8px ${color};"></div>`, iconSize:[12,12], iconAnchor:[6,6] });
            const marker = L.marker([m.lat, m.lng], { icon })
                .bindPopup(`<div style="background:#0a0a0c;color:#fff;padding:10px;border-radius:10px;min-width:180px;"><div style="font-size:10px;color:${color};letter-spacing:2px;font-weight:700;margin-bottom:4px;">${(m.status||'').toUpperCase()}</div><div style="font-size:13px;font-weight:700;margin-bottom:4px;">${m.description||'Misiune'}</div><div style="font-size:12px;color:rgba(255,255,255,0.5);">💰 ${m.reward||0} VV</div></div>`, { className:'ceo-popup' })
                .addTo(ceoMap);
            ceoMarkers[doc.id] = marker;
        });

        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        setEl('mission-count-today',  todayCount);
        setEl('stat-open',            open);
        setEl('stat-completed',       completed);
        setEl('stat-vv-circulated',   vvCirc + ' VV');

        if (listEl) {
            if (!activeMissions.length) {
                listEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px;">Nicio misiune deschisă acum.</div>';
            } else {
                activeMissions.slice(0,10).forEach(({ data:m }) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(52,199,89,0.05);border:1px solid rgba(52,199,89,0.12);border-radius:12px;cursor:pointer;';
                    row.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:#34c759;box-shadow:0 0 6px #34c759;flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#fff;">${m.description||'Misiune'}</div><div style="font-size:11px;color:rgba(255,255,255,0.35);">📍 ${m.lat?m.lat.toFixed(4)+', '+m.lng.toFixed(4):'GPS N/A'}</div></div><div style="font-size:13px;font-weight:800;color:#D4AF37;">${m.reward||0} VV</div>`;
                    if (m.lat && m.lng) row.addEventListener('click', () => ceoMap.flyTo([m.lat,m.lng],16,{duration:1}));
                    listEl.appendChild(row);
                });
            }
        }
        setTimeout(() => { if (ceoMap) ceoMap.invalidateSize(); }, 100);
    });
}

// ================================================================
// SYSTEM CONTROL — Remote Config · .set merge:true (bulletproof)
// ================================================================
let _maintenanceActive = false;

function loadSysControl() {
    // .onSnapshot cu merge:true — nu dă eroare dacă documentul nu există
    db.collection('system').doc('app_config').onSnapshot(doc => {
        if (!doc.exists) {
            // Prima rulare: cream documentul cu valorile default
            db.collection('system').doc('app_config').set({
                version:        '1.0.0',
                forceUpdate:    false,
                silentUpdate:   false,
                maintenanceMode:false,
                updateMessage:  '',
                updateType:     'soft',
                lastUpdated:    firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(e => console.warn('[SysCtl] Init:', e.message));
            return;
        }

        const cfg = doc.data();
        _maintenanceActive = cfg.maintenanceMode || false;

        const vEl = document.getElementById('sysctl-current-version');
        if (vEl) vEl.textContent = cfg.version || '1.0.0';

        const dEl = document.getElementById('sysctl-version-date');
        if (dEl && cfg.lastUpdated) {
            dEl.textContent = 'Ultima: ' + cfg.lastUpdated.toDate().toLocaleString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
        }

        updateMaintenanceUI(_maintenanceActive);

        // Auto-completează versiunea next (+0.0.1)
        const vInput = document.getElementById('sysctl-new-version');
        if (vInput && !vInput.value && cfg.version) {
            const parts = cfg.version.split('.');
            if (parts.length === 3) { parts[2] = String((parseInt(parts[2])||0)+1); vInput.value = parts.join('.'); }
        }
    });
    loadUpdateHistory();
}

function updateMaintenanceUI(active) {
    const label  = document.getElementById('sysctl-maintenance-label');
    const toggle = document.getElementById('sysctl-maintenance-toggle');
    const knob   = document.getElementById('sysctl-maintenance-knob');
    if (label)  { label.textContent = active ? 'ACTIV' : 'INACTIV'; label.style.color = active ? '#ff9500' : 'rgba(255,255,255,0.6)'; }
    if (toggle) { toggle.style.background = active ? 'rgba(255,149,0,0.3)' : 'rgba(255,255,255,0.1)'; toggle.style.borderColor = active ? 'rgba(255,149,0,0.4)' : 'rgba(255,255,255,0.1)'; }
    if (knob)   { knob.style.left = active ? '27px' : '3px'; knob.style.background = active ? '#ff9500' : 'rgba(255,255,255,0.4)'; knob.style.boxShadow = active ? '0 0 8px rgba(255,149,0,0.6)' : 'none'; }
}

async function toggleMaintenance() {
    const newState = !_maintenanceActive;
    const msg = newState ? 'Activezi MAINTENANCE MODE?\nToți Insiderii vor vedea ecranul de mentenanță.' : 'Dezactivezi maintenance mode?';
    if (!confirm(msg)) return;
    try {
        // .set merge:true — funcționează indiferent dacă documentul există sau nu
        await db.collection('system').doc('app_config').set({ maintenanceMode:newState, lastUpdated:firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
        addAuditEntry(newState ? '🔧 MAINTENANCE MODE activat' : '✅ Maintenance dezactivat');
        showCEOToast(newState ? '🔧 Maintenance ACTIV' : '✅ Maintenance dezactivat', newState ? 'gold' : 'green');
    } catch(e) { showCEOToast('Eroare: ' + e.message, 'red'); }
}

async function pushLiveUpdate() {
    const msg     = document.getElementById('sysctl-update-msg').value.trim();
    const version = document.getElementById('sysctl-new-version').value.trim();
    const type    = document.getElementById('sysctl-update-type').value;
    const labels  = { soft:'Soft (Toast)', force:'Force (Blocare)', silent:'Silent (Auto-reload)' };

    if (!msg)     { showCEOToast('Scrie un mesaj de actualizare.', 'red'); return; }
    if (!version) { showCEOToast('Specifică versiunea nouă.', 'red'); return; }
    if (!confirm(`Emiti actualizarea ${version} (${labels[type]}) către toți Insiderii?`)) return;

    const btn = document.querySelector('[onclick="pushLiveUpdate()"]');
    if (btn) { btn.style.opacity='0.5'; btn.style.pointerEvents='none'; }

    try {
        // .set merge:true — NICIODATĂ nu va da eroare "No document to update"
        await db.collection('system').doc('app_config').set({
            version,
            forceUpdate:  type === 'force',
            silentUpdate: type === 'silent',
            updateMessage: msg,
            updateType:   type,
            lastUpdated:  firebase.firestore.FieldValue.serverTimestamp(),
            pushedAt:     firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Istoric push-uri
        await db.collection('system').doc('app_config')
            .collection('update_history').add({
                version, message:msg, type,
                pushedBy: 'CEO',
                pushedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        addAuditEntry(`🚀 Push Update v${version} (${labels[type]}): ${msg}`);
        showCEOToast(`🚀 Update v${version} emis! Insiderii sunt notificați.`, 'blue');
        document.getElementById('sysctl-update-msg').value = '';

    } catch(e) { showCEOToast('Eroare push: ' + e.message, 'red'); }
    finally { if (btn) { btn.style.opacity='1'; btn.style.pointerEvents='auto'; } }
}

function loadUpdateHistory() {
    db.collection('system').doc('app_config').collection('update_history')
        .orderBy('pushedAt','desc').limit(5)
        .onSnapshot(snap => {
            const el = document.getElementById('sysctl-update-history');
            if (!el) return;
            if (snap.empty) { el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Nicio actualizare emisă încă.</div>'; return; }
            const icons = { soft:'🔔', force:'🔴', silent:'🔇' };
            el.innerHTML = '';
            snap.forEach(doc => {
                const d    = doc.data();
                const date = d.pushedAt?.toDate().toLocaleString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) || '—';
                el.innerHTML += `
                    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                        <span style="font-size:18px;flex-shrink:0;">${icons[d.type]||'📦'}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                                <span style="font-size:12px;font-weight:800;color:#fff;font-family:monospace;">v${d.version||'—'}</span>
                                <span style="font-size:10px;color:rgba(255,255,255,0.25);">${date}</span>
                            </div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.message||'—'}</div>
                        </div>
                    </div>`;
            });
        });
}
