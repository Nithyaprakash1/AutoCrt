/**
 * Niprak Digital Correction - Live Excel Tabulation & Correction Marks Sheet Manager
 * High-performance spreadsheet interface that automatically logs and updates student marks
 * as teachers correct each paper. Features Excel freeze panes, inline cell editing,
 * dynamic question columns (Q1...Qn), live class statistics, and one-click Excel download.
 */

class CorrectionMarksPageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = Object.assign({
            onOpenEvaluation: null,
            onShowToast: null
        }, options);

        this.evaluations = [];
        this.classes = [];
        this.subjects = [];
        this.selectedSubject = "all";
        this.selectedClass = "all";
        this.selectedStatus = "all";
        this.searchQuery = "";
        this.activeCellEdit = null; // { paperId, qNo, cellEl }
        this.isLoading = false;
        this.viewMode = "excel"; // "excel" or "cards"
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        this.isLoading = true;
        try {
            if (window.appStorage) {
                const all = await window.appStorage.getAllEvaluations(false, true);
                this.evaluations = Array.isArray(all) ? all : [];

                const clsList = await window.appStorage.getClassesList();
                this.classes = Array.isArray(clsList) ? clsList : [];

                // Extract unique subjects
                const subSet = new Set();
                this.evaluations.forEach(e => {
                    if (e.subject) subSet.add(e.subject.trim());
                });
                this.subjects = Array.from(subSet).sort();

                // Auto-select teacher's assigned subject if none selected yet
                if (this.selectedSubject === "all") {
                    const activeUser = window.appStorage.getCurrentUser();
                    if (activeUser && Array.isArray(activeUser.assignedSubjects) && activeUser.assignedSubjects.length > 0) {
                        const firstSub = activeUser.assignedSubjects.find(s => s && s !== 'all' && s !== 'All Subjects');
                        if (firstSub && this.subjects.some(s => window.appStorage.isSubjectMatch(s, '', firstSub))) {
                            this.selectedSubject = firstSub;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load marks data:", err);
            if (this.options.onShowToast) {
                this.options.onShowToast("Error loading marks: " + err.message, "error");
            }
        } finally {
            this.isLoading = false;
        }
    }

    getFilteredEvaluations() {
        const query = (this.searchQuery || "").trim().toLowerCase();
        const targetSub = this.selectedSubject;
        const targetCls = this.selectedClass;
        const targetStatus = this.selectedStatus;

        return this.evaluations.filter(e => {
            if (!e) return false;

            // 1. Subject filter
            if (targetSub !== "all") {
                const subMatch = window.appStorage 
                    ? window.appStorage.isSubjectMatch(e.subject || '', e.examName || '', targetSub, e.templateName || '')
                    : (e.subject || "").toLowerCase().includes(targetSub.toLowerCase());
                if (!subMatch) return false;
            }

            // 2. Class filter
            if (targetCls !== "all") {
                const eCls = String(e.className || e.classLabel || e.class || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                const tCls = String(targetCls).toLowerCase().replace(/[^a-z0-9]/g, '');
                if (eCls !== tCls && !eCls.includes(tCls) && !tCls.includes(eCls)) return false;
            }

            // 3. Status filter
            const obt = Number(e.obtainedMarks) || 0;
            const isCompleted = e.status === "Completed";
            const isPartial = (e.status === "In Progress" || e.status === "partial" || obt > 0) && !isCompleted;
            const isPending = !isCompleted && !isPartial;

            if (targetStatus === "completed" && !isCompleted) return false;
            if (targetStatus === "partial" && !isPartial) return false;
            if (targetStatus === "pending" && !isPending) return false;

            // 4. Search query
            if (query) {
                const name = (e.studentName || "").toLowerCase();
                const roll = (e.rollNo || "").toLowerCase();
                const sub = (e.subject || "").toLowerCase();
                const cls = (e.className || e.class || "").toLowerCase();
                if (!name.includes(query) && !roll.includes(query) && !sub.includes(query) && !cls.includes(query)) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // Sort primarily by roll number numerically, then name
            const rollA = parseInt(String(a.rollNo || '').replace(/\D/g, ''), 10) || 0;
            const rollB = parseInt(String(b.rollNo || '').replace(/\D/g, ''), 10) || 0;
            if (rollA !== rollB) return rollA - rollB;
            return (a.studentName || '').localeCompare(b.studentName || '');
        });
    }

    extractQuestionColumns(evalList) {
        const questionCols = [];
        const seenQKeys = new Set();

        evalList.forEach(p => {
            (p.questions || []).forEach(q => {
                const key = String(q.qNo !== undefined ? q.qNo : q.label || '');
                if (key && !seenQKeys.has(key)) {
                    seenQKeys.add(key);
                    const qNum = parseInt(String(key).replace(/\D/g, ''), 10) || (questionCols.length + 1);
                    questionCols.push({
                        key: key,
                        qNo: q.qNo !== undefined ? q.qNo : qNum,
                        label: q.label || `Q${q.qNo || qNum}`,
                        maxMarks: Number(q.maxMarks) || 1,
                        order: qNum
                    });
                }
            });
        });

        // Sort question columns numerically (Q1, Q2, ... Q31)
        questionCols.sort((a, b) => a.order - b.order);
        return questionCols;
    }

    render() {
        if (!this.container) return;

        const filtered = this.getFilteredEvaluations();
        const questionCols = this.extractQuestionColumns(filtered);

        const totalPapers = this.evaluations.length;
        const filteredCount = filtered.length;
        const completedPapers = filtered.filter(e => e.status === "Completed").length;
        const inProgressPapers = filtered.filter(e => (e.status === "In Progress" || Number(e.obtainedMarks) > 0) && e.status !== "Completed").length;
        const pendingPapers = filtered.filter(e => (!e.status || e.status === "Pending" || e.status === "unmarked") && Number(e.obtainedMarks) === 0).length;

        const totalObt = filtered.reduce((acc, e) => acc + (Number(e.obtainedMarks) || 0), 0);
        const totalMax = filtered.reduce((acc, e) => acc + (Number(e.maxMarks) || 40), 0);
        const avgScore = filteredCount > 0 ? (totalObt / filteredCount).toFixed(1) : "0.0";
        const avgPct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : 0;
        const highestScore = filtered.length > 0 ? Math.max(...filtered.map(e => Number(e.obtainedMarks) || 0)) : 0;
        const lowestScore = filtered.length > 0 ? Math.min(...filtered.map(e => Number(e.obtainedMarks) || 0)) : 0;

        this.container.innerHTML = `
            <div class="excel-marks-page-wrap animate-fade-in" style="padding: 20px 24px; max-width: 100%; box-sizing: border-box;">
                
                <!-- Excel Top Command Bar -->
                <div class="excel-top-ribbon" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; background: #FFFFFF; padding: 16px 20px; border-radius: 14px; border: 1.5px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <!-- Excel Green Icon Badge -->
                        <div style="width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #107C41 0%, #217346 100%); display: flex; align-items: center; justify-content: center; color: #FFFFFF; box-shadow: 0 4px 10px rgba(16, 124, 65, 0.28);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="8" y1="13" x2="16" y2="13"/>
                                <line x1="8" y1="17" x2="16" y2="17"/>
                                <line x1="10" y1="9" x2="8" y2="9"/>
                            </svg>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h2 style="margin: 0; font-size: 1.45rem; font-weight: 700; color: #0F172A; letter-spacing: -0.5px;">
                                    Live Excel Tabulation Sheet
                                </h2>
                                <span style="background: rgba(16, 124, 65, 0.12); color: #107C41; font-weight: 700; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase;">
                                    LIVE SYNC
                                </span>
                            </div>
                            <p style="margin: 3px 0 0 0; font-size: 0.85rem; color: #64748B;">
                                As you correct papers and click Save, marks are automatically recorded below into this Excel grid. Click any cell to edit.
                            </p>
                        </div>
                    </div>

                    <!-- Excel Actions -->
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <button type="button" id="btn-excel-repair-scores" title="Auto-detect & repair any lowered scores or missing subpart allocations" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(52, 199, 89, 0.12); border: 1.5px solid rgba(52, 199, 89, 0.4); color: #2E7D32; padding: 9px 15px; border-radius: 10px; font-size: 0.86rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            <span>⚡ Auto-Repair Template Marks</span>
                        </button>

                        <button type="button" id="btn-excel-download-sheet" title="Export this entire table directly as Microsoft Excel (.csv)" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #107C41 0%, #15803D 100%); border: none; color: #FFFFFF; padding: 9px 18px; border-radius: 10px; font-size: 0.88rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 3px 8px rgba(16, 124, 65, 0.35);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Download as Excel (.csv)</span>
                        </button>

                        <button type="button" id="btn-excel-refresh-grid" title="Refresh sheet from database" style="display: inline-flex; align-items: center; gap: 6px; background: #FFFFFF; border: 1.5px solid #CBD5E1; color: #334155; padding: 9px 14px; border-radius: 10px; font-size: 0.86rem; font-weight: 600; cursor: pointer;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            <span>Refresh</span>
                        </button>
                    </div>

                </div>

                <!-- Excel Summary KPI Banner -->
                <div class="excel-kpi-bar" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px;">
                    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; border-left: 4px solid #107C41;">
                        <span style="font-size: 0.74rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Students Listed</span>
                        <div style="font-size: 1.35rem; font-weight: 700; color: #0F172A; margin-top: 2px;">${filteredCount} <span style="font-size: 0.8rem; font-weight: 500; color: #64748B;">/ ${totalPapers}</span></div>
                    </div>
                    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; border-left: 4px solid #2E7D32;">
                        <span style="font-size: 0.74rem; font-weight: 700; color: #2E7D32; text-transform: uppercase;">Fully Evaluated</span>
                        <div style="font-size: 1.35rem; font-weight: 700; color: #2E7D32; margin-top: 2px;">${completedPapers}</div>
                    </div>
                    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; border-left: 4px solid #D97706;">
                        <span style="font-size: 0.74rem; font-weight: 700; color: #D97706; text-transform: uppercase;">In Progress</span>
                        <div style="font-size: 1.35rem; font-weight: 700; color: #D97706; margin-top: 2px;">${inProgressPapers}</div>
                    </div>
                    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; border-left: 4px solid #007AFF;">
                        <span style="font-size: 0.74rem; font-weight: 700; color: #007AFF; text-transform: uppercase;">Class Average Score</span>
                        <div style="font-size: 1.35rem; font-weight: 700; color: #007AFF; margin-top: 2px;">${avgScore} <span style="font-size: 0.85rem; font-weight: 600;">(${avgPct}%)</span></div>
                    </div>
                    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; border-left: 4px solid #8B5CF6;">
                        <span style="font-size: 0.74rem; font-weight: 700; color: #8B5CF6; text-transform: uppercase;">High / Low Score</span>
                        <div style="font-size: 1.35rem; font-weight: 700; color: #0F172A; margin-top: 2px;">${highestScore} <span style="font-size: 0.8rem; font-weight: 500; color: #64748B;">/ ${lowestScore}</span></div>
                    </div>
                </div>

                <!-- Excel Filter Controls -->
                <div class="excel-filter-strip" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 12px 18px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;">
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                        <!-- Subject -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">Subject:</label>
                            <select id="filter-excel-subject" style="padding: 7px 10px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.84rem; font-weight: 600; background: #F8FAFC;">
                                <option value="all" ${this.selectedSubject === 'all' ? 'selected' : ''}>All Subjects</option>
                                ${this.subjects.map(s => `<option value="${s}" ${this.selectedSubject === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Class -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">Class:</label>
                            <select id="filter-excel-class" style="padding: 7px 10px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.84rem; font-weight: 600; background: #F8FAFC;">
                                <option value="all" ${this.selectedClass === 'all' ? 'selected' : ''}>All Classes</option>
                                ${this.classes.map(c => `<option value="${c.label || c.name || c.id}" ${this.selectedClass === (c.label || c.name || c.id) ? 'selected' : ''}>${c.label || c.name}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Status -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">Status:</label>
                            <select id="filter-excel-status" style="padding: 7px 10px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.84rem; font-weight: 600; background: #F8FAFC;">
                                <option value="all" ${this.selectedStatus === 'all' ? 'selected' : ''}>All (${filteredCount})</option>
                                <option value="completed" ${this.selectedStatus === 'completed' ? 'selected' : ''}>Completed (${completedPapers})</option>
                                <option value="partial" ${this.selectedStatus === 'partial' ? 'selected' : ''}>In Progress (${inProgressPapers})</option>
                                <option value="pending" ${this.selectedStatus === 'pending' ? 'selected' : ''}>Pending (${pendingPapers})</option>
                            </select>
                        </div>
                    </div>

                    <!-- Search Input -->
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 240px;">
                        <input type="text" id="inp-excel-search" value="${this.searchQuery}" placeholder="Quick search student name or roll..." style="width: 100%; padding: 7px 12px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 0.84rem; background: #F8FAFC;" />
                    </div>
                </div>

                <!-- Excel Spreadsheet Grid Container -->
                <div class="excel-grid-container" style="background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                    
                    <div style="background: #F1F5F9; border-bottom: 1px solid #CBD5E1; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: #64748B;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: 700; color: #107C41;">SPREADSHEET VIEW</span>
                            <span>•</span>
                            <span>${questionCols.length} Question Columns Detected</span>
                            <span>•</span>
                            <span>Click any cell to edit mark inline</span>
                        </div>
                        <span id="excel-active-cell-info" style="font-family: monospace; font-weight: 600; color: #007AFF;">Ready</span>
                    </div>

                    <div class="excel-table-scroll-wrap" style="overflow-x: auto; max-height: 68vh; overflow-y: auto;">
                        <table class="excel-spreadsheet-table" style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.84rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            <thead>
                                <tr style="background: #E2E8F0; color: #334155; font-size: 0.76rem; font-weight: 700; text-transform: uppercase;">
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; width: 44px; text-align: center; position: sticky; left: 0; background: #E2E8F0; z-index: 5;">#</th>
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; width: 90px; text-align: left; position: sticky; left: 44px; background: #E2E8F0; z-index: 5;">Roll No</th>
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 160px; text-align: left; position: sticky; left: 134px; background: #E2E8F0; z-index: 5;">Student Name</th>
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 100px; text-align: left;">Class</th>
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 120px; text-align: left;">Subject</th>
                                    
                                    <!-- Dynamic Question Columns: Q1, Q2, ... Qn -->
                                    ${questionCols.map(c => `
                                        <th style="padding: 10px 8px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 58px; text-align: center; background: #F8FAFC;" title="${c.label} (${c.maxMarks} Marks)">
                                            <div>${c.label}</div>
                                            <div style="font-size: 0.68rem; color: #64748B; font-weight: 500;">(${c.maxMarks}M)</div>
                                        </th>
                                    `).join('')}

                                    <!-- Totals & Performance -->
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 90px; text-align: center; background: #EBF5EE; color: #107C41;">Total Marks</th>
                                    <th style="padding: 10px 10px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 65px; text-align: center;">Max</th>
                                    <th style="padding: 10px 10px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 65px; text-align: center;">%</th>
                                    <th style="padding: 10px 10px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 65px; text-align: center;">Grade</th>
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; border-right: 1px solid #CBD5E1; min-width: 95px; text-align: center;">Status</th>
                                    <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; min-width: 110px; text-align: right;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.length === 0 ? `
                                    <tr>
                                        <td colspan="${11 + questionCols.length}" style="text-align: center; padding: 48px; color: #64748B;">
                                            <div style="font-size: 1.8rem; margin-bottom: 8px;">📊</div>
                                            <div style="font-size: 1rem; font-weight: 600; color: #0F172A;">No student evaluations in this view</div>
                                            <div style="font-size: 0.85rem;">Select another subject or class, or correct papers in workspace to see them logged here.</div>
                                        </td>
                                    </tr>
                                ` : filtered.map((p, rIdx) => {
                                    const obt = Number(p.obtainedMarks) || 0;
                                    const maxM = Number(p.maxMarks) || 40;
                                    const pct = p.percentage !== undefined ? p.percentage : (maxM > 0 ? Math.round((obt / maxM) * 100) : 0);
                                    const grade = p.grade || (pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F");
                                    const isComp = p.status === "Completed";
                                    const hasMarks = obt > 0 || (p.questions && p.questions.some(q => Number(q.awardedMarks) > 0));
                                    const qMap = new Map();
                                    (p.questions || []).forEach(q => {
                                        const k = String(q.qNo !== undefined ? q.qNo : q.label || '');
                                        qMap.set(k, q);
                                    });

                                    return `
                                        <tr style="border-bottom: 1px solid #E2E8F0; background: ${rIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'};" class="excel-row" data-paper-id="${p.id}">
                                            <!-- S.No (Sticky) -->
                                            <td style="padding: 8px 10px; border-right: 1px solid #E2E8F0; text-align: center; font-family: monospace; font-size: 0.78rem; color: #64748B; position: sticky; left: 0; background: ${rIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}; z-index: 3;">
                                                ${rIdx + 1}
                                            </td>

                                            <!-- Roll No (Sticky) -->
                                            <td style="padding: 8px 12px; border-right: 1px solid #E2E8F0; font-family: monospace; font-weight: 700; color: #0F172A; position: sticky; left: 44px; background: ${rIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}; z-index: 3;">
                                                ${p.rollNo || '-'}
                                            </td>

                                            <!-- Student Name (Sticky) -->
                                            <td style="padding: 8px 12px; border-right: 1px solid #E2E8F0; font-weight: 600; color: #0F172A; position: sticky; left: 134px; background: ${rIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}; z-index: 3;">
                                                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;" title="${p.studentName || 'Student'}">
                                                    ${p.studentName || 'Student'}
                                                </div>
                                            </td>

                                            <!-- Class -->
                                            <td style="padding: 8px 12px; border-right: 1px solid #E2E8F0; white-space: nowrap; color: #475569;">
                                                ${p.className || p.class || '-'}
                                            </td>

                                            <!-- Subject -->
                                            <td style="padding: 8px 12px; border-right: 1px solid #E2E8F0; white-space: nowrap; color: #475569;">
                                                ${p.subject || '-'}
                                            </td>

                                            <!-- Dynamic Question Mark Cells -->
                                            ${questionCols.map(c => {
                                                const qObj = qMap.get(c.key) || (p.questions ? p.questions.find(q => q.qNo === c.qNo || q.label === c.label) : null);
                                                const qAwarded = qObj ? Number(qObj.awardedMarks) : null;
                                                const hasVal = qAwarded !== null && !isNaN(qAwarded);
                                                const isFull = hasVal && qAwarded === c.maxMarks;
                                                const isZero = hasVal && qAwarded === 0;

                                                return `
                                                    <td class="excel-editable-q-cell" data-paper-id="${p.id}" data-q-key="${c.key}" data-max="${c.maxMarks}" style="padding: 6px 4px; border-right: 1px solid #E2E8F0; text-align: center; cursor: pointer; transition: background 0.1s ease; background: ${isFull ? 'rgba(52, 199, 89, 0.08)' : (isZero ? 'rgba(239, 68, 68, 0.05)' : '')};" title="Click to edit mark for ${c.label}">
                                                        <span class="cell-val-text" style="font-weight: 700; color: ${isFull ? '#2E7D32' : (isZero ? '#DC2626' : (hasVal && qAwarded > 0 ? '#007AFF' : '#94A3B8'))};">
                                                            ${hasVal ? qAwarded : '—'}
                                                        </span>
                                                    </td>
                                                `;
                                            }).join('')}

                                            <!-- Total Obtained Marks -->
                                            <td style="padding: 8px 12px; border-right: 1px solid #E2E8F0; text-align: center; font-weight: 700; font-size: 0.95rem; color: #107C41; background: #EBF5EE;" class="cell-total-obt">
                                                ${hasMarks || isComp ? obt : 0}
                                            </td>

                                            <!-- Max Marks -->
                                            <td style="padding: 8px 10px; border-right: 1px solid #E2E8F0; text-align: center; color: #64748B; font-weight: 500;">
                                                ${maxM}
                                            </td>

                                            <!-- Percentage -->
                                            <td style="padding: 8px 10px; border-right: 1px solid #E2E8F0; text-align: center; font-weight: 600; color: ${pct >= 75 ? '#2E7D32' : (pct >= 40 ? '#007AFF' : '#DC2626')};">
                                                ${pct}%
                                            </td>

                                            <!-- Grade -->
                                            <td style="padding: 8px 10px; border-right: 1px solid #E2E8F0; text-align: center;">
                                                <span style="font-weight: 700; font-size: 0.82rem; padding: 2px 6px; border-radius: 4px; background: ${pct >= 75 ? 'rgba(52, 199, 89, 0.15)' : (pct >= 40 ? 'rgba(0, 122, 255, 0.12)' : 'rgba(239, 68, 68, 0.12)')}; color: ${pct >= 75 ? '#2E7D32' : (pct >= 40 ? '#007AFF' : '#DC2626')};">
                                                    ${grade}
                                                </span>
                                            </td>

                                            <!-- Status -->
                                            <td style="padding: 8px 12px; border-right: 1px solid #E2E8F0; text-align: center;">
                                                <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; background: ${isComp ? 'rgba(52, 199, 89, 0.12)' : (hasMarks ? 'rgba(245, 158, 11, 0.12)' : '#F1F5F9')}; color: ${isComp ? '#2E7D32' : (hasMarks ? '#B45309' : '#64748B')};">
                                                    ${isComp ? 'Completed' : (hasMarks ? 'In Progress' : 'Pending')}
                                                </span>
                                            </td>

                                            <!-- Actions -->
                                            <td style="padding: 6px 12px; text-align: right; white-space: nowrap;">
                                                <button type="button" class="btn-excel-open-paper" data-id="${p.id}" title="Open evaluation workspace" style="background: #007AFF; color: #FFFFFF; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;">
                                                    Open Paper
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}

                                <!-- Bottom Summary / Average Row -->
                                ${filtered.length > 0 ? `
                                    <tr style="background: #F8FAFC; border-top: 2px solid #CBD5E1; font-weight: 700; color: #0F172A;">
                                        <td colspan="5" style="padding: 10px 14px; text-align: right; border-right: 1px solid #CBD5E1; text-transform: uppercase; font-size: 0.78rem; letter-spacing: 0.5px; position: sticky; left: 0; background: #F8FAFC; z-index: 4;">
                                            CLASS AVERAGE:
                                        </td>

                                        <!-- Dynamic Question Column Averages -->
                                        ${questionCols.map(c => {
                                            let colSum = 0;
                                            let colCount = 0;
                                            filtered.forEach(p => {
                                                const qObj = (p.questions || []).find(q => String(q.qNo !== undefined ? q.qNo : q.label) === String(c.key));
                                                if (qObj && qObj.awardedMarks !== undefined && !isNaN(Number(qObj.awardedMarks))) {
                                                    colSum += Number(qObj.awardedMarks);
                                                    colCount++;
                                                }
                                            });
                                            const colAvg = colCount > 0 ? (colSum / colCount).toFixed(1) : "-";
                                            return `
                                                <td style="padding: 8px 4px; text-align: center; border-right: 1px solid #CBD5E1; font-size: 0.76rem; color: #007AFF;">
                                                    ${colAvg}
                                                </td>
                                            `;
                                        }).join('')}

                                        <!-- Total Average Score -->
                                        <td style="padding: 10px 12px; border-right: 1px solid #CBD5E1; text-align: center; font-size: 0.95rem; color: #107C41; background: #EBF5EE;">
                                            ${avgScore}
                                        </td>
                                        <td style="padding: 10px 10px; border-right: 1px solid #CBD5E1; text-align: center;">-</td>
                                        <td style="padding: 10px 10px; border-right: 1px solid #CBD5E1; text-align: center; color: #007AFF;">${avgPct}%</td>
                                        <td style="padding: 10px 10px; border-right: 1px solid #CBD5E1; text-align: center;">-</td>
                                        <td style="padding: 10px 12px; border-right: 1px solid #CBD5E1; text-align: center;">-</td>
                                        <td style="padding: 10px 12px; text-align: right;">-</td>
                                    </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Filters
        this.container.querySelector("#filter-excel-subject")?.addEventListener("change", (e) => {
            this.selectedSubject = e.target.value;
            this.render();
        });

        this.container.querySelector("#filter-excel-class")?.addEventListener("change", (e) => {
            this.selectedClass = e.target.value;
            this.render();
        });

        this.container.querySelector("#filter-excel-status")?.addEventListener("change", (e) => {
            this.selectedStatus = e.target.value;
            this.render();
        });

        this.container.querySelector("#inp-excel-search")?.addEventListener("input", (e) => {
            this.searchQuery = e.target.value;
            this.render();
        });

        // Download Excel button
        this.container.querySelector("#btn-excel-download-sheet")?.addEventListener("click", () => {
            this.downloadSpreadsheetAsExcel();
        });

        // Refresh Grid button
        this.container.querySelector("#btn-excel-refresh-grid")?.addEventListener("click", async () => {
            const btn = this.container.querySelector("#btn-excel-refresh-grid");
            if (btn) btn.innerHTML = "Refreshing...";
            await this.loadData();
            this.render();
            if (this.options.onShowToast) this.options.onShowToast("Excel marks grid refreshed!");
        });

        // Auto Repair scores button
        this.container.querySelector("#btn-excel-repair-scores")?.addEventListener("click", async () => {
            await this.handleAutoRepairAllMarks();
        });

        // Open Paper button
        this.container.querySelectorAll(".btn-excel-open-paper").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const evalItem = this.evaluations.find(e => String(e.id) === String(id));
                if (evalItem && this.options.onOpenEvaluation) {
                    await this.options.onOpenEvaluation(evalItem);
                }
            });
        });

        // Inline cell editing for questions
        this.container.querySelectorAll(".excel-editable-q-cell").forEach(cell => {
            cell.addEventListener("click", (e) => {
                // Prevent duplicate click when input is active
                if (cell.querySelector("input")) return;
                this.makeCellEditable(cell);
            });
        });
    }

    makeCellEditable(cell) {
        const paperId = cell.getAttribute("data-paper-id");
        const qKey = cell.getAttribute("data-q-key");
        const maxMarks = Number(cell.getAttribute("data-max")) || 1;
        const currentText = cell.querySelector(".cell-val-text")?.textContent.trim();
        const currentVal = (currentText && currentText !== "—") ? Number(currentText) : 0;

        const infoEl = this.container.querySelector("#excel-active-cell-info");
        if (infoEl) infoEl.textContent = `Editing ${qKey} (Max: ${maxMarks}M)`;

        cell.style.background = "#FEF3C7";
        cell.innerHTML = `
            <input type="number" step="0.5" min="0" max="${maxMarks}" value="${currentVal}" 
                   style="width: 48px; padding: 2px 4px; font-size: 0.85rem; font-weight: 700; text-align: center; border: 2px solid #007AFF; border-radius: 4px; outline: none; background: #FFFFFF;" />
        `;

        const inp = cell.querySelector("input");
        inp.focus();
        inp.select();

        let committed = false;
        const commitValue = async () => {
            if (committed) return;
            committed = true;

            const newVal = Math.min(maxMarks, Math.max(0, Number(inp.value) || 0));
            await this.updateSingleQuestionMark(paperId, qKey, newVal);

            if (infoEl) infoEl.textContent = `Saved ${qKey} = ${newVal}M`;
        };

        inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                commitValue();
            } else if (e.key === "Escape") {
                committed = true;
                this.render();
            }
        });

        inp.addEventListener("blur", () => {
            commitValue();
        });
    }

    async updateSingleQuestionMark(paperId, qKey, newAwardedMark) {
        const evalItem = this.evaluations.find(e => String(e.id) === String(paperId));
        if (!evalItem) return;

        if (!Array.isArray(evalItem.questions)) evalItem.questions = [];

        // Find or create question
        let q = evalItem.questions.find(item => String(item.qNo !== undefined ? item.qNo : item.label) === String(qKey));
        if (q) {
            q.awardedMarks = newAwardedMark;
            q.status = newAwardedMark === q.maxMarks ? "correct" : (newAwardedMark > 0 ? "partial" : "wrong");

            // Distribute into subquestions if present
            if (q.hasSubQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
                let rem = newAwardedMark;
                q.subQuestions.forEach(sq => {
                    const alloc = Math.min(rem, sq.maxMarks);
                    sq.awardedMarks = alloc;
                    rem = Math.max(0, rem - alloc);
                });
            }
        }

        // Recalculate row total
        const maxM = Number(evalItem.maxMarks) || 40;
        const newTotal = evalItem.questions.reduce((sum, item) => sum + (Number(item.awardedMarks) || 0), 0);
        evalItem.obtainedMarks = Math.round(newTotal * 10) / 10;
        evalItem.percentage = maxM > 0 ? Math.round((evalItem.obtainedMarks / maxM) * 100) : 0;
        evalItem.grade = evalItem.percentage >= 90 ? "A+" : evalItem.percentage >= 75 ? "A" : evalItem.percentage >= 60 ? "B" : evalItem.percentage >= 40 ? "C" : "F";
        evalItem.status = evalItem.questions.every(item => item.status && item.status !== "unmarked" && item.status !== "pending") ? "Completed" : "In Progress";
        evalItem.updatedAt = new Date().toISOString();

        if (window.appStorage) {
            await window.appStorage.saveEvaluation(evalItem);
        }

        this.render();
        if (this.options.onShowToast) {
            this.options.onShowToast(`Updated ${evalItem.studentName || 'Student'} ${qKey} = ${newAwardedMark}M (Total: ${evalItem.obtainedMarks}/${maxM}M)`, "success");
        }
    }

    async handleAutoRepairAllMarks() {
        if (!window.appStorage) return;

        let repairedCount = 0;
        const all = await window.appStorage.getAllEvaluations(false, true);

        for (const ev of all) {
            let changed = false;
            const maxM = Number(ev.maxMarks) || 40;
            const currentObt = Number(ev.obtainedMarks) || 0;

            if (Array.isArray(ev.questions) && ev.questions.length > 0) {
                ev.questions.forEach(q => {
                    const qAwarded = Number(q.awardedMarks) || 0;
                    if (q.hasSubQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
                        const subSum = q.subQuestions.reduce((s, sq) => s + (Number(sq.awardedMarks) || 0), 0);
                        if (subSum === 0 && qAwarded > 0) {
                            let rem = qAwarded;
                            q.subQuestions.forEach(sq => {
                                const alloc = Math.min(rem, sq.maxMarks);
                                sq.awardedMarks = alloc;
                                rem = Math.max(0, rem - alloc);
                            });
                            changed = true;
                        } else if (subSum > qAwarded) {
                            q.awardedMarks = subSum;
                            changed = true;
                        }
                    }

                    if (q.awardedMarks > 0 && (q.status === "unmarked" || q.status === "pending" || !q.status)) {
                        q.status = q.awardedMarks === q.maxMarks ? "correct" : "partial";
                        changed = true;
                    }
                });

                const qSum = ev.questions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
                if (qSum > currentObt) {
                    ev.obtainedMarks = Math.round(qSum * 10) / 10;
                    ev.percentage = maxM > 0 ? Math.round((ev.obtainedMarks / maxM) * 100) : 0;
                    ev.grade = ev.percentage >= 90 ? "A+" : ev.percentage >= 75 ? "A" : ev.percentage >= 60 ? "B" : ev.percentage >= 40 ? "C" : "F";
                    ev.status = ev.questions.every(q => q.status !== "unmarked" && q.status !== "pending") ? "Completed" : "In Progress";
                    changed = true;
                }
            }

            // Annotation recovery check
            if (Array.isArray(ev.annotations) && ev.annotations.length > 0) {
                let annMarkSum = 0;
                ev.annotations.forEach(a => {
                    if (a.marks !== undefined) annMarkSum += Number(a.marks);
                    else if (a.type === "marks" || a.type === "margin_mark") annMarkSum += Number(a.points || a.text) || 0;
                });
                if (annMarkSum > Number(ev.obtainedMarks) && annMarkSum <= maxM) {
                    ev.obtainedMarks = Math.round(annMarkSum * 10) / 10;
                    ev.percentage = maxM > 0 ? Math.round((ev.obtainedMarks / maxM) * 100) : 0;
                    ev.grade = ev.percentage >= 90 ? "A+" : ev.percentage >= 75 ? "A" : ev.percentage >= 60 ? "B" : ev.percentage >= 40 ? "C" : "F";
                    changed = true;
                }
            }

            if (changed) {
                await window.appStorage.saveEvaluation(ev);
                repairedCount++;
            }
        }

        await this.loadData();
        this.render();

        if (this.options.onShowToast) {
            this.options.onShowToast(`Auto-repair complete! Restored marks for ${repairedCount} student papers.`, "success");
        }
    }

    downloadSpreadsheetAsExcel() {
        const filtered = this.getFilteredEvaluations();
        if (filtered.length === 0) {
            if (this.options.onShowToast) this.options.onShowToast("No marks data to export.", "warning");
            return;
        }

        const questionCols = this.extractQuestionColumns(filtered);

        // Header Row
        const headers = [
            "S.No",
            "Roll No",
            "Student Name",
            "Class",
            "Subject",
            "Exam Blueprint",
            ...questionCols.map(c => `"${c.label} (${c.maxMarks}M)"`),
            "Total Marks Obtained",
            "Max Marks",
            "Percentage",
            "Grade",
            "Status"
        ];

        // Data Rows
        const rows = filtered.map((p, idx) => {
            const obt = Number(p.obtainedMarks) || 0;
            const maxM = Number(p.maxMarks) || 40;
            const pct = p.percentage !== undefined ? p.percentage : (maxM > 0 ? Math.round((obt / maxM) * 100) : 0);
            const grade = p.grade || (pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F");

            const qMap = new Map();
            (p.questions || []).forEach(q => {
                const k = String(q.qNo !== undefined ? q.qNo : q.label || '');
                qMap.set(k, q);
            });

            const qCells = questionCols.map(c => {
                const qObj = qMap.get(c.key) || (p.questions ? p.questions.find(q => q.qNo === c.qNo || q.label === c.label) : null);
                if (qObj && qObj.awardedMarks !== undefined && !isNaN(Number(qObj.awardedMarks))) {
                    return Number(qObj.awardedMarks);
                }
                return 0;
            });

            return [
                idx + 1,
                `"${p.rollNo || ''}"`,
                `"${(p.studentName || '').replace(/"/g, '""')}"`,
                `"${(p.className || p.class || '').replace(/"/g, '""')}"`,
                `"${(p.subject || '').replace(/"/g, '""')}"`,
                `"${(p.templateName || p.examName || '').replace(/"/g, '""')}"`,
                ...qCells,
                obt,
                maxM,
                `"${pct}%"`,
                `"${grade}"`,
                `"${p.status || 'Completed'}"`
            ].join(',');
        });

        // Summary Average Row
        const totalObt = filtered.reduce((acc, e) => acc + (Number(e.obtainedMarks) || 0), 0);
        const avgScore = (totalObt / filtered.length).toFixed(1);
        const avgPct = Math.round((totalObt / filtered.reduce((acc, e) => acc + (Number(e.maxMarks) || 40), 0)) * 100);

        const qAverages = questionCols.map(c => {
            let colSum = 0;
            filtered.forEach(p => {
                const qObj = (p.questions || []).find(q => String(q.qNo !== undefined ? q.qNo : q.label) === String(c.key));
                if (qObj && qObj.awardedMarks !== undefined) colSum += Number(qObj.awardedMarks) || 0;
            });
            return (colSum / filtered.length).toFixed(1);
        });

        const summaryRow = [
            `"AVERAGE"`,
            `""`,
            `"CLASS AVERAGE"`,
            `""`,
            `""`,
            `""`,
            ...qAverages,
            avgScore,
            `""`,
            `"${avgPct}%"`,
            `""`,
            `""`
        ].join(',');

        const csvContent = "\uFEFF" + [headers.join(','), ...rows, summaryRow].join('\r\n');
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const subName = (filtered[0]?.subject || "Marks").replace(/\s+/g, '_');
        const clsName = (filtered[0]?.className || filtered[0]?.class || "Class").replace(/\s+/g, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `${clsName}_${subName}_Live_Excel_Marks_Sheet_${dateStr}.csv`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        if (this.options.onShowToast) {
            this.options.onShowToast("Excel marks spreadsheet downloaded successfully!");
        }
    }
}

window.CorrectionMarksPageManager = CorrectionMarksPageManager;
