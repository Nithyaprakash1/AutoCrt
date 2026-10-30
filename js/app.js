/**
 * Niprak Digital Correction - Main Application Coordinator
 * Handles view switching, workspace lifecycle, autosave loops,
 * keyboard shortcuts, and component coordination.
 */

class AppController {
    constructor() {
        this.currentView = "dashboard";
        this.activeEvaluation = null;
        this.canvasEngine = null;
        this.markingPanel = null;
        this.autosaveTimer = null;
        this.hasUnsavedChanges = false;

        // Sub-managers
        this.dashboardManager = null;
        this.evaluationForm = null;
        this.historyManager = null;
        this.bulkReportManager = null;
        this.uploadPortalManager = null;

        // Dual Portal Role Management: 'uploader' vs 'evaluator'
        this.activePortal = localStorage.getItem("niprak_active_portal") || localStorage.getItem("onespace_active_portal") || null;
    }

    async init() {
        console.log("Initializing Niprak OSM Digital Correction...");

        // Ensure storage is initialized
        await window.appStorage.init();

        // Auto-restore any evaluations corrupted by default maths template to their proper blueprints
        await this.restoreMisplacedEvaluations();
        // Auto-migrate any 10th Tamil Revision 1 evaluations to official 40 Qs / 40M (1 Section, 40 Qs x 1M) blueprint
        await this.migrateTamilGrade10Evaluations();
        // Auto-migrate any Biology Revision 1 evaluations to official 13 Qs Revision 1 Subjective blueprint
        await this.migrateBiologyRevision1Evaluations();
        // Auto-unify any Economics evaluations from hardcoded eco-xii-40 to genuine Economics Revision 2 blueprint
        await this.migrateEconomicsDuplicateEvaluations();

        // Load settings & teacher info
        const settings = await window.appStorage.getSettings();
        this.applySettingsToUI(settings);

        // Global App Alert Bridge & Safe Native Alert Upgrade (Apple Cupertino Dialogs)
        window.showAppAlert = (opts) => this.showAlertDialog(opts);
        window.alert = (msg) => {
            const strMsg = String(msg || "");
            const isErr = /error|incorrect|failed|invalid|not found|quota/i.test(strMsg);
            const isWarn = /warning|please|required|must be/i.test(strMsg);
            this.showAlertDialog({
                title: isErr ? "Notice" : (isWarn ? "Attention" : "Information"),
                message: strMsg,
                type: isErr ? "error" : (isWarn ? "warning" : "info")
            });
        };

        // Bind global UI elements
        this.bindPortalControls();
        this.bindNavigation();
        this.bindNotificationCenter();
        this.bindWorkspaceControls();
        this.bindKeyboardShortcuts();
        this.bindSettingsModal();
        this.updateStorageQuotaDisplay();
        this.updateNotificationBadge();
        this.initLoginSlideshow();
        this.initIOSInteractions();

        // Respect page data-default-portal attribute if set (uploader.html vs teacher.html)
        const pageDefaultPortal = document.body.getAttribute("data-default-portal");
        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const targetPortal = pageDefaultPortal || (currentUser?.role === "super_admin" ? "super_admin" : (currentUser?.role === "admin" ? "admin" : (currentUser?.role === "uploader" ? "uploader" : this.activePortal))) || "evaluator";

        this.setPortal(targetPortal, true);

        // Enforce platform license subscription gating
        await this.enforceLicenseGate();
        setInterval(() => this.enforceLicenseGate(), 60000);

        // Check for direct workspace or shared subject load via URL query param (e.g. ?paperId=eval-123, ?subject=Physics)
        const urlParams = new URLSearchParams(window.location.search);
        const evalId = urlParams.get("evalId") || urlParams.get("paperId") || urlParams.get("id");
        const targetSubject = urlParams.get("subject");
        const targetBatch = urlParams.get("batch");
        const targetView = urlParams.get("view");

        const hasSharedTarget = Boolean(evalId || targetSubject || targetBatch || targetView === "dashboard" || targetView === "uploaded-papers");

        if (hasSharedTarget) {
            sessionStorage.setItem("niprak_shared_target", JSON.stringify({
                evalId,
                targetSubject,
                targetBatch,
                targetView
            }));

            // Direct Shared Access: Ensure recipient is not blocked by a misleading login screen
            if (!currentUser && !pageDefaultPortal) {
                const guestUser = {
                    id: "usr_shared_guest",
                    name: "Faculty Evaluator",
                    role: "evaluator",
                    roleLabel: "Teacher Desk",
                    subject: targetSubject || "",
                    assignedSubjects: targetSubject ? [targetSubject] : [],
                    status: "active"
                };
                window.appStorage.setCurrentUser(guestUser);
                currentUser = guestUser;
            }
            this.hidePortalLoginScreen();

            // 1. Single Paper Direct Navigation
            if (evalId) {
                const ev = await window.appStorage.getEvaluationById(evalId);
                if (ev) {
                    await this.openWorkspace(ev);
                    if (this.showToast) {
                        this.showToast(`✓ Opened ${ev.studentName || 'Student'}'s ${ev.subject || 'paper'} via WhatsApp link`);
                    }
                } else {
                    // Fall back to Teacher Desk dashboard
                    this.switchPortal("evaluator", false);
                    await this.switchView("dashboard");
                    if (this.showToast) {
                        this.showToast("Paper not found locally, opening Teacher Desk.");
                    }
                }
            } 
            // 2. Pure Uploaded Papers (Only if explicitly requested without subject or batch)
            else if (targetView === "uploaded-papers" && !targetSubject && !targetBatch) {
                await this.switchView("uploaded-papers");
                if (this.uploadedPapersPageManager) {
                    this.uploadedPapersPageManager.render();
                }
                if (this.showToast) {
                    this.showToast("✓ Viewing Uploaded Papers Repository");
                }
            }
            // 3. Subject or Batch Direct Navigation -> Navigate to Teacher Desk with Cards
            else if (targetSubject || targetBatch || targetView === "dashboard" || targetView === "uploaded-papers") {
                // Ensure portal is switched to Teacher Desk
                this.switchPortal("evaluator", false);
                await this.switchView("dashboard");
                if (this.dashboardManager) {
                    const activeUser = window.appStorage.getCurrentUser();
                    const isAdmin = activeUser && (activeUser.role === 'admin' || activeUser.role === 'super_admin');
                    
                    if (targetSubject) {
                        this.dashboardManager.teacherSubject = targetSubject;
                        if (isAdmin) {
                            this.dashboardManager.teacherSubjects = [targetSubject];
                        }
                        this.dashboardManager.selectedSubjectFilter = targetSubject;
                    }
                    if (targetBatch) {
                        this.dashboardManager.highlightBatchKey = targetBatch;
                    }
                    this.dashboardManager.activeBatchKey = null; // Always display CARDS overview mode
                    this.dashboardManager.applyFilters();
                    this.dashboardManager.render();
                    this.dashboardManager.bindEvents();
                }
                if (this.showToast) {
                    this.showToast(`✓ Viewing ${targetSubject || 'examination'} blueprint cards on Teacher Desk`);
                }
            }
        } else {
            // Normal startup routing
            if (!currentUser && !pageDefaultPortal) {
                this.showPortalLoginScreen();
            }
            this.switchView(targetPortal === "super_admin" ? "super-admin" : (targetPortal === "uploader" ? "upload-portal" : (targetPortal === "admin" ? "admin-panel" : "dashboard")));
        }

        // Dismiss app preloader smoothly
        const preloader = document.getElementById("app-preloader");
        if (preloader) {
            setTimeout(() => {
                preloader.classList.add("preloader-hidden");
                setTimeout(() => {
                    preloader.style.display = "none";
                }, 450);
            }, 350);
        }
    }

    // --- Dual Portal Management & iOS Transitions ---

    preloadLoginImages() {
        const urls = [
            "https://nithyaprakash1.github.io/ATA.github.io/asset/infra/Infra5.png",
            "https://nithyaprakash1.github.io/ATA.github.io/asset/infra/Infra9.png",
            "https://nithyaprakash1.github.io/ATA.github.io/asset/infra/infra12.png",
            "https://nithyaprakash1.github.io/ATA.github.io/asset/infra/Infra4.png"
        ];
        urls.forEach(u => {
            const img = new Image();
            img.src = u;
        });
    }

    initLoginSlideshow() {
        this.preloadLoginImages();
        const slideshow = document.getElementById("login-slideshow");
        if (!slideshow) return;
        const slides = slideshow.querySelectorAll(".login-slide-item");
        const dots = slideshow.querySelectorAll(".slide-dot");
        if (!slides.length) return;

        let currentIndex = 0;
        const totalSlides = slides.length;
        let slideTimer = null;

        const showSlide = (index) => {
            slides.forEach((s, i) => {
                s.classList.toggle("active", i === index);
            });
            dots.forEach((d, i) => {
                d.classList.toggle("active", i === index);
            });
            currentIndex = index;
        };

        const nextSlide = () => {
            const next = (currentIndex + 1) % totalSlides;
            showSlide(next);
        };

        const startTimer = () => {
            if (slideTimer) clearInterval(slideTimer);
            slideTimer = setInterval(nextSlide, 5500);
        };

        dots.forEach(dot => {
            dot.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(dot.getAttribute("data-index"), 10);
                if (!isNaN(idx)) {
                    showSlide(idx);
                    startTimer();
                }
            });
        });

        startTimer();
        this._loginSlideTimer = slideTimer;
    }

    initIOSInteractions() {
        // Global iOS tactile ripple on interactive actions
        document.addEventListener("pointerdown", (e) => {
            const target = e.target.closest(
                ".btn-portal-enter, .login-tab-btn, .sidebar-menu-item, .nav-link, .btn, .btn-primary, .btn-super-primary, .btn-super-secondary, .hud-btn, .btn-tool, .action-btn-circle, .slide-dot, .btn-action-view"
            );
            if (!target) return;

            target.classList.add("ios-tap-active");
            const removePress = () => {
                target.classList.remove("ios-tap-active");
                window.removeEventListener("pointerup", removePress);
                window.removeEventListener("pointercancel", removePress);
            };
            window.addEventListener("pointerup", removePress);
            window.addEventListener("pointercancel", removePress);

            // Spawn tactile iOS ripple bubble
            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.6;
            const ripple = document.createElement("span");
            ripple.className = "ios-ripple-bubble";

            const isDarkTarget = target.classList.contains("btn-portal-enter") || target.classList.contains("btn-primary") || target.classList.contains("btn-super-primary");
            if (!isDarkTarget) {
                ripple.classList.add("ios-ripple-dark");
            }

            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;

            target.classList.add("ios-ripple-target");
            target.appendChild(ripple);

            ripple.addEventListener("animationend", () => {
                ripple.remove();
            });
        });
    }

    triggerIOSLoginBurst(clickX, clickY) {
        const burst = document.createElement("div");
        burst.className = "ios-login-screen-burst";
        if (clickX && clickY) {
            burst.style.setProperty("--burst-x", `${clickX}px`);
            burst.style.setProperty("--burst-y", `${clickY}px`);
        }
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 850);

        const overlay = document.getElementById("portal-login-screen");
        if (overlay) {
            overlay.classList.add("ios-login-dismissing");
        }
    }

    showPortalLoginScreen() {
        const overlay = document.getElementById("portal-login-screen");
        if (overlay) {
            overlay.classList.remove("ios-login-dismissing");
            overlay.style.display = "flex";
        }
    }

    hidePortalLoginScreen() {
        const overlay = document.getElementById("portal-login-screen");
        if (overlay) {
            overlay.classList.add("ios-login-dismissing");
            setTimeout(() => {
                overlay.style.display = "none";
                overlay.classList.remove("ios-login-dismissing");
            }, 450);
        }
    }

    // Auto-restore any evaluations corrupted by default maths template to their proper subject blueprints
    async restoreMisplacedEvaluations() {
        if (!window.appStorage) return;
        try {
            const all = await window.appStorage.getAllEvaluations(false, true);
            if (!Array.isArray(all) || all.length === 0) return;

            let restoredCount = 0;
            for (const ev of all) {
                if (!ev) continue;
                // Never mutate user-uploaded papers
                if (ev.isUserUploaded) continue;

                const subLower = (ev.subject || "").toLowerCase().trim();
                const tplLower = (ev.templateName || "").toLowerCase().trim();
                const examLower = (ev.examName || "").toLowerCase().trim();
                const clsLower = (ev.className || ev.class || "").toLowerCase().trim();

                const isMathSubject = subLower.includes("math");

                // Check if a non-math evaluation was corrupted by the default math blueprint (mat-x-rev1-40 or 31 Qs)
                const isCorruptedNonMath = !isMathSubject && (
                    ev.templateId === "mat-x-rev1-40" ||
                    ev.templateId === "mat-x-rev2-40" ||
                    ev.templateId === "mat-x-10th-rev-40" ||
                    tplLower.includes("10 mathematics") ||
                    tplLower.includes("std 10 maths") ||
                    (ev.questions && ev.questions.length === 31 && ev.maxMarks === 40 && (
                        subLower.includes("chem") ||
                        subLower.includes("bio") ||
                        subLower.includes("eng") ||
                        subLower.includes("social") ||
                        subLower.includes("physic") ||
                        subLower.includes("entrep") ||
                        subLower.includes("econom") ||
                        subLower.includes("politic") ||
                        subLower.includes("history") ||
                        subLower.includes("science") ||
                        subLower.includes("tamil")
                    ))
                );

                // Check if a Grade 12 or 80-mark Math paper was wrongly forced into the 40M / 31 Qs Grade 10 blueprint
                const isCorruptedGrade12Math = isMathSubject && (clsLower.includes("12") || clsLower.includes("xii")) && (
                    ev.templateId === "mat-x-rev1-40" ||
                    (ev.questions && ev.questions.length === 31 && ev.maxMarks === 40)
                );

                if (!isCorruptedNonMath && !isCorruptedGrade12Math) {
                    continue;
                }

                console.log(`[Auto-Restore] Found corrupted evaluation ${ev.studentName || 'Student'} (${ev.id}) - Subject: ${ev.subject}, Current Template: ${ev.templateName} (${ev.templateId}). Restoring proper blueprint...`);

                let targetTpl = null;

                // 1. Chemistry
                if (subLower.includes("chem")) {
                    if (clsLower.includes("10") || clsLower.includes("x")) {
                        targetTpl = window.MockData?.scienceGrade10ChemistryTemplate;
                    } else if (tplLower.includes("board") || examLower.includes("board") || ev.maxMarks === 70) {
                        targetTpl = window.MockData?.chemistryClass12BoardTemplate;
                    } else {
                        targetTpl = window.MockData?.chemistryRevision1SubjectiveTemplate;
                    }
                }
                // 2. Biology
                else if (subLower.includes("bio") || subLower.includes("botany") || subLower.includes("zoology") || subLower.includes("life sci")) {
                    if (clsLower.includes("10") || clsLower.includes("x")) {
                        targetTpl = window.MockData?.scienceGrade10BiologyTemplate;
                    } else if (tplLower.includes("board") || examLower.includes("board") || ev.maxMarks === 70) {
                        targetTpl = window.MockData?.biologyClass12BoardTemplate;
                    } else if (ev.maxMarks === 40 || tplLower.includes("40") || examLower.includes("40")) {
                        targetTpl = window.MockData?.biologyRevision1Subjective40Template;
                    } else {
                        targetTpl = window.MockData?.biologyRevision1SubjectiveTemplate;
                    }
                }
                // 3. English
                else if (subLower.includes("english") || subLower.includes("eng")) {
                    targetTpl = (clsLower.includes("10") || clsLower.includes("x"))
                        ? null
                        : (window.MockData?.englishGrade12ObjSubjTemplate || window.MockData?.englishTemplate);
                }
                // 4. Social Science
                else if (subLower.includes("social")) {
                    targetTpl = window.MockData?.socialGrade10Revision1Template;
                }
                // 5. Physics
                else if (subLower.includes("physic")) {
                    if (tplLower.includes("revision test 1") || examLower.includes("revision test 1")) {
                        targetTpl = window.MockData?.grade12RevisionTest1Template;
                    } else if (tplLower.includes("revision 1") || examLower.includes("revision 1")) {
                        targetTpl = window.MockData?.physicsRevision1Template;
                    } else {
                        targetTpl = window.MockData?.physicsTemplate;
                    }
                }
                // 6. Grade 12 Math
                else if (isCorruptedGrade12Math) {
                    targetTpl = window.MockData?.mathGrade12Template;
                }
                // 7. Tamil
                else if (subLower.includes("tamil")) {
                    targetTpl = window.MockData?.tamilGrade10Revision1Template;
                }
                // 8. Humanities & Commerce
                else if (subLower.includes("entrep")) {
                    targetTpl = window.MockData?.entrepreneurshipGrade12Template;
                } else if (subLower.includes("econom") || subLower.includes("ecom") || subLower === "eco" || subLower.startsWith("eco ") || subLower.includes("eco-") || tplLower.includes("econom") || examLower.includes("econom")) {
                    targetTpl = window.MockData?.economicsTemplate;
                } else if (subLower.includes("politic") || subLower.includes("pol sci")) {
                    targetTpl = window.MockData?.politicalScienceTemplate;
                } else if (subLower.includes("history")) {
                    targetTpl = window.MockData?.historyRevision1Template;
                } else if (subLower.includes("science")) {
                    targetTpl = window.MockData?.scienceGrade10BiologyTemplate || window.MockData?.scienceGrade10ChemistryTemplate;
                }
                // 9. Commerce & Technical Subjects
                else if (subLower.includes("account")) {
                    targetTpl = window.MockData?.accountancyGrade12Template;
                } else if (subLower.includes("business") || subLower.includes("bst")) {
                    targetTpl = window.MockData?.businessStudiesGrade12Template;
                } else if (subLower.includes("informatics") || subLower === "ip" || subLower.includes("info prac")) {
                    targetTpl = window.MockData?.informaticsPracticesGrade12Template;
                } else if (subLower.includes("computer") || subLower === "cs") {
                    targetTpl = window.MockData?.computerScienceGrade12Template;
                } else if (subLower.includes("french")) {
                    targetTpl = (clsLower.includes("10") || clsLower.includes("x")) ? window.MockData?.frenchGrade10Template : window.MockData?.frenchGrade12Template;
                }

                if (!targetTpl) {
                    const is12 = clsLower.includes("12") || clsLower.includes("xii");
                    const subClean = (ev.subject || "General").trim();
                    const cleanName = `${is12 ? 'Grade 12' : 'Grade 10'} ${subClean} Assessment 2026`;
                    targetTpl = {
                        id: `tpl-${subLower.replace(/[^a-z0-9]/g, '_')}-${is12 ? '12' : '10'}`,
                        name: cleanName,
                        examName: cleanName,
                        subject: ev.subject,
                        maxMarks: ev.maxMarks || 80,
                        duration: "3 Hours",
                        badge: "Official Blueprint",
                        sections: [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Main", qStartNo: 1, qEndNo: (ev.questions?.length || 30), qCount: (ev.questions?.length || 30), marksPerQ: 1, maxMarks: (ev.maxMarks || 80), secTotal: (ev.maxMarks || 80) }
                        ],
                        questions: ev.questions && ev.questions.length > 0 ? ev.questions : []
                    };
                }

                // Restore blueprint metadata
                ev.templateId = targetTpl.id;
                ev.templateName = targetTpl.name;
                ev.examName = targetTpl.examName || targetTpl.name;
                // If this paper belongs to Class 12, rigorously strip any stale "10 " prefixes
                if (clsLower.includes("12") || clsLower.includes("xii")) {
                    ev.templateName = ev.templateName.replace(/\b(10th\s+|10\s+|STD\s+10\s+)/gi, "Grade 12 ");
                    ev.examName = ev.examName.replace(/\b(10th\s+|10\s+|STD\s+10\s+)/gi, "Grade 12 ");
                }
                ev.maxMarks = targetTpl.maxMarks;
                ev.sections = JSON.parse(JSON.stringify(targetTpl.sections || []));

                // Map old marks safely
                const oldMarksMap = new Map();
                (ev.questions || []).forEach(q => {
                    const numMarks = Number(q.awardedMarks) || 0;
                    const subMarksSum = Array.isArray(q.subQuestions)
                        ? q.subQuestions.reduce((sum, sq) => sum + (Number(sq.awardedMarks) || 0), 0)
                        : 0;
                    const effectiveMarks = Math.max(numMarks, subMarksSum);
                    const isGraded = (q.status && q.status !== "unmarked" && q.status !== "pending") || effectiveMarks > 0;
                    if (isGraded || q.status === "wrong") {
                        oldMarksMap.set(String(q.qNo), { ...q, awardedMarks: effectiveMarks });
                        if (q.label) {
                            oldMarksMap.set(String(q.label).toUpperCase().trim(), { ...q, awardedMarks: effectiveMarks });
                            oldMarksMap.set(String(q.label).replace(/[^0-9]/g, ''), { ...q, awardedMarks: effectiveMarks });
                        }
                    }
                });

                // Also harvest marks from margin annotations if present
                if (Array.isArray(ev.pages)) {
                    ev.pages.forEach(p => {
                        if (p && Array.isArray(p.annotations)) {
                            p.annotations.forEach(a => {
                                if (a.qNo) {
                                    const qKey = String(a.qNo).replace(/[^0-9]/g, '');
                                    if (qKey && !oldMarksMap.has(qKey)) {
                                        const markVal = Number(a.marks || a.stepMarks || a.mark) || 0;
                                        if (markVal > 0 || a.type === "tick") {
                                            oldMarksMap.set(qKey, {
                                                qNo: Number(qKey),
                                                awardedMarks: markVal,
                                                status: markVal > 0 || a.type === "tick" ? "correct" : "unmarked"
                                            });
                                        }
                                    }
                                }
                            });
                        }
                    });
                }

                let tplQuestions = (targetTpl.questions && targetTpl.questions.length > 0)
                    ? targetTpl.questions
                    : [];

                if (tplQuestions.length === 0 && targetTpl.sections && Array.isArray(targetTpl.sections)) {
                    let synQ = 1;
                    targetTpl.sections.forEach(sec => {
                        const start = sec.qStartNo || synQ;
                        const end = sec.qEndNo || (start + (sec.qCount || 1) - 1);
                        const marks = Number(sec.marksPerQ) || 1;
                        for (let qn = start; qn <= end; qn++) {
                            tplQuestions.push({
                                id: `q_${qn}`,
                                qNo: qn,
                                qNumber: `Q${qn}`,
                                label: `Q${qn}`,
                                section: sec.title || sec.name || `Section ${sec.letter || 'A'}`,
                                sectionId: sec.id || `sec_${(sec.letter || 'a').toLowerCase()}`,
                                maxMarks: marks,
                                isChoice: !!sec.hasChoice,
                                hasSubQuestions: false,
                                subQuestions: []
                            });
                            synQ = Math.max(synQ, qn + 1);
                        }
                    });
                }

                ev.questions = JSON.parse(JSON.stringify(tplQuestions)).map(newQ => {
                    const prev = oldMarksMap.get(String(newQ.qNo)) || oldMarksMap.get(String(newQ.label || '').replace(/[^0-9]/g, ''));
                    if (prev) {
                        if (prev.status === "correct") {
                            newQ.awardedMarks = newQ.maxMarks;
                            newQ.status = "correct";
                        } else if (prev.status === "wrong") {
                            newQ.awardedMarks = 0;
                            newQ.status = "wrong";
                        } else {
                            newQ.awardedMarks = Math.min(Number(prev.awardedMarks) || 0, newQ.maxMarks);
                            newQ.status = newQ.awardedMarks === newQ.maxMarks ? "correct" : (newQ.awardedMarks > 0 ? "partial" : prev.status || "unmarked");
                        }
                        if (newQ.hasSubQuestions && Array.isArray(newQ.subQuestions) && newQ.subQuestions.length > 0) {
                            let rem = newQ.awardedMarks;
                            newQ.subQuestions.forEach(sq => {
                                const alloc = Math.min(rem, sq.maxMarks);
                                sq.awardedMarks = alloc;
                                rem = Math.max(0, rem - alloc);
                            });
                        }
                    }
                    return newQ;
                });

                const totalObt = ev.questions.reduce((sum, q) => (q.status !== "unmarked" && q.status !== "pending") ? sum + (Number(q.awardedMarks) || 0) : sum, 0);
                ev.obtainedMarks = Math.round(totalObt * 10) / 10;
                ev.percentage = ev.maxMarks > 0 ? Math.round((ev.obtainedMarks / ev.maxMarks) * 100) : 0;
                ev.grade = ev.percentage >= 90 ? "A+" : ev.percentage >= 75 ? "A" : ev.percentage >= 60 ? "B" : ev.percentage >= 40 ? "C" : "F";
                ev.status = ev.obtainedMarks > 0 ? ((window.isEvaluationFullyGraded ? window.isEvaluationFullyGraded(ev.questions, ev.sections || targetTpl.sections) : ev.questions.every(q => q.status && q.status !== "unmarked" && q.status !== "pending")) ? "Completed" : "In Progress") : (ev.status || "Pending");

                await window.appStorage.saveEvaluation(ev);
                restoredCount++;
                console.log(`[Auto-Restore] Restored ${ev.studentName || 'Student'} (${ev.id}) to ${targetTpl.name} (${ev.questions.length} Qs / ${ev.maxMarks}M). Total: ${ev.obtainedMarks}/${ev.maxMarks}`);
            }

            if (restoredCount > 0) {
                console.log(`[Auto-Restore] Successfully restored ${restoredCount} corrupted evaluation(s) to their genuine subject blueprints!`);
            }
        } catch (e) {
            console.warn("Auto-restore evaluations warning:", e);
        }
    }

    // Safe shim for backward compatibility
    async migrateMathGrade10Evaluations() {
        return;
    }

    // Auto-repair & migrate any 10th Tamil Revision 1 evaluations to official 40 Qs / 40M (1 Section, all 1 Mark each) blueprint
    async migrateTamilGrade10Evaluations() {
        if (!window.appStorage) return;
        try {
            const all = await window.appStorage.getAllEvaluations(false, true);
            if (!Array.isArray(all) || all.length === 0) return;

            const tpl = window.MockData?.tamilGrade10Revision1Template;
            if (!tpl) return;

            let updatedCount = 0;
            for (const ev of all) {
                if (!ev || ev.isUserUploaded) continue;
                const subLower = (ev.subject || "").toLowerCase();
                const tplLower = (ev.templateName || "").toLowerCase();
                const examLower = (ev.examName || "").toLowerCase();
                const clsLower = (ev.className || ev.class || "").toLowerCase();

                const isTamilSubject = subLower.includes("tamil");
                if (!isTamilSubject) continue;

                const isTamil10Revision1 = (
                    ev.templateId === "tam-x-rev1-40" ||
                    tplLower.includes("tamil") ||
                    examLower.includes("tamil") ||
                    tplLower.includes("revision 1 objective") ||
                    examLower.includes("revision 1 objective") ||
                    tplLower.includes("revision 1") ||
                    examLower.includes("revision 1") ||
                    clsLower.includes("10") ||
                    clsLower.includes("x") ||
                    ev.maxMarks === 40
                );

                if (isTamil10Revision1) {
                    const needsRepair = (
                        ev.questions?.length !== 40 ||
                        ev.maxMarks !== 40 ||
                        !ev.sections ||
                        ev.sections.length !== 1 ||
                        ev.sections[0]?.qCount !== 40 ||
                        ev.questions?.some(q => q.maxMarks !== 1 || q.hasSubQuestions)
                    );

                    if (needsRepair) {
                        console.log(`[Auto-Repair] Migrating Tamil evaluation ${ev.studentName || 'Student'} (${ev.id}) to 40 Qs / 40M (all 1 Mark) blueprint...`);
                        ev.templateId = tpl.id;
                        ev.templateName = tpl.name;
                        ev.examName = tpl.examName;
                        ev.maxMarks = 40;
                        ev.sections = JSON.parse(JSON.stringify(tpl.sections));

                        const oldMarksMap = new Map();
                        (ev.questions || []).forEach(q => {
                            if (q.status && q.status !== "unmarked" && q.status !== "pending") {
                                oldMarksMap.set(q.qNo, q);
                            }
                        });

                        ev.questions = JSON.parse(JSON.stringify(tpl.questions)).map(newQ => {
                            if (oldMarksMap.has(newQ.qNo)) {
                                const prev = oldMarksMap.get(newQ.qNo);
                                newQ.awardedMarks = Math.min(Number(prev.awardedMarks) || 0, 1);
                                newQ.status = prev.status;
                            }
                            newQ.hasSubQuestions = false;
                            newQ.subQuestions = [];
                            newQ.maxMarks = 1;
                            return newQ;
                        });

                        const totalObt = ev.questions.reduce((sum, q) => (q.status !== "unmarked" && q.status !== "pending") ? sum + (Number(q.awardedMarks) || 0) : sum, 0);
                        ev.obtainedMarks = Math.round(totalObt * 10) / 10;
                        ev.percentage = Math.round((ev.obtainedMarks / 40) * 100);
                        ev.grade = ev.percentage >= 90 ? "A+" : ev.percentage >= 75 ? "A" : ev.percentage >= 60 ? "B" : ev.percentage >= 40 ? "C" : "F";

                        await window.appStorage.saveEvaluation(ev);
                        updatedCount++;
                    }
                }
            }
            if (updatedCount > 0) {
                console.log(`[Auto-Repair] Successfully migrated ${updatedCount} evaluation(s) to 10th Tamil Revision 1 Blueprint (40 Qs x 1M).`);
            }
        } catch (e) {
            console.warn("Auto-repair Tamil migration warning:", e);
        }
    }

    // Auto-repair & migrate any Biology Revision 1 evaluations to official 13 Qs Revision 1 Subjective blueprint
    async migrateBiologyRevision1Evaluations() {
        if (!window.appStorage) return;
        try {
            const allEvals = await window.appStorage.getAllEvaluations(false, true);
            if (!allEvals || !Array.isArray(allEvals) || allEvals.length === 0) return;

            const tpl = window.MockData?.biologyRevision1SubjectiveTemplate;
            if (!tpl || !tpl.questions || tpl.questions.length === 0) return;

            let updatedCount = 0;
            for (const ev of allEvals) {
                if (!ev || ev.isUserUploaded) continue;
                const subLower = (ev.subject || "").toLowerCase();
                const tplLower = (ev.templateName || "").toLowerCase();
                const examLower = (ev.examName || "").toLowerCase();

                const isBioSubject = subLower.includes("bio") || subLower.includes("botany") || subLower.includes("zoology") || subLower.includes("life sci");
                if (!isBioSubject) continue;

                const clsLower = (ev.className || ev.class || "").toLowerCase();
                // Never migrate Grade 10 Science / Biology papers into the 12th Grade 13-question blueprint!
                if (clsLower.includes("10") || clsLower.includes("x") || ev.templateId === "bio-x-30") continue;

                const isRevision1Subj =
                    tplLower.includes("revision 1") ||
                    examLower.includes("revision 1") ||
                    tplLower.includes("subjective") ||
                    examLower.includes("subjective") ||
                    ev.templateId === "bio-rev1-sub-13" ||
                    ev.templateId === "bio-rev1-sub-40" ||
                    (ev.questions && ev.questions.length === 10);

                if (isRevision1Subj) {
                    const needsMigration =
                        ev.questions?.length !== 13 ||
                        ev.maxMarks === 30 ||
                        ev.templateId === "bio-x-30";

                    if (needsMigration) {
                        const use40M = ev.maxMarks === 40;
                        const targetTpl = (use40M && window.MockData?.biologyRevision1Subjective40Template)
                            ? window.MockData.biologyRevision1Subjective40Template
                            : tpl;

                        ev.templateId = targetTpl.id;
                        ev.templateName = targetTpl.name;
                        ev.examName = targetTpl.examName;
                        ev.maxMarks = targetTpl.maxMarks;
                        ev.duration = targetTpl.duration;
                        ev.sections = JSON.parse(JSON.stringify(targetTpl.sections));

                        const oldMarksMap = new Map();
                        (ev.questions || []).forEach(q => {
                            if (q.status && q.status !== "unmarked" && q.status !== "pending") {
                                oldMarksMap.set(q.qNo, q);
                            }
                        });

                        ev.questions = JSON.parse(JSON.stringify(targetTpl.questions)).map(newQ => {
                            if (oldMarksMap.has(newQ.qNo)) {
                                const prev = oldMarksMap.get(newQ.qNo);
                                newQ.awardedMarks = Math.min(Number(prev.awardedMarks) || 0, newQ.maxMarks);
                                newQ.status = prev.status;
                            } else {
                                newQ.awardedMarks = 0;
                                newQ.status = "unmarked";
                            }
                            return newQ;
                        });

                        const totalObt = ev.questions.reduce((sum, q) => (q.status !== "unmarked" && q.status !== "pending") ? sum + (Number(q.awardedMarks) || 0) : sum, 0);
                        ev.obtainedMarks = Math.round(totalObt * 10) / 10;
                        if (ev.maxMarks > 0) {
                            ev.percentage = Math.round((ev.obtainedMarks / ev.maxMarks) * 100);
                        }
                        ev.grade = ev.percentage >= 90 ? "A+" : ev.percentage >= 75 ? "A" : ev.percentage >= 60 ? "B" : ev.percentage >= 40 ? "C" : "F";
                        ev.updatedAt = new Date().toISOString();

                        await window.appStorage.saveEvaluation(ev);
                        updatedCount++;
                    }
                }
            }
            if (updatedCount > 0) {
                console.log(`[Auto-Repair] Successfully migrated ${updatedCount} evaluation(s) to Biology Revision 1 Subjective (13 Qs) Blueprint.`);
            }
        } catch (e) {
            console.warn("Auto-repair Biology migration warning:", e);
        }
    }

    async migrateEconomicsDuplicateEvaluations() {
        if (!window.appStorage) return;
        try {
            const allEvals = await window.appStorage.getAllEvaluations(false, true);
            if (!allEvals || !Array.isArray(allEvals) || allEvals.length === 0) return;

            const catalog = await window.appStorage.getSubjectCatalog();
            const ecoSub = Array.isArray(catalog) ? catalog.find(s => (s.name || "").toLowerCase().includes("econom") || s.id === "eco") : null;
            
            // Find user's genuine template (e.g. Economics Revision 2 Subjective 2026)
            let genuineTpl = ecoSub?.templates?.find(t => 
                (t.name && t.name.toLowerCase().includes("revision 2")) ||
                (t.examName && t.examName.toLowerCase().includes("revision 2"))
            ) || ecoSub?.templates?.find(t => t.id !== "eco-xii-40" && !(t.name && t.name.includes("Grade XII Economics - 40 Marks")));

            let updatedCount = 0;
            for (const ev of allEvals) {
                if (!ev) continue;
                const isLegacyEco40 = ev.templateId === "eco-xii-40" || (ev.templateName && ev.templateName.includes("Grade XII Economics - 40 Marks"));
                if (isLegacyEco40) {
                    if (genuineTpl) {
                        ev.templateId = genuineTpl.id;
                        ev.templateName = genuineTpl.name;
                        ev.examName = genuineTpl.examName || genuineTpl.name;
                        if (genuineTpl.sections && (!ev.sections || ev.sections.length === 0)) {
                            ev.sections = JSON.parse(JSON.stringify(genuineTpl.sections));
                        }
                    } else {
                        ev.templateName = "Economics Revision 2 Subjective 2026";
                        ev.examName = "Economics Revision 2 Subjective 2026";
                    }
                    ev.updatedAt = new Date().toISOString();
                    await window.appStorage.saveEvaluation(ev);
                    updatedCount++;
                }
            }
            if (updatedCount > 0) {
                console.log(`[Auto-Repair] Successfully unified ${updatedCount} Economics evaluation(s) under genuine blueprint: ${genuineTpl?.name || 'Economics Revision 2 Subjective 2026'}.`);
            }
        } catch (e) {
            console.warn("Economics blueprint migration warning:", e);
        }
    }

    // --- Platform License Subscription Gatekeeper ---

    async enforceLicenseGate() {
        if (!window.appStorage || typeof window.appStorage.isPlatformLocked !== "function") return false;
        try {
            const lockStatus = await window.appStorage.isPlatformLocked();
            const currentUser = window.appStorage.getCurrentUser();
            const isSuperAdmin = currentUser && (currentUser.role === "super_admin" || (currentUser.email && currentUser.email.toLowerCase() === "iamnithyaprakash@gmail.com"));

            if (lockStatus.locked && !isSuperAdmin) {
                this.showPlatformLockedOverlay(false, lockStatus);
                return true;
            } else {
                const overlay = document.getElementById("platform-locked-overlay");
                if (overlay && !overlay.getAttribute("data-is-preview")) {
                    overlay.remove();
                }
                return false;
            }
        } catch (e) {
            console.warn("enforceLicenseGate error:", e);
            return false;
        }
    }

    async showPlatformLockedOverlay(isPreview = false, lockStatus = null) {
        const existing = document.getElementById("platform-locked-overlay");
        if (existing) existing.remove();

        const lic = (lockStatus && lockStatus.license) ? lockStatus.license : (await window.appStorage.getLicenseConfig());
        const bank = lic.bankDetails || {};
        const expiryFormatted = lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString("en-IN", { dateStyle: "full" }) : "Expired";

        const overlay = document.createElement("div");
        overlay.id = "platform-locked-overlay";
        if (isPreview) overlay.setAttribute("data-is-preview", "true");
        overlay.className = "platform-locked-backdrop";

        const qrHtml = lic.paymentQrUrl 
            ? `<img src="${lic.paymentQrUrl}" alt="Scan QR to Renew" class="locked-qr-img" />`
            : `
            <div class="locked-svg-qr-wrap">
                <svg width="180" height="180" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="200" rx="16" fill="#FFFFFF"/>
                    <rect x="20" y="20" width="46" height="46" rx="6" fill="#0F172A"/>
                    <rect x="28" y="28" width="30" height="30" rx="3" fill="#FFFFFF"/>
                    <rect x="34" y="34" width="18" height="18" rx="2" fill="#0F172A"/>
                    <rect x="134" y="20" width="46" height="46" rx="6" fill="#0F172A"/>
                    <rect x="142" y="28" width="30" height="30" rx="3" fill="#FFFFFF"/>
                    <rect x="148" y="34" width="18" height="18" rx="2" fill="#0F172A"/>
                    <rect x="20" y="134" width="46" height="46" rx="6" fill="#0F172A"/>
                    <rect x="28" y="142" width="30" height="30" rx="3" fill="#FFFFFF"/>
                    <rect x="34" y="148" width="18" height="18" rx="2" fill="#0F172A"/>
                    <rect x="76" y="24" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="96" y="24" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="116" y="24" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="86" y="44" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="106" y="44" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="76" y="64" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="116" y="64" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="24" y="76" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="44" y="76" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="24" y="96" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="54" y="106" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="80" y="80" width="40" height="40" rx="8" fill="#AF52DE" opacity="0.12"/>
                    <circle cx="100" cy="100" r="14" fill="#0071E3"/>
                    <path d="M96 100L99 103L105 97" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="134" y="76" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="154" y="76" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="164" y="96" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="76" y="134" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="106" y="134" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="96" y="154" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="116" y="154" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="144" y="134" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="164" y="154" width="10" height="10" rx="2" fill="#0F172A"/>
                    <rect x="144" y="164" width="10" height="10" rx="2" fill="#0F172A"/>
                </svg>
            </div>
            `;

        overlay.innerHTML = `
            <div class="locked-card-container">
                ${isPreview ? `
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
                        <button type="button" id="btn-close-locked-preview" class="btn-preview-close" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 6px 14px; border-radius: 99px; font-size: 0.8rem; cursor: pointer;">
                            ✕ Close Preview
                        </button>
                    </div>
                ` : ''}

                <!-- Lock Header Icon & Title -->
                <div class="locked-header-box">
                    <div class="locked-shield-pulse">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>
                    <span class="locked-pill-tag">LICENSE EXPIRED / ACCESS LOCKED</span>
                    <h2 class="locked-main-heading">Platform Access Suspended</h2>
                    <p class="locked-inst-sub">${lic.institutionName || 'Adwaith Thought Academy'} • Niprak Digital Examination Platform</p>
                </div>

                <!-- Custom Reason / Instructions Box -->
                <div class="locked-message-box">
                    <p class="locked-msg-text">${lic.lockoutMessage || 'Your institutional subscription license has expired. Please complete renewal payment via the QR code or bank account below and contact Mr. Nithya Prakash to activate access.'}</p>
                    <div class="locked-expiry-tag">Validity Expired: <strong>${expiryFormatted}</strong></div>
                </div>

                <!-- Payment QR & Bank Transfer Card -->
                <div class="locked-payment-card">
                    <div class="payment-card-left">
                        <div class="qr-code-frame">
                            ${qrHtml}
                            <span class="qr-scan-label">Scan via GPay / PhonePe / Paytm</span>
                        </div>
                    </div>

                    <div class="payment-card-right">
                        <h4 class="bank-details-title">Bank Transfer &amp; UPI Payment</h4>
                        <div class="bank-info-grid">
                            <div class="bank-item">
                                <span class="b-lbl">Account Holder</span>
                                <span class="b-val">${bank.accountName || 'Nithya Prakash'}</span>
                            </div>
                            <div class="bank-item">
                                <span class="b-lbl">Bank Name</span>
                                <span class="b-val">${bank.bankName || 'HDFC Bank'}</span>
                            </div>
                            <div class="bank-item">
                                <span class="b-lbl">Account Number</span>
                                <div class="b-val-copy">
                                    <span id="copy-acc-num">${bank.accountNumber || '50100234567890'}</span>
                                    <button type="button" class="btn-copy-clip" data-target="copy-acc-num" title="Copy Account Number">Copy</button>
                                </div>
                            </div>
                            <div class="bank-item">
                                <span class="b-lbl">IFSC Code</span>
                                <div class="b-val-copy">
                                    <span id="copy-ifsc">${bank.ifscCode || 'HDFC0001234'}</span>
                                    <button type="button" class="btn-copy-clip" data-target="copy-ifsc" title="Copy IFSC">Copy</button>
                                </div>
                            </div>
                            <div class="bank-item" style="grid-column: span 2;">
                                <span class="b-lbl">UPI ID (VPA)</span>
                                <div class="b-val-copy">
                                    <strong id="copy-upi" style="color: #0071E3;">${bank.upiId || 'iamnithyaprakash@okhdfcbank'}</strong>
                                    <button type="button" class="btn-copy-clip" data-target="copy-upi" title="Copy UPI ID">Copy</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Contact & Support Links -->
                <div class="locked-contact-row">
                    ${lic.contactPhone ? `
                        <a href="tel:${lic.contactPhone.replace(/\s+/g, '')}" class="btn-contact-action">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            <span>Call / WhatsApp: ${lic.contactPhone}</span>
                        </a>
                    ` : ''}
                    ${lic.contactEmail ? `
                        <a href="mailto:${lic.contactEmail}?subject=Niprak%20OSM%20Subscription%20Renewal" class="btn-contact-action">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <span>${lic.contactEmail}</span>
                        </a>
                    ` : ''}
                </div>

                <!-- Secret Super Admin Unlock Trigger -->
                <div class="locked-secret-unlock-row">
                    <button type="button" id="btn-secret-super-admin-unlock" class="btn-secret-unlock">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span>Super Admin Sign In &amp; License Renew</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Copy buttons logic
        overlay.querySelectorAll(".btn-copy-clip").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-target");
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    navigator.clipboard.writeText(targetEl.textContent.trim()).then(() => {
                        const original = btn.textContent;
                        btn.textContent = "Copied!";
                        btn.style.color = "#16A34A";
                        setTimeout(() => {
                            btn.textContent = original;
                            btn.style.color = "";
                        }, 1800);
                    });
                }
            });
        });

        if (isPreview) {
            const btnClosePreview = overlay.querySelector("#btn-close-locked-preview");
            if (btnClosePreview) {
                btnClosePreview.addEventListener("click", () => overlay.remove());
            }
        }

        // Secret unlock button
        const btnSecretUnlock = overlay.querySelector("#btn-secret-super-admin-unlock");
        if (btnSecretUnlock) {
            btnSecretUnlock.addEventListener("click", () => this.showSuperAdminUnlockDialog(overlay));
        }
    }

    showSuperAdminUnlockDialog(parentOverlay) {
        const dialogId = "super-admin-secret-modal";
        const old = document.getElementById(dialogId);
        if (old) old.remove();

        const modal = document.createElement("div");
        modal.id = dialogId;
        modal.className = "super-modal-overlay";
        modal.style.zIndex = "10000002";
        modal.innerHTML = `
            <div class="super-modal-dialog" style="max-width: 420px; text-align: left; animation: fadeInModal 0.2s ease-out;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.2rem;">👑</span>
                        <h3 style="font-size: 1.15rem; font-weight: 700; color: #0F172A; margin: 0;">Super Admin Unlock</h3>
                    </div>
                    <button type="button" id="btn-close-unlock-modal" style="background: none; border: none; font-size: 1.4rem; color: #64748B; cursor: pointer;">×</button>
                </div>
                <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 16px;">Sign in as Platform Owner (iamnithyaprakash@gmail.com) to bypass lock and manage subscription.</p>

                <div class="super-form-group">
                    <label class="super-label">Super Admin Email / User ID</label>
                    <input type="email" id="unlock-email" class="super-input" placeholder="iamnithyaprakash@gmail.com" />
                </div>
                <div class="super-form-group">
                    <label class="super-label">Password</label>
                    <input type="password" id="unlock-pass" class="super-input" placeholder="Enter password" />
                </div>

                <div id="unlock-err-msg" style="display: none; padding: 8px 12px; border-radius: 8px; background: #FEE2E2; color: #DC2626; font-size: 0.82rem; margin-bottom: 14px;"></div>

                <div class="modal-actions-row" style="margin-top: 18px;">
                    <button type="button" id="btn-cancel-unlock" class="btn-super-secondary">Cancel</button>
                    <button type="button" id="btn-submit-unlock" class="btn-super-primary" style="background: linear-gradient(135deg, #AF52DE, #5856D6);">
                        <span>Sign In &amp; Enter Console</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector("#btn-close-unlock-modal").addEventListener("click", () => modal.remove());
        modal.querySelector("#btn-cancel-unlock").addEventListener("click", () => modal.remove());

        const doUnlock = () => {
            const email = modal.querySelector("#unlock-email")?.value.trim().toLowerCase();
            const pass = modal.querySelector("#unlock-pass")?.value.trim();
            const errBox = modal.querySelector("#unlock-err-msg");

            if (email === "iamnithyaprakash@gmail.com" && pass === "iamnithyaprakash@gmail.com") {
                const superAdminAccount = {
                    id: "usr_super_admin",
                    uid: "usr_super_admin",
                    name: "Nithya Prakash (Super Admin)",
                    username: "iamnithyaprakash",
                    email: "iamnithyaprakash@gmail.com",
                    password: "iamnithyaprakash@gmail.com",
                    role: "super_admin",
                    roleLabel: "Super Admin (Owner)",
                    status: "active",
                    assignedSubjects: ["All Subjects"],
                    assignedClasses: ["All Classes"],
                    createdAt: new Date().toISOString()
                };
                window.appStorage.setCurrentUser(superAdminAccount);
                modal.remove();
                if (parentOverlay) parentOverlay.remove();
                this.setPortal("super_admin", true);
                this.applySettingsToUI();
                this.showToast("⚡ Welcome back, Super Admin!", "success");
            } else {
                if (errBox) {
                    errBox.style.display = "block";
                    errBox.textContent = "Invalid Super Admin credentials. Please check your email and password.";
                }
            }
        };

        modal.querySelector("#btn-submit-unlock").addEventListener("click", doUnlock);
        modal.querySelector("#unlock-pass").addEventListener("keydown", (e) => {
            if (e.key === "Enter") doUnlock();
        });
    }

    // --- Apple Cupertino Styled Dialogs for Alerts and Confirmations ---

    showAlertDialog(options = {}) {
        const {
            title = "Notice",
            message = "",
            type = "info", // "error" | "warning" | "success" | "info"
            primaryBtnText = "OK",
            secondaryBtnText = null,
            danger = false
        } = (typeof options === "string" ? { message: options } : options);

        return new Promise((resolve) => {
            const existing = document.getElementById("app-global-alert-dialog");
            if (existing) existing.remove();

            const icons = {
                error: `
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(255, 59, 48, 0.12); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #FF3B30;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </div>
                `,
                warning: `
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(255, 149, 0, 0.12); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #FF9500;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </div>
                `,
                success: `
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(52, 199, 89, 0.12); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #34C759;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                `,
                info: `
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(0, 113, 227, 0.12); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #0071E3;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </div>
                `
            };

            const overlay = document.createElement("div");
            overlay.id = "app-global-alert-dialog";
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.55);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: osDialogFade 0.18s ease-out;
            `;

            const card = document.createElement("div");
            card.style.cssText = `
                background: var(--bg-card, #ffffff);
                color: var(--text-main, #1d1d1f);
                width: 100%;
                max-width: 400px;
                border-radius: 22px;
                padding: 26px 24px 22px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1);
                border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
                text-align: center;
                animation: osDialogPop 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;

            card.innerHTML = `
                ${icons[type] || icons.info}
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main, #1d1d1f); margin: 0 0 8px; line-height: 1.35;">${title}</h3>
                <p style="font-size: 0.92rem; color: var(--text-muted, #6e6e73); margin: 0 0 24px; line-height: 1.5; white-space: pre-line; word-break: break-word;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    ${secondaryBtnText ? `
                        <button type="button" id="btn-dialog-secondary" style="flex: 1; height: 44px; border-radius: 12px; background: var(--bg-subtle, #f2f2f7); border: 1px solid var(--border-color, #e5e5ea); color: var(--text-main, #1d1d1f); font-size: 0.92rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease;">
                            ${secondaryBtnText}
                        </button>
                    ` : ""}
                    <button type="button" id="btn-dialog-primary" style="flex: 1; height: 44px; border-radius: 12px; background: ${danger ? '#FF3B30' : (type === 'error' ? '#FF3B30' : '#0071E3')}; border: none; color: #ffffff; font-size: 0.92rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px ${type === 'error' ? 'rgba(255, 59, 48, 0.3)' : 'rgba(0, 113, 227, 0.3)'}; transition: transform 0.12s ease;">
                        ${primaryBtnText}
                    </button>
                </div>
            `;

            overlay.appendChild(card);
            document.body.appendChild(overlay);

            const btnPrimary = card.querySelector("#btn-dialog-primary");
            const btnSecondary = card.querySelector("#btn-dialog-secondary");

            if (btnPrimary) {
                btnPrimary.focus();
                btnPrimary.addEventListener("click", () => {
                    overlay.remove();
                    resolve(true);
                });
            }

            if (btnSecondary) {
                btnSecondary.addEventListener("click", () => {
                    overlay.remove();
                    resolve(false);
                });
            }

            const onKeyDown = (e) => {
                if (e.key === "Escape") {
                    document.removeEventListener("keydown", onKeyDown);
                    overlay.remove();
                    resolve(false);
                } else if (e.key === "Enter" && !secondaryBtnText) {
                    document.removeEventListener("keydown", onKeyDown);
                    overlay.remove();
                    resolve(true);
                }
            };
            document.addEventListener("keydown", onKeyDown);
        });
    }

    showForgotPasswordDialog(defaultEmail = "") {
        return new Promise((resolve) => {
            const existing = document.getElementById("app-forgot-password-dialog");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "app-forgot-password-dialog";
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.55);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: osDialogFade 0.18s ease-out;
            `;

            const card = document.createElement("div");
            card.style.cssText = `
                background: var(--bg-card, #ffffff);
                color: var(--text-main, #1d1d1f);
                width: 100%;
                max-width: 440px;
                border-radius: 22px;
                padding: 28px 24px 24px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1);
                border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
                text-align: left;
                animation: osDialogPop 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(0, 113, 227, 0.1); display: flex; align-items: center; justify-content: center; color: #0071E3;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main, #1d1d1f); margin: 0; line-height: 1.3;">Reset Password</h3>
                        <span style="font-size: 0.8rem; color: var(--text-muted, #6e6e73);">Niprak OSM Secure Recovery</span>
                    </div>
                </div>

                <p style="font-size: 0.88rem; color: var(--text-muted, #6e6e73); margin: 0 0 18px; line-height: 1.5;">
                    Enter your registered email address below. We'll send an official Firebase password reset link directly to your inbox.
                </p>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--text-muted, #6e6e73); margin-bottom: 6px;">Registered Email Address</label>
                    <input type="email" id="inp-forgot-email" value="${defaultEmail || ''}" placeholder="name@school.edu" style="width: 100%; height: 44px; padding: 0 14px; border: 1px solid var(--border-color, #d2d2d7); border-radius: 12px; font-size: 0.92rem; background: var(--bg-subtle, #f5f5f7); color: var(--text-main, #1d1d1f); outline: none; box-sizing: border-box;" />
                </div>

                <div id="forgot-status-msg" style="display: none; padding: 10px 14px; border-radius: 10px; font-size: 0.84rem; margin-bottom: 16px;"></div>

                <div style="display: flex; gap: 10px;">
                    <button type="button" id="btn-forgot-cancel" style="flex: 1; height: 44px; border-radius: 12px; background: var(--bg-subtle, #f2f2f7); border: 1px solid var(--border-color, #e5e5ea); color: var(--text-main, #1d1d1f); font-size: 0.92rem; font-weight: 600; cursor: pointer;">
                        Cancel
                    </button>
                    <button type="button" id="btn-forgot-submit" style="flex: 1.3; height: 44px; border-radius: 12px; background: #0071E3; border: none; color: #ffffff; font-size: 0.92rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.3);">
                        Send Reset Link
                    </button>
                </div>
            `;

            overlay.appendChild(card);
            document.body.appendChild(overlay);

            const emailInput = card.querySelector("#inp-forgot-email");
            const btnSubmit = card.querySelector("#btn-forgot-submit");
            const btnCancel = card.querySelector("#btn-forgot-cancel");
            const statusBox = card.querySelector("#forgot-status-msg");

            if (emailInput) emailInput.focus();

            const closeDialog = () => {
                overlay.remove();
                resolve();
            };

            if (btnCancel) btnCancel.addEventListener("click", closeDialog);

            const doSubmit = async () => {
                const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
                if (!email || !email.includes("@")) {
                    if (statusBox) {
                        statusBox.style.display = "block";
                        statusBox.style.background = "rgba(255, 59, 48, 0.1)";
                        statusBox.style.color = "#FF3B30";
                        statusBox.textContent = "Please enter a valid email address.";
                    }
                    if (emailInput) emailInput.focus();
                    return;
                }

                btnSubmit.disabled = true;
                btnSubmit.textContent = "Sending...";

                try {
                    let result = { success: true };
                    if (window.firebaseManager && typeof window.firebaseManager.sendPasswordReset === "function") {
                        result = await window.firebaseManager.sendPasswordReset(email);
                    }

                    if (result && result.success) {
                        closeDialog();
                        await this.showAlertDialog({
                            title: "Reset Link Sent",
                            message: `A password reset link has been dispatched to ${email}.\n\nPlease check your inbox (and spam folder) to set a new password.`,
                            type: "success",
                            primaryBtnText: "Understood"
                        });
                    } else {
                        const errMsg = (result && result.error) ? result.error : "Could not send reset email. Please try again.";
                        if (statusBox) {
                            statusBox.style.display = "block";
                            statusBox.style.background = "rgba(255, 59, 48, 0.1)";
                            statusBox.style.color = "#FF3B30";
                            statusBox.textContent = errMsg.replace("Firebase: ", "");
                        }
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = "Send Reset Link";
                    }
                } catch (err) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Send Reset Link";
                    if (statusBox) {
                        statusBox.style.display = "block";
                        statusBox.style.background = "rgba(255, 59, 48, 0.1)";
                        statusBox.style.color = "#FF3B30";
                        statusBox.textContent = err.message || "Failed to send reset link.";
                    }
                }
            };

            if (btnSubmit) btnSubmit.addEventListener("click", doSubmit);
            if (emailInput) {
                emailInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") doSubmit();
                });
            }
        });
    }

    setPortal(portalName, doSwitchView = true) {
        const pageDefault = document.body.getAttribute("data-default-portal");

        // Only redirect if page has a data-default-portal attribute (e.g. standalone uploader.html or admin.html)
        if (pageDefault) {
            if (portalName === "admin" && pageDefault !== "admin") {
                localStorage.setItem("niprak_active_portal", "admin");
                localStorage.setItem("onespace_active_portal", "admin");
                window.location.href = "admin.html";
                return;
            }

            if (portalName === "evaluator" && pageDefault === "uploader") {
                localStorage.setItem("niprak_active_portal", "evaluator");
                localStorage.setItem("onespace_active_portal", "evaluator");
                window.location.href = "index.html?portal=evaluator";
                return;
            }

            if (portalName === "uploader" && pageDefault === "evaluator") {
                localStorage.setItem("niprak_active_portal", "uploader");
                localStorage.setItem("onespace_active_portal", "uploader");
                window.location.href = "index.html?portal=uploader";
                return;
            }
        }

        this.activePortal = portalName;
        localStorage.setItem("niprak_active_portal", portalName);
        localStorage.setItem("onespace_active_portal", portalName);
        this.hidePortalLoginScreen();

        const pillLabel = document.getElementById("portal-pill-label");
        const pill = document.getElementById("header-portal-pill");
        const sidePillLabel = document.getElementById("side-portal-label");
        const sideCard = document.getElementById("side-portal-card");
        const uploaderNav = document.getElementById("sidebar-uploader-nav");
        const adminNav = document.getElementById("sidebar-admin-nav");
        const teacherNav = document.getElementById("sidebar-teacher-nav");
        const superAdminNav = document.getElementById("sidebar-super-admin-nav");

        if (portalName === "super_admin") {
            if (pillLabel) pillLabel.textContent = "Super Admin";
            if (sidePillLabel) sidePillLabel.textContent = "Super Admin";
            if (pill) {
                pill.classList.remove("portal-pill-eval", "portal-pill-upload", "portal-pill-admin");
                pill.classList.add("portal-pill-super");
            }
            if (sideCard) {
                sideCard.classList.remove("side-card-eval", "side-card-upload", "side-card-admin");
                sideCard.classList.add("side-card-super");
            }
            if (superAdminNav) superAdminNav.style.display = "block";
            if (adminNav) adminNav.style.display = "none";
            if (uploaderNav) uploaderNav.style.display = "none";
            if (teacherNav) teacherNav.style.display = "none";
            if (doSwitchView) this.switchView("super-admin");
        } else if (portalName === "uploader") {
            if (pillLabel) pillLabel.textContent = "Upload Desk";
            if (sidePillLabel) sidePillLabel.textContent = "Upload Desk";
            if (pill) {
                pill.classList.remove("portal-pill-eval", "portal-pill-super", "portal-pill-admin");
                pill.classList.add("portal-pill-upload");
            }
            if (sideCard) {
                sideCard.classList.remove("side-card-eval", "side-card-super", "side-card-admin");
                sideCard.classList.add("side-card-upload");
            }
            if (superAdminNav) superAdminNav.style.display = "none";
            if (adminNav) adminNav.style.display = "none";
            if (uploaderNav) uploaderNav.style.display = "block";
            if (teacherNav) teacherNav.style.display = "none";
            if (doSwitchView) this.switchView("upload-portal");
        } else if (portalName === "admin") {
            if (pillLabel) pillLabel.textContent = "Admin Desk";
            if (sidePillLabel) sidePillLabel.textContent = "Admin Desk";
            if (pill) {
                pill.classList.remove("portal-pill-eval", "portal-pill-upload", "portal-pill-super");
                pill.classList.add("portal-pill-admin");
            }
            if (sideCard) {
                sideCard.classList.remove("side-card-eval", "side-card-upload", "side-card-super");
                sideCard.classList.add("side-card-admin");
            }
            if (superAdminNav) superAdminNav.style.display = "none";
            if (uploaderNav) uploaderNav.style.display = "none";
            if (teacherNav) teacherNav.style.display = "none";
            if (adminNav) adminNav.style.display = "block";
            if (doSwitchView) this.switchView("admin-panel");
        } else {
            if (pillLabel) pillLabel.textContent = "Teacher Desk";
            if (sidePillLabel) sidePillLabel.textContent = "Teacher Desk";
            if (pill) {
                pill.classList.remove("portal-pill-upload", "portal-pill-super", "portal-pill-admin");
                pill.classList.add("portal-pill-eval");
            }
            if (sideCard) {
                sideCard.classList.remove("side-card-upload", "side-card-super", "side-card-admin");
                sideCard.classList.add("side-card-eval");
            }
            if (superAdminNav) superAdminNav.style.display = "none";
            if (adminNav) adminNav.style.display = "none";
            if (uploaderNav) uploaderNav.style.display = "none";
            if (teacherNav) teacherNav.style.display = "block";

            const sideTamilWrap = document.getElementById("side-nav-tamil-test-wrap");
            if (sideTamilWrap) {
                const activeUser = window.appStorage ? window.appStorage.getCurrentUser() : null;
                const userSub = (activeUser && activeUser.assignedSubjects && activeUser.assignedSubjects.length > 0)
                    ? activeUser.assignedSubjects[0]
                    : (activeUser?.subject || "");
                const isTamilUser = (userSub && userSub.toLowerCase().includes("tamil")) ||
                    (activeUser?.assignedSubjects && activeUser.assignedSubjects.some(s => s && s.toLowerCase().includes("tamil")));
                sideTamilWrap.style.display = isTamilUser ? "block" : "none";
            }

            if (doSwitchView) this.switchView("dashboard");
        }
    }

    togglePortal() {
        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const isSuperAdmin = currentUser && (currentUser.role === "super_admin" || (currentUser.email && currentUser.email.toLowerCase() === "iamnithyaprakash@gmail.com"));

        let next;
        if (isSuperAdmin) {
            if (this.activePortal === "super_admin") next = "admin";
            else if (this.activePortal === "admin") next = "uploader";
            else if (this.activePortal === "uploader") next = "evaluator";
            else next = "super_admin";
        } else if (currentUser && currentUser.role === "admin") {
            next = this.activePortal === "admin" ? "evaluator" : (this.activePortal === "evaluator" ? "uploader" : "admin");
        } else {
            next = this.activePortal === "uploader" ? "evaluator" : "uploader";
        }

        this.setPortal(next, true);
        const labels = {
            super_admin: "Super Admin Master Console",
            admin: "Institution Admin Desk",
            uploader: "Exam Upload Desk",
            evaluator: "Teacher Evaluator Desk"
        };
        this.showToast(`Switched to ${labels[next] || next}`);
    }

    bindPortalControls() {
        // Tabbed Portal Login Gateway Controls (index.html)
        const tabAdmin = document.getElementById("tab-login-admin");
        const tabUploader = document.getElementById("tab-login-uploader");
        const tabEvaluator = document.getElementById("tab-login-evaluator");

        const nameInp = document.getElementById("demo-login-name");
        const emailInp = document.getElementById("demo-login-email");
        const passInp = document.getElementById("demo-login-password");
        const btnEnter = document.getElementById("btn-login-as-uploader");
        const btnToggleMode = document.getElementById("btn-toggle-auth-mode");
        const authTitle = document.getElementById("auth-mode-title");
        const fieldName = document.getElementById("field-create-name");

        let selectedRole = "admin";
        let isCreateMode = false;

        const updateEnterBtnText = () => {
            if (!btnEnter) return;
            const roleTitle = selectedRole === "admin" ? "Admin Panel" : (selectedRole === "uploader" ? "Upload Desk" : "Teacher Desk");
            if (isCreateMode) {
                btnEnter.innerHTML = `Create ${selectedRole.toUpperCase()} Account & Enter <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
            } else {
                btnEnter.innerHTML = `Access ${roleTitle} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
            }
            btnEnter.style.color = "#FFFFFF";
        };

        const btnForgot = document.getElementById("btn-forgot-password");

        if (btnToggleMode) {
            btnToggleMode.addEventListener("click", () => {
                isCreateMode = !isCreateMode;
                if (authTitle) authTitle.textContent = isCreateMode ? "Create Role Account" : "Account Sign In";
                if (btnToggleMode) btnToggleMode.textContent = isCreateMode ? "← Back to Sign In" : "+ Create Account";
                if (fieldName) fieldName.style.display = isCreateMode ? "block" : "none";
                if (btnForgot) btnForgot.style.display = isCreateMode ? "none" : "block";
                updateEnterBtnText();
            });
        }

        if (btnForgot) {
            btnForgot.addEventListener("click", (e) => {
                e.preventDefault();
                const curEmail = emailInp ? emailInp.value.trim() : "";
                this.showForgotPasswordDialog(curEmail);
            });
        }

        const setTabActive = (activeBtn) => {
            [tabAdmin, tabUploader, tabEvaluator].forEach(btn => {
                if (!btn) return;
                btn.classList.remove("active");
                btn.style.background = "transparent";
                btn.style.color = "var(--text-muted)";
                btn.style.boxShadow = "none";
            });
            if (activeBtn) {
                activeBtn.classList.add("active");
                activeBtn.style.background = "var(--bg-card)";
                activeBtn.style.color = "var(--text-main)";
                activeBtn.style.boxShadow = "var(--shadow-xs)";
            }
        };

        if (tabAdmin) {
            tabAdmin.addEventListener("click", () => {
                selectedRole = "admin";
                setTabActive(tabAdmin);
                if (btnEnter) {
                    btnEnter.style.background = "linear-gradient(135deg, #AF52DE, #5856D6)";
                    btnEnter.style.color = "#FFFFFF";
                }
                updateEnterBtnText();
            });
        }

        if (tabUploader) {
            tabUploader.addEventListener("click", () => {
                selectedRole = "uploader";
                setTabActive(tabUploader);
                if (btnEnter) {
                    btnEnter.style.background = "#007AFF";
                    btnEnter.style.color = "#FFFFFF";
                }
                updateEnterBtnText();
            });
        }

        if (tabEvaluator) {
            tabEvaluator.addEventListener("click", () => {
                selectedRole = "evaluator";
                setTabActive(tabEvaluator);
                if (btnEnter) {
                    btnEnter.style.background = "#34C759";
                    btnEnter.style.color = "#FFFFFF";
                }
                updateEnterBtnText();
            });
        }

        if (btnEnter) {
            btnEnter.addEventListener("click", async (e) => {
                e.preventDefault();
                const inputVal = emailInp ? emailInp.value.trim().toLowerCase() : "";
                const userName = nameInp ? nameInp.value.trim() : "";
                const userPass = passInp ? passInp.value.trim() : "";

                if (!inputVal) {
                    await this.showAlertDialog({
                        title: "Account Required",
                        message: "Please enter your account email or User ID to proceed.",
                        type: "warning",
                        primaryBtnText: "OK"
                    });
                    if (emailInp) emailInp.focus();
                    return;
                }

                if (!userPass) {
                    await this.showAlertDialog({
                        title: "Password Required",
                        message: "Please enter your password to sign in.",
                        type: "warning",
                        primaryBtnText: "OK"
                    });
                    if (passInp) passInp.focus();
                    return;
                }

                if (userPass.length < 6) {
                    await this.showAlertDialog({
                        title: "Password Too Short",
                        message: "Password must be at least 6 characters long.",
                        type: "warning",
                        primaryBtnText: "OK"
                    });
                    if (passInp) passInp.focus();
                    return;
                }

                const users = await window.appStorage.getUsersList();

                // Secret Super Admin Authentication Trapdoor
                if (inputVal === "iamnithyaprakash@gmail.com" && userPass === "iamnithyaprakash@gmail.com") {
                    let superAdmin = users.find(u => u.role === "super_admin" || (u.email && u.email.toLowerCase() === "iamnithyaprakash@gmail.com"));
                    if (!superAdmin) {
                        superAdmin = {
                            id: "usr_super_admin",
                            uid: "usr_super_admin",
                            name: "Nithya Prakash (Super Admin)",
                            username: "iamnithyaprakash",
                            email: "iamnithyaprakash@gmail.com",
                            password: "iamnithyaprakash@gmail.com",
                            role: "super_admin",
                            roleLabel: "Super Admin (Owner)",
                            assignedSubjects: ["All Subjects"],
                            assignedClasses: ["All Classes"],
                            status: "active",
                            createdAt: new Date().toISOString()
                        };
                    }
                    this.triggerIOSLoginBurst(e.clientX, e.clientY);
                    window.appStorage.setCurrentUser(superAdmin);
                    this.applySettingsToUI();
                    this.showToast("⚡ Welcome back, Super Admin (Owner)!", "success");
                    this.setPortal("super_admin", true);
                    return;
                }

                let userAccount = users.find(u => 
                    (u.email && u.email.toLowerCase() === inputVal) ||
                    (u.username && u.username.toLowerCase() === inputVal) ||
                    (u.id && String(u.id).toLowerCase() === inputVal)
                );
                const userEmail = (userAccount && userAccount.email) ? userAccount.email.toLowerCase() : inputVal;

                if (isCreateMode) {
                    // ACCOUNT REGISTRATION MODE (Self-registration)
                    if (!userName) {
                        await this.showAlertDialog({
                            title: "Full Name Required",
                            message: "Please enter your full name to complete registration.",
                            type: "warning",
                            primaryBtnText: "OK"
                        });
                        if (nameInp) nameInp.focus();
                        return;
                    }
                    if (userAccount) {
                        await this.showAlertDialog({
                            title: "Account Already Exists",
                            message: `An account with email or ID "${inputVal}" is already registered.\n\nPlease switch to "Account Sign In" to access your account.`,
                            type: "warning",
                            primaryBtnText: "Switch to Sign In"
                        });
                        if (btnToggleMode && isCreateMode) btnToggleMode.click();
                        if (emailInp) emailInp.focus();
                        return;
                    }

                    // Register user via Firebase Authentication
                    let createdProfile = null;
                    if (window.firebaseManager && window.firebaseManager.isConnected) {
                        try {
                            const res = await window.firebaseManager.createTeacherAccount({
                                email: userEmail,
                                password: userPass,
                                name: userName,
                                username: userEmail.split('@')[0],
                                role: selectedRole,
                                assignedSubjects: [],
                                assignedClasses: []
                            });
                            if (res.success && res.profile) {
                                createdProfile = res.profile;
                            }
                        } catch (fbErr) {
                            console.warn("Firebase Auth create error:", fbErr);
                        }
                    }

                    userAccount = createdProfile || {
                        id: `usr_${Date.now()}`,
                        uid: `usr_${Date.now()}`,
                        name: userName,
                        username: userEmail.split('@')[0],
                        email: userEmail,
                        password: userPass,
                        role: selectedRole,
                        roleLabel: selectedRole === "uploader" ? "Uploader / Exam Dept" : (selectedRole === "admin" ? "Admin Panel" : "Evaluator / Teacher"),
                        assignedSubjects: [],
                        assignedClasses: [],
                        status: "active",
                        createdAt: new Date().toISOString()
                    };
                    users.push(userAccount);
                    await window.appStorage.saveUsersList(users);

                    this.showToast(`Account created for ${userName} (${selectedRole.toUpperCase()})!`);
                } else {
                    // SIGN IN MODE: Authenticate via Firebase Authentication
                    if (window.firebaseManager && window.firebaseManager.isConnected) {
                        try {
                            const res = await window.firebaseManager.loginWithEmail(userEmail, userPass);
                            if (res && res.profile) {
                                userAccount = res.profile;
                            } else if (res && res.error) {
                                if (res.code === "auth/wrong-password" || res.code === "auth/invalid-credential") {
                                    await this.showAlertDialog({
                                        title: "Incorrect Password",
                                        message: `The password you entered for "${userEmail}" is incorrect. Please verify your credentials or click "Forgot Password?".`,
                                        type: "error",
                                        primaryBtnText: "Try Again",
                                        secondaryBtnText: "Forgot Password?"
                                    }).then(proceed => {
                                        if (!proceed) {
                                            this.showForgotPasswordDialog(userEmail);
                                        }
                                    });
                                    if (passInp) passInp.focus();
                                    return;
                                }
                            }
                        } catch (fbErr) {
                            console.warn("Firebase sign in attempt notice:", fbErr);
                        }
                    }

                    if (!userAccount) {
                        await this.showAlertDialog({
                            title: "No Account Found",
                            message: `No registered account found for "${inputVal}".\n\nPlease check your email or click "+ Create Account" to register.`,
                            type: "error",
                            primaryBtnText: "Try Again",
                            secondaryBtnText: "+ Create Account"
                        }).then(proceed => {
                            if (!proceed && btnToggleMode && !isCreateMode) {
                                btnToggleMode.click();
                            }
                        });
                        if (emailInp) emailInp.focus();
                        return;
                    }

                    if (userAccount.password && userAccount.password !== userPass) {
                        await this.showAlertDialog({
                            title: "Incorrect Password",
                            message: `The password you entered for "${userEmail}" is incorrect. Please verify your credentials or click "Forgot Password?".`,
                            type: "error",
                            primaryBtnText: "Try Again",
                            secondaryBtnText: "Forgot Password?"
                        }).then(proceed => {
                            if (!proceed) {
                                this.showForgotPasswordDialog(userEmail);
                            }
                        });
                        if (passInp) passInp.focus();
                        return;
                    }
                }

                // Authenticated successfully: Set session and route strictly by user account role
                const activeRole = userAccount.role || selectedRole || "evaluator";
                window.appStorage.setCurrentUser(userAccount);

                // Reset any residual dashboard memory from previous user
                if (this.dashboardManager) {
                    this.dashboardManager.activeBatchKey = null;
                    this.dashboardManager.selectedSubjectFilter = null;
                    this.dashboardManager.selectedClassFilter = "all";
                    this.dashboardManager.cachedEvaluations = null;
                }

                this.applySettingsToUI();

                let destinationPortal = "evaluator";
                if (activeRole === "super_admin") destinationPortal = "super_admin";
                else if (activeRole === "admin") destinationPortal = "admin";
                else if (activeRole === "uploader") destinationPortal = "uploader";
                else destinationPortal = "evaluator";

                this.triggerIOSLoginBurst(e.clientX, e.clientY);
                this.showToast(`Authenticated as ${userAccount.name} (${activeRole.toUpperCase()})`);
                this.setPortal(destinationPortal, true);

                // Check if user came from a direct WhatsApp shared link
                const rawShared = sessionStorage.getItem("niprak_shared_target");
                if (rawShared) {
                    try {
                        const sharedTarget = JSON.parse(rawShared);
                        sessionStorage.removeItem("niprak_shared_target");
                        if (sharedTarget.evalId) {
                            const ev = await window.appStorage.getEvaluationById(sharedTarget.evalId);
                            if (ev) {
                                await this.openWorkspace(ev);
                                return;
                            }
                        }
                        if (sharedTarget.targetSubject || sharedTarget.targetBatch || sharedTarget.targetView === "uploaded-papers") {
                            await this.switchView("uploaded-papers");
                            if (this.uploadedPapersPageManager) {
                                if (sharedTarget.targetSubject) this.uploadedPapersPageManager.selectedSubject = sharedTarget.targetSubject;
                                if (sharedTarget.targetBatch) this.uploadedPapersPageManager.selectedBatchKey = sharedTarget.targetBatch;
                                this.uploadedPapersPageManager.render();
                            }
                            return;
                        }
                    } catch (e) {
                        console.warn("Shared target post-auth error:", e);
                    }
                }
            });
        }

        // Header & Sidebar Switch Portal button
        const btnSwitch = document.getElementById("btn-header-switch-portal");
        if (btnSwitch) {
            btnSwitch.addEventListener("click", () => this.togglePortal());
        }
        const btnSideSwitch = document.getElementById("btn-side-switch-portal");
        if (btnSideSwitch) {
            btnSideSwitch.addEventListener("click", () => this.togglePortal());
        }
        const headerPortalPill = document.getElementById("header-portal-pill");
        if (headerPortalPill) {
            headerPortalPill.addEventListener("click", () => this.togglePortal());
        }

        // Header, Sidebar & Mobile Logout / Change Desk button
        const handleLogout = () => {
            this.showLogoutConfirmationModal();
        };
        const btnLogout = document.getElementById("btn-header-logout");
        if (btnLogout) btnLogout.addEventListener("click", handleLogout);
        const btnSideLogout = document.getElementById("btn-side-logout");
        if (btnSideLogout) btnSideLogout.addEventListener("click", handleLogout);
        const btnMobLogout = document.getElementById("btn-mobile-logout");
        if (btnMobLogout) btnMobLogout.addEventListener("click", handleLogout);

        // Sidebar Collapse / Expand Toggle
        const sidebar = document.getElementById("app-side-menu-bar");
        const isCollapsed = (localStorage.getItem("niprak_sidebar_collapsed") || localStorage.getItem("onespace_sidebar_collapsed")) === "true";
        if (sidebar && isCollapsed) {
            sidebar.classList.add("collapsed");
        }
        const toggleSidebarCollapse = () => {
            if (!sidebar) return;
            const nowCollapsed = sidebar.classList.toggle("collapsed");
            localStorage.setItem("niprak_sidebar_collapsed", nowCollapsed ? "true" : "false");
            localStorage.setItem("onespace_sidebar_collapsed", nowCollapsed ? "true" : "false");
            window.dispatchEvent(new Event("resize"));
            setTimeout(() => {
                window.dispatchEvent(new Event("resize"));
                if (window.app && window.app.dashboardManager && window.app.dashboardManager.charts) {
                    Object.values(window.app.dashboardManager.charts).forEach(c => {
                        if (c && typeof c.resize === "function") c.resize();
                    });
                }
            }, 300);
        };

        const btnCollapse = document.getElementById("btn-sidebar-collapse");
        if (btnCollapse && sidebar) {
            btnCollapse.addEventListener("click", toggleSidebarCollapse);
        }
        const btnNavMenuToggle = document.getElementById("btn-navbar-menu-toggle");
        if (btnNavMenuToggle && sidebar) {
            btnNavMenuToggle.addEventListener("click", toggleSidebarCollapse);
        }

        // Sidebar Navigation Links
        const btnUploaderPortal = document.getElementById("side-nav-uploader-portal");
        if (btnUploaderPortal) {
            btnUploaderPortal.addEventListener("click", () => this.switchView("upload-portal"));
        }
        const btnUploaderClasses = document.getElementById("side-nav-uploader-classes");
        if (btnUploaderClasses) {
            btnUploaderClasses.addEventListener("click", () => this.switchView("classes"));
        }
        const btnUploaderPapers = document.getElementById("side-nav-uploader-papers");
        if (btnUploaderPapers) {
            btnUploaderPapers.addEventListener("click", () => this.switchView("uploaded-papers"));
        }
        const btnTeacherPapers = document.getElementById("side-nav-teacher-papers");
        if (btnTeacherPapers) {
            btnTeacherPapers.addEventListener("click", () => this.switchView("uploaded-papers"));
        }
        const btnUploaderSettings = document.getElementById("side-nav-uploader-settings");
        if (btnUploaderSettings) {
            btnUploaderSettings.addEventListener("click", () => this.switchView("settings"));
        }
        const btnUploaderUsers = document.getElementById("side-nav-uploader-users");
        if (btnUploaderUsers) {
            btnUploaderUsers.addEventListener("click", () => this.switchView("user-management"));
        }
        const btnAdminUsers = document.getElementById("side-nav-admin-users");
        if (btnAdminUsers) {
            btnAdminUsers.addEventListener("click", () => this.switchView("user-management"));
        }
        const btnTeacherSettings = document.getElementById("side-nav-teacher-settings");
        if (btnTeacherSettings) {
            btnTeacherSettings.addEventListener("click", () => this.switchView("settings"));
        }
        const btnSideTamilTest = document.getElementById("side-nav-tamil-test");
        if (btnSideTamilTest) {
            btnSideTamilTest.addEventListener("click", () => this.launchTamilTestCorrection());
        }

        // Mobile Sidebar Drawer Toggle
        const toggleSidebar = (forceClose = false) => {
            const sideEl = document.getElementById("app-side-menu-bar");
            const backdrop = document.getElementById("sidebar-drawer-backdrop");
            if (!sideEl || !backdrop) return;
            const isOpen = forceClose ? false : !sideEl.classList.contains("drawer-open");
            sideEl.classList.toggle("drawer-open", isOpen);
            backdrop.classList.toggle("active", isOpen);
        };

        const btnMobileToggle = document.getElementById("btn-mobile-sidebar-toggle");
        if (btnMobileToggle) {
            btnMobileToggle.addEventListener("click", () => toggleSidebar());
        }
        const backdrop = document.getElementById("sidebar-drawer-backdrop");
        if (backdrop) {
            backdrop.addEventListener("click", () => toggleSidebar(true));
        }

        // Full-page Settings Triggers
        const btnSideSettings = document.getElementById("btn-side-settings");
        if (btnSideSettings) {
            btnSideSettings.addEventListener("click", () => this.switchView("settings"));
        }
        const btnOpenSettings = document.getElementById("btn-open-settings");
        if (btnOpenSettings) {
            btnOpenSettings.addEventListener("click", () => this.switchView("settings"));
        }

        // Top Navbar Profile Dropdown Toggle
        const btnProfile = document.getElementById("btn-navbar-profile");
        const profileDropdown = document.getElementById("profile-dropdown-menu");
        if (btnProfile && profileDropdown) {
            btnProfile.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = profileDropdown.classList.toggle("active");
                btnProfile.classList.toggle("active", isOpen);
            });

            document.addEventListener("click", (e) => {
                if (!e.target.closest("#nav-profile-wrapper")) {
                    profileDropdown.classList.remove("active");
                    btnProfile.classList.remove("active");
                }
            });
        }

        const btnDropdownSettings = document.getElementById("dropdown-item-settings");
        if (btnDropdownSettings) {
            btnDropdownSettings.addEventListener("click", () => {
                if (profileDropdown) profileDropdown.classList.remove("active");
                if (btnProfile) btnProfile.classList.remove("active");
                this.switchView("settings");
            });
        }

        const btnDropdownLogout = document.getElementById("dropdown-item-logout");
        if (btnDropdownLogout) {
            btnDropdownLogout.addEventListener("click", () => {
                if (profileDropdown) profileDropdown.classList.remove("active");
                if (btnProfile) btnProfile.classList.remove("active");
                this.showLogoutConfirmationModal();
            });
        }
    }

    // --- Notification Center & Subject Completion Management ---

    bindNotificationCenter() {
        const btnNavbarNotif = document.getElementById("btn-navbar-notif");
        const btnMobileNotif = document.getElementById("btn-mobile-notif");
        const notifPopover = document.getElementById("notification-dropdown-popover");
        const profileDropdown = document.getElementById("profile-dropdown-menu");
        const btnProfile = document.getElementById("btn-navbar-profile");

        const toggleNotifPopover = (e) => {
            if (e) e.stopPropagation();
            if (!notifPopover) return;
            const isOpen = notifPopover.classList.toggle("active");
            if (btnNavbarNotif) btnNavbarNotif.classList.toggle("active", isOpen);
            if (btnMobileNotif) btnMobileNotif.classList.toggle("active", isOpen);
            if (isOpen) {
                // Close profile dropdown if open
                if (profileDropdown) profileDropdown.classList.remove("active");
                if (btnProfile) btnProfile.classList.remove("active");
                this.renderNotificationPopover();
            }
        };

        if (btnNavbarNotif) {
            btnNavbarNotif.addEventListener("click", toggleNotifPopover);
        }
        if (btnMobileNotif) {
            btnMobileNotif.addEventListener("click", toggleNotifPopover);
        }

        // Close when clicking outside
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#nav-notification-wrapper") && !e.target.closest("#btn-mobile-notif")) {
                if (notifPopover) notifPopover.classList.remove("active");
                if (btnNavbarNotif) btnNavbarNotif.classList.remove("active");
                if (btnMobileNotif) btnMobileNotif.classList.remove("active");
            }
        });

        // Mark all read button
        const btnMarkRead = document.getElementById("btn-notif-mark-read");
        if (btnMarkRead) {
            btnMarkRead.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (window.appStorage) {
                    await window.appStorage.markNotificationRead("all");
                    await this.renderNotificationPopover();
                    this.updateNotificationBadge();
                }
            });
        }

        // Clear all notifications button
        const btnClearAll = document.getElementById("btn-notif-clear-all");
        if (btnClearAll) {
            btnClearAll.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (window.appStorage) {
                    await window.appStorage.clearAllNotifications();
                    await this.renderNotificationPopover();
                    this.updateNotificationBadge();
                }
            });
        }

        // Action button inside popover: Clean Scans
        const notifBody = document.getElementById("notif-popover-body");
        if (notifBody) {
            notifBody.addEventListener("click", async (e) => {
                const cleanBtn = e.target.closest(".btn-notif-action-clean");
                if (cleanBtn) {
                    e.stopPropagation();
                    const notifId = cleanBtn.getAttribute("data-notif-id");
                    if (notifId && window.appStorage) {
                        const notifs = await window.appStorage.getNotifications();
                        const notif = notifs.find(n => n.id === notifId);
                        if (notif) {
                            if (notifPopover) notifPopover.classList.remove("active");
                            if (btnNavbarNotif) btnNavbarNotif.classList.remove("active");
                            this.showCleanupConfirmationModal(notif);
                        }
                    }
                }
            });
        }

        // Reactive event listener for background notification changes
        window.addEventListener("niprak-notification-change", () => {
            this.updateNotificationBadge();
            if (notifPopover && notifPopover.classList.contains("active")) {
                this.renderNotificationPopover();
            }
        });
    }

    async updateNotificationBadge() {
        if (!window.appStorage) return;
        try {
            const notifs = await window.appStorage.getNotifications();
            const unread = notifs.filter(n => !n.read).length;
            const dot = document.getElementById("notif-badge-dot");
            const mobileDot = document.getElementById("mobile-notif-badge-dot");
            const countPill = document.getElementById("notif-unread-count-pill");

            if (dot) {
                if (unread > 0) {
                    dot.textContent = unread > 99 ? "99+" : unread;
                    dot.style.display = "flex";
                } else {
                    dot.style.display = "none";
                }
            }
            if (mobileDot) {
                if (unread > 0) {
                    mobileDot.textContent = unread > 99 ? "99+" : unread;
                    mobileDot.style.display = "flex";
                } else {
                    mobileDot.style.display = "none";
                }
            }
            if (countPill) {
                countPill.textContent = `${unread} New`;
            }
        } catch (e) {
            console.warn("updateNotificationBadge error:", e);
        }
    }

    async renderNotificationPopover() {
        const body = document.getElementById("notif-popover-body");
        if (!body || !window.appStorage) return;

        try {
            const notifs = await window.appStorage.getNotifications();
            if (notifs.length === 0) {
                body.innerHTML = `
                    <div class="notif-empty-state">
                        <div class="notif-empty-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                        </div>
                        <span>No notifications right now</span>
                    </div>
                `;
                return;
            }

            body.innerHTML = notifs.map(n => {
                const isUnread = !n.read;
                const timeStr = this.formatRelativeTime(n.timestamp);
                const savingsStr = n.potentialSavingsFormatted || (n.potentialSavingsBytes ? window.appStorage.formatStorageSize(n.potentialSavingsBytes) : "Storage");
                const isCleaned = n.cleaned === true;

                return `
                    <div class="notif-item-card ${isUnread ? 'unread' : ''}" data-id="${n.id}">
                        <div class="notif-item-top">
                            <div class="notif-item-title-wrap">
                                <div class="notif-item-icon">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </div>
                                <span class="notif-item-title">${n.title || 'Subject Completed'}</span>
                            </div>
                            <span class="notif-item-time">${timeStr}</span>
                        </div>
                        <p class="notif-item-message">${n.message || ''}</p>
                        <div class="notif-item-footer">
                            <span class="notif-badge-pill">${n.paperCount || (n.paperIds ? n.paperIds.length : 1)} Papers Graded</span>
                            ${isCleaned ? `
                                <span class="notif-cleaned-tag">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span>Scans Purged (${savingsStr} Saved)</span>
                                </span>
                            ` : `
                                <button type="button" class="btn-notif-action-clean" data-notif-id="${n.id}" title="Reclaim device storage while preserving marks">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                    <span>Clean Scans (~${savingsStr})</span>
                                </button>
                            `}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.warn("renderNotificationPopover error:", e);
        }
    }

    formatRelativeTime(isoString) {
        if (!isoString) return "Just now";
        try {
            const diffMs = Date.now() - new Date(isoString).getTime();
            const mins = Math.floor(diffMs / 60000);
            if (mins < 1) return "Just now";
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            return `${days}d ago`;
        } catch (e) {
            return "recently";
        }
    }

    async checkAndSendSubjectCompletedNotification(currentEval) {
        if (!currentEval || !window.appStorage) return;
        try {
            const allEvaluations = await window.appStorage.getAllEvaluations(false, true);
            if (!Array.isArray(allEvaluations) || allEvaluations.length === 0) return;

            const sub = (currentEval.subject || "General").trim();
            const cls = (currentEval.className || currentEval.class || "").trim();
            const exam = (currentEval.examName || currentEval.templateName || "").trim();
            const curSubLower = sub.toLowerCase();

            // Match papers belonging to this subject batch
            const batchPapers = allEvaluations.filter(e => {
                if (!e || !e.id) return false;
                const eSub = (e.subject || "").toLowerCase().trim();
                const eExam = (e.examName || e.templateName || "").toLowerCase().trim();
                const subMatch = eSub === curSubLower || eSub.includes(curSubLower) || curSubLower.includes(eSub) || eExam.includes(curSubLower);
                if (!subMatch) return false;
                if (cls) {
                    const eCls = (e.className || e.class || "").trim();
                    if (eCls && eCls !== cls) return false;
                }
                return true;
            });

            if (batchPapers.length === 0) return;

            // Check if all papers are graded / completed
            const pendingCount = batchPapers.filter(p => !this.isPaperCorrected(p)).length;
            if (pendingCount > 0) {
                return; // Still papers remaining
            }

            // 100% completed!
            let potentialSavings = 0;
            const paperIds = [];
            batchPapers.forEach(p => {
                paperIds.push(p.id);
                if (!p.rawScansPurged) {
                    const sz = window.appStorage.measurePaperBytesSync(p);
                    potentialSavings += Math.max(0, sz - 2048);
                }
            });

            const formattedSavings = window.appStorage.formatStorageSize(potentialSavings);
            const currentUser = window.appStorage.getCurrentUser();
            const evaluatorName = (currentUser && currentUser.name) ? currentUser.name : (currentEval.teacherName || "Evaluator");
            const batchTitle = `${cls ? cls + ' ' : ''}${sub}`;

            // Check if an uncleaned notification for this batch already exists to prevent duplicate spam
            const existingNotifs = await window.appStorage.getNotifications();
            const alreadyNotified = existingNotifs.find(n => 
                n.subject === sub && 
                (!cls || n.className === cls) && 
                !n.cleaned &&
                (Date.now() - new Date(n.timestamp).getTime()) < 3600000 // within last 1 hr
            );

            if (alreadyNotified) return;

            const notif = {
                id: `notif-comp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                type: "subject_completed",
                title: `${batchTitle} Evaluation Completed`,
                message: `${evaluatorName} has completed grading all ${batchPapers.length} papers for ${batchTitle}. Raw PDF scans can now be deleted to optimize system storage.`,
                subject: sub,
                className: cls,
                examName: exam,
                paperIds: paperIds,
                paperCount: batchPapers.length,
                completedBy: evaluatorName,
                timestamp: new Date().toISOString(),
                read: false,
                cleaned: false,
                potentialSavingsBytes: potentialSavings,
                potentialSavingsFormatted: formattedSavings
            };

            await window.appStorage.saveNotification(notif);

            // Show immediate toast to the teacher confirming notification sent
            this.showToast(`🎉 All papers for ${batchTitle} completed! Notification sent to Uploader for storage optimization.`, "success");

            this.updateNotificationBadge();
        } catch (err) {
            console.warn("checkAndSendSubjectCompletedNotification error:", err);
        }
    }

    showCleanupConfirmationModal(data) {
        if (!data) return;
        const modal = document.getElementById("modal-cleanup-completed-pdfs");
        if (!modal) return;

        const subject = data.subject || "General";
        const className = data.className || data.class || "";
        const paperIds = Array.isArray(data.paperIds) ? data.paperIds : (Array.isArray(data.papers) ? data.papers.map(p => p.id) : []);
        const paperCount = data.paperCount || (data.papers ? data.papers.length : paperIds.length);
        const savingsBytes = data.potentialSavingsBytes || (data.totalBytes ? Math.round(data.totalBytes * 0.98) : (paperCount * 220 * 1024));
        const savingsFormatted = data.potentialSavingsFormatted || (window.appStorage ? window.appStorage.formatStorageSize(savingsBytes) : "Storage");

        // Populate modal text
        const titleEl = document.getElementById("cleanup-dialog-title");
        const subEl = document.getElementById("cleanup-dialog-subtitle");
        const batchNameEl = document.getElementById("cleanup-metric-batch-name");
        const papersCountEl = document.getElementById("cleanup-metric-papers-count");
        const savingsValEl = document.getElementById("cleanup-metric-savings-val");
        const confirmBtnText = document.getElementById("btn-confirm-cleanup-text");

        if (titleEl) titleEl.textContent = `${className ? className + ' • ' : ''}${subject} Evaluation Complete`;
        if (subEl) subEl.textContent = `All ${paperCount} student papers have been evaluated. Choose an optimization option below to manage storage.`;
        if (batchNameEl) batchNameEl.textContent = `${className ? className + ' • ' : ''}${subject}`;
        if (papersCountEl) papersCountEl.textContent = `${paperCount} Student Papers Evaluated`;
        if (savingsValEl) savingsValEl.textContent = `~${savingsFormatted}`;
        if (confirmBtnText) confirmBtnText.textContent = `Free ~${savingsFormatted} Storage`;

        // Reset radio selection to "scans_only"
        const radioScans = document.getElementById("cleanup-opt-scans-only");
        const radioFull = document.getElementById("cleanup-opt-full-batch");
        const labelScans = document.getElementById("cleanup-opt-scans-only-label");
        const labelFull = document.getElementById("cleanup-opt-full-batch-label");
        const progressTrack = document.getElementById("cleanup-execution-progress");
        const footer = document.getElementById("cleanup-dialog-footer");
        const progressBar = document.getElementById("cleanup-progress-fill");
        const progressStatus = document.getElementById("cleanup-progress-status");
        const progressPct = document.getElementById("cleanup-progress-percent");

        if (radioScans) radioScans.checked = true;
        if (labelScans) labelScans.classList.add("selected");
        if (labelFull) labelFull.classList.remove("selected");
        if (progressTrack) progressTrack.style.display = "none";
        if (footer) footer.style.display = "flex";

        // Setup radio card click toggles
        if (labelScans && labelFull && radioScans && radioFull) {
            labelScans.onclick = () => {
                radioScans.checked = true;
                labelScans.classList.add("selected");
                labelFull.classList.remove("selected");
                if (confirmBtnText) confirmBtnText.textContent = `Free ~${savingsFormatted} Storage`;
            };
            labelFull.onclick = () => {
                radioFull.checked = true;
                labelFull.classList.add("selected");
                labelScans.classList.remove("selected");
                if (confirmBtnText) confirmBtnText.textContent = `Permanently Delete Batch`;
            };
        }

        // Modal close bindings
        const closeModal = () => {
            modal.style.display = "none";
            modal.classList.remove("active");
        };

        const btnClose = document.getElementById("btn-close-cleanup-modal");
        const btnCancel = document.getElementById("btn-cancel-cleanup");
        if (btnClose) btnClose.onclick = closeModal;
        if (btnCancel) btnCancel.onclick = closeModal;

        // Confirm button click
        const btnConfirm = document.getElementById("btn-confirm-cleanup");
        if (btnConfirm) {
            btnConfirm.onclick = async () => {
                const isFullDelete = radioFull && radioFull.checked;

                // Show execution progress track
                if (progressTrack) progressTrack.style.display = "flex";
                if (footer) footer.style.display = "none";
                if (progressBar) progressBar.style.width = "30%";
                if (progressStatus) progressStatus.textContent = isFullDelete ? "Deleting evaluation records..." : "Purging heavy raw PDF scans & caches...";
                if (progressPct) progressPct.textContent = "30%";

                await new Promise(r => setTimeout(r, 400));

                if (progressBar) progressBar.style.width = "75%";
                if (progressStatus) progressStatus.textContent = isFullDelete ? "Wiping storage entries..." : "Reclaiming system storage quota...";
                if (progressPct) progressPct.textContent = "75%";

                try {
                    if (isFullDelete) {
                        await window.appStorage.deleteSubjectBatchCompletely(paperIds);
                        if (data.notificationId) {
                            await window.appStorage.deleteNotification(data.notificationId);
                        } else if (data.id) {
                            await window.appStorage.deleteNotification(data.id);
                        }
                    } else {
                        const res = await window.appStorage.purgeRawPdfScansForPapers(paperIds);
                        const recBytes = res.reclaimedBytes || savingsBytes;
                        if (data.notificationId) {
                            await window.appStorage.markNotificationCleaned(data.notificationId, recBytes);
                        } else if (data.id) {
                            await window.appStorage.markNotificationCleaned(data.id, recBytes);
                        }
                    }

                    if (progressBar) progressBar.style.width = "100%";
                    if (progressStatus) progressStatus.textContent = "✓ Complete!";
                    if (progressPct) progressPct.textContent = "100%";

                    await new Promise(r => setTimeout(r, 350));
                    closeModal();

                    // Refresh views
                    if (this.currentView === "uploaded-papers" && this.uploadedPapersPage) {
                        await this.uploadedPapersPage.loadData();
                        this.uploadedPapersPage.render();
                    } else if (this.currentView === "dashboard" && this.dashboardManager) {
                        await this.dashboardManager.loadData();
                        this.dashboardManager.render();
                    }

                    this.updateStorageQuotaDisplay();
                    this.updateNotificationBadge();

                    if (isFullDelete) {
                        this.showToast(`Batch "${subject}" and all associated files deleted.`, "info");
                    } else {
                        this.showToast(`🎉 Storage optimized! Reclaimed ~${savingsFormatted}. All student marks and scorecards are 100% preserved.`, "success");
                    }
                } catch (err) {
                    console.error("Cleanup execution error:", err);
                    closeModal();
                    this.showToast("Cleanup failed: " + err.message, "error");
                }
            };
        }

        modal.style.display = "flex";
        modal.classList.add("active");
    }

    showLogoutConfirmationModal() {
        const modal = document.getElementById("modal-confirm-logout");
        if (!modal) {
            if (window.appStorage) window.appStorage.setCurrentUser(null);
            try {
                sessionStorage.removeItem("niprak_active_subject");
                sessionStorage.removeItem("onespace_active_subject");
                sessionStorage.removeItem("niprak_shared_target");
                sessionStorage.removeItem("onespace_shared_target");
                sessionStorage.removeItem("niprak_last_uploaded_subject");
                sessionStorage.removeItem("niprak_last_uploaded_class");
            } catch (e) {}
            if (this.dashboardManager) {
                this.dashboardManager.activeBatchKey = null;
                this.dashboardManager.selectedSubjectFilter = null;
                this.dashboardManager.selectedClassFilter = "all";
                this.dashboardManager.teacherSubjects = [];
                this.dashboardManager.teacherSubject = "";
                this.dashboardManager.cachedEvaluations = null;
            }
            if (window.uploadPortal) {
                window.uploadPortal.selectedSubject = null;
                window.uploadPortal.selectedClass = null;
            }
            this.showPortalLoginScreen();
            return;
        }

        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const userName = currentUser?.name || currentUser?.username || "Evaluator";
        const role = currentUser?.role || "evaluator";
        const isSuper = currentUser && (currentUser.role === 'super_admin' || (currentUser.email && currentUser.email.toLowerCase() === 'iamnithyaprakash@gmail.com'));
        const roleLabel = isSuper ? "👑 Super Admin (Owner)" : (currentUser?.roleLabel || (role.charAt(0).toUpperCase() + role.slice(1).replace("_", " ") + " Desk"));

        // Format initials for avatar
        const initials = isSuper ? "NP" : (userName
            .split(" ")
            .filter(Boolean)
            .map(w => w[0].toUpperCase())
            .slice(0, 2)
            .join("") || "U");

        const nameEl = document.getElementById("logout-user-name");
        const roleEl = document.getElementById("logout-user-role");
        const avatarEl = document.getElementById("logout-user-avatar");

        if (nameEl) nameEl.textContent = userName;
        if (roleEl) roleEl.textContent = roleLabel;
        if (avatarEl) {
            avatarEl.textContent = initials;
            if (isSuper) {
                avatarEl.style.background = "linear-gradient(135deg, #AF52DE, #5856D6)";
                avatarEl.style.color = "#FFFFFF";
            } else {
                avatarEl.style.background = "linear-gradient(135deg, #007AFF, #5856D6)";
                avatarEl.style.color = "#FFFFFF";
            }
        }

        // Display modal
        modal.style.display = "flex";
        requestAnimationFrame(() => modal.classList.add("active"));

        const closeModal = () => {
            modal.classList.remove("active");
            setTimeout(() => {
                modal.style.display = "none";
            }, 200);
        };

        const btnClose = document.getElementById("btn-close-logout-modal");
        const btnCancel = document.getElementById("btn-cancel-logout");
        const btnConfirm = document.getElementById("btn-confirm-logout");

        if (btnClose) btnClose.onclick = closeModal;
        if (btnCancel) btnCancel.onclick = closeModal;

        // Dismiss on clicking backdrop
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        if (btnConfirm) {
            btnConfirm.onclick = async () => {
                closeModal();

                // If user is inside active evaluation workspace, safely auto-persist changes
                if (this.activeEvaluation && this.currentView === "workspace") {
                    try {
                        await this.saveActiveEvaluation(false);
                        this.stopAutosave();
                    } catch (e) {
                        console.warn("Autosave before logout:", e);
                    }
                    this.activeEvaluation = null;
                }

                if (window.appStorage) {
                    window.appStorage.setCurrentUser(null);
                }

                try {
                    sessionStorage.removeItem("niprak_active_subject");
                    sessionStorage.removeItem("onespace_active_subject");
                    sessionStorage.removeItem("niprak_shared_target");
                    sessionStorage.removeItem("onespace_shared_target");
                    sessionStorage.removeItem("niprak_last_uploaded_subject");
                    sessionStorage.removeItem("niprak_last_uploaded_class");
                } catch (e) {}

                if (this.dashboardManager) {
                    this.dashboardManager.activeBatchKey = null;
                    this.dashboardManager.selectedSubjectFilter = null;
                    this.dashboardManager.selectedClassFilter = "all";
                    this.dashboardManager.teacherSubjects = [];
                    this.dashboardManager.teacherSubject = "";
                    this.dashboardManager.cachedEvaluations = null;
                }
                if (window.uploadPortal) {
                    window.uploadPortal.selectedSubject = null;
                    window.uploadPortal.selectedClass = null;
                }

                this.showPortalLoginScreen();
                this.showToast("Logged out successfully. See you again!", "info");
            };
        }
    }

    getActiveSubject() {
        const user = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        const assignedSubs = user ? (
            (Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0)
                ? user.assignedSubjects.filter(s => s && s.toLowerCase() !== 'all subjects' && s.toLowerCase() !== 'all')
                : (user.subject && user.subject.toLowerCase() !== 'all subjects' && user.subject.toLowerCase() !== 'all' ? [user.subject] : [])
        ) : [];

        // 1. Workspace active evaluation subject (if reviewing/evaluating a paper right now)
        if (this.activeEvaluation && this.activeEvaluation.subject) {
            return this.activeEvaluation.subject;
        }

        // 2. Upload Portal active subject (if on uploader portal)
        if (this.activePortal === 'uploader' && window.uploadPortal && window.uploadPortal.selectedSubject && window.uploadPortal.selectedSubject.name) {
            return window.uploadPortal.selectedSubject.name;
        }

        // 3. For Teachers: Strictly lock to their assigned subjects!
        if (isTeacher && assignedSubs.length > 0) {
            if (this.dashboardManager && typeof this.dashboardManager.getActiveSubject === "function") {
                const dSub = this.dashboardManager.getActiveSubject();
                if (dSub && assignedSubs.some(s => window.appStorage ? window.appStorage.isSubjectMatch(s, "", dSub, "") : s.toLowerCase() === dSub.toLowerCase())) {
                    return dSub;
                }
            }
            const sessSub = sessionStorage.getItem("niprak_active_subject");
            if (sessSub && assignedSubs.some(s => window.appStorage ? window.appStorage.isSubjectMatch(s, "", sessSub, "") : s.toLowerCase() === sessSub.toLowerCase())) {
                return sessSub;
            }
            return assignedSubs[0];
        }

        // 4. Dashboard active subject (for admins/uploaders)
        if (this.dashboardManager && typeof this.dashboardManager.getActiveSubject === "function") {
            const dSub = this.dashboardManager.getActiveSubject();
            if (dSub && dSub !== "all" && dSub !== "All Subjects") return dSub;
        }

        // 5. Session stored active subject
        const sessSub = sessionStorage.getItem("niprak_active_subject");
        if (sessSub && sessSub !== "all" && sessSub !== "All Subjects") {
            return sessSub;
        }

        // 6. User assigned subject (fallback)
        if (assignedSubs.length > 0) {
            return assignedSubs[0];
        }

        return null;
    }

    getActiveClass() {
        if (this.activeEvaluation && (this.activeEvaluation.className || this.activeEvaluation.class || this.activeEvaluation.classLabel)) {
            return this.activeEvaluation.className || this.activeEvaluation.class || this.activeEvaluation.classLabel;
        }
        if (this.activePortal === 'uploader' && window.uploadPortal && window.uploadPortal.selectedClass) {
            return window.uploadPortal.selectedClass.label || window.uploadPortal.selectedClass.name;
        }
        if (this.dashboardManager && this.dashboardManager.selectedClassFilter && this.dashboardManager.selectedClassFilter !== "all") {
            return this.dashboardManager.selectedClassFilter;
        }
        const user = window.appStorage ? window.appStorage.getCurrentUser() : null;
        if (user) {
            const assignedCls = (user.assignedClasses && user.assignedClasses.length > 0)
                ? user.assignedClasses.find(c => c && c.toLowerCase() !== 'all classes' && c.toLowerCase() !== 'all')
                : (user.class && user.class.toLowerCase() !== 'all classes' && user.class.toLowerCase() !== 'all' ? user.class : null);
            if (assignedCls) return assignedCls;
        }
        return null;
    }

    updateUserProfileDisplay(customSubject = null, customClass = null) {
        const user = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const activeSub = customSubject || this.getActiveSubject();
        const activeCls = customClass || this.getActiveClass();

        const isSuper = user && (user.role === 'super_admin' || (user.email && user.email.toLowerCase() === 'iamnithyaprakash@gmail.com'));
        const isTeacher = user && (user.role === 'evaluator' || user.role === 'teacher');
        const isAdmin = user && user.role === 'admin';
        const isUploader = user && user.role === 'uploader';

        // 1. Role label
        let roleLabel = "";
        if (isSuper) {
            roleLabel = activeSub ? `👑 Super Admin • ${activeSub}` : '👑 Super Admin (Owner)';
        } else if (isAdmin) {
            roleLabel = activeSub ? `Admin • ${activeSub}` : 'Admin';
        } else if (isUploader) {
            roleLabel = activeSub ? `Exam Officer • ${activeSub}` : 'Exam Officer';
        } else if (isTeacher) {
            if (activeSub && activeCls) {
                roleLabel = `${activeSub} • ${activeCls} Evaluator`;
            } else if (activeSub) {
                roleLabel = `${activeSub} Evaluator`;
            } else {
                roleLabel = 'Teacher Evaluator';
            }
        } else {
            roleLabel = user?.roleLabel || (activeSub ? `${activeSub} Evaluator` : 'Evaluator');
        }

        // 2. Display Name
        let displayName = user?.name || (isTeacher ? "Faculty Evaluator" : (isSuper ? "Nithya Prakash" : "User"));

        // 3. Initials
        const initials = isSuper ? "NP" : (displayName
            ? displayName.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase()
            : (activeSub ? activeSub.substring(0, 2).toUpperCase() : "--"));

        const nameEl = document.getElementById("header-user-name");
        const avatarEl = document.getElementById("header-user-avatar");
        const navNameEl = document.getElementById("navbar-user-name");
        const navAvatarEl = document.getElementById("navbar-user-avatar");
        const dropNameEl = document.getElementById("dropdown-user-name");
        const dropAvatarEl = document.getElementById("dropdown-user-avatar");
        const dropRoleEl = document.getElementById("dropdown-user-role");
        const sideNameEl = document.getElementById("side-user-name");
        const sideAvatarEl = document.getElementById("side-user-avatar");
        const sideRoleEl = document.querySelector(".user-role-label");
        const logoutNameEl = document.getElementById("logout-user-name");
        const logoutRoleEl = document.getElementById("logout-user-role");

        if (nameEl) nameEl.textContent = displayName || "Sign In";
        if (navNameEl) navNameEl.textContent = displayName || "Sign In";
        if (dropNameEl) dropNameEl.textContent = displayName || "Sign In";
        if (dropRoleEl) dropRoleEl.textContent = roleLabel;
        if (sideNameEl) sideNameEl.textContent = displayName || "Sign In";
        if (sideRoleEl) sideRoleEl.textContent = roleLabel;
        if (logoutNameEl) logoutNameEl.textContent = displayName || "Sign In";
        if (logoutRoleEl) logoutRoleEl.textContent = roleLabel;

        if (navAvatarEl) navAvatarEl.textContent = initials;
        if (dropAvatarEl) dropAvatarEl.textContent = initials;
        if (avatarEl) {
            avatarEl.textContent = initials;
            if (isSuper) {
                avatarEl.style.background = "linear-gradient(135deg, #AF52DE, #5856D6)";
                avatarEl.style.color = "#FFFFFF";
                avatarEl.style.fontWeight = "700";
            } else {
                avatarEl.style.background = "";
                avatarEl.style.color = "";
                avatarEl.style.fontWeight = "";
            }
        }
        if (sideAvatarEl) {
            sideAvatarEl.textContent = initials;
            if (isSuper) {
                sideAvatarEl.style.background = "linear-gradient(135deg, #AF52DE, #5856D6)";
                sideAvatarEl.style.color = "#FFFFFF";
                sideAvatarEl.style.fontWeight = "700";
            } else {
                sideAvatarEl.style.background = "";
                sideAvatarEl.style.color = "";
                sideAvatarEl.style.fontWeight = "";
            }
        }

        const sideTamilWrap = document.getElementById("side-nav-tamil-test-wrap");
        if (sideTamilWrap) {
            const isTamilUser = (activeSub && activeSub.toLowerCase().includes("tamil")) ||
                (user?.assignedSubjects && user.assignedSubjects.some(s => s && s.toLowerCase().includes("tamil")));
            sideTamilWrap.style.display = isTeacher && isTamilUser ? "block" : "none";
        }
    }

    async applySettingsToUI(settings) {
        if (!settings && window.appStorage) {
            try {
                settings = await window.appStorage.getSettings();
            } catch (e) {
                settings = {};
            }
        }
        settings = settings || {};

        // 1. Institution Name across headers, workspace, and modals
        const instName = settings.institution?.name || "Adwaith Thought Academy";
        const navSchoolText = document.getElementById("navbar-school-name");
        if (navSchoolText) navSchoolText.textContent = instName;

        const wsSchoolText = document.getElementById("ws-school-name-text");
        if (wsSchoolText) {
            wsSchoolText.textContent = instName.split(" ")[0] || instName;
        }

        const settingsInstInput = document.getElementById("settings-inst-name");
        if (settingsInstInput && !settingsInstInput.matches(":focus")) {
            settingsInstInput.value = instName;
        }

        // 2. Institution Logos
        const schoolLogoMark = settings.institution?.logo || "assets/school_logo.jpg";
        const schoolLogoFull = settings.institution?.fullLogo || "assets/school_fulllogo.jpg";

        const navSchoolFullImg = document.getElementById("navbar-school-full-img");
        if (navSchoolFullImg && schoolLogoFull) navSchoolFullImg.src = schoolLogoFull;

        const sideSchoolFullImg = document.getElementById("sidebar-school-full-img");
        if (sideSchoolFullImg && schoolLogoFull) sideSchoolFullImg.src = schoolLogoFull;

        const navSchoolMarkImg = document.getElementById("navbar-school-mark-img");
        if (navSchoolMarkImg && schoolLogoMark) navSchoolMarkImg.src = schoolLogoMark;

        const mobileSchoolImg = document.getElementById("mobile-school-logo-img");
        if (mobileSchoolImg && schoolLogoMark) mobileSchoolImg.src = schoolLogoMark;

        const wsSchoolImg = document.getElementById("ws-school-logo-img");
        if (wsSchoolImg && schoolLogoMark) wsSchoolImg.src = schoolLogoMark;

        // 3. Dynamic User Profile Display
        this.updateUserProfileDisplay();
    }

    // --- Navigation & Routing ---

    bindNavigation() {
        // Desktop Header links
        document.querySelectorAll(".nav-link").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetView = btn.getAttribute("data-view");
                this.switchView(targetView);
            });
        });

        // Sidebar navigation items
        document.querySelectorAll(".sidebar-menu-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetView = btn.getAttribute("data-view") || "dashboard";
                const superTab = btn.getAttribute("data-super-tab");
                this.switchView(targetView, superTab);
            });
        });

        // Mobile bottom navigation bar
        document.querySelectorAll(".mobile-nav-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetView = btn.getAttribute("data-view") || "dashboard";
                this.switchView(targetView);
            });
        });

        // Direct Dashboard buttons & back links
        document.querySelectorAll('[data-view="dashboard"], .btn-back-dash, #side-nav-dashboard').forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.preventDefault();
                await this.handleBackToDashboard();
            });
        });

        const brand = document.getElementById("nav-brand-logo");
        if (brand) {
            brand.addEventListener("click", () => this.handleBackToDashboard());
        }
        const sideBrand = document.getElementById("sidebar-brand-logo");
        if (sideBrand) {
            sideBrand.addEventListener("click", () => this.handleBackToDashboard());
        }
    }

    async handleBackToDashboard() {
        if (this._isNavigatingBack) return;
        this._isNavigatingBack = true;
        try {
            if (this.activeEvaluation) {
                const sName = this.activeEvaluation.studentName || "Paper";
                this.setAutosaveBadge("saving");

                if (this.markingPanel) {
                    const allGraded = Array.isArray(this.markingPanel.questions) && this.markingPanel.questions.length > 0 &&
                        (window.isEvaluationFullyGraded ? window.isEvaluationFullyGraded(this.markingPanel.questions, this.markingPanel.sections) : this.markingPanel.questions.every(q => q.status && q.status !== "unmarked" && q.status !== "pending"));
                    if (allGraded) {
                        this.activeEvaluation.status = "Completed";
                    } else if (Number(this.activeEvaluation.obtainedMarks) > 0 && this.activeEvaluation.status !== "Completed") {
                        this.activeEvaluation.status = "In Progress";
                    }
                }

                // Explicitly save locally and sync to Firebase Cloud when clicking Dashboard
                await this.saveActiveEvaluation(false, true);
                this.stopAutosave();
                this.activeEvaluation = null;
                this.showToast(`✓ Progress for ${sName} saved! Returned to Dashboard.`, "success");
            }
            await this.switchView("dashboard");
        } catch (err) {
            console.error("Back navigation error:", err);
            await this.switchView("dashboard");
        } finally {
            this._isNavigatingBack = false;
        }
    }

    renderViewSkeleton(viewName, container) {
        if (!container) return;

        // Common Header Shimmer
        const headerSkeleton = `
            <div class="skeleton-page-header">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="skeleton-shimmer skeleton-bone" style="width: 180px; height: 26px;"></div>
                    <div class="skeleton-shimmer skeleton-bone" style="width: 240px; height: 13px;"></div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <div class="skeleton-shimmer skeleton-btn" style="width: 110px; height: 33px;"></div>
                </div>
            </div>
        `;

        // 4 KPI Cards Shimmer
        const kpisSkeleton = `
            <div class="skeleton-kpi-grid">
                ${[1, 2, 3, 4].map(() => `
                    <div class="skeleton-kpi-box">
                        <div class="skeleton-shimmer skeleton-avatar" style="width: 36px; height: 36px;"></div>
                        <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                            <div class="skeleton-shimmer skeleton-bone" style="width: 60px; height: 11px;"></div>
                            <div class="skeleton-shimmer skeleton-bone" style="width: 90px; height: 20px;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // 6 Batch Cards Shimmer
        const cardsSkeleton = `
            <div class="skeleton-cards-grid">
                ${[1, 2, 3, 4, 5, 6].map(() => `
                    <div class="skeleton-batch-card">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <div style="display: flex; gap: 6px;">
                                <div class="skeleton-shimmer skeleton-chip" style="width: 64px; height: 20px;"></div>
                                <div class="skeleton-shimmer skeleton-chip" style="width: 50px; height: 20px;"></div>
                            </div>
                            <div class="skeleton-shimmer skeleton-chip" style="width: 60px; height: 20px;"></div>
                        </div>
                        <div class="skeleton-shimmer skeleton-bone" style="width: 75%; height: 18px; margin-bottom: 8px;"></div>
                        <div class="skeleton-shimmer skeleton-bone" style="width: 55%; height: 12px; margin-bottom: 14px;"></div>
                        <div class="skeleton-shimmer skeleton-bone" style="width: 100%; height: 6px; border-radius: 4px; margin-bottom: 14px;"></div>
                        <div style="display: flex; gap: 6px; margin-top: auto;">
                            <div class="skeleton-shimmer skeleton-btn" style="flex: 1; height: 30px;"></div>
                            <div class="skeleton-shimmer skeleton-btn" style="width: 30px; height: 30px;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Table Rows Shimmer
        const tableSkeleton = `
            <div class="skeleton-table-card">
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
                    <div class="skeleton-shimmer skeleton-bone" style="width: 140px; height: 16px;"></div>
                    <div class="skeleton-shimmer skeleton-bone" style="width: 80px; height: 16px;"></div>
                </div>
                <div style="padding: 12px 16px;">
                    ${[1, 2, 3, 4, 5, 6, 7].map(() => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.04);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="skeleton-shimmer skeleton-avatar" style="width: 24px; height: 24px;"></div>
                                <div class="skeleton-shimmer skeleton-bone" style="width: 120px; height: 14px;"></div>
                            </div>
                            <div class="skeleton-shimmer skeleton-bone" style="width: 70px; height: 14px;"></div>
                            <div class="skeleton-shimmer skeleton-chip" style="width: 65px; height: 20px;"></div>
                            <div class="skeleton-shimmer skeleton-bone" style="width: 50px; height: 14px;"></div>
                            <div class="skeleton-shimmer skeleton-btn" style="width: 60px; height: 26px;"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Form & Upload Shimmer
        const formSkeleton = `
            <div class="skeleton-table-card" style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
                <div style="display: flex; gap: 12px;">
                    <div class="skeleton-shimmer skeleton-chip" style="width: 90px; height: 28px;"></div>
                    <div class="skeleton-shimmer skeleton-chip" style="width: 90px; height: 28px;"></div>
                    <div class="skeleton-shimmer skeleton-chip" style="width: 90px; height: 28px;"></div>
                </div>
                <div class="skeleton-shimmer skeleton-bone" style="width: 100%; height: 160px; border-radius: 12px;"></div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <div class="skeleton-shimmer skeleton-btn" style="width: 90px; height: 34px;"></div>
                    <div class="skeleton-shimmer skeleton-btn" style="width: 130px; height: 34px;"></div>
                </div>
            </div>
        `;

        if (viewName === "dashboard" || viewName === "uploaded-papers" || viewName === "classes") {
            container.innerHTML = `
                <div class="skeleton-page-wrap">
                    ${headerSkeleton}
                    ${kpisSkeleton}
                    ${cardsSkeleton}
                </div>
            `;
        } else if (viewName === "upload-portal" || viewName === "new-eval" || viewName === "settings") {
            container.innerHTML = `
                <div class="skeleton-page-wrap">
                    ${headerSkeleton}
                    ${formSkeleton}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="skeleton-page-wrap">
                    ${headerSkeleton}
                    ${kpisSkeleton}
                    ${tableSkeleton}
                </div>
            `;
        }
    }

    async switchView(viewName, targetSubTab = null) {
        if (viewName === "history") {
            viewName = "dashboard";
        }
        if (viewName !== "super-admin") {
            const isLocked = await this.enforceLicenseGate();
            if (isLocked) return;
        }

        this.currentView = viewName;

        // If leaving workspace, close it gracefully
        if (viewName !== "workspace") {
            this.closeCorrectionCompletedModal();
            this.updateFloatingSaveNextPill(false);
        }
        if (this.activeEvaluation && viewName !== "workspace") {
            const currentEval = this.activeEvaluation;
            if (this.markingPanel) {
                const allGraded = Array.isArray(this.markingPanel.questions) && this.markingPanel.questions.length > 0 &&
                    (window.isEvaluationFullyGraded ? window.isEvaluationFullyGraded(this.markingPanel.questions, this.markingPanel.sections) : this.markingPanel.questions.every(q => q.status && q.status !== "unmarked" && q.status !== "pending"));
                if (allGraded) {
                    currentEval.status = "Completed";
                } else if (Number(currentEval.obtainedMarks) > 0 && currentEval.status !== "Completed") {
                    currentEval.status = "In Progress";
                }
            }
            await this.saveActiveEvaluation(false, true);
            this.stopAutosave();
            this.activeEvaluation = null;
        }

        // Close mobile drawer if open
        const sidebar = document.getElementById("app-side-menu-bar");
        const backdrop = document.getElementById("sidebar-drawer-backdrop");
        if (sidebar) sidebar.classList.remove("drawer-open");
        if (backdrop) backdrop.classList.remove("active");

        // Shell and workspace visibility
        const appShell = document.getElementById("main-app-shell");
        const mobileTopBar = document.getElementById("app-mobile-top-bar");
        const mainHeader = document.getElementById("main-app-header");
        const mainContent = document.getElementById("main-content-area");
        const workspaceView = document.getElementById("view-workspace");

        if (viewName === "workspace") {
            if (appShell) appShell.style.display = "none";
            if (mobileTopBar) mobileTopBar.style.display = "none";
            if (mainHeader) mainHeader.style.display = "none";
            if (mainContent) mainContent.style.display = "none";
            if (workspaceView) workspaceView.style.display = "flex";
            return;
        }

        if (appShell) appShell.style.display = "flex";
        if (mobileTopBar) mobileTopBar.style.display = "";
        if (mainHeader) mainHeader.style.display = "flex";
        if (mainContent) mainContent.style.display = "block";
        if (workspaceView) workspaceView.style.display = "none";
        this.updateStorageQuotaDisplay();

        // Update nav active states (Sidebar + Desktop Header)
        document.querySelectorAll(".sidebar-menu-item").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-view") === viewName);
        });
        document.querySelectorAll(".nav-link").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-view") === viewName);
        });

        // Determine navigation direction (iOS UINavigationController style)
        const isBackward = (viewName === "dashboard" || this._isNavigatingBack);
        const navClass = isBackward ? "ios-nav-backward" : "ios-nav-forward";

        // Hide all views
        document.querySelectorAll(".view-section").forEach(sec => {
            sec.classList.remove("active-view", "ios-nav-forward", "ios-nav-backward");
        });

        const activateSection = (id) => {
            const el = document.getElementById(id);
            if (el) el.classList.add("active-view", navClass);
            return el;
        };

        // Show target view & mount manager
        const rootIdMap = {
            "upload-portal": "upload-portal-container-root",
            "dashboard": "dashboard-container-root",
            "new-eval": "eval-form-container-root",
            "history": "history-container-root",
            "bulk-report": "bulk-report-container-root",
            "classes": "classes-container-root",
            "uploaded-papers": "uploaded-papers-container-root",
            "correction-marks": "correction-marks-container-root",
            "settings": "settings-container-root",
            "user-management": "user-management-container-root",
            "admin-panel": "admin-panel-container-root",
            "super-admin": "super-admin-container-root"
        };
        const rootId = rootIdMap[viewName];
        const root = rootId ? document.getElementById(rootId) : null;
        if (root) {
            this.renderViewSkeleton(viewName, root);
        }

        const minSkeletonDelay = () => new Promise(r => setTimeout(r, 220));

        if (viewName === "upload-portal") {
            activateSection("view-upload-portal");
            this.uploadPortalManager = new UploadPortalManager(root, {
                onOpenWorkspace: (ev) => this.openWorkspace(ev),
                onSwitchToEvaluator: () => this.setPortal("evaluator", true)
            });
            await Promise.all([this.uploadPortalManager.init(), minSkeletonDelay()]);
        } else if (viewName === "dashboard") {
            activateSection("view-dashboard");
            this.dashboardManager = new DashboardManager(root, {
                onStartNew: () => this.switchView("new-eval"),
                onOpenEvaluation: (ev) => this.openWorkspace(ev),
                onDownloadPDF: (ev) => this.downloadEvaluationPDF(ev),
                onBulkDownloadPDF: (evals) => this.downloadBulkPDFs(evals),
                onExportExcel: (evals) => this.exportEvaluationsAsExcel(evals)
            });
            await Promise.all([this.dashboardManager.init(), minSkeletonDelay()]);
        } else if (viewName === "new-eval") {
            activateSection("view-new-eval");
            await minSkeletonDelay();
            this.evaluationForm = new EvaluationForm(root, {
                onStartCorrection: (ev) => this.openWorkspace(ev)
            });
        } else if (viewName === "history") {
            activateSection("view-history");
            this.historyManager = new EvaluationHistoryManager(root, {
                onOpenEvaluation: (ev) => this.openWorkspace(ev),
                onDownloadPDF: (ev) => this.downloadEvaluationPDF(ev)
            });
            await Promise.all([this.historyManager.init(), minSkeletonDelay()]);
        } else if (viewName === "bulk-report") {
            activateSection("view-bulk-report");
            this.bulkReportManager = new BulkReportManager(root);
            await Promise.all([this.bulkReportManager.init(), minSkeletonDelay()]);
        } else if (viewName === "classes") {
            activateSection("view-classes");
            if (root && window.ClassesPageManager) {
                this.classesPageManager = new ClassesPageManager(root);
                await Promise.all([this.classesPageManager.init(), minSkeletonDelay()]);
            }
        } else if (viewName === "uploaded-papers") {
            activateSection("view-uploaded-papers");
            if (root && window.UploadedPapersPageManager) {
                this.uploadedPapersPageManager = new UploadedPapersPageManager(root);
                await Promise.all([this.uploadedPapersPageManager.init(), minSkeletonDelay()]);
            }
        } else if (viewName === "correction-marks") {
            activateSection("view-correction-marks");
            if (root && window.CorrectionMarksPageManager) {
                this.correctionMarksPageManager = new CorrectionMarksPageManager(root, {
                    onOpenEvaluation: (ev) => this.openWorkspace(ev),
                    onShowToast: (msg, type) => this.showToast(msg, type)
                });
                await Promise.all([this.correctionMarksPageManager.init(), minSkeletonDelay()]);
            }
        } else if (viewName === "settings") {
            activateSection("view-settings");
            if (root && window.SettingsPageManager) {
                this.settingsPageManager = new SettingsPageManager(root);
                await Promise.all([this.settingsPageManager.init(), minSkeletonDelay()]);
            }
        } else if (viewName === "user-management") {
            activateSection("view-user-management");
            if (root && window.UserManagementPageManager) {
                this.userManagementPageManager = new UserManagementPageManager(root);
                await Promise.all([this.userManagementPageManager.init(), minSkeletonDelay()]);
            }
        } else if (viewName === "admin-panel") {
            activateSection("view-admin-panel");
            if (root && window.AdminPanelManager) {
                this.adminPanelManager = new AdminPanelManager(root);
                window.adminPanelManager = this.adminPanelManager;
                await Promise.all([this.adminPanelManager.init(), minSkeletonDelay()]);
            }
        } else if (viewName === "super-admin") {
            activateSection("view-super-admin");
            if (root && window.SuperAdminManager) {
                if (!this.superAdminManager) {
                    this.superAdminManager = new SuperAdminManager(root, { initialTab: targetSubTab || "license" });
                    await Promise.all([this.superAdminManager.init(targetSubTab), minSkeletonDelay()]);
                } else {
                    if (targetSubTab) {
                        this.superAdminManager.switchTab(targetSubTab);
                    } else {
                        await Promise.all([this.superAdminManager.init(), minSkeletonDelay()]);
                    }
                }
            }
        }
        this.updateUserProfileDisplay();
    }

    // --- Workspace Initialization & Lifecycle ---

    updateTopHud(q) {
        if (!q) return;
        const qLabelEl = document.getElementById("hud-active-q-label");
        const qMaxEl = document.getElementById("hud-active-q-max");
        const secBadge = document.getElementById("hud-section-badge");
        const secTotalBadge = document.getElementById("hud-sec-total-badge");
        const qTotalBadge = document.getElementById("hud-q-total-badge");
        const choiceBadge = document.getElementById("hud-choice-badge");
        const customInp = document.getElementById("hud-custom-score-inp");

        const isUnmarked = !q || q.status === "unmarked" || q.status === "pending";
        if (qLabelEl) qLabelEl.textContent = `Q${q.qNo}`;
        if (qMaxEl) qMaxEl.textContent = `/ ${q.maxMarks} Marks`;
        if (secBadge) secBadge.textContent = q.section || "Section A";
        if (qTotalBadge) {
            qTotalBadge.textContent = isUnmarked ? `Q Total: —/${q.maxMarks}M` : `Q Total: ${q.awardedMarks}/${q.maxMarks}M`;
            if (isUnmarked) {
                qTotalBadge.style.color = "var(--text-muted, #86868b)";
            } else {
                qTotalBadge.style.color = "";
            }
        }

        const qTopicEl = document.getElementById("hud-active-q-topic");
        if (qTopicEl) {
            qTopicEl.style.display = "none";
        }

        if (this.markingPanel) {
            const secTotals = this.markingPanel.getSectionTotals();
            const currentSec = secTotals.find(s => s.id === q.sectionId || s.name === q.section);
            if (secTotalBadge && currentSec) {
                secTotalBadge.textContent = `Sec Total: ${currentSec.obtainedMarks}/${currentSec.maxMarks}M`;
            }
        }

        if (choiceBadge) {
            if (q.isChoice) {
                choiceBadge.style.display = "inline-flex";
                choiceBadge.textContent = q.selectedChoice ? `Choice: ${q.selectedChoice}` : "OR Choice";
            } else {
                choiceBadge.style.display = "none";
            }
        }

        if (customInp) {
            customInp.value = isUnmarked ? "" : (q.awardedMarks !== undefined ? q.awardedMarks : "");
            customInp.placeholder = "—";
        }

        // Dynamically rebuild hud-number-marks-row tailored to active question ceiling (e.g. 7M, 12M, 15M)
        const hudNumRow = document.querySelector(".hud-number-marks-row");
        if (hudNumRow) {
            const numbers = this.markingPanel?.generateQuickNumbers ? this.markingPanel.generateQuickNumbers(q.maxMarks) : [0, 0.5, 1, 1.5, 2];
            hudNumRow.innerHTML = numbers.map(n => `
                <button type="button" class="hud-mark-btn ${n % 1 !== 0 ? 'hud-half-btn' : ''} ${(!isUnmarked && Number(q.awardedMarks) === n) ? 'active' : ''}" data-mark="${n}">${n}</button>
            `).join("");

            hudNumRow.querySelectorAll(".hud-mark-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const mark = Number(btn.getAttribute("data-mark"));
                    this.markingPanel?.setActiveQuestionMark(mark);
                    if (this.canvasEngine) {
                        this.canvasEngine.setMarksValue(mark > 0 ? `+${mark}` : "0");
                    }
                    const activeQ = this.markingPanel?.getActiveQuestion();
                    if (activeQ) {
                        this.updateTopHud(activeQ);
                    }
                    this.updatePageTotalDisplay();
                });
            });
        }
    }

    awardFullMarksWithMarginStamp(targetQ = null) {
        if (targetQ && this.markingPanel) {
            const idx = this.markingPanel.questions.findIndex(item => item === targetQ || item.id === targetQ.id || item.qNo === targetQ.qNo);
            if (idx >= 0 && idx !== this.markingPanel.activeQuestionIndex) {
                this.markingPanel.selectQuestion(idx);
            }
        }
        const q = this.markingPanel?.getActiveQuestion() || targetQ;
        if (!q) return;

        const maxMarks = Number(q.maxMarks) || 0;

        // 1. Award full marks to active question in marking panel
        this.markingPanel?.setActiveQuestionMark(maxMarks, "correct");

        // 2. Determine stamping position: use last click position or cursor position or smart middle
        let stampPos = this.canvasEngine?.currentCursorNormPos || this.canvasEngine?.lastClickNormPos;
        if (!stampPos) {
            stampPos = { x: 0.25, y: 0.35 };
        }

        if (this.canvasEngine) {
            // Check if page already has a tick near stampPos.y, if not place one
            const curPage = this.canvasEngine.pages[this.canvasEngine.currentPageIndex];
            const hasRecentTick = curPage && (curPage.annotations || []).some(a => a.type === "tick" && Math.abs(a.y - stampPos.y) < 0.08);

            if (!hasRecentTick) {
                const tickStamp = {
                    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    pageIndex: this.canvasEngine.currentPageIndex,
                    type: "tick",
                    x: stampPos.x,
                    y: stampPos.y,
                    color: "#DC2626", // Teacher Red Ink
                    marks: maxMarks,
                    qNo: q.qNo,
                    qLabel: q.label || `Q${q.qNo}`,
                    isStep: false,
                    hasMarginMark: false,
                    scale: 1.0,
                    timestamp: Date.now()
                };
                this.canvasEngine.addAnnotation(tickStamp);
            }
            this.canvasEngine.renderOverlay();
        }

        // 4. Update HUD and page total display
        this.updateTopHud(q);
        this.updatePageTotalDisplay();

        // 5. User feedback
        this.showToast(`[Full Marks] Awarded (${maxMarks}M) to Q${q.qNo}. Press Enter to calculate & advance.`);

        this.hasUnsavedChanges = true;
        this.setAutosaveBadge("unsaved");
    }

    awardZeroMarks(targetQ = null, explicitPos = null) {
        const q = targetQ || this.markingPanel?.getActiveQuestion();
        if (!q) return;

        // 1. Mark question as 0 marks & status "wrong" in marking panel
        this.markingPanel?.setActiveQuestionMark(0, "wrong");

        // 2. Determine stamping position: use explicitPos or cursor position or last click position
        let stampPos = explicitPos || this.canvasEngine?.currentCursorNormPos || this.canvasEngine?.lastClickNormPos;
        if (!stampPos) {
            stampPos = { x: 0.25, y: 0.35 };
        }

        // 3. Stamp wrong (X cross) mark on canvas with 0 marks
        if (this.canvasEngine) {
            // Check if page already has a wrong mark near stampPos.y, if not place one
            const curPage = this.canvasEngine.pages[this.canvasEngine.currentPageIndex];
            const hasRecentWrong = curPage && (curPage.annotations || []).some(a => a.type === "wrong" && Math.abs(a.y - stampPos.y) < 0.08);

            if (!hasRecentWrong) {
                const wrongStamp = {
                    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    pageIndex: this.canvasEngine.currentPageIndex,
                    type: "wrong",
                    x: stampPos.x,
                    y: stampPos.y,
                    color: "#DC2626", // Teacher Red Ink
                    marks: 0,
                    qNo: q.qNo,
                    qLabel: q.label || `Q${q.qNo}`,
                    isStep: false,
                    hasMarginMark: false,
                    scale: 1.0,
                    timestamp: Date.now()
                };
                this.canvasEngine.addAnnotation(wrongStamp);
            }
            this.canvasEngine.renderOverlay();
        }

        // 4. Update HUD and page total display
        this.updateTopHud(q);
        this.updatePageTotalDisplay();

        // 5. User feedback
        this.showToast(`Marked Q${q.qNo} as 0 Marks. Press Enter to calculate & advance.`);

        this.hasUnsavedChanges = true;
        this.setAutosaveBadge("unsaved");
    }

    updatePageTotalDisplay() {
        const valEl = document.getElementById("ws-page-total-val");
        if (!valEl || !this.canvasEngine) return;
        const total = this.canvasEngine.getPageTotalMarks();
        valEl.textContent = total;
    }

    syncQuestionScoresFromAnnotations() {
        if (!this.canvasEngine) return;
        const questions = this.markingPanel ? (this.markingPanel.questions || []) : (this.activeEvaluation?.questions || []);
        let updated = false;

        if (questions && questions.length > 0) {
            questions.forEach((q, idx) => {
                // If question is explicitly marked as wrong / 0 marks in marking panel, do NOT let legacy canvas annotations turn it into 1!
                if (q.status === "wrong" && (q.awardedMarks === 0 || q.awardedMarks === "0")) {
                    return;
                }
                const annTotal = this.canvasEngine.getQuestionTotalFromAnnotations(q.qNo);
                const annList = this.canvasEngine.getAnnotationsForQuestion(q.qNo);
                const hasMarginMark = annList.some(a => a.type === "margin_mark" || a.type === "left_mark");
                const hasWrongMark = annList.some(a => a.type === "wrong");
                const hasTicksOrMarks = annList.some(a => a.type === "tick" || a.type === "marks");
                const hasScoreAnnotations = hasMarginMark || hasWrongMark || (hasTicksOrMarks && annTotal > 0);

                if (hasScoreAnnotations && (annTotal > 0 || hasMarginMark || hasWrongMark)) {
                    const clamped = Math.min(q.maxMarks, Math.max(0, annTotal));
                    const targetStatus = hasWrongMark && clamped === 0 ? "wrong" : (clamped === 0 ? (q.status === "wrong" ? "wrong" : "unmarked") : (clamped >= q.maxMarks ? "correct" : "partial"));
                    if (q.awardedMarks !== clamped || q.status !== targetStatus) {
                        if (this.markingPanel) {
                            this.markingPanel.assignQuestionMarkDirect(idx, clamped, targetStatus);
                        } else {
                            q.awardedMarks = clamped;
                            q.status = targetStatus;
                        }
                        updated = true;
                    }
                } else {
                    // Score annotations were deleted or removed from the paper: remove from the side where marks are entered!
                    if (q.awardedMarks > 0 || q.status === "correct" || q.status === "partial" || q.status === "wrong") {
                        if (this.markingPanel) {
                            this.markingPanel.clearQuestionMark(idx);
                        } else {
                            q.awardedMarks = 0;
                            q.status = "unmarked";
                        }
                        updated = true;
                    }
                }
            });
        }

        // Calculate total obtained marks across paper
        let totalObtained = 0;
        let maxMarks = this.activeEvaluation?.maxMarks || 20;

        if (this.markingPanel && typeof this.markingPanel.recalculate === "function") {
            const summary = this.markingPanel.recalculate();
            totalObtained = summary.obtainedMarks;
            maxMarks = summary.maxMarks;
        } else if (questions && questions.length > 0) {
            totalObtained = questions.reduce((sum, q) => {
                if (q.status === "unmarked" || q.status === "pending") return sum;
                return sum + (Number(q.awardedMarks) || 0);
            }, 0);
        } else {
            totalObtained = this.canvasEngine.getPaperTotalMarks();
        }
        totalObtained = Math.round(totalObtained * 10) / 10;

        if (this.activeEvaluation) {
            this.activeEvaluation.obtainedMarks = totalObtained;
            this.activeEvaluation.questions = questions;
            const pct = maxMarks > 0 ? Math.round((totalObtained / maxMarks) * 100) : 0;
            this.activeEvaluation.percentage = pct;
            this.activeEvaluation.grade = pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F";
        }

        // Update live score badge in top bar and side panel
        const topScoreEl = document.getElementById("ws-live-score-val");
        if (topScoreEl) {
            topScoreEl.textContent = `${totalObtained} / ${maxMarks}`;
        }
        const obtEl = document.getElementById("score-obtained-val");
        if (obtEl) {
            obtEl.textContent = totalObtained;
        }

        const activeQ = this.markingPanel ? this.markingPanel.getActiveQuestion() : null;
        if (activeQ) this.updateTopHud(activeQ);
        this.updatePageTotalDisplay();
        this.renderScorecardTable();
    }

    async openWorkspace(evaluation) {
        if (!evaluation) return;
        this.closeCorrectionCompletedModal();
        this.updateFloatingSaveNextPill(false);
        this.showLoadingBox("Opening Answer Script...", `Loading ${evaluation.studentName || 'Student'}'s paper & correction tools...`);
        this.hidePortalLoginScreen();

        // Always fetch fresh record from storage to get saved annotations & page images
        if (evaluation.id && window.appStorage) {
            const fresh = await window.appStorage.getEvaluationById(evaluation.id);
            if (fresh) evaluation = fresh;
        }

        if (evaluation && evaluation.subject) {
            sessionStorage.setItem("niprak_active_subject", evaluation.subject);
            this.updateUserProfileDisplay(evaluation.subject, evaluation.className || evaluation.class);
        }

        // Subject Authorization Check: Teachers may ONLY evaluate papers of their assigned subjects
        const activeUser = window.appStorage.getCurrentUser();
        if (activeUser && (activeUser.role === 'evaluator' || activeUser.role === 'teacher')) {
            const assigned = (Array.isArray(activeUser.assignedSubjects) && activeUser.assignedSubjects.length > 0)
                ? activeUser.assignedSubjects.filter(s => s && s !== 'all' && s !== 'All Subjects')
                : (activeUser.subject ? [activeUser.subject] : []);

            if (assigned.length > 0) {
                const isMatch = assigned.some(s => window.appStorage.isSubjectMatch(evaluation.subject, evaluation.examName || evaluation.templateName, s, evaluation.templateName));
                if (!isMatch) {
                    const msg = `Access Restricted: This paper is for ${evaluation.subject || 'another subject'}. You are assigned to ${assigned.join(', ') || 'no subjects'}.`;
                    if (this.showToast) this.showToast(msg, "error");
                    else alert(msg);
                    await this.switchView("dashboard");
                    return;
                }
            }
        }

        // If raw PDF scans are purged to preserve storage, open the Student Scorecard directly
        if (evaluation.rawScansPurged) {
            if (this.showToast) {
                this.showToast(`Displaying score log for ${evaluation.studentName || 'Student'} (scans purged to save storage)`);
            }
            if (this.adminPanelManager && typeof this.adminPanelManager.openStudent360 === "function") {
                this.adminPanelManager.openStudent360(evaluation.rollNo, evaluation.studentName);
                return;
            } else if (window.adminPanelManager && typeof window.adminPanelManager.openStudent360 === "function") {
                window.adminPanelManager.openStudent360(evaluation.rollNo, evaluation.studentName);
                return;
            } else if (window.AdminPanelManager && document.getElementById("modal-admin-student-profile")) {
                const tempMgr = new window.AdminPanelManager(document.getElementById("view-admin-panel") || document.body);
                await tempMgr.init();
                tempMgr.openStudent360(evaluation.rollNo, evaluation.studentName);
                return;
            }
        }

        if (window.appStorage) {
            const cached = await window.appStorage.getPdfCache(evaluation.id);
            if (cached) {
                if ((!evaluation.pages || evaluation.pages.length === 0) && cached.pages && cached.pages.length > 0) {
                    evaluation.pages = cached.pages;
                }
                if (!evaluation.pdfDataUrl && cached.pdfDataUrl) {
                    evaluation.pdfDataUrl = cached.pdfDataUrl;
                }
            }
        }

        const hasLocalPages = Array.isArray(evaluation.pages) && evaluation.pages.length > 0 && evaluation.pages.some(p => p && typeof p === 'string' && (p.startsWith('data:') || p.startsWith('blob:')));
        const hasLocalPdf = evaluation.pdfDataUrl && typeof evaluation.pdfDataUrl === 'string' && (evaluation.pdfDataUrl.startsWith('data:') || evaluation.pdfDataUrl.startsWith('blob:'));

        if (!hasLocalPages && !hasLocalPdf && evaluation.pdfStorageUrl) {
            if (!evaluation.pages || evaluation.pages.length === 0) {
                evaluation.pages = [evaluation.pdfStorageUrl];
            }
            if (!evaluation.pdfDataUrl) {
                evaluation.pdfDataUrl = evaluation.pdfStorageUrl;
            }
        } else if (hasLocalPdf && (!evaluation.pages || evaluation.pages.length === 0)) {
            evaluation.pages = [evaluation.pdfDataUrl];
        }

        if (!evaluation.pages || evaluation.pages.length === 0) {
            evaluation.pages = [CanvasEngine.generateDefaultLinedPageDataUrl(evaluation.studentName, evaluation.rollNo, evaluation.subject)];
        }

        // Direct PDF Correction Workflow: Preserve paper questions, marks, and annotations 100%!
        if (!evaluation.maxMarks || evaluation.maxMarks <= 0) {
            evaluation.maxMarks = 40;
        }

        // AUTO-HEAL: Detect and resolve template mismatch (e.g. maxMarks is 40M, but questions sum to 80M)
        const qSum = Array.isArray(evaluation.questions) && evaluation.questions.length > 0
            ? evaluation.questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0)
            : 0;

        if (qSum > 0 && Math.abs(qSum - Number(evaluation.maxMarks)) > 1) {
            console.warn(`[Auto-Heal] Paper ${evaluation.id} template mismatch: maxMarks is ${evaluation.maxMarks} but questions sum to ${qSum}. Auto-syncing questions...`);
            let matchedTpl = null;
            if (window.appStorage) {
                const catalog = await window.appStorage.getSubjectCatalog();
                if (catalog && Array.isArray(catalog)) {
                    for (const sub of catalog) {
                        if (sub && Array.isArray(sub.templates)) {
                            matchedTpl = sub.templates.find(t => t.id === evaluation.templateId || t.name === evaluation.templateName);
                            if (matchedTpl) break;
                        }
                    }
                }
            }
            if (window.buildQuestionsFromTemplate) {
                evaluation.questions = window.buildQuestionsFromTemplate(matchedTpl, evaluation.maxMarks);
            } else {
                const ratio = Number(evaluation.maxMarks) / qSum;
                evaluation.questions.forEach(q => {
                    q.maxMarks = Math.max(1, Math.round((Number(q.maxMarks) * ratio) * 10) / 10);
                });
            }
            evaluation.sections = (matchedTpl && matchedTpl.sections) ? JSON.parse(JSON.stringify(matchedTpl.sections)) : [{
                id: "sec_main",
                name: "All Questions",
                title: "All Questions",
                qStartNo: 1,
                qEndNo: evaluation.questions.length,
                qCount: evaluation.questions.length,
                maxMarks: evaluation.maxMarks
            }];
            try {
                if (window.appStorage) await window.appStorage.saveEvaluation(evaluation);
            } catch (e) {}
        }

        if (!Array.isArray(evaluation.questions) || evaluation.questions.length === 0) {
            const qCount = evaluation.totalQuestions || 31;
            const tMarks = Number(evaluation.maxMarks) || 40;
            const markPerQ = Math.max(1, Math.round((tMarks / qCount) * 10) / 10);
            evaluation.questions = [];
            for (let qn = 1; qn <= qCount; qn++) {
                evaluation.questions.push({
                    id: `q_${qn}`,
                    qNo: qn,
                    qNumber: `Q${qn}`,
                    number: `Q${qn}`,
                    label: `Q${qn}`,
                    section: "All Questions",
                    sectionId: "sec_main",
                    maxMarks: markPerQ,
                    awardedMarks: null,
                    obtainedMarks: 0,
                    status: "unmarked",
                    remarks: "",
                    isChoice: false,
                    hasSubQuestions: false,
                    subQuestions: []
                });
            }
        }

        if (!Array.isArray(evaluation.sections) || evaluation.sections.length === 0) {
            evaluation.sections = [{
                id: "sec_main",
                name: "All Questions",
                title: "All Questions",
                qStartNo: 1,
                qEndNo: evaluation.questions.length,
                qCount: evaluation.questions.length,
                maxMarks: evaluation.maxMarks || 40
            }];
        }

                this.activeEvaluation = evaluation;
        this.switchView("workspace");

        // Show workspace loading overlay
        const wsOverlay = document.getElementById("ws-loading-overlay");
        if (wsOverlay) {
            wsOverlay.style.display = "flex";
            wsOverlay.style.opacity = "1";
        }

        // Top bar info update
        const nameEl = document.getElementById("ws-student-name-text");
        if (nameEl) nameEl.textContent = evaluation.studentName || "Student Paper";
        const rollEl = document.getElementById("ws-roll-tag-text");
        if (rollEl) rollEl.textContent = `Roll: ${evaluation.rollNo || "-"}`;
        const subEl = document.getElementById("ws-exam-subtitle-text");
        if (subEl) subEl.textContent = `${evaluation.subject || ""} • ${evaluation.examName || ""}`;

        // Populate and synchronize the Template Switcher dropdown
        await this.populateWorkspaceTemplateSelector(evaluation);
        this.hideLoadingBox();

        // Save & Report Button visibility (shown for Tamil / test evaluations)
        const btnSaveReport = document.getElementById("ws-btn-save-report");
        if (btnSaveReport) {
            const isTamil = (evaluation.subject || "").toLowerCase().includes("tamil");
            btnSaveReport.style.display = isTamil ? "inline-flex" : "none";
        }

        // Clear canvas container root to prevent duplicate stacked canvases when opening paper second time!
        const canvasContainer = document.getElementById("canvas-container-root");
        if (canvasContainer) {
            canvasContainer.innerHTML = "";
        }

        // Initialize Canvas Engine with Radial Marking Wheel & Page Total callbacks
        this.canvasEngine = new CanvasEngine(canvasContainer, {
            onAnnotationsChange: (annList) => {
                this.activeEvaluation.annotations = annList;
                this.syncQuestionScoresFromAnnotations();
                this.updatePageTotalDisplay();
                this.hasUnsavedChanges = true;
                this.setAutosaveBadge("unsaved");
            },
            onPageChange: (currentIdx, totalPages) => {
                const pagerText = document.getElementById("ws-pager-text");
                if (pagerText) pagerText.textContent = `Page ${currentIdx + 1} of ${totalPages}`;
                this.updatePageTotalDisplay();
            },
            getActiveQuestionInfo: () => {
                const q = this.markingPanel?.getActiveQuestion();
                return q ? { label: `Q${q.qNo}`, maxMarks: q.maxMarks, currentMarks: q.awardedMarks, qNo: q.qNo, section: q.section } : { label: "Q1", maxMarks: 2, qNo: 1, section: "Section A" };
            },
            onRadialMarkAwarded: (markVal, isStep, normPos) => {
                if (markVal === "skip") {
                    const activeQ = this.markingPanel?.getActiveQuestion();
                    if (activeQ) {
                        if (this.canvasEngine) {
                            this.canvasEngine.removeAnnotationsForQuestion(activeQ.qNo);
                            this.updatePageTotalDisplay();
                        }
                        this.markingPanel.assignCurrentQuestionMark(0, "skipped");
                        this.updateTopHud(activeQ);
                        this.markingPanel.nextQuestion();
                        this.showToast(`Q${activeQ.qNo} marked as Skipped / Choice.`);
                    }
                    return;
                }
                const numVal = Number(markVal) || 0;
                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ && this.canvasEngine) {
                    const stepSum = this.canvasEngine.getQuestionStepMarksSum(activeQ.qNo);
                    const runningScore = stepSum > 0 ? Math.min(activeQ.maxMarks, stepSum) : (numVal === 0 ? 0 : (activeQ.awardedMarks || numVal));
                    const status = runningScore >= activeQ.maxMarks ? "correct" : (runningScore === 0 ? "wrong" : "partial");
                    this.markingPanel.assignCurrentQuestionMark(runningScore, status);
                    this.updateTopHud(activeQ);
                    this.updatePageTotalDisplay();
                    const markDesc = numVal === 0 ? "0 Marks" : `+${numVal} Mark`;
                    this.showToast(`Placed ${markDesc} on paper (Current: ${activeQ.awardedMarks}/${activeQ.maxMarks}M). Press Enter to calculate & advance.`);
                }
            },
            onAnnotationSelected: (ann) => {
                if (!ann) return;
                const rawQ = ann.qNo || ann.qLabel;
                if (rawQ && this.markingPanel && Array.isArray(this.markingPanel.questions)) {
                    const targetKey = CanvasEngine.normalizeQKey(rawQ);
                    const idx = this.markingPanel.questions.findIndex(q => 
                        CanvasEngine.normalizeQKey(q.qNo) === targetKey || 
                        CanvasEngine.normalizeQKey(q.label) === targetKey || 
                        CanvasEngine.normalizeQKey(q.id) === targetKey
                    );
                    if (idx >= 0) {
                        this.markingPanel.selectQuestion(idx);

                        // Highlight & scroll question row in side list
                        const listRow = document.querySelector(`.q-row[data-index="${idx}"]`);
                        if (listRow) {
                            listRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            listRow.classList.add("q-row-highlight-pulse");
                            setTimeout(() => listRow.classList.remove("q-row-highlight-pulse"), 1200);
                        }

                        // Scroll breakdown row
                        const bRow = document.querySelector(`.q-breakdown-row[data-index="${idx}"]`);
                        if (bRow) {
                            bRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }
                    }
                }
            }
        });

        // Initialize Marking Panel
        const markingContainer = document.getElementById("marking-panel-container");
        this.markingPanel = new MarkingPanel(markingContainer, {
            onAwardFullMarks: (q) => {
                this.awardFullMarksWithMarginStamp(q);
            },
            onAwardZeroMarks: (q) => {
                this.awardZeroMarks(q);
            },
            onQuestionMarkCleared: (q) => {
                if (this.canvasEngine) {
                    this.canvasEngine.removeAnnotationsForQuestion(q.qNo);
                    this.updatePageTotalDisplay();
                }
                const summary = this.markingPanel?.recalculate ? this.markingPanel.recalculate() : null;
                const totalObtained = summary ? summary.obtainedMarks : (this.markingPanel?.obtainedMarksTotal || 0);
                const maxMarks = summary ? summary.maxMarks : (this.markingPanel?.maxMarksTotal || 20);

                if (this.activeEvaluation) {
                    this.activeEvaluation.obtainedMarks = totalObtained;
                    const pct = maxMarks > 0 ? Math.round((totalObtained / maxMarks) * 100) : 0;
                    this.activeEvaluation.percentage = pct;
                    this.activeEvaluation.grade = pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F";
                }

                const topScoreEl = document.getElementById("ws-live-score-val");
                if (topScoreEl) {
                    topScoreEl.textContent = `${totalObtained} / ${maxMarks}`;
                }
                const obtEl = document.getElementById("score-obtained-val");
                if (obtEl) {
                    obtEl.textContent = totalObtained;
                }
                this.updateTopHud(q);
                this.renderScorecardTable();
                this.hasUnsavedChanges = true;
                this.setAutosaveBadge("unsaved");
            },
            onScoreChange: (scoreSummary) => {
                this.activeEvaluation.obtainedMarks = scoreSummary.obtainedMarks;
                this.activeEvaluation.maxMarks = scoreSummary.maxMarks;
                this.activeEvaluation.percentage = scoreSummary.percentage;
                this.activeEvaluation.grade = scoreSummary.grade;
                this.activeEvaluation.correctCount = scoreSummary.correctCount;
                this.activeEvaluation.wrongCount = scoreSummary.wrongCount;
                this.activeEvaluation.feedback = scoreSummary.feedback;
                this.activeEvaluation.questions = scoreSummary.questions;

                // Sync top bar score
                const topScoreEl = document.getElementById("ws-live-score-val");
                if (topScoreEl) {
                    topScoreEl.textContent = `${scoreSummary.obtainedMarks} / ${scoreSummary.maxMarks}`;
                }
                const obtEl = document.getElementById("score-obtained-val");
                if (obtEl) {
                    obtEl.textContent = scoreSummary.obtainedMarks;
                }

                // Check and clean up companion margin marks for all questions that became unmarked or wrong
                if (this.canvasEngine && this.markingPanel?.questions) {
                    this.markingPanel.questions.forEach(ques => {
                        if (ques.status === "unmarked" || ques.status === "pending") {
                            const qAnns = this.canvasEngine.getAnnotationsForQuestion(ques.qNo);
                            const hasMargin = qAnns.some(a => a.type === "margin_mark" || a.type === "left_mark");
                            if (hasMargin) {
                                this.canvasEngine.removeAnnotationsForQuestion(ques.qNo);
                            }
                        }
                    });
                }

                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) this.updateTopHud(activeQ);

                this.updatePageTotalDisplay();
                this.renderScorecardTable();

                // STRICT RULE: Keep status Pending until teacher explicitly clicks Save or Save & Next
                if (!this.activeEvaluation.status || (this.activeEvaluation.status !== "Completed" && this.activeEvaluation.status !== "Corrected")) {
                    this.activeEvaluation.status = "Pending";
                }

                this.hasUnsavedChanges = true;
                this.setAutosaveBadge("unsaved");
            },
            onQuestionSelect: (q, idx) => {
                this.updateTopHud(q);
                if (this.canvasEngine) {
                    this.canvasEngine.setMarksValue(`+${q.maxMarks}`);
                }
                this.renderScorecardTable();
            },
            onPresetCommentClick: (commentText) => {
                if (this.canvasEngine) {
                    this.canvasEngine.addPresetComment(commentText);
                    this.showToast(`Comment "${commentText}" added to paper`);
                }
            },
            onAllGraded: (scoreSummary) => {
                this.showCorrectionCompletedModal(scoreSummary);
            }
        });

        // Load evaluation data into canvas & marking panel
        try {
            const pdfFallbackUrl = evaluation.pdfStorageUrl || evaluation.pdfDataUrl || null;
            await this.canvasEngine.setPages(
                evaluation.pages || [],
                evaluation.annotations || [],
                pdfFallbackUrl,
                {
                    studentName: evaluation.studentName,
                    rollNo: evaluation.rollNo,
                    subject: evaluation.subject
                }
            );
            this.markingPanel.setEvaluationData(evaluation.questions || [], evaluation.maxMarks || 20, evaluation.feedback || "", evaluation.sections || []);

            // Sync initial Top HUD with Q1
            const initialQ = this.markingPanel.getActiveQuestion();
            if (initialQ) this.updateTopHud(initialQ);
            this.updatePageTotalDisplay();
            this.renderScorecardTable();

            // Update pager UI
            const pagerText = document.getElementById("ws-pager-text");
            if (pagerText && this.canvasEngine && this.canvasEngine.pages) {
                pagerText.textContent = `Page 1 of ${this.canvasEngine.pages.length}`;
            }

            // Set default tool
            this.selectTool("tick");

            // Fit to page initially & redraw canvas
            if (this.canvasEngine) {
                this.canvasEngine.fitToPage();
                this.canvasEngine.renderAll();
                requestAnimationFrame(() => {
                    this.canvasEngine?.fitToPage();
                    this.canvasEngine?.renderAll();
                    setTimeout(() => {
                        this.canvasEngine?.fitToPage();
                        this.canvasEngine?.renderAll();
                    }, 100);
                    setTimeout(() => {
                        this.canvasEngine?.fitToPage();
                        this.canvasEngine?.renderAll();
                    }, 300);
                });
            }

            // Start autosave cycle
            this.startAutosave();
            this.setAutosaveBadge("saved");
        } catch (openErr) {
            console.error("Error opening evaluation in workspace:", openErr);
            this.showToast("Note: Student paper could not be loaded from cloud. Displaying digital scorecard.", 4000);
        } finally {
            if (wsOverlay) {
                wsOverlay.style.opacity = "0";
                setTimeout(() => {
                    wsOverlay.style.display = "none";
                }, 150);
            }
        }
    }

    async populateWorkspaceTemplateSelector(evaluation) {
        const titleEl = document.getElementById("ws-active-exam-title");
        const examName = evaluation.examName || evaluation.templateName || "Assessment";
        const dateStr = evaluation.examDate ? ` • ${evaluation.examDate}` : "";
        const maxM = evaluation.maxMarks || 40;
        const examText = `${examName}${dateStr} (${maxM}M)`;

        if (titleEl) {
            titleEl.textContent = examText;
        }

        const selectEl = document.getElementById("ws-select-template");
        if (selectEl) {
            let availableTemplates = [];
            if (window.appStorage) {
                const catalog = await window.appStorage.getSubjectCatalog();
                const subObj = (catalog || []).find(s => window.appStorage.isSubjectMatch(s.name, '', evaluation.subject));
                if (subObj && Array.isArray(subObj.templates) && subObj.templates.length > 0) {
                    availableTemplates = subObj.templates;
                }
            }

            if (availableTemplates.length > 1) {
                selectEl.innerHTML = availableTemplates.map(t => 
                    `<option value="${t.id}" ${(t.id === evaluation.templateId || t.name === evaluation.templateName) ? 'selected' : ''}>${t.name} (${t.maxMarks || 40}M)</option>`
                ).join('');
                selectEl.style.display = "inline-block";
                selectEl.style.fontSize = "0.78rem";
                selectEl.style.padding = "3px 8px";
                selectEl.style.borderRadius = "6px";
                selectEl.style.border = "1px solid rgba(255,255,255,0.3)";
                selectEl.style.background = "rgba(255,255,255,0.12)";
                selectEl.style.color = "#FFFFFF";
                selectEl.style.cursor = "pointer";

                selectEl.onchange = async (e) => {
                    const newId = e.target.value;
                    if (newId && newId !== evaluation.templateId) {
                        await this.changeActiveEvaluationTemplate(newId);
                    }
                };
            } else {
                selectEl.innerHTML = `<option value="${evaluation.templateId || 'current'}">${examText}</option>`;
                selectEl.style.display = "none";
            }
        }
    }

        async changeActiveEvaluationTemplate(newTemplateId) {
        if (!this.activeEvaluation) return;

        // Locate blueprint from catalog or MockData
        let foundTpl = null;
        if ((newTemplateId === "mat-x-10th-rev-40" || newTemplateId === "mat-x-rev2-40") && window.MockData?.mathGrade10Revision2Template) {
            foundTpl = window.MockData.mathGrade10Revision2Template;
        } else if (newTemplateId === "mat-x-rev1-40" && window.MockData?.mathGrade10Revision1Template) {
            foundTpl = window.MockData.mathGrade10Revision1Template;
        } else if (newTemplateId === "tam-x-rev1-40" && window.MockData?.tamilGrade10Revision1Template) {
            foundTpl = window.MockData.tamilGrade10Revision1Template;
        } else if (newTemplateId === "bio-rev1-sub-13" && window.MockData?.biologyRevision1SubjectiveTemplate) {
            foundTpl = window.MockData.biologyRevision1SubjectiveTemplate;
        } else if (newTemplateId === "che-rev1-sub-13" && window.MockData?.chemistryRevision1SubjectiveTemplate) {
            foundTpl = window.MockData.chemistryRevision1SubjectiveTemplate;
        } else if (newTemplateId === "pol-cbse-80" && window.MockData?.politicalScienceTemplate) {
            foundTpl = window.MockData.politicalScienceTemplate;
        }

        let catalog = null;
        if (!foundTpl && window.appStorage) {
            catalog = await window.appStorage.getSubjectCatalog();
        }
        if (!catalog && window.uploadPortal && window.uploadPortal.catalog) {
            catalog = window.uploadPortal.catalog;
        }

        if (catalog && Array.isArray(catalog)) {
            for (const sub of catalog) {
                if (Array.isArray(sub.templates)) {
                    foundTpl = sub.templates.find(t => t.id === newTemplateId);
                    if (foundTpl) break;
                }
            }
        }

        if (!foundTpl && window.MockData) {
            for (const key of Object.keys(window.MockData)) {
                if (key.endsWith("Template") && window.MockData[key] && window.MockData[key].id === newTemplateId) {
                    foundTpl = window.MockData[key];
                    break;
                }
            }
        }

        if (!foundTpl) {
            this.showToast("Blueprint not found", "error");
            return;
        }

        // Build question list for chosen blueprint
        let tplQuestions = (foundTpl.questions && foundTpl.questions.length > 0)
            ? foundTpl.questions
            : [];

        if (tplQuestions.length === 0 && foundTpl.sections && Array.isArray(foundTpl.sections)) {
            let syntheticQNo = 1;
            foundTpl.sections.forEach(sec => {
                const start = sec.qStartNo || syntheticQNo;
                const end = sec.qEndNo || (start + (sec.qCount || 1) - 1);
                const marks = Number(sec.marksPerQ) || 1;
                const secName = sec.title || sec.name || `Section ${sec.letter || 'A'}`;
                const secId = sec.id || `sec_${(sec.letter || 'a').toLowerCase()}`;
                const isSub = !!sec.hasSubQuestions;
                for (let qn = start; qn <= end; qn++) {
                    const subQs = isSub && Array.isArray(sec.subQuestions) && sec.subQuestions.length > 0
                        ? sec.subQuestions.map((sq, sqIdx) => ({
                            id: sq.id || sq.subId || sq.letter || String(sqIdx + 1),
                            subId: sq.subId || sq.letter || String(sqIdx + 1),
                            letter: sq.letter || sq.label || String(sqIdx + 1),
                            label: sq.label ? (String(sq.label).startsWith("(") ? sq.label : `(${sq.label})`) : `(${sq.subId || sqIdx + 1})`,
                            maxMarks: Number(sq.maxMarks !== undefined ? sq.maxMarks : sq.marks) || 1,
                            awardedMarks: 0,
                            hasChoice: !!(sq.hasChoice || sq.isChoice),
                            isChoice: !!(sq.hasChoice || sq.isChoice),
                            choiceLabel: sq.choiceLabel || ""
                        }))
                        : [];
                    tplQuestions.push({
                        id: `q_${qn}`,
                        qNo: qn,
                        qNumber: `Q${qn}`,
                        label: `Q${qn}`,
                        section: secName,
                        sectionId: secId,
                        maxMarks: marks,
                        isChoice: !!sec.hasChoice,
                        hasSubQuestions: isSub && subQs.length > 0,
                        subQuestions: subQs
                    });
                    syntheticQNo = Math.max(syntheticQNo, qn + 1);
                }
            });
        }

        // Map existing awarded marks rigorously
        const oldMarksMap = new Map();
        (this.activeEvaluation.questions || []).forEach(q => {
            const numMarks = Number(q.awardedMarks) || 0;
            const subMarksSum = Array.isArray(q.subQuestions) 
                ? q.subQuestions.reduce((sum, sq) => sum + (Number(sq.awardedMarks) || 0), 0) 
                : 0;
            const effectiveMarks = Math.max(numMarks, subMarksSum);
            const isGraded = (q.status && q.status !== "unmarked" && q.status !== "pending") || effectiveMarks > 0;
            
            if (isGraded || q.status === "wrong") {
                const qObj = { ...q, awardedMarks: effectiveMarks };
                oldMarksMap.set(String(q.qNo), qObj);
                oldMarksMap.set(Number(q.qNo), qObj);
                if (q.label) {
                    oldMarksMap.set(String(q.label).toUpperCase().trim(), qObj);
                    oldMarksMap.set(String(q.label).replace(/[^0-9]/g, ''), qObj);
                }
            }
        });

        const prevEvalObtained = Number(this.activeEvaluation.obtainedMarks) || 0;

        const newQuestions = tplQuestions.map(tq => {
            const newQ = JSON.parse(JSON.stringify(tq));
            const prev = oldMarksMap.get(String(newQ.qNo)) 
                || oldMarksMap.get(Number(newQ.qNo)) 
                || oldMarksMap.get(String(newQ.label || '').toUpperCase().trim())
                || oldMarksMap.get(String(newQ.label || '').replace(/[^0-9]/g, ''));
            if (prev) {
                const prevAwarded = Math.max(Number(prev.awardedMarks) || 0, (prev.subQuestions || []).reduce((s, sq) => s + (Number(sq.awardedMarks) || 0), 0));
                newQ.awardedMarks = Math.min(prevAwarded, newQ.maxMarks);
                newQ.status = prev.status || (newQ.awardedMarks === newQ.maxMarks ? "correct" : (newQ.awardedMarks > 0 ? "partial" : "unmarked"));
                if (newQ.hasSubQuestions && Array.isArray(newQ.subQuestions) && newQ.subQuestions.length > 0) {
                    if (prev.subQuestions && prev.subQuestions.length === newQ.subQuestions.length) {
                        newQ.subQuestions.forEach((sq, sIdx) => {
                            sq.awardedMarks = Math.min(Number(prev.subQuestions[sIdx].awardedMarks) || 0, sq.maxMarks);
                        });
                    } else {
                        // Distribute awardedMarks across subquestions rather than zeroing!
                        let rem = newQ.awardedMarks;
                        newQ.subQuestions.forEach(sq => {
                            const alloc = Math.min(rem, sq.maxMarks);
                            sq.awardedMarks = alloc;
                            rem = Math.max(0, rem - alloc);
                        });
                    }
                }
            } else {
                newQ.awardedMarks = 0;
                newQ.status = "unmarked";
            }
            return newQ;
        });

        // Update active evaluation properties
        this.activeEvaluation.templateId = foundTpl.id;
        this.activeEvaluation.templateName = foundTpl.name;
        this.activeEvaluation.examName = foundTpl.examName || foundTpl.name;
        this.activeEvaluation.maxMarks = foundTpl.maxMarks || 40;
        this.activeEvaluation.duration = foundTpl.duration || this.activeEvaluation.duration || "2 Hours";
        this.activeEvaluation.sections = JSON.parse(JSON.stringify(foundTpl.sections || []));
        this.activeEvaluation.questions = newQuestions;

        // Recalculate obtained total & percentage
        const totalObt = this.activeEvaluation.questions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
        this.activeEvaluation.obtainedMarks = Math.round(Math.max(totalObt, prevEvalObtained) * 10) / 10;
        if (this.activeEvaluation.maxMarks > 0) {
            this.activeEvaluation.percentage = Math.round((this.activeEvaluation.obtainedMarks / this.activeEvaluation.maxMarks) * 100);
        }
        this.activeEvaluation.grade = this.activeEvaluation.percentage >= 90 ? "A+" : this.activeEvaluation.percentage >= 75 ? "A" : this.activeEvaluation.percentage >= 60 ? "B" : this.activeEvaluation.percentage >= 40 ? "C" : "F";
        this.activeEvaluation.status = this.activeEvaluation.obtainedMarks > 0 ? ((window.isEvaluationFullyGraded ? window.isEvaluationFullyGraded(this.activeEvaluation.questions, this.activeEvaluation.sections) : this.activeEvaluation.questions.every(q => q.status && q.status !== "unmarked" && q.status !== "pending")) ? "Completed" : "In Progress") : (this.activeEvaluation.status || "Pending");
        this.activeEvaluation.updatedAt = new Date().toISOString();

        // Persist to storage
        if (window.appStorage) {
            await window.appStorage.saveEvaluation(this.activeEvaluation);
        }

        // Re-initialize marking panel
        if (this.markingPanel) {
            this.markingPanel.setEvaluationData(
                this.activeEvaluation.questions,
                this.activeEvaluation.sections,
                this.activeEvaluation.maxMarks,
                this.activeEvaluation.feedback
            );
        }

        // Update workspace UI HUD
        const subEl = document.getElementById("ws-exam-subtitle-text");
        if (subEl) subEl.textContent = `${this.activeEvaluation.subject || ""} • ${this.activeEvaluation.examName || this.activeEvaluation.templateName || ""}`;

        const scoreValEl = document.getElementById("ws-live-score-val");
        if (scoreValEl) scoreValEl.textContent = `${this.activeEvaluation.obtainedMarks} / ${this.activeEvaluation.maxMarks}`;

        this.renderScorecardTable();
        this.showToast(`✓ Blueprint switched to: ${foundTpl.name} (${newQuestions.length} Qs / ${foundTpl.maxMarks}M)`, "success");
    }

    renderScorecardTable() {
        const container = document.getElementById("ws-scorecard-table-container");
        const badge = document.getElementById("ws-scorecard-unmarked-badge");
        if (!container || !this.markingPanel) return;

        const questions = this.markingPanel.questions || [];
        const sections = this.markingPanel.sections || [];
        const evalData = this.activeEvaluation || {};

        let unmarkedCount = window.calculateUnmarkedQuestionsCount 
            ? window.calculateUnmarkedQuestionsCount(questions, sections)
            : questions.filter(q => (q.status === "unmarked" || q.status === "pending") && Number(q.awardedMarks) === 0).length;

        let tableHtml = `
            <table class="scorecard-matrix-table">
                <thead>
                    <tr>
                        <th>SECTION</th>
                        <th>QUESTION NO.</th>
                        <th>SUB-PARTS / TOPIC</th>
                        <th>ALLOTTED MARKS</th>
                        <th>OBTAINED MARKS</th>
                        <th>STATUS</th>
                    </tr>
                </thead>
                <tbody>
        `;

        questions.forEach((q, idx) => {
            const secObj = sections.find(s => s.id === q.sectionId || s.name === q.section || s.title === q.section);
            const secName = secObj ? secObj.name : (q.section || "Section A");
            const reqCount = secObj ? (Number(secObj.requiredCount || secObj.answerCount) || questions.filter(item => item.sectionId === secObj.id || item.section === secObj.name || item.section === secObj.title).length) : (q.sectionRequiredCount || 999);
            const secQs = secObj ? questions.filter(item => item.sectionId === secObj.id || item.section === secObj.name || item.section === secObj.title) : [];
            const answeredInSec = secQs.filter(item => item.status && item.status !== "unmarked" && item.status !== "pending" && item.status !== "skipped").length;
            const isChoiceMet = answeredInSec >= reqCount;

            const isSkipped = q.status === "skipped" || (isChoiceMet && (q.status === "unmarked" || q.status === "pending"));
            const isUnmarked = !isSkipped && (q.status === "unmarked" || q.status === "pending") && Number(q.awardedMarks) === 0;

            const statusTag = isSkipped
                ? `<span class="score-st-badge st-skipped" style="background:#F1F5F9; color:#64748B; border:1px solid #CBD5E1;">⏭️ Optional (Skipped)</span>`
                : isUnmarked 
                    ? `<span class="score-st-badge st-unmarked">⚠️ UNMARKED</span>`
                    : (q.awardedMarks === q.maxMarks 
                        ? `<span class="score-st-badge st-graded">✓ Graded (Full)</span>`
                        : (q.status === "wrong" || q.awardedMarks === 0
                            ? `<span class="score-st-badge st-wrong" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;">✗ Incorrect (0M)</span>`
                            : `<span class="score-st-badge st-partial">◐ Graded (${q.awardedMarks}M)</span>`));

            let subpartsStr = "-";
            if (q.hasSubQuestions && q.subQuestions && q.subQuestions.length > 0) {
                subpartsStr = q.subQuestions.map(sq => `${sq.label}: ${sq.awardedMarks}/${sq.maxMarks}M`).join(" • ");
            } else if (q.isChoice) {
                subpartsStr = `Choice (${q.selectedChoice || 'Option 1'})`;
            }

            const isActive = idx === this.markingPanel.activeQuestionIndex;

            tableHtml += `
                <tr class="scorecard-row ${isActive ? 'row-active-q' : ''} ${isUnmarked ? 'row-unmarked' : ''}" data-q-idx="${idx}">
                    <td class="col-sec-tag">${secName}</td>
                    <td class="col-qno-tag">Q${q.qNo}</td>
                    <td class="col-subparts-tag">${subpartsStr}</td>
                    <td class="col-allotted-tag">${q.maxMarks} M</td>
                    <td class="col-obtained-tag ${q.awardedMarks > 0 ? 'mark-awarded' : ''}">${isSkipped ? '—' : `${q.awardedMarks} M`}</td>
                    <td class="col-status-tag">${statusTag}</td>
                </tr>
            `;
        });

        const totalMax = evalData.maxMarks || this.markingPanel.maxMarksTotal || 70;
        const totalObtained = evalData.obtainedMarks !== undefined ? evalData.obtainedMarks : (this.markingPanel.obtainedMarksTotal || 0);
        const gradeInfo = window.calculateGradeScale 
            ? window.calculateGradeScale(totalObtained, totalMax)
            : { grade: evalData.grade || "A1", gradePoint: 10, marksRange: "91 – 100", remarks: "Outstanding" };

        tableHtml += `
                </tbody>
                <tfoot>
                    <tr class="scorecard-footer-row">
                        <td colspan="3" class="foot-title">TOTAL EVALUATION SCORECARD SUMMARY</td>
                        <td class="foot-allotted">${totalMax} Marks</td>
                        <td class="foot-obtained">${totalObtained} Marks</td>
                        <td class="foot-pct">Grade: ${gradeInfo.grade} (GP: ${gradeInfo.gradePoint})</td>
                    </tr>
                </tfoot>
            </table>
        `;

        container.innerHTML = tableHtml;

        // Bind table row click to select question
        container.querySelectorAll(".scorecard-row").forEach(row => {
            row.addEventListener("click", () => {
                const idx = Number(row.getAttribute("data-q-idx"));
                this.markingPanel.selectQuestion(idx);
                this.renderScorecardTable();
            });
        });

        // Update top status badge
        if (badge) {
            if (unmarkedCount > 0) {
                badge.className = "scorecard-unmarked-pill has-unmarked";
                badge.textContent = `⚠️ ${unmarkedCount} Required Question${unmarkedCount > 1 ? 's' : ''} UNMARKED!`;
            } else {
                badge.className = "scorecard-unmarked-pill all-graded";
                badge.textContent = `✓ Required Questions Graded (100% Complete)`;
            }
        }
    }

    bindWorkspaceControls() {
        // Back to Dashboard button
        const backBtn = document.getElementById("ws-btn-back");
        if (backBtn) {
            backBtn.onclick = async (e) => {
                e.preventDefault();
                await this.handleBackToDashboard();
            };
        }

        // Print Scorecard button
        const btnPrintScorecard = document.getElementById("btn-print-scorecard-report");
        if (btnPrintScorecard) {
            btnPrintScorecard.addEventListener("click", () => {
                this.renderScorecardTable();
                window.print();
            });
        }

        // Toggle Scorecard Collapse
        const btnToggleScorecard = document.getElementById("btn-toggle-scorecard-collapse");
        const scorecardTableWrap = document.getElementById("ws-scorecard-table-container");
        const collapseLabel = document.getElementById("scorecard-collapse-label");
        if (btnToggleScorecard && scorecardTableWrap) {
            btnToggleScorecard.addEventListener("click", () => {
                const isHidden = scorecardTableWrap.style.display === "none";
                scorecardTableWrap.style.display = isHidden ? "block" : "none";
                if (collapseLabel) collapseLabel.textContent = isHidden ? "Hide Table" : "Show Table";
            });
        }

        // Left toolbar buttons
        const toolButtons = document.querySelectorAll(".tool-button");
        toolButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const toolName = btn.getAttribute("data-tool");
                this.selectTool(toolName);
            });
        });

        // Top bar tools
        const btnUndo = document.getElementById("ws-btn-undo");
        if (btnUndo) btnUndo.addEventListener("click", () => this.canvasEngine?.undo());

        const btnRedo = document.getElementById("ws-btn-redo");
        if (btnRedo) btnRedo.addEventListener("click", () => this.canvasEngine?.redo());

        const btnZoomIn = document.getElementById("ws-btn-zoom-in");
        if (btnZoomIn) btnZoomIn.addEventListener("click", () => this.canvasEngine?.zoomIn());

        const btnZoomOut = document.getElementById("ws-btn-zoom-out");
        if (btnZoomOut) btnZoomOut.addEventListener("click", () => this.canvasEngine?.zoomOut());

        const btnFitW = document.getElementById("ws-btn-fit-width");
        if (btnFitW) btnFitW.addEventListener("click", () => this.canvasEngine?.fitToWidth());

        const btnFitP = document.getElementById("ws-btn-fit-page");
        if (btnFitP) btnFitP.addEventListener("click", () => this.canvasEngine?.fitToPage());

        const zoomBadge = document.getElementById("ws-zoom-pct-badge");
        if (zoomBadge) {
            zoomBadge.addEventListener("click", () => {
                if (!this.canvasEngine) return;
                const cur = Math.round(this.canvasEngine.zoom * 100);
                if (Math.abs(cur - 100) < 6) {
                    this.canvasEngine.fitToPage();
                } else if (Math.abs(cur - 85) < 6) {
                    this.canvasEngine.setZoom(1.0);
                } else {
                    this.canvasEngine.setZoom(0.85);
                }
            });
        }

        const btnFullscreen = document.getElementById("ws-btn-fullscreen");
        if (btnFullscreen) {
            btnFullscreen.addEventListener("click", () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            });
        }

        // Save Progress & Come Out (Exit Workspace to Dashboard)
        const btnSave = document.getElementById("ws-btn-save-progress");
        if (btnSave) {
            btnSave.addEventListener("click", async () => {
                const sName = this.activeEvaluation?.studentName || "student paper";
                this.showActionProgressModal({
                    title: "Saving Correction Paper",
                    subtitle: `Persisting marks, annotations, and student scorecard for ${sName}...`,
                    statusText: "Saving evaluation record to database..."
                });

                await this.saveActiveEvaluation(true);

                this.setActionProgressModalSuccess({
                    title: "✓ Correction Paper Saved!",
                    subtitle: `All marks, stamps, and feedback for ${sName} saved successfully.`,
                    statusText: "Exiting evaluation workspace...",
                    delayMs: 400,
                    onComplete: () => {
                        this.switchView("dashboard");
                        this.showToast("Evaluation saved! Returned to Dashboard.", "success");
                    }
                });
            });
        }

        // Save & Next Student
        const btnSaveNext = document.getElementById("ws-btn-save-next");
        if (btnSaveNext) {
            btnSaveNext.addEventListener("click", async () => {
                await this.saveAndGoNextStudent();
            });
        }

        // Floating Corner Action: Save & Next
        const btnFloatingSaveNext = document.getElementById("ws-floating-save-next-pill");
        if (btnFloatingSaveNext) {
            btnFloatingSaveNext.addEventListener("click", async () => {
                await this.saveAndGoNextStudent();
            });
        }

        // Correction Completed Modal Actions
        const btnCompletedRecheck = document.getElementById("btn-completed-recheck");
        if (btnCompletedRecheck) {
            btnCompletedRecheck.addEventListener("click", () => {
                this.closeCorrectionCompletedModal();
                this.showToast("Review mode active. Click 'Save & Next' in the corner whenever you are done.", "info");
            });
        }

        const btnCompletedSaveNext = document.getElementById("btn-completed-save-next");
        if (btnCompletedSaveNext) {
            btnCompletedSaveNext.addEventListener("click", async () => {
                await this.handleCompletedSaveAndNext();
            });
        }

        const btnCloseCompleted = document.getElementById("btn-close-completed-modal");
        if (btnCloseCompleted) {
            btnCloseCompleted.addEventListener("click", () => {
                this.closeCorrectionCompletedModal();
            });
        }

        // Close completion modal on backdrop click to allow re-checking paper
        const compModalEl = document.getElementById("modal-correction-completed");
        if (compModalEl) {
            compModalEl.addEventListener("click", (e) => {
                if (e.target === compModalEl) {
                    this.closeCorrectionCompletedModal();
                }
            });
        }

        // Absent overlay buttons
        const btnAbsentMark = document.getElementById("btn-absent-mark-confirm");
        if (btnAbsentMark) {
            btnAbsentMark.addEventListener("click", async () => {
                if (this._absentStudentEval) {
                    this._absentStudentEval.status = "Absent";
                    await window.appStorage.saveEvaluation(this._absentStudentEval);
                    this.showToast(`${this._absentStudentEval.studentName} marked Absent.`);
                }
                await this.goToNextStudentInQueue();
            });
        }
        const btnAbsentSkip = document.getElementById("btn-absent-skip");
        if (btnAbsentSkip) {
            btnAbsentSkip.addEventListener("click", async () => {
                await this.goToNextStudentInQueue();
            });
        }

        // Export Excel
        const btnExcel = document.getElementById("ws-btn-export-excel");
        if (btnExcel) {
            btnExcel.addEventListener("click", () => {
                this.exportEvaluationsAsExcel();
            });
        }

        // Generate PDF
        const btnPdf = document.getElementById("ws-btn-export-pdf");
        if (btnPdf) {
            btnPdf.addEventListener("click", async () => {
                await this.saveActiveEvaluation(false);
                await this.downloadEvaluationPDF(this.activeEvaluation);
            });
        }

        // Save & Report Button (Tamil / Instant Report)
        const btnSaveReport = document.getElementById("ws-btn-save-report");
        if (btnSaveReport) {
            btnSaveReport.addEventListener("click", async () => {
                if (!this.activeEvaluation) return;
                await this.saveActiveEvaluation(true);
                this.showToast("✓ Evaluation saved! Displaying report card...", "success");
                this.showTamilReportCardModal(this.activeEvaluation);
            });
        }

        // Reset Current Paper
        const btnResetPaper = document.getElementById("ws-btn-reset-paper");
        if (btnResetPaper) {
            btnResetPaper.addEventListener("click", () => {
                if (!this.activeEvaluation) return;
                this.showResetPaperDialog(async () => {
                    await this.resetActivePaperFully();
                });
            });
        }

        // Replace / Upload Student PDF Paper
        const btnReplacePdf = document.getElementById("ws-btn-replace-pdf");
        const inputReplacePdf = document.getElementById("ws-input-replace-pdf");
        if (btnReplacePdf && inputReplacePdf) {
            btnReplacePdf.addEventListener("click", () => {
                inputReplacePdf.click();
            });
            inputReplacePdf.addEventListener("change", async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file || !this.activeEvaluation) return;
                try {
                    this.showToast(`Ingesting ${file.name}...`);
                    await this.loadStudentFileIntoWorkspace(file);
                } catch (err) {
                    console.error("Error loading PDF:", err);
                    this.showToast("Failed to load PDF: " + err.message);
                } finally {
                    inputReplacePdf.value = "";
                }
            });
        }

        // Delete Current Paper
        const btnDeletePaper = document.getElementById("ws-btn-delete-paper");
        if (btnDeletePaper) {
            btnDeletePaper.addEventListener("click", () => {
                if (!this.activeEvaluation || !this.activeEvaluation.id) return;
                const targetEval = this.activeEvaluation;
                this.showDeletePaperDialog(targetEval, async () => {
                    await window.appStorage.deleteEvaluation(targetEval.id);
                    this.showToast(`Deleted ${targetEval.studentName || 'student'}'s paper.`);
                    this.activeEvaluation = null;
                    await this.loadEvaluations();
                    this.switchView("dashboard");
                });
            });
        }

        // Mobile drawer toggle
        const drawerBtn = document.getElementById("ws-btn-mobile-drawer");
        if (drawerBtn) {
            drawerBtn.addEventListener("click", () => {
                const panel = document.getElementById("marking-panel-container");
                if (panel) panel.classList.toggle("mobile-drawer-open");
            });
        }

        // --- Top Quick-Marking HUD Controls ---
        const hudPrev = document.getElementById("hud-btn-prev-q");
        if (hudPrev) hudPrev.addEventListener("click", () => this.markingPanel?.prevQuestion());

        const hudNext = document.getElementById("hud-btn-next-q");
        if (hudNext) hudNext.addEventListener("click", () => this.markingPanel?.nextQuestion());

        // Step Marks (+0.5, +1.0)
        const hudStepHalf = document.getElementById("hud-btn-step-half");
        if (hudStepHalf) {
            hudStepHalf.addEventListener("click", () => {
                this.markingPanel?.addStepMark(0.5);
                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) {
                    this.updateTopHud(activeQ);
                    this.updatePageTotalDisplay();
                    if (this.canvasEngine) {
                        this.canvasEngine.setMarksValue(`+0.5`);
                    }
                    this.showToast(`+0.5 Step added (Total: ${activeQ.awardedMarks}/${activeQ.maxMarks}M). Press Enter to calculate & advance.`);
                }
            });
        }

        const hudStepOne = document.getElementById("hud-btn-step-one");
        if (hudStepOne) {
            hudStepOne.addEventListener("click", () => {
                this.markingPanel?.addStepMark(1.0);
                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) {
                    this.updateTopHud(activeQ);
                    this.updatePageTotalDisplay();
                    if (this.canvasEngine) {
                        this.canvasEngine.setMarksValue(`+1`);
                    }
                    this.showToast(`+1.0 Step added (Total: ${activeQ.awardedMarks}/${activeQ.maxMarks}M). Press Enter to calculate & advance.`);
                }
            });
        }

        // Quick Mark Buttons (Integers & Half Marks)
        document.querySelectorAll(".hud-mark-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const val = Number(btn.getAttribute("data-mark"));
                this.markingPanel?.setActiveQuestionMark(val);
                if (this.canvasEngine) {
                    this.canvasEngine.setMarksValue(val > 0 ? `+${val}` : "0");
                    const activeQ = this.markingPanel?.getActiveQuestion();
                    if (activeQ) {
                        const curPage = this.canvasEngine.pages[this.canvasEngine.currentPageIndex];
                        const existingMarginMark = (curPage?.annotations || []).find(a => 
                            (a.type === "margin_mark" || a.type === "left_mark") && 
                            this.canvasEngine.normalizeQKey(a.qNo || a.qLabel) === this.canvasEngine.normalizeQKey(activeQ.qNo)
                        );
                        if (existingMarginMark) {
                            existingMarginMark.marks = val;
                            this.canvasEngine.renderOverlay();
                            this.canvasEngine.notifyChange();
                        }
                    }
                }
                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) {
                    this.updateTopHud(activeQ);
                    this.updatePageTotalDisplay();
                    this.showToast(`Selected ${val}M for Q${activeQ.qNo}. Press Enter to calculate & advance.`);
                }
            });
        });

        // Custom Score Input & Apply button
        const applyCustom = () => {
            const inp = document.getElementById("hud-custom-score-inp");
            if (!inp) return;
            const raw = (inp.value || "").trim();
            const activeIdx = this.markingPanel?.activeQuestionIndex;
            if (raw === "") {
                if (typeof activeIdx === "number" && activeIdx >= 0) {
                    this.markingPanel?.clearQuestionMark(activeIdx);
                }
                return;
            }
            const val = Math.max(0, Number(raw));
            if (isNaN(val)) return;
            this.markingPanel?.setActiveQuestionMark(val);
            if (this.canvasEngine) {
                this.canvasEngine.setMarksValue(`+${val}`);
            }
            const activeQ = this.markingPanel?.getActiveQuestion();
            if (activeQ) this.updateTopHud(activeQ);
        };

        const btnApplyCustom = document.getElementById("hud-btn-apply-custom");
        if (btnApplyCustom) btnApplyCustom.addEventListener("click", applyCustom);

        const customInpEl = document.getElementById("hud-custom-score-inp");
        if (customInpEl) {
            customInpEl.addEventListener("input", (e) => {
                if (e.target.value.trim() === "") {
                    const activeIdx = this.markingPanel?.activeQuestionIndex;
                    if (typeof activeIdx === "number" && activeIdx >= 0) {
                        this.markingPanel?.clearQuestionMark(activeIdx);
                    }
                }
            });
            customInpEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                }
            });
        }

        // Stamp on Paper Button
        const stampBtn = document.getElementById("hud-btn-stamp-toggle");
        if (stampBtn) {
            stampBtn.addEventListener("click", () => {
                this.selectTool("marks");
                const q = this.markingPanel?.getActiveQuestion();
                if (q && this.canvasEngine) {
                    const markVal = q.awardedMarks > 0 ? `+${q.awardedMarks}` : `+${q.maxMarks}`;
                    this.canvasEngine.setMarksValue(markVal);
                }
                this.showToast("Marks stamp active: Click anywhere on the paper to place stamp");
            });
        }

        // Floating Pager Buttons
        const pagerPrev = document.getElementById("ws-pager-prev");
        if (pagerPrev) {
            pagerPrev.addEventListener("click", () => this.canvasEngine?.prevPage());
        }

        const pagerNext = document.getElementById("ws-pager-next");
        if (pagerNext) {
            pagerNext.addEventListener("click", () => this.canvasEngine?.nextPage());
        }
    }

    selectTool(toolName) {
        document.querySelectorAll(".tool-button").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-tool") === toolName);
        });

        if (this.canvasEngine) {
            this.canvasEngine.setTool(toolName);
        }
    }

    bindKeyboardShortcuts() {
        window.addEventListener("keydown", (e) => {
            // Only handle shortcuts when workspace is visible
            if (this.currentView !== "workspace") return;

            // Handle Completion Modal shortcuts:
            // Allow Escape to dismiss modal so the teacher can freely re-check the paper.
            // DO NOT auto-advance on Enter - user must explicitly click "Save & Go Next Student" button
            const compModal = document.getElementById("modal-correction-completed");
            if (compModal && compModal.style.display !== "none") {
                if (e.key === "Escape") {
                    e.preventDefault();
                    this.closeCorrectionCompletedModal();
                    return;
                }
                if (e.key === "Enter") {
                    // Prevent accidental Enter auto-advance when completion modal is visible
                    e.preventDefault();
                    return;
                }
            }

            // Prevent rapid autorepeat from skipping questions
            if (e.repeat) return;

            // Ignore when typing in input, textarea, button or select
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
            if (tag === "input" || tag === "textarea" || tag === "button" || tag === "select") return;

            const key = (e.key || "").toLowerCase();

            if (e.ctrlKey || e.metaKey) {
                if (key === "a") {
                    e.preventDefault();
                    this.canvasEngine?.selectAll();
                    this.showToast("All annotations selected on current page");
                } else if (key === "z") {
                    e.preventDefault();
                    if (e.shiftKey) this.canvasEngine?.redo();
                    else this.canvasEngine?.undo();
                } else if (key === "y") {
                    e.preventDefault();
                    this.canvasEngine?.redo();
                } else if (key === "s") {
                    e.preventDefault();
                    this.saveActiveEvaluation(true);
                    this.showToast("Progress saved!");
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    this.saveAndGoNextStudent();
                }
                return;
            }

            // Batch or single delete shortcut
            if (e.key === "Delete" || e.key === "Backspace") {
                if (this.canvasEngine) {
                    if (this.canvasEngine.selectedAnnotations && this.canvasEngine.selectedAnnotations.length > 1) {
                        e.preventDefault();
                        this.canvasEngine.deleteSelectedBatch();
                        return;
                    } else if (this.canvasEngine.selectedAnnotation) {
                        e.preventDefault();
                        this.canvasEngine.deleteAnnotation(this.canvasEngine.selectedAnnotation);
                        return;
                    }
                }
                // If no canvas annotation was selected, clear active question's mark from side and canvas
                const activeIdx = this.markingPanel?.activeQuestionIndex;
                if (typeof activeIdx === "number" && activeIdx >= 0 && this.markingPanel) {
                    const activeQ = this.markingPanel.getActiveQuestion();
                    if (activeQ && (activeQ.status !== "unmarked" || activeQ.awardedMarks > 0)) {
                        e.preventDefault();
                        this.markingPanel.clearQuestionMark(activeIdx);
                        this.showToast(`Cleared mark for Q${activeQ.qNo}. You can re-enter mark.`);
                        return;
                    }
                }
            }

            // Single key shortcuts
            switch (key) {
                case "v":
                    this.selectTool("select");
                    break;
                case "t":
                    this.selectTool("tick");
                    break;
                case "w":
                case "x":
                    this.selectTool("wrong");
                    break;
                case "c":
                    this.selectTool("circle");
                    break;
                case "e":
                    this.selectTool("eraser");
                    break;
                case "p":
                    this.selectTool("pen");
                    break;
                case "f":
                    e.preventDefault();
                    this.awardFullMarksWithMarginStamp();
                    break;
                case "s":
                    e.preventDefault();
                    if (this.markingPanel) {
                        const curQ = this.markingPanel.getActiveQuestion();
                        this.markingPanel.assignCurrentQuestionMark(0, "skipped");
                        this.markingPanel.nextQuestion();
                        this.showToast(`Q${curQ ? curQ.qNo : ''} marked as Skipped / Choice.`);
                    }
                    break;
                case "h":
                    e.preventDefault();
                    this.markingPanel?.addStepMark(0.5);
                    const aq = this.markingPanel?.getActiveQuestion();
                    if (aq) this.updateTopHud(aq);
                    this.updatePageTotalDisplay();
                    this.showToast(`+0.5 Step Mark awarded (Total: ${aq?.awardedMarks || 0}M). Press Enter to calculate & advance.`);
                    break;
                case "+":
                case "=":
                    e.preventDefault();
                    this.markingPanel?.addStepMark(1.0);
                    const stepQ = this.markingPanel?.getActiveQuestion();
                    if (stepQ) this.updateTopHud(stepQ);
                    this.updatePageTotalDisplay();
                    this.showToast(`+1.0 Step Mark awarded (Total: ${stepQ?.awardedMarks || 0}M). Press Enter to calculate & advance.`);
                    break;
                case "n":
                    e.preventDefault();
                    this.markingPanel?.nextQuestion();
                    break;
                case "arrowup":
                    e.preventDefault();
                    this.markingPanel?.prevQuestion();
                    break;
                case "arrowdown":
                    e.preventDefault();
                    this.markingPanel?.nextQuestion();
                    break;
            }

            // Enter key: calculate total step marks for active question (e.g. 1 + 1 + 1) → stamp question mark label in left margin → jump to next question
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const now = Date.now();
                if (this._lastEnterAdvanceTime && (now - this._lastEnterAdvanceTime < 300)) return;
                this._lastEnterAdvanceTime = now;

                this.commitActiveQuestionAndAdvance();
                return;
            }

            // Numeric quick mark shortcut: press 0..9 to set mark for active question
            if (e.key >= "0" && e.key <= "9") {
                const mark = Number(e.key);
                this.markingPanel?.setActiveQuestionMark(mark);
                if (this.canvasEngine) {
                    this.canvasEngine.setMarksValue(mark > 0 ? `+${mark}` : "0");
                }
                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) {
                    this.updateTopHud(activeQ);
                    this.updatePageTotalDisplay();
                }
                return;
            }
        });
    }

    commitActiveQuestionAndAdvance() {
        const committingQ = this.markingPanel?.getActiveQuestion();
        if (!committingQ) return;

        let totalMarks = 0;
        if (this.canvasEngine) {
            // Check if active question was explicitly set to 0 marks or wrong: strictly preserve 0!
            if (committingQ.status === "wrong" || committingQ.awardedMarks === 0 || committingQ.awardedMarks === "0") {
                totalMarks = 0;
            } else {
                // 1. Calculate sum from all step marks placed for this question on canvas (e.g. 1 + 1 + 1)
                const stepTotal = this.canvasEngine.getQuestionStepMarksSum(committingQ.qNo);
                if (stepTotal > 0) {
                    totalMarks = Math.min(committingQ.maxMarks, stepTotal);
                } else if (committingQ.awardedMarks !== undefined && committingQ.awardedMarks !== null && committingQ.awardedMarks > 0) {
                    totalMarks = Math.min(committingQ.maxMarks, committingQ.awardedMarks);
                } else {
                    totalMarks = 0;
                }
            }

            // 2. Assign calculated total to active question in marking panel
            const status = totalMarks >= committingQ.maxMarks ? "correct" : (totalMarks === 0 ? "wrong" : "partial");
            this.markingPanel?.assignCurrentQuestionMark(totalMarks, status);

            // 3. Stamp question mark label in left margin with 10px gap
            // Determine vertical position: align with question's annotations or last click position
            const curPage = this.canvasEngine.pages[this.canvasEngine.currentPageIndex];
            const qAnns = (curPage?.annotations || []).filter(a =>
                (a.type === "tick" || a.type === "marks" || a.type === "wrong") &&
                this.canvasEngine.normalizeQKey(a.qNo || a.qLabel) === this.canvasEngine.normalizeQKey(committingQ.qNo)
            );
            const targetY = qAnns.length > 0
                ? qAnns[qAnns.length - 1].y
                : (this.canvasEngine.lastClickNormPos ? this.canvasEngine.lastClickNormPos.y : (this.canvasEngine.currentCursorNormPos ? this.canvasEngine.currentCursorNormPos.y : 0.4));

            this.canvasEngine.stampRightMarginMark(committingQ.qNo, totalMarks, targetY);
            this.canvasEngine.renderOverlay();
        }

        this.updateTopHud(committingQ);
        this.updatePageTotalDisplay();

        // 4. Jump to next question
        const moved = this.markingPanel?.nextQuestion();
        if (moved) {
            const nextQ = this.markingPanel?.getActiveQuestion();
            if (nextQ) {
                this.updateTopHud(nextQ);
                this.showToast(`Q${committingQ.qNo}: ${totalMarks}/${committingQ.maxMarks}M stamped in left margin. Moved to ${nextQ.label || `Q${nextQ.qNo}`}`);
            }
        } else {
            this.showToast(`Q${committingQ.qNo}: ${totalMarks}/${committingQ.maxMarks}M stamped in left margin (Final question)`);
        }
    }

    // --- Autosave Engine ---

    startAutosave() {
        this.stopAutosave();
        // Local-only draft timer (0 Firebase cloud costs): persists draft strictly in browser memory & IndexedDB
        this.autosaveTimer = setInterval(async () => {
            if (this.hasUnsavedChanges && this.activeEvaluation) {
                // syncToCloud = false: Never writes to Firebase cloud on interval timer!
                await this.saveActiveEvaluation(false, false);
            }
        }, 25000); // 25-second local draft interval
    }

    stopAutosave() {
        if (this.autosaveTimer) {
            clearInterval(this.autosaveTimer);
            this.autosaveTimer = null;
        }
    }

    async saveActiveEvaluation(notify = false, syncToCloud = false) {
        if (!this.activeEvaluation) return;

        // Sync to cloud ONLY when teacher explicitly saves (e.g. Save, Save & Next, Save & Report, or Ctrl+S)
        const isExplicitUserSave = notify === true || syncToCloud === true;

        if (isExplicitUserSave) {
            this.setAutosaveBadge("saving");
        }

        if (this.canvasEngine) {
            this.activeEvaluation.annotations = this.canvasEngine.getAllAnnotations();
            if ((!this.activeEvaluation.pages || this.activeEvaluation.pages.length === 0) && this.canvasEngine.pages && this.canvasEngine.pages.length > 0) {
                const cePages = this.canvasEngine.pages.map(p => p.imageSrc).filter(src => src && typeof src === "string" && !src.includes("evaluations_pdf"));
                if (cePages.length > 0) {
                    this.activeEvaluation.pages = cePages;
                }
            }
        }
        if (this.markingPanel) {
            const summary = this.markingPanel.getScoreSummary();
            this.activeEvaluation.obtainedMarks = summary.obtainedMarks;
            this.activeEvaluation.maxMarks = summary.maxMarks;
            this.activeEvaluation.percentage = summary.percentage;
            this.activeEvaluation.grade = summary.grade;
            this.activeEvaluation.feedback = summary.feedback;
            this.activeEvaluation.questions = summary.questions;
            // STRICT RULE: Only mark "Completed" / "Corrected" when teacher explicitly clicks Save or Save & Next!
            if (notify === true) {
                this.activeEvaluation.status = "Completed";
            }
        }

        this.activeEvaluation.lastUpdated = new Date().toISOString();
        this.activeEvaluation.updatedAt = new Date().toISOString();

        const currentEval = this.activeEvaluation;
        if (!currentEval || !currentEval.id) return;

        // Save to IndexedDB / local storage; ONLY sync to Firebase cloud when teacher explicitly clicks Save!
        try {
            await window.appStorage.saveEvaluation(currentEval, isExplicitUserSave);
        } catch (saveErr) {
            console.warn("Storage save warning:", saveErr);
        }

        if (this.activeEvaluation && this.activeEvaluation.id) {
            window.appStorage.saveDraft(this.activeEvaluation.id, this.activeEvaluation);
        } else if (currentEval && currentEval.id) {
            window.appStorage.saveDraft(currentEval.id, currentEval);
        }

        this.hasUnsavedChanges = false;
        if (isExplicitUserSave) {
            this.setAutosaveBadge("saved");
            console.log("Evaluation state persisted to Database & Cloud successfully.");
            this.checkAndSendSubjectCompletedNotification(currentEval);
        } else {
            this.setAutosaveBadge("draft");
        }
    }

    setAutosaveBadge(state) {
        const dot = document.querySelector(".autosave-dot");
        const text = document.getElementById("ws-autosave-text");
        if (!dot || !text) return;

        if (state === "saving") {
            dot.classList.add("saving");
            dot.classList.remove("unsaved");
            text.textContent = "Syncing to Cloud...";
        } else if (state === "unsaved") {
            dot.classList.remove("saving");
            dot.classList.add("unsaved");
            text.textContent = "Unsaved Changes • Click Save";
        } else if (state === "draft") {
            dot.classList.remove("saving", "unsaved");
            text.textContent = "Draft cached locally";
        } else {
            dot.classList.remove("saving", "unsaved");
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            text.textContent = `Saved at ${time}`;
        }
    }

    async downloadEvaluationPDF(evaluation) {
        try {
            const targetEval = evaluation || this.activeEvaluation;
            if (!targetEval) {
                this.showToast("No paper available to export.", "error");
                return;
            }

            const sName = targetEval.studentName || "Student";
            this.showActionProgressModal({
                title: "Generating Corrected Paper PDF",
                subtitle: `Rendering evaluated pages, margin stamps & scorecard for ${sName}...`,
                statusText: "Preparing high-resolution PDF document...",
                badgeText: "PDF Document"
            });

            if (this.activeEvaluation) {
                this.updateActionProgressModal(20, "Saving current annotations...");
                await this.saveActiveEvaluation(false);
            }

            this.updateActionProgressModal(35, "Rendering annotated pages & stamps...");

            const filename = await window.PDFGenerator.generateCorrectedPaperPDF(targetEval, (pct, status) => {
                const mappedPct = Math.round(35 + (pct * 0.6));
                this.updateActionProgressModal(mappedPct, status);
            });

            this.setActionProgressModalSuccess({
                title: "✓ PDF Export Complete!",
                subtitle: `Downloaded "${filename}" successfully.`,
                statusText: "Download initiated in your browser.",
                delayMs: 1100
            });
        } catch (err) {
            console.error("PDF generation failed:", err);
            this.closeActionProgressModal();
            this.showToast("Failed to generate PDF: " + err.message, "error");
        }
    }

    isPaperCorrected(e) {
        if (!e) return false;
        const s = (e.status || "").toLowerCase().trim();
        if (s === "completed" || s === "corrected" || s === "graded" || s === "evaluated") {
            return true;
        }
        if (e.percentage !== undefined && e.percentage !== null && Number(e.percentage) > 0 && s !== "pending" && s !== "in progress") {
            return true;
        }
        return false;
    }

    // --- Save & Next Student Navigation ---

    async saveAndGoNextStudent() {
        if (!this.activeEvaluation) return;
        const sName = this.activeEvaluation?.studentName || "student paper";
        const currentId = String(this.activeEvaluation?.id);

        this.showActionProgressModal({
            title: "Saving Paper & Loading Next",
            subtitle: `Persisting marks, annotations, and scorecard for ${sName}...`,
            statusText: "Writing evaluation record to database...",
            badgeText: "Save & Next"
        });

        // 1. Fast save active evaluation
        this.updateActionProgressModal(35, "Saving current evaluation record...");
        await this.saveActiveEvaluation(true);

        // 2. Scan queue for next paper
        this.updateActionProgressModal(70, "Scanning evaluation queue for next uncorrected paper...");
        const allEvaluations = await window.appStorage.getAllEvaluations(false, true);

        // Match current class/exam/subject or all assigned papers
        const currentClass = this.activeEvaluation?.class || this.activeEvaluation?.className;
        const currentSubject = this.activeEvaluation?.subject;
        let queue = Array.isArray(allEvaluations) ? [...allEvaluations] : [];

        if (currentSubject) {
            queue = queue.filter(e => window.appStorage.isSubjectMatch(e.subject, e.examName || e.templateName, currentSubject));
        }

        const currentExam = this.activeEvaluation?.examName || this.activeEvaluation?.templateName;
        if (currentExam) {
            const sameExam = queue.filter(e => (e.examName || e.templateName) === currentExam);
            if (sameExam.length > 0) queue = sameExam;
        }

        if (currentClass) {
            const sameClass = queue.filter(e => (e.class || e.className) === currentClass);
            if (sameClass.length > 0) queue = sameClass;
        }

        // Sort by roll number, then name
        const sorted = queue.sort((a, b) => {
            const rollA = parseInt((a.rollNo || "").replace(/\D/g, "")) || 0;
            const rollB = parseInt((b.rollNo || "").replace(/\D/g, "")) || 0;
            if (rollA !== rollB) return rollA - rollB;
            return (a.studentName || "").localeCompare(b.studentName || "");
        });

        const currentIdx = sorted.findIndex(e => String(e.id) === currentId);

        // Find next UNCORRECTED paper strictly:
        // 1. First search subsequent papers after currentIdx
        let nextEval = sorted.slice(currentIdx + 1).find(e => String(e.id) !== currentId && !this.isPaperCorrected(e)) || null;

        // 2. If no uncorrected paper found after currentIdx, wrap around from beginning of queue
        if (!nextEval && currentIdx > 0) {
            nextEval = sorted.slice(0, currentIdx).find(e => String(e.id) !== currentId && !this.isPaperCorrected(e)) || null;
        }

        // --- CASE 1: No next paper found (Queue is finished) ---
        if (!nextEval) {
            this.checkAndSendSubjectCompletedNotification(this.activeEvaluation);
            this.setActionProgressModalSuccess({
                title: "✓ Saved! No More Papers In Queue",
                subtitle: `All student papers have been evaluated successfully.`,
                statusText: "Returning to Dashboard...",
                delayMs: 1100,
                onComplete: () => {
                    this.switchView("dashboard");
                    this.showToast("All student papers evaluated! Returned to Dashboard.", "success");
                }
            });
            return;
        }

        // --- CASE 2: Next paper is found ---
        const nextName = nextEval.studentName || "Next Student";
        const fullEval = await window.appStorage.getEvaluationById(nextEval.id);
        const evalToOpen = fullEval || nextEval;

        if (!evalToOpen.pages || evalToOpen.pages.length === 0) {
            if (evalToOpen.pdfDataUrl) evalToOpen.pages = [evalToOpen.pdfDataUrl];
        }

        if (!evalToOpen.pages || evalToOpen.pages.length === 0) {
            this.closeActionProgressModal();
            this._absentStudentEval = evalToOpen;
            const absentOverlay = document.getElementById("ws-absent-overlay");
            const nameEl = document.getElementById("absent-student-name");
            if (nameEl) nameEl.textContent = `${evalToOpen.studentName || "Student"} (Roll: ${evalToOpen.rollNo || "—"})`;
            if (absentOverlay) absentOverlay.style.display = "flex";
            return;
        }

        this.setActionProgressModalSuccess({
            title: "✓ Saved! Loading Next Student",
            subtitle: `Now opening ${nextName} (Roll: ${evalToOpen.rollNo || "—"})...`,
            statusText: "Rendering answer sheet pages...",
            delayMs: 400,
            onComplete: async () => {
                await this.openWorkspace(evalToOpen);
                this.showToast(`Loaded ${nextName}'s answer sheet.`, "success");
            }
        });
    }

    async goToNextStudentInQueue() {
        return this.saveAndGoNextStudent();
    }

    // --- Correction Completed Modal & Floating Save & Next Pill ---

    showCorrectionCompletedModal(summary) {
        if (!this.activeEvaluation || this.currentView !== "workspace") return;

        const modal = document.getElementById("modal-correction-completed");
        if (!modal) return;

        // Blur active element so keyboard events do not trigger buttons accidentally
        if (document.activeElement && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
        }

        const sName = this.activeEvaluation.studentName || "Student";
        const rNo = this.activeEvaluation.rollNo || "—";
        const cls = this.activeEvaluation.class || this.activeEvaluation.className || "";
        const sub = this.activeEvaluation.subject || "";
        const obt = summary && summary.obtainedMarks !== undefined ? summary.obtainedMarks : (this.activeEvaluation.obtainedMarks || 0);
        const max = summary && summary.maxMarks !== undefined ? summary.maxMarks : (this.activeEvaluation.maxMarks || 0);
        const pct = summary && summary.percentage !== undefined ? summary.percentage : (max > 0 ? Math.round((obt / max) * 100) : 0);
        const grade = summary && summary.grade ? summary.grade : (this.activeEvaluation.grade || "A1");

        const metaEl = document.getElementById("completed-student-meta");
        if (metaEl) {
            metaEl.textContent = sName + " • Roll No: " + rNo + (cls ? " • " + cls : "") + (sub ? " • " + sub : "");
        }

        const scoreEl = document.getElementById("completed-score-val");
        if (scoreEl) scoreEl.textContent = obt + " / " + max;

        const pctEl = document.getElementById("completed-pct-val");
        if (pctEl) pctEl.textContent = pct + "%";

        const gradeEl = document.getElementById("completed-grade-val");
        if (gradeEl) gradeEl.textContent = grade;

        // Display modal
        modal.style.display = "flex";

        // Show floating Save & Next pill in the corner as well
        this.updateFloatingSaveNextPill(true, obt, max);
    }

    closeCorrectionCompletedModal() {
        const modal = document.getElementById("modal-correction-completed");
        if (modal) modal.style.display = "none";
    }

    async handleCompletedSaveAndNext() {
        this.closeCorrectionCompletedModal();
        await this.saveAndGoNextStudent();
    }

    updateFloatingSaveNextPill(show, obt = null, max = null) {
        const pill = document.getElementById("ws-floating-save-next-pill");
        if (!pill) return;
        if (show && this.currentView === "workspace" && this.activeEvaluation) {
            pill.style.display = "inline-flex";
            const scoreTag = document.getElementById("ws-floating-score-badge");
            if (scoreTag && obt !== null && max !== null) {
                scoreTag.textContent = obt + "/" + max + "M";
            }
        } else {
            pill.style.display = "none";
        }
    }

    // --- Tamil "Test Me!" Interactive Evaluation Engine ---

    generateTamilTestPage(pageNum = 1, rollNo = "TAM-TEST-01", studentName = "Tamil Demo Student (Test Me)") {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 1650;
        const ctx = canvas.getContext("2d");

        // Cream paper background
        ctx.fillStyle = "#FAFBFD";
        ctx.fillRect(0, 0, 1200, 1650);

        // Header Card Banner
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(40, 30, 1120, 130);
        ctx.strokeStyle = "#CBD5E1";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(40, 30, 1120, 130);

        // Institution & Exam Title
        ctx.fillStyle = "#0F172A";
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.fillText("ADWAITH THOUGHT ACADEMY • DIGITAL EXAMINATION SYSTEM", 60, 68);

        ctx.fillStyle = "#0071E3";
        ctx.font = "600 16px system-ui, -apple-system, sans-serif";
        ctx.fillText("வகுப்பு 10 • தமிழ் (Class 10 Tamil) • Revision 1 Objective 2026", 60, 100);

        // Student Info sub-row
        ctx.fillStyle = "#475569";
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.fillText(`Student: ${studentName}  |  Roll No: ${rollNo}  |  Class: 10-A  |  Max Marks: 40M  |  Page ${pageNum} of 2`, 60, 132);

        // Section Title Banner
        ctx.fillStyle = "#E0F2FE";
        ctx.fillRect(40, 175, 1120, 40);
        ctx.strokeStyle = "#BAE6FD";
        ctx.strokeRect(40, 175, 1120, 40);
        ctx.fillStyle = "#0369A1";
        ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
        const secSub = pageNum === 1
            ? "பகுதி - அ (Section A) - புறவய வினாக்கள் (Q1 முதல் Q20 வரை - 1 மதிப்பெண்)"
            : "பகுதி - அ (Section A) - தொடர்ச்சி (Q21 முதல் Q40 வரை - 1 மதிப்பெண்)";
        ctx.fillText(secSub, 60, 201);

        // Margin Column Line (Red vertical line)
        ctx.strokeStyle = "rgba(225, 29, 72, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(140, 225);
        ctx.lineTo(140, 1600);
        ctx.stroke();

        // Column Titles
        ctx.fillStyle = "#94A3B8";
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.fillText("வினா", 70, 248);
        ctx.fillText("மாணவர் விடை (Student Answer Sheet)", 165, 248);

        // Horizontal Lined Rulings
        ctx.strokeStyle = "rgba(0, 113, 227, 0.08)";
        ctx.lineWidth = 1;
        for (let y = 265; y <= 1580; y += 65) {
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(1160, y);
            ctx.stroke();
        }

        // 20 Sample Questions & Realistic Student Answers per page
        const startQ = pageNum === 1 ? 1 : 21;
        const endQ = pageNum === 1 ? 20 : 40;

        const sampleAnswers = [
            "அ) பாவலரேறு பெருஞ்சித்திரனார்",
            "ஆ) குறிஞ்சிப்பாட்டு",
            "இ) க. சச்சிதானந்தன்",
            "ஈ) பன்னாடு தந்த மாறன் வழுதி",
            "அ) வணிகக் கப்பல்களும் ஐம்பெரும் காப்பியங்களும்",
            "ஆ) மதுரை மாநகரம்",
            "இ) எட்டுத்தொகை நூல்கள்",
            "ஈ) உ.வே. சாமிநாதையர்",
            "அ) சிலப்பதிகாரம்",
            "ஆ) முல்லைப்பாட்டு",
            "இ) கம்பர்",
            "ஈ) திருவள்ளுவர்",
            "அ) நற்றிணை",
            "ஆ) குறுந்தொகை",
            "இ) ஐங்குறுநூறு",
            "ஈ) பதிற்றுப்பத்து",
            "அ) பரிபாடல்",
            "ஆ) கலித்தொகை",
            "இ) அகநானூறு",
            "ஈ) புறநானூறு"
        ];

        let qIndex = 0;
        for (let qNo = startQ; qNo <= endQ; qNo++) {
            const y = 295 + (qIndex * 65);

            // Q Number in margin column
            ctx.fillStyle = "#0F172A";
            ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
            ctx.fillText(`Q${qNo}`, 65, y);

            // Student written answer (realistic ink style)
            const ansText = sampleAnswers[qIndex % sampleAnswers.length];
            ctx.fillStyle = "#1E3A8A";
            ctx.font = "18px 'Courier New', monospace, system-ui";
            ctx.fillText(`விடை:  ${ansText}`, 170, y);

            // Marks badge placeholder in right margin
            ctx.fillStyle = "#94A3B8";
            ctx.font = "12px system-ui, -apple-system, sans-serif";
            ctx.fillText("[ 1M ]", 1090, y);

            qIndex++;
        }

        // Bottom Footer
        ctx.fillStyle = "#94A3B8";
        ctx.font = "13px system-ui, -apple-system, sans-serif";
        ctx.fillText(`Adwaith Thought Academy • On-Screen Marking • Page ${pageNum} of 2`, 60, 1625);

        return canvas.toDataURL("image/jpeg", 0.92);
    }

    async launchTamilTestCorrection() {
        if (!window.appStorage) return;

        // Ensure portal is in evaluator/teacher mode
        this.setPortal("evaluator", false);

        const testPaperId = "eval_tamil_test_me_sample";

        // Generate 2-page realistic Tamil exam answer sheet
        const page1 = this.generateTamilTestPage(1, "TAM-TEST-01", "Tamil Demo Student (Test Me)");
        const page2 = this.generateTamilTestPage(2, "TAM-TEST-01", "Tamil Demo Student (Test Me)");

        const tpl = window.MockData?.tamilGrade10Revision1Template || {
            id: "tam-x-rev1-40",
            name: "10 TAMIL - Revision 1 Objective",
            examName: "Revision 1 Objective 2026",
            subject: "Tamil",
            maxMarks: 40,
            sections: [
                { id: "sec_a", letter: "A", name: "Section A", title: "Sec A: 40 Qs (40M)", qStartNo: 1, qEndNo: 40, qCount: 40, marksPerQ: 1, maxMarks: 40, secTotal: 40, hasChoice: false, hasSubQuestions: false, subQuestions: [] }
            ],
            questions: []
        };

        const questions = [];
        for (let i = 1; i <= 40; i++) {
            questions.push({
                id: `tam_test_q${i}`,
                qNo: i,
                qNumber: `Q${i}`,
                label: `Q${i}`,
                maxMarks: 1,
                awardedMarks: 0,
                status: "unmarked",
                section: "Section A",
                sectionId: "sec_a",
                topic: `Objective Question ${i}`,
                hasSubQuestions: false,
                subQuestions: []
            });
        }

        const testEvaluation = {
            id: testPaperId,
            studentName: "Tamil Demo Student (Test Me)",
            rollNo: "TAM-TEST-01",
            class: "Class 10-A",
            className: "Class 10-A",
            classLabel: "Class 10-A",
            subject: "Tamil",
            templateId: "tam-x-rev1-40",
            templateName: "10 TAMIL - Revision 1 Objective",
            examName: "Revision 1 Objective 2026",
            maxMarks: 40,
            obtainedMarks: 0,
            percentage: 0,
            grade: "--",
            status: "Pending",
            pageCount: 2,
            totalPages: 2,
            pages: [page1, page2],
            annotations: [],
            feedback: "",
            sections: JSON.parse(JSON.stringify(tpl.sections)),
            questions: questions,
            date: new Date().toISOString(),
            isTestMePaper: true
        };

        // Save to IndexedDB so it's persistent across reloads
        await window.appStorage.saveEvaluation(testEvaluation);

        // Open directly in the workspace!
        await this.openWorkspace(testEvaluation);

        if (this.showToast) {
            this.showToast("✍️ Test Me! paper loaded (40 Qs, 1M each). Draw markings, evaluate, click Save & Report!", "success");
        }
    }

    showTamilReportCardModal(evaluation) {
        const modalId = "tamil-report-card-modal-overlay";
        const old = document.getElementById(modalId);
        if (old) old.remove();

        const ev = evaluation || this.activeEvaluation || {};
        const obt = ev.obtainedMarks || 0;
        const max = ev.maxMarks || 40;
        const pct = max > 0 ? Math.round((obt / max) * 100) : 0;
        const grade = ev.grade || (pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F");

        const modal = document.createElement("div");
        modal.id = modalId;
        modal.className = "apple-dialog-overlay";
        modal.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px;";

        modal.innerHTML = `
            <div style="background: #FFFFFF; border-radius: 18px; width: 100%; max-width: 640px; box-shadow: 0 24px 50px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.08); overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;">
                <!-- Modal Header -->
                <div style="background: linear-gradient(135deg, #0F172A, #1E293B); color: #FFFFFF; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: #10B981; font-weight: 700; letter-spacing: 0.5px;">✓ Evaluation Report Generated</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; font-weight: 500; color: #FFFFFF;">Tamil Evaluation Scorecard</h3>
                    </div>
                    <button type="button" id="btn-close-tamil-report-modal" style="background: rgba(255,255,255,0.12); border: none; color: #FFFFFF; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center;">&times;</button>
                </div>

                <!-- Modal Body -->
                <div style="padding: 24px; overflow-y: auto; flex: 1;">
                    <!-- Student Meta Box -->
                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <h4 style="margin: 0; font-size: 1.05rem; color: #0F172A; font-weight: 600;">${ev.studentName || 'Student'}</h4>
                            <p style="margin: 4px 0 0; font-size: 0.82rem; color: #64748B;">Roll: <strong>${ev.rollNo || '-'}</strong> • Class: <strong>${ev.className || ev.class || 'Class 10-A'}</strong> • Subject: <strong>Tamil</strong></p>
                            <p style="margin: 2px 0 0; font-size: 0.78rem; color: #0071E3;">Blueprint: ${ev.templateName || '10 TAMIL - Revision 1 Objective'}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 2rem; font-weight: 700; color: ${pct >= 75 ? '#10B981' : pct >= 40 ? '#0071E3' : '#DC2626'};">${obt} <span style="font-size: 1.1rem; color: #94A3B8;">/ ${max}</span></div>
                            <span style="font-size: 0.82rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: rgba(16, 185, 129, 0.12); color: #10B981;">${pct}% • Grade ${grade}</span>
                        </div>
                    </div>

                    <!-- Questions 1-40 Breakdown Grid -->
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 0.88rem; font-weight: 600; color: #0F172A; margin: 0 0 10px; display: flex; justify-content: space-between;">
                            <span>Section A: 40 Questions Breakdown (1M each)</span>
                            <span style="color: #64748B; font-weight: 400; font-size: 0.78rem;">Status: ${ev.status || 'Completed'}</span>
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 6px;">
                            ${(ev.questions || []).map(q => {
                                const marks = Number(q.awardedMarks) || 0;
                                const isFull = marks >= q.maxMarks;
                                const isZero = marks === 0 && (q.status === 'wrong' || q.status === 'marked');
                                const bg = isFull ? 'rgba(16, 185, 129, 0.12)' : (isZero ? 'rgba(220, 38, 38, 0.12)' : '#F1F5F9');
                                const border = isFull ? '#10B981' : (isZero ? '#DC2626' : '#CBD5E1');
                                const textColor = isFull ? '#059669' : (isZero ? '#DC2626' : '#64748B');
                                return `
                                    <div style="border: 1px solid ${border}; background: ${bg}; border-radius: 8px; padding: 6px 2px; text-align: center;" title="Q${q.qNo}: ${marks}/${q.maxMarks}M">
                                        <div style="font-size: 0.68rem; color: #64748B;">Q${q.qNo}</div>
                                        <div style="font-size: 0.88rem; font-weight: 700; color: ${textColor};">${marks}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Modal Footer Actions -->
                <div style="padding: 16px 24px; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <button type="button" id="btn-tamil-report-back-dash" style="background: transparent; border: 1px solid #CBD5E1; color: #475569; padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer;">
                        ← Back to Teacher Desk
                    </button>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="btn-tamil-report-download-pdf" style="background: linear-gradient(135deg, #0071E3, #0056B3); border: none; color: #FFFFFF; padding: 8px 18px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <span>📥 Download PDF Report</span>
                        </button>
                        <button type="button" id="btn-tamil-report-done" style="background: #10B981; border: none; color: #FFFFFF; padding: 8px 18px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer;">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector("#btn-close-tamil-report-modal")?.addEventListener("click", () => modal.remove());
        modal.querySelector("#btn-tamil-report-done")?.addEventListener("click", () => modal.remove());
        modal.querySelector("#btn-tamil-report-back-dash")?.addEventListener("click", async () => {
            modal.remove();
            await this.switchView("dashboard");
        });
        modal.querySelector("#btn-tamil-report-download-pdf")?.addEventListener("click", async () => {
            await this.downloadEvaluationPDF(ev);
        });
    }

    // --- Bulk PDF Download ---

    async downloadBulkPDFs(evaluations = null) {
        try {
            let targetList = Array.isArray(evaluations) && evaluations.length > 0 ? evaluations : null;
            if (!targetList) {
                targetList = await window.appStorage.getAllEvaluations(false, true);
            }

            if (!targetList || targetList.length === 0) {
                this.showToast("No student papers available to download.", "error");
                return;
            }

            const total = targetList.length;
            this.showActionProgressModal({
                title: `Bulk Downloading ${total} Evaluated PDF${total > 1 ? 's' : ''}`,
                subtitle: `Generating individual annotated answer sheets with official scorecards...`,
                statusText: `Preparing batch export (0/${total})...`,
                badgeText: "Bulk PDF Export"
            });

            let successCount = 0;
            for (let i = 0; i < total; i++) {
                const ev = targetList[i];
                const sName = ev.studentName || `Student ${i + 1}`;
                const stepPct = Math.round(((i + 1) / total) * 90);
                this.updateActionProgressModal(Math.max(10, stepPct), `Generating PDF ${i + 1} of ${total}: ${sName}...`);

                try {
                    let fullEval = ev;
                    if (!fullEval.pages || fullEval.pages.length === 0) {
                        const loaded = await window.appStorage.getEvaluationById(ev.id);
                        if (loaded) fullEval = loaded;
                    }
                    if (window.PDFGenerator && typeof window.PDFGenerator.generateCorrectedPaperPDF === "function") {
                        await window.PDFGenerator.generateCorrectedPaperPDF(fullEval);
                        successCount++;
                    }
                    // Polite delay between downloads to prevent browser pop-up blocking
                    await new Promise(r => setTimeout(r, 400));
                } catch (err) {
                    console.warn(`Error generating PDF for ${sName}:`, err);
                }
            }

            this.setActionProgressModalSuccess({
                title: "✓ Bulk PDF Export Complete!",
                subtitle: `Successfully exported and downloaded ${successCount} student PDF document${successCount > 1 ? 's' : ''}.`,
                statusText: "Files downloaded to your system.",
                delayMs: 1400
            });
        } catch (err) {
            console.error("Bulk PDF export failed:", err);
            this.closeActionProgressModal();
            this.showToast("Bulk PDF export encountered an issue: " + err.message, "error");
        }
    }

    // --- Excel Export ---

    async exportEvaluationsAsExcel(evaluationsList = null) {
        try {
            this.showActionProgressModal({
                title: "Exporting Results Spreadsheet",
                subtitle: "Compiling student roster total marks and final grades...",
                statusText: "Fetching evaluation records from storage...",
                badgeText: "Excel / CSV"
            });

            this.updateActionProgressModal(25, "Reading evaluated papers from database...");
            await new Promise(r => setTimeout(r, 150));

            if (this.activeEvaluation) {
                await this.saveActiveEvaluation(false);
            }

            // Determine active subject from current panel / evaluation / teacher
            let activeSubject = null;
            if (this.activeEvaluation && this.activeEvaluation.subject) {
                activeSubject = this.activeEvaluation.subject;
            } else if (this.dashboardManager) {
                if (this.dashboardManager.selectedSubjectFilter && this.dashboardManager.selectedSubjectFilter !== "all") {
                    activeSubject = this.dashboardManager.selectedSubjectFilter;
                } else if (this.dashboardManager.teacherSubject && this.dashboardManager.teacherSubject !== "all") {
                    activeSubject = this.dashboardManager.teacherSubject;
                }
            }
            if (!activeSubject && window.appStorage) {
                const user = window.appStorage.getCurrentUser();
                if (user && user.assignedSubjects && user.assignedSubjects.length > 0 && !user.assignedSubjects.includes("All Subjects")) {
                    activeSubject = user.assignedSubjects[0];
                } else if (user && user.subject && user.subject !== "All Subjects") {
                    activeSubject = user.subject;
                }
            }

            let allEvaluations = null;
            if (Array.isArray(evaluationsList) && evaluationsList.length > 0) {
                // If caller provided an explicit list (e.g. selected checkboxes or batch papers), respect it directly!
                allEvaluations = [...evaluationsList];
                if (!activeSubject && allEvaluations[0]?.subject) {
                    activeSubject = allEvaluations[0].subject;
                }
            } else {
                allEvaluations = await window.appStorage.getAllEvaluations(false, true);
                if ((!allEvaluations || allEvaluations.length === 0) && this.activeEvaluation) {
                    allEvaluations = [this.activeEvaluation];
                } else if (this.activeEvaluation && !allEvaluations.some(e => e.id === this.activeEvaluation.id)) {
                    allEvaluations.unshift(this.activeEvaluation);
                }

                // Only filter by activeSubject if allEvaluations was loaded globally from storage
                if (activeSubject && activeSubject !== "all" && activeSubject !== "All Subjects") {
                    const filtered = allEvaluations.filter(ev => {
                        return window.appStorage 
                            ? window.appStorage.isSubjectMatch(ev.subject, ev.examName, activeSubject, ev.templateName)
                            : ((ev.subject || "").toLowerCase().includes(activeSubject.toLowerCase()));
                    });
                    if (filtered.length > 0) {
                        allEvaluations = filtered;
                    }
                }
            }

            if (!allEvaluations || allEvaluations.length === 0) {
                this.closeActionProgressModal();
                this.showToast(`No evaluation records found to export.`, "warning");
                return;
            }

            this.updateActionProgressModal(65, `Formatting ${allEvaluations.length} student total marks records...`);
            await new Promise(r => setTimeout(r, 180));

            // Clean total marks format — NO individual question marks
            const headers = [
                "S.No",
                "Roll No",
                "Student Name",
                "Class",
                "Section",
                "Subject",
                "Examination",
                "Total Marks Obtained",
                "Max Marks",
                "Percentage",
                "Grade",
                "Status"
            ];

            const rows = allEvaluations.map((ev, idx) => {
                // If this is currently the active evaluation in session, use live scoring from markingPanel / activeEvaluation
                let actualObtained = ev.obtainedMarks;
                let actualMax = ev.maxMarks;
                let actualQuestions = ev.questions;

                if (this.activeEvaluation && String(this.activeEvaluation.id) === String(ev.id)) {
                    if (this.markingPanel && typeof this.markingPanel.obtainedMarksTotal === "number") {
                        actualObtained = this.markingPanel.obtainedMarksTotal;
                        actualMax = this.markingPanel.maxMarksTotal || actualMax;
                        actualQuestions = this.markingPanel.questions || actualQuestions;
                    } else if (this.activeEvaluation.obtainedMarks !== undefined) {
                        actualObtained = this.activeEvaluation.obtainedMarks;
                        actualMax = this.activeEvaluation.maxMarks || actualMax;
                        actualQuestions = this.activeEvaluation.questions || actualQuestions;
                    }
                }

                // Check draft if record in list is missing marks or has stale 0
                if ((actualObtained === undefined || actualObtained === null || actualObtained === 0) && window.appStorage && typeof window.appStorage.getDraft === "function") {
                    const draft = window.appStorage.getDraft(ev.id);
                    if (draft && draft.obtainedMarks !== undefined && Number(draft.obtainedMarks) > 0) {
                        actualObtained = draft.obtainedMarks;
                        if (draft.maxMarks) actualMax = draft.maxMarks;
                        if (draft.questions && draft.questions.length > 0) actualQuestions = draft.questions;
                    }
                }

                // If questions array exists and has scored answers, ensure obtained marks strictly reflects question sum
                if (Array.isArray(actualQuestions) && actualQuestions.length > 0) {
                    const qSum = actualQuestions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
                    const roundedQSum = Math.round(qSum * 10) / 10;
                    // If question marks sum is greater than 0, or if ev.obtainedMarks was 0/undefined while questions had awarded marks
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

                const pct = finalMax > 0 
                    ? Math.round((finalObtained / finalMax) * 100) 
                    : (ev.percentage !== undefined ? ev.percentage : 0);
                const gradeInfo = window.calculateGradeScale 
                    ? window.calculateGradeScale(finalObtained, finalMax) 
                    : { grade: ev.grade || "--" };

                return [
                    idx + 1,
                    ev.rollNo || "",
                    ev.studentName || "",
                    ev.class || ev.className || "",
                    ev.section || "",
                    ev.subject || activeSubject || "General",
                    ev.examName || ev.templateName || "Examination",
                    finalObtained,
                    finalMax,
                    `${pct}%`,
                    ev.grade || gradeInfo.grade || "--",
                    ev.status || "Completed"
                ];
            });

            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell !== undefined && cell !== null ? cell : '').replace(/"/g, '""')}"`).join(","))
                .join("\r\n");

            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const safeSub = (activeSubject || allEvaluations[0]?.subject || "Class").replace(/[^a-zA-Z0-9_-]/g, "_");
            const firstCls = (allEvaluations[0]?.classLabel || allEvaluations[0]?.className || allEvaluations[0]?.class || "Marks").replace(/[^a-zA-Z0-9_-]/g, "_");
            const date = new Date().toISOString().slice(0, 10);
            a.download = `${safeSub}_${firstCls}_Marks_Report_${date}.csv`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                try {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (e) {}
            }, 2000);

            this.setActionProgressModalSuccess({
                title: "✓ Excel Spreadsheet Ready!",
                subtitle: `Exported ${allEvaluations.length} student total marks records.`,
                statusText: "Downloaded CSV/Excel marks file.",
                delayMs: 1100
            });
        } catch (err) {
            console.error("Excel export failed:", err);
            this.closeActionProgressModal();
            this.showToast("Failed to export results: " + err.message, "error");
        }
    }

    // --- Unified Action Progress Modal (Save, Export PDF, Export Excel) ---

    showActionProgressModal({ title, subtitle, statusText = "Processing..." }) {
        const modalId = "modal-action-progress-dialog";
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const backdrop = document.createElement("div");
        backdrop.id = modalId;
        backdrop.className = "publish-loading-backdrop";
        backdrop.innerHTML = `
            <div class="publish-loading-card" id="action-progress-card">
                <div class="publish-modal-icon-wrap" id="action-dialog-icon">
                    <div class="publish-spinner-circle"></div>
                </div>
                <h3 class="publish-modal-title" id="action-dialog-title">${title}</h3>
                <p class="publish-modal-subtitle" id="action-dialog-subtitle">${subtitle}</p>
                <div class="publish-progress-section">
                    <div class="publish-progress-row">
                        <span class="publish-progress-status" id="action-dialog-status">${statusText}</span>
                        <span class="publish-progress-percent" id="action-dialog-percent">0%</span>
                    </div>
                    <div class="publish-track">
                        <div class="publish-bar" id="action-dialog-bar" style="width: 0%;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
    }

    updateActionProgressModal(percent, statusText) {
        const statusEl = document.getElementById("action-dialog-status");
        const percentEl = document.getElementById("action-dialog-percent");
        const barEl = document.getElementById("action-dialog-bar");

        if (statusEl && statusText) statusEl.textContent = statusText;
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
    }

    setActionProgressModalSuccess({ title, subtitle, statusText, delayMs = 1000, onComplete = null }) {
        const iconWrap = document.getElementById("action-dialog-icon");
        const titleEl = document.getElementById("action-dialog-title");
        const subEl = document.getElementById("action-dialog-subtitle");
        const statusEl = document.getElementById("action-dialog-status");
        const percentEl = document.getElementById("action-dialog-percent");
        const barEl = document.getElementById("action-dialog-bar");

        if (iconWrap) {
            iconWrap.innerHTML = `
                <div style="width: 58px; height: 58px; border-radius: 50%; background: #34C759; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(52, 199, 89, 0.4);">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            `;
        }
        if (titleEl) titleEl.textContent = title || "✓ Completed Successfully!";
        if (subEl && subtitle) subEl.textContent = subtitle;
        if (statusEl && statusText) statusEl.textContent = statusText;
        if (percentEl) percentEl.textContent = "100%";
        if (barEl) {
            barEl.style.width = "100%";
            barEl.style.background = "#34C759";
        }

        setTimeout(() => {
            const backdrop = document.getElementById("modal-action-progress-dialog");
            if (backdrop) backdrop.remove();
            if (typeof onComplete === "function") onComplete();
        }, delayMs);
    }

    closeActionProgressModal() {
        const backdrop = document.getElementById("modal-action-progress-dialog");
        if (backdrop) backdrop.remove();
    }

    showDeletePaperDialog(ev, onDeleted) {
        if (!ev || !ev.id) return;
        const modalId = "ws-delete-modal-overlay";
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const rawDate = ev.updatedAt || ev.lastUpdated || ev.createdAt;
        let lastUpdatedStr = "—";
        if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                lastUpdatedStr = `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })}`;
            }
        }

        const isCorr = this.isPaperCorrected(ev);
        const statusLabel = isCorr ? "Corrected" : "Uncorrected (Pending)";
        const statusColor = isCorr ? "#16A34A" : "#D97706";

        const modal = document.createElement("div");
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: fadeInModal 0.2s ease-out;
        `;

        modal.innerHTML = `
            <style>
                @keyframes fadeInModal {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes spinLoading {
                    to { transform: rotate(360deg); }
                }
            </style>
            <div style="background: #FFFFFF; border-radius: 16px; max-width: 460px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.22); overflow: hidden; border: 1px solid #E2E8F0;">
                <div style="padding: 24px; text-align: center;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.2rem; font-weight: 700; color: #0F172A; margin: 0 0 8px;">Delete Answer Sheet</h3>
                    <p style="font-size: 0.88rem; color: #64748B; margin: 0 0 18px; line-height: 1.45;">
                        Are you sure you want to permanently delete this paper? All marks, annotations, and evaluations will be removed.
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; text-align: left; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Student:</span>
                            <span style="font-size: 0.85rem; font-weight: 700; color: #1E293B;">${ev.studentName || "Unnamed Student"}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Roll Number:</span>
                            <span style="font-size: 0.82rem; font-weight: 600; color: #334155; font-family: monospace;">${ev.rollNo || "—"}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Class & Subject:</span>
                            <span style="font-size: 0.82rem; font-weight: 500; color: #334155;">${ev.class || ev.className || "Class 12"} • ${ev.subject || "Physics"}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Status:</span>
                            <span style="font-size: 0.82rem; font-weight: 700; color: ${statusColor};">${statusLabel}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 0.8rem; color: #64748B;">Last Updated:</span>
                            <span style="font-size: 0.8rem; color: #475569;">${lastUpdatedStr}</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="ws-btn-cancel-delete" style="flex: 1; height: 42px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.15s ease;">
                            Cancel
                        </button>
                        <button type="button" id="ws-btn-confirm-delete" style="flex: 1; height: 42px; border-radius: 10px; border: none; background: #DC2626; color: #FFFFFF; font-weight: 600; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s ease;">
                            <span id="ws-btn-delete-text">Delete Paper</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector("#ws-btn-cancel-delete");
        const confirmBtn = modal.querySelector("#ws-btn-confirm-delete");
        const delText = modal.querySelector("#ws-btn-delete-text");

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.remove();
        });

        confirmBtn.addEventListener("click", async () => {
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.75";
            confirmBtn.style.cursor = "not-allowed";
            delText.innerHTML = `<span style="display: inline-block; width: 15px; height: 15px; border: 2px solid #FFFFFF; border-top-color: transparent; border-radius: 50%; animation: spinLoading 0.7s linear infinite; margin-right: 6px; vertical-align: middle;"></span> Deleting...`;

            try {
                if (onDeleted) await onDeleted();
                delText.innerHTML = `✓ Deleted`;
                confirmBtn.style.background = "#16A34A";
                await new Promise(r => setTimeout(r, 400));
                modal.remove();
            } catch (err) {
                console.error("Delete error:", err);
                cancelBtn.disabled = false;
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = "1";
                confirmBtn.style.cursor = "pointer";
                delText.textContent = "Delete Paper";
            }
        });
    }

    showResetPaperDialog(onConfirm) {
        if (!this.activeEvaluation) return;
        const ev = this.activeEvaluation;
        const modal = document.createElement("div");
        modal.className = "confirm-modal-backdrop";
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(4px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: fadeInModal 0.2s ease-out;
        `;

        modal.innerHTML = `
            <div style="background: #FFFFFF; border-radius: 16px; max-width: 440px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.22); overflow: hidden; border: 1px solid #E2E8F0;">
                <div style="padding: 24px; text-align: center;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.15rem; font-weight: 400 !important; color: #0F172A; margin: 0 0 8px;">Reset Paper Evaluation?</h3>
                    <p style="font-size: 0.88rem; font-weight: 400 !important; color: #64748B; margin: 0 0 18px; line-height: 1.45;">
                        Are you sure you want to reset this paper? All annotations, marks, and feedback on <span style="color: #0F172A;">${ev.studentName || "this paper"}</span> will be cleared and reset to fresh Pending state.
                    </p>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="ws-btn-cancel-reset" style="flex: 1; height: 42px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-weight: 400 !important; font-size: 0.88rem; cursor: pointer; transition: all 0.15s ease;">
                            Cancel
                        </button>
                        <button type="button" id="ws-btn-confirm-reset" style="flex: 1; height: 42px; border-radius: 10px; border: none; background: #D97706; color: #FFFFFF; font-weight: 400 !important; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s ease;">
                            <span id="ws-btn-reset-text">Reset Paper</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector("#ws-btn-cancel-reset");
        const confirmBtn = modal.querySelector("#ws-btn-confirm-reset");
        const resetText = modal.querySelector("#ws-btn-reset-text");

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.remove();
        });

        confirmBtn.addEventListener("click", async () => {
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.75";
            confirmBtn.style.cursor = "not-allowed";
            resetText.innerHTML = `<span style="display: inline-block; width: 15px; height: 15px; border: 2px solid #FFFFFF; border-top-color: transparent; border-radius: 50%; animation: spinLoading 0.7s linear infinite; margin-right: 6px; vertical-align: middle;"></span> Resetting...`;

            try {
                if (onConfirm) await onConfirm();
                resetText.innerHTML = `✓ Reset Complete`;
                confirmBtn.style.background = "#16A34A";
                await new Promise(r => setTimeout(r, 400));
                modal.remove();
            } catch (err) {
                console.error("Reset error:", err);
                cancelBtn.disabled = false;
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = "1";
                confirmBtn.style.cursor = "pointer";
                resetText.textContent = "Reset Paper";
            }
        });
    }

    async loadStudentFileIntoWorkspace(file) {
        if (!file || !this.activeEvaluation) return;

        await CanvasEngine.ensurePdfJs();
        let pdfDataUrl = null;
        let compressedPages = [];

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;

            for (let p = 1; p <= numPages; p++) {
                const page = await pdf.getPage(p);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(viewport.width);
                canvas.height = Math.round(viewport.height);
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: ctx, viewport }).promise;
                compressedPages.push(canvas.toDataURL("image/jpeg", 0.78));
            }

            pdfDataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
        } else {
            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
            if (dataUrl) compressedPages.push(dataUrl);
        }

        if (compressedPages.length === 0 && !pdfDataUrl) {
            throw new Error("Could not parse file pages.");
        }

        this.activeEvaluation.pages = compressedPages.length > 0 ? compressedPages : [pdfDataUrl];
        if (pdfDataUrl) this.activeEvaluation.pdfDataUrl = pdfDataUrl;
        this.activeEvaluation.pdfStorageUrl = null;
        this.activeEvaluation.rawFile = file;
        this.activeEvaluation.pageCount = compressedPages.length || 1;

        await window.appStorage.saveEvaluation(this.activeEvaluation);

        await this.canvasEngine.setPages(
            this.activeEvaluation.pages,
            this.activeEvaluation.annotations || [],
            this.activeEvaluation.pdfDataUrl,
            {
                studentName: this.activeEvaluation.studentName,
                rollNo: this.activeEvaluation.rollNo,
                subject: this.activeEvaluation.subject
            }
        );

        const pagerText = document.getElementById("ws-pager-text");
        if (pagerText && this.canvasEngine && this.canvasEngine.pages) {
            pagerText.textContent = `Page 1 of ${this.canvasEngine.pages.length}`;
        }
        this.canvasEngine.fitToPage();
        this.showToast(`✓ Loaded ${this.activeEvaluation.pageCount} page(s) from ${file.name}`);
    }

    async resetActivePaperFully() {
        if (!this.activeEvaluation) return;

        // 1. Wipe annotations from canvas engine
        if (this.canvasEngine) {
            this.canvasEngine.clearAllAnnotations();
        }

        // 2. Wipe questions & marks in marking panel
        if (this.markingPanel) {
            this.markingPanel.resetAllQuestions();
        }

        // 3. Reset evaluation model
        this.activeEvaluation.obtainedMarks = 0;
        this.activeEvaluation.percentage = 0;
        this.activeEvaluation.grade = "--";
        this.activeEvaluation.status = "Pending";
        this.activeEvaluation.feedback = "";
        this.activeEvaluation.correctCount = 0;
        this.activeEvaluation.wrongCount = 0;
        this.activeEvaluation.annotations = [];
        if (this.activeEvaluation.questions) {
            this.activeEvaluation.questions.forEach(q => {
                q.awardedMarks = 0;
                q.status = "unmarked";
            });
        }

        // 4. Update UI displays
        const topScoreEl = document.getElementById("ws-live-score-val");
        if (topScoreEl) {
            topScoreEl.textContent = `0 / ${this.activeEvaluation.maxMarks || 20}`;
        }
        const activeQ = this.markingPanel?.getActiveQuestion();
        if (activeQ) this.updateTopHud(activeQ);

        this.updatePageTotalDisplay();
        this.renderScorecardTable();

        // 5. Save reset state to storage
        this.hasUnsavedChanges = true;
        this.setAutosaveBadge("unsaved");
        await this.saveActiveEvaluation(true);
        this.showToast("Paper has been completely reset to initial state.", "info");
    }

    // --- Settings Modal & Firebase Bridge ---

    bindSettingsModal() {
        const modal = document.getElementById("modal-settings");
        const btnOpen = document.getElementById("btn-open-settings");
        const btnClose = document.getElementById("btn-close-settings");
        const btnCancel = document.getElementById("btn-cancel-settings");
        const btnSave = document.getElementById("btn-save-settings");
        const modeSelect = document.getElementById("settings-storage-mode");
        const fbFields = document.getElementById("firebase-config-fields");

        // Tabs
        const tabBtns = modal ? modal.querySelectorAll(".modal-tab-btn") : [];
        const tabPanes = modal ? modal.querySelectorAll(".settings-tab-pane") : [];

        const switchTab = (targetTabId) => {
            tabBtns.forEach(btn => {
                if (btn.getAttribute("data-tab") === targetTabId) {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            });
            tabPanes.forEach(pane => {
                if (pane.id === targetTabId) {
                    pane.classList.add("active");
                    pane.style.display = "block";
                } else {
                    pane.classList.remove("active");
                    pane.style.display = "none";
                }
            });
        };

        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const tabId = btn.getAttribute("data-tab");
                if (tabId) switchTab(tabId);
            });
        });

        // Profile live preview
        const nameInput = document.getElementById("settings-teacher-name");
        const previewName = document.getElementById("settings-preview-name");
        const previewAvatar = document.getElementById("settings-avatar-preview");

        const updateProfilePreview = (name) => {
            const trimmed = (name || "").trim() || "User";
            if (previewName) previewName.textContent = trimmed;
            const initials = trimmed
                .split(" ")
                .filter(Boolean)
                .map(w => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "US";
            if (previewAvatar) previewAvatar.textContent = initials;
        };

        if (nameInput) {
            nameInput.addEventListener("input", () => {
                updateProfilePreview(nameInput.value);
            });
        }

        // Password Reset Elements
        const currPassInput = document.getElementById("settings-curr-password");
        const newPassInput = document.getElementById("settings-new-password");
        const confirmPassInput = document.getElementById("settings-confirm-password");
        const btnResetPass = document.getElementById("btn-submit-password-reset");
        const statusBox = document.getElementById("password-reset-status");

        const showPassStatus = (msg, isSuccess) => {
            if (!statusBox) return;
            statusBox.style.display = "block";
            statusBox.className = `settings-status-box ${isSuccess ? "status-success" : "status-error"}`;
            statusBox.textContent = msg;
        };

        if (btnResetPass) {
            btnResetPass.addEventListener("click", async () => {
                const currPass = (currPassInput ? currPassInput.value : "").trim();
                const newPass = (newPassInput ? newPassInput.value : "").trim();
                const confirmPass = (confirmPassInput ? confirmPassInput.value : "").trim();

                const storedPass = await window.appStorage.getUserPassword();

                if (!currPass) {
                    showPassStatus("Please enter your current password.", false);
                    return;
                }
                if (currPass !== storedPass) {
                    showPassStatus("Current password is incorrect. Please verify and try again.", false);
                    return;
                }
                if (!newPass || newPass.length < 6) {
                    showPassStatus("New password must be at least 6 characters long.", false);
                    return;
                }
                if (newPass !== confirmPass) {
                    showPassStatus("New password and confirmation do not match.", false);
                    return;
                }

                await window.appStorage.saveUserPassword(newPass);
                showPassStatus("Password successfully updated! Your new password is now active.", true);

                if (currPassInput) currPassInput.value = "";
                if (newPassInput) newPassInput.value = "";
                if (confirmPassInput) confirmPassInput.value = "";

                this.showToast("Account password updated successfully!");
            });
        }

        const openModal = async () => {
            const settings = await window.appStorage.getSettings();
            const instEl = document.getElementById("settings-inst-name");
            const teacherEl = document.getElementById("settings-teacher-name");
            if (instEl) instEl.value = settings.institution?.name || "";
            if (teacherEl) teacherEl.value = settings.teacher?.name || "";

            updateProfilePreview(teacherEl ? teacherEl.value : "");

            if (modeSelect) {
                modeSelect.value = settings.storageMode || "local";
                if (fbFields) fbFields.style.display = modeSelect.value === "firebase" ? "block" : "none";
            }

            const apiKeyEl = document.getElementById("fb-cfg-api-key");
            const projIdEl = document.getElementById("fb-cfg-project-id");
            const bucketEl = document.getElementById("fb-cfg-storage-bucket");
            if (apiKeyEl) apiKeyEl.value = settings.firebaseConfig?.apiKey || "";
            if (projIdEl) projIdEl.value = settings.firebaseConfig?.projectId || "";
            if (bucketEl) bucketEl.value = settings.firebaseConfig?.storageBucket || "";

            // Reset password inputs and status
            if (currPassInput) currPassInput.value = "";
            if (newPassInput) newPassInput.value = "";
            if (confirmPassInput) confirmPassInput.value = "";
            if (statusBox) {
                statusBox.style.display = "none";
                statusBox.textContent = "";
            }

            // Open full-page settings view
            this.switchView("settings");
        };

        this.openSettingsModal = openModal;

        const closeModal = () => {
            if (modal) modal.classList.remove("active");
        };

        if (btnOpen) btnOpen.addEventListener("click", openModal);
        const btnSideSettings = document.getElementById("btn-side-settings");
        if (btnSideSettings) btnSideSettings.addEventListener("click", openModal);
        const btnUploaderSettings = document.getElementById("side-nav-uploader-settings");
        if (btnUploaderSettings) btnUploaderSettings.addEventListener("click", openModal);
        const btnStorageBadge = document.getElementById("navbar-storage-quota");
        if (btnStorageBadge) {
            btnStorageBadge.addEventListener("click", () => {
                if (this.settingsPageManager) {
                    this.settingsPageManager.activeTab = "cloud";
                }
                this.switchView("settings");
            });
        }
        if (btnClose) btnClose.addEventListener("click", closeModal);
        if (btnCancel) btnCancel.addEventListener("click", closeModal);

        if (btnSave) {
            btnSave.addEventListener("click", async () => {
                const teacherName = document.getElementById("settings-teacher-name")?.value.trim() || "";
                const instName = document.getElementById("settings-inst-name")?.value.trim() || "";
                const existing = await window.appStorage.getSettings() || {};

                const settings = {
                    ...existing,
                    institution: {
                        name: instName,
                        code: existing.institution?.code || "",
                        logo: "assets/school_logo.jpg",
                        fullLogo: "assets/school_fulllogo.jpg"
                    },
                    teacher: { name: teacherName }
                };

                await window.appStorage.saveSettings(settings);
                this.applySettingsToUI(settings);

                closeModal();
                this.showToast("Settings updated successfully!");
            });
        }
    }

    // --- Toast Notifications ---

    showLoadingBox(title = "Opening Answer Script...", desc = "Loading student paper, annotations & correction tools...") {
        let el = document.getElementById("global-app-loader");
        if (!el) {
            el = document.createElement("div");
            el.id = "global-app-loader";
            el.className = "global-app-loader-overlay";
            el.innerHTML = `
                <div class="global-app-loader-card">
                    <div class="global-app-spinner"></div>
                    <h4 id="global-loader-title">${title}</h4>
                    <p id="global-loader-desc">${desc}</p>
                </div>
            `;
            document.body.appendChild(el);
        } else {
            const titleEl = document.getElementById("global-loader-title");
            const descEl = document.getElementById("global-loader-desc");
            if (titleEl) titleEl.textContent = title;
            if (descEl) descEl.textContent = desc;
        }
        el.style.display = "flex";
        el.style.opacity = "1";
    }

    hideLoadingBox() {
        const el = document.getElementById("global-app-loader");
        if (el) {
            el.style.opacity = "0";
            setTimeout(() => { el.style.display = "none"; }, 200);
        }
    }

    showToast(message, type = "success") {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast ${type === "error" ? "toast-error" : (type === "warning" ? "toast-warning" : "toast-success")}`;
        toast.textContent = message;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    async updateStorageQuotaDisplay() {
        if (!window.appStorage || typeof window.appStorage.getStorageUsage !== "function") return;
        try {
            const usage = await window.appStorage.getStorageUsage();

            // 1. Top Navbar Quota Badge (shown only for Admin / Uploader)
            const valEl = document.getElementById("nav-storage-val");
            const barEl = document.getElementById("nav-storage-bar");
            const badgeEl = document.getElementById("navbar-storage-quota");

            const formattedUsed = usage.formattedUsed || `${usage.usedGB} GB`;

            if (valEl) {
                valEl.textContent = `${formattedUsed} / ${usage.totalGB} GB`;
            }
            if (barEl) {
                barEl.style.width = `${Math.min(100, Math.max(2, usage.percentUsed || 0))}%`;
            }
            if (badgeEl) {
                // Show ONLY to Admin and Uploader desks! Hide from Teacher Desk & Workspace
                const isTeacher = this.activePortal === "teacher" || (this.currentUser && this.currentUser.role === "evaluator");
                const isUploaderOrAdmin = !isTeacher && (this.activePortal === "uploader" || this.activePortal === "admin" || (this.currentUser && (this.currentUser.role === "admin" || this.currentUser.role === "uploader")));
                badgeEl.style.display = isUploaderOrAdmin ? "flex" : "none";

                badgeEl.classList.toggle("near-limit", usage.isNearLimit && !usage.isExceeded);
                badgeEl.classList.toggle("exceeded", usage.isExceeded);
                badgeEl.title = `Storage Used: ${formattedUsed} (${usage.totalPapersCount || 0} papers, ${usage.totalPagesCount || 0} pages). Click to manage & clean storage.`;
            }

            // 2. Settings Modal Quota Fields (if visible)
            const modalPercent = document.getElementById("modal-storage-percent");
            const modalBar = document.getElementById("modal-storage-bar");
            const modalUsed = document.getElementById("modal-storage-used");
            const modalRemaining = document.getElementById("modal-storage-remaining");

            if (modalPercent) modalPercent.textContent = `${usage.userFormatted || formattedUsed}`;
            if (modalBar) modalBar.style.width = `${Math.min(100, Math.max(2, usage.percentUsed || 0))}%`;
            if (modalUsed) modalUsed.textContent = `${usage.userFormatted || formattedUsed}`;
            if (modalRemaining) modalRemaining.textContent = `${usage.completedFormatted || "0 KB"} safe to clean`;
        } catch (e) {
            console.warn("Storage quota display update error:", e);
        }
    }

    async loadEvaluations() {
        if (this.currentView === "dashboard" && this.dashboardManager) {
            this.dashboardManager.evaluations = await window.appStorage.getAllEvaluations(false, true);
            this.dashboardManager.applyFilters();
            this.dashboardManager.render();
            this.dashboardManager.bindEvents();
        } else if (this.currentView === "history" && this.historyManager) {
            this.historyManager.evaluations = await window.appStorage.getAllEvaluations(false, true);
            this.historyManager.init();
        } else if (this.currentView === "admin-panel" && this.adminPanelManager) {
            this.adminPanelManager.init();
        } else if (this.currentView === "uploaded-papers" && this.uploadedPapersPageManager) {
            this.uploadedPapersPageManager.init();
        }
    }
}

// Bootstrap application on DOMContentLoaded
window.addEventListener("DOMContentLoaded", () => {
    window.app = new AppController();
    window.appInstance = window.app;
    window.app.init();
});
