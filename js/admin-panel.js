/**
 * Niprak Digital Correction - Master Admin Panel & Institutional Evaluation Audit
 * Dedicated exclusively to Institution Administrators:
 * 1. Subject & Teacher Correction Tracker: All monitored curriculum subjects, Total Uploaded, Completed/Corrected, Pending ("How many need to do"), Last Corrected Date & Time.
 * 2. Class & Exam Blueprint Batches: Comprehensive cards for every academic class cohort and examination blueprint batch across all subjects.
 * 3. Dedicated Corrected Papers Oversight Table with Quick Filters ("All", "✓ Corrected Only", "◐ Pending Only") and Batch Drilldown.
 * 4. Student 360 Multi-Subject Scorecard (Admin Only): View that student's complete marks across all curriculum subjects with print transcript.
 * 5. Master Excel & Print Analytics Exports.
 */

class AdminPanelManager {
    getGradeLevel(className) {
        const str = String(className || "").toLowerCase();
        if ((/\b10\b|\b10th\b|\bx\b/i.test(str) || str.includes("class 10") || str.includes("grade 10") || str.includes("std 10")) && !(/\b12\b|\b12th\b|\bxii\b/i.test(str))) {
            return 10;
        }
        if (/\b12\b|\b12th\b|\bxii\b/i.test(str) || str.includes("class 12") || str.includes("grade 12") || str.includes("std 12")) {
            return 12;
        }
        if (/\b11\b|\b11th\b|\bxi\b/i.test(str) || str.includes("class 11") || str.includes("grade 11") || str.includes("std 11")) {
            return 11;
        }
        const num = parseInt(str.match(/\d+/)?.[0] || "0", 10);
        return num || 99;
    }

    getSectionLetter(className) {
        const str = String(className || "").toUpperCase().trim();
        const m = str.match(/[-_\s]([A-Z])(?:\b|$)/) || str.match(/\b([A-Z])$/);
        return m ? m[1] : "Z";
    }

    renderAdminBatchCardHtml(b) {
        const pct = b.total > 0 ? Math.round((b.corrected / b.total) * 100) : 0;
        const isCompleted = b.pending === 0 && b.total > 0;
        const isBatchActive = this.selectedBatchKey === b.key;

        return `
            <div class="teacher-batch-card admin-batch-card ${isBatchActive ? 'active' : ''}" data-batch-key="${b.key}" data-subject="${b.subject}">
                <div class="batch-card-top-row">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span class="batch-class-badge">${b.className}</span>
                        <span class="batch-subject-tag">${b.subject}</span>
                        ${b.isNew ? `
                            <span class="batch-new-pill" style="display: inline-flex; align-items: center; gap: 3px; font-size: 0.68rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #059669; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">✨ NEW</span>
                        ` : ''}
                    </div>
                    <span class="batch-status-pill ${isCompleted ? 'status-all-done' : 'status-has-pending'}">
                        ${isCompleted ? '✓ 100% Graded' : `${b.pending} Need To Do`}
                    </span>
                </div>

                <h4 class="batch-card-name" title="${b.templateName}">${b.templateName}</h4>

                <div class="batch-card-meta-row">
                    <span>Max Marks: <strong>${b.maxMarks}M</strong></span>
                    <span>•</span>
                    <span>Roster: <strong>${b.total} Papers</strong></span>
                </div>

                <div class="batch-progress-wrapper">
                    <div class="batch-progress-labels">
                        <span class="progress-ratio">${b.corrected} / ${b.total} Graded</span>
                        <span class="progress-pct" style="color: ${pct === 100 ? '#16A34A' : '#0071E3'}; font-weight: 600;">${pct}%</span>
                    </div>
                    <div class="batch-progress-bar">
                        <div class="batch-progress-fill" style="width: ${pct}%; background: ${pct === 100 ? '#16A34A' : 'linear-gradient(90deg, #AF52DE, #0071E3)'};"></div>
                    </div>
                </div>

                <div class="batch-actions-row" style="margin-top: 10px; display: flex; gap: 6px;">
                    <button type="button" class="btn-batch-view btn-admin-filter-batch" data-batch-key="${b.key}" data-subject="${b.subject}" title="Filter evaluation records to this batch">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>${isBatchActive ? '✓ Viewing' : `View (${b.total})`}</span>
                    </button>
                    <button type="button" class="btn-batch-share btn-admin-batch-share" data-batch-key="${b.key}" data-subject="${b.subject}" data-class="${b.className}" data-template="${b.templateName}" data-total="${b.total}" title="Share this batch via WhatsApp">
                        ${(window.Icons && window.Icons.whatsapp) || ''}
                        <span>Share</span>
                    </button>
                </div>
            </div>
        `;
    }

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
        this.selectedBatchKey = "all"; // "all" | specific batch key
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
            } catch (e) {
                this.catalog = [];
            }
            try {
                this.classes = await window.appStorage.getClassesList() || [];
            } catch (e) {
                this.classes = [];
            }
        }
    }

    isEvaluationCorrected(ev) {
        if (!ev) return false;
        if (ev.status === "Completed") return true;
        if (ev.percentage !== undefined && ev.percentage !== null && Number(ev.percentage) > 0) return true;
        if (ev.obtainedMarks !== undefined && ev.obtainedMarks !== null && Number(ev.obtainedMarks) > 0) return true;
        if (Array.isArray(ev.annotations) && ev.annotations.length > 0) return true;
        return false;
    }

    formatDateTime(ts) {
        if (!ts) return "—";
        try {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return "—";
            const datePart = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
            const timePart = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
            return `${datePart} at ${timePart}`;
        } catch (e) {
            return "—";
        }
    }

    // --- All Monitored Curriculum Subjects ---
    computeSubjectStats() {
        const subjectMap = new Map();

        // 1. Seed standard core curriculum subjects
        const standardCore = [
            { name: "Physics", code: "PHY", teacher: "Dr. Arvind Raman" },
            { name: "Chemistry", code: "CHEM", teacher: "Prof. Priya Sundaram" },
            { name: "Mathematics", code: "MATH", teacher: "Dr. K. Venkatesh" },
            { name: "Biology", code: "BIO", teacher: "Dr. Meenakshi Iyer" },
            { name: "English", code: "ENG", teacher: "Mrs. Shanthi Rao" },
            { name: "Political Science", code: "POL", teacher: "Faculty Evaluator" },
            { name: "Tamil", code: "TAM", teacher: "Faculty Evaluator" },
            { name: "Economics", code: "ECO", teacher: "Faculty Evaluator" },
            { name: "History", code: "HIS", teacher: "Faculty Evaluator" },
            { name: "Social Science", code: "SST", teacher: "Faculty Evaluator" }
        ];
        standardCore.forEach(sc => {
            subjectMap.set(sc.name.toLowerCase(), {
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
                    const key = norm.toLowerCase();
                    if (!subjectMap.has(key)) {
                        subjectMap.set(key, {
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
            let matchedKey = null;
            for (const [k, v] of subjectMap.entries()) {
                if (window.appStorage && window.appStorage.isSubjectMatch(ev.subject, ev.examName, v.name, ev.templateName)) {
                    matchedKey = k;
                    break;
                }
            }
            const subject = matchedKey ? subjectMap.get(matchedKey).name : (ev.subject || "General").trim();
            const key = matchedKey || subject.toLowerCase();
            if (!subjectMap.has(key)) {
                subjectMap.set(key, {
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
            const entry = subjectMap.get(key);
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
            subjectMap.forEach((entry, subKey) => {
                if (!entry.teacher || entry.teacher === "—") {
                    const teacherUser = this.users.find(u => 
                        u.role === "evaluator" && 
                        Array.isArray(u.assignedSubjects) && 
                        u.assignedSubjects.some(s => s.toLowerCase() === subKey)
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

    // --- All Class & Exam Blueprint Batches ---
    computeBatches() {
        const batchMap = new Map();
        this.evaluations.forEach(ev => {
            const cls = ev.className || ev.class || ev.classLabel || "Class 12-A";
            const tpl = ev.templateName || ev.examName || "Annual Assessment Blueprint";
            const sub = (ev.subject || "General").trim();
            const batchKey = `${cls}:::${tpl}:::${sub}`;
            if (!batchMap.has(batchKey)) {
                batchMap.set(batchKey, {
                    key: batchKey,
                    className: cls,
                    templateName: tpl,
                    subject: sub,
                    papers: [],
                    total: 0,
                    corrected: 0,
                    pending: 0,
                    maxMarks: ev.maxMarks || 70,
                    teacherName: ev.teacherName || ev.evaluatorName || "Faculty Evaluator",
                    lastUpdated: ev.updatedAt || ev.lastUpdated || ev.createdAt
                });
            }
            const b = batchMap.get(batchKey);
            b.papers.push(ev);
            b.total++;
            const isCorr = this.isEvaluationCorrected(ev);
            if (isCorr) {
                b.corrected++;
            } else {
                b.pending++;
            }
            const ts = ev.updatedAt || ev.lastUpdated || ev.createdAt;
            if (ts && (!b.lastUpdated || new Date(ts).getTime() > new Date(b.lastUpdated).getTime())) {
                b.lastUpdated = ts;
            }
        });
        return Array.from(batchMap.values());
    }

    getFilteredBatches() {
        const allBatches = this.computeBatches();
        if (!this.selectedSubject || this.selectedSubject === "all") {
            return allBatches;
        }
        return allBatches.filter(b => b.subject.toLowerCase() === this.selectedSubject.toLowerCase());
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
            // 0. Batch Filter
            if (this.selectedBatchKey && this.selectedBatchKey !== "all") {
                const parts = this.selectedBatchKey.split(":::");
                const bCls = parts[0] || "";
                const bTpl = parts[1] || "";
                const bSub = (parts[2] || "").toLowerCase();

                const pCls = p.className || "Class 12";
                const pSec = p.section || "A";
                const pTpl = p.examName || p.templateName || "";
                const pSub = (p.subject || "").toLowerCase();

                const clsMatch = bCls.includes(pCls) || pCls.includes(bCls) || `${pCls}-${pSec}` === bCls;
                const tplMatch = bTpl === pTpl || pTpl.includes(bTpl) || bTpl.includes(pTpl);
                const subMatch = !bSub || bSub === pSub;

                if (!clsMatch || !tplMatch || !subMatch) return false;
            }

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
                const matchExam = p.examName.toLowerCase().includes(q);
                if (!matchName && !matchRoll && !matchSub && !matchExam) return false;
            }

            return true;
        });
    }

    computeStudentMultiSubjectMatrix() {
        const studentMap = new Map();

        this.evaluations.forEach(ev => {
            const roll = (ev.rollNo || "—").toString().trim();
            const name = (ev.studentName || "Student Paper").trim();
            const key = `${roll}:::${name}`;

            if (!studentMap.has(key)) {
                studentMap.set(key, {
                    rollNo: roll,
                    studentName: name,
                    className: ev.className || ev.class || "Class 12",
                    section: ev.section || "A",
                    subjects: {},
                    totalObtained: 0,
                    totalMax: 0,
                    completedSubjects: 0
                });
            }

            const student = studentMap.get(key);
            const sub = (ev.subject || "General").trim();
            const isCorr = this.isEvaluationCorrected(ev);
            const obt = Number(ev.obtainedMarks) || 0;
            const max = Number(ev.maxMarks) || 70;

            student.subjects[sub] = {
                obtainedMarks: obt,
                maxMarks: max,
                percentage: max > 0 ? Math.round((obt / max) * 100) : 0,
                grade: ev.grade || (obt >= 60 ? "A" : obt >= 40 ? "B" : "C"),
                isCorrected: isCorr,
                feedback: ev.feedback || ""
            };

            if (isCorr) {
                student.totalObtained += obt;
                student.totalMax += max;
                student.completedSubjects++;
            }
        });

        return Array.from(studentMap.values()).map(s => {
            const overallPct = s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0;
            const overallGrade = window.calculateGradeScale 
                ? window.calculateGradeScale(s.totalObtained, s.totalMax).grade 
                : (overallPct >= 80 ? "A1" : overallPct >= 60 ? "B1" : "C");
            return {
                ...s,
                overallPercentage: overallPct,
                overallGrade
            };
        });
    }

    render() {
        if (!this.container) {
            this.container = document.getElementById("admin-panel-container-root") || document.getElementById("view-admin-panel");
        }
        if (!this.container) return;

        const subjectsData = this.computeSubjectStats();
        const allBatches = this.computeBatches();
        const filteredBatches = this.getFilteredBatches();
        const allPapers = this.computeDetailedPapers();
        const filteredPapers = this.filterPapers(allPapers);
        const studentMatrix = this.computeStudentMultiSubjectMatrix();
        const filteredStudents = studentMatrix.filter(s => {
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                if (!s.studentName.toLowerCase().includes(q) && !s.rollNo.toLowerCase().includes(q)) return false;
            }
            if (this.selectedClass !== "all") {
                const clsStr = `${s.className}-${s.section}`.toLowerCase();
                const target = this.selectedClass.toLowerCase().replace("class ", "").trim();
                if (!clsStr.includes(target)) return false;
            }
            return true;
        });

        // Subject Scoping
        const isSubjectScoped = this.selectedSubject !== "all";
        const isBatchScoped = this.selectedBatchKey !== "all";

        // KPI Counts based on current scope
        const scopedPapers = allPapers.filter(p => {
            if (isSubjectScoped && p.subject.toLowerCase() !== this.selectedSubject.toLowerCase()) return false;
            return true;
        });
        const kpiTotalCount = scopedPapers.length;
        const kpiCorrectedCount = scopedPapers.filter(p => p.isCorrected).length;
        const kpiPendingCount = Math.max(0, kpiTotalCount - kpiCorrectedCount);

        let activeBatchTitle = "";
        if (isBatchScoped) {
            const parts = this.selectedBatchKey.split(":::");
            activeBatchTitle = `${parts[0]} • ${parts[1]}`;
        }

        this.container.innerHTML = `
            <div class="admin-panel-layout">
                <!-- Header Card (Apple Cupertino Governance Card) -->
                <div class="admin-header-card">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="admin-title-badge">Institution Central Audit Desk</span>
                        </div>
                        <h1 class="admin-title-main">Administrative Oversight &amp; Student Marks Audit</h1>
                        <p class="admin-sub-text">Monitor faculty correction progress across subjects, review all class blueprint batches, and inspect individual student multi-subject dossiers.</p>
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

                <!-- Section 1: Subject Evaluation Progress & Last Corrected Status (All Subjects) -->
                <div style="margin-bottom: 28px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <h2 style="font-size: 1.15rem; font-weight: 500; color: var(--text-main); margin: 0;">Subject &amp; Faculty Evaluation Tracker</h2>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0;">All monitored curriculum subjects. Click any card to drill down into its blueprint batches &amp; records.</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">${subjectsData.length} Subjects Monitored</span>
                            ${isSubjectScoped ? `
                                <button type="button" class="btn-clear-subject-pill" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: #007AFF; font-size: 0.78rem; font-weight: 500; cursor: pointer;">
                                    <span>Show All Subjects</span>
                                </button>
                            ` : ''}
                        </div>
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
                                <div class="admin-sub-card ${isCurrentSub ? 'active-subject' : ''}" data-subject="${sub.name}" role="button" title="Click to view blueprint batches and evaluation records for ${sub.name}">
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

                <!-- Section 2: Class & Exam Blueprint Batches (All Subjects & Classes) -->
                <div class="teacher-batches-section" style="margin-bottom: 28px;">
                    <div class="teacher-batches-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                        <div class="teacher-batches-title-col">
                            <h3 class="teacher-batches-title" style="display: flex; align-items: center; gap: 8px; font-size: 1.15rem; font-weight: 500; color: var(--text-main); margin: 0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                                <span>Class &amp; Exam Blueprint Batches</span>
                                <span class="teacher-batches-count-pill" style="font-size: 0.76rem; padding: 2px 8px; border-radius: 12px; background: rgba(175, 82, 222, 0.1); color: #AF52DE; border: 1px solid rgba(175, 82, 222, 0.2);">
                                    ${filteredBatches.length} ${filteredBatches.length === 1 ? 'Batch' : 'Batches'}
                                </span>
                            </h3>
                            <p class="teacher-batches-desc" style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0;">
                                ${isSubjectScoped ? `All cohort blueprint batches for <strong>${this.selectedSubject}</strong>.` : 'All academic class cohorts and examination blueprints across curriculum subjects.'} Click any batch to filter records below or share directly.
                            </p>
                        </div>
                        ${isBatchScoped ? `
                            <button type="button" class="btn-admin-clear-batch" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 8px; border: 1px solid #0071E3; background: rgba(0, 113, 227, 0.08); color: #0071E3; font-size: 0.78rem; font-weight: 500; cursor: pointer;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                <span>Showing Batch: ${activeBatchTitle} (Clear)</span>
                            </button>
                        ` : ''}
                    </div>

                    <div class="teacher-batches-grouped-container">
                        ${(() => {
                            if (filteredBatches.length === 0) {
                                return `
                                    <div class="teacher-batches-empty">
                                        <p>No examination batches found for ${isSubjectScoped ? this.selectedSubject : 'current selection'}. Ingest papers to populate blueprint batches.</p>
                                    </div>
                                `;
                            }

                            // Group batches by Grade Level (10th top, 12th below, others)
                            const gradeGroupsMap = new Map();
                            filteredBatches.forEach(b => {
                                const g = this.getGradeLevel(b.className);
                                if (!gradeGroupsMap.has(g)) gradeGroupsMap.set(g, []);
                                gradeGroupsMap.get(g).push(b);
                            });

                            const sortedGrades = Array.from(gradeGroupsMap.keys()).sort((a, b) => {
                                const order = { 10: 1, 12: 2, 11: 3, 99: 4 };
                                const ordA = order[a] !== undefined ? order[a] : (a < 10 ? 0 : 5);
                                const ordB = order[b] !== undefined ? order[b] : (b < 10 ? 0 : 5);
                                return ordA - ordB;
                            });

                            return sortedGrades.map(gKey => {
                                const gBatches = gradeGroupsMap.get(gKey) || [];
                                if (gBatches.length === 0) return '';

                                gBatches.sort((a, b) => {
                                    const secA = this.getSectionLetter(a.className);
                                    const secB = this.getSectionLetter(b.className);
                                    if (secA !== secB) return secA.localeCompare(secB);
                                    const tsA = a.latestTimestamp || 0;
                                    const tsB = b.latestTimestamp || 0;
                                    if (tsA !== tsB) return tsB - tsA;
                                    return (a.templateName || "").localeCompare(b.templateName || "");
                                });

                                const gradeTitle = gKey === 10 ? 'Class 10th (Grade X)' : (gKey === 12 ? 'Class 12th (Grade XII)' : (gKey === 11 ? 'Class 11th (Grade XI)' : `Grade ${gKey}`));
                                const totalPapersInGrade = gBatches.reduce((sum, b) => sum + b.total, 0);
                                const totalPendingInGrade = gBatches.reduce((sum, b) => sum + b.pending, 0);
                                const isCollapsed = this.collapsedGradeGroups ? this.collapsedGradeGroups.has(gKey) : false;

                                return `
                                    <div class="dash-grade-group-section" data-grade="${gKey}" style="margin-bottom: 24px;">
                                        <div class="dash-grade-header admin-grade-header" data-grade="${gKey}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; margin-bottom: 12px; cursor: pointer; user-select: none; transition: all 0.15s ease; box-shadow: 0 2px 5px rgba(0,0,0,0.03);">
                                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                <span style="font-size: 1.25rem;">${gKey === 10 ? '🔟' : (gKey === 12 ? '🎓' : '📚')}</span>
                                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                                    <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: #1E293B;">
                                                        ${gradeTitle}
                                                    </h4>
                                                    <span style="font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: rgba(175, 82, 222, 0.1); color: #AF52DE; border: 1px solid rgba(175, 82, 222, 0.2);">
                                                        ${gBatches.length} ${gBatches.length === 1 ? 'Batch' : 'Batches'}
                                                    </span>
                                                    <span style="font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: rgba(100, 116, 139, 0.08); color: #64748B;">
                                                        ${totalPapersInGrade} Papers
                                                    </span>
                                                    ${totalPendingInGrade > 0 ? `
                                                        <span style="font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: rgba(217, 119, 6, 0.1); color: #D97706; border: 1px solid rgba(217, 119, 6, 0.2);">
                                                            ${totalPendingInGrade} Need To Do
                                                        </span>
                                                    ` : `
                                                        <span style="font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: rgba(22, 163, 74, 0.1); color: #16A34A; border: 1px solid rgba(22, 163, 74, 0.2);">
                                                            ✓ 100% Graded
                                                        </span>
                                                    `}
                                                </div>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span class="grade-toggle-text" style="font-size: 0.78rem; font-weight: 600; color: #64748B;">
                                                    ${isCollapsed ? 'Expand' : 'Collapse'}
                                                </span>
                                                <span class="grade-toggle-chevron" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #F1F5F9; color: #475569; transition: transform 0.2s ease; transform: rotate(${isCollapsed ? '-90deg' : '0deg'});">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                                                </span>
                                            </div>
                                        </div>

                                        <div class="dash-grade-batches-body" style="display: ${isCollapsed ? 'none' : 'block'};">
                                            <div class="teacher-batches-grid">
                                                ${gBatches.map(b => this.renderAdminBatchCardHtml(b)).join('')}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('');
                        })()}
                    </div>
                </div>

                <!-- Section 3: Detailed Corrected Papers & Evaluation Oversight Table -->
                <div id="admin-oversight-section" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 22px; box-shadow: var(--shadow-sm); margin-bottom: 30px;">
                    <!-- Section Title & Subject Filter Notice -->
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <h2 style="font-size: 1.25rem; font-weight: 500; color: var(--text-main); margin: 0;">Evaluation Records &amp; Student Oversight</h2>
                                ${isSubjectScoped ? `
                                    <span style="background: rgba(0, 122, 255, 0.1); color: #007AFF; font-size: 0.78rem; font-weight: 500; padding: 2px 10px; border-radius: 12px; border: 1px solid rgba(0, 122, 255, 0.2);">
                                        ${this.selectedSubject}
                                    </span>
                                ` : ''}
                                ${isBatchScoped ? `
                                    <span style="background: rgba(175, 82, 222, 0.1); color: #AF52DE; font-size: 0.78rem; font-weight: 500; padding: 2px 10px; border-radius: 12px; border: 1px solid rgba(175, 82, 222, 0.2);">
                                        Batch: ${activeBatchTitle}
                                    </span>
                                ` : ''}
                            </div>
                            <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                                ${isBatchScoped 
                                    ? `Filtered to batch <strong>${activeBatchTitle}</strong> (${filteredPapers.length} papers).`
                                    : (isSubjectScoped 
                                        ? `Showing records for <strong>${this.selectedSubject}</strong>. Click <strong>✓ Corrected</strong> or <strong>◐ Need To Do</strong> below to filter by grading status.` 
                                        : `Click on a subject pill below or select <strong>✓ Corrected</strong> / <strong>◐ Need To Do</strong> to filter evaluation records.`)}
                            </p>
                        </div>

                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${isSubjectScoped || isBatchScoped ? `
                                <button type="button" class="btn-clear-subject-pill" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: #007AFF; font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    <span>Reset All Filters</span>
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
                                <span class="kpi-label">✓ Corrected</span>
                                <div class="kpi-value" style="color: #16A34A;">${kpiCorrectedCount}</div>
                                <span class="kpi-sub">${isSubjectScoped ? `${this.selectedSubject} Evaluated` : 'Grading complete'}</span>
                            </div>
                            ${this.statusFilter === 'corrected' ? '<span class="kpi-active-pill corrected">Active</span>' : ''}
                        </div>

                        <!-- ◐ Need To Do -->
                        <div class="admin-oversight-card ${this.statusFilter === 'pending' ? 'active-pending' : ''}" data-status="pending" role="button" title="Click to view only Pending papers needing correction for ${isSubjectScoped ? this.selectedSubject : 'all subjects'}">
                            <div class="kpi-icon-wrap pending">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <div class="kpi-details">
                                <span class="kpi-label">◐ Need To Do</span>
                                <div class="kpi-value" style="color: #D97706;">${kpiPendingCount}</div>
                                <span class="kpi-sub">${isSubjectScoped ? `${this.selectedSubject} Awaiting Marking` : 'Pending evaluation'}</span>
                            </div>
                            ${this.statusFilter === 'pending' ? '<span class="kpi-active-pill pending">Active</span>' : ''}
                        </div>
                    </div>

                    <!-- Search and Secondary Controls Bar -->
                    <div class="admin-search-controls-bar">
                        <div class="admin-search-box-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="admin-papers-search-input" value="${this.searchQuery}" placeholder="Search student name, roll no, or blueprint..." />
                            ${this.searchQuery ? '<button type="button" id="btn-clear-admin-search" class="btn-clear-search-x">×</button>' : ''}
                        </div>

                        <div class="admin-filter-dropdowns-group">
                            <select id="admin-papers-class-filter" class="admin-filter-select">
                                <option value="all" ${this.selectedClass === 'all' ? 'selected' : ''}>All Classes</option>
                                <option value="Class 12-A" ${this.selectedClass === 'Class 12-A' ? 'selected' : ''}>Class 12-A</option>
                                <option value="Class 12-B" ${this.selectedClass === 'Class 12-B' ? 'selected' : ''}>Class 12-B</option>
                                <option value="Class 12-C" ${this.selectedClass === 'Class 12-C' ? 'selected' : ''}>Class 12-C</option>
                                <option value="Class 12-D" ${this.selectedClass === 'Class 12-D' ? 'selected' : ''}>Class 12-D</option>
                            </select>

                            <select id="admin-papers-subject-filter" class="admin-filter-select">
                                <option value="all" ${!isSubjectScoped ? 'selected' : ''}>All Subjects</option>
                                ${subjectsData.map(s => `<option value="${s.name}" ${isSubjectScoped && this.selectedSubject.toLowerCase() === s.name.toLowerCase() ? 'selected' : ''}>${s.name}</option>`).join("")}
                            </select>
                        </div>
                    </div>

                    <!-- Active Filter Context Tag Pill -->
                    ${(isSubjectScoped || this.statusFilter !== 'all' || this.selectedClass !== 'all' || this.searchQuery || isBatchScoped) ? `
                        <div class="admin-active-filter-banner">
                            <span style="font-weight: 500;">Filter active:</span>
                            ${isSubjectScoped ? `<span class="active-filter-badge">Subject: ${this.selectedSubject}</span>` : ''}
                            ${isBatchScoped ? `<span class="active-filter-badge">Batch: ${activeBatchTitle}</span>` : ''}
                            ${this.statusFilter !== 'all' ? `<span class="active-filter-badge">Status: ${this.statusFilter === 'corrected' ? '✓ Corrected Only' : '◐ Need To Do Only'}</span>` : ''}
                            ${this.selectedClass !== 'all' ? `<span class="active-filter-badge">Class: ${this.selectedClass}</span>` : ''}
                            ${this.searchQuery ? `<span class="active-filter-badge">Query: "${this.searchQuery}"</span>` : ''}
                            <button type="button" class="btn-reset-filter-link">Reset all</button>
                        </div>
                    ` : ''}

                    <!-- Tab View 1: Detailed Papers Oversight Table -->
                    ${this.activeTab === 'papers' ? `
                        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 14px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.86rem;">
                                <thead>
                                    <tr style="background: var(--bg-subtle); border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                        <th style="padding: 12px 14px;">Roll No</th>
                                        <th style="padding: 12px 14px;">Student Name</th>
                                        <th style="padding: 12px 14px;">Class</th>
                                        <th style="padding: 12px 14px;">Subject</th>
                                        <th style="padding: 12px 14px;">Exam Blueprint</th>
                                        <th style="padding: 12px 14px; text-align: center;">Score</th>
                                        <th style="padding: 12px 14px; text-align: center;">%</th>
                                        <th style="padding: 12px 14px; text-align: center;">Grade</th>
                                        <th style="padding: 12px 14px; text-align: center;">Status</th>
                                        <th style="padding: 12px 14px;">Last Corrected</th>
                                        <th style="padding: 12px 14px;">Faculty Evaluator</th>
                                        <th style="padding: 12px 14px; text-align: center;">Admin Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredPapers.length === 0 ? `
                                        <tr>
                                            <td colspan="12" style="padding: 40px; text-align: center; color: var(--text-muted);">
                                                No evaluation records found matching the active criteria. Try adjusting your subject or status filters.
                                            </td>
                                        </tr>
                                    ` : filteredPapers.map(p => `
                                        <tr class="admin-paper-row" data-roll="${p.rollNo}" data-name="${p.studentName}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s ease;">
                                            <td style="padding: 11px 14px; font-weight: 500; font-family: monospace;">${p.rollNo}</td>
                                            <td style="padding: 11px 14px; font-weight: 500; color: var(--text-main);">${p.studentName}</td>
                                            <td style="padding: 11px 14px; color: var(--text-muted);">${p.className}-${p.section}</td>
                                            <td style="padding: 11px 14px;">
                                                <span style="font-weight: 500; color: #007AFF;">${p.subject}</span>
                                            </td>
                                            <td style="padding: 11px 14px; color: var(--text-muted); font-size: 0.82rem;">${p.examName}</td>
                                            <td style="padding: 11px 14px; text-align: center; font-weight: 600; color: ${p.isCorrected ? '#16A34A' : '#D97706'};">
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
                                                No student marks found for current search.
                                            </td>
                                        </tr>
                                    ` : filteredStudents.map(s => `
                                        <tr class="admin-paper-row" data-roll="${s.rollNo}" data-name="${s.studentName}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s ease;">
                                            <td style="padding: 11px 14px; font-weight: 500; font-family: monospace;">${s.rollNo}</td>
                                            <td style="padding: 11px 14px; font-weight: 500; color: var(--text-main);">${s.studentName}</td>
                                            <td style="padding: 11px 14px; color: var(--text-muted);">${s.className}-${s.section}</td>
                                            ${subjectsData.slice(0, 5).map(sub => {
                                                const sc = s.subjects[sub.name];
                                                if (sc && sc.isCorrected) {
                                                    return `<td style="padding: 11px 14px; text-align: center; font-weight: 600; color: #16A34A;">${sc.obtainedMarks} <span style="font-size: 0.74rem; color: var(--text-muted); font-weight: normal;">(${sc.grade})</span></td>`;
                                                } else {
                                                    return `<td style="padding: 11px 14px; text-align: center; color: var(--text-muted);">—</td>`;
                                                }
                                            }).join("")}
                                            <td style="padding: 11px 14px; text-align: center; font-weight: 700; color: var(--text-main);">
                                                ${s.totalObtained} / ${s.totalMax}
                                            </td>
                                            <td style="padding: 11px 14px; text-align: center; font-weight: 600;">${s.overallPercentage}%</td>
                                            <td style="padding: 11px 14px; text-align: center;">
                                                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(52, 199, 89, 0.12); color: #16A34A; font-weight: 600; font-size: 0.78rem;">${s.overallGrade}</span>
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
                    this.selectedBatchKey = "all";
                    this.render();
                    const sec = document.getElementById("admin-oversight-section");
                    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });

        // 2. Clickable Subject Filter Pills (Section 3)
        this.container.querySelectorAll(".admin-subject-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                const targetSub = pill.getAttribute("data-subject") || "all";
                this.selectedSubject = targetSub;
                this.selectedBatchKey = "all";
                this.render();
            });
        });

        // 3. Clear Subject / Reset Filters Button
        this.container.querySelectorAll(".btn-clear-subject-pill").forEach(btn => {
            btn.addEventListener("click", () => {
                this.selectedSubject = "all";
                this.selectedBatchKey = "all";
                this.statusFilter = "all";
                this.selectedClass = "all";
                this.searchQuery = "";
                this.render();
            });
        });

        // 4. Batch Card Clicks & View Batch Records Button (Section 2)
        // Collapsible Grade Headers for Admin
        this.container.querySelectorAll(".admin-grade-header").forEach(header => {
            header.addEventListener("click", () => {
                const gKey = Number(header.getAttribute("data-grade"));
                if (!this.collapsedGradeGroups) this.collapsedGradeGroups = new Set();
                if (this.collapsedGradeGroups.has(gKey)) {
                    this.collapsedGradeGroups.delete(gKey);
                } else {
                    this.collapsedGradeGroups.add(gKey);
                }
                const section = header.closest(".dash-grade-group-section");
                if (section) {
                    const body = section.querySelector(".dash-grade-batches-body");
                    const txt = section.querySelector(".grade-toggle-text");
                    const chevron = section.querySelector(".grade-toggle-chevron");
                    const isNowCollapsed = this.collapsedGradeGroups.has(gKey);
                    if (body) body.style.display = isNowCollapsed ? "none" : "block";
                    if (txt) txt.textContent = isNowCollapsed ? "Expand" : "Collapse";
                    if (chevron) chevron.style.transform = isNowCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
                }
            });
        });

        this.container.querySelectorAll(".admin-batch-card, .btn-admin-filter-batch").forEach(el => {
            el.addEventListener("click", (e) => {
                if (e.target.closest(".btn-admin-batch-share")) return;
                const batchKey = el.getAttribute("data-batch-key");
                const subject = el.getAttribute("data-subject");
                if (this.selectedBatchKey === batchKey) {
                    this.selectedBatchKey = "all";
                } else {
                    this.selectedBatchKey = batchKey;
                    if (subject) this.selectedSubject = subject;
                }
                this.render();
                const sec = document.getElementById("admin-oversight-section");
                if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });

        // 4.5. Clear Batch Filter Button
        this.container.querySelectorAll(".btn-admin-clear-batch").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.selectedBatchKey = "all";
                this.render();
            });
        });

        // 4.6. Batch WhatsApp Share Button
        this.container.querySelectorAll(".btn-admin-batch-share").forEach(btn => {
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

        // 5. View Switcher (Papers vs Student Matrix)
        this.container.querySelectorAll(".admin-view-toggle-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const view = btn.getAttribute("data-view") || "papers";
                this.activeTab = view;
                this.render();
            });
        });

        // 6. Clickable Oversight KPI filter cards (Total, ✓ Corrected, ◐ Need To Do)
        this.container.querySelectorAll(".admin-oversight-card").forEach(card => {
            card.addEventListener("click", () => {
                const targetStatus = card.getAttribute("data-status");
                if (targetStatus) {
                    this.statusFilter = targetStatus;
                    this.render();
                }
            });
        });

        // 7. Reset Filters Link in banner
        this.container.querySelectorAll(".btn-reset-filter-link").forEach(btn => {
            btn.addEventListener("click", () => {
                this.selectedSubject = "all";
                this.selectedBatchKey = "all";
                this.statusFilter = "all";
                this.selectedClass = "all";
                this.searchQuery = "";
                this.render();
            });
        });

        // 8. Search Input
        const searchInput = this.container.querySelector("#admin-papers-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.render();
                const refreshed = this.container.querySelector("#admin-papers-search-input");
                if (refreshed) {
                    refreshed.focus();
                    refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
                }
            });
        }

        const clearSearchBtn = this.container.querySelector("#btn-clear-admin-search");
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener("click", () => {
                this.searchQuery = "";
                this.render();
            });
        }

        // 9. Subject Filter Dropdown
        const subSelect = this.container.querySelector("#admin-papers-subject-filter");
        if (subSelect) {
            subSelect.addEventListener("change", (e) => {
                this.selectedSubject = e.target.value;
                this.selectedBatchKey = "all";
                this.render();
            });
        }

        // 10. Class Filter Dropdown
        const classSelect = this.container.querySelector("#admin-papers-class-filter");
        if (classSelect) {
            classSelect.addEventListener("change", (e) => {
                this.selectedClass = e.target.value;
                this.render();
            });
        }

        // 11. Manage Users & Faculty Desk
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

        // 12. Print Report
        const printBtn = this.container.querySelector("#btn-admin-print-report");
        if (printBtn) {
            printBtn.addEventListener("click", () => window.print());
        }

        // 13. Export Excel
        const exportBtn = this.container.querySelector("#btn-admin-export-excel");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => this.exportExcelMatrix());
        }

        // 14. Student 360 trigger buttons and row clicks
        this.container.querySelectorAll(".btn-student-360-pill").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const roll = btn.getAttribute("data-roll");
                const name = btn.getAttribute("data-name");
                this.openStudent360(roll, name);
            });
        });

        this.container.querySelectorAll(".admin-paper-row").forEach(row => {
            row.addEventListener("click", (e) => {
                if (e.target.closest("button") || e.target.closest("a")) return;
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

        const normRoll = (rollNo || "").toString().trim().toLowerCase();
        const normName = (studentName || "").toString().trim().toLowerCase();
        const cleanRollDigits = normRoll.replace(/\D/g, "");

        const studentEvals = this.evaluations.filter(ev => {
            const evRoll = (ev.rollNo || "").toString().trim().toLowerCase();
            const evName = (ev.studentName || "").toString().trim().toLowerCase();
            const evDigits = evRoll.replace(/\D/g, "");

            if (normRoll && normRoll !== "—" && evRoll && evRoll !== "—") {
                if (evRoll === normRoll) return true;
                if (cleanRollDigits && evDigits && cleanRollDigits === evDigits) return true;
            }

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

        const refEval = studentEvals[0] || {};
        const displayName = refEval.studentName || studentName || "Student Paper";
        const displayRoll = refEval.rollNo || rollNo || "101";
        const displayClass = `${refEval.className || refEval.class || "Class 12"}-${refEval.section || "A"}`;

        const initials = displayName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0].toUpperCase())
            .join("") || "ST";

        const evalBySubject = new Map();
        studentEvals.forEach(ev => {
            const sub = (ev.subject || "General").trim();
            evalBySubject.set(sub.toLowerCase(), ev);
        });

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

        const sortedSubjectList = Array.from(allSubjectNames).sort((a, b) => {
            const priority = ["physics", "chemistry", "mathematics", "biology", "english"];
            const pA = priority.indexOf(a.toLowerCase());
            const pB = priority.indexOf(b.toLowerCase());
            if (pA !== -1 && pB !== -1) return pA - pB;
            if (pA !== -1) return -1;
            if (pB !== -1) return 1;
            return a.localeCompare(b);
        });

        let totalObtained = 0;
        let totalMax = 0;
        let gradedCount = 0;
        const teacherRemarks = [];

        const rowsHtml = sortedSubjectList.map(subName => {
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

                let fbStr = "";
                if (typeof ev.feedback === "string") {
                    fbStr = ev.feedback.trim();
                } else if (ev.feedback && typeof ev.feedback === "object") {
                    const raw = ev.feedback.text || ev.feedback.remarks || ev.feedback.comment || ev.feedback.feedback || "";
                    fbStr = typeof raw === "string" ? raw.trim() : String(raw || "").trim();
                } else if (ev.feedback !== undefined && ev.feedback !== null) {
                    fbStr = String(ev.feedback).trim();
                }
                if (fbStr) {
                    teacherRemarks.push(`<strong>${subName}:</strong> "${fbStr}"`);
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

        const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
        const overallGrade = totalMax > 0 ? (window.calculateGradeScale ? window.calculateGradeScale(totalObtained, totalMax).grade : (overallPct >= 80 ? "A1" : overallPct >= 60 ? "B1" : "C")) : "—";

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
        if (elMeta) elMeta.textContent = `Roll No: ${displayRoll} • Class: ${displayClass} • All Curriculum Subjects`;
        if (elTotalScore) elTotalScore.textContent = `${totalObtained} / ${totalMax}`;
        if (elOverallPct) elOverallPct.textContent = `${overallPct}%`;
        if (elGrade) elGrade.textContent = overallGrade;
        if (elRatio) elRatio.textContent = `${gradedCount} of ${sortedSubjectList.length} Subjects Evaluated`;
        if (elTbody) elTbody.innerHTML = rowsHtml;

        if (elFeedbackBox && elFeedbackText) {
            if (teacherRemarks.length > 0) {
                elFeedbackBox.style.display = "block";
                elFeedbackText.innerHTML = teacherRemarks.join("<br/><br/>");
            } else {
                elFeedbackBox.style.display = "none";
            }
        }

        modal.style.display = "flex";
        const closeModal = () => { modal.style.display = "none"; };

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

    exportExcelMatrix() {
        const papers = this.computeDetailedPapers();
        const headers = ["Roll No", "Student Name", "Class", "Subject", "Max Marks", "Obtained Marks", "Percentage", "Grade", "Status", "Last Corrected", "Faculty Evaluator"];
        const rows = papers.map(p => [
            p.rollNo || "",
            p.studentName || "",
            `${p.className || ""}-${p.section || ""}`,
            p.subject || "",
            p.maxMarks || 0,
            p.obtainedMarks || 0,
            `${p.percentage || 0}%`,
            p.grade || "--",
            p.status || "",
            p.lastCorrectedFormatted || "",
            p.teacherName || ""
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell !== undefined && cell !== null ? cell : '').replace(/"/g, '""')}"`).join(","))
            .join("\r\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Admin_Master_Evaluation_Audit_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            try {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } catch (e) {}
        }, 2000);
    }
}

window.AdminPanelManager = AdminPanelManager;
