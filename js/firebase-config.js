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

    // Compress Base64 image to ~35KB so it easily fits inside Firestore 1MB document limit if Storage CORS fails
    async compressBase64Image(dataUrl, maxDimension = 850, quality = 0.5) {
        if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
            return dataUrl;
        }
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let w = img.naturalWidth || 1000;
                let h = img.naturalHeight || 1400;
                if (w > maxDimension || h > maxDimension) {
                    if (w > h) {
                        h = Math.round((h * maxDimension) / w);
                        w = maxDimension;
                    } else {
                        w = Math.round((w * maxDimension) / h);
                        h = maxDimension;
                    }
                }
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    // Firebase Storage: Upload Data URL / Blob and get permanent HTTPS Download URL with 1.5s CORS timeout
    async uploadImageToStorage(path, dataUrl) {
        if (!this.isConnected || !this.storage || !dataUrl) return null;
        try {
            const uploadPromise = (async () => {
                const storageRef = this.storage.ref().child(path);
                const snapshot = await storageRef.putString(dataUrl, 'data_url');
                return await snapshot.ref.getDownloadURL();
            })();

            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
            return await Promise.race([uploadPromise, timeoutPromise]);
        } catch (err) {
            console.warn("Firebase Storage upload CORS/skipped:", err.message || err);
            return null;
        }
    }

    // Firestore + Firebase Storage: Upload Heavy Assets & Save Paper Document
    async saveEvaluation(evaluation) {
        if (!this.isConnected || !this.firestore || !evaluation || !evaluation.id) return false;
        try {
            const evalId = String(evaluation.id);
            const sanitized = JSON.parse(JSON.stringify(evaluation));

            // Process page images
            if (Array.isArray(sanitized.pages)) {
                for (let i = 0; i < sanitized.pages.length; i++) {
                    const pageStr = sanitized.pages[i];
                    if (typeof pageStr === "string" && pageStr.startsWith("data:")) {
                        const path = `evaluations/${evalId}/page_${i + 1}.jpg`;
                        const url = await this.uploadImageToStorage(path, pageStr);
                        if (url) {
                            sanitized.pages[i] = url;
                            evaluation.pages[i] = url;
                        } else {
                            // Fallback: Compress Base64 image to ~35KB so document fits inside 1MB Firestore limit
                            sanitized.pages[i] = await this.compressBase64Image(pageStr, 850, 0.5);
                        }
                    }
                }
            }

            // Process raw PDF Data URL if present
            if (sanitized.pdfDataUrl && typeof sanitized.pdfDataUrl === "string" && sanitized.pdfDataUrl.startsWith("data:")) {
                const pdfPath = `evaluations/${evalId}/paper.pdf`;
                const url = await this.uploadImageToStorage(pdfPath, sanitized.pdfDataUrl);
                if (url) {
                    sanitized.pdfDataUrl = url;
                    evaluation.pdfDataUrl = url;
                } else {
                    delete sanitized.pdfDataUrl; // Omit heavy PDF string from Firestore document
                }
            } else if (sanitized.pdfDataUrl && sanitized.pdfDataUrl.length > 500000) {
                delete sanitized.pdfDataUrl;
            }

            await this.firestore.collection("evaluations").doc(evalId).set(sanitized, { merge: true });
            console.log(`🔥 Evaluation ${evalId} saved to Firestore successfully!`);
            return true;
        } catch (err) {
            console.warn("Firestore save error/skipped:", err.message || err);
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
