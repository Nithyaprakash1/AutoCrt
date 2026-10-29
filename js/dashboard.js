/**
 * Niprak Digital Correction - Teacher Dashboard
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
        this.selectedSubjectFilter = null; // null by default so active panel subject is used
        this.searchQuery = "";
        this.selectedIds = new Set();
        this.teacherSubject = "";
        this.teacherName = "";
        this.charts = {}; // Store Chart.js instances
        // Active batch key for drill-down ('className:::templateName' or null for batches overview)
        this.activeBatchKey = null;
        // Highlight batch key from shared direct links (keeps overview cards visible with target card highlighted)
        this.highlightBatchKey = null;

        // Drill-down step: 'papers' (direct view) | 'classes' (grid view)
        this.viewMode = "papers"; // Default to direct papers view with filters so teacher papers are never hidden
    }

    async init() {
        if (!this.container) return;
        this.evaluations = await window.appStorage.getAllEvaluations(false, true);

        // Check if uploader just published a new batch of papers
        const lastCls = sessionStorage.getItem("niprak_last_uploaded_class");
        const lastSub = sessionStorage.getItem("niprak_last_uploaded_subject");
        if (lastSub) {
            this.selectedSubjectFilter = lastSub;
            sessionStorage.removeItem("niprak_last_uploaded_subject");
        }
        if (lastCls) {
            sessionStorage.removeItem("niprak_last_uploaded_class");
        }
        this.selectedClassFilter = "all";

        // Get authenticated user profile for subject panel & greeting name
        const user = window.appStorage.getCurrentUser();
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

        if (user) {
            let assignedSubs = (user.assignedSubjects && user.assignedSubjects.length > 0)
                ? [...user.assignedSubjects]
                : (user.subject ? [user.subject] : []);

            let assignedCls = (user.assignedClasses && user.assignedClasses.length > 0)
                ? [...user.assignedClasses]
                : (user.class ? [user.class] : []);

            this.teacherSubjects = assignedSubs;
            this.teacherSubject = assignedSubs[0] || user.subject || "";
            this.teacherClasses = assignedCls;

            this.teacherName = user.name || "";
            if (isTeacher && (!this.teacherName || this.teacherName.includes("Nithya Prakash") || this.teacherName === "Faculty Evaluator")) {
                this.teacherName = this.teacherSubject || "Subject Evaluator";
            }
        }

        // Check URL parameters or direct shared target (e.g. ?view=dashboard&subject=Physics&batch=Class 12-A:::Physics...)
        const urlParams = new URLSearchParams(window.location.search);
        let sharedSub = urlParams.get("subject");
        let sharedBatch = urlParams.get("batch");
        if (!sharedSub && !sharedBatch) {
            try {
                const rawShared = sessionStorage.getItem("niprak_shared_target");
                if (rawShared) {
                    const parsed = JSON.parse(rawShared);
                    sharedSub = parsed.targetSubject;
                    sharedBatch = parsed.targetBatch;
                }
            } catch (e) {}
        }
        // Consume shared target so it doesn't leak into subsequent reloads or navigations
        try { sessionStorage.removeItem("niprak_shared_target"); } catch (e) {}

        if (sharedSub && sharedSub !== "all") {
            this.teacherSubject = sharedSub;
            this.teacherSubjects = [sharedSub];
            this.selectedSubjectFilter = sharedSub;
        }

        if (sharedBatch && sharedBatch !== "all") {
            this.highlightBatchKey = sharedBatch;
            // Always keep activeBatchKey null on initial load so Teacher Desk displays the CARDS overview mode
            this.activeBatchKey = null;
        }

        // Evaluator / Teacher desk defaults to active subject or assigned subject panel
        const sessSub = sessionStorage.getItem("niprak_active_subject");
        if (sessSub && sessSub !== "all" && sessSub !== "All Subjects" && (!this.selectedSubjectFilter || this.selectedSubjectFilter === "all")) {
            this.selectedSubjectFilter = sessSub;
        } else if (isTeacher && (!this.selectedSubjectFilter || this.selectedSubjectFilter === "all")) {
            const primarySub = (this.teacherSubject && this.teacherSubject !== "all" && this.teacherSubject !== "All Subjects")
                ? this.teacherSubject
                : (this.teacherSubjects && this.teacherSubjects.find(s => s && s !== "all" && s !== "All Subjects"));
            if (primarySub) {
                this.selectedSubjectFilter = primarySub;
            }
        }

        this.applyFilters();
        this.render();
        this.bindEvents();
        this.renderCharts();

        const activeSubNow = this.getActiveSubject();
        if (activeSubNow && activeSubNow !== "all" && activeSubNow !== "All Subjects") {
            sessionStorage.setItem("niprak_active_subject", activeSubNow);
        }
        if (window.app && typeof window.app.updateUserProfileDisplay === "function") {
            window.app.updateUserProfileDisplay(activeSubNow, this.selectedClassFilter !== "all" ? this.selectedClassFilter : null);
        }

        // Background Cloud Sync: Pull fresh papers from Firebase quietly without tearing down DOM
        if (window.firebaseManager) {
            window.appStorage.getAllEvaluations(true, true).then((freshList) => {
                if (Array.isArray(freshList) && freshList.length > 0) {
                    this.evaluations = freshList;
                    this.applyFilters();
                    if (!this.activeBatchKey) {
                        this.render();
                        this.bindEvents();
                    } else {
                        this.renderTableRows();
                        this.updateCountsInUI();
                    }
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
        if (this._chartsResizeObserver) {
            this._chartsResizeObserver.disconnect();
            this._chartsResizeObserver = null;
        }
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

    getActiveSubject() {
        // If user explicitly selected "All Subjects" pill
        if (this.selectedSubjectFilter === "all" || this.selectedSubjectFilter === "All Subjects") {
            return null;
        }

        // 1. Explicitly chosen subject filter (via pill button, dropdown, or URL/upload target)
        if (this.selectedSubjectFilter) {
            return this.selectedSubjectFilter;
        }

        // 2. Evaluator / Teacher assigned primary subject panel property
        if (this.teacherSubject && this.teacherSubject !== "all" && this.teacherSubject !== "All Subjects") {
            return this.teacherSubject;
        }

        // 3. User profile assigned subjects
        const user = window.appStorage ? window.appStorage.getCurrentUser() : null;
        if (user) {
            if (Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0) {
                const valid = user.assignedSubjects.find(s => s && s !== "all" && s !== "All Subjects");
                if (valid) return valid;
            }
            if (user.subject && user.subject !== "all" && user.subject !== "All Subjects") {
                return user.subject;
            }
        }

        // 4. Multiple assigned teacherSubjects list
        if (Array.isArray(this.teacherSubjects) && this.teacherSubjects.length > 0) {
            const valid = this.teacherSubjects.find(s => s && s !== "all" && s !== "All Subjects");
            if (valid) return valid;
        }

        return null;
    }

    getSubjectEvals() {
        const activeSub = this.getActiveSubject();
        if (activeSub && activeSub !== 'all' && activeSub !== 'All Subjects') {
            return this.evaluations.filter(e => window.appStorage.isSubjectMatch(e.subject, e.examName, activeSub, e.templateName));
        }

        if (this.teacherSubject && this.teacherSubject !== 'all' && this.teacherSubject !== 'All Subjects') {
            return this.evaluations.filter(e => window.appStorage.isSubjectMatch(e.subject, e.examName, this.teacherSubject, e.templateName));
        }

        const user = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        if (isTeacher && Array.isArray(this.teacherSubjects) && this.teacherSubjects.length > 0 && !this.teacherSubjects.includes("All Subjects")) {
            return this.evaluations.filter(e => this.teacherSubjects.some(s => window.appStorage.isSubjectMatch(e.subject, e.examName, s, e.templateName)));
        }

        return this.evaluations;
    }

    applyFilters() {
        const user = window.appStorage.getCurrentUser();
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        const activeSub = this.getActiveSubject();

        this.filteredEvaluations = this.evaluations.filter(e => {
            const isCorr = this.isPaperCorrected(e);

            // 0. Subject Isolation: If viewing a particular subject panel (e.g. Maths panel), strictly show that subject's papers alone!
            if (activeSub && activeSub !== 'all' && activeSub !== 'All Subjects') {
                const subMatch = window.appStorage.isSubjectMatch(e.subject, e.examName, activeSub, e.templateName);
                if (!subMatch) return false;
            } else if (this.teacherSubject && this.teacherSubject !== 'all' && this.teacherSubject !== 'All Subjects') {
                const subMatch = window.appStorage.isSubjectMatch(e.subject, e.examName, this.teacherSubject, e.templateName);
                if (!subMatch) return false;
            } else if (isTeacher && this.teacherSubjects && this.teacherSubjects.length > 0 && !this.teacherSubjects.includes("All Subjects")) {
                const matches = this.teacherSubjects.some(s => window.appStorage.isSubjectMatch(e.subject, e.examName, s, e.templateName));
                if (!matches) return false;
            }

            // Active Batch filter: When drilled down into a specific batch card
            if (this.activeBatchKey) {
                const parts = this.activeBatchKey.split(":::");
                const targetCls = (parts[0] || "").toLowerCase().trim();
                const targetTpl = (parts.slice(1).join(":::") || "").toLowerCase().trim();

                // 1. Direct batch membership check: If this.batches is already calculated and has this active batch
                let matchedBatch = null;
                if (this.batches && this.batches.length > 0) {
                    matchedBatch = this.batches.find(b => b.key === this.activeBatchKey ||
                        (b.className && b.className.toLowerCase().trim() === targetCls && b.templateName && b.templateName.toLowerCase().trim() === targetTpl));
                }

                let inBatch = false;
                if (matchedBatch && matchedBatch.papers && matchedBatch.papers.length > 0) {
                    inBatch = matchedBatch.papers.some(p => String(p.id) === String(e.id));
                }

                // 2. Deterministic batch key comparison (exact match)
                if (!inBatch) {
                    const eCls = (e.classLabel || e.className || e.class || "Class 12-A").toLowerCase().trim();
                    const examTitle = (e.examName || e.templateName || "Assessment").toLowerCase().trim();
                    const dateStr = e.examDate ? ` (${e.examDate})`.toLowerCase().trim() : '';
                    const eTplFull = `${examTitle}${dateStr}`.trim();
                    const eBatchKey = `${eCls}:::${eTplFull}`;

                    if (eBatchKey === this.activeBatchKey.toLowerCase().trim()) {
                        inBatch = true;
                    }
                }

                // 3. Flexible normalized fallback (match class AND match template/exam)
                if (!inBatch) {
                    const normTargetCls = targetCls.replace(/[^a-z0-9]/g, '');
                    const eCls1 = (e.class || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eCls2 = (e.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eCls3 = (e.classLabel || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    const clsMatches = !normTargetCls || 
                        eCls1 === normTargetCls || eCls2 === normTargetCls || eCls3 === normTargetCls ||
                        (eCls1 && (eCls1.includes(normTargetCls) || normTargetCls.includes(eCls1))) ||
                        (eCls2 && (eCls2.includes(normTargetCls) || normTargetCls.includes(eCls2))) ||
                        (eCls3 && (eCls3.includes(normTargetCls) || normTargetCls.includes(eCls3)));

                    if (!clsMatches) return false;

                    const examDateStr = e.examDate ? ` (${e.examDate})` : '';
                    const examNameRaw = (e.examName || "").toLowerCase().trim();
                    const tplNameRaw = (e.templateName || "").toLowerCase().trim();
                    const examWithDate = `${examNameRaw}${examDateStr}`.toLowerCase().trim();
                    const tplWithDate = `${tplNameRaw}${examDateStr}`.toLowerCase().trim();
                    const harmTpl = (window.harmonizeTemplateForSubject ? window.harmonizeTemplateForSubject(tplNameRaw, e.subject) : tplNameRaw).toLowerCase().trim();

                    const normTargetTpl = targetTpl.replace(/[^a-z0-9]/g, '');
                    const normExam = examNameRaw.replace(/[^a-z0-9]/g, '');
                    const normTpl = tplNameRaw.replace(/[^a-z0-9]/g, '');
                    const normExamDate = examWithDate.replace(/[^a-z0-9]/g, '');
                    const normTplDate = tplWithDate.replace(/[^a-z0-9]/g, '');
                    const normHarm = harmTpl.replace(/[^a-z0-9]/g, '');

                    const tplMatches = !normTargetTpl ||
                        normExam === normTargetTpl || normExamDate === normTargetTpl ||
                        normTpl === normTargetTpl || normTplDate === normTargetTpl || normHarm === normTargetTpl ||
                        (normExam && (normExam.includes(normTargetTpl) || normTargetTpl.includes(normExam))) ||
                        (normExamDate && (normExamDate.includes(normTargetTpl) || normTargetTpl.includes(normExamDate))) ||
                        (normTpl && (normTpl.includes(normTargetTpl) || normTargetTpl.includes(normTpl))) ||
                        (normTplDate && (normTplDate.includes(normTargetTpl) || normTargetTpl.includes(normTplDate))) ||
                        (normHarm && (normHarm.includes(normTargetTpl) || normTargetTpl.includes(normHarm))) ||
                        (examNameRaw && (examNameRaw.includes(targetTpl) || targetTpl.includes(examNameRaw))) ||
                        (tplNameRaw && (tplNameRaw.includes(targetTpl) || targetTpl.includes(tplNameRaw))) ||
                        (examWithDate && (examWithDate.includes(targetTpl) || targetTpl.includes(examWithDate))) ||
                        (tplWithDate && (tplWithDate.includes(targetTpl) || targetTpl.includes(tplWithDate))) ||
                        (harmTpl && (harmTpl.includes(targetTpl) || targetTpl.includes(harmTpl)));

                    if (!tplMatches) return false;
                }
            }

            // 1. Status Tab filter
            if (this.activeTab === "uncorrected" && isCorr) return false;
            if (this.activeTab === "corrected" && !isCorr) return false;

            // 2. Class filter (flexible matching when on overview)
            if (!this.activeBatchKey && this.selectedClassFilter && this.selectedClassFilter !== "all") {
                const normFilter = this.selectedClassFilter.toLowerCase().replace(/[^a-z0-9]/g, '');
                const eCls1 = (e.class || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const eCls2 = (e.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const eCls3 = (e.classLabel || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const classMatch = !normFilter || 
                    eCls1 === normFilter || eCls2 === normFilter || eCls3 === normFilter ||
                    (eCls1 && (eCls1.includes(normFilter) || normFilter.includes(eCls1))) ||
                    (eCls2 && (eCls2.includes(normFilter) || normFilter.includes(eCls2))) ||
                    (eCls3 && (eCls3.includes(normFilter) || normFilter.includes(eCls3)));
                if (!classMatch) return false;
            }

            // 2b. Subject filter dropdown (secondary — within the teacher's own subject)
            if (this.selectedSubjectFilter && this.selectedSubjectFilter !== "all") {
                if (!window.appStorage.isSubjectMatch(e.subject, e.examName || e.templateName, this.selectedSubjectFilter, e.templateName)) return false;
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
        const user = window.appStorage.getCurrentUser();
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
        const isUploader = user && user.role === 'uploader';
        const allowsAll = isAdmin || isUploader || !user || !isTeacher;
        let teacherAssigned = this.teacherSubjects && this.teacherSubjects.length > 0
            ? [...this.teacherSubjects]
            : (this.teacherSubject && this.teacherSubject !== "all" ? [this.teacherSubject] : []);
        if (isTeacher) {
            teacherAssigned = teacherAssigned.filter(s => s && s !== 'all' && s !== 'All Subjects');
        }

        const ic = window.Icons || {};
        const greetingStr = this.getGreeting();
        const activeSub = this.getActiveSubject();
        const displaySubject = activeSub || (this.teacherSubject && this.teacherSubject !== 'all' && this.teacherSubject !== 'All Subjects'
            ? this.teacherSubject 
            : (teacherAssigned.length === 1 && teacherAssigned[0] !== 'All Subjects' ? teacherAssigned[0] : (teacherAssigned.length > 1 ? teacherAssigned.join(' & ') : (isAdmin ? 'All Subjects' : 'Evaluation'))));
        let displayName = this.teacherName || "";
        if (!displayName || displayName.includes("Nithya Prakash")) {
            displayName = (displaySubject && displaySubject !== 'Evaluation') ? displaySubject : "Teacher";
        }

        // Active panel subject: strictly isolate cards & papers to that specific subject desk
        const activePanelSubject = (activeSub && activeSub !== 'all' && activeSub !== 'All Subjects')
            ? activeSub
            : ((displaySubject && displaySubject !== 'All Subjects' && displaySubject !== 'Evaluation') ? displaySubject : null);

        // Compute Class & Template Batches for Teacher Desk: Strictly show active subject's batches alone!
        let evalsForBatches = subjectEvals;
        if (activePanelSubject) {
            evalsForBatches = this.evaluations.filter(e => window.appStorage.isSubjectMatch(e.subject, e.examName, activePanelSubject, e.templateName));
        } else if (isTeacher && this.teacherSubjects && this.teacherSubjects.length > 0 && !this.teacherSubjects.includes("All Subjects")) {
            evalsForBatches = this.evaluations.filter(e => this.teacherSubjects.some(s => window.appStorage.isSubjectMatch(e.subject, e.examName, s, e.templateName)));
        }

        if (isTeacher && this.teacherClasses && this.teacherClasses.length > 0 && !this.teacherClasses.includes("All Classes") && !this.teacherClasses.includes("all")) {
            evalsForBatches = evalsForBatches.filter(e => {
                const eCls = (e.class || e.className || e.classLabel || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                return this.teacherClasses.some(tc => {
                    const normTc = tc.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return !normTc || eCls === normTc || (normTc && eCls.includes(normTc)) || (eCls && normTc.includes(eCls));
                });
            });
        }

        const batchMap = new Map();
        evalsForBatches.forEach(e => {
            const cls = e.classLabel || e.className || e.class || "Class 12-A";
            const sub = e.subject || activePanelSubject || displaySubject;
            const examTitle = e.examName || e.templateName || "Assessment";
            const dateStr = e.examDate ? ` (${e.examDate})` : '';
            const tpl = `${examTitle}${dateStr}`;
            const batchKey = `${cls}:::${tpl}`;
            if (!batchMap.has(batchKey)) {
                batchMap.set(batchKey, {
                    key: batchKey,
                    className: cls,
                    templateName: tpl,
                    examName: examTitle,
                    examDate: e.examDate || '',
                    subject: sub,
                    papers: [],
                    total: 0,
                    corrected: 0,
                    uncorrected: 0,
                    maxMarks: e.maxMarks || 40,
                    firstPendingPaper: null
                });
            }
            const b = batchMap.get(batchKey);
            b.papers.push(e);
            b.total++;
            const isCorr = this.isPaperCorrected(e);
            if (isCorr) {
                b.corrected++;
            } else {
                b.uncorrected++;
                if (!b.firstPendingPaper) b.firstPendingPaper = e;
            }
        });
        this.batches = Array.from(batchMap.values());
        if (activePanelSubject) {
            this.batches = this.batches.filter(b => window.appStorage.isSubjectMatch(b.subject, b.templateName, activePanelSubject, b.templateName));
        }
        if (this.highlightBatchKey) {
            const hKey = this.highlightBatchKey.toLowerCase().trim();
            this.batches.sort((a, b) => {
                const aMatch = a.key.toLowerCase().trim() === hKey || hKey.includes(a.key.toLowerCase().trim()) ||
                               (hKey.includes(a.className.toLowerCase()) && hKey.includes(a.templateName.toLowerCase()));
                const bMatch = b.key.toLowerCase().trim() === hKey || hKey.includes(b.key.toLowerCase().trim()) ||
                               (hKey.includes(b.className.toLowerCase()) && hKey.includes(b.templateName.toLowerCase()));
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return 0;
            });
        }

        // Check if currently viewing Tamil desk
        const isTamilDesk = (displaySubject && displaySubject.toLowerCase().includes('tamil')) ||
            (this.teacherSubject && this.teacherSubject.toLowerCase().includes('tamil')) ||
            teacherAssigned.some(s => s && s.toLowerCase().includes('tamil'));

        // Welcome Headline with Subject & Class Display
        const activeClassesList = (this.teacherClasses && this.teacherClasses.length > 0)
            ? this.teacherClasses.filter(c => c && c.toLowerCase() !== 'all classes' && c.toLowerCase() !== 'all')
            : [];
        const displayClasses = activeClassesList.join(', ');
        const welcomeHeadline = displayClasses
            ? `${displaySubject} • ${displayClasses} Evaluation Desk`
            : `${displaySubject} Evaluation Desk`;

        // =========================================================================
        // VIEW 1: Batches Overview Mode (Default)
        // Renders Welcome Banner + KPI Metric Cards + Class-Template Batches Grid ONLY.
        // Hides flat table & saves cloud storage reads / DOM bloat until user enters a batch.
        // =========================================================================
        if (!this.activeBatchKey) {
            this.container.innerHTML = `
                <div class="dashboard-page">
                    <!-- Welcome Banner with Dynamic Greeting, Subject Title & Quick Start Action -->
                    <div class="dashboard-welcome-banner">
                        <div class="welcome-text-col">
                            <span class="welcome-greeting">${greetingStr}, ${displayName}! 👋</span>
                            <h2 class="welcome-headline">${welcomeHeadline}</h2>
                            <p class="welcome-sub">Streamlined examination batches. Click into any class card below to view its student answer sheets, evaluate marks, and export results.</p>
                        </div>
                        <div class="welcome-action-col" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                            ${isTamilDesk ? `
                                <button type="button" class="btn-primary btn-large btn-tamil-test-me" id="dash-btn-test-me" style="background: linear-gradient(135deg, #10B981, #059669); border-color: #059669; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35); font-weight: 500; display: inline-flex; align-items: center; gap: 8px;" title="Test correct a sample Tamil paper with the 40-mark blueprint">
                                    <span class="btn-icon">✍️</span> Test Me!
                                </button>
                            ` : ''}
                            <button type="button" class="btn-primary btn-large" id="dash-btn-start-correction" title="Open first pending paper to evaluate">
                                <span class="btn-icon">${ic.lightning || '⚡'}</span> Start Correction
                            </button>
                        </div>
                    </div>

                    <!-- Live Counter Labels & KPI Metric Cards -->
                    <div class="kpi-grid">
                        <div class="kpi-card kpi-uncorrected-highlight" id="card-tab-uncorrected" title="Uncorrected Papers">
                            <div class="kpi-card-header">
                                <div class="kpi-icon-wrap bg-amber-light">
                                    <span class="kpi-icon text-amber">${ic.pending || ''}</span>
                                </div>
                                <span class="counter-badge counter-badge-new" style="font-size: 0.72rem; padding: 4px 9px; border-radius: 6px; background: rgba(217, 119, 6, 0.12); color: #D97706; font-weight: 700; white-space: nowrap;">${uncorrectedCount} UNCORRECTED</span>
                            </div>
                            <div class="kpi-card-body">
                                <span class="kpi-value text-amber">${uncorrectedCount}</span>
                                <span class="kpi-title">PENDING EVALUATION</span>
                            </div>
                        </div>

                        <div class="kpi-card kpi-corrected-highlight" id="card-tab-corrected" title="Corrected Papers">
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

                        <div class="kpi-card" id="card-tab-all" title="Total Papers">
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

                    <!-- Class & Exam Batches Section -->
                    <div class="teacher-batches-section" id="teacher-batches-section">
                        <div class="teacher-batches-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                            <div class="teacher-batches-title-col">
                                <h3 class="teacher-batches-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                                    Class & Exam Blueprint Batches
                                    <span class="teacher-batches-count-pill">${this.batches.length} ${this.batches.length === 1 ? 'Batch' : 'Batches'}</span>
                                </h3>
                                <p class="teacher-batches-desc" style="margin: 2px 0 0;">Click any card to view its student answer sheets or start marking directly.</p>
                            </div>
                            ${this.highlightBatchKey ? `
                                <button type="button" class="btn-admin-clear-batch" id="btn-clear-dash-highlight" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 8px; border: 1px solid #0071E3; background: rgba(0, 113, 227, 0.08); color: #0071E3; font-size: 0.78rem; font-weight: 500; cursor: pointer;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    <span>Focus: ${this.highlightBatchKey.replace(':::', ' • ')} (Clear)</span>
                                </button>
                            ` : ''}
                        </div>

                        <div class="teacher-batches-grid">
                            ${this.batches.length === 0 ? `
                                <div class="teacher-batches-empty">
                                    <p>No exam batches currently allotted for ${displaySubject}. Upload papers to populate class-template cards.</p>
                                </div>
                            ` : this.batches.map(b => {
                                const pct = b.total > 0 ? Math.round((b.corrected / b.total) * 100) : 0;
                                const isCompleted = b.uncorrected === 0 && b.total > 0;
                                const isSharedTarget = Boolean(this.highlightBatchKey && (
                                    b.key.toLowerCase().trim() === this.highlightBatchKey.toLowerCase().trim() ||
                                    this.highlightBatchKey.toLowerCase().trim().includes(b.key.toLowerCase().trim()) ||
                                    (this.highlightBatchKey.toLowerCase().includes(b.className.toLowerCase()) && this.highlightBatchKey.toLowerCase().includes(b.templateName.toLowerCase()))
                                ));

                                return `
                                    <div class="teacher-batch-card ${isSharedTarget ? 'active active-shared-batch' : ''}" data-class="${b.className}" data-template="${b.templateName}" data-batch-key="${b.key}" style="cursor: pointer; ${isSharedTarget ? 'border: 2px solid #0071E3; box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.22), 0 10px 28px rgba(0, 113, 227, 0.12);' : ''}">
                                        <div class="batch-card-top-row">
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                                <span class="batch-class-badge">${b.className}</span>
                                                <span class="batch-subject-tag">${b.subject}</span>
                                                ${isSharedTarget ? `
                                                    <span class="batch-status-pill" style="background: rgba(0, 113, 227, 0.12); color: #0071E3; font-weight: 600; border: 1px solid rgba(0, 113, 227, 0.25);">★ Shared Batch</span>
                                                ` : ''}
                                            </div>
                                            <span class="batch-status-pill ${isCompleted ? 'status-all-done' : 'status-has-pending'}">
                                                ${isCompleted ? '✓ All Graded' : `${b.uncorrected} Pending`}
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
                                                <span class="progress-ratio">${b.corrected} / ${b.total} Evaluated</span>
                                                <span class="progress-pct" style="color: ${pct === 100 ? '#16A34A' : '#0071E3'}; font-weight: 700;">${pct}%</span>
                                            </div>
                                            <div class="batch-progress-bar">
                                                <div class="batch-progress-fill" style="width: ${pct}%; background: ${pct === 100 ? '#16A34A' : 'linear-gradient(90deg, #0071E3, #38BDF8)'};"></div>
                                            </div>
                                        </div>

                                        <div class="batch-actions-row">
                                            <button type="button" class="btn-batch-view" data-class="${b.className}" data-template="${b.templateName}" title="Open papers in this batch">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                <span>View Papers (${b.total})</span>
                                            </button>
                                            <button type="button" class="btn-batch-start" data-class="${b.className}" data-template="${b.templateName}" title="Start correcting papers in this batch">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                                <span>${isCompleted ? 'Review' : 'Start Marking'}</span>
                                            </button>
                                            ${b.subject && b.subject.toLowerCase().includes('tamil') ? `
                                                <button type="button" class="btn-batch-view btn-batch-test-me" data-class="${b.className}" data-template="${b.templateName}" style="border-color: #10B981; color: #059669; font-weight: 500;" title="Test correct a sample Tamil paper">
                                                    ✍️ Test Me!
                                                </button>
                                            ` : ''}
                                            <button type="button" class="btn-batch-share btn-dash-batch-share" data-class="${b.className}" data-template="${b.templateName}" data-subject="${b.subject}" data-total="${b.total}" title="Share this batch via WhatsApp">
                                                ${(window.Icons && window.Icons.whatsapp) || ''}
                                                <span>Share</span>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // =========================================================================
        // VIEW 2: Batch Drill-Down Mode (When teacher clicked a specific batch)
        // Shows Batch Header Banner with [Back to All Batches] + Analytics + That batch's papers
        // =========================================================================
        const [targetClass, ...restTpl] = this.activeBatchKey.split(":::");
        const targetTemplate = restTpl.join(":::");
        const currentBatch = (this.batches || []).find(b => b.key === this.activeBatchKey || (b.className === targetClass && b.templateName === targetTemplate)) || {
            className: targetClass,
            templateName: targetTemplate,
            subject: displaySubject,
            papers: this.filteredEvaluations,
            total: this.filteredEvaluations.length,
            corrected: this.filteredEvaluations.filter(e => this.isPaperCorrected(e)).length,
            uncorrected: this.filteredEvaluations.filter(e => !this.isPaperCorrected(e)).length,
            maxMarks: this.filteredEvaluations[0]?.maxMarks || 70
        };
        if (currentBatch.papers && currentBatch.papers.length === 0 && this.filteredEvaluations && this.filteredEvaluations.length > 0) {
            currentBatch.papers = this.filteredEvaluations;
            currentBatch.total = this.filteredEvaluations.length;
            currentBatch.corrected = this.filteredEvaluations.filter(e => this.isPaperCorrected(e)).length;
            currentBatch.uncorrected = this.filteredEvaluations.filter(e => !this.isPaperCorrected(e)).length;
        }
        const batchPct = currentBatch.total > 0 ? Math.round((currentBatch.corrected / currentBatch.total) * 100) : 0;
        const batchIsDone = currentBatch.uncorrected === 0 && currentBatch.total > 0;

        this.container.innerHTML = `
            <div class="dashboard-page">
                <!-- Batch Navigation Header Banner -->
                <div class="batch-detail-header-banner" style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); color: #FFFFFF; border-radius: 14px; padding: 20px 24px; margin-bottom: 22px; box-shadow: 0 4px 18px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <button type="button" class="btn-back-to-batches" id="btn-back-to-batches" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22); color: #FFFFFF; border-radius: 999px; padding: 7px 16px; font-size: 0.82rem; font-weight: 400 !important; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.15s ease;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                            <span>Back to All Batches</span>
                        </button>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <span style="font-size: 0.78rem; font-weight: 400 !important; padding: 4px 12px; border-radius: 999px; background: ${batchIsDone ? 'rgba(52, 199, 89, 0.2)' : 'rgba(0, 122, 255, 0.2)'}; color: ${batchIsDone ? '#34C759' : '#60A5FA'}; border: 1px solid ${batchIsDone ? 'rgba(52, 199, 89, 0.4)' : 'rgba(96, 165, 250, 0.4)'};">
                                ${batchIsDone ? '✓ All Papers Evaluated' : `${currentBatch.uncorrected} Pending Evaluation`}
                            </span>
                            ${((currentBatch.subject && currentBatch.subject.toLowerCase().includes('tamil')) || isTamilDesk) ? `
                                <button type="button" class="btn-primary btn-tamil-test-me" id="btn-batch-test-me" style="background: linear-gradient(135deg, #10B981, #059669); border-color: #059669; padding: 7px 16px; font-size: 0.82rem; border-radius: 999px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;" title="Test correct a sample Tamil paper">
                                    <span>✍️ Test Me!</span>
                                </button>
                            ` : ''}
                            <button type="button" class="btn-primary" id="btn-batch-start-marking" style="padding: 7px 16px; font-size: 0.82rem; border-radius: 999px; font-weight: 400 !important; display: inline-flex; align-items: center; gap: 6px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                ${currentBatch.uncorrected === 0 ? 'Review Papers' : 'Start Marking'}
                            </button>
                        </div>
                    </div>

                    <div style="display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                <span style="background: #0071E3; color: #FFFFFF; font-size: 0.74rem; font-weight: 400 !important; padding: 3px 9px; border-radius: 6px; text-transform: uppercase;">${currentBatch.className}</span>
                                <span style="background: rgba(255,255,255,0.12); color: #E2E8F0; font-size: 0.74rem; font-weight: 400 !important; padding: 3px 9px; border-radius: 6px;">${currentBatch.subject}</span>
                                <span style="color: #94A3B8; font-size: 0.8rem;">Max Marks: <span style="color: #FFFFFF;">${currentBatch.maxMarks}M</span></span>
                            </div>
                            <h2 style="font-size: 1.25rem; font-weight: 400 !important; margin: 0; color: #FFFFFF;">${currentBatch.templateName}</h2>
                        </div>
                        <div style="min-width: 200px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 5px; color: #CBD5E1;">
                                <span>Batch Progress</span>
                                <span>${currentBatch.corrected} / ${currentBatch.total} Evaluated (${batchPct}%)</span>
                            </div>
                            <div style="height: 7px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden;">
                                <div style="width: ${batchPct}%; height: 100%; background: ${batchIsDone ? '#10B981' : 'linear-gradient(90deg, #38BDF8, #818CF8)'}; border-radius: 999px;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Analytics Charts Section for This Batch Alone -->
                <div class="analytics-charts-grid" style="margin-bottom: 22px;">
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

                <!-- Batch Student Papers Table & Actions -->
                <div class="dashboard-main-section">
                    <div class="section-top-bar" style="margin-bottom: 14px;">
                        <div>
                            <h3 class="section-title">Student Papers & Evaluation Desk</h3>
                            <p class="section-subtitle">Showing answer sheets for ${currentBatch.className} — ${currentBatch.templateName}. Mark papers or bulk export results.</p>
                        </div>
                    </div>

                    <!-- Comprehensive Filter and Control Bar -->
                    <div class="dash-filters-toolbar" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; background: #FFFFFF; padding: 12px 16px; border-radius: 12px; border: 1px solid #E2E8F0; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                        <div class="dash-filters-group" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1; min-width: 260px;">
                            <select id="dash-filter-status" class="form-select-sm" title="Filter by paper status" style="font-size: 0.85rem; font-weight: 400 !important; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #1E293B; cursor: pointer; min-width: 160px;">
                                <option value="all" ${this.activeTab === 'all' ? 'selected' : ''}>All Papers (${currentBatch.total})</option>
                                <option value="uncorrected" ${this.activeTab === 'uncorrected' ? 'selected' : ''}>Uncorrected (${currentBatch.uncorrected})</option>
                                <option value="corrected" ${this.activeTab === 'corrected' ? 'selected' : ''}>Corrected (${currentBatch.corrected})</option>
                            </select>

                            <div style="position: relative; flex: 1; min-width: 200px;">
                                <input type="text" id="dash-search-input" class="form-input form-input-sm" value="${this.searchQuery}" placeholder="🔍 Search student or roll no in this batch..." style="width: 100%; height: 38px; padding: 0 12px; font-size: 0.85rem; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; font-weight: 400 !important;" />
                            </div>
                        </div>

                        <div class="dash-actions-group" style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap;">
                            <button type="button" class="btn-secondary" id="dash-btn-bulk-pdf" title="Bulk download selected or all PDFs" style="background: #FFFFFF; border: 1.5px solid #007AFF; color: #007AFF; font-size: 0.84rem; font-weight: 400 !important; height: 38px; padding: 0 15px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;">
                                <span class="btn-icon" style="display: flex; align-items: center;">${ic.pdf || '📄'}</span> Bulk Download PDFs <span id="dash-pdf-count-badge" style="background: rgba(0, 122, 255, 0.12); padding: 2px 7px; border-radius: 10px; font-size: 0.75rem; font-weight: 400 !important;">(${this.selectedIds.size > 0 ? this.selectedIds.size : 'All ' + this.filteredEvaluations.length})</span>
                            </button>

                            <button type="button" class="btn-secondary" id="dash-btn-bulk-excel" title="Bulk export spreadsheet" style="background: #FFFFFF; border: 1.5px solid #16A34A; color: #16A34A; font-size: 0.84rem; font-weight: 400 !important; height: 38px; padding: 0 15px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;">
                                <span class="btn-icon" style="display: flex; align-items: center;">${ic.csv || '📊'}</span> Bulk Export Excel
                            </button>

                            <button type="button" class="btn-secondary" id="dash-btn-bulk-delete" title="Delete selected papers to free storage space" style="background: #FFFFFF; border: 1.5px solid #DC2626; color: #DC2626; font-size: 0.84rem; font-weight: 400 !important; height: 38px; padding: 0 15px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                <span>Bulk Delete</span> <span id="dash-delete-count-badge" style="background: rgba(220, 38, 38, 0.1); padding: 2px 7px; border-radius: 10px; font-size: 0.75rem; font-weight: 400 !important;">(${this.selectedIds.size})</span>
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
                                ${this.renderSkeletonRows(4)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.renderTableRows();
    }

    renderSkeletonRows(count = 4) {
        let html = "";
        for (let i = 0; i < count; i++) {
            html += `
                <tr class="skeleton-table-row">
                    <td style="text-align: center;"><div class="skeleton-shimmer" style="width: 16px; height: 16px; border-radius: 4px;"></div></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="skeleton-shimmer skeleton-avatar"></div>
                            <div class="skeleton-shimmer skeleton-bone" style="width: 110px;"></div>
                        </div>
                    </td>
                    <td><div class="skeleton-shimmer skeleton-bone" style="width: 48px;"></div></td>
                    <td><div class="skeleton-shimmer skeleton-bone" style="width: 72px;"></div></td>
                    <td><div class="skeleton-shimmer skeleton-bone" style="width: 130px;"></div></td>
                    <td><div class="skeleton-shimmer skeleton-bone" style="width: 50px;"></div></td>
                    <td><div class="skeleton-shimmer skeleton-chip"></div></td>
                    <td><div class="skeleton-shimmer skeleton-chip"></div></td>
                    <td><div class="skeleton-shimmer skeleton-bone" style="width: 80px;"></div></td>
                    <td class="text-right">
                        <div style="display: inline-flex; gap: 6px;">
                            <div class="skeleton-shimmer skeleton-btn"></div>
                            <div class="skeleton-shimmer skeleton-btn" style="width: 50px;"></div>
                        </div>
                    </td>
                </tr>
            `;
        }
        return html;
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
            const isPurged = Boolean(ev.rawScansPurged);
            const isCompleted = this.isPaperCorrected(ev);
            let statusClass = "badge-pending";
            let statusLabel = isCompleted ? "Corrected" : "Uncorrected";
            if (isPurged) {
                statusClass = "badge-archived";
                statusLabel = "✓ Log Archived";
            } else if (isCompleted) {
                statusClass = "badge-completed";
                statusLabel = "Corrected";
            }
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
                        <span class="status-pill ${statusClass}">${statusLabel}</span>
                    </td>
                    <td class="text-muted font-sm">${dateStr}</td>
                    <td class="text-right">
                        <div class="action-btn-group" style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                            <button type="button" class="btn-action-view btn-dash-open" data-id="${ev.id}" title="${isPurged ? 'View Student Scorecard' : (isCompleted ? 'Review or edit marks' : 'Start correction')}">
                                ${isPurged ? 'Scorecard' : (isCompleted ? 'View / Edit' : 'Evaluate')}
                            </button>
                            <button type="button" class="btn-action-quick-marks btn-dash-quick-marks" data-paper-id="${ev.id}" title="Quick enter or edit marks without opening canvas" style="background: rgba(0, 113, 227, 0.08); border: 1px solid rgba(0, 113, 227, 0.25); color: #0071E3; padding: 4px 8px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                                <span>✏️ Marks</span>
                            </button>
                            <button type="button" class="btn-action-pdf btn-dash-pdf" data-id="${ev.id}" title="${isPurged ? 'Download official scorecard PDF' : 'Download individual evaluated PDF'}">
                                ${ic.pdf || '📄'} ${isPurged ? 'Scorecard' : 'PDF'}
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
        const delBadge = this.container.querySelector("#dash-delete-count-badge");
        if (delBadge) {
            delBadge.textContent = `(${this.selectedIds.size})`;
        }
        const delBtn = this.container.querySelector("#dash-btn-bulk-delete");
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
        // Teacher Batch Cards Interactions -> Drill down into that batch
        this.container.querySelectorAll(".teacher-batch-card").forEach(card => {
            card.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                const cls = card.getAttribute("data-class");
                const tpl = card.getAttribute("data-template");
                if (cls && tpl) {
                    this.activeBatchKey = `${cls}:::${tpl}`;
                    this.activeTab = "all";
                    this.searchQuery = "";
                    this.selectedIds.clear();
                    this.applyFilters();
                    this.render();
                    this.bindEvents();
                    this.renderCharts();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    const matchedBatch = (this.batches || []).find(b => b.key === this.activeBatchKey);
                    const bSub = matchedBatch?.subject || this.getActiveSubject();
                    if (window.app && typeof window.app.updateUserProfileDisplay === "function") {
                        window.app.updateUserProfileDisplay(bSub, cls);
                    }
                }
            });
        });

        this.container.querySelectorAll(".btn-batch-view").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const cls = btn.getAttribute("data-class");
                const tpl = btn.getAttribute("data-template");
                if (cls && tpl) {
                    this.activeBatchKey = `${cls}:::${tpl}`;
                    this.activeTab = "all";
                    this.searchQuery = "";
                    this.selectedIds.clear();
                    this.applyFilters();
                    this.render();
                    this.bindEvents();
                    this.renderCharts();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    const matchedBatch = (this.batches || []).find(b => b.key === this.activeBatchKey);
                    const bSub = matchedBatch?.subject || this.getActiveSubject();
                    if (window.app && typeof window.app.updateUserProfileDisplay === "function") {
                        window.app.updateUserProfileDisplay(bSub, cls);
                    }
                }
            });
        });

        // Back to All Batches Button (in View 2)
        const btnBackToBatches = this.container.querySelector("#btn-back-to-batches");
        if (btnBackToBatches) {
            btnBackToBatches.addEventListener("click", () => {
                this.activeBatchKey = null;
                this.activeTab = "all";
                this.searchQuery = "";
                this.selectedIds.clear();
                this.applyFilters();
                this.render();
                this.bindEvents();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        }

        // Batch Start Marking Button (in View 2)
        const btnBatchStartMarking = this.container.querySelector("#btn-batch-start-marking");
        if (btnBatchStartMarking) {
            btnBatchStartMarking.addEventListener("click", () => {
                const uncorrected = this.filteredEvaluations.find(e => !this.isPaperCorrected(e));
                const target = uncorrected || this.filteredEvaluations[0];
                if (target && this.options.onOpenEvaluation) {
                    this.options.onOpenEvaluation(target);
                } else if (target && window.app) {
                    window.app.openWorkspace(target);
                }
            });
        }

        this.container.querySelectorAll(".btn-batch-start").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const cls = btn.getAttribute("data-class");
                const tpl = btn.getAttribute("data-template");
                const normCls = (cls || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const normTpl = (tpl || "").toLowerCase().replace(/[^a-z0-9]/g, '');

                const batch = (this.batches || []).find(b => {
                    const bCls = (b.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    const bTpl = (b.templateName || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    return (bCls === normCls || bCls.includes(normCls) || normCls.includes(bCls)) &&
                           (bTpl === normTpl || bTpl.includes(normTpl) || normTpl.includes(bTpl));
                }) || (this.batches || []).find(b => b.className === cls && b.templateName === tpl);

                if (batch) {
                    const targetPaper = batch.firstPendingPaper || (batch.papers && batch.papers[0]);
                    if (window.app && typeof window.app.showLoadingBox === "function") {
                        window.app.showLoadingBox("Opening Answer Script...", `Opening ${targetPaper?.studentName || 'Student'}'s paper in ${batch.className}...`);
                    }
                    if (targetPaper && this.options.onOpenEvaluation) {
                        this.options.onOpenEvaluation(targetPaper);
                    } else if (targetPaper && window.app) {
                        window.app.openWorkspace(targetPaper);
                    } else if (window.app) {
                        window.app.showToast("No papers found in this batch.", "warning");
                    }
                } else if (window.app) {
                    window.app.showToast("Opening evaluation workspace...", "info");
                }
            });
        });

        // Clear Direct WhatsApp Highlight Button
        const btnClearHighlight = this.container.querySelector("#btn-clear-dash-highlight");
        if (btnClearHighlight) {
            btnClearHighlight.addEventListener("click", () => {
                this.highlightBatchKey = null;
                this.render();
                this.bindEvents();
            });
        }

        // WhatsApp Share from Teacher Desk Batch Card
        this.container.querySelectorAll(".btn-dash-batch-share").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const cls = btn.getAttribute("data-class");
                const tpl = btn.getAttribute("data-template");
                const sub = btn.getAttribute("data-subject") || this.teacherSubject || "Subject";
                const total = btn.getAttribute("data-total");
                const batchKey = `${cls}:::${tpl}`;
                if (window.ShareManager) {
                    window.ShareManager.shareSubject({
                        subject: sub,
                        className: cls,
                        templateName: tpl,
                        paperCount: total,
                        batchKey: batchKey
                    });
                }
            });
        });

        // Smooth scroll shared batch card into view if arriving via direct link
        if (this.highlightBatchKey) {
            setTimeout(() => {
                const targetCard = this.container.querySelector(".teacher-batch-card.active-shared-batch");
                if (targetCard) {
                    targetCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }, 120);
        }

        const btnClearBatch = this.container.querySelector("#btn-clear-batch-filter");
        if (btnClearBatch) {
            btnClearBatch.addEventListener("click", () => {
                this.selectedClassFilter = "all";
                this.applyFilters();
                this.renderTableRows();
                this.updateCountsInUI();
                this.container.querySelectorAll(".teacher-batch-card").forEach(c => c.classList.remove("active"));
                const clsSelect = this.container.querySelector("#dash-filter-class");
                if (clsSelect) clsSelect.value = "all";
                btnClearBatch.remove();
            });
        }

        // Test Me! button for Tamil panel
        this.container.querySelectorAll("#dash-btn-test-me, #btn-batch-test-me, .btn-batch-test-me").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (window.app && typeof window.app.launchTamilTestCorrection === "function") {
                    window.app.launchTamilTestCorrection();
                }
            });
        });

        // Start Correction Queue button (Banner)
        const startBtn = this.container.querySelector("#dash-btn-start-correction");
        if (startBtn) {
            startBtn.addEventListener("click", () => {
                if (window.app && typeof window.app.showLoadingBox === "function") {
                    window.app.showLoadingBox("Opening Answer Script...", "Loading first pending student paper...");
                }
                // Find first uncorrected paper in active scope to open directly
                const targetPool = (this.filteredEvaluations && this.filteredEvaluations.length > 0)
                    ? this.filteredEvaluations
                    : this.getSubjectEvals();
                const uncorrected = targetPool.find(e => !this.isPaperCorrected(e)) || targetPool[0];
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

        // Toolbar Bulk Delete Button
        const toolbarBulkDelete = this.container.querySelector("#dash-btn-bulk-delete");
        if (toolbarBulkDelete) {
            toolbarBulkDelete.addEventListener("click", () => {
                this.showBulkDeleteModal();
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
                if (this.selectedSubjectFilter && this.selectedSubjectFilter !== "all" && this.selectedSubjectFilter !== "All Subjects") {
                    sessionStorage.setItem("niprak_active_subject", this.selectedSubjectFilter);
                }
                this.applyFilters();
                this.renderTableRows();
                if (window.app && typeof window.app.updateUserProfileDisplay === "function") {
                    window.app.updateUserProfileDisplay(this.getActiveSubject(), this.selectedClassFilter !== "all" ? this.selectedClassFilter : null);
                }
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
                    if (window.app && typeof window.app.showLoadingBox === "function") {
                        window.app.showLoadingBox("Opening Answer Script...", "Loading student paper & correction workspace...");
                    }
                    const evaluation = await window.appStorage.getEvaluationById(id);
                    if (evaluation) {
                        if (this.options.onOpenEvaluation) {
                            this.options.onOpenEvaluation(evaluation);
                        } else if (window.app) {
                            window.app.openWorkspace(evaluation);
                        }
                    } else if (window.app && typeof window.app.hideLoadingBox === "function") {
                        window.app.hideLoadingBox();
                    }
                    return;
                }

                // Quick Marks shortcut from Dashboard
                const quickMarksBtn = e.target.closest(".btn-dash-quick-marks");
                if (quickMarksBtn) {
                    const id = quickMarksBtn.getAttribute("data-paper-id");
                    if (window.app && typeof window.app.switchView === "function") {
                        await window.app.switchView("correction-marks");
                        if (window.app.correctionMarksPageManager) {
                            window.app.correctionMarksPageManager.loadPaper(id);
                        }
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
                this.evaluations = await window.appStorage.getAllEvaluations(false, true);
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

    showBulkDeleteModal() {
        const targetIds = Array.from(this.selectedIds);
        if (targetIds.length === 0) {
            if (window.appInstance && window.appInstance.showToast) {
                window.appInstance.showToast("Please select at least one paper using the checkboxes to delete.", "info");
            } else {
                alert("Please select at least one paper using the checkboxes to delete.");
            }
            return;
        }

        const selectedEvals = this.filteredEvaluations.filter(e => targetIds.includes(String(e.id)));
        const count = selectedEvals.length;
        const totalPages = selectedEvals.reduce((sum, e) => sum + (e.pageCount || (e.pages ? e.pages.length : (e.totalPages || 1))), 0);
        const approxKB = totalPages * 350;
        const spaceEstimate = approxKB >= 1024 ? `${(approxKB / 1024).toFixed(1)} MB` : `${approxKB} KB`;

        const modalId = "dash-bulk-delete-modal-overlay";
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
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: #0F172A; margin: 0 0 8px;">Bulk Delete Answer Sheets</h3>
                    <p style="font-size: 0.88rem; color: #64748B; margin: 0 0 18px; line-height: 1.45;">
                        Are you sure you want to permanently delete <strong>${count} selected paper(s)</strong>? This will permanently release browser storage space and remove all associated scores and annotations.
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
                            <span style="font-size: 0.8rem; color: #64748B;">Storage Space Saved:</span>
                            <span style="font-size: 0.85rem; font-weight: 700; color: #16A34A;">~${spaceEstimate}</span>
                        </div>
                    </div>

                    <div id="bulk-delete-progress-bar" style="display: none; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748B; margin-bottom: 4px;">
                            <span id="bulk-delete-status-text">Deleting papers...</span>
                            <span id="bulk-delete-pct-text">0%</span>
                        </div>
                        <div style="height: 6px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                            <div id="bulk-delete-track" style="height: 100%; width: 0%; background: #DC2626; transition: width 0.15s ease;"></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btn-cancel-bulk-delete" style="flex: 1; height: 42px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.15s ease;">
                            Cancel
                        </button>
                        <button type="button" id="btn-confirm-bulk-delete" style="flex: 1; height: 42px; border-radius: 10px; border: none; background: #DC2626; color: #FFFFFF; font-weight: 600; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s ease;">
                            <span id="btn-bulk-delete-text">Delete ${count} Paper(s)</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector("#btn-cancel-bulk-delete");
        const confirmBtn = modal.querySelector("#btn-confirm-bulk-delete");
        const delText = modal.querySelector("#btn-bulk-delete-text");
        const progressBox = modal.querySelector("#bulk-delete-progress-bar");
        const statusText = modal.querySelector("#bulk-delete-status-text");
        const pctText = modal.querySelector("#bulk-delete-pct-text");
        const track = modal.querySelector("#bulk-delete-track");

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
                    console.error("Bulk delete item error:", id, e);
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

            // Refresh UI
            this.evaluations = await window.appStorage.getAllEvaluations(false, true);
            this.applyFilters();
            this.render();
            this.bindEvents();
            if (this.activeBatchKey) {
                this.renderCharts();
            }

            if (window.appInstance && window.appInstance.showToast) {
                window.appInstance.showToast(`Deleted ${deleted} paper(s) to optimize space.`, "success");
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
        if (this.selectedIds && this.selectedIds.size > 0) {
            targets = this.evaluations.filter(e => this.selectedIds.has(String(e.id)));
        } else if (this.filteredEvaluations && this.filteredEvaluations.length > 0) {
            targets = [...this.filteredEvaluations];
        } else if (this.activeBatchKey) {
            const parts = this.activeBatchKey.split(":::");
            const targetCls = (parts[0] || "").toLowerCase().trim();
            const targetTpl = (parts.slice(1).join(":::") || "").toLowerCase().trim();
            const matchedBatch = (this.batches || []).find(b => b.key === this.activeBatchKey);
            if (matchedBatch && matchedBatch.papers && matchedBatch.papers.length > 0) {
                targets = [...matchedBatch.papers];
            } else {
                targets = this.evaluations.filter(e => {
                    const eCls = (e.classLabel || e.className || e.class || "Class 12-A").toLowerCase().trim();
                    const examTitle = (e.examName || e.templateName || "Assessment").toLowerCase().trim();
                    const dateStr = e.examDate ? ` (${e.examDate})`.toLowerCase().trim() : '';
                    const eBatchKey = `${eCls}:::${examTitle}${dateStr}`.trim();
                    if (eBatchKey === this.activeBatchKey.toLowerCase().trim()) return true;

                    const normTargetCls = targetCls.replace(/[^a-z0-9]/g, '');
                    const eClsNorm = eCls.replace(/[^a-z0-9]/g, '');
                    const clsMatch = !normTargetCls || eClsNorm === normTargetCls || eClsNorm.includes(normTargetCls) || normTargetCls.includes(eClsNorm);
                    if (!clsMatch) return false;

                    const normTargetTpl = targetTpl.replace(/[^a-z0-9]/g, '');
                    const normExam = (e.examName || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    const normTpl = (e.templateName || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    return !normTargetTpl || normExam === normTargetTpl || normTpl === normTargetTpl ||
                           (normExam && (normExam.includes(normTargetTpl) || normTargetTpl.includes(normExam))) ||
                           (normTpl && (normTpl.includes(normTargetTpl) || normTargetTpl.includes(normTpl)));
                });
            }
        }

        if (targets.length === 0 && this.evaluations && this.evaluations.length > 0) {
            const activeSub = this.getActiveSubject();
            if (activeSub) {
                targets = this.evaluations.filter(e => window.appStorage.isSubjectMatch(e.subject, e.examName, activeSub, e.templateName));
            } else {
                targets = [...this.evaluations];
            }
        }

        if (targets.length === 0) {
            if (window.appInstance && window.appInstance.showToast) {
                window.appInstance.showToast("No student evaluation records found to export.", "error");
            } else if (window.app && window.app.showToast) {
                window.app.showToast("No student evaluation records found to export.", "error");
            }
            return;
        }

        if (this.options && typeof this.options.onExportExcel === "function") {
            this.options.onExportExcel(targets);
        } else if (window.app && typeof window.app.exportEvaluationsAsExcel === "function") {
            window.app.exportEvaluationsAsExcel(targets);
        } else if (window.appInstance && typeof window.appInstance.exportEvaluationsAsExcel === "function") {
            window.appInstance.exportEvaluationsAsExcel(targets);
        }
    }

    renderCharts() {
        if (!window.Chart) {
            return;
        }

        this.destroyCharts();

        // Only render charts if user has drilled into a batch
        if (!this.activeBatchKey) {
            return;
        }

        const batchEvals = this.filteredEvaluations;

        // 1. Score Distribution Bar Chart
        const scoreDistCanvas = document.getElementById("chart-score-dist");
        if (scoreDistCanvas) {
            const ranges = { "< 50%": 0, "50-69%": 0, "70-84%": 0, "85-100%": 0 };
            batchEvals.forEach(e => {
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
            batchEvals.forEach(e => {
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
            batchEvals.forEach(e => {
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
                            ticks: { font: { family: "-apple-system, system-ui", size: 10, weight: "400" } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        // Attach dynamic ResizeObserver to automatically resize charts when sidebar menu expands or collapses
        const chartsGrid = document.querySelector(".analytics-charts-grid");
        if (chartsGrid && window.ResizeObserver) {
            if (this._chartsResizeObserver) {
                this._chartsResizeObserver.disconnect();
            }
            this._chartsResizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    Object.values(this.charts).forEach(c => {
                        if (c && typeof c.resize === "function") {
                            c.resize();
                        }
                    });
                });
            });
            this._chartsResizeObserver.observe(chartsGrid);
        }
    }
}

window.DashboardManager = DashboardManager;
