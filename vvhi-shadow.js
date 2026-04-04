// ================================================================
// VVhi — VVHYBRID INTELLIGENCE · SHADOW MODE
// Dataset de antrenament · Versiunea 0.1 · Beta
// ================================================================
//
// LEGAL NOTICE:
// Acest modul colectează date STRICT ANONIMIZATE pentru antrenarea
// sistemului VVhi de detecție a fraudei.
// Conform: GDPR Art. 5(1)(b) - limitarea scopului,
//          GDPR Art. 25 - privacy by design,
//          EU AI Act Art. 10 - calitatea datelor de antrenament.
//
// NU se colectează: UID, email, alias, GPS exact, device ID, IP.
// SE colectează: descriere misiune, imagine, decizie, motiv, timestamp orar.
//
// Utilizatorii sunt informați în T&C conform clauzei de mai jos.
// ================================================================

var VVhi = (function() {

    // ============================================================
    // CONFIGURARE — modifică doar aici
    // ============================================================
    var COLLECTION = 'vvhi_dataset';
    var ENABLED    = true;   // setează false pentru a opri colectarea temporar

    // ============================================================
    // ANONIMIZARE — core funcție de sanitizare PII
    // Verificată de 3 ori conform cererii.
    // ============================================================
    function sanitize(rawData) {
        // Lista câmpurilor INTERZISE — PII conform GDPR
        var FORBIDDEN = [
            'agentId', 'uid', 'userId', 'createdBy', 'solverId', 'creatorId',
            'email', 'alias', 'name', 'displayName', 'phone',
            'gpsLat', 'gpsLng', 'lat', 'lng', 'location',
            'deviceId', 'imei', 'ip', 'from', 'to'
        ];

        var clean = {};
        Object.keys(rawData).forEach(function(key) {
            if (FORBIDDEN.indexOf(key) === -1) {
                clean[key] = rawData[key];
            }
        });
        return clean;
    }

    // Rotunjim timestamp la ora exactă (previne re-identificarea prin corelație temporală)
    function roundedTimestamp() {
        var now = new Date();
        now.setMinutes(0, 0, 0);
        return now.getTime();
    }

    // ============================================================
    // FUNCȚIA PRINCIPALĂ — logEntry
    // Rulează ASYNC în fundal. Nu blochează niciodată fluxul CEO.
    // ============================================================
    function logEntry(payload) {
        if (!ENABLED) return;

        // Rulăm complet asincron — eroarea VVhi nu afectează produsul
        setTimeout(function() {
            (async function() {
                try {
                    // Pasul 1: Sanitizare strictă — scoatem orice PII
                    var clean = sanitize(payload);

                    // Pasul 2: Construim pachetul final — NUMAI câmpuri permise
                    var packet = {
                        // CE S-A CERUT
                        mission_brief:    clean.mission_brief    || null,
                        // DOVADA
                        proof_image_url:  clean.proof_image_url  || null,
                        // DECIZIA CEO
                        ceo_decision:     clean.ceo_decision     || null,   // 'APPROVED' | 'REJECTED'
                        reject_reason:    clean.reject_reason    || null,   // motivul DSA dacă REJECTED
                        // CONTEXT TEMPORAL — rotunjit la oră, nu la secundă
                        timestamp_hour:   roundedTimestamp(),
                        // METADATA SISTEM — non-PII
                        schema_version:   '0.1',
                        source:           'vvteam_ceo_decision'
                    };

                    // Pasul 3: Verificare finală — ne asigurăm că nu a scăpat niciun PII
                    var PII_PATTERNS = /uid|email|alias|name|gps|lat|lng|device|imei|phone|ip\b/i;
                    var packetStr = JSON.stringify(packet);
                    if (PII_PATTERNS.test(packetStr)) {
                        console.warn('[VVhi] ABORT — PII detectat în packet. Salvare anulată.');
                        return;
                    }

                    // Pasul 4: Scriem în Firestore — colecție separată
                    await db.collection(COLLECTION).add(packet);

                    console.log('[VVhi] ✓ Entry logged:', clean.ceo_decision);

                } catch(e) {
                    // VVhi eșuează silențios — produsul principal NU este afectat
                    console.warn('[VVhi] Log failed (non-blocking):', e.message);
                }
            })();
        }, 0); // setTimeout 0 = fire-and-forget complet asincron
    }

    // ============================================================
    // API PUBLIC
    // ============================================================
    return {

        // Apelată după APPROVE în approvePhotoCEO()
        logApproval: function(photoData) {
            logEntry({
                mission_brief:   photoData.message || null,
                proof_image_url: photoData.url     || null,
                ceo_decision:    'APPROVED',
                reject_reason:   null
            });
        },

        // Apelată după REJECT în confirmDSAReject()
        logRejection: function(photoData, reasonText) {
            logEntry({
                mission_brief:   photoData.message || null,
                proof_image_url: photoData.url     || null,
                ceo_decision:    'REJECTED',
                reject_reason:   reasonText        || null
            });
        },

        // Status pentru CEO — afișat în UI
        getStatus: function() {
            return ENABLED ? '🟢 VVhi Shadow Mode ACTIV' : '⚫ VVhi Shadow Mode OPRIT';
        },

        // Toggle rapid din UI
        toggle: function() {
            ENABLED = !ENABLED;
            addAuditEntry(ENABLED ? '🧠 VVhi Shadow Mode ACTIVAT' : '⚫ VVhi Shadow Mode oprit');
            showCEOToast(ENABLED ? '🧠 VVhi: Colectare activată' : '⚫ VVhi: Colectare oprită', ENABLED ? 'gold' : 'blue');
        }
    };

})();
