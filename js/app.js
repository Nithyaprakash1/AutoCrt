/**
 * OneSpace Digital Correction - Main Application Coordinator
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
        this.activePortal = localStorage.getItem("onespace_active_portal") || null;
    }

    async init() {
        console.log("Initializing Niprak OSM Digital Correction...");

        // Ensure storage is initialized
        await window.appStorage.init();

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
        this.bindWorkspaceControls();
        this.bindKeyboardShortcuts();
        this.bindSettingsModal();
        this.updateStorageQuotaDisplay();

        // Respect page data-default-portal attribute if set (uploader.html vs teacher.html)
        const pageDefaultPortal = document.body.getAttribute("data-default-portal");
        const targetPortal = pageDefaultPortal || this.activePortal || "evaluator";

        this.setPortal(targetPortal, true);

        // Check for direct workspace load via URL query param (e.g. ?evalId=eval-123)
        const urlParams = new URLSearchParams(window.location.search);
        const evalId = urlParams.get("evalId");
        if (evalId) {
            const ev = await window.appStorage.getEvaluationById(evalId);
            if (ev) {
                await this.openWorkspace(ev);
            }
        } else {
            this.switchView("dashboard");
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

    // --- Dual Portal Management ---

    showPortalLoginScreen() {
        const overlay = document.getElementById("portal-login-screen");
        if (overlay) overlay.style.display = "flex";
    }

    hidePortalLoginScreen() {
        const overlay = document.getElementById("portal-login-screen");
        if (overlay) overlay.style.display = "none";
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
                localStorage.setItem("onespace_active_portal", "admin");
                window.location.href = "admin.html";
                return;
            }

            if (portalName === "evaluator" && pageDefault === "uploader") {
                localStorage.setItem("onespace_active_portal", "evaluator");
                window.location.href = "teacher.html";
                return;
            }

            if (portalName === "uploader" && pageDefault === "evaluator") {
                localStorage.setItem("onespace_active_portal", "uploader");
                window.location.href = "uploader.html";
                return;
            }
        }

        this.activePortal = portalName;
        localStorage.setItem("onespace_active_portal", portalName);
        this.hidePortalLoginScreen();

        const pillLabel = document.getElementById("portal-pill-label");
        const pill = document.getElementById("header-portal-pill");
        const sidePillLabel = document.getElementById("side-portal-label");
        const sideCard = document.getElementById("side-portal-card");
        const uploaderNav = document.getElementById("sidebar-uploader-nav");
        const teacherNav = document.getElementById("sidebar-teacher-nav");

        if (portalName === "uploader") {
            if (pillLabel) pillLabel.textContent = "Upload Desk";
            if (sidePillLabel) sidePillLabel.textContent = "Upload Desk";
            if (pill) {
                pill.classList.remove("portal-pill-eval");
                pill.classList.add("portal-pill-upload");
            }
            if (sideCard) {
                sideCard.classList.remove("side-card-eval");
                sideCard.classList.add("side-card-upload");
            }
            if (uploaderNav) uploaderNav.style.display = "block";
            if (teacherNav) teacherNav.style.display = "none";
            if (doSwitchView) this.switchView("upload-portal");
        } else if (portalName === "admin") {
            if (pillLabel) pillLabel.textContent = "Admin Desk";
            if (sidePillLabel) sidePillLabel.textContent = "Admin Desk";
            if (doSwitchView) this.switchView("admin-panel");
        } else {
            if (pillLabel) pillLabel.textContent = "Teacher Desk";
            if (sidePillLabel) sidePillLabel.textContent = "Teacher Desk";
            if (pill) {
                pill.classList.remove("portal-pill-upload");
                pill.classList.add("portal-pill-eval");
            }
            if (sideCard) {
                sideCard.classList.remove("side-card-upload");
                sideCard.classList.add("side-card-eval");
            }
            if (uploaderNav) uploaderNav.style.display = "none";
            if (teacherNav) teacherNav.style.display = "block";
            if (doSwitchView) this.switchView("dashboard");
        }
    }

    togglePortal() {
        const next = this.activePortal === "uploader" ? "evaluator" : "uploader";
        this.setPortal(next, true);
        this.showToast(`Switched to ${next === 'uploader' ? 'Exam Upload Desk' : 'Teacher Evaluator Desk'}`);
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
                if (btnEnter) btnEnter.style.background = "linear-gradient(135deg, #AF52DE, #5856D6)";
                updateEnterBtnText();
            });
        }

        if (tabUploader) {
            tabUploader.addEventListener("click", () => {
                selectedRole = "uploader";
                setTabActive(tabUploader);
                if (btnEnter) btnEnter.style.background = "#007AFF";
                updateEnterBtnText();
            });
        }

        if (tabEvaluator) {
            tabEvaluator.addEventListener("click", () => {
                selectedRole = "evaluator";
                setTabActive(tabEvaluator);
                if (btnEnter) btnEnter.style.background = "#34C759";
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
                                assignedSubjects: selectedRole === "evaluator" ? ["Physics"] : ["All Subjects"],
                                assignedClasses: ["Class 12-A"]
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
                        assignedSubjects: selectedRole === "evaluator" ? ["Physics"] : ["All Subjects"],
                        assignedClasses: ["Class 12-A"],
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
                this.applySettingsToUI();

                let destinationPortal = "evaluator";
                if (activeRole === "admin") destinationPortal = "admin";
                else if (activeRole === "uploader") destinationPortal = "uploader";
                else destinationPortal = "evaluator";

                this.showToast(`Authenticated as ${userAccount.name} (${activeRole.toUpperCase()})`);
                this.setPortal(destinationPortal, true);
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
        const handleLogout = () => this.showPortalLoginScreen();
        const btnLogout = document.getElementById("btn-header-logout");
        if (btnLogout) btnLogout.addEventListener("click", handleLogout);
        const btnSideLogout = document.getElementById("btn-side-logout");
        if (btnSideLogout) btnSideLogout.addEventListener("click", handleLogout);
        const btnMobLogout = document.getElementById("btn-mobile-logout");
        if (btnMobLogout) btnMobLogout.addEventListener("click", handleLogout);

        // Sidebar Collapse / Expand Toggle
        const sidebar = document.getElementById("app-side-menu-bar");
        const isCollapsed = localStorage.getItem("onespace_sidebar_collapsed") === "true";
        if (sidebar && isCollapsed) {
            sidebar.classList.add("collapsed");
        }
        const toggleSidebarCollapse = () => {
            if (!sidebar) return;
            const nowCollapsed = sidebar.classList.toggle("collapsed");
            localStorage.setItem("onespace_sidebar_collapsed", nowCollapsed ? "true" : "false");
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
        const btnUploaderSettings = document.getElementById("side-nav-uploader-settings");
        if (btnUploaderSettings) {
            btnUploaderSettings.addEventListener("click", () => this.switchView("settings"));
        }
        const btnUploaderUsers = document.getElementById("side-nav-uploader-users");
        if (btnUploaderUsers) {
            btnUploaderUsers.addEventListener("click", () => this.switchView("user-management"));
        }
        const btnTeacherSettings = document.getElementById("side-nav-teacher-settings");
        if (btnTeacherSettings) {
            btnTeacherSettings.addEventListener("click", () => this.switchView("settings"));
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
    }

    applySettingsToUI() {
        const user = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const nameEl = document.getElementById("header-user-name");
        const avatarEl = document.getElementById("header-user-avatar");
        const sideNameEl = document.getElementById("side-user-name");
        const sideAvatarEl = document.getElementById("side-user-avatar");
        const sideRoleEl = document.querySelector(".user-role-label");

        const name = user ? user.name : "";
        const roleLabel = user ? (user.role === 'admin' ? 'Admin' : (user.role === 'uploader' ? 'Exam Officer' : 'Teacher Evaluator')) : "";
        const initials = name
            ? name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase()
            : "--";

        if (nameEl) nameEl.textContent = name || "Sign In";
        if (sideNameEl) sideNameEl.textContent = name || "Sign In";
        if (sideRoleEl) sideRoleEl.textContent = roleLabel;
        if (avatarEl) avatarEl.textContent = initials;
        if (sideAvatarEl) sideAvatarEl.textContent = initials;
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
                this.switchView(targetView);
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
                await this.saveActiveEvaluation(false);
                this.stopAutosave();
                this.activeEvaluation = null;
            }
            await this.switchView("dashboard");
        } catch (err) {
            console.error("Back navigation error:", err);
            await this.switchView("dashboard");
        } finally {
            this._isNavigatingBack = false;
        }
    }

    async switchView(viewName) {
        this.currentView = viewName;

        // If leaving workspace, close it gracefully
        if (this.activeEvaluation && viewName !== "workspace") {
            await this.saveActiveEvaluation(false);
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

        // Hide all views
        document.querySelectorAll(".view-section").forEach(sec => {
            sec.classList.remove("active-view");
        });

        // Show target view & mount manager
        if (viewName === "upload-portal") {
            const el = document.getElementById("view-upload-portal");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("upload-portal-container-root");
            this.uploadPortalManager = new UploadPortalManager(root, {
                onOpenWorkspace: (ev) => this.openWorkspace(ev),
                onSwitchToEvaluator: () => this.setPortal("evaluator", true)
            });
            await this.uploadPortalManager.init();
        } else if (viewName === "dashboard") {
            const el = document.getElementById("view-dashboard");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("dashboard-container-root");
            this.dashboardManager = new DashboardManager(root, {
                onStartNew: () => this.switchView("new-eval"),
                onOpenEvaluation: (ev) => this.openWorkspace(ev),
                onDownloadPDF: (ev) => this.downloadEvaluationPDF(ev),
                onBulkDownloadPDF: (evals) => this.downloadBulkPDFs(evals),
                onExportExcel: (evals) => this.exportEvaluationsAsExcel(evals)
            });
            await this.dashboardManager.init();
        } else if (viewName === "new-eval") {
            const el = document.getElementById("view-new-eval");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("eval-form-container-root");
            this.evaluationForm = new EvaluationForm(root, {
                onStartCorrection: (ev) => this.openWorkspace(ev)
            });
        } else if (viewName === "history") {
            const el = document.getElementById("view-history");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("history-container-root");
            this.historyManager = new EvaluationHistoryManager(root, {
                onOpenEvaluation: (ev) => this.openWorkspace(ev),
                onDownloadPDF: (ev) => this.downloadEvaluationPDF(ev)
            });
            await this.historyManager.init();
        } else if (viewName === "bulk-report") {
            const el = document.getElementById("view-bulk-report");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("bulk-report-container-root");
            this.bulkReportManager = new BulkReportManager(root);
            await this.bulkReportManager.init();
        } else if (viewName === "classes") {
            const el = document.getElementById("view-classes");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("classes-container-root");
            if (root && window.ClassesPageManager) {
                this.classesPageManager = new ClassesPageManager(root);
                await this.classesPageManager.init();
            }
        } else if (viewName === "uploaded-papers") {
            const el = document.getElementById("view-uploaded-papers");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("uploaded-papers-container-root");
            if (root && window.UploadedPapersPageManager) {
                this.uploadedPapersPageManager = new UploadedPapersPageManager(root);
                await this.uploadedPapersPageManager.init();
            }
        } else if (viewName === "settings") {
            const el = document.getElementById("view-settings");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("settings-container-root");
            if (root && window.SettingsPageManager) {
                this.settingsPageManager = new SettingsPageManager(root);
                await this.settingsPageManager.init();
            }
        } else if (viewName === "user-management") {
            const el = document.getElementById("view-user-management");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("user-management-container-root");
            if (root && window.UserManagementPageManager) {
                this.userManagementPageManager = new UserManagementPageManager(root);
                await this.userManagementPageManager.init();
            }
        } else if (viewName === "admin-panel") {
            const el = document.getElementById("view-admin-panel");
            if (el) el.classList.add("active-view");
            const root = document.getElementById("admin-panel-container-root");
            if (root && window.AdminPanelManager) {
                this.adminPanelManager = new AdminPanelManager(root);
                await this.adminPanelManager.init();
            }
        }
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

        if (qLabelEl) qLabelEl.textContent = `Q${q.qNo}`;
        if (qMaxEl) qMaxEl.textContent = `/ ${q.maxMarks} Marks`;
        if (secBadge) secBadge.textContent = q.section || "Section A";
        if (qTotalBadge) qTotalBadge.textContent = `Q Total: ${q.awardedMarks}/${q.maxMarks}M`;

        const qTopicEl = document.getElementById("hud-active-q-topic");
        if (qTopicEl) {
            if (q.topic) {
                qTopicEl.textContent = q.topic;
                qTopicEl.title = q.topic;
                qTopicEl.style.display = "inline-block";
            } else {
                qTopicEl.style.display = "none";
            }
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

        if (customInp) customInp.value = q.awardedMarks !== undefined ? q.awardedMarks : 0;

        // Dynamically rebuild hud-number-marks-row tailored to active question ceiling (e.g. 7M, 12M, 15M)
        const hudNumRow = document.querySelector(".hud-number-marks-row");
        if (hudNumRow) {
            const numbers = this.markingPanel?.generateQuickNumbers ? this.markingPanel.generateQuickNumbers(q.maxMarks) : [0, 0.5, 1, 1.5, 2];
            hudNumRow.innerHTML = numbers.map(n => `
                <button type="button" class="hud-mark-btn ${n % 1 !== 0 ? 'hud-half-btn' : ''} ${Number(q.awardedMarks) === n ? 'active' : ''}" data-mark="${n}">${n}</button>
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
                        this.updatePageTotalDisplay();
                        if (activeQ.awardedMarks >= activeQ.maxMarks) {
                            setTimeout(() => {
                                const moved = this.markingPanel?.nextQuestion();
                                if (moved) {
                                    const nextQ = this.markingPanel?.getActiveQuestion();
                                    if (nextQ) {
                                        this.updateTopHud(nextQ);
                                        this.showToast(`Moved to ${nextQ.label || `Q${nextQ.qNo}`}`);
                                    }
                                }
                            }, 280);
                        }
                    } else {
                        this.updatePageTotalDisplay();
                    }
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

        // 2. Determine stamping position: use cursor position or last click position
        let stampPos = this.canvasEngine?.currentCursorNormPos || this.canvasEngine?.lastClickNormPos;
        if (!stampPos) {
            stampPos = { x: 0.25, y: 0.35 };
        }

        if (this.canvasEngine) {
            // Check if page already has a tick near stampPos.y, if not place one
            const curPage = this.canvasEngine.pages[this.canvasEngine.currentPageIndex];
            const hasRecentTick = curPage && (curPage.annotations || []).some(a => a.type === "tick" && Math.abs(a.y - stampPos.y) < 0.08);

            const tickX = Math.max(0.02, stampPos.x - 0.025);
            const labelX = Math.min(0.96, stampPos.x + 0.035);

            if (!hasRecentTick) {
                const tickStamp = {
                    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    pageIndex: this.canvasEngine.currentPageIndex,
                    type: "tick",
                    x: tickX,
                    y: stampPos.y,
                    color: "#DC2626", // Teacher Red Ink
                    marks: maxMarks,
                    qNo: q.qNo,
                    qLabel: q.label || `Q${q.qNo}`,
                    isStep: false,
                    hasMarginMark: true,
                    scale: 1.0,
                    timestamp: Date.now()
                };
                this.canvasEngine.addAnnotation(tickStamp);
            }

            // 3. Stamp question total marks where cursor is placed
            this.canvasEngine.stampRightMarginMark(q.qNo, maxMarks, stampPos.y, labelX);
            this.canvasEngine.renderOverlay();
        }

        // 4. Update HUD and page total display
        this.updateTopHud(q);
        this.updatePageTotalDisplay();

        // 5. User feedback
        this.showToast(`[Full Marks] Awarded (${maxMarks}M) to Q${q.qNo} with left-margin stamp!`);

        this.hasUnsavedChanges = true;
        this.setAutosaveBadge("saving");

        // 6. Auto-advance to next question if full marks added
        setTimeout(() => {
            const moved = this.markingPanel?.nextQuestion();
            if (moved) {
                const nextQ = this.markingPanel?.getActiveQuestion();
                if (nextQ) {
                    this.updateTopHud(nextQ);
                    this.showToast(`Moved to ${nextQ.label || `Q${nextQ.qNo}`}`);
                }
            }
        }, 280);
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

        if (this.canvasEngine) {
            // Check if page already has a wrong mark near stampPos.y, if not place one
            const curPage = this.canvasEngine.pages[this.canvasEngine.currentPageIndex];
            const hasRecentWrong = curPage && (curPage.annotations || []).some(a => a.type === "wrong" && Math.abs(a.y - stampPos.y) < 0.08);

            const wrongX = Math.max(0.02, stampPos.x - 0.025);
            const labelX = Math.min(0.96, stampPos.x + 0.035);

            if (!hasRecentWrong) {
                const wrongStamp = {
                    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    pageIndex: this.canvasEngine.currentPageIndex,
                    type: "wrong",
                    x: wrongX,
                    y: stampPos.y,
                    color: "#DC2626", // Teacher Red Ink
                    marks: 0,
                    qNo: q.qNo,
                    qLabel: q.label || `Q${q.qNo}`,
                    isStep: false,
                    hasMarginMark: true,
                    scale: 1.0,
                    timestamp: Date.now()
                };
                this.canvasEngine.addAnnotation(wrongStamp);
            }

            // Stamp question mark label where cursor was placed (e.g. Q1: 0M)
            this.canvasEngine.stampRightMarginMark(q.qNo, 0, stampPos.y, labelX);
            this.canvasEngine.renderOverlay();
        }

        // 4. Update HUD and page total display
        this.updateTopHud(q);
        this.updatePageTotalDisplay();

        // 5. User feedback
        this.showToast(`Marked Q${q.qNo} as 0 Marks`);

        this.hasUnsavedChanges = true;
        this.setAutosaveBadge("saving");
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
                const annTotal = this.canvasEngine.getQuestionTotalFromAnnotations(q.qNo);
                const annList = this.canvasEngine.getAnnotationsForQuestion(q.qNo);
                const hasMarginMark = annList.some(a => a.type === "margin_mark" || a.type === "left_mark");
                const hasScoreAnnotations = hasMarginMark || (annList.length > 0 && annTotal > 0);

                if (hasScoreAnnotations) {
                    const clamped = Math.min(q.maxMarks, Math.max(0, annTotal));
                    if (q.awardedMarks !== clamped || q.status === "unmarked") {
                        if (this.markingPanel) {
                            this.markingPanel.assignQuestionMarkDirect(idx, clamped, clamped === 0 ? "wrong" : (clamped === q.maxMarks ? "correct" : "partial"));
                        } else {
                            q.awardedMarks = clamped;
                            if (clamped === q.maxMarks) q.status = "correct";
                            else if (clamped === 0) q.status = "wrong";
                            else q.status = "partial";
                        }
                        updated = true;
                    }
                }
            });
        }

        // Calculate total obtained marks across paper
        let totalObtained = 0;
        let maxMarks = this.activeEvaluation?.maxMarks || 20;

        if (this.markingPanel && this.markingPanel.obtainedMarksTotal !== undefined && this.markingPanel.obtainedMarksTotal !== null) {
            totalObtained = this.markingPanel.obtainedMarksTotal;
        } else if (questions && questions.length > 0) {
            totalObtained = questions.reduce((sum, q) => sum + (Number(q.awardedMarks) || 0), 0);
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

        // Update live score badge in top bar
        const topScoreEl = document.getElementById("ws-live-score-val");
        if (topScoreEl) {
            topScoreEl.textContent = `${totalObtained} / ${maxMarks}`;
        }

        if (updated && this.markingPanel) {
            const activeQ = this.markingPanel.getActiveQuestion();
            if (activeQ) this.updateTopHud(activeQ);
        }
    }

    async openWorkspace(evaluation) {
        if (!evaluation) return;
        this.hidePortalLoginScreen();

        // Always fetch fresh record from storage to get saved annotations & page images
        if (evaluation.id && window.appStorage) {
            const fresh = await window.appStorage.getEvaluationById(evaluation.id);
            if (fresh) evaluation = fresh;
        }

        if ((!evaluation.pages || evaluation.pages.length === 0) && window.appStorage) {
            const cached = await window.appStorage.getPdfCache(evaluation.id);
            if (cached) {
                if (cached.pages && cached.pages.length > 0) evaluation.pages = cached.pages;
                if (cached.pdfDataUrl) evaluation.pdfDataUrl = cached.pdfDataUrl;
            }
        }

        // Prioritize authentic Cloud PDF Storage URL over single-page placeholder
        if (evaluation.pdfStorageUrl) {
            const hasMultipleRealPages = Array.isArray(evaluation.pages) && evaluation.pages.length > 1;
            if (!hasMultipleRealPages) {
                evaluation.pages = [evaluation.pdfStorageUrl];
            }
            if (!evaluation.pdfDataUrl) evaluation.pdfDataUrl = evaluation.pdfStorageUrl;
        } else if (evaluation.pdfDataUrl && (!evaluation.pages || evaluation.pages.length <= 1)) {
            evaluation.pages = [evaluation.pdfDataUrl];
        }
        if (!evaluation.pages || evaluation.pages.length === 0) {
            evaluation.pages = [CanvasEngine.generateDefaultLinedPageDataUrl(evaluation.studentName, evaluation.rollNo)];
        }

        // Detect English or Physics paper template
        const subLower = (evaluation.subject || "").toLowerCase();
        const tmplLower = (evaluation.templateName || evaluation.examName || "").toLowerCase();
        const isEnglish = subLower.includes("english") || tmplLower.includes("english") || (evaluation.questions && evaluation.questions.length === 13);

        if (isEnglish && window.MockData && window.MockData.englishTemplate) {
            const tmpl = window.MockData.englishTemplate;
            evaluation.subject = "English";
            evaluation.maxMarks = tmpl.maxMarks || 80;
            evaluation.sections = JSON.parse(JSON.stringify(tmpl.sections));
            if (!evaluation.examName) evaluation.examName = tmpl.name;

            if (!evaluation.questions || evaluation.questions.length !== 13) {
                evaluation.questions = JSON.parse(JSON.stringify(tmpl.questions));
            } else {
                evaluation.questions.forEach((q, idx) => {
                    const templateQ = tmpl.questions[idx];
                    if (templateQ) {
                        q.qNo = templateQ.qNo;
                        q.qNumber = templateQ.qNumber;
                        q.label = templateQ.label || `Q${idx + 1}`;
                        q.section = templateQ.section;
                        q.sectionId = templateQ.sectionId;
                        q.maxMarks = templateQ.maxMarks;
                        q.topic = templateQ.topic;
                    }
                });
            }
        } else if ((!evaluation.questions || evaluation.questions.length === 0) && window.MockData && window.MockData.physicsTemplate) {
            evaluation.questions = JSON.parse(JSON.stringify(window.MockData.physicsTemplate.questions));
            evaluation.maxMarks = window.MockData.physicsTemplate.maxMarks || 70;
            evaluation.sections = window.MockData.physicsTemplate.sections || evaluation.sections || [];
        } else if (evaluation.questions && evaluation.questions.length === 33 && window.MockData && window.MockData.physicsTemplate) {
            // Ensure 33 Qs Physics Board paper has full 5-section separation (Sections A to E)
            const hasMissingSections = !evaluation.sections || evaluation.sections.length <= 1;
            const hasCollapsedSectionIds = evaluation.questions.some((q, idx) => idx >= 16 && (!q.sectionId || q.sectionId === "sec_a"));
            if (hasMissingSections || hasCollapsedSectionIds) {
                evaluation.sections = JSON.parse(JSON.stringify(window.MockData.physicsTemplate.sections));
                evaluation.maxMarks = 70;
                evaluation.questions.forEach((q, idx) => {
                    const templateQ = window.MockData.physicsTemplate.questions[idx];
                    if (templateQ) {
                        q.section = templateQ.section;
                        q.sectionId = templateQ.sectionId;
                        q.maxMarks = templateQ.maxMarks;
                        if (!q.topic) q.topic = templateQ.topic;
                    }
                });
            }
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
                this.setAutosaveBadge("saving");
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
                const q = this.markingPanel?.getActiveQuestion();
                let awardedFull = false;
                if (Number(markVal) === 0) {
                    // In round mark dial selecting 0 awards 0 marks to that question and sets status to "wrong"
                    this.markingPanel?.setActiveQuestionMark(0, "wrong");
                } else if (isStep) {
                    this.markingPanel?.addStepMark(markVal);
                    const updatedQ = this.markingPanel?.getActiveQuestion();
                    if (updatedQ && updatedQ.awardedMarks >= updatedQ.maxMarks) {
                        awardedFull = true;
                    }
                } else {
                    if (q && markVal >= q.maxMarks) {
                        this.markingPanel?.setActiveQuestionMark(q.maxMarks, "correct");
                        awardedFull = true;
                    } else {
                        this.markingPanel?.addMarkToActiveQuestion(markVal);
                        const updatedQ = this.markingPanel?.getActiveQuestion();
                        if (updatedQ && updatedQ.awardedMarks >= updatedQ.maxMarks) {
                            awardedFull = true;
                        }
                    }
                }
                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) this.updateTopHud(activeQ);
                this.updatePageTotalDisplay();
                const markDesc = Number(markVal) === 0 ? `0 Marks (Wrong)` : (isStep ? `+${markVal} Step Mark` : `${markVal} Marks`);
                this.showToast(`Awarded ${markDesc} to ${activeQ ? activeQ.label : 'question'}`);

                // Auto-advance to next question when full mark is added
                if (awardedFull) {
                    setTimeout(() => {
                        const moved = this.markingPanel?.nextQuestion();
                        if (moved) {
                            const nextQ = this.markingPanel?.getActiveQuestion();
                            if (nextQ) {
                                this.updateTopHud(nextQ);
                                this.showToast(`Moved to ${nextQ.label || `Q${nextQ.qNo}`}`);
                            }
                        }
                    }, 280);
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

                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) this.updateTopHud(activeQ);

                this.updatePageTotalDisplay();
                this.renderScorecardTable();

                // STRICT RULE: Keep status Pending until teacher explicitly clicks Save or Save & Next
                if (!this.activeEvaluation.status || (this.activeEvaluation.status !== "Completed" && this.activeEvaluation.status !== "Corrected")) {
                    this.activeEvaluation.status = "Pending";
                }

                this.hasUnsavedChanges = true;
                this.setAutosaveBadge("saving");
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
            }
        });

        // Load evaluation data into canvas & marking panel
        await this.canvasEngine.setPages(evaluation.pages || [], evaluation.annotations || []);
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

        // Fit to page initially & hide loader
        if (this.canvasEngine) this.canvasEngine.fitToPage();
        if (wsOverlay) {
            wsOverlay.style.opacity = "0";
            setTimeout(() => {
                wsOverlay.style.display = "none";
            }, 250);
        }

        // Start autosave cycle
        this.startAutosave();
        this.setAutosaveBadge("saved");
    }

    renderScorecardTable() {
        const container = document.getElementById("ws-scorecard-table-container");
        const badge = document.getElementById("ws-scorecard-unmarked-badge");
        if (!container || !this.markingPanel) return;

        const questions = this.markingPanel.questions || [];
        const sections = this.markingPanel.sections || [];
        const evalData = this.activeEvaluation || {};

        let unmarkedCount = 0;

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
            const secObj = sections.find(s => s.id === q.sectionId || s.name === q.section);
            const secName = secObj ? secObj.name : (q.section || "Section A");
            const isUnmarked = (q.status === "unmarked" || q.status === "pending") && Number(q.awardedMarks) === 0;

            if (isUnmarked) unmarkedCount++;

            const statusTag = isUnmarked 
                ? `<span class="score-st-badge st-unmarked">⚠️ UNMARKED</span>`
                : (q.awardedMarks === q.maxMarks 
                    ? `<span class="score-st-badge st-graded">✓ Graded (Full)</span>`
                    : `<span class="score-st-badge st-partial">◐ Graded (${q.awardedMarks}M)</span>`);

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
                    <td class="col-obtained-tag ${q.awardedMarks > 0 ? 'mark-awarded' : ''}">${q.awardedMarks} M</td>
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
                badge.textContent = `⚠️ ${unmarkedCount} Question${unmarkedCount > 1 ? 's' : ''} UNMARKED!`;
            } else {
                badge.className = "scorecard-unmarked-pill all-graded";
                badge.textContent = `✓ All ${questions.length} Questions Graded (100% Complete)`;
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
                    if (this.canvasEngine) {
                        this.canvasEngine.setMarksValue(`+0.5`);
                    }
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
                    if (this.canvasEngine) {
                        this.canvasEngine.setMarksValue(`+1`);
                    }
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
                }
                const activeQ = this.markingPanel?.getActiveQuestion();
                if (activeQ) {
                    this.updateTopHud(activeQ);
                    this.updatePageTotalDisplay();
                    if (activeQ.awardedMarks >= activeQ.maxMarks) {
                        setTimeout(() => {
                            const moved = this.markingPanel?.nextQuestion();
                            if (moved) {
                                const nextQ = this.markingPanel?.getActiveQuestion();
                                if (nextQ) {
                                    this.updateTopHud(nextQ);
                                    this.showToast(`Moved to ${nextQ.label || `Q${nextQ.qNo}`}`);
                                }
                            }
                        }, 280);
                    }
                }
            });
        });

        // Custom Score Input & Apply button
        const applyCustom = () => {
            const inp = document.getElementById("hud-custom-score-inp");
            if (!inp) return;
            const val = Math.max(0, Number(inp.value) || 0);
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

            // Ignore when typing in input or textarea
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
            if (tag === "input" || tag === "textarea") return;

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
                case "h":
                    e.preventDefault();
                    this.markingPanel?.addStepMark(0.5);
                    const aq = this.markingPanel?.getActiveQuestion();
                    if (aq) this.updateTopHud(aq);
                    this.updatePageTotalDisplay();
                    this.showToast("+0.5 Step Mark awarded");
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

            // Enter key: calculate total step marks for active question → stamp per-question total in left margin → advance to next question
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const committingQ = this.markingPanel?.getActiveQuestion();
                if (committingQ) {
                    if (this.canvasEngine) {
                        // Calculate total from all step marks placed for this question on canvas
                        const stepTotal = this.canvasEngine.getQuestionTotalFromAnnotations(committingQ.qNo);
                        if (stepTotal > 0) {
                            const finalQScore = Math.min(committingQ.maxMarks, stepTotal);
                            this.markingPanel.assignCurrentQuestionMark(finalQScore);
                        }
                    }

                    if (committingQ.awardedMarks > 0) {
                        if (this.canvasEngine) {
                            const stampY = this.canvasEngine.currentCursorNormPos ? this.canvasEngine.currentCursorNormPos.y : (this.canvasEngine.lastClickNormPos ? this.canvasEngine.lastClickNormPos.y : 0.4);
                            const stampX = this.canvasEngine.currentCursorNormPos ? this.canvasEngine.currentCursorNormPos.x : (this.canvasEngine.lastClickNormPos ? this.canvasEngine.lastClickNormPos.x : 0.08);
                            this.canvasEngine.stampRightMarginMark(committingQ.qNo, committingQ.awardedMarks, stampY, stampX);
                            this.canvasEngine.renderOverlay();
                        }
                        this.updatePageTotalDisplay();
                        this.showToast(`Q${committingQ.qNo}: ${committingQ.awardedMarks}/${committingQ.maxMarks}M committed`);
                    } else {
                        this.showToast(`Q${committingQ.qNo}: 0/${committingQ.maxMarks}M committed`);
                    }
                }
                this.markingPanel?.nextQuestion();
                return;
            }

            // Numeric quick mark shortcut: press 0..9 to instantly mark active question!
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
                    if (activeQ.awardedMarks >= activeQ.maxMarks) {
                        setTimeout(() => {
                            const moved = this.markingPanel?.nextQuestion();
                            if (moved) {
                                const nextQ = this.markingPanel?.getActiveQuestion();
                                if (nextQ) {
                                    this.updateTopHud(nextQ);
                                    this.showToast(`Moved to ${nextQ.label || `Q${nextQ.qNo}`}`);
                                }
                            }
                        }, 280);
                    }
                }
            }
        });
    }

    // --- Autosave Engine ---

    startAutosave() {
        this.stopAutosave();
        this.autosaveTimer = setInterval(async () => {
            if (this.hasUnsavedChanges && this.activeEvaluation) {
                await this.saveActiveEvaluation(false);
            }
        }, 12000); // 12-second intervals
    }

    stopAutosave() {
        if (this.autosaveTimer) {
            clearInterval(this.autosaveTimer);
            this.autosaveTimer = null;
        }
    }

    async saveActiveEvaluation(notify = false) {
        if (!this.activeEvaluation) return;

        this.setAutosaveBadge("saving");
        if (this.canvasEngine) {
            this.activeEvaluation.annotations = this.canvasEngine.getAllAnnotations();
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

        // Save to IndexedDB / local storage
        await window.appStorage.saveEvaluation(this.activeEvaluation);
        window.appStorage.saveDraft(this.activeEvaluation.id, this.activeEvaluation);

        this.hasUnsavedChanges = false;
        this.setAutosaveBadge("saved");
        if (notify) {
            console.log("Evaluation state persisted successfully.");
        }
    }

    setAutosaveBadge(state) {
        const dot = document.querySelector(".autosave-dot");
        const text = document.getElementById("ws-autosave-text");
        if (!dot || !text) return;

        if (state === "saving") {
            dot.classList.add("saving");
            text.textContent = "Saving...";
        } else {
            dot.classList.remove("saving");
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
        // Strictly consider corrected only when teacher explicitly saved/evaluated it
        return e.status === "Completed" || e.status === "Corrected" || e.status === "Graded" || e.status === "Evaluated";
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
        this.updateActionProgressModal(70, "Scanning evaluation queue for next student paper...");
        const allEvaluations = await window.appStorage.getAllEvaluations();

        // Match current class/exam/subject or all assigned papers
        const currentClass = this.activeEvaluation?.class || this.activeEvaluation?.className;
        let queue = Array.isArray(allEvaluations) ? [...allEvaluations] : [];
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
        let nextEval = (currentIdx >= 0 && currentIdx + 1 < sorted.length) ? sorted[currentIdx + 1] : null;

        // If no paper strictly following current index, search for any remaining uncorrected paper in queue
        if (!nextEval) {
            nextEval = sorted.find(e => String(e.id) !== currentId && !this.isPaperCorrected(e)) || null;
        }

        // --- CASE 1: No next paper found (Queue is finished) ---
        if (!nextEval) {
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

    // --- Bulk PDF Download ---

    async downloadBulkPDFs(evaluations = null) {
        try {
            let targetList = Array.isArray(evaluations) && evaluations.length > 0 ? evaluations : null;
            if (!targetList) {
                targetList = await window.appStorage.getAllEvaluations();
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
                subtitle: "Compiling student roster marks, section breakdowns, and grades...",
                statusText: "Fetching evaluation records from storage...",
                badgeText: "Excel / CSV Matrix"
            });

            this.updateActionProgressModal(25, "Reading evaluated papers from database...");
            await new Promise(r => setTimeout(r, 180));

            if (this.activeEvaluation) {
                await this.saveActiveEvaluation(false);
            }

            let allEvaluations = Array.isArray(evaluationsList) && evaluationsList.length > 0 ? evaluationsList : null;
            if (!allEvaluations) {
                allEvaluations = await window.appStorage.getAllEvaluations();
                if ((!allEvaluations || allEvaluations.length === 0) && this.activeEvaluation) {
                    allEvaluations = [this.activeEvaluation];
                } else if (this.activeEvaluation && !allEvaluations.some(e => e.id === this.activeEvaluation.id)) {
                    allEvaluations.unshift(this.activeEvaluation);
                }
            }

            if (!allEvaluations || allEvaluations.length === 0) {
                this.closeActionProgressModal();
                this.showToast("No evaluations to export.", "error");
                return;
            }

            this.updateActionProgressModal(65, `Formatting ${allEvaluations.length} student scores & question matrices...`);
            await new Promise(r => setTimeout(r, 220));

            // Build detailed question-by-question header and student mark rows
            const maxQs = Math.max(...allEvaluations.map(e => (e.questions ? e.questions.length : 0)), 0);
            const qHeaders = [];
            for (let i = 1; i <= Math.min(maxQs, 50); i++) {
                qHeaders.push(`Q${i} Marks`);
            }

            const headers = [
                "Roll No", "Student Name", "Subject", "Exam", "Class/Section",
                "Obtained Marks", "Max Marks", "Percentage", "Grade", "Status",
                ...qHeaders
            ];

            const rows = allEvaluations.map(ev => {
                const pct = ev.maxMarks > 0 ? Math.round(((ev.obtainedMarks || 0) / ev.maxMarks) * 100) : 0;
                const qMarks = (ev.questions || []).map(q => q.awardedMarks !== undefined ? q.awardedMarks : 0);
                return [
                    ev.rollNo || "",
                    ev.studentName || "",
                    ev.subject || "",
                    ev.examName || "",
                    `${ev.class || ev.className || ""} ${ev.section || ""}`.trim(),
                    ev.obtainedMarks !== undefined ? ev.obtainedMarks : 0,
                    ev.maxMarks || 0,
                    `${pct}%`,
                    ev.grade || "--",
                    ev.status || "Pending",
                    ...qMarks
                ];
            });

            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell !== undefined && cell !== null ? cell : '').replace(/"/g, '""')}"`).join(","))
                .join("\r\n");

            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `Niprak_OSM_Physics_Marks_Matrix_${date}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.setActionProgressModalSuccess({
                title: "✓ Excel Spreadsheet Ready!",
                subtitle: `Exported ${allEvaluations.length} student results successfully.`,
                statusText: "Downloaded CSV/Excel matrix file.",
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
        if (btnStorageBadge) btnStorageBadge.addEventListener("click", () => this.switchView("settings"));
        if (btnClose) btnClose.addEventListener("click", closeModal);
        if (btnCancel) btnCancel.addEventListener("click", closeModal);

        if (modeSelect && fbFields) {
            modeSelect.addEventListener("change", () => {
                fbFields.style.display = modeSelect.value === "firebase" ? "block" : "none";
            });
        }

        if (btnSave) {
            btnSave.addEventListener("click", async () => {
                const teacherName = document.getElementById("settings-teacher-name")?.value.trim() || "";
                const instName = document.getElementById("settings-inst-name")?.value.trim() || "";
                const storageMode = modeSelect ? modeSelect.value : "local";

                const settings = {
                    institution: {
                        name: instName,
                        code: "",
                        logo: "assets/school_logo.jpg",
                        fullLogo: "assets/school_fulllogo.jpg"
                    },
                    teacher: { name: teacherName },
                    storageMode: storageMode,
                    firebaseConfig: {
                        apiKey: document.getElementById("fb-cfg-api-key")?.value.trim() || "",
                        projectId: document.getElementById("fb-cfg-project-id")?.value.trim() || "",
                        storageBucket: document.getElementById("fb-cfg-storage-bucket")?.value.trim() || ""
                    }
                };

                await window.appStorage.saveSettings(settings);
                this.applySettingsToUI(settings);

                if (settings.storageMode === "firebase" && window.firebaseManager) {
                    await window.firebaseManager.init(settings.firebaseConfig);
                }

                closeModal();
                this.showToast("Settings updated successfully!");
            });
        }
    }

    applySettingsToUI(settings) {
        if (!settings) return;

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

        // 2. Teacher Profile Name across sidebars and previews
        const teacherName = settings.teacher?.name || "Mrs. Nithya Prakash";
        const sideUserName = document.getElementById("side-user-name");
        if (sideUserName) sideUserName.textContent = teacherName;

        const initials = teacherName.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "NP";
        const sideAvatar = document.getElementById("side-user-avatar");
        if (sideAvatar) sideAvatar.textContent = initials;

        const previewAvatar = document.getElementById("settings-avatar-preview");
        if (previewAvatar) previewAvatar.textContent = initials;

        const previewName = document.getElementById("settings-preview-name");
        if (previewName) previewName.textContent = teacherName;

        // 3. Institution Logos
        const schoolLogoMark = settings.institution?.logo || "assets/school_logo.jpg";
        const schoolLogoFull = settings.institution?.fullLogo || "assets/school_fulllogo.jpg";

        const navSchoolFullImg = document.getElementById("navbar-school-full-img");
        if (navSchoolFullImg && schoolLogoFull) navSchoolFullImg.src = schoolLogoFull;

        const navSchoolMarkImg = document.getElementById("navbar-school-mark-img");
        if (navSchoolMarkImg && schoolLogoMark) navSchoolMarkImg.src = schoolLogoMark;

        const mobileSchoolImg = document.getElementById("mobile-school-logo-img");
        if (mobileSchoolImg && schoolLogoMark) mobileSchoolImg.src = schoolLogoMark;

        const wsSchoolImg = document.getElementById("ws-school-logo-img");
        if (wsSchoolImg && schoolLogoMark) wsSchoolImg.src = schoolLogoMark;
    }

    // --- Toast Notifications ---

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

            // 1. Top Navbar 50 GB Quota Badge
            const valEl = document.getElementById("nav-storage-val");
            const barEl = document.getElementById("nav-storage-bar");
            const badgeEl = document.getElementById("navbar-storage-quota");

            if (valEl) {
                valEl.textContent = `${usage.usedGB} / ${usage.totalGB} GB`;
            }
            if (barEl) {
                barEl.style.width = `${Math.min(100, Math.max(1, usage.percentUsed))}%`;
            }
            if (badgeEl) {
                // Show ONLY to Admin and Uploader desks! Hide from Teacher Desk & Workspace
                const isUploaderOrAdmin = this.activePortal === "uploader" || this.activePortal === "admin" || (this.currentUser && (this.currentUser.role === "admin" || this.currentUser.role === "uploader"));
                badgeEl.style.display = isUploaderOrAdmin ? "flex" : "none";

                badgeEl.classList.toggle("near-limit", usage.isNearLimit && !usage.isExceeded);
                badgeEl.classList.toggle("exceeded", usage.isExceeded);
                badgeEl.title = `Institution Storage: ${usage.usedGB} GB of ${usage.totalGB} GB Used (${usage.percentUsed}%). Remaining: ${usage.remainingGB} GB. Click to manage.`;
            }

            // 2. Settings Modal Quota Fields (if visible)
            const modalPercent = document.getElementById("modal-storage-percent");
            const modalBar = document.getElementById("modal-storage-bar");
            const modalUsed = document.getElementById("modal-storage-used");
            const modalRemaining = document.getElementById("modal-storage-remaining");

            if (modalPercent) modalPercent.textContent = `${usage.percentUsed}%`;
            if (modalBar) modalBar.style.width = `${Math.min(100, Math.max(1, usage.percentUsed))}%`;
            if (modalUsed) modalUsed.textContent = `${usage.usedGB} GB`;
            if (modalRemaining) modalRemaining.textContent = `${usage.remainingGB} GB`;
        } catch (e) {
            console.warn("Storage quota display update error:", e);
        }
    }

    async loadEvaluations() {
        if (this.currentView === "dashboard" && this.dashboardManager) {
            this.dashboardManager.evaluations = await window.appStorage.getAllEvaluations();
            this.dashboardManager.applyFilters();
            this.dashboardManager.render();
            this.dashboardManager.bindEvents();
        } else if (this.currentView === "history" && this.historyManager) {
            this.historyManager.evaluations = await window.appStorage.getAllEvaluations();
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
