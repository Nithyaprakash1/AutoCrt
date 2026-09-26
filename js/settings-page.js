/**
 * OneSpace Digital Correction - Full-Page Settings Manager
 * Modern macOS / iPadOS System Settings layout with left vertical category nav,
 * profile preview, client password verification, database sync, and evaluation options.
 */

class SettingsPageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentTab = "profile";
        this.settings = null;
        this.userPassword = "admin123";
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            this.settings = await window.appStorage.getSettings();
            if (typeof window.appStorage.getUserPassword === "function") {
                this.userPassword = await window.appStorage.getUserPassword();
            }
        }
        if (!this.settings) {
            this.settings = {
                institution: {
                    name: "",
                    code: "",
                    logo: "assets/school_logo.jpg",
                    fullLogo: "assets/school_fulllogo.jpg"
                },
                teacher: {
                    name: "",
                    role: ""
                },
                storageMode: "local",
                firebaseConfig: {
                    apiKey: "",
                    projectId: "",
                    storageBucket: ""
                },
                preferences: {
                    passingPercentage: 40,
                    quickMarkRange: 10,
                    autosaveInterval: 10
                }
            };
        }
        if (!this.settings.preferences) {
            this.settings.preferences = {
                passingPercentage: 40,
                quickMarkRange: 10,
                autosaveInterval: 10
            };
        }
        if (window.appStorage && typeof window.appStorage.getStorageUsage === "function") {
            this.storageUsage = await window.appStorage.getStorageUsage();
        } else {
            this.storageUsage = { usedGB: 0, totalGB: 50, remainingGB: 50, percentUsed: 0 };
        }
    }

    render() {
        if (!this.container) return;

        const teacherName = this.settings.teacher?.name || "";
        const instName = this.settings.institution?.name || "";
        const teacherRole = this.settings.teacher?.role || "";
        const initials = teacherName.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "??";
        const storageMode = this.settings.storageMode || "local";
        const fbConfig = this.settings.firebaseConfig || {};
        const prefs = this.settings.preferences || { passingPercentage: 40, quickMarkRange: 10, autosaveInterval: 10 };

        this.container.innerHTML = `
            <div class="settings-page-layout">
                <!-- Top Header -->
                <div class="settings-page-header">
                    <div class="header-titles">
                        <div class="header-tag-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            System Preferences
                        </div>
                        <h1 class="page-title">Settings & Configuration</h1>
                        <p class="page-subtitle">Configure your profile identity, security credentials, database storage mode, and evaluation preferences.</p>
                    </div>

                    <div class="header-actions">
                        <button type="button" class="btn-settings-save-top" id="btn-save-settings-full">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            <span>Save Changes</span>
                        </button>
                    </div>
                </div>

                <!-- Main Settings Split View (Left Tabs + Right Panel) -->
                <div class="settings-split-container">
                    <!-- Left Vertical Category Nav Rail -->
                    <div class="settings-nav-rail">
                        <button type="button" class="settings-nav-pill ${this.currentTab === 'profile' ? 'active' : ''}" data-tab="profile">
                            <span class="pill-icon">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </span>
                            <div class="pill-text-col">
                                <span class="pill-title">Profile & Institution</span>
                                <span class="pill-desc">Name, role & institution</span>
                            </div>
                        </button>

                        <button type="button" class="settings-nav-pill ${this.currentTab === 'security' ? 'active' : ''}" data-tab="security">
                            <span class="pill-icon">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <div class="pill-text-col">
                                <span class="pill-title">Security & Password</span>
                                <span class="pill-desc">Password reset & auth</span>
                            </div>
                        </button>

                        <button type="button" class="settings-nav-pill ${this.currentTab === 'cloud' ? 'active' : ''}" data-tab="cloud">
                            <span class="pill-icon">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                            </span>
                            <div class="pill-text-col">
                                <span class="pill-title">Database & Cloud</span>
                                <span class="pill-desc">Local & Cloud Sync</span>
                            </div>
                        </button>

                        <button type="button" class="settings-nav-pill ${this.currentTab === 'preferences' ? 'active' : ''}" data-tab="preferences">
                            <span class="pill-icon">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            </span>
                            <div class="pill-text-col">
                                <span class="pill-title">Marking Preferences</span>
                                <span class="pill-desc">HUD score range & autosave</span>
                            </div>
                        </button>
                    </div>

                    <!-- Right Content Panel -->
                    <div class="settings-content-panel">
                        <!-- Tab 1: Profile & Institution -->
                        <div class="settings-tab-section" id="sec-tab-profile" style="display: ${this.currentTab === 'profile' ? 'block' : 'none'};">
                            <div class="settings-card-group">
                                <div class="card-group-header">
                                    <h3 class="card-group-title">User Display Profile</h3>
                                    <p class="card-group-desc">Information displayed on your evaluation sheets, feedback cards, and header profile.</p>
                                </div>

                                <div class="card-group-body">
                                    <div class="form-row-two-col">
                                        <div class="form-group">
                                            <label>Evaluator Full Name *</label>
                                            <input type="text" id="input-full-teacher-name" class="form-input" value="${teacherName}" placeholder="e.g. Mrs. Nithya Prakash" />
                                            <span class="form-help-text">Appears in header, sidebar badge, and digital certificates.</span>
                                        </div>

                                        <div class="form-group">
                                            <label>Designation / Role Title</label>
                                            <input type="text" id="input-full-teacher-role" class="form-input" value="${teacherRole}" placeholder="e.g. Senior Evaluator" />
                                        </div>
                                    </div>

                                    <div class="form-group" style="margin-top: 14px;">
                                        <label>School / Institution Name *</label>
                                        <input type="text" id="input-full-inst-name" class="form-input" value="${instName}" placeholder="e.g. Adwaith Thought Academy" />
                                        <span class="form-help-text">Appears in top navbar client badge and generated PDF report banners.</span>
                                    </div>

                                    <!-- Live Profile Card Preview -->
                                    <div class="profile-live-preview-box">
                                        <div class="preview-badge-label">Live Preview</div>
                                        <div class="preview-content-row">
                                            <div class="preview-avatar-chip" id="full-settings-avatar-preview">${initials}</div>
                                            <div class="preview-details">
                                                <span class="preview-user-name" id="full-settings-name-preview">${teacherName}</span>
                                                <span class="preview-inst-tag" id="full-settings-inst-preview">${instName} • ${teacherRole}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tab 2: Security & Password -->
                        <div class="settings-tab-section" id="sec-tab-security" style="display: ${this.currentTab === 'security' ? 'block' : 'none'};">
                            <div class="settings-card-group">
                                <div class="card-group-header">
                                    <h3 class="card-group-title">Account Password Reset</h3>
                                    <p class="card-group-desc">Update your account credentials to keep your evaluator portal secure.</p>
                                </div>

                                <div class="card-group-body">
                                    <div id="full-password-status-box" class="settings-status-box" style="display: none;"></div>

                                    <div class="form-group" style="margin-bottom: 16px;">
                                        <label>Current Password *</label>
                                        <input type="password" id="input-full-curr-password" class="form-input" placeholder="Enter your existing password" autocomplete="current-password" />
                                    </div>

                                    <div class="form-row-two-col">
                                        <div class="form-group">
                                            <label>New Password *</label>
                                            <input type="password" id="input-full-new-password" class="form-input" placeholder="Minimum 6 characters" autocomplete="new-password" />
                                        </div>

                                        <div class="form-group">
                                            <label>Confirm New Password *</label>
                                            <input type="password" id="input-full-confirm-password" class="form-input" placeholder="Re-type new password" autocomplete="new-password" />
                                        </div>
                                    </div>

                                    <div class="security-action-row" style="margin-top: 18px;">
                                        <button type="button" class="btn-primary" id="btn-full-submit-password">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                            Update Password
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tab 3: Cloud & Database -->
                        <div class="settings-tab-section" id="sec-tab-cloud" style="display: ${this.currentTab === 'cloud' ? 'block' : 'none'};">
                            <div class="settings-card-group">
                                <div class="card-group-header">
                                    <h3 class="card-group-title">Storage & Synchronization Mode</h3>
                                    <p class="card-group-desc">Select how evaluations and student papers are persisted across sessions.</p>
                                </div>

                                <div class="card-group-body">
                                    <!-- 50.0 GB Institution Storage Quota Meter -->
                                    <div class="quota-meter-container" style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                            <div>
                                                <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">Institution Quota Limit</h4>
                                                <p style="font-size: 0.78rem; color: var(--text-muted);">Allocated capacity for PDF answer papers and evaluations.</p>
                                            </div>
                                            <span style="font-size: 0.95rem; font-weight: 700; color: #0071E3;">${this.storageUsage?.percentUsed || 0}% Used</span>
                                        </div>
                                        <div style="height: 10px; background: rgba(0,0,0,0.06); border-radius: 99px; overflow: hidden; margin-bottom: 12px;">
                                            <div style="height: 100%; width: ${Math.min(100, Math.max(1, this.storageUsage?.percentUsed || 0))}%; background: linear-gradient(90deg, #34C759, #0071E3); border-radius: 99px; transition: width 0.4s ease;"></div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted);">
                                            <span>Used: <strong style="color: var(--text-main);">${this.storageUsage?.usedGB || 0} GB</strong></span>
                                            <span>Remaining: <strong style="color: var(--text-main);">${this.storageUsage?.remainingGB || 50} GB</strong></span>
                                            <span>Quota Limit: <strong style="color: var(--text-main);">50.0 GB Limit</strong></span>
                                        </div>
                                    </div>

                                    <div class="form-group" style="margin-bottom: 18px;">
                                        <label>Data Storage Mode</label>
                                        <select id="select-full-storage-mode" class="form-select">
                                            <option value="local" ${storageMode === 'local' ? 'selected' : ''}>Local Offline Mode (IndexedDB + LocalStorage)</option>
                                            <option value="firebase" ${storageMode === 'firebase' ? 'selected' : ''}>Cloud Server & Realtime Sync</option>
                                        </select>
                                    </div>

                                    <div id="full-firebase-credentials-box" style="display: ${storageMode === 'firebase' ? 'block' : 'none'}; border-top: 1px solid var(--border-color); padding-top: 16px;">
                                        <h4 class="sub-section-title">Cloud Server Configuration</h4>
                                        <div class="form-group" style="margin-bottom: 12px;">
                                            <label>API Key</label>
                                            <input type="text" id="input-fb-api-key" class="form-input" placeholder="AIzaSy..." value="${fbConfig.apiKey || ''}" />
                                        </div>
                                        <div class="form-group" style="margin-bottom: 12px;">
                                            <label>Project ID</label>
                                            <input type="text" id="input-fb-project-id" class="form-input" placeholder="niprak-osm-evaluation" value="${fbConfig.projectId || 'niprak-osm-evaluation'}" />
                                        </div>
                                        <div class="form-group" style="margin-bottom: 12px;">
                                            <label>Storage Bucket</label>
                                            <input type="text" id="input-fb-storage-bucket" class="form-input" placeholder="niprak-osm-evaluation.appspot.com" value="${fbConfig.storageBucket || 'niprak-osm-evaluation.appspot.com'}" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tab 4: Evaluation Preferences -->
                        <div class="settings-tab-section" id="sec-tab-preferences" style="display: ${this.currentTab === 'preferences' ? 'block' : 'none'};">
                            <div class="settings-card-group">
                                <div class="card-group-header">
                                    <h3 class="card-group-title">Evaluation Workspace Defaults</h3>
                                    <p class="card-group-desc">Tailor on-screen marking HUD controls, quick-score buttons, and autosave intervals.</p>
                                </div>

                                <div class="card-group-body">
                                    <div class="form-row-two-col">
                                        <div class="form-group">
                                            <label>Top HUD Quick-Mark Buttons Range</label>
                                            <select id="select-quick-mark-range" class="form-select">
                                                <option value="10" ${prefs.quickMarkRange === 10 ? 'selected' : ''}>0 to 10 Marks (Standard)</option>
                                                <option value="5" ${prefs.quickMarkRange === 5 ? 'selected' : ''}>0 to 5 Marks (Short Questions)</option>
                                                <option value="20" ${prefs.quickMarkRange === 20 ? 'selected' : ''}>0 to 20 Marks (Extended Questions)</option>
                                            </select>
                                            <span class="form-help-text">Determines the numbers displayed on the top HUD quick-mark bar.</span>
                                        </div>

                                        <div class="form-group">
                                            <label>Default Minimum Passing %</label>
                                            <input type="number" id="input-passing-percentage" class="form-input" min="20" max="80" value="${prefs.passingPercentage || 40}" />
                                            <span class="form-help-text">Used for pass/fail classification in bulk analytics.</span>
                                        </div>
                                    </div>

                                    <div class="form-group" style="margin-top: 14px;">
                                        <label>Autosave Frequency (Seconds)</label>
                                        <select id="select-autosave-interval" class="form-select">
                                            <option value="5" ${prefs.autosaveInterval === 5 ? 'selected' : ''}>Every 5 Seconds</option>
                                            <option value="10" ${prefs.autosaveInterval === 10 ? 'selected' : ''}>Every 10 Seconds (Recommended)</option>
                                            <option value="30" ${prefs.autosaveInterval === 30 ? 'selected' : ''}>Every 30 Seconds</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Bottom Sticky Action Bar -->
                        <div class="settings-bottom-actions">
                            <button type="button" class="btn-secondary" id="btn-reset-settings-defaults">Reset to Defaults</button>
                            <button type="button" class="btn-primary" id="btn-save-settings-bottom">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Tab switching
        this.container.querySelectorAll(".settings-nav-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                const tab = pill.getAttribute("data-tab");
                this.currentTab = tab;
                this.container.querySelectorAll(".settings-nav-pill").forEach(p => p.classList.toggle("active", p === pill));
                this.container.querySelectorAll(".settings-tab-section").forEach(sec => {
                    sec.style.display = sec.id === `sec-tab-${tab}` ? "block" : "none";
                });
            });
        });

        // Live Preview updates
        const nameInput = this.container.querySelector("#input-full-teacher-name");
        const instInput = this.container.querySelector("#input-full-inst-name");
        const roleInput = this.container.querySelector("#input-full-teacher-role");
        const avatarPreview = this.container.querySelector("#full-settings-avatar-preview");
        const namePreview = this.container.querySelector("#full-settings-name-preview");
        const instPreview = this.container.querySelector("#full-settings-inst-preview");

        const updateLivePreview = () => {
            const n = nameInput?.value.trim() || "";
            const inst = instInput?.value.trim() || "";
            const role = roleInput?.value.trim() || "";
            const initials = n.split(" ").filter(Boolean).map(x => x[0]).slice(0, 2).join("").toUpperCase() || "??";

            if (avatarPreview) avatarPreview.textContent = initials;
            if (namePreview) namePreview.textContent = n || "Your Name";
            if (instPreview) instPreview.textContent = inst || role ? `${inst}${inst && role ? " • " : ""}${role}` : "Your Institution";
        };

        if (nameInput) nameInput.addEventListener("input", updateLivePreview);
        if (instInput) instInput.addEventListener("input", updateLivePreview);
        if (roleInput) roleInput.addEventListener("input", updateLivePreview);

        // Toggle Firebase credentials box
        const storageModeSelect = this.container.querySelector("#select-full-storage-mode");
        const fbBox = this.container.querySelector("#full-firebase-credentials-box");
        if (storageModeSelect && fbBox) {
            storageModeSelect.addEventListener("change", () => {
                fbBox.style.display = storageModeSelect.value === "firebase" ? "block" : "none";
            });
        }

        // Save Settings (Top and Bottom buttons)
        const handleSave = async () => {
            const tName = nameInput?.value.trim() || "";
            const iName = instInput?.value.trim() || "";
            const tRole = roleInput?.value.trim() || "";
            const sMode = storageModeSelect?.value || "local";

            const passPct = Number(this.container.querySelector("#input-passing-percentage")?.value) || 40;
            const qmRange = Number(this.container.querySelector("#select-quick-mark-range")?.value) || 10;
            const autoInt = Number(this.container.querySelector("#select-autosave-interval")?.value) || 10;

            const newSettings = {
                institution: {
                    name: iName,
                    code: this.settings.institution?.code || "",
                    logo: "assets/school_logo.jpg",
                    fullLogo: "assets/school_fulllogo.jpg"
                },
                teacher: {
                    name: tName,
                    role: tRole
                },
                storageMode: sMode,
                firebaseConfig: {
                    apiKey: this.container.querySelector("#input-fb-api-key")?.value.trim() || "",
                    projectId: this.container.querySelector("#input-fb-project-id")?.value.trim() || "",
                    storageBucket: this.container.querySelector("#input-fb-storage-bucket")?.value.trim() || ""
                },
                preferences: {
                    passingPercentage: passPct,
                    quickMarkRange: qmRange,
                    autosaveInterval: autoInt
                }
            };

            this.settings = newSettings;
            if (window.appStorage) {
                await window.appStorage.saveSettings(newSettings);
            }
            if (window.app) {
                window.app.applySettingsToUI(newSettings);
                window.app.showToast("Settings updated successfully!");
            }
        };

        const btnSaveTop = this.container.querySelector("#btn-save-settings-full");
        const btnSaveBottom = this.container.querySelector("#btn-save-settings-bottom");
        if (btnSaveTop) btnSaveTop.addEventListener("click", handleSave);
        if (btnSaveBottom) btnSaveBottom.addEventListener("click", handleSave);

        // Password Reset Submission
        const btnSubmitPassword = this.container.querySelector("#btn-full-submit-password");
        if (btnSubmitPassword) {
            btnSubmitPassword.addEventListener("click", async () => {
                const statusBox = this.container.querySelector("#full-password-status-box");
                const currPass = this.container.querySelector("#input-full-curr-password")?.value || "";
                const newPass = this.container.querySelector("#input-full-new-password")?.value || "";
                const confirmPass = this.container.querySelector("#input-full-confirm-password")?.value || "";

                const showStatus = (msg, isSuccess = false) => {
                    if (!statusBox) return;
                    statusBox.style.display = "block";
                    statusBox.className = `settings-status-box ${isSuccess ? 'status-success' : 'status-error'}`;
                    statusBox.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span>${msg}</span>
                    `;
                };

                const savedPass = window.appStorage ? (await window.appStorage.getUserPassword()) : "";

                if (!currPass) {
                    showStatus("Please enter your current password.");
                    return;
                }

                if (currPass !== savedPass) {
                    showStatus("Current password is incorrect. Please verify and try again.");
                    return;
                }

                if (!newPass || newPass.length < 6) {
                    showStatus("New password must be at least 6 characters in length.");
                    return;
                }

                if (newPass !== confirmPass) {
                    showStatus("New password and confirmation password do not match.");
                    return;
                }

                if (window.appStorage) {
                    await window.appStorage.saveUserPassword(newPass);
                }
                this.userPassword = newPass;

                // Clear input fields
                const cInput = this.container.querySelector("#input-full-curr-password");
                const nInput = this.container.querySelector("#input-full-new-password");
                const cfInput = this.container.querySelector("#input-full-confirm-password");
                if (cInput) cInput.value = "";
                if (nInput) nInput.value = "";
                if (cfInput) cfInput.value = "";

                showStatus("Password successfully updated and securely saved!", true);
                if (window.app) window.app.showToast("Account password updated!");
            });
        }

        // Reset to Defaults
        const btnResetDefaults = this.container.querySelector("#btn-reset-settings-defaults");
        if (btnResetDefaults) {
            btnResetDefaults.addEventListener("click", () => {
                if (confirm("Reset configuration to default values? This will clear your name, institution and role fields.")) {
                    if (nameInput) nameInput.value = "";
                    if (instInput) instInput.value = "";
                    if (roleInput) roleInput.value = "";
                    updateLivePreview();
                    handleSave();
                }
            });
        }
    }
}

window.SettingsPageManager = SettingsPageManager;
