/**
 * OneSpace Digital Correction - Student Evaluation History
 * Search & filter evaluation archives by Student Name, Register No, Class, Subject, Exam.
 * Allows instant viewing, continuing correction, and re-downloading PDFs.
 */

class EvaluationHistoryManager {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = Object.assign({
            onOpenEvaluation: null,
            onDownloadPDF: null
        }, options);

        this.evaluations = [];
        this.filteredList = [];
    }

    async init() {
        if (!this.container) return;
        this.evaluations = await window.appStorage.getAllEvaluations();
        this.filteredList = [...this.evaluations];
        this.render();
        this.bindEvents();
    }

    render() {
        const ic = window.Icons || {};

        this.container.innerHTML = `
            <div class="history-page">
                <div class="page-header-row">
                    <div>
                        <h2 class="page-title">Student Evaluation History</h2>
                        <p class="page-subtitle">Search, view, and retrieve corrected student papers and marks</p>
                    </div>
                </div>

                <!-- Comprehensive Search Bar & Filter Controls -->
                <div class="search-filter-card">
                    <div class="search-input-wrap">
                        <span class="search-icon">${ic.search || ''}</span>
                        <input type="text" id="history-search-input" class="history-search-field" 
                            placeholder="Search by student name, roll number, or exam title..." />
                    </div>
                    <div class="filter-dropdowns-row">
                        <select id="hist-filter-class" class="form-select-sm">
                            <option value="all">All Classes</option>
                        </select>
                        <select id="hist-filter-subject" class="form-select-sm">
                            <option value="all">All Subjects</option>
                        </select>
                        <select id="hist-filter-status" class="form-select-sm">
                            <option value="all">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                </div>

                <!-- History Table View -->
                <div class="history-table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Student Details</th>
                                <th>Register No</th>
                                <th>Class & Sec</th>
                                <th>Subject</th>
                                <th>Exam Name</th>
                                <th>Exam Date</th>
                                <th>Marks Obtained</th>
                                <th>Status</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="history-tbody">
                            <!-- Dynamic rows -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.populateDropdowns();
        this.renderRows();
    }

    populateDropdowns() {
        const classSelect = this.container.querySelector("#hist-filter-class");
        const subjSelect = this.container.querySelector("#hist-filter-subject");

        if (classSelect) {
            const classes = [...new Set(this.evaluations.map(e => e.class).filter(Boolean))];
            classes.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = c;
                classSelect.appendChild(opt);
            });
        }

        if (subjSelect) {
            const subjects = [...new Set(this.evaluations.map(e => e.subject).filter(Boolean))];
            subjects.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s;
                opt.textContent = s;
                subjSelect.appendChild(opt);
            });
        }
    }

    renderRows() {
        const tbody = this.container.querySelector("#history-tbody");
        if (!tbody) return;

        if (this.filteredList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="empty-state-cell">No matching student evaluation records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.filteredList.map(ev => {
            const isCompleted = ev.status === "Completed";
            const statusClass = isCompleted ? "badge-completed" : "badge-pending";

            return `
                <tr>
                    <td>
                        <div class="student-name-block">
                            <span class="student-display-name">${ev.studentName || "Unnamed"}</span>
                        </div>
                    </td>
                    <td class="font-mono font-bold">${ev.rollNo || "-"}</td>
                    <td>${ev.class || ""} - ${ev.section || ""}</td>
                    <td class="font-medium">${ev.subject || "-"}</td>
                    <td>${ev.examName || "-"}</td>
                    <td class="text-muted font-sm">${ev.examDate || "-"}</td>
                    <td>
                        <div class="history-score-cell">
                            <span class="score-number font-bold">${ev.obtainedMarks || 0}</span>
                            <span class="text-muted">/ ${ev.maxMarks || 0}</span>
                            <span class="score-pct-tag">(${ev.percentage || 0}%)</span>
                        </div>
                    </td>
                    <td>
                        <span class="status-pill ${statusClass}">${ev.status || "Pending"}</span>
                    </td>
                    <td class="text-right">
                        <div class="action-btn-group">
                            <button type="button" class="btn-action-view btn-hist-open" data-id="${ev.id}">
                                ${isCompleted ? 'View Paper' : 'Continue'}
                            </button>
                            <button type="button" class="btn-action-pdf btn-hist-pdf" data-id="${ev.id}" title="Download Corrected PDF">
                                ${(window.Icons && window.Icons.pdf) || ''} PDF
                            </button>
                            <button type="button" class="btn-action-delete btn-hist-delete" data-id="${ev.id}" title="Delete Physics Paper" style="background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); color: #DC2626; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
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
        const searchInp = this.container.querySelector("#history-search-input");
        const classSel = this.container.querySelector("#hist-filter-class");
        const subjSel = this.container.querySelector("#hist-filter-subject");
        const statusSel = this.container.querySelector("#hist-filter-status");

        const triggerFilter = () => {
            const query = (searchInp?.value || "").toLowerCase().trim();
            const classVal = classSel?.value || "all";
            const subjVal = subjSel?.value || "all";
            const statusVal = statusSel?.value || "all";

            this.filteredList = this.evaluations.filter(e => {
                if (query) {
                    const matchName = (e.studentName || "").toLowerCase().includes(query);
                    const matchRoll = (e.rollNo || "").toLowerCase().includes(query);
                    const matchExam = (e.examName || "").toLowerCase().includes(query);
                    const matchSubj = (e.subject || "").toLowerCase().includes(query);
                    if (!matchName && !matchRoll && !matchExam && !matchSubj) return false;
                }

                if (classVal !== "all" && e.class !== classVal) return false;
                if (subjVal !== "all" && e.subject !== subjVal) return false;
                if (statusVal !== "all" && e.status !== statusVal) return false;

                return true;
            });

            this.renderRows();
        };

        if (searchInp) searchInp.addEventListener("input", triggerFilter);
        if (classSel) classSel.addEventListener("change", triggerFilter);
        if (subjSel) subjSel.addEventListener("change", triggerFilter);
        if (statusSel) statusSel.addEventListener("change", triggerFilter);

        // Action triggers
        const tbody = this.container.querySelector("#history-tbody");
        if (tbody) {
            tbody.addEventListener("click", async (e) => {
                const openBtn = e.target.closest(".btn-hist-open");
                if (openBtn) {
                    const id = openBtn.getAttribute("data-id");
                    const ev = await window.appStorage.getEvaluationById(id);
                    if (ev && this.options.onOpenEvaluation) {
                        this.options.onOpenEvaluation(ev);
                    }
                }

                const pdfBtn = e.target.closest(".btn-hist-pdf");
                if (pdfBtn) {
                    const id = pdfBtn.getAttribute("data-id");
                    const ev = await window.appStorage.getEvaluationById(id);
                    if (ev && this.options.onDownloadPDF) {
                        this.options.onDownloadPDF(ev);
                    }
                }

                const delBtn = e.target.closest(".btn-hist-delete");
                if (delBtn) {
                    const id = delBtn.getAttribute("data-id");
                    const ev = await window.appStorage.getEvaluationById(id);
                    const name = ev ? (ev.studentName || "student paper") : "this paper";
                    if (confirm(`Are you sure you want to delete ${name}'s Physics paper? This action cannot be undone.`)) {
                        await window.appStorage.deleteEvaluation(id);
                        this.evaluations = await window.appStorage.getAllEvaluations();
                        triggerFilter();
                        if (window.appInstance) {
                            await window.appInstance.loadEvaluations();
                            if (window.appInstance.showToast) {
                                window.appInstance.showToast(`Deleted ${name}'s Physics paper`);
                            }
                        }
                    }
                }
            });
        }
    }
}

window.EvaluationHistoryManager = EvaluationHistoryManager;
