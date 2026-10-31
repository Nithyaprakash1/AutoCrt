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

    renderBatchCardHtml(b) {
        const pct = b.total > 0 ? Math.round((b.corrected / b.total) * 100) : 0;
        const isCompleted = b.uncorrected === 0 && b.total > 0;
        const isInProgress = b.corrected > 0 && b.uncorrected > 0;
        const isSharedTarget = Boolean(this.highlightBatchKey && (
            b.key.toLowerCase().trim() === this.highlightBatchKey.toLowerCase().trim() ||
            this.highlightBatchKey.toLowerCase().trim().includes(b.key.toLowerCase().trim()) ||
            (this.highlightBatchKey.toLowerCase().includes(b.className.toLowerCase()) && this.highlightBatchKey.toLowerCase().includes(b.templateName.toLowerCase()))
        ));

        const startButtonText = isCompleted ? 'Review' : 'Start Marking';

        return `
            <div class="teacher-batch-card ${b.isNew ? 'is-new-batch' : ''} ${isCompleted ? 'is-completed-batch' : ''} ${isSharedTarget ? 'active active-shared-batch' : ''}" data-class="${b.className}" data-template="${b.templateName}" data-batch-key="${b.key}">
                <div class="batch-card-top-row">
                    <div class="batch-card-badges-left">
                        <span class="batch-class-badge">${b.className}</span>
                        <span class="batch-subject-tag">${b.subject}</span>
                        ${b.isNew ? `
                            <span class="batch-new-badge">NEW</span>
                        ` : ''}
                        ${isSharedTarget ? `
                            <span class="batch-target-pill">Target</span>
                        ` : ''}
                    </div>
                    <div class="batch-card-status-right">
                        <span class="batch-status-pill ${isCompleted ? 'status-completed' : (isInProgress ? 'status-in-progress' : 'status-pending')}">
                            ${isCompleted ? '✓ Completed' : (isInProgress ? '◐ In Progress' : '○ Pending')}
                        </span>
                    </div>
                </div>

                <div class="batch-card-mid-section">
                    <h4 class="batch-card-title" title="${b.templateName}">${b.templateName}</h4>

                    <div class="batch-card-meta">
                        <div class="meta-item">
                            <span class="meta-bullet bullet-total">○</span>
                            <span class="meta-count">${b.total} Papers</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-bullet bullet-corrected">●</span>
                            <span class="meta-count text-green">${b.corrected} Corrected</span>
                        </div>
                        ${b.uncorrected > 0 ? `
                            <div class="meta-item">
                                <span class="meta-bullet bullet-pending">●</span>
                                <span class="meta-count text-amber">${b.uncorrected} Pending</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="batch-actions-row">
                    <button type="button" class="btn-batch-view" data-class="${b.className}" data-template="${b.templateName}" data-batch-key="${b.key}" title="Open papers in this batch">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <span>View Papers (${b.total})</span>
                    </button>
                    <button type="button" class="btn-batch-start" data-class="${b.className}" data-template="${b.templateName}" data-batch-key="${b.key}" title="Start correcting papers in this batch">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>${startButtonText}</span>
                    </button>
                    ${b.subject && b.subject.toLowerCase().includes('tamil') ? `
                        <button type="button" class="btn-batch-view btn-batch-test-me" data-class="${b.className}" data-template="${b.templateName}" data-batch-key="${b.key}" title="Test correct a sample Tamil paper">
                            ✍️ Test Me!
                        </button>
                    ` : ''}
                    <button type="button" class="btn-batch-share btn-dash-batch-share" data-class="${b.className}" data-template="${b.templateName}" data-batch-key="${b.key}" data-subject="${b.subject}" data-total="${b.total}" title="Share this batch via WhatsApp">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        <span>Share</span>
                    </button>
                </div>
            </div>
        `;
    }

    async init() {
        if (!this.container) return;
        this.evaluations = await window.appStorage.getAllEvaluations(false, true);

        // Check if uploader just published a new batch of papers
        const lastCls = sessionStorage.getItem("niprak_last_uploaded_class");
        const lastSub = sessionStorage.getItem("niprak_last_uploaded_subject");
        const lastBatch = sessionStorage.getItem("niprak_last_uploaded_batch");
        if (lastSub) {
            this.selectedSubjectFilter = lastSub;
            sessionStorage.removeItem("niprak_last_uploaded_subject");
        }
        if (lastCls) {
            sessionStorage.removeItem("niprak_last_uploaded_class");
        }
        if (lastBatch) {
            this.highlightBatchKey = lastBatch;
            sessionStorage.removeItem("niprak_last_uploaded_batch");
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

            this.teacherName = user.name || (isTeacher ? "Faculty Evaluator" : "User");
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

        // Evaluator / Teacher desk defaults to assigned subject panel
        const sessSub = sessionStorage.getItem("niprak_active_subject");
        if (isTeacher) {
            const primarySub = (this.teacherSubject && this.teacherSubject !== "all" && this.teacherSubject !== "All Subjects")
                ? this.teacherSubject
                : (this.teacherSubjects && this.teacherSubjects.find(s => s && s !== "all" && s !== "All Subjects"));

            // Check if sessSub is genuinely one of this teacher's assigned subjects
            const isAssigned = sessSub && sessSub !== "all" && sessSub !== "All Subjects" &&
                this.teacherSubjects && this.teacherSubjects.some(s => window.appStorage ? window.appStorage.isSubjectMatch(s, "", sessSub, "") : s.toLowerCase() === sessSub.toLowerCase());

            if (isAssigned) {
                this.selectedSubjectFilter = sessSub;
            } else if (primarySub && (!this.teacherSubjects || this.teacherSubjects.length <= 1)) {
                this.selectedSubjectFilter = primarySub;
                try { sessionStorage.setItem("niprak_active_subject", primarySub); } catch (e) {}
            } else {
                this.selectedSubjectFilter = "all";
            }
        } else {
            // Admin or Uploader desk: can use sessSub if present, otherwise default to all
            if (sessSub && sessSub !== "all" && sessSub !== "All Subjects" && (!this.selectedSubjectFilter || this.selectedSubjectFilter === "all")) {
                this.selectedSubjectFilter = sessSub;
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

        // Background Cloud Sync & Realtime Cross-Device Listener
        if (!this._cloudSyncListenerAttached) {
            this._cloudSyncListenerAttached = true;
            window.addEventListener("niprak-evaluations-cloud-synced", async () => {
                if (!this.container || !document.body.contains(this.container)) return;
                const viewDash = document.getElementById("view-dashboard");
                if (viewDash && !viewDash.classList.contains("active-view")) return;

                this.evaluations = await window.appStorage.getAllEvaluations(false, true);
                this.applyFilters();
                if (!this.activeBatchKey) {
                    this.render();
                    this.bindEvents();
                } else {
                    this.renderTableRows();
                    this.updateCountsInUI();
                }
            });
        }

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
        if (e.status === "Completed" || e.status === "Corrected" || e.status === "Graded" || e.status === "Evaluated") {
            return true;
        }
        if (Array.isArray(e.questions) && e.questions.length > 0) {
            const hasUnmarked = e.questions.some(q => !q.status || q.status === "unmarked" || q.status === "pending");
            if (!hasUnmarked) return true;
        }
        return false;
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

        const user = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        if (isTeacher && Array.isArray(this.teacherSubjects) && this.teacherSubjects.length > 0 && !this.teacherSubjects.includes("All Subjects")) {
            return this.evaluations.filter(e => this.teacherSubjects.some(s => window.appStorage.isSubjectMatch(e.subject, e.examName, s, e.templateName)));
        }

        if (this.teacherSubject && this.teacherSubject !== 'all' && this.teacherSubject !== 'All Subjects') {
            return this.evaluations.filter(e => window.appStorage.isSubjectMatch(e.subject, e.examName, this.teacherSubject, e.templateName));
        }

        return this.evaluations;
    }

    applyFilters() {
        const user = window.appStorage.getCurrentUser();
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        const activeSub = this.getActiveSubject();

        // Active Batch filter: When drilled down into a specific batch card, base evaluations MUST come from this batch
        if (this.activeBatchKey) {
            let matchedBatch = null;
            if (this.batches && this.batches.length > 0) {
                const parts = this.activeBatchKey.split(":::");
                const targetCls = (parts[0] || "").toLowerCase().trim();
                const targetTpl = (parts.slice(1).join(":::") || "").toLowerCase().trim();
                matchedBatch = this.batches.find(b => b.key === this.activeBatchKey ||
                    (b.className && b.className.toLowerCase().trim() === targetCls && b.templateName && b.templateName.toLowerCase().trim() === targetTpl));
            }

            let baseList = [];
            if (matchedBatch && Array.isArray(matchedBatch.papers)) {
                // Direct membership: matchedBatch is the authoritative ground truth for this card
                baseList = matchedBatch.papers;
            } else {
                // Fallback when this.batches is not yet computed
                const parts = this.activeBatchKey.split(":::");
                const targetCls = (parts[0] || "").toLowerCase().trim();
                const targetTpl = (parts.slice(1).join(":::") || "").toLowerCase().trim();
                baseList = this.evaluations.filter(e => {
                    const rawCls = (e.classLabel || e.className || e.class || "Class 12-A");
                    const eCls = (window.appStorage && typeof window.appStorage.canonicalizeClassName === "function")
                        ? window.appStorage.canonicalizeClassName(rawCls).toLowerCase().trim()
                        : rawCls.toLowerCase().trim();
                    const examTitle = (e.examName || e.templateName || "Assessment").toLowerCase().trim().replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/g, '');
                    const eBatchKey = `${eCls}:::${examTitle}`;

                    if (eBatchKey === this.activeBatchKey.toLowerCase().trim()) return true;

                    const normTargetCls = targetCls.replace(/[^a-z0-9]/g, '');
                    const eClsNorm = (e.class || e.className || e.classLabel || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normTargetCls && eClsNorm !== normTargetCls) return false;

                    const targetTplBase = targetTpl.replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');
                    const eExamBase = examTitle.replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');
                    const eTplBase = (e.templateName || "").toLowerCase().replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');

                    return Boolean(targetTplBase && (eExamBase === targetTplBase || eTplBase === targetTplBase));
                });
            }

            // Filter this batch's papers ONLY by status tab ('all', 'uncorrected', 'corrected') and search query
            this.filteredEvaluations = baseList.filter(e => {
                const isCorr = this.isPaperCorrected(e);
                if (this.activeTab === "uncorrected" && isCorr) return false;
                if (this.activeTab === "corrected" && !isCorr) return false;

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
            return;
        }

        this.filteredEvaluations = this.evaluations.filter(e => {
            const isCorr = this.isPaperCorrected(e);

            // 0. Subject Isolation: If viewing a particular subject panel, strictly show that subject's papers alone!
            if (activeSub && activeSub !== 'all' && activeSub !== 'All Subjects') {
                const subMatch = window.appStorage.isSubjectMatch(e.subject, e.examName, activeSub, e.templateName);
                if (!subMatch) return false;
            } else if (isTeacher && this.teacherSubjects && this.teacherSubjects.length > 0 && !this.teacherSubjects.includes("All Subjects")) {
                const matches = this.teacherSubjects.some(s => window.appStorage.isSubjectMatch(e.subject, e.examName, s, e.templateName));
                if (!matches) return false;
            } else if (this.teacherSubject && this.teacherSubject !== 'all' && this.teacherSubject !== 'All Subjects') {
                const subMatch = window.appStorage.isSubjectMatch(e.subject, e.examName, this.teacherSubject, e.templateName);
                if (!subMatch) return false;
            }

            // 1. Status Tab filter
            if (this.activeTab === "uncorrected" && isCorr) return false;
            if (this.activeTab === "corrected" && !isCorr) return false;

            // 2. Class filter (flexible matching when on overview)
            if (this.selectedClassFilter && this.selectedClassFilter !== "all") {
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
        let displayName = this.teacherName || (user?.name || "Teacher");

        // Active panel subject: isolate cards & papers to that specific subject desk if explicitly selected
        const activePanelSubject = (activeSub && activeSub !== 'all' && activeSub !== 'All Subjects')
            ? activeSub
            : ((this.selectedSubjectFilter && this.selectedSubjectFilter !== 'all' && this.selectedSubjectFilter !== 'All Subjects') ? this.selectedSubjectFilter : null);

        // Compute Class & Template Batches for Teacher Desk:
        let evalsForBatches = subjectEvals;
        if (activePanelSubject) {
            evalsForBatches = this.evaluations.filter(e => window.appStorage.isSubjectMatch(e.subject, e.examName, activePanelSubject, e.templateName));
        } else if (isTeacher && this.teacherSubjects && this.teacherSubjects.length > 0 && !this.teacherSubjects.includes("All Subjects")) {
            evalsForBatches = this.evaluations.filter(e => this.teacherSubjects.some(s => window.appStorage.isSubjectMatch(e.subject, e.examName, s, e.templateName)));
        }

        if (isTeacher && this.teacherClasses && this.teacherClasses.length > 0 && !this.teacherClasses.includes("All Classes") && !this.teacherClasses.includes("all")) {
            evalsForBatches = evalsForBatches.filter(e => {
                // User-uploaded real answer scripts of authorized subjects are not blocked by class mismatch
                if (e.isUserUploaded || (!e.isMock && (e.uploadedAt || e.pdfDataUrl || e.pdfStorageUrl || (e.pages && e.pages.length > 0)))) {
                    return true;
                }
                const rawCls = (e.class || e.className || e.classLabel || "");
                const eCls = rawCls.toLowerCase().replace(/[^a-z0-9]/g, '');
                return this.teacherClasses.some(tc => {
                    const normTc = tc.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (!normTc || eCls === normTc || (normTc && eCls.includes(normTc)) || (eCls && normTc.includes(eCls))) return true;
                    // Grade number matching: e.g. "10" matches "Class 10-A", "Class 10" matches "10-A"
                    const numTc = normTc.match(/\d+/)?.[0];
                    const numCls = eCls.match(/\d+/)?.[0];
                    if (numTc && numCls && numTc === numCls) {
                        const secTc = normTc.replace(/\d+/g, '').replace('class', '').replace('grade', '');
                        const secCls = eCls.replace(/\d+/g, '').replace('class', '').replace('grade', '');
                        if (!secTc || !secCls || secTc === secCls) return true;
                    }
                    return false;
                });
            });
        }

        const batchMap = new Map();
        evalsForBatches.forEach(e => {
            const rawCls = e.classLabel || e.className || e.class || "Class 12-A";
            const cls = (window.appStorage && typeof window.appStorage.canonicalizeClassName === "function")
                ? window.appStorage.canonicalizeClassName(rawCls)
                : rawCls;
            const sub = e.subject || activePanelSubject || displaySubject;
            const rawExamTitle = (e.examName || e.templateName || "Assessment").trim();
            // Ignore minor date divergence in exam name so papers for the same exam never split into multiple cards
            const examTitle = rawExamTitle.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/g, '').trim();
            const batchKey = `${cls}:::${examTitle}`;
            if (!batchMap.has(batchKey)) {
                batchMap.set(batchKey, {
                    key: batchKey,
                    className: cls,
                    templateName: examTitle,
                    examName: examTitle,
                    examDate: e.examDate || '',
                    subject: sub,
                    papers: [],
                    studentMap: new Map(),
                    total: 0,
                    corrected: 0,
                    uncorrected: 0,
                    maxMarks: e.maxMarks || 40,
                    firstPendingPaper: null,
                    latestTimestamp: 0
                });
            }
            const b = batchMap.get(batchKey);
            // Deduplicate exact duplicate uploads for the same student inside the batch, prioritizing graded copy with marks
            const sKey = (e.rollNo ? String(e.rollNo).trim().toLowerCase() : '') || (e.studentName ? String(e.studentName).trim().toLowerCase() : String(e.id));
            if (b.studentMap.has(sKey)) {
                const existing = b.studentMap.get(sKey);
                const existingScore = Number(existing.obtainedMarks) || 0;
                const newScore = Number(e.obtainedMarks) || 0;
                const existingIsDone = existing.status === 'Completed' || existingScore > 0;
                const newIsDone = e.status === 'Completed' || newScore > 0;
                if (!existingIsDone && newIsDone) {
                    const idx = b.papers.findIndex(p => String(p.id) === String(existing.id));
                    if (idx >= 0) b.papers[idx] = e;
                    b.studentMap.set(sKey, e);
                }
            } else {
                b.studentMap.set(sKey, e);
                b.papers.push(e);
            }
            if (!b.examDate && e.examDate) b.examDate = e.examDate;
            const pTime = new Date(e.createdAt || e.uploadedAt || e.timestamp || e.lastUpdated || 0).getTime();
            if (pTime > b.latestTimestamp) b.latestTimestamp = pTime;
        });
        const now = Date.now();
        let catalogTpls = [];
        try {
            if (window.appStorage && typeof window.appStorage.getSubjectCatalog === 'function') {
                const cat = window.appStorage.getSubjectCatalog() || {};
                Object.values(cat).forEach(subItem => {
                    const tList = subItem?.templates || (Array.isArray(subItem) ? subItem : []);
                    if (Array.isArray(tList)) {
                        tList.forEach(t => {
                            if (t && t.isNew) catalogTpls.push(t);
                        });
                    }
                });
            }
        } catch (_) {}

        this.batches = Array.from(batchMap.values()).map(b => {
            b.total = b.papers.length;
            b.corrected = b.papers.filter(p => this.isPaperCorrected(p)).length;
            b.uncorrected = b.total - b.corrected;
            b.firstPendingPaper = b.papers.find(p => !this.isPaperCorrected(p)) || null;
            // 7-day recency window for newly uploaded batches
            const isRecent = b.latestTimestamp > 0 && (now - b.latestTimestamp < 7 * 24 * 60 * 60 * 1000);
            const matchesNewTpl = catalogTpls.some(t => {
                const name = (t.name || t.examName || '').toLowerCase().trim();
                const bName = (b.templateName || b.examName || '').toLowerCase().trim();
                return name && bName && (name === bName || bName.includes(name) || name.includes(bName));
            });
            // Card stays marked NEW while it has pending papers to correct
            b.isNew = (matchesNewTpl || isRecent) && b.uncorrected > 0;
            b.isCompletelyNew = b.isNew && b.corrected === 0;
            return b;
        });

        if (activePanelSubject) {
            this.batches = this.batches.filter(b => window.appStorage.isSubjectMatch(b.subject, b.templateName, activePanelSubject, b.templateName));
        }

        // Global sort: Newly uploaded templates/batches FIRST!
        this.batches.sort((a, b) => {
            if (this.highlightBatchKey) {
                const hKey = this.highlightBatchKey.toLowerCase().trim();
                const aMatch = a.key.toLowerCase().trim() === hKey || hKey.includes(a.key.toLowerCase().trim()) ||
                               (hKey.includes(a.className.toLowerCase()) && hKey.includes(a.templateName.toLowerCase()));
                const bMatch = b.key.toLowerCase().trim() === hKey || hKey.includes(b.key.toLowerCase().trim()) ||
                               (hKey.includes(b.className.toLowerCase()) && hKey.includes(b.templateName.toLowerCase()));
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
            }

            // 1. Completely untouched new templates first
            const aCompNew = Boolean(a.isCompletelyNew);
            const bCompNew = Boolean(b.isCompletelyNew);
            if (aCompNew !== bCompNew) return aCompNew ? -1 : 1;

            // 2. Any new template (in progress)
            const aIsNew = Boolean(a.isNew);
            const bIsNew = Boolean(b.isNew);
            if (aIsNew !== bIsNew) return aIsNew ? -1 : 1;

            // 3. Batches with pending papers before fully completed ones
            const aPending = a.uncorrected > 0;
            const bPending = b.uncorrected > 0;
            if (aPending !== bPending) return aPending ? -1 : 1;

            // 4. Latest upload timestamp first (LIFO)
            const tsA = a.latestTimestamp || 0;
            const tsB = b.latestTimestamp || 0;
            if (tsA !== tsB) return tsB - tsA;

            return (a.templateName || "").localeCompare(b.templateName || "");
        });

        // Distinct classes for filter pills: Canonicalize, deduplicate and ensure count > 0
        const activeClassesList = (this.teacherClasses && this.teacherClasses.length > 0)
            ? this.teacherClasses.filter(c => c && c.toLowerCase() !== 'all classes' && c.toLowerCase() !== 'all')
            : [];
        const activeSubjectsList = (this.teacherSubjects && this.teacherSubjects.length > 0)
            ? this.teacherSubjects.filter(s => s && s.toLowerCase() !== 'all subjects' && s.toLowerCase() !== 'all')
            : [];

        const classBatchCountMap = new Map();
        this.batches.forEach(b => {
            const rawCls = b.className || "Class 12-A";
            const canonCls = (window.appStorage && typeof window.appStorage.canonicalizeClassName === "function")
                ? window.appStorage.canonicalizeClassName(rawCls)
                : rawCls;
            b.className = canonCls;
            classBatchCountMap.set(canonCls, (classBatchCountMap.get(canonCls) || 0) + 1);
        });

        const distinctBatchClasses = Array.from(classBatchCountMap.keys()).sort((a, b) => {
            const na = this.getGradeLevel(a);
            const nb = this.getGradeLevel(b);
            if (na !== nb) return na - nb; // 10th first, then 11th, then 12th
            const secA = this.getSectionLetter(a);
            const secB = this.getSectionLetter(b);
            if (secA !== secB) return secA.localeCompare(secB); // A, then B, then C
            return a.localeCompare(b);
        });

        // Distinct subjects for filter pills: Canonicalize, deduplicate and ensure count > 0
        const subjectBatchCountMap = new Map();
        this.batches.forEach(b => {
            let sub = (b.subject || "General").trim();
            if (window.appStorage && typeof window.appStorage.isSubjectMatch === "function") {
                const matchedAssigned = (this.teacherSubjects || []).find(ts => window.appStorage.isSubjectMatch(sub, "", ts, ""));
                if (matchedAssigned) sub = matchedAssigned;
            }
            b.subject = sub;
            subjectBatchCountMap.set(sub, (subjectBatchCountMap.get(sub) || 0) + 1);
        });

        const distinctBatchSubjects = Array.from(subjectBatchCountMap.keys()).sort();

        // Safety reset filters if previously selected class or subject no longer exists in available batches
        if (this.selectedClassFilter && this.selectedClassFilter !== "all") {
            const hasMatch = distinctBatchClasses.some(c => c.toLowerCase().replace(/[^a-z0-9]/g, '') === this.selectedClassFilter.toLowerCase().replace(/[^a-z0-9]/g, ''));
            if (!hasMatch) this.selectedClassFilter = "all";
        }
        if (this.selectedSubjectFilter && this.selectedSubjectFilter !== "all" && this.selectedSubjectFilter !== "All Subjects") {
            const hasMatch = distinctBatchSubjects.some(s => window.appStorage.isSubjectMatch(s, "", this.selectedSubjectFilter, ""));
            if (!hasMatch) this.selectedSubjectFilter = "all";
        }

        // Filter batches by selected class & subject filter pills
        let displayBatches = this.batches;
        if (this.selectedClassFilter && this.selectedClassFilter !== "all") {
            const targetNorm = this.selectedClassFilter.toLowerCase().replace(/[^a-z0-9]/g, '');
            displayBatches = displayBatches.filter(b => {
                const bNorm = (b.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                if (bNorm === targetNorm || (targetNorm && bNorm.includes(targetNorm)) || (bNorm && targetNorm.includes(bNorm))) return true;
                const numTarget = targetNorm.match(/\d+/)?.[0];
                const numB = bNorm.match(/\d+/)?.[0];
                return Boolean(numTarget && numB && numTarget === numB);
            });
        }
        if (this.selectedSubjectFilter && this.selectedSubjectFilter !== "all" && this.selectedSubjectFilter !== "All Subjects") {
            displayBatches = displayBatches.filter(b => window.appStorage.isSubjectMatch(b.subject, b.templateName, this.selectedSubjectFilter, b.templateName));
        }

        // Check if currently viewing Tamil desk
        const isTamilDesk = (displaySubject && displaySubject.toLowerCase().includes('tamil')) ||
            (this.teacherSubject && this.teacherSubject.toLowerCase().includes('tamil')) ||
            teacherAssigned.some(s => s && s.toLowerCase().includes('tamil'));

        // Welcome Headline with Subject & Class Display
        const canonicalClasses = Array.from(new Set(activeClassesList.map(c => window.appStorage ? window.appStorage.canonicalizeClassName(c) : c)));
        const displayClasses = canonicalClasses.join(', ');
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
                    <!-- Dashboard Header Banner -->
                    <div class="dashboard-welcome-banner">
                        <div class="welcome-header-left">
                            <div class="welcome-avatar-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                </svg>
                            </div>
                            <div class="welcome-text-col">
                                <span class="welcome-greeting">${greetingStr}, ${displayName}! 👋</span>
                                <h2 class="welcome-headline">${welcomeHeadline}</h2>
                                <p class="welcome-sub">Share, review and manage question papers, classes, and student evaluations. Class-wise breakdown, subject-wise progress, and more — all in one place.</p>
                                <div class="welcome-allocation-tags">
                                    <div class="allocation-chip chip-subjects">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0878F9" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                        <span class="chip-badge-label text-blue">AUTHORIZED SUBJECTS</span>
                                        <span class="chip-badge-val">${activeSubjectsList.length > 0 ? activeSubjectsList.join(', ') : 'All Subjects'}</span>
                                    </div>
                                    <div class="allocation-chip chip-classes">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                        <span class="chip-badge-label text-green">ASSIGNED CLASSES</span>
                                        <span class="chip-badge-val">${activeClassesList.length > 0 ? activeClassesList.slice(0, 3).join(', ') + (activeClassesList.length > 3 ? ` + ${activeClassesList.length - 3}` : '') : 'All Classes'}</span>
                                        <span class="chip-chevron">▾</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="welcome-action-col">
                            ${isTamilDesk ? `
                                <button type="button" class="btn-primary btn-large btn-tamil-test-me" id="dash-btn-test-me" title="Test correct a sample Tamil paper with the 40-mark blueprint">
                                    <span class="btn-icon">✍️</span> Test Me!
                                </button>
                            ` : ''}
                            <button type="button" class="btn-secondary btn-clean-duplicates" id="dash-btn-clean-duplicates-top" title="Scan and safely remove duplicate student papers, keeping original copies">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                <span>Clean Duplicates</span>
                            </button>
                            <button type="button" class="btn-secondary btn-sync-cloud" id="dash-btn-cloud-sync" title="Sync papers with cloud in real time">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                <span>Sync Cloud</span>
                            </button>
                            <button type="button" class="btn-primary btn-start-correction" id="dash-btn-start-correction" title="Open first pending paper to evaluate">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                <span>Start Correction</span>
                            </button>
                        </div>
                    </div>

                    <!-- Statistics Cards (4 Horizontal Cards) -->
                    <div class="kpi-grid">
                        <div class="kpi-card kpi-uncorrected-highlight" id="card-tab-uncorrected" title="Uncorrected Papers">
                            <div class="kpi-card-header">
                                <div class="kpi-icon-wrap kpi-icon-pending">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                <span class="counter-badge badge-pending">${uncorrectedCount} UNCORRECTED ›</span>
                            </div>
                            <div class="kpi-card-body">
                                <span class="kpi-value">${uncorrectedCount}</span>
                                <span class="kpi-title">PAPERS FOR EVALUATION</span>
                            </div>
                            <span class="kpi-card-chevron">›</span>
                        </div>

                        <div class="kpi-card kpi-corrected-highlight" id="card-tab-corrected" title="Corrected Papers">
                            <div class="kpi-card-header">
                                <div class="kpi-icon-wrap kpi-icon-graded">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                                <span class="counter-badge badge-graded">${correctedCount} GRADED</span>
                            </div>
                            <div class="kpi-card-body">
                                <span class="kpi-value">${correctedCount}</span>
                                <span class="kpi-title">CORRECTED PAPERS</span>
                            </div>
                            <span class="kpi-card-chevron">›</span>
                        </div>

                        <div class="kpi-card" id="card-tab-all" title="Total Papers">
                            <div class="kpi-card-header">
                                <div class="kpi-icon-wrap kpi-icon-total">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0878F9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <span class="counter-badge badge-total">TOTAL</span>
                            </div>
                            <div class="kpi-card-body">
                                <span class="kpi-value">${totalCount}</span>
                                <span class="kpi-title">TOTAL ASSIGNED</span>
                            </div>
                            <span class="kpi-card-chevron">›</span>
                        </div>

                        <div class="kpi-card" id="card-tab-performance" title="Average Performance">
                            <div class="kpi-card-header">
                                <div class="kpi-icon-wrap kpi-icon-perf">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EC4899" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                                </div>
                                <span class="counter-badge badge-perf">EVALUATED</span>
                            </div>
                            <div class="kpi-card-body">
                                <span class="kpi-value">${avgScorePct}%</span>
                                <span class="kpi-title">AVERAGE PERFORMANCE</span>
                            </div>
                            <span class="kpi-card-chevron">›</span>
                        </div>
                    </div>

                    <!-- Class & Exam Blueprint Batches Section -->
                    <div class="teacher-batches-section" id="teacher-batches-section">
                        <div class="teacher-batches-header">
                            <div class="teacher-batches-title-col">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div class="batches-section-icon-wrap">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0878F9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
                                    </div>
                                    <h3 class="teacher-batches-title">
                                        Class & Exam Blueprint Batches
                                        <span class="teacher-batches-count-pill">${displayBatches.length} ${displayBatches.length === 1 ? 'Batch' : 'Batches'}</span>
                                    </h3>
                                </div>
                                <p class="teacher-batches-desc">Click any card to view its student answer sheets or start marking directly.</p>
                                
                                ${distinctBatchClasses.length > 1 ? `
                                    <div class="dash-class-pills-bar">
                                        <span class="filter-pills-label">Classes:</span>
                                        <button type="button" class="btn-dash-class-pill ${this.selectedClassFilter === 'all' ? 'active' : ''}" data-class="all">
                                            All Classes (${this.batches.length})
                                        </button>
                                        ${distinctBatchClasses.map(clsName => {
                                            const countForCls = classBatchCountMap.get(clsName) || 0;
                                            const isAct = this.selectedClassFilter === clsName ||
                                                (this.selectedClassFilter && this.selectedClassFilter.toLowerCase().replace(/[^a-z0-9]/g, '') === clsName.toLowerCase().replace(/[^a-z0-9]/g, ''));
                                            return `
                                                <button type="button" class="btn-dash-class-pill ${isAct ? 'active' : ''}" data-class="${clsName}">
                                                    ${clsName} (${countForCls})
                                                </button>
                                            `;
                                        }).join('')}
                                    </div>
                                ` : ''}

                                ${distinctBatchSubjects.length > 1 ? `
                                    <div class="dash-subject-pills-bar">
                                        <span class="filter-pills-label">Subjects:</span>
                                        <button type="button" class="btn-dash-subject-pill ${(!this.selectedSubjectFilter || this.selectedSubjectFilter === 'all') ? 'active' : ''}" data-subject="all">
                                            All Subjects (${this.batches.length})
                                        </button>
                                        ${distinctBatchSubjects.map(subName => {
                                            const countForSub = subjectBatchCountMap.get(subName) || 0;
                                            const isAct = this.selectedSubjectFilter === subName ||
                                                (window.appStorage && window.appStorage.isSubjectMatch(subName, "", this.selectedSubjectFilter, ""));
                                            return `
                                                <button type="button" class="btn-dash-subject-pill ${isAct ? 'active' : ''}" data-subject="${subName}">
                                                    ${subName} (${countForSub})
                                                </button>
                                            `;
                                        }).join('')}
                                    </div>
                                ` : ''}
                            </div>
                            ${this.highlightBatchKey ? `
                                <button type="button" class="btn-admin-clear-batch" id="btn-clear-dash-highlight">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    <span>Focus: ${this.highlightBatchKey.replace(':::', ' • ')} (Clear)</span>
                                </button>
                            ` : ''}
                        </div>

                        <div class="teacher-batches-grouped-container">
                            ${(() => {
                                if (displayBatches.length === 0) {
                                    return `
                                        <div class="teacher-batches-empty">
                                            <p>No exam batches found for ${this.selectedClassFilter !== 'all' ? this.selectedClassFilter : displaySubject}.</p>
                                        </div>
                                    `;
                                }

                                // 1. Identify Newly Uploaded Templates to feature right at the top
                                const newBatches = displayBatches.filter(b => b.isNew || (b.latestTimestamp > 0 && (now - b.latestTimestamp < 7 * 24 * 60 * 60 * 1000) && b.uncorrected > 0));

                                const newSectionHtml = (newBatches.length > 0 && this.selectedClassFilter === 'all') ? `
                                    <div class="dash-new-templates-section" style="margin-bottom: 24px; padding: 18px 20px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%); border: 1.5px solid rgba(16, 185, 129, 0.35); border-radius: 16px; box-shadow: 0 4px 18px rgba(16, 185, 129, 0.08);">
                                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="font-size: 1.25rem;">✨</span>
                                                <h4 style="font-size: 0.95rem; font-weight: 700; color: #065F46; margin: 0; display: flex; align-items: center; gap: 8px;">
                                                    Newly Uploaded Templates & Exams
                                                    <span style="background: #10B981; color: white; font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.03em;">
                                                        ${newBatches.length} NEW
                                                    </span>
                                                </h4>
                                            </div>
                                            <span style="font-size: 0.78rem; color: #047857; font-weight: 500;">Recently uploaded answer sheets ready for your evaluation</span>
                                        </div>
                                        <div class="teacher-batches-grid">
                                            ${newBatches.map(b => this.renderBatchCardHtml(b)).join('')}
                                        </div>
                                    </div>
                                ` : '';

                                // Group batches by Grade Level
                                const gradeGroupsMap = new Map();
                                displayBatches.forEach(b => {
                                    const g = this.getGradeLevel(b.className);
                                    if (!gradeGroupsMap.has(g)) gradeGroupsMap.set(g, []);
                                    gradeGroupsMap.get(g).push(b);
                                });

                                // Sorted grades: grades with new templates first, then 10th, 12th, 11th, others
                                const sortedGrades = Array.from(gradeGroupsMap.keys()).sort((a, b) => {
                                    const aHasNew = (gradeGroupsMap.get(a) || []).some(item => item.isNew);
                                    const bHasNew = (gradeGroupsMap.get(b) || []).some(item => item.isNew);
                                    if (aHasNew !== bHasNew) return aHasNew ? -1 : 1;

                                    const order = { 10: 1, 12: 2, 11: 3, 99: 4 };
                                    const ordA = order[a] !== undefined ? order[a] : (a < 10 ? 0 : 5);
                                    const ordB = order[b] !== undefined ? order[b] : (b < 10 ? 0 : 5);
                                    return ordA - ordB;
                                });

                                const gradeSectionsHtml = sortedGrades.map(gKey => {
                                    const gBatches = gradeGroupsMap.get(gKey) || [];
                                    if (gBatches.length === 0) return '';

                                    // Sort batches within grade:
                                    // 1. Newly added / untouched templates first!
                                    // 2. Latest uploaded timestamp (LIFO)
                                    // 3. Batches with pending papers before completed
                                    // 4. Section letters (A, B, C)
                                    gBatches.sort((a, b) => {
                                        const aCompNew = Boolean(a.isCompletelyNew);
                                        const bCompNew = Boolean(b.isCompletelyNew);
                                        if (aCompNew !== bCompNew) return aCompNew ? -1 : 1;

                                        const aIsNew = Boolean(a.isNew);
                                        const bIsNew = Boolean(b.isNew);
                                        if (aIsNew !== bIsNew) return aIsNew ? -1 : 1;

                                        const tsA = a.latestTimestamp || 0;
                                        const tsB = b.latestTimestamp || 0;
                                        if (tsA !== tsB) return tsB - tsA;

                                        const aPending = a.uncorrected > 0;
                                        const bPending = b.uncorrected > 0;
                                        if (aPending !== bPending) return aPending ? -1 : 1;

                                        const secA = this.getSectionLetter(a.className);
                                        const secB = this.getSectionLetter(b.className);
                                        if (secA !== secB) return secA.localeCompare(secB);

                                        return (a.templateName || "").localeCompare(b.templateName || "");
                                    });

                                    const gradeTitle = gKey === 10 ? 'Class 10th (Grade X)' : (gKey === 12 ? 'Class 12th (Grade XII)' : (gKey === 11 ? 'Class 11th (Grade XI)' : `Grade ${gKey}`));
                                    const totalPapersInGrade = gBatches.reduce((sum, b) => sum + b.total, 0);
                                    const totalPendingInGrade = gBatches.reduce((sum, b) => sum + b.uncorrected, 0);
                                    const isCollapsed = this.collapsedGradeGroups ? this.collapsedGradeGroups.has(gKey) : false;

                                    return `
                                        <div class="dash-grade-group-section ${isCollapsed ? 'is-collapsed' : ''}" data-grade="${gKey}">
                                            <div class="dash-grade-header" data-grade="${gKey}">
                                                <div class="dash-grade-header-left">
                                                    <span class="grade-number-badge">${gKey}</span>
                                                    <h4 class="grade-title-text">${gradeTitle}</h4>
                                                    <div class="grade-badges-wrap">
                                                        <span class="grade-badge-batches">
                                                            ${gBatches.length} ${gBatches.length === 1 ? 'Batch' : 'Batches'}
                                                        </span>
                                                        <span class="grade-badge-papers">
                                                            ${totalPapersInGrade} Papers
                                                        </span>
                                                        ${totalPendingInGrade > 0 ? `
                                                            <span class="grade-badge-pending">
                                                                ${totalPendingInGrade} Pending
                                                            </span>
                                                        ` : `
                                                            <span class="grade-badge-completed">
                                                                ✓ All Graded
                                                            </span>
                                                        `}
                                                    </div>
                                                </div>
                                                <div class="dash-grade-header-right">
                                                    <span class="grade-toggle-text">${isCollapsed ? 'Expand' : 'Collapse'}</span>
                                                    <span class="grade-toggle-chevron">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                                                    </span>
                                                </div>
                                            </div>

                                            <div class="dash-grade-batches-body ${isCollapsed ? 'is-collapsed' : ''}">
                                                <div class="teacher-batches-grid">
                                                    ${gBatches.map(b => this.renderBatchCardHtml(b)).join('')}
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('');

                                return newSectionHtml + gradeSectionsHtml;
                            })()}
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

                            <button type="button" class="btn-secondary btn-clean-duplicates" id="dash-btn-clean-duplicates-table" title="Scan and safely remove duplicate student papers, keeping original copies" style="background: #FFFFFF; border: 1.5px solid #64748B; color: #334155; font-size: 0.84rem; font-weight: 400 !important; height: 38px; padding: 0 14px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;">
                                <span class="btn-icon" style="display: flex; align-items: center;">🧹</span> Clean Duplicates
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
                <tr class="${isChecked ? 'row-selected' : ''} ${isCompleted ? 'row-paper-completed' : ''}" style="${isChecked ? 'background-color: rgba(0, 122, 255, 0.04);' : ''}">
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
        // Class filter pills in Batches section
        this.container.querySelectorAll(".btn-dash-class-pill").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const cls = btn.getAttribute("data-class") || "all";
                this.selectedClassFilter = cls;
                this.applyFilters();
                this.render();
                this.bindEvents();
            });
        });

        // Subject filter pills in Batches section
        this.container.querySelectorAll(".btn-dash-subject-pill").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const sub = btn.getAttribute("data-subject") || "all";
                this.selectedSubjectFilter = sub;
                if (sub !== "all") {
                    try { sessionStorage.setItem("niprak_active_subject", sub); } catch (e) {}
                } else {
                    try { sessionStorage.removeItem("niprak_active_subject"); } catch (e) {}
                }
                this.applyFilters();
                this.render();
                this.bindEvents();
            });
        });

        // Teacher Batch Cards Interactions -> Drill down into that batch
        // Collapsible Grade Headers
        this.container.querySelectorAll(".dash-grade-header").forEach(header => {
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

                    if (isNowCollapsed) {
                        section.classList.add("is-collapsed");
                        if (body) body.classList.add("is-collapsed");
                    } else {
                        section.classList.remove("is-collapsed");
                        if (body) body.classList.remove("is-collapsed");
                    }
                    if (txt) txt.textContent = isNowCollapsed ? "Expand" : "Collapse";
                    if (chevron) chevron.style.transform = isNowCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
                }
            });
        });

        this.container.querySelectorAll(".teacher-batch-card").forEach(card => {
            card.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                const batchKey = card.getAttribute("data-batch-key") || `${card.getAttribute("data-class")}:::${card.getAttribute("data-template")}`;
                const cls = card.getAttribute("data-class");
                if (batchKey) {
                    this.activeBatchKey = batchKey;
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
                const batchKey = btn.getAttribute("data-batch-key") || `${btn.getAttribute("data-class")}:::${btn.getAttribute("data-template")}`;
                const cls = btn.getAttribute("data-class");
                if (batchKey) {
                    this.activeBatchKey = batchKey;
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
                const batchKey = btn.getAttribute("data-batch-key");
                const cls = btn.getAttribute("data-class");
                const tpl = btn.getAttribute("data-template");
                const normCls = (cls || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const normTpl = (tpl || "").toLowerCase().replace(/[^a-z0-9]/g, '');

                const batch = (this.batches || []).find(b => (batchKey && b.key === batchKey) || (b.className === cls && b.templateName === tpl)) ||
                    (this.batches || []).find(b => {
                        const bCls = (b.className || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                        const bTpl = (b.templateName || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                        return (bCls === normCls || bCls.includes(normCls) || normCls.includes(bCls)) &&
                               (bTpl === normTpl || bTpl.includes(normTpl) || normTpl.includes(bTpl));
                    });

                if (batch) {
                    const targetPaper = batch.firstPendingPaper || (batch.papers && batch.papers[0]);
                    if (window.app && typeof window.app.showLoadingBox === "function") {
                        window.app.showLoadingBox("Opening Answer Script...", `Opening ${targetPaper?.studentName || 'Student'}'s paper in ${batch.className}...`);
                    }
                    if (targetPaper && this.options.onOpenEvaluation) {
                        this.options.onOpenEvaluation(targetPaper, batch.papers);
                    } else if (targetPaper && window.app) {
                        window.app.openWorkspace(targetPaper, batch.papers);
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

        // Clean Duplicates Buttons (both top banner and table toolbar)
        this.container.querySelectorAll(".btn-clean-duplicates").forEach(btn => {
            btn.addEventListener("click", () => {
                this.handleCleanDuplicates();
            });
        });

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

    async handleCleanDuplicates() {
        if (!window.appStorage || typeof window.appStorage.deduplicateEvaluations !== "function") return;

        if (window.app && typeof window.app.showLoadingBox === "function") {
            window.app.showLoadingBox("Scanning for Duplicates...", "Analyzing student records across all batches...");
        }

        try {
            // Dry-run first to identify duplicate student papers
            const scan = await window.appStorage.deduplicateEvaluations({ dryRun: true });

            if (window.app && typeof window.app.hideLoadingBox === "function") {
                window.app.hideLoadingBox();
            }

            if (!scan || scan.duplicatesRemoved === 0) {
                if (window.app && window.app.showToast) {
                    window.app.showToast("✓ All Clean: No duplicate papers found! Every student in your rosters has exactly one copy.", "success");
                } else {
                    alert("✓ All Clean: No duplicate papers found! Every student in your rosters has exactly one copy.");
                }
                return;
            }

            const preview = scan.removedPapers.slice(0, 5).map(p => 
                `• ${p.studentName || 'Student'} (Roll ${p.rollNo || '—'}) in ${p.className} - ${p.examName}`
            ).join('\n');
            const more = scan.removedPapers.length > 5 ? `\n...and ${scan.removedPapers.length - 5} more duplicate(s)` : '';

            const confirmMsg = `Found ${scan.duplicatesRemoved} duplicate student paper copy(ies):\n\n${preview}${more}\n\nSafe deduplication will:\n✓ Keep 1 primary (graded) copy for each student\n✓ Delete only the redundant extra copies\n\nProceed to remove these ${scan.duplicatesRemoved} duplicate copies now?`;

            if (!window.confirm(confirmMsg)) {
                return;
            }

            if (window.app && typeof window.app.showLoadingBox === "function") {
                window.app.showLoadingBox("Purging Duplicates...", `Safely removing ${scan.duplicatesRemoved} duplicate paper copies...`);
            }

            const result = await window.appStorage.deduplicateEvaluations({ dryRun: false });

            // Reload evaluations from storage
            this.evaluations = await window.appStorage.getAllEvaluations(false, false);
            this.applyFilters();
            this.render();
            this.bindEvents();

            if (window.app && typeof window.app.hideLoadingBox === "function") {
                window.app.hideLoadingBox();
            }

            const successMsg = `Successfully purged ${result.duplicatesRemoved} duplicate paper(s). Originals safely preserved!`;
            if (window.app && window.app.showToast) {
                window.app.showToast(successMsg, "success");
            } else {
                alert(successMsg);
            }
        } catch (err) {
            console.error("Clean duplicates error:", err);
            if (window.app && typeof window.app.hideLoadingBox === "function") {
                window.app.hideLoadingBox();
            }
            if (window.app && window.app.showToast) {
                window.app.showToast("Deduplication error: " + err.message, "error");
            }
        }
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

                    // Strict Date Check: If active batch has a date, paper must have the exact same date!
                    const targetDateMatch = targetTpl.match(/\((\d{4}-\d{2}-\d{2})\)/);
                    const targetDate = targetDateMatch ? targetDateMatch[1] : null;
                    if (targetDate && (!e.examDate || e.examDate !== targetDate)) return false;
                    if (!targetDate && e.examDate) return false;

                    const normTargetCls = targetCls.replace(/[^a-z0-9]/g, '');
                    const eClsNorm = eCls.replace(/[^a-z0-9]/g, '');
                    const clsMatch = !normTargetCls || eClsNorm === normTargetCls;
                    if (!clsMatch) return false;

                    const normTargetTpl = targetTpl.replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');
                    const normExam = (e.examName || "").toLowerCase().replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');
                    const normTpl = (e.templateName || "").toLowerCase().replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').trim().replace(/[^a-z0-9]/g, '');
                    return !normTargetTpl || normExam === normTargetTpl || normTpl === normTargetTpl;
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
