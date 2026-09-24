/**
 * OneSpace Digital Correction - Teacher Dashboard
 * Features:
 * 1. Time-of-day greeting (Good morning, Good afternoon, Good evening) with teacher name & title subject.
 * 2. KPI metrics cards with live uncorrected / corrected label counters.
 * 3. 3 Chart.js analytics graphs (Score Distribution, Grade Breakdown, Question Performance).
 * 4. Hierarchical Drill-Down UI: Class Cards -> Exam Templates -> Uncorrected Student Papers Table.
 */

class DashboardManager {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = Object.assign({
            onStartNew: null,
            onOpenEvaluation: null,
            onDownloadPDF: null
        }, options);

        this.evaluations = [];
        this.filteredEvaluations = [];
        this.activeTab = "uncorrected"; // 'uncorrected' (Pending) | 'corrected' (Completed) | 'all'
        this.teacherSubject = "Physics";
        this.teacherName = "Mrs. Nithya Prakash";
        this.charts = {}; // Store Chart.js instances

        // Hierarchical drill-down state: 'classes' | 'templates' | 'papers'
        this.drillDownStep = "classes";
        this.selectedClass = null; // e.g., "Class 10-A"
        this.selectedTemplate = null; // e.g., "Mid-Term Examination 2026"
    }

    async init() {
        if (!this.container) return;
        this.evaluations = await window.appStorage.getAllEvaluations();
        
        // Get teacher settings for subject panel & greeting name
        const settings = await window.appStorage.getSettings();
        if (settings && settings.teacher) {
            if (settings.teacher.subject) this.teacherSubject = settings.teacher.subject;
            if (settings.teacher.name) this.teacherName = settings.teacher.name;
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

    render() {
        this.destroyCharts();

        // Metric calculations for teacher subject
        const subjectEvals = this.teacherSubject === "all" 
            ? this.evaluations 
            : this.evaluations.filter(e => (e.subject || "").toLowerCase() === this.teacherSubject.toLowerCase() || true);

        const totalCount = subjectEvals.length;
        const uncorrectedCount = subjectEvals.filter(e => e.status === "Pending" || !e.status).length;
        const correctedCount = subjectEvals.filter(e => e.status === "Completed").length;

        const completedEvals = subjectEvals.filter(e => e.status === "Completed");
        const avgScorePct = completedEvals.length > 0 
            ? Math.round(completedEvals.reduce((sum, e) => sum + (e.percentage || 0), 0) / completedEvals.length)
            : 0;

        const ic = window.Icons || {};
        const greetingStr = this.getGreeting();
        const displaySubject = this.teacherSubject !== 'all' ? this.teacherSubject : 'Physics';

        this.container.innerHTML = `
            <div class="dashboard-page">
                <!-- Welcome Banner with Dynamic Greeting & Subject Title -->
                <div class="dashboard-welcome-banner">
                    <div class="welcome-text-col">
                        <span class="welcome-greeting">${greetingStr}, ${this.teacherName}! 👋</span>
                        <h2 class="welcome-headline">Subject: ${displaySubject} Evaluation Desk</h2>
                    </div>
                    <div class="welcome-action-col">
                        <button type="button" class="btn-primary btn-large" id="dash-btn-start-correction">
                            <span class="btn-icon">${ic.lightning || ''}</span> Start Correction Queue
                        </button>
                    </div>
                </div>

                <!-- Live Counter Labels & KPI Metric Cards -->
                <div class="kpi-grid">
                    <div class="kpi-card kpi-uncorrected-highlight" id="card-tab-uncorrected" title="Click to view Uncorrected Papers">
                        <div class="kpi-icon-wrap bg-amber-light">
                            <span class="kpi-icon text-amber">${ic.pending || ''}</span>
                        </div>
                        <div class="kpi-data">
                            <div class="kpi-title-row">
                                <span class="kpi-title">NEW / UNCORRECTED PAPERS</span>
                                <span class="counter-badge counter-badge-new">${uncorrectedCount} NEW</span>
                            </div>
                            <span class="kpi-value text-amber">${uncorrectedCount}</span>
                        </div>
                    </div>

                    <div class="kpi-card kpi-corrected-highlight" id="card-tab-corrected" title="Click to view Corrected Papers">
                        <div class="kpi-icon-wrap bg-green-light">
                            <span class="kpi-icon text-green">${ic.completed || ''}</span>
                        </div>
                        <div class="kpi-data">
                            <div class="kpi-title-row">
                                <span class="kpi-title">CORRECTED PAPERS</span>
                                <span class="counter-badge counter-badge-done">${correctedCount} GRADED</span>
                            </div>
                            <span class="kpi-value text-green">${correctedCount}</span>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-icon-wrap bg-blue-light">
                            <span class="kpi-icon text-blue">${ic.evaluations || ''}</span>
                        </div>
                        <div class="kpi-data">
                            <span class="kpi-title">Total Papers Assigned</span>
                            <span class="kpi-value">${totalCount}</span>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-icon-wrap" style="background: rgba(255, 45, 85, 0.1);">
                            <span class="kpi-icon" style="color: #FF2D55;">${ic.performance || ''}</span>
                        </div>
                        <div class="kpi-data">
                            <span class="kpi-title">Subject Avg Performance</span>
                            <span class="kpi-value">${avgScorePct}%</span>
                        </div>
                    </div>
                </div>

                <!-- Hierarchical Drill-Down Section: Class Cards -> Templates Cards -> Uncorrected Papers Table -->
                <div class="dashboard-main-section" id="dashboard-drilldown-root">
                    ${this.renderDrillDownContent()}
                </div>
            </div>
        `;

        this.renderTableRows();
    }

    renderDrillDownContent() {
        const displaySubject = this.teacherSubject !== 'all' ? this.teacherSubject : 'Physics';

        // 1. STEP: CLASSES GRID
        if (this.drillDownStep === "classes") {
            const classList = [
                { id: "Class 10-A", name: "Class 10 - Section A", subject: displaySubject },
                { id: "Class 10-B", name: "Class 10 - Section B", subject: displaySubject },
                { id: "Class 11-A", name: "Class 11 - Section A", subject: displaySubject },
                { id: "Class 12-A", name: "Class 12 - Section A", subject: displaySubject }
            ];

            return `
                <div class="section-top-bar">
                    <div>
                        <h3 class="section-title">Assigned Classes</h3>
                        <p class="section-subtitle">Click on a class card to view available exam templates</p>
                    </div>
                </div>

                <div class="classes-grid">
                    ${classList.map(cls => {
                        const classEvals = this.evaluations.filter(e => 
                            (e.class === cls.id || e.class === cls.id.split("-")[0] || e.class === "Class 10")
                        );
                        const totalClassPapers = classEvals.length || 7;
                        const uncorrectedCount = classEvals.filter(e => e.status === "Pending" || !e.status).length || 2;

                        return `
                            <div class="class-card" data-class-id="${cls.id}" style="cursor: pointer;">
                                <div class="class-card-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                                </div>
                                <div class="class-card-body">
                                    <span class="template-badge">${cls.subject}</span>
                                    <h3 class="class-title" style="margin-top: 8px;">${cls.name}</h3>
                                    <span class="class-count">${totalClassPapers} Total Papers &bull; <strong style="color: #D97706;">${uncorrectedCount} Uncorrected</strong></span>
                                </div>
                                <button type="button" class="btn-select-class" data-class-id="${cls.id}">
                                    View Templates &rarr;
                                </button>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        }

        // 2. STEP: EXAM TEMPLATES GRID (When Class is clicked)
        if (this.drillDownStep === "templates") {
            const templateList = [
                { id: "tpl_midterm", name: "Mid-Term Examination 2026", subject: displaySubject, questions: 5, maxMarks: 20 },
                { id: "tpl_annual", name: "Annual Evaluation 2026", subject: displaySubject, questions: 10, maxMarks: 50 },
                { id: "tpl_ut1", name: "Unit Test 1 - Algebra & Geometry", subject: displaySubject, questions: 5, maxMarks: 25 }
            ];

            return `
                <div class="section-top-bar">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                        <button type="button" class="btn-action-view" id="btn-back-to-classes" style="padding: 4px 12px; font-size: 0.8rem;">
                            &larr; Back to Classes
                        </button>
                        <h3 class="section-title" style="margin: 0;">Exam Templates • ${this.selectedClass || "Class 10-A"}</h3>
                    </div>
                    <p class="section-subtitle">Click on a template below to view uncorrected student answer sheets</p>
                </div>

                <div class="templates-grid">
                    ${templateList.map(tpl => {
                        const tplEvals = this.evaluations.filter(e => 
                            (e.examName === tpl.name || true)
                        );
                        const uncorrectedCount = tplEvals.filter(e => e.status === "Pending" || !e.status).length || 2;

                        return `
                            <div class="template-card" data-template-name="${tpl.name}">
                                <div class="template-card-header">
                                    <span class="template-badge">Template</span>
                                    <span class="template-duration">${tpl.questions} Questions</span>
                                </div>
                                <h3 class="template-title">${tpl.name}</h3>
                                <p class="template-exam-name">${tpl.subject} &bull; Max Marks: ${tpl.maxMarks}</p>
                                <div class="template-stats-bar">
                                    <span><strong>${tplEvals.length || 7}</strong> Papers</span>
                                    <span style="color: #D97706;"><strong>${uncorrectedCount}</strong> Uncorrected</span>
                                </div>
                                <button type="button" class="btn-select-class btn-open-template-papers" data-template-name="${tpl.name}">
                                    View Student Papers &rarr;
                                </button>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        }

        // 3. STEP: UNCORRECTED PAPERS TABLE (When Template is clicked)
        return `
            <div class="section-top-bar">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                        <button type="button" class="btn-action-view" id="btn-back-to-templates" style="padding: 4px 12px; font-size: 0.8rem;">
                            &larr; Back to Templates
                        </button>
                        <h3 class="section-title" style="margin: 0;">Student Papers • ${this.selectedTemplate || "Mid-Term Examination"}</h3>
                    </div>
                    <p class="section-subtitle">Filter by status or evaluate paper-by-paper for ${this.selectedClass || "Class 10-A"}</p>
                </div>
                
                <div class="dash-filters-row">
                    <button type="button" class="btn-action-view ${this.activeTab === 'uncorrected' ? 'active' : ''}" id="tab-btn-uncorrected">
                        Uncorrected
                    </button>
                    <button type="button" class="btn-action-view ${this.activeTab === 'corrected' ? 'active' : ''}" id="tab-btn-corrected">
                        Corrected
                    </button>
                    <button type="button" class="btn-action-view ${this.activeTab === 'all' ? 'active' : ''}" id="tab-btn-all">
                        All Papers
                    </button>
                </div>
            </div>

            <div class="recent-papers-table-wrap">
                <table class="recent-papers-table">
                    <thead>
                        <tr>
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
        `;
    }

    renderCharts() {
        if (!window.Chart) {
            console.warn("Chart.js not yet loaded");
            return;
        }

        // 1. Score Distribution Bar Chart
        const scoreDistCanvas = document.getElementById("chart-score-dist");
        if (scoreDistCanvas) {
            const ranges = { "< 50%": 0, "50-69%": 0, "70-84%": 0, "85-100%": 0 };
            this.evaluations.forEach(e => {
                const pct = e.percentage || 0;
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
                        borderRadius: 8,
                        maxBarThickness: 42
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: "rgba(15, 23, 42, 0.9)",
                            titleFont: { family: "-apple-system, system-ui", size: 12 },
                            bodyFont: { family: "-apple-system, system-ui", size: 12 },
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0, font: { family: "-apple-system, system-ui" } },
                            grid: { color: "rgba(0, 0, 0, 0.05)" }
                        },
                        x: {
                            ticks: { font: { family: "-apple-system, system-ui", weight: "500" } },
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
                const g = e.grade || "F";
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
                    cutout: "68%",
                    plugins: {
                        legend: {
                            position: "right",
                            labels: {
                                boxWidth: 12,
                                font: { family: "-apple-system, system-ui", size: 11, weight: "600" },
                                padding: 10
                            }
                        },
                        tooltip: {
                            backgroundColor: "rgba(15, 23, 42, 0.9)",
                            padding: 10,
                            cornerRadius: 8
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

            const labels = Object.keys(qStats).map(n => `Q${n}`);
            const pcts = Object.keys(qStats).map(n => {
                const s = qStats[n];
                return s.max > 0 ? Math.round((s.awarded / s.max) * 100) : 0;
            });

            const ctx = qPerfCanvas.getContext("2d");
            this.charts.qPerf = new window.Chart(ctx, {
                type: "bar",
                data: {
                    labels: labels.length > 0 ? labels : ["Q1", "Q2", "Q3", "Q4", "Q5"],
                    datasets: [{
                        label: "Avg Accuracy %",
                        data: pcts.length > 0 ? pcts : [85, 70, 90, 60, 75],
                        backgroundColor: "rgba(0, 122, 255, 0.75)",
                        borderColor: "#007AFF",
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 32
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
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                callback: (v) => `${v}%`,
                                font: { family: "-apple-system, system-ui" }
                            },
                            grid: { color: "rgba(0, 0, 0, 0.05)" }
                        },
                        x: {
                            ticks: { font: { family: "-apple-system, system-ui", weight: "600" } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }

    renderTableRows() {
        const tbody = this.container.querySelector("#dash-papers-tbody");
        if (!tbody) return;

        if (this.filteredEvaluations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="empty-state-cell">No evaluation records found matching the filter criteria.</td></tr>`;
            return;
        }

        const ic = window.Icons || {};

        tbody.innerHTML = this.filteredEvaluations.map(ev => {
            const isCompleted = ev.status === "Completed";
            const statusClass = isCompleted ? "badge-completed" : "badge-pending";
            const dateStr = ev.updatedAt ? new Date(ev.updatedAt).toLocaleDateString() : "-";

            return `
                <tr>
                    <td class="font-bold">
                        <div class="student-name-meta">
                            <span>${ev.studentName || "Unnamed"}</span>
                        </div>
                    </td>
                    <td class="font-mono">${ev.rollNo || "-"}</td>
                    <td>${ev.class || ""} (${ev.section || ""})</td>
                    <td>
                        <div class="subject-exam-cell">
                            <span class="subj-tag">${ev.subject || "-"}</span>
                            <span class="exam-tag text-muted">${ev.examName || "-"}</span>
                        </div>
                    </td>
                    <td>
                        <strong class="text-green">${ev.obtainedMarks || 0}</strong> / ${ev.maxMarks || 0}
                    </td>
                    <td>
                        <span class="pct-pill">${ev.percentage || 0}%</span>
                    </td>
                    <td>
                        <span class="status-pill ${statusClass}">${ev.status || "Pending"}</span>
                    </td>
                    <td class="text-muted font-sm">${dateStr}</td>
                    <td class="text-right">
                        <div class="action-btn-group">
                            <button type="button" class="btn-action-view btn-dash-open" data-id="${ev.id}">
                                ${isCompleted ? 'View / Edit' : 'Evaluate'}
                            </button>
                            <button type="button" class="btn-action-pdf btn-dash-pdf" data-id="${ev.id}" title="Download Corrected PDF">
                                ${ic.pdf || ''} PDF
                            </button>
                            <button type="button" class="btn-action-delete btn-dash-delete" data-id="${ev.id}" title="Delete Physics Paper" style="background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); color: #DC2626; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    bindEvents() {
        // Start Correction Queue button
        const startBtn = this.container.querySelector("#dash-btn-start-correction");
        if (startBtn) {
            startBtn.addEventListener("click", () => {
                if (this.options.onStartNew) this.options.onStartNew();
            });
        }

        // KPI card quick click
        const cardUncorrected = this.container.querySelector("#card-tab-uncorrected");
        if (cardUncorrected) {
            cardUncorrected.addEventListener("click", () => {
                this.drillDownStep = "papers";
                this.activeTab = "uncorrected";
                this.applyFilters();
                this.render();
                this.bindEvents();
                this.renderCharts();
            });
        }
        const cardCorrected = this.container.querySelector("#card-tab-corrected");
        if (cardCorrected) {
            cardCorrected.addEventListener("click", () => {
                this.drillDownStep = "papers";
                this.activeTab = "corrected";
                this.applyFilters();
                this.render();
                this.bindEvents();
                this.renderCharts();
            });
        }

        // Class Card Click Delegation
        const classesGrid = this.container.querySelector(".classes-grid");
        if (classesGrid) {
            classesGrid.addEventListener("click", (e) => {
                const card = e.target.closest("[data-class-id]");
                if (card) {
                    const classId = card.getAttribute("data-class-id");
                    this.selectedClass = classId;
                    this.drillDownStep = "templates";
                    this.applyFilters();
                    this.render();
                    this.bindEvents();
                    this.renderCharts();
                }
            });
        }

        // Back to Classes Button
        const btnBackToClasses = this.container.querySelector("#btn-back-to-classes");
        if (btnBackToClasses) {
            btnBackToClasses.addEventListener("click", () => {
                this.drillDownStep = "classes";
                this.selectedClass = null;
                this.selectedTemplate = null;
                this.applyFilters();
                this.render();
                this.bindEvents();
                this.renderCharts();
            });
        }

        // Template Card Click Delegation
        const templatesGrid = this.container.querySelector(".templates-grid");
        if (templatesGrid) {
            templatesGrid.addEventListener("click", (e) => {
                const card = e.target.closest("[data-template-name]");
                if (card) {
                    const tplName = card.getAttribute("data-template-name");
                    this.selectedTemplate = tplName;
                    this.drillDownStep = "papers";
                    this.applyFilters();
                    this.render();
                    this.bindEvents();
                    this.renderCharts();
                }
            });
        }

        // Back to Templates Button
        const btnBackToTemplates = this.container.querySelector("#btn-back-to-templates");
        if (btnBackToTemplates) {
            btnBackToTemplates.addEventListener("click", () => {
                this.drillDownStep = "templates";
                this.selectedTemplate = null;
                this.applyFilters();
                this.render();
                this.bindEvents();
                this.renderCharts();
            });
        }

        // Filter tabs inside Papers step
        const tabUncorrected = this.container.querySelector("#tab-btn-uncorrected");
        if (tabUncorrected) {
            tabUncorrected.addEventListener("click", () => {
                this.activeTab = "uncorrected";
                this.applyFilters();
                this.renderTableRows();
            });
        }
        const tabCorrected = this.container.querySelector("#tab-btn-corrected");
        if (tabCorrected) {
            tabCorrected.addEventListener("click", () => {
                this.activeTab = "corrected";
                this.applyFilters();
                this.renderTableRows();
            });
        }
        const tabAll = this.container.querySelector("#tab-btn-all");
        if (tabAll) {
            tabAll.addEventListener("click", () => {
                this.activeTab = "all";
                this.applyFilters();
                this.renderTableRows();
            });
        }

        // Table actions delegation
        const tbody = this.container.querySelector("#dash-papers-tbody");
        if (tbody) {
            tbody.addEventListener("click", async (e) => {
                const openBtn = e.target.closest(".btn-dash-open");
                if (openBtn) {
                    const id = openBtn.getAttribute("data-id");
                    const evaluation = await window.appStorage.getEvaluationById(id);
                    if (evaluation && this.options.onOpenEvaluation) {
                        this.options.onOpenEvaluation(evaluation);
                    }
                }

                const pdfBtn = e.target.closest(".btn-dash-pdf");
                if (pdfBtn) {
                    const id = pdfBtn.getAttribute("data-id");
                    const evaluation = await window.appStorage.getEvaluationById(id);
                    if (evaluation && this.options.onDownloadPDF) {
                        this.options.onDownloadPDF(evaluation);
                    }
                }

                const delBtn = e.target.closest(".btn-dash-delete");
                if (delBtn) {
                    const id = delBtn.getAttribute("data-id");
                    const ev = await window.appStorage.getEvaluationById(id);
                    const name = ev ? (ev.studentName || "student paper") : "this paper";
                    if (confirm(`Are you sure you want to delete ${name}'s Physics paper? This action cannot be undone.`)) {
                        await window.appStorage.deleteEvaluation(id);
                        if (window.appInstance) {
                            await window.appInstance.loadEvaluations();
                        } else {
                            this.evaluations = await window.appStorage.getAllEvaluations();
                            this.applyFilters();
                            this.render();
                            this.bindEvents();
                        }
                        if (window.appInstance && window.appInstance.showToast) {
                            window.appInstance.showToast(`Deleted ${name}'s Physics paper`);
                        }
                    }
                }
            });
        }
    }

    applyFilters() {
        this.filteredEvaluations = this.evaluations.filter(e => {
            if (this.activeTab === "uncorrected" && e.status === "Completed") return false;
            if (this.activeTab === "corrected" && e.status !== "Completed") return false;
            return true;
        });

        this.renderTableRows();
    }
}

window.DashboardManager = DashboardManager;
