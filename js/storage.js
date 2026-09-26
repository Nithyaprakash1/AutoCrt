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
        this.pdfCacheMap = new Map();
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
        const targetId = String(id);

        // Store ONLY ONE format: if pdfDataUrl is present, do not store duplicate pages
        const payloadToStore = pdfPayload.pdfDataUrl ? {
            pdfDataUrl: pdfPayload.pdfDataUrl,
            pdfStorageUrl: pdfPayload.pdfStorageUrl || null
        } : {
            pages: pdfPayload.pages || []
        };

        // 1. High-speed in-memory cache
        this.pdfCacheMap.set(targetId, payloadToStore);

        // 2. Persistent Cache API (supports multi-gigabyte payloads without LocalStorage 5MB quota errors)
        try {
            if ('caches' in window) {
                const cache = await caches.open('onespace-pdf-cache-v1');
                const response = new Response(JSON.stringify(payloadToStore), {
                    headers: { 'Content-Type': 'application/json' }
                });
                await cache.put(new Request(`/pdf-cache/${targetId}`), response);
            }
        } catch (cErr) {
            // Silently fallback to memory / IndexedDB
        }
    }

    async getPdfCache(id) {
        if (!id) return null;
        const targetId = String(id);
        // 1. Check in-memory cache
        if (this.pdfCacheMap.has(targetId)) {
            return this.pdfCacheMap.get(targetId);
        }

        // 2. Check Cache API
        try {
            if ('caches' in window) {
                const cache = await caches.open('onespace-pdf-cache-v1');
                const resp = await cache.match(new Request(`/pdf-cache/${targetId}`));
                if (resp) {
                    const data = await resp.json();
                    if (data) {
                        this.pdfCacheMap.set(targetId, data);
                        return data;
                    }
                }
            }
        } catch (e) {}

        // 3. Fallback: check session/local storage if small
        try {
            const sRaw = sessionStorage.getItem(`onespace_pdf_${targetId}`) || localStorage.getItem(`onespace_pdf_${targetId}`);
            if (sRaw) {
                const parsed = JSON.parse(sRaw);
                this.pdfCacheMap.set(targetId, parsed);
                return parsed;
            }
        } catch (e) {}

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

        // Merge with in-memory store so newly saved papers in the session are never lost
        if (this.memoryStore && this.memoryStore.length > 0) {
            if (!list || list.length === 0) {
                list = [...this.memoryStore];
            } else {
                const listMap = new Map(list.map(e => [String(e.id), e]));
                for (const memItem of this.memoryStore) {
                    if (memItem && memItem.id) {
                        const sId = String(memItem.id);
                        if (!listMap.has(sId)) {
                            list.push(memItem);
                        } else {
                            const existing = listMap.get(sId);
                            // If in-memory copy has newer marks or updated timestamp, prefer it
                            if ((memItem.updatedAt && (!existing.updatedAt || memItem.updatedAt >= existing.updatedAt)) ||
                                (Number(memItem.obtainedMarks) > 0 && Number(existing.obtainedMarks) === 0)) {
                                const idx = list.findIndex(e => String(e.id) === sId);
                                if (idx >= 0) list[idx] = Object.assign({}, existing, memItem);
                            }
                        }
                    }
                }
            }
        }

        if (!list || list.length === 0) {
            // Also check localStorage summary
            try {
                const raw = localStorage.getItem("onespace_evaluations_summary") || localStorage.getItem("onespace_evaluations");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        list = parsed.filter(e => e && e.id);
                    }
                }
            } catch (e) {}
        }

        if ((!list || list.length === 0) && window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbList = await window.firebaseManager.getAllEvaluations();
                if (fbList && fbList.length > 0) list = fbList;
            } catch (e) {
                console.warn("Firebase getAllEvaluations fallback warning:", e);
            }
        }

        // Update memoryStore with latest consolidated list
        if (list && list.length > 0) {
            this.memoryStore = [...list];
        }

        return this.filterEvaluationsForUser(list);
    }

    getCurrentUser() {
        try {
            const raw = localStorage.getItem("onespace_active_user");
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return this.currentUser || null;
    }

    setCurrentUser(user) {
        this.currentUser = user;
        try {
            if (user) {
                localStorage.setItem("onespace_active_user", JSON.stringify(user));
            } else {
                localStorage.removeItem("onespace_active_user");
            }
        } catch (e) {}
    }

    filterEvaluationsForUser(list) {
        if (!Array.isArray(list)) return [];
        const user = this.getCurrentUser();
        if (!user) return list;

        // Admin or Uploader role accesses all evaluations
        if (user.role === 'admin' || user.role === 'uploader') {
            return list;
        }

        // Teacher / Evaluator role: filter by assigned subject / class / teacher UID
        const teacherUid = user.uid || user.id;
        const assignedSubjects = Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0 
            ? user.assignedSubjects 
            : (user.subject ? [user.subject] : []);
        const assignedClasses = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];

        // If no specific restrictions, show all evaluations
        if (assignedSubjects.length === 0 && assignedClasses.length === 0 && !teacherUid) {
            return list;
        }

        const filtered = list.filter(e => {
            // 1. Direct teacher assignment
            if (e.assignedTeacherId && teacherUid && String(e.assignedTeacherId) === String(teacherUid)) {
                return true;
            }
            // 2. Flexible subject match (e.g. "Physics" matches "Physics Board Paper 2026")
            if (assignedSubjects.length > 0) {
                if (assignedSubjects.some(s => s === "All Subjects")) return true;
                if (e.subject) {
                    const subLower = e.subject.toLowerCase();
                    if (assignedSubjects.some(s => {
                        const sLow = s.toLowerCase();
                        return sLow === subLower || subLower.includes(sLow) || sLow.includes(subLower);
                    })) {
                        return true;
                    }
                }
            }
            // 3. Flexible class match (e.g. "Class 12-A" matches "Class 12", "12-A", etc.)
            if (assignedClasses.length > 0) {
                if (assignedClasses.some(c => c === "All Classes")) return true;
                const eClass = (e.class || e.className || e.classLabel || "").toLowerCase();
                if (eClass && assignedClasses.some(c => {
                    const cLow = c.toLowerCase();
                    return cLow === eClass || eClass.includes(cLow) || cLow.includes(eClass);
                })) {
                    return true;
                }
            }
            return false;
        });

        // Fail-safe: if strict filtering resulted in 0 papers but evaluations exist,
        // fallback to returning all papers so the teacher desk is never blocked with 0s
        return filtered.length > 0 ? filtered : list;
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
            if ((!evalObj.pages || evalObj.pages.length === 0) && evalObj.pdfStorageUrl) {
                evalObj.pages = [evalObj.pdfStorageUrl];
            }
            if (!evalObj.pages) evalObj.pages = evalObj.pdfDataUrl ? [evalObj.pdfDataUrl] : [];
        } else {
            evalObj = this.getDraft(id);
        }

        return evalObj ? JSON.parse(JSON.stringify(evalObj)) : null;
    }

    async saveEvaluation(evaluation) {
        if (!this.isReady) await this.readyPromise;

        // Save ONLY ONE format: if paper is a PDF, store only the single PDF document (no redundant rendered JPEG page copies)
        const isPdf = !!(evaluation.pdfDataUrl || (evaluation.pages && evaluation.pages.length === 1 && typeof evaluation.pages[0] === 'string' && evaluation.pages[0].startsWith('data:application/pdf')));
        if (isPdf) {
            if (!evaluation.pdfDataUrl && evaluation.pages && evaluation.pages[0]) {
                evaluation.pdfDataUrl = evaluation.pages[0];
            }
            delete evaluation.pages;
        }

        const cachePayload = evaluation.pdfDataUrl 
            ? { pdfDataUrl: evaluation.pdfDataUrl, pdfStorageUrl: evaluation.pdfStorageUrl || null }
            : { pages: evaluation.pages || [] };

        await this.storePdfCache(evaluation.id, cachePayload);

        // Perform cloud sync asynchronously in background without blocking local save
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            window.firebaseManager.saveEvaluation(evaluation).catch(fbErr => {
                console.warn("Background cloud sync warning:", fbErr);
            });
        }

        return this._putDirect(evaluation);
    }

    _putDirect(evaluation) {
        evaluation.updatedAt = new Date().toISOString();
        if (!evaluation.createdAt) {
            evaluation.createdAt = new Date().toISOString();
        }

        // Memory store update: strictly overwrite existing record by matching ID
        const targetId = String(evaluation.id);
        const idx = this.memoryStore.findIndex(e => String(e.id) === targetId);
        if (idx >= 0) {
            this.memoryStore[idx] = Object.assign({}, this.memoryStore[idx], evaluation);
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
                pdfStorageUrl: e.pdfStorageUrl || null,
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
                const cleanRecord = Object.assign({}, evaluation);
                if (cleanRecord.rawFile) delete cleanRecord.rawFile;
                // If PDF is present, do not store redundant rendered pages array in IndexedDB
                if (cleanRecord.pdfDataUrl) {
                    delete cleanRecord.pages;
                }
                const req = store.put(cleanRecord); // store.put strictly overwrites existing key
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

        // 1. Remove from in-memory cache and map
        this.memoryStore = (this.memoryStore || []).filter(e => String(e.id) !== targetId);
        if (this.pdfCacheMap) {
            this.pdfCacheMap.delete(targetId);
        }

        // 2. Remove from localStorage
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

        // 3. Remove from sessionStorage
        try {
            sessionStorage.removeItem(`onespace_draft_${targetId}`);
            sessionStorage.removeItem(`onespace_pdf_${targetId}`);
        } catch (e) {}

        // 4. Remove from CacheStorage (PDF binary cache)
        try {
            if ('caches' in window) {
                const cache = await caches.open("onespace-pdf-cache-v1");
                await cache.delete(`/pdf-cache/${targetId}`);
            }
        } catch (e) {
            console.warn("CacheStorage delete error:", e);
        }

        // 5. Remove from Firebase Firestore AND Firebase Storage
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                await window.firebaseManager.deleteEvaluation(targetId);
            } catch (e) {
                console.warn("Firestore/Storage delete evaluation failed:", e);
            }
        }

        // 6. Delete from IndexedDB
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

        // Notify app to refresh 50 GB storage quota display if available
        if (window.app && typeof window.app.updateStorageQuotaDisplay === "function") {
            window.app.updateStorageQuotaDisplay();
        }

        return true;
    }

    // --- 50 GB Storage Quota Tracking & Estimation ---
    async getStorageUsage() {
        let usedBytes = 0;

        // 1. Browser Storage Manager Estimate (IndexedDB + Cache Storage)
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const est = await navigator.storage.estimate();
                if (est && est.usage) {
                    usedBytes = est.usage;
                }
            } catch (e) {}
        }

        // 2. Sum data from memoryStore / evaluated papers (calculate approximate size)
        let docBytes = 0;
        const list = this.memoryStore || [];
        for (const ev of list) {
            if (ev.pdfDataUrl && typeof ev.pdfDataUrl === 'string') {
                docBytes += Math.round(ev.pdfDataUrl.length * 0.75); // base64 payload to bytes
            } else if (ev.pages && Array.isArray(ev.pages)) {
                for (const p of ev.pages) {
                    if (typeof p === 'string' && p.startsWith('data:')) {
                        docBytes += Math.round(p.length * 0.75);
                    }
                }
            }
            if (!ev.pdfDataUrl && (!ev.pages || ev.pages.length === 0)) {
                docBytes += (ev.pageCount || 4) * 350 * 1024; // ~350KB per student answer sheet
            }
        }
        usedBytes = Math.max(usedBytes, docBytes);

        const limitBytes = 50 * 1024 * 1024 * 1024; // 50 GB quota
        const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
        const totalGB = 50;
        const remainingGB = Math.max(0, 50 - parseFloat(usedGB)).toFixed(2);
        const percentUsed = Math.min(100, parseFloat(((usedBytes / limitBytes) * 100).toFixed(1)));

        return {
            usedBytes,
            limitBytes,
            usedGB: parseFloat(usedGB),
            totalGB,
            remainingGB: parseFloat(remainingGB),
            percentUsed,
            isNearLimit: percentUsed >= 90,
            isExceeded: usedBytes >= limitBytes
        };
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
            institution: {
                name: "",
                logo: "assets/school_logo.jpg",
                fullLogo: "assets/school_fulllogo.jpg"
            },
            teacher: { name: "Mr. Nithya Prakash" },
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

        if (window.firebaseManager && window.firebaseManager.isConnected && typeof window.firebaseManager.getSettings === "function") {
            try {
                const fbSettings = await window.firebaseManager.getSettings();
                if (fbSettings) return { ...defaultSettings, ...fbSettings };
            } catch (e) {
                console.warn("Firebase getSettings fallback warning:", e);
            }
        }

        try {
            const raw = localStorage.getItem("onespace_settings");
            if (raw) {
                const parsed = JSON.parse(raw);
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
        if (window.firebaseManager && window.firebaseManager.isConnected && typeof window.firebaseManager.saveSettings === "function") {
            try {
                await window.firebaseManager.saveSettings(settings);
            } catch (e) {
                console.warn("Firebase saveSettings warning:", e);
            }
        }
        return settings;
    }

    // Autosave Draft Recovery
    saveDraft(evalId, data) {
        if (!evalId || !data) return;
        try {
            // Strip out massive pages / pdfDataUrl so draft never exceeds quota in sessionStorage
            const cleanDraft = {
                id: data.id,
                studentName: data.studentName,
                rollNo: data.rollNo,
                class: data.class,
                className: data.className,
                section: data.section,
                subject: data.subject,
                examName: data.examName,
                obtainedMarks: data.obtainedMarks,
                maxMarks: data.maxMarks,
                percentage: data.percentage,
                grade: data.grade,
                status: data.status,
                annotations: data.annotations || [],
                questions: data.questions || [],
                feedback: data.feedback || ""
            };
            sessionStorage.setItem(`onespace_draft_${evalId}`, JSON.stringify({
                data: cleanDraft,
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
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbRoster = await window.firebaseManager.getClassRoster(classId);
                if (fbRoster && Array.isArray(fbRoster)) return fbRoster;
            } catch (e) {
                console.warn("Firebase getClassRoster fallback warning:", e);
            }
        }

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
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                await window.firebaseManager.saveClassRoster(classId, roster);
            } catch (e) {
                console.warn("Firebase saveClassRoster warning:", e);
            }
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
                this.memoryStore = this.memoryStore.filter(e => e && e.id && !e.isMock);
            }
        } catch (e) {
            console.warn("Error purging legacy mock data:", e);
        }
    }

    async getSubjectCatalog() {
        await this.readyPromise;
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbCatalog = await window.firebaseManager.getSubjectCatalog();
                if (fbCatalog) return fbCatalog;
            } catch (e) {}
        }

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
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                await window.firebaseManager.saveSubjectCatalog(catalog);
            } catch (e) {}
        }
        return catalog;
    }

    async getClassesList() {
        await this.readyPromise;
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbClasses = await window.firebaseManager.getClassesList();
                if (fbClasses) return fbClasses;
            } catch (e) {}
        }

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
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                await window.firebaseManager.saveClassesList(classes);
            } catch (e) {}
        }
        return classes;
    }

    async getUserPassword() {
        await this.readyPromise;
        return localStorage.getItem("onespace_user_password") || "";
    }

    async saveUserPassword(password) {
        await this.readyPromise;
        localStorage.setItem("onespace_user_password", password);
        return true;
    }

    async getUsersList() {
        await this.readyPromise;
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbUsers = await window.firebaseManager.getUsersList();
                if (fbUsers && Array.isArray(fbUsers)) return fbUsers;
            } catch (e) {}
        }

        const key = "onespace_users";
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Error loading users", e);
        }
        return [];
    }

    async saveUsersList(users) {
        await this.readyPromise;
        const key = "onespace_users";
        try {
            localStorage.setItem(key, JSON.stringify(users));
        } catch (e) {
            console.error("Error saving users", e);
        }
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                await window.firebaseManager.saveUsersList(users);
            } catch (e) {}
        }
        return users;
    }
}

window.appStorage = new StorageService();
