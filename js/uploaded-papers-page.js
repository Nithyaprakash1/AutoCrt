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
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            const allPapers = await window.appStorage.getAllEvaluations();
            this.papers = typeof window.appStorage.filterEvaluationsForUser === "function"
                ? window.appStorage.filterEvaluationsForUser(allPapers)
                : allPapers;
            if (typeof window.appStorage.getStorageUsage === "function") {
                await window.appStorage.getStorageUsage();
            }
            const savedCatalog = await window.appStorage.getSubjectCatalog();
            if (savedCatalog) {
                const names = savedCatalog.map(s => s.name);
                if (!names.some(n => n.toLowerCase().includes('politic'))) {
                    names.push("Political Science");
                }
                this.subjects = names;
            } else {
                this.subjects = ["Physics", "English", "Political Science", "Economics", "History", "Social Science", "Mathematics", "Biology", "Chemistry", "Tamil"];
            }

            const currentUser = window.appStorage.getCurrentUser();
            const isTeacher = Boolean(currentUser && (currentUser.role === 'evaluator' || currentUser.role === 'teacher'));
            this.currentUser = currentUser;
            this.isTeacher = isTeacher;
            if (isTeacher) {
                let assigned = Array.isArray(currentUser.assignedSubjects) && currentUser.assignedSubjects.length > 0
                    ? [...currentUser.assignedSubjects]
                    : (currentUser.subject ? [currentUser.subject] : []);
                assigned = assigned.filter(s => s && s !== 'all' && s !== 'All Subjects');
                this.subjects = assigned;
                if (this.selectedSubject === "all" || !assigned.some(s => window.appStorage.isSubjectMatch(this.selectedSubject, '', s))) {
                    this.selectedSubject = assigned[0] || "";
                }
            }

            const savedClasses = await window.appStorage.getClassesList();
            if (savedClasses) {
                this.classes = savedClasses;
            } else {
                this.classes = [
                    { id: "cls_12a", name: "Class 12-A" },
                    { id: "cls_12b", name: "Class 12-B" },
                    { id: "cls_12c", name: "Class 12-C" },
                    { id: "cls_12d", name: "Class 12-D" }
                ];
            }
        }
    }

    computeBatches() {
        const batchMap = new Map();
        this.papers.forEach(p => {
            const cls = p.className || p.class || "Class 12-A";
            const sub = p.subject || "General";
            const rawTpl = p.templateName || p.examName || "Exam Blueprint";
            const tpl = window.harmonizeTemplateForSubject ? window.harmonizeTemplateForSubject(rawTpl, sub) : rawTpl;
            const batchKey = `${cls}:::${tpl}`;
            if (!batchMap.has(batchKey)) {
                batchMap.set(batchKey, {
                    key: batchKey,
                    className: cls,
                    templateName: tpl,
                    subject: sub,
                    papers: [],
                    total: 0,
                    completed: 0,
                    pending: 0,
                    totalPages: 0,
                    totalBytes: 0,
                    maxMarks: p.maxMarks || 20
                });
            }
            const b = batchMap.get(batchKey);
            b.papers.push(p);
            b.total++;
            if (p.status === "Completed") {
                b.completed++;
            } else {
                b.pending++;
            }
            const pg = p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1));
            b.totalPages += pg;
            if (window.appStorage && typeof window.appStorage.measurePaperBytesSync === "function") {
                b.totalBytes += window.appStorage.measurePaperBytesSync(p);
            } else {
                b.totalBytes += (p.fileSizeBytes || (pg * 185 * 1024));
            }
        });
        return Array.from(batchMap.values());
    }

    getFilteredBatches() {
        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : this.currentUser;
        const isTeacher = (this.isTeacher !== undefined && this.isTeacher !== null)
            ? this.isTeacher
            : Boolean(currentUser && (currentUser.role === 'evaluator' || currentUser.role === 'teacher'));
        const batches = this.computeBatches();
        return batches.filter(b => {
            // Mandatory Teacher subject guard
            if (isTeacher && this.subjects.length > 0) {
                const matchesAnyTeacherSub = this.subjects.some(s => window.appStorage.isSubjectMatch(b.subject, '', s, b.templateName));
                if (!matchesAnyTeacherSub) return false;
            }

            if (this.selectedSubject !== "all" && !window.appStorage.isSubjectMatch(b.subject, '', this.selectedSubject, b.templateName)) return false;
            if (this.selectedClass !== "all") {
                const clsMatch = b.className === this.selectedClass || b.className.includes(this.selectedClass);
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
        return this.papers.filter(p => {
            const pCls = p.className || p.class || "Class 12-A";
            const rawTpl = p.templateName || p.examName || "Exam Blueprint";
            const pTpl = window.harmonizeTemplateForSubject ? window.harmonizeTemplateForSubject(rawTpl, p.subject) : rawTpl;
            const pKey = `${pCls}:::${pTpl}`;

            // Mandatory Teacher subject guard
            if (isTeacher && this.subjects.length > 0) {
                const matchesAnyTeacherSub = this.subjects.some(s => window.appStorage.isSubjectMatch(p.subject, p.examName, s, p.templateName));
                if (!matchesAnyTeacherSub) return false;
            }

            if (this.selectedBatchKey !== "all" && pKey !== this.selectedBatchKey) return false;
            if (this.selectedSubject !== "all" && !window.appStorage.isSubjectMatch(p.subject, p.examName, this.selectedSubject, p.templateName)) return false;
            if (this.selectedClass !== "all") {
                const clsMatch = pCls === this.selectedClass || pCls.includes(this.selectedClass);
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
                                    ${!isTeacher ? `<option value="all" ${this.selectedSubject === 'all' ? 'selected' : ''}>All</option>` : (this.subjects.length > 1 ? `<option value="all" ${this.selectedSubject === 'all' ? 'selected' : ''}>All My Subjects</option>` : '')}
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
                                                    ${isComp ? `<span class="score-pill">${p.obtainedMarks} / ${p.maxMarks}</span>` : '<span class="score-none">—</span>'}
                                                </td>
                                                <td class="cell-actions">
                                                    <div class="paper-actions-group">
                                                        <button type="button" class="btn-paper-action btn-action-inspect" data-paper-id="${p.id}" title="Inspect pages of this paper">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                            <span>Inspect</span>
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
                const id = btn.getAttribute("data-paper-id");
                let target = this.papers.find(p => p.id === id);
                if (window.appStorage) {
                    const fresh = await window.appStorage.getEvaluationById(id);
                    if (fresh) target = fresh;
                }
                if (target && window.app) {
                    window.app.openWorkspace(target);
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
                    window.app.openWorkspace(p);
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
