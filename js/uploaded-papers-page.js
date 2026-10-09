/**
 * Niprak Digital Correction - Uploaded Papers & Pages Repository Manager
 * Full-page archive of all uploaded exam papers, multi-page answer sheets,
 * multi-dimensional filtering, page count metrics, and page inspection lightbox.
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
        this.searchQuery = "";
        this.inspectingPaper = null;
        this.selectedIds = new Set();
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            this.papers = await window.appStorage.getAllEvaluations();
            const savedCatalog = await window.appStorage.getSubjectCatalog();
            if (savedCatalog) {
                this.subjects = savedCatalog.map(s => s.name);
            } else {
                this.subjects = ["Physics", "English", "Political Science", "Economics", "History", "Social Science"];
            }

            const currentUser = window.appStorage.getCurrentUser();
            if (currentUser && currentUser.role === 'evaluator' && currentUser.assignedSubjects && currentUser.assignedSubjects.length > 0 && !currentUser.assignedSubjects.includes("All Subjects")) {
                this.subjects = currentUser.assignedSubjects;
                if (this.selectedSubject === "all") {
                    this.selectedSubject = currentUser.assignedSubjects[0];
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

    getFilteredPapers() {
        return this.papers.filter(p => {
            if (this.selectedSubject !== "all" && p.subject !== this.selectedSubject) return false;
            if (this.selectedClass !== "all") {
                const clsMatch = p.className === this.selectedClass || (p.className && p.className.includes(this.selectedClass));
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
                const matchId = p.id && p.id.toLowerCase().includes(q);
                if (!matchName && !matchRoll && !matchId) return false;
            }
            return true;
        });
    }

    render() {
        if (!this.container) return;

        // Apply filters
        const filtered = this.getFilteredPapers();

        // Clean up selectedIds no longer present
        const visibleIdSet = new Set(filtered.map(p => String(p.id)));
        const newSelected = new Set();
        this.selectedIds.forEach(id => {
            if (visibleIdSet.has(id)) newSelected.add(id);
        });
        this.selectedIds = newSelected;

        // Compute Metrics
        const totalPapers = this.papers.length;
        const totalPages = this.papers.reduce((sum, p) => sum + (p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1))), 0);
        const completedPapers = this.papers.filter(p => p.status === "Completed").length;
        const pendingPapers = totalPapers - completedPapers;

        this.container.innerHTML = `
            <div class="uploaded-papers-layout">
                <!-- Top Header Banner -->
                <div class="uploaded-page-header">
                    <div class="header-titles">
                        <div class="header-tag-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            Repository & Dispatch
                        </div>
                        <h1 class="page-title">Uploaded Papers & Ingested Pages</h1>
                        <p class="page-subtitle">Central archive of all ingested multi-page answer scripts, allocation status, page verification, and evaluation readiness.</p>
                    </div>

                    <div class="header-actions">
                        <button type="button" class="btn-papers-secondary" id="btn-export-papers-manifest" title="Download CSV manifest of all uploaded papers">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Export Manifest</span>
                        </button>
                        <button type="button" class="btn-papers-secondary" id="btn-papers-bulk-delete" title="Delete selected papers to free storage space" style="border-color: #DC2626; color: #DC2626; font-weight: 500;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            <span>Bulk Delete</span> <span id="papers-bulk-delete-badge" style="background: rgba(220, 38, 38, 0.1); padding: 2px 7px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">(${this.selectedIds.size})</span>
                        </button>
                        <button type="button" class="btn-papers-primary" id="btn-goto-upload-desk">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span>+ Ingest More Papers</span>
                        </button>
                    </div>
                </div>

                <!-- KPI Overview Grid -->
                <div class="papers-kpi-grid">
                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Total Ingested Papers</span>
                            <span class="kpi-value">${totalPapers}</span>
                        </div>
                    </div>

                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-purple">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Total Document Pages</span>
                            <span class="kpi-value">${totalPages} Pages</span>
                        </div>
                    </div>

                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-orange">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Pending Correction</span>
                            <span class="kpi-value">${pendingPapers}</span>
                        </div>
                    </div>

                    <div class="papers-kpi-card">
                        <div class="kpi-icon-wrap icon-green">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Evaluated Papers</span>
                            <span class="kpi-value">${completedPapers}</span>
                        </div>
                    </div>
                </div>

                <!-- Filter & Search Controls Bar -->
                <div class="papers-filter-card">
                    <div class="filter-controls-row">
                        <div class="search-field-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="input-papers-search" placeholder="Search by student name, roll number, or paper ID..." value="${this.searchQuery}" />
                            ${this.searchQuery ? `<button type="button" class="btn-clear-papers-search" id="btn-clear-papers-search">×</button>` : ''}
                        </div>

                        <div class="filter-dropdown-group">
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
                                <label>Class:</label>
                                <select id="select-papers-class" class="form-select-sm">
                                    <option value="all" ${this.selectedClass === 'all' ? 'selected' : ''}>All Classes</option>
                                    ${this.classes.map(c => `
                                        <option value="${c.name}" ${this.selectedClass === c.name ? 'selected' : ''}>${c.name}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="filter-select-item">
                                <label>Status:</label>
                                <select id="select-papers-status" class="form-select-sm">
                                    <option value="all" ${this.selectedStatus === 'all' ? 'selected' : ''}>All Statuses</option>
                                    <option value="Pending" ${this.selectedStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="Completed" ${this.selectedStatus === 'Completed' ? 'selected' : ''}>Evaluated</option>
                                </select>
                            </div>

                            ${(this.selectedSubject !== "all" || this.selectedClass !== "all" || this.selectedStatus !== "all" || this.searchQuery) ? `
                                <button type="button" class="btn-reset-filters" id="btn-reset-papers-filters" title="Reset all active filters">
                                    Reset Filters
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Papers Data Table Card -->
                <div class="papers-table-card">
                    <div class="table-meta-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <span class="table-results-label">Showing <b>${filtered.length}</b> of ${totalPapers} uploaded papers</span>
                        ${this.selectedIds.size > 0 ? `<span style="font-size: 0.82rem; font-weight: 600; color: #DC2626;">${this.selectedIds.size} paper(s) selected for bulk delete</span>` : ''}
                    </div>

                    <div class="papers-table-wrapper">
                        <table class="papers-data-table">
                            <thead>
                                <tr>
                                    <th style="width: 44px; text-align: center;">
                                        <input type="checkbox" id="papers-select-all" title="Select All Papers" style="cursor: pointer; width: 16px; height: 16px;" />
                                    </th>
                                    <th style="width: 90px;">Roll No</th>
                                    <th>Student Name</th>
                                    <th style="width: 120px;">Class</th>
                                    <th>Subject & Exam</th>
                                    <th style="width: 110px;">Page Count</th>
                                    <th style="width: 140px;">Evaluation Status</th>
                                    <th style="width: 90px;">Score</th>
                                    <th style="width: 170px; text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.length === 0 ? `
                                    <tr>
                                        <td colspan="9" class="papers-empty-cell">
                                            <div class="empty-papers-state">
                                                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                <span>No papers match the current filters.</span>
                                                <button type="button" class="btn-empty-upload-shortcut" id="btn-empty-upload-shortcut">
                                                    Upload New Papers
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ` : filtered.map(p => {
                                    const pageCount = p.pageCount || (p.pages ? p.pages.length : (p.totalPages || 1));
                                    const isComp = p.status === "Completed";
                                    const initials = (p.studentName || "ST").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                                    const isChecked = this.selectedIds.has(String(p.id));
                                    return `
                                        <tr data-paper-id="${p.id}" class="${isChecked ? 'row-selected' : ''}" style="${isChecked ? 'background-color: rgba(220, 38, 38, 0.04);' : ''}">
                                            <td style="text-align: center;">
                                                <input type="checkbox" class="papers-item-check" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
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
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/></svg>
                                                    ${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'}
                                                </span>
                                            </td>
                                            <td class="cell-status">
                                                <span class="status-pill ${isComp ? 'status-completed' : 'status-pending'}">
                                                    <span class="status-dot"></span>
                                                    ${isComp ? 'Evaluated' : 'Pending'}
                                                </span>
                                            </td>
                                            <td class="cell-score">
                                                ${isComp ? `<span class="score-pill">${p.obtainedMarks} / ${p.maxMarks}</span>` : '<span class="score-none">—</span>'}
                                            </td>
                                            <td class="cell-actions" style="text-align: right;">
                                                <button type="button" class="btn-paper-action btn-action-inspect" data-paper-id="${p.id}" title="Inspect pages of this paper">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                    Inspect
                                                </button>
                                                <button type="button" class="btn-paper-action btn-action-eval" data-paper-id="${p.id}" title="Open evaluation workspace">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                                    Evaluate
                                                </button>
                                                <button type="button" class="btn-paper-action btn-action-delete" data-paper-id="${p.id}" title="Delete paper">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
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

                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto; padding: 20px;">
                        <div class="inspector-pages-grid" id="inspector-pages-grid">
                            <!-- Page Thumbnails injected dynamically -->
                        </div>
                    </div>

                    <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="inspector-footer-note" id="inspector-footer-note">Pages are verified and ready for evaluation.</span>
                        <div class="inspector-footer-actions">
                            <button type="button" class="btn-secondary" id="btn-dismiss-inspector">Close</button>
                            <button type="button" class="btn-primary" id="btn-launch-eval-from-inspector">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                Open in Evaluator
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
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

        // Action: Delete Paper
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
                    if (window.app) window.app.showToast(`Deleted paper for ${target.studentName}.`);
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
        const approxKB = totalPages * 350;
        const spaceEstimate = approxKB >= 1024 ? `${(approxKB / 1024).toFixed(1)} MB` : `${approxKB} KB`;

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
                <div style="padding: 26px; text-align: center;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: #0F172A; margin: 0 0 8px;">Delete Uploaded Papers</h3>
                    <p style="font-size: 0.88rem; color: #64748B; margin: 0 0 18px; line-height: 1.45;">
                        Are you sure you want to permanently delete <strong>${count} selected uploaded paper(s)</strong>? This will remove all associated document scans and free browser storage.
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 16px; text-align: left; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Selected Papers:</span>
                            <span style="font-size: 0.85rem; font-weight: 700; color: #DC2626;">${count} Paper(s)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Total Document Pages:</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #1E293B;">${totalPages} Pages</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 0.8rem; color: #64748B;">Estimated Space Freed:</span>
                            <span style="font-size: 0.85rem; font-weight: 700; color: #16A34A;">~${spaceEstimate}</span>
                        </div>
                    </div>

                    <div id="papers-bulk-delete-progress-bar" style="display: none; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748B; margin-bottom: 4px;">
                            <span id="papers-bulk-delete-status-text">Deleting papers...</span>
                            <span id="papers-bulk-delete-pct-text">0%</span>
                        </div>
                        <div style="height: 6px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                            <div id="papers-bulk-delete-track" style="height: 100%; width: 0%; background: #DC2626; transition: width 0.15s ease;"></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btn-cancel-papers-bulk-del" style="flex: 1; height: 42px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.15s ease;">
                            Cancel
                        </button>
                        <button type="button" id="btn-confirm-papers-bulk-del" style="flex: 1; height: 42px; border-radius: 10px; border: none; background: #DC2626; color: #FFFFFF; font-weight: 600; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s ease;">
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
            await new Promise(r => setTimeout(r, 450));
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
        subtitle.textContent = `${paper.className || 'Class 12-A'} • ${paper.subject || 'Subject'} (${paper.examName || 'Exam'})`;

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

        if (window.app) window.app.showToast("Uploaded papers manifest downloaded!");
    }
}

window.UploadedPapersPageManager = UploadedPapersPageManager;
