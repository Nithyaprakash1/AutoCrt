/**
 * Niprak Digital Correction - Full-Page Settings Manager
 * Modern macOS / iPadOS System Settings layout with left vertical category nav,
 * profile preview, client password verification, and role-aware My Storage & Space Cleanup.
 */

class SettingsPageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentTab = options.initialTab || "profile";
        this.settings = null;
        this.userPassword = "";
        this.storageUsage = null;
        this.selectedPaperIds = new Set();
        this.storageStatusFilter = "all"; // "all" | "Completed" | "Pending"
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            await window.appStorage.getAllEvaluations();
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
                }
            };
        }

        if (window.appStorage && typeof window.appStorage.getStorageUsage === "function") {
            this.storageUsage = await window.appStorage.getStorageUsage();
        } else {
            this.storageUsage = {
                isTeacher: true,
                usedBytes: 0,
                formattedUsed: "0 KB",
                userUsedBytes: 0,
                userFormatted: "0 KB",
                completedBytes: 0,
                completedFormatted: "0 KB",
                completedCount: 0,
                pendingBytes: 0,
                pendingFormatted: "0 KB",
                pendingCount: 0,
                totalPapersCount: 0,
                totalPagesCount: 0,
                papersWithSize: []
            };
        }

        // Remove any selected IDs that no longer exist
        const validIds = new Set((this.storageUsage.papersWithSize || []).map(p => String(p.id)));
        for (const id of Array.from(this.selectedPaperIds)) {
            if (!validIds.has(String(id))) {
                this.selectedPaperIds.delete(id);
            }
        }
    }

    getFilteredStoragePapers() {
        const list = (this.storageUsage && Array.isArray(this.storageUsage.papersWithSize))
            ? this.storageUsage.papersWithSize
            : [];
        if (this.storageStatusFilter === "all") return list;
        return list.filter(p => p.status === this.storageStatusFilter);
    }

    getSelectedStorageSummary() {
        const list = (this.storageUsage && Array.isArray(this.storageUsage.papersWithSize))
            ? this.storageUsage.papersWithSize
            : [];
        const selected = list.filter(p => this.selectedPaperIds.has(String(p.id)));
        const bytes = selected.reduce((sum, p) => sum + (Number(p.sizeBytes) || 0), 0);
        const pages = selected.reduce((sum, p) => sum + (Number(p.pageCount) || 1), 0);
        const formatted = window.appStorage && typeof window.appStorage.formatStorageSize === "function"
            ? window.appStorage.formatStorageSize(bytes)
            : `${(bytes / 1024).toFixed(1)} KB`;
        return {
            count: selected.length,
            bytes,
            pages,
            formatted,
            papers: selected
        };
    }

    render() {
        if (!this.container) return;

        const currentUser = window.appStorage ? window.appStorage.getCurrentUser() : null;
        const teacherName = this.settings.teacher?.name || currentUser?.name || "";
        const instName = this.settings.institution?.name || "Adwaith Thought Academy";
        const teacherRole = this.settings.teacher?.role || currentUser?.roleLabel || "";
        const initials = teacherName.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "NP";

        const usage = this.storageUsage || {};
        const isTeacher = usage.isTeacher !== false;
        const filteredPapers = this.getFilteredStorageSummaryPapers();
        const selSummary = this.getSelectedStorageSummary();

        const totalBytes = Math.max(1, usage.userUsedBytes || 0);
        const completedPct = usage.userUsedBytes > 0 ? Math.min(100, Math.round((usage.completedBytes / totalBytes) * 100)) : 0;
        const pendingPct = usage.userUsedBytes > 0 ? Math.max(0, 100 - completedPct) : 0;

        this.container.innerHTML = `
            <div class="settings-page-layout">
                <!-- Top Header -->
                <div class="settings-page-header">
                    <div class="header-titles">
                        <div class="header-tag-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            System Preferences
                        </div>
                        <h1 class="page-title">Settings & Storage Management</h1>
                        <p class="page-subtitle">Manage your evaluator profile, account password security, and optimize your personal paper storage space.</p>
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
                                <span class="pill-title">My Storage & Cleanup</span>
                                <span class="pill-desc">${usage.userFormatted || '0 KB'} used (${usage.totalPapersCount || 0} papers)</span>
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
                                                <span class="preview-user-name" id="full-settings-name-preview">${teacherName || 'Your Name'}</span>
                                                <span class="preview-inst-tag" id="full-settings-inst-preview">${instName}${teacherRole ? ` • ${teacherRole}` : ''}</span>
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

                        <!-- Tab 3: My Storage & Space Cleanup (Role-Aware KB / MB / GB + Select & Clean) -->
                        <div class="settings-tab-section" id="sec-tab-cloud" style="display: ${this.currentTab === 'cloud' ? 'block' : 'none'};">
                            <div class="settings-card-group">
                                <div class="card-group-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                                    <div>
                                        <h3 class="card-group-title">${isTeacher ? 'My Allocated Paper Storage & Cleanup' : 'Uploaded Papers Storage & Space Optimizer'}</h3>
                                        <p class="card-group-desc">
                                            ${isTeacher
                                                ? 'View the exact storage space used by your assigned subject papers (in KB / MB / GB). Select evaluated or unwanted papers below to confirm and clean up your storage.'
                                                : 'Monitor exact storage consumption across uploaded answer scripts (in KB / MB / GB) and select papers to confirm and free space.'}
                                        </p>
                                    </div>
                                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: rgba(52, 199, 89, 0.1); color: #16A34A; font-size: 0.78rem; white-space: nowrap;">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                                        Smart Compression Active
                                    </span>
                                </div>

                                <div class="card-group-body">
                                    <!-- 3 Role-Aware Storage Breakdown Cards (Exact KB / MB / GB) -->
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 18px;">
                                        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px;">
                                            <div style="font-size: 0.75rem; color: #64748B; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 4px;">
                                                ${isTeacher ? 'My Storage Used' : 'Total Papers Storage'}
                                            </div>
                                            <div style="font-size: 1.45rem; color: #0F172A; letter-spacing: -0.02em; margin-bottom: 4px;">
                                                ${usage.userFormatted || '0 KB'}
                                            </div>
                                            <div style="font-size: 0.78rem; color: #64748B;">
                                                ${usage.totalPapersCount || 0} Paper(s) • ${usage.totalPagesCount || 0} Page(s)
                                            </div>
                                        </div>

                                        <div style="background: rgba(52, 199, 89, 0.05); border: 1px solid rgba(52, 199, 89, 0.22); border-radius: 14px; padding: 16px;">
                                            <div style="font-size: 0.75rem; color: #15803D; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 4px;">
                                                Evaluated (Safe to Clean)
                                            </div>
                                            <div style="font-size: 1.45rem; color: #16A34A; letter-spacing: -0.02em; margin-bottom: 4px;">
                                                ${usage.completedFormatted || '0 KB'}
                                            </div>
                                            <div style="font-size: 0.78rem; color: #15803D;">
                                                ${usage.completedCount || 0} Evaluated Paper(s)
                                            </div>
                                        </div>

                                        <div style="background: rgba(255, 149, 0, 0.05); border: 1px solid rgba(255, 149, 0, 0.24); border-radius: 14px; padding: 16px;">
                                            <div style="font-size: 0.75rem; color: #B45309; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 4px;">
                                                Pending Correction
                                            </div>
                                            <div style="font-size: 1.45rem; color: #D97706; letter-spacing: -0.02em; margin-bottom: 4px;">
                                                ${usage.pendingFormatted || '0 KB'}
                                            </div>
                                            <div style="font-size: 0.78rem; color: #B45309;">
                                                ${usage.pendingCount || 0} Pending Paper(s)
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Proportional Storage Distribution Bar (Evaluated vs Pending) -->
                                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                                            <span style="font-size: 0.82rem; color: #334155;">
                                                Storage Breakdown: <b>${usage.completedFormatted || '0 KB'}</b> Evaluated (${completedPct}%) • <b>${usage.pendingFormatted || '0 KB'}</b> Pending (${pendingPct}%)
                                            </span>
                                            ${usage.completedCount > 0 ? `
                                                <button type="button" id="btn-settings-select-evaluated" style="display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 8px; border: 1px solid #16A34A; background: #FFFFFF; color: #16A34A; font-size: 0.76rem; cursor: pointer;">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                                    Select All Evaluated (${usage.completedCount})
                                                </button>
                                            ` : ''}
                                        </div>
                                        <div style="height: 10px; background: #E2E8F0; border-radius: 999px; overflow: hidden; display: flex;">
                                            <div style="width: ${completedPct}%; background: #34C759; height: 100%; transition: width 0.3s ease;" title="Evaluated: ${usage.completedFormatted}"></div>
                                            <div style="width: ${pendingPct}%; background: #FF9500; height: 100%; transition: width 0.3s ease;" title="Pending: ${usage.pendingFormatted}"></div>
                                        </div>
                                    </div>

                                    <!-- Action Bar to Filter, Select & Clean Storage -->
                                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <label style="font-size: 0.8rem; color: #64748B;">Show:</label>
                                            <select id="select-settings-storage-filter" class="form-select-sm" style="height: 34px; border-radius: 8px;">
                                                <option value="all" ${this.storageStatusFilter === 'all' ? 'selected' : ''}>All My Papers (${usage.totalPapersCount || 0})</option>
                                                <option value="Completed" ${this.storageStatusFilter === 'Completed' ? 'selected' : ''}>Evaluated Only (${usage.completedCount || 0})</option>
                                                <option value="Pending" ${this.storageStatusFilter === 'Pending' ? 'selected' : ''}>Pending Only (${usage.pendingCount || 0})</option>
                                            </select>
                                        </div>

                                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                            <button type="button" id="btn-settings-clean-selected" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 16px; border-radius: 8px; border: 1px solid #DC2626; background: ${selSummary.count > 0 ? '#DC2626' : '#FFFFFF'}; color: ${selSummary.count > 0 ? '#FFFFFF' : '#DC2626'}; font-size: 0.82rem; cursor: pointer; transition: all 0.15s ease;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                <span>Clean Selected (${selSummary.count})</span>
                                                ${selSummary.count > 0 ? `<span style="background: rgba(255,255,255,0.22); padding: 2px 7px; border-radius: 8px; font-size: 0.74rem;">Free ${selSummary.formatted}</span>` : ''}
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Selectable Papers Storage Table -->
                                    <div style="border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
                                        <div style="max-height: 340px; overflow-y: auto; overflow-x: auto;">
                                            <table class="papers-data-table" style="width: 100%; border-collapse: collapse; font-size: 0.83rem;">
                                                <thead>
                                                    <tr>
                                                        <th style="width: 42px; text-align: center; padding: 10px 12px;">
                                                            <input type="checkbox" id="settings-storage-select-all" title="Select all visible papers" style="cursor: pointer; width: 15px; height: 15px; vertical-align: middle; margin: 0;" ${filteredPapers.length > 0 && filteredPapers.every(p => this.selectedPaperIds.has(String(p.id))) ? 'checked' : ''} />
                                                        </th>
                                                        <th style="padding: 10px 12px;">Student & Roll</th>
                                                        <th style="padding: 10px 12px;">Class & Subject</th>
                                                        <th style="padding: 10px 12px;">Pages</th>
                                                        <th style="padding: 10px 12px;">Status</th>
                                                        <th style="padding: 10px 12px;">Storage Used</th>
                                                        <th style="width: 90px; text-align: right; padding: 10px 14px;">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${filteredPapers.length === 0 ? `
                                                        <tr>
                                                            <td colspan="7" style="padding: 32px 16px; text-align: center; color: #64748B;">
                                                                No papers found in storage for this filter.
                                                            </td>
                                                        </tr>
                                                    ` : filteredPapers.map(p => {
                                                        const isChecked = this.selectedPaperIds.has(String(p.id));
                                                        const isComp = p.status === "Completed";
                                                        return `
                                                            <tr data-storage-id="${p.id}" style="${isChecked ? 'background: rgba(220, 38, 38, 0.04);' : ''}">
                                                                <td style="text-align: center; padding: 10px 12px;">
                                                                    <input type="checkbox" class="settings-storage-row-check" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; vertical-align: middle; margin: 0;" />
                                                                </td>
                                                                <td style="padding: 10px 12px; white-space: nowrap;">
                                                                    <div style="display: flex; flex-direction: column;">
                                                                        <span style="color: #0F172A;">${p.studentName}</span>
                                                                        <span style="font-size: 0.74rem; color: #64748B;">Roll: ${p.rollNo}</span>
                                                                    </div>
                                                                </td>
                                                                <td style="padding: 10px 12px; white-space: nowrap;">
                                                                    <span class="badge-class-tag">${p.className}</span>
                                                                    <span style="margin-left: 6px; color: #334155;">${p.subject}</span>
                                                                </td>
                                                                <td style="padding: 10px 12px; white-space: nowrap;">
                                                                    <span class="badge-page-count">${p.pageCount} ${p.pageCount === 1 ? 'Page' : 'Pages'}</span>
                                                                </td>
                                                                <td style="padding: 10px 12px; white-space: nowrap;">
                                                                    <span class="status-pill ${isComp ? 'status-completed' : 'status-pending'}">
                                                                        <span class="status-dot"></span>
                                                                        ${isComp ? 'Evaluated' : 'Pending'}
                                                                    </span>
                                                                </td>
                                                                <td style="padding: 10px 12px; white-space: nowrap;">
                                                                    <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px; background: #F1F5F9; color: #0F172A; font-family: var(--font-mono); font-size: 0.78rem;">
                                                                        ${p.sizeFormatted}
                                                                    </span>
                                                                </td>
                                                                <td style="padding: 10px 14px; text-align: right; white-space: nowrap;">
                                                                    <button type="button" class="btn-paper-action btn-action-delete btn-settings-single-clean" data-id="${p.id}" title="Delete & clean this paper">
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        `;
                                                    }).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Bottom Sticky Action Bar -->
                        <div class="settings-bottom-actions">
                            <button type="button" class="btn-secondary" id="btn-reset-settings-defaults">Reset Profile Defaults</button>
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

    getFilteredStorageSummaryPapers() {
        return this.getFilteredStoragePapers();
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

        // Save Settings (Top and Bottom buttons)
        const handleSave = async () => {
            const tName = nameInput?.value.trim() || "";
            const iName = instInput?.value.trim() || "";
            const tRole = roleInput?.value.trim() || "";

            const newSettings = Object.assign({}, this.settings, {
                institution: {
                    name: iName,
                    code: this.settings.institution?.code || "",
                    logo: "assets/school_logo.jpg",
                    fullLogo: "assets/school_fulllogo.jpg"
                },
                teacher: {
                    name: tName,
                    role: tRole
                }
            });

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

                if (savedPass && currPass !== savedPass) {
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

        // Storage & Cleanup Tab Controls
        const filterSelect = this.container.querySelector("#select-settings-storage-filter");
        if (filterSelect) {
            filterSelect.addEventListener("change", (e) => {
                this.storageStatusFilter = e.target.value;
                this.render();
            });
        }

        const btnSelectEval = this.container.querySelector("#btn-settings-select-evaluated");
        if (btnSelectEval) {
            btnSelectEval.addEventListener("click", () => {
                const list = (this.storageUsage && Array.isArray(this.storageUsage.papersWithSize))
                    ? this.storageUsage.papersWithSize
                    : [];
                list.forEach(p => {
                    if (p.status === "Completed") {
                        this.selectedPaperIds.add(String(p.id));
                    }
                });
                this.render();
            });
        }

        const selectAllCheck = this.container.querySelector("#settings-storage-select-all");
        if (selectAllCheck) {
            selectAllCheck.addEventListener("change", (e) => {
                const visible = this.getFilteredStoragePapers();
                if (e.target.checked) {
                    visible.forEach(p => this.selectedPaperIds.add(String(p.id)));
                } else {
                    visible.forEach(p => this.selectedPaperIds.delete(String(p.id)));
                }
                this.render();
            });
        }

        this.container.querySelectorAll(".settings-storage-row-check").forEach(cb => {
            cb.addEventListener("change", (e) => {
                const id = String(cb.getAttribute("data-id"));
                if (e.target.checked) {
                    this.selectedPaperIds.add(id);
                } else {
                    this.selectedPaperIds.delete(id);
                }
                this.render();
            });
        });

        this.container.querySelectorAll(".btn-settings-single-clean").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = String(btn.getAttribute("data-id"));
                this.selectedPaperIds.clear();
                this.selectedPaperIds.add(id);
                this.showConfirmCleanStorageModal();
            });
        });

        const btnCleanSelected = this.container.querySelector("#btn-settings-clean-selected");
        if (btnCleanSelected) {
            btnCleanSelected.addEventListener("click", () => {
                if (this.selectedPaperIds.size === 0) {
                    if (window.app && window.app.showToast) {
                        window.app.showToast("Please select at least one paper using the checkboxes to clean storage.", "warning");
                    }
                    return;
                }
                this.showConfirmCleanStorageModal();
            });
        }

        // Reset to Defaults
        const btnResetDefaults = this.container.querySelector("#btn-reset-settings-defaults");
        if (btnResetDefaults) {
            btnResetDefaults.addEventListener("click", () => {
                if (confirm("Reset profile configuration to default values?")) {
                    if (nameInput) nameInput.value = "";
                    if (instInput) instInput.value = "";
                    if (roleInput) roleInput.value = "";
                    updateLivePreview();
                    handleSave();
                }
            });
        }
    }

    showConfirmCleanStorageModal() {
        const summary = this.getSelectedStorageSummary();
        if (summary.count === 0) return;

        const modalId = "settings-clean-storage-modal-overlay";
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        `;

        modal.innerHTML = `
            <div style="background: #FFFFFF; border-radius: 16px; max-width: 460px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.22); overflow: hidden; border: 1px solid #E2E8F0;">
                <div style="padding: 26px; text-align: center;">
                    <div style="width: 54px; height: 54px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.2rem; color: #0F172A; margin: 0 0 8px;">Confirm & Clean Storage</h3>
                    <p style="font-size: 0.86rem; color: #64748B; margin: 0 0 18px; line-height: 1.45;">
                        You are about to permanently remove <b>${summary.count} selected paper(s)</b> to optimize and free up your storage space.
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 16px; text-align: left; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Selected Papers:</span>
                            <span style="font-size: 0.85rem; color: #DC2626;">${summary.count} Paper(s)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 0.8rem; color: #64748B;">Total Pages Removed:</span>
                            <span style="font-size: 0.85rem; color: #1E293B;">${summary.pages} Page(s)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 0.8rem; color: #64748B;">Exact Storage Freed:</span>
                            <span style="font-size: 0.88rem; color: #16A34A;">${summary.formatted}</span>
                        </div>
                    </div>

                    <div id="settings-clean-progress-wrap" style="display: none; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748B; margin-bottom: 4px;">
                            <span id="settings-clean-status-label">Cleaning storage...</span>
                            <span id="settings-clean-pct-label">0%</span>
                        </div>
                        <div style="height: 6px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                            <div id="settings-clean-bar-fill" style="height: 100%; width: 0%; background: #DC2626; transition: width 0.15s ease;"></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="btn-cancel-settings-clean" style="flex: 1; height: 40px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #475569; font-size: 0.86rem; cursor: pointer;">
                            Cancel
                        </button>
                        <button type="button" id="btn-confirm-settings-clean" style="flex: 1.2; height: 40px; border-radius: 10px; border: none; background: #DC2626; color: #FFFFFF; font-size: 0.86rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span id="btn-confirm-settings-clean-text">Confirm & Clean (${summary.formatted})</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector("#btn-cancel-settings-clean");
        const confirmBtn = modal.querySelector("#btn-confirm-settings-clean");
        const confirmText = modal.querySelector("#btn-confirm-settings-clean-text");
        const progWrap = modal.querySelector("#settings-clean-progress-wrap");
        const statusLabel = modal.querySelector("#settings-clean-status-label");
        const pctLabel = modal.querySelector("#settings-clean-pct-label");
        const barFill = modal.querySelector("#settings-clean-bar-fill");

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.remove();
        });

        confirmBtn.addEventListener("click", async () => {
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.75";
            progWrap.style.display = "block";

            const ids = Array.from(this.selectedPaperIds);
            let cleanedCount = 0;

            for (let i = 0; i < ids.length; i++) {
                try {
                    if (window.appStorage) {
                        await window.appStorage.deleteEvaluation(ids[i]);
                        cleanedCount++;
                    }
                } catch (err) {
                    console.warn("Storage clean error:", err);
                }
                const pct = Math.round(((i + 1) / ids.length) * 100);
                barFill.style.width = `${pct}%`;
                pctLabel.textContent = `${pct}%`;
                statusLabel.textContent = `Cleaned ${i + 1} of ${ids.length} paper(s)...`;
            }

            this.selectedPaperIds.clear();
            confirmText.textContent = `✓ Freed ${summary.formatted}`;
            confirmBtn.style.background = "#16A34A";
            await new Promise(r => setTimeout(r, 400));
            modal.remove();

            await this.loadData();
            this.render();
            if (window.app && typeof window.app.updateStorageQuotaDisplay === "function") {
                window.app.updateStorageQuotaDisplay();
            }
            if (window.app && window.app.showToast) {
                window.app.showToast(`Cleaned ${cleanedCount} paper(s) and freed ${summary.formatted} of storage!`, "success");
            }
        });
    }
}

window.SettingsPageManager = SettingsPageManager;
