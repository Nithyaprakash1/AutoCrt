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
        this.readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });
        
        // Initialize immediately if Firebase SDK is already available on window, otherwise on DOMContentLoaded
        if (typeof window !== "undefined") {
            if (typeof window.firebase !== "undefined") {
                this.init();
            } else {
                window.addEventListener("DOMContentLoaded", () => this.init());
            }
        }
    }

    async ensureReady(timeoutMs = 2500) {
        if (this.isConnected && this.firestore) return true;
        let timer;
        const timeoutPromise = new Promise((resolve) => {
            timer = setTimeout(() => resolve(this.isConnected), timeoutMs);
        });
        const res = await Promise.race([this.readyPromise, timeoutPromise]);
        clearTimeout(timer);
        return res || this.isConnected;
    }

    init() {
        if (this.isConnected && this.app) return true;
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
                if (this._resolveReady) this._resolveReady(true);
                return true;
            } catch (err) {
                console.warn("Firebase initialization warning:", err);
                this.isConnected = false;
                if (this._resolveReady) this._resolveReady(false);
                return false;
            }
        } else {
            console.warn("Firebase CDN SDKs not loaded on window.");
            this.isConnected = false;
            if (this._resolveReady) this._resolveReady(false);
            return false;
        }
    }

    // Firebase Auth: Login with Email or Username & Password
    async loginWithEmail(emailOrUsername, password) {
        if (!this.isConnected || !this.auth) {
            console.warn("Firebase Auth not connected, running session auth.");
            return { user: { email: emailOrUsername, displayName: emailOrUsername.split("@")[0] }, isLocal: true };
        }
        try {
            let targetEmail = (emailOrUsername || "").trim();

            // Support logging in via User ID / Username (e.g. "sarah.bio")
            if (!targetEmail.includes("@")) {
                if (window.appStorage) {
                    const users = await window.appStorage.getUsersList();
                    const match = users.find(u => 
                        (u.username && u.username.toLowerCase() === targetEmail.toLowerCase()) || 
                        (u.id && u.id.toLowerCase() === targetEmail.toLowerCase())
                    );
                    if (match && match.email) {
                        targetEmail = match.email;
                    }
                }
            }

            const userCred = await this.auth.signInWithEmailAndPassword(targetEmail, password);
            const user = userCred.user;
            let profile = null;

            if (this.firestore && user) {
                try {
                    const doc = await this.firestore.collection("users").doc(user.uid).get();
                    if (doc.exists) {
                        profile = doc.data();
                    } else {
                        // Create basic profile in Firestore if missing
                        profile = {
                            uid: user.uid,
                            id: user.uid,
                            name: user.displayName || targetEmail.split("@")[0],
                            email: targetEmail,
                            role: "evaluator",
                            assignedSubjects: ["Physics"],
                            assignedClasses: ["Class 12-A"],
                            status: "active",
                            createdAt: new Date().toISOString()
                        };
                        await this.firestore.collection("users").doc(user.uid).set(profile, { merge: true });
                    }
                } catch (pErr) {
                    console.warn("Error fetching profile from Firestore:", pErr);
                }
            }
            return { user, profile, isLocal: false };
        } catch (err) {
            console.warn("Firebase Auth Login Warning:", err.message);
            return { user: null, profile: null, isLocal: false, error: err.message, code: err.code };
        }
    }

    // Firebase Auth: Create Teacher / Evaluator Account with Email & Password
    // Uses secondary Firebase App so current admin session is NOT signed out!
    async createTeacherAccount(teacherData) {
        const {
            email,
            password,
            name,
            username,
            role = "evaluator",
            assignedSubjects = ["Physics"],
            assignedClasses = ["Class 12-A"],
            status = "active",
            extraData = {}
        } = teacherData;

        if (!email || !password) {
            return { success: false, error: "Email and password are required." };
        }

        if (password.length < 6) {
            return { success: false, error: "Password must be at least 6 characters long." };
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = (name || "").trim() || cleanEmail.split("@")[0];
        const cleanUsername = (username || "").trim() || cleanEmail.split("@")[0];

        // If Firebase is not connected, return local success
        if (!this.isConnected || !window.firebase) {
            const localUid = `usr_${Date.now()}`;
            const localProfile = {
                uid: localUid,
                id: localUid,
                name: cleanName,
                username: cleanUsername,
                email: cleanEmail,
                password: password,
                role: role,
                roleLabel: role === "uploader" ? "Uploader / Exam Dept" : "Evaluator / Teacher",
                assignedSubjects: assignedSubjects,
                assignedClasses: assignedClasses,
                status: status,
                createdAt: new Date().toISOString(),
                ...extraData
            };
            return { success: true, uid: localUid, profile: localProfile, isLocal: true };
        }

        let secondaryApp = null;
        try {
            // Provision user via secondary Firebase App instance to preserve Admin session
            const appName = "TeacherProvision_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
            secondaryApp = window.firebase.initializeApp(this.config, appName);
            const secondaryAuth = secondaryApp.auth();

            const userCred = await secondaryAuth.createUserWithEmailAndPassword(cleanEmail, password);
            const newUser = userCred.user;

            if (newUser && cleanName) {
                try {
                    await newUser.updateProfile({ displayName: cleanName });
                } catch (pErr) {}
            }

            const uid = newUser.uid;

            // Clean up secondary auth session
            await secondaryAuth.signOut();
            await secondaryApp.delete();
            secondaryApp = null;

            // Construct profile data
            const profileData = Object.assign({
                uid: uid,
                id: uid,
                name: cleanName,
                username: cleanUsername,
                email: cleanEmail,
                password: password, // preserved for admin credential distribution
                role: role,
                roleLabel: role === "uploader" ? "Uploader / Exam Dept" : "Evaluator / Teacher",
                assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [assignedSubjects],
                assignedClasses: Array.isArray(assignedClasses) ? assignedClasses : [assignedClasses],
                status: status,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, extraData);

            // Save teacher profile in Firestore "users" collection
            if (this.firestore) {
                await this.firestore.collection("users").doc(uid).set(profileData, { merge: true });
            }

            console.log(`🔥 Created Teacher account in Firebase Auth: ${cleanEmail} (UID: ${uid})`);
            return { success: true, uid: uid, profile: profileData, isLocal: false };
        } catch (err) {
            if (secondaryApp) {
                try { await secondaryApp.delete(); } catch (e) {}
            }

            // Handle case where user already exists in Firebase Auth
            if (err.code === "auth/email-already-in-use") {
                console.info(`User ${cleanEmail} already exists in Firebase Authentication. Updating profile.`);
                const existingUid = `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
                const profileData = Object.assign({
                    id: existingUid,
                    name: cleanName,
                    username: cleanUsername,
                    email: cleanEmail,
                    password: password,
                    role: role,
                    roleLabel: role === "uploader" ? "Uploader / Exam Dept" : "Evaluator / Teacher",
                    assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [assignedSubjects],
                    assignedClasses: Array.isArray(assignedClasses) ? assignedClasses : [assignedClasses],
                    status: status,
                    updatedAt: new Date().toISOString()
                }, extraData);

                if (this.firestore) {
                    try {
                        const snap = await this.firestore.collection("users").where("email", "==", cleanEmail).get();
                        if (!snap.empty) {
                            const docRef = snap.docs[0].ref;
                            profileData.uid = snap.docs[0].id;
                            profileData.id = snap.docs[0].id;
                            await docRef.set(profileData, { merge: true });
                        }
                    } catch (fsErr) {}
                }

                return { success: true, uid: profileData.uid || existingUid, profile: profileData, alreadyExists: true };
            }

            console.error("Firebase Auth Teacher creation error:", err);
            return { success: false, error: err.message, code: err.code };
        }
    }

    // Batch sync teachers list to Firebase Authentication
    async batchSyncTeachersToFirebaseAuth(teachers) {
        if (!Array.isArray(teachers) || teachers.length === 0) return { success: true, synced: 0 };
        let synced = 0;
        const results = [];

        for (const t of teachers) {
            if (t.email && t.password) {
                const res = await this.createTeacherAccount({
                    email: t.email,
                    password: t.password,
                    name: t.name,
                    username: t.username,
                    role: t.role || "evaluator",
                    assignedSubjects: t.assignedSubjects,
                    assignedClasses: t.assignedClasses,
                    status: t.status || "active"
                });
                if (res.success) synced++;
                results.push(res);
            }
        }
        return { success: true, synced, total: teachers.length, results };
    }

    // Firebase Auth: Register New User with Email & Password (direct self-registration)
    async registerUserWithEmail(email, password, name, role = "evaluator", extraData = {}) {
        return this.createTeacherAccount({
            email,
            password,
            name,
            role,
            assignedSubjects: extraData.assignedSubjects || ["Physics"],
            assignedClasses: extraData.assignedClasses || ["Class 12-A"],
            extraData
        });
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

    // Firestore & Storage: Save Evaluation Document and Upload PDF & Pages to Firebase Storage (Optimized & Parallel)
    async saveEvaluation(evaluation) {
        if (!evaluation || !evaluation.id) return false;
        try {
            const evalData = JSON.parse(JSON.stringify(evaluation));
            const rawFile = evaluation.rawFile || null;
            if (evalData.rawFile) delete evalData.rawFile;

            // Upload PDF file and page images to Firebase Storage in parallel if connected
            if (this.storage) {
                let uploadedPdfUrl = evalData.pdfStorageUrl || null;

                // 1. Upload & strictly overwrite original single PDF document in Firebase Storage
                if (!uploadedPdfUrl) {
                    const storagePath = `evaluations_pdf/${evalData.id}.pdf`;
                    if (rawFile instanceof File || rawFile instanceof Blob) {
                        try {
                            uploadedPdfUrl = await this.uploadStorageBlob(storagePath, rawFile, { contentType: 'application/pdf' });
                        } catch (fErr) {
                            console.warn("Direct file upload to Storage failed:", fErr);
                        }
                    }

                    if (!uploadedPdfUrl && evalData.pdfDataUrl && evalData.pdfDataUrl.startsWith("data:")) {
                        try {
                            const blob = this.dataURLtoBlob(evalData.pdfDataUrl);
                            if (blob) {
                                uploadedPdfUrl = await this.uploadStorageBlob(storagePath, blob, { contentType: 'application/pdf' });
                            }
                        } catch (pdfErr) {
                            console.warn("Base64 PDF upload to Storage failed:", pdfErr);
                        }
                    }
                }

                if (uploadedPdfUrl) {
                    evalData.pdfStorageUrl = uploadedPdfUrl;
                }
            }

            // 2. Firestore Document Size Optimization:
            // Cloud Firestore has a strict 1MB document size limit.
            // Save sanitized document: omit redundant base64 strings and duplicate page arrays
            const firestoreRecord = Object.assign({}, evalData);
            if (firestoreRecord.pdfDataUrl && firestoreRecord.pdfDataUrl.startsWith("data:")) {
                delete firestoreRecord.pdfDataUrl; // Omit large base64 from Firestore
            }
            delete firestoreRecord.pages; // Store only the single PDF reference, not duplicate page arrays!
            firestoreRecord.hasPdfStorage = !!evalData.pdfStorageUrl;
            firestoreRecord.pageCount = evalData.pageCount || 1;
            firestoreRecord.updatedAt = new Date().toISOString();

            if (this.firestore) {
                await this.firestore.collection("evaluations").doc(String(evalData.id)).set(firestoreRecord, { merge: true });
                console.log(`🔥 Successfully saved evaluation ${evalData.id} to Firestore! Single Storage PDF: ${evalData.pdfStorageUrl ? 'Uploaded' : 'Pending'}`);
            }

            return true;
        } catch (err) {
            console.error("Error saving evaluation to Firestore:", err);
            return false;
        }
    }

    // Helper: Parse Firestore REST field value to standard JS primitive or object
    parseFirestoreValue(v) {
        if (!v || typeof v !== 'object') return null;
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return Number(v.integerValue);
        if ('doubleValue' in v) return Number(v.doubleValue);
        if ('booleanValue' in v) return v.booleanValue;
        if ('nullValue' in v) return null;
        if ('arrayValue' in v) {
            const arr = v.arrayValue && Array.isArray(v.arrayValue.values) ? v.arrayValue.values : [];
            return arr.map(item => this.parseFirestoreValue(item));
        }
        if ('mapValue' in v) {
            const out = {};
            const fields = (v.mapValue && v.mapValue.fields) ? v.mapValue.fields : {};
            for (const [key, childVal] of Object.entries(fields)) {
                out[key] = this.parseFirestoreValue(childVal);
            }
            return out;
        }
        return null;
    }

    // Helper: Parse complete Firestore REST document into evaluation object
    parseFirestoreDocument(doc) {
        if (!doc) return null;
        const out = {};
        const fields = doc.fields || {};
        for (const [key, val] of Object.entries(fields)) {
            out[key] = this.parseFirestoreValue(val);
        }
        if (!out.id && doc.name) {
            out.id = doc.name.split('/').pop();
        }
        return out;
    }

    // Firestore: Get All Evaluations (Dual-Channel: Web SDK + Direct REST API Fallback)
    async getAllEvaluations() {
        await this.ensureReady(1800);
        let list = [];

        // 1. Try Firestore Web SDK first
        if (this.isConnected && this.firestore) {
            try {
                const snapshot = await this.firestore.collection("evaluations").get();
                if (snapshot && !snapshot.empty) {
                    list = snapshot.docs.map(doc => {
                        const d = doc.data() || {};
                        if (!d.id) d.id = doc.id;
                        return d;
                    });
                    if (list.length > 0) {
                        return list;
                    }
                }
            } catch (err) {
                console.warn("Firestore Web SDK getAllEvaluations error, attempting REST fallback:", err);
            }
        }

        // 2. High-speed Direct REST Fallback (Direct GET to Firestore REST API, ultra-reliable across all machines/browsers)
        try {
            const endpoint = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/evaluations?pageSize=100`;
            const resp = await fetch(endpoint);
            if (resp.ok) {
                const json = await resp.json();
                if (json.documents && Array.isArray(json.documents)) {
                    list = json.documents.map(d => this.parseFirestoreDocument(d)).filter(Boolean);
                    console.log(`🔥 Successfully loaded ${list.length} evaluations via Firestore REST API!`);
                    return list;
                }
            }
        } catch (restErr) {
            console.warn("Firestore REST fallback getAllEvaluations warning:", restErr);
        }

        return list;
    }

    // Firestore: Get Single Evaluation by ID (Dual-Channel: Web SDK + REST)
    async getEvaluationById(id) {
        if (!id) return null;
        const targetId = String(id);
        await this.ensureReady(1500);

        // 1. Try Web SDK
        if (this.isConnected && this.firestore) {
            try {
                const doc = await this.firestore.collection("evaluations").doc(targetId).get();
                if (doc.exists) {
                    const d = doc.data() || {};
                    if (!d.id) d.id = doc.id;
                    return d;
                }
            } catch (err) {
                console.warn("Firestore SDK getEvaluationById error:", err);
            }
        }

        // 2. REST Fallback
        try {
            const endpoint = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/evaluations/${targetId}`;
            const resp = await fetch(endpoint);
            if (resp.ok) {
                const json = await resp.json();
                return this.parseFirestoreDocument(json);
            }
        } catch (restErr) {
            console.warn("Firestore REST getEvaluationById warning:", restErr);
        }

        return null;
    }

    // Convert dataURL string to Blob object for Firebase Storage upload
    dataURLtoBlob(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') return null;
        try {
            const parts = dataUrl.split(',');
            if (parts.length < 2) return null;
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        } catch (e) {
            console.warn("Error converting dataURL to Blob:", e);
            return null;
        }
    }

    // Firestore & Storage: Delete Evaluation Record and Storage Assets
    async deleteEvaluation(id) {
        if (!id) return false;
        const targetId = String(id);

        // 1. Delete document from Firestore
        if (this.firestore) {
            try {
                await this.firestore.collection("evaluations").doc(targetId).delete();
                console.log(`Deleted evaluation ${targetId} from Firestore.`);
            } catch (err) {
                console.warn("Error deleting evaluation from Firestore:", err);
            }
        }

        // 2. Delete single PDF & any associated files from Firebase Cloud Storage
        if (this.storage) {
            try {
                // Delete direct single PDF
                const pdfRef = this.storage.ref().child(`evaluations_pdf/${targetId}.pdf`);
                await pdfRef.delete().catch(() => {});
            } catch (sErr) {}

            try {
                // Delete legacy path if existed
                const legacyRef = this.storage.ref().child(`evaluations_pdf/${targetId}/student_paper.pdf`);
                await legacyRef.delete().catch(() => {});
            } catch (sErr) {}

            try {
                // Delete folder contents if any legacy files in evaluations_pdf/{id}
                const folderRef = this.storage.ref().child(`evaluations_pdf/${targetId}`);
                const list = await folderRef.listAll().catch(() => null);
                if (list && list.items) {
                    await Promise.all(list.items.map(item => item.delete().catch(() => {})));
                }
            } catch (fErr) {}

            try {
                // Delete legacy page images if any existed
                const pagesRef = this.storage.ref().child(`evaluations_pages/${targetId}`);
                const list = await pagesRef.listAll().catch(() => null);
                if (list && list.items) {
                    await Promise.all(list.items.map(item => item.delete().catch(() => {})));
                }
            } catch (pErr) {}

            console.log(`Deleted evaluation ${targetId} assets from Firebase Storage.`);
        }

        return true;
    }

    // Firestore: Save Generic Exam Template
    async saveExamTemplate(template) {
        if (!this.isConnected || !this.firestore || !template || !template.id) return false;
        try {
            await this.firestore.collection("exam_templates").doc(String(template.id)).set(template, { merge: true });
            console.log(`Saved exam template ${template.id} to Firestore.`);
            return true;
        } catch (err) {
            console.error("Error saving template to Firestore:", err);
            return false;
        }
    }

    // Firestore: Get Generic Exam Template by ID
    async getExamTemplate(id) {
        if (!this.isConnected || !this.firestore || !id) return null;
        try {
            const doc = await this.firestore.collection("exam_templates").doc(String(id)).get();
            return doc.exists ? doc.data() : null;
        } catch (err) {
            console.error("Error fetching template from Firestore:", err);
            return null;
        }
    }

    // Firestore: Get All Exam Templates
    async getAllExamTemplates() {
        if (!this.isConnected || !this.firestore) return [];
        try {
            const snapshot = await this.firestore.collection("exam_templates").get();
            return snapshot.docs.map(doc => doc.data());
        } catch (err) {
            console.warn("Error fetching all exam templates from Firestore:", err);
            return [];
        }
    }

    // Firestore: Class Roster Sync
    async saveClassRoster(classId, roster) {
        if (!this.isConnected || !this.firestore || !classId) return false;
        try {
            await this.firestore.collection("class_rosters").doc(String(classId)).set({
                classId,
                roster,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            return true;
        } catch (err) {
            console.warn("Error saving class roster to Firestore:", err);
            return false;
        }
    }

    async getClassRoster(classId) {
        if (!this.isConnected || !this.firestore || !classId) return null;
        try {
            const doc = await this.firestore.collection("class_rosters").doc(String(classId)).get();
            return doc.exists ? doc.data().roster : null;
        } catch (err) {
            console.warn("Error fetching class roster from Firestore:", err);
            return null;
        }
    }

    // Firestore: Custom Subject Catalog Sync
    async saveSubjectCatalog(catalog) {
        if (!this.isConnected || !this.firestore) return false;
        try {
            await this.firestore.collection("app_config").doc("subject_catalog").set({ catalog, updatedAt: new Date().toISOString() });
            return true;
        } catch (err) {
            console.warn("Error saving subject catalog to Firestore:", err);
            return false;
        }
    }

    async getSubjectCatalog() {
        if (!this.isConnected || !this.firestore) return null;
        try {
            const doc = await this.firestore.collection("app_config").doc("subject_catalog").get();
            return doc.exists ? doc.data().catalog : null;
        } catch (err) {
            console.warn("Error fetching subject catalog from Firestore:", err);
            return null;
        }
    }

    // Firestore: Custom Classes List Sync
    async saveClassesList(classes) {
        if (!this.isConnected || !this.firestore) return false;
        try {
            await this.firestore.collection("app_config").doc("classes_list").set({ classes, updatedAt: new Date().toISOString() });
            return true;
        } catch (err) {
            console.warn("Error saving classes list to Firestore:", err);
            return false;
        }
    }

    async getClassesList() {
        if (!this.isConnected || !this.firestore) return null;
        try {
            const doc = await this.firestore.collection("app_config").doc("classes_list").get();
            return doc.exists ? doc.data().classes : null;
        } catch (err) {
            console.warn("Error fetching classes list from Firestore:", err);
            return null;
        }
    }



    // Firestore: Users List Sync
    async saveUsersList(users) {
        if (!this.isConnected || !this.firestore) return false;
        try {
            await this.firestore.collection("app_config").doc("users_list").set({ users, updatedAt: new Date().toISOString() });
            return true;
        } catch (err) {
            console.warn("Error saving users list to Firestore:", err);
            return false;
        }
    }

    async getUsersList() {
        if (!this.isConnected || !this.firestore) return null;
        try {
            const doc = await this.firestore.collection("app_config").doc("users_list").get();
            return doc.exists ? doc.data().users : null;
        } catch (err) {
            console.warn("Error fetching users list from Firestore:", err);
            return null;
        }
    }

    // Firestore: App Settings Sync
    async saveSettings(settings) {
        if (!this.isConnected || !this.firestore) return false;
        try {
            await this.firestore.collection("app_config").doc("settings").set({
                settings,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            return true;
        } catch (err) {
            console.warn("Error saving settings to Firestore:", err);
            return false;
        }
    }

    async getSettings() {
        if (!this.isConnected || !this.firestore) return null;
        try {
            const doc = await this.firestore.collection("app_config").doc("settings").get();
            return doc.exists ? (doc.data().settings || doc.data()) : null;
        } catch (err) {
            console.warn("Error fetching settings from Firestore:", err);
            return null;
        }
    }

    // Firebase Storage: Upload File or Blob and return Public Download URL
    async uploadStorageBlob(filePath, blob, metadata = {}) {
        if (!this.isConnected || !this.storage || !blob) return null;
        try {
            const storageRef = this.storage.ref().child(filePath);
            const uploadTask = await storageRef.put(blob, metadata);
            const downloadUrl = await uploadTask.ref.getDownloadURL();
            console.log(`Uploaded to Firebase Storage at ${filePath}: ${downloadUrl}`);
            return downloadUrl;
        } catch (err) {
            console.error("Firebase Storage upload error:", err);
            return null;
        }
    }
}

window.firebaseManager = new FirebaseManager();
