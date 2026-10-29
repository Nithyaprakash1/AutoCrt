/**
 * Niprak OSM - AI-Assisted Handwritten Answer Sheet Auto-Evaluator
 * ===================================================================
 * Standalone, Opt-In, and Non-Destructive Module.
 * 
 * Features:
 * - Unobtrusive workspace toolbar integration ("✨ AI Auto-Mark").
 * - Apple Cupertino-style modal for Answer Key & Rubric upload/paste.
 * - Gemini Vision AI integration to scan ruled handwritten student sheets.
 * - Extracts handwritten Q numbers, steps, formulas, and answers.
 * - Non-destructive mark injection via existing platform APIs.
 * - Human-in-the-loop cross-checking with confidence badges & instant teacher override.
 * 
 * STRICT ARCHITECTURAL RULE:
 * ZERO modification to core platform files (app.js, canvas-engine.js, storage.js).
 */

(function () {
    "use strict";

    class AIAutoEvaluator {
        constructor() {
            this.storageKeyApiKey = "niprak_ai_gemini_api_key";
            this.storageKeyModel = "niprak_ai_gemini_model";
            this.storageKeyRubricsPrefix = "niprak_ai_rubric_";

            this.apiKey = localStorage.getItem(this.storageKeyApiKey) || "";
            this.selectedModel = localStorage.getItem(this.storageKeyModel) || "gemini-2.5-flash";
            this.isEvaluating = false;
            this.currentEvaluations = [];
            this.answerKeyText = "";

            this.init();
        }

        init() {
            this.injectStyles();
            this.injectModal();
            this.bindToolbarMount();
            console.log("[AI-Auto-Evaluator] Standalone Vision AI Module loaded successfully.");
        }

        // =========================================================================
        // 1. STYLES (Self-Contained Cupertino / Apple Glassmorphic Design)
        // =========================================================================
        injectStyles() {
            if (document.getElementById("ai-auto-evaluator-styles")) return;

            const style = document.createElement("style");
            style.id = "ai-auto-evaluator-styles";
            style.textContent = `
                /* Toolbar Button */
                .btn-ws-ai-automark {
                    display: inline-flex !important;
                    align-items: center;
                    gap: 6px;
                    padding: 0 12px;
                    height: 32px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
                    color: #FFFFFF !important;
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    user-select: none;
                }
                .btn-ws-ai-automark:hover {
                    background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
                }
                .btn-ws-ai-automark:active {
                    transform: scale(0.97);
                }
                .btn-ws-ai-automark svg {
                    stroke: #FFFFFF;
                    flex-shrink: 0;
                }

                /* Modal Backdrop & Dialog */
                .ai-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 100000;
                    background: rgba(15, 23, 42, 0.5);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                    animation: aiModalFadeIn 0.2s ease;
                }
                @keyframes aiModalFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .ai-modal-card {
                    background: #FFFFFF;
                    width: 100%;
                    max-width: 660px;
                    max-height: 90vh;
                    border-radius: 20px;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: aiModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes aiModalPop {
                    from { opacity: 0; transform: scale(0.94) translateY(12px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .ai-modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid #E2E8F0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: #F8FAFC;
                }
                .ai-header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .ai-icon-circle {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
                    border: 1px solid #C7D2FE;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    color: #6366F1;
                }
                .ai-header-titles h3 {
                    margin: 0;
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: #0F172A;
                    letter-spacing: -0.01em;
                }
                .ai-header-titles p {
                    margin: 2px 0 0;
                    font-size: 0.78rem;
                    color: #64748B;
                }
                .ai-btn-close {
                    background: none;
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.3rem;
                    color: #64748B;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .ai-btn-close:hover {
                    background: #E2E8F0;
                    color: #0F172A;
                }

                /* Modal Body */
                .ai-modal-body {
                    padding: 20px 24px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                /* Form Sections */
                .ai-section {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 14px;
                    padding: 16px;
                }
                .ai-section-title {
                    font-size: 0.84rem;
                    font-weight: 700;
                    color: #334155;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .ai-section-title span.badge {
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 999px;
                    background: #E0E7FF;
                    color: #4F46E5;
                    font-weight: 600;
                }

                /* API Key Input */
                .ai-input-row {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .ai-text-input {
                    flex: 1;
                    padding: 9px 12px;
                    border: 1px solid #CBD5E1;
                    border-radius: 10px;
                    font-size: 0.84rem;
                    background: #FFFFFF;
                    color: #0F172A;
                    outline: none;
                    transition: border-color 0.15s ease;
                }
                .ai-text-input:focus {
                    border-color: #6366F1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
                }
                .ai-select {
                    padding: 8px 12px;
                    border: 1px solid #CBD5E1;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    background: #FFFFFF;
                    color: #0F172A;
                    outline: none;
                }

                /* Answer Key Textarea */
                .ai-textarea {
                    width: 100%;
                    box-sizing: border-box;
                    min-height: 120px;
                    max-height: 220px;
                    padding: 10px 12px;
                    border: 1px solid #CBD5E1;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-family: inherit;
                    color: #0F172A;
                    background: #FFFFFF;
                    resize: vertical;
                    outline: none;
                    line-height: 1.45;
                }
                .ai-textarea:focus {
                    border-color: #6366F1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
                }

                /* File Upload Dropzone */
                .ai-dropzone {
                    border: 1.5px dashed #CBD5E1;
                    border-radius: 10px;
                    padding: 12px;
                    text-align: center;
                    background: #FFFFFF;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    margin-bottom: 10px;
                }
                .ai-dropzone:hover {
                    border-color: #6366F1;
                    background: #F5F3FF;
                }
                .ai-dropzone p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: #64748B;
                }
                .ai-dropzone strong {
                    color: #4F46E5;
                }

                /* Target Questions Scope Pills */
                .ai-scope-pills {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .ai-scope-pill {
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .ai-scope-pill.active {
                    background: #6366F1;
                    color: #FFFFFF;
                    border-color: #4F46E5;
                }

                /* Footer Actions */
                .ai-modal-footer {
                    padding: 16px 24px;
                    border-top: 1px solid #E2E8F0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: #F8FAFC;
                }
                .ai-footer-note {
                    font-size: 0.74rem;
                    color: #64748B;
                    max-width: 320px;
                }
                .ai-footer-btns {
                    display: flex;
                    gap: 10px;
                }
                .ai-btn-secondary {
                    padding: 9px 16px;
                    border-radius: 10px;
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    color: #334155;
                    font-size: 0.84rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .ai-btn-primary {
                    padding: 9px 20px;
                    border-radius: 10px;
                    border: 1px solid #4F46E5;
                    background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
                    color: #FFFFFF;
                    font-size: 0.86rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
                    transition: all 0.15s ease;
                }
                .ai-btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.45);
                }
                .ai-btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* Live Progress Overlay */
                .ai-progress-wrap {
                    display: none;
                    flex-direction: column;
                    align-items: center;
                    padding: 30px 20px;
                    text-align: center;
                }
                .ai-spinner {
                    width: 44px;
                    height: 44px;
                    border: 3.5px solid rgba(99, 102, 241, 0.15);
                    border-top-color: #6366F1;
                    border-radius: 50%;
                    animation: aiSpin 0.8s linear infinite;
                    margin-bottom: 16px;
                }
                @keyframes aiSpin {
                    to { transform: rotate(360deg); }
                }
                .ai-progress-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #0F172A;
                    margin: 0 0 6px;
                }
                .ai-progress-desc {
                    font-size: 0.82rem;
                    color: #64748B;
                    margin: 0 0 16px;
                }
                .ai-progress-bar-track {
                    width: 100%;
                    max-width: 380px;
                    height: 8px;
                    background: #E2E8F0;
                    border-radius: 99px;
                    overflow: hidden;
                }
                .ai-progress-bar-fill {
                    height: 100%;
                    width: 15%;
                    background: linear-gradient(90deg, #6366F1, #8B5CF6);
                    border-radius: 99px;
                    transition: width 0.3s ease;
                }

                /* Visual AI Chip in Sidebar Question List */
                .ai-question-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 0.68rem;
                    font-weight: 600;
                    padding: 1px 6px;
                    border-radius: 999px;
                    margin-left: 6px;
                    cursor: help;
                    user-select: none;
                    transition: all 0.15s ease;
                }
                .ai-chip-high {
                    background: rgba(34, 197, 94, 0.14);
                    color: #16A34A;
                    border: 1px solid rgba(34, 197, 94, 0.35);
                }
                .ai-chip-medium {
                    background: rgba(245, 158, 11, 0.14);
                    color: #D97706;
                    border: 1px solid rgba(245, 158, 11, 0.35);
                }
                .ai-chip-low {
                    background: rgba(239, 68, 68, 0.14);
                    color: #DC2626;
                    border: 1px solid rgba(239, 68, 68, 0.35);
                }
            `;
            document.head.appendChild(style);
        }

        // =========================================================================
        // 2. MODAL INJECTION (Apple / Cupertino Dialog)
        // =========================================================================
        injectModal() {
            if (document.getElementById("modal-ai-auto-evaluator")) return;

            const modal = document.createElement("div");
            modal.id = "modal-ai-auto-evaluator";
            modal.className = "ai-modal-backdrop";
            modal.style.display = "none";

            modal.innerHTML = `
                <div class="ai-modal-card">
                    <!-- Modal Header -->
                    <div class="ai-modal-header">
                        <div class="ai-header-left">
                            <div class="ai-icon-circle">✨</div>
                            <div class="ai-header-titles">
                                <h3>AI Auto-Mark with Answer Key</h3>
                                <p>Automated handwritten answer sheet evaluation powered by Vision AI.</p>
                            </div>
                        </div>
                        <button type="button" class="ai-btn-close" id="ai-btn-close-modal">×</button>
                    </div>

                    <!-- Modal Body (Config & Input View) -->
                    <div class="ai-modal-body" id="ai-modal-config-view">
                        <!-- Section 1: Vision Model & API Key -->
                        <div class="ai-section">
                            <div class="ai-section-title">
                                <span>Vision AI Credentials</span>
                                <span class="badge">Google Gemini</span>
                            </div>
                            <div class="ai-input-row" style="margin-bottom: 8px;">
                                <input type="password" id="ai-input-api-key" class="ai-text-input" 
                                    placeholder="Enter your Gemini API Key..." value="${this.apiKey}" />
                                <button type="button" id="ai-btn-toggle-key" class="ai-btn-secondary" style="padding: 8px 12px; font-size: 0.78rem;">Show</button>
                                <select id="ai-select-model" class="ai-select">
                                    <option value="gemini-2.5-flash" ${this.selectedModel === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (Fast & Accurate)</option>
                                    <option value="gemini-1.5-flash" ${this.selectedModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
                                    <option value="gemini-1.5-pro" ${this.selectedModel === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro (Deep Reasoning)</option>
                                </select>
                            </div>
                            <div style="font-size: 0.74rem; color: #64748B;">
                                Keys are securely stored in your browser's local storage.
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #6366F1; text-decoration: underline; font-weight: 500;">Get a free API key here ↗</a>
                            </div>
                        </div>

                        <!-- Section 2: Answer Key / Marking Rubric -->
                        <div class="ai-section">
                            <div class="ai-section-title">
                                <span>Model Answer Key / Marking Rubric</span>
                                <span class="badge" id="ai-rubric-status-badge">Required</span>
                            </div>
                            <div class="ai-dropzone" id="ai-file-dropzone">
                                <p>📄 Drag & drop Answer Key (PDF, TXT, Image) or <strong>Browse File</strong></p>
                                <input type="file" id="ai-input-rubric-file" accept=".pdf,.txt,.docx,image/*" style="display: none;" />
                            </div>
                            <textarea id="ai-textarea-rubric" class="ai-textarea" 
                                placeholder="Or paste the Answer Key / Rubric text here:&#10;Q1: (Option B) Photosynthesis — 1 Mark&#10;Q2: Ohm's Law formula V = IR and statement — 2 Marks&#10;Q3: Definition of Database with Primary Key example — 3 Marks..."></textarea>
                        </div>

                        <!-- Section 3: Evaluation Scope -->
                        <div class="ai-section">
                            <div class="ai-section-title">
                                <span>Evaluation Scope</span>
                                <span style="font-size: 0.76rem; color: #64748B;" id="ai-exam-info-text">Detecting active paper...</span>
                            </div>
                            <div class="ai-scope-pills">
                                <button type="button" class="ai-scope-pill active" data-scope="all">Scan & Match All Questions</button>
                                <button type="button" class="ai-scope-pill" data-scope="unmarked">Unmarked Questions Only</button>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Body (Progress View during Evaluation) -->
                    <div class="ai-progress-wrap" id="ai-modal-progress-view">
                        <div class="ai-spinner"></div>
                        <h4 class="ai-progress-title" id="ai-progress-status-title">Preparing High-Res Pages...</h4>
                        <p class="ai-progress-desc" id="ai-progress-status-desc">Rendering handwritten student pages for Vision AI analysis...</p>
                        <div class="ai-progress-bar-track">
                            <div class="ai-progress-bar-fill" id="ai-progress-bar"></div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="ai-modal-footer">
                        <div class="ai-footer-note">
                            Human-in-the-Loop: AI suggests marks; you can easily cross-check, adjust, and override any score before saving.
                        </div>
                        <div class="ai-footer-btns">
                            <button type="button" class="ai-btn-secondary" id="ai-btn-cancel">Cancel</button>
                            <button type="button" class="ai-btn-primary" id="ai-btn-start-eval">
                                <span>✨ Start AI Auto-Mark</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            this.bindModalEvents(modal);
        }

        bindModalEvents(modal) {
            const btnClose = modal.querySelector("#ai-btn-close-modal");
            const btnCancel = modal.querySelector("#ai-btn-cancel");
            const btnToggleKey = modal.querySelector("#ai-btn-toggle-key");
            const inpApiKey = modal.querySelector("#ai-input-api-key");
            const selectModel = modal.querySelector("#ai-select-model");
            const dropzone = modal.querySelector("#ai-file-dropzone");
            const inpFile = modal.querySelector("#ai-input-rubric-file");
            const textareaRubric = modal.querySelector("#ai-textarea-rubric");
            const btnStart = modal.querySelector("#ai-btn-start-eval");
            const scopePills = modal.querySelectorAll(".ai-scope-pill");

            // Close handlers
            const closeModal = () => {
                if (this.isEvaluating) return;
                modal.style.display = "none";
            };
            if (btnClose) btnClose.addEventListener("click", closeModal);
            if (btnCancel) btnCancel.addEventListener("click", closeModal);
            modal.addEventListener("click", (e) => {
                if (e.target === modal) closeModal();
            });

            // Toggle API key visibility
            if (btnToggleKey && inpApiKey) {
                btnToggleKey.addEventListener("click", () => {
                    if (inpApiKey.type === "password") {
                        inpApiKey.type = "text";
                        btnToggleKey.textContent = "Hide";
                    } else {
                        inpApiKey.type = "password";
                        btnToggleKey.textContent = "Show";
                    }
                });
            }

            // Save API Key & Model
            if (inpApiKey) {
                inpApiKey.addEventListener("input", () => {
                    this.apiKey = inpApiKey.value.trim();
                    localStorage.setItem(this.storageKeyApiKey, this.apiKey);
                });
            }
            if (selectModel) {
                selectModel.addEventListener("change", () => {
                    this.selectedModel = selectModel.value;
                    localStorage.setItem(this.storageKeyModel, this.selectedModel);
                });
            }

            // File upload & Dropzone
            if (dropzone && inpFile) {
                dropzone.addEventListener("click", () => inpFile.click());
                dropzone.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    dropzone.style.borderColor = "#6366F1";
                });
                dropzone.addEventListener("dragleave", () => {
                    dropzone.style.borderColor = "#CBD5E1";
                });
                dropzone.addEventListener("drop", (e) => {
                    e.preventDefault();
                    dropzone.style.borderColor = "#CBD5E1";
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        this.handleRubricFile(e.dataTransfer.files[0], textareaRubric);
                    }
                });
                inpFile.addEventListener("change", () => {
                    if (inpFile.files && inpFile.files.length > 0) {
                        this.handleRubricFile(inpFile.files[0], textareaRubric);
                    }
                });
            }

            // Scope pills selection
            scopePills.forEach(pill => {
                pill.addEventListener("click", () => {
                    scopePills.forEach(p => p.classList.remove("active"));
                    pill.classList.add("active");
                });
            });

            // Start AI Auto-Evaluation
            if (btnStart) {
                btnStart.addEventListener("click", () => {
                    this.startEvaluationPipeline();
                });
            }
        }

        async handleRubricFile(file, textareaEl) {
            if (!file) return;
            const name = file.name.toLowerCase();

            // Text file
            if (name.endsWith(".txt")) {
                const text = await file.text();
                if (textareaEl) textareaEl.value = text;
                this.showToast(`Loaded ${file.name}`);
                return;
            }

            // PDF file
            if (name.endsWith(".pdf") && window.pdfjsLib) {
                try {
                    this.showToast("Extracting text from PDF Answer Key...");
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(" ");
                        fullText += `\n--- Answer Key Page ${i} ---\n` + pageText;
                    }
                    if (textareaEl) textareaEl.value = fullText.trim();
                    this.showToast(`Extracted ${pdf.numPages} page(s) from Answer Key PDF.`);
                } catch (e) {
                    console.warn("PDF extraction warning:", e);
                    this.showToast("Could not extract text automatically. Please paste the rubric text.", "warning");
                }
            } else {
                this.showToast("Please paste the answer key text or upload a .txt / .pdf file.", "info");
            }
        }

        // =========================================================================
        // 3. TOOLBAR MOUNTING (Injects into Workspace without modifying core code)
        // =========================================================================
        bindToolbarMount() {
            const mount = () => {
                const topActions = document.getElementById("ws-top-actions");
                if (topActions && !document.getElementById("ws-btn-ai-automark")) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "btn-ws-tool btn-ws-ai-automark";
                    btn.id = "ws-btn-ai-automark";
                    btn.title = "AI-Assisted Auto-Marking with Answer Key (Opt-In)";
                    btn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                        <span class="btn-text">AI Auto-Mark</span>
                    `;
                    btn.addEventListener("click", () => this.openModal());

                    // Place right before "ws-btn-save-progress"
                    const saveBtn = document.getElementById("ws-btn-save-progress");
                    if (saveBtn) {
                        topActions.insertBefore(btn, saveBtn);
                    } else {
                        topActions.appendChild(btn);
                    }
                }
            };

            // Mount on DOM ready and monitor view transitions
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", mount);
            } else {
                mount();
            }

            // Periodic sanity check to ensure button is mounted when entering workspace
            setInterval(mount, 1200);
        }

        openModal() {
            const modal = document.getElementById("modal-ai-auto-evaluator");
            if (!modal) return;

            const ev = window.app?.activeEvaluation;
            if (!ev) {
                this.showToast("Please open a student answer sheet in the workspace first.", "warning");
                return;
            }

            // Restore last saved rubric for this subject / exam if available
            const rubricKey = this.storageKeyRubricsPrefix + (ev.subject || "general").toLowerCase().replace(/[^a-z0-9]/g, '_');
            const savedRubric = localStorage.getItem(rubricKey) || "";
            const textarea = modal.querySelector("#ai-textarea-rubric");
            if (textarea && !textarea.value && savedRubric) {
                textarea.value = savedRubric;
            }

            const infoEl = modal.querySelector("#ai-exam-info-text");
            if (infoEl) {
                infoEl.textContent = `${ev.studentName || 'Student'} • ${ev.subject || 'Subject'} (${ev.examName || ev.templateName || 'Exam'})`;
            }

            // Reset progress views
            const configView = modal.querySelector("#ai-modal-config-view");
            const progressView = modal.querySelector("#ai-modal-progress-view");
            const btnStart = modal.querySelector("#ai-btn-start-eval");
            if (configView) configView.style.display = "flex";
            if (progressView) progressView.style.display = "none";
            if (btnStart) btnStart.disabled = false;

            modal.style.display = "flex";
        }

        // =========================================================================
        // 4. SCANNING & HIGH-RESOLUTION EXTRACTION PIPELINE
        // =========================================================================
        async getHighResStudentPages() {
            const pages = [];
            const ce = window.app?.canvasEngine;

            // Priority 1: High-resolution raster images from CanvasEngine
            if (ce && Array.isArray(ce.pages) && ce.pages.length > 0) {
                for (let i = 0; i < ce.pages.length; i++) {
                    const p = ce.pages[i];
                    if (p.canvas && p.canvas.width > 0) {
                        const dataUrl = p.canvas.toDataURL("image/jpeg", 0.88);
                        pages.push({
                            pageIndex: i + 1,
                            base64: dataUrl.split(",")[1]
                        });
                    } else if (p.imgObj && p.imgObj.complete && p.imgObj.naturalWidth > 0) {
                        const offscreen = document.createElement("canvas");
                        offscreen.width = p.imgObj.naturalWidth;
                        offscreen.height = p.imgObj.naturalHeight;
                        const ctx = offscreen.getContext("2d");
                        ctx.drawImage(p.imgObj, 0, 0);
                        const dataUrl = offscreen.toDataURL("image/jpeg", 0.88);
                        pages.push({
                            pageIndex: i + 1,
                            base64: dataUrl.split(",")[1]
                        });
                    } else if (p.imageSrc && typeof p.imageSrc === "string" && p.imageSrc.startsWith("data:image/")) {
                        pages.push({
                            pageIndex: i + 1,
                            base64: p.imageSrc.split(",")[1]
                        });
                    }
                }
            }

            // Priority 2: PDF.js native renderer fallback if needed
            if (pages.length === 0) {
                const ev = window.app?.activeEvaluation;
                const pdfSrc = ev?.pdfDataUrl || ev?.pdfStorageUrl;
                if (pdfSrc && window.pdfjsLib) {
                    try {
                        const pdf = await window.pdfjsLib.getDocument(pdfSrc).promise;
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const viewport = page.getViewport({ scale: 1.6 });
                            const canvas = document.createElement("canvas");
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            const ctx = canvas.getContext("2d");
                            await page.render({ canvasContext: ctx, viewport }).promise;
                            const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
                            pages.push({
                                pageIndex: i,
                                base64: dataUrl.split(",")[1]
                            });
                        }
                    } catch (pdfErr) {
                        console.warn("[AI-Auto-Evaluator] PDF.js fallback warning:", pdfErr);
                    }
                }
            }

            return pages;
        }

        // =========================================================================
        // 5. EVALUATION PIPELINE EXECUTION (Vision AI)
        // =========================================================================
        async startEvaluationPipeline() {
            const modal = document.getElementById("modal-ai-auto-evaluator");
            if (!modal) return;

            const apiKey = (modal.querySelector("#ai-input-api-key")?.value || "").trim();
            if (!apiKey) {
                this.showToast("Please enter a valid Gemini API Key.", "warning");
                return;
            }

            const rubricText = (modal.querySelector("#ai-textarea-rubric")?.value || "").trim();
            if (!rubricText) {
                this.showToast("Please enter or upload the Answer Key / Rubric.", "warning");
                return;
            }

            const ev = window.app?.activeEvaluation;
            if (!ev) {
                this.showToast("No active evaluation paper found.", "error");
                return;
            }

            // Save rubric for future papers of this subject
            const rubricKey = this.storageKeyRubricsPrefix + (ev.subject || "general").toLowerCase().replace(/[^a-z0-9]/g, '_');
            localStorage.setItem(rubricKey, rubricText);

            // Determine questions scope
            const activeScope = modal.querySelector(".ai-scope-pill.active")?.getAttribute("data-scope") || "all";
            const questions = window.app?.markingPanel?.questions || ev.questions || [];
            let targetQs = [...questions];

            if (activeScope === "unmarked") {
                targetQs = targetQs.filter(q => q.status === "unmarked" || q.status === "pending" || !q.status);
            }

            if (targetQs.length === 0) {
                this.showToast("No questions match the selected evaluation scope.", "info");
                return;
            }

            // Switch to progress view
            const configView = modal.querySelector("#ai-modal-config-view");
            const progressView = modal.querySelector("#ai-modal-progress-view");
            const titleEl = modal.querySelector("#ai-progress-status-title");
            const descEl = modal.querySelector("#ai-progress-status-desc");
            const barEl = modal.querySelector("#ai-progress-bar");
            const btnStart = modal.querySelector("#ai-btn-start-eval");

            if (configView) configView.style.display = "none";
            if (progressView) progressView.style.display = "flex";
            if (btnStart) btnStart.disabled = true;
            this.isEvaluating = true;

            try {
                // Step 1: Render student pages
                if (titleEl) titleEl.textContent = "Rendering Student Answer Pages...";
                if (descEl) descEl.textContent = "Extracting high-resolution scans of handwritten answer sheet...";
                if (barEl) barEl.style.width = "25%";

                const pageImages = await this.getHighResStudentPages();
                if (pageImages.length === 0) {
                    throw new Error("Unable to capture student answer sheet pages for AI analysis.");
                }

                // Step 2: Build Vision AI Prompt
                if (titleEl) titleEl.textContent = `Analyzing with ${this.selectedModel}...`;
                if (descEl) descEl.textContent = `Sending ${pageImages.length} handwritten page(s) to Vision AI for grading...`;
                if (barEl) barEl.style.width = "55%";

                const prompt = this.buildPrompt(ev, targetQs, rubricText);
                const result = await this.callGeminiVisionAPI(apiKey, this.selectedModel, prompt, pageImages);

                // Step 3: Inject Marks Non-Destructively
                if (titleEl) titleEl.textContent = "Allotting Question Marks...";
                if (descEl) descEl.textContent = "Injecting AI-allotted marks into student scorecard for your review...";
                if (barEl) barEl.style.width = "85%";

                const count = this.injectEvaluationsIntoWorkspace(result.evaluations || []);

                if (barEl) barEl.style.width = "100%";
                this.showToast(`✨ AI evaluated and auto-filled ${count} question(s)! Review and override marks anytime.`, "success");

                // Auto-close modal after brief completion feedback
                setTimeout(() => {
                    modal.style.display = "none";
                    this.isEvaluating = false;
                }, 800);

            } catch (err) {
                console.error("[AI-Auto-Evaluator] Pipeline error:", err);
                this.showToast(`AI Auto-Mark Error: ${err.message}`, "error");
                if (configView) configView.style.display = "flex";
                if (progressView) progressView.style.display = "none";
                if (btnStart) btnStart.disabled = false;
                this.isEvaluating = false;
            }
        }

        buildPrompt(ev, targetQs, rubricText) {
            const qListSummary = targetQs.map(q => ({
                qNum: String(q.qNo || q.label || "").replace(/[^0-9]/g, '') || String(q.qNo || ""),
                label: q.label || `Q${q.qNo}`,
                maxMarks: Number(q.maxMarks) || 1,
                topic: q.topic || ""
            }));

            return `You are an expert, meticulous examination evaluator assessing a student's handwritten exam answer paper.
Attached are high-resolution page images of the student's handwritten ruled answer sheets.

EXAMINATION DETAILS:
- Student: ${ev.studentName || 'Student'} (Roll: ${ev.rollNo || '—'})
- Subject: ${ev.subject || 'Subject'}
- Assessment: ${ev.examName || ev.templateName || 'Standard Assessment'}

TARGET QUESTIONS TO EVALUATE:
${JSON.stringify(qListSummary, null, 2)}

OFFICIAL MODEL ANSWER KEY & MARKING RUBRIC:
${rubricText}

EVALUATION RULES:
1. Scan the student's handwritten answers across all pages. Locate question numbers written by the student (e.g. "Q1", "1", "1(a)", "Ans 2", etc.).
2. For each question in TARGET QUESTIONS:
   - Carefully read the student's handwritten text, formulas, steps, diagrams, and keywords.
   - Compare the student's answer against the Official Model Answer Key and Rubric.
   - Award a fair numeric score between 0 and maxMarks (supports 0.5 increments e.g. 0.5, 1, 1.5, 2, 2.5, etc.).
   - Full marks if correct. Partial marks if steps/keywords match. 0 marks if completely incorrect or unanswered.
   - Assess confidence: "high", "medium", or "low" (if handwriting is ambiguous or messy).
   - Provide a concise 1-sentence teacher explanation justifying the score.
3. Return STRICT JSON with no surrounding text or markdown formatting:
{
  "evaluations": [
    {
      "qNum": "1",
      "score": 2,
      "maxScore": 2,
      "confidence": "high",
      "explanation": "Correct formula and final answer match the key."
    }
  ]
}`;
        }

        async callGeminiVisionAPI(apiKey, model, promptText, pageImages) {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            // Prepare inline data parts for each page image
            const parts = [{ text: promptText }];
            pageImages.forEach(img => {
                parts.push({
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: img.base64
                    }
                });
            });

            const payload = {
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            };

            const resp = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                const errMsg = errData.error?.message || `HTTP ${resp.status} ${resp.statusText}`;
                throw new Error(errMsg);
            }

            const data = await resp.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) {
                throw new Error("No response content generated by Vision AI model.");
            }

            try {
                return JSON.parse(textResponse);
            } catch (jsonErr) {
                // Sanitize potential markdown code fences
                const cleanJson = textResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
                return JSON.parse(cleanJson);
            }
        }

        // =========================================================================
        // 6. NON-DESTRUCTIVE MARK INJECTION & HUMAN-IN-THE-LOOP OVERRIDE
        // =========================================================================
        injectEvaluationsIntoWorkspace(evaluationsList) {
            if (!Array.isArray(evaluationsList) || evaluationsList.length === 0) return 0;

            const mp = window.app?.markingPanel;
            const questions = mp?.questions || window.app?.activeEvaluation?.questions || [];
            let injectedCount = 0;

            evaluationsList.forEach(item => {
                const qNumClean = String(item.qNum || "").replace(/[^0-9]/g, '');
                if (!qNumClean) return;

                // Match question index in MarkingPanel
                const idx = questions.findIndex(q => {
                    const qNoStr = String(q.qNo || "").replace(/[^0-9]/g, '');
                    const labelStr = String(q.label || "").replace(/[^0-9]/g, '');
                    return qNoStr === qNumClean || labelStr === qNumClean;
                });

                if (idx >= 0) {
                    const targetQ = questions[idx];
                    const maxScore = Number(targetQ.maxMarks) || Number(item.maxScore) || 1;
                    const awarded = Math.min(Math.max(0, Number(item.score) || 0), maxScore);

                    // Update question mark via existing platform method
                    if (mp && typeof mp.assignQuestionMarkDirect === "function") {
                        const status = awarded === maxScore ? "correct" : (awarded === 0 ? "wrong" : "partial");
                        mp.assignQuestionMarkDirect(idx, awarded, status);
                    }

                    // Store AI metadata directly on the question
                    targetQ.aiEvaluated = true;
                    targetQ.aiConfidence = item.confidence || "high";
                    targetQ.aiExplanation = item.explanation || "";
                    targetQ.aiScore = awarded;

                    injectedCount++;
                }
            });

            // Re-render sidebar and attach visual AI chips
            if (mp && typeof mp.renderQuestionsList === "function") {
                mp.renderQuestionsList();
            }
            this.attachAIBadgesToQuestionList(questions);

            return injectedCount;
        }

        attachAIBadgesToQuestionList(questions) {
            const listContainer = document.getElementById("questions-list-container");
            if (!listContainer || !Array.isArray(questions)) return;

            questions.forEach((q, idx) => {
                if (!q.aiEvaluated) return;

                const qRow = listContainer.querySelector(`.q-row[data-index="${idx}"]`);
                if (qRow && !qRow.querySelector(".ai-question-chip")) {
                    const chip = document.createElement("span");
                    const conf = (q.aiConfidence || "high").toLowerCase();
                    const confClass = conf === "high" ? "ai-chip-high" : (conf === "medium" ? "ai-chip-medium" : "ai-chip-low");

                    chip.className = `ai-question-chip ${confClass}`;
                    chip.title = `AI Evaluation (${conf.toUpperCase()} confidence):\n${q.aiExplanation || 'Auto-matched with rubric'}\nClick to cross-check or adjust.`;
                    chip.innerHTML = `🤖 Auto: ${q.aiScore}/${q.maxMarks}M`;

                    const labelEl = qRow.querySelector(".q-label-col") || qRow.querySelector(".q-title");
                    if (labelEl) {
                        labelEl.appendChild(chip);
                    }
                }
            });
        }

        showToast(message, type = "info") {
            if (window.app && typeof window.app.showToast === "function") {
                window.app.showToast(message, type);
            } else {
                console.log(`[AI-Auto-Evaluator Toast] ${type.toUpperCase()}: ${message}`);
            }
        }
    }

    // Initialize as a global singleton
    window.aiAutoEvaluator = new AIAutoEvaluator();

})();
