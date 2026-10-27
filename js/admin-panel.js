/**
 * Niprak Digital Correction - Master Admin Panel & Institutional Evaluation Audit
 * Dedicated exclusively to Institution Administrators:
 * 1. Subject & Teacher Correction Tracker: Total Uploaded, Completed/Corrected, Pending ("How many need to do"), Last Corrected Date & Time.
 * 2. Dedicated Corrected Papers Oversight Table with Quick Filters ("All", "✓ Corrected Only", "◐ Pending Only").
 * 3. Student 360 Multi-Subject Scorecard (Admin Only): View that student's complete marks across all curriculum subjects with print transcript.
 * 4. Master Excel & Print Analytics Exports.
 */

class AdminPanelManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.evaluations = [];
        this.users = [];
        this.catalog = [];
        this.classes = [];
        this.searchQuery = "";
        this.selectedClass = "all";
        this.selectedSubject = "all";
        this.statusFilter = "all"; // "all" | "corrected" | "pending"
        this.activeTab = "papers"; // "papers" (Corrected Papers Oversight) | "matrix" (All-Subject Grid)
        this.selectedStudentData = null;
    }

    async init() {
        if (!this.container) {
            this.container = document.getElementById("admin-panel-container-root") || document.getElementById("view-admin-panel");
        }
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            await window.appStorage.init();
            this.evaluations = await window.appStorage.getAllEvaluations();
            this.users = await window.appStorage.getUsersList();
            try {
                this.catalog = await window.appStorage.getSubjectCatalog() || [];
                this.classes = await window.appStorage.getClassesList() || [];
            } catch (e) {
                this.catalog = [];
                this.classes = [];
            }
        }
    }

    isEvaluationCorrected(ev) {
        if (!ev) return false;
        const s = (ev.status || "").toLowerCase().trim();
        if (s === "completed" || s === "corrected" || s === "graded" || s === "evaluated") {
            return true;
        }
        if (ev.percentage !== undefined && ev.percentage !== null && Number(ev.percentage) > 0 && s !== "pending" && s !== "in progress") {
            return true;
        }
        return false;
    }

    formatDateTime(isoStr) {
        if (!isoStr) return "—";
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return "—";
            return d.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }) + " • " + d.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
        } catch (e) {
            return "—";
        }
    }

    computeSubjectStats() {
        const subjectMap = new Map();

        // 1. Seed standard core curriculum subjects
        const standardCore = [
            { name: "Physics", code: "PHY", teacher: "Dr. Arvind Raman" },
            { name: "Chemistry", code: "CHEM", teacher: "Prof. Priya Sundaram" },
            { name: "Mathematics", code: "MATH", teacher: "Dr. K. Venkatesh" },
            { name: "Biology", code: "BIO", teacher: "Dr. Meenakshi Iyer" },
            { name: "English", code: "ENG", teacher: "Mrs. Shanthi Rao" }
        ];
        standardCore.forEach(sc => {
            subjectMap.set(sc.name, {
                code: sc.code,
                name: sc.name,
                teacher: sc.teacher,
                uploaded: 0,
                corrected: 0,
                lastCorrectedTimestamp: null,
                totalScoreObt: 0,
                totalScoreMax: 0
            });
        });

        // 2. Seed from custom subject catalog if available
        if (Array.isArray(this.catalog) && this.catalog.length > 0) {
            this.catalog.forEach(sub => {
                if (sub && sub.name) {
                    const norm = sub.name.trim();
                    if (!subjectMap.has(norm)) {
                        subjectMap.set(norm, {
                            code: sub.code || norm.substring(0, 4).toUpperCase(),
                            name: norm,
                            teacher: sub.teacherName || sub.evaluator || "Faculty Evaluator",
                            uploaded: 0,
                            corrected: 0,
                            lastCorrectedTimestamp: null,
                            totalScoreObt: 0,
                            totalScoreMax: 0
                        });
                    }
                }
            });
        }

        // 3. Accumulate evaluations
        this.evaluations.forEach(ev => {
            const subject = (ev.subject || "General").trim();
            if (!subjectMap.has(subject)) {
                subjectMap.set(subject, {
                    code: subject.substring(0, 4).toUpperCase(),
                    name: subject,
                    teacher: ev.teacherName || ev.evaluatorName || "—",
                    uploaded: 0,
                    corrected: 0,
                    lastCorrectedTimestamp: null,
                    totalScoreObt: 0,
                    totalScoreMax: 0
                });
            }
            const entry = subjectMap.get(subject);
            entry.uploaded++;

            const isCorr = this.isEvaluationCorrected(ev);
            if (isCorr) {
                entry.corrected++;
                entry.totalScoreObt += Number(ev.obtainedMarks) || 0;
                entry.totalScoreMax += Number(ev.maxMarks) || 70;

                const ts = ev.updatedAt || ev.lastUpdated || ev.completedAt || ev.createdAt;
                if (ts) {
                    const tsTime = new Date(ts).getTime();
                    if (!entry.lastCorrectedTimestamp || tsTime > new Date(entry.lastCorrectedTimestamp).getTime()) {
                        entry.lastCorrectedTimestamp = ts;
                    }
                }
            }

            // Derive faculty name
            if ((!entry.teacher || entry.teacher === "—") && (ev.teacherName || ev.evaluatorName)) {
                entry.teacher = ev.teacherName || ev.evaluatorName;
            }
        });

        // Match with assigned faculty from user directory if still unassigned
        if (Array.isArray(this.users)) {
            subjectMap.forEach((entry, subName) => {
                if (!entry.teacher || entry.teacher === "—") {
                    const teacherUser = this.users.find(u => 
                        u.role === "evaluator" && 
                        Array.isArray(u.assignedSubjects) && 
                        u.assignedSubjects.some(s => s.toLowerCase() === subName.toLowerCase())
                    );
                    if (teacherUser) entry.teacher = teacherUser.name;
                }
            });
        }

        return Array.from(subjectMap.values()).map(entry => {
            const pending = Math.max(0, entry.uploaded - entry.corrected);
            const pct = entry.uploaded > 0 ? Math.round((entry.corrected / entry.uploaded) * 100) : (entry.corrected > 0 ? 100 : 0);
            const avgPct = entry.corrected > 0 && entry.totalScoreMax > 0 
                ? Math.round((entry.totalScoreObt / entry.totalScoreMax) * 100)
                : 0;
            return {
                ...entry,
                pending,
                pct,
                avgPct,
                lastCorrectedFormatted: this.formatDateTime(entry.lastCorrectedTimestamp)
            };
        });
    }

    computeDetailedPapers() {
        return this.evaluations.map(ev => {
            const isCorr = this.isEvaluationCorrected(ev);
            const ts = ev.updatedAt || ev.lastUpdated || ev.completedAt || ev.createdAt;
            const maxMarks = ev.maxMarks || 70;
            const obtainedMarks = ev.obtainedMarks !== undefined ? Number(ev.obtainedMarks) : 0;
            const pct = maxMarks > 0 ? Math.round((obtainedMarks / maxMarks) * 100) : 0;
            const grade = ev.grade || (window.calculateGradeScale ? window.calculateGradeScale(obtainedMarks, maxMarks).grade : (pct >= 80 ? "A1" : pct >= 60 ? "B1" : "C"));

            return {
                id: ev.id,
                rollNo: ev.rollNo || "—",
                studentName: ev.studentName || "Student Paper",
                className: ev.className || ev.class || "Class 12",
                section: ev.section || "A",
                subject: (ev.subject || "General").trim(),
                examName: ev.examName || ev.templateName || "Annual Assessment",
                obtainedMarks,
                maxMarks,
                percentage: pct,
                grade,
                isCorrected: isCorr,
                rawScansPurged: Boolean(ev.rawScansPurged),
                status: isCorr ? "Completed" : "Pending",
                timestamp: ts,
                lastCorrectedFormatted: isCorr ? this.formatDateTime(ts) : "—",
                teacherName: ev.teacherName || ev.evaluatorName || "Faculty Evaluator",
                feedback: ev.feedback || ""
            };
        });
    }

    filterPapers(papers) {
        return papers.filter(p => {
            // 1. Status Filter (All / Corrected Only / Pending Only)
            if (this.statusFilter === "corrected" && !p.isCorrected) return false;
            if (this.statusFilter === "pending" && p.isCorrected) return false;

            // 2. Subject Filter
            if (this.selectedSubject !== "all" && p.subject.toLowerCase() !== this.selectedSubject.toLowerCase()) {
                return false;
            }

            // 3. Class Filter
            if (this.selectedClass !== "all") {
                const combined = `${p.className}-${p.section}`.toLowerCase();
                const target = this.selectedClass.toLowerCase().replace("class ", "").trim();
                if (!combined.includes(target) && !p.className.toLowerCase().includes(target)) {
                    return false;
                }
            }

            // 4. Search Query
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase().trim();
                const matchName = p.studentName.toLowerCase().includes(q);
                const matchRoll = p.rollNo.toLowerCase().includes(q);
                const matchSub = p.subject.toLowerCase().includes(q);
                if (!matchName && !matchRoll && !matchSub) return false;
            }

            return true;
        });
    }

    computeStudentMatrix() {
        if (!this.evaluations || this.evaluations.length === 0) return [];

        const studentMap = new Map();

        this.evaluations.forEach(ev => {
            const key = (ev.rollNo || ev.studentName || ev.id).toString().trim().toLowerCase();
            if (!studentMap.has(key)) {
                studentMap.set(key, {
                    rollNo: ev.rollNo || "—",
                    studentName: ev.studentName || "Student Paper",
                    class: `${ev.className || ev.class || 'Class 12'}-${ev.section || 'A'}`,
                    evaluations: [],
                    subjectsMap: {},
                    totalObtained: 0,
                    totalMax: 0,
                    gradedCount: 0,
                    totalCount: 0
                });
            }
            const s = studentMap.get(key);
            s.evaluations.push(ev);
            const subName = (ev.subject || "General").trim();
            s.subjectsMap[subName] = ev;
            s.totalCount++;

            if (this.isEvaluationCorrected(ev)) {
                s.gradedCount++;
                s.totalObtained += Number(ev.obtainedMarks) || 0;
                s.totalMax += Number(ev.maxMarks) || 70;
            }
        });

        return Array.from(studentMap.values()).map(s => {
            const totalMax = s.totalMax > 0 ? s.totalMax : 70;
            const pct = totalMax > 0 ? Math.round((s.totalObtained / totalMax) * 100) : 0;
            const grade = window.calculateGradeScale ? window.calculateGradeScale(s.totalObtained, totalMax).grade : (pct >= 80 ? "A1" : pct >= 60 ? "B1" : "C");
            const allGraded = s.gradedCount === s.totalCount && s.totalCount > 0;

            return {
                ...s,
                percentage: pct,
                grade,
                status: allGraded ? "Completed" : "Pending"
            };
        });
    }

    filterStudentMatrix(students) {
        return students.filter(s => {
            if (this.selectedClass !== "all") {
                const combined = (s.class || "").toLowerCase();
                const target = this.selectedClass.toLowerCase().replace("class ", "").trim();
                if (!combined.includes(target)) return false;
            }
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase().trim();
                const matchName = (s.studentName || "").toLowerCase().includes(q);
                const matchRoll = (s.rollNo || "").toLowerCase().includes(q);
                if (!matchName && !matchRoll) return false;
            }
            return true;
        });
    }

    render() {
        const subjectsData = this.computeSubjectStats();
        const allPapers = this.computeDetailedPapers();
        const filteredPapers = this.filterPapers(allPapers);
        const studentMatrix = this.computeStudentMatrix();
        const filteredStudents = this.filterStudentMatrix(studentMatrix);

        // Subject Scoping
        const isSubjectScoped = Boolean(this.selectedSubject && this.selectedSubject !== "all");
        const scopePapers = isSubjectScoped
            ? allPapers.filter(p => p.subject.toLowerCase() === this.selectedSubject.toLowerCase())
            : allPapers;

        const kpiTotalCount = scopePapers.length;
        const kpiCorrectedCount = scopePapers.filter(p => p.isCorrected).length;
        const kpiPendingCount = scopePapers.filter(p => !p.isCorrected).length;

        // Check if static table bodies exist (e.g. in standalone admin.html)
        const staticSubTbody = document.getElementById("admin-subject-tracker-tbody");
        const staticStudentTbody = document.getElementById("admin-student-matrix-tbody");
        if (staticSubTbody && staticStudentTbody) {
            this.renderStaticMode(subjectsData, studentMatrix, allPapers);
            this.bindStaticEvents();
            return;
        }

        if (!this.container) return;

        // Build Unique Subject & Class filter options
        const uniqueSubjects = Array.from(new Set(allPapers.map(p => p.subject))).filter(Boolean);
        ["Physics", "Chemistry", "Mathematics", "Biology", "English"].forEach(s => {
            if (!uniqueSubjects.some(u => u.toLowerCase() === s.toLowerCase())) {
                uniqueSubjects.push(s);
            }
        });
        const uniqueClasses = Array.from(new Set(allPapers.map(p => `${p.className}-${p.section}`))).filter(Boolean);

        this.container.innerHTML = `
            <div class="admin-panel-layout">
                <!-- Header Card (Apple Cupertino Governance Card) -->
                <div class="admin-header-card">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="admin-title-badge">Institution Central Audit Desk</span>
                        </div>
                        <h1 class="admin-title-main">Administrative Oversight &amp; Student Marks Audit</h1>
                        <p class="admin-sub-text">Monitor faculty correction progress across subjects, review completed papers, and inspect individual student multi-subject dossiers.</p>
                    </div>

                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="btn-secondary" id="btn-admin-manage-users" style="display: flex; align-items: center; gap: 6px; height: 38px; border-color: rgba(175, 82, 222, 0.3); color: #AF52DE; background: rgba(175, 82, 222, 0.06);" title="Manage administrator, exam officer, and faculty evaluator credentials">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            <span>User Management</span>
                        </button>
                        <button type="button" class="btn-secondary" id="btn-admin-print-report" style="display: flex; align-items: center; gap: 6px; height: 38px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            <span>Print Audit</span>
                        </button>
                        <button type="button" class="btn-primary" id="btn-admin-export-excel" style="display: flex; align-items: center; gap: 6px; height: 38px; background: linear-gradient(135deg, #AF52DE, #5856D6);">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                            <span>Export Master Excel</span>
                        </button>
                    </div>
                </div>

                <!-- Section 1: Subject Evaluation Progress & Last Corrected Status -->
                <div style="margin-bottom: 28px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <div>
                            <h2 style="font-size: 1.15rem; font-weight: 400; color: var(--text-main); margin: 0;">Subject &amp; Faculty Evaluation Tracker</h2>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0;">Click any subject card below to drill down into its records &amp; monitor "how many need to do".</p>
                        </div>
                        <span style="font-size: 0.82rem; color: var(--text-muted);">${subjectsData.length} Subjects Monitored</span>
                    </div>

                    <div class="admin-subject-grid">
                        ${subjectsData.length === 0 ? `
                            <div style="grid-column: 1 / -1; padding: 30px; text-align: center; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-color); color: var(--text-muted);">
                                No subject evaluations ingested yet. Upload papers on the Upload Desk to populate subject audit stats.
                            </div>
                        ` : subjectsData.map(sub => {
                            const is100 = sub.pct === 100 && sub.uploaded > 0;
                            const statusCls = is100 ? "completed" : (sub.corrected > 0 ? "in-progress" : "pending");
                            const statusText = is100 ? "✓ 100% All Graded" : (sub.corrected > 0 ? `${sub.pct}% In Progress` : "0% Awaiting Grading");
                            const isCurrentSub = isSubjectScoped && this.selectedSubject.toLowerCase() === sub.name.toLowerCase();

                            return `
                                <div class="admin-sub-card ${isCurrentSub ? 'active-subject' : ''}" data-subject="${sub.name}" role="button" title="Click to view evaluation records for ${sub.name}">
                                    <div class="admin-sub-card-top">
                                        <span class="admin-sub-code-tag">${sub.code}</span>
                                        <span class="admin-sub-status-pill ${statusCls}">${statusText}</span>
                                    </div>
                                    <h3 class="admin-sub-title">${sub.name}</h3>
                                    <div class="admin-sub-teacher">Faculty: <strong>${sub.teacher}</strong></div>

                                    <div class="admin-sub-progress-track">
                                        <div class="admin-sub-progress-fill ${is100 ? 'full' : ''}" style="width: ${sub.pct}%;"></div>
                                    </div>

                                    <div class="admin-sub-metrics-row">
                                        <span>Total: <strong>${sub.uploaded}</strong></span>
                                        <span style="color: #16A34A;">Corrected: <strong>${sub.corrected}</strong></span>
                                        <span style="color: #D97706;">Need To Do: <strong>${sub.pending}</strong></span>
                                    </div>

                                    <div class="admin-sub-last-corrected">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                        <span>Last Corrected: <strong>${sub.lastCorrectedFormatted}</strong></span>
                                    </div>

                                    <div class="sub-view-link">
                                        <span>${isCurrentSub ? '✓ Viewing Records' : 'View Subject Records →'}</span>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>

                <!-- Section 2: Detailed Corrected Papers & Evaluation Oversight Table -->
                <div id="admin-oversight-section" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 22px; box-shadow: var(--shadow-sm); margin-bottom: 30px;">
                    <!-- Section Title & Subject Filter Notice -->
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <h2 style="font-size: 1.25rem; font-weight: 400; color: var(--text-main); margin: 0;">Evaluation Records &amp; Student Oversight</h2>
                                ${isSubjectScoped ? `
                                    <span style="background: rgba(0, 122, 255, 0.1); color: #007AFF; font-size: 0.78rem; font-weight: 500; padding: 2px 10px; border-radius: 12px; border: 1px solid rgba(0, 122, 255, 0.2);">
                                        ${this.selectedSubject}
                                    </span>
                                ` : ''}
                            </div>
                            <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                                ${isSubjectScoped 
                                    ? `Showing records for <strong>${this.selectedSubject}</strong>. Click <strong>✓ Corrected</strong> or <strong>◐ Need To Do</strong> below to filter by grading status.` 
                                    : `Click on a subject pill below or select <strong>✓ Corrected</strong> / <strong>◐ Need To Do</strong> to filter evaluation records.`}
                            </p>
                        </div>

                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${isSubjectScoped ? `
                                <button type="button" class="btn-clear-subject-pill" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: #007AFF; font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    <span>Show All Subjects</span>
                                </button>
                            ` : ''}

                            <!-- View Toggle Switcher (Papers vs Student Matrix) -->
                            <div class="admin-view-toggle-bar">
                                <button type="button" class="admin-view-toggle-btn ${this.activeTab === 'papers' ? 'active' : ''}" data-view="papers" title="View individual paper evaluations">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <span>Papers (${filteredPapers.length})</span>
                                </button>
                                <button type="button" class="admin-view-toggle-btn ${this.activeTab === 'matrix' ? 'active' : ''}" data-view="matrix" title="View consolidated student multi-subject matrix">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                                    <span>Student Matrix (${filteredStudents.length})</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Subject Filter Pills Row -->
                    <div class="admin-subject-pill-row">
                        <button type="button" class="admin-subject-pill ${!isSubjectScoped ? 'active' : ''}" data-subject="all">
                            <span>All Subjects</span>
                            <span class="pill-count">${allPapers.length}</span>
                        </button>
                        ${subjectsData.map(sub => {
                            const isSubActive = isSubjectScoped && this.selectedSubject.toLowerCase() === sub.name.toLowerCase();
                            return `
                                <button type="button" class="admin-subject-pill ${isSubActive ? 'active' : ''}" data-subject="${sub.name}">
                                    <span>${sub.name}</span>
                                    <span class="pill-count">${sub.uploaded}</span>
                                </button>
                            `;
                        }).join("")}
                    </div>

                    <!-- Prominent Interactive KPI Filter Cards (Subject-Optimized) -->
                    <div class="admin-oversight-kpi-row" id="admin-kpi-filter-cards">
                        <!-- Total Answer Sheets -->
                        <div class="admin-oversight-card ${this.statusFilter === 'all' ? 'active-all' : ''}" data-status="all" role="button" title="Show All ${isSubjectScoped ? this.selectedSubject : ''} Papers">
                            <div class="kpi-icon-wrap all">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            </div>
                            <div class="kpi-details">
                                <span class="kpi-label">Total Answer Papers</span>
                                <div class="kpi-value">${kpiTotalCount}</div>
                                <span class="kpi-sub">${isSubjectScoped ? `${this.selectedSubject} Total Papers` : 'All subjects ingested'}</span>
                            </div>
                            ${this.statusFilter === 'all' ? '<span class="kpi-active-pill all">Active</span>' : ''}
                        </div>

                        <!-- ✓ Corrected -->
                        <div class="admin-oversight-card ${this.statusFilter === 'corrected' ? 'active-corrected' : ''}" data-status="corrected" role="button" title="Click to view only Corrected papers for ${isSubjectScoped ? this.selectedSubject : 'all subjects'}">
                            <div class="kpi-icon-wrap corrected">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div class="kpi-details">
                                <span class="kpi-label" style="color: #16A34A; font-weight: 600;">✓ Corrected</span>
                                <div class="kpi-value" style="color: #16A34A;">${kpiCorrectedCount}</div>
                                <span class="kpi-sub" style="color: #16A34A;">${isSubjectScoped ? `${this.selectedSubject} Graded` : 'Graded & finalized'}</span>
                            </div>
                            ${this.statusFilter === 'corrected' ? '<span class="kpi-active-pill">Showing Only</span>' : '<span style="font-size: 0.72rem; color: #16A34A; position: absolute; top: 12px; right: 14px; font-weight: 500;">Click to View →</span>'}
                        </div>

                        <!-- ◐ Need To Do -->
                        <div class="admin-oversight-card ${this.statusFilter === 'pending' ? 'active-pending' : ''}" data-status="pending" role="button" title="Click to view papers pending teacher evaluation for ${isSubjectScoped ? this.selectedSubject : 'all subjects'}">
                            <div class="kpi-icon-wrap pending">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <div class="kpi-details">
                                <span class="kpi-label" style="color: #D97706; font-weight: 600;">◐ Need To Do</span>
                                <div class="kpi-value" style="color: #D97706;">${kpiPendingCount}</div>
                                <span class="kpi-sub" style="color: #D97706;">${isSubjectScoped ? `${this.selectedSubject} Pending` : 'Pending evaluation'}</span>
                            </div>
                            ${this.statusFilter === 'pending' ? '<span class="kpi-active-pill pending">Showing Only</span>' : '<span style="font-size: 0.72rem; color: #D97706; position: absolute; top: 12px; right: 14px; font-weight: 500;">Click to View →</span>'}
                        </div>
                    </div>

                    <!-- Filter Toolbar -->
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border-color);">
                        <div>
                            <!-- Dynamic Filter Status Banner -->
                            <div>
                                ${this.statusFilter === 'corrected' ? `
                                    <span style="color: #16A34A; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                        Showing ${filteredPapers.length} Corrected Papers ${isSubjectScoped ? `for ${this.selectedSubject}` : ''} (${kpiCorrectedCount} Graded)
                                    </span>
                                    <button type="button" class="btn-reset-filter-link" data-status="all" style="margin-left: 10px; background: none; border: none; color: #007AFF; font-size: 0.8rem; text-decoration: underline; cursor: pointer;">Show All ${isSubjectScoped ? this.selectedSubject : ''} Papers</button>
                                ` : (this.statusFilter === 'pending' ? `
                                    <span style="color: #D97706; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                        Showing ${filteredPapers.length} Papers Needing Evaluation ${isSubjectScoped ? `for ${this.selectedSubject}` : ''} (${kpiPendingCount} Need To Do)
                                    </span>
                                    <button type="button" class="btn-reset-filter-link" data-status="all" style="margin-left: 10px; background: none; border: none; color: #007AFF; font-size: 0.8rem; text-decoration: underline; cursor: pointer;">Show All ${isSubjectScoped ? this.selectedSubject : ''} Papers</button>
                                ` : `
                                    <span style="color: var(--text-muted); font-size: 0.85rem;">
                                        Showing ${this.activeTab === 'papers' ? filteredPapers.length : filteredStudents.length} Records ${isSubjectScoped ? `for ${this.selectedSubject}` : ''} (${kpiCorrectedCount} Corrected • ${kpiPendingCount} Need To Do)
                                    </span>
                                `)}
                            </div>
                        </div>

                        <!-- Search & Dropdown Filters -->
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <input type="text" id="admin-papers-search" placeholder="Search student name or roll..." value="${this.searchQuery}" style="height: 36px; padding: 0 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 0.84rem; background: var(--bg-subtle); width: 210px;" />
                            
                            <select id="admin-papers-subject-filter" style="height: 36px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 0.84rem; background: var(--bg-subtle);">
                                <option value="all">All Subjects</option>
                                ${uniqueSubjects.map(sub => `<option value="${sub}" ${this.selectedSubject.toLowerCase() === sub.toLowerCase() ? 'selected' : ''}>${sub}</option>`).join("")}
                            </select>

                            <select id="admin-papers-class-filter" style="height: 36px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 0.84rem; background: var(--bg-subtle);">
                                <option value="all">All Classes</option>
                                ${uniqueClasses.map(cls => `<option value="${cls}" ${this.selectedClass === cls ? 'selected' : ''}>${cls}</option>`).join("")}
                            </select>
                        </div>
                    </div>

                    <!-- Tab View 1: Papers Evaluation View -->
                    ${this.activeTab === 'papers' ? `
                        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 14px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.86rem;">
                                <thead>
                                    <tr style="background: var(--bg-subtle); border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                        <th style="padding: 12px 14px;">Roll No</th>
                                        <th style="padding: 12px 14px;">Student Name</th>
                                        <th style="padding: 12px 14px;">Class</th>
                                        <th style="padding: 12px 14px;">Subject</th>
                                        <th style="padding: 12px 14px; text-align: center;">Score</th>
                                        <th style="padding: 12px 14px; text-align: center;">Percentage</th>
                                        <th style="padding: 12px 14px; text-align: center;">Grade</th>
                                        <th style="padding: 12px 14px; text-align: center;">Status</th>
                                        <th style="padding: 12px 14px;">Last Corrected</th>
                                        <th style="padding: 12px 14px;">Faculty</th>
                                        <th style="padding: 12px 14px; text-align: center;">Admin Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredPapers.length === 0 ? `
                                        <tr>
                                            <td colspan="11" style="padding: 40px; text-align: center; color: var(--text-muted);">
                                                No evaluation papers matching current filter criteria.
                                            </td>
                                        </tr>
                                    ` : filteredPapers.map(p => `
                                        <tr class="admin-paper-row" data-roll="${p.rollNo}" data-name="${p.studentName}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s ease;" title="Click to view all subjects' marks for ${p.studentName}">
                                            <td style="padding: 11px 14px; font-weight: 500; color: var(--text-main); font-family: 'JetBrains Mono', monospace;">${p.rollNo}</td>
                                            <td style="padding: 11px 14px; color: var(--text-main); font-weight: 500;">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span>${p.studentName}</span>
                                                </div>
                                            </td>
                                            <td style="padding: 11px 14px; color: var(--text-muted);">${p.className}-${p.section}</td>
                                            <td style="padding: 11px 14px;">
                                                <span style="padding: 2px 8px; border-radius: 6px; background: rgba(0, 122, 255, 0.08); color: #007AFF; font-size: 0.8rem; font-weight: 500;">
                                                    ${p.subject}
                                                </span>
                                            </td>
                                            <td style="padding: 11px 14px; text-align: center; font-weight: 600; color: ${p.isCorrected ? '#16A34A' : 'var(--text-muted)'};">
                                                ${p.isCorrected ? `${p.obtainedMarks} / ${p.maxMarks}` : '—'}
                                            </td>
                                            <td style="padding: 11px 14px; text-align: center; font-weight: 500;">
                                                ${p.isCorrected ? `${p.percentage}%` : '—'}
                                            </td>
                                            <td style="padding: 11px 14px; text-align: center;">
                                                ${p.isCorrected ? `<span style="padding: 2px 7px; border-radius: 6px; background: rgba(52, 199, 89, 0.12); color: #16A34A; font-weight: 600; font-size: 0.78rem;">${p.grade}</span>` : '—'}
                                            </td>
                                            <td style="padding: 11px 14px; text-align: center;">
                                                <span style="padding: 3px 10px; border-radius: 12px; font-size: 0.76rem; font-weight: 500; background: ${p.isCorrected ? (p.rawScansPurged ? 'rgba(175, 82, 222, 0.12)' : 'rgba(52, 199, 89, 0.12)') : 'rgba(255, 149, 0, 0.12)'}; color: ${p.isCorrected ? (p.rawScansPurged ? '#8E44AD' : '#16A34A') : '#D97706'};">
                                                    ${p.isCorrected ? (p.rawScansPurged ? '✓ Log Archived' : '✓ Corrected') : '◐ Pending'}
                                                </span>
                                            </td>
                                            <td style="padding: 11px 14px; color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;">
                                                ${p.lastCorrectedFormatted}
                                            </td>
                                            <td style="padding: 11px 14px; color: var(--text-muted); font-size: 0.82rem;">
                                                ${p.teacherName}
                                            </td>
                                            <td style="padding: 11px 14px; text-align: center;">
                                                <button type="button" class="btn-student-360-pill" data-roll="${p.rollNo}" data-name="${p.studentName}" title="Inspect full marks across all subjects for ${p.studentName}">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    <span>Student 360</span>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <!-- Tab View 2: Student Multi-Subject Matrix -->
                        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 14px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.86rem;">
                                <thead>
                                    <tr style="background: var(--bg-subtle); border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                        <th style="padding: 12px 14px;">Roll No</th>
                                        <th style="padding: 12px 14px;">Student Name</th>
                                        <th style="padding: 12px 14px;">Class</th>
                                        ${subjectsData.slice(0, 5).map(sub => `<th style="padding: 12px 14px; text-align: center;">${sub.name}</th>`).join("")}
                                        <th style="padding: 12px 14px; text-align: center;">Total Score</th>
                                        <th style="padding: 12px 14px; text-align: center;">%</th>
                                        <th style="padding: 12px 14px; text-align: center;">Grade</th>
                                        <th style="padding: 12px 14px; text-align: center;">Admin Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredStudents.length === 0 ? `
                                        <tr>
                                            <td colspan="${4 + Math.min(5, subjectsData.length) + 4}" style="padding: 40px; text-align: center; color: var(--text-muted);">
                                                No student records matching current search criteria.
                                            </td>
                                        </tr>
                                    ` : filteredStudents.map(s => `
                                        <tr class="admin-paper-row admin-matrix-row" data-roll="${s.rollNo}" data-name="${s.studentName}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s ease;" title="Click to view full marks scorecard across all subjects">
                                            <td style="padding: 11px 14px; font-weight: 500; font-family: 'JetBrains Mono', monospace;">${s.rollNo}</td>
                                            <td style="padding: 11px 14px; font-weight: 500; color: var(--text-main);">${s.studentName}</td>
                                            <td style="padding: 11px 14px; color: var(--text-muted);">${s.class}</td>
                                            ${subjectsData.slice(0, 5).map(sub => {
                                                const ev = s.subjectsMap[sub.name] || Object.values(s.subjectsMap).find(e => (e.subject || "").toLowerCase() === sub.name.toLowerCase());
                                                if (!ev) return `<td style="padding: 11px 14px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">—</td>`;
                                                const isCorr = this.isEvaluationCorrected(ev);
                                                return `
                                                    <td style="padding: 11px 14px; text-align: center; font-size: 0.82rem;">
                                                        ${isCorr 
                                                            ? `<span style="font-weight: 600; color: #16A34A;">${ev.obtainedMarks}/${ev.maxMarks || 70}</span>`
                                                            : `<span style="color: #D97706; font-size: 0.76rem;">◐ Pending</span>`}
                                                    </td>
                                                `;
                                            }).join("")}
                                            <td style="padding: 11px 14px; text-align: center; font-weight: 600;">${s.totalObtained} / ${s.totalMax}</td>
                                            <td style="padding: 11px 14px; text-align: center; font-weight: 500;">${s.percentage}%</td>
                                            <td style="padding: 11px 14px; text-align: center;">
                                                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(52, 199, 89, 0.12); color: #16A34A; font-weight: 600; font-size: 0.78rem;">${s.grade}</span>
                                            </td>
                                            <td style="padding: 11px 14px; text-align: center;">
                                                <button type="button" class="btn-student-360-pill" data-roll="${s.rollNo}" data-name="${s.studentName}" title="Inspect full marks across all subjects for ${s.studentName}">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    <span>Student 360</span>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        if (!this.container) return;

        // 1. Clickable Subject Tracker Cards (Section 1)
        this.container.querySelectorAll(".admin-sub-card").forEach(card => {
            card.addEventListener("click", () => {
                const subName = card.getAttribute("data-subject");
                if (subName) {
                    this.selectedSubject = (this.selectedSubject.toLowerCase() === subName.toLowerCase()) ? "all" : subName;
                    this.render();
                    const sec = document.getElementById("admin-oversight-section");
                    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });

        // 2. Clickable Subject Filter Pills (Section 2)
        this.container.querySelectorAll(".admin-subject-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                const targetSub = pill.getAttribute("data-subject") || "all";
                this.selectedSubject = targetSub;
                this.render();
            });
        });

        // 3. Clear Subject Filter Button
        this.container.querySelectorAll(".btn-clear-subject-pill").forEach(btn => {
            btn.addEventListener("click", () => {
                this.selectedSubject = "all";
                this.render();
            });
        });

        // 4. View Switcher (Papers vs Student Matrix)
        this.container.querySelectorAll(".admin-view-toggle-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const view = btn.getAttribute("data-view") || "papers";
                this.activeTab = view;
                this.render();
            });
        });

        // 5. Clickable Oversight KPI filter cards (Total, ✓ Corrected, ◐ Need To Do)
        this.container.querySelectorAll(".admin-oversight-card").forEach(card => {
            card.addEventListener("click", () => {
                const targetStatus = card.getAttribute("data-status");
                if (targetStatus) {
                    this.statusFilter = targetStatus;
                    this.render();
                }
            });
        });

        // 6. Reset Filters Link in banner
        this.container.querySelectorAll(".btn-reset-filter-link").forEach(btn => {
            btn.addEventListener("click", () => {
                this.statusFilter = "all";
                this.render();
            });
        });

        // 7. Live Search Input
        const searchInput = this.container.querySelector("#admin-papers-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.render();
            });
        }

        // 8. Subject Select Filter Dropdown
        const subSelect = this.container.querySelector("#admin-papers-subject-filter");
        if (subSelect) {
            subSelect.addEventListener("change", (e) => {
                this.selectedSubject = e.target.value;
                this.render();
            });
        }

        // 9. Class Filter Dropdown
        const classSelect = this.container.querySelector("#admin-papers-class-filter");
        if (classSelect) {
            classSelect.addEventListener("change", (e) => {
                this.selectedClass = e.target.value;
                this.render();
            });
        }

        // 9.5. Manage Users & Faculty Desk
        const manageUsersBtn = this.container.querySelector("#btn-admin-manage-users");
        if (manageUsersBtn) {
            manageUsersBtn.addEventListener("click", () => {
                if (typeof window.switchAdminView === "function") {
                    window.switchAdminView("user-management");
                } else if (window.app && typeof window.app.switchView === "function") {
                    window.app.switchView("user-management");
                }
            });
        }

        // 10. Print Report
        const printBtn = this.container.querySelector("#btn-admin-print-report");
        if (printBtn) {
            printBtn.addEventListener("click", () => window.print());
        }

        // 11. Export Excel
        const exportBtn = this.container.querySelector("#btn-admin-export-excel");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => this.exportExcelMatrix());
        }

        // 12. Student 360 trigger buttons and row clicks
        this.container.querySelectorAll(".btn-student-360-pill").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const roll = btn.getAttribute("data-roll");
                const name = btn.getAttribute("data-name");
                this.openStudent360(roll, name);
            });
        });

        this.container.querySelectorAll(".admin-paper-row").forEach(row => {
            row.addEventListener("click", () => {
                const roll = row.getAttribute("data-roll");
                const name = row.getAttribute("data-name");
                this.openStudent360(roll, name);
            });
        });
    }

    // --- Student 360 All-Subjects Modal (Only for Admin) ---

    openStudent360(rollNo, studentName) {
        const modal = document.getElementById("modal-admin-student-profile");
        if (!modal) return;

        // Group all evaluations belonging to this student across subjects
        const normRoll = (rollNo || "").toString().trim().toLowerCase();
        const normName = (studentName || "").toString().trim().toLowerCase();
        const cleanRollDigits = normRoll.replace(/\D/g, "");

        const studentEvals = this.evaluations.filter(ev => {
            const evRoll = (ev.rollNo || "").toString().trim().toLowerCase();
            const evName = (ev.studentName || "").toString().trim().toLowerCase();
            const evDigits = evRoll.replace(/\D/g, "");

            // 1. Roll number matches exactly or numeric parts match (e.g. 101 == "Roll 101")
            if (normRoll && normRoll !== "—" && evRoll && evRoll !== "—") {
                if (evRoll === normRoll) return true;
                if (cleanRollDigits && evDigits && cleanRollDigits === evDigits) return true;
            }

            // 2. Student name matches
            if (normName && evName && normName !== "student paper" && evName !== "student paper") {
                if (evName === normName) return true;
                if (normName.length >= 3 && evName.length >= 3) {
                    if (evName.includes(normName) || normName.includes(evName)) return true;
                    const nFirst = normName.split(" ")[0];
                    const evFirst = evName.split(" ")[0];
                    if (nFirst && evFirst && nFirst === evFirst && nFirst.length >= 3) return true;
                }
            }

            return false;
        });

        // Derive metadata
        const refEval = studentEvals[0] || {};
        const displayName = refEval.studentName || studentName || "Student Paper";
        const displayRoll = refEval.rollNo || rollNo || "101";
        const displayClass = `${refEval.className || refEval.class || "Class 12"}-${refEval.section || "A"}`;

        // Avatar initials
        const initials = displayName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0].toUpperCase())
            .join("") || "ST";

        // Map evaluations by subject
        const evalBySubject = new Map();
        studentEvals.forEach(ev => {
            const sub = (ev.subject || "General").trim();
            evalBySubject.set(sub.toLowerCase(), ev);
        });

        // Determine all curriculum subjects:
        // Always include core subjects + all subjects present across all evaluations in the system + catalog subjects
        const allSubjectNames = new Set([
            "Physics",
            "Chemistry",
            "Mathematics",
            "Biology",
            "English"
        ]);

        if (Array.isArray(this.catalog) && this.catalog.length > 0) {
            this.catalog.forEach(c => { if (c && c.name) allSubjectNames.add(c.name.trim()); });
        }
        if (Array.isArray(this.evaluations)) {
            this.evaluations.forEach(e => {
                if (e && e.subject && e.subject.trim()) {
                    allSubjectNames.add(e.subject.trim());
                }
            });
        }
        studentEvals.forEach(e => {
            if (e && e.subject && e.subject.trim()) {
                allSubjectNames.add(e.subject.trim());
            }
        });

        // Build subject rows & calculate cumulative totals
        let totalObtained = 0;
        let totalMax = 0;
        let gradedCount = 0;
        let teacherRemarks = [];

        const subjectRowsHtml = Array.from(allSubjectNames).map(subName => {
            const ev = evalBySubject.get(subName.toLowerCase());
            if (ev) {
                const isCorr = this.isEvaluationCorrected(ev);
                const max = Number(ev.maxMarks) || 70;
                const obt = Number(ev.obtainedMarks) || 0;
                const pct = max > 0 ? Math.round((obt / max) * 100) : 0;
                const grade = ev.grade || (window.calculateGradeScale ? window.calculateGradeScale(obt, max).grade : (pct >= 80 ? "A1" : pct >= 60 ? "B1" : "C"));
                const ts = ev.updatedAt || ev.lastUpdated || ev.completedAt || ev.createdAt;
                const teacher = ev.teacherName || ev.evaluatorName || "Faculty Evaluator";

                if (isCorr) {
                    gradedCount++;
                    totalObtained += obt;
                    totalMax += max;
                } else {
                    totalMax += max;
                }

                if (ev.feedback && ev.feedback.trim()) {
                    teacherRemarks.push(`<strong>${subName}:</strong> "${ev.feedback.trim()}"`);
                }

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px 14px; font-weight: 500;">
                            <span style="color: var(--text-main); font-size: 0.9rem;">${subName}</span>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">${ev.examName || 'Assessment'}</div>
                        </td>
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">${max} M</td>
                        <td style="padding: 12px 14px; text-align: center; font-weight: 600; color: ${isCorr ? '#16A34A' : '#D97706'}; font-size: 0.92rem;">
                            ${isCorr ? `${obt} M` : '—'}
                        </td>
                        <td style="padding: 12px 14px; text-align: center; font-weight: 500;">${isCorr ? `${pct}%` : '—'}</td>
                        <td style="padding: 12px 14px; text-align: center;">
                            ${isCorr ? `<span style="padding: 2px 7px; border-radius: 6px; background: rgba(52, 199, 89, 0.12); color: #16A34A; font-weight: 600; font-size: 0.78rem;">${grade}</span>` : '—'}
                        </td>
                        <td style="padding: 12px 14px; text-align: center;">
                            <span style="padding: 3px 10px; border-radius: 12px; font-size: 0.74rem; font-weight: 500; background: ${isCorr ? (ev.rawScansPurged ? 'rgba(175, 82, 222, 0.12)' : 'rgba(52, 199, 89, 0.12)') : 'rgba(255, 149, 0, 0.12)'}; color: ${isCorr ? (ev.rawScansPurged ? '#8E44AD' : '#16A34A') : '#D97706'};">
                                ${isCorr ? (ev.rawScansPurged ? '✓ Log Archived' : '✓ Graded') : '◐ In Progress'}
                            </span>
                        </td>
                        <td style="padding: 12px 14px; font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">${isCorr ? this.formatDateTime(ts) : '—'}</td>
                        <td style="padding: 12px 14px; font-size: 0.8rem; color: var(--text-muted);">${teacher}</td>
                    </tr>
                `;
            } else {
                return `
                    <tr style="opacity: 0.65; border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px 14px; font-weight: 500; color: var(--text-muted);">
                            <span>${subName}</span>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">Curriculum Assessment</div>
                        </td>
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">70 M</td>
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">—</td>
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">—</td>
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">—</td>
                        <td style="padding: 12px 14px; text-align: center;">
                            <span style="padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; background: rgba(148, 163, 184, 0.15); color: #64748B;">
                                ⚠️ Awaiting Paper
                            </span>
                        </td>
                        <td style="padding: 12px 14px; font-size: 0.78rem; color: var(--text-muted);">—</td>
                        <td style="padding: 12px 14px; font-size: 0.8rem; color: var(--text-muted);">Department Faculty</td>
                    </tr>
                `;
            }
        }).join("");

        // Set KPIs
        const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
        const overallGrade = totalMax > 0 ? (window.calculateGradeScale ? window.calculateGradeScale(totalObtained, totalMax).grade : (overallPct >= 80 ? "A1" : overallPct >= 60 ? "B1" : "C")) : "—";

        // Populate modal DOM
        const elAvatar = document.getElementById("s360-avatar");
        const elName = document.getElementById("s360-name");
        const elMeta = document.getElementById("s360-meta");
        const elTotalScore = document.getElementById("s360-total-score");
        const elOverallPct = document.getElementById("s360-overall-pct");
        const elGrade = document.getElementById("s360-grade");
        const elRatio = document.getElementById("s360-completion-ratio");
        const elTbody = document.getElementById("s360-subjects-tbody");
        const elFeedbackBox = document.getElementById("s360-teacher-feedback-box");
        const elFeedbackText = document.getElementById("s360-feedback-text");

        if (elAvatar) elAvatar.textContent = initials;
        if (elName) elName.textContent = displayName;
        if (elMeta) elMeta.textContent = `Roll No: ${displayRoll} • Class: ${displayClass} • Central Institutional Examination Cell`;
        if (elTotalScore) elTotalScore.textContent = `${totalObtained} / ${totalMax > 0 ? totalMax : 70} M`;
        if (elOverallPct) elOverallPct.textContent = `${overallPct}%`;
        if (elGrade) elGrade.textContent = overallGrade;
        if (elRatio) elRatio.textContent = `${gradedCount} of ${allSubjectNames.size} Subjects Evaluated`;
        if (elTbody) elTbody.innerHTML = subjectRowsHtml;

        if (elFeedbackBox && elFeedbackText) {
            if (teacherRemarks.length > 0) {
                elFeedbackBox.style.display = "block";
                elFeedbackText.innerHTML = teacherRemarks.join(" • ");
            } else {
                elFeedbackBox.style.display = "none";
            }
        }

        // Show modal
        modal.style.display = "flex";
        requestAnimationFrame(() => modal.classList.add("active"));

        const closeModal = () => {
            modal.classList.remove("active");
            setTimeout(() => { modal.style.display = "none"; }, 200);
        };

        const btnClose = document.getElementById("btn-close-s360-modal");
        const btnDone = document.getElementById("btn-done-s360-modal");
        const btnPrint = document.getElementById("btn-print-s360-report");

        if (btnClose) btnClose.onclick = closeModal;
        if (btnDone) btnDone.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        if (btnPrint) {
            btnPrint.onclick = () => {
                window.print();
            };
        }
    }

    renderStaticMode(subjectsData, studentMatrix, allPapers) {
        // Fallback for standalone admin.html static DOM
        const subTbody = document.getElementById("admin-subject-tracker-tbody");
        if (subTbody) {
            subTbody.innerHTML = subjectsData.map(sub => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 16px; font-weight: 600; color: var(--text-main);">
                        ${sub.name}
                        <div style="font-size: 0.72rem; color: #AF52DE;">${sub.code}</div>
                    </td>
                    <td style="padding: 12px 16px; color: var(--text-muted);">${sub.teacher}</td>
                    <td style="padding: 12px 16px; font-weight: 500;">${sub.uploaded}</td>
                    <td style="padding: 12px 16px; color: #16A34A; font-weight: 600;">${sub.corrected}</td>
                    <td style="padding: 12px 16px; color: #D97706; font-weight: 500;">${sub.pending}</td>
                    <td style="padding: 12px 16px; font-size: 0.8rem; color: var(--text-muted);">${sub.lastCorrectedFormatted}</td>
                </tr>
            `).join("");
        }

        const studentTbody = document.getElementById("admin-student-matrix-tbody");
        if (studentTbody) {
            studentTbody.innerHTML = allPapers.map(p => `
                <tr class="admin-paper-row" data-roll="${p.rollNo}" data-name="${p.studentName}" style="border-bottom: 1px solid var(--border-color); cursor: pointer;">
                    <td style="padding: 12px 14px; font-weight: 500;">${p.rollNo}</td>
                    <td style="padding: 12px 14px; color: var(--text-main);">${p.studentName}</td>
                    <td style="padding: 12px 14px; color: var(--text-muted);">${p.className}-${p.section}</td>
                    <td style="padding: 12px 14px; font-weight: 500; color: #007AFF;">${p.subject}</td>
                    <td style="padding: 12px 14px; text-align: center; font-weight: 600;">${p.isCorrected ? `${p.obtainedMarks}/${p.maxMarks}` : '—'}</td>
                    <td style="padding: 12px 14px; text-align: center;">${p.isCorrected ? `${p.percentage}%` : '—'}</td>
                    <td style="padding: 12px 14px; text-align: center;">
                        <span style="padding: 2px 8px; border-radius: 6px; background: ${p.isCorrected ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)'}; color: ${p.isCorrected ? '#16A34A' : '#D97706'}; font-size: 0.78rem;">
                            ${p.isCorrected ? '✓ Corrected' : '◐ Pending'}
                        </span>
                    </td>
                    <td style="padding: 12px 14px; font-size: 0.8rem; color: var(--text-muted);">${p.lastCorrectedFormatted}</td>
                    <td style="padding: 12px 14px; text-align: center;">
                        <button type="button" class="btn-student-360-pill" data-roll="${p.rollNo}" data-name="${p.studentName}">
                            Student 360
                        </button>
                    </td>
                </tr>
            `).join("");
        }
    }

    bindStaticEvents() {
        const studentTbody = document.getElementById("admin-student-matrix-tbody");
        if (studentTbody && !studentTbody.dataset.bound) {
            studentTbody.dataset.bound = "true";
            studentTbody.addEventListener("click", (e) => {
                const target = e.target.closest(".btn-student-360-pill") || e.target.closest(".admin-paper-row");
                if (target) {
                    const roll = target.getAttribute("data-roll");
                    const name = target.getAttribute("data-name");
                    this.openStudent360(roll, name);
                }
            });
        }
    }

    exportExcelMatrix() {
        const papers = this.computeDetailedPapers();
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Roll No,Student Name,Class,Subject,Max Marks,Obtained Marks,Percentage,Grade,Status,Last Corrected,Faculty Evaluator\n";

        papers.forEach(p => {
            csvContent += `"${p.rollNo}","${p.studentName}","${p.className}-${p.section}","${p.subject}","${p.maxMarks}","${p.obtainedMarks}","${p.percentage}%","${p.grade}","${p.status}","${p.lastCorrectedFormatted}","${p.teacherName}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Admin_Master_Evaluation_Audit_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.AdminPanelManager = AdminPanelManager;
