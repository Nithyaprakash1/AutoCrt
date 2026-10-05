/**
 * OneSpace Digital Correction - User Management Page Manager
 * Dedicated to Exam Department / Uploader Desk for managing:
 * - Evaluator / Teacher credentials (User ID & Password)
 * - Assigned Subjects (Biology, Chemistry, Physics, Mathematics, Science, etc.)
 * - Assigned Classes / Divisions
 * - Role Governance (Evaluator / Teacher vs. Uploader / Exam Dept)
 * - Strict Regular Typography (0 Bold elements)
 */

class UserManagementPageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.users = [];
        this.subjectsList = ["Physics"];
        this.classesList = ["Class 12-A", "Class 12-B", "Class 12-C", "Class 12-D", "Class 10-A", "Class 10-B"];
        this.searchQuery = "";
        this.roleFilter = "all";
        this.subjectFilter = "all";
        this.revealedPasswords = new Set();
        this.editingUser = null;
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        if (window.appStorage) {
            this.users = await window.appStorage.getUsersList();
            const catalog = await window.appStorage.getSubjectCatalog();
            if (catalog && Array.isArray(catalog) && catalog.length > 0) {
                this.subjectsList = catalog.map(s => s.name);
            }
            const classes = await window.appStorage.getClassesList();
            if (classes && Array.isArray(classes)) {
                this.classesList = [...new Set([...this.classesList, ...classes.map(c => c.label || c.name)])];
            }
        }
    }

    render() {
        if (!this.container) return;

        const totalUsers = this.users.length;
        const evaluatorCount = this.users.filter(u => u.role === "evaluator").length;
        const uploaderCount = this.users.filter(u => u.role === "uploader").length;
        const activeSubjectsCount = new Set(this.users.flatMap(u => u.assignedSubjects || [])).size;

        this.container.innerHTML = `
            <div class="user-mgmt-layout">
                <!-- Header Banner -->
                <div class="user-mgmt-header">
                    <div class="header-titles">
                        <div class="header-tag-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Exam Department Governance
                        </div>
                        <h1 class="page-title">User Management & Subject Allocation</h1>
                        <p class="page-subtitle">Create evaluator and exam officer credentials (User ID & Password), assign Physics subjects, and configure evaluation access permissions.</p>
                    </div>

                    <div class="header-actions">
                        <button type="button" class="btn-mgmt-secondary" id="btn-sync-credentials" title="Ensure all teacher login credentials are synchronized">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                            <span>Sync Credentials</span>
                        </button>
                        <button type="button" class="btn-mgmt-secondary" id="btn-export-users-csv" title="Export users list as CSV">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Export CSV</span>
                        </button>
                        <button type="button" class="btn-mgmt-primary" id="btn-add-new-user">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span>Add New User</span>
                        </button>
                    </div>
                </div>

                <!-- 4 Metrics Stat Cards -->
                <div class="user-metrics-grid">
                    <div class="user-metric-card">
                        <div class="metric-icon-box icon-blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-total-users">${totalUsers}</span>
                            <span class="metric-label">Total Registered Users</span>
                        </div>
                    </div>
                    <div class="user-metric-card">
                        <div class="metric-icon-box icon-green">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-evaluators">${evaluatorCount}</span>
                            <span class="metric-label">Evaluators / Teachers</span>
                        </div>
                    </div>
                    <div class="user-metric-card">
                        <div class="metric-icon-box icon-purple">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-uploaders">${uploaderCount}</span>
                            <span class="metric-label">Exam Dept Uploaders</span>
                        </div>
                    </div>
                    <div class="user-metric-card">
                        <div class="metric-icon-box icon-amber">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        </div>
                        <div class="metric-content">
                            <span class="metric-val" id="metric-subjects">${activeSubjectsCount}</span>
                            <span class="metric-label">Assigned Subjects</span>
                        </div>
                    </div>
                </div>

                <!-- Search & Filters Toolbar -->
                <div class="user-mgmt-toolbar">
                    <div class="search-box-wrap">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="search-input" id="input-user-search" placeholder="Search by User ID, Name, or Subject..." value="${this.searchQuery}" />
                    </div>

                    <div class="filters-wrap">
                        <div class="filter-item">
                            <label class="filter-label" for="select-role-filter">Role:</label>
                            <select id="select-role-filter" class="filter-select">
                                <option value="all" ${this.roleFilter === 'all' ? 'selected' : ''}>All Roles</option>
                                <option value="evaluator" ${this.roleFilter === 'evaluator' ? 'selected' : ''}>Evaluator / Teacher</option>
                                <option value="uploader" ${this.roleFilter === 'uploader' ? 'selected' : ''}>Uploader / Exam Dept</option>
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
                    </div>
                </div>

                <!-- Users Table Section -->
                <div class="user-table-card">
                    <div class="table-scroll-wrapper" id="user-table-container">
                        ${this.renderTableHTML()}
                    </div>
                </div>
            </div>

            <!-- Add / Edit User Modal Container -->
            <div id="user-modal-container-root"></div>
        `;

        this.bindEvents();
    }

    renderTableHTML() {
        const filtered = this.getFilteredUsers();

        if (filtered.length === 0) {
            return `
                <div class="user-empty-state">
                    <div class="empty-icon-circle">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    </div>
                    <h3 class="empty-title">No Users Found</h3>
                    <p class="empty-sub">No matching evaluator or uploader accounts found for the current query or filter.</p>
                    <button type="button" class="btn-mgmt-primary" id="btn-empty-add-user">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>+ Add New User</span>
                    </button>
                </div>
            `;
        }

        return `
            <table class="user-data-table">
                <thead>
                    <tr>
                        <th>User ID & Name</th>
                        <th>Role</th>
                        <th>Password</th>
                        <th>Assigned Subjects</th>
                        <th>Assigned Classes</th>
                        <th>Status</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(u => {
                        const isRevealed = this.revealedPasswords.has(u.id);
                        const roleClass = u.role === 'uploader' ? 'role-badge-uploader' : 'role-badge-evaluator';
                        const roleText = u.role === 'uploader' ? 'Uploader / Admin' : 'Evaluator / Teacher';
                        const statusClass = u.status === 'active' ? 'status-badge-active' : 'status-badge-inactive';

                        return `
                            <tr data-user-id="${u.id}">
                                <td>
                                    <div class="user-profile-cell">
                                        <div class="user-avatar-circle">
                                            ${(u.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div class="user-info-text">
                                            <span class="user-display-name">${u.name}</span>
                                            <span class="user-id-code">ID: ${u.username || u.id} ${u.email ? `• ${u.email}` : ''}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="role-badge ${roleClass}">${roleText}</span>
                                </td>
                                <td>
                                    <div class="password-cell-box">
                                        <span class="password-val ${isRevealed ? 'revealed' : 'masked'}" id="pass-val-${u.id}">
                                            ${isRevealed ? u.password : '••••••••••••'}
                                        </span>
                                        <button type="button" class="btn-toggle-pass" data-user-id="${u.id}" title="${isRevealed ? 'Hide Password' : 'Show Password'}">
                                            ${isRevealed ? `
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                            ` : `
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            `}
                                        </button>
                                    </div>
                                </td>
                                <td>
                                    <div class="user-subject-tags-row">
                                        ${(u.assignedSubjects || []).map(sub => `
                                            <span class="subject-pill-tag tag-${sub.toLowerCase().replace(/[^a-z0-9]/g, '')}">${sub}</span>
                                        `).join('')}
                                    </div>
                                </td>
                                <td>
                                    <div class="user-classes-tags-row">
                                        ${(u.assignedClasses || []).map(cls => `
                                            <span class="class-pill-tag">${cls}</span>
                                        `).join('')}
                                    </div>
                                </td>
                                <td>
                                    <button type="button" class="btn-status-toggle" data-user-id="${u.id}" title="Click to toggle status">
                                        <span class="status-badge ${statusClass}">
                                            <span class="status-dot"></span>
                                            ${u.status === 'active' ? 'Active' : 'Inactive'}
                                        </span>
                                    </button>
                                </td>
                                <td style="text-align: right;">
                                    <div class="actions-buttons-row">
                                        <button type="button" class="btn-table-action btn-edit-user" data-user-id="${u.id}" title="Edit User & Assigned Subjects">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button type="button" class="btn-table-action btn-delete-user" data-user-id="${u.id}" title="Delete User">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                        </button>
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
            if (this.roleFilter !== "all" && u.role !== this.roleFilter) return false;
            if (this.subjectFilter !== "all") {
                const subs = u.assignedSubjects || [];
                if (!subs.includes(this.subjectFilter) && !subs.includes("All Subjects")) return false;
            }
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                const name = (u.name || "").toLowerCase();
                const uname = (u.username || "").toLowerCase();
                const subs = (u.assignedSubjects || []).join(" ").toLowerCase();
                return name.includes(q) || uname.includes(q) || subs.includes(q);
            }
            return true;
        });
    }

    bindEvents() {
        // Search Input
        const searchInput = this.container.querySelector("#input-user-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.updateTableOnly();
            });
        }

        // Role Filter
        const roleSelect = this.container.querySelector("#select-role-filter");
        if (roleSelect) {
            roleSelect.addEventListener("change", (e) => {
                this.roleFilter = e.target.value;
                this.updateTableOnly();
            });
        }

        // Subject Filter
        const subSelect = this.container.querySelector("#select-subject-filter");
        if (subSelect) {
            subSelect.addEventListener("change", (e) => {
                this.subjectFilter = e.target.value;
                this.updateTableOnly();
            });
        }

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
                    alert("Account synchronization service is not available.");
                    return;
                }
                const originalHtml = btnSync.innerHTML;
                btnSync.disabled = true;
                btnSync.innerHTML = `<span>Syncing Credentials...</span>`;

                try {
                    const res = await window.firebaseManager.batchSyncTeachersToFirebaseAuth(this.users);
                    if (res.success) {
                        this.showToast(`Synced ${res.synced} of ${this.users.length} teacher accounts successfully!`);
                    } else {
                        this.showToast("Batch synchronization completed with notices.");
                    }
                    await this.loadData();
                    this.render();
                } catch (sErr) {
                    console.error("Sync error:", sErr);
                    this.showToast("Sync failed: " + sErr.message);
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

        // Delegate table action buttons
        const tableContainer = this.container.querySelector("#user-table-container");
        if (tableContainer) {
            tableContainer.addEventListener("click", (e) => {
                const btnEmptyAdd = e.target.closest("#btn-empty-add-user");
                if (btnEmptyAdd) {
                    this.openUserModal();
                    return;
                }

                const btnPass = e.target.closest(".btn-toggle-pass");
                if (btnPass) {
                    const uId = btnPass.getAttribute("data-user-id");
                    this.togglePasswordReveal(uId);
                    return;
                }

                const btnEdit = e.target.closest(".btn-edit-user");
                if (btnEdit) {
                    const uId = btnEdit.getAttribute("data-user-id");
                    const u = this.users.find(item => item.id === uId);
                    if (u) this.openUserModal(u);
                    return;
                }

                const btnDelete = e.target.closest(".btn-delete-user");
                if (btnDelete) {
                    const uId = btnDelete.getAttribute("data-user-id");
                    this.deleteUser(uId);
                    return;
                }

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
        u.status = u.status === "active" ? "inactive" : "active";
        await window.appStorage.saveUsersList(this.users);
        if (window.firebaseManager && window.firebaseManager.firestore) {
            try {
                await window.firebaseManager.firestore.collection("users").doc(u.uid || u.id).set({ status: u.status }, { merge: true });
            } catch (e) {}
        }
        this.render();
        this.showToast(`User ${u.name} marked ${u.status}`);
    }

    async deleteUser(userId) {
        const u = this.users.find(item => item.id === userId);
        if (!u) return;
        if (!confirm(`Are you sure you want to remove user "${u.name}" (${u.username})?`)) return;

        this.users = this.users.filter(item => item.id !== userId);
        await window.appStorage.saveUsersList(this.users);
        if (window.firebaseManager && window.firebaseManager.firestore) {
            try {
                await window.firebaseManager.firestore.collection("users").doc(u.uid || u.id).delete();
            } catch (e) {}
        }
        this.render();
        this.showToast(`User ${u.name} removed`);
    }

    openUserModal(user = null) {
        this.editingUser = user;
        const isEdit = !!user;
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
                        <span class="modal-tag-pill">${isEdit ? 'Update Credentials' : 'New Evaluator Registration'}</span>
                        <h3 class="modal-heading">${isEdit ? 'Edit User & Subject Assignment' : 'Add New User'}</h3>
                    </div>
                    <button type="button" class="btn-modal-close" id="btn-user-modal-close">×</button>
                </div>

                <form id="form-user-details" class="modal-body-form">
                    <div class="form-row-two-col">
                        <div class="form-group">
                            <label class="form-label" for="inp-user-fullname">Full Name <span class="required-star">*</span></label>
                            <input type="text" id="inp-user-fullname" class="form-input" placeholder="e.g. Dr. Sarah Johnson" value="${uData.name}" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="inp-user-username">User ID / Username <span class="required-star">*</span></label>
                            <input type="text" id="inp-user-username" class="form-input" placeholder="e.g. sarah.bio" value="${uData.username || ''}" required />
                        </div>
                    </div>

                    <div class="form-row-two-col">
                        <div class="form-group">
                            <label class="form-label" for="inp-user-email">User Email <span class="required-star">*</span></label>
                            <input type="email" id="inp-user-email" class="form-input" placeholder="e.g. sarah@niprak.edu" value="${uData.email || ''}" required />
                        </div>
                        <div class="form-group">
                            <div class="label-with-action-row">
                                <label class="form-label" for="inp-user-pass">Password <span class="required-star">*</span></label>
                                <button type="button" class="btn-label-link" id="btn-gen-pass">Generate</button>
                            </div>
                            <div class="input-with-inline-btn">
                                <input type="text" id="inp-user-pass" class="form-input" placeholder="Enter secure password (min 6 chars)" value="${uData.password}" required />
                            </div>
                        </div>
                    </div>

                    <div class="form-row-two-col">
                        <div class="form-group" style="grid-column: span 2;">
                            <label class="form-label" for="select-user-role">Role <span class="required-star">*</span></label>
                            <select id="select-user-role" class="form-select">
                                <option value="evaluator" ${uData.role === 'evaluator' ? 'selected' : ''}>Evaluator / Teacher (Marking Desk)</option>
                                <option value="uploader" ${uData.role === 'uploader' ? 'selected' : ''}>Uploader / Exam Dept (Admin)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Assigned Subjects Checkbox Grid -->
                    <div class="form-group" style="margin-top: 6px;">
                        <label class="form-label">Assigned Subject(s) <span class="required-star">*</span></label>
                        <p class="form-help-sub">Select the academic subjects this evaluator is authorized to correct:</p>
                        <div class="checkbox-options-grid">
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
                    <div class="form-group" style="margin-top: 6px;">
                        <label class="form-label">Assigned Classes / Divisions</label>
                        <div class="checkbox-options-grid">
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

                    <!-- Status Selection -->
                    <div class="form-group" style="margin-top: 6px;">
                        <label class="form-label" for="select-user-status">Account Status</label>
                        <select id="select-user-status" class="form-select">
                            <option value="active" ${uData.status === 'active' ? 'selected' : ''}>Active (Can Log in & Grade)</option>
                            <option value="inactive" ${uData.status === 'inactive' ? 'selected' : ''}>Inactive / Suspended</option>
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

        // Generate Password button
        const genBtn = modalEl.querySelector("#btn-gen-pass");
        if (genBtn) {
            genBtn.addEventListener("click", () => {
                const passInp = modalEl.querySelector("#inp-user-pass");
                if (passInp) passInp.value = this.generateRandomPassword();
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
                const email = modalEl.querySelector("#inp-user-email")?.value.trim();
                const password = modalEl.querySelector("#inp-user-pass")?.value.trim();
                const role = modalEl.querySelector("#select-user-role")?.value;
                const status = modalEl.querySelector("#select-user-status")?.value;

                const selectedSubjects = Array.from(modalEl.querySelectorAll("input[name='assigned_subject']:checked")).map(cb => cb.value);
                const selectedClasses = Array.from(modalEl.querySelectorAll("input[name='assigned_class']:checked")).map(cb => cb.value);

                if (!name || !username || !email || !password) {
                    alert("Please fill in all required fields (Name, User ID, Email, Password).");
                    return;
                }

                if (password.length < 6) {
                    alert("Password must be at least 6 characters long.");
                    return;
                }

                if (selectedSubjects.length === 0) {
                    alert("Please assign at least one subject to this user.");
                    return;
                }

                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = isEdit ? "Updating..." : "Securing Credentials...";
                }

                try {
                    if (isEdit && this.editingUser) {
                        this.editingUser.name = name;
                        this.editingUser.username = username;
                        this.editingUser.email = email;
                        this.editingUser.password = password;
                        this.editingUser.role = role;
                        this.editingUser.roleLabel = role === 'uploader' ? 'Uploader / Exam Dept' : 'Evaluator / Teacher';
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
                                    roleLabel: role === 'uploader' ? 'Uploader / Exam Dept' : 'Evaluator / Teacher',
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
                        const existingEmail = this.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
                        if (existingEmail) {
                            alert(`Account creation notice: A user with email "${email}" is already in the list. Please use a unique email or edit the existing user.`);
                            if (btnSubmit) {
                                btnSubmit.disabled = false;
                                btnSubmit.textContent = "Create User Account";
                            }
                            return;
                        }

                        // Create account credentials
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
                                alert("Credential Setup Notice: " + res.error);
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
                            roleLabel: role === 'uploader' ? 'Uploader / Exam Dept' : 'Evaluator / Teacher',
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
                    this.showToast(isEdit ? `User ${name} updated successfully` : `Teacher account created successfully for ${name}!`);
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
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789#$@";
        let pass = "";
        for (let i = 0; i < 9; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    }

    exportUsersCSV() {
        const headers = ["User ID", "Full Name", "Role", "Password", "Assigned Subjects", "Assigned Classes", "Status"];
        const rows = this.users.map(u => [
            `"${u.username || u.id}"`,
            `"${u.name}"`,
            `"${u.role === 'uploader' ? 'Uploader / Exam Dept' : 'Evaluator / Teacher'}"`,
            `"${u.password}"`,
            `"${(u.assignedSubjects || []).join(', ')}"`,
            `"${(u.assignedClasses || []).join(', ')}"`,
            `"${u.status}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `niprak_users_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        this.showToast("Users list exported to CSV");
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
