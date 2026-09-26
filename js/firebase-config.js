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

                // 1. Upload original PDF document
                if (!uploadedPdfUrl) {
                    if (rawFile instanceof File || rawFile instanceof Blob) {
                        try {
                            const storagePath = `evaluations_pdf/${evalData.id}/${rawFile.name || 'student_paper.pdf'}`;
                            uploadedPdfUrl = await this.uploadStorageBlob(storagePath, rawFile, { contentType: 'application/pdf' });
                        } catch (fErr) {
                            console.warn("Direct file upload to Storage failed:", fErr);
                        }
                    }

                    if (!uploadedPdfUrl && evalData.pdfDataUrl && evalData.pdfDataUrl.startsWith("data:")) {
                        try {
                            const blob = this.dataURLtoBlob(evalData.pdfDataUrl);
                            if (blob) {
                                const storagePath = `evaluations_pdf/${evalData.id}/student_paper.pdf`;
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

                // 2. Parallel upload of extracted page images to Firebase Storage
                if (Array.isArray(evalData.pages) && evalData.pages.length > 0) {
                    const pageUploadPromises = evalData.pages.map(async (pg, i) => {
                        if (typeof pg === 'string' && pg.startsWith("data:")) {
                            try {
                                const pageBlob = this.dataURLtoBlob(pg);
                                if (pageBlob) {
                                    const pagePath = `evaluations_pages/${evalData.id}/page_${i + 1}.jpeg`;
                                    const pageUrl = await this.uploadStorageBlob(pagePath, pageBlob, { contentType: 'image/jpeg' });
                                    return pageUrl || null;
                                }
                            } catch (pgErr) {
                                console.warn(`Page ${i + 1} upload warning:`, pgErr);
                            }
                            return null;
                        }
                        return pg; // already a Firebase Storage URL
                    });

                    const uploadedPages = await Promise.all(pageUploadPromises);
                    evalData.storagePages = uploadedPages.filter(Boolean);
                    if (evalData.storagePages.length === evalData.pages.length) {
                        evalData.pages = evalData.storagePages;
                    }
                }
            }

            // 3. Firestore Document Size Optimization:
            // Cloud Firestore has a strict 1MB document size limit.
            // Create a sanitized lightweight document that never exceeds the limit:
            const firestoreRecord = Object.assign({}, evalData);
            if (firestoreRecord.pdfDataUrl && firestoreRecord.pdfDataUrl.startsWith("data:")) {
                delete firestoreRecord.pdfDataUrl; // Omit large base64 from Firestore
            }
            if (Array.isArray(firestoreRecord.pages)) {
                firestoreRecord.pages = firestoreRecord.pages.map(p => {
                    if (typeof p === "string" && p.startsWith("data:")) {
                        return null; // Omit heavy base64 images from Firestore document
                    }
                    return p;
                }).filter(Boolean);
            }
            firestoreRecord.hasPdfStorage = !!evalData.pdfStorageUrl;
            firestoreRecord.pageCount = Array.isArray(evaluation.pages) ? evaluation.pages.length : 1;
            firestoreRecord.updatedAt = new Date().toISOString();

            if (this.firestore) {
                await this.firestore.collection("evaluations").doc(String(evalData.id)).set(firestoreRecord, { merge: true });
                console.log(`🔥 Successfully saved evaluation ${evalData.id} to Firestore! Storage PDF: ${evalData.pdfStorageUrl ? 'Uploaded' : 'Pending'}`);
            }

            return true;
        } catch (err) {
            console.error("Error saving evaluation to Firestore:", err);
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
            console.warn("Error fetching all evaluations from Firestore:", err);
            return [];
        }
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

    // Firestore: Save Single Evaluation Document Directly
    async deleteEvaluation(id) {
        if (!this.isConnected || !this.firestore || !id) return false;
        try {
            await this.firestore.collection("evaluations").doc(String(id)).delete();
            console.log(`Deleted evaluation ${id} from Firestore.`);
            return true;
        } catch (err) {
            console.warn("Error deleting evaluation from Firestore:", err);
            return false;
        }
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
