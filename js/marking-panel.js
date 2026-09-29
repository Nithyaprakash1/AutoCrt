/**
 * OneSpace Digital Correction - Question-Wise Marking & Scoring Engine
 * Supports:
 * - Structured Sections (A, B, C...) with Question Count, Marks per Question, & Section Totals
 * - Choice Questions ("this or that" / Option 1 OR Option 2) with fixed question ceiling
 * - Sub-Questions (e.g. 12a = 2M, 12b = 2M, 12c = 1M) rolling up live into Question Total
 * - Step Marks (+0.5, +1.0) and Half Marks (0.5, 1.5, 2.5...)
 * - Live Section Totals, Question Totals, and Grand Score Recalculation
 * - Strict Regular Typography (0 Bold elements)
 */

// Global Grading Engine adhering to Official Pattern:
// A1: 91 – 100 (GP: 10)
// A2: 81 – 90  (GP: 9)
// B1: 71 – 80  (GP: 8)
// B2: 61 – 70  (GP: 7)
// C1: 51 – 60  (GP: 6)
// C2: 41 – 50  (GP: 5)
// D / D1 / D2: 33 – 40 (GP: 4)
// E1: 21 – 32  (GP: 0, Fail / Essential Repeat)
// E2: 0 – 20   (GP: 0, Fail / Essential Repeat)
window.calculateGradeScale = function(obtainedMarks, maxMarks) {
    const max = Number(maxMarks) || 70;
    const obt = Number(obtainedMarks) || 0;
    const pct = max > 0 ? Math.round((obt / max) * 100) : 0;

    let grade = "E2";
    let gradePoint = 0;
    let marksRange = "0 – 20";
    let remarks = "Fail / Essential Repeat";
    let status = "Fail";

    if (pct >= 91) {
        grade = "A1"; gradePoint = 10; marksRange = "91 – 100"; remarks = "Outstanding"; status = "Pass";
    } else if (pct >= 81) {
        grade = "A2"; gradePoint = 9; marksRange = "81 – 90"; remarks = "Excellent"; status = "Pass";
    } else if (pct >= 71) {
        grade = "B1"; gradePoint = 8; marksRange = "71 – 80"; remarks = "Very Good"; status = "Pass";
    } else if (pct >= 61) {
        grade = "B2"; gradePoint = 7; marksRange = "61 – 70"; remarks = "Good"; status = "Pass";
    } else if (pct >= 51) {
        grade = "C1"; gradePoint = 6; marksRange = "51 – 60"; remarks = "Above Average"; status = "Pass";
    } else if (pct >= 41) {
        grade = "C2"; gradePoint = 5; marksRange = "41 – 50"; remarks = "Average"; status = "Pass";
    } else if (pct >= 33) {
        grade = "D"; gradePoint = 4; marksRange = "33 – 40"; remarks = "Pass"; status = "Pass";
    } else if (pct >= 21) {
        grade = "E1"; gradePoint = 0; marksRange = "21 – 32"; remarks = "Fail / Essential Repeat"; status = "Fail";
    } else {
        grade = "E2"; gradePoint = 0; marksRange = "0 – 20"; remarks = "Fail / Essential Repeat"; status = "Fail";
    }

    return { grade, gradePoint, marksRange, remarks, status, percentage: pct };
};

class MarkingPanel {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = Object.assign({
            onScoreChange: null,
            onQuestionSelect: null,
            onPresetCommentClick: null
        }, options);

        this.questions = [];
        this.sections = [];
        this.activeQuestionIndex = 0;
        this.activeSubQuestionIndex = 0;
        this.selectedSectionFilter = "all";
        this.overallFeedback = "";
        this.maxMarksTotal = 0;
        this.obtainedMarksTotal = 0;
    }

    setEvaluationData(questions, maxMarks, feedback = "", sections = null) {
        // Robust helper to extract accurate section information for each question
        const getSecMeta = (q, idx) => {
            const sName = q.section || q.sectionName || "";
            let sId = q.sectionId;
            const match = sName.match(/Section\s+([A-Za-z])/i);
            let letter = match ? match[1].toUpperCase() : null;

            if (!letter && sId && sId.startsWith("sec_")) {
                letter = sId.replace("sec_", "").slice(0, 1).toUpperCase();
            }

            if (!letter) {
                if ((questions || []).length === 13) {
                    if (idx < 2) letter = "A";
                    else if (idx < 6) letter = "B";
                    else letter = "C";
                } else {
                    // Infer from question sequence for standard 33 Q paper if needed
                    if (idx < 16) letter = "A";
                    else if (idx < 21) letter = "B";
                    else if (idx < 28) letter = "C";
                    else if (idx < 30) letter = "D";
                    else letter = "E";
                }
            }

            sId = `sec_${letter.toLowerCase()}`;
            const finalName = `Section ${letter}`;
            return { sId, letter, sName: finalName };
        };

        // Gather unique sections across questions
        const distinctQSecs = new Map();
        (questions || []).forEach((q, idx) => {
            const meta = getSecMeta(q, idx);
            if (!distinctQSecs.has(meta.sId)) {
                distinctQSecs.set(meta.sId, meta);
            }
        });

        if (Array.isArray(sections) && sections.length > 1 && sections.length >= distinctQSecs.size) {
            this.sections = sections.map((s, idx) => ({
                id: s.id || `sec_${String.fromCharCode(97 + idx)}`,
                letter: s.letter || String.fromCharCode(65 + idx),
                name: s.name || `Section ${s.letter || String.fromCharCode(65 + idx)}`,
                title: s.title || s.name || `Section ${s.letter || String.fromCharCode(65 + idx)}`,
                questionCount: Number(s.questionCount) || Number(s.qCount) || 1,
                marksPerQ: Number(s.marksPerQ) || 1,
                maxMarks: Number(s.maxMarks) || (Number(s.questionCount || s.qCount || 1) * Number(s.marksPerQ || 1)),
                hasChoice: !!s.hasChoice,
                hasSubQuestions: !!s.hasSubQuestions
            }));
        } else if (window.MockData?.englishTemplate?.sections && (questions || []).length === 13) {
            // For 13 Qs English Core Board paper, use the official 3-section blueprint
            this.sections = JSON.parse(JSON.stringify(window.MockData.englishTemplate.sections)).map(s => ({
                ...s,
                questionCount: Number(s.questionCount) || Number(s.qCount) || 1
            }));
        } else if (window.MockData?.physicsTemplate?.sections && (questions || []).length === 33) {
            // For 33 Qs Physics Board paper, use the official 5-section blueprint
            this.sections = JSON.parse(JSON.stringify(window.MockData.physicsTemplate.sections)).map(s => ({
                ...s,
                questionCount: Number(s.questionCount) || Number(s.qCount) || 1
            }));
        } else {
            // Detect from questions
            const detectedSections = new Map();
            (questions || []).forEach((q, idx) => {
                const { sId, letter, sName } = getSecMeta(q, idx);
                if (!detectedSections.has(sId)) {
                    detectedSections.set(sId, {
                        id: sId,
                        letter: letter,
                        name: sName,
                        title: sName,
                        questionCount: 0,
                        marksPerQ: Number(q.maxMarks) || 1,
                        maxMarks: 0
                    });
                }
                const sec = detectedSections.get(sId);
                sec.questionCount++;
                sec.maxMarks += Number(q.maxMarks) || 0;
            });

            if (detectedSections.size > 0) {
                this.sections = Array.from(detectedSections.values());
            } else {
                this.sections = [
                    { id: "sec_a", letter: "A", name: "Section A", title: "Section A", questionCount: (questions || []).length || 5, marksPerQ: 1, maxMarks: Number(maxMarks) || 16 }
                ];
            }
        }

        // Parse & normalize questions
        this.questions = (questions || []).map((q, idx) => {
            const meta = getSecMeta(q, idx);
            const secObj = this.sections.find(s => s.id === meta.sId || s.letter === meta.letter || s.name === meta.sName || s.title === meta.sName) 
                           || this.sections[0] 
                           || { id: meta.sId, name: meta.sName, title: meta.sName };
            const secName = secObj.name;
            const secId = secObj.id;
            const maxM = Number(q.maxMarks) !== undefined && !isNaN(Number(q.maxMarks)) ? Number(q.maxMarks) : 1;

            // Handle sub-questions
            let subQs = null;
            if (q.hasSubQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
                subQs = q.subQuestions.map(sq => ({
                    subId: sq.subId || sq.letter || "a",
                    label: sq.label || `(${sq.subId || sq.letter || "a"})`,
                    maxMarks: Number(sq.maxMarks) || 1,
                    awardedMarks: sq.awardedMarks !== undefined ? Number(sq.awardedMarks) : 0
                }));
            }

            let awardedM = Number(q.awardedMarks);
            if (isNaN(awardedM)) awardedM = 0;
            if (subQs && subQs.length > 0) {
                awardedM = subQs.reduce((sum, sq) => sum + (Number(sq.awardedMarks) || 0), 0);
            }

            let status = q.status || "unmarked";
            if (awardedM === maxM) status = "correct";
            else if (awardedM === 0 && q.status === "wrong") status = "wrong";
            else if (awardedM > 0) status = "partial";

            return {
                id: q.id || `q${idx + 1}`,
                qNo: q.qNo !== undefined ? q.qNo : idx + 1,
                label: q.label || `Q${idx + 1}`,
                topic: q.topic || "",
                section: secName,
                sectionId: secId,
                maxMarks: maxM,
                awardedMarks: awardedM,
                status: status,
                isChoice: !!q.isChoice,
                choices: q.choices && q.choices.length > 0 ? q.choices : null,
                selectedChoice: q.selectedChoice || (q.choices ? (typeof q.choices[0] === "string" ? q.choices[0] : q.choices[0].label) : null),
                hasSubQuestions: !!(subQs && subQs.length > 0),
                subQuestions: subQs
            };
        });

        this.overallFeedback = feedback || "";
        this.maxMarksTotal = Number(maxMarks) || this.calculateDefaultMaxMarks();
        this.activeQuestionIndex = 0;
        this.activeSubQuestionIndex = 0;

        this.render();
        this.recalculate();
    }

    calculateDefaultMaxMarks() {
        return this.questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);
    }

    getSectionTotals() {
        return this.sections.map(sec => {
            const secQuestions = this.questions.filter(q => q.sectionId === sec.id || q.section === sec.name || q.section === sec.title);
            const obtained = secQuestions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
            const maxM = secQuestions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0) || sec.maxMarks;
            return {
                id: sec.id,
                name: sec.name,
                letter: sec.letter,
                title: sec.title,
                obtainedMarks: Math.round(obtained * 10) / 10,
                maxMarks: maxM,
                questionCount: secQuestions.length
            };
        });
    }

    render() {
        if (!this.container) return;

        const secTotals = this.getSectionTotals();
        const activeQ = this.questions[this.activeQuestionIndex] || this.questions[0];

        this.container.innerHTML = `
            <div class="marking-panel-content">
                <!-- Prominent Score Banner -->
                <div class="score-banner-card">
                    <div class="score-main">
                        <span class="score-label">TOTAL MARKS</span>
                        <div class="score-numbers">
                            <span class="score-obtained" id="score-obtained-val">0</span>
                            <span class="score-separator">/</span>
                            <span class="score-max" id="score-max-val">${this.maxMarksTotal}</span>
                        </div>
                    </div>
                    <div class="score-meta-pills">
                        <span class="score-pill pill-percent" id="score-percent-val">0%</span>
                        <span class="score-pill pill-grade" id="score-grade-val">--</span>
                    </div>
                </div>

                <!-- Section × Question Breakdown Table (Below Total Marks) -->
                <div class="q-breakdown-table-card" id="q-breakdown-table-card">
                    <div class="q-breakdown-header">
                        <span class="col-sec">SEC</span>
                        <span class="col-q">Q</span>
                        <span class="col-status">STATUS</span>
                        <span class="col-marks">MARKS</span>
                    </div>
                    <div class="q-breakdown-body" id="q-breakdown-body">
                        ${this.questions.map((q, idx) => {
                            const isActive = idx === this.activeQuestionIndex;
                            const secObj = this.sections.find(s => s.id === q.sectionId || s.name === q.section || s.title === q.section);
                            const secLetter = secObj ? secObj.letter : (q.section ? q.section.replace(/[^A-Za-z0-9]/g, '').slice(-1).toUpperCase() : 'A');
                            const isAllOk = q.awardedMarks === q.maxMarks && q.maxMarks > 0;
                            const statusIcon = isAllOk ? '✓' : (q.awardedMarks > 0 ? '◑' : (q.status === 'wrong' ? '✗' : '○'));
                            const statusLabel = isAllOk ? 'OK' : (q.awardedMarks > 0 ? 'Partial' : (q.status === 'wrong' ? 'Zero' : '-'));
                            const statusCls = isAllOk ? 'st-ok' : (q.awardedMarks > 0 ? 'st-part' : (q.status === 'wrong' ? 'st-zero' : 'st-unmarked'));
                            
                            return `<div class="q-breakdown-row ${isActive ? 'active-brow' : ''}" data-index="${idx}" title="${q.topic || `Question ${q.qNo}`}">
                                <span class="brow-col col-sec">${secLetter}</span>
                                <span class="brow-col col-q">Q${q.qNo}</span>
                                <span class="brow-col col-status ${statusCls}"><span class="st-icon">${statusIcon}</span> ${statusLabel}</span>
                                <span class="brow-col col-marks">${q.awardedMarks}/${q.maxMarks}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Quick Marking Keypad with Step & Half Marks -->
                <div class="quick-marking-card" id="quick-marking-card-box">
                    <div class="section-label">
                        <div class="quick-pad-title-wrap">
                            <span>QUICK MARKING PAD</span>
                            <span class="active-sec-tag" id="active-sec-badge">${activeQ ? (activeQ.section || 'Section A') : 'Section A'}</span>
                        </div>
                        <div class="active-q-tags-wrap">
                            <span class="active-q-tag" id="active-q-name">${activeQ ? `Q${activeQ.qNo}` : 'Q1'}</span>
                            <span class="active-q-total-pill" id="active-q-total-pill">Total: ${activeQ ? activeQ.awardedMarks : 0}/${activeQ ? activeQ.maxMarks : 0}M</span>
                        </div>
                    </div>

                    <!-- Active Section Ceiling & Full Marks Awareness Strip -->
                    <div class="active-sec-ceiling-strip" id="active-sec-ceiling-strip">
                        <div class="sec-ceiling-left">
                            <span class="sec-ceiling-tag" id="sec-ceiling-tag">${activeQ ? (activeQ.section || 'Section A') : 'Section A'}</span>
                            <span class="sec-ceiling-qmax" id="sec-ceiling-qmax">Question Ceiling: Max ${activeQ ? activeQ.maxMarks : 0}M</span>
                        </div>
                        <div class="sec-ceiling-right">
                            <span class="sec-ceiling-sec-total" id="sec-ceiling-sec-total">Sec: 0/0M</span>
                        </div>
                    </div>

                    <!-- Active Question Topic Banner -->
                    <div class="active-q-topic-banner" id="active-q-topic-banner" style="${activeQ && activeQ.topic ? 'display: block;' : 'display: none;'} padding: 7px 12px; background: #F1F5F9; border-radius: 6px; font-size: 0.82rem; font-weight: 600; color: #1E293B; margin-bottom: 10px; border-left: 3px solid #007AFF;">
                        ${activeQ && activeQ.topic ? activeQ.topic : ''}
                    </div>

                    <!-- Choice / OR Question Selector (if applicable) -->
                    <div class="choice-selector-box" id="choice-selector-wrap" style="${activeQ && activeQ.isChoice ? 'display: block;' : 'display: none;'}">
                        <span class="choice-box-label">Choose Attempted Option (OR Choice):</span>
                        <div class="choice-options-row" id="choice-buttons-row">
                            <!-- Injected dynamically -->
                        </div>
                    </div>

                    <!-- Sub-Questions Breakdown Box (if applicable) -->
                    <div class="sub-questions-marking-box" id="subq-marking-wrap" style="${activeQ && activeQ.hasSubQuestions ? 'display: block;' : 'display: none;'}">
                        <span class="subq-box-label">Sub-Questions Scoring (Rolls up to Question Total):</span>
                        <div class="subq-items-list" id="subq-items-container">
                            <!-- Injected dynamically -->
                        </div>
                    </div>

                    <!-- Step Marks Quick Controls -->
                    <div class="step-marks-toolbar">
                        <span class="step-label">Step Marks:</span>
                        <button type="button" class="btn-step-mark" data-step="0.5" id="btn-step-half" title="Add +0.5 Step Mark">
                            +0.5 Step
                        </button>
                        <button type="button" class="btn-step-mark" data-step="1.0" id="btn-step-one" title="Add +1.0 Step Mark">
                            +1.0 Step
                        </button>
                    </div>

                    <!-- Primary Actions: Full Mark / Zero -->
                    <div class="quick-mark-actions">
                        <button type="button" class="quick-action-btn btn-quick-correct" id="btn-quick-tick" title="Mark Full Marks [F]">
                            <span class="btn-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </span> Full Mark (F)
                        </button>
                        <button type="button" class="quick-action-btn btn-quick-wrong" id="btn-quick-cross" title="Assign 0 Marks to Question">
                            <span class="btn-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </span> Zero (0)
                        </button>
                    </div>

                    <!-- Quick Marks Grid: Dynamically calibrated to question ceiling -->
                    <div class="quick-numbers-grid" id="quick-numbers-grid-container">
                        ${this.generateQuickNumbers(activeQ ? activeQ.maxMarks : 2).map(n => `
                            <button type="button" class="quick-num-btn ${n % 1 !== 0 ? 'half-num-btn' : ''} ${activeQ && Number(activeQ.awardedMarks) === n ? 'active' : ''}" data-val="${n}">${n}</button>
                        `).join("")}
                    </div>

                    <div class="quick-next-row">
                        <button type="button" class="btn-prev-question" id="btn-prev-q">
                            ← Prev Q
                        </button>
                        <button type="button" class="btn-next-question" id="btn-next-q">
                            Next Question →
                        </button>
                    </div>
                </div>

                <!-- Question Wise Marks List -->
                <div class="questions-list-section">
                    <div class="section-header-row">
                        <span class="section-title">QUESTIONS (${this.questions.length})</span>
                        <button type="button" class="btn-add-question-mini" id="btn-add-q">+ Add Q</button>
                    </div>
                    <div class="questions-table-wrap">
                        <div class="questions-list" id="questions-list-container">
                            <!-- Question rows injected here -->
                        </div>
                    </div>
                </div>

                <!-- Overall Feedback -->
                <div class="overall-feedback-card">
                    <label for="marking-overall-feedback" class="section-label">OVERALL FEEDBACK / REMARKS</label>
                    <textarea id="marking-overall-feedback" class="feedback-textarea" rows="3" placeholder="Enter overall student evaluation summary...">${this.overallFeedback}</textarea>
                </div>

                <!-- Predefined Quick Comments (at bottom) -->
                <div class="preset-comments-card">
                    <div class="section-label">TEACHER COMMENTS</div>
                    <div class="preset-chips-wrap" id="preset-comments-container">
                        <!-- Comment chips -->
                    </div>
                </div>
            </div>
        `;

        this.renderActiveQuestionDetail();
        this.renderQuestionsList();
        this.renderPresetComments();
        this.bindEvents();
    }

    generateQuickNumbers(maxMarks) {
        const m = Number(maxMarks) || 2;
        if (m <= 2) {
            return [0, 0.5, 1, 1.5, 2];
        } else if (m <= 4) {
            return [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].filter(v => v <= m);
        } else if (m <= 7) {
            // E.g. CBSE 5M, 7M
            const nums = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
            if (m >= 6) nums.push(6);
            if (m >= 7) nums.push(7);
            return nums.filter(v => v <= m);
        } else if (m <= 10) {
            return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(v => v <= m);
        } else if (m <= 15) {
            return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter(v => v <= m);
        } else {
            return [0, 2, 4, 6, 8, 10, 12, 14, 15, m];
        }
    }

    renderActiveQuestionDetail() {
        const q = this.questions[this.activeQuestionIndex];
        if (!q) return;

        // Active Question tags
        const nameEl = this.container.querySelector("#active-q-name");
        const secBadge = this.container.querySelector("#active-sec-badge");
        const totalPill = this.container.querySelector("#active-q-total-pill");

        if (nameEl) nameEl.textContent = `Q${q.qNo}`;
        if (secBadge) secBadge.textContent = q.section || "Section";
        if (totalPill) totalPill.textContent = `Total: ${q.awardedMarks}/${q.maxMarks}M`;

        // Update Top Workspace Bar active chip (e.g. "Section A - Q1: Unseen Passage (12M)")
        const topSecChip = document.getElementById("ws-active-sec-q-chip");
        if (topSecChip) {
            const secName = q.section || "Section A";
            topSecChip.textContent = `${secName} - Q${q.qNo}${q.topic ? `: ${q.topic}` : ''}`;
        }

        // Active Section Ceiling & Question Max Ceiling Strip
        const secCeilingTag = this.container.querySelector("#sec-ceiling-tag");
        const secCeilingQMax = this.container.querySelector("#sec-ceiling-qmax");
        const secCeilingTotal = this.container.querySelector("#sec-ceiling-sec-total");
        const topicBanner = this.container.querySelector("#active-q-topic-banner");

        const secTotals = this.getSectionTotals();
        const currentSec = secTotals.find(s => s.id === q.sectionId || s.name === q.section || s.title === q.section);

        if (secCeilingTag) secCeilingTag.textContent = currentSec ? (currentSec.title || currentSec.name) : (q.section || "Section");
        if (secCeilingQMax) secCeilingQMax.textContent = `Question Ceiling: Max ${q.maxMarks}M`;
        if (secCeilingTotal && currentSec) {
            secCeilingTotal.textContent = `Sec: ${currentSec.obtainedMarks}/${currentSec.maxMarks}M`;
        }

        if (topicBanner) {
            if (q.topic) {
                topicBanner.textContent = q.topic;
                topicBanner.style.display = "block";
            } else {
                topicBanner.style.display = "none";
            }
        }

        // Dynamically rebuild Quick Numbers keypad for question ceiling (up to 7M, 12M, 15M)
        const grid = this.container.querySelector("#quick-numbers-grid-container");
        if (grid) {
            const numbers = this.generateQuickNumbers(q.maxMarks);
            grid.innerHTML = numbers.map(n => `
                <button type="button" class="quick-num-btn ${n % 1 !== 0 ? 'half-num-btn' : ''} ${Number(q.awardedMarks) === n ? 'active' : ''}" data-val="${n}">${n}</button>
            `).join("");

            grid.querySelectorAll(".quick-num-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const val = Number(btn.getAttribute("data-val"));
                    this.assignCurrentQuestionMark(val);
                });
            });
        }

        // Choice Question selector
        const choiceWrap = this.container.querySelector("#choice-selector-wrap");
        const choiceBtnsRow = this.container.querySelector("#choice-buttons-row");
        if (choiceWrap && choiceBtnsRow) {
            if (q.isChoice && q.choices && q.choices.length > 0) {
                choiceWrap.style.display = "block";
                choiceBtnsRow.innerHTML = q.choices.map((c, i) => {
                    const label = typeof c === "string" ? c : (c.label || `Option ${i + 1}`);
                    const isSelected = q.selectedChoice === label;
                    return `
                        <button type="button" class="choice-opt-btn ${isSelected ? 'selected' : ''}" data-choice="${label}">
                            <span class="choice-opt-dot"></span>
                            <span class="choice-opt-text">${label}</span>
                        </button>
                    `;
                }).join("");
            } else {
                choiceWrap.style.display = "none";
                choiceBtnsRow.innerHTML = "";
            }
        }

        // Sub-Questions scoring
        const subqWrap = this.container.querySelector("#subq-marking-wrap");
        const subqContainer = this.container.querySelector("#subq-items-container");
        if (subqWrap && subqContainer) {
            if (q.hasSubQuestions && q.subQuestions && q.subQuestions.length > 0) {
                subqWrap.style.display = "block";
                subqContainer.innerHTML = q.subQuestions.map((sq, sIdx) => {
                    const isSubActive = sIdx === this.activeSubQuestionIndex;
                    return `
                        <div class="subq-row ${isSubActive ? 'subq-active' : ''}" data-sub-idx="${sIdx}">
                            <div class="subq-label-col">
                                <span class="subq-badge">Part ${sq.label || `(${sq.subId})`}</span>
                                <span class="subq-max">(${sq.maxMarks} Marks)</span>
                                ${sq.isChoice ? `<span class="subq-choice-tag" title="Internal Choice for subpart ('this or that')">OR</span>` : ''}
                            </div>
                            <div class="subq-input-col">
                                <div class="subq-input-wrap">
                                    <input type="number" step="0.5" min="0" max="${sq.maxMarks}" 
                                        class="subq-score-input" value="${sq.awardedMarks}" data-sub-idx="${sIdx}" />
                                    <span class="subq-denom">/ ${sq.maxMarks}</span>
                                </div>
                            </div>
                            <div class="subq-quick-col">
                                <button type="button" class="subq-mini-btn subq-full-btn" data-sub-action="full" data-sub-idx="${sIdx}" title="Full marks for part">Full</button>
                                <button type="button" class="subq-mini-btn subq-zero-btn" data-sub-action="zero" data-sub-idx="${sIdx}" title="Zero marks for part">0</button>
                            </div>
                        </div>
                    `;
                }).join("");
            } else {
                subqWrap.style.display = "none";
                subqContainer.innerHTML = "";
            }
        }
    }

    renderQuestionsList() {
        const listEl = this.container.querySelector("#questions-list-container");
        if (!listEl) return;

        // Filter questions if section filter is active
        const visibleQuestions = this.selectedSectionFilter === "all" 
            ? this.questions 
            : this.questions.filter(q => q.sectionId === this.selectedSectionFilter || q.section === this.selectedSectionFilter);

        // Group by section for clean organization
        let currentSectionId = null;
        let html = "";

        visibleQuestions.forEach(q => {
            const actualIdx = this.questions.indexOf(q);
            const isActive = actualIdx === this.activeQuestionIndex;

            // Render section header when section changes
            if (q.sectionId !== currentSectionId) {
                currentSectionId = q.sectionId;
                const sec = this.sections.find(s => s.id === q.sectionId) || { name: q.section || "Section", title: q.section || "Section" };
                const secTotal = this.getSectionTotals().find(s => s.id === q.sectionId);
                const displayTitle = sec.title || sec.name;
                html += `
                    <div class="q-list-section-header">
                        <span class="q-list-sec-title">${displayTitle}</span>
                        <span class="q-list-sec-score">${secTotal ? `${secTotal.obtainedMarks}/${secTotal.maxMarks} Marks` : ''}</span>
                    </div>
                `;
            }

            // Sub-question mini chips if question has sub-parts
            let subqChips = "";
            if (q.hasSubQuestions && q.subQuestions && q.subQuestions.length > 0) {
                subqChips = `
                    <div class="q-row-subq-strip">
                        ${q.subQuestions.map(sq => `
                            <span class="subq-chip">${sq.label}: ${sq.awardedMarks}/${sq.maxMarks}M</span>
                        `).join("")}
                    </div>
                `;
            }

            // Choice tag
            let choiceTag = "";
            if (q.isChoice) {
                choiceTag = `<span class="q-choice-tag" title="Choice Question">OR</span>`;
            }

            html += `
                <div class="q-row ${isActive ? 'active-row' : ''}" data-index="${actualIdx}">
                    <div class="q-number-col">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="q-badge">Q${q.qNo}</span>
                            ${choiceTag}
                        </div>
                        ${q.topic ? `<span class="q-topic-subtitle" style="display: block; font-size: 0.72rem; color: #64748B; font-weight: 500; margin-top: 2px; max-width: 175px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${q.topic}">${q.topic}</span>` : ''}
                    </div>
                    <div class="q-inputs-col">
                        <div class="score-input-group">
                            <input type="number" step="0.5" min="0" max="${q.maxMarks}" 
                                class="q-score-input" value="${q.awardedMarks}" data-index="${actualIdx}" />
                            <span class="q-score-divider">/</span>
                            <input type="number" step="0.5" min="1" 
                                class="q-max-input" value="${q.maxMarks}" data-index="${actualIdx}" title="Max Marks" />
                        </div>
                        ${subqChips}
                    </div>
                    <div class="q-quick-pills">
                        <button type="button" class="q-mini-btn btn-mini-tick ${q.status === 'correct' ? 'active' : ''}" data-action="correct" data-index="${actualIdx}" title="Full Mark">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button type="button" class="q-mini-btn btn-mini-wrong ${q.status === 'wrong' ? 'active' : ''}" data-action="wrong" data-index="${actualIdx}" title="Zero Mark">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    }

    renderPresetComments() {
        const wrap = this.container.querySelector("#preset-comments-container");
        if (!wrap) return;

        const presets = (window.MockData && window.MockData.presetComments) || [
            "Good", "Improve handwriting", "Correct method", "Wrong calculation", 
            "Need more explanation", "Excellent", "Revise this topic"
        ];

        wrap.innerHTML = presets.map(p => `
            <button type="button" class="preset-chip-btn" data-comment="${p}">${p}</button>
        `).join("");
    }

    bindEvents() {
        // Section breakdown filter pills
        this.container.querySelectorAll(".sec-breakdown-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                const secId = pill.getAttribute("data-sec-id");
                this.selectedSectionFilter = secId;
                this.container.querySelectorAll(".sec-breakdown-pill").forEach(p => p.classList.toggle("active-filter", p.getAttribute("data-sec-id") === secId));
                this.renderQuestionsList();
            });
        });

        // Q Breakdown table row click → select that question
        const breakdownBody = this.container.querySelector("#q-breakdown-body");
        if (breakdownBody) {
            breakdownBody.addEventListener("click", (e) => {
                const row = e.target.closest(".q-breakdown-row");
                if (row) {
                    const idx = Number(row.getAttribute("data-index"));
                    this.selectQuestion(idx);
                }
            });
        }

        // Quick numbers grid (integer and half marks: 0.5, 1, 1.5, etc.)
        this.container.querySelectorAll(".quick-num-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const val = Number(btn.getAttribute("data-val"));
                this.assignCurrentQuestionMark(val);
                const q = this.questions[this.activeQuestionIndex];
                if (q && q.awardedMarks >= q.maxMarks) {
                    setTimeout(() => this.nextQuestion(), 280);
                }
            });
        });

        // Step Marks (+0.5, +1.0)
        const btnStepHalf = this.container.querySelector("#btn-step-half");
        if (btnStepHalf) {
            btnStepHalf.addEventListener("click", () => {
                this.addStepMark(0.5);
            });
        }

        const btnStepOne = this.container.querySelector("#btn-step-one");
        if (btnStepOne) {
            btnStepOne.addEventListener("click", () => {
                this.addStepMark(1.0);
            });
        }

        // Quick Full / Zero
        const btnTick = this.container.querySelector("#btn-quick-tick");
        if (btnTick) {
            btnTick.addEventListener("click", () => {
                const q = this.questions[this.activeQuestionIndex];
                if (q) {
                    if (this.options.onAwardFullMarks) {
                        this.options.onAwardFullMarks(q);
                    } else {
                        this.assignCurrentQuestionMark(q.maxMarks, "correct");
                        setTimeout(() => this.nextQuestion(), 280);
                    }
                }
            });
        }

        const btnCross = this.container.querySelector("#btn-quick-cross");
        if (btnCross) {
            btnCross.addEventListener("click", () => {
                this.assignCurrentQuestionMark(0, "wrong");
            });
        }

        // Stepper: Next / Prev
        const btnPrev = this.container.querySelector("#btn-prev-q");
        if (btnPrev) {
            btnPrev.addEventListener("click", () => this.prevQuestion());
        }

        const btnNext = this.container.querySelector("#btn-next-q");
        if (btnNext) {
            btnNext.addEventListener("click", () => this.nextQuestion());
        }

        // Add Question button
        const btnAddQ = this.container.querySelector("#btn-add-q");
        if (btnAddQ) {
            btnAddQ.addEventListener("click", () => {
                const nextNo = this.questions.length + 1;
                const lastSec = this.sections[this.sections.length - 1] || { id: "sec_a", name: "Section A" };
                this.questions.push({
                    id: `q${nextNo}`,
                    qNo: nextNo,
                    maxMarks: 2,
                    awardedMarks: 0,
                    status: "unmarked",
                    label: `Q${nextNo}`,
                    section: lastSec.name,
                    sectionId: lastSec.id,
                    isChoice: false,
                    hasSubQuestions: false,
                    subQuestions: null
                });
                this.renderQuestionsList();
                this.recalculate();
            });
        }

        // Choice Option click delegation
        const choiceBtnsRow = this.container.querySelector("#choice-buttons-row");
        if (choiceBtnsRow) {
            choiceBtnsRow.addEventListener("click", (e) => {
                const btn = e.target.closest(".choice-opt-btn");
                if (btn) {
                    const choiceVal = btn.getAttribute("data-choice");
                    this.selectQuestionChoice(this.activeQuestionIndex, choiceVal);
                }
            });
        }

        // Sub-Questions scoring delegation
        const subqContainer = this.container.querySelector("#subq-items-container");
        if (subqContainer) {
            subqContainer.addEventListener("click", (e) => {
                const subRow = e.target.closest(".subq-row");
                if (subRow && !e.target.closest(".subq-mini-btn") && !e.target.closest("input")) {
                    const sIdx = Number(subRow.getAttribute("data-sub-idx"));
                    this.activeSubQuestionIndex = sIdx;
                    this.renderActiveQuestionDetail();
                }

                const miniBtn = e.target.closest(".subq-mini-btn");
                if (miniBtn) {
                    const sIdx = Number(miniBtn.getAttribute("data-sub-idx"));
                    const action = miniBtn.getAttribute("data-sub-action");
                    const q = this.questions[this.activeQuestionIndex];
                    if (q && q.subQuestions && q.subQuestions[sIdx]) {
                        const maxM = q.subQuestions[sIdx].maxMarks;
                        this.assignSubQuestionMark(this.activeQuestionIndex, sIdx, action === "full" ? maxM : 0);
                    }
                }
            });

            subqContainer.addEventListener("change", (e) => {
                if (e.target.classList.contains("subq-score-input")) {
                    const sIdx = Number(e.target.getAttribute("data-sub-idx"));
                    const val = Math.max(0, Number(e.target.value) || 0);
                    this.assignSubQuestionMark(this.activeQuestionIndex, sIdx, val);
                }
            });
        }

        // Question List click & inputs delegation
        const listContainer = this.container.querySelector("#questions-list-container");
        if (listContainer) {
            listContainer.addEventListener("click", (e) => {
                const row = e.target.closest(".q-row");
                if (row && !e.target.closest(".q-mini-btn") && !e.target.closest("input")) {
                    const idx = Number(row.getAttribute("data-index"));
                    this.selectQuestion(idx);
                }

                // Mini buttons
                const miniBtn = e.target.closest(".q-mini-btn");
                if (miniBtn) {
                    e.stopPropagation();
                    const action = miniBtn.getAttribute("data-action");
                    const idx = Number(miniBtn.getAttribute("data-index"));
                    const q = this.questions[idx];
                    if (action === "correct") {
                        if (this.options.onAwardFullMarks) {
                            this.options.onAwardFullMarks(q);
                        } else {
                            this.assignQuestionMarkDirect(idx, q.maxMarks, "correct");
                        }
                    } else if (action === "wrong") {
                        this.assignQuestionMarkDirect(idx, 0, "wrong");
                    }
                }
            });

            listContainer.addEventListener("change", (e) => {
                if (e.target.classList.contains("q-score-input")) {
                    const idx = Number(e.target.getAttribute("data-index"));
                    const val = Math.max(0, Number(e.target.value) || 0);
                    const q = this.questions[idx];
                    this.assignQuestionMarkDirect(idx, Math.min(val, q.maxMarks));
                } else if (e.target.classList.contains("q-max-input")) {
                    const idx = Number(e.target.getAttribute("data-index"));
                    const val = Math.max(1, Number(e.target.value) || 1);
                    this.questions[idx].maxMarks = val;
                    this.maxMarksTotal = this.calculateDefaultMaxMarks();
                    this.recalculate();
                }
            });
        }

        // Preset comment click
        this.container.querySelectorAll(".preset-chip-btn").forEach(chip => {
            chip.addEventListener("click", () => {
                const text = chip.getAttribute("data-comment");
                if (this.options.onPresetCommentClick) {
                    this.options.onPresetCommentClick(text);
                }
            });
        });

        // Feedback textarea
        const fbEl = this.container.querySelector("#marking-overall-feedback");
        if (fbEl) {
            fbEl.addEventListener("input", () => {
                this.overallFeedback = fbEl.value;
                this.recalculate();
            });
        }
    }

    selectQuestion(index) {
        if (index >= 0 && index < this.questions.length) {
            this.activeQuestionIndex = index;
            this.activeSubQuestionIndex = 0;
            const q = this.questions[index];

            this.renderActiveQuestionDetail();

            this.container.querySelectorAll(".q-row").forEach(r => {
                const rIdx = Number(r.getAttribute("data-index"));
                r.classList.toggle("active-row", rIdx === index);
            });

            // Sync q-breakdown-body active-brow highlight
            this.container.querySelectorAll(".q-breakdown-row").forEach(r => {
                const rIdx = Number(r.getAttribute("data-index"));
                r.classList.toggle("active-brow", rIdx === index);
            });

            if (this.options.onQuestionSelect) {
                this.options.onQuestionSelect(q, index);
            }
        }
    }

    nextQuestion() {
        if (this.activeQuestionIndex < this.questions.length - 1) {
            this.selectQuestion(this.activeQuestionIndex + 1);
            return true;
        }
        return false;
    }

    prevQuestion() {
        if (this.activeQuestionIndex > 0) {
            this.selectQuestion(this.activeQuestionIndex - 1);
            return true;
        }
        return false;
    }

    selectQuestionChoice(qIndex, choice) {
        const q = this.questions[qIndex];
        if (!q) return;
        q.selectedChoice = choice;
        this.renderActiveQuestionDetail();
        this.recalculate();
    }

    assignSubQuestionMark(qIndex, subIndex, val) {
        const q = this.questions[qIndex];
        if (!q || !q.subQuestions || !q.subQuestions[subIndex]) return;

        const sq = q.subQuestions[subIndex];
        sq.awardedMarks = Math.min(Math.max(0, Number(val) || 0), sq.maxMarks);

        // Roll up to question total
        q.awardedMarks = q.subQuestions.reduce((sum, item) => sum + (Number(item.awardedMarks) || 0), 0);
        q.awardedMarks = Math.round(q.awardedMarks * 10) / 10;

        if (q.awardedMarks === q.maxMarks) q.status = "correct";
        else if (q.awardedMarks === 0) q.status = "wrong";
        else q.status = "partial";

        this.renderActiveQuestionDetail();
        this.renderQuestionsList();
        this.recalculate();
    }

    addStepMark(stepVal = 0.5) {
        const q = this.questions[this.activeQuestionIndex];
        if (!q) return;

        if (q.hasSubQuestions && q.subQuestions && q.subQuestions.length > 0) {
            // Apply step to active sub-question
            const sIdx = this.activeSubQuestionIndex;
            const sq = q.subQuestions[sIdx] || q.subQuestions[0];
            const current = Number(sq.awardedMarks) || 0;
            const nextVal = Math.min(sq.maxMarks, Math.round((current + stepVal) * 10) / 10);
            this.assignSubQuestionMark(this.activeQuestionIndex, sIdx, nextVal);
        } else {
            // Apply step directly to question
            const current = Number(q.awardedMarks) || 0;
            const nextVal = Math.min(q.maxMarks, Math.round((current + stepVal) * 10) / 10);
            this.assignCurrentQuestionMark(nextVal);
        }
    }

    addMarkToActiveQuestion(marks) {
        const q = this.questions[this.activeQuestionIndex];
        if (!q) return;

        if (q.hasSubQuestions && q.subQuestions && q.subQuestions.length > 0) {
            const sIdx = this.activeSubQuestionIndex;
            const sq = q.subQuestions[sIdx] || q.subQuestions[0];
            const current = Number(sq.awardedMarks) || 0;
            const nextVal = Math.min(sq.maxMarks, Math.round((current + marks) * 10) / 10);
            this.assignSubQuestionMark(this.activeQuestionIndex, sIdx, nextVal);
        } else {
            const current = Number(q.awardedMarks) || 0;
            const nextVal = Math.min(q.maxMarks, Math.round((current + marks) * 10) / 10);
            this.assignCurrentQuestionMark(nextVal);
        }
    }

    setActiveQuestionMark(marks, forcedStatus = null) {
        return this.assignCurrentQuestionMark(marks, forcedStatus);
    }

    assignCurrentQuestionMark(marks, forcedStatus = null) {
        const q = this.questions[this.activeQuestionIndex];
        if (!q) return;

        const val = Math.min(Math.max(0, marks), q.maxMarks);
        q.awardedMarks = Math.round(val * 10) / 10;

        if (forcedStatus) {
            q.status = forcedStatus;
        } else {
            if (q.awardedMarks === q.maxMarks) q.status = "correct";
            else if (q.awardedMarks === 0) q.status = "wrong";
            else q.status = "partial";
        }

        // If question has sub-questions, distribute or sync
        if (q.hasSubQuestions && q.subQuestions && q.subQuestions.length > 0) {
            if (val === q.maxMarks) {
                q.subQuestions.forEach(sq => { sq.awardedMarks = sq.maxMarks; });
            } else if (val === 0) {
                q.subQuestions.forEach(sq => { sq.awardedMarks = 0; });
            }
        }

        this.renderActiveQuestionDetail();
        this.renderQuestionsList();
        this.recalculate();
    }

    assignQuestionMarkDirect(index, marks, forcedStatus = null) {
        const q = this.questions[index];
        if (!q) return;

        const val = Math.min(Math.max(0, marks), q.maxMarks);
        q.awardedMarks = Math.round(val * 10) / 10;

        if (forcedStatus) {
            q.status = forcedStatus;
        } else {
            if (q.awardedMarks === q.maxMarks) q.status = "correct";
            else if (q.awardedMarks === 0) q.status = "wrong";
            else q.status = "partial";
        }

        if (index === this.activeQuestionIndex) {
            this.renderActiveQuestionDetail();
        }
        this.renderQuestionsList();
        this.recalculate();
    }

    recalculate() {
        this.obtainedMarksTotal = this.questions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
        this.obtainedMarksTotal = Math.round(this.obtainedMarksTotal * 10) / 10;
        this.maxMarksTotal = this.questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);

        const pct = this.maxMarksTotal > 0 ? Math.round((this.obtainedMarksTotal / this.maxMarksTotal) * 100) : 0;

        const gradeInfo = window.calculateGradeScale 
            ? window.calculateGradeScale(this.obtainedMarksTotal, this.maxMarksTotal)
            : { grade: "A1", gradePoint: 10, marksRange: "91 – 100", remarks: "Outstanding", status: "Pass" };
        const grade = gradeInfo.grade;

        let correct = 0;
        let wrong = 0;
        let partial = 0;

        this.questions.forEach(q => {
            if (q.status === "correct") correct++;
            else if (q.status === "wrong") wrong++;
            else if (q.status === "partial") partial++;
        });

        const secTotals = this.getSectionTotals();

        // Update DOM if container exists
        if (this.container) {
            const obtEl = this.container.querySelector("#score-obtained-val");
            const maxEl = this.container.querySelector("#score-max-val");
            const pctEl = this.container.querySelector("#score-percent-val");
            const grdEl = this.container.querySelector("#score-grade-val");

            if (obtEl) obtEl.textContent = this.obtainedMarksTotal;
            if (maxEl) maxEl.textContent = this.maxMarksTotal;
            if (pctEl) pctEl.textContent = `${pct}%`;
            if (grdEl) {
                grdEl.textContent = grade;
                grdEl.title = `Grade: ${grade} | Grade Point: ${gradeInfo.gradePoint} (${gradeInfo.marksRange}) - ${gradeInfo.remarks}`;
            }

            const corrEl = this.container.querySelector("#stat-correct-count");
            const wrgEl = this.container.querySelector("#stat-wrong-count");
            const partEl = this.container.querySelector("#stat-partial-count");

            if (corrEl) corrEl.textContent = correct;
            if (wrgEl) wrgEl.textContent = wrong;
            if (partEl) partEl.textContent = partial;

            // Update section score pills in breakdown
            secTotals.forEach(st => {
                const secValEl = this.container.querySelector(`#sec-score-val-${st.id}`);
                if (secValEl) secValEl.textContent = `${st.obtainedMarks}/${st.maxMarks}M`;
            });

            // Update compact Q breakdown table
            const breakdownBody = this.container.querySelector('#q-breakdown-body');
            if (breakdownBody) {
                breakdownBody.innerHTML = this.questions.map((q, idx) => {
                    const isActive = idx === this.activeQuestionIndex;
                    const secObj = this.sections.find(s => s.id === q.sectionId || s.name === q.section);
                    const secLetter = secObj ? secObj.letter : (q.section ? q.section.replace(/[^A-Za-z]/g, '').slice(-1).toUpperCase() : 'A');
                    const statusIcon = q.status === 'correct' ? '✓' : q.status === 'wrong' ? '✗' : q.status === 'partial' ? '◑' : '○';
                    return `<div class="q-breakdown-row ${isActive ? 'active-brow' : ''} ${q.status}" data-index="${idx}">
                        <span class="brow-sec">${secLetter}</span>
                        <span class="brow-q">Q${q.qNo}</span>
                        <span class="brow-marks">${statusIcon} ${q.awardedMarks}/${q.maxMarks}</span>
                    </div>`;
                }).join('');
                // Re-bind click events on breakdown rows
                breakdownBody.querySelectorAll('.q-breakdown-row').forEach(row => {
                    row.addEventListener('click', () => {
                        const idx = Number(row.getAttribute('data-index'));
                        this.selectQuestion(idx);
                    });
                });
            }

            // Update active question detail total pill
            const activeQ = this.getActiveQuestion();
            if (activeQ) {
                const qTotalPill = this.container.querySelector("#active-q-total-pill");
                if (qTotalPill) qTotalPill.textContent = `Total: ${activeQ.awardedMarks}/${activeQ.maxMarks}M`;
            }
        }

        const summary = {
            obtainedMarks: this.obtainedMarksTotal,
            maxMarks: this.maxMarksTotal,
            percentage: pct,
            grade: grade,
            gradePoint: gradeInfo.gradePoint,
            gradeRange: gradeInfo.marksRange,
            gradeRemarks: gradeInfo.remarks,
            correctCount: correct,
            wrongCount: wrong,
            partialCount: partial,
            sections: secTotals,
            questions: this.questions,
            feedback: this.overallFeedback
        };

        if (this.options.onScoreChange) {
            this.options.onScoreChange(summary);
        }

        return summary;
    }

    getScoreSummary() {
        return this.recalculate();
    }

    getActiveQuestion() {
        return this.questions[this.activeQuestionIndex] || null;
    }

    getActiveQuestionIndex() {
        return this.activeQuestionIndex;
    }

    setActiveQuestionMark(marks, forcedStatus = null) {
        this.assignCurrentQuestionMark(marks, forcedStatus);
    }
}

window.MarkingPanel = MarkingPanel;
