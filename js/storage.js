/**
 * Niprak Digital Correction - Storage Layer (Dual Mode)
 * Provides IndexedDB persistence with LocalStorage fallback and MockData auto-seeding.
 * Also hooks into Firebase Firestore & Storage if configured.
 */

class StorageService {
    constructor() {
        this.dbName = "NiprakEvaluationDB";
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
        this.memoryStore = [];
        this.pdfCacheMap = new Map();
        this.deletedEvaluations = this._loadDeletedIds();
        this.notifications = this._loadNotifications();
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
                    await this._migrateFromLegacyDB();
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

    async _migrateFromLegacyDB() {
        if (!window.indexedDB || !this.db) return;
        try {
            const oldReq = indexedDB.open("OneSpaceEvaluationDB");
            oldReq.onsuccess = (e) => {
                const oldDb = e.target.result;
                if (oldDb.objectStoreNames.contains("evaluations")) {
                    const tx = oldDb.transaction(["evaluations"], "readonly");
                    const store = tx.objectStore("evaluations");
                    const getAllReq = store.getAll();
                    getAllReq.onsuccess = () => {
                        const legacyEvals = getAllReq.result || [];
                        if (legacyEvals.length > 0 && this.db) {
                            try {
                                const newTx = this.db.transaction(["evaluations"], "readwrite");
                                const newStore = newTx.objectStore("evaluations");
                                legacyEvals.forEach(ev => {
                                    if (ev && ev.id) newStore.put(ev);
                                });
                            } catch (err) {}
                        }
                    };
                }
            };
        } catch (e) {}
    }

    async purgeLegacyMockData() {
        const isUnwanted = (e) => {
            if (!e) return true;
            // Real student papers uploaded by the user must NEVER be purged!
            if (e.isUserUploaded === true && e.isMock !== true) return false;
            const name = String(e.studentName || "").toLowerCase();
            const id = String(e.id || "").toLowerCase();
            const exam = String(e.examName || e.templateName || "").toLowerCase();
            const isDharnishMock = (name.includes("dharnish") || id.includes("dharnish")) && (e.isMock === true || !e.isUserUploaded || exam.includes("sample") || id === "eval-005");
            const isMock = e.isMock === true || ["eval-001", "eval-002", "eval-003", "eval-004", "eval-005", "eval-006", "eval-007"].includes(id);
            const isLegacyMath = ["arun kumar", "bhavana sharma", "chetan reddy", "deepika patel", "eashwar nathan", "farhan ali", "gayathri devi"].includes(name);
            return isDharnishMock || isMock || isLegacyMath;
        };

        if (!this.memoryStore) this.memoryStore = [];
        this.memoryStore = this.memoryStore.filter(e => e && e.id && !isUnwanted(e));

        try {
            const raw = localStorage.getItem("niprak_evaluations_summary") || localStorage.getItem("onespace_evaluations_summary") || localStorage.getItem("niprak_evaluations") || localStorage.getItem("onespace_evaluations");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    const cleaned = parsed.filter(e => e && e.id && !isUnwanted(e));
                    localStorage.setItem("niprak_evaluations_summary", JSON.stringify(cleaned));
                    localStorage.setItem("onespace_evaluations_summary", JSON.stringify(cleaned));
                    localStorage.setItem("niprak_evaluations", JSON.stringify(cleaned));
                    localStorage.setItem("onespace_evaluations", JSON.stringify(cleaned));
                }
            }
        } catch (e) {}

        if (this.db) {
            try {
                const tx = this.db.transaction(["evaluations"], "readwrite");
                const store = tx.objectStore("evaluations");
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = req.result || [];
                    all.forEach(item => {
                        if (isUnwanted(item)) {
                            store.delete(item.id);
                        }
                    });
                };
            } catch (err) {}
        }
    }

    async purgeUnwantedData() {
        await this.purgeLegacyMockData();
        try {
            if ('caches' in window) {
                for (const cacheName of ['niprak-pdf-cache-v1', 'onespace-pdf-cache-v1']) {
                    try {
                        const cache = await caches.open(cacheName);
                        const keys = await cache.keys();
                        for (const req of keys) {
                            if (req.url.toLowerCase().includes("dharnish") || req.url.includes("eval-00")) {
                                await cache.delete(req);
                            }
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return true;
    }

    _loadDeletedIds() {
        try {
            const raw = localStorage.getItem("niprak_deleted_ids") || localStorage.getItem("onespace_deleted_ids");
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) return new Set(arr.map(String));
            }
        } catch (e) {}
        return new Set();
    }

    _recordDeletedId(id) {
        if (!id) return;
        const targetId = String(id);
        if (!this.deletedEvaluations) this.deletedEvaluations = new Set();
        this.deletedEvaluations.add(targetId);
        try {
            const json = JSON.stringify(Array.from(this.deletedEvaluations));
            localStorage.setItem("niprak_deleted_ids", json);
            localStorage.setItem("onespace_deleted_ids", json);
        } catch (e) {}
    }

    _clearDeletedId(id) {
        if (!id || !this.deletedEvaluations) return;
        const targetId = String(id);
        if (this.deletedEvaluations.has(targetId)) {
            this.deletedEvaluations.delete(targetId);
            try {
                const json = JSON.stringify(Array.from(this.deletedEvaluations));
                localStorage.setItem("niprak_deleted_ids", json);
                localStorage.setItem("onespace_deleted_ids", json);
            } catch (e) {}
        }
    }

    _loadNotifications() {
        try {
            const raw = localStorage.getItem("niprak_notifications") || localStorage.getItem("onespace_notifications");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        return [];
    }

    async getNotifications() {
        const list = this._loadNotifications();
        return list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }

    async saveNotification(notif) {
        if (!notif || !notif.id) return notif;
        let list = this._loadNotifications();
        const existingIdx = list.findIndex(n => n.id === notif.id);
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...notif };
        } else {
            list.unshift(notif);
        }
        // Limit to latest 60 notifications
        if (list.length > 60) list = list.slice(0, 60);
        try {
            const json = JSON.stringify(list);
            localStorage.setItem("niprak_notifications", json);
            localStorage.setItem("onespace_notifications", json);
        } catch (e) {}
        this.notifications = list;
        window.dispatchEvent(new CustomEvent("niprak-notification-change", { detail: notif }));
        return notif;
    }

    async markNotificationRead(id = null) {
        let list = this._loadNotifications();
        if (!id || id === "all") {
            list = list.map(n => ({ ...n, read: true }));
        } else {
            const target = list.find(n => n.id === id);
            if (target) target.read = true;
        }
        try {
            const json = JSON.stringify(list);
            localStorage.setItem("niprak_notifications", json);
            localStorage.setItem("onespace_notifications", json);
        } catch (e) {}
        this.notifications = list;
        window.dispatchEvent(new CustomEvent("niprak-notification-change"));
        return list;
    }

    async markNotificationCleaned(id, purgedBytes = 0) {
        if (!id) return;
        let list = this._loadNotifications();
        const target = list.find(n => n.id === id);
        if (target) {
            target.cleaned = true;
            target.purgedBytes = purgedBytes;
            target.cleanedAt = new Date().toISOString();
            try {
                const json = JSON.stringify(list);
                localStorage.setItem("niprak_notifications", json);
                localStorage.setItem("onespace_notifications", json);
            } catch (e) {}
            this.notifications = list;
            window.dispatchEvent(new CustomEvent("niprak-notification-change", { detail: target }));
        }
    }

    async deleteNotification(id) {
        if (!id) return;
        let list = this._loadNotifications();
        list = list.filter(n => n.id !== id);
        try {
            const json = JSON.stringify(list);
            localStorage.setItem("niprak_notifications", json);
            localStorage.setItem("onespace_notifications", json);
        } catch (e) {}
        this.notifications = list;
        window.dispatchEvent(new CustomEvent("niprak-notification-change"));
    }

    async clearAllNotifications() {
        this.notifications = [];
        try {
            localStorage.setItem("niprak_notifications", "[]");
            localStorage.setItem("onespace_notifications", "[]");
        } catch (e) {}
        window.dispatchEvent(new CustomEvent("niprak-notification-change"));
    }

    fallbackInit() {
        try {
            const raw = localStorage.getItem("niprak_evaluations_summary") || localStorage.getItem("onespace_evaluations_summary") || localStorage.getItem("niprak_evaluations") || localStorage.getItem("onespace_evaluations");
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
        // No auto-seeding of mock evaluations - keep evaluations clean
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

        const payloadToStore = {
            pdfDataUrl: pdfPayload.pdfDataUrl || null,
            pdfStorageUrl: pdfPayload.pdfStorageUrl || null,
            pages: Array.isArray(pdfPayload.pages) && pdfPayload.pages.length > 0 ? pdfPayload.pages : []
        };

        // 1. High-speed in-memory cache
        this.pdfCacheMap.set(targetId, payloadToStore);

        // 2. Persistent Cache API (supports multi-gigabyte payloads without LocalStorage 5MB quota errors)
        try {
            if ('caches' in window) {
                const cache = await caches.open('niprak-pdf-cache-v1');
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

        // 2. Check Cache API (check niprak-pdf-cache-v1 first, then legacy onespace-pdf-cache-v1)
        try {
            if ('caches' in window) {
                let cache = await caches.open('niprak-pdf-cache-v1');
                let resp = await cache.match(new Request(`/pdf-cache/${targetId}`));
                if (!resp) {
                    const oldCache = await caches.open('onespace-pdf-cache-v1');
                    resp = await oldCache.match(new Request(`/pdf-cache/${targetId}`));
                }
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
            const sRaw = sessionStorage.getItem(`niprak_pdf_${targetId}`) || localStorage.getItem(`niprak_pdf_${targetId}`) || sessionStorage.getItem(`onespace_pdf_${targetId}`) || localStorage.getItem(`onespace_pdf_${targetId}`);
            if (sRaw) {
                const parsed = JSON.parse(sRaw);
                this.pdfCacheMap.set(targetId, parsed);
                return parsed;
            }
        } catch (e) {}

        return null;
    }

    _saveEvaluationToIndexedDB(evaluation) {
        if (!this.db || !evaluation || !evaluation.id) return;
        try {
            const tx = this.db.transaction(["evaluations"], "readwrite");
            const store = tx.objectStore("evaluations");
            const cleanRecord = Object.assign({}, evaluation);
            if (cleanRecord.rawFile) delete cleanRecord.rawFile;
            // CRITICAL: Preserve cleanRecord.pages in IndexedDB so rendered scans are never stripped!
            store.put(cleanRecord);
        } catch (e) {
            console.warn("Error caching evaluation into IndexedDB:", e);
        }
    }

    async getAllEvaluations(forceSync = false, bypassFilter = false) {
        if (!this.isReady) await this.readyPromise;
        let list = [];

        // 1. Instant local read: Load from IndexedDB
        if (this.db) {
            list = await new Promise((resolve) => {
                const tx = this.db.transaction(["evaluations"], "readonly");
                const store = tx.objectStore("evaluations");
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        }

        // Filter out any tombstoned deleted IDs immediately from local read
        if (this.deletedEvaluations && this.deletedEvaluations.size > 0) {
            list = list.filter(e => e && e.id && !this.deletedEvaluations.has(String(e.id)));
        }

        // Merge with in-memory store so newly saved papers in this session are never lost
        if (this.memoryStore && this.memoryStore.length > 0) {
            if (!list || list.length === 0) {
                list = [...this.memoryStore];
            } else {
                const listMap = new Map(list.map(e => [String(e.id), e]));
                for (const memItem of this.memoryStore) {
                    if (memItem && memItem.id) {
                        const sId = String(memItem.id);
                        if (this.deletedEvaluations && this.deletedEvaluations.has(sId)) continue;
                        if (!listMap.has(sId)) {
                            list.push(memItem);
                        } else {
                            const existing = listMap.get(sId);
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
            try {
                const raw = localStorage.getItem("niprak_evaluations_summary") || localStorage.getItem("onespace_evaluations_summary") || localStorage.getItem("niprak_evaluations") || localStorage.getItem("onespace_evaluations");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        list = parsed.filter(e => e && e.id && !(this.deletedEvaluations && this.deletedEvaluations.has(String(e.id))));
                    }
                }
            } catch (e) {}
        }

        // 2. CLOUD SYNCHRONIZATION: Always query Firebase (Firestore & Storage) to ensure multi-device consistency!
        // When papers are uploaded on Machine A, Machine B must fetch and display them immediately.
        if (window.firebaseManager) {
            try {
                const fbList = await window.firebaseManager.getAllEvaluations();
                if (Array.isArray(fbList) && fbList.length > 0) {
                    const listMap = new Map(list.map(e => [String(e.id), e]));
                    let addedCount = 0;

                    for (const fbItem of fbList) {
                        if (!fbItem || !fbItem.id) continue;
                        const sId = String(fbItem.id);

                        // If this paper was explicitly deleted by the user, ignore resurrected copies from cloud/cache
                        if (this.deletedEvaluations && this.deletedEvaluations.has(sId)) {
                            continue;
                        }

                        if (!listMap.has(sId)) {
                            list.push(fbItem);
                            listMap.set(sId, fbItem);
                            this._saveEvaluationToIndexedDB(fbItem);
                            addedCount++;
                        } else {
                            const existing = listMap.get(sId);
                            // If cloud has newer evaluation or updated timestamp, update local record
                            if (fbItem.updatedAt && (!existing.updatedAt || fbItem.updatedAt >= existing.updatedAt)) {
                                const merged = Object.assign({}, existing, fbItem, {
                                    // Retain local annotations if paper is actively being corrected here
                                    annotations: (existing.annotations && existing.annotations.length > 0) ? existing.annotations : (fbItem.annotations || []),
                                    // Retain local pages and pdfDataUrl so cloud sync never strips local scans
                                    pages: (existing.pages && existing.pages.length > 0) ? existing.pages : (fbItem.pages || []),
                                    pdfDataUrl: existing.pdfDataUrl || fbItem.pdfDataUrl || null,
                                    obtainedMarks: (Number(existing.obtainedMarks) > 0) ? existing.obtainedMarks : fbItem.obtainedMarks
                                });
                                const idx = list.findIndex(e => String(e.id) === sId);
                                if (idx >= 0) list[idx] = merged;
                                this._saveEvaluationToIndexedDB(merged);
                            }
                        }
                    }

                    if (addedCount > 0) {
                        console.log(`🔥 Synchronized ${addedCount} new evaluation(s) from Firebase Cloud! Total now: ${list.length}`);
                    }
                }
            } catch (e) {
                console.warn("Firebase getAllEvaluations sync warning:", e);
            }
        }

        // 3. RECONCILIATION: For each evaluation, reconcile draft data and verify question sum consistency
        if (Array.isArray(list) && list.length > 0) {
            list = list.map(ev => {
                if (!ev || !ev.id) return ev;
                const draft = this.getDraft(ev.id);
                let merged = ev;
                if (draft) {
                    merged = Object.assign({}, ev, {
                        obtainedMarks: draft.obtainedMarks !== undefined ? draft.obtainedMarks : ev.obtainedMarks,
                        maxMarks: draft.maxMarks || ev.maxMarks,
                        percentage: draft.percentage !== undefined ? draft.percentage : ev.percentage,
                        grade: draft.grade || ev.grade,
                        status: draft.status || ev.status,
                        questions: (draft.questions && draft.questions.length > 0) ? draft.questions : ev.questions
                    });
                }

                // If questions exist, calculate exact awarded sum to prevent stale or divergent totalMarks
                if (Array.isArray(merged.questions) && merged.questions.length > 0) {
                    const qSum = merged.questions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
                    const roundedQSum = Math.round(qSum * 10) / 10;
                    if (roundedQSum > 0 || (merged.obtainedMarks === undefined || merged.obtainedMarks === null)) {
                        merged.obtainedMarks = roundedQSum;
                        if (merged.maxMarks && Number(merged.maxMarks) > 0) {
                            merged.percentage = Math.round((roundedQSum / Number(merged.maxMarks)) * 100);
                            if (window.calculateGradeScale) {
                                merged.grade = window.calculateGradeScale(roundedQSum, merged.maxMarks).grade;
                            }
                        }
                    }
                }

                // Canonicalize Class Names: e.g. "10 A", "10-A", "10 B", "12 C", etc.
                if (merged.class || merged.className || merged.classLabel) {
                    const canonCls = this.canonicalizeClassName(merged.classLabel || merged.className || merged.class);
                    merged.classLabel = canonCls;
                    merged.className = canonCls;
                    merged.class = canonCls;
                }

                // Canonicalize Subject Name: "10 English" -> "English"
                if (merged.subject) {
                    const sTrim = String(merged.subject).trim();
                    if (sTrim.toLowerCase() === '10 english') {
                        merged.subject = 'English';
                    }
                }

                // Strip incorrect "Grade XII English" mistakenly forced on Class 10
                const isGrade10 = String(merged.classLabel || merged.className || merged.class || '').includes('10');
                if (isGrade10) {
                    if (merged.examName && String(merged.examName).toLowerCase().includes('grade xii english')) {
                        merged.examName = 'Grade 10 English Assessment 2026';
                    }
                    if (merged.templateName && String(merged.templateName).toLowerCase().includes('grade xii english')) {
                        merged.templateName = 'Grade 10 English Assessment 2026';
                    }
                }

                // Harmonize template and exam name if contradictory to the actual paper subject
                if (merged.subject) {
                    const originalTpl = merged.templateName;
                    const originalExam = merged.examName;
                    const originalTplId = merged.templateId;
                    merged.templateName = this.harmonizeTemplateForSubject(merged.templateName, merged.subject);
                    merged.examName = this.harmonizeTemplateForSubject(merged.examName, merged.subject);
                    if (merged.templateId === "mat-x-10th-rev-40" || (merged.templateName === "10 MATHEMATICS - Revision 2 Objective" && !merged.templateId)) {
                        merged.templateId = "mat-x-rev2-40";
                    } else if (merged.templateName === "10 MATHEMATICS - Revision 1 Objective" && !merged.templateId) {
                        merged.templateId = "mat-x-rev1-40";
                    }
                    if (merged.templateName !== originalTpl || merged.examName !== originalExam || merged.templateId !== originalTplId) {
                        try { this._saveEvaluationToIndexedDB(merged); } catch (e) {}
                    }
                }

                return merged;
            });
        }

        // Update memoryStore with latest consolidated list
        if (list && list.length > 0) {
            this.memoryStore = [...list];
            try {
                const summaryList = list.map(e => ({
                    id: e.id,
                    studentName: e.studentName,
                    rollNo: e.rollNo,
                    class: e.class || e.className,
                    className: e.className || e.class,
                    section: e.section,
                    subject: e.subject,
                    examName: e.examName,
                    templateName: e.templateName,
                    obtainedMarks: e.obtainedMarks,
                    maxMarks: e.maxMarks,
                    percentage: e.percentage,
                    status: e.status,
                    pageCount: e.pageCount || (Array.isArray(e.pages) ? e.pages.length : (e.totalPages || 1)),
                    fileSizeBytes: e.fileSizeBytes || 0,
                    pdfStorageUrl: e.pdfStorageUrl || null,
                    isUserUploaded: true,
                    isMock: false
                }));
                localStorage.setItem("niprak_evaluations_summary", JSON.stringify(summaryList));
                localStorage.setItem("onespace_evaluations_summary", JSON.stringify(summaryList));
            } catch (e) {}
        }

        if (bypassFilter) {
            return list;
        }

        return this.filterEvaluationsForUser(list);
    }

    getCurrentUser() {
        try {
            const raw = localStorage.getItem("niprak_active_user") || localStorage.getItem("onespace_active_user");
            if (raw) {
                const u = JSON.parse(raw);
                if (u) {
                    // Synchronize latest allocations from user management storage if available
                    try {
                        const allUsersRaw = localStorage.getItem("niprak_users") || localStorage.getItem("onespace_users");
                        if (allUsersRaw) {
                            const allUsers = JSON.parse(allUsersRaw);
                            if (Array.isArray(allUsers)) {
                                const fresh = allUsers.find(x =>
                                    (x.id && u.id && String(x.id) === String(u.id)) ||
                                    (x.uid && (u.uid || u.id) && String(x.uid) === String(u.uid || u.id)) ||
                                    (x.email && u.email && x.email.toLowerCase() === u.email.toLowerCase()) ||
                                    (x.username && u.username && x.username === u.username)
                                );
                                if (fresh) {
                                    if (Array.isArray(fresh.assignedClasses) && fresh.assignedClasses.length > 0) {
                                        u.assignedClasses = fresh.assignedClasses;
                                    }
                                    if (Array.isArray(fresh.assignedSubjects) && fresh.assignedSubjects.length > 0) {
                                        u.assignedSubjects = fresh.assignedSubjects;
                                    }
                                    if (fresh.subject) u.subject = fresh.subject;
                                    if (fresh.class) u.class = fresh.class;
                                    if (fresh.name) u.name = fresh.name;
                                    if (fresh.role) u.role = fresh.role;
                                }
                            }
                        }
                    } catch (syncErr) {}

                    if (u.subject && (!Array.isArray(u.assignedSubjects) || u.assignedSubjects.length === 0)) {
                        u.assignedSubjects = [u.subject];
                    }
                    if (Array.isArray(u.assignedSubjects) && u.assignedSubjects.length > 0 && !u.subject) {
                        u.subject = u.assignedSubjects[0];
                    }
                    if (u.class && (!Array.isArray(u.assignedClasses) || u.assignedClasses.length === 0)) {
                        u.assignedClasses = [u.class];
                    }
                    if (Array.isArray(u.assignedClasses) && u.assignedClasses.length > 0 && !u.class) {
                        u.class = u.assignedClasses[0];
                    }
                }
                return u;
            }
        } catch (e) {}
        return this.currentUser || null;
    }

    setCurrentUser(user) {
        const prevUser = this.currentUser;
        this.currentUser = user;
        try {
            if (user) {
                const uStr = JSON.stringify(user);
                localStorage.setItem("niprak_active_user", uStr);
                localStorage.setItem("onespace_active_user", uStr);

                // Purge stale session cache if switching to a new account or logging in freshly
                const prevId = prevUser ? (prevUser.id || prevUser.email || prevUser.username) : null;
                const nextId = user.id || user.email || user.username;
                if (!prevId || prevId !== nextId) {
                    sessionStorage.removeItem("niprak_active_subject");
                    sessionStorage.removeItem("onespace_active_subject");
                    sessionStorage.removeItem("niprak_shared_target");
                    sessionStorage.removeItem("onespace_shared_target");
                    sessionStorage.removeItem("niprak_last_uploaded_subject");
                    sessionStorage.removeItem("niprak_last_uploaded_class");
                }
            } else {
                localStorage.removeItem("niprak_active_user");
                localStorage.removeItem("onespace_active_user");
                sessionStorage.removeItem("niprak_active_subject");
                sessionStorage.removeItem("onespace_active_subject");
                sessionStorage.removeItem("niprak_shared_target");
                sessionStorage.removeItem("onespace_shared_target");
                sessionStorage.removeItem("niprak_last_uploaded_subject");
                sessionStorage.removeItem("niprak_last_uploaded_class");
            }
        } catch (e) {}
    }

    canonicalizeClassName(cls) {
        if (!cls) return 'Class 12-A';
        const str = String(cls).trim();
        const norm = str.toLowerCase();
        
        let grade = '';
        const numMatch = norm.match(/\b(10|11|12|9)(?:th|st|nd|rd)?\b/);
        if (numMatch) {
            grade = numMatch[1];
        } else {
            const romanMatch = norm.match(/\b(xii|xi|x|ix)\b/i);
            if (romanMatch) {
                const r = romanMatch[1].toLowerCase();
                if (r === 'xii') grade = '12';
                else if (r === 'xi') grade = '11';
                else if (r === 'x') grade = '10';
                else if (r === 'ix') grade = '9';
            }
        }
        
        let sec = '';
        const cleanAfterGrade = norm.replace(/\b(class|grade|std|standard|sec|section|10th|11th|12th|9th|10|11|12|9|xii|xi|x|ix)\b/gi, '').replace(/[^a-z]/gi, '').trim();
        if (cleanAfterGrade.length === 1 && cleanAfterGrade.toUpperCase() >= 'A' && cleanAfterGrade.toUpperCase() <= 'Z') {
            sec = cleanAfterGrade.toUpperCase();
        } else if (str.includes('-')) {
            const p = str.split('-');
            const cand = p[p.length - 1].trim().toUpperCase();
            if (cand.length === 1 && cand >= 'A' && cand <= 'Z') sec = cand;
        }

        if (grade && sec) {
            return `Class ${grade}-${sec}`;
        }
        if (grade) {
            return `Class ${grade}`;
        }
        return str;
    }

    canonicalizeSubject(sub) {
        if (!sub) return '';
        const s = String(sub).toLowerCase().trim();
        if (s.includes('entrepreneur')) return 'entrepreneurship';
        if (s.includes('business') || s.includes('bst')) return 'business_studies';
        if (s.includes('account')) return 'accountancy';
        if (s.includes('social') || s.includes('sst') || s.includes('soc sci') || s.includes('soc-x') || s.includes('soc-')) return 'social_science';
        if (s.includes('politic') || s.includes('civic') || s.includes('pol sci') || s.includes('pol. sci') || s.includes('pol science') || s.includes('polity') || s === 'pol' || s.startsWith('pol ') || s.endsWith(' pol') || s.includes('pol-') || s === 'ps') return 'political_science';
        if (s.includes('informatics') || s.includes('info prac') || s === 'ip' || s.startsWith('ip ') || s.includes('ip-')) return 'informatics_practices';
        if (s.includes('computer') || s === 'cs' || s.startsWith('cs ') || s.includes('cs-')) return 'computer_science';
        if (s.includes('bio') || s.includes('botany') || s.includes('zoology') || s.includes('life sci') || s.includes('bio-')) return 'biology';
        if (s.includes('chem') || s.includes('che-')) return 'chemistry';
        if (s.includes('physic') || s === 'phy' || s.startsWith('phy ') || s.includes('phy-')) return 'physics';
        if (s.includes('math') || s.includes('mat-x') || s.includes('mat-xii') || s.includes('mat x') || s.includes('mat xii') || s.includes('10th math') || s.includes('10 math') || s === '10th revision' || s === 'revision 2 - objective' || s === 'revision 2 objective') return 'mathematics';
        if (s.includes('english') || s.includes('eng') || s.includes('eng-')) return 'english';
        if (s.includes('econom') || s.includes('ecom') || s === 'eco' || s.startsWith('eco ') || s.endsWith(' eco') || s.includes('eco-') || s.includes('eco_') || s === 'econ' || s === 'ec') return 'economics';
        if (s.includes('histor')) return 'history';
        if (s.includes('geograph')) return 'geography';
        if (s.includes('tamil') || s === 'tam' || s.startsWith('tam ') || s.includes('tam-')) return 'tamil';
        if (s.includes('hindi') || s === 'hin' || s.startsWith('hin ') || s.includes('hin-')) return 'hindi';
        if (s.includes('french')) return 'french';
        if (s.includes('sanskrit')) return 'sanskrit';
        if (s === 'science' || s.startsWith('science ') || s.endsWith(' science') || s.includes('gen sci') || s.includes('general science') || s.includes('natural sci') || s.includes('sci-x') || s.includes('sci-')) return 'science';
        return s.replace(/\s+/g, '_');
    }

    harmonizeTemplateForSubject(templateName, subject, className = '') {
        if (!templateName || !subject) return templateName || '';
        const cleanSub = String(subject).trim();
        const canon = this.canonicalizeSubject(cleanSub);
        const isClass12 = /\b(12|xii|grade\s*12|class\s*12)\b/i.test(String(className || templateName));

        // When the paper is Mathematics:
        if (canon === 'mathematics') {
            const tLower = String(templateName).toLowerCase().trim();
            // Handle Grade 10 Mathematics Revision 2 Objective
            if (
                tLower === '10th revision' ||
                tLower === '10th revision - 2 objective' ||
                tLower === 'revision 2 - objective' ||
                tLower === 'revision 2 objective' ||
                tLower === 'revision 2' ||
                tLower === 'maths revision 2' ||
                tLower.includes('revision 2') ||
                tLower.includes('revision-2') ||
                tLower.includes('rev 2') ||
                tLower.includes('rev2')
            ) {
                return '10 MATHEMATICS - Revision 2 Objective';
            }
            // Handle Grade 10 Mathematics Revision 1 Objective
            if (
                tLower === 'std 10 maths revision 1 - 40 marks' ||
                tLower === 'revision 1 objective 2026' ||
                tLower === 'revision 1 - objective' ||
                tLower === 'revision 1 objective' ||
                tLower === 'revision 1' ||
                tLower === 'maths revision 1' ||
                tLower.includes('revision 1') ||
                tLower.includes('revision-1') ||
                tLower.includes('rev 1') ||
                tLower.includes('rev1')
            ) {
                return '10 MATHEMATICS - Revision 1 Objective';
            }
            return templateName;
        }

        if (canon !== 'mathematics' && /mathematics|maths|math\b/i.test(templateName)) {
            let replaced = templateName.replace(/\b(10th\s+|10\s+|Grade\s+10\s+|STD\s+10\s+)?(MATHEMATICS|MATHS|MATH)\b/gi, (match, prefix) => {
                if (isClass12) {
                    return "Grade 12 " + cleanSub.toUpperCase();
                }
                return (prefix || "") + cleanSub.toUpperCase();
            });
            if (isClass12) {
                replaced = replaced.replace(/\b(10th|10|STD 10)\b/gi, "Grade 12");
            }
            return replaced;
        }

        // If template has "10" but the class is clearly 12th grade, correct the label
        if (isClass12 && /\b(10th\s+|10\s+|Grade\s+10\s+|STD\s+10\s+)/i.test(templateName)) {
            return templateName.replace(/\b(10th\s+|10\s+|Grade\s+10\s+|STD\s+10\s+)/gi, "Grade 12 ");
        }

        return templateName;
    }

    isSubjectMatch(paperSubject, paperExamName, targetSubject, paperTemplateName) {
        if (!targetSubject) return false;
        const tSub = String(targetSubject).toLowerCase().trim();
        if (tSub === 'all' || tSub === 'all subjects') return true;

        const cTarget = this.canonicalizeSubject(tSub);
        if (!cTarget) return false;

        const pSub = (paperSubject || '').toLowerCase().trim();
        const pExam = (paperExamName || '').toLowerCase().trim();
        const pTpl = (paperTemplateName || '').toLowerCase().trim();

        const cPaper = this.canonicalizeSubject(pSub);
        const cExam = this.canonicalizeSubject(pExam);
        const cTpl = this.canonicalizeSubject(pTpl);

        // 1. Direct canonical match from paperSubject, examName, or templateName
        if (cPaper === cTarget || cExam === cTarget || cTpl === cTarget) {
            return true;
        }

        // 2. Strict conflict prevention: If paper has an explicitly identified DIFFERENT standard core subject,
        // and neither the exam nor template points to the target subject, do NOT cross-leak
        const STANDARD_SUBJECTS = new Set([
            'entrepreneurship', 'business_studies', 'accountancy', 'social_science',
            'political_science', 'informatics_practices', 'computer_science', 'biology',
            'chemistry', 'physics', 'mathematics', 'english', 'economics', 'history',
            'geography', 'tamil', 'hindi', 'french', 'sanskrit', 'science'
        ]);
        if (cPaper && STANDARD_SUBJECTS.has(cPaper) && cPaper !== cTarget) {
            if (cExam !== cTarget && cTpl !== cTarget) {
                return false;
            }
        }

        // 3. Combined text scan fallback
        const combined = `${pSub} ${pExam} ${pTpl}`.toLowerCase();
        if (cTarget === 'political_science') {
            return combined.includes('politic') || combined.includes('pol science') || combined.includes('pol sci') || combined.includes('polity') || combined.includes('civic') || combined.includes('pol-');
        }
        if (cTarget === 'social_science') {
            return combined.includes('social') || combined.includes('sst') || combined.includes('soc sci') || combined.includes('soc-x') || combined.includes('soc-');
        }
        if (cTarget === 'biology') {
            return combined.includes('bio') || combined.includes('botany') || combined.includes('zoology') || combined.includes('life sci') || combined.includes('bio-');
        }
        if (cTarget === 'chemistry') {
            return combined.includes('chem') || combined.includes('che-');
        }
        if (cTarget === 'physics') {
            return combined.includes('physic') || combined.includes('phy-') || combined.startsWith('phy ') || combined.endsWith(' phy') || /\bphy\b/.test(combined);
        }
        if (cTarget === 'mathematics') {
            return combined.includes('math') || combined.includes('mat-x') || combined.includes('mat-xii') || combined.includes('mat x') || combined.includes('mat xii') || combined.includes('10th math') || combined.includes('10 math') || combined.includes('10th revision') || (combined.includes('revision 2') && !combined.includes('eco') && !combined.includes('chem') && !combined.includes('phy') && !combined.includes('bio'));
        }
        if (cTarget === 'tamil') {
            return combined.includes('tamil') || combined.includes('tam-') || combined.startsWith('tam ') || combined.endsWith(' tam') || /\btam\b/.test(combined);
        }
        if (cTarget === 'english') {
            return combined.includes('english') || combined.includes('eng') || combined.includes('eng-');
        }
        if (cTarget === 'economics') {
            return combined.includes('econom') || combined.includes('ecom') || /\b(eco|econ)\b/.test(combined);
        }
        if (cTarget === 'history') {
            return combined.includes('histor');
        }
        if (cTarget === 'geography') {
            return combined.includes('geograph');
        }
        if (cTarget === 'business_studies') {
            return combined.includes('business') || combined.includes('bst');
        }
        if (cTarget === 'accountancy') {
            return combined.includes('account');
        }
        if (cTarget === 'computer_science') {
            return combined.includes('computer') || combined.includes('info prac') || combined.includes('ip') || /\bcs\b/.test(combined);
        }
        if (cTarget === 'entrepreneurship') {
            return combined.includes('entrepreneur');
        }
        if (cTarget === 'french') {
            return combined.includes('french') || combined.includes('fre-');
        }
        if (cTarget === 'informatics_practices') {
            return combined.includes('informatics') || combined.includes('info prac') || combined.includes('ip') || combined.includes('ip-');
        }
        if (cTarget === 'science') {
            return (combined.includes('science') || combined.includes('sci-x') || combined.includes('sci-') || combined.includes('gen sci')) && !combined.includes('social') && !combined.includes('political') && !combined.includes('computer');
        }

        return false;
    }

    filterEvaluationsForUser(list) {
        if (!Array.isArray(list)) return [];
        const user = this.getCurrentUser();
        const activePortal = localStorage.getItem("niprak_active_portal") || localStorage.getItem("onespace_active_portal") || "evaluator";

        // Admin or Super Admin role accesses all evaluations across portals
        if (user && (user.role === 'admin' || user.role === 'super_admin')) {
            return list;
        }

        // Exam Officer (uploader) portal or role accesses all evaluations
        if (activePortal === 'uploader' || (user && user.role === 'uploader')) {
            return list;
        }

        // If no user is logged in (guest / demo mode), do not block papers
        if (!user) {
            return list;
        }

        // Teacher / Evaluator role: filter by assigned subject(s) & class(es)
        const isTeacher = user.role === 'evaluator' || user.role === 'teacher';
        if (!isTeacher) {
            return list;
        }

        const teacherUid = user.uid || user.id;
        let assignedSubjects = Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0
            ? [...user.assignedSubjects]
            : (user.subject ? [user.subject] : []);
        const assignedClasses = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];

        // Check if teacher allows all subjects or all classes
        const allowsAllSubjects = assignedSubjects.length === 0 || assignedSubjects.some(s => s === "All Subjects" || s === "all");
        const allowsAllClasses = assignedClasses.length === 0 || assignedClasses.some(c => c === "All Classes" || c === "all");

        if (allowsAllSubjects && allowsAllClasses) {
            return list;
        }

        const filtered = list.filter(e => {
            if (!e) return false;

            // 1. SUBJECT MATCH: Always strictly enforce Authorized Subjects from User Management
            if (!allowsAllSubjects) {
                const subjectMatches = assignedSubjects.some(s => this.isSubjectMatch(e.subject, e.examName, s, e.templateName));
                if (!subjectMatches) return false;
            }

            // Direct teacher assignment takes priority if specifically assigned to this teacher
            if (e.assignedTeacherId && teacherUid && String(e.assignedTeacherId) === String(teacherUid)) {
                return true;
            }

            // User-uploaded real answer scripts of authorized subjects are not blocked by class mismatch
            if (e.isUserUploaded || (!e.isMock && (e.uploadedAt || e.pdfDataUrl || e.pdfStorageUrl || (e.pages && e.pages.length > 0)))) {
                return true;
            }

            // 2. CLASS MATCH (if teacher has specific class restrictions)
            if (!allowsAllClasses) {
                const eClass = (e.class || e.className || e.classLabel || "").toLowerCase().trim();
                if (eClass) {
                    const classMatches = assignedClasses.some(c => {
                        const cLow = c.toLowerCase().trim();
                        if (!cLow) return false;
                        if (eClass === cLow || eClass.includes(cLow) || cLow.includes(eClass)) return true;
                        const cNorm = cLow.replace(/[^a-z0-9]/g, '');
                        const eNorm = eClass.replace(/[^a-z0-9]/g, '');
                        if (cNorm === eNorm || (cNorm && eNorm.includes(cNorm)) || (eNorm && cNorm.includes(eNorm))) return true;
                        const cNum = cLow.match(/\d+/)?.[0];
                        const eNum = eClass.match(/\d+/)?.[0];
                        if (cNum && eNum && cNum === eNum) {
                            const cSec = cLow.match(/[-_\s]([a-z])$/)?.[1];
                            const eSec = eClass.match(/[-_\s]([a-z])$/)?.[1];
                            if (!cSec || !eSec || cSec === eSec) return true;
                        }
                        return false;
                    });
                    if (!classMatches) return false;
                }
            }

            return true;
        });

        // Strict Subject Enforcement: If teacher has assigned subjects, never leak unauthorized subjects!
        if (filtered.length === 0 && list.length > 0) {
            if (!allowsAllSubjects) {
                const subOnlyMatches = list.filter(e => {
                    if (!e) return false;
                    return assignedSubjects.some(s => this.isSubjectMatch(e.subject, e.examName, s, e.templateName));
                });
                return subOnlyMatches;
            }
            return [];
        }

        return filtered;
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

        if (!evalObj && window.firebaseManager) {
            try {
                evalObj = await window.firebaseManager.getEvaluationById(targetId);
                if (!evalObj) {
                    const fbList = await window.firebaseManager.getAllEvaluations();
                    evalObj = fbList.find(e => String(e.id) === targetId) || null;
                }
                if (evalObj) {
                    this._saveEvaluationToIndexedDB(evalObj);
                }
            } catch (e) {}
        }

        // If local record lacks cloud PDF storage URL, fetch latest record from Firebase
        if (evalObj && !evalObj.pdfStorageUrl && !evalObj.pdfDataUrl && (!evalObj.pages || evalObj.pages.length <= 1) && window.firebaseManager) {
            try {
                const cloudObj = await window.firebaseManager.getEvaluationById(targetId);
                if (cloudObj && cloudObj.pdfStorageUrl) {
                    evalObj = Object.assign({}, evalObj, cloudObj);
                    this._saveEvaluationToIndexedDB(evalObj);
                }
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

            // 1. Recover pages and pdfDataUrl from CacheStorage / Memory Cache if missing
            const cached = await this.getPdfCache(id);
            if (cached) {
                if ((!evalObj.pages || evalObj.pages.length === 0) && cached.pages && cached.pages.length > 0) {
                    evalObj.pages = cached.pages;
                }
                if (!evalObj.pdfDataUrl && cached.pdfDataUrl) {
                    evalObj.pdfDataUrl = cached.pdfDataUrl;
                }
            }

            // 2. Only use remote pdfStorageUrl if we do NOT have local pages or local data URL
            const hasLocalPages = Array.isArray(evalObj.pages) && evalObj.pages.length > 0 && evalObj.pages.some(p => p && typeof p === 'string' && (p.startsWith('data:') || p.startsWith('blob:')));
            const hasLocalPdf = evalObj.pdfDataUrl && typeof evalObj.pdfDataUrl === 'string' && (evalObj.pdfDataUrl.startsWith('data:') || evalObj.pdfDataUrl.startsWith('blob:'));

            if (!hasLocalPages && !hasLocalPdf && evalObj.pdfStorageUrl) {
                if (!evalObj.pages || evalObj.pages.length === 0) {
                    evalObj.pages = [evalObj.pdfStorageUrl];
                }
                if (!evalObj.pdfDataUrl) {
                    evalObj.pdfDataUrl = evalObj.pdfStorageUrl;
                }
            } else if (hasLocalPdf && (!evalObj.pages || evalObj.pages.length === 0)) {
                evalObj.pages = [evalObj.pdfDataUrl];
            }
            if (!evalObj.pages) evalObj.pages = evalObj.pdfDataUrl ? [evalObj.pdfDataUrl] : [];
        } else {
            evalObj = this.getDraft(id);
        }

        if (evalObj && evalObj.subject) {
            evalObj.templateName = this.harmonizeTemplateForSubject(evalObj.templateName, evalObj.subject);
            evalObj.examName = this.harmonizeTemplateForSubject(evalObj.examName, evalObj.subject);
        }

        return evalObj ? JSON.parse(JSON.stringify(evalObj)) : null;
    }

    formatStorageSize(bytes) {
        const b = Number(bytes) || 0;
        if (b <= 0) return "0 KB";
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
        if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
        return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    measurePaperBytesSync(ev) {
        if (!ev) return 0;
        if (ev.rawScansPurged) {
            return Math.max(1024, Number(ev.fileSizeBytes) || 2048);
        }
        let bytes = 0;
        const cached = this.pdfCacheMap ? this.pdfCacheMap.get(String(ev.id)) : null;
        const pdfStr = ev.pdfDataUrl || (cached && cached.pdfDataUrl) || null;
        const pagesArr = (Array.isArray(ev.pages) && ev.pages.length > 0) ? ev.pages : (cached && Array.isArray(cached.pages) ? cached.pages : null);

        if (typeof pdfStr === "string" && pdfStr.startsWith("data:")) {
            const commaIdx = pdfStr.indexOf(",");
            const base64Len = commaIdx >= 0 ? (pdfStr.length - commaIdx - 1) : pdfStr.length;
            bytes += Math.round(base64Len * 0.75);
        } else if (Array.isArray(pagesArr) && pagesArr.length > 0) {
            for (const p of pagesArr) {
                if (typeof p === "string" && p.startsWith("data:")) {
                    const commaIdx = p.indexOf(",");
                    const base64Len = commaIdx >= 0 ? (p.length - commaIdx - 1) : p.length;
                    bytes += Math.round(base64Len * 0.75);
                }
            }
        }

        if (bytes === 0 && ev.rawFile && ev.rawFile.size) {
            bytes = Number(ev.rawFile.size) || 0;
        }
        if (bytes === 0 && ev.fileSizeBytes && Number(ev.fileSizeBytes) > 0) {
            bytes = Number(ev.fileSizeBytes);
        }

        // Add lightweight JSON metadata & annotations overhead
        try {
            const metaStr = JSON.stringify({
                id: ev.id,
                studentName: ev.studentName,
                rollNo: ev.rollNo,
                questions: ev.questions || [],
                annotations: ev.annotations || []
            });
            bytes += metaStr.length;
        } catch (e) {}

        // Fallback if remote/cloud-only paper without local binary loaded yet
        if (bytes < 4096) {
            const pCount = ev.pageCount || (Array.isArray(pagesArr) ? pagesArr.length : (ev.totalPages || 1));
            bytes += pCount * 165 * 1024; // ~165 KB per compressed page
        }

        return bytes;
    }

    async saveEvaluation(evaluation) {
        if (!this.isReady) await this.readyPromise;

        // Calculate and persist exact paper byte size & page count before stripping pages
        if (!evaluation.pageCount) {
            evaluation.pageCount = Array.isArray(evaluation.pages) && evaluation.pages.length > 0
                ? evaluation.pages.length
                : (evaluation.totalPages || 1);
        }
        const measuredBytes = this.measurePaperBytesSync(evaluation);
        if (measuredBytes > 0) {
            evaluation.fileSizeBytes = measuredBytes;
        }

        if (!evaluation.pdfDataUrl && evaluation.pages && evaluation.pages.length === 1 && typeof evaluation.pages[0] === 'string' && evaluation.pages[0].startsWith('data:application/pdf')) {
            evaluation.pdfDataUrl = evaluation.pages[0];
        }

        const cachePayload = {
            pdfDataUrl: evaluation.pdfDataUrl || null,
            pdfStorageUrl: evaluation.pdfStorageUrl || null,
            pages: Array.isArray(evaluation.pages) && evaluation.pages.length > 0 ? evaluation.pages : []
        };

        await this.storePdfCache(evaluation.id, cachePayload);

        // Perform cloud sync with Firebase
        if (window.firebaseManager) {
            try {
                const hasRawFile = !!(evaluation.rawFile || (evaluation.pdfDataUrl && evaluation.pdfDataUrl.startsWith("data:")));
                if (hasRawFile) {
                    await window.firebaseManager.ensureReady(3500);
                    if (window.firebaseManager.isConnected || window.firebaseManager.firestore) {
                        await window.firebaseManager.saveEvaluation(evaluation);
                    }
                } else {
                    // For lightweight autosave strokes, sync in background to keep UI silky smooth
                    window.firebaseManager.ensureReady(2000).then(ready => {
                        if (ready || window.firebaseManager.isConnected) {
                            window.firebaseManager.saveEvaluation(evaluation).catch(fbErr => {
                                console.warn("Background cloud sync warning:", fbErr);
                            });
                        }
                    }).catch(() => {});
                }
            } catch (syncErr) {
                console.warn("Cloud sync error in saveEvaluation:", syncErr);
            }
        }

        return this._putDirect(evaluation);
    }

    /**
     * Persists multiple evaluations into memoryStore, IndexedDB, and localStorage summaries.
     */
    async saveAllEvaluations(evaluations) {
        if (!Array.isArray(evaluations)) return [];
        if (!this.isReady) await this.readyPromise;

        for (const ev of evaluations) {
            if (ev && ev.id) {
                this._putDirect(ev);
                this._saveEvaluationToIndexedDB(ev);
            }
        }
        return evaluations;
    }

    _putDirect(evaluation) {
        evaluation.updatedAt = new Date().toISOString();
        if (!evaluation.createdAt) {
            evaluation.createdAt = new Date().toISOString();
        }

        // Clear any previous tombstone since user is creating/saving this paper
        this._clearDeletedId(evaluation.id);

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
                pageCount: e.pageCount || (Array.isArray(e.pages) ? e.pages.length : (e.totalPages || 1)),
                fileSizeBytes: e.fileSizeBytes || 0,
                pdfStorageUrl: e.pdfStorageUrl || null,
                isUserUploaded: true,
                isMock: false
            }));
            localStorage.setItem("niprak_evaluations_summary", JSON.stringify(summaryList));
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
                // CRITICAL: Preserve cleanRecord.pages so local rendered scans are never stripped
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

        // Record permanent tombstone so cloud background sync never resurrects this deleted paper
        this._recordDeletedId(targetId);

        // 1. Remove from in-memory cache and map
        this.memoryStore = (this.memoryStore || []).filter(e => String(e.id) !== targetId);
        if (this.pdfCacheMap) {
            this.pdfCacheMap.delete(targetId);
        }

        // 2. Remove from localStorage
        try {
            for (const key of ["niprak_evaluations", "onespace_evaluations", "niprak_evaluations_summary", "onespace_evaluations_summary"]) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const arr = JSON.parse(raw).filter(e => String(e.id) !== targetId);
                    localStorage.setItem(key, JSON.stringify(arr));
                }
            }
        } catch (e) {
            console.warn("localStorage delete evaluation error:", e);
        }

        // 3. Remove from sessionStorage
        try {
            sessionStorage.removeItem(`niprak_draft_${targetId}`);
            sessionStorage.removeItem(`onespace_draft_${targetId}`);
            sessionStorage.removeItem(`niprak_pdf_${targetId}`);
            sessionStorage.removeItem(`onespace_pdf_${targetId}`);
        } catch (e) {}

        // 4. Remove from CacheStorage (PDF binary cache)
        try {
            if ('caches' in window) {
                for (const cName of ["niprak-pdf-cache-v1", "onespace-pdf-cache-v1"]) {
                    try {
                        const cache = await caches.open(cName);
                        await cache.delete(`/pdf-cache/${targetId}`);
                    } catch (e) {}
                }
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

        // Notify app to refresh storage display if available
        if (window.app && typeof window.app.updateStorageQuotaDisplay === "function") {
            window.app.updateStorageQuotaDisplay();
        }

        return true;
    }

    // --- Role-Aware Accurate Storage Usage & Paper Size Calculator (KB / MB / GB) ---
    async getStorageUsage() {
        if (!this.isReady) await this.readyPromise;

        // Ensure we have current evaluations loaded from IndexedDB if memoryStore is empty
        let allPapers = Array.isArray(this.memoryStore) && this.memoryStore.length > 0 ? [...this.memoryStore] : [];
        if (allPapers.length === 0 && this.db) {
            try {
                allPapers = await new Promise((resolve) => {
                    const tx = this.db.transaction(["evaluations"], "readonly");
                    const store = tx.objectStore("evaluations");
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                });
                if (this.deletedEvaluations && this.deletedEvaluations.size > 0) {
                    allPapers = allPapers.filter(e => e && e.id && !this.deletedEvaluations.has(String(e.id)));
                }
                if (allPapers.length > 0) {
                    this.memoryStore = [...allPapers];
                }
            } catch (e) {}
        }

        // Filter papers for the active user (Teacher sees ONLY their own assigned papers; Uploader/Admin sees all)
        const userPapers = this.filterEvaluationsForUser(allPapers);

        let userUsedBytes = 0;
        let completedBytes = 0;
        let pendingBytes = 0;
        let completedCount = 0;
        let pendingCount = 0;
        let totalPagesCount = 0;

        const papersWithSize = [];

        for (const ev of userPapers) {
            if (!ev || !ev.id) continue;
            // Warm pdfCacheMap from CacheStorage if not yet loaded and no fileSizeBytes cached
            if (!ev.fileSizeBytes && !ev.pdfDataUrl && (!ev.pages || ev.pages.length === 0) && !this.pdfCacheMap.has(String(ev.id))) {
                try {
                    await this.getPdfCache(ev.id);
                } catch (e) {}
            }

            const sizeBytes = this.measurePaperBytesSync(ev);
            ev.fileSizeBytes = sizeBytes;
            const pageCount = ev.pageCount || (Array.isArray(ev.pages) ? ev.pages.length : (ev.totalPages || 1));
            totalPagesCount += pageCount;
            userUsedBytes += sizeBytes;

            const isComp = ev.status === "Completed" || ev.status === "Corrected" || ev.status === "Graded" || ev.status === "Evaluated";
            if (isComp) {
                completedBytes += sizeBytes;
                completedCount++;
            } else {
                pendingBytes += sizeBytes;
                pendingCount++;
            }

            papersWithSize.push({
                id: ev.id,
                studentName: ev.studentName || "Unnamed Student",
                rollNo: ev.rollNo || "—",
                className: ev.className || ev.class || "Class 12-A",
                subject: ev.subject || "General",
                examName: ev.examName || ev.templateName || "Examination",
                status: isComp ? "Completed" : "Pending",
                obtainedMarks: ev.obtainedMarks,
                maxMarks: ev.maxMarks,
                pageCount,
                sizeBytes,
                sizeFormatted: this.formatStorageSize(sizeBytes)
            });
        }

        // Also compute total system bytes across all papers (for Admin / Uploader)
        let systemUsedBytes = 0;
        for (const ev of allPapers) {
            if (!ev || !ev.id) continue;
            systemUsedBytes += (ev.fileSizeBytes || this.measurePaperBytesSync(ev));
        }

        const user = this.getCurrentUser();
        const activePortal = localStorage.getItem("niprak_active_portal") || localStorage.getItem("onespace_active_portal") || "evaluator";
        const isTeacher = (user && user.role === "evaluator") || (!user && activePortal === "evaluator") || activePortal === "evaluator";

        const effectiveUsedBytes = isTeacher ? userUsedBytes : systemUsedBytes;
        const limitBytes = 50 * 1024 * 1024 * 1024; // 50 GB institution ceiling
        const usedMB = parseFloat((effectiveUsedBytes / (1024 * 1024)).toFixed(2));
        const usedGB = parseFloat((effectiveUsedBytes / (1024 * 1024 * 1024)).toFixed(3));
        const totalGB = 50;
        const remainingGB = parseFloat(Math.max(0, totalGB - usedGB).toFixed(2));
        const percentUsed = effectiveUsedBytes > 0
            ? Math.min(100, Math.max(0.1, parseFloat(((effectiveUsedBytes / limitBytes) * 100).toFixed(2))))
            : 0;

        return {
            isTeacher,
            usedBytes: effectiveUsedBytes,
            formattedUsed: this.formatStorageSize(effectiveUsedBytes),
            userUsedBytes,
            userFormatted: this.formatStorageSize(userUsedBytes),
            completedBytes,
            completedFormatted: this.formatStorageSize(completedBytes),
            completedCount,
            pendingBytes,
            pendingFormatted: this.formatStorageSize(pendingBytes),
            pendingCount,
            totalPapersCount: papersWithSize.length,
            totalPagesCount,
            papersWithSize,
            limitBytes,
            usedMB,
            usedGB,
            totalGB,
            remainingGB,
            percentUsed,
            isNearLimit: percentUsed >= 90,
            isExceeded: effectiveUsedBytes >= limitBytes
        };
    }

    saveDraft(id, evaluation) {
        if (!id || !evaluation) return;
        try {
            const evStr = JSON.stringify(evaluation);
            sessionStorage.setItem(`niprak_draft_${id}`, evStr);
            sessionStorage.setItem(`onespace_draft_${id}`, evStr);
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
            const raw = sessionStorage.getItem(`niprak_draft_${id}`) || sessionStorage.getItem(`onespace_draft_${id}`);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return this.memoryStore.find(e => e.id === id) || null;
    }

    async getSettings() {
        await this.readyPromise;
        const activeUser = this.getCurrentUser();
        const activeSub = (activeUser && activeUser.assignedSubjects && activeUser.assignedSubjects.length > 0)
            ? activeUser.assignedSubjects[0]
            : (activeUser?.subject || "");
        const defaultTeacherName = activeUser?.name || "Subject Evaluator";

        const defaultSettings = {
            institution: {
                name: "",
                logo: "assets/school_logo.jpg",
                fullLogo: "assets/school_fulllogo.jpg"
            },
            teacher: { name: defaultTeacherName },
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

        let result = defaultSettings;
        if (window.firebaseManager && window.firebaseManager.isConnected && typeof window.firebaseManager.getSettings === "function") {
            try {
                const fbSettings = await window.firebaseManager.getSettings();
                if (fbSettings) result = { ...defaultSettings, ...fbSettings };
            } catch (e) {
                console.warn("Firebase getSettings fallback warning:", e);
            }
        } else {
            try {
                const raw = localStorage.getItem("niprak_settings") || localStorage.getItem("onespace_settings");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    result = { ...defaultSettings, ...parsed };
                }
            } catch (e) {
                console.error("Error reading settings", e);
            }
        }

        // Evaluator Full Name should reflect custom account name or active subject
        const isTeacherRole = activeUser && (activeUser.role === 'evaluator' || activeUser.role === 'teacher');
        if (isTeacherRole || !result.teacher?.name) {
            result.teacher = Object.assign({}, result.teacher, {
                name: activeUser?.name || result.teacher?.name || "Subject Evaluator"
            });
        }
        return result;
    }

    async saveSettings(settings) {
        await this.readyPromise;
        try {
            const str = JSON.stringify(settings);
            localStorage.setItem("niprak_settings", str);
            localStorage.setItem("onespace_settings", str);
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
            const draftPayload = JSON.stringify({
                data: cleanDraft,
                timestamp: Date.now()
            });
            sessionStorage.setItem(`niprak_draft_${evalId}`, draftPayload);
            sessionStorage.setItem(`onespace_draft_${evalId}`, draftPayload);
        } catch (e) {
            // Silently ignore session quota
        }
    }

    getDraft(evalId) {
        try {
            const raw = sessionStorage.getItem(`niprak_draft_${evalId}`) || sessionStorage.getItem(`onespace_draft_${evalId}`);
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
            sessionStorage.removeItem(`niprak_draft_${evalId}`);
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

        try {
            const raw = localStorage.getItem(`niprak_roster_${classId}`) || localStorage.getItem(`onespace_roster_${classId}`);
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
        try {
            const rStr = JSON.stringify(roster);
            localStorage.setItem(`niprak_roster_${classId}`, rStr);
            localStorage.setItem(`onespace_roster_${classId}`, rStr);
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
                if (key.startsWith("niprak_roster_") || key.startsWith("onespace_roster_")) {
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

    syncCatalogBlueprints(catalog) {
        if (!Array.isArray(catalog) || catalog.length === 0) return { catalog, modified: false };
        let modified = false;

        // 1. Synchronize Mathematics
        let mathSub = catalog.find(s => s && (s.id === 'mat' || (s.name && s.name.toLowerCase().trim() === 'mathematics')));
        if (!mathSub) {
            mathSub = {
                id: "mat",
                name: "Mathematics",
                code: "MAT-301",
                badge: "4 Templates",
                description: "Class 10 & 12 Mathematics Assessments & 10th Revision",
                templates: []
            };
            catalog.push(mathSub);
            modified = true;
        }

        if (!Array.isArray(mathSub.templates)) {
            mathSub.templates = [];
            modified = true;
        }

        const mathRev1Blueprint = window.MockData?.mathGrade10Revision1Template;
        const mathRev2Blueprint = window.MockData?.mathGrade10Revision2Template;

        // Target Revision 2 Blueprint
        const targetRev2 = {
            id: "mat-x-rev2-40",
            name: "10 MATHEMATICS - Revision 2 Objective",
            examName: "Revision 2 - Objective",
            subject: "Mathematics",
            maxMarks: 40,
            duration: "1 Hour",
            badge: "Revision 2 Blueprint",
            sections: mathRev2Blueprint ? JSON.parse(JSON.stringify(mathRev2Blueprint.sections)) : [
                { id: "sec_a", letter: "A", name: "Section A", title: "Sec A: 28 Qs (28M)", qStartNo: 1, qEndNo: 28, qCount: 28, marksPerQ: 1, maxMarks: 28, secTotal: 28, hasChoice: false, hasSubQuestions: false, subQuestions: [] },
                {
                    id: "sec_b", letter: "B", name: "Section B", title: "Sec B: 3 Qs (12M)", qStartNo: 29, qEndNo: 31, qCount: 3, marksPerQ: 4, maxMarks: 12, secTotal: 12, hasChoice: false, hasSubQuestions: true, subQuestionNumbers: "Q29, Q30, Q31",
                    subQuestions: [
                        { id: "i", subId: "i", letter: "i", label: "(i)", marks: 1, maxMarks: 1, awardedMarks: 0, hasChoice: false, isChoice: false },
                        { id: "ii", subId: "ii", letter: "ii", label: "(ii)", marks: 1, maxMarks: 1, awardedMarks: 0, hasChoice: false, isChoice: false },
                        { id: "iii", subId: "iii", letter: "iii", label: "(iii) [Either (a) or (b)]", marks: 2, maxMarks: 2, awardedMarks: 0, hasChoice: true, isChoice: true, choiceLabel: "Either (a) or (b)", choices: ["Option (a)", "Option (b)"], selectedChoice: "Option (a)" }
                    ]
                }
            ],
            questions: mathRev2Blueprint ? JSON.parse(JSON.stringify(mathRev2Blueprint.questions)) : []
        };

        // Check for Revision 2 in mathSub.templates
        let rev2Idx = mathSub.templates.findIndex(t => 
            t && (
                t.id === "mat-x-rev2-40" || 
                t.id === "mat-x-10th-rev-40" ||
                t.name === "10 MATHEMATICS - Revision 2 Objective" ||
                t.name === "10th Revision" ||
                t.examName === "10th Revision - 2 Objective" ||
                t.examName === "Revision 2 - Objective" ||
                (t.name && t.name.toLowerCase().includes("revision 2")) ||
                (t.examName && t.examName.toLowerCase().includes("revision 2"))
            )
        );

        if (rev2Idx === -1) {
            // Find Revision 1 to insert right after, or unshift
            const rev1Idx = mathSub.templates.findIndex(t => t && (t.id === "mat-x-rev1-40" || (t.name && t.name.toLowerCase().includes("revision 1"))));
            if (rev1Idx !== -1) {
                mathSub.templates.splice(rev1Idx + 1, 0, targetRev2);
            } else {
                mathSub.templates.unshift(targetRev2);
            }
            modified = true;
        } else {
            const curr = mathSub.templates[rev2Idx];
            if (curr.id !== targetRev2.id || curr.name !== targetRev2.name || curr.examName !== targetRev2.examName || curr.maxMarks !== 40 || !curr.questions || curr.questions.length !== 31) {
                mathSub.templates[rev2Idx] = Object.assign({}, curr, targetRev2);
                modified = true;
            }
        }

        // Target Revision 1 Blueprint
        const targetRev1 = {
            id: "mat-x-rev1-40",
            name: "10 MATHEMATICS - Revision 1 Objective",
            examName: "Revision 1 Objective 2026",
            subject: "Mathematics",
            maxMarks: 40,
            duration: "1 Hour",
            badge: "Revision 1 Blueprint",
            sections: mathRev1Blueprint ? JSON.parse(JSON.stringify(mathRev1Blueprint.sections)) : [],
            questions: mathRev1Blueprint ? JSON.parse(JSON.stringify(mathRev1Blueprint.questions)) : []
        };
        let rev1Idx = mathSub.templates.findIndex(t => 
            t && (
                t.id === "mat-x-rev1-40" || 
                t.name === "10 MATHEMATICS - Revision 1 Objective" ||
                t.name === "STD 10 Maths REVISION 1 - 40 marks" ||
                t.examName === "Revision 1 Objective 2026" ||
                (t.name && t.name.toLowerCase().includes("revision 1") && t.name.toLowerCase().includes("math"))
            )
        );
        if (rev1Idx === -1) {
            mathSub.templates.unshift(targetRev1);
            modified = true;
        } else {
            const curr = mathSub.templates[rev1Idx];
            if (curr.id !== targetRev1.id || curr.name !== targetRev1.name || curr.maxMarks !== 40 || !curr.questions || curr.questions.length !== 31) {
                mathSub.templates[rev1Idx] = Object.assign({}, curr, targetRev1);
                modified = true;
            }
        }

        // Deduplicate Mathematics templates
        const seenIds = new Set();
        const initialCount = mathSub.templates.length;
        mathSub.templates = mathSub.templates.filter(t => {
            if (!t) return false;
            if (t.id === "mat-x-10th-rev-40" || (t.name === "10th Revision" && t.id !== "mat-x-rev2-40")) {
                return false;
            }
            if (seenIds.has(t.id)) return false;
            seenIds.add(t.id);
            return true;
        });
        if (mathSub.templates.length !== initialCount) {
            modified = true;
        }

        const tplCount = mathSub.templates.length;
        mathSub.badge = tplCount === 1 ? "1 Template" : `${tplCount} Templates`;

        // Clean up hardcoded placeholder "Standard Assessment" templates across all subjects if other templates exist
        catalog.forEach(sub => {
            if (sub && Array.isArray(sub.templates) && sub.templates.length > 1) {
                const initialLen = sub.templates.length;
                sub.templates = sub.templates.filter(t => {
                    if (!t) return false;
                    const tName = (t.name || "").toLowerCase().trim();
                    return !(tName.includes("standard assessment") && t.maxMarks === 50);
                });
                if (sub.templates.length !== initialLen) {
                    modified = true;
                    sub.badge = sub.templates.length === 1 ? "1 Template" : `${sub.templates.length} Templates`;
                }
            }
        });

        return { catalog, modified };
    }

    async getSubjectCatalog() {
        await this.readyPromise;
        let catalog = null;
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbCatalog = await window.firebaseManager.getSubjectCatalog();
                if (fbCatalog) catalog = fbCatalog;
            } catch (e) {}
        }

        if (!catalog) {
            try {
                const raw = localStorage.getItem("niprak_custom_catalog") || localStorage.getItem("onespace_custom_catalog");
                if (raw) catalog = JSON.parse(raw);
            } catch (e) {
                console.error("Error loading custom catalog", e);
            }
        }

        if (!catalog && window.uploadPortal && window.uploadPortal.catalog) {
            catalog = window.uploadPortal.catalog;
        }

        if (catalog && Array.isArray(catalog) && catalog.length > 0) {
            const syncResult = this.syncCatalogBlueprints(catalog);
            if (syncResult && syncResult.modified) {
                try {
                    await this.saveSubjectCatalog(syncResult.catalog);
                } catch (e) {}
            }
            return syncResult ? syncResult.catalog : catalog;
        }

        return null;
    }

    async saveSubjectCatalog(catalog) {
        await this.readyPromise;
        // Strip svgIcon and iconColor - keep them strictly in code to eliminate database storage and transfer costs
        const cleanCatalog = Array.isArray(catalog) ? catalog.map(sub => {
            if (!sub || typeof sub !== 'object') return sub;
            const copy = Object.assign({}, sub);
            delete copy.svgIcon;
            delete copy.iconColor;
            return copy;
        }) : catalog;

        try {
            const catStr = JSON.stringify(cleanCatalog);
            localStorage.setItem("niprak_custom_catalog", catStr);
            localStorage.setItem("onespace_custom_catalog", catStr);
        } catch (e) {
            console.error("Error saving custom catalog", e);
        }
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                await window.firebaseManager.saveSubjectCatalog(cleanCatalog);
            } catch (e) {}
        }
        return cleanCatalog;
    }

    async getClassesList() {
        await this.readyPromise;
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbClasses = await window.firebaseManager.getClassesList();
                if (fbClasses) return fbClasses;
            } catch (e) {}
        }

        try {
            const raw = localStorage.getItem("niprak_custom_classes") || localStorage.getItem("onespace_custom_classes");
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Error loading custom classes", e);
        }
        return null;
    }

    async saveClassesList(classes) {
        await this.readyPromise;
        try {
            const clsStr = JSON.stringify(classes);
            localStorage.setItem("niprak_custom_classes", clsStr);
            localStorage.setItem("onespace_custom_classes", clsStr);
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
        return localStorage.getItem("niprak_user_password") || localStorage.getItem("onespace_user_password") || "";
    }

    async saveUserPassword(password) {
        await this.readyPromise;
        localStorage.setItem("niprak_user_password", password);
        localStorage.setItem("onespace_user_password", password);
        return true;
    }

    async getUsersList() {
        await this.readyPromise;
        let users = [];
        if (window.firebaseManager && window.firebaseManager.isConnected) {
            try {
                const fbUsers = await window.firebaseManager.getUsersList();
                if (fbUsers && Array.isArray(fbUsers)) users = fbUsers;
            } catch (e) {}
        }

        if (users.length === 0) {
            try {
                const raw = localStorage.getItem("niprak_users") || localStorage.getItem("onespace_users");
                if (raw) users = JSON.parse(raw);
            } catch (e) {
                console.error("Error loading users", e);
            }
        }

        // Ensure Super Admin account (iamnithyaprakash@gmail.com) always exists
        const superAdminEmail = "iamnithyaprakash@gmail.com";
        const hasSuperAdmin = users.some(u => u && (u.email === superAdminEmail || u.username === "iamnithyaprakash"));
        if (!hasSuperAdmin) {
            const superAdminObj = {
                id: "usr_super_admin",
                uid: "usr_super_admin",
                name: "Nithya Prakash (Super Admin)",
                username: "iamnithyaprakash",
                email: superAdminEmail,
                password: superAdminEmail,
                role: "super_admin",
                roleLabel: "Super Admin (Owner)",
                status: "active",
                assignedSubjects: ["All Subjects"],
                assignedClasses: ["All Classes"],
                createdAt: new Date().toISOString()
            };
            users.unshift(superAdminObj);
            try {
                const uStr = JSON.stringify(users);
                localStorage.setItem("niprak_users", uStr);
                localStorage.setItem("onespace_users", uStr);
            } catch (e) {}
        }
        return users;
    }

    async saveUsersList(users) {
        await this.readyPromise;
        try {
            const uStr = JSON.stringify(users);
            localStorage.setItem("niprak_users", uStr);
            localStorage.setItem("onespace_users", uStr);
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

    // --- Platform License & Subscription Locking Engine ---

    async getLicenseConfig() {
        await this.readyPromise;
        // Default 4 months active period starting from now
        const now = new Date();
        const fourMonthsAhead = new Date(now.getTime() + (120 * 24 * 60 * 60 * 1000));

        const defaultLicense = {
            status: "active", // "active" | "locked" | "expired"
            isManuallyLocked: false,
            activatedAt: now.toISOString(),
            expiresAt: fourMonthsAhead.toISOString(),
            planPeriod: "4_months", // "1_month" | "3_months" | "4_months" | "6_months" | "1_year" | "custom"
            planDurationDays: 120,
            institutionName: "Adwaith Thought Academy",
            contactEmail: "iamnithyaprakash@gmail.com",
            contactPhone: "+91 98765 43210",
            paymentQrUrl: "", // Custom QR image data URL or image path
            bankDetails: {
                accountName: "Nithya Prakash",
                accountNumber: "50100234567890",
                ifscCode: "HDFC0001234",
                bankName: "HDFC Bank",
                upiId: "iamnithyaprakash@okhdfcbank"
            },
            lockoutMessage: "Your institutional subscription license for Niprak OSM has expired or access has been temporarily restricted. To renew or reactivate full access for 3 or 4 months, please scan the UPI QR code below or transfer to our bank account and contact Mr. Nithya Prakash."
        };

        if (window.firebaseManager && window.firebaseManager.isConnected && typeof window.firebaseManager.getLicenseConfig === "function") {
            try {
                const fbLic = await window.firebaseManager.getLicenseConfig();
                if (fbLic) return { ...defaultLicense, ...fbLic };
            } catch (e) {}
        }

        try {
            const raw = localStorage.getItem("niprak_license_config") || localStorage.getItem("onespace_license_config");
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...defaultLicense, ...parsed };
            }
        } catch (e) {}

        await this.saveLicenseConfig(defaultLicense);
        return defaultLicense;
    }

    async saveLicenseConfig(license) {
        await this.readyPromise;
        try {
            const str = JSON.stringify(license);
            localStorage.setItem("niprak_license_config", str);
            localStorage.setItem("onespace_license_config", str);
        } catch (e) {
            console.error("Error saving license config", e);
        }
        if (window.firebaseManager && window.firebaseManager.isConnected && typeof window.firebaseManager.saveLicenseConfig === "function") {
            try {
                await window.firebaseManager.saveLicenseConfig(license);
            } catch (e) {}
        }
        return license;
    }

    async isPlatformLocked() {
        const license = await this.getLicenseConfig();
        const user = this.getCurrentUser();

        // Super Admin (Owner) is NEVER locked out under any circumstance!
        if (user && (user.role === "super_admin" || (user.email && user.email.toLowerCase() === "iamnithyaprakash@gmail.com"))) {
            return { locked: false, reason: null, license };
        }

        // 1. Check manual kill switch
        if (license.isManuallyLocked === true) {
            return { locked: true, reason: "manual", license };
        }

        // 2. Check expiration timestamp
        if (license.expiresAt) {
            const expiryTime = new Date(license.expiresAt).getTime();
            if (Date.now() > expiryTime) {
                return { locked: true, reason: "expired", license };
            }
        }

        return { locked: false, reason: null, license };
    }

    // --- Purge Raw PDF Scans for Storage Optimization (Retains Student Marks & Scorecard) ---
    async purgeRawPdfScansForPapers(paperIds) {
        if (!Array.isArray(paperIds) || paperIds.length === 0) return { purgedCount: 0, reclaimedBytes: 0 };
        await this.readyPromise;
        let purgedCount = 0;
        let reclaimedBytes = 0;

        for (const rawId of paperIds) {
            const id = String(rawId);
            try {
                // 1. Remove binary cache entry in memory
                if (this.pdfCacheMap) {
                    this.pdfCacheMap.delete(id);
                }

                // 2. Clear browser CacheStorage entries
                if ('caches' in window) {
                    for (const cName of ["niprak-pdf-cache-v1", "onespace-pdf-cache-v1"]) {
                        try {
                            const cache = await caches.open(cName);
                            await cache.delete(`/pdf-cache/${id}`);
                        } catch (e) {}
                    }
                }

                // 3. Clear session draft
                try {
                    sessionStorage.removeItem(`niprak_draft_${id}`);
                    sessionStorage.removeItem(`onespace_draft_${id}`);
                } catch (e) {}

                // 4. Retrieve evaluation record
                const ev = await this.getEvaluationById(id);
                if (ev) {
                    const originalBytes = this.measurePaperBytesSync(ev);
                    ev.rawScansPurged = true;
                    ev.pdfDataUrl = null;
                    delete ev.pdfDataUrl;
                    ev.pages = [];
                    delete ev.pages;
                    if (ev.rawFile) delete ev.rawFile;
                    ev.fileSizeBytes = 2048; // lightweight metadata footprint
                    reclaimedBytes += Math.max(0, originalBytes - 2048);

                    // Update memory store
                    const memIdx = this.memoryStore.findIndex(m => String(m.id) === id);
                    if (memIdx >= 0) {
                        this.memoryStore[memIdx] = ev;
                    }

                    // Update IndexedDB
                    if (this.db) {
                        await new Promise((resolve) => {
                            try {
                                const tx = this.db.transaction(["evaluations"], "readwrite");
                                const store = tx.objectStore("evaluations");
                                const req = store.put(ev);
                                req.onsuccess = () => resolve();
                                req.onerror = () => resolve();
                            } catch (e) { resolve(); }
                        });
                    }

                    // Update LocalStorage summary if stored there
                    try {
                        const raw = localStorage.getItem("niprak_evaluations_summary") || localStorage.getItem("onespace_evaluations_summary");
                        if (raw) {
                            let list = JSON.parse(raw);
                            if (Array.isArray(list)) {
                                const lIdx = list.findIndex(e => String(e.id) === id);
                                if (lIdx >= 0) {
                                    list[lIdx].rawScansPurged = true;
                                    list[lIdx].fileSizeBytes = 2048;
                                    delete list[lIdx].pdfDataUrl;
                                    delete list[lIdx].pages;
                                    const json = JSON.stringify(list);
                                    localStorage.setItem("niprak_evaluations_summary", json);
                                    localStorage.setItem("onespace_evaluations_summary", json);
                                }
                            }
                        }
                    } catch (e) {}

                    purgedCount++;
                }
            } catch (err) {
                console.warn(`Error purging raw PDF scans for paper ${id}:`, err);
            }
        }

        // Trigger storage quota recalculation & sync
        if (window.app && typeof window.app.updateStorageQuotaDisplay === "function") {
            window.app.updateStorageQuotaDisplay();
        }

        return { purgedCount, reclaimedBytes };
    }

    async deleteSubjectBatchCompletely(paperIds) {
        return await this.cleanStoragePapers(paperIds);
    }

    async cleanStoragePapers(paperIds) {
        if (!Array.isArray(paperIds) || paperIds.length === 0) return 0;
        await this.readyPromise;
        let cleanedCount = 0;
        for (const id of paperIds) {
            try {
                await this.deleteEvaluation(id);
                cleanedCount++;
            } catch (err) {
                console.warn(`Error purging paper ${id}:`, err);
            }
        }
        return cleanedCount;
    }

    /**
     * Scans all evaluations and removes only duplicate copies for the same student in the same exam.
     * Safely preserves exactly ONE primary copy (preferring the graded/evaluated copy with teacher marks).
     */
    async deduplicateEvaluations(options = { dryRun: false }) {
        await this.readyPromise;
        const all = await this.getAllEvaluations(false, true); // bypassFilter = true to inspect entire store
        if (!Array.isArray(all) || all.length <= 1) {
            return { totalScanned: all ? all.length : 0, duplicatesRemoved: 0, survivingCount: all ? all.length : 0, removedPapers: [] };
        }

        const groups = new Map();

        all.forEach(paper => {
            if (!paper || !paper.id) return;
            if (this.deletedEvaluations && this.deletedEvaluations.has(String(paper.id))) return;

            const clsNorm = (paper.class || paper.className || paper.classLabel || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            const subNorm = (paper.subject || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // Base exam / template name stripped of dates e.g. (2026-10-23)
            const rawExam = paper.examName || paper.templateName || "assessment";
            const baseExam = rawExam.toLowerCase().replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');

            // Student identity: roll number or student name or file name
            const rollNorm = (paper.rollNo || "").toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const nameNorm = (paper.studentName || "").toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const fileNorm = (paper.fileName || (paper.rawFile && paper.rawFile.name) || "").toLowerCase().trim().replace(/[^a-z0-9]/g, '');

            let studentKey = "";
            if (rollNorm) {
                studentKey = `roll:${rollNorm}`;
            } else if (nameNorm && !nameNorm.includes("unnamed") && nameNorm !== "student") {
                studentKey = `name:${nameNorm}`;
            } else if (fileNorm) {
                studentKey = `file:${fileNorm}`;
            } else {
                studentKey = `id:${paper.id}`;
            }

            const groupKey = `${clsNorm}:::${subNorm}:::${baseExam}:::${studentKey}`;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey).push(paper);
        });

        const removedPapers = [];
        let duplicatesCount = 0;

        for (const [key, papers] of groups.entries()) {
            if (papers.length <= 1) continue;

            // Sort papers in descending order of quality/completeness:
            // Best paper stays at index 0 (SURVIVOR to KEEP).
            papers.sort((a, b) => {
                // 1. Graded / Completed status has highest priority
                const aDone = (a.status === "Completed" || a.status === "Corrected" || a.status === "Graded" || a.status === "Evaluated");
                const bDone = (b.status === "Completed" || b.status === "Corrected" || b.status === "Graded" || b.status === "Evaluated");
                if (aDone && !bDone) return -1;
                if (!aDone && bDone) return 1;

                // 2. Marks awarded > 0
                const aMarks = Number(a.obtainedMarks) || 0;
                const bMarks = Number(b.obtainedMarks) || 0;
                if (aMarks > bMarks) return -1;
                if (aMarks < bMarks) return 1;

                // 3. Annotations count (teacher drawings / checkmarks)
                const aAnno = Array.isArray(a.annotations) ? a.annotations.length : 0;
                const bAnno = Array.isArray(b.annotations) ? b.annotations.length : 0;
                if (aAnno > bAnno) return -1;
                if (aAnno < bAnno) return 1;

                // 4. Questions with awarded marks
                const aQ = Array.isArray(a.questions) ? a.questions.filter(q => q && (q.awardedMarks !== undefined || q.isCorrect !== undefined)).length : 0;
                const bQ = Array.isArray(b.questions) ? b.questions.filter(q => q && (q.awardedMarks !== undefined || q.isCorrect !== undefined)).length : 0;
                if (aQ > bQ) return -1;
                if (aQ < bQ) return 1;

                // 5. PDF scan data presence
                const aHasPdf = Boolean(a.pdfDataUrl || a.pdfStorageUrl || (Array.isArray(a.pages) && a.pages.length > 0));
                const bHasPdf = Boolean(b.pdfDataUrl || b.pdfStorageUrl || (Array.isArray(b.pages) && b.pages.length > 0));
                if (aHasPdf && !bHasPdf) return -1;
                if (!aHasPdf && bHasPdf) return 1;

                // 6. Original earlier creation date (preserve the original upload)
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (aTime && bTime && aTime !== bTime) {
                    return aTime - bTime;
                }

                return 0;
            });

            const survivor = papers[0];
            const redundant = papers.slice(1);

            for (const dup of redundant) {
                removedPapers.push({
                    deletedId: dup.id,
                    keptId: survivor.id,
                    studentName: dup.studentName || survivor.studentName || 'Student',
                    rollNo: dup.rollNo || survivor.rollNo || '—',
                    className: dup.className || dup.class || survivor.className,
                    examName: dup.examName || dup.templateName || survivor.examName,
                    status: dup.status
                });

                if (!options.dryRun) {
                    await this.deleteEvaluation(dup.id);
                }
                duplicatesCount++;
            }
        }

        console.log(`🧹 Deduplication Pass: Scanned ${all.length} papers, ${options.dryRun ? 'found' : 'purged'} ${duplicatesCount} redundant duplicate(s). Surviving unique papers: ${all.length - duplicatesCount}`);

        return {
            totalScanned: all.length,
            duplicatesRemoved: duplicatesCount,
            survivingCount: all.length - duplicatesCount,
            removedPapers: removedPapers
        };
    }

    async clearAppCaches() {
        let freedKeys = 0;
        try {
            if ('caches' in window) {
                for (const cName of ["niprak-pdf-cache-v1", "onespace-pdf-cache-v1"]) {
                    try {
                        const cache = await caches.open(cName);
                        const keys = await cache.keys();
                        for (const req of keys) {
                            await cache.delete(req);
                            freedKeys++;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return freedKeys;
    }

    async exportDatabaseBackup() {
        const evaluations = await this.getAllEvaluations();
        const users = await this.getUsersList();
        const settings = await this.getSettings();
        const catalog = await this.getSubjectCatalog();
        const classes = await this.getClassesList();
        const license = await this.getLicenseConfig();

        const backupData = {
            version: "2.4",
            exportDate: new Date().toISOString(),
            institution: settings.institution?.name || "Adwaith Thought Academy",
            license,
            evaluations,
            users,
            settings,
            catalog,
            classes
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const dateStr = new Date().toISOString().split("T")[0];
        a.download = `Niprak_OSM_Master_Backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }
}

window.appStorage = new StorageService();
window.canonicalizeClassName = function(cls) {
    return window.appStorage ? window.appStorage.canonicalizeClassName(cls) : (cls || 'Class 12-A');
};
window.canonicalizeSubject = function(sub) {
    return window.appStorage ? window.appStorage.canonicalizeSubject(sub) : (sub || '').toLowerCase().trim();
};
window.isSubjectMatch = function(paperSub, paperExam, targetSub) {
    return window.appStorage ? window.appStorage.isSubjectMatch(paperSub, paperExam, targetSub) : false;
};
window.harmonizeTemplateForSubject = function(tpl, sub) {
    return window.appStorage ? window.appStorage.harmonizeTemplateForSubject(tpl, sub) : (tpl || '');
};

window.buildQuestionsFromTemplate = function(tpl, targetMaxMarks = 40) {
    const maxMarks = Number(targetMaxMarks) || (tpl ? Number(tpl.maxMarks) : 40) || 40;

    // 1. Explicit questions list on template
    if (tpl && Array.isArray(tpl.questions) && tpl.questions.length > 0) {
        return JSON.parse(JSON.stringify(tpl.questions)).map((q, idx) => ({
            id: q.id || `q_${idx + 1}`,
            qNo: q.qNo || idx + 1,
            qNumber: q.qNumber || `Q${q.qNo || idx + 1}`,
            label: q.label || q.qNumber || `Q${idx + 1}`,
            section: q.section || "Section A",
            sectionId: q.sectionId || "sec_a",
            maxMarks: Number(q.maxMarks) || 1,
            awardedMarks: q.awardedMarks !== undefined ? q.awardedMarks : null,
            status: q.status || "unmarked",
            hasSubQuestions: !!q.hasSubQuestions,
            subQuestions: Array.isArray(q.subQuestions) ? JSON.parse(JSON.stringify(q.subQuestions)) : []
        }));
    }

    // 2. Synthesize from template sections
    if (tpl && Array.isArray(tpl.sections) && tpl.sections.length > 0) {
        let tplQuestions = [];
        let syntheticQNo = 1;
        tpl.sections.forEach(sec => {
            const start = sec.qStartNo || syntheticQNo;
            const end = sec.qEndNo || (start + (sec.qCount || 1) - 1);
            const marks = Number(sec.marksPerQ) || 1;
            const secName = sec.title || sec.name || `Section ${sec.letter || 'A'}`;
            const secId = sec.id || `sec_${(sec.letter || 'a').toLowerCase()}`;
            const isSub = !!sec.hasSubQuestions;
            for (let qn = start; qn <= end; qn++) {
                const subQs = isSub && Array.isArray(sec.subQuestions) && sec.subQuestions.length > 0
                    ? sec.subQuestions.map((sq, sqIdx) => ({
                        id: sq.id || sq.subId || sq.letter || String(sqIdx + 1),
                        subId: sq.subId || sq.letter || String(sqIdx + 1),
                        letter: sq.letter || sq.label || String(sqIdx + 1),
                        label: sq.label ? (String(sq.label).startsWith("(") ? sq.label : `(${sq.label})`) : `(${sq.subId || sqIdx + 1})`,
                        maxMarks: Number(sq.maxMarks !== undefined ? sq.maxMarks : sq.marks) || 1,
                        awardedMarks: 0
                    }))
                    : [];
                tplQuestions.push({
                    id: `q_${qn}`,
                    qNo: qn,
                    qNumber: `Q${qn}`,
                    label: `Q${qn}`,
                    section: secName,
                    sectionId: secId,
                    maxMarks: marks,
                    isChoice: !!sec.hasChoice,
                    hasSubQuestions: isSub && subQs.length > 0,
                    subQuestions: subQs,
                    awardedMarks: null,
                    status: "unmarked"
                });
                syntheticQNo = Math.max(syntheticQNo, qn + 1);
            }
        });
        return tplQuestions;
    }

    // 3. Fallback: Generate appropriate number of questions totaling maxMarks
    const qCount = maxMarks === 80 ? 40 : (maxMarks <= 25 ? 10 : (maxMarks <= 50 ? 25 : 30));
    const markPerQ = Math.max(1, Math.round((maxMarks / qCount) * 10) / 10);
    const qs = [];
    for (let i = 1; i <= qCount; i++) {
        qs.push({
            id: `q_${i}`,
            qNo: i,
            qNumber: `Q${i}`,
            label: `Q${i}`,
            section: "All Questions",
            sectionId: "sec_main",
            maxMarks: i === qCount ? Math.max(1, Math.round((maxMarks - (markPerQ * (qCount - 1))) * 10) / 10) : markPerQ,
            awardedMarks: null,
            status: "unmarked"
        });
    }
    return qs;
};

