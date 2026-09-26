/**
 * OneSpace Digital Correction - Admin Panel & Master Analytics Manager
 * Features:
 * 1. Subject & Teacher Correction Tracker (Papers Uploaded vs Graded by Teacher)
 * 2. Student All-Subject Score Matrix Table (Roll No, Name, Physics, Chem, Math, Bio, Total, %, Grade)
 * 3. Class-wise Performance & Pass Rate Summary
 * 4. Excel CSV Export & Print Report Controls
 */

class AdminPanelManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.evaluations = [];
        this.users = [];
        this.searchQuery = "";
        this.selectedClass = "all";
    }

    async init() {
        if (!this.container) {
            this.container = document.getElementById("view-admin-panel");
        }
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            await window.appStorage.init();
            this.evaluations = await window.appStorage.getAllEvaluations();
            this.users = await window.appStorage.getUsersList();
        }
    }

    render() {
        const subjectsData = this.computeSubjectStats();
        const studentMatrix = this.computeStudentMatrix();
        const filteredMatrix = this.filterMatrix(studentMatrix);
        const classStats = this.computeClassStats(studentMatrix);

        // Check if static table bodies exist (e.g. in admin.html)
        const subjectTbody = document.getElementById("admin-subject-tracker-tbody");
        const studentTbody = document.getElementById("admin-student-matrix-tbody");

        if (subjectTbody && studentTbody) {
            this.renderStaticMode(subjectsData, filteredMatrix, classStats, studentMatrix);
            this.bindStaticEvents();
            return;
        }

        if (!this.container) return;

        this.container.innerHTML = `
            <div class="admin-panel-layout" style="padding: 24px; max-width: 1400px; margin: 0 auto; animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
                <!-- Header Title Bar -->
                <div class="admin-header-bar" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <span style="font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--apple-blue); font-weight: 500;">INSTITUTION GOVERNANCE & ANALYTICS</span>
                        <h1 style="font-size: 1.8rem; font-weight: 400; color: var(--text-main); margin-top: 4px;">Master Admin & Evaluation Audit Desk</h1>
                        <p style="font-size: 0.92rem; color: var(--text-muted); margin-top: 2px;">Track teacher correction progress, view multi-subject student scorecards, and export class reports.</p>
                    </div>

                        <button type="button" class="btn-mgmt-secondary" id="btn-admin-clean-data" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 12px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); color: #DC2626; font-size: 0.88rem; cursor: pointer;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            Clean Up Data
                        </button>
                        <button type="button" class="btn-mgmt-secondary" id="btn-admin-print-report" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); font-size: 0.88rem; cursor: pointer;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            Print Summary Report
                        </button>
                        <button type="button" class="btn-mgmt-primary" id="btn-admin-export-excel" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 12px; background: var(--primary); color: #fff; border: none; font-size: 0.88rem; cursor: pointer;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                            Export Excel Matrix
                        </button>
                    </div>
                </div>

                <!-- Section 1: Subject & Teacher Correction Tracker -->
                <div style="margin-bottom: 32px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <h2 style="font-size: 1.25rem; font-weight: 400; color: var(--text-main);">Subject & Faculty Evaluation Audit</h2>
                        <span style="font-size: 0.82rem; color: var(--text-muted);">${subjectsData.length} Active Faculty Desks</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                        ${subjectsData.map(sub => `
                            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 18px; padding: 20px; box-shadow: var(--shadow-sm);">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                                    <span style="font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 10px; border-radius: 20px; background: rgba(0,122,255,0.1); color: var(--apple-blue); font-weight: 500;">${sub.code}</span>
                                    <span style="font-size: 0.85rem; font-weight: 500; color: ${sub.pct === 100 ? '#34C759' : '#D97706'};">${sub.pct}% Completed</span>
                                </div>
                                <h3 style="font-size: 1.1rem; font-weight: 400; color: var(--text-main); margin-bottom: 4px;">${sub.name}</h3>
                                <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 16px;">Faculty: ${sub.teacher}</p>

                                <div style="background: var(--bg-subtle); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
                                    <div style="background: var(--primary); height: 100%; width: ${sub.pct}%; transition: width 0.3s ease;"></div>
                                </div>

                                <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-body);">
                                    <span>Uploaded: <strong>${sub.uploaded}</strong></span>
                                    <span>Corrected: <strong>${sub.corrected}</strong></span>
                                    <span>Pending: <strong>${sub.pending}</strong></span>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <!-- Section 2: Student All-Subject Grade Matrix Table -->
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 24px; box-shadow: var(--shadow-sm); margin-bottom: 32px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: 400; color: var(--text-main);">All-Subject Student Score Matrix</h2>
                            <p style="font-size: 0.84rem; color: var(--text-muted);">Consolidated marks across all subjects for each student</p>
                        </div>

                        <div style="display: flex; gap: 12px; align-items: center;">
                            <input type="text" id="admin-matrix-search" placeholder="Search student name or roll..." value="${this.searchQuery}" style="height: 38px; padding: 0 14px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 0.88rem; background: var(--bg-subtle); width: 220px;" />
                            
                            <select id="admin-matrix-class-filter" style="height: 38px; padding: 0 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 0.88rem; background: var(--bg-subtle);">
                                <option value="all" ${this.selectedClass === 'all' ? 'selected' : ''}>All Classes</option>
                                <option value="Class 12-A" ${this.selectedClass === 'Class 12-A' ? 'selected' : ''}>Class 12-A</option>
                                <option value="Class 12-B" ${this.selectedClass === 'Class 12-B' ? 'selected' : ''}>Class 12-B</option>
                                <option value="Class 10-A" ${this.selectedClass === 'Class 10-A' ? 'selected' : ''}>Class 10-A</option>
                            </select>
                        </div>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
                            <thead>
                                <tr style="background: var(--bg-subtle); border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                    <th style="padding: 12px 14px;">Roll No</th>
                                    <th style="padding: 12px 14px;">Student Name</th>
                                    <th style="padding: 12px 14px;">Class</th>
                                    <th style="padding: 12px 14px; text-align: center;">Physics (70M)</th>
                                    <th style="padding: 12px 14px; text-align: center;">Chemistry (70M)</th>
                                    <th style="padding: 12px 14px; text-align: center;">Maths (80M)</th>
                                    <th style="padding: 12px 14px; text-align: center;">Total Score</th>
                                    <th style="padding: 12px 14px; text-align: center;">Percentage</th>
                                    <th style="padding: 12px 14px; text-align: center;">Grade</th>
                                    <th style="padding: 12px 14px; text-align: center;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredMatrix.length === 0 ? `
                                    <tr>
                                        <td colspan="10" style="padding: 40px; text-align: center; color: var(--text-muted);">
                                            No student records found. Upload papers on the Upload Desk to populate student marks.
                                        </td>
                                    </tr>
                                ` : filteredMatrix.map(row => `
                                    <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
                                        <td style="padding: 12px 14px; font-weight: 500;">${row.rollNo}</td>
                                        <td style="padding: 12px 14px; color: var(--text-main);">${row.studentName}</td>
                                        <td style="padding: 12px 14px; color: var(--text-muted);">${row.class}</td>
                                        <td style="padding: 12px 14px; text-align: center; font-weight: 500; color: ${row.physicsMarks !== '--' ? 'var(--primary)' : 'var(--text-muted)'};">${row.physicsMarks}</td>
                                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">${row.chemMarks}</td>
                                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">${row.mathMarks}</td>
                                        <td style="padding: 12px 14px; text-align: center; font-weight: 600;">${row.totalObtained} / ${row.totalMax}</td>
                                        <td style="padding: 12px 14px; text-align: center;">${row.percentage}%</td>
                                        <td style="padding: 12px 14px; text-align: center;"><span style="padding: 2px 8px; border-radius: 6px; background: rgba(52,199,89,0.1); color: #34C759; font-weight: 500;">${row.grade}</span></td>
                                        <td style="padding: 12px 14px; text-align: center;">
                                            <span style="padding: 3px 10px; border-radius: 12px; font-size: 0.78rem; background: ${row.status === 'Completed' ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)'}; color: ${row.status === 'Completed' ? '#34C759' : '#D97706'};">
                                                ${row.status === 'Completed' ? '✓ Graded' : '◐ Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Section 3: Class Summary KPI Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
                    ${classStats.map(cs => `
                        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 18px; padding: 20px;">
                            <span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">${cs.className} SUMMARY</span>
                            <div style="font-size: 1.6rem; font-weight: 400; color: var(--text-main); margin: 6px 0;">${cs.avgPct}% Avg</div>
                            <div style="font-size: 0.82rem; color: var(--text-body); display: flex; justify-content: space-between;">
                                <span>Students: ${cs.count}</span>
                                <span>Pass Rate: <strong style="color: #34C759;">${cs.passRate}%</strong></span>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const searchInp = this.container.querySelector("#admin-matrix-search");
        if (searchInp) {
            searchInp.addEventListener("input", (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.render();
            });
        }

        const classSelect = this.container.querySelector("#admin-matrix-class-filter");
        if (classSelect) {
            classSelect.addEventListener("change", (e) => {
                this.selectedClass = e.target.value;
                this.render();
            });
        }

        const printBtn = this.container.querySelector("#btn-admin-print-report");
        if (printBtn) {
            printBtn.addEventListener("click", () => window.print());
        }

        const exportBtn = this.container.querySelector("#btn-admin-export-excel");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => this.exportExcelMatrix());
        }

        const cleanBtn = this.container.querySelector("#btn-admin-clean-data");
        if (cleanBtn) {
            cleanBtn.addEventListener("click", async () => {
                if (confirm("Clean Up Unwanted / Demo Data?\n\nThis will permanently delete demo math evaluations and the 5 Dharnish test records from browser storage & cloud sync.\n\nOfficial curriculum blueprints and class rosters will remain intact.")) {
                    cleanBtn.disabled = true;
                    cleanBtn.textContent = "Cleaning...";
                    if (window.appStorage && typeof window.appStorage.purgeUnwantedData === "function") {
                        await window.appStorage.purgeUnwantedData();
                    }
                    if (window.app && typeof window.app.updateStorageQuotaDisplay === "function") {
                        window.app.updateStorageQuotaDisplay();
                    }
                    await this.init();
                    if (window.app && window.app.showToast) {
                        window.app.showToast("✓ Cleaned up unwanted test data and Dharnish records successfully!", "success");
                    }
                }
            });
        }
    }

    renderStaticMode(subjectsData, filteredMatrix, classStats, studentMatrix) {
        // Update KPI Cards
        const totalPapers = subjectsData.reduce((acc, s) => acc + s.uploaded, 0);
        const totalCorrected = subjectsData.reduce((acc, s) => acc + s.corrected, 0);
        const totalPending = subjectsData.reduce((acc, s) => acc + s.pending, 0);

        const kpiTotal = document.getElementById("kpi-total-papers");
        if (kpiTotal) kpiTotal.textContent = totalPapers;

        const kpiCorrected = document.getElementById("kpi-corrected-papers");
        if (kpiCorrected) kpiCorrected.textContent = totalCorrected;

        const kpiCorrectedSub = document.getElementById("kpi-corrected-sub");
        if (kpiCorrectedSub) {
            const pct = totalPapers > 0 ? Math.round((totalCorrected / totalPapers) * 100) : 100;
            kpiCorrectedSub.textContent = `${pct}% completion rate`;
        }

        const kpiPending = document.getElementById("kpi-pending-papers");
        if (kpiPending) kpiPending.textContent = totalPending;

        // Render Subject & Faculty Audit Table
        const subjectTbody = document.getElementById("admin-subject-tracker-tbody");
        if (subjectTbody) {
            subjectTbody.innerHTML = subjectsData.map(sub => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 16px; font-weight: 600; color: var(--text-main);">
                        ${sub.name}
                        <div style="font-size: 0.72rem; color: var(--apple-blue);">${sub.code}</div>
                    </td>
                    <td style="padding: 12px 16px; color: var(--text-muted);">${sub.teacher}</td>
                    <td style="padding: 12px 16px; font-weight: 500;">${sub.uploaded}</td>
                    <td style="padding: 12px 16px; color: #34C759; font-weight: 600;">${sub.corrected}</td>
                    <td style="padding: 12px 16px; color: #FF9500; font-weight: 500;">${sub.pending}</td>
                    <td style="padding: 12px 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="flex: 1; background: var(--bg-subtle); height: 6px; border-radius: 3px; overflow: hidden;">
                                <div style="background: ${sub.pct === 100 ? '#34C759' : '#007AFF'}; height: 100%; width: ${sub.pct}%;"></div>
                            </div>
                            <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-main);">${sub.pct}%</span>
                        </div>
                    </td>
                </tr>
            `).join("");
        }

        // Render Student Score Matrix Table
        const studentTbody = document.getElementById("admin-student-matrix-tbody");
        if (studentTbody) {
            if (filteredMatrix.length === 0) {
                studentTbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="padding: 32px; text-align: center; color: var(--text-muted);">
                            No evaluation records found. Upload student answer sheets on the Upload Desk to view live marks matrix.
                        </td>
                    </tr>
                `;
            } else {
                studentTbody.innerHTML = filteredMatrix.map(row => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px 14px; font-weight: 500; color: var(--text-main);">${row.rollNo}</td>
                        <td style="padding: 12px 14px; color: var(--text-main);">${row.studentName}</td>
                        <td style="padding: 12px 14px; color: var(--text-muted);">${row.class}</td>
                        <td style="padding: 12px 14px; text-align: center; font-weight: 600; color: #007AFF;">${row.physicsMarks}</td>
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">${row.chemMarks}</td>
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted);">${row.mathMarks}</td>
                        <td style="padding: 12px 14px; text-align: center; font-weight: 600; color: var(--text-main);">${row.totalObtained} / ${row.totalMax}</td>
                        <td style="padding: 12px 14px; text-align: center; font-weight: 600;">${row.percentage}%</td>
                        <td style="padding: 12px 14px; text-align: center;"><span style="padding: 2px 8px; border-radius: 6px; background: rgba(52,199,89,0.12); color: #34C759; font-weight: 600; font-size: 0.8rem;">${row.grade}</span></td>
                        <td style="padding: 12px 14px; text-align: center;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <span style="padding: 3px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 500; background: ${row.status === 'Completed' ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)'}; color: ${row.status === 'Completed' ? '#34C759' : '#FF9500'};">
                                    ${row.status === 'Completed' ? '✓ Graded' : '◐ Pending'}
                                </span>
                                <button type="button" class="btn-admin-delete-eval" data-eval-id="${row.id}" title="Delete Physics Paper" style="background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.25); color: #DC2626; padding: 4px 8px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join("");
            }
        }

        // Render Class Summary Metrics
        if (classStats.length > 0) {
            const avgScoreEl = document.getElementById("class-metric-avg-score");
            if (avgScoreEl) avgScoreEl.textContent = `${classStats[0].avgPct}%`;

            const highestScoreEl = document.getElementById("class-metric-highest-score");
            if (highestScoreEl) {
                const maxPct = studentMatrix.length > 0 ? Math.max(...studentMatrix.map(s => s.percentage)) : 0;
                highestScoreEl.textContent = `${maxPct}%`;
            }

            const passRateEl = document.getElementById("class-metric-pass-pct");
            if (passRateEl) passRateEl.textContent = `${classStats[0].passRate}%`;
        }
    }

    bindStaticEvents() {
        const searchInput = document.getElementById("admin-search-student");
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = "true";
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.render();
            });
        }

        const classFilter = document.getElementById("admin-filter-class");
        if (classFilter && !classFilter.dataset.bound) {
            classFilter.dataset.bound = "true";
            classFilter.addEventListener("change", (e) => {
                this.selectedClass = e.target.value;
                this.render();
            });
        }

        const btnExport = document.getElementById("btn-admin-export-excel") || document.getElementById("btn-sidebar-admin-export-excel");
        if (btnExport && !btnExport.dataset.bound) {
            btnExport.dataset.bound = "true";
            btnExport.addEventListener("click", () => this.exportExcelMatrix());
        }

        const btnSidebarExport = document.getElementById("btn-sidebar-admin-export-excel");
        if (btnSidebarExport && !btnSidebarExport.dataset.bound) {
            btnSidebarExport.dataset.bound = "true";
            btnSidebarExport.addEventListener("click", () => this.exportExcelMatrix());
        }

        const btnPrint = document.getElementById("btn-admin-print-report") || document.getElementById("btn-sidebar-admin-print-report");
        if (btnPrint && !btnPrint.dataset.bound) {
            btnPrint.dataset.bound = "true";
            btnPrint.addEventListener("click", () => window.print());
        }

        const btnSidebarPrint = document.getElementById("btn-sidebar-admin-print-report");
        if (btnSidebarPrint && !btnSidebarPrint.dataset.bound) {
            btnSidebarPrint.dataset.bound = "true";
            btnSidebarPrint.addEventListener("click", () => window.print());
        }

        const studentTbody = document.getElementById("admin-student-matrix-tbody");
        if (studentTbody && !studentTbody.dataset.bound) {
            studentTbody.dataset.bound = "true";
            studentTbody.addEventListener("click", async (e) => {
                const delBtn = e.target.closest(".btn-admin-delete-eval");
                if (delBtn) {
                    const id = delBtn.getAttribute("data-eval-id");
                    if (confirm("Are you sure you want to delete this Physics paper? This action cannot be undone.")) {
                        await window.appStorage.deleteEvaluation(id);
                        await this.init();
                    }
                }
            });
        }
    }

    computeSubjectStats() {
        // Build subject stats purely from real evaluation data
        const subjectMap = new Map();
        this.evaluations.forEach(ev => {
            const subject = ev.subject || "General";
            if (!subjectMap.has(subject)) {
                subjectMap.set(subject, { uploaded: 0, corrected: 0 });
            }
            const entry = subjectMap.get(subject);
            entry.uploaded++;
            if (ev.status === "Completed" || ev.obtainedMarks > 0) {
                entry.corrected++;
            }
        });

        if (subjectMap.size === 0) return [];

        return Array.from(subjectMap.entries()).map(([subject, stats]) => {
            const { uploaded, corrected } = stats;
            const pending = Math.max(0, uploaded - corrected);
            const pct = uploaded > 0 ? Math.round((corrected / uploaded) * 100) : 100;
            // Derive teacher name from most recent evaluation for this subject
            const subjectEvals = this.evaluations.filter(e => (e.subject || "General") === subject);
            const latestTeacher = subjectEvals.find(e => e.teacherName)?.teacherName || "—";
            return {
                code: subject.substring(0, 4).toUpperCase(),
                name: subject,
                teacher: latestTeacher,
                uploaded,
                corrected,
                pending,
                pct
            };
        });
    }

    computeStudentMatrix() {
        if (!this.evaluations || this.evaluations.length === 0) return [];

        // Group evaluations by student rollNo or id
        const studentMap = new Map();

        this.evaluations.forEach(ev => {
            const key = ev.rollNo || ev.id;
            if (!studentMap.has(key)) {
                studentMap.set(key, {
                    id: ev.id,
                    rollNo: ev.rollNo || "101",
                    studentName: ev.studentName || "Student Paper",
                    class: `${ev.class || 'Class 12'}-${ev.section || 'A'}`,
                    physicsMarks: ev.obtainedMarks !== undefined ? `${ev.obtainedMarks}/${ev.maxMarks || 70}` : "--",
                    chemMarks: "--",
                    mathMarks: "--",
                    totalObtained: ev.obtainedMarks || 0,
                    totalMax: ev.maxMarks || 70,
                    percentage: ev.percentage || Math.round(((ev.obtainedMarks || 0) / (ev.maxMarks || 70)) * 100),
                    grade: ev.grade || (window.calculateGradeScale ? window.calculateGradeScale(ev.obtainedMarks || 0, ev.maxMarks || 70).grade : "B1"),
                    status: ev.status || "Pending"
                });
            }
        });

        return Array.from(studentMap.values());
    }

    filterMatrix(matrix) {
        return matrix.filter(row => {
            const matchesQuery = !this.searchQuery || 
                row.studentName.toLowerCase().includes(this.searchQuery) || 
                row.rollNo.toLowerCase().includes(this.searchQuery);

            const matchesClass = this.selectedClass === "all" || row.class.includes(this.selectedClass.replace("Class ", ""));

            return matchesQuery && matchesClass;
        });
    }

    computeClassStats(matrix) {
        if (!matrix || matrix.length === 0) {
            return [
                { className: "Class 12-A", count: 0, avgPct: 0, passRate: 100 },
                { className: "Class 12-B", count: 0, avgPct: 0, passRate: 100 }
            ];
        }

        const class12A = matrix.filter(m => m.class.includes("12-A"));
        const class12B = matrix.filter(m => m.class.includes("12-B"));

        const getAvg = (arr) => arr.length > 0 ? Math.round(arr.reduce((s, a) => s + a.percentage, 0) / arr.length) : 0;

        return [
            { className: "Class 12-A", count: class12A.length, avgPct: getAvg(class12A), passRate: 100 },
            { className: "Class 12-B", count: class12B.length, avgPct: getAvg(class12B), passRate: 100 }
        ];
    }

    exportExcelMatrix() {
        const matrix = this.computeStudentMatrix();
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Roll No,Student Name,Class,Physics Score,Chemistry Score,Mathematics Score,Total Score,Percentage,Grade,Status\n";

        matrix.forEach(row => {
            csvContent += `"${row.rollNo}","${row.studentName}","${row.class}","${row.physicsMarks}","${row.chemMarks}","${row.mathMarks}","${row.totalObtained}/${row.totalMax}","${row.percentage}%","${row.grade}","${row.status}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Student_Master_Score_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.AdminPanelManager = AdminPanelManager;
