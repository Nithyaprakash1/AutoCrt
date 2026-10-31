/**
 * Niprak Digital Correction - Uploaded Papers & Pages Repository Manager
 * Full-page archive of all uploaded exam papers, multi-page answer sheets,
 * organized into Class - Template cards, batch metrics, bulk deletion,
 * and page inspection lightbox.
 */

class UploadedPapersPageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.papers = [];
        this.subjects = [];
        this.classes = [];
        this.selectedSubject = "all";
        this.selectedClass = "all";
        this.selectedStatus = "all";
        this.selectedBatchKey = "all";
        this.viewMode = "cards"; // "cards" or "table"
        this.searchQuery = "";
        this.inspectingPaper = null;
        this.selectedIds = new Set();
        this.currentUser = null;
        this.isTeacher = false;
    }

    async init() {
        if (!this._cloudSyncListenerAttached) {
            this._cloudSyncListenerAttached = true;
            window.addEventListener("niprak-evaluations-cloud-synced", async () => {
                if (!this.container || !document.body.contains(this.container)) return;
                const viewUp = document.getElementById("view-uploaded-papers");
                if (viewUp && !viewUp.classList.contains("active-view")) return;

                await this.loadData();
                this.render();
                this.bindEvents();
            });
        }

        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            const allPapers = await window.appStorage.getAllEvaluations(false, true);
            const currentUser = window.appStorage.getCurrentUser();
            const isTeacher = Boolean(currentUser && (currentUser.role === 'evaluator' || currentUser.role === 'teacher'));
            this.currentUser = currentUser;
            this.isTeacher = isTeacher;

            let assigned = isTeacher && Array.isArray(currentUser.assignedSubjects) && currentUser.assignedSubjects.length > 0
                ? [...currentUser.assignedSubjects]
                : (isTeacher && currentUser.subject ? [currentUser.subject] : []);
            assigned = assigned.filter(s => s && s !== 'all' && s !== 'All Subjects');

            if (isTeacher && assigned.length > 0) {
                const filtered = window.appStorage.filterEvaluationsForUser(allPapers);
                this.papers = (filtered && filtered.length > 0) ? filtered : allPapers;
                const subjectSet = new Set(assigned);
                allPapers.forEach(p => {
                    if (p && p.subject) subjectSet.add(p.subject);
                });
                this.subjects = Array.from(subjectSet);
                if (this.selectedSubject !== "all" && !this.subjects.some(s => window.appStorage.isSubjectMatch(this.selectedSubject, '', s))) {
                    this.selectedSubject = "all";
                }
            } else {
                this.papers = allPapers;
                const savedCatalog = await window.appStorage.getSubjectCatalog();
                const subjectSet = new Set(["Political Science", "Physics", "English", "Economics", "History", "Social Science", "Mathematics", "Biology", "Chemistry", "Tamil"]);
                if (savedCatalog && Array.isArray(savedCatalog)) {
                    savedCatalog.forEach(s => { if (s && s.name) subjectSet.add(s.name); });
                }
                allPapers.forEach(p => {
                    if (p && p.subject) {
                        if (window.appStorage.isSubjectMatch(p.subject, '', 'Political Science')) {
                            subjectSet.add("Political Science");
                        } else {
                            subjectSet.add(p.subject);
                        }
                    }
                });
                this.subjects = Array.from(subjectSet);
            }

            if (typeof window.appStorage.getStorageUsage === "function") {
                await window.appStorage.getStorageUsage();
            }

            const savedClasses = await window.appStorage.getClassesList();
            if (savedClasses) {
                this.classes = savedClasses;
            } else {
                this.classes = [
                    { id: "cls_12a", name: "Class 12-A" },
                    { id: "cls_12b", name: "Class 12-B" },
                    { id: "cls_12c", name: "Class 12-C" },
                    { id: "cls_12d", name: "Class 12-D" },
                    { id: "cls_10a", name: "Class 10-A" },
                    { id: "cls_10b", name: "Class 10-B" }
                ];
            }
        }
    }

    computeBatches() {
        const batchMap = new Map();
        this.papers.forEach(p => {
            const rawCls = p.classLabel || p.className || p.class || "Class 12-A";
            const cls = (window.appStorage && typeof window.appStorage.canonicalizeClassName === "function")
                ? window.appStorage.canonicalizeClassName(rawCls)
                : rawCls;
            const sub = p.subject || "General";
            const rawExamTitle = (p.examName || p.templateName || "Assessment").trim();
            // Ignore minor date divergence in exam name so papers stay together in 1 card
            const examTitle = rawExamTitle.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/g, '').trim();
            const batchKey = `${cls}:::${examTitle}`;
            if (!batchMap.has(batchKey)) {
                batchMap.set(batchKey, {
                    key: batchKey,
                    className: cls,
                    templateName: examTitle,
                    examName: examTitle,
                    examDate: p.examDate || '',
                    subject: sub,
                    papers: [],
                    studentMap: new Map(),
                    total: 0,
                    completed: 0,
                    pending: 0,
                    totalPages: 0,
                    totalBytes: 0,
                    maxMarks: p.maxMarks || 40
                });
            }
            const b = batchMap.get(batchKey);
            // Deduplicate exact duplicate uploads for the same student inside the batch, prioritizing graded copy
            const sKey = (p.rollNo ? String(p.rollNo).trim().toLowerCase() : '') || (p.studentName ? String(p.studentName).trim().toLowerCase() : String(p.id));
            if (b.studentMap.has(sKey)) {
                const existing = b.studentMap.get(sKey);
                const existingScore = Number(existing.obtainedMarks) || 0;
                const newScore = Number(p.obtainedMarks) || 0;
                const existingIsDone = existing.status === 'Completed' || existingScore > 0;
                const newIsDone = p.status === 'Completed' || newScore > 0;
                if (!existingIsDone && newIsDone) {
                    const idx = b.papers.findIndex(item => String(item.id) === String(existing.id));
                    if (idx >= 0) b.papers[idx] = p;
                    b.studentMap.set(sKey, p);
                }
            } else {
                b.studentMap.set(sKey, p);
                b.papers.push(p);
            }
            if (!b.examDate && p.examDate) b.examDate = p.examDate;
        });

        return Array.from(batchMap.values()).map(b => {
            b.total = b.papers.length;
            b.completed = b.papers.filter(p => p.status === "Completed").length;
            b.pending = b.total - b.completed;
            b.totalPages = b.papers.reduce((sum, p) => sum + (p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1))), 0);
            b.totalBytes = b.papers.reduce((sum, p) => {
                if (window.appStorage && typeof window.appStorage.measurePaperBytesSync === "function") {
                    return sum + window.appStorage.measurePaperBytesSync(p);
                }
                const pg = p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1));
                return sum + (p.fileSizeBytes || (pg * 185 * 1024));
            }, 0);
            const pTime = b.papers.reduce((max, p) => {
                const t = new Date(p.createdAt || p.uploadedAt || p.timestamp || p.lastUpdated || 0).getTime();
                return t > max ? t : max;
            }, 0);
            b.latestTimestamp = pTime;
            return b;
        }).sort((a, b) => {
            if (a.pending > 0 && b.pending === 0) return -1;
            if (a.pending === 0 && b.pending > 0) return 1;
            return (b.latestTimestamp || 0) - (a.latestTimestamp || 0);
        });
    }

    getFilteredBatches() {
        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : this.currentUser;
        const isTeacher = (this.isTeacher !== undefined && this.isTeacher !== null)
            ? this.isTeacher
            : Boolean(currentUser && (currentUser.role === 'evaluator' || currentUser.role === 'teacher'));
        const batches = this.computeBatches();
        const teacherClasses = (currentUser && currentUser.assignedClasses && currentUser.assignedClasses.length > 0)
            ? currentUser.assignedClasses.filter(c => c && c.toLowerCase() !== 'all classes' && c.toLowerCase() !== 'all')
            : (currentUser && currentUser.class && currentUser.class.toLowerCase() !== 'all classes' && currentUser.class.toLowerCase() !== 'all' ? [currentUser.class] : []);

        return batches.filter(b => {
            // Mandatory Teacher subject guard
            if (isTeacher && this.subjects.length > 0) {
                const matchesAnyTeacherSub = this.subjects.some(s => window.appStorage.isSubjectMatch(b.subject, '', s, b.templateName));
                if (!matchesAnyTeacherSub) return false;
            }

            // Mandatory Teacher class guard (if teacher is assigned specific classes)
            if (isTeacher && teacherClasses.length > 0) {
                const bCls = (b.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchesCls = teacherClasses.some(tc => {
                    const normTc = tc.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return !normTc || bCls === normTc || bCls.includes(normTc) || normTc.includes(bCls);
                });
                if (!matchesCls) return false;
            }

            if (this.selectedSubject !== "all" && !window.appStorage.isSubjectMatch(b.subject, '', this.selectedSubject, b.templateName)) return false;
            if (this.selectedClass !== "all") {
                const targetCls = this.selectedClass.toLowerCase().replace(/[^a-z0-9]/g, '');
                const bCls = (b.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const clsMatch = bCls === targetCls || (targetCls && bCls.includes(targetCls)) || (bCls && targetCls.includes(bCls));
                if (!clsMatch) return false;
            }
            if (this.selectedStatus !== "all") {
                if (this.selectedStatus === "Completed" && b.pending > 0) return false;
                if (this.selectedStatus === "Pending" && b.pending === 0) return false;
            }
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                const matchCls = b.className.toLowerCase().includes(q);
                const matchTpl = b.templateName.toLowerCase().includes(q);
                const matchSub = b.subject.toLowerCase().includes(q);
                const matchStudent = b.papers.some(p =>
                    (p.studentName && p.studentName.toLowerCase().includes(q)) ||
                    (p.rollNo && p.rollNo.toLowerCase().includes(q))
                );
                if (!matchCls && !matchTpl && !matchSub && !matchStudent) return false;
            }
            return true;
        });
    }

    getFilteredPapers() {
        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : this.currentUser;
        const isTeacher = (this.isTeacher !== undefined && this.isTeacher !== null)
            ? this.isTeacher
            : Boolean(currentUser && (currentUser.role === 'evaluator' || currentUser.role === 'teacher'));
        const teacherClasses = (currentUser && currentUser.assignedClasses && currentUser.assignedClasses.length > 0)
            ? currentUser.assignedClasses.filter(c => c && c.toLowerCase() !== 'all classes' && c.toLowerCase() !== 'all')
            : (currentUser && currentUser.class && currentUser.class.toLowerCase() !== 'all classes' && currentUser.class.toLowerCase() !== 'all' ? [currentUser.class] : []);

        return this.papers.filter(p => {
            const rawCls = p.classLabel || p.className || p.class || "Class 12-A";
            const pCls = (window.appStorage && typeof window.appStorage.canonicalizeClassName === "function")
                ? window.appStorage.canonicalizeClassName(rawCls)
                : rawCls;
            const rawExamTitle = (p.examName || p.templateName || "Assessment").trim();
            const examTitle = rawExamTitle.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/g, '').trim();
            const pKey = `${pCls}:::${examTitle}`;

            // Mandatory Teacher subject guard
            if (isTeacher && this.subjects.length > 0) {
                const matchesAnyTeacherSub = this.subjects.some(s => window.appStorage.isSubjectMatch(p.subject, p.examName, s, p.templateName));
                if (!matchesAnyTeacherSub) return false;
            }

            // Mandatory Teacher class guard (if teacher is assigned specific classes)
            if (isTeacher && teacherClasses.length > 0) {
                const pClsNorm = (pCls || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchesCls = teacherClasses.some(tc => {
                    const normTc = tc.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return !normTc || pClsNorm === normTc || pClsNorm.includes(normTc) || normTc.includes(pClsNorm);
                });
                if (!matchesCls) return false;
            }

            if (this.selectedBatchKey !== "all" && pKey !== this.selectedBatchKey) return false;
            if (this.selectedSubject !== "all" && !window.appStorage.isSubjectMatch(p.subject, p.examName, this.selectedSubject, p.templateName)) return false;
            if (this.selectedClass !== "all") {
                const targetCls = this.selectedClass.toLowerCase().replace(/[^a-z0-9]/g, '');
                const pClsNorm = (pCls || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const clsMatch = pClsNorm === targetCls || (targetCls && pClsNorm.includes(targetCls)) || (pClsNorm && targetCls.includes(pClsNorm));
                if (!clsMatch) return false;
            }
            if (this.selectedStatus !== "all") {
                if (this.selectedStatus === "Completed" && p.status !== "Completed") return false;
                if (this.selectedStatus === "Pending" && p.status === "Completed") return false;
            }
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                const matchName = p.studentName && p.studentName.toLowerCase().includes(q);
                const matchRoll = p.rollNo && p.rollNo.toLowerCase().includes(q);
                const matchId = p.id && String(p.id).toLowerCase().includes(q);
                const matchTpl = pTpl.toLowerCase().includes(q);
                if (!matchName && !matchRoll && !matchId && !matchTpl) return false;
            }
            return true;
        });
    }

    formatBytes(bytes) {
        if (window.appStorage && typeof window.appStorage.formatStorageSize === "function") {
            return window.appStorage.formatStorageSize(bytes);
        }
        if (!bytes || bytes <= 0) return "0 MB";
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }

    render() {
        if (!this.container) return;

        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : this.currentUser;
        const isTeacher = (this.isTeacher !== undefined && this.isTeacher !== null)
            ? this.isTeacher
            : Boolean(currentUser && (currentUser.role === 'evaluator' || currentUser.role === 'teacher'));

        const allBatches = this.computeBatches();
        const filteredBatches = this.getFilteredBatches();
        const filteredPapers = this.getFilteredPapers();

        // Clean up selectedIds no longer visible
        const visibleIdSet = new Set(filteredPapers.map(p => String(p.id)));
        const newSelected = new Set();
        this.selectedIds.forEach(id => {
            if (visibleIdSet.has(id)) newSelected.add(id);
        });
        this.selectedIds = newSelected;

        // Metrics calculations
        const totalPapers = this.papers.length;
        const totalPages = this.papers.reduce((sum, p) => sum + (p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1))), 0);
        const totalBytes = this.papers.reduce((sum, p) => {
            if (window.appStorage && typeof window.appStorage.measurePaperBytesSync === "function") {
                return sum + window.appStorage.measurePaperBytesSync(p);
            }
            return sum + (p.fileSizeBytes || ((p.pageCount || 1) * 185 * 1024));
        }, 0);
        const formattedTotalStorage = this.formatBytes(totalBytes);
        const completedPapers = this.papers.filter(p => p.status === "Completed").length;
        const pendingPapers = totalPapers - completedPapers;

        // Current active batch info if drill-down selected
        let activeBatchObj = null;
        if (this.selectedBatchKey !== "all") {
            activeBatchObj = allBatches.find(b => b.key === this.selectedBatchKey);
        }

        this.container.innerHTML = `
            <div class="uploaded-papers-layout">
                <!-- Top Compact Header Banner -->
                <div class="uploaded-page-header">
                    <div class="header-titles">
                        <h1 class="page-title">Uploaded Papers</h1>
                    </div>

                    <div class="header-actions">
                        <button type="button" class="btn-papers-secondary" id="btn-export-papers-manifest" title="Download CSV manifest of all uploaded papers">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Manifest</span>
                        </button>
                        <button type="button" class="btn-papers-primary" id="btn-goto-upload-desk">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span>+ Ingest Papers</span>
                        </button>
                    </div>
                </div>

                <!-- KPI Overview Grid (Compact Cupertino Fit-to-Screen) -->
                <div class="papers-kpi-grid">
                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-purple">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Batches</span>
                            <span class="kpi-value">${allBatches.length}</span>
                        </div>
                    </div>

                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-blue">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Total Papers</span>
                            <span class="kpi-value">${totalPapers}</span>
                        </div>
                    </div>

                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-green">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Evaluated</span>
                            <span class="kpi-value">${completedPapers} <span style="font-size: 0.8rem; color: #F59E0B;">/ ${totalPapers}</span></span>
                        </div>
                    </div>

                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-orange">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Storage</span>
                            <span class="kpi-value">${formattedTotalStorage}</span>
                        </div>
                    </div>
                </div>

                <!-- Filter Controls Bar -->
                <div class="papers-filter-card">
                    <div class="filter-controls-row">
                        <!-- Search Bar -->
                        <div class="search-field-wrap">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="input-papers-search" placeholder="Search class, template, student..." value="${this.searchQuery}" />
                            ${this.searchQuery ? `<button type="button" class="btn-clear-papers-search" id="btn-clear-papers-search">×</button>` : ''}
                        </div>

                        <!-- Filter Dropdowns -->
                        <div class="filter-dropdown-group">
                            <div class="filter-select-item">
                                <label>Class:</label>
                                <select id="select-papers-class" class="form-select-sm">
                                    <option value="all" ${this.selectedClass === 'all' ? 'selected' : ''}>All</option>
                                    ${this.classes.map(c => `
                                        <option value="${c.name}" ${this.selectedClass === c.name ? 'selected' : ''}>${c.name}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="filter-select-item">
                                <label>Subject:</label>
                                <select id="select-papers-subject" class="form-select-sm">
                                    <option value="all" ${this.selectedSubject === 'all' ? 'selected' : ''}>All Subjects</option>
                                    ${this.subjects.map(s => `
                                        <option value="${s}" ${this.selectedSubject === s ? 'selected' : ''}>${s}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="filter-select-item">
                                <label>Status:</label>
                                <select id="select-papers-status" class="form-select-sm">
                                    <option value="all" ${this.selectedStatus === 'all' ? 'selected' : ''}>All</option>
                                    <option value="Pending" ${this.selectedStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="Completed" ${this.selectedStatus === 'Completed' ? 'selected' : ''}>Evaluated</option>
                                </select>
                            </div>

                            ${(this.selectedSubject !== "all" || this.selectedClass !== "all" || this.selectedStatus !== "all" || this.searchQuery || this.selectedBatchKey !== "all") ? `
                                <button type="button" class="btn-reset-filters" id="btn-reset-papers-filters" title="Reset all active filters">
                                    Reset
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Main Content Display -->
                ${this.viewMode === 'cards' && this.selectedBatchKey === 'all' ? `
                    <!-- Class - Template Cards Grid View -->
                    <div class="uploaded-batches-section">
                        <div class="uploaded-batches-header">
                            <div class="uploaded-batches-title-col">
                                <h3 class="uploaded-batches-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                                    Exam Batches
                                    <span class="uploaded-batches-count-pill">${filteredBatches.length} ${filteredBatches.length === 1 ? 'Batch' : 'Batches'}</span>
                                </h3>
                            </div>
                        </div>

                        <div class="uploaded-batches-grid">
                            ${filteredBatches.length === 0 ? `
                                <div class="uploaded-batches-empty">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                                    <p>No uploaded paper batches match the current filter criteria.</p>
                                    <button type="button" class="btn-papers-primary" id="btn-batch-empty-upload">
                                        + Ingest Papers
                                    </button>
                                </div>
                            ` : filteredBatches.map(b => {
                                const pct = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
                                const isCompleted = b.pending === 0 && b.total > 0;
                                const formattedStorage = this.formatBytes(b.totalBytes);

                                return `
                                    <div class="uploaded-batch-card" data-batch-key="${b.key}">
                                        <div class="batch-card-top-row">
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                                <span class="batch-class-badge">${b.className}</span>
                                                <span class="batch-subject-tag">${b.subject}</span>
                                            </div>
                                            <span class="batch-status-pill ${isCompleted ? 'status-all-done' : 'status-has-pending'}">
                                                ${isCompleted ? '✓ Graded' : `${b.pending} Pending`}
                                            </span>
                                        </div>

                                        <h4 class="batch-card-name" title="${b.templateName}">${b.templateName}</h4>

                                        <div class="batch-card-meta-row">
                                            <span>${b.total} Papers</span>
                                            <span>•</span>
                                            <span>${b.totalPages} Pages</span>
                                            <span>•</span>
                                            <span style="color: #0071E3;">${formattedStorage}</span>
                                        </div>

                                        <div class="batch-progress-wrapper">
                                            <div class="batch-progress-labels">
                                                <span class="progress-ratio">${b.completed} / ${b.total} Graded</span>
                                                <span class="progress-pct" style="color: ${pct === 100 ? '#16A34A' : '#0071E3'};">${pct}%</span>
                                            </div>
                                            <div class="batch-progress-bar">
                                                <div class="batch-progress-fill" style="width: ${pct}%; background: ${pct === 100 ? '#16A34A' : 'linear-gradient(90deg, #0071E3, #38BDF8)'};"></div>
                                            </div>
                                        </div>

                                        <div class="batch-actions-row">
                                            <button type="button" class="btn-batch-view" data-batch-key="${b.key}" title="View papers in this batch">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                <span>View (${b.total})</span>
                                            </button>
                                            <button type="button" class="btn-batch-change-template" data-batch-key="${b.key}" data-subject="${b.subject}" data-class="${b.className}" data-template="${b.templateName}" title="Change or reassign exam template for all papers in this batch">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                                <span>Change Template</span>
                                            </button>
                                            <button type="button" class="btn-batch-share" data-batch-key="${b.key}" data-subject="${b.subject}" data-class="${b.className}" data-template="${b.templateName}" data-total="${b.total}" title="Share this subject batch via WhatsApp">
                                                ${(window.Icons && window.Icons.whatsapp) || ''}
                                                <span>Share</span>
                                            </button>
                                            ${isCompleted ? `
                                                <button type="button" class="btn-batch-cleanup-scans" data-batch-key="${b.key}" title="Optimize storage by clearing heavy raw PDF scans while preserving marks">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
                                                    <span>Clean Scans</span>
                                                </button>
                                            ` : ''}
                                            <button type="button" class="btn-batch-delete" data-batch-key="${b.key}" title="Delete Batch">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : `
                    <!-- Active Batch Drilldown Alert Header (if filtered to one batch) -->
                    ${activeBatchObj ? `
                        <div class="active-batch-banner">
                            <div class="active-batch-left">
                                <button type="button" class="btn-batch-back" id="btn-back-to-all-batches" title="Back to all batches">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                                    <span>All Batches</span>
                                </button>
                                <div class="active-batch-titles">
                                    <span class="active-batch-badge">${activeBatchObj.className}</span>
                                    <h3 class="active-batch-name">${activeBatchObj.templateName} (${activeBatchObj.subject})</h3>
                                    <span class="active-batch-meta">${activeBatchObj.total} Papers • ${activeBatchObj.totalPages} Pages • ${this.formatBytes(activeBatchObj.totalBytes)}</span>
                                </div>
                            </div>
                            <div class="active-batch-right" style="display: flex; gap: 8px; align-items: center;">
                                <button type="button" class="btn-papers-secondary btn-batch-change-template-active" data-batch-key="${activeBatchObj.key}" title="Change template for this batch">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                    <span>Change Template</span>
                                </button>
                                <button type="button" class="btn-papers-secondary btn-batch-share-active" data-batch-key="${activeBatchObj.key}" data-subject="${activeBatchObj.subject}" data-class="${activeBatchObj.className}" data-template="${activeBatchObj.templateName}" data-total="${activeBatchObj.total}" title="Share this batch via WhatsApp">
                                    ${(window.Icons && window.Icons.whatsapp) || ''}
                                    <span>Share WhatsApp</span>
                                </button>
                                ${this.selectedIds.size > 0 ? `
                                    <button type="button" class="btn-papers-secondary btn-papers-bulk-delete" id="btn-papers-bulk-delete" title="Delete selected papers" style="color: #DC2626; border-color: #DC2626;">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        <span>Delete Selected (${this.selectedIds.size})</span>
                                    </button>
                                ` : ''}
                                ${activeBatchObj.pending === 0 && activeBatchObj.total > 0 ? `
                                    <button type="button" class="btn-batch-cleanup-scans" data-batch-key="${activeBatchObj.key}" title="Optimize storage by clearing heavy raw PDF scans while preserving marks">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
                                        <span>Clean Scans</span>
                                    </button>
                                ` : ''}
                                <button type="button" class="btn-papers-secondary btn-batch-delete-active" data-batch-key="${activeBatchObj.key}" title="Delete this whole batch" style="color: #DC2626; border-color: #DC2626;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    <span>Delete Batch</span>
                                </button>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Papers Data Table Card -->
                    <div class="papers-table-card">
                        <div class="table-meta-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <span class="table-results-label">Showing ${filteredPapers.length} of ${totalPapers} uploaded papers</span>
                            ${this.selectedIds.size > 0 ? `<span style="font-size: 0.8rem; color: #DC2626;">${this.selectedIds.size} paper(s) selected</span>` : ''}
                        </div>

                        <div class="papers-table-wrapper">
                            <table class="papers-data-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px; text-align: center;">
                                            <input type="checkbox" id="papers-select-all" title="Select All Papers" style="cursor: pointer; width: 15px; height: 15px; vertical-align: middle; margin: 0;" />
                                        </th>
                                        <th style="width: 80px;">Roll No</th>
                                        <th style="min-width: 150px;">Student Name</th>
                                        <th style="width: 110px;">Class</th>
                                        <th style="min-width: 150px;">Subject & Exam</th>
                                        <th style="width: 100px;">Pages</th>
                                        <th style="width: 120px;">Status</th>
                                        <th style="width: 85px;">Score</th>
                                        <th style="width: 200px; text-align: right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredPapers.length === 0 ? `
                                        <tr>
                                            <td colspan="9" class="papers-empty-cell">
                                                <div class="empty-papers-state">
                                                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                    <span>No papers match the current filters.</span>
                                                    <button type="button" class="btn-empty-upload-shortcut" id="btn-empty-upload-shortcut">
                                                        Upload New Papers
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ` : filteredPapers.map(p => {
                                        const pageCount = p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1));
                                        const isPurged = Boolean(p.rawScansPurged);
                                        const isComp = p.status === "Completed";
                                        const statusPillClass = isPurged ? 'status-archived' : (isComp ? 'status-completed' : 'status-pending');
                                        const statusPillLabel = isPurged ? 'Log Archived' : (isComp ? 'Evaluated' : 'Pending');
                                        const initials = (p.studentName || "ST").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                                        const isChecked = this.selectedIds.has(String(p.id));
                                        return `
                                            <tr data-paper-id="${p.id}" class="${isChecked ? 'row-selected' : ''}" style="${isChecked ? 'background-color: rgba(220, 38, 38, 0.04);' : ''}">
                                                <td style="text-align: center;">
                                                    <input type="checkbox" class="papers-item-check" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; vertical-align: middle; margin: 0;" />
                                                </td>
                                                <td class="cell-roll">${p.rollNo || '—'}</td>
                                                <td class="cell-name">
                                                    <div class="student-name-chip">
                                                        <span class="avatar-circle">${initials}</span>
                                                        <span class="name-text">${p.studentName || 'Unnamed Student'}</span>
                                                    </div>
                                                </td>
                                                <td class="cell-class">
                                                    <span class="badge-class-tag">${p.className || p.class || 'Class 12-A'}</span>
                                                </td>
                                                <td class="cell-exam">
                                                    <div class="exam-info-stack">
                                                        <span class="exam-subject-text">${p.subject || 'General'}</span>
                                                        <span class="exam-name-text">${p.examName || p.templateName || 'Mid-Term Exam'}</span>
                                                    </div>
                                                </td>
                                                <td class="cell-pages">
                                                    <span class="badge-page-count">
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/></svg>
                                                        ${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'}
                                                    </span>
                                                </td>
                                                <td class="cell-status">
                                                    <span class="status-pill ${statusPillClass}">
                                                        <span class="status-dot"></span>
                                                        ${statusPillLabel}
                                                    </span>
                                                </td>
                                                <td class="cell-score">
                                                    ${(isComp || Number(p.obtainedMarks) > 0) ? `<span class="score-pill">${p.obtainedMarks} / ${p.maxMarks || 40}</span>` : '<span class="score-none">—</span>'}
                                                </td>
                                                <td class="cell-actions">
                                                    <div class="paper-actions-group">
                                                        <button type="button" class="btn-paper-action btn-action-inspect" data-paper-id="${p.id}" title="Inspect pages of this paper">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                            <span>Inspect</span>
                                                        </button>
                                                        <button type="button" class="btn-paper-action btn-action-quick-marks" data-paper-id="${p.id}" title="Quick enter or edit marks">
                                                            <span>✏️ Marks</span>
                                                        </button>
                                                        <button type="button" class="btn-paper-action btn-action-eval" data-paper-id="${p.id}" title="${isPurged ? 'View Student Scorecard' : 'Open evaluation workspace'}">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                                            <span>${isPurged ? 'Scorecard' : 'Evaluate'}</span>
                                                        </button>
                                                        <button type="button" class="btn-paper-action btn-action-share" data-paper-id="${p.id}" data-name="${p.studentName || ''}" data-roll="${p.rollNo || ''}" data-subject="${p.subject || ''}" data-class="${p.className || p.class || ''}" title="Share direct link to this paper via WhatsApp">
                                                            ${(window.Icons && window.Icons.whatsapp) || ''}
                                                            <span>Share</span>
                                                        </button>
                                                        <button type="button" class="btn-paper-action btn-action-delete" data-paper-id="${p.id}" title="Delete paper" aria-label="Delete paper">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `}
            </div>

            <!-- Page Inspector Lightbox Modal Backdrop -->
            <div class="modal-backdrop" id="modal-papers-inspector" style="display: none;">
                <div class="modal-dialog modal-dialog-large">
                    <div class="modal-header">
                        <div id="inspector-header-info">
                            <h3 class="modal-title" id="inspector-student-title">Page Inspector</h3>
                            <p class="modal-subtitle" id="inspector-student-subtitle">Reviewing multi-page student answer script</p>
                        </div>
                        <button type="button" class="btn-modal-close" id="btn-close-inspector">×</button>
                    </div>

                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto; padding: 16px;">
                        <div class="inspector-pages-grid" id="inspector-pages-grid">
                            <!-- Page Thumbnails injected dynamically -->
                        </div>
                    </div>

                    <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="inspector-footer-note" id="inspector-footer-note">Pages are verified and ready for evaluation.</span>
                        <div class="inspector-footer-actions">
                            <button type="button" class="btn-secondary" id="btn-dismiss-inspector">Close</button>
                            <button type="button" class="btn-primary" id="btn-launch-eval-from-inspector">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                Open Evaluator
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // View Mode Switcher
        const btnToggleCards = this.container.querySelector("#btn-toggle-view-cards");
        if (btnToggleCards) {
            btnToggleCards.addEventListener("click", () => {
                this.viewMode = "cards";
                this.selectedBatchKey = "all";
                this.render();
            });
        }
        const btnToggleTable = this.container.querySelector("#btn-toggle-view-table");
        if (btnToggleTable) {
            btnToggleTable.addEventListener("click", () => {
                this.viewMode = "table";
                this.selectedBatchKey = "all";
                this.render();
            });
        }

        // Search Input
        const inputSearch = this.container.querySelector("#input-papers-search");
        if (inputSearch) {
            inputSearch.addEventListener("input", (e) => {
                this.searchQuery = e.target.value.trim();
                this.render();
                const fresh = this.container.querySelector("#input-papers-search");
                if (fresh) {
                    fresh.focus();
                    fresh.setSelectionRange(fresh.value.length, fresh.value.length);
                }
            });
        }
        const btnClearSearch = this.container.querySelector("#btn-clear-papers-search");
        if (btnClearSearch) {
            btnClearSearch.addEventListener("click", () => {
                this.searchQuery = "";
                this.render();
            });
        }

        // Subject Filter
        const selSub = this.container.querySelector("#select-papers-subject");
        if (selSub) {
            selSub.addEventListener("change", (e) => {
                this.selectedSubject = e.target.value;
                if (this.selectedSubject && this.selectedSubject !== "all") {
                    sessionStorage.setItem("niprak_active_subject", this.selectedSubject);
                    if (window.app && typeof window.app.updateUserProfileDisplay === "function") {
                        window.app.updateUserProfileDisplay(this.selectedSubject, this.selectedClass !== "all" ? this.selectedClass : null);
                    }
                }
                this.render();
            });
        }

        // Class Filter
        const selCls = this.container.querySelector("#select-papers-class");
        if (selCls) {
            selCls.addEventListener("change", (e) => {
                this.selectedClass = e.target.value;
                this.render();
            });
        }

        // Status Filter
        const selStatus = this.container.querySelector("#select-papers-status");
        if (selStatus) {
            selStatus.addEventListener("change", (e) => {
                this.selectedStatus = e.target.value;
                this.render();
            });
        }

        // Reset Filters
        const btnReset = this.container.querySelector("#btn-reset-papers-filters");
        if (btnReset) {
            btnReset.addEventListener("click", () => {
                this.selectedSubject = "all";
                this.selectedClass = "all";
                this.selectedStatus = "all";
                this.selectedBatchKey = "all";
                this.searchQuery = "";
                this.render();
            });
        }

        // Navigation to Upload Desk
        const btnGotoUpload = this.container.querySelector("#btn-goto-upload-desk");
        if (btnGotoUpload) {
            btnGotoUpload.addEventListener("click", () => {
                if (window.app) window.app.switchView("upload-portal");
            });
        }
        const btnEmptyUpload = this.container.querySelector("#btn-empty-upload-shortcut");
        if (btnEmptyUpload) {
            btnEmptyUpload.addEventListener("click", () => {
                if (window.app) window.app.switchView("upload-portal");
            });
        }
        const btnBatchEmptyUpload = this.container.querySelector("#btn-batch-empty-upload");
        if (btnBatchEmptyUpload) {
            btnBatchEmptyUpload.addEventListener("click", () => {
                if (window.app) window.app.switchView("upload-portal");
            });
        }

        // Export Manifest
        const btnExport = this.container.querySelector("#btn-export-papers-manifest");
        if (btnExport) {
            btnExport.addEventListener("click", () => {
                this.exportPapersManifest();
            });
        }

        // Bulk Delete Button
        const btnBulkDel = this.container.querySelector("#btn-papers-bulk-delete");
        if (btnBulkDel) {
            btnBulkDel.addEventListener("click", () => {
                this.showBulkDeleteModal();
            });
        }

        // Batch Card: View Papers
        this.container.querySelectorAll(".btn-batch-view").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const key = btn.getAttribute("data-batch-key");
                this.selectedBatchKey = key;
                this.render();
            });
        });

        // Batch Card: Inspect Sample
        this.container.querySelectorAll(".btn-batch-inspect").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const key = btn.getAttribute("data-batch-key");
                const batches = this.computeBatches();
                const targetBatch = batches.find(b => b.key === key);
                if (targetBatch && targetBatch.papers.length > 0) {
                    this.openInspector(targetBatch.papers[0]);
                }
            });
        });

        // Batch Card: Delete Entire Batch
        this.container.querySelectorAll(".btn-batch-delete, .btn-batch-delete-active").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const key = btn.getAttribute("data-batch-key");
                const batches = this.computeBatches();
                const targetBatch = batches.find(b => b.key === key);
                if (targetBatch) {
                    this.showBatchDeleteModal(targetBatch);
                }
            });
        });

        // Batch Card: Change Template
        this.container.querySelectorAll(".btn-batch-change-template, .btn-batch-change-template-active").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const key = btn.getAttribute("data-batch-key");
                const batches = this.computeBatches();
                const targetBatch = batches.find(b => b.key === key);
                if (targetBatch) {
                    this.openChangeTemplateModal(targetBatch);
                }
            });
        });

        // Batch Card: Clean Scans Storage Optimization
        this.container.querySelectorAll(".btn-batch-cleanup-scans").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const key = btn.getAttribute("data-batch-key");
                const batches = this.computeBatches();
                const targetBatch = batches.find(b => b.key === key);
                if (targetBatch && window.app && typeof window.app.showCleanupConfirmationModal === "function") {
                    window.app.showCleanupConfirmationModal({
                        subject: targetBatch.subject,
                        className: targetBatch.className,
                        examName: targetBatch.templateName,
                        paperIds: targetBatch.papers.map(p => p.id),
                        paperCount: targetBatch.total,
                        potentialSavingsBytes: Math.round(targetBatch.totalBytes * 0.98),
                        potentialSavingsFormatted: this.formatBytes(Math.round(targetBatch.totalBytes * 0.98))
                    });
                }
            });
        });

        // Entire Batch Card Click (defaults to View Papers)
        this.container.querySelectorAll(".uploaded-batch-card").forEach(card => {
            card.addEventListener("click", (e) => {
                if (e.target.closest("button")) return; // handled by button
                const key = card.getAttribute("data-batch-key");
                this.selectedBatchKey = key;
                this.render();
            });
        });

        // Back to All Batches Button
        const btnBackBatches = this.container.querySelector("#btn-back-to-all-batches");
        if (btnBackBatches) {
            btnBackBatches.addEventListener("click", () => {
                this.selectedBatchKey = "all";
                this.render();
            });
        }

        // Select All Checkbox
        const selectAllBox = this.container.querySelector("#papers-select-all");
        if (selectAllBox) {
            selectAllBox.addEventListener("change", (e) => {
                const currentFiltered = this.getFilteredPapers();
                if (e.target.checked) {
                    currentFiltered.forEach(p => this.selectedIds.add(String(p.id)));
                } else {
                    this.selectedIds.clear();
                }
                this.render();
            });
        }

        // Row Checkboxes
        this.container.querySelectorAll(".papers-item-check").forEach(cb => {
            cb.addEventListener("change", (e) => {
                const id = String(cb.getAttribute("data-id"));
                if (e.target.checked) {
                    this.selectedIds.add(id);
                } else {
                    this.selectedIds.delete(id);
                }
                this.updateSelectionBadge();
                const tr = cb.closest("tr");
                if (tr) {
                    tr.style.backgroundColor = e.target.checked ? "rgba(220, 38, 38, 0.04)" : "";
                }
            });
        });

        // Action: Share Batch via WhatsApp
        this.container.querySelectorAll(".btn-batch-share, .btn-batch-share-active").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const key = btn.getAttribute("data-batch-key");
                const subject = btn.getAttribute("data-subject");
                const className = btn.getAttribute("data-class");
                const templateName = btn.getAttribute("data-template");
                const paperCount = btn.getAttribute("data-total");
                if (window.ShareManager) {
                    window.ShareManager.shareSubject({
                        subject,
                        className,
                        templateName,
                        paperCount,
                        batchKey: key
                    });
                }
            });
        });

        // Action: Share Single Paper via WhatsApp
        this.container.querySelectorAll(".btn-action-share").forEach(btn => {
            btn.addEventListener("click", () => {
                const paperId = btn.getAttribute("data-paper-id");
                const studentName = btn.getAttribute("data-name");
                const rollNo = btn.getAttribute("data-roll");
                const subject = btn.getAttribute("data-subject");
                const className = btn.getAttribute("data-class");
                if (window.ShareManager) {
                    window.ShareManager.sharePaper({
                        paperId,
                        studentName,
                        rollNo,
                        subject,
                        className
                    });
                }
            });
        });

        // Action: Evaluate Paper
        this.container.querySelectorAll(".btn-action-eval").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (window.app && typeof window.app.showLoadingBox === "function") {
                    window.app.showLoadingBox("Opening Answer Script...", "Loading student paper & correction workspace...");
                }
                const id = btn.getAttribute("data-paper-id");
                let target = this.papers.find(p => p.id === id);
                if (window.appStorage) {
                    const fresh = await window.appStorage.getEvaluationById(id);
                    if (fresh) target = fresh;
                }
                if (target && window.app) {
                    const batches = this.computeBatches();
                    const targetBatch = batches.find(b => b.papers.some(p => String(p.id) === String(id))) ||
                                        (this.selectedBatchKey !== "all" ? batches.find(b => b.key === this.selectedBatchKey) : null);
                    const queue = targetBatch ? targetBatch.papers : this.papers;
                    window.app.openWorkspace(target, queue);
                }
            });
        });

        this.container.querySelectorAll(".btn-action-quick-marks").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-paper-id");
                if (window.app && typeof window.app.switchView === "function") {
                    await window.app.switchView("correction-marks");
                    if (window.app.correctionMarksPageManager) {
                        const evalItem = window.app.correctionMarksPageManager.evaluations.find(e => String(e.id) === String(id));
                        if (evalItem) {
                            window.app.correctionMarksPageManager.openMarksEntryModal(evalItem);
                        }
                    }
                }
            });
        });

        // Action: Inspect Pages Lightbox
        this.container.querySelectorAll(".btn-action-inspect").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-paper-id");
                const target = this.papers.find(p => p.id === id);
                if (target) {
                    this.openInspector(target);
                }
            });
        });

        // Action: Delete Single Paper
        this.container.querySelectorAll(".btn-action-delete").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-paper-id");
                const target = this.papers.find(p => String(p.id) === String(id));
                if (!target) return;

                if (confirm(`Delete answer sheet for ${target.studentName} (Roll: ${target.rollNo})?`)) {
                    if (window.appStorage) {
                        await window.appStorage.deleteEvaluation(id);
                    }
                    this.selectedIds.delete(String(id));
                    this.papers = this.papers.filter(p => String(p.id) !== String(id));
                    if (window.app && window.app.showToast) {
                        window.app.showToast(`Deleted paper for ${target.studentName}.`, "info");
                    }
                    await this.loadData();
                    this.render();
                }
            });
        });

        // Inspector Modal dismissal
        const modalInspector = this.container.querySelector("#modal-papers-inspector");
        const btnCloseInspector = this.container.querySelector("#btn-close-inspector");
        const btnDismissInspector = this.container.querySelector("#btn-dismiss-inspector");
        const btnLaunchEval = this.container.querySelector("#btn-launch-eval-from-inspector");

        const closeInspector = () => {
            if (modalInspector) {
                modalInspector.style.display = "none";
                modalInspector.classList.remove("active");
            }
            this.inspectingPaper = null;
        };

        if (btnCloseInspector) btnCloseInspector.addEventListener("click", closeInspector);
        if (btnDismissInspector) btnDismissInspector.addEventListener("click", closeInspector);

        if (btnLaunchEval) {
            btnLaunchEval.addEventListener("click", () => {
                if (this.inspectingPaper && window.app) {
                    const p = this.inspectingPaper;
                    closeInspector();
                    const batches = this.computeBatches();
                    const targetBatch = batches.find(b => b.papers.some(paper => String(paper.id) === String(p.id)));
                    const queue = targetBatch ? targetBatch.papers : this.papers;
                    window.app.openWorkspace(p, queue);
                }
            });
        }

        this.updateSelectionBadge();
    }

    updateSelectionBadge() {
        const badge = this.container.querySelector("#papers-bulk-delete-badge");
        if (badge) {
            badge.textContent = `(${this.selectedIds.size})`;
            if (this.selectedIds.size > 0) {
                badge.style.background = "rgba(255, 255, 255, 0.22)";
                badge.style.color = "#FFFFFF";
            } else {
                badge.style.background = "rgba(220, 38, 38, 0.1)";
                badge.style.color = "#DC2626";
            }
        }
        const delBtn = this.container.querySelector("#btn-papers-bulk-delete");
        if (delBtn) {
            if (this.selectedIds.size > 0) {
                delBtn.style.background = "#DC2626";
                delBtn.style.color = "#FFFFFF";
                delBtn.style.borderColor = "#DC2626";
                delBtn.style.boxShadow = "0 2px 8px rgba(220, 38, 38, 0.25)";
            } else {
                delBtn.style.background = "#FFFFFF";
                delBtn.style.color = "#DC2626";
                delBtn.style.borderColor = "#DC2626";
                delBtn.style.boxShadow = "none";
            }
        }
        const selectAllBox = this.container.querySelector("#papers-select-all");
        if (selectAllBox) {
            const filtered = this.getFilteredPapers();
            if (filtered.length === 0) {
                selectAllBox.checked = false;
                selectAllBox.indeterminate = false;
            } else if (this.selectedIds.size === filtered.length) {
                selectAllBox.checked = true;
                selectAllBox.indeterminate = false;
            } else if (this.selectedIds.size > 0) {
                selectAllBox.checked = false;
                selectAllBox.indeterminate = true;
            } else {
                selectAllBox.checked = false;
                selectAllBox.indeterminate = false;
            }
        }
    }

    async openChangeTemplateModal(batch) {
        if (!batch || !batch.papers || batch.papers.length === 0) return;
        const catalog = await window.appStorage.getSubjectCatalog();
        const subObj = catalog.find(s => window.appStorage.isSubjectMatch(s.name, '', batch.subject));
        const availableTemplates = (subObj && subObj.templates) ? subObj.templates : [];

        const modalId = "batch-change-template-modal-overlay";
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const modal = document.createElement("div");
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: fadeInModal 0.2s ease-out;
        `;

        modal.innerHTML = `
            <div style="background: #FFFFFF; border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 20px 45px rgba(0,0,0,0.22); padding: 24px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <div>
                        <h3 style="margin: 0 0 4px; font-size: 1.2rem; font-weight: 500; color: #1E293B;">Change Batch Template</h3>
                        <p style="margin: 0; font-size: 0.84rem; color: #64748B;">Reassign template for <strong>${batch.className} — ${batch.subject}</strong> (${batch.total} Papers)</p>
                    </div>
                    <button type="button" id="btn-close-change-tpl" style="background: none; border: none; font-size: 1.4rem; color: #94A3B8; cursor: pointer; line-height: 1;">&times;</button>
                </div>

                <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 12px 14px; margin-bottom: 18px;">
                    <div style="font-size: 0.74rem; font-weight: 500; color: #991B1B; text-transform: uppercase; margin-bottom: 2px;">CURRENT (MISMATCHED) TEMPLATE</div>
                    <div style="font-size: 0.92rem; font-weight: 500; color: #DC2626;">${batch.templateName}</div>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display: block; font-size: 0.86rem; font-weight: 500; color: #334155; margin-bottom: 10px;">
                        Select Correct Template for ${batch.subject}:
                    </label>
                    <div style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto;">
                        ${availableTemplates.map((t, idx) => `
                            <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; border: 1.5px solid ${idx === 0 ? '#007AFF' : '#E2E8F0'}; background: ${idx === 0 ? 'rgba(0,122,255,0.04)' : '#FFFFFF'}; cursor: pointer; transition: all 0.15s ease;" class="lbl-change-tpl-row">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <input type="radio" name="change-target-template" value="${t.id}" data-name="${t.name}" data-marks="${t.maxMarks || 40}" ${idx === 0 ? 'checked' : ''} style="cursor: pointer;" />
                                    <div>
                                        <div style="font-size: 0.88rem; font-weight: 500; color: #1E293B;">${t.name}</div>
                                        <div style="font-size: 0.74rem; color: #64748B;">${t.badge || 'Blueprint'} • ${t.sections ? t.sections.length : 1} Section(s)</div>
                                    </div>
                                </div>
                                <span style="font-size: 0.78rem; font-weight: 500; background: #EEF2F6; color: #334155; padding: 2px 8px; border-radius: 6px;">${t.maxMarks || 40}M</span>
                            </label>
                        `).join('')}
                        <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; border: 1.5px solid #E2E8F0; background: #FFFFFF; cursor: pointer;" class="lbl-change-tpl-row">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="radio" name="change-target-template" value="custom" style="cursor: pointer;" />
                                <span style="font-size: 0.88rem; font-weight: 500; color: #1E293B;">Custom Template Name & Marks</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div id="change-tpl-custom-inputs" style="display: none; margin-bottom: 18px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px;">
                    <div style="margin-bottom: 8px;">
                        <label style="display: block; font-size: 0.78rem; font-weight: 500; color: #475569; margin-bottom: 4px;">New Template / Exam Name</label>
                        <input type="text" id="inp-change-custom-name" placeholder="e.g. Grade 10 Mathematics - Revision 2 Objective" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.85rem;" />
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 500; color: #475569; margin-bottom: 4px;">Total Max Marks</label>
                        <input type="number" id="inp-change-custom-marks" value="40" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.85rem;" />
                    </div>
                </div>

                <div style="margin-bottom: 18px; padding: 10px 14px; background: #F1F5F9; border-radius: 8px; border: 1px solid #E2E8F0;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #334155; cursor: pointer;">
                        <input type="checkbox" id="chk-apply-all-matching" checked style="width: 16px; height: 16px; cursor: pointer;" />
                        <span>Also apply to all other papers in <strong>${batch.className}</strong> for this subject</span>
                    </label>
                </div>

                <div id="change-tpl-progress-bar" style="display: none; margin-bottom: 16px; padding: 12px 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 6px;">
                        <span id="change-tpl-status-text" style="color: #334155; font-weight: 500;">Applying template update...</span>
                        <span id="change-tpl-pct-text" style="color: #007AFF; font-weight: 700;">0%</span>
                    </div>
                    <div style="height: 7px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                        <div id="change-tpl-track" style="height: 100%; width: 0%; background: linear-gradient(90deg, #007AFF 0%, #34C759 100%); border-radius: 999px; transition: width 0.2s ease;"></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" id="btn-cancel-change-tpl" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; font-size: 0.85rem; color: #475569; cursor: pointer;">Cancel</button>
                    <button type="button" id="btn-confirm-apply-template" style="background: #007AFF; color: #FFFFFF; border: none; padding: 8px 18px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <span id="btn-confirm-apply-tpl-text">Apply Template Update</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Radio change
        modal.querySelectorAll("input[name='change-target-template']").forEach(radio => {
            radio.addEventListener("change", (e) => {
                const customBox = modal.querySelector("#change-tpl-custom-inputs");
                modal.querySelectorAll(".lbl-change-tpl-row").forEach(lbl => {
                    lbl.style.borderColor = "#E2E8F0";
                    lbl.style.background = "#FFFFFF";
                });
                const parentLbl = e.target.closest(".lbl-change-tpl-row");
                if (parentLbl) {
                    parentLbl.style.borderColor = "#007AFF";
                    parentLbl.style.background = "rgba(0,122,255,0.04)";
                }
                if (e.target.value === "custom") {
                    if (customBox) customBox.style.display = "block";
                } else {
                    if (customBox) customBox.style.display = "none";
                }
            });
        });

        const closeModal = () => modal.remove();
        modal.querySelector("#btn-close-change-tpl").addEventListener("click", closeModal);
        modal.querySelector("#btn-cancel-change-tpl").addEventListener("click", closeModal);

        modal.querySelector("#btn-confirm-apply-template").addEventListener("click", async () => {
            const selectedRadio = modal.querySelector("input[name='change-target-template']:checked");
            if (!selectedRadio) return;

            let newTplName = "";
            let newTplId = "";
            let newMaxMarks = 40;
            let matchedTpl = null;

            if (selectedRadio.value === "custom") {
                const customName = modal.querySelector("#inp-change-custom-name").value.trim();
                const customMarks = parseFloat(modal.querySelector("#inp-change-custom-marks").value) || 40;
                if (!customName) {
                    alert("Please enter a custom template name.");
                    return;
                }
                newTplName = customName;
                newTplId = `tpl_custom_${Date.now()}`;
                newMaxMarks = customMarks;
            } else {
                matchedTpl = availableTemplates.find(t => t.id === selectedRadio.value);
                if (matchedTpl) {
                    newTplName = matchedTpl.name;
                    newTplId = matchedTpl.id;
                    newMaxMarks = matchedTpl.maxMarks || 40;
                }
            }

            // UI Elements for progress tracking
            const confirmBtn = modal.querySelector("#btn-confirm-apply-template");
            const confirmBtnText = modal.querySelector("#btn-confirm-apply-tpl-text");
            const cancelBtn = modal.querySelector("#btn-cancel-change-tpl");
            const closeBtn = modal.querySelector("#btn-close-change-tpl");
            const progressBox = modal.querySelector("#change-tpl-progress-bar");
            const statusText = modal.querySelector("#change-tpl-status-text");
            const pctText = modal.querySelector("#change-tpl-pct-text");
            const track = modal.querySelector("#change-tpl-track");

            const setProgress = (pct, msg) => {
                const p = Math.min(100, Math.max(0, Math.round(pct)));
                if (track) track.style.width = `${p}%`;
                if (pctText) pctText.textContent = `${p}%`;
                if (statusText && msg) statusText.textContent = msg;
            };

            // Lock controls & show progress bar
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.style.cursor = "wait";
                confirmBtn.style.opacity = "0.9";
            }
            if (confirmBtnText) {
                confirmBtnText.innerHTML = `<span class="btn-spinner-icon" style="display: inline-block; width: 13px; height: 13px; border: 2px solid #FFFFFF; border-top-color: transparent; border-radius: 50%; animation: spinLoading 0.6s linear infinite; vertical-align: middle; margin-right: 4px;"></span><span>Applying...</span>`;
            }
            if (cancelBtn) {
                cancelBtn.disabled = true;
                cancelBtn.style.opacity = "0.45";
                cancelBtn.style.cursor = "not-allowed";
            }
            if (closeBtn) {
                closeBtn.disabled = true;
                closeBtn.style.opacity = "0.45";
                closeBtn.style.cursor = "not-allowed";
            }
            modal.querySelectorAll("input").forEach(inp => inp.disabled = true);
            if (progressBox) progressBox.style.display = "block";

            try {
                setProgress(10, "Fetching paper evaluations from storage...");

                // Build fresh clean questions for the new template!
                const newQuestions = window.buildQuestionsFromTemplate 
                    ? window.buildQuestionsFromTemplate(matchedTpl, newMaxMarks)
                    : [];

                // Scope: Apply to this batch card OR all papers in this class matching this exam
                const applyAllMatching = modal.querySelector("#chk-apply-all-matching") ? modal.querySelector("#chk-apply-all-matching").checked : true;
                const batchPaperIds = new Set(batch.papers.map(p => String(p.id)));
                const allEvals = await window.appStorage.getAllEvaluations(false, true);

                setProgress(25, "Scanning and identifying matching answer scripts...");

                const oldClsNorm = (batch.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const oldTplNorm = (batch.templateName || "").toLowerCase().replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');
                const oldSubNorm = (batch.subject || "").toLowerCase().trim();

                let updatedCount = 0;
                allEvals.forEach(p => {
                    const pId = String(p.id);
                    const isDirectBatch = batchPaperIds.has(pId);
                    let isMatch = isDirectBatch;
                    if (applyAllMatching && !isMatch) {
                        const pCls = (p.class || p.className || p.classLabel || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                        const pTpl = (p.templateName || p.examName || "").toLowerCase().replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');
                        const pSub = (p.subject || "").toLowerCase().trim();
                        if (pCls === oldClsNorm && (pTpl === oldTplNorm || !pTpl) && (!oldSubNorm || pSub === oldSubNorm || window.appStorage.isSubjectMatch(p.subject, p.examName, batch.subject))) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        p.templateName = newTplName;
                        p.templateId = newTplId;
                        p.maxMarks = newMaxMarks;
                        p.examName = newTplName;
                        // CRITICAL: Replace questions so the old 80-mark questions are completely eradicated!
                        p.questions = JSON.parse(JSON.stringify(newQuestions));
                        p.sections = (matchedTpl && matchedTpl.sections) ? JSON.parse(JSON.stringify(matchedTpl.sections)) : [{
                            id: "sec_main",
                            name: "All Questions",
                            title: "All Questions",
                            qStartNo: 1,
                            qEndNo: newQuestions.length,
                            qCount: newQuestions.length,
                            maxMarks: newMaxMarks
                        }];

                        // Clear stale sessionStorage drafts for this paper
                        try {
                            sessionStorage.removeItem(`niprak_draft_${p.id}`);
                            sessionStorage.removeItem(`onespace_draft_${p.id}`);
                        } catch (e) {}

                        updatedCount++;
                    }
                });

                setProgress(55, `Saving ${updatedCount} updated papers to local storage...`);

                if (window.appStorage) {
                    if (typeof window.appStorage.saveAllEvaluations === "function") {
                        await window.appStorage.saveAllEvaluations(allEvals);
                    } else {
                        const directList = allEvals.filter(p => batchPaperIds.has(String(p.id)));
                        for (let i = 0; i < directList.length; i++) {
                            await window.appStorage.saveEvaluation(directList[i]);
                            const stepPct = 55 + Math.round(((i + 1) / directList.length) * 20);
                            setProgress(stepPct, `Saving paper ${i + 1} of ${directList.length}...`);
                        }
                    }
                }

                setProgress(80, "Synchronizing updates with cloud database...");

                // Sync to Firestore if online
                if (window.firebaseManager && window.firebaseManager.firestore) {
                    try {
                        const batchWriter = window.firebaseManager.firestore.batch();
                        const evalColl = window.firebaseManager.firestore.collection("evaluations");
                        allEvals.filter(p => batchPaperIds.has(String(p.id))).forEach(p => {
                            const docRef = evalColl.doc(String(p.id));
                            batchWriter.set(docRef, {
                                templateName: newTplName,
                                templateId: newTplId,
                                maxMarks: newMaxMarks,
                                examName: newTplName,
                                questions: newQuestions,
                                updatedAt: new Date().toISOString()
                            }, { merge: true });
                        });
                        await batchWriter.commit();
                    } catch (fsErr) {
                        console.warn("Firestore batch template update notice:", fsErr);
                    }
                }

                // 100% Complete feedback
                setProgress(100, `✓ Successfully updated ${updatedCount} paper${updatedCount === 1 ? '' : 's'}!`);
                if (track) track.style.background = "#16A34A";
                if (pctText) pctText.style.color = "#16A34A";
                if (confirmBtn) confirmBtn.style.background = "#16A34A";
                if (confirmBtnText) confirmBtnText.innerHTML = "✓ Updated!";

                await new Promise(r => setTimeout(r, 450));

                closeModal();
                if (window.app && typeof window.app.showToast === "function") {
                    window.app.showToast(`✓ Updated template to "${newTplName}" (${newMaxMarks}M) for all ${updatedCount} papers!`, "success");
                }
                await this.init();
                this.selectedBatchKey = "all";
                this.render();
            } catch (err) {
                console.error("Error applying template update:", err);
                setProgress(100, "❌ Update encountered an issue.");
                if (track) track.style.background = "#DC2626";
                if (pctText) pctText.style.color = "#DC2626";
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.style.cursor = "pointer";
                    confirmBtn.style.opacity = "1";
                    confirmBtn.style.background = "#007AFF";
                }
                if (confirmBtnText) confirmBtnText.innerHTML = "Retry Apply";
                if (cancelBtn) {
                    cancelBtn.disabled = false;
                    cancelBtn.style.opacity = "1";
                    cancelBtn.style.cursor = "pointer";
                }
                if (closeBtn) {
                    closeBtn.disabled = false;
                    closeBtn.style.opacity = "1";
                    closeBtn.style.cursor = "pointer";
                }
                modal.querySelectorAll("input").forEach(inp => inp.disabled = false);
            }
        });
    }

    showBatchDeleteModal(batch) {
        if (!batch || !batch.papers || batch.papers.length === 0) return;
        const count = batch.papers.length;
        const totalPages = batch.totalPages;
        const spaceEstimate = this.formatBytes(batch.totalBytes);

        const modalId = "batch-delete-modal-overlay";
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const modal = document.createElement("div");
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: fadeInModal 0.2s ease-out;
        `;

        modal.innerHTML = `
            <div style="background: #FFFFFF; border-radius: 16px; max-width: 480px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.22); overflow: hidden; border: 1px solid #E2E8F0;">
                <div style="padding: 24px; text-align: center;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.2rem; font-weight: 400 !important; color: #0F172A; margin: 0 0 6px;">Delete Batch</h3>
                    <p style="font-size: 0.85rem; color: #64748B; margin: 0 0 16px; line-height: 1.45;">
                        Are you sure you want to permanently delete all papers in <span style="color: #0F172A;">${batch.className} – ${batch.templateName}</span>?
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; text-align: left; margin-bottom: 18px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 0.78rem; color: #64748B;">Target Class & Exam:</span>
                            <span style="font-size: 0.82rem; color: #0071E3;">${batch.className} (${batch.subject})</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 0.78rem; color: #64748B;">Total Batch Papers:</span>
                            <span style="font-size: 0.82rem; color: #DC2626;">${count} Paper(s)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 0.78rem; color: #64748B;">Document Pages:</span>
                            <span style="font-size: 0.82rem; color: #1E293B;">${totalPages} Pages</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 0.78rem; color: #64748B;">Storage Reclaimed:</span>
                            <span style="font-size: 0.82rem; color: #16A34A;">~${spaceEstimate}</span>
                        </div>
                    </div>

                    <div id="batch-delete-progress-bar" style="display: none; margin-bottom: 14px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748B; margin-bottom: 4px;">
                            <span id="batch-delete-status-text">Deleting batch papers...</span>
                            <span id="batch-delete-pct-text">0%</span>
                        </div>
                        <div style="height: 6px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                            <div id="batch-delete-track" style="height: 100%; width: 0%; background: #DC2626; transition: width 0.15s ease;"></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btn-cancel-batch-del" style="flex: 1; height: 38px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-weight: 400 !important; font-size: 0.85rem; cursor: pointer;">
                            Cancel
                        </button>
                        <button type="button" id="btn-confirm-batch-del" style="flex: 1.2; height: 38px; border-radius: 8px; border: none; background: #DC2626; color: #FFFFFF; font-weight: 400 !important; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span id="btn-batch-del-text">Delete Batch (${count})</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector("#btn-cancel-batch-del");
        const confirmBtn = modal.querySelector("#btn-confirm-batch-del");
        const delText = modal.querySelector("#btn-batch-del-text");
        const progressBox = modal.querySelector("#batch-delete-progress-bar");
        const statusText = modal.querySelector("#batch-delete-status-text");
        const pctText = modal.querySelector("#batch-delete-pct-text");
        const track = modal.querySelector("#batch-delete-track");

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.remove();
        });

        confirmBtn.addEventListener("click", async () => {
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.75";
            confirmBtn.style.cursor = "not-allowed";
            progressBox.style.display = "block";

            let deleted = 0;
            for (let i = 0; i < batch.papers.length; i++) {
                const p = batch.papers[i];
                try {
                    await window.appStorage.deleteEvaluation(p.id);
                    deleted++;
                } catch (e) {
                    console.error("Batch delete error on paper:", p.id, e);
                }
                const pct = Math.round(((i + 1) / batch.papers.length) * 100);
                track.style.width = `${pct}%`;
                pctText.textContent = `${pct}%`;
                statusText.textContent = `Deleted ${i + 1} of ${batch.papers.length} papers...`;
            }

            delText.innerHTML = `✓ Done (${deleted} Deleted)`;
            confirmBtn.style.background = "#16A34A";
            await new Promise(r => setTimeout(r, 400));
            modal.remove();

            if (this.selectedBatchKey === batch.key) {
                this.selectedBatchKey = "all";
            }
            await this.loadData();
            this.render();

            if (window.app && window.app.showToast) {
                window.app.showToast(`Deleted batch ${batch.className} (${deleted} papers). Storage freed: ~${spaceEstimate}!`, "success");
            }
        });
    }

    showBulkDeleteModal() {
        const targetIds = Array.from(this.selectedIds);
        if (targetIds.length === 0) {
            if (window.app && window.app.showToast) {
                window.app.showToast("Please select at least one paper using the checkboxes to delete.", "info");
            } else {
                alert("Please select at least one paper using the checkboxes to delete.");
            }
            return;
        }

        const selectedPapers = this.papers.filter(p => targetIds.includes(String(p.id)));
        const count = selectedPapers.length;
        const totalPages = selectedPapers.reduce((sum, p) => sum + (p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1))), 0);
        const totalBytes = selectedPapers.reduce((sum, p) => {
            if (window.appStorage && typeof window.appStorage.measurePaperBytesSync === "function") {
                return sum + window.appStorage.measurePaperBytesSync(p);
            }
            return sum + (p.fileSizeBytes || ((p.pageCount || 1) * 185 * 1024));
        }, 0);
        const spaceEstimate = this.formatBytes(totalBytes);

        const modalId = "papers-bulk-delete-modal-overlay";
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const modal = document.createElement("div");
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: fadeInModal 0.2s ease-out;
        `;

        modal.innerHTML = `
            <div style="background: #FFFFFF; border-radius: 16px; max-width: 480px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.22); overflow: hidden; border: 1px solid #E2E8F0;">
                <div style="padding: 24px; text-align: center;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.2rem; font-weight: 400 !important; color: #0F172A; margin: 0 0 6px;">Delete Selected Papers</h3>
                    <p style="font-size: 0.85rem; color: #64748B; margin: 0 0 16px; line-height: 1.45;">
                        Are you sure you want to permanently delete <span style="color: #0F172A;">${count} selected uploaded paper(s)</span>? This will remove all document scans and free browser storage.
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; text-align: left; margin-bottom: 18px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 0.78rem; color: #64748B;">Selected Papers:</span>
                            <span style="font-size: 0.82rem; color: #DC2626;">${count} Paper(s)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 0.78rem; color: #64748B;">Total Document Pages:</span>
                            <span style="font-size: 0.82rem; color: #1E293B;">${totalPages} Pages</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 0.78rem; color: #64748B;">Estimated Space Freed:</span>
                            <span style="font-size: 0.82rem; color: #16A34A;">~${spaceEstimate}</span>
                        </div>
                    </div>

                    <div id="papers-bulk-delete-progress-bar" style="display: none; margin-bottom: 14px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748B; margin-bottom: 4px;">
                            <span id="papers-bulk-delete-status-text">Deleting papers...</span>
                            <span id="papers-bulk-delete-pct-text">0%</span>
                        </div>
                        <div style="height: 6px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                            <div id="papers-bulk-delete-track" style="height: 100%; width: 0%; background: #DC2626; transition: width 0.15s ease;"></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btn-cancel-papers-bulk-del" style="flex: 1; height: 38px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-weight: 400 !important; font-size: 0.85rem; cursor: pointer;">
                            Cancel
                        </button>
                        <button type="button" id="btn-confirm-papers-bulk-del" style="flex: 1; height: 38px; border-radius: 8px; border: none; background: #DC2626; color: #FFFFFF; font-weight: 400 !important; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span id="btn-papers-bulk-del-text">Delete ${count} Paper(s)</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector("#btn-cancel-papers-bulk-del");
        const confirmBtn = modal.querySelector("#btn-confirm-papers-bulk-del");
        const delText = modal.querySelector("#btn-papers-bulk-del-text");
        const progressBox = modal.querySelector("#papers-bulk-delete-progress-bar");
        const statusText = modal.querySelector("#papers-bulk-delete-status-text");
        const pctText = modal.querySelector("#papers-bulk-delete-pct-text");
        const track = modal.querySelector("#papers-bulk-delete-track");

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.remove();
        });

        confirmBtn.addEventListener("click", async () => {
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.75";
            confirmBtn.style.cursor = "not-allowed";
            progressBox.style.display = "block";

            let deleted = 0;
            for (let i = 0; i < targetIds.length; i++) {
                const id = targetIds[i];
                try {
                    await window.appStorage.deleteEvaluation(id);
                    deleted++;
                } catch (e) {
                    console.error("Bulk delete error on paper:", id, e);
                }
                const pct = Math.round(((i + 1) / targetIds.length) * 100);
                track.style.width = `${pct}%`;
                pctText.textContent = `${pct}%`;
                statusText.textContent = `Deleted ${i + 1} of ${targetIds.length} papers...`;
            }

            this.selectedIds.clear();
            delText.innerHTML = `✓ Done (${deleted} Deleted)`;
            confirmBtn.style.background = "#16A34A";
            await new Promise(r => setTimeout(r, 400));
            modal.remove();

            await this.loadData();
            this.render();

            if (window.app && window.app.showToast) {
                window.app.showToast(`Deleted ${deleted} paper(s) successfully. Storage optimized!`, "success");
            }
        });
    }

    openInspector(paper) {
        this.inspectingPaper = paper;
        const modal = this.container.querySelector("#modal-papers-inspector");
        const title = this.container.querySelector("#inspector-student-title");
        const subtitle = this.container.querySelector("#inspector-student-subtitle");
        const grid = this.container.querySelector("#inspector-pages-grid");
        const note = this.container.querySelector("#inspector-footer-note");

        if (!modal || !grid) return;

        title.textContent = `${paper.studentName || 'Student'} – Roll ${paper.rollNo || 'N/A'}`;
        subtitle.textContent = `${paper.className || 'Class 12-A'} • ${paper.subject || 'Subject'} (${paper.examName || paper.templateName || 'Exam'})`;

        let pages = paper.pages || (paper.pdfDataUrl ? [paper.pdfDataUrl] : []);

        note.textContent = `${pages.length} document page(s) verified • Ready for digital marking.`;

        grid.innerHTML = pages.map((page, idx) => {
            const pageNum = page.pageNumber || idx + 1;
            return `
                <div class="page-thumb-card">
                    <div class="thumb-header">
                        <span class="thumb-page-badge">Page ${pageNum} of ${pages.length}</span>
                        <span class="thumb-verified-badge">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                            Ingested
                        </span>
                    </div>
                    <div class="thumb-canvas-container" id="thumb-canvas-wrap-${pageNum}">
                        ${typeof page === "string" && page.startsWith("data:application/pdf") ? `<iframe src="${page}" style="width: 100%; height: 260px; border: none;"></iframe>` : (typeof page === "string" && page.startsWith("data:image/") ? `<img src="${page}" alt="Page ${pageNum}" style="width: 100%; max-height: 260px; object-fit: contain;" />` : `<div class="thumb-preview-sheet" style="background:#F8FAFC; border:1px dashed #CBD5E1; display:flex; align-items:center; justify-content:center; flex-direction:column; padding:20px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><span style="font-size:12px; color:#64748B; margin-top:8px;">Uploaded Document Page ${pageNum}</span></div>`)}
                    </div>
                </div>
            `;
        }).join('');

        modal.style.display = "flex";
        modal.classList.add("active");
    }

    exportPapersManifest() {
        const headers = ["Paper ID", "Roll Number", "Student Name", "Class", "Subject", "Exam", "Total Pages", "Status", "Obtained Marks", "Max Marks"];
        const rows = this.papers.map(p => [
            p.id || "",
            p.rollNo || "",
            `"${(p.studentName || '').replace(/"/g, '""')}"`,
            p.className || p.class || "",
            p.subject || "",
            `"${(p.examName || p.templateName || '').replace(/"/g, '""')}"`,
            p.pages ? p.pages.length : (p.totalPages || 1),
            p.status || "Pending",
            p.status === "Completed" ? (p.obtainedMarks || 0) : "",
            p.maxMarks || 20
        ]);

        const csvContent = "data:text/csv;charset=utf-8," +
            headers.join(",") + "\n" +
            rows.map(r => r.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `uploaded_papers_manifest_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.app && window.app.showToast) {
            window.app.showToast("Uploaded papers manifest downloaded!", "success");
        }
    }
}

window.UploadedPapersPageManager = UploadedPapersPageManager;
