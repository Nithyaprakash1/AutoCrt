/**
 * Niprak Digital Correction - Master User & Faculty Management Manager
 * Apple Cupertino / Human Interface Design Theme
 *
 * Dedicated to Administrators & Exam Operations for:
 * - Role Governance: Administrators, Exam Officers (Uploaders), Faculty Evaluators
 * - Access Control: Strict permission boundaries (Uploaders cannot delete Admin accounts; Admins govern all)
 * - Credential Management: User ID, Email, Secure Passwords with live reveal & copy
 * - Academic Specializations: Authorizations across Subject Catalog & Assigned Classes
 * - Strict Regular Typography (font-weight: 400 !important)
 */

class UserManagementPageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.users = [];
        this.subjectsList = ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Computer Science"];
        this.classesList = ["Class 12-A", "Class 12-B", "Class 12-C", "Class 11-A", "Class 11-B", "Class 10-A"];
        this.searchQuery = "";
        this.roleFilter = "all";
        this.subjectFilter = "all";
        this.statusFilter = "all";
        this.revealedPasswords = new Set();
        this.editingUser = null;
    }

    async init() {
        if (!this.container) {
            this.container = document.getElementById("user-management-container-root") || 
                             document.getElementById("admin-user-management-root") ||
                             document.getElementById("view-user-management");
        }
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            await window.appStorage.init();
            this.users = await window.appStorage.getUsersList();
            try {
                const catalog = await window.appStorage.getSubjectCatalog();
                if (catalog && Array.isArray(catalog) && catalog.length > 0) {
                    this.subjectsList = [...new Set([...this.subjectsList, ...catalog.map(s => s.name || s.label)])];
                }
                const classes = await window.appStorage.getClassesList();
                if (classes && Array.isArray(classes) && classes.length > 0) {
                    this.classesList = [...new Set([...this.classesList, ...classes.map(c => c.label || c.name)])];
                }
            } catch (e) {
                console.warn("UserMgmt catalog loading notice:", e);
            }
        }
    }

    // --- Active User & Permission Security Helpers ---

    getCurrentUser() {
        if (window.appStorage && typeof window.appStorage.getCurrentUser === "function") {
            const u = window.appStorage.getCurrentUser();
            if (u) return u;
        }
        if (window.app && window.app.currentUser) {
            return window.app.currentUser;
        }
        try {
            const raw = localStorage.getItem("niprak_active_user") || localStorage.getItem("onespace_active_user");
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    }

    isCurrentUserAdmin() {
        const u = this.getCurrentUser();
        if (document.body && document.body.getAttribute("data-default-portal") === "admin") return true;
        if (!u) return false;
        if (u.role === "super_admin" || (u.email && u.email.toLowerCase() === "iamnithyaprakash@gmail.com")) return true;
        if (u.role === "admin") return true;
        return false;
    }

    getRoleMeta(user) {
        const role = (user && user.role ? user.role : "evaluator").toLowerCase();
        const isSuper = role === "super_admin" || (user && user.email && user.email.toLowerCase() === "iamnithyaprakash@gmail.com");

        if (isSuper) {
            return {
                id: "super_admin",
                label: "Super Admin (Owner)",
                shortLabel: "Super Admin",
                badgeClass: "role-badge-super-admin",
                avatarClass: "avatar-super-admin",
                icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
                desc: "Full Root Authority across all portals and security controls"
            };
        }
        if (role === "admin") {
            return {
                id: "admin",
                label: "Administrator",
                shortLabel: "Admin",
                badgeClass: "role-badge-admin",
                avatarClass: "avatar-admin",
                icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
                desc: "Institutional Audit, Subject Oversight & User Governance"
            };
        }
        if (role === "uploader") {
            return {
                id: "uploader",
                label: "Exam Officer / Uploader",
                shortLabel: "Exam Officer",
                badgeClass: "role-badge-uploader",
                avatarClass: "avatar-uploader",
                icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
                desc: "Upload Desk Ingestion, Class Batches & PDF Scan Operations"
            };
        }
        return {
            id: "evaluator",
            label: "Faculty Evaluator",
            shortLabel: "Evaluator",
            badgeClass: "role-badge-evaluator",
            avatarClass: "avatar-evaluator",
            icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
            desc: "On-Screen Marking, Sectional Question Scoring & Feedback"
        };
    }

    /**
     * Strict Access Control Policy:
     * - Root Super Admin can NEVER be removed.
     * - Current active user cannot delete their own session account.
     * - Uploader CANNOT delete an Administrator account ("uploader cant delete the admin alone").
     * - Administrator CAN delete Uploader and Evaluator accounts ("admin can delete uploader also ok").
     */
    canDeleteUser(targetUser) {
        if (!targetUser) return { allowed: false, reason: "Invalid target user." };
        const currentUser = this.getCurrentUser();
        const isCurrentAdmin = this.isCurrentUserAdmin();
        const targetRole = (targetUser.role || "evaluator").toLowerCase();
        const isTargetSuper = targetRole === "super_admin" || (targetUser.email && targetUser.email.toLowerCase() === "iamnithyaprakash@gmail.com");
        const isTargetAdmin = isTargetSuper || targetRole === "admin";

        // 1. Root Super Admin protection
        if (isTargetSuper) {
            return { allowed: false, reason: "The Platform Super Admin (Owner) cannot be removed." };
        }

        // 2. Prevent self-deletion
        if (currentUser && (targetUser.id === currentUser.id || targetUser.uid === currentUser.uid || (targetUser.email && targetUser.email === currentUser.email))) {
            return { allowed: false, reason: "Self-deletion prohibited: You cannot remove your currently active account." };
        }

        // 3. Uploader cannot delete Admin accounts
        if (isTargetAdmin && !isCurrentAdmin) {
            return { allowed: false, reason: "Uploaders cannot delete Administrator accounts. Access restricted to Admin only." };
        }

        // 4. Admin can delete uploaders, evaluators, and subordinate staff
        if (isCurrentAdmin) {
            return { allowed: true };
        }

        // 5. Non-admins cannot delete other admins
        if (isTargetAdmin) {
            return { allowed: false, reason: "Access restricted: Only Administrators can remove Admin accounts." };
        }

        // 6. Uploader deleting an evaluator is permitted if permitted in desk
        return { allowed: true };
    }

    canEditUser(targetUser) {
        if (!targetUser) return false;
        const isCurrentAdmin = this.isCurrentUserAdmin();
        const targetRole = (targetUser.role || "evaluator").toLowerCase();
        const isTargetSuper = targetRole === "super_admin" || (targetUser.email && targetUser.email.toLowerCase() === "iamnithyaprakash@gmail.com");
        const isTargetAdmin = isTargetSuper || targetRole === "admin";

        if (isTargetSuper) {
            return isTargetSuper; // only super admin can edit super admin
        }
        if (isTargetAdmin && !isCurrentAdmin) {
            return false; // uploader cannot edit admin
        }
        return true;
    }

    // --- Main Layout Rendering ---

    render() {
        if (!this.container) return;

        const totalUsers = this.users.length;
        const adminCount = this.users.filter(u => u.role === "admin" || u.role === "super_admin").length;
        const uploaderCount = this.users.filter(u => u.role === "uploader").length;
        const evaluatorCount = this.users.filter(u => u.role === "evaluator" || (!u.role && u.role !== "admin" && u.role !== "uploader" && u.role !== "super_admin")).length;

        const currentUser = this.getCurrentUser();
        const isAdmin = this.isCurrentUserAdmin();

        this.container.innerHTML = `
            <div class="user-mgmt-layout animate-fade-in">
                <!-- Header Banner -->
                <div class="user-mgmt-header">
                    <div class="header-titles">
                        <div class="header-tag-pill">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <span>Central Identity & Access Governance</span>
                        </div>
                        <h1 class="page-title">User Management & Role Access</h1>
                        <p class="page-subtitle">Govern institutional administrator, exam officer, and faculty evaluator credentials, subject allotments, and security permissions.</p>
                    </div>

                    <div class="header-actions">
                        <button type="button" class="btn-mgmt-secondary" id="btn-sync-credentials" title="Sync credentials with cloud authentication database">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                            <span>Sync Credentials</span>
                        </button>
                        <button type="button" class="btn-mgmt-secondary" id="btn-export-users-csv" title="Export users list as CSV file">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Export CSV</span>
                        </button>
                        <button type="button" class="btn-mgmt-primary" id="btn-add-new-user" title="Register a new platform account">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span>Add New User</span>
                        </button>
                    </div>
                </div>

                <!-- 4 KPI Stat Cards: Total, Admins, Uploaders, Evaluators -->
                <div class="user-metrics-grid">
                    <div class="user-metric-card" data-role-filter="all" title="View all users">
                        <div class="metric-icon-box icon-blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-total-users">${totalUsers}</span>
                            <span class="metric-label">Total Registered Users</span>
                        </div>
                    </div>
                    <div class="user-metric-card" data-role-filter="admin" title="Filter Administrators">
                        <div class="metric-icon-box icon-purple">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-admins" style="color: #AF52DE;">${adminCount}</span>
                            <span class="metric-label">Administrators (Audit & Control)</span>
                        </div>
                    </div>
                    <div class="user-metric-card" data-role-filter="uploader" title="Filter Exam Officers">
                        <div class="metric-icon-box icon-sky">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-uploaders" style="color: #0284C7;">${uploaderCount}</span>
                            <span class="metric-label">Exam Officers (Uploaders)</span>
                        </div>
                    </div>
                    <div class="user-metric-card" data-role-filter="evaluator" title="Filter Faculty Evaluators">
                        <div class="metric-icon-box icon-green">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-evaluators" style="color: #16A34A;">${evaluatorCount}</span>
                            <span class="metric-label">Faculty Evaluators (Graders)</span>
                        </div>
                    </div>
                </div>

                <!-- Search & Filters Toolbar -->
                <div class="user-mgmt-toolbar">
                    <div class="search-box-wrap">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="search-input" id="input-user-search" placeholder="Search by name, username, email, or subject..." value="${this.searchQuery}" />
                        ${this.searchQuery ? `<button type="button" class="btn-clear-search" id="btn-clear-user-search" title="Clear search">×</button>` : ''}
                    </div>

                    <div class="filters-wrap">
                        <div class="filter-item">
                            <label class="filter-label" for="select-role-filter">Role:</label>
                            <select id="select-role-filter" class="filter-select">
                                <option value="all" ${this.roleFilter === 'all' ? 'selected' : ''}>All Roles (${totalUsers})</option>
                                <option value="admin" ${this.roleFilter === 'admin' ? 'selected' : ''}>Administrator (${adminCount})</option>
                                <option value="uploader" ${this.roleFilter === 'uploader' ? 'selected' : ''}>Exam Officer / Uploader (${uploaderCount})</option>
                                <option value="evaluator" ${this.roleFilter === 'evaluator' ? 'selected' : ''}>Faculty Evaluator (${evaluatorCount})</option>
                            </select>
                        </div>
                        <div class="filter-item">
                            <label class="filter-label" for="select-subject-filter">Subject:</label>
                            <select id="select-subject-filter" class="filter-select">
                                <option value="all">All Subjects</option>
                                ${this.subjectsList.map(s => `
                                    <option value="${s}" ${this.subjectFilter === s ? 'selected' : ''}>${s}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="filter-item">
                            <label class="filter-label" for="select-status-filter">Status:</label>
                            <select id="select-status-filter" class="filter-select">
                                <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>All Status</option>
                                <option value="active" ${this.statusFilter === 'active' ? 'selected' : ''}>Active Only</option>
                                <option value="inactive" ${this.statusFilter === 'inactive' ? 'selected' : ''}>Suspended Only</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Users Table Section -->
                <div class="user-table-card">
                    <div class="table-scroll-wrapper" id="user-table-container">
                        ${this.renderTableHTML()}
                    </div>
                </div>
            </div>

            <!-- Add / Edit / Delete Modal Roots -->
            <div id="user-modal-container-root"></div>
            <div id="user-delete-confirm-root"></div>
        `;

        this.bindEvents();
    }

    renderTableHTML() {
        const filtered = this.getFilteredUsers();
        const currentUser = this.getCurrentUser();
        const isCurrentAdmin = this.isCurrentUserAdmin();

        if (filtered.length === 0) {
            return `
                <div class="user-empty-state">
                    <div class="empty-icon-circle">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    </div>
                    <h3 class="empty-title">No Matching Users Found</h3>
                    <p class="empty-sub">No user accounts found matching your search query or filter criteria. Try resetting filters or adding a new user.</p>
                    <button type="button" class="btn-mgmt-primary" id="btn-empty-add-user">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Add New User</span>
                    </button>
                </div>
            `;
        }

        return `
            <table class="user-data-table">
                <thead>
                    <tr>
                        <th style="min-width: 220px;">User & Identity</th>
                        <th style="min-width: 170px;">Role & Governance</th>
                        <th style="min-width: 190px;">Credentials / Password</th>
                        <th style="min-width: 200px;">Authorized Subjects</th>
                        <th style="min-width: 150px;">Assigned Classes</th>
                        <th style="min-width: 110px;">Status</th>
                        <th style="min-width: 100px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(u => {
                        const isRevealed = this.revealedPasswords.has(u.id);
                        const roleMeta = this.getRoleMeta(u);
                        const statusClass = u.status === 'active' ? 'status-badge-active' : 'status-badge-inactive';
                        const isYou = currentUser && (u.id === currentUser.id || u.uid === currentUser.uid || (u.email && u.email === currentUser.email));
                        const canDelete = this.canDeleteUser(u);
                        const canEdit = this.canEditUser(u);

                        // Initials for avatar
                        const nameParts = (u.name || u.username || "User").trim().split(/\s+/);
                        const initials = nameParts.length > 1 
                            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                            : (nameParts[0].slice(0, 2)).toUpperCase();

                        const isSubjectAdmin = roleMeta.id === "admin" || roleMeta.id === "super_admin";
                        const isSubjectUploader = roleMeta.id === "uploader";

                        return `
                            <tr data-user-id="${u.id}" class="${isYou ? 'user-row-current-session' : ''}">
                                <td>
                                    <div class="user-profile-cell">
                                        <div class="user-avatar-circle ${roleMeta.avatarClass}" title="${roleMeta.label}">
                                            ${initials}
                                        </div>
                                        <div class="user-info-text">
                                            <div class="user-name-row">
                                                <span class="user-display-name">${u.name || 'Unnamed User'}</span>
                                                ${isYou ? `<span class="user-you-pill" title="Current Active Session">You</span>` : ''}
                                            </div>
                                            <span class="user-id-code">ID: ${u.username || u.id} ${u.email ? `• ${u.email}` : ''}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="role-badge ${roleMeta.badgeClass}">
                                        ${roleMeta.icon}
                                        <span>${roleMeta.label}</span>
                                    </span>
                                </td>
                                <td>
                                    <div class="password-cell-box">
                                        <span class="password-val ${isRevealed ? 'revealed' : 'masked'}" id="pass-val-${u.id}">
                                            ${isRevealed ? (u.password || '••••••••') : '••••••••••••'}
                                        </span>
                                        <button type="button" class="btn-toggle-pass" data-user-id="${u.id}" title="${isRevealed ? 'Hide Password' : 'Show Password'}">
                                            ${isRevealed ? `
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                            ` : `
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            `}
                                        </button>
                                        <button type="button" class="btn-copy-pass" data-password="${u.password || ''}" data-user-name="${u.name}" title="Copy Password">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        </button>
                                    </div>
                                </td>
                                <td>
                                    <div class="user-subject-tags-row">
                                        ${isSubjectAdmin ? `
                                            <span class="subject-pill-tag tag-admin-all">★ Master Access (All Subjects)</span>
                                        ` : isSubjectUploader ? `
                                            <span class="subject-pill-tag tag-uploader-all">★ All Ingestion Desk Subjects</span>
                                        ` : (u.assignedSubjects && u.assignedSubjects.length > 0) ? (
                                            u.assignedSubjects.map(sub => `
                                                <span class="subject-pill-tag tag-${sub.toLowerCase().replace(/[^a-z0-9]/g, '')}">
                                                    <span class="sub-dot"></span>
                                                    ${sub}
                                                </span>
                                            `).join('')
                                        ) : `
                                            <span class="subject-pill-tag tag-none">No Subjects Assigned</span>
                                        `}
                                    </div>
                                </td>
                                <td>
                                    <div class="user-classes-tags-row">
                                        ${(isSubjectAdmin || isSubjectUploader) ? `
                                            <span class="class-pill-tag tag-all-classes">All Classes</span>
                                        ` : (u.assignedClasses && u.assignedClasses.length > 0) ? (
                                            u.assignedClasses.map(cls => `
                                                <span class="class-pill-tag">${cls}</span>
                                            `).join('')
                                        ) : `
                                            <span class="class-pill-tag tag-none">All Assigned</span>
                                        `}
                                    </div>
                                </td>
                                <td>
                                    <button type="button" class="btn-status-toggle" data-user-id="${u.id}" title="Click to toggle account status">
                                        <span class="status-badge ${statusClass}">
                                            <span class="status-dot"></span>
                                            <span>${u.status === 'active' ? 'Active' : 'Suspended'}</span>
                                        </span>
                                    </button>
                                </td>
                                <td style="text-align: right;">
                                    <div class="actions-buttons-row">
                                        <button type="button" class="btn-table-action btn-edit-user" data-user-id="${u.id}" ${canEdit ? '' : 'disabled style="opacity: 0.35; cursor: not-allowed;"'} title="${canEdit ? 'Edit User Credentials & Permissions' : 'You do not have permission to edit this Administrator account'}">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        ${canDelete.allowed ? `
                                            <button type="button" class="btn-table-action btn-delete-user" data-user-id="${u.id}" title="Delete User">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                            </button>
                                        ` : `
                                            <button type="button" class="btn-table-action btn-delete-locked" disabled title="${canDelete.reason}">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                            </button>
                                        `}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    getFilteredUsers() {
        return this.users.filter(u => {
            // Role filter
            if (this.roleFilter !== "all") {
                const r = (u.role || "evaluator").toLowerCase();
                if (this.roleFilter === "admin" && r !== "admin" && r !== "super_admin") return false;
                if (this.roleFilter === "uploader" && r !== "uploader") return false;
                if (this.roleFilter === "evaluator" && r !== "evaluator") return false;
            }

            // Status filter
            if (this.statusFilter !== "all") {
                const s = u.status || "active";
                if (this.statusFilter !== s) return false;
            }

            // Subject filter
            if (this.subjectFilter !== "all") {
                const r = (u.role || "evaluator").toLowerCase();
                // Admin and super_admin have access to all subjects
                if (r === "admin" || r === "super_admin") {
                    // include in all subjects
                } else {
                    const subs = u.assignedSubjects || [];
                    if (!subs.includes(this.subjectFilter) && !subs.includes("All Subjects")) return false;
                }
            }

            // Search query
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase().trim();
                const name = (u.name || "").toLowerCase();
                const uname = (u.username || "").toLowerCase();
                const email = (u.email || "").toLowerCase();
                const role = (u.role || "").toLowerCase();
                const subs = (u.assignedSubjects || []).join(" ").toLowerCase();
                return name.includes(q) || uname.includes(q) || email.includes(q) || role.includes(q) || subs.includes(q);
            }

            return true;
        });
    }

    // --- Interactive Event Bindings ---

    bindEvents() {
        if (!this.container) return;

        // Search Input
        const searchInput = this.container.querySelector("#input-user-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.updateTableOnly();
            });
        }

        // Clear Search Button
        const btnClear = this.container.querySelector("#btn-clear-user-search");
        if (btnClear) {
            btnClear.addEventListener("click", () => {
                this.searchQuery = "";
                const inp = this.container.querySelector("#input-user-search");
                if (inp) inp.value = "";
                this.render();
            });
        }

        // Role Filter Select
        const roleSelect = this.container.querySelector("#select-role-filter");
        if (roleSelect) {
            roleSelect.addEventListener("change", (e) => {
                this.roleFilter = e.target.value;
                this.updateTableOnly();
            });
        }

        // Subject Filter Select
        const subSelect = this.container.querySelector("#select-subject-filter");
        if (subSelect) {
            subSelect.addEventListener("change", (e) => {
                this.subjectFilter = e.target.value;
                this.updateTableOnly();
            });
        }

        // Status Filter Select
        const statusSelect = this.container.querySelector("#select-status-filter");
        if (statusSelect) {
            statusSelect.addEventListener("change", (e) => {
                this.statusFilter = e.target.value;
                this.updateTableOnly();
            });
        }

        // Quick KPI Card Filters
        this.container.querySelectorAll(".user-metric-card[data-role-filter]").forEach(card => {
            card.addEventListener("click", () => {
                const rf = card.getAttribute("data-role-filter") || "all";
                this.roleFilter = rf;
                const sel = this.container.querySelector("#select-role-filter");
                if (sel) sel.value = rf;
                this.updateTableOnly();
            });
        });

        // Add User Button
        const btnAdd = this.container.querySelector("#btn-add-new-user");
        if (btnAdd) {
            btnAdd.addEventListener("click", () => this.openUserModal());
        }

        const btnEmptyAdd = this.container.querySelector("#btn-empty-add-user");
        if (btnEmptyAdd) {
            btnEmptyAdd.addEventListener("click", () => this.openUserModal());
        }

        // Sync Credentials Button
        const btnSync = this.container.querySelector("#btn-sync-credentials");
        if (btnSync) {
            btnSync.addEventListener("click", async () => {
                if (!window.firebaseManager) {
                    alert("Cloud Authentication service is not initialized.");
                    return;
                }
                const originalHtml = btnSync.innerHTML;
                btnSync.disabled = true;
                btnSync.innerHTML = `<span>Syncing Credentials...</span>`;

                try {
                    const res = await window.firebaseManager.batchSyncTeachersToFirebaseAuth(this.users);
                    if (res.success) {
                        this.showToast(`Synchronized ${res.synced} of ${this.users.length} accounts to Cloud Auth.`);
                    } else {
                        this.showToast("Batch synchronization finished with notices.");
                    }
                    await this.loadData();
                    this.render();
                } catch (sErr) {
                    console.error("Sync error:", sErr);
                    this.showToast("Sync error: " + sErr.message);
                } finally {
                    btnSync.disabled = false;
                    btnSync.innerHTML = originalHtml;
                }
            });
        }

        // Export CSV Button
        const btnExport = this.container.querySelector("#btn-export-users-csv");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportUsersCSV());
        }

        // Table Action Delegation
        const tableContainer = this.container.querySelector("#user-table-container");
        if (tableContainer) {
            tableContainer.addEventListener("click", (e) => {
                // Empty state add button
                const btnEmptyAdd = e.target.closest("#btn-empty-add-user");
                if (btnEmptyAdd) {
                    this.openUserModal();
                    return;
                }

                // Password show/hide toggle
                const btnPass = e.target.closest(".btn-toggle-pass");
                if (btnPass) {
                    const uId = btnPass.getAttribute("data-user-id");
                    this.togglePasswordReveal(uId);
                    return;
                }

                // Copy password button
                const btnCopy = e.target.closest(".btn-copy-pass");
                if (btnCopy) {
                    const pass = btnCopy.getAttribute("data-password");
                    const name = btnCopy.getAttribute("data-user-name") || "user";
                    if (pass) {
                        navigator.clipboard.writeText(pass).then(() => {
                            this.showToast(`Password copied for ${name}!`);
                            btnCopy.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                            setTimeout(() => {
                                btnCopy.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
                            }, 1800);
                        }).catch(() => {
                            prompt("Copy password:", pass);
                        });
                    }
                    return;
                }

                // Edit User
                const btnEdit = e.target.closest(".btn-edit-user");
                if (btnEdit && !btnEdit.disabled) {
                    const uId = btnEdit.getAttribute("data-user-id");
                    const u = this.users.find(item => item.id === uId);
                    if (u) {
                        if (!this.canEditUser(u)) {
                            alert("Access Denied: You do not have permission to modify this Administrator account.");
                            return;
                        }
                        this.openUserModal(u);
                    }
                    return;
                }

                // Delete User
                const btnDelete = e.target.closest(".btn-delete-user");
                if (btnDelete) {
                    const uId = btnDelete.getAttribute("data-user-id");
                    this.handleDeleteUser(uId);
                    return;
                }

                // Toggle User Active/Inactive Status
                const btnStatus = e.target.closest(".btn-status-toggle");
                if (btnStatus) {
                    const uId = btnStatus.getAttribute("data-user-id");
                    this.toggleUserStatus(uId);
                    return;
                }
            });
        }
    }

    updateTableOnly() {
        const container = this.container.querySelector("#user-table-container");
        if (container) {
            container.innerHTML = this.renderTableHTML();
        }
    }

    togglePasswordReveal(userId) {
        if (this.revealedPasswords.has(userId)) {
            this.revealedPasswords.delete(userId);
        } else {
            this.revealedPasswords.add(userId);
        }
        this.updateTableOnly();
    }

    async toggleUserStatus(userId) {
        const u = this.users.find(item => item.id === userId);
        if (!u) return;

        // Security check: non-admin cannot deactivate admin
        const isCurrentAdmin = this.isCurrentUserAdmin();
        const role = (u.role || "evaluator").toLowerCase();
        if ((role === "admin" || role === "super_admin") && !isCurrentAdmin) {
            alert("Access Denied: Only Administrators can modify Administrator account status.");
            return;
        }

        u.status = u.status === "active" ? "inactive" : "active";
        await window.appStorage.saveUsersList(this.users);
        if (window.firebaseManager && window.firebaseManager.firestore) {
            try {
                await window.firebaseManager.firestore.collection("users").doc(u.uid || u.id).set({ status: u.status }, { merge: true });
            } catch (e) {}
        }
        this.render();
        this.showToast(`User ${u.name} marked as ${u.status === 'active' ? 'Active' : 'Suspended'}`);
    }

    // --- Deletion Flow with Permission Checks & Custom Apple Confirmation Dialog ---

    handleDeleteUser(userId) {
        const u = this.users.find(item => item.id === userId);
        if (!u) return;

        const check = this.canDeleteUser(u);
        if (!check.allowed) {
            alert(`Access Denied: ${check.reason}`);
            return;
        }

        const roleMeta = this.getRoleMeta(u);
        const confirmRoot = document.getElementById("user-delete-confirm-root") || this.container;

        const modalEl = document.createElement("div");
        modalEl.className = "user-modal-backdrop animate-fade-in";
        modalEl.innerHTML = `
            <div class="custom-delete-modal-dialog">
                <div class="delete-icon-ring">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </div>
                <h3 class="delete-modal-title">Delete User Account</h3>
                <p class="delete-modal-msg">
                    Are you sure you want to permanently delete <strong>${u.name}</strong> (<span style="color: #64748B;">@${u.username || u.id}</span>)?
                    <br/><br/>
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; background: rgba(0,0,0,0.04); font-size: 0.82rem; color: #475569;">
                        Role: <strong>${roleMeta.label}</strong>
                    </span>
                    <br/><br/>
                    This will immediately revoke their access to the evaluation desk and credentials. All existing answer sheets already graded remain preserved.
                </p>
                <div class="delete-modal-actions">
                    <button type="button" class="btn-mgmt-secondary" id="btn-cancel-delete">Cancel</button>
                    <button type="button" class="btn-danger-confirm" id="btn-confirm-delete">Permanently Delete</button>
                </div>
            </div>
        `;

        confirmRoot.innerHTML = "";
        confirmRoot.appendChild(modalEl);

        const btnCancel = modalEl.querySelector("#btn-cancel-delete");
        const btnConfirm = modalEl.querySelector("#btn-confirm-delete");

        const closeModal = () => { confirmRoot.innerHTML = ""; };
        if (btnCancel) btnCancel.addEventListener("click", closeModal);

        if (btnConfirm) {
            btnConfirm.addEventListener("click", async () => {
                btnConfirm.disabled = true;
                btnConfirm.textContent = "Deleting...";

                try {
                    this.users = this.users.filter(item => item.id !== userId);
                    await window.appStorage.saveUsersList(this.users);

                    if (window.firebaseManager && window.firebaseManager.firestore) {
                        try {
                            await window.firebaseManager.firestore.collection("users").doc(u.uid || u.id).delete();
                        } catch (e) {
                            console.warn("Firestore user delete notice:", e);
                        }
                    }

                    closeModal();
                    this.render();
                    this.showToast(`User "${u.name}" (${roleMeta.label}) was permanently deleted.`);
                } catch (err) {
                    console.error("Error deleting user:", err);
                    alert("Failed to delete user: " + err.message);
                    closeModal();
                }
            });
        }
    }

    // --- Add & Edit User Modal Form ---

    openUserModal(user = null) {
        this.editingUser = user;
        const isEdit = !!user;
        const isCurrentAdmin = this.isCurrentUserAdmin();
        const modalRoot = document.getElementById("user-modal-container-root");
        if (!modalRoot) return;

        const uData = user || {
            name: "",
            username: "",
            email: "",
            password: this.generateRandomPassword(),
            role: "evaluator",
            assignedSubjects: [],
            assignedClasses: [],
            status: "active"
        };

        const modalEl = document.createElement("div");
        modalEl.className = "user-modal-backdrop animate-fade-in";
        modalEl.innerHTML = `
            <div class="user-modal-card">
                <div class="modal-header">
                    <div class="modal-title-wrap">
                        <span class="modal-tag-pill">${isEdit ? 'Update Credentials & Permissions' : 'New User Account Registration'}</span>
                        <h3 class="modal-heading">${isEdit ? `Edit User: ${uData.name}` : 'Create New User Account'}</h3>
                    </div>
                    <button type="button" class="btn-modal-close" id="btn-user-modal-close" title="Close">×</button>
                </div>

                <form id="form-user-details" class="modal-body-form">
                    <div class="form-row-two-col">
                        <div class="form-group">
                            <label class="form-label" for="inp-user-fullname">Full Name <span class="required-star">*</span></label>
                            <input type="text" id="inp-user-fullname" class="form-input" placeholder="e.g. Dr. Sarah Johnson" value="${uData.name || ''}" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="inp-user-username">User ID / Username <span class="required-star">*</span></label>
                            <input type="text" id="inp-user-username" class="form-input" placeholder="e.g. sarah.bio" value="${uData.username || ''}" required />
                        </div>
                    </div>

                    <div class="form-row-two-col">
                        <div class="form-group">
                            <label class="form-label" for="inp-user-email">Email Address <span class="required-star">*</span></label>
                            <input type="email" id="inp-user-email" class="form-input" placeholder="e.g. sarah@adwaith.edu" value="${uData.email || ''}" required />
                        </div>
                        <div class="form-group">
                            <div class="label-with-action-row">
                                <label class="form-label" for="inp-user-pass">Password <span class="required-star">*</span></label>
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" class="btn-label-link" id="btn-gen-pass" title="Generate random password">Generate</button>
                                    <button type="button" class="btn-label-link" id="btn-modal-copy-pass" title="Copy to clipboard">Copy</button>
                                </div>
                            </div>
                            <div class="input-with-inline-btn">
                                <input type="text" id="inp-user-pass" class="form-input" placeholder="Enter secure password (min 6 characters)" value="${uData.password || ''}" required />
                            </div>
                        </div>
                    </div>

                    <!-- Role Selector with Administrator, Uploader, Evaluator -->
                    <div class="form-group">
                        <label class="form-label" for="select-user-role">System Role & Permissions <span class="required-star">*</span></label>
                        <select id="select-user-role" class="form-select">
                            <option value="admin" ${uData.role === 'admin' ? 'selected' : ''} ${(!isCurrentAdmin && !isEdit) ? 'disabled' : ''}>
                                Administrator (Institutional Audit, Subject Progress & User Governance)
                            </option>
                            <option value="uploader" ${uData.role === 'uploader' ? 'selected' : ''}>
                                Exam Officer / Uploader (Upload Desk, Batch Scans & Class Ingestion)
                            </option>
                            <option value="evaluator" ${(uData.role === 'evaluator' || !uData.role) ? 'selected' : ''}>
                                Faculty Evaluator (Marking Desk, On-Screen Scoring & Remarks)
                            </option>
                        </select>
                        <div id="role-helper-note" class="role-helper-box">
                            <!-- Populated dynamically based on role -->
                        </div>
                    </div>

                    <!-- Assigned Subjects Checkbox Grid -->
                    <div class="form-group" id="group-assigned-subjects">
                        <div class="label-with-action-row">
                            <label class="form-label">Authorized Subject(s) <span class="required-star">*</span></label>
                            <button type="button" class="btn-label-link" id="btn-select-all-subs">Select All</button>
                        </div>
                        <p class="form-help-sub">Select the academic subjects this faculty member is authorized to correct:</p>
                        <div class="checkbox-options-grid" id="subs-checkbox-grid">
                            ${this.subjectsList.map(s => {
                                const isChecked = (uData.assignedSubjects || []).includes(s) || (uData.assignedSubjects || []).includes("All Subjects");
                                return `
                                    <label class="custom-checkbox-card">
                                        <input type="checkbox" name="assigned_subject" value="${s}" ${isChecked ? 'checked' : ''} />
                                        <span class="chk-label">${s}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Assigned Classes Checkbox Grid -->
                    <div class="form-group" id="group-assigned-classes">
                        <div class="label-with-action-row">
                            <label class="form-label">Assigned Classes / Divisions</label>
                            <button type="button" class="btn-label-link" id="btn-select-all-classes">Select All</button>
                        </div>
                        <div class="checkbox-options-grid" id="classes-checkbox-grid">
                            ${this.classesList.map(c => {
                                const isChecked = (uData.assignedClasses || []).includes(c) || (uData.assignedClasses || []).includes("All Classes");
                                return `
                                    <label class="custom-checkbox-card">
                                        <input type="checkbox" name="assigned_class" value="${c}" ${isChecked ? 'checked' : ''} />
                                        <span class="chk-label">${c}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Account Status -->
                    <div class="form-group">
                        <label class="form-label" for="select-user-status">Account Access Status</label>
                        <select id="select-user-status" class="form-select">
                            <option value="active" ${uData.status === 'active' ? 'selected' : ''}>Active (Authorized to log in & evaluate)</option>
                            <option value="inactive" ${uData.status === 'inactive' ? 'selected' : ''}>Suspended / Inactive (Login temporarily disabled)</option>
                        </select>
                    </div>

                    <div class="modal-footer-row">
                        <button type="button" class="btn-mgmt-secondary" id="btn-user-modal-cancel">Cancel</button>
                        <button type="submit" class="btn-mgmt-primary" id="btn-user-modal-save">
                            ${isEdit ? 'Save Changes' : 'Create User Account'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        modalRoot.innerHTML = "";
        modalRoot.appendChild(modalEl);

        const closeBtn = modalEl.querySelector("#btn-user-modal-close");
        const cancelBtn = modalEl.querySelector("#btn-user-modal-cancel");
        const closeModal = () => { modalRoot.innerHTML = ""; };

        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

        // Role change dynamic helper
        const roleSelect = modalEl.querySelector("#select-user-role");
        const roleHelper = modalEl.querySelector("#role-helper-note");
        const updateRoleHelper = () => {
            if (!roleSelect || !roleHelper) return;
            const r = roleSelect.value;
            if (r === "admin") {
                roleHelper.innerHTML = `
                    <div class="helper-pill-admin">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span><strong>Administrator:</strong> Unrestricted access to Exam Audit, Faculty Progress Tracker, Student Mark Matrix, and User Management. Automatically authorized across all subjects.</span>
                    </div>
                `;
            } else if (r === "uploader") {
                roleHelper.innerHTML = `
                    <div class="helper-pill-uploader">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span><strong>Exam Officer / Uploader:</strong> Authorized for Upload Desk, batch paper ingestion, class roster uploads, and PDF scan deletion. Cannot delete Administrator accounts.</span>
                    </div>
                `;
            } else {
                roleHelper.innerHTML = `
                    <div class="helper-pill-evaluator">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        <span><strong>Faculty Evaluator:</strong> Marking Desk access restricted strictly to their assigned subjects and classes below.</span>
                    </div>
                `;
            }
        };
        if (roleSelect) {
            roleSelect.addEventListener("change", updateRoleHelper);
            updateRoleHelper();
        }

        // Generate Password
        const genBtn = modalEl.querySelector("#btn-gen-pass");
        if (genBtn) {
            genBtn.addEventListener("click", () => {
                const passInp = modalEl.querySelector("#inp-user-pass");
                if (passInp) {
                    passInp.value = this.generateRandomPassword();
                    this.showToast("Generated secure password!");
                }
            });
        }

        // Copy Password from modal
        const copyBtn = modalEl.querySelector("#btn-modal-copy-pass");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                const passInp = modalEl.querySelector("#inp-user-pass");
                if (passInp && passInp.value) {
                    navigator.clipboard.writeText(passInp.value).then(() => {
                        this.showToast("Password copied to clipboard!");
                    });
                }
            });
        }

        // Select All Subjects
        const btnAllSubs = modalEl.querySelector("#btn-select-all-subs");
        if (btnAllSubs) {
            btnAllSubs.addEventListener("click", () => {
                const cbs = modalEl.querySelectorAll("input[name='assigned_subject']");
                const allChecked = Array.from(cbs).every(cb => cb.checked);
                cbs.forEach(cb => cb.checked = !allChecked);
                btnAllSubs.textContent = allChecked ? "Select All" : "Deselect All";
            });
        }

        // Select All Classes
        const btnAllClasses = modalEl.querySelector("#btn-select-all-classes");
        if (btnAllClasses) {
            btnAllClasses.addEventListener("click", () => {
                const cbs = modalEl.querySelectorAll("input[name='assigned_class']");
                const allChecked = Array.from(cbs).every(cb => cb.checked);
                cbs.forEach(cb => cb.checked = !allChecked);
                btnAllClasses.textContent = allChecked ? "Select All" : "Deselect All";
            });
        }

        // Form Submit
        const form = modalEl.querySelector("#form-user-details");
        if (form) {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const btnSubmit = modalEl.querySelector("#btn-user-modal-save");
                const name = modalEl.querySelector("#inp-user-fullname")?.value.trim();
                const username = modalEl.querySelector("#inp-user-username")?.value.trim();
                const email = modalEl.querySelector("#inp-user-email")?.value.trim().toLowerCase();
                const password = modalEl.querySelector("#inp-user-pass")?.value.trim();
                const role = modalEl.querySelector("#select-user-role")?.value || "evaluator";
                const status = modalEl.querySelector("#select-user-status")?.value || "active";

                let selectedSubjects = Array.from(modalEl.querySelectorAll("input[name='assigned_subject']:checked")).map(cb => cb.value);
                let selectedClasses = Array.from(modalEl.querySelectorAll("input[name='assigned_class']:checked")).map(cb => cb.value);

                if (!name || !username || !email || !password) {
                    alert("Please fill in all required fields (Full Name, User ID, Email, Password).");
                    return;
                }

                if (password.length < 6) {
                    alert("Password must be at least 6 characters long.");
                    return;
                }

                // If role is Admin or Uploader, automatically assign all subjects if none selected
                if ((role === "admin" || role === "uploader") && selectedSubjects.length === 0) {
                    selectedSubjects = ["All Subjects"];
                }

                if (role === "evaluator" && selectedSubjects.length === 0) {
                    alert("Please assign at least one subject for this Faculty Evaluator.");
                    return;
                }

                // Check security permission: non-admin cannot create/promote to admin
                if (role === "admin" && !isCurrentAdmin && !isEdit) {
                    alert("Access Denied: Only Administrators can create Administrator accounts.");
                    return;
                }

                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = isEdit ? "Updating..." : "Securing Credentials...";
                }

                const roleLabel = role === "super_admin" 
                    ? "Super Admin (Owner)" 
                    : (role === "admin" ? "Administrator" : (role === "uploader" ? "Exam Officer / Uploader" : "Faculty Evaluator"));

                try {
                    if (isEdit && this.editingUser) {
                        this.editingUser.name = name;
                        this.editingUser.username = username;
                        this.editingUser.email = email;
                        this.editingUser.password = password;
                        this.editingUser.role = role;
                        this.editingUser.roleLabel = roleLabel;
                        this.editingUser.assignedSubjects = selectedSubjects;
                        this.editingUser.assignedClasses = selectedClasses;
                        this.editingUser.status = status;

                        // Sync updated profile to Firestore
                        if (window.firebaseManager && window.firebaseManager.firestore) {
                            try {
                                const uid = this.editingUser.uid || this.editingUser.id;
                                await window.firebaseManager.firestore.collection("users").doc(uid).set({
                                    name: name,
                                    username: username,
                                    email: email,
                                    password: password,
                                    role: role,
                                    roleLabel: roleLabel,
                                    assignedSubjects: selectedSubjects,
                                    assignedClasses: selectedClasses,
                                    status: status,
                                    updatedAt: new Date().toISOString()
                                }, { merge: true });
                            } catch (fsErr) {
                                console.warn("Firestore user update warning:", fsErr);
                            }
                        }
                    } else {
                        // Check for duplicate email locally
                        const existingEmail = this.users.find(u => u.email && u.email.toLowerCase() === email);
                        if (existingEmail) {
                            alert(`Account notice: A user with email "${email}" already exists. Please use a unique email or edit the existing account.`);
                            if (btnSubmit) {
                                btnSubmit.disabled = false;
                                btnSubmit.textContent = "Create User Account";
                            }
                            return;
                        }

                        // Provision account in Firebase Auth / Firestore if connected
                        let createdProfile = null;
                        if (window.firebaseManager) {
                            const res = await window.firebaseManager.createTeacherAccount({
                                email: email,
                                password: password,
                                name: name,
                                username: username,
                                role: role,
                                assignedSubjects: selectedSubjects,
                                assignedClasses: selectedClasses,
                                status: status
                            });

                            if (res.success && res.profile) {
                                createdProfile = res.profile;
                            } else if (!res.success && res.error) {
                                alert("Credential Notice: " + res.error);
                                if (btnSubmit) {
                                    btnSubmit.disabled = false;
                                    btnSubmit.textContent = "Create User Account";
                                }
                                return;
                            }
                        }

                        const newUser = createdProfile || {
                            id: `usr_${Date.now()}`,
                            uid: `usr_${Date.now()}`,
                            name: name,
                            username: username,
                            email: email,
                            password: password,
                            role: role,
                            roleLabel: roleLabel,
                            assignedSubjects: selectedSubjects,
                            assignedClasses: selectedClasses,
                            status: status,
                            createdAt: new Date().toISOString().split("T")[0]
                        };
                        this.users.unshift(newUser);
                    }

                    await window.appStorage.saveUsersList(this.users);
                    closeModal();
                    this.render();
                    this.showToast(isEdit ? `Account for ${name} updated successfully.` : `New ${roleLabel} account registered for ${name}!`);
                } catch (err) {
                    console.error("Error creating/saving user:", err);
                    alert("Failed to save user: " + err.message);
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = isEdit ? "Save Changes" : "Create User Account";
                    }
                }
            });
        }
    }

    generateRandomPassword() {
        const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        const digits = "23456789";
        const specials = "#$@!";
        let pass = "";
        for (let i = 0; i < 5; i++) pass += letters.charAt(Math.floor(Math.random() * letters.length));
        for (let i = 0; i < 3; i++) pass += digits.charAt(Math.floor(Math.random() * digits.length));
        pass += specials.charAt(Math.floor(Math.random() * specials.length));
        return pass;
    }

    exportUsersCSV() {
        const headers = ["User ID", "Full Name", "Email", "Role", "Password", "Authorized Subjects", "Assigned Classes", "Status"];
        const rows = this.users.map(u => {
            const roleMeta = this.getRoleMeta(u);
            return [
                `"${u.username || u.id}"`,
                `"${u.name || ''}"`,
                `"${u.email || ''}"`,
                `"${roleMeta.label}"`,
                `"${u.password || ''}"`,
                `"${(u.assignedSubjects || []).join(', ')}"`,
                `"${(u.assignedClasses || []).join(', ')}"`,
                `"${u.status || 'active'}"`
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `niprak_users_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        this.showToast("Users directory exported to CSV");
    }

    showToast(msg) {
        if (window.app && typeof window.app.showToast === "function") {
            window.app.showToast(msg);
        } else {
            console.log("UserMgmt Toast:", msg);
        }
    }
}

window.UserManagementPageManager = UserManagementPageManager;
