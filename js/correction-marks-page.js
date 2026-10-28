/**
 * Niprak Digital Correction - Correction Marks Register & Direct Marks Entry Manager
 * Provides a dedicated table ledger of all evaluated & uploaded answer papers,
 * showing detailed question scores, status, total marks, percentage, grade,
 * direct quick marks entry / editing, and Excel export.
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
        this.editingEvaluation = null;
        this.expandedRowIds = new Set();
        this.isLoading = false;
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
            }
        } catch (err) {
            console.error("Failed to load correction marks data:", err);
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
        });
    }

    render() {
        if (!this.container) return;

        const filtered = this.getFilteredEvaluations();
        const totalPapers = this.evaluations.length;
        const completedPapers = this.evaluations.filter(e => e.status === "Completed").length;
        const partialPapers = this.evaluations.filter(e => (e.status === "In Progress" || Number(e.obtainedMarks) > 0) && e.status !== "Completed").length;
        const pendingPapers = this.evaluations.filter(e => (!e.status || e.status === "Pending" || e.status === "unmarked") && Number(e.obtainedMarks) === 0).length;

        const totalScored = this.evaluations.reduce((acc, e) => acc + (Number(e.obtainedMarks) || 0), 0);
        const totalPossible = this.evaluations.reduce((acc, e) => acc + (Number(e.maxMarks) || 40), 0);
        const avgPct = totalPossible > 0 ? Math.round((totalScored / totalPossible) * 100) : 0;

        this.container.innerHTML = `
            <div class="correction-marks-page-wrap animate-fade-in" style="padding: 24px; max-width: 1440px; margin: 0 auto;">
                
                <!-- Page Top Header -->
                <div class="marks-page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                            <span class="marks-header-badge" style="background: rgba(0, 122, 255, 0.1); color: #007AFF; font-size: 0.78rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase;">
                                Live Marks Ledger
                            </span>
                            <span style="font-size: 0.8rem; color: var(--text-muted, #64748B);">Updated Live & Synced</span>
                        </div>
                        <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--text-main, #0F172A); margin: 0 0 6px 0; letter-spacing: -0.5px;">
                            Student Correction Marks Register
                        </h2>
                        <p style="font-size: 0.88rem; color: var(--text-muted, #64748B); margin: 0;">
                            Comprehensive table view of all evaluated and pending answer papers. Review question breakdowns, correct marks mismatches, or directly entry scores.
                        </p>
                    </div>

                    <!-- Top Action Buttons -->
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <button type="button" class="btn-action-refresh" id="btn-marks-auto-repair" title="Auto-detect & repair any scores lowered by template changes or missing sub-part distributions" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(52, 199, 89, 0.1); border: 1.5px solid rgba(52, 199, 89, 0.4); color: #2E7D32; padding: 8px 16px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            <span>⚡ Auto-Repair Template Marks</span>
                        </button>
                        <button type="button" class="btn-action-export" id="btn-marks-export-excel" title="Download all correction marks as Excel spreadsheet" style="display: inline-flex; align-items: center; gap: 6px; background: #007AFF; border: none; color: #FFFFFF; padding: 8px 16px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(0, 122, 255, 0.25);">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Export Excel</span>
                        </button>
                        <button type="button" class="btn-action-refresh" id="btn-marks-reload" title="Refresh marks list" style="display: inline-flex; align-items: center; gap: 6px; background: var(--bg-card, #FFFFFF); border: 1.5px solid var(--border-color, #E2E8F0); color: var(--text-main, #0F172A); padding: 8px 14px; border-radius: 10px; font-size: 0.85rem; font-weight: 500; cursor: pointer;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                <!-- KPI Metric Summary Bar -->
                <div class="marks-kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px;">
                    <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 12px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                        <div style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted, #64748B); text-transform: uppercase; margin-bottom: 4px;">Total Papers</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-main, #0F172A);">${totalPapers}</div>
                    </div>
                    <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 12px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                        <div style="font-size: 0.78rem; font-weight: 600; color: #2E7D32; text-transform: uppercase; margin-bottom: 4px;">Fully Corrected</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #2E7D32;">${completedPapers}</div>
                    </div>
                    <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 12px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                        <div style="font-size: 0.78rem; font-weight: 600; color: #D97706; text-transform: uppercase; margin-bottom: 4px;">Partially Graded</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #D97706;">${partialPapers}</div>
                    </div>
                    <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 12px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                        <div style="font-size: 0.78rem; font-weight: 600; color: #EF4444; text-transform: uppercase; margin-bottom: 4px;">Pending Evaluation</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #EF4444;">${pendingPapers}</div>
                    </div>
                    <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 12px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                        <div style="font-size: 0.78rem; font-weight: 600; color: #007AFF; text-transform: uppercase; margin-bottom: 4px;">Overall Average</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #007AFF;">${avgPct}%</div>
                    </div>
                </div>

                <!-- Filter Controls Strip -->
                <div class="marks-filter-card" style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;">
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; flex: 1; min-width: 280px;">
                        <!-- Subject Filter -->
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #64748B); text-transform: uppercase;">Subject</label>
                            <select id="filter-marks-subject" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #CBD5E1); background: var(--bg-subtle, #F8FAFC); font-size: 0.85rem; font-weight: 500; min-width: 160px; color: var(--text-main, #0F172A);">
                                <option value="all" ${this.selectedSubject === 'all' ? 'selected' : ''}>All Subjects</option>
                                ${this.subjects.map(s => `<option value="${s}" ${this.selectedSubject === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Class Filter -->
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #64748B); text-transform: uppercase;">Class</label>
                            <select id="filter-marks-class" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #CBD5E1); background: var(--bg-subtle, #F8FAFC); font-size: 0.85rem; font-weight: 500; min-width: 140px; color: var(--text-main, #0F172A);">
                                <option value="all" ${this.selectedClass === 'all' ? 'selected' : ''}>All Classes</option>
                                ${this.classes.map(c => `<option value="${c.label || c.name || c.id}" ${this.selectedClass === (c.label || c.name || c.id) ? 'selected' : ''}>${c.label || c.name}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Status Filter -->
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #64748B); text-transform: uppercase;">Status</label>
                            <select id="filter-marks-status" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #CBD5E1); background: var(--bg-subtle, #F8FAFC); font-size: 0.85rem; font-weight: 500; min-width: 150px; color: var(--text-main, #0F172A);">
                                <option value="all" ${this.selectedStatus === 'all' ? 'selected' : ''}>All Status</option>
                                <option value="completed" ${this.selectedStatus === 'completed' ? 'selected' : ''}>Completed (${completedPapers})</option>
                                <option value="partial" ${this.selectedStatus === 'partial' ? 'selected' : ''}>Partially Graded (${partialPapers})</option>
                                <option value="pending" ${this.selectedStatus === 'pending' ? 'selected' : ''}>Pending (${pendingPapers})</option>
                            </select>
                        </div>
                    </div>

                    <!-- Search Input -->
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 260px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #64748B); text-transform: uppercase;">Search Student / Roll</label>
                        <div style="position: relative;">
                            <input type="text" id="inp-marks-search" value="${this.searchQuery}" placeholder="Search name or roll no..." style="width: 100%; padding: 8px 12px 8px 34px; border-radius: 8px; border: 1px solid var(--border-color, #CBD5E1); background: var(--bg-subtle, #F8FAFC); font-size: 0.85rem; color: var(--text-main, #0F172A);" />
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" style="position: absolute; left: 10px; top: 10px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                    </div>
                </div>

                <!-- Marks Table Card -->
                <div class="marks-table-card" style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    
                    <div style="padding: 14px 20px; border-bottom: 1px solid var(--border-color, #E2E8F0); display: flex; justify-content: space-between; align-items: center; background: var(--bg-subtle, #F8FAFC);">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main, #0F172A);">
                            Showing ${filtered.length} of ${totalPapers} student records
                        </span>
                        <span style="font-size: 0.78rem; color: var(--text-muted, #64748B);">
                            💡 Click <strong>"✏️ Entry Marks"</strong> to directly edit scores or fix any template discrepancies
                        </span>
                    </div>

                    ${filtered.length === 0 ? `
                        <div style="text-align: center; padding: 48px 20px; color: var(--text-muted, #64748B);">
                            <div style="font-size: 2rem; margin-bottom: 8px;">📋</div>
                            <div style="font-size: 1rem; font-weight: 600; color: var(--text-main, #0F172A); margin-bottom: 4px;">No paper records match your filter</div>
                            <div style="font-size: 0.85rem;">Try changing the subject or class filter above.</div>
                        </div>
                    ` : `
                        <div class="table-responsive" style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background: var(--bg-subtle, #F8FAFC); border-bottom: 1px solid var(--border-color, #E2E8F0); color: var(--text-muted, #64748B); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                        <th style="padding: 12px 16px; width: 80px;">Roll</th>
                                        <th style="padding: 12px 16px;">Student Name</th>
                                        <th style="padding: 12px 16px;">Class</th>
                                        <th style="padding: 12px 16px;">Subject & Blueprint</th>
                                        <th style="padding: 12px 16px; text-align: center;">Status</th>
                                        <th style="padding: 12px 16px; text-align: center;">Total Marks</th>
                                        <th style="padding: 12px 16px; text-align: center;">% / Grade</th>
                                        <th style="padding: 12px 16px; text-align: center;">Breakdown</th>
                                        <th style="padding: 12px 16px; text-align: right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filtered.map((p, idx) => {
                                        const obt = Number(p.obtainedMarks) || 0;
                                        const maxM = Number(p.maxMarks) || 40;
                                        const pct = p.percentage !== undefined ? p.percentage : (maxM > 0 ? Math.round((obt / maxM) * 100) : 0);
                                        const grade = p.grade || (pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F");
                                        const isCompleted = p.status === "Completed";
                                        const hasMarks = obt > 0 || (p.questions && p.questions.some(q => Number(q.awardedMarks) > 0));
                                        const isExpanded = this.expandedRowIds.has(String(p.id));

                                        const statusBadge = isCompleted 
                                            ? `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; background: rgba(52, 199, 89, 0.12); color: #2E7D32;">✓ Completed</span>`
                                            : (hasMarks 
                                                ? `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; background: rgba(245, 158, 11, 0.12); color: #B45309;">◐ In Progress</span>`
                                                : `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 0.74rem; font-weight: 600; background: var(--bg-subtle, #F1F5F9); color: var(--text-muted, #64748B);">⏳ Pending</span>`);

                                        const scoreBadge = hasMarks || isCompleted
                                            ? `<span style="font-weight: 700; font-size: 0.95rem; color: #007AFF;">${obt} <span style="font-size: 0.78rem; font-weight: 500; color: #64748B;">/ ${maxM} M</span></span>`
                                            : `<span style="color: #94A3B8; font-weight: 500;">0 / ${maxM} M</span>`;

                                        const questions = Array.isArray(p.questions) ? p.questions : [];
                                        const answeredCount = questions.filter(q => Number(q.awardedMarks) > 0 || (q.status && q.status !== "unmarked" && q.status !== "pending")).length;

                                        return `
                                            <tr style="border-bottom: 1px solid var(--border-color, #F1F5F9); transition: background 0.15s ease;" class="marks-table-row">
                                                <td style="padding: 12px 16px; font-weight: 600; font-family: monospace; color: var(--text-main, #0F172A);">${p.rollNo || '-'}</td>
                                                <td style="padding: 12px 16px;">
                                                    <div style="font-weight: 600; color: var(--text-main, #0F172A);">${p.studentName || 'Student'}</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-muted, #64748B);">${p.id}</div>
                                                </td>
                                                <td style="padding: 12px 16px;">
                                                    <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: var(--bg-subtle, #F8FAFC); border: 1px solid var(--border-color, #E2E8F0); font-size: 0.78rem; font-weight: 600;">
                                                        ${p.className || p.class || '-'}
                                                    </span>
                                                </td>
                                                <td style="padding: 12px 16px;">
                                                    <div style="font-weight: 600; color: var(--text-main, #0F172A);">${p.subject || '-'}</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-muted, #64748B);">${p.templateName || p.examName || 'Assessment'} (${questions.length || 0} Qs)</div>
                                                </td>
                                                <td style="padding: 12px 16px; text-align: center;">${statusBadge}</td>
                                                <td style="padding: 12px 16px; text-align: center;">${scoreBadge}</td>
                                                <td style="padding: 12px 16px; text-align: center;">
                                                    <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 0.82rem; background: ${pct >= 75 ? 'rgba(52, 199, 89, 0.15)' : pct >= 40 ? 'rgba(0, 122, 255, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; color: ${pct >= 75 ? '#2E7D32' : pct >= 40 ? '#007AFF' : '#DC2626'};">
                                                        ${pct}% (${grade})
                                                    </span>
                                                </td>
                                                <td style="padding: 12px 16px; text-align: center;">
                                                    <button type="button" class="btn-toggle-q-breakdown" data-id="${p.id}" style="border: 1px solid var(--border-color, #CBD5E1); background: var(--bg-subtle, #F8FAFC); border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; font-weight: 500; cursor: pointer;">
                                                        ${answeredCount}/${questions.length || 0} Qs ${isExpanded ? '▲' : '▼'}
                                                    </button>
                                                </td>
                                                <td style="padding: 12px 16px; text-align: right;">
                                                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                                                        <button type="button" class="btn-open-marks-entry" data-id="${p.id}" title="Directly enter or edit marks for this student" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(0, 122, 255, 0.1); border: 1px solid rgba(0, 122, 255, 0.3); color: #007AFF; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                                                            ✏️ Entry Marks
                                                        </button>
                                                        <button type="button" class="btn-open-ws-paper" data-id="${p.id}" title="Open evaluation workspace" style="display: inline-flex; align-items: center; gap: 4px; background: #007AFF; border: none; color: #FFFFFF; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                                                            📄 Open Paper
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            <!-- Expandable Question Breakdown Row -->
                                            ${isExpanded ? `
                                                <tr style="background: rgba(0, 122, 255, 0.02); border-bottom: 1.5px solid var(--border-color, #CBD5E1);">
                                                    <td colspan="9" style="padding: 14px 20px;">
                                                        <div style="margin-bottom: 8px; font-size: 0.8rem; font-weight: 700; color: var(--text-main, #0F172A); display: flex; justify-content: space-between; align-items: center;">
                                                            <span>Question Marks Breakdown for ${p.studentName || 'Student'} (${p.templateName || 'Assessment'})</span>
                                                            <button type="button" class="btn-open-marks-entry" data-id="${p.id}" style="background: transparent; border: none; color: #007AFF; font-size: 0.8rem; font-weight: 600; cursor: pointer; text-decoration: underline;">
                                                                Edit individual question marks →
                                                            </button>
                                                        </div>
                                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                                            ${questions.length === 0 ? `<span style="font-size: 0.82rem; color: #94A3B8;">No question blueprint attached to this paper.</span>` : questions.map(q => {
                                                                const qMarks = Number(q.awardedMarks) || 0;
                                                                const qMax = Number(q.maxMarks) || 1;
                                                                const isFull = qMarks === qMax;
                                                                const isZero = qMarks === 0;

                                                                let subStr = "";
                                                                if (q.hasSubQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
                                                                    subStr = ` [${q.subQuestions.map(sq => `${sq.label || sq.subId}:${sq.awardedMarks || 0}/${sq.maxMarks}M`).join(', ')}]`;
                                                                }

                                                                return `
                                                                    <div style="display: inline-flex; align-items: center; gap: 4px; background: ${isFull ? 'rgba(52, 199, 89, 0.12)' : (!isZero ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card, #FFFFFF)')}; border: 1px solid ${isFull ? 'rgba(52, 199, 89, 0.3)' : (!isZero ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color, #E2E8F0)')}; border-radius: 6px; padding: 4px 8px; font-size: 0.78rem;">
                                                                        <strong style="color: var(--text-main, #0F172A);">${q.label || `Q${q.qNo}`}:</strong>
                                                                        <span style="font-weight: 700; color: ${isFull ? '#2E7D32' : (!isZero ? '#B45309' : '#64748B')};">${qMarks}/${qMax}M</span>
                                                                        <span style="font-size: 0.72rem; color: #64748B;">${subStr}</span>
                                                                    </div>
                                                                `;
                                                            }).join('')}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ` : ''}
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>

                <!-- Marks Entry / Edit Modal Root -->
                <div id="modal-marks-entry-root"></div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Filter change handlers
        const subFilter = this.container.querySelector("#filter-marks-subject");
        if (subFilter) {
            subFilter.addEventListener("change", (e) => {
                this.selectedSubject = e.target.value;
                this.render();
            });
        }

        const clsFilter = this.container.querySelector("#filter-marks-class");
        if (clsFilter) {
            clsFilter.addEventListener("change", (e) => {
                this.selectedClass = e.target.value;
                this.render();
            });
        }

        const stFilter = this.container.querySelector("#filter-marks-status");
        if (stFilter) {
            stFilter.addEventListener("change", (e) => {
                this.selectedStatus = e.target.value;
                this.render();
            });
        }

        const searchInp = this.container.querySelector("#inp-marks-search");
        if (searchInp) {
            searchInp.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        // Refresh button
        const btnReload = this.container.querySelector("#btn-marks-reload");
        if (btnReload) {
            btnReload.addEventListener("click", async () => {
                btnReload.innerHTML = "Refreshing...";
                await this.loadData();
                this.render();
                if (this.options.onShowToast) this.options.onShowToast("Marks list refreshed.");
            });
        }

        // Export to Excel
        const btnExport = this.container.querySelector("#btn-marks-export-excel");
        if (btnExport) {
            btnExport.addEventListener("click", () => {
                this.exportMarksToExcel();
            });
        }

        // Auto-Repair Template Marks Button
        const btnAutoRepair = this.container.querySelector("#btn-marks-auto-repair");
        if (btnAutoRepair) {
            btnAutoRepair.addEventListener("click", async () => {
                await this.handleAutoRepairAllMarks();
            });
        }

        // Expand/collapse question breakdown
        this.container.querySelectorAll(".btn-toggle-q-breakdown").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                if (this.expandedRowIds.has(id)) {
                    this.expandedRowIds.delete(id);
                } else {
                    this.expandedRowIds.add(id);
                }
                this.render();
            });
        });

        // Open Workspace button
        this.container.querySelectorAll(".btn-open-ws-paper").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const evalItem = this.evaluations.find(e => String(e.id) === String(id));
                if (evalItem && this.options.onOpenEvaluation) {
                    await this.options.onOpenEvaluation(evalItem);
                }
            });
        });

        // Open Marks Entry Modal button
        this.container.querySelectorAll(".btn-open-marks-entry").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const evalItem = this.evaluations.find(e => String(e.id) === String(id));
                if (evalItem) {
                    this.openMarksEntryModal(evalItem);
                }
            });
        });
    }

    openMarksEntryModal(evalItem) {
        const modalRoot = this.container.querySelector("#modal-marks-entry-root");
        if (!modalRoot) return;

        const maxM = Number(evalItem.maxMarks) || 40;
        const currentObt = Number(evalItem.obtainedMarks) || 0;
        const questions = Array.isArray(evalItem.questions) ? JSON.parse(JSON.stringify(evalItem.questions)) : [];

        modalRoot.innerHTML = `
            <div class="modal-backdrop active" id="modal-marks-entry-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px; backdrop-filter: blur(4px);">
                <div class="modal-dialog" style="background: var(--bg-card, #FFFFFF); border-radius: 16px; width: 100%; max-width: 780px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.25); display: flex; flex-direction: column;">
                    
                    <!-- Modal Header -->
                    <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color, #E2E8F0); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 0.78rem; font-weight: 700; color: #007AFF; text-transform: uppercase; margin-bottom: 2px;">Direct Correction Marks Entry</div>
                            <h3 style="font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--text-main, #0F172A);">
                                ${evalItem.studentName || 'Student'} (Roll: ${evalItem.rollNo || '-'})
                            </h3>
                            <div style="font-size: 0.82rem; color: var(--text-muted, #64748B);">
                                ${evalItem.className || evalItem.class || ''} • ${evalItem.subject || ''} • ${evalItem.templateName || evalItem.examName || 'Assessment Blueprint'}
                            </div>
                        </div>
                        <button type="button" id="btn-close-marks-modal" style="background: none; border: none; font-size: 1.5rem; color: #64748B; cursor: pointer; padding: 4px;">×</button>
                    </div>

                    <!-- Modal Body -->
                    <div style="padding: 20px 24px; flex: 1;">
                        
                        <!-- Quick Total Marks Input Box -->
                        <div style="background: rgba(0, 122, 255, 0.05); border: 1.5px solid rgba(0, 122, 255, 0.25); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                            <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-main, #0F172A); display: block; margin-bottom: 6px;">
                                Quick Total Marks Entry (Auto-proportional sync to questions)
                            </label>
                            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <input type="number" id="inp-modal-total-marks" value="${currentObt}" min="0" max="${maxM}" step="0.5" style="width: 100px; padding: 8px 12px; font-size: 1.25rem; font-weight: 700; border-radius: 8px; border: 1.5px solid #007AFF; text-align: center; color: #007AFF; background: #FFFFFF;" />
                                    <span style="font-size: 1.1rem; font-weight: 700; color: #64748B;">/ ${maxM} Marks</span>
                                </div>
                                <button type="button" id="btn-modal-apply-total" style="padding: 8px 14px; border-radius: 8px; background: #007AFF; color: #FFFFFF; font-size: 0.85rem; font-weight: 600; border: none; cursor: pointer;">
                                    Apply Total to Questions
                                </button>
                                <span id="modal-pct-preview" style="font-size: 0.85rem; font-weight: 700; color: #2E7D32;">
                                    ${maxM > 0 ? Math.round((currentObt / maxM) * 100) : 0}% (${evalItem.grade || 'Grade'})
                                </span>
                            </div>
                            <p style="font-size: 0.75rem; color: #64748B; margin: 8px 0 0 0;">
                                Teachers can either enter the total marks directly above or fine-tune individual question marks below.
                            </p>
                        </div>

                        <!-- Question by Question Matrix -->
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main, #0F172A); margin: 0;">
                                    Question-by-Question Marks Entry (${questions.length} Questions)
                                </h4>
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" id="btn-modal-all-full" style="padding: 4px 10px; border-radius: 6px; background: rgba(52, 199, 89, 0.12); color: #2E7D32; border: 1px solid rgba(52, 199, 89, 0.3); font-size: 0.78rem; font-weight: 600; cursor: pointer;">All Full Marks</button>
                                    <button type="button" id="btn-modal-all-zero" style="padding: 4px 10px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.78rem; font-weight: 600; cursor: pointer;">All Zero</button>
                                </div>
                            </div>

                            <div class="modal-q-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; max-height: 340px; overflow-y: auto; padding: 4px;">
                                ${questions.length === 0 ? `<div style="grid-column: 1/-1; text-align: center; color: #64748B; padding: 20px;">No question blueprint found for this paper.</div>` : questions.map((q, qIdx) => {
                                    const qMax = Number(q.maxMarks) || 1;
                                    const qAwarded = Number(q.awardedMarks) || 0;
                                    const hasSubs = q.hasSubQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0;

                                    return `
                                        <div style="border: 1px solid var(--border-color, #E2E8F0); border-radius: 10px; padding: 10px 12px; background: var(--bg-card, #FFFFFF);">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                                <strong style="font-size: 0.85rem; color: var(--text-main, #0F172A);">${q.label || `Q${q.qNo}`}</strong>
                                                <span style="font-size: 0.75rem; color: #64748B;">Max: ${qMax}M</span>
                                            </div>

                                            ${!hasSubs ? `
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <input type="number" step="0.5" min="0" max="${qMax}" value="${qAwarded}" data-q-idx="${qIdx}" class="inp-q-mark" style="width: 70px; padding: 6px 8px; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.9rem; font-weight: 700; text-align: center;" />
                                                    <span style="font-size: 0.8rem; color: #64748B;">/ ${qMax} M</span>
                                                </div>
                                            ` : `
                                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                                    ${q.subQuestions.map((sq, sqIdx) => `
                                                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
                                                            <span>Part ${sq.label || `(${sq.subId})`}:</span>
                                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                                <input type="number" step="0.5" min="0" max="${sq.maxMarks}" value="${sq.awardedMarks || 0}" data-q-idx="${qIdx}" data-sub-idx="${sqIdx}" class="inp-subq-mark" style="width: 50px; padding: 4px; border-radius: 4px; border: 1px solid #CBD5E1; text-align: center; font-weight: 700;" />
                                                                <span style="color: #64748B;">/${sq.maxMarks}</span>
                                                            </div>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            `}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                    </div>

                    <!-- Modal Footer -->
                    <div style="padding: 16px 24px; border-top: 1px solid var(--border-color, #E2E8F0); background: var(--bg-subtle, #F8FAFC); display: flex; justify-content: space-between; align-items: center;">
                        <button type="button" id="btn-cancel-marks-modal" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; font-size: 0.85rem; font-weight: 600; cursor: pointer; color: #64748B;">
                            Cancel
                        </button>
                        <button type="button" id="btn-save-marks-modal" style="padding: 8px 20px; border-radius: 8px; background: #007AFF; color: #FFFFFF; font-size: 0.88rem; font-weight: 600; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);">
                            💾 Save & Apply Marks
                        </button>
                    </div>

                </div>
            </div>
        `;

        // Modal event handling
        const closeModal = () => {
            modalRoot.innerHTML = "";
        };

        modalRoot.querySelector("#btn-close-marks-modal")?.addEventListener("click", closeModal);
        modalRoot.querySelector("#btn-cancel-marks-modal")?.addEventListener("click", closeModal);

        const totalInp = modalRoot.querySelector("#inp-modal-total-marks");
        const pctPreview = modalRoot.querySelector("#modal-pct-preview");

        const updateLiveTotal = () => {
            let sum = 0;
            questions.forEach((q, qIdx) => {
                if (q.hasSubQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
                    const subSum = q.subQuestions.reduce((s, sq) => s + (Number(sq.awardedMarks) || 0), 0);
                    q.awardedMarks = subSum;
                    sum += subSum;
                } else {
                    sum += (Number(q.awardedMarks) || 0);
                }
            });

            sum = Math.round(sum * 10) / 10;
            if (totalInp) totalInp.value = sum;
            const pct = maxM > 0 ? Math.round((sum / maxM) * 100) : 0;
            const grade = pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F";
            if (pctPreview) pctPreview.textContent = `${pct}% (${grade})`;
            return sum;
        };

        // Question mark input listener
        modalRoot.querySelectorAll(".inp-q-mark").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const qIdx = parseInt(e.target.getAttribute("data-q-idx"), 10);
                const val = Math.min(Number(e.target.max) || 1, Math.max(0, Number(e.target.value) || 0));
                if (questions[qIdx]) {
                    questions[qIdx].awardedMarks = val;
                    questions[qIdx].status = val === questions[qIdx].maxMarks ? "correct" : (val > 0 ? "partial" : "wrong");
                }
                updateLiveTotal();
            });
        });

        // Subquestion mark input listener
        modalRoot.querySelectorAll(".inp-subq-mark").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const qIdx = parseInt(e.target.getAttribute("data-q-idx"), 10);
                const subIdx = parseInt(e.target.getAttribute("data-sub-idx"), 10);
                const val = Math.min(Number(e.target.max) || 1, Math.max(0, Number(e.target.value) || 0));
                if (questions[qIdx] && questions[qIdx].subQuestions && questions[qIdx].subQuestions[subIdx]) {
                    questions[qIdx].subQuestions[subIdx].awardedMarks = val;
                }
                updateLiveTotal();
            });
        });

        // Quick Apply Total Button
        modalRoot.querySelector("#btn-modal-apply-total")?.addEventListener("click", () => {
            const targetTotal = Math.min(maxM, Math.max(0, Number(totalInp?.value) || 0));
            let remaining = targetTotal;

            questions.forEach(q => {
                if (q.hasSubQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
                    let qSum = 0;
                    q.subQuestions.forEach(sq => {
                        const alloc = Math.min(remaining, sq.maxMarks);
                        sq.awardedMarks = alloc;
                        remaining = Math.max(0, remaining - alloc);
                        qSum += alloc;
                    });
                    q.awardedMarks = qSum;
                    q.status = qSum === q.maxMarks ? "correct" : (qSum > 0 ? "partial" : "wrong");
                } else {
                    const alloc = Math.min(remaining, q.maxMarks);
                    q.awardedMarks = alloc;
                    remaining = Math.max(0, remaining - alloc);
                    q.status = alloc === q.maxMarks ? "correct" : (alloc > 0 ? "partial" : "wrong");
                }
            });

            // Re-render modal to reflect changes
            this.openMarksEntryModal({
                ...evalItem,
                obtainedMarks: targetTotal,
                questions: questions
            });
        });

        // All Full Marks
        modalRoot.querySelector("#btn-modal-all-full")?.addEventListener("click", () => {
            questions.forEach(q => {
                q.awardedMarks = q.maxMarks;
                q.status = "correct";
                if (q.hasSubQuestions && Array.isArray(q.subQuestions)) {
                    q.subQuestions.forEach(sq => { sq.awardedMarks = sq.maxMarks; });
                }
            });
            this.openMarksEntryModal({
                ...evalItem,
                obtainedMarks: maxM,
                questions: questions
            });
        });

        // All Zero Marks
        modalRoot.querySelector("#btn-modal-all-zero")?.addEventListener("click", () => {
            questions.forEach(q => {
                q.awardedMarks = 0;
                q.status = "wrong";
                if (q.hasSubQuestions && Array.isArray(q.subQuestions)) {
                    q.subQuestions.forEach(sq => { sq.awardedMarks = 0; });
                }
            });
            this.openMarksEntryModal({
                ...evalItem,
                obtainedMarks: 0,
                questions: questions
            });
        });

        // Save & Apply Marks
        modalRoot.querySelector("#btn-save-marks-modal")?.addEventListener("click", async () => {
            const finalTotal = updateLiveTotal();
            const pct = maxM > 0 ? Math.round((finalTotal / maxM) * 100) : 0;
            const grade = pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F";
            const isAllAnswered = questions.every(q => q.status && q.status !== "unmarked" && q.status !== "pending");
            const newStatus = finalTotal > 0 ? (isAllAnswered ? "Completed" : "In Progress") : "Pending";

            evalItem.questions = questions;
            evalItem.obtainedMarks = finalTotal;
            evalItem.percentage = pct;
            evalItem.grade = grade;
            evalItem.status = newStatus;
            evalItem.updatedAt = new Date().toISOString();

            if (window.appStorage) {
                await window.appStorage.saveEvaluation(evalItem);
            }

            closeModal();
            this.render();
            if (this.options.onShowToast) {
                this.options.onShowToast(`Marks updated for ${evalItem.studentName || 'Student'}: ${finalTotal}/${maxM} Marks (${pct}%)`, "success");
            }
        });
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
                            // Distribute into subquestions
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
                    ev.status = ev.questions.every(q => q.status && q.status !== "unmarked" && q.status !== "pending") ? "Completed" : "In Progress";
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

    exportMarksToExcel() {
        const filtered = this.getFilteredEvaluations();
        if (filtered.length === 0) {
            if (this.options.onShowToast) this.options.onShowToast("No marks data to export.", "warning");
            return;
        }

        const headers = ["Roll No", "Student Name", "Class", "Subject", "Blueprint", "Status", "Obtained Marks", "Max Marks", "Percentage", "Grade", "Questions Breakdown"];
        const rows = filtered.map(p => {
            const obt = Number(p.obtainedMarks) || 0;
            const maxM = Number(p.maxMarks) || 40;
            const pct = p.percentage !== undefined ? p.percentage : (maxM > 0 ? Math.round((obt / maxM) * 100) : 0);
            const grade = p.grade || (pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F");
            const qStr = (p.questions || []).map(q => `${q.label || `Q${q.qNo}`}:${q.awardedMarks || 0}/${q.maxMarks}M`).join(' | ');

            return [
                `"${p.rollNo || ''}"`,
                `"${(p.studentName || '').replace(/"/g, '""')}"`,
                `"${(p.className || p.class || '').replace(/"/g, '""')}"`,
                `"${(p.subject || '').replace(/"/g, '""')}"`,
                `"${(p.templateName || p.examName || '').replace(/"/g, '""')}"`,
                `"${p.status || 'Pending'}"`,
                obt,
                maxM,
                `${pct}%`,
                `"${grade}"`,
                `"${qStr.replace(/"/g, '""')}"`
            ].join(',');
        });

        const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        a.download = `Correction_Marks_Ledger_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        if (this.options.onShowToast) {
            this.options.onShowToast("Marks ledger exported successfully!");
        }
    }
}

window.CorrectionMarksPageManager = CorrectionMarksPageManager;
