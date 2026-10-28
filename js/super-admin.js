/**
 * Niprak Digital Correction - Super Admin Master Control Center
 * Exclusive console for platform owner (iamnithyaprakash@gmail.com):
 * 1. Platform License & Subscription Locking Engine (1/3/4/6/12 months or custom expiry, emergency kill switch)
 * 2. UPI QR Code & Bank Account details configuration with live preview
 * 3. Master Storage Engine & Deep Cleanup (safe multi-paper purge, cache wipe, JSON backup)
 * 4. Master User Governance (create, edit, reset passwords, change roles, assign subjects/classes)
 */

class SuperAdminManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.activeTab = options.initialTab || "license"; // "license" | "storage" | "users" | "analytics"
        this.license = null;
        this.storageUsage = null;
        this.users = [];
        this.papers = [];
        this.selectedPaperIds = new Set();
        this.userSearchQuery = "";
        this.userRoleFilter = "all";
        this.storageSearchQuery = "";
        this.storageFilterStatus = "all";
        this.auditSearchQuery = "";
        this.auditSelectedClass = "all";
        this.revealedPasswords = new Set();
        this.editingUser = null;
    }

    switchTab(tabName) {
        if (!tabName) return;
        this.activeTab = tabName;
        this.render();
    }

    async init(targetTab = null) {
        if (targetTab) this.activeTab = targetTab;
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (!window.appStorage) return;
        await window.appStorage.readyPromise;
        this.license = await window.appStorage.getLicenseConfig();
        this.storageUsage = await window.appStorage.getStorageUsage();
        this.users = await window.appStorage.getUsersList();
        const allPapers = await window.appStorage.getAllEvaluations();
        this.papers = allPapers;
    }

    render() {
        if (!this.container) return;

        // Compute high level KPIs
        const totalPapers = this.papers.length;
        const totalUsers = this.users.length;
        const totalBytes = this.papers.reduce((sum, p) => sum + (p.fileSizeBytes || (window.appStorage.measurePaperBytesSync ? window.appStorage.measurePaperBytesSync(p) : 0)), 0);
        const formattedTotalStorage = window.appStorage.formatStorageSize(totalBytes);

        // License status determination
        const isManuallyLocked = this.license?.isManuallyLocked === true;
        const expiryTime = this.license?.expiresAt ? new Date(this.license.expiresAt).getTime() : 0;
        const now = Date.now();
        const isExpired = expiryTime > 0 && now > expiryTime;
        const isPlatformActive = !isManuallyLocked && !isExpired;

        let statusBadge = `<span class="super-status-pill status-active"><span class="status-dot-pulse"></span> ACTIVE</span>`;
        if (isManuallyLocked) {
            statusBadge = `<span class="super-status-pill status-locked"><span class="status-dot-pulse pulse-red"></span> LOCKED MANUALLY</span>`;
        } else if (isExpired) {
            statusBadge = `<span class="super-status-pill status-expired"><span class="status-dot-pulse pulse-amber"></span> EXPIRED</span>`;
        }

        // Remaining time calculation
        let timeRemainingText = "Expired";
        let daysLeft = 0;
        if (!isExpired && expiryTime > now) {
            const diffMs = expiryTime - now;
            daysLeft = Math.floor(diffMs / (24 * 60 * 60 * 1000));
            const hoursLeft = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            timeRemainingText = `${daysLeft} Days, ${hoursLeft} Hours Remaining`;
        }

        this.container.innerHTML = `
            <div class="super-admin-layout">
                <!-- Top Header Banner -->
                <div class="super-header-bar">
                    <div class="super-header-titles">
                        <div class="super-royal-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            PLATFORM OWNER & SUPER ADMIN CONSOLE
                        </div>
                        <h1 class="super-title">Super Admin Master Control Center</h1>
                        <p class="super-subtitle">Universal platform license subscription, emergency locking kill-switch, institutional storage deep cleanup, and master user governance.</p>
                    </div>

                    <div class="super-header-metrics">
                        <div class="super-metric-chip">
                            <span class="metric-chip-label">Platform Status</span>
                            <span class="metric-chip-val">${statusBadge}</span>
                        </div>
                        <div class="super-metric-chip">
                            <span class="metric-chip-label">Storage Used</span>
                            <span class="metric-chip-val" style="color: #0071E3;">${formattedTotalStorage}</span>
                        </div>
                        <div class="super-metric-chip">
                            <span class="metric-chip-label">Total Users</span>
                            <span class="metric-chip-val" style="color: #AF52DE;">${totalUsers} Users</span>
                        </div>
                    </div>
                </div>

                <!-- Navigation Tabs -->
                <div class="super-tabs-bar">
                    <button type="button" class="super-tab-btn ${this.activeTab === 'license' ? 'active' : ''}" data-tab="license">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span>License &amp; Access Locking</span>
                        ${isPlatformActive ? `<span class="super-tab-chip chip-green">${daysLeft}d left</span>` : `<span class="super-tab-chip chip-red">Locked</span>`}
                    </button>
                    <button type="button" class="super-tab-btn ${this.activeTab === 'storage' ? 'active' : ''}" data-tab="storage">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                        <span>Storage &amp; Deep Cleanup</span>
                        <span class="super-tab-chip chip-blue">${this.papers.length} Papers</span>
                    </button>
                    <button type="button" class="super-tab-btn ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>User Management</span>
                        <span class="super-tab-chip">${this.users.length}</span>
                    </button>
                    <button type="button" class="super-tab-btn ${this.activeTab === 'analytics' ? 'active' : ''}" data-tab="analytics">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                        <span>Audit &amp; Analytics Matrix</span>
                    </button>
                </div>

                <!-- Tab Pane Viewports -->
                <div class="super-pane-viewport">
                    ${this.activeTab === 'license' ? this.renderLicenseTab(isPlatformActive, isManuallyLocked, isExpired, timeRemainingText, daysLeft) : ''}
                    ${this.activeTab === 'storage' ? this.renderStorageTab(formattedTotalStorage) : ''}
                    ${this.activeTab === 'users' ? this.renderUsersTab() : ''}
                    ${this.activeTab === 'analytics' ? this.renderAnalyticsTab() : ''}
                </div>
            </div>

            <!-- Modal Container Root -->
            <div id="super-modal-root"></div>
        `;

        this.bindEvents();
    }

    // ==========================================
    // TAB 1: LICENSE & ACCESS LOCKING
    // ==========================================

    renderLicenseTab(isActive, isManuallyLocked, isExpired, timeRemainingText, daysLeft) {
        const lic = this.license || {};
        const expiryFormatted = lic.expiresAt ? new Date(lic.expiresAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }) : "Not Set";
        const activatedFormatted = lic.activatedAt ? new Date(lic.activatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
        const bank = lic.bankDetails || {};

        return `
            <div class="super-pane-container">
                <!-- Status Banner & Kill Switch Card -->
                <div class="super-license-status-card ${isActive ? 'card-active' : 'card-locked'}">
                    <div class="status-card-header">
                        <div class="status-headline-wrap">
                            <div class="status-big-icon ${isActive ? 'icon-green' : 'icon-red'}">
                                ${isActive ? `
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                                ` : `
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                `}
                            </div>
                            <div class="status-headline-col">
                                <span class="status-pre-title">INSTITUTIONAL LICENSE STATUS</span>
                                <h2 class="status-main-title">${isActive ? 'Platform Access is ACTIVE' : (isManuallyLocked ? 'Platform Access is MANUALLY LOCKED' : 'Platform License has EXPIRED')}</h2>
                                <p class="status-desc">${isActive 
                                    ? `Teachers and exam officers have full access to mark papers, view dashboards, and ingest documents. (${timeRemainingText})` 
                                    : `All non-admin users (evaluators, uploaders) are strictly blocked by the institutional lock screen. Only Super Admin can sign in.`}</p>
                            </div>
                        </div>

                        <!-- Instant Kill Switch Action -->
                        <div class="kill-switch-action-wrap">
                            <button type="button" id="btn-super-toggle-killswitch" class="btn-super-killswitch ${isManuallyLocked ? 'btn-unlock' : 'btn-lock'}">
                                ${isManuallyLocked ? `
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V7a5 5 0 0 1 9.9-1"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/></svg>
                                    <span>UNLOCK PLATFORM ACCESS</span>
                                ` : `
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    <span>LOCK PLATFORM ACCESS NOW</span>
                                `}
                            </button>
                        </div>
                    </div>

                    <!-- Countdown & Expiry Grid -->
                    <div class="status-dates-grid">
                        <div class="date-box">
                            <span class="date-box-label">Expires On</span>
                            <span class="date-box-val" id="lic-expiry-display">${expiryFormatted}</span>
                        </div>
                        <div class="date-box">
                            <span class="date-box-label">Time Remaining</span>
                            <span class="date-box-val" style="color: ${isActive ? '#16A34A' : '#DC2626'}; font-weight: 700;">${timeRemainingText}</span>
                        </div>
                        <div class="date-box">
                            <span class="date-box-label">Last Activated</span>
                            <span class="date-box-val">${activatedFormatted}</span>
                        </div>
                        <div class="date-box">
                            <span class="date-box-label">Licensed School</span>
                            <span class="date-box-val">${lic.institutionName || 'Adwaith Thought Academy'}</span>
                        </div>
                    </div>
                </div>

                <!-- 1-Click Subscription Duration Extension Chips -->
                <div class="super-card" style="margin-top: 24px;">
                    <div class="super-card-header">
                        <div>
                            <h3 class="super-card-title">1-Click Subscription Duration Activation</h3>
                            <p class="super-card-sub">When the institution pays via QR code or bank transfer, click any duration preset below to instantly activate or extend access.</p>
                        </div>
                    </div>

                    <div class="duration-presets-grid">
                        <button type="button" class="duration-preset-btn" data-days="30" data-label="1 Month">
                            <span class="preset-name">1 Month</span>
                            <span class="preset-days">+30 Days Access</span>
                            <span class="preset-tag">Trial / Short Term</span>
                        </button>
                        <button type="button" class="duration-preset-btn recommended" data-days="90" data-label="3 Months">
                            <span class="preset-badge">POPULAR</span>
                            <span class="preset-name">3 Months</span>
                            <span class="preset-days">+90 Days Access</span>
                            <span class="preset-tag">Quarterly Term</span>
                        </button>
                        <button type="button" class="duration-preset-btn recommended-gold" data-days="120" data-label="4 Months">
                            <span class="preset-badge badge-gold">RECOMMENDED</span>
                            <span class="preset-name">4 Months</span>
                            <span class="preset-days">+120 Days Access</span>
                            <span class="preset-tag">Full Academic Term</span>
                        </button>
                        <button type="button" class="duration-preset-btn" data-days="180" data-label="6 Months">
                            <span class="preset-name">6 Months</span>
                            <span class="preset-days">+180 Days Access</span>
                            <span class="preset-tag">Semester License</span>
                        </button>
                        <button type="button" class="duration-preset-btn" data-days="365" data-label="1 Year">
                            <span class="preset-name">1 Year</span>
                            <span class="preset-days">+365 Days Access</span>
                            <span class="preset-tag">Annual License</span>
                        </button>
                    </div>

                    <!-- Custom Date & Time Picker -->
                    <div class="custom-expiry-row">
                        <div class="custom-expiry-col">
                            <label class="super-label" for="super-custom-expiry-input">Or Set Exact Custom Expiration Date &amp; Time:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="datetime-local" id="super-custom-expiry-input" class="super-input" style="max-width: 320px;" />
                                <button type="button" id="btn-super-apply-custom-expiry" class="btn-super-secondary">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span>Set Custom Expiry</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Payment QR Code & Bank Account Configuration -->
                <div class="super-card" style="margin-top: 24px;">
                    <div class="super-card-header">
                        <div>
                            <h3 class="super-card-title">UPI QR Code &amp; Bank Account Configuration</h3>
                            <p class="super-card-sub">Configure your payment QR code and bank credentials displayed to the institution on the locked screen when subscription expires.</p>
                        </div>
                        <div>
                            <button type="button" id="btn-super-preview-locked" class="btn-super-secondary">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span>Preview Locked Screen</span>
                            </button>
                        </div>
                    </div>

                    <div class="payment-config-grid">
                        <!-- Left: QR Code Preview & Upload -->
                        <div class="qr-preview-col">
                            <div class="qr-box-frame">
                                <div class="qr-img-wrap" id="super-qr-preview-container">
                                    ${this.renderQrPreviewImage(lic.paymentQrUrl, bank.upiId)}
                                </div>
                                <span class="qr-caption">Scannable by Google Pay, PhonePe, Paytm, BHIM &amp; Banking Apps</span>
                            </div>

                            <div class="qr-upload-actions">
                                <label class="btn-super-secondary btn-upload-qr-label">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    <span>Upload QR Image</span>
                                    <input type="file" id="super-qr-file-input" accept="image/*" style="display: none;" />
                                </label>
                                ${lic.paymentQrUrl ? `
                                    <button type="button" id="btn-super-reset-qr" class="btn-super-secondary" style="color: #DC2626;" title="Reset to standard UPI QR">Reset</button>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Right: Bank Credentials & Contact Form -->
                        <div class="bank-form-col">
                            <div class="form-row-2">
                                <div class="super-form-group">
                                    <label class="super-label">Account Holder Name</label>
                                    <input type="text" id="cfg-account-name" class="super-input" value="${bank.accountName || 'Nithya Prakash'}" placeholder="e.g. Nithya Prakash" />
                                </div>
                                <div class="super-form-group">
                                    <label class="super-label">Bank Name</label>
                                    <input type="text" id="cfg-bank-name" class="super-input" value="${bank.bankName || 'HDFC Bank'}" placeholder="e.g. HDFC Bank" />
                                </div>
                            </div>

                            <div class="form-row-2">
                                <div class="super-form-group">
                                    <label class="super-label">Account Number</label>
                                    <input type="text" id="cfg-account-number" class="super-input" value="${bank.accountNumber || '50100234567890'}" placeholder="Account Number" />
                                </div>
                                <div class="super-form-group">
                                    <label class="super-label">IFSC Code</label>
                                    <input type="text" id="cfg-ifsc-code" class="super-input" value="${bank.ifscCode || 'HDFC0001234'}" placeholder="e.g. HDFC0001234" />
                                </div>
                            </div>

                            <div class="form-row-2">
                                <div class="super-form-group">
                                    <label class="super-label">UPI ID (VPA)</label>
                                    <input type="text" id="cfg-upi-id" class="super-input" value="${bank.upiId || 'iamnithyaprakash@okhdfcbank'}" placeholder="e.g. iamnithyaprakash@okhdfcbank" />
                                </div>
                                <div class="super-form-group">
                                    <label class="super-label">Contact Mobile / WhatsApp</label>
                                    <input type="text" id="cfg-contact-phone" class="super-input" value="${lic.contactPhone || '+91 98765 43210'}" placeholder="+91..." />
                                </div>
                            </div>

                            <div class="super-form-group">
                                <label class="super-label">Custom Lockout Message (shown when subscription ends)</label>
                                <textarea id="cfg-lockout-msg" class="super-textarea" rows="3" placeholder="Enter instructions for renewal...">${lic.lockoutMessage || ''}</textarea>
                            </div>

                            <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
                                <button type="button" id="btn-save-license-settings" class="btn-super-primary">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                    <span>Save License &amp; Payment Settings</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderQrPreviewImage(customUrl, upiId) {
        if (customUrl) {
            return `<img src="${customUrl}" alt="Payment QR Code" class="qr-preview-img" />`;
        }
        // Crisp high-resolution SVG QR Code placeholder
        const cleanUpi = upiId || 'iamnithyaprakash@okhdfcbank';
        return `
            <div class="svg-qr-placeholder">
                <svg width="160" height="160" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="200" rx="16" fill="#FFFFFF"/>
                    <!-- QR Finder Patterns -->
                    <rect x="20" y="20" width="46" height="46" rx="6" fill="#0F172A"/>
                    <rect x="28" y="28" width="30" height="30" rx="3" fill="#FFFFFF"/>
                    <rect x="34" y="34" width="18" height="18" rx="2" fill="#0F172A"/>

                    <rect x="134" y="20" width="46" height="46" rx="6" fill="#0F172A"/>
                    <rect x="142" y="28" width="30" height="30" rx="3" fill="#FFFFFF"/>
                    <rect x="148" y="34" width="18" height="18" rx="2" fill="#0F172A"/>

                    <rect x="20" y="134" width="46" height="46" rx="6" fill="#0F172A"/>
                    <rect x="28" y="142" width="30" height="30" rx="3" fill="#FFFFFF"/>
                    <rect x="34" y="148" width="18" height="18" rx="2" fill="#0F172A"/>

                    <!-- QR Data Blocks -->
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
                <span class="upi-id-badge">UPI: ${cleanUpi}</span>
            </div>
        `;
    }

    // ==========================================
    // TAB 2: STORAGE & DEEP CLEANUP
    // ==========================================

    renderStorageTab(formattedTotalStorage) {
        const completedPapers = this.papers.filter(p => p.status === "Completed");
        const pendingPapers = this.papers.filter(p => p.status !== "Completed");

        const completedBytes = completedPapers.reduce((sum, p) => sum + (p.fileSizeBytes || (window.appStorage.measurePaperBytesSync ? window.appStorage.measurePaperBytesSync(p) : 0)), 0);
        const pendingBytes = pendingPapers.reduce((sum, p) => sum + (p.fileSizeBytes || (window.appStorage.measurePaperBytesSync ? window.appStorage.measurePaperBytesSync(p) : 0)), 0);

        const formattedCompleted = window.appStorage.formatStorageSize(completedBytes);
        const formattedPending = window.appStorage.formatStorageSize(pendingBytes);

        // Filtered papers list
        const filteredPapers = this.papers.filter(p => {
            if (this.storageFilterStatus !== "all") {
                if (this.storageFilterStatus === "completed" && p.status !== "Completed") return false;
                if (this.storageFilterStatus === "pending" && p.status === "Completed") return false;
            }
            if (this.storageSearchQuery) {
                const q = this.storageSearchQuery.toLowerCase();
                const mName = p.studentName && p.studentName.toLowerCase().includes(q);
                const mRoll = p.rollNo && p.rollNo.toLowerCase().includes(q);
                const mSub = p.subject && p.subject.toLowerCase().includes(q);
                const mId = p.id && p.id.toLowerCase().includes(q);
                if (!mName && !mRoll && !mSub && !mId) return false;
            }
            return true;
        });

        // Compute selected size
        const selectedCount = this.selectedPaperIds.size;
        let selectedBytes = 0;
        this.papers.forEach(p => {
            if (this.selectedPaperIds.has(String(p.id))) {
                selectedBytes += (p.fileSizeBytes || (window.appStorage.measurePaperBytesSync ? window.appStorage.measurePaperBytesSync(p) : 0));
            }
        });
        const formattedSelectedSize = window.appStorage.formatStorageSize(selectedBytes);

        return `
            <div class="super-pane-container">
                <!-- 3 Storage KPI Metric Cards -->
                <div class="super-storage-kpi-grid">
                    <div class="super-kpi-card">
                        <div class="kpi-icon-box icon-blue">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                        </div>
                        <div class="kpi-content">
                            <span class="kpi-label">Total System Storage Used</span>
                            <span class="kpi-val">${formattedTotalStorage}</span>
                            <span class="kpi-sub">${this.papers.length} Answer Papers • 50 GB Ceiling</span>
                        </div>
                    </div>

                    <div class="super-kpi-card">
                        <div class="kpi-icon-box icon-green">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div class="kpi-content">
                            <span class="kpi-label">Graded Scripts (Safe to Clean)</span>
                            <span class="kpi-val" style="color: #16A34A;">${formattedCompleted}</span>
                            <span class="kpi-sub">${completedPapers.length} Completed Scripts Ready to Wipe</span>
                        </div>
                    </div>

                    <div class="super-kpi-card">
                        <div class="kpi-icon-box icon-orange">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div class="kpi-content">
                            <span class="kpi-label">Pending Scripts (In Correction)</span>
                            <span class="kpi-val" style="color: #EA580C;">${formattedPending}</span>
                            <span class="kpi-sub">${pendingPapers.length} Papers Awaiting Final Grading</span>
                        </div>
                    </div>
                </div>

                <!-- Master Actions & Deep Cleanup Toolbar -->
                <div class="super-card" style="margin-top: 24px;">
                    <div class="super-card-header">
                        <div>
                            <h3 class="super-card-title">Deep Storage Engine &amp; Batch Purge Controls</h3>
                            <p class="super-card-sub">Select evaluated or older answer scripts to permanently free disk space across IndexedDB, CacheStorage, and Cloud Storage.</p>
                        </div>

                        <!-- System Utilities -->
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" id="btn-super-export-backup" class="btn-super-secondary" title="Export all database evaluations as JSON before cleaning">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>Export JSON Backup</span>
                            </button>
                            <button type="button" id="btn-super-wipe-cache" class="btn-super-secondary" title="Wipe local browser CacheStorage">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                <span>Wipe Browser Caches</span>
                            </button>
                        </div>
                    </div>

                    <!-- Batch Selection Toolbar -->
                    <div class="storage-batch-toolbar">
                        <div class="batch-select-btns">
                            <button type="button" id="btn-select-all-evaluated" class="btn-batch-chip">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Select All Graded (${completedPapers.length})</span>
                            </button>
                            <button type="button" id="btn-select-all-papers" class="btn-batch-chip">
                                <span>Select All (${this.papers.length})</span>
                            </button>
                            <button type="button" id="btn-deselect-all-papers" class="btn-batch-chip">
                                <span>Deselect All</span>
                            </button>
                        </div>

                        <!-- Purge Action -->
                        <div class="batch-purge-col">
                            ${selectedCount > 0 ? `
                                <span class="purge-count-pill">${selectedCount} Selected • ${formattedSelectedSize} Space</span>
                            ` : `<span class="purge-count-pill" style="color: #64748B;">0 Selected</span>`}

                            <button type="button" id="btn-purge-selected-papers" class="btn-super-danger" ${selectedCount === 0 ? 'disabled' : ''}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                <span>Purge Selected Papers (${selectedCount})</span>
                            </button>
                        </div>
                    </div>

                    <!-- Filter & Search Row -->
                    <div class="storage-filter-row">
                        <div class="search-box-wrap" style="flex: 1; max-width: 360px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="input-storage-search" class="search-input" placeholder="Search student name, roll no, subject..." value="${this.storageSearchQuery}" />
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <label class="super-label" style="margin: 0;">Status:</label>
                            <select id="select-storage-filter-status" class="super-select" style="width: 170px;">
                                <option value="all" ${this.storageFilterStatus === 'all' ? 'selected' : ''}>All Scripts</option>
                                <option value="completed" ${this.storageFilterStatus === 'completed' ? 'selected' : ''}>Completed (${completedPapers.length})</option>
                                <option value="pending" ${this.storageFilterStatus === 'pending' ? 'selected' : ''}>Pending (${pendingPapers.length})</option>
                            </select>
                        </div>
                    </div>

                    <!-- Papers Storage Table -->
                    <div class="table-scroll-wrapper" style="margin-top: 16px;">
                        <table class="super-data-table">
                            <thead>
                                <tr>
                                    <th style="width: 44px; text-align: center;">
                                        <input type="checkbox" id="chk-storage-select-all" ${this.papers.length > 0 && selectedCount === this.papers.length ? 'checked' : ''} />
                                    </th>
                                    <th>Student &amp; Roll No</th>
                                    <th>Subject &amp; Class</th>
                                    <th>Pages</th>
                                    <th>Evaluation Status</th>
                                    <th>Storage Size</th>
                                    <th style="text-align: right; width: 140px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredPapers.length === 0 ? `
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 36px; color: #64748B;">
                                            No answer papers match your search filter.
                                        </td>
                                    </tr>
                                ` : filteredPapers.map(p => {
                                    const pId = String(p.id);
                                    const isSelected = this.selectedPaperIds.has(pId);
                                    const pSize = p.fileSizeBytes || (window.appStorage.measurePaperBytesSync ? window.appStorage.measurePaperBytesSync(p) : 0);
                                    const formattedPSize = window.appStorage.formatStorageSize(pSize);
                                    const pPages = p.pageCount || (Array.isArray(p.pages) ? p.pages.length : (p.totalPages || 1));
                                    const isComp = p.status === "Completed";

                                    return `
                                        <tr class="${isSelected ? 'row-selected' : ''}">
                                            <td style="text-align: center;">
                                                <input type="checkbox" class="chk-paper-item" data-id="${pId}" ${isSelected ? 'checked' : ''} />
                                            </td>
                                            <td>
                                                <div style="font-weight: 600; color: #0F172A;">${p.studentName || 'Unnamed Student'}</div>
                                                <div style="font-size: 0.78rem; color: #64748B;">Roll: ${p.rollNo || '—'} • ID: ${pId}</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 500; color: #0F172A;">${p.subject || 'General'}</div>
                                                <div style="font-size: 0.78rem; color: #64748B;">${p.className || p.class || 'Class 12-A'}</div>
                                            </td>
                                            <td>
                                                <span class="pages-badge">${pPages} Pages</span>
                                            </td>
                                            <td>
                                                <span class="eval-status-badge ${isComp ? 'badge-completed' : 'badge-pending'}">
                                                    ${isComp ? 'Graded' : 'Pending'}
                                                </span>
                                            </td>
                                            <td>
                                                <strong style="color: #0071E3;">${formattedPSize}</strong>
                                            </td>
                                            <td style="text-align: right;">
                                                <div class="row-actions-group">
                                                    <button type="button" class="btn-row-action btn-inspect-paper" data-id="${pId}" title="Inspect paper pages">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    </button>
                                                    <button type="button" class="btn-row-action btn-delete-single-paper" data-id="${pId}" title="Delete paper to free storage" style="color: #DC2626;">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB 3: USER GOVERNANCE
    // ==========================================

    renderUsersTab() {
        const evaluators = this.users.filter(u => u.role === "evaluator");
        const uploaders = this.users.filter(u => u.role === "uploader");
        const admins = this.users.filter(u => u.role === "admin" || u.role === "super_admin");

        const filteredUsers = this.users.filter(u => {
            if (this.userRoleFilter !== "all" && u.role !== this.userRoleFilter) return false;
            if (this.userSearchQuery) {
                const q = this.userSearchQuery.toLowerCase();
                const mName = u.name && u.name.toLowerCase().includes(q);
                const mEmail = u.email && u.email.toLowerCase().includes(q);
                const mUser = u.username && u.username.toLowerCase().includes(q);
                const mSub = (u.assignedSubjects || []).some(s => s.toLowerCase().includes(q));
                if (!mName && !mEmail && !mUser && !mSub) return false;
            }
            return true;
        });

        return `
            <div class="super-pane-container">
                <!-- User Metrics Grid -->
                <div class="super-user-kpi-grid">
                    <div class="super-kpi-card">
                        <div class="kpi-icon-box icon-purple">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div class="kpi-content">
                            <span class="kpi-label">Total Registered Users</span>
                            <span class="kpi-val">${this.users.length}</span>
                        </div>
                    </div>
                    <div class="super-kpi-card">
                        <div class="kpi-icon-box icon-green">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </div>
                        <div class="kpi-content">
                            <span class="kpi-label">Evaluators / Teachers</span>
                            <span class="kpi-val" style="color: #16A34A;">${evaluators.length}</span>
                        </div>
                    </div>
                    <div class="super-kpi-card">
                        <div class="kpi-icon-box icon-blue">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div class="kpi-content">
                            <span class="kpi-label">Exam Dept Uploaders</span>
                            <span class="kpi-val" style="color: #0071E3;">${uploaders.length}</span>
                        </div>
                    </div>
                    <div class="super-kpi-card">
                        <div class="kpi-icon-box icon-gold">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </div>
                        <div class="kpi-content">
                            <span class="kpi-label">Administrators</span>
                            <span class="kpi-val" style="color: #D97706;">${admins.length}</span>
                        </div>
                    </div>
                </div>

                <!-- Users Table Card -->
                <div class="super-card" style="margin-top: 24px;">
                    <div class="super-card-header">
                        <div>
                            <h3 class="super-card-title">Universal User &amp; Credentials Governance</h3>
                            <p class="super-card-sub">Create accounts, assign subject allotments, reveal and reset passwords, and toggle active status.</p>
                        </div>
                        <div>
                            <button type="button" id="btn-super-add-user" class="btn-super-primary">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                <span>+ Add New User</span>
                            </button>
                        </div>
                    </div>

                    <!-- Filter & Search Toolbar -->
                    <div class="user-filter-toolbar">
                        <div class="search-box-wrap" style="flex: 1; max-width: 360px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="input-super-user-search" class="search-input" placeholder="Search user ID, name, or subject..." value="${this.userSearchQuery}" />
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <label class="super-label" style="margin: 0;">Role:</label>
                            <select id="select-super-role-filter" class="super-select" style="width: 170px;">
                                <option value="all" ${this.userRoleFilter === 'all' ? 'selected' : ''}>All Roles</option>
                                <option value="evaluator" ${this.userRoleFilter === 'evaluator' ? 'selected' : ''}>Evaluators</option>
                                <option value="uploader" ${this.userRoleFilter === 'uploader' ? 'selected' : ''}>Uploaders</option>
                                <option value="admin" ${this.userRoleFilter === 'admin' ? 'selected' : ''}>Admins</option>
                            </select>
                        </div>
                    </div>

                    <!-- Users Table -->
                    <div class="table-scroll-wrapper" style="margin-top: 16px;">
                        <table class="super-data-table">
                            <thead>
                                <tr>
                                    <th>User &amp; ID</th>
                                    <th>Role</th>
                                    <th>Assigned Subjects</th>
                                    <th>Credentials (Password)</th>
                                    <th>Status</th>
                                    <th style="text-align: right; width: 140px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredUsers.map(u => {
                                    const uId = String(u.id);
                                    const isSuper = u.role === "super_admin" || 
                                        (u.email && u.email.toLowerCase() === "iamnithyaprakash@gmail.com") ||
                                        (u.name && u.name.toLowerCase().includes("nithya prakash")) ||
                                        uId === "usr_super_admin";
                                    const isRevealed = this.revealedPasswords.has(uId);
                                    const passDisplay = isRevealed ? (u.password || '••••••') : '••••••••';
                                    const subjects = (u.assignedSubjects && u.assignedSubjects.length > 0) ? u.assignedSubjects.join(", ") : '—';
                                    const isAct = u.status !== "inactive";

                                    let roleBadge = `<span class="user-role-chip chip-evaluator">Evaluator</span>`;
                                    if (u.role === "uploader") roleBadge = `<span class="user-role-chip chip-uploader">Uploader</span>`;
                                    if (u.role === "admin") roleBadge = `<span class="user-role-chip chip-admin">Admin</span>`;
                                    if (isSuper) roleBadge = `<span class="user-role-chip chip-super">Super Admin</span>`;

                                    return `
                                        <tr>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 10px;">
                                                    <div class="user-avatar-mini">${(u.name || 'U').substring(0, 2).toUpperCase()}</div>
                                                    <div>
                                                        <div style="font-weight: 600; color: #0F172A;">${u.name} ${isSuper ? '👑' : ''}</div>
                                                        <div style="font-size: 0.78rem; color: #64748B;">${u.email || u.username} • ID: ${u.username || uId}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>${roleBadge}</td>
                                            <td>
                                                <div style="max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.82rem; color: #334155;" title="${subjects}">
                                                    ${subjects}
                                                </div>
                                            </td>
                                            <td>
                                                ${isSuper ? `
                                                    <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:5px; background:rgba(239, 68, 68, 0.12); color:#dc2626; font-size:0.75rem; font-weight:600; letter-spacing:0.4px;">
                                                        🔒 TOP SECRET • ENCRYPTED
                                                    </span>
                                                ` : `
                                                    <div style="display: flex; align-items: center; gap: 6px;">
                                                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #0F172A;">${passDisplay}</span>
                                                        <button type="button" class="btn-reveal-pass" data-id="${uId}" title="Reveal password">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                        </button>
                                                    </div>
                                                `}
                                            </td>
                                            <td>
                                                <span class="user-status-pill ${isAct ? 'pill-active' : 'pill-inactive'}">
                                                    ${isAct ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style="text-align: right;">
                                                <div class="row-actions-group">
                                                    <button type="button" class="btn-row-action btn-edit-user" data-id="${uId}" title="Edit user">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    ${!isSuper ? `
                                                        <button type="button" class="btn-row-action btn-delete-user" data-id="${uId}" title="Delete user" style="color: #DC2626;">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                        </button>
                                                    ` : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // TAB 4: ANALYTICS & AUDIT MATRIX
    // ==========================================

    renderAnalyticsTab() {
        const subjectsData = this.computeSubjectStats();
        const studentMatrix = this.computeStudentMatrix();
        const filteredMatrix = this.filterAuditMatrix(studentMatrix);
        const classStats = this.computeClassStats(studentMatrix);

        const totalPapers = this.papers.length;
        const completedPapers = this.papers.filter(p => p.status === "Completed" || (p.obtainedMarks != null && p.obtainedMarks > 0)).length;
        const pendingPapers = Math.max(0, totalPapers - completedPapers);
        const passRate = totalPapers > 0 ? Math.round((completedPapers / totalPapers) * 100) : 100;
        const totalPages = this.papers.reduce((sum, p) => sum + (p.pageCount || (p.pages ? p.pages.length : 1)), 0);
        const totalFaculty = this.users.filter(u => u.role === "evaluator").length;

        // Extract unique class list for filter
        const classSet = new Set(["all"]);
        studentMatrix.forEach(s => { if (s.class) classSet.add(s.class); });
        const classOptions = Array.from(classSet);

        return `
            <div class="super-pane-container">
                <!-- Top Header & Action Controls -->
                <div class="super-card">
                    <div class="super-card-header">
                        <div>
                            <div class="super-royal-badge" style="margin-bottom: 6px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                EXAM AUDIT & FACULTY TRACKER
                            </div>
                            <h3 class="super-card-title">Subject &amp; Faculty Evaluation Audit Matrix</h3>
                            <p class="super-card-sub">Real-time correction progress tracker, student cumulative score matrix, and class-wise performance analytics.</p>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <button type="button" id="btn-audit-print-report" class="btn-super-secondary">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                <span>Print Summary Report</span>
                            </button>
                            <button type="button" id="btn-audit-export-excel" class="btn-super-primary" style="background: #16A34A;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                                <span>Export Excel Matrix</span>
                            </button>
                            <button type="button" id="btn-open-standalone-admin" class="btn-super-secondary" style="color: #AF52DE;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                <span>Admin Desk</span>
                            </button>
                        </div>
                    </div>

                    <!-- High-level Audit Overview KPIs -->
                    <div class="super-analytics-grid">
                        <div class="analytics-card">
                            <span class="analytics-label">Total Ingested Papers</span>
                            <span class="analytics-val" style="color: #0F172A;">${totalPapers}</span>
                            <span class="analytics-sub">Across all student submissions</span>
                        </div>
                        <div class="analytics-card">
                            <span class="analytics-label">Corrected Papers</span>
                            <span class="analytics-val" style="color: #16A34A;">${completedPapers}</span>
                            <div class="analytics-bar-track">
                                <div class="analytics-bar-fill" style="width: ${passRate}%;"></div>
                            </div>
                        </div>
                        <div class="analytics-card">
                            <span class="analytics-label">Pending Evaluation</span>
                            <span class="analytics-val" style="color: #F59E0B;">${pendingPapers}</span>
                            <span class="analytics-sub">${totalPapers > 0 ? Math.round((pendingPapers / totalPapers) * 100) : 0}% of total papers</span>
                        </div>
                        <div class="analytics-card">
                            <span class="analytics-label">Ingested Pages</span>
                            <span class="analytics-val" style="color: #0071E3;">${totalPages} Pages</span>
                            <span class="analytics-sub">Active faculty: ${totalFaculty} Teachers</span>
                        </div>
                    </div>
                </div>

                <!-- Section 1: Subject & Faculty Evaluation Audit Cards -->
                <div class="super-card" style="margin-top: 24px;">
                    <div class="super-card-header">
                        <div>
                            <h3 class="super-card-title">Subject &amp; Faculty Correction Tracker</h3>
                            <p class="super-card-sub">Papers uploaded vs graded by subject teacher.</p>
                        </div>
                        <span class="super-tab-chip chip-blue">${subjectsData.length} Subjects</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">
                        ${subjectsData.length === 0 ? `
                            <div style="grid-column: 1/-1; padding: 24px; text-align: center; color: #94A3B8;">
                                No subject evaluations recorded yet. Upload student papers on the Exam Upload Desk.
                            </div>
                        ` : subjectsData.map(sub => `
                            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; padding: 3px 10px; border-radius: 99px; background: rgba(0, 113, 227, 0.1); color: #0071E3;">${sub.code}</span>
                                    <span style="font-size: 0.82rem; font-weight: 600; color: ${sub.pct === 100 ? '#16A34A' : '#D97706'};">${sub.pct}% Graded</span>
                                </div>
                                <h4 style="font-size: 1.05rem; font-weight: 600; color: #0F172A; margin: 0 0 2px;">${sub.name}</h4>
                                <p style="font-size: 0.82rem; color: #64748B; margin: 0 0 14px;">Evaluator: <strong>${sub.teacher}</strong></p>

                                <div class="analytics-bar-track" style="margin-bottom: 12px; height: 8px;">
                                    <div class="analytics-bar-fill" style="width: ${sub.pct}%; background: ${sub.pct === 100 ? '#16A34A' : '#0071E3'};"></div>
                                </div>

                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #475569;">
                                    <span>Uploaded: <strong>${sub.uploaded}</strong></span>
                                    <span>Graded: <strong style="color: #16A34A;">${sub.corrected}</strong></span>
                                    <span>Pending: <strong style="color: #F59E0B;">${sub.pending}</strong></span>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <!-- Section 2: Student Score Matrix Table -->
                <div class="super-card" style="margin-top: 24px;">
                    <div class="super-card-header">
                        <div>
                            <h3 class="super-card-title">Student Cumulative Score Matrix</h3>
                            <p class="super-card-sub">Multi-subject marksheet records, awarded scores, and percentage breakdown.</p>
                        </div>
                    </div>

                    <div class="storage-filter-row">
                        <div class="search-box-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="super-audit-search-input" class="search-input" placeholder="Search student name or roll number..." value="${this.auditSearchQuery}" />
                        </div>
                        <select id="super-audit-class-filter" class="super-select">
                            ${classOptions.map(cls => `
                                <option value="${cls}" ${this.auditSelectedClass === cls ? 'selected' : ''}>${cls === 'all' ? 'All Classes' : cls}</option>
                            `).join("")}
                        </select>
                    </div>

                    <div class="table-scroll-wrapper">
                        <table class="super-data-table">
                            <thead>
                                <tr>
                                    <th>Roll No</th>
                                    <th>Student Name</th>
                                    <th>Class</th>
                                    <th>Subject</th>
                                    <th style="text-align: center;">Score</th>
                                    <th style="text-align: center;">Percentage</th>
                                    <th style="text-align: center;">Grade</th>
                                    <th style="text-align: center;">Status</th>
                                    <th style="text-align: center;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredMatrix.length === 0 ? `
                                    <tr>
                                        <td colspan="9" style="text-align: center; padding: 40px; color: #94A3B8;">
                                            No student records found matching the filter criteria.
                                        </td>
                                    </tr>
                                ` : filteredMatrix.map(row => `
                                    <tr>
                                        <td style="font-weight: 600; color: #0F172A;">${row.rollNo}</td>
                                        <td style="font-weight: 500; color: #0F172A;">${row.studentName}</td>
                                        <td><span class="pages-badge">${row.class}</span></td>
                                        <td>${row.subject}</td>
                                        <td style="text-align: center; font-weight: 600; color: #0071E3;">${row.totalObtained} / ${row.totalMax}</td>
                                        <td style="text-align: center; font-weight: 600;">${row.percentage}%</td>
                                        <td style="text-align: center;">
                                            <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 0.78rem; background: rgba(34, 197, 94, 0.12); color: #16A34A;">${row.grade}</span>
                                        </td>
                                        <td style="text-align: center;">
                                            <span class="eval-status-badge ${row.status === 'Completed' ? 'status-completed' : 'status-pending'}">
                                                ${row.status === 'Completed' ? '✓ Graded' : '◐ Pending'}
                                            </span>
                                        </td>
                                        <td style="text-align: center;">
                                            <button type="button" class="btn-row-action btn-inspect-audit-paper" data-id="${row.id}" title="Inspect / Evaluate Paper">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                <span>Inspect</span>
                                            </button>
                                        </td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Section 3: Class Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-top: 24px;">
                    ${classStats.map(cs => `
                        <div class="super-card" style="margin-bottom: 0;">
                            <span class="kpi-label">${cs.className} Summary</span>
                            <div style="font-size: 1.6rem; font-weight: 600; color: #0F172A; margin: 8px 0 4px;">${cs.avgPct}% Class Average</div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.84rem; color: #64748B;">
                                <span>Total Students: <strong>${cs.count}</strong></span>
                                <span>Pass Rate: <strong style="color: #16A34A;">${cs.passRate}%</strong></span>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    computeSubjectStats() {
        const subjectMap = new Map();
        this.papers.forEach(p => {
            const subject = p.subject || "General";
            if (!subjectMap.has(subject)) {
                subjectMap.set(subject, { uploaded: 0, corrected: 0 });
            }
            const entry = subjectMap.get(subject);
            entry.uploaded++;
            if (p.status === "Completed" || (p.obtainedMarks != null && p.obtainedMarks > 0)) {
                entry.corrected++;
            }
        });

        if (subjectMap.size === 0) return [];

        return Array.from(subjectMap.entries()).map(([subject, stats]) => {
            const { uploaded, corrected } = stats;
            const pending = Math.max(0, uploaded - corrected);
            const pct = uploaded > 0 ? Math.round((corrected / uploaded) * 100) : 100;
            const subjectPapers = this.papers.filter(p => (p.subject || "General") === subject);
            const latestTeacher = subjectPapers.find(p => p.teacherName)?.teacherName || "Assigned Faculty";
            return {
                code: subject.substring(0, 4).toUpperCase(),
                name: subject,
                teacher: latestTeacher,
                uploaded,
                corrected,
                pending,
                pct
            };
        });
    }

    computeStudentMatrix() {
        return this.papers.map(p => {
            const maxMarks = p.maxMarks || p.totalMarks || 100;
            const obtained = p.obtainedMarks != null ? p.obtainedMarks : (p.score != null ? p.score : 0);
            const pct = maxMarks > 0 ? Math.round((obtained / maxMarks) * 100) : 0;
            let grade = "A+";
            if (pct < 33) grade = "F";
            else if (pct < 50) grade = "C";
            else if (pct < 70) grade = "B";
            else if (pct < 85) grade = "A";

            return {
                id: p.id,
                rollNo: p.rollNo || (p.studentId ? String(p.studentId).slice(-4) : "—"),
                studentName: p.studentName || "Student",
                class: p.class || p.className || "Class 12",
                subject: p.subject || "General",
                totalObtained: obtained,
                totalMax: maxMarks,
                percentage: pct,
                grade: grade,
                status: p.status || (obtained > 0 ? "Completed" : "Pending")
            };
        });
    }

    filterAuditMatrix(matrix) {
        return matrix.filter(row => {
            const matchesQuery = !this.auditSearchQuery ||
                (row.studentName && row.studentName.toLowerCase().includes(this.auditSearchQuery)) ||
                (row.rollNo && row.rollNo.toLowerCase().includes(this.auditSearchQuery)) ||
                (row.subject && row.subject.toLowerCase().includes(this.auditSearchQuery));

            const matchesClass = this.auditSelectedClass === "all" || row.class === this.auditSelectedClass;

            return matchesQuery && matchesClass;
        });
    }

    computeClassStats(matrix) {
        if (!matrix || matrix.length === 0) {
            return [
                { className: "All Classes", count: 0, avgPct: 0, passRate: 100 }
            ];
        }

        const classMap = new Map();
        matrix.forEach(m => {
            const cls = m.class || "General";
            if (!classMap.has(cls)) classMap.set(cls, []);
            classMap.get(cls).push(m);
        });

        return Array.from(classMap.entries()).map(([cls, list]) => {
            const avg = list.length > 0 ? Math.round(list.reduce((sum, s) => sum + s.percentage, 0) / list.length) : 0;
            const passed = list.filter(s => s.percentage >= 33).length;
            const passRate = list.length > 0 ? Math.round((passed / list.length) * 100) : 100;
            return {
                className: cls,
                count: list.length,
                avgPct: avg,
                passRate: passRate
            };
        });
    }

    exportAuditExcel(matrix) {
        let csv = "data:text/csv;charset=utf-8,";
        csv += "Roll No,Student Name,Class,Subject,Obtained Marks,Max Marks,Percentage,Grade,Status\n";
        matrix.forEach(row => {
            csv += `"${row.rollNo}","${row.studentName}","${row.class}","${row.subject}","${row.totalObtained}","${row.totalMax}","${row.percentage}%","${row.grade}","${row.status}"\n`;
        });
        const encoded = encodeURI(csv);
        const a = document.createElement("a");
        a.setAttribute("href", encoded);
        a.setAttribute("download", `Student_Master_Score_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // ==========================================
    // EVENT BINDINGS
    // ==========================================

    bindEvents() {
        // Tab switching
        const tabBtns = this.container.querySelectorAll(".super-tab-btn");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const tab = btn.getAttribute("data-tab");
                if (tab && tab !== this.activeTab) {
                    this.activeTab = tab;
                    this.render();
                }
            });
        });

        // 1-Click Killswitch Toggle
        const btnKill = this.container.querySelector("#btn-super-toggle-killswitch");
        if (btnKill) {
            btnKill.addEventListener("click", async () => {
                const isCurrentlyLocked = this.license.isManuallyLocked === true;
                const nextState = !isCurrentlyLocked;
                const confirmMsg = nextState 
                    ? "Are you sure you want to LOCK platform access immediately?\n\nAll non-admin users will immediately be presented with the payment & renewal locked screen."
                    : "Are you sure you want to UNLOCK platform access immediately?\n\nTeachers and exam officers will immediately be granted access.";
                
                if (confirm(confirmMsg)) {
                    this.license.isManuallyLocked = nextState;
                    this.license.status = nextState ? "locked" : "active";
                    await window.appStorage.saveLicenseConfig(this.license);
                    if (window.app && window.app.showToast) {
                        window.app.showToast(nextState ? "Platform Access LOCKED" : "Platform Access UNLOCKED", nextState ? "warning" : "success");
                    }
                    this.render();
                }
            });
        }

        // 1-Click Duration Presets
        const presetBtns = this.container.querySelectorAll(".duration-preset-btn");
        presetBtns.forEach(btn => {
            btn.addEventListener("click", async () => {
                const days = parseInt(btn.getAttribute("data-days"), 10) || 30;
                const label = btn.getAttribute("data-label") || `${days} Days`;

                if (confirm(`Activate or extend platform access for ${label} (+${days} Days)?\n\nThis will set the platform status to ACTIVE and grant access immediately.`)) {
                    await this.extendLicenseDays(days, label);
                }
            });
        });

        // Apply Custom Expiry Date
        const btnCustomExpiry = this.container.querySelector("#btn-super-apply-custom-expiry");
        const customInput = this.container.querySelector("#super-custom-expiry-input");
        if (btnCustomExpiry && customInput) {
            btnCustomExpiry.addEventListener("click", async () => {
                const val = customInput.value;
                if (!val) {
                    alert("Please select a date and time first.");
                    return;
                }
                const selectedDate = new Date(val);
                if (isNaN(selectedDate.getTime())) {
                    alert("Invalid date format selected.");
                    return;
                }
                this.license.expiresAt = selectedDate.toISOString();
                this.license.isManuallyLocked = false;
                this.license.status = "active";
                await window.appStorage.saveLicenseConfig(this.license);
                if (window.app && window.app.showToast) {
                    window.app.showToast(`Custom expiration set to ${selectedDate.toLocaleString()}`, "success");
                }
                this.render();
            });
        }

        // Save License & Payment Settings
        const btnSaveSettings = this.container.querySelector("#btn-save-license-settings");
        if (btnSaveSettings) {
            btnSaveSettings.addEventListener("click", async () => {
                const accName = this.container.querySelector("#cfg-account-name")?.value.trim() || "";
                const bName = this.container.querySelector("#cfg-bank-name")?.value.trim() || "";
                const accNum = this.container.querySelector("#cfg-account-number")?.value.trim() || "";
                const ifsc = this.container.querySelector("#cfg-ifsc-code")?.value.trim() || "";
                const upi = this.container.querySelector("#cfg-upi-id")?.value.trim() || "";
                const phone = this.container.querySelector("#cfg-contact-phone")?.value.trim() || "";
                const msg = this.container.querySelector("#cfg-lockout-msg")?.value.trim() || "";

                this.license.bankDetails = {
                    accountName: accName,
                    bankName: bName,
                    accountNumber: accNum,
                    ifscCode: ifsc,
                    upiId: upi
                };
                this.license.contactPhone = phone;
                this.license.lockoutMessage = msg;

                await window.appStorage.saveLicenseConfig(this.license);
                if (window.app && window.app.showToast) {
                    window.app.showToast("License & Payment Settings saved successfully!", "success");
                }
                this.render();
            });
        }

        // Upload Custom QR Image
        const qrInput = this.container.querySelector("#super-qr-file-input");
        if (qrInput) {
            qrInput.addEventListener("change", (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    this.license.paymentQrUrl = evt.target.result;
                    await window.appStorage.saveLicenseConfig(this.license);
                    if (window.app && window.app.showToast) {
                        window.app.showToast("Custom Payment QR uploaded successfully!", "success");
                    }
                    this.render();
                };
                reader.readAsDataURL(file);
            });
        }

        // Reset QR to default
        const btnResetQr = this.container.querySelector("#btn-super-reset-qr");
        if (btnResetQr) {
            btnResetQr.addEventListener("click", async () => {
                this.license.paymentQrUrl = "";
                await window.appStorage.saveLicenseConfig(this.license);
                if (window.app && window.app.showToast) {
                    window.app.showToast("QR code reset to default UPI QR", "info");
                }
                this.render();
            });
        }

        // Preview Locked Screen
        const btnPreviewLocked = this.container.querySelector("#btn-super-preview-locked");
        if (btnPreviewLocked) {
            btnPreviewLocked.addEventListener("click", () => {
                if (window.app && typeof window.app.showPlatformLockedOverlay === "function") {
                    window.app.showPlatformLockedOverlay(true); // pass preview = true
                }
            });
        }

        // --- Storage Tab Events ---
        const btnSelectAllEval = this.container.querySelector("#btn-select-all-evaluated");
        if (btnSelectAllEval) {
            btnSelectAllEval.addEventListener("click", () => {
                this.papers.forEach(p => {
                    if (p.status === "Completed") this.selectedPaperIds.add(String(p.id));
                });
                this.render();
            });
        }

        const btnSelectAll = this.container.querySelector("#btn-select-all-papers");
        if (btnSelectAll) {
            btnSelectAll.addEventListener("click", () => {
                this.papers.forEach(p => this.selectedPaperIds.add(String(p.id)));
                this.render();
            });
        }

        const btnDeselectAll = this.container.querySelector("#btn-deselect-all-papers");
        if (btnDeselectAll) {
            btnDeselectAll.addEventListener("click", () => {
                this.selectedPaperIds.clear();
                this.render();
            });
        }

        const chkSelectAll = this.container.querySelector("#chk-storage-select-all");
        if (chkSelectAll) {
            chkSelectAll.addEventListener("change", (e) => {
                if (e.target.checked) {
                    this.papers.forEach(p => this.selectedPaperIds.add(String(p.id)));
                } else {
                    this.selectedPaperIds.clear();
                }
                this.render();
            });
        }

        const itemCheckboxes = this.container.querySelectorAll(".chk-paper-item");
        itemCheckboxes.forEach(chk => {
            chk.addEventListener("change", (e) => {
                const id = e.target.getAttribute("data-id");
                if (e.target.checked) this.selectedPaperIds.add(id);
                else this.selectedPaperIds.delete(id);
                this.render();
            });
        });

        // Search storage
        const inputStorageSearch = this.container.querySelector("#input-storage-search");
        if (inputStorageSearch) {
            inputStorageSearch.addEventListener("input", (e) => {
                this.storageSearchQuery = e.target.value;
                this.render();
            });
        }

        const selectStorageStatus = this.container.querySelector("#select-storage-filter-status");
        if (selectStorageStatus) {
            selectStorageStatus.addEventListener("change", (e) => {
                this.storageFilterStatus = e.target.value;
                this.render();
            });
        }

        // Purge Selected Papers
        const btnPurge = this.container.querySelector("#btn-purge-selected-papers");
        if (btnPurge) {
            btnPurge.addEventListener("click", () => this.showPurgeConfirmModal());
        }

        // Wipe Cache
        const btnWipeCache = this.container.querySelector("#btn-super-wipe-cache");
        if (btnWipeCache) {
            btnWipeCache.addEventListener("click", async () => {
                if (confirm("Clear local browser CacheStorage to free temporary PDF memory?")) {
                    const freed = await window.appStorage.clearAppCaches();
                    if (window.app && window.app.showToast) {
                        window.app.showToast(`Cache cleaned! (${freed} cache entries freed)`, "success");
                    }
                    await this.loadData();
                    this.render();
                }
            });
        }

        // Export Database JSON Backup
        const btnExportBackup = this.container.querySelector("#btn-super-export-backup");
        if (btnExportBackup) {
            btnExportBackup.addEventListener("click", async () => {
                await window.appStorage.exportDatabaseBackup();
                if (window.app && window.app.showToast) {
                    window.app.showToast("Database backup downloaded successfully!", "success");
                }
            });
        }

        // Single Paper Delete
        const singleDeletes = this.container.querySelectorAll(".btn-delete-single-paper");
        singleDeletes.forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const target = this.papers.find(p => String(p.id) === id);
                if (!target) return;
                if (confirm(`Permanently delete paper for "${target.studentName || 'Student'}" (ID: ${id})?`)) {
                    await window.appStorage.deleteEvaluation(id);
                    this.selectedPaperIds.delete(id);
                    if (window.app && window.app.showToast) {
                        window.app.showToast("Paper deleted successfully", "success");
                    }
                    await this.loadData();
                    this.render();
                }
            });
        });

        // Single Paper Inspect Lightbox
        const inspectBtns = this.container.querySelectorAll(".btn-inspect-paper");
        inspectBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const target = this.papers.find(p => String(p.id) === id);
                if (target) this.showInspectLightbox(target);
            });
        });

        // --- User Tab Events ---
        const inputUserSearch = this.container.querySelector("#input-super-user-search");
        if (inputUserSearch) {
            inputUserSearch.addEventListener("input", (e) => {
                this.userSearchQuery = e.target.value;
                this.render();
            });
        }

        const selectUserRole = this.container.querySelector("#select-super-role-filter");
        if (selectUserRole) {
            selectUserRole.addEventListener("change", (e) => {
                this.userRoleFilter = e.target.value;
                this.render();
            });
        }

        const btnAddUser = this.container.querySelector("#btn-super-add-user");
        if (btnAddUser) {
            btnAddUser.addEventListener("click", () => this.showUserModal());
        }

        const editUserBtns = this.container.querySelectorAll(".btn-edit-user");
        editUserBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const u = this.users.find(item => String(item.id) === id);
                if (u) this.showUserModal(u);
            });
        });

        const deleteUserBtns = this.container.querySelectorAll(".btn-delete-user");
        deleteUserBtns.forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const u = this.users.find(item => String(item.id) === id);
                if (!u) return;
                if (confirm(`Delete user "${u.name}" (${u.email || u.username})?`)) {
                    this.users = this.users.filter(item => String(item.id) !== id);
                    await window.appStorage.saveUsersList(this.users);
                    if (window.app && window.app.showToast) {
                        window.app.showToast("User deleted successfully", "success");
                    }
                    this.render();
                }
            });
        });

        const revealBtns = this.container.querySelectorAll(".btn-reveal-pass");
        revealBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                if (this.revealedPasswords.has(id)) this.revealedPasswords.delete(id);
                else this.revealedPasswords.add(id);
                this.render();
            });
        });

        // Tab 4: Audit Matrix controls
        const auditSearchInp = this.container.querySelector("#super-audit-search-input");
        if (auditSearchInp) {
            auditSearchInp.addEventListener("input", (e) => {
                this.auditSearchQuery = e.target.value.toLowerCase().trim();
                this.render();
            });
        }

        const auditClassSelect = this.container.querySelector("#super-audit-class-filter");
        if (auditClassSelect) {
            auditClassSelect.addEventListener("change", (e) => {
                this.auditSelectedClass = e.target.value;
                this.render();
            });
        }

        const btnAuditPrint = this.container.querySelector("#btn-audit-print-report");
        if (btnAuditPrint) {
            btnAuditPrint.addEventListener("click", () => window.print());
        }

        const btnAuditExcel = this.container.querySelector("#btn-audit-export-excel");
        if (btnAuditExcel) {
            btnAuditExcel.addEventListener("click", () => {
                const matrix = this.computeStudentMatrix();
                const filtered = this.filterAuditMatrix(matrix);
                this.exportAuditExcel(filtered);
            });
        }

        const btnOpenStandaloneAdmin = this.container.querySelector("#btn-open-standalone-admin");
        if (btnOpenStandaloneAdmin) {
            btnOpenStandaloneAdmin.addEventListener("click", () => {
                if (window.app && typeof window.app.setPortal === "function") {
                    window.app.setPortal("admin", true);
                } else {
                    window.location.href = "admin.html";
                }
            });
        }

        const inspectAuditBtns = this.container.querySelectorAll(".btn-inspect-audit-paper");
        inspectAuditBtns.forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const paper = this.papers.find(p => String(p.id) === id);
                if (paper && window.app && typeof window.app.openWorkspace === "function") {
                    window.app.openWorkspace(paper);
                }
            });
        });
    }

    // ==========================================
    // EXTEND LICENSE HELPER
    // ==========================================

    async extendLicenseDays(daysToAdd, planLabel) {
        const now = Date.now();
        const curExpiry = this.license?.expiresAt ? new Date(this.license.expiresAt).getTime() : now;
        // If current expiry is in the future, extend from current expiry. If already expired, extend from now.
        const baseTime = curExpiry > now ? curExpiry : now;
        const newExpiry = new Date(baseTime + (daysToAdd * 24 * 60 * 60 * 1000));

        this.license.expiresAt = newExpiry.toISOString();
        this.license.activatedAt = new Date().toISOString();
        this.license.planPeriod = planLabel;
        this.license.planDurationDays = daysToAdd;
        this.license.isManuallyLocked = false;
        this.license.status = "active";

        await window.appStorage.saveLicenseConfig(this.license);

        if (window.app && window.app.showToast) {
            window.app.showToast(`Platform access activated for ${planLabel}! (Expires ${newExpiry.toLocaleDateString()})`, "success");
        }
        this.render();
    }

    // ==========================================
    // PURGE CONFIRM MODAL
    // ==========================================

    showPurgeConfirmModal() {
        const targetIds = Array.from(this.selectedPaperIds);
        if (targetIds.length === 0) return;

        let totalBytes = 0;
        this.papers.forEach(p => {
            if (targetIds.includes(String(p.id))) {
                totalBytes += (p.fileSizeBytes || (window.appStorage.measurePaperBytesSync ? window.appStorage.measurePaperBytesSync(p) : 0));
            }
        });
        const formattedBytes = window.appStorage.formatStorageSize(totalBytes);

        const modalRoot = this.container.querySelector("#super-modal-root") || document.body;
        const modal = document.createElement("div");
        modal.className = "super-modal-overlay";
        modal.innerHTML = `
            <div class="super-modal-dialog">
                <div class="modal-danger-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </div>
                <h3 class="modal-dialog-title">Permanently Purge ${targetIds.length} Papers?</h3>
                <p class="modal-dialog-sub">This will permanently delete the selected student answer sheets, rendered page images, and cached PDF payloads. This action cannot be undone.</p>
                
                <div class="modal-storage-freed-banner">
                    <span class="freed-label">Total Storage to be Permanently Freed:</span>
                    <span class="freed-val">${formattedBytes}</span>
                </div>

                <div class="modal-actions-row">
                    <button type="button" class="btn-super-secondary" id="btn-modal-cancel">Cancel</button>
                    <button type="button" class="btn-super-danger" id="btn-modal-confirm-purge">Yes, Purge Papers</button>
                </div>
            </div>
        `;

        modalRoot.appendChild(modal);

        modal.querySelector("#btn-modal-cancel").addEventListener("click", () => modal.remove());
        modal.querySelector("#btn-modal-confirm-purge").addEventListener("click", async () => {
            const btn = modal.querySelector("#btn-modal-confirm-purge");
            btn.disabled = true;
            btn.textContent = "Purging...";

            const count = await window.appStorage.cleanStoragePapers(targetIds);
            this.selectedPaperIds.clear();
            modal.remove();

            if (window.app && window.app.showToast) {
                window.app.showToast(`Cleaned ${count} papers! Freed ${formattedBytes} storage space.`, "success");
            }
            await this.loadData();
            this.render();
        });
    }

    // ==========================================
    // USER ADD / EDIT MODAL
    // ==========================================

    showUserModal(user = null) {
        const isEdit = Boolean(user);
        const modalRoot = this.container.querySelector("#super-modal-root") || document.body;
        const modal = document.createElement("div");
        modal.className = "super-modal-overlay";

        const subjectsList = ["Physics", "English", "Political Science", "Economics", "History", "Social Science", "Mathematics", "Biology", "Chemistry", "Entrepreneurship"];

        modal.innerHTML = `
            <div class="super-modal-dialog" style="max-width: 520px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: #0F172A; margin: 0;">${isEdit ? 'Edit User Credentials' : 'Add New User'}</h3>
                    <button type="button" id="btn-user-modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748B;">×</button>
                </div>

                <div class="super-form-group">
                    <label class="super-label">Full Name</label>
                    <input type="text" id="usr-modal-name" class="super-input" value="${user?.name || ''}" placeholder="e.g. Dr. Rajesh Kumar" />
                </div>

                <div class="form-row-2">
                    <div class="super-form-group">
                        <label class="super-label">Email Address</label>
                        <input type="email" id="usr-modal-email" class="super-input" value="${user?.email || ''}" placeholder="teacher@school.edu" />
                    </div>
                    <div class="super-form-group">
                        <label class="super-label">User ID / Username</label>
                        <input type="text" id="usr-modal-username" class="super-input" value="${user?.username || ''}" placeholder="teacher_id" />
                    </div>
                </div>

                <div class="form-row-2">
                    <div class="super-form-group">
                        <label class="super-label">Password</label>
                        <input type="text" id="usr-modal-pass" class="super-input" value="${user?.password || 'Teacher@123'}" placeholder="Password" />
                    </div>
                    <div class="super-form-group">
                        <label class="super-label">Portal Role</label>
                        <select id="usr-modal-role" class="super-select">
                            <option value="evaluator" ${user?.role === 'evaluator' ? 'selected' : ''}>Evaluator / Teacher</option>
                            <option value="uploader" ${user?.role === 'uploader' ? 'selected' : ''}>Uploader / Exam Dept</option>
                            <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrator</option>
                        </select>
                    </div>
                </div>

                <div class="super-form-group">
                    <label class="super-label">Assigned Subjects (Hold Ctrl/Cmd to select multiple)</label>
                    <select id="usr-modal-subjects" class="super-select" multiple style="height: 100px;">
                        <option value="All Subjects" ${(user?.assignedSubjects || []).includes("All Subjects") ? 'selected' : ''}>All Subjects</option>
                        ${subjectsList.map(s => `
                            <option value="${s}" ${(user?.assignedSubjects || []).includes(s) ? 'selected' : ''}>${s}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="modal-actions-row" style="margin-top: 20px;">
                    <button type="button" class="btn-super-secondary" id="btn-user-cancel">Cancel</button>
                    <button type="button" class="btn-super-primary" id="btn-user-save">${isEdit ? 'Save Changes' : 'Create User'}</button>
                </div>
            </div>
        `;

        modalRoot.appendChild(modal);

        modal.querySelector("#btn-user-modal-close").addEventListener("click", () => modal.remove());
        modal.querySelector("#btn-user-cancel").addEventListener("click", () => modal.remove());

        modal.querySelector("#btn-user-save").addEventListener("click", async () => {
            const name = modal.querySelector("#usr-modal-name")?.value.trim();
            const email = modal.querySelector("#usr-modal-email")?.value.trim().toLowerCase();
            const username = modal.querySelector("#usr-modal-username")?.value.trim() || email.split('@')[0];
            const pass = modal.querySelector("#usr-modal-pass")?.value.trim();
            const role = modal.querySelector("#usr-modal-role")?.value || "evaluator";
            const subSelect = modal.querySelector("#usr-modal-subjects");
            const assignedSubjects = Array.from(subSelect.selectedOptions).map(o => o.value);

            if (!name || !email || !pass) {
                alert("Please fill in Name, Email, and Password.");
                return;
            }

            if (isEdit) {
                user.name = name;
                user.email = email;
                user.username = username;
                user.password = pass;
                user.role = role;
                user.assignedSubjects = assignedSubjects;
            } else {
                const newUser = {
                    id: `usr_${Date.now()}`,
                    name,
                    email,
                    username,
                    password: pass,
                    role,
                    assignedSubjects,
                    assignedClasses: [],
                    status: "active",
                    createdAt: new Date().toISOString()
                };
                this.users.push(newUser);
            }

            await window.appStorage.saveUsersList(this.users);
            modal.remove();
            if (window.app && window.app.showToast) {
                window.app.showToast(isEdit ? "User updated!" : "New user created!", "success");
            }
            this.render();
        });
    }

    // ==========================================
    // INSPECT LIGHTBOX
    // ==========================================

    showInspectLightbox(paper) {
        const pages = paper.pages || (paper.pdfDataUrl ? [paper.pdfDataUrl] : []);
        const modalRoot = this.container.querySelector("#super-modal-root") || document.body;
        const modal = document.createElement("div");
        modal.className = "super-modal-overlay";
        modal.innerHTML = `
            <div class="super-modal-dialog" style="max-width: 720px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <div>
                        <h3 style="font-size: 1.15rem; font-weight: 700; color: #0F172A; margin: 0;">${paper.studentName || 'Student Paper'}</h3>
                        <p style="font-size: 0.8rem; color: #64748B; margin: 2px 0 0;">${paper.subject || 'General'} • Roll: ${paper.rollNo || '—'} • ${pages.length} Pages</p>
                    </div>
                    <button type="button" id="btn-inspect-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748B;">×</button>
                </div>

                <div class="inspect-pages-scroll" style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0;">
                    ${pages.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: #94A3B8;">No page previews available for this record.</div>
                    ` : pages.map((pg, i) => `
                        <div style="background: white; border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
                            <div style="padding: 6px 12px; font-size: 0.75rem; font-weight: 600; color: #475569; background: #F1F5F9; border-bottom: 1px solid #E2E8F0;">Page ${i + 1}</div>
                            <img src="${pg}" alt="Page ${i + 1}" style="width: 100%; display: block;" loading="lazy" />
                        </div>
                    `).join('')}
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
                    <button type="button" class="btn-super-secondary" id="btn-inspect-done">Close</button>
                </div>
            </div>
        `;
        modalRoot.appendChild(modal);

        modal.querySelector("#btn-inspect-close").addEventListener("click", () => modal.remove());
        modal.querySelector("#btn-inspect-done").addEventListener("click", () => modal.remove());
    }
}

window.SuperAdminManager = SuperAdminManager;
