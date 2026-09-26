/**
 * OneSpace Digital Correction - Bulk Mark Report Generator
 * Supports class/exam filtering, multi-student selection, sorting,
 * Landscape A4 PDF generation with repeated headers & pagination, and CSV/Excel export.
 */

class BulkReportManager {
    constructor(containerElement) {
        this.container = containerElement;
        this.evaluations = [];
        this.filteredEvaluations = [];
        this.selectedIds = new Set();
        this.sortBy = "rollNo"; // "rollNo", "name", "score"
        this.sortAsc = true;
    }

    async init() {
        if (!this.container) return;
        this.evaluations = await window.appStorage.getAllEvaluations();
        this.render();
        this.applyFilter();
    }

    render() {
        // Collect distinct filters
        const exams = [...new Set(this.evaluations.map(e => e.examName).filter(Boolean))];
        const classes = [...new Set(this.evaluations.map(e => e.class).filter(Boolean))];
        const sections = [...new Set(this.evaluations.map(e => e.section).filter(Boolean))];
        const subjects = [...new Set(this.evaluations.map(e => e.subject).filter(Boolean))];

        const ic = window.Icons || {};

        this.container.innerHTML = `
            <div class="bulk-report-page">
                <div class="bulk-cobrand-strip">
                    <div class="bulk-school-badge">
                        <img src="assets/school_fulllogo.jpg" alt="Client School" class="bulk-school-logo-img" />
                        <span class="bulk-school-name">Adwaith Thought Academy</span>
                    </div>
                    <div class="bulk-badge-divider"></div>
                    <div class="bulk-app-badge">
                        <img src="assets/fulllogo.png" alt="Niprak OSM" class="bulk-app-logo-img" />
                        <span class="bulk-app-tag">Official Evaluation System</span>
                    </div>
                </div>

                <div class="page-header-row">
                    <div>
                        <h2 class="page-title">Bulk Mark Report Generator</h2>
                        <p class="page-subtitle">Consolidate multiple student answer sheet evaluations into a unified class tabulation sheet</p>
                    </div>
                    <div class="header-actions-group">
                        <button type="button" class="btn-secondary" id="btn-export-csv">
                            <span class="btn-icon">${ic.csv || ''}</span> Export CSV / Excel
                        </button>
                        <button type="button" class="btn-primary" id="btn-generate-bulk-pdf">
                            <span class="btn-icon">${ic.pdf || ''}</span> Download Landscape PDF
                        </button>
                    </div>
                </div>

                <!-- Filter Strip -->
                <div class="filter-card">
                    <div class="filter-grid">
                        <div class="form-group">
                            <label>Examination</label>
                            <select id="bulk-filter-exam" class="form-select">
                                <option value="all">All Examinations</option>
                                ${exams.map(x => `<option value="${x}">${x}</option>`).join("")}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Class</label>
                            <select id="bulk-filter-class" class="form-select">
                                <option value="all">All Classes</option>
                                ${classes.map(c => `<option value="${c}">${c}</option>`).join("")}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Section</label>
                            <select id="bulk-filter-section" class="form-select">
                                <option value="all">All Sections</option>
                                ${sections.map(s => `<option value="${s}">${s}</option>`).join("")}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Subject</label>
                            <select id="bulk-filter-subject" class="form-select">
                                <option value="all">All Subjects</option>
                                ${subjects.map(s => `<option value="${s}">${s}</option>`).join("")}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Selection & Table Tools -->
                <div class="table-tools-row">
                    <div class="selection-counter">
                        <label class="checkbox-label">
                            <input type="checkbox" id="bulk-select-all" checked />
                            <span>Select All Students (<span id="bulk-selected-count">0</span> selected)</span>
                        </label>
                    </div>
                    <div class="sort-controls">
                        <span class="sort-label">Sort by:</span>
                        <button type="button" class="btn-sort ${this.sortBy === 'rollNo' ? 'active' : ''}" data-sort="rollNo">Reg No</button>
                        <button type="button" class="btn-sort ${this.sortBy === 'name' ? 'active' : ''}" data-sort="name">Student Name</button>
                        <button type="button" class="btn-sort ${this.sortBy === 'score' ? 'active' : ''}" data-sort="score">Total Score</button>
                    </div>
                </div>

                <!-- Tabulation Table Preview -->
                <div class="tabulation-table-wrap">
                    <table class="report-table" id="bulk-report-table">
                        <thead id="bulk-table-head">
                            <!-- Dynamic head -->
                        </thead>
                        <tbody id="bulk-table-body">
                            <!-- Dynamic rows -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Filters
        ["bulk-filter-exam", "bulk-filter-class", "bulk-filter-section", "bulk-filter-subject"].forEach(id => {
            const el = this.container.querySelector(`#${id}`);
            if (el) {
                el.addEventListener("change", () => this.applyFilter());
            }
        });

        // Select all
        const selAll = this.container.querySelector("#bulk-select-all");
        if (selAll) {
            selAll.addEventListener("change", (e) => {
                const checked = e.target.checked;
                this.filteredEvaluations.forEach(ev => {
                    if (checked) this.selectedIds.add(ev.id);
                    else this.selectedIds.delete(ev.id);
                });
                this.updateTableRows();
            });
        }

        // Sort buttons
        this.container.querySelectorAll(".btn-sort").forEach(btn => {
            btn.addEventListener("click", () => {
                const sortKey = btn.getAttribute("data-sort");
                if (this.sortBy === sortKey) {
                    this.sortAsc = !this.sortAsc;
                } else {
                    this.sortBy = sortKey;
                    this.sortAsc = true;
                }
                this.container.querySelectorAll(".btn-sort").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.sortEvaluations();
                this.updateTableRows();
            });
        });

        // Row checkbox delegation
        const tbody = this.container.querySelector("#bulk-table-body");
        if (tbody) {
            tbody.addEventListener("change", (e) => {
                if (e.target.classList.contains("student-row-check")) {
                    const id = e.target.getAttribute("data-id");
                    if (e.target.checked) this.selectedIds.add(id);
                    else this.selectedIds.delete(id);
                    this.updateCounter();
                }
            });
        }

        // Export CSV
        const btnCsv = this.container.querySelector("#btn-export-csv");
        if (btnCsv) {
            btnCsv.addEventListener("click", () => this.exportCSV());
        }

        // Generate PDF
        const btnPdf = this.container.querySelector("#btn-generate-bulk-pdf");
        if (btnPdf) {
            btnPdf.addEventListener("click", () => this.generateLandscapePDF());
        }
    }

    applyFilter() {
        const examFilter = this.container.querySelector("#bulk-filter-exam")?.value || "all";
        const classFilter = this.container.querySelector("#bulk-filter-class")?.value || "all";
        const sectionFilter = this.container.querySelector("#bulk-filter-section")?.value || "all";
        const subjectFilter = this.container.querySelector("#bulk-filter-subject")?.value || "all";

        this.filteredEvaluations = this.evaluations.filter(e => {
            if (examFilter !== "all" && e.examName !== examFilter) return false;
            if (classFilter !== "all" && e.class !== classFilter) return false;
            if (sectionFilter !== "all" && e.section !== sectionFilter) return false;
            if (subjectFilter !== "all" && e.subject !== subjectFilter) return false;
            return true;
        });

        // Default select all in filtered
        this.selectedIds = new Set(this.filteredEvaluations.map(e => e.id));
        this.sortEvaluations();
        this.renderTableHeader();
        this.updateTableRows();
    }

    sortEvaluations() {
        this.filteredEvaluations.sort((a, b) => {
            let res = 0;
            if (this.sortBy === "rollNo") {
                res = String(a.rollNo || "").localeCompare(String(b.rollNo || ""), undefined, { numeric: true });
            } else if (this.sortBy === "name") {
                res = String(a.studentName || "").localeCompare(String(b.studentName || ""));
            } else if (this.sortBy === "score") {
                res = (a.obtainedMarks || 0) - (b.obtainedMarks || 0);
            }
            return this.sortAsc ? res : -res;
        });
    }

    getMaxQuestions() {
        let maxCount = 5;
        this.filteredEvaluations.forEach(e => {
            if (e.questions && e.questions.length > maxCount) {
                maxCount = e.questions.length;
            }
        });
        return maxCount;
    }

    renderTableHeader() {
        const thead = this.container.querySelector("#bulk-table-head");
        if (!thead) return;

        const maxQ = this.getMaxQuestions();
        let qHeaders = "";
        for (let i = 1; i <= maxQ; i++) {
            qHeaders += `<th>Q${i}</th>`;
        }

        thead.innerHTML = `
            <tr>
                <th style="width: 45px;"><input type="checkbox" id="header-select-all" checked /></th>
                <th style="width: 50px;">S.No</th>
                <th>Register No</th>
                <th>Student Name</th>
                <th>Class & Sec</th>
                ${qHeaders}
                <th>Total</th>
                <th>Max</th>
                <th>Percentage</th>
                <th>Grade</th>
                <th>Status</th>
            </tr>
        `;

        const hdrCheck = thead.querySelector("#header-select-all");
        if (hdrCheck) {
            hdrCheck.addEventListener("change", (e) => {
                const checked = e.target.checked;
                this.filteredEvaluations.forEach(ev => {
                    if (checked) this.selectedIds.add(ev.id);
                    else this.selectedIds.delete(ev.id);
                });
                this.updateTableRows();
            });
        }
    }

    updateTableRows() {
        const tbody = this.container.querySelector("#bulk-table-body");
        if (!tbody) return;

        const maxQ = this.getMaxQuestions();

        if (this.filteredEvaluations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${10 + maxQ}" class="empty-state-cell">No evaluations found matching the selected filters.</td></tr>`;
            this.updateCounter();
            return;
        }

        tbody.innerHTML = this.filteredEvaluations.map((ev, idx) => {
            const isChecked = this.selectedIds.has(ev.id);
            const questions = ev.questions || [];

            let qCols = "";
            for (let q = 0; q < maxQ; q++) {
                const mark = questions[q] ? questions[q].awardedMarks : "-";
                qCols += `<td class="text-center">${mark}</td>`;
            }

            const statusClass = ev.status === "Completed" ? "badge-completed" : "badge-pending";

            return `
                <tr class="${isChecked ? 'row-selected' : ''}">
                    <td><input type="checkbox" class="student-row-check" data-id="${ev.id}" ${isChecked ? 'checked' : ''} /></td>
                    <td class="text-center font-mono">${idx + 1}</td>
                    <td class="font-mono">${ev.rollNo || "-"}</td>
                    <td class="font-regular">${ev.studentName || "-"}</td>
                    <td>${ev.class || ""} - ${ev.section || ""}</td>
                    ${qCols}
                    <td class="text-center text-green">${ev.obtainedMarks || 0}</td>
                    <td class="text-center text-muted">${ev.maxMarks || 0}</td>
                    <td class="text-center">${ev.percentage || 0}%</td>
                    <td class="text-center">${ev.grade || "--"}</td>
                    <td><span class="status-pill ${statusClass}">${ev.status || "Pending"}</span></td>
                </tr>
            `;
        }).join("");

        this.updateCounter();
    }

    updateCounter() {
        const countEl = this.container.querySelector("#bulk-selected-count");
        if (countEl) {
            countEl.textContent = this.selectedIds.size;
        }
    }

    getSelectedEvaluations() {
        return this.filteredEvaluations.filter(e => this.selectedIds.has(e.id));
    }

    exportCSV() {
        const selected = this.getSelectedEvaluations();
        if (selected.length === 0) {
            alert("Please select at least one student to export.");
            return;
        }

        const maxQ = this.getMaxQuestions();
        const headers = ["S.No", "Register No", "Student Name", "Class", "Section", "Subject", "Exam Name"];
        for (let i = 1; i <= maxQ; i++) {
            headers.push(`Q${i}`);
        }
        headers.push("Total Marks", "Max Marks", "Percentage", "Grade", "Status");

        const rows = [headers];

        selected.forEach((ev, idx) => {
            const row = [
                idx + 1,
                `"${ev.rollNo || ''}"`,
                `"${ev.studentName || ''}"`,
                `"${ev.class || ''}"`,
                `"${ev.section || ''}"`,
                `"${ev.subject || ''}"`,
                `"${ev.examName || ''}"`
            ];

            for (let q = 0; q < maxQ; q++) {
                const mark = ev.questions && ev.questions[q] ? ev.questions[q].awardedMarks : "";
                row.push(mark);
            }

            row.push(ev.obtainedMarks || 0);
            row.push(ev.maxMarks || 0);
            row.push(`${ev.percentage || 0}%`);
            row.push(ev.grade || "--");
            row.push(ev.status || "Pending");

            rows.push(row);
        });

        const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Bulk_Mark_Report_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async generateLandscapePDF() {
        const selected = this.getSelectedEvaluations();
        if (selected.length === 0) {
            alert("Please select at least one student to generate report.");
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("jsPDF library is not available.");
            return;
        }

        // Preload co-branding logos
        const [schoolLogoData, appLogoData] = await Promise.all([
            window.PDFGenerator ? window.PDFGenerator.loadLogoDataUrl("assets/school_fulllogo.jpg") : null,
            window.PDFGenerator ? window.PDFGenerator.loadLogoDataUrl("assets/fulllogo.png") : null
        ]);

        const { jsPDF } = window.jspdf;
        // Landscape A4 (297 x 210 mm)
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 12;

        const maxQ = this.getMaxQuestions();
        const headers = ["S.No", "Reg No", "Student Name", "Class-Sec"];
        for (let i = 1; i <= maxQ; i++) {
            headers.push(`Q${i}`);
        }
        headers.push("Total", "Max", "%", "Grade");

        const body = selected.map((ev, idx) => {
            const row = [
                idx + 1,
                ev.rollNo || "-",
                ev.studentName || "-",
                `${ev.class || ""}-${ev.section || ""}`
            ];

            for (let q = 0; q < maxQ; q++) {
                const mark = ev.questions && ev.questions[q] ? ev.questions[q].awardedMarks : "-";
                row.push(mark);
            }

            row.push(ev.obtainedMarks || 0);
            row.push(ev.maxMarks || 0);
            row.push(`${ev.percentage || 0}%`);
            const gradeInfo = window.calculateGradeScale 
                ? window.calculateGradeScale(ev.obtainedMarks, ev.maxMarks) 
                : { grade: ev.grade || "--" };
            row.push(ev.grade || gradeInfo.grade);
            return row;
        });

        // Compute class aggregate stats (Passing threshold >= 33% as per official scale)
        const avgScore = Math.round(selected.reduce((s, e) => s + (e.obtainedMarks || 0), 0) / selected.length);
        const passCount = selected.filter(e => (e.percentage || 0) >= 33).length;
        const passRate = Math.round((passCount / selected.length) * 100);

        const examTitle = selected[0]?.examName || "Consolidated Examination Report";
        const subjectTitle = selected[0]?.subject || "All Subjects";
        const institutionName = selected[0]?.institutionName || "Adwaith Thought Academy";

        if (doc.autoTable) {
            doc.autoTable({
                head: [headers],
                body: body,
                startY: 30,
                margin: { left: margin, right: margin, bottom: 20 },
                theme: "grid",
                styles: {
                    fontSize: 8.5,
                    cellPadding: 2.2,
                    valign: "middle",
                    fontStyle: "normal"
                },
                headStyles: {
                    fillColor: [16, 185, 129], // Emerald primary
                    textColor: [255, 255, 255],
                    fontStyle: "normal",
                    halign: "center"
                },
                columnStyles: {
                    0: { halign: "center", cellWidth: 12 },
                    1: { halign: "center", cellWidth: 20, fontStyle: "normal" },
                    2: { halign: "left", fontStyle: "normal" },
                    3: { halign: "center", cellWidth: 22 }
                },
                // Set question columns to center
                didParseCell: (data) => {
                    if (data.column.index >= 4) {
                        data.cell.styles.halign = "center";
                    }
                },
                didDrawPage: (data) => {
                    // Header container on every page
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(226, 232, 240);
                    doc.setLineWidth(0.4);
                    doc.roundedRect(margin, 5.5, pageWidth - margin * 2, 20, 2, 2, "FD");

                    // Top-Left: Client School Logo
                    if (schoolLogoData) {
                        try {
                            doc.addImage(schoolLogoData, "JPEG", margin + 3, 7.5, 42, 14.3);
                        } catch (e) {
                            console.warn("Could not draw school logo on bulk PDF:", e);
                        }
                    }

                    // Top-Right: Application Logo
                    if (appLogoData) {
                        try {
                            doc.addImage(appLogoData, "PNG", pageWidth - margin - 45, 8.5, 42, 12.6);
                        } catch (e) {
                            console.warn("Could not draw OSM logo on bulk PDF:", e);
                        }
                    }

                    // Center: Co-branding institutional info
                    doc.setTextColor(15, 23, 42);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(11);
                    doc.text(institutionName.toUpperCase(), pageWidth / 2, 11.5, { align: "center" });

                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.setFont("helvetica", "normal");
                    doc.text(`EXAMINATION TABULATION SHEET: ${examTitle} | Subject: ${subjectTitle}`, pageWidth / 2, 17, { align: "center" });

                    doc.setFontSize(7.5);
                    doc.text(`Students: ${selected.length} | Class Avg: ${avgScore} | Pass Rate: ${passRate}%`, pageWidth / 2, 22, { align: "center" });

                    // Footer on every page
                    const pageNo = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Niprak OSM - Bulk Mark Report | Generated: ${new Date().toLocaleDateString()}`, margin, pageHeight - 8);
                    doc.text(`Page ${pageNo}`, pageWidth - margin, pageHeight - 8, { align: "right" });
                }
            });
        }

        doc.save(`Bulk_Mark_Report_${examTitle.replace(/\s+/g, "_")}.pdf`);
    }
}

window.BulkReportManager = BulkReportManager;
