/**
 * OneSpace Digital Correction - Evaluation Creation & File Dropzone
 * Handles Step 1 metadata, dynamic question max marks generator,
 * Step 2 drag-and-drop file upload, client-side image compression,
 * multi-page PDF extraction via PDF.js, and instant sample paper loading.
 */

class EvaluationForm {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = Object.assign({
            onStartCorrection: null
        }, options);

        this.uploadedPages = []; // Array of data URLs
        this.questionsConfig = [];
        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
        this.generateQuestionInputs(5, 20);
    }

    render() {
        const today = new Date().toISOString().split("T")[0];
        const initialInst = (window.appStorage && window.appStorage._cachedSettings?.institution?.name) || "";
        const initialTeacher = (window.appStorage && window.appStorage._cachedSettings?.teacher?.name) || "";

        const ic = window.Icons || {};

        this.container.innerHTML = `
            <div class="eval-form-page">
                <div class="form-header-bar">
                    <div>
                        <h2 class="form-title">New Paper Evaluation</h2>
                        <p class="form-subtitle">Enter student and examination details, then upload the student's answer sheet.</p>
                    </div>
                    <button type="button" class="btn-sample-load" id="btn-load-sample-eval">
                        <span class="btn-icon">${ic.lightning || ''}</span> Quick Load Sample Paper
                    </button>
                </div>

                <form id="evaluation-creation-form" class="eval-multi-step-form">
                    <!-- Step 1: Evaluation Details -->
                    <div class="form-card">
                        <div class="card-title-row">
                            <span class="step-num">1</span>
                            <div>
                                <h3 class="card-title">Student & Examination Details</h3>
                                <p class="card-desc">All required fields to classify the student paper</p>
                            </div>
                        </div>

                        <div class="form-grid-3">
                            <div class="form-group">
                                <label for="inp-student-name">Student Full Name <span class="required">*</span></label>
                                <input type="text" id="inp-student-name" class="form-input" placeholder="e.g. Arun Kumar" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-roll-no">Roll No / Register No <span class="required">*</span></label>
                                <input type="text" id="inp-roll-no" class="form-input" placeholder="e.g. 101" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-class">Class <span class="required">*</span></label>
                                <input type="text" id="inp-class" class="form-input" placeholder="e.g. Class 10" value="Class 10" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-section">Section <span class="required">*</span></label>
                                <input type="text" id="inp-section" class="form-input" placeholder="e.g. A" value="A" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-subject">Subject <span class="required">*</span></label>
                                <input type="text" id="inp-subject" class="form-input" placeholder="e.g. Mathematics" value="Physics" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-exam-name">Exam Name <span class="required">*</span></label>
                                <input type="text" id="inp-exam-name" class="form-input" placeholder="e.g. Mid-Term Examination 2026" value="Mid-Term Examination 2026" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-exam-date">Exam Date <span class="required">*</span></label>
                                <input type="date" id="inp-exam-date" class="form-input" value="${today}" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-correction-date">Correction Date</label>
                                <input type="date" id="inp-correction-date" class="form-input" value="${today}" />
                            </div>
                            <div class="form-group">
                                <label for="inp-max-marks">Maximum Marks <span class="required">*</span></label>
                                <input type="number" id="inp-max-marks" class="form-input" min="1" value="20" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-num-questions">Number of Questions <span class="required">*</span></label>
                                <input type="number" id="inp-num-questions" class="form-input" min="1" max="50" value="5" required />
                            </div>
                            <div class="form-group">
                                <label for="inp-start-time">Start Time</label>
                                <input type="time" id="inp-start-time" class="form-input" value="09:00" />
                            </div>
                            <div class="form-group">
                                <label for="inp-end-time">End Time</label>
                                <input type="time" id="inp-end-time" class="form-input" value="09:30" />
                            </div>
                        </div>

                        <!-- Optional Institution and Teacher Info -->
                        <div class="optional-collapsible">
                            <div class="collapsible-toggle" id="toggle-opt-details">
                                <span>+ Optional Institution & Evaluator Profile</span>
                            </div>
                            <div class="collapsible-content form-grid-3" id="opt-details-body" style="display: none; margin-top: 12px;">
                                <div class="form-group">
                                    <label for="inp-inst-name">School / Institution Name</label>
                                    <input type="text" id="inp-inst-name" class="form-input" value="${initialInst}" />
                                </div>
                                <div class="form-group">
                                    <label for="inp-teacher-name">Teacher Name</label>
                                    <input type="text" id="inp-teacher-name" class="form-input" value="${initialTeacher}" />
                                </div>
                                <div class="form-group">
                                    <label for="inp-academic-year">Academic Year</label>
                                    <input type="text" id="inp-academic-year" class="form-input" value="2026-2027" />
                                </div>
                            </div>
                        </div>

                        <!-- Dynamic Question Marks Allocator -->
                        <div class="question-allocator-wrap">
                            <label class="form-subheading">Question Marks Breakdown</label>
                            <div class="question-chips-grid" id="question-chips-container">
                                <!-- Generated dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Step 2: Upload Answer Sheet -->
                    <div class="form-card">
                        <div class="card-title-row">
                            <span class="step-num">2</span>
                            <div>
                                <h3 class="card-title">Upload Answer Sheet (PDF or Images)</h3>
                                <p class="card-desc">Supported: JPG, JPEG, PNG, WebP, PDF. Multi-page documents will be extracted automatically.</p>
                            </div>
                        </div>

                        <!-- Dropzone -->
                        <div class="dropzone-box" id="file-dropzone">
                            <input type="file" id="file-input-field" multiple accept=".pdf,image/png,image/jpeg,image/jpg,image/webp" style="display: none;" />
                            <div class="dropzone-content">
                                <div class="dropzone-icon">${ic.upload || ''}</div>
                                <div class="dropzone-text">
                                    <span>Drag and drop answer sheet files here</span>, or <span class="browse-link">browse from computer</span>
                                </div>
                                <div class="dropzone-hint">PDF documents or multiple image pages (Max 25MB per file)</div>
                            </div>
                        </div>

                        <!-- Uploaded Pages Preview Strip -->
                        <div class="pages-preview-strip" id="pages-preview-area" style="display: none;">
                            <div class="pages-strip-header">
                                <span class="pages-count-tag" id="pages-count-text">0 Pages Extracted</span>
                                <button type="button" class="btn-clear-pages" id="btn-clear-pages">Clear All</button>
                            </div>
                            <div class="pages-thumbnails-row" id="pages-thumbnails-list">
                                <!-- Thumbnails injected here -->
                            </div>
                        </div>
                    </div>

                    <!-- Submit Footer -->
                    <div class="form-footer-action">
                        <button type="submit" class="btn-start-correction" id="btn-submit-eval">
                            <span class="btn-icon">${ic.pen || ''}</span> Start Correction
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    bindEvents() {
        // Toggle optional details
        const toggleBtn = this.container.querySelector("#toggle-opt-details");
        const optBody = this.container.querySelector("#opt-details-body");
        if (toggleBtn && optBody) {
            toggleBtn.addEventListener("click", () => {
                const isOpen = optBody.style.display !== "none";
                optBody.style.display = isOpen ? "none" : "grid";
                toggleBtn.textContent = isOpen ? "+ Optional Institution & Evaluator Profile" : "- Hide Optional Profile";
            });
        }

        // Questions number change
        const numQInp = this.container.querySelector("#inp-num-questions");
        const maxMInp = this.container.querySelector("#inp-max-marks");
        if (numQInp) {
            numQInp.addEventListener("input", () => {
                const count = Math.max(1, Math.min(50, Number(numQInp.value) || 1));
                const totalM = Number(maxMInp?.value) || 20;
                this.generateQuestionInputs(count, totalM);
            });
        }

        // File dropzone events
        const dropzone = this.container.querySelector("#file-dropzone");
        const fileInput = this.container.querySelector("#file-input-field");

        if (dropzone && fileInput) {
            dropzone.addEventListener("click", () => fileInput.click());
            dropzone.addEventListener("dragover", (e) => {
                e.preventDefault();
                dropzone.classList.add("dragover");
            });
            dropzone.addEventListener("dragleave", () => {
                dropzone.classList.remove("dragover");
            });
            dropzone.addEventListener("drop", (e) => {
                e.preventDefault();
                dropzone.classList.remove("dragover");
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.handleFiles(e.dataTransfer.files);
                }
            });

            fileInput.addEventListener("change", () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    this.handleFiles(fileInput.files);
                }
            });
        }

        // Clear pages button
        const clearBtn = this.container.querySelector("#btn-clear-pages");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                this.uploadedPages = [];
                this.renderThumbnails();
            });
        }

        // Quick load sample paper
        const sampleBtn = this.container.querySelector("#btn-load-sample-eval");
        if (sampleBtn) {
            sampleBtn.addEventListener("click", () => this.loadSamplePreset());
        }

        // Form submit
        const form = this.container.querySelector("#evaluation-creation-form");
        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                this.submitForm();
            });
        }
    }

    generateQuestionInputs(count, totalMarks) {
        const container = this.container.querySelector("#question-chips-container");
        if (!container) return;

        const defaultPerQ = Math.max(1, Math.floor(totalMarks / count));
        const remainder = totalMarks - (defaultPerQ * count);

        this.questionsConfig = [];
        let html = "";
        for (let i = 1; i <= count; i++) {
            const marks = i === count ? defaultPerQ + remainder : defaultPerQ;
            this.questionsConfig.push({ qNo: i, maxMarks: marks, awardedMarks: 0, status: "unmarked" });

            html += `
                <div class="q-config-chip">
                    <span class="q-chip-label">Q${i} Max:</span>
                    <input type="number" step="0.5" min="1" class="q-chip-input" data-qno="${i}" value="${marks}" />
                </div>
            `;
        }
        container.innerHTML = html;

        // Listen for max mark adjustments
        container.querySelectorAll(".q-chip-input").forEach(input => {
            input.addEventListener("input", () => {
                const qNo = Number(input.getAttribute("data-qno"));
                const val = Math.max(1, Number(input.value) || 1);
                const item = this.questionsConfig.find(q => q.qNo === qNo);
                if (item) item.maxMarks = val;

                // Sync total max marks input
                const newTotal = this.questionsConfig.reduce((sum, q) => sum + q.maxMarks, 0);
                const maxInp = this.container.querySelector("#inp-max-marks");
                if (maxInp) maxInp.value = newTotal;
            });
        });
    }

    loadSamplePreset() {
        const studentName = "Arun Kumar";
        const regNo = "101";

        this.container.querySelector("#inp-student-name").value = studentName;
        this.container.querySelector("#inp-roll-no").value = regNo;
        this.container.querySelector("#inp-class").value = "Class 10";
        this.container.querySelector("#inp-section").value = "A";
        this.container.querySelector("#inp-subject").value = "Physics";
        this.container.querySelector("#inp-exam-name").value = "Mid-Term Examination 2026";
        this.container.querySelector("#inp-max-marks").value = "20";
        this.container.querySelector("#inp-num-questions").value = "5";

        this.generateQuestionInputs(5, 20);

        this.uploadedPages = [];
        this.renderThumbnails();
    }

    async handleFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type === "application/pdf") {
                await this.processPDFFile(file);
            } else if (file.type.startsWith("image/")) {
                await this.processImageFile(file);
            } else {
                alert(`Unsupported file format: ${file.name}. Please upload PDF or image files.`);
            }
        }
        this.renderThumbnails();
    }

    async processImageFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Automatic compression: scale down if width > 1600
                    const maxW = 1600;
                    let targetW = img.width;
                    let targetH = img.height;

                    if (targetW > maxW) {
                        targetH = Math.round((maxW / targetW) * targetH);
                        targetW = maxW;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    const compressedUrl = canvas.toDataURL("image/jpeg", 0.85);
                    this.uploadedPages.push(compressedUrl);
                    resolve();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async processPDFFile(file) {
        if (!window.pdfjsLib && window.ensurePdfJs) {
            await window.ensurePdfJs();
        }
        if (!window.pdfjsLib && window.CanvasEngine && window.CanvasEngine.ensurePdfJs) {
            await window.CanvasEngine.ensurePdfJs();
        }
        if (!window.pdfjsLib) {
            alert("PDF.js library is loading. Please try again in a few seconds.");
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 }); // High-DPI render

                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext("2d");

                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                this.uploadedPages.push(canvas.toDataURL("image/jpeg", 0.85));
            }
        } catch (e) {
            console.error("Error processing PDF:", e);
            alert("Failed to parse PDF file. Ensure it is a valid document.");
        }
    }

    renderThumbnails() {
        const area = this.container.querySelector("#pages-preview-area");
        const list = this.container.querySelector("#pages-thumbnails-list");
        const countText = this.container.querySelector("#pages-count-text");

        if (!area || !list) return;

        if (this.uploadedPages.length === 0) {
            area.style.display = "none";
            return;
        }

        area.style.display = "block";
        if (countText) countText.textContent = `${this.uploadedPages.length} Page(s) Ready for Evaluation`;

        list.innerHTML = this.uploadedPages.map((src, idx) => `
            <div class="page-thumb-card">
                <img src="${src}" alt="Page ${idx + 1}" class="page-thumb-img" />
                <span class="page-thumb-badge">Page ${idx + 1}</span>
                <button type="button" class="btn-remove-thumb" data-index="${idx}" title="Remove Page">×</button>
            </div>
        `).join("");

        list.querySelectorAll(".btn-remove-thumb").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = Number(btn.getAttribute("data-index"));
                this.uploadedPages.splice(idx, 1);
                this.renderThumbnails();
            });
        });
    }

    async submitForm() {
        // Validation
        const studentName = this.container.querySelector("#inp-student-name").value.trim();
        const rollNo = this.container.querySelector("#inp-roll-no").value.trim();
        const className = this.container.querySelector("#inp-class").value.trim();
        const section = this.container.querySelector("#inp-section").value.trim();
        const subject = this.container.querySelector("#inp-subject").value.trim();
        const examName = this.container.querySelector("#inp-exam-name").value.trim();
        const examDate = this.container.querySelector("#inp-exam-date").value;
        const correctionDate = this.container.querySelector("#inp-correction-date").value;
        const startTime = this.container.querySelector("#inp-start-time").value;
        const endTime = this.container.querySelector("#inp-end-time").value;
        const maxMarks = Number(this.container.querySelector("#inp-max-marks").value) || 20;

        const instName = this.container.querySelector("#inp-inst-name").value.trim();
        const teacherName = this.container.querySelector("#inp-teacher-name").value.trim();
        const academicYear = this.container.querySelector("#inp-academic-year").value.trim();

        if (this.uploadedPages.length === 0) {
            alert("Please attach or upload a PDF answer sheet for this student before saving.");
            return;
        }

        const evaluation = {
            id: `eval_${Date.now()}`,
            studentName,
            rollNo,
            class: className,
            section,
            subject,
            examName,
            examDate,
            correctionDate,
            startTime,
            endTime,
            maxMarks,
            institutionName: instName,
            teacherName,
            academicYear,
            pages: this.uploadedPages,
            questions: this.questionsConfig,
            annotations: [],
            obtainedMarks: 0,
            percentage: 0,
            grade: "--",
            correctCount: 0,
            wrongCount: 0,
            feedback: "",
            status: "Pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to storage
        await window.appStorage.saveEvaluation(evaluation);

        if (this.options.onStartCorrection) {
            this.options.onStartCorrection(evaluation);
        }
    }
}

window.EvaluationForm = EvaluationForm;
