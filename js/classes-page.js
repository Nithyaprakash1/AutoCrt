/**
 * OneSpace Digital Correction - Classes & Rosters Page Manager
 * Full-page management of grades, sections, and enrolled student rosters.
 * Supports CSV/Excel demo template download and bulk roster ingestion.
 */

class ClassesPageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.classes = [];
        this.activeClassId = null;
        this.currentRoster = [];
        this.searchQuery = "";
        this.isAddStudentOpen = false;
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            const savedClasses = await window.appStorage.getClassesList();
            if (savedClasses && savedClasses.length > 0) {
                this.classes = savedClasses;
            } else {
                this.classes = [];
            }

            if (!this.activeClassId && this.classes.length > 0) {
                this.activeClassId = this.classes[0].id;
            }

            if (this.activeClassId) {
                this.currentRoster = await window.appStorage.getClassRoster(this.activeClassId);
            }
        }
    }

    render() {
        if (!this.container) return;

        const activeClass = this.classes.find(c => c.id === this.activeClassId) || this.classes[0];
        const filteredRoster = this.currentRoster.filter(s => {
            if (!this.searchQuery) return true;
            const q = this.searchQuery.toLowerCase();
            return (
                (s.studentName && s.studentName.toLowerCase().includes(q)) ||
                (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
                (s.parentContact && s.parentContact.toLowerCase().includes(q))
            );
        });

        this.container.innerHTML = `
            <div class="classes-page-layout">
                <!-- Top Header Banner -->
                <div class="classes-page-header">
                    <div class="header-titles">
                        <div class="header-tag-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            Academic Management
                        </div>
                        <h1 class="page-title">Student & Classes</h1>
                        <p class="page-subtitle">Configure school grades, divisions, and enrolled student rosters for exam allocation and automated paper reconciliation.</p>
                    </div>

                    <div class="header-actions">
                        <button type="button" class="btn-classes-secondary" id="btn-classes-download-template" title="Download sample CSV template with columns">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Download Demo Excel</span>
                        </button>
                        <button type="button" class="btn-classes-secondary" id="btn-classes-import-trigger" title="Upload student roster CSV or Excel">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                            <span>Bulk Import Roster</span>
                        </button>
                        <input type="file" id="input-roster-file" accept=".csv, .txt, .xlsx, .xls" style="display: none;" />
                        <button type="button" class="btn-classes-primary" id="btn-classes-add-class">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span>Add New Class</span>
                        </button>
                    </div>
                </div>

                <!-- Class Selection Cards Grid -->
                <div class="classes-cards-section">
                    <div class="section-label-row">
                        <span class="section-heading">Active Classes (${this.classes.length})</span>
                        <span class="section-subtext">Click any class card to view and manage enrolled student rosters</span>
                    </div>

                    <div class="classes-cards-grid">
                        ${this.classes.map(cls => {
                            const isSelected = cls.id === this.activeClassId;
                            const count = isSelected ? this.currentRoster.length : (cls.studentCount !== undefined ? cls.studentCount : 0);
                            return `
                                <div class="class-card ${isSelected ? 'selected' : ''}" data-class-id="${cls.id}">
                                    <div class="class-card-top">
                                        <div class="class-card-badge">Section ${cls.section || 'A'}</div>
                                        <div class="class-status-dot ${isSelected ? 'active' : ''}"></div>
                                    </div>
                                    <h3 class="class-card-title">${cls.name || cls.label}</h3>
                                    <div class="class-card-meta">
                                        <div class="meta-item">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                            <span>${count} Students Enrolled</span>
                                        </div>
                                        <div class="meta-item">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            <span>Active Academic Term</span>
                                        </div>
                                    </div>
                                    <div class="class-card-actions">
                                        <button type="button" class="btn-card-manage ${isSelected ? 'btn-selected' : ''}" data-class-id="${cls.id}">
                                            ${isSelected ? 'Currently Viewing' : 'Select Class'}
                                        </button>
                                        <button type="button" class="btn-card-upload-shortcut" data-class-id="${cls.id}" title="Upload answer sheets for this class">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                            Upload
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}

                        <!-- Add Class Quick Card -->
                        <div class="class-card add-class-card" id="card-trigger-add-class">
                            <div class="add-class-inner">
                                <div class="add-icon-ring">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                </div>
                                <span class="add-title">Add New Class</span>
                                <span class="add-desc">Define grade, section & auto-generate baseline roster</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Active Class Roster Details -->
                <div class="roster-management-card">
                    <div class="roster-header-row">
                        <div class="roster-info-col">
                            <div class="roster-class-title">
                                <span>${activeClass ? activeClass.name : 'Class Roster'}</span>
                                <span class="roster-count-badge">${this.currentRoster.length} Enrolled Students</span>
                            </div>
                            <span class="roster-sub-label">Section ${activeClass ? activeClass.section : 'A'} • Academic Year 2025-2026</span>
                        </div>

                        <div class="roster-tools-col">
                            <div class="roster-search-box">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="input-roster-search" placeholder="Search by name, roll no, phone..." value="${this.searchQuery}" />
                                ${this.searchQuery ? `<button type="button" class="btn-clear-search" id="btn-clear-roster-search">×</button>` : ''}
                            </div>

                            <button type="button" class="btn-toggle-add-student" id="btn-toggle-add-student">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                <span>Add Student</span>
                            </button>
                        </div>
                    </div>

                    <!-- Collapsible Add Student Inline Form -->
                    <div class="add-student-form-pane" id="pane-add-student" style="display: ${this.isAddStudentOpen ? 'block' : 'none'};">
                        <div class="pane-inner">
                            <h4 class="form-pane-title">Add Individual Student to ${activeClass ? activeClass.name : 'Class'}</h4>
                            <div class="form-row-grid">
                                <div class="form-field">
                                    <label>Roll Number *</label>
                                    <input type="text" id="new-stu-roll" class="form-input" placeholder="e.g. 1226" />
                                </div>
                                <div class="form-field">
                                    <label>Full Student Name *</label>
                                    <input type="text" id="new-stu-name" class="form-input" placeholder="e.g. Priya Sundaram" />
                                </div>
                            </div>
                            <div class="form-actions-row">
                                <button type="button" class="btn-pane-cancel" id="btn-cancel-add-student">Cancel</button>
                                <button type="button" class="btn-pane-save" id="btn-save-new-student">Save Student to Roster</button>
                            </div>
                        </div>
                    </div>

                    <!-- Roster Data Table -->
                    <div class="roster-table-wrapper">
                        <table class="roster-data-table">
                            <thead>
                                <tr>
                                    <th style="width: 120px;">Roll No</th>
                                    <th>Student Name</th>
                                    <th style="width: 150px;">Enrollment Status</th>
                                    <th style="width: 110px; text-align: right;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredRoster.length === 0 ? `
                                    <tr>
                                        <td colspan="4" class="roster-empty-cell">
                                            <div class="empty-roster-state">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                <span>${this.searchQuery ? 'No students matched your search query.' : 'No students found in this class roster.'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ` : filteredRoster.map(s => `
                                    <tr data-roll="${s.rollNo}">
                                        <td class="cell-roll">${s.rollNo}</td>
                                        <td class="cell-name">
                                            <div class="student-name-chip">
                                                <span class="avatar-circle">${(s.studentName || 'ST').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</span>
                                                <span class="name-text">${s.studentName}</span>
                                            </div>
                                        </td>
                                        <td class="cell-status">
                                            <span class="badge-enrolled">
                                                <span class="dot"></span> Enrolled
                                            </span>
                                        </td>
                                        <td class="cell-action" style="text-align: right;">
                                            <button type="button" class="btn-roster-delete" data-roll="${s.rollNo}" title="Remove student from roster">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Dynamic Add Class Modal Backdrop -->
            <div class="modal-backdrop" id="modal-classes-create-class" style="display: none;">
                <div class="modal-dialog modal-dialog-compact">
                    <div class="modal-header">
                        <div>
                            <h3 class="modal-title">Add New Class</h3>
                            <p class="modal-subtitle">Specify grade and division section</p>
                        </div>
                        <button type="button" class="btn-modal-close" id="btn-close-class-modal">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label>Grade / Level</label>
                            <input type="text" id="input-modal-grade" class="form-input" placeholder="e.g. 12 or 10" value="12" />
                        </div>
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label>Section Letter</label>
                            <input type="text" id="input-modal-section" class="form-input" placeholder="e.g. E or F" value="E" maxlength="2" />
                        </div>
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label>Class Display Label</label>
                            <input type="text" id="input-modal-label" class="form-input" placeholder="e.g. Class 12-E" value="Class 12-E" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" id="btn-cancel-class-modal">Cancel</button>
                        <button type="button" class="btn-primary" id="btn-confirm-create-class">Create Class & Roster</button>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Class card selection
        this.container.querySelectorAll(".class-card[data-class-id]").forEach(card => {
            card.addEventListener("click", async (e) => {
                if (e.target.closest(".btn-card-upload-shortcut")) return;
                const id = card.getAttribute("data-class-id");
                if (id !== this.activeClassId) {
                    this.activeClassId = id;
                    if (window.appStorage) {
                        this.currentRoster = await window.appStorage.getClassRoster(id);
                    }
                    this.render();
                }
            });
        });

        // Quick upload shortcut from class card
        this.container.querySelectorAll(".btn-card-upload-shortcut").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const classId = btn.getAttribute("data-class-id");
                const targetCls = this.classes.find(c => c.id === classId);
                if (window.app) {
                    window.app.switchView("upload-portal");
                    setTimeout(() => {
                        if (window.app.uploadPortalManager && targetCls) {
                            window.app.uploadPortalManager.selectedClass = targetCls;
                            window.app.uploadPortalManager.currentStep = 4;
                            window.app.uploadPortalManager.updateStepView();
                        }
                    }, 120);
                }
            });
        });

        // Search roster
        const inputSearch = this.container.querySelector("#input-roster-search");
        if (inputSearch) {
            inputSearch.addEventListener("input", (e) => {
                this.searchQuery = e.target.value.trim();
                this.render();
                const freshInput = this.container.querySelector("#input-roster-search");
                if (freshInput) {
                    freshInput.focus();
                    freshInput.setSelectionRange(freshInput.value.length, freshInput.value.length);
                }
            });
        }
        const btnClear = this.container.querySelector("#btn-clear-roster-search");
        if (btnClear) {
            btnClear.addEventListener("click", () => {
                this.searchQuery = "";
                this.render();
            });
        }

        // Toggle add student form
        const btnToggleAdd = this.container.querySelector("#btn-toggle-add-student");
        if (btnToggleAdd) {
            btnToggleAdd.addEventListener("click", () => {
                this.isAddStudentOpen = !this.isAddStudentOpen;
                const pane = this.container.querySelector("#pane-add-student");
                if (pane) pane.style.display = this.isAddStudentOpen ? "block" : "none";
            });
        }
        const btnCancelAdd = this.container.querySelector("#btn-cancel-add-student");
        if (btnCancelAdd) {
            btnCancelAdd.addEventListener("click", () => {
                this.isAddStudentOpen = false;
                const pane = this.container.querySelector("#pane-add-student");
                if (pane) pane.style.display = "none";
            });
        }

        // Save new student
        const btnSaveStudent = this.container.querySelector("#btn-save-new-student");
        if (btnSaveStudent) {
            btnSaveStudent.addEventListener("click", async () => {
                const roll = this.container.querySelector("#new-stu-roll")?.value.trim();
                const name = this.container.querySelector("#new-stu-name")?.value.trim();

                if (!roll || !name) {
                    alert("Please provide both Roll Number and Student Full Name.");
                    return;
                }

                if (this.currentRoster.some(s => s.rollNo === roll)) {
                    alert(`A student with Roll Number ${roll} already exists in this roster.`);
                    return;
                }

                const newStudent = { rollNo: roll, studentName: name };
                this.currentRoster.push(newStudent);
                this.currentRoster.sort((a, b) => Number(a.rollNo) - Number(b.rollNo));

                if (window.appStorage && this.activeClassId) {
                    await window.appStorage.saveClassRoster(this.activeClassId, this.currentRoster);
                }

                // Update class studentCount
                const cls = this.classes.find(c => c.id === this.activeClassId);
                if (cls) {
                    cls.studentCount = this.currentRoster.length;
                    if (window.appStorage) await window.appStorage.saveClassesList(this.classes);
                }

                this.isAddStudentOpen = false;
                if (window.app) window.app.showToast(`Added ${name} to roster!`);
                this.render();
            });
        }

        // Delete student from roster
        this.container.querySelectorAll(".btn-roster-delete").forEach(btn => {
            btn.addEventListener("click", async () => {
                const roll = btn.getAttribute("data-roll");
                const target = this.currentRoster.find(s => s.rollNo === roll);
                if (!target) return;

                if (confirm(`Remove ${target.studentName} (Roll: ${roll}) from this class roster?`)) {
                    this.currentRoster = this.currentRoster.filter(s => s.rollNo !== roll);
                    if (window.appStorage && this.activeClassId) {
                        await window.appStorage.saveClassRoster(this.activeClassId, this.currentRoster);
                    }
                    const cls = this.classes.find(c => c.id === this.activeClassId);
                    if (cls) {
                        cls.studentCount = this.currentRoster.length;
                        if (window.appStorage) await window.appStorage.saveClassesList(this.classes);
                    }
                    if (window.app) window.app.showToast(`Removed student ${target.studentName}.`);
                    this.render();
                }
            });
        });

        // Download Demo Excel / CSV Template
        const btnDownloadTemplate = this.container.querySelector("#btn-classes-download-template");
        if (btnDownloadTemplate) {
            btnDownloadTemplate.addEventListener("click", () => {
                this.downloadSampleTemplate();
            });
        }

        // Bulk Import Roster Trigger
        const btnImportTrigger = this.container.querySelector("#btn-classes-import-trigger");
        const fileInput = this.container.querySelector("#input-roster-file");
        if (btnImportTrigger && fileInput) {
            btnImportTrigger.addEventListener("click", () => fileInput.click());
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) this.handleBulkImportFile(file);
                fileInput.value = "";
            });
        }

        // Add Class Modal
        const btnAddClass = this.container.querySelector("#btn-classes-add-class");
        const cardAddClass = this.container.querySelector("#card-trigger-add-class");
        const modalEl = this.container.querySelector("#modal-classes-create-class");
        const btnCloseModal = this.container.querySelector("#btn-close-class-modal");
        const btnCancelModal = this.container.querySelector("#btn-cancel-class-modal");
        const btnConfirmCreate = this.container.querySelector("#btn-confirm-create-class");

        const openModal = () => {
            if (modalEl) {
                modalEl.style.display = "flex";
                modalEl.classList.add("active");
            }
        };
        const closeModal = () => {
            if (modalEl) {
                modalEl.style.display = "none";
                modalEl.classList.remove("active");
            }
        };

        if (btnAddClass) btnAddClass.addEventListener("click", openModal);
        if (cardAddClass) cardAddClass.addEventListener("click", openModal);
        if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
        if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

        const gradeInput = this.container.querySelector("#input-modal-grade");
        const secInput = this.container.querySelector("#input-modal-section");
        const labelInput = this.container.querySelector("#input-modal-label");

        if (gradeInput && secInput && labelInput) {
            const syncLabel = () => {
                const g = gradeInput.value.trim() || "12";
                const s = secInput.value.trim().toUpperCase() || "E";
                labelInput.value = `Class ${g}-${s}`;
            };
            gradeInput.addEventListener("input", syncLabel);
            secInput.addEventListener("input", syncLabel);
        }

        if (btnConfirmCreate) {
            btnConfirmCreate.addEventListener("click", async () => {
                const g = gradeInput?.value.trim() || "12";
                const s = secInput?.value.trim().toUpperCase() || "E";
                const lbl = labelInput?.value.trim() || `Class ${g}-${s}`;

                const newId = `cls_${g.toLowerCase()}${s.toLowerCase()}_${Date.now()}`;
                const newCls = {
                    id: newId,
                    name: lbl,
                    label: lbl,
                    section: s,
                    grade: g,
                    studentCount: 0
                };

                this.classes.push(newCls);
                if (window.appStorage) {
                    await window.appStorage.saveClassesList(this.classes);
                    const autoRoster = window.appStorage.generateDefaultRoster(newId);
                    await window.appStorage.saveClassRoster(newId, autoRoster);
                }

                closeModal();
                this.activeClassId = newId;
                if (window.appStorage) {
                    this.currentRoster = await window.appStorage.getClassRoster(newId);
                    newCls.studentCount = this.currentRoster.length;
                }
                if (window.app) window.app.showToast(`Class ${lbl} created successfully! (${this.currentRoster.length} Enrolled Students)`);
                this.render();
            });
        }
    }

    downloadSampleTemplate() {
        const headers = ["Roll Number", "Student Name"];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `student_roster_demo_template.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.app) window.app.showToast("Demo Excel/CSV template downloaded!");
    }

    async handleBulkImportFile(file) {
        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length <= 1) {
                alert("File appears empty or does not contain student rows.");
                return;
            }

            const headerLine = lines[0].toLowerCase();
            const hasHeader = headerLine.includes("roll") || headerLine.includes("name");
            const dataLines = hasHeader ? lines.slice(1) : lines;

            const importedStudents = [];
            for (const line of dataLines) {
                const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
                if (parts.length >= 2 && parts[0] && parts[1]) {
                    importedStudents.push({
                        rollNo: parts[0],
                        studentName: parts[1]
                    });
                }
            }

            if (importedStudents.length === 0) {
                alert("Could not parse any valid student entries. Please ensure columns: Roll Number, Student Name.");
                return;
            }

            // Append or update existing roster
            for (const imp of importedStudents) {
                const idx = this.currentRoster.findIndex(s => s.rollNo === imp.rollNo);
                if (idx >= 0) {
                    this.currentRoster[idx] = imp;
                } else {
                    this.currentRoster.push(imp);
                }
            }
            this.currentRoster.sort((a, b) => Number(a.rollNo) - Number(b.rollNo));

            if (window.appStorage && this.activeClassId) {
                await window.appStorage.saveClassRoster(this.activeClassId, this.currentRoster);
            }

            const cls = this.classes.find(c => c.id === this.activeClassId);
            if (cls) {
                cls.studentCount = this.currentRoster.length;
                if (window.appStorage) await window.appStorage.saveClassesList(this.classes);
            }

            if (window.app) window.app.showToast(`Imported ${importedStudents.length} students into roster!`);
            this.render();
        } catch (err) {
            console.error("Error reading import file:", err);
            alert("Failed to parse file. Please verify CSV formatting.");
        }
    }
}

window.ClassesPageManager = ClassesPageManager;
