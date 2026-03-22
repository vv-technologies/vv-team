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

// ================= LIGHTBOX LOGIC =================
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
    if(activeGalleryArray.length === 0) return;
    activeGalleryIndex = (activeGalleryIndex + 1) % activeGalleryArray.length;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
}
function lbPrev(event) {
    event.stopPropagation();
    if(activeGalleryArray.length === 0) return;
    activeGalleryIndex = (activeGalleryIndex - 1 + activeGalleryArray.length) % activeGalleryArray.length;
    document.getElementById('lb-img').src = activeGalleryArray[activeGalleryIndex];
}

// ================= AUDIO PING =================
function playAlertSound() {
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.4);
    } catch(e) { console.log("Audio nesuportat."); }
}

// ================= LOGIN CEO — Email & Parolă =================

// Verificam sesiunea — DOAR CEO real, nu useri anonimi
firebase.auth().onAuthStateChanged(user => {
    if (user && !user.isAnonymous) {
        // E logat cu email/parola — CEO real
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        document.getElementById('login-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('login-screen').style.display = 'none';
            initDashboard();
        }, 300);
    } else if (user && user.isAnonymous) {
        // E un Insider anonim din VV Beta — delogam si aratam loginul
        firebase.auth().signOut();
        document.getElementById('login-screen').style.display = 'flex';
    } else {
        // Niciun user — aratam loginul
        document.getElementById('login-screen').style.display = 'flex';
    }
});

function checkLogin() {
    const email = document.getElementById('ceo-email').value.trim();
    const pass = document.getElementById('ceo-pass').value.trim();
    const btn = document.getElementById('login-btn');
    const errMsg = document.getElementById('login-error');

    if (!email || !pass) {
        errMsg.textContent = 'Completează email și parolă.';
        errMsg.style.display = 'block';
        return;
    }

    btn.textContent = 'SE VERIFICĂ...';
    btn.style.opacity = '0.6';
    errMsg.style.display = 'none';

    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(cred => {
            // Login reusit
            btn.textContent = 'AUTENTIFICAT ✓';
            document.getElementById('login-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-screen').style.display = 'none';
                initDashboard();
            }, 400);
        })
        .catch(err => {
            btn.textContent = 'INTRĂ ÎN SISTEM';
            btn.style.opacity = '1';
            if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                errMsg.textContent = 'Email sau parolă incorectă.';
            } else if (err.code === 'auth/invalid-email') {
                errMsg.textContent = 'Email invalid.';
            } else {
                errMsg.textContent = 'Eroare conexiune. Încearcă din nou.';
            }
            errMsg.style.display = 'block';
        });
}

// Enter pe oricare câmp declanșează login
document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('ceo-email');
    const passInput = document.getElementById('ceo-pass');
    if (emailInput) emailInput.addEventListener('keypress', e => { if(e.key === 'Enter') checkLogin(); });
    if (passInput) passInput.addEventListener('keypress', e => { if(e.key === 'Enter') checkLogin(); });
});

// ================= LOGOUT CEO =================
function logoutCEO() {
    firebase.auth().signOut().then(() => {
        location.reload();
    });
}

// ================= NAVIGATIE =================
function switchSection(id, element) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id + '-section').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    element.classList.add('active');
}

function initDashboard() {
    loadGlobalFeed();
    loadDisputes();
    loadLeaderboard(); 
    loadFeedback();
    loadKeys();
    loadTalentPool();
}

// ================= 1. FEED — 24H GOD MODE =================
function loadGlobalFeed() {
    const cutoff24h = Date.now() - (24 * 60 * 60 * 1000);

    db.collection('photos')
        .orderBy('timestamp', 'desc')
        .onSnapshot(snap => {
            const container = document.getElementById('feed-container');
            container.innerHTML = '';
            currentFeedPhotos = [];
            let imgIndex = 0;
            let count = 0;

            if (snap.empty) {
                container.innerHTML = '<div style="color:var(--text-muted);">Nicio captură în ultimele 24h.</div>';
                return;
            }

            snap.forEach(doc => {
                const d = doc.data();
                // Filtram doar ultimele 24h
                if (d.timestamp < cutoff24h) return;
                count++;
                currentFeedPhotos.push(d.url);

                const date = new Date(d.timestamp).toLocaleString('ro-RO', {
                    hour: '2-digit', minute: '2-digit',
                    day: '2-digit', month: 'short'
                });
                const gpsStr = d.gpsLat
                    ? `${d.gpsLat.toFixed(4)}, ${d.gpsLng.toFixed(4)}`
                    : 'GPS N/A';
                const flagHtml = d.flagged
                    ? `<div class="flag-badge"><i class="fas fa-exclamation-triangle"></i> ALERTAT</div>`
                    : '';

                container.innerHTML += `
                    <div class="photo-card">
                        <div style="position:relative;">
                            <img src="${d.url}" class="photo-img"
                                onclick="openLightbox('feed', ${imgIndex})"
                                title="Click pentru Zoom">
                            <div style="
                                position:absolute; bottom:0; left:0; right:0;
                                background:rgba(0,0,0,0.6);
                                backdrop-filter:blur(8px);
                                -webkit-backdrop-filter:blur(8px);
                                padding:8px 12px;
                            ">
                                <div style="font-size:10px; color:rgba(255,255,255,0.5); letter-spacing:1px;">VV PROOF</div>
                                <div style="font-size:11px; color:rgba(255,255,255,0.7);">📍 ${gpsStr}</div>
                            </div>
                        </div>
                        <div class="photo-info">
                            ${flagHtml}
                            <div class="photo-msg">"${d.message || 'Captură VV'}"</div>
                            <div class="photo-meta">
                                <span><i class="fas fa-clock"></i> ${date}</span>
                                <span style="cursor:pointer; color:var(--vv-blue);"
                                    onclick="openModerateModal('${doc.id}', '${d.agentId}', '${d.alias || 'INSIDER'}')">
                                    ${(d.alias || 'INSIDER').substring(0,8)} ›
                                </span>
                            </div>
                            <div style="display:flex; gap:8px; margin-top:12px;">
                                <button onclick="moderatePhoto('${doc.id}', '${d.agentId}', true)"
                                    style="flex:1; padding:10px; border:none; border-radius:10px;
                                    background:rgba(52,199,89,0.15); color:#34c759;
                                    border:1px solid rgba(52,199,89,0.3);
                                    font-weight:700; font-size:12px; cursor:pointer;">
                                    ✓ APROBĂ
                                </button>
                                <button onclick="moderatePhoto('${doc.id}', '${d.agentId}', false)"
                                    style="flex:1; padding:10px; border:none; border-radius:10px;
                                    background:rgba(255,59,48,0.15); color:#ff3b30;
                                    border:1px solid rgba(255,59,48,0.3);
                                    font-weight:700; font-size:12px; cursor:pointer;">
                                    ✕ REFUZĂ
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                imgIndex++;
            });

            if (count === 0) {
                container.innerHTML = '<div style="color:var(--text-muted);">Nicio captură în ultimele 24h.</div>';
            }
        });
}

// Aprobare / Refuz captură
async function moderatePhoto(photoId, agentId, approved) {
    try {
        if (approved) {
            // Gasim misiunea asociata si dam reward
            const photoDoc = await db.collection('photos').doc(photoId).get();
            const reward = photoDoc.data()?.reward || 0;
            if (reward > 0 && agentId) {
                await db.collection('users').doc(agentId).update({
                    balance: firebase.firestore.FieldValue.increment(reward)
                });
            }
            await db.collection('photos').doc(photoId).update({ approved: true, flagged: false });
            alert('✅ Captură aprobată! VV Coins transferați.');
        } else {
            await db.collection('photos').doc(photoId).update({ approved: false, flagged: true });
            alert('❌ Captură refuzată și marcată.');
        }
    } catch(e) { alert('Eroare: ' + e.message); }
}

// Modal moderare Insider
function openModerateModal(photoId, agentId, alias) {
    const existing = document.getElementById('moderate-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'moderate-modal';
    modal.style.cssText = `
        position:fixed; inset:0; z-index:100000;
        background:rgba(0,0,0,0.75);
        backdrop-filter:blur(20px);
        -webkit-backdrop-filter:blur(20px);
        display:flex; align-items:center; justify-content:center;
    `;
    modal.innerHTML = `
        <div style="
            background:rgba(12,12,18,0.98);
            backdrop-filter:blur(30px);
            -webkit-backdrop-filter:blur(30px);
            border:1px solid rgba(255,255,255,0.1);
            border-radius:24px;
            padding:32px 28px;
            width:90%; max-width:360px;
        ">
            <div style="font-size:11px; color:rgba(255,255,255,0.3); letter-spacing:3px; margin-bottom:8px;">CONTROL INSIDER</div>
            <div style="font-size:20px; font-weight:900; color:#fff; margin-bottom:24px;">${alias}</div>

            <button onclick="sanctionInsider('${agentId}', 'warn')"
                style="width:100%; padding:14px; margin-bottom:10px; border-radius:12px;
                background:rgba(10,132,255,0.1); color:#0A84FF;
                border:1px solid rgba(10,132,255,0.3);
                font-weight:700; font-size:13px; cursor:pointer; text-align:left;">
                <i class="fas fa-bell" style="margin-right:10px;"></i> Trimite Avertisment
            </button>

            <button onclick="sanctionInsider('${agentId}', 'penalize')"
                style="width:100%; padding:14px; margin-bottom:10px; border-radius:12px;
                background:rgba(255,149,0,0.1); color:#ff9500;
                border:1px solid rgba(255,149,0,0.3);
                font-weight:700; font-size:13px; cursor:pointer; text-align:left;">
                <i class="fas fa-coins" style="margin-right:10px;"></i> Penalizare 50 VV Coins
            </button>

            <button onclick="sanctionInsider('${agentId}', 'ban')"
                style="width:100%; padding:14px; margin-bottom:20px; border-radius:12px;
                background:rgba(255,59,48,0.1); color:#ff3b30;
                border:1px solid rgba(255,59,48,0.3);
                font-weight:700; font-size:13px; cursor:pointer; text-align:left;">
                <i class="fas fa-ban" style="margin-right:10px;"></i> Ban / Dezactivează Contul
            </button>

            <button onclick="document.getElementById('moderate-modal').remove()"
                style="width:100%; padding:12px; border-radius:12px;
                background:transparent; color:rgba(255,255,255,0.3);
                border:1px solid rgba(255,255,255,0.08);
                font-weight:600; font-size:12px; cursor:pointer;">
                ÎNCHIDE
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function sanctionInsider(agentId, type) {
    try {
        if (type === 'warn') {
            await db.collection('inbox').add({
                to: agentId,
                from: 'CEO',
                message: '⚠️ Ai primit un avertisment oficial de la VVTeam. Respectă regulamentul.',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('✅ Avertisment trimis Insider-ului.');
        } else if (type === 'penalize') {
            await db.collection('users').doc(agentId).update({
                balance: firebase.firestore.FieldValue.increment(-50)
            });
            alert('✅ 50 VV Coins deduse din balanță.');
        } else if (type === 'ban') {
            if (!confirm('Ești sigur că vrei să banezi acest Insider?')) return;
            await db.collection('users').doc(agentId).update({
                banned: true,
                balance: 0
            });
            alert('✅ Insider banat și fonduri blocate.');
        }
        document.getElementById('moderate-modal')?.remove();
    } catch(e) { alert('Eroare: ' + e.message); }
}

// ================= 2. DISPUTE =================
function loadDisputes() {
    db.collection('missions').where('status', '==', 'disputed').onSnapshot(snap => {
        const container = document.getElementById('disputes-container');
        const badge = document.getElementById('dispute-badge');
        
        container.innerHTML = '';
        currentDisputePhotos = [];
        let imgIndex = 0;

        if(snap.size > 0) { badge.style.display = 'inline-block'; badge.innerText = snap.size; } 
        else { badge.style.display = 'none'; container.innerHTML = '<div style="color:var(--text-muted);">Nicio dispută activă. Sistem curat.</div>'; }

        if (!isFirstDisputeLoad) {
            let hasNew = false;
            snap.docChanges().forEach(change => { if (change.type === 'added') hasNew = true; });
            if (hasNew) playAlertSound();
        }
        isFirstDisputeLoad = false;

        snap.forEach(doc => {
            let m = doc.data();
            currentDisputePhotos.push(m.photoUrl);

            container.innerHTML += `
                <div class="photo-card" style="border-color: var(--danger);">
                    <img src="${m.photoUrl}" class="photo-img" onclick="openLightbox('dispute', ${imgIndex})" title="Click pentru Inspecție">
                    <div class="photo-info">
                        <div class="flag-badge">DISPUTĂ DESCHISĂ</div>
                        <div class="photo-msg" style="color:var(--text-muted); font-size:12px;">Cerere: <span style="color:#fff;">${m.description}</span></div>
                        <div class="photo-meta" style="margin-top:10px;">
                            <span>Recompensă: <strong style="color:var(--gold);">${m.reward} VV</strong></span>
                        </div>
                        <div class="action-row">
                            <button class="btn-approve" onclick="resolveDispute('${doc.id}', '${m.solverId}', ${m.reward}, true)">POZĂ OK</button>
                            <button class="btn-reject" onclick="resolveDispute('${doc.id}', '${m.creatorId}', ${m.reward}, false)">FAKE (Retur BANI)</button>
                        </div>
                    </div>
                </div>
            `;
            imgIndex++;
        });
    });
}

async function resolveDispute(missionId, targetUserId, amount, isApprove) {
    let msg = isApprove ? "Plătești AGENTULUI?" : "Returnezi banii CLIENTULUI?";
    if(!confirm(msg)) return;
    try {
        await db.collection('users').doc(targetUserId).update({ balance: firebase.firestore.FieldValue.increment(amount) });
        await db.collection('missions').doc(missionId).update({ status: isApprove ? 'completed' : 'cancelled_fraud' });
        alert("Dispută rezolvată.");
    } catch(e) { alert("Eroare: " + e.message); }
}

// ================= 3. LEADERBOARD & TOTAL BANI =================
function loadLeaderboard() {
    db.collection('users').onSnapshot(snap => {
        let users = [];
        let totalBankValue = 0; 

        snap.forEach(doc => {
            let data = doc.data();
            data.uid = doc.id;
            users.push(data);
            totalBankValue += (data.balance || 0); 
        });

        document.getElementById('total-vv-bank').innerText = totalBankValue.toLocaleString() + " VV";

        users.sort((a, b) => (b.balance || 0) - (a.balance || 0));
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';

        if(users.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Niciun agent.</td></tr>'; return; }

        users.forEach((u, index) => {
            let rankHtml = index === 0 ? `<span class="rank-gold">#1</span>` : index === 1 ? `<span style="color:#C0C0C0; font-weight:bold;">#2</span>` : index === 2 ? `<span style="color:#CD7F32; font-weight:bold;">#3</span>` : `#${index + 1}`;
            let shortId = u.uid.substring(0,5).toUpperCase();
            let bal = u.balance || 0;
            let statusHtml = bal >= 1000 ? `<span class="badge-onyx"><i class="fas fa-check-circle"></i> ELIGIBIL ONYX</span>` : `<span style="color:var(--text-muted); font-size:11px;">ÎN PROGRES</span>`;

            tbody.innerHTML += `
                <tr>
                    <td>${rankHtml}</td>
                    <td><strong style="color:#fff;">${u.alias || "Agent"}</strong> <span style="color:#555; font-size:10px; margin-left:5px;">(${shortId})</span></td>
                    <td style="color:var(--safe-green); font-family:monospace; font-size:16px;">${bal} VV</td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        });
    });
}

// ================= 4. FEEDBACK =================
function loadFeedback() {
    const tbody = document.getElementById('feedback-body');
    tbody.innerHTML = `
        <tr>
            <td><strong style="color:#fff;">Sistem Beta</strong></td>
            <td style="color:rgba(255,255,255,0.8);">Meniul este activ. Așteaptă mesaje din aplicație.</td>
            <td><span style="color:var(--safe-green); font-size:11px; font-weight:bold;">ONLINE</span></td>
            <td><button class="btn-reply" onclick="alert('Funcție de Reply pregătită.')">REPLY</button></td>
        </tr>
    `;
}

// ================= WIPE DATABASE =================
async function deleteAllBetaData() {
    let promptWord = prompt("ATENȚIE: Această acțiune va șterge TOATE pozele și misiunile din sistem! Scrie: RESET");
    if(promptWord !== "RESET") { alert("Procedură anulată."); return; }
    
    try {
        let photos = await db.collection('photos').get();
        photos.forEach(doc => doc.ref.delete());
        
        let missions = await db.collection('missions').get();
        missions.forEach(doc => doc.ref.delete());

        alert("Sistem curățat complet! Gata pentru un nou test.");
    } catch(e) { alert("Eroare la ștergere: " + e.message); }
}

// ================= TALENT POOL =================
function loadTalentPool() {
    db.collection('talent_pool')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
            const container = document.getElementById('talent-container');
            if (!container) return;
            container.innerHTML = '';

            if (snap.empty) {
                container.innerHTML = '<div style="color:var(--text-muted);">Nicio aplicație încă. Împărtășește VV cu lumea!</div>';
                return;
            }

            snap.forEach(doc => {
                const d = doc.data();
                const date = d.createdAt?.toDate().toLocaleString('ro-RO') || '—';
                container.innerHTML += `
                    <div style="
                        background:var(--glass-bg);
                        border:1px solid var(--glass-border);
                        border-radius:16px; padding:20px;
                        display:flex; flex-direction:column; gap:8px;
                    ">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:14px; font-weight:800; color:#fff;">${d.alias || 'INSIDER'}</span>
                            <span style="font-size:10px; color:var(--text-muted);">${date}</span>
                        </div>
                        <div style="font-size:13px; color:rgba(255,255,255,0.7);">
                            <strong style="color:rgba(255,255,255,0.5);">Skills:</strong> ${d.skill}
                        </div>
                        ${d.portfolio && d.portfolio !== 'N/A' ? `
                        <a href="${d.portfolio}" target="_blank" style="
                            font-size:12px; color:var(--vv-blue);
                            text-decoration:none; font-weight:600;
                        ">
                            <i class="fas fa-link"></i> ${d.portfolio}
                        </a>` : ''}
                        <div style="display:flex; gap:8px; margin-top:4px;">
                            <button onclick="updateTalentStatus('${doc.id}', 'contacted')" style="
                                flex:1; padding:10px; border:none; border-radius:10px;
                                background:rgba(10,132,255,0.15); color:#0A84FF;
                                border:1px solid rgba(10,132,255,0.3);
                                font-weight:700; font-size:11px; cursor:pointer;">
                                CONTACTEAZĂ
                            </button>
                            <button onclick="updateTalentStatus('${doc.id}', 'rejected')" style="
                                flex:1; padding:10px; border:none; border-radius:10px;
                                background:rgba(255,59,48,0.1); color:#ff3b30;
                                border:1px solid rgba(255,59,48,0.25);
                                font-weight:700; font-size:11px; cursor:pointer;">
                                RESPINGE
                            </button>
                        </div>
                    </div>
                `;
            });
        });
}

async function updateTalentStatus(docId, status) {
    try {
        await db.collection('talent_pool').doc(docId).update({ status });
        alert(status === 'contacted' ? '✅ Marcat ca Contactat!' : '❌ Aplicație respinsă.');
    } catch(e) { alert('Eroare: ' + e.message); }
}

// ================= 5. CHEI — GOD MODE DASHBOARD =================
function loadKeys() {
    db.collection('access_keys').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const list = document.getElementById('keys-list');
        const dashboard = document.getElementById('keys-dashboard');
        if (!list) return;

        let totalKeys = 0;
        let activeKeys = 0;
        let usedKeys = 0;
        let userGenerated = 0;

        list.innerHTML = '';

        snap.forEach(doc => {
            const d = doc.data();
            totalKeys++;
            if (d.active) activeKeys++;
            if (d.used) usedKeys++;
            if (d.generatedBy) userGenerated++;

            const statusColor = d.active ? 'var(--safe-green)' : '#ff3b30';
            const statusText = d.active ? 'ACTIV' : 'DEZACTIVAT';
            const sourceText = d.generatedBy
                ? `<span style="font-size:10px; color:rgba(255,255,255,0.3);">de ${d.generatedByAlias || 'INSIDER'}</span>`
                : `<span style="font-size:10px; color:rgba(255,255,255,0.3);">CEO</span>`;

            const date = d.createdAt?.toDate().toLocaleString('ro-RO', {
                day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
            }) || '—';

            list.innerHTML += `
                <div class="key-item" style="flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span style="font-family:monospace; font-size:15px; letter-spacing:2px;">${d.key}</span>
                        <div style="display:flex; gap:8px; align-items:center;">
                            ${sourceText}
                            <span style="font-size:10px; color:rgba(255,255,255,0.2);">${date}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; margin-left:auto;">
                        <span style="font-size:11px; font-weight:700; color:${statusColor};">${statusText}</span>
                        <button onclick="toggleKey('${doc.id}', ${d.active})" style="
                            background:${d.active ? 'rgba(255,59,48,0.12)' : 'rgba(52,199,89,0.12)'};
                            border:1px solid ${d.active ? 'rgba(255,59,48,0.25)' : 'rgba(52,199,89,0.25)'};
                            color:${d.active ? '#ff3b30' : '#34c759'};
                            padding:5px 12px; border-radius:8px; font-size:11px;
                            font-weight:700; cursor:pointer;
                        ">${d.active ? 'REVOKE' : 'ACTIVEAZĂ'}</button>
                    </div>
                </div>`;
        });

        // Update dashboard stats
        if (dashboard) {
            dashboard.innerHTML = `
                <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:20px;">
                    <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:24px; font-weight:900; color:#fff;">${totalKeys}</div>
                        <div style="font-size:10px; color:rgba(255,255,255,0.3); letter-spacing:1px; margin-top:2px;">TOTAL CHEI</div>
                    </div>
                    <div style="background:rgba(52,199,89,0.06); border:1px solid rgba(52,199,89,0.2); border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:24px; font-weight:900; color:#34c759;">${activeKeys}</div>
                        <div style="font-size:10px; color:rgba(52,199,89,0.5); letter-spacing:1px; margin-top:2px;">ACTIVE</div>
                    </div>
                    <div style="background:rgba(10,132,255,0.06); border:1px solid rgba(10,132,255,0.2); border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:24px; font-weight:900; color:#0A84FF;">${userGenerated}</div>
                        <div style="font-size:10px; color:rgba(10,132,255,0.5); letter-spacing:1px; margin-top:2px;">DE INSIDERI</div>
                    </div>
                    <div style="background:rgba(255,149,0,0.06); border:1px solid rgba(255,149,0,0.2); border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:24px; font-weight:900; color:#ff9500;">${totalKeys - activeKeys}</div>
                        <div style="font-size:10px; color:rgba(255,149,0,0.5); letter-spacing:1px; margin-top:2px;">REVOCATE</div>
                    </div>
                </div>
            `;
        }
    });
}

// ================= FIX: active: true la generare =================
async function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newKey = '';
    for(let i = 0; i < 6; i++) newKey += chars.charAt(Math.floor(Math.random() * chars.length));
    try {
        await db.collection('access_keys').add({
            key: newKey,
            active: true,        // ← FIX: câmpul care lipsea
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) { alert("Eroare generare cheie."); }
}

// Activează / dezactivează o cheie existentă
async function toggleKey(docId, currentState) {
    try {
        await db.collection('access_keys').doc(docId).update({ active: !currentState });
    } catch(e) { alert("Eroare: " + e.message); }
}
