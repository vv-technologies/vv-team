// [DEPLOY:vv-team-logic.js]
/**
 * VVhi Autonomy Module - V1.0
 * Integrare: Shadow Mode & Confidence Scoring
 */

async function processMission(missionData) {
    // Calcul S (Confidence Score)
    const S = (missionData.V_gps * 0.4) + (missionData.V_img * 0.4) + (missionData.V_rep * 0.2);
    
    // Log pentru Audit Trail
    console.log(`[VVhi] Analiză misiune ${missionData.id}: Scorul S este ${S.toFixed(2)}`);

    if (S > 0.90) {
        // Autonomie totală: Aprobare
        await db.collection('missions').doc(missionData.id).update({
            status: 'approved',
            vv_coins: 10,
            processed_by: 'VVhi_Auto',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await VVhi.logApproval(missionData.id, { reason: "High Confidence", score: S });
        return "AUTO_APPROVED";

    } else if (S < 0.40) {
        // Autonomie totală: Respingere
        await db.collection('missions').doc(missionData.id).update({
            status: 'rejected',
            rejection_reason: "Low Confidence",
            processed_by: 'VVhi_Auto'
        });
        await VVhi.logRejection(missionData.id, { reason: "Low Confidence", advice: "Verifică luminozitatea/GPS" });
        await FraudDetector.check(missionData.userId); // Incrementare tentativă eșuată
        return "AUTO_REJECTED";

    } else {
        // Shadow Mode: Alertă pentru Arhitect
        console.warn(`[VVhi] Shadow Mode: Decizie necesară pentru ${missionData.id}. Scor: ${S}`);
        await db.collection('notifications').add({
            type: 'MANUAL_REVIEW_REQUIRED',
            missionId: missionData.id,
            confidence: S,
            message: "Predicție VVhi: Necesită validare umană",
            read: false
        });
        return "MANUAL_REVIEW";
    }
}

// Anti-Fraud Trigger
const FraudDetector = {
    check: async (userId) => {
        const userRef = db.collection('users').doc(userId);
        const user = await userRef.get();
        const attempts = (user.data().failed_attempts || 0) + 1;
        
        await userRef.update({ failed_attempts: attempts });
        
        if (attempts >= 3) {
            await userRef.update({ status: 'restricted' });
            console.error(`[SECURITY] User ${userId} restricționat pentru fraudă.`);
        }
    }
};