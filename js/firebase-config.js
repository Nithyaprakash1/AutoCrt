/**
 * OneSpace Digital Correction - Firebase Configuration & Connection
 * Connected to Project: studio-5089173188-26125
 */

const firebaseConfig = {
  apiKey: "AIzaSyCBTaMEijihtm1cZV1B7cSWAFisIPn4yLQ",
  authDomain: "studio-5089173188-26125.firebaseapp.com",
  projectId: "studio-5089173188-26125",
  storageBucket: "studio-5089173188-26125.firebasestorage.app",
  messagingSenderId: "869087357582",
  appId: "1:869087357582:web:6716fd75db64fc6acbf7df"
};

class FirebaseManager {
    constructor() {
        this.config = firebaseConfig;
        this.app = null;
        this.auth = null;
        this.firestore = null;
        this.storage = null;
        this.isConnected = false;
        this.currentUser = null;
        
        // Auto-initialize when window loads
        if (typeof window !== "undefined") {
            window.addEventListener("DOMContentLoaded", () => this.init());
        }
    }

    init() {
        if (typeof window.firebase !== "undefined") {
            try {
                if (!window.firebase.apps.length) {
                    this.app = window.firebase.initializeApp(this.config);
                } else {
                    this.app = window.firebase.app();
                }

                if (window.firebase.auth) {
                    this.auth = window.firebase.auth();
                    this.auth.onAuthStateChanged((user) => {
                        this.currentUser = user;
                        console.log("Firebase Auth State:", user ? `Logged in as ${user.email}` : "Logged Out");
                    });
                }

                if (window.firebase.firestore) {
                    this.firestore = window.firebase.firestore();
                }

                if (window.firebase.storage) {
                    this.storage = window.firebase.storage();
                }

                this.isConnected = true;
                console.log("🔥 Firebase connected successfully to project studio-5089173188-26125!");
                return true;
            } catch (err) {
                console.warn("Firebase initialization warning:", err);
                this.isConnected = false;
                return false;
            }
        } else {
            console.warn("Firebase CDN SDKs not loaded on window.");
            return false;
        }
    }

    // Demo Firebase Auth Login
    async loginWithEmail(email, password) {
        if (!this.isConnected || !this.auth) {
            console.warn("Firebase Auth not connected, running local demo login session.");
            return { user: { email, displayName: email.split("@")[0] }, isLocal: true };
        }
        try {
            const userCred = await this.auth.signInWithEmailAndPassword(email, password);
            return { user: userCred.user, isLocal: false };
        } catch (err) {
            console.warn("Firebase Auth Error, falling back to local demo login:", err.message);
            return { user: { email, displayName: email.split("@")[0] }, isLocal: true, error: err.message };
        }
    }

    // Firestore: Save Physics Exam Template
    async savePhysicsTemplate(template) {
        if (!this.isConnected || !this.firestore) return false;
        try {
            await this.firestore.collection("exam_templates").doc(template.id || "phy-cbse-70").set(template, { merge: true });
            console.log("Saved Physics template to Firestore successfully.");
            return true;
        } catch (err) {
            console.error("Error saving Physics template to Firestore:", err);
            return false;
        }
    }

    // Firestore: Load Physics Exam Template
    async getPhysicsTemplate() {
        if (!this.isConnected || !this.firestore) return null;
        try {
            const doc = await this.firestore.collection("exam_templates").doc("phy-cbse-70").get();
            return doc.exists ? doc.data() : null;
        } catch (err) {
            console.error("Error fetching Physics template from Firestore:", err);
            return null;
        }
    }

    // Firestore: Save Evaluation Paper (Sanitized to avoid 1MB document size limit)
    async saveEvaluation(evaluation) {
        if (!this.isConnected || !this.firestore || !evaluation || !evaluation.id) return false;
        try {
            const sanitized = { ...evaluation };
            if (sanitized.pdfDataUrl && sanitized.pdfDataUrl.length > 500000) {
                delete sanitized.pdfDataUrl;
            }
            if (Array.isArray(sanitized.pages)) {
                sanitized.pages = sanitized.pages.map(p => (typeof p === "string" && p.length > 500000) ? "[Local Base64 Data]" : p);
            }
            await this.firestore.collection("evaluations").doc(String(evaluation.id)).set(sanitized, { merge: true });
            return true;
        } catch (err) {
            console.warn("Firestore sync skipped for heavy paper:", err.message || err);
            return false;
        }
    }

    // Firestore: Get All Evaluations
    async getAllEvaluations() {
        if (!this.isConnected || !this.firestore) return [];
        try {
            const snapshot = await this.firestore.collection("evaluations").get();
            return snapshot.docs.map(doc => doc.data());
        } catch (err) {
            console.warn("Error fetching evaluations from Firestore:", err);
            return [];
        }
    }
}

window.firebaseManager = new FirebaseManager();
