/**
 * OneSpace Digital Correction - Teacher Dashboard
 * Features:
 * 1. Time-of-day greeting (Good morning, Good afternoon, Good evening) with teacher name & subject.
 * 2. KPI metrics cards with live uncorrected / corrected counters and performance percentage.
 * 3. 3 Chart.js analytics graphs (Score Distribution, Grade Breakdown, Question Performance).
 * 4. Comprehensive Filter & Search Strip: Status tabs, Class dropdown, Search input.
 * 5. Bulk Download of Evaluated PDFs & Bulk Export to Excel / CSV with multi-select checkboxes.
 * 6. Responsive Student Papers Evaluation Table with quick actions (Evaluate, View/Edit, PDF, Delete).
 */

class DashboardManager {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = Object.assign({
            onStartNew: null,
            onOpenEvaluation: null,
            onDownloadPDF: null,
            onBulkDownloadPDF: null,
            onExportExcel: null
        }, options);

        this.evaluations = [];
        this.filteredEvaluations = [];
        this.activeTab = "all"; // 'all' | 'uncorrected' | 'corrected'
        this.selectedClassFilter = "all"; // 'all' or class name
        this.searchQuery = "";
        this.selectedIds = new Set();
        this.teacherSubject = "";
        this.teacherName = "";
        this.charts = {}; // Store Chart.js instances

        // Drill-down step: 'papers' (direct view) | 'classes' (grid view)
        this.viewMode = "papers"; // Default to direct papers view with filters so teacher papers are never hidden
    }

    async init() {
        if (!this.container) return;
        this.evaluations = await window.appStorage.getAllEvaluations();

        // Get authenticated user profile for subject panel & greeting name
        const user = window.appStorage.getCurrentUser();
        if (user) {
            this.teacherName = user.name || "";
            this.teacherSubject = (user.assignedSubjects && user.assignedSubjects.length > 0)
                ? user.assignedSubjects[0]
                : (user.subject || "");
        }

        this.applyFilters();
        this.render();
        this.bindEvents();
        this.renderCharts();
    }

    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }

    destroyCharts() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key] && typeof this.charts[key].destroy === "function") {
                this.charts[key].destroy();
            }
        });
        this.charts = {};
    }

    isPaperCorrected(e) {
        if (!e) return false;
        if (e.status === "Completed" || e.status === "Graded" || e.status === "Evaluated") return true;
        if (Number(e.obtainedMarks) > 0) return true;
        if (Array.isArray(e.questions) && e.questions.some(q => q.status === "correct" || q.status === "wrong" || Number(q.awardedMarks) > 0)) {
            return true;
        }
        return false;
    }

    getSubjectEvals() {
        if (!this.teacherSubject || this.teacherSubject === "all" || this.teacherSubject === "All Subjects") {
            return this.evaluations;
        }
        const tSub = this.teacherSubject.toLowerCase();
        const matched = this.evaluations.filter(e => {
            if (!e.subject) return true;
            const s = e.subject.toLowerCase();
            return s === tSub || s.includes(tSub) || tSub.includes(s);
        });
        return matched.length > 0 ? matched : this.evaluations;
    }

    applyFilters() {
        this.filteredEvaluations = this.evaluations.filter(e => {
            const isCorr = this.isPaperCorrected(e);

            // 1. Status Tab filter
            if (this.activeTab === "uncorrected" && isCorr) return false;
            if (this.activeTab === "corrected" && !isCorr) return false;

            // 2. Class filter
            if (this.selectedClassFilter && this.selectedClassFilter !== "all") {
                const eCls = (e.class || e.className || e.classLabel || "").toLowerCase();
                if (eCls !== this.selectedClassFilter.toLowerCase()) return false;
            }

            // 3. Search query filter
            if (this.searchQuery && this.searchQuery.trim().length > 0) {
                const q = this.searchQuery.toLowerCase().trim();
                const name = (e.studentName || "").toLowerCase();
                const roll = (e.rollNo || "").toLowerCase();
                const sub = (e.subject || "").toLowerCase();
                const exam = (e.examName || e.templateName || "").toLowerCase();
                const cls = (e.class || e.className || "").toLowerCase();
                if (!name.includes(q) && !roll.includes(q) && !sub.includes(q) && !exam.includes(q) && !cls.includes(q)) {
                    return false;
                }
            }

            return true;
        });

        // Clean up selectedIds that are no longer in filtered set
        const visibleIdSet = new Set(this.filteredEvaluations.map(e => String(e.id)));
        const newSelected = new Set();
        this.selectedIds.forEach(id => {
            if (visibleIdSet.has(id)) newSelected.add(id);
        });
        this.selectedIds = newSelected;
    }

    render() {
        this.destroyCharts();

        // Metric calculations for teacher subject
        const subjectEvals = this.getSubjectEvals();
        const totalCount = subjectEvals.length;
        const correctedCount = subjectEvals.filter(e => this.isPaperCorrected(e)).length;
        const uncorrectedCount = Math.max(0, totalCount - correctedCount);

        const gradedEvals = subjectEvals.filter(e => this.isPaperCorrected(e) && (
            (e.percentage !== undefined && e.percentage !== null) ||
            (Number(e.maxMarks) > 0 && e.obtainedMarks !== undefined)
        ));

        const avgScorePct = gradedEvals.length > 0
            ? Math.round(gradedEvals.reduce((sum, e) => {
                const pct = (e.percentage !== undefined && e.percentage !== null)
                    ? Number(e.percentage)
                    : (Number(e.maxMarks) > 0 ? (Number(e.obtainedMarks || 0) / Number(e.maxMarks)) * 100 : 0);
                return sum + pct;
            }, 0) / gradedEvals.length)
            : 0;

        // Distinct classes for filter dropdown
        const classSet = new Set(
            this.evaluations
                .map(e => e.class || e.className || e.classLabel)
                .filter(Boolean)
        );
        const classList = Array.from(classSet);

        const ic = window.Icons || {};
        const greetingStr = this.getGreeting();
        const displayName = this.teacherName || "Teacher";
        const displaySubject = (this.teacherSubject && this.teacherSubject !== 'all') ? this.teacherSubject : 'Evaluation';

        this.container.innerHTML = `
            <div class="dashboard-page">
                <!-- Welcome Banner with Dynamic Greeting, Subject Title & Quick Export Actions -->
                <div class="dashboard-welcome-banner">
                    <div class="welcome-text-col">
                        <span class="welcome-greeting">${greetingStr}, ${displayName}! 👋</span>
                        <h2 class="welcome-headline">${displaySubject} Evaluation Desk</h2>
                        <p class="welcome-sub">Manage answer sheet corrections, review live score distributions, and export evaluated student documents.</p>
                    </div>
                    <div class="welcome-action-col" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button type="button" class="btn-primary btn-large" id="dash-btn-start-correction" title="Open first pending paper to evaluate">
                            <span class="btn-icon">${ic.lightning || '⚡'}</span> Start Correction
                        </button>
                        <button type="button" class="btn-secondary" id="dash-btn-banner-bulk-pdf" title="Bulk download all evaluated PDFs" style="background: #FFFFFF; border: 1px solid rgba(0, 122, 255, 0.4); color: #007AFF;">
                            <span class="btn-icon">${ic.pdf || '📄'}</span> Bulk Download PDFs
                        </button>
                        <button type="button" class="btn-secondary" id="dash-btn-banner-export-excel" title="Export class result matrix to Excel" style="background: #FFFFFF; border: 1px solid rgba(52, 199, 89, 0.4); color: #2E7D32;">
                            <span class="btn-icon">${ic.csv || '📊'}</span> Export Excel
                        </button>
                    </div>
                </div>

                <!-- Live Counter Labels & KPI Metric Cards -->
                <div class="kpi-grid">
                    <div class="kpi-card kpi-uncorrected-highlight" id="card-tab-uncorrected" title="Click to view Uncorrected Papers" style="cursor: pointer;">
                        <div class="kpi-card-header">
                            <div class="kpi-icon-wrap bg-amber-light">
                                <span class="kpi-icon text-amber">${ic.pending || ''}</span>
                            </div>
                            <span class="counter-badge counter-badge-new" style="font-size: 0.72rem; padding: 4px 9px; border-radius: 6px; background: rgba(217, 119, 6, 0.12); color: #D97706; font-weight: 700; white-space: nowrap;">${uncorrectedCount} UNCORRECTED</span>
                        </div>
                        <div class="kpi-card-body">
                            <span class="kpi-value text-amber">${uncorrectedCount}</span>
                            <span class="kpi-title">UNCORRECTED PAPERS</span>
                        </div>
                    </div>

                    <div class="kpi-card kpi-corrected-highlight" id="card-tab-corrected" title="Click to view Corrected Papers" style="cursor: pointer;">
                        <div class="kpi-card-header">
                            <div class="kpi-icon-wrap bg-green-light">
                                <span class="kpi-icon text-green">${ic.completed || ''}</span>
                            </div>
                            <span class="counter-badge counter-badge-done" style="font-size: 0.72rem; padding: 4px 9px; border-radius: 6px; background: rgba(52, 199, 89, 0.12); color: #34C759; font-weight: 700; white-space: nowrap;">${correctedCount} GRADED</span>
                        </div>
                        <div class="kpi-card-body">
                            <span class="kpi-value text-green">${correctedCount}</span>
                            <span class="kpi-title">CORRECTED PAPERS</span>
                        </div>
                    </div>

                    <div class="kpi-card" id="card-tab-all" title="Click to view All Papers" style="cursor: pointer;">
                        <div class="kpi-card-header">
                            <div class="kpi-icon-wrap bg-blue-light">
                                <span class="kpi-icon text-blue">${ic.evaluations || ''}</span>
                            </div>
                            <span class="counter-badge" style="font-size: 0.72rem; padding: 4px 9px; border-radius: 6px; background: rgba(0, 122, 255, 0.12); color: #007AFF; font-weight: 700; white-space: nowrap;">TOTAL</span>
                        </div>
                        <div class="kpi-card-body">
                            <span class="kpi-value">${totalCount}</span>
                            <span class="kpi-title">TOTAL ASSIGNED</span>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-card-header">
                            <div class="kpi-icon-wrap" style="background: rgba(255, 45, 85, 0.1);">
                                <span class="kpi-icon" style="color: #FF2D55;">${ic.performance || ''}</span>
                            </div>
                            <span class="counter-badge" style="font-size: 0.72rem; padding: 4px 9px; border-radius: 6px; background: rgba(255, 45, 85, 0.12); color: #FF2D55; font-weight: 700; white-space: nowrap;">${gradedEvals.length} EVALUATED</span>
                        </div>
                        <div class="kpi-card-body">
                            <span class="kpi-value">${avgScorePct}%</span>
                            <span class="kpi-title">AVG PERFORMANCE</span>
                        </div>
                    </div>
                </div>

                <!-- Analytics Charts Section -->
                <div class="analytics-charts-grid" style="margin-bottom: 24px;">
                    <div class="chart-card">
                        <div class="chart-header">
                            <h4 class="chart-title">Score Distribution</h4>
                            <span class="chart-badge">Class Performance</span>
                        </div>
                        <div class="chart-body" style="height: 180px;">
                            <canvas id="chart-score-dist"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-header">
                            <h4 class="chart-title">Grade Breakdown</h4>
                            <span class="chart-badge">Grades A+ to F</span>
                        </div>
                        <div class="chart-body" style="height: 180px;">
                            <canvas id="chart-grade-dist"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-header">
                            <h4 class="chart-title">Question Accuracy</h4>
                            <span class="chart-badge">Avg % by Question</span>
                        </div>
                        <div class="chart-body" style="height: 180px;">
                            <canvas id="chart-question-perf"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Main Evaluation Desk Section with Filters & Bulk Actions -->
                <div class="dashboard-main-section">
                    <div class="section-top-bar" style="margin-bottom: 16px;">
                        <div>
                            <h3 class="section-title">Student Papers & Evaluation Desk</h3>
                            <p class="section-subtitle">Real-time roster of answer sheets. Filter by class or status, mark papers, and bulk export PDFs or Excel matrices.</p>
                        </div>
                    </div>

                    <!-- Comprehensive Filter and Control Bar -->
                    <div class="dash-filters-toolbar" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: #F8F9FA; padding: 12px 16px; border-radius: 12px; border: 1px solid #E5E7EB; margin-bottom: 18px;">
                        <!-- Left: Status Tabs -->
                        <div class="dash-filters-row" style="display: flex; gap: 6px;">
                            <button type="button" class="btn-action-view ${this.activeTab === 'all' ? 'active' : ''}" id="tab-btn-all" style="padding: 6px 14px; font-size: 0.85rem; font-weight: 600; border-radius: 8px;">
                                All Papers (${totalCount})
                            </button>
                            <button type="button" class="btn-action-view ${this.activeTab === 'uncorrected' ? 'active' : ''}" id="tab-btn-uncorrected" style="padding: 6px 14px; font-size: 0.85rem; font-weight: 600; border-radius: 8px; color: ${this.activeTab === 'uncorrected' ? '#FFFFFF' : '#D97706'};">
                                Uncorrected (${uncorrectedCount})
                            </button>
                            <button type="button" class="btn-action-view ${this.activeTab === 'corrected' ? 'active' : ''}" id="tab-btn-corrected" style="padding: 6px 14px; font-size: 0.85rem; font-weight: 600; border-radius: 8px; color: ${this.activeTab === 'corrected' ? '#FFFFFF' : '#16A34A'};">
                                Corrected (${correctedCount})
                            </button>
                        </div>

                        <!-- Center: Class Filter Dropdown & Search Input -->
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1; max-width: 520px; justify-content: flex-end;">
                            <select id="dash-filter-class" class="form-select-sm" style="font-size: 0.85rem; font-weight: 500; height: 36px; padding: 0 10px; border-radius: 8px; min-width: 140px;">
                                <option value="all">All Classes</option>
                                ${classList.map(cls => `<option value="${cls}" ${this.selectedClassFilter === cls ? 'selected' : ''}>${cls}</option>`).join("")}
                            </select>

                            <div style="position: relative; flex: 1; min-width: 200px;">
                                <input type="text" id="dash-search-input" class="form-input form-input-sm" value="${this.searchQuery}" placeholder="🔍 Search student or roll no..." style="width: 100%; height: 36px; padding-left: 12px; font-size: 0.85rem; border-radius: 8px;" />
                            </div>
                        </div>

                        <!-- Right: Bulk Actions -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button type="button" class="btn-secondary" id="dash-btn-bulk-pdf" title="Bulk download selected or filtered PDFs" style="background: #FFFFFF; border: 1px solid #007AFF; color: #007AFF; font-size: 0.84rem; font-weight: 600; padding: 7px 14px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                                <span class="btn-icon">${ic.pdf || '📄'}</span> Bulk Download PDFs <span id="dash-pdf-count-badge" style="background: rgba(0, 122, 255, 0.12); padding: 2px 7px; border-radius: 10px; font-size: 0.75rem;">(${this.selectedIds.size > 0 ? this.selectedIds.size : 'All'})</span>
                            </button>

                            <button type="button" class="btn-secondary" id="dash-btn-bulk-excel" title="Bulk export spreadsheet" style="background: #FFFFFF; border: 1px solid #16A34A; color: #16A34A; font-size: 0.84rem; font-weight: 600; padding: 7px 14px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                                <span class="btn-icon">${ic.csv || '📊'}</span> Bulk Export Excel
                            </button>
                        </div>
                    </div>

                    <!-- Papers Table with Multi-Select Checkboxes -->
                    <div class="recent-papers-table-wrap">
                        <table class="recent-papers-table">
                            <thead>
                                <tr>
                                    <th style="width: 44px; text-align: center;">
                                        <input type="checkbox" id="dash-select-all" title="Select All Papers" style="cursor: pointer; width: 16px; height: 16px;" />
                                    </th>
                                    <th>Student</th>
                                    <th>Register No</th>
                                    <th>Class</th>
                                    <th>Subject & Exam</th>
                                    <th>Marks</th>
                                    <th>Percentage</th>
                                    <th>Status</th>
                                    <th>Last Updated</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="dash-papers-tbody">
                                <!-- Rendered dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.renderTableRows();
    }

    renderTableRows() {
        const tbody = this.container.querySelector("#dash-papers-tbody");
        if (!tbody) return;

        if (this.filteredEvaluations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state-cell" style="text-align: center; padding: 48px 16px; color: #64748B;">
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 12px; display: block; opacity: 0.35;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        <p style="font-size: 0.95rem; font-weight: 500; margin: 0 0 6px;">No evaluation records match your current filter criteria.</p>
                        <p style="font-size: 0.82rem; margin: 0; color: #94A3B8;">Try changing the status tab, switching class, or clearing your search query.</p>
                    </td>
                </tr>
            `;
            this.updateSelectionBadge();
            return;
        }

        const ic = window.Icons || {};

        tbody.innerHTML = this.filteredEvaluations.map(ev => {
            const isCompleted = this.isPaperCorrected(ev);
            const statusClass = isCompleted ? "badge-completed" : "badge-pending";
            const dateStr = ev.updatedAt ? new Date(ev.updatedAt).toLocaleDateString() : "-";
            const isChecked = this.selectedIds.has(String(ev.id));
            const pct = (ev.percentage !== undefined && ev.percentage !== null)
                ? Number(ev.percentage)
                : (Number(ev.maxMarks) > 0 ? Math.round((Number(ev.obtainedMarks || 0) / Number(ev.maxMarks)) * 100) : 0);

            return `
                <tr class="${isChecked ? 'row-selected' : ''}" style="${isChecked ? 'background-color: rgba(0, 122, 255, 0.04);' : ''}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="dash-paper-check" data-id="${ev.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
                    </td>
                    <td class="font-bold">
                        <div class="student-name-meta" style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #007AFF, #5856D6); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
                                ${(ev.studentName || "S").charAt(0).toUpperCase()}
                            </div>
                            <span>${ev.studentName || "Unnamed Student"}</span>
                        </div>
                    </td>
                    <td class="font-mono">${ev.rollNo || "-"}</td>
                    <td>${ev.class || ev.className || "Class 12"} ${ev.section ? `(${ev.section})` : ''}</td>
                    <td>
                        <div class="subject-exam-cell">
                            <span class="subj-tag">${ev.subject || "Physics"}</span>
                            <span class="exam-tag text-muted" style="display: block; font-size: 0.75rem; margin-top: 2px;">${ev.examName || ev.templateName || "Board Blueprint"}</span>
                        </div>
                    </td>
                    <td>
                        <strong class="${isCompleted ? 'text-green' : 'text-amber'}">${ev.obtainedMarks || 0}</strong> / ${ev.maxMarks || 70}
                    </td>
                    <td>
                        <span class="pct-pill" style="font-weight: 700; ${pct >= 75 ? 'color: #16A34A;' : pct >= 50 ? 'color: #D97706;' : 'color: #DC2626;'}">${pct}%</span>
                    </td>
                    <td>
                        <span class="status-pill ${statusClass}">${isCompleted ? 'Corrected' : 'Uncorrected'}</span>
                    </td>
                    <td class="text-muted font-sm">${dateStr}</td>
                    <td class="text-right">
                        <div class="action-btn-group" style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                            <button type="button" class="btn-action-view btn-dash-open" data-id="${ev.id}" title="${isCompleted ? 'Review or edit marks' : 'Start correction'}">
                                ${isCompleted ? 'View / Edit' : 'Evaluate'}
                            </button>
                            <button type="button" class="btn-action-pdf btn-dash-pdf" data-id="${ev.id}" title="Download individual evaluated PDF">
                                ${ic.pdf || '📄'} PDF
                            </button>
                            <button type="button" class="btn-action-delete btn-dash-delete" data-id="${ev.id}" title="Delete paper" style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25); color: #DC2626; padding: 4px 8px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Del
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        this.updateSelectionBadge();
    }

    updateSelectionBadge() {
        const badge = this.container.querySelector("#dash-pdf-count-badge");
        if (badge) {
            badge.textContent = `(${this.selectedIds.size > 0 ? this.selectedIds.size : 'All ' + this.filteredEvaluations.length})`;
        }
        const selectAllBox = this.container.querySelector("#dash-select-all");
        if (selectAllBox) {
            const totalVis = this.filteredEvaluations.length;
            if (totalVis === 0) {
                selectAllBox.checked = false;
                selectAllBox.indeterminate = false;
            } else if (this.selectedIds.size === totalVis) {
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

    bindEvents() {
        // Start Correction Queue button (Banner)
        const startBtn = this.container.querySelector("#dash-btn-start-correction");
        if (startBtn) {
            startBtn.addEventListener("click", () => {
                // Find first uncorrected paper to open directly
                const uncorrected = this.evaluations.find(e => !this.isPaperCorrected(e));
                if (uncorrected && this.options.onOpenEvaluation) {
                    this.options.onOpenEvaluation(uncorrected);
                } else if (this.evaluations.length > 0 && this.options.onOpenEvaluation) {
                    this.options.onOpenEvaluation(this.evaluations[0]);
                } else if (this.options.onStartNew) {
                    this.options.onStartNew();
                }
            });
        }

        // Banner Bulk PDF Button
        const bannerBulkPdf = this.container.querySelector("#dash-btn-banner-bulk-pdf");
        if (bannerBulkPdf) {
            bannerBulkPdf.addEventListener("click", () => {
                this.triggerBulkPdfDownload();
            });
        }

        // Banner Bulk Excel Button
        const bannerExportExcel = this.container.querySelector("#dash-btn-banner-export-excel");
        if (bannerExportExcel) {
            bannerExportExcel.addEventListener("click", () => {
                this.triggerExcelExport();
            });
        }

        // Toolbar Bulk PDF Button
        const toolbarBulkPdf = this.container.querySelector("#dash-btn-bulk-pdf");
        if (toolbarBulkPdf) {
            toolbarBulkPdf.addEventListener("click", () => {
                this.triggerBulkPdfDownload();
            });
        }

        // Toolbar Bulk Excel Button
        const toolbarBulkExcel = this.container.querySelector("#dash-btn-bulk-excel");
        if (toolbarBulkExcel) {
            toolbarBulkExcel.addEventListener("click", () => {
                this.triggerExcelExport();
            });
        }

        // KPI Card: Uncorrected
        const cardUncorrected = this.container.querySelector("#card-tab-uncorrected");
        if (cardUncorrected) {
            cardUncorrected.addEventListener("click", () => {
                this.activeTab = "uncorrected";
                this.updateFilterTabButtons();
                this.applyFilters();
                this.renderTableRows();
            });
        }

        // KPI Card: Corrected
        const cardCorrected = this.container.querySelector("#card-tab-corrected");
        if (cardCorrected) {
            cardCorrected.addEventListener("click", () => {
                this.activeTab = "corrected";
                this.updateFilterTabButtons();
                this.applyFilters();
                this.renderTableRows();
            });
        }

        // KPI Card: All
        const cardAll = this.container.querySelector("#card-tab-all");
        if (cardAll) {
            cardAll.addEventListener("click", () => {
                this.activeTab = "all";
                this.updateFilterTabButtons();
                this.applyFilters();
                this.renderTableRows();
            });
        }

        // Status Tabs in Toolbar
        const tabAll = this.container.querySelector("#tab-btn-all");
        if (tabAll) {
            tabAll.addEventListener("click", () => {
                this.activeTab = "all";
                this.updateFilterTabButtons();
                this.applyFilters();
                this.renderTableRows();
            });
        }

        const tabUncorrected = this.container.querySelector("#tab-btn-uncorrected");
        if (tabUncorrected) {
            tabUncorrected.addEventListener("click", () => {
                this.activeTab = "uncorrected";
                this.updateFilterTabButtons();
                this.applyFilters();
                this.renderTableRows();
            });
        }

        const tabCorrected = this.container.querySelector("#tab-btn-corrected");
        if (tabCorrected) {
            tabCorrected.addEventListener("click", () => {
                this.activeTab = "corrected";
                this.updateFilterTabButtons();
                this.applyFilters();
                this.renderTableRows();
            });
        }

        // Class Filter Dropdown
        const classSelect = this.container.querySelector("#dash-filter-class");
        if (classSelect) {
            classSelect.addEventListener("change", (e) => {
                this.selectedClassFilter = e.target.value;
                this.applyFilters();
                this.renderTableRows();
            });
        }

        // Search Input
        const searchInput = this.container.querySelector("#dash-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.applyFilters();
                this.renderTableRows();
            });
        }

        // Select All Checkbox
        const selectAllBox = this.container.querySelector("#dash-select-all");
        if (selectAllBox) {
            selectAllBox.addEventListener("change", (e) => {
                if (e.target.checked) {
                    this.filteredEvaluations.forEach(ev => this.selectedIds.add(String(ev.id)));
                } else {
                    this.selectedIds.clear();
                }
                this.renderTableRows();
            });
        }

        // Table Delegation (Row Checkboxes & Actions)
        const tbody = this.container.querySelector("#dash-papers-tbody");
        if (tbody) {
            tbody.addEventListener("change", (e) => {
                const check = e.target.closest(".dash-paper-check");
                if (check) {
                    const id = String(check.getAttribute("data-id"));
                    if (check.checked) {
                        this.selectedIds.add(id);
                    } else {
                        this.selectedIds.delete(id);
                    }
                    this.updateSelectionBadge();
                    const tr = check.closest("tr");
                    if (tr) {
                        tr.style.backgroundColor = check.checked ? "rgba(0, 122, 255, 0.04)" : "";
                    }
                }
            });

            tbody.addEventListener("click", async (e) => {
                // Open workspace
                const openBtn = e.target.closest(".btn-dash-open");
                if (openBtn) {
                    const id = openBtn.getAttribute("data-id");
                    const evaluation = await window.appStorage.getEvaluationById(id);
                    if (evaluation && this.options.onOpenEvaluation) {
                        this.options.onOpenEvaluation(evaluation);
                    }
                    return;
                }

                // Individual PDF
                const pdfBtn = e.target.closest(".btn-dash-pdf");
                if (pdfBtn) {
                    const id = pdfBtn.getAttribute("data-id");
                    const evaluation = await window.appStorage.getEvaluationById(id);
                    if (evaluation && this.options.onDownloadPDF) {
                        this.options.onDownloadPDF(evaluation);
                    }
                    return;
                }

                // Delete paper
                const delBtn = e.target.closest(".btn-dash-delete");
                if (delBtn) {
                    const id = delBtn.getAttribute("data-id");
                    const ev = await window.appStorage.getEvaluationById(id);
                    const name = ev ? (ev.studentName || "student paper") : "this paper";
                    if (confirm(`Are you sure you want to delete ${name}'s evaluation? This action cannot be undone.`)) {
                        await window.appStorage.deleteEvaluation(id);
                        this.evaluations = await window.appStorage.getAllEvaluations();
                        this.applyFilters();
                        this.render();
                        this.bindEvents();
                        this.renderCharts();
                        if (window.appInstance && window.appInstance.showToast) {
                            window.appInstance.showToast(`Deleted ${name}'s paper.`);
                        }
                    }
                }
            });
        }
    }

    updateFilterTabButtons() {
        const tabs = [
            { id: "#tab-btn-all", name: "all" },
            { id: "#tab-btn-uncorrected", name: "uncorrected" },
            { id: "#tab-btn-corrected", name: "corrected" }
        ];
        tabs.forEach(t => {
            const btn = this.container.querySelector(t.id);
            if (btn) btn.classList.toggle("active", this.activeTab === t.name);
        });
    }

    triggerBulkPdfDownload() {
        let targets = [];
        if (this.selectedIds.size > 0) {
            targets = this.evaluations.filter(e => this.selectedIds.has(String(e.id)));
        } else {
            targets = this.filteredEvaluations;
        }

        if (targets.length === 0) {
            if (window.appInstance && window.appInstance.showToast) {
                window.appInstance.showToast("No evaluated papers available to download.", "error");
            }
            return;
        }

        if (this.options.onBulkDownloadPDF) {
            this.options.onBulkDownloadPDF(targets);
        } else if (window.appInstance && typeof window.appInstance.downloadBulkPDFs === "function") {
            window.appInstance.downloadBulkPDFs(targets);
        }
    }

    triggerExcelExport() {
        let targets = [];
        if (this.selectedIds.size > 0) {
            targets = this.evaluations.filter(e => this.selectedIds.has(String(e.id)));
        } else {
            targets = this.filteredEvaluations;
        }

        if (targets.length === 0) {
            if (window.appInstance && window.appInstance.showToast) {
                window.appInstance.showToast("No student evaluation records to export.", "error");
            }
            return;
        }

        if (this.options.onExportExcel) {
            this.options.onExportExcel(targets);
        } else if (window.appInstance && typeof window.appInstance.exportEvaluationsAsExcel === "function") {
            window.appInstance.exportEvaluationsAsExcel(targets);
        }
    }

    renderCharts() {
        if (!window.Chart) {
            return;
        }

        // 1. Score Distribution Bar Chart
        const scoreDistCanvas = document.getElementById("chart-score-dist");
        if (scoreDistCanvas) {
            const ranges = { "< 50%": 0, "50-69%": 0, "70-84%": 0, "85-100%": 0 };
            this.evaluations.forEach(e => {
                const pct = (e.percentage !== undefined && e.percentage !== null)
                    ? Number(e.percentage)
                    : (Number(e.maxMarks) > 0 ? (Number(e.obtainedMarks || 0) / Number(e.maxMarks)) * 100 : 0);
                if (pct < 50) ranges["< 50%"]++;
                else if (pct < 70) ranges["50-69%"]++;
                else if (pct < 85) ranges["70-84%"]++;
                else ranges["85-100%"]++;
            });

            const ctx = scoreDistCanvas.getContext("2d");
            this.charts.scoreDist = new window.Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(ranges),
                    datasets: [{
                        label: "Students",
                        data: Object.values(ranges),
                        backgroundColor: [
                            "rgba(255, 59, 48, 0.75)",
                            "rgba(255, 149, 0, 0.75)",
                            "rgba(0, 122, 255, 0.75)",
                            "rgba(52, 199, 89, 0.75)"
                        ],
                        borderColor: ["#FF3B30", "#FF9500", "#007AFF", "#34C759"],
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 36
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: "rgba(15, 23, 42, 0.9)",
                            padding: 8,
                            cornerRadius: 6
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0, font: { family: "-apple-system, system-ui", size: 10 } },
                            grid: { color: "rgba(0, 0, 0, 0.05)" }
                        },
                        x: {
                            ticks: { font: { family: "-apple-system, system-ui", size: 10, weight: "600" } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        // 2. Grade Breakdown Doughnut Chart
        const gradeCanvas = document.getElementById("chart-grade-dist");
        if (gradeCanvas) {
            const grades = { "A+": 0, "A": 0, "B": 0, "C": 0, "D": 0, "E/F": 0 };
            this.evaluations.forEach(e => {
                const g = e.grade || (this.isPaperCorrected(e) ? "B" : "E/F");
                if (grades[g] !== undefined) grades[g]++;
                else grades["E/F"]++;
            });

            const ctx = gradeCanvas.getContext("2d");
            this.charts.gradeDist = new window.Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: Object.keys(grades),
                    datasets: [{
                        data: Object.values(grades),
                        backgroundColor: [
                            "#34C759", "#30D158", "#007AFF", "#5856D6", "#FF9500", "#FF3B30"
                        ],
                        borderWidth: 2,
                        borderColor: "#FFFFFF"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "65%",
                    plugins: {
                        legend: {
                            position: "right",
                            labels: {
                                boxWidth: 10,
                                font: { family: "-apple-system, system-ui", size: 10, weight: "600" },
                                padding: 6
                            }
                        },
                        tooltip: {
                            backgroundColor: "rgba(15, 23, 42, 0.9)",
                            padding: 8,
                            cornerRadius: 6
                        }
                    }
                }
            });
        }

        // 3. Question Performance Bar Chart
        const qPerfCanvas = document.getElementById("chart-question-perf");
        if (qPerfCanvas) {
            const qStats = {};
            this.evaluations.forEach(e => {
                if (Array.isArray(e.questions)) {
                    e.questions.forEach((q, idx) => {
                        const qNum = q.qNo || (idx + 1);
                        if (!qStats[qNum]) qStats[qNum] = { awarded: 0, max: 0 };
                        qStats[qNum].awarded += (Number(q.awardedMarks) || 0);
                        qStats[qNum].max += (Number(q.maxMarks) || 1);
                    });
                }
            });

            const labels = Object.keys(qStats).slice(0, 10).map(n => `Q${n}`);
            const pcts = Object.keys(qStats).slice(0, 10).map(n => {
                const s = qStats[n];
                return s.max > 0 ? Math.round((s.awarded / s.max) * 100) : 0;
            });

            const ctx = qPerfCanvas.getContext("2d");
            this.charts.qPerf = new window.Chart(ctx, {
                type: "bar",
                data: {
                    labels: labels.length > 0 ? labels : ["Q1", "Q2", "Q3", "Q4", "Q5"],
                    datasets: [{
                        label: "Accuracy %",
                        data: pcts.length > 0 ? pcts : [75, 80, 65, 85, 70],
                        backgroundColor: "rgba(0, 122, 255, 0.75)",
                        borderColor: "#007AFF",
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 24
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (item) => `Avg Score: ${item.parsed.y}%`
                            },
                            backgroundColor: "rgba(15, 23, 42, 0.9)",
                            padding: 8,
                            cornerRadius: 6
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                callback: (v) => `${v}%`,
                                font: { family: "-apple-system, system-ui", size: 10 }
                            },
                            grid: { color: "rgba(0, 0, 0, 0.05)" }
                        },
                        x: {
                            ticks: { font: { family: "-apple-system, system-ui", size: 10, weight: "600" } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }
}

window.DashboardManager = DashboardManager;
