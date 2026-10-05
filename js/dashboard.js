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
        this.selectedSubjectFilter = "all"; // 'all' or subject name
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

        // Check if uploader just published a new batch of papers
        const lastCls = sessionStorage.getItem("niprak_last_uploaded_class");
        const lastSub = sessionStorage.getItem("niprak_last_uploaded_subject");
        if (lastCls) {
            this.selectedClassFilter = lastCls;
            sessionStorage.removeItem("niprak_last_uploaded_class");
        }
        if (lastSub) {
            this.selectedSubjectFilter = lastSub;
            sessionStorage.removeItem("niprak_last_uploaded_subject");
        }

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

        // Background Cloud Sync: Pull fresh papers from Firebase quietly without tearing down DOM
        if (window.firebaseManager) {
            window.appStorage.getAllEvaluations(true).then((freshList) => {
                if (Array.isArray(freshList) && freshList.length > 0 && freshList.length !== this.evaluations.length) {
                    this.evaluations = freshList;
                    this.applyFilters();
                    this.renderTableRows();
                    this.updateCountsInUI();
                }
            }).catch(() => {});
        }
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
        // Strictly consider corrected only when teacher explicitly saved/evaluated it
        return e.status === "Completed" || e.status === "Corrected" || e.status === "Graded" || e.status === "Evaluated";
    }

    getSubjectEvals() {
        if (!this.teacherSubject || this.teacherSubject === "all" || this.teacherSubject === "All Subjects") {
            return this.evaluations;
        }
        const tSub = this.teacherSubject.toLowerCase();
        // Strictly return only papers that match this teacher's subject
        return this.evaluations.filter(e => {
            if (!e.subject) return false; // Papers with no subject are NOT shown to subject-specific teachers
            const s = e.subject.toLowerCase();
            return s === tSub || s.includes(tSub) || tSub.includes(s);
        });
    }

    applyFilters() {
        this.filteredEvaluations = this.evaluations.filter(e => {
            const isCorr = this.isPaperCorrected(e);

            // 0. MANDATORY: Teacher subject isolation
            // If this teacher has an assigned subject, they ONLY see their own subject's papers
            if (this.teacherSubject && this.teacherSubject !== "all" && this.teacherSubject !== "All Subjects") {
                const tSub = this.teacherSubject.toLowerCase();
                const eSub = (e.subject || "").toLowerCase();
                if (!eSub) return false; // No subject tag = not shown
                if (eSub !== tSub && !eSub.includes(tSub) && !tSub.includes(eSub)) return false;
            }

            // 1. Status Tab filter
            if (this.activeTab === "uncorrected" && isCorr) return false;
            if (this.activeTab === "corrected" && !isCorr) return false;

            // 2. Class filter (flexible matching)
            if (this.selectedClassFilter && this.selectedClassFilter !== "all") {
                const fCls = this.selectedClassFilter.toLowerCase().trim();
                const eCls = (e.class || e.className || e.classLabel || "").toLowerCase().trim();
                if (eCls !== fCls && !eCls.includes(fCls) && !fCls.includes(eCls)) return false;
            }

            // 2b. Subject filter dropdown (secondary — within the teacher's own subject)
            if (this.selectedSubjectFilter && this.selectedSubjectFilter !== "all") {
                const fSub = this.selectedSubjectFilter.toLowerCase().trim();
                const eSub = (e.subject || "").toLowerCase().trim();
                if (eSub !== fSub && !eSub.includes(fSub) && !fSub.includes(eSub)) return false;
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
        // Distinct subjects — only from real uploaded evaluations, no hardcoded list
        // For subject-specific teachers: only show their own subject in dropdown
        const subjectSet = new Set(this.evaluations.map(e => e.subject).filter(Boolean));
        const subjectList = (this.teacherSubject && this.teacherSubject !== "all")
            ? [this.teacherSubject]  // Teacher only sees their own subject in the dropdown
            : Array.from(subjectSet);

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
                            <span class="chart-badge">Grades A1 to E2</span>
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
                    <div class="dash-filters-toolbar" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; background: #FFFFFF; padding: 14px 18px; border-radius: 12px; border: 1px solid #E2E8F0; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                        <!-- Left: Filter Dropdowns & Search Box -->
                        <div class="dash-filters-group" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1; min-width: 300px;">
                            <!-- Status Filter Dropdown -->
                            <select id="dash-filter-status" class="form-select-sm" title="Filter by paper status" style="font-size: 0.85rem; font-weight: 600; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #1E293B; cursor: pointer; min-width: 160px;">
                                <option value="all" ${this.activeTab === 'all' ? 'selected' : ''}>All Papers (${totalCount})</option>
                                <option value="uncorrected" ${this.activeTab === 'uncorrected' ? 'selected' : ''}>Uncorrected (${uncorrectedCount})</option>
                                <option value="corrected" ${this.activeTab === 'corrected' ? 'selected' : ''}>Corrected (${correctedCount})</option>
                            </select>

                            <!-- Subject Filter Dropdown -->
                            <select id="dash-filter-subject" class="form-select-sm" title="Filter by subject" style="font-size: 0.85rem; font-weight: 500; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #1E293B; cursor: pointer; min-width: 140px;">
                                <option value="all">All Subjects</option>
                                ${subjectList.map(sub => `<option value="${sub}" ${this.selectedSubjectFilter === sub ? 'selected' : ''}>${sub}</option>`).join("")}
                            </select>

                            <!-- Class Filter Dropdown -->
                            <select id="dash-filter-class" class="form-select-sm" title="Filter by class" style="font-size: 0.85rem; font-weight: 500; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #1E293B; cursor: pointer; min-width: 130px;">
                                <option value="all">All Classes</option>
                                ${classList.map(cls => `<option value="${cls}" ${this.selectedClassFilter === cls ? 'selected' : ''}>${cls}</option>`).join("")}
                            </select>

                            <!-- Search Input -->
                            <div style="position: relative; flex: 1; min-width: 200px;">
                                <input type="text" id="dash-search-input" class="form-input form-input-sm" value="${this.searchQuery}" placeholder="🔍 Search student or roll no..." style="width: 100%; height: 38px; padding: 0 12px; font-size: 0.85rem; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF;" />
                            </div>
                        </div>

                        <!-- Right: Bulk Actions Aligned Group -->
                        <div class="dash-actions-group" style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                            <button type="button" class="btn-secondary" id="dash-btn-bulk-pdf" title="Bulk download selected or all PDFs" style="background: #FFFFFF; border: 1.5px solid #007AFF; color: #007AFF; font-size: 0.84rem; font-weight: 600; height: 38px; padding: 0 15px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;">
                                <span class="btn-icon" style="display: flex; align-items: center;">${ic.pdf || '📄'}</span> Bulk Download PDFs <span id="dash-pdf-count-badge" style="background: rgba(0, 122, 255, 0.12); padding: 2px 7px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">(${this.selectedIds.size > 0 ? this.selectedIds.size : 'All ' + this.filteredEvaluations.length})</span>
                            </button>

                            <button type="button" class="btn-secondary" id="dash-btn-bulk-excel" title="Bulk export spreadsheet" style="background: #FFFFFF; border: 1.5px solid #16A34A; color: #16A34A; font-size: 0.84rem; font-weight: 600; height: 38px; padding: 0 15px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;">
                                <span class="btn-icon" style="display: flex; align-items: center;">${ic.csv || '📊'}</span> Bulk Export Excel
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
                                    <th>Grade & Result</th>
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
            const rawDate = ev.updatedAt || ev.lastUpdated || ev.createdAt;
            let dateStr = "—";
            if (rawDate) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    const dStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                    const tStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
                    dateStr = `<div style="line-height: 1.3;"><span style="font-weight: 600; color: #1E293B; font-size: 0.82rem;">${dStr}</span><span style="display: block; font-size: 0.73rem; color: #64748B;">${tStr}</span></div>`;
                }
            }
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
                        ${isCompleted ? `
                            <span class="pct-pill" style="font-weight: 700; ${pct >= 75 ? 'color: #16A34A;' : pct >= 33 ? 'color: #D97706;' : 'color: #DC2626;'}">
                                ${(window.calculateGradeScale ? window.calculateGradeScale(ev.obtainedMarks, ev.maxMarks).grade : ev.grade || 'A1')}
                                <span style="font-size: 0.76rem; font-weight: normal; color: #64748B;">(GP: ${(window.calculateGradeScale ? window.calculateGradeScale(ev.obtainedMarks, ev.maxMarks).gradePoint : 10)})</span>
                            </span>
                        ` : `<span style="color: #94A3B8; font-size: 0.84rem;">Pending</span>`}
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

        // Status Filter Dropdown
        const statusSelect = this.container.querySelector("#dash-filter-status");
        if (statusSelect) {
            statusSelect.addEventListener("change", (e) => {
                this.activeTab = e.target.value;
                this.applyFilters();
                this.renderTableRows();
                this.updateFilterTabButtons();
            });
        }

        // KPI Card: Uncorrected
        const cardUncorrected = this.container.querySelector("#card-tab-uncorrected");
        if (cardUncorrected) {
            cardUncorrected.addEventListener("click", () => {
                this.activeTab = "uncorrected";
                this.applyFilters();
                this.renderTableRows();
                this.updateFilterTabButtons();
            });
        }

        // KPI Card: Corrected
        const cardCorrected = this.container.querySelector("#card-tab-corrected");
        if (cardCorrected) {
            cardCorrected.addEventListener("click", () => {
                this.activeTab = "corrected";
                this.applyFilters();
                this.renderTableRows();
                this.updateFilterTabButtons();
            });
        }

        // KPI Card: All
        const cardAll = this.container.querySelector("#card-tab-all");
        if (cardAll) {
            cardAll.addEventListener("click", () => {
                this.activeTab = "all";
                this.applyFilters();
                this.renderTableRows();
                this.updateFilterTabButtons();
            });
        }

        // Subject Filter Dropdown
        const subjectSelect = this.container.querySelector("#dash-filter-subject");
        if (subjectSelect) {
            subjectSelect.addEventListener("change", (e) => {
                this.selectedSubjectFilter = e.target.value;
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

                // Delete paper with modal dialog & loading indicator
                const delBtn = e.target.closest(".btn-dash-delete");
                if (delBtn) {
                    const id = delBtn.getAttribute("data-id");
                    const ev = await window.appStorage.getEvaluationById(id);
                    if (ev) {
                        this.showDeleteModal(ev);
                    }
                    return;
                }
            });
        }
    }

    showDeleteModal(ev) {
        if (!ev || !ev.id) return;
        const modalId = "dash-delete-modal-overlay";
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const rawDate = ev.updatedAt || ev.lastUpdated || ev.createdAt;
        let lastUpdatedStr = "—";
        if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                lastUpdatedStr = `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })}`;
            }
        }

        const isCorr = this.isPaperCorrected(ev);
        const statusLabel = isCorr ? "Corrected" : "Uncorrected (Pending)";
        const statusColor = isCorr ? "#16A34A" : "#D97706";

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
            <style>
                @keyframes fadeInModal {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes spinLoading {
                    to { transform: rotate(360deg); }
                }
            </style>
            <div style="background: #FFFFFF; border-radius: 16px; max-width: 460px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.22); overflow: hidden; border: 1px solid #E2E8F0;">
                <div style="padding: 24px; text-align: center;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.2rem; font-weight: 700; color: #0F172A; margin: 0 0 8px;">Delete Answer Sheet</h3>
                    <p style="font-size: 0.88rem; color: #64748B; margin: 0 0 18px; line-height: 1.45;">
                        Are you sure you want to permanently delete this paper? All marks, annotations, and evaluations will be removed.
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; text-align: left; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Student:</span>
                            <span style="font-size: 0.85rem; font-weight: 700; color: #1E293B;">${ev.studentName || "Unnamed Student"}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Roll Number:</span>
                            <span style="font-size: 0.82rem; font-weight: 600; color: #334155; font-family: monospace;">${ev.rollNo || "—"}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Class & Subject:</span>
                            <span style="font-size: 0.82rem; font-weight: 500; color: #334155;">${ev.class || ev.className || "Class 12"} • ${ev.subject || "Physics"}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Status:</span>
                            <span style="font-size: 0.82rem; font-weight: 700; color: ${statusColor};">${statusLabel}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 0.8rem; color: #64748B;">Last Updated:</span>
                            <span style="font-size: 0.8rem; color: #475569;">${lastUpdatedStr}</span>
                        </div>
                    </div>

                    <div id="delete-modal-error" style="display: none; padding: 8px 12px; background: #FEF2F2; border: 1px solid #F87171; border-radius: 8px; color: #991B1B; font-size: 0.8rem; margin-bottom: 14px; text-align: left;"></div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btn-cancel-delete" style="flex: 1; height: 42px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.15s ease;">
                            Cancel
                        </button>
                        <button type="button" id="btn-confirm-delete" style="flex: 1; height: 42px; border-radius: 10px; border: none; background: #DC2626; color: #FFFFFF; font-weight: 600; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s ease;">
                            <span id="btn-delete-text">Delete Paper</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector("#btn-cancel-delete");
        const confirmBtn = modal.querySelector("#btn-confirm-delete");
        const delText = modal.querySelector("#btn-delete-text");
        const errBox = modal.querySelector("#delete-modal-error");

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.remove();
        });

        confirmBtn.addEventListener("click", async () => {
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.75";
            confirmBtn.style.cursor = "not-allowed";
            delText.innerHTML = `<span style="display: inline-block; width: 15px; height: 15px; border: 2px solid #FFFFFF; border-top-color: transparent; border-radius: 50%; animation: spinLoading 0.7s linear infinite; margin-right: 6px; vertical-align: middle;"></span> Deleting...`;

            try {
                await window.appStorage.deleteEvaluation(ev.id);
                this.selectedIds.delete(String(ev.id));
                delText.innerHTML = `✓ Deleted`;
                confirmBtn.style.background = "#16A34A";
                await new Promise(r => setTimeout(r, 400));
                modal.remove();

                // Refresh evaluations smoothly without jarring screen flicker
                this.evaluations = await window.appStorage.getAllEvaluations();
                this.applyFilters();
                this.renderTableRows();
                this.updateCountsInUI();

                if (window.appInstance && window.appInstance.showToast) {
                    window.appInstance.showToast(`Deleted ${ev.studentName || 'student'}'s paper.`, "success");
                }
            } catch (err) {
                console.error("Delete paper error:", err);
                cancelBtn.disabled = false;
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = "1";
                confirmBtn.style.cursor = "pointer";
                delText.textContent = "Delete Paper";
                if (errBox) {
                    errBox.style.display = "block";
                    errBox.textContent = `Error deleting paper: ${err.message || err}`;
                }
            }
        });
    }

    updateFilterTabButtons() {
        const statusSelect = this.container.querySelector("#dash-filter-status");
        if (statusSelect && statusSelect.value !== this.activeTab) {
            statusSelect.value = this.activeTab;
        }

        const cardAll = this.container.querySelector("#card-tab-all");
        const cardUncorrected = this.container.querySelector("#card-tab-uncorrected");
        const cardCorrected = this.container.querySelector("#card-tab-corrected");

        if (cardAll) cardAll.style.outline = this.activeTab === "all" ? "2px solid #007AFF" : "none";
        if (cardUncorrected) cardUncorrected.style.outline = this.activeTab === "uncorrected" ? "2px solid #D97706" : "none";
        if (cardCorrected) cardCorrected.style.outline = this.activeTab === "corrected" ? "2px solid #16A34A" : "none";
    }

    updateCountsInUI() {
        const subjectEvals = this.getSubjectEvals();
        const totalCount = subjectEvals.length;
        const correctedCount = subjectEvals.filter(e => this.isPaperCorrected(e)).length;
        const uncorrectedCount = Math.max(0, totalCount - correctedCount);

        const statusSelect = this.container.querySelector("#dash-filter-status");
        if (statusSelect) {
            const optAll = statusSelect.querySelector("option[value='all']");
            const optUnc = statusSelect.querySelector("option[value='uncorrected']");
            const optCor = statusSelect.querySelector("option[value='corrected']");
            if (optAll) optAll.textContent = `All Papers (${totalCount})`;
            if (optUnc) optUnc.textContent = `Uncorrected (${uncorrectedCount})`;
            if (optCor) optCor.textContent = `Corrected (${correctedCount})`;
        }

        const cardUncVal = this.container.querySelector("#card-tab-uncorrected .kpi-value");
        const cardUncBadge = this.container.querySelector("#card-tab-uncorrected .counter-badge");
        if (cardUncVal) cardUncVal.textContent = uncorrectedCount;
        if (cardUncBadge) cardUncBadge.textContent = `${uncorrectedCount} UNCORRECTED`;

        const cardCorVal = this.container.querySelector("#card-tab-corrected .kpi-value");
        const cardCorBadge = this.container.querySelector("#card-tab-corrected .counter-badge");
        if (cardCorVal) cardCorVal.textContent = correctedCount;
        if (cardCorBadge) cardCorBadge.textContent = `${correctedCount} GRADED`;

        const cardAllVal = this.container.querySelector("#card-tab-all .kpi-value");
        if (cardAllVal) cardAllVal.textContent = totalCount;

        this.updateSelectionBadge();
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
            const grades = { "A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0, "D": 0, "E1": 0, "E2": 0 };
            this.evaluations.forEach(e => {
                let g = e.grade;
                if (!g && e.obtainedMarks !== undefined && e.maxMarks && window.calculateGradeScale) {
                    g = window.calculateGradeScale(e.obtainedMarks, e.maxMarks).grade;
                }
                if (grades[g] !== undefined) {
                    grades[g]++;
                } else if (g === "A+") grades["A1"]++;
                else if (g === "A") grades["A2"]++;
                else if (g === "B") grades["B1"]++;
                else if (g === "C") grades["C1"]++;
                else if (g === "D") grades["D"]++;
                else if (g === "E") grades["E1"]++;
                else if (g === "F" || g === "E/F") grades["E2"]++;
                else if (this.isPaperCorrected(e)) grades["B1"]++;
                else grades["E2"]++;
            });

            const ctx = gradeCanvas.getContext("2d");
            this.charts.gradeDist = new window.Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: Object.keys(grades),
                    datasets: [{
                        data: Object.values(grades),
                        backgroundColor: [
                            "#10B981", "#34C759", "#007AFF", "#5856D6", "#3B82F6", "#F59E0B", "#F97316", "#EF4444", "#DC2626"
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
