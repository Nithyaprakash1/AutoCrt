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

        // If teacher is allotted specific subject(s) (e.g. English), scope evaluations strictly to that subject
        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : null;
        if (currentUser && currentUser.role === 'evaluator' && currentUser.assignedSubjects && currentUser.assignedSubjects.length > 0 && !currentUser.assignedSubjects.includes("All Subjects")) {
            const assigned = currentUser.assignedSubjects.map(s => s.toLowerCase().trim());
            this.evaluations = this.evaluations.filter(e => {
                const sub = (e.subject || "").toLowerCase().trim();
                const exam = (e.examName || e.templateName || "").toLowerCase().trim();
                return assigned.some(a => sub === a || sub.includes(a) || a.includes(sub) || exam.includes(a));
            });
        }

        this.render();
        this.applyFilter();
    }

    render() {
        // Collect distinct filters
        const exams = [...new Set(this.evaluations.map(e => e.examName).filter(Boolean))];
        const classes = [...new Set(this.evaluations.map(e => e.class).filter(Boolean))];
        const sections = [...new Set(this.evaluations.map(e => e.section).filter(Boolean))];

        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : null;
        let subjects = [...new Set(this.evaluations.map(e => e.subject).filter(Boolean))];
        if (currentUser && currentUser.role === 'evaluator' && currentUser.assignedSubjects && currentUser.assignedSubjects.length > 0 && !currentUser.assignedSubjects.includes("All Subjects")) {
            subjects = currentUser.assignedSubjects;
        } else if (subjects.length === 0) {
            subjects = ["Physics", "English"];
        }

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
                            <tr class="skeleton-table-row">
                                <td style="text-align: center;"><div class="skeleton-shimmer" style="width: 16px; height: 16px; border-radius: 4px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 24px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 50px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 120px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 60px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 60px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 40px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 40px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 45px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-chip"></div></td>
                                <td><div class="skeleton-shimmer skeleton-chip"></div></td>
                            </tr>
                            <tr class="skeleton-table-row">
                                <td style="text-align: center;"><div class="skeleton-shimmer" style="width: 16px; height: 16px; border-radius: 4px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 24px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 50px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 140px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 60px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 60px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 40px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 40px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-bone" style="width: 45px;"></div></td>
                                <td><div class="skeleton-shimmer skeleton-chip"></div></td>
                                <td><div class="skeleton-shimmer skeleton-chip"></div></td>
                            </tr>
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

        thead.innerHTML = `
            <tr>
                <th style="width: 45px;"><input type="checkbox" id="header-select-all" checked /></th>
                <th style="width: 50px;">S.No</th>
                <th>Register No</th>
                <th>Student Name</th>
                <th>Class & Sec</th>
                <th>Subject</th>
                <th>Total Marks</th>
                <th>Max Marks</th>
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

        if (this.filteredEvaluations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="empty-state-cell">No evaluations found matching the selected filters.</td></tr>`;
            this.updateCounter();
            return;
        }

        tbody.innerHTML = this.filteredEvaluations.map((ev, idx) => {
            const isChecked = this.selectedIds.has(ev.id);
            const statusClass = ev.status === "Completed" ? "badge-completed" : "badge-pending";

            return `
                <tr class="${isChecked ? 'row-selected' : ''}">
                    <td><input type="checkbox" class="student-row-check" data-id="${ev.id}" ${isChecked ? 'checked' : ''} /></td>
                    <td class="text-center font-mono">${idx + 1}</td>
                    <td class="font-mono">${ev.rollNo || "-"}</td>
                    <td class="font-regular">${ev.studentName || "-"}</td>
                    <td>${ev.class || ""} - ${ev.section || ""}</td>
                    <td><span class="badge" style="background: rgba(0,122,255,0.08); color: #007AFF;">${ev.subject || "-"}</span></td>
                    <td class="text-center text-green" style="font-weight: 600;">${ev.obtainedMarks !== undefined ? ev.obtainedMarks : 0}</td>
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

        // Only total marks columns - no individual questions
        const headers = ["S.No", "Register No", "Student Name", "Class", "Section", "Subject", "Exam Name", "Total Marks Obtained", "Max Marks", "Percentage", "Grade", "Status"];

        const rows = [headers];

        selected.forEach((ev, idx) => {
            let actualObtained = ev.obtainedMarks;
            let actualMax = ev.maxMarks;
            let actualQuestions = ev.questions;

            // Check draft if record has 0 or undefined
            if ((actualObtained === undefined || actualObtained === null || actualObtained === 0) && window.appStorage && typeof window.appStorage.getDraft === "function") {
                const draft = window.appStorage.getDraft(ev.id);
                if (draft && draft.obtainedMarks !== undefined && Number(draft.obtainedMarks) > 0) {
                    actualObtained = draft.obtainedMarks;
                    if (draft.maxMarks) actualMax = draft.maxMarks;
                    if (draft.questions && draft.questions.length > 0) actualQuestions = draft.questions;
                }
            }

            if (Array.isArray(actualQuestions) && actualQuestions.length > 0) {
                const qSum = actualQuestions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
                const roundedQSum = Math.round(qSum * 10) / 10;
                if (roundedQSum > 0 || (actualObtained === undefined || actualObtained === null)) {
                    actualObtained = roundedQSum;
                }
            }

            const finalObtained = actualObtained !== undefined && actualObtained !== null && !isNaN(Number(actualObtained)) 
                ? Number(actualObtained) 
                : 0;
            const finalMax = actualMax !== undefined && actualMax !== null && Number(actualMax) > 0 
                ? Number(actualMax) 
                : 70;

            const pct = finalMax > 0 ? Math.round((finalObtained / finalMax) * 100) : (ev.percentage || 0);
            const gradeInfo = window.calculateGradeScale 
                ? window.calculateGradeScale(finalObtained, finalMax) 
                : { grade: ev.grade || "--" };

            const row = [
                idx + 1,
                `"${ev.rollNo || ''}"`,
                `"${ev.studentName || ''}"`,
                `"${ev.class || ''}"`,
                `"${ev.section || ''}"`,
                `"${ev.subject || ''}"`,
                `"${ev.examName || ''}"`,
                finalObtained,
                finalMax,
                `"${pct}%"`,
                `"${ev.grade || gradeInfo.grade || '--'}"`,
                `"${ev.status || 'Completed'}"`
            ];

            rows.push(row);
        });

        const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const subName = (selected[0]?.subject || "Marks").replace(/\s+/g, "_");
        link.setAttribute("download", `${subName}_Total_Marks_Report_${new Date().toISOString().split("T")[0]}.csv`);
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

        const headers = ["S.No", "Reg No", "Student Name", "Class & Sec", "Subject", "Total Marks", "Max Marks", "Percentage", "Grade", "Status"];

        const body = selected.map((ev, idx) => {
            let actualObtained = ev.obtainedMarks;
            let actualMax = ev.maxMarks;
            let actualQuestions = ev.questions;

            if ((actualObtained === undefined || actualObtained === null || actualObtained === 0) && window.appStorage && typeof window.appStorage.getDraft === "function") {
                const draft = window.appStorage.getDraft(ev.id);
                if (draft && draft.obtainedMarks !== undefined && Number(draft.obtainedMarks) > 0) {
                    actualObtained = draft.obtainedMarks;
                    if (draft.maxMarks) actualMax = draft.maxMarks;
                    if (draft.questions && draft.questions.length > 0) actualQuestions = draft.questions;
                }
            }

            if (Array.isArray(actualQuestions) && actualQuestions.length > 0) {
                const qSum = actualQuestions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
                const roundedQSum = Math.round(qSum * 10) / 10;
                if (roundedQSum > 0 || (actualObtained === undefined || actualObtained === null)) {
                    actualObtained = roundedQSum;
                }
            }

            const finalObtained = actualObtained !== undefined && actualObtained !== null && !isNaN(Number(actualObtained)) 
                ? Number(actualObtained) 
                : 0;
            const finalMax = actualMax !== undefined && actualMax !== null && Number(actualMax) > 0 
                ? Number(actualMax) 
                : 70;

            const pct = finalMax > 0 ? Math.round((finalObtained / finalMax) * 100) : (ev.percentage || 0);
            const gradeInfo = window.calculateGradeScale 
                ? window.calculateGradeScale(finalObtained, finalMax) 
                : { grade: ev.grade || "--", status: ev.status || "Pass" };

            return [
                idx + 1,
                ev.rollNo || "-",
                ev.studentName || "-",
                `${ev.class || ""}-${ev.section || ""}`,
                ev.subject || "-",
                finalObtained,
                finalMax,
                `${pct}%`,
                ev.grade || gradeInfo.grade,
                ev.status || gradeInfo.status || "Completed"
            ];
        });

        // Compute class aggregate stats (Passing threshold >= 33% as per official scale)
        const avgScore = Math.round(body.reduce((s, row) => s + (Number(row[5]) || 0), 0) / body.length);
        const passCount = body.filter(row => {
            const pctVal = parseFloat(String(row[7]).replace("%", "")) || 0;
            return pctVal >= 33;
        }).length;
        const passRate = Math.round((passCount / body.length) * 100);

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
                    fontSize: 9,
                    cellPadding: 3,
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
                    0: { halign: "center", cellWidth: 14 },
                    1: { halign: "center", cellWidth: 26 },
                    2: { halign: "left" },
                    3: { halign: "center", cellWidth: 26 },
                    4: { halign: "center", cellWidth: 32 },
                    5: { halign: "center", cellWidth: 26 },
                    6: { halign: "center", cellWidth: 24 },
                    7: { halign: "center", cellWidth: 26 },
                    8: { halign: "center", cellWidth: 22 },
                    9: { halign: "center", cellWidth: 26 }
                },
                didParseCell: (data) => {
                    if (data.column.index >= 5) {
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
