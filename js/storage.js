/**
 * OneSpace Digital Correction - Storage Layer (Dual Mode)
 * Provides IndexedDB persistence with LocalStorage fallback and MockData auto-seeding.
 * Also hooks into Firebase Firestore & Storage if configured.
 */

class StorageService {
    constructor() {
        this.dbName = "OneSpaceEvaluationDB";
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
        this.memoryStore = [];
        this.readyPromise = this.init();
    }

    async init() {
        return new Promise((resolve) => {
            try {
                if (!window.indexedDB) {
                    console.info("IndexedDB not supported, falling back to LocalStorage.");
                    this.fallbackInit();
                    this.isReady = true;
                    resolve();
                    return;
                }

                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onupgradeneeded = (event) => {
                    try {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains("evaluations")) {
                            const evalStore = db.createObjectStore("evaluations", { keyPath: "id" });
                            evalStore.createIndex("examName", "examName", { unique: false });
                            evalStore.createIndex("class", "class", { unique: false });
                            evalStore.createIndex("status", "status", { unique: false });
                            evalStore.createIndex("studentName", "studentName", { unique: false });
                        }
                        if (!db.objectStoreNames.contains("settings")) {
                            db.createObjectStore("settings", { keyPath: "key" });
                        }
                    } catch (e) {
                        console.warn("IndexedDB upgrade warning, using fallback:", e);
                    }
                };

                request.onsuccess = async (event) => {
                    this.db = event.target.result;
                    await this.seedInitialDataIfNeeded();
                    this.purgeLegacyMockData();
                    this.isReady = true;
                    resolve();
                };

                request.onerror = (event) => {
                    console.warn("IndexedDB unavailable or blocked, activating LocalStorage fallback.");
                    this.db = null;
                    this.fallbackInit();
                    this.purgeLegacyMockData();
                    this.isReady = true;
                    resolve();
                };
            } catch (err) {
                console.warn("IndexedDB error caught, activating LocalStorage fallback:", err);
                this.db = null;
                this.fallbackInit();
                this.purgeLegacyMockData();
                this.isReady = true;
                resolve();
            }
        });
    }

    purgeLegacyMockData() {
        if (!this.memoryStore) this.memoryStore = [];
        this.memoryStore = this.memoryStore.filter(e => e && e.id);
    }

    fallbackInit() {
        try {
            const raw = localStorage.getItem("onespace_evaluations_summary") || localStorage.getItem("onespace_evaluations");
            if (!raw) {
                this.memoryStore = [];
            } else {
                const parsed = JSON.parse(raw);
                this.memoryStore = Array.isArray(parsed) ? parsed.filter(e => e && e.id) : [];
            }
        } catch (e) {
            console.error("Fallback init error:", e);
            this.memoryStore = [];
        }
        this.purgeLegacyMockData();
    }

    async seedInitialDataIfNeeded() {
        const count = await this.countEvaluations();
        if (count === 0 && window.MockData) {
            const initialData = window.MockData.getInitialEvaluations();
            for (const item of initialData) {
                await this._putDirect(item);
            }
        }
    }

    countEvaluations() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(this.memoryStore.length);
                return;
            }
            const tx = this.db.transaction(["evaluations"], "readonly");
            const store = tx.objectStore("evaluations");
            const req = store.count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(0);
        });
    }

    async storePdfCache(id, pdfPayload) {
        if (!id || !pdfPayload) return;
        try {
            const dataStr = JSON.stringify(pdfPayload);
            sessionStorage.setItem(`onespace_pdf_${id}`, dataStr);
            try {
                localStorage.setItem(`onespace_pdf_${id}`, dataStr);
            } catch (lErr) {}
            if ('caches' in window) {
                const cache = await caches.open('onespace-pdf-cache-v1');
                const response = new Response(dataStr, {
                    headers: { 'Content-Type': 'application/json' }
                });
                await cache.put(new Request(`/pdf-cache/${id}`), response);
            }
        } catch (e) {
            console.warn("PDF cache storage warning:", e);
        }
    }

    async getPdfCache(id) {
        if (!id) return null;
        try {
            const sRaw = sessionStorage.getItem(`onespace_pdf_${id}`) || localStorage.getItem(`onespace_pdf_${id}`);
            if (sRaw) return JSON.parse(sRaw);

            if ('caches' in window) {
                const cache = await caches.open('onespace-pdf-cache-v1');
                const resp = await cache.match(new Request(`/pdf-cache/${id}`));
                if (resp) {
                    const data = await resp.json();
                    if (data) {
                        try {
                            sessionStorage.setItem(`onespace_pdf_${id}`, JSON.stringify(data));
                        } catch (sErr) {}
                        return data;
                    }
                }
            }
        } catch (e) {
            console.warn("PDF cache retrieval warning:", e);
        }
        return null;
    }

    async getAllEvaluations() {
        if (!this.isReady) await this.readyPromise;
        let list = [];

        if (this.db) {
            list = await new Promise((resolve) => {
                const tx = this.db.transaction(["evaluations"], "readonly");
                const store = tx.objectStore("evaluations");
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        }

        if (!list || list.length === 0) {
            list = [...this.memoryStore];
        }

        if ((!list || list.length === 0) && window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbList = await window.firebaseManager.getAllEvaluations();
                if (fbList && fbList.length > 0) list = fbList;
            } catch (e) {
                console.warn("Firebase getAllEvaluations fallback warning:", e);
            }
        }

        // Hydrate missing PDF page data from PDF Cache API or sessionStorage
        for (const item of list) {
            if (!item.pages || item.pages.length === 0) {
                const cached = await this.getPdfCache(item.id);
                if (cached) {
                    if (cached.pages && cached.pages.length > 0) item.pages = cached.pages;
                    if (cached.pdfDataUrl) item.pdfDataUrl = cached.pdfDataUrl;
                }
            }
            if (!item.pages) item.pages = item.pdfDataUrl ? [item.pdfDataUrl] : [];
        }

        return list;
    }

    async getEvaluationById(id) {
        if (!this.isReady) await this.readyPromise;
        if (id === null || id === undefined) return null;
        const targetId = String(id);
        let evalObj = null;

        if (this.db) {
            evalObj = await new Promise((resolve) => {
                const tx = this.db.transaction(["evaluations"], "readonly");
                const store = tx.objectStore("evaluations");
                const req = store.get(id);
                req.onsuccess = () => {
                    if (req.result) resolve(req.result);
                    else {
                        const req2 = store.get(targetId);
                        req2.onsuccess = () => resolve(req2.result || null);
                        req2.onerror = () => resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            });
        }

        if (!evalObj) {
            evalObj = (this.memoryStore || []).find(e => String(e.id) === targetId) || null;
        }

        if (!evalObj && window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbList = await window.firebaseManager.getAllEvaluations();
                evalObj = fbList.find(e => String(e.id) === targetId) || null;
            } catch (e) {}
        }

        if (evalObj) {
            const draft = this.getDraft(id);
            if (draft) {
                if (draft.annotations && draft.annotations.length > 0) evalObj.annotations = draft.annotations;
                if (draft.questions && draft.questions.length > 0) evalObj.questions = draft.questions;
                if (draft.obtainedMarks !== undefined) evalObj.obtainedMarks = draft.obtainedMarks;
                if (draft.percentage !== undefined) evalObj.percentage = draft.percentage;
                if (draft.grade !== undefined) evalObj.grade = draft.grade;
                if (draft.status !== undefined) evalObj.status = draft.status;
            }

            if (!evalObj.pages || evalObj.pages.length === 0) {
                const cached = await this.getPdfCache(id);
                if (cached) {
                    if (cached.pages && cached.pages.length > 0) evalObj.pages = cached.pages;
                    if (cached.pdfDataUrl) evalObj.pdfDataUrl = cached.pdfDataUrl;
                }
            }
            if (!evalObj.pages) evalObj.pages = evalObj.pdfDataUrl ? [evalObj.pdfDataUrl] : [];
        } else {
            evalObj = this.getDraft(id);
        }

        return evalObj ? JSON.parse(JSON.stringify(evalObj)) : null;
    }

    async saveEvaluation(evaluation) {
        if (!this.isReady) await this.readyPromise;

        if (evaluation.pages && evaluation.pages.length > 0) {
            await this.storePdfCache(evaluation.id, {
                pages: evaluation.pages,
                pdfDataUrl: evaluation.pdfDataUrl || null
            });
        }

        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                await window.firebaseManager.saveEvaluation(evaluation);
            } catch (fbErr) {
                console.warn("Firebase save evaluation error:", fbErr);
            }
        }

        return this._putDirect(evaluation);
    }

    _putDirect(evaluation) {
        evaluation.updatedAt = new Date().toISOString();
        if (!evaluation.createdAt) {
            evaluation.createdAt = new Date().toISOString();
        }

        // Memory store update
        const idx = this.memoryStore.findIndex(e => e.id === evaluation.id);
        if (idx >= 0) {
            this.memoryStore[idx] = evaluation;
        } else {
            this.memoryStore.unshift(evaluation);
        }

        // Persistent LocalStorage summary update (without heavy page Data URLs to avoid QuotaExceededError)
        try {
            const summaryList = this.memoryStore.map(e => ({
                id: e.id,
                studentName: e.studentName,
                rollNo: e.rollNo,
                class: e.class,
                className: e.className,
                section: e.section,
                subject: e.subject,
                examName: e.examName,
                templateName: e.templateName,
                obtainedMarks: e.obtainedMarks,
                maxMarks: e.maxMarks,
                percentage: e.percentage,
                status: e.status,
                isUserUploaded: true,
                isMock: false
            }));
            localStorage.setItem("onespace_evaluations_summary", JSON.stringify(summaryList));
        } catch (e) {
            console.warn("LocalStorage summary write error:", e);
        }

        if (!this.db) {
            return Promise.resolve(evaluation);
        }

        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(["evaluations"], "readwrite");
                const store = tx.objectStore("evaluations");
                const req = store.put(evaluation);
                req.onsuccess = () => resolve(evaluation);
                req.onerror = (e) => {
                    console.warn("IndexedDB put error, using fallback memory/cacheStorage:", e.target?.error || e);
                    resolve(evaluation);
                };
            } catch (err) {
                console.warn("IndexedDB transaction error, using fallback:", err);
                resolve(evaluation);
            }
        });
    }

    async deleteEvaluation(id) {
        if (id === null || id === undefined) return false;
        await this.readyPromise;
        const targetId = String(id);

        // Remove from memoryStore
        this.memoryStore = (this.memoryStore || []).filter(e => String(e.id) !== targetId);

        // Remove from localStorage
        try {
            const legacy = localStorage.getItem("onespace_evaluations");
            if (legacy) {
                const arr = JSON.parse(legacy).filter(e => String(e.id) !== targetId);
                localStorage.setItem("onespace_evaluations", JSON.stringify(arr));
            }
            const summary = localStorage.getItem("onespace_evaluations_summary");
            if (summary) {
                const arr = JSON.parse(summary).filter(e => String(e.id) !== targetId);
                localStorage.setItem("onespace_evaluations_summary", JSON.stringify(arr));
            }
        } catch (e) {
            console.warn("localStorage delete evaluation error:", e);
        }

        // Remove from sessionStorage
        try {
            sessionStorage.removeItem(`onespace_draft_${targetId}`);
            sessionStorage.removeItem(`onespace_pdf_${targetId}`);
        } catch (e) {}

        // Remove from CacheStorage
        try {
            if ('caches' in window) {
                const cache = await caches.open("onespace-pdf-cache-v1");
                await cache.delete(`/pdf-cache/${targetId}`);
            }
        } catch (e) {
            console.warn("CacheStorage delete error:", e);
        }

        // Remove from Firebase Firestore
        if (window.firebaseApp && window.firebaseApp.db) {
            try {
                await window.firebaseApp.db.collection("evaluations").doc(targetId).delete();
            } catch (e) {
                console.warn("Firestore delete evaluation failed:", e);
            }
        }

        // Delete from IndexedDB
        if (this.db) {
            await new Promise((resolve) => {
                const tx = this.db.transaction(["evaluations"], "readwrite");
                const store = tx.objectStore("evaluations");
                const req = store.delete(id);
                req.onsuccess = () => resolve(true);
                req.onerror = () => {
                    const req2 = store.delete(targetId);
                    req2.onsuccess = () => resolve(true);
                    req2.onerror = () => resolve(false);
                };
            });
        }
        return true;
    }

    saveDraft(id, evaluation) {
        if (!id || !evaluation) return;
        try {
            sessionStorage.setItem(`onespace_draft_${id}`, JSON.stringify(evaluation));
            const idx = this.memoryStore.findIndex(e => e.id === id);
            if (idx >= 0) {
                this.memoryStore[idx] = evaluation;
            } else {
                this.memoryStore.unshift(evaluation);
            }
        } catch (e) {
            console.warn("saveDraft storage warning:", e);
        }
    }

    getDraft(id) {
        if (!id) return null;
        try {
            const raw = sessionStorage.getItem(`onespace_draft_${id}`);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return this.memoryStore.find(e => e.id === id) || null;
    }

    async getSettings() {
        await this.readyPromise;
        const defaultSettings = {
            institution: window.MockData ? window.MockData.institution : {
                name: "Adwaith Thought Academy",
                logo: "assets/school_logo.jpg",
                fullLogo: "assets/school_fulllogo.jpg"
            },
            teacher: window.MockData ? window.MockData.teacher : { name: "Evaluator" },
            firebaseConfig: {
                apiKey: "",
                authDomain: "",
                projectId: "",
                storageBucket: "",
                messagingSenderId: "",
                appId: ""
            },
            storageMode: "local" // "local" or "firebase"
        };

        try {
            const raw = localStorage.getItem("onespace_settings");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (!parsed.institution || parsed.institution.name === "Greenwood International Academy") {
                    parsed.institution = defaultSettings.institution;
                }
                return { ...defaultSettings, ...parsed };
            }
        } catch (e) {
            console.error("Error reading settings", e);
        }
        return defaultSettings;
    }

    async saveSettings(settings) {
        await this.readyPromise;
        try {
            localStorage.setItem("onespace_settings", JSON.stringify(settings));
        } catch (e) {
            console.error("Error saving settings", e);
        }
        return settings;
    }

    // Autosave Draft Recovery
    saveDraft(evalId, data) {
        try {
            sessionStorage.setItem(`onespace_draft_${evalId}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            // Silently ignore session quota
        }
    }

    getDraft(evalId) {
        try {
            const raw = sessionStorage.getItem(`onespace_draft_${evalId}`);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    clearDraft(evalId) {
        try {
            sessionStorage.removeItem(`onespace_draft_${evalId}`);
        } catch (e) {}
    }

    // Class Roster Management (Excel / CSV Bulk Student Lists)
    async getClassRoster(classId) {
        await this.readyPromise;
        const key = `onespace_roster_${classId}`;
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Error loading roster for", classId, e);
        }

        const defaultRoster = this.generateDefaultRoster(classId);
        await this.saveClassRoster(classId, defaultRoster);
        return defaultRoster;
    }

    async saveClassRoster(classId, roster) {
        await this.readyPromise;
        const key = `onespace_roster_${classId}`;
        try {
            localStorage.setItem(key, JSON.stringify(roster));
        } catch (e) {
            console.error("Error saving roster for", classId, e);
        }
        return roster;
    }

    generateDefaultRoster(classId) {
        return [];
    }

    purgeLegacyMockData() {
        try {
            // Remove mock rosters from localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith("onespace_roster_")) {
                    const raw = localStorage.getItem(key);
                    if (raw && (raw.includes("Aarav") || raw.includes("Diya") || raw.includes("Rohan"))) {
                        localStorage.removeItem(key);
                    }
                }
            });

            // Filter out mock evaluations
            if (Array.isArray(this.memoryStore)) {
                this.memoryStore = this.memoryStore.filter(e => e.isUserUploaded && !e.isMock);
            }
        } catch (e) {
            console.warn("Error purging legacy mock data:", e);
        }
    }

    async getSubjectCatalog() {
        await this.readyPromise;
        const key = "onespace_custom_catalog";
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Error loading custom catalog", e);
        }
        return null;
    }

    async saveSubjectCatalog(catalog) {
        await this.readyPromise;
        const key = "onespace_custom_catalog";
        try {
            localStorage.setItem(key, JSON.stringify(catalog));
        } catch (e) {
            console.error("Error saving custom catalog", e);
        }
        return catalog;
    }

    async getClassesList() {
        await this.readyPromise;
        const key = "onespace_custom_classes";
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Error loading custom classes", e);
        }
        return null;
    }

    async saveClassesList(classes) {
        await this.readyPromise;
        const key = "onespace_custom_classes";
        try {
            localStorage.setItem(key, JSON.stringify(classes));
        } catch (e) {
            console.error("Error saving custom classes", e);
        }
        return classes;
    }

    async getUserPassword() {
        await this.readyPromise;
        return localStorage.getItem("onespace_user_password") || "admin123";
    }

    async saveUserPassword(password) {
        await this.readyPromise;
        localStorage.setItem("onespace_user_password", password);
        return true;
    }

    async getUsersList() {
        await this.readyPromise;
        const key = "onespace_users";
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Error loading users", e);
        }
        // Initial pre-seeded users
        const defaultUsers = [
            {
                id: "usr_1",
                username: "physics.teacher",
                name: "Mrs. Nithya Prakash",
                role: "evaluator",
                roleLabel: "Senior Physics Faculty",
                password: "physics2026",
                assignedSubjects: ["Physics"],
                assignedClasses: ["Class 12-A", "Class 12-B"],
                status: "active",
                createdAt: "2026-02-10"
            },
            {
                id: "usr_2",
                username: "physics.uploader",
                name: "Physics Exam Officer",
                role: "uploader",
                roleLabel: "Physics Uploader / Exam Dept",
                password: "physics2026",
                assignedSubjects: ["Physics"],
                assignedClasses: ["Class 12-A", "Class 12-B", "Class 12-C", "Class 12-D"],
                status: "active",
                createdAt: "2026-01-05"
            }
        ];
        await this.saveUsersList(defaultUsers);
        return defaultUsers;
    }

    async saveUsersList(users) {
        await this.readyPromise;
        const key = "onespace_users";
        try {
            localStorage.setItem(key, JSON.stringify(users));
        } catch (e) {
            console.error("Error saving users", e);
        }
        return users;
    }
}

window.appStorage = new StorageService();
