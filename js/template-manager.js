/**
 * Niprak OSM – Template Manager Page
 * Shows all templates (hardcoded + Firebase), papers inside each,
 * upload dates, PDF previews, select & delete (paper or full template + papers).
 * Hardcoded templates are flagged so the admin knows they live in mock-data.js / upload-portal.js.
 */

class TemplateManagerPage {
    constructor(containerEl) {
        this.container = containerEl;
        this.allEvaluations = [];
        this.templateGroups = [];
        this.sortBy = 'date_desc';       // date_desc | date_asc | papers_desc | name_asc
        this.filterDate = '';            // YYYY-MM-DD or ''
        this.isLoading = false;
        this.expandedTemplateId = null;
        this.selectedPaperIds = new Set();
        this._previewModal = null;

        // Canonical list of hardcoded template IDs across mock-data.js + upload-portal.js
        this.HARDCODED_IDS = new Set([
            'phy-cbse-70',
            'eng-core-cbse-80',
            'mat-x-rev1-40',
            'mat-x-rev2-40',
            'mat-x-10th-rev-40',
            'mat-xii-80',
            'bio-x-30',
            'bio-rev1-sub-13',
            'bio-rev1-sub-40',
            'eco-xii-40',
            'eco-xii-rev1-40',
            'chem-xii-70',
            'tam-x-rev1-40',
            'tam-xii-rev1-40',
            'hin-x-80',
            'sci-x-80',
        ]);
    }

    /* ── Main entry ─────────────────────────────────────────────────────── */
    async render() {
        this.container.innerHTML = this._skeleton();
        await this._load();
    }

    async _load() {
        this.isLoading = true;
        this._setLoading(true);
        try {
            const evals = await window.appStorage.getAllEvaluations(true, true);
            this.allEvaluations = Array.isArray(evals) ? evals : [];
            this._buildGroups();
            this._renderPage();
        } catch (err) {
            console.error('[TemplateManager] Load error:', err);
            this._renderError(err.message || 'Failed to load templates.');
        } finally {
            this.isLoading = false;
            this._setLoading(false);
        }
    }

    /* ── Group papers by templateId/templateName ───────────────────────── */
    _buildGroups() {
        const map = new Map();

        for (const ev of this.allEvaluations) {
            if (!ev || !ev.id) continue;
            const tplId   = ev.templateId   || '__no_template__';
            const tplName = ev.templateName || ev.examName || 'Unknown Template';
            const subject = ev.subject || '';
            const maxMarks = ev.maxMarks || 0;
            const uploadedAt = ev.date || ev.updatedAt || ev.createdAt || null;

            if (!map.has(tplId)) {
                map.set(tplId, {
                    id:         tplId,
                    name:       tplName,
                    subject:    subject,
                    maxMarks:   maxMarks,
                    isHardcoded: this.HARDCODED_IDS.has(tplId),
                    papers:     [],
                    earliest:   uploadedAt,
                    latest:     uploadedAt,
                });
            }
            const grp = map.get(tplId);
            grp.papers.push(ev);
            if (uploadedAt) {
                if (!grp.earliest || uploadedAt < grp.earliest) grp.earliest = uploadedAt;
                if (!grp.latest   || uploadedAt > grp.latest)   grp.latest   = uploadedAt;
            }
            // Use the most common template name
            if (tplName && tplName !== 'Unknown Template') grp.name = tplName;
            if (subject) grp.subject = subject;
            if (maxMarks) grp.maxMarks = maxMarks;
        }

        this.templateGroups = Array.from(map.values());
        this._sortGroups();
    }

    _sortGroups() {
        const g = this.templateGroups;
        if (this.sortBy === 'date_desc')    g.sort((a, b) => (b.latest || '') > (a.latest || '') ? 1 : -1);
        else if (this.sortBy === 'date_asc') g.sort((a, b) => (a.latest || '') > (b.latest || '') ? 1 : -1);
        else if (this.sortBy === 'papers_desc') g.sort((a, b) => b.papers.length - a.papers.length);
        else if (this.sortBy === 'name_asc') g.sort((a, b) => a.name.localeCompare(b.name));
    }

    _filteredGroups() {
        if (!this.filterDate) return this.templateGroups;
        return this.templateGroups.filter(g => {
            // Keep groups that have at least one paper uploaded on that date
            return g.papers.some(p => {
                const d = (p.date || p.updatedAt || p.createdAt || '').slice(0, 10);
                return d === this.filterDate;
            });
        });
    }

    /* ── Skeleton while loading ─────────────────────────────────────────── */
    _skeleton() {
        return `
        <div class="tm-page" id="tm-page-root">
            <div class="tm-header-bar">
                <div class="tm-header-left">
                    <h2 class="tm-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="9" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="12" width="8" height="9" rx="2"/><rect x="3" y="16" width="8" height="5" rx="2"/></svg>
                        Template Manager
                    </h2>
                    <span class="tm-subtitle" id="tm-subtitle">Loading templates…</span>
                </div>
                <div class="tm-header-right" id="tm-header-controls">
                    <div class="tm-filter-group">
                        <label class="tm-filter-label">Filter by Date</label>
                        <input type="date" class="tm-date-input" id="tm-date-filter" />
                    </div>
                    <div class="tm-filter-group">
                        <label class="tm-filter-label">Sort</label>
                        <select class="tm-sort-select" id="tm-sort-select">
                            <option value="date_desc">Newest First</option>
                            <option value="date_asc">Oldest First</option>
                            <option value="papers_desc">Most Papers</option>
                            <option value="name_asc">Name A–Z</option>
                        </select>
                    </div>
                    <button class="tm-btn-refresh" id="tm-btn-refresh" title="Refresh from cloud">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Refresh
                    </button>
                </div>
            </div>
            <div class="tm-list-area" id="tm-list-area">
                <div class="tm-loading-state" id="tm-loading-state">
                    <div class="tm-spinner"></div>
                    <p>Loading templates from Firestore…</p>
                </div>
            </div>
        </div>
        ${this._modalHtml()}
        ${this._styles()}
        `;
    }

    /* ── Full page render ───────────────────────────────────────────────── */
    _renderPage() {
        const groups = this._filteredGroups();
        const subtitle = `${groups.length} template${groups.length !== 1 ? 's' : ''} • ${this.allEvaluations.length} papers total`;
        const subtitleEl = document.getElementById('tm-subtitle');
        if (subtitleEl) subtitleEl.textContent = subtitle;

        const listArea = document.getElementById('tm-list-area');
        if (!listArea) return;

        if (groups.length === 0) {
            listArea.innerHTML = `
            <div class="tm-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <h3>No templates found</h3>
                <p>${this.filterDate ? 'No papers uploaded on ' + this._fmtDate(this.filterDate) + '.' : 'Upload papers to see templates here.'}</p>
                ${this.filterDate ? '<button class="tm-btn-secondary" onclick="document.getElementById(\'tm-date-filter\').value=\'\';window._tmPage._onDateChange(\'\')">Clear Filter</button>' : ''}
            </div>`;
        } else {
            listArea.innerHTML = groups.map(g => this._templateCard(g)).join('');
        }

        this._attachListeners();
    }

    /* ── Template card HTML ──────────────────────────────────────────────── */
    _templateCard(grp) {
        const isExpanded = this.expandedTemplateId === grp.id;
        const papersHtml = isExpanded ? this._papersTable(grp) : '';
        const hcBadge = grp.isHardcoded
            ? `<span class="tm-badge tm-badge-hardcoded" title="This template is built into the source code (mock-data.js / upload-portal.js). To remove it permanently you must also delete it from the code.">⟨/⟩ Hard‑coded</span>`
            : `<span class="tm-badge tm-badge-firebase">☁ Firebase</span>`;

        const latestStr = grp.latest ? this._fmtDate(grp.latest.slice(0, 10)) + ' ' + this._fmtTime(grp.latest) : '—';
        const earliestStr = grp.earliest ? this._fmtDate(grp.earliest.slice(0, 10)) : '—';

        return `
        <div class="tm-template-card ${isExpanded ? 'is-expanded' : ''}" data-tpl-id="${this._esc(grp.id)}">
            <div class="tm-card-header">
                <div class="tm-card-left">
                    <div class="tm-card-icon">${this._subjectIcon(grp.subject)}</div>
                    <div class="tm-card-meta">
                        <div class="tm-card-name">${this._esc(grp.name)}</div>
                        <div class="tm-card-detail">
                            <span>${this._esc(grp.subject || 'Unknown Subject')}</span>
                            ${grp.maxMarks ? `<span class="tm-dot">•</span><span>${grp.maxMarks} Marks</span>` : ''}
                            <span class="tm-dot">•</span><span>ID: <code>${this._esc(grp.id)}</code></span>
                        </div>
                        <div class="tm-card-dates">
                            <span>📅 Uploaded: <strong>${earliestStr}</strong></span>
                            <span class="tm-dot">•</span>
                            <span>🕒 Last activity: <strong>${latestStr}</strong></span>
                        </div>
                    </div>
                </div>
                <div class="tm-card-right">
                    ${hcBadge}
                    <span class="tm-paper-count">${grp.papers.length} paper${grp.papers.length !== 1 ? 's' : ''}</span>
                    <button class="tm-btn-expand" data-tpl-id="${this._esc(grp.id)}" title="${isExpanded ? 'Collapse' : 'Expand to view papers'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${isExpanded ? '180deg' : '0deg'}); transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button class="tm-btn-delete-tpl" data-tpl-id="${this._esc(grp.id)}" title="Delete template and all its papers" ${grp.isHardcoded ? 'data-hardcoded="true"' : ''}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Delete Template
                    </button>
                </div>
            </div>
            ${isExpanded ? `<div class="tm-papers-area">${papersHtml}</div>` : ''}
        </div>`;
    }

    /* ── Papers table inside expanded card ───────────────────────────────── */
    _papersTable(grp) {
        // Sort papers newest first by date
        const papers = [...grp.papers].sort((a, b) => {
            const da = a.date || a.updatedAt || '';
            const db = b.date || b.updatedAt || '';
            return db > da ? 1 : -1;
        });

        // Apply date filter to papers if active
        const filtered = this.filterDate
            ? papers.filter(p => (p.date || p.updatedAt || p.createdAt || '').slice(0, 10) === this.filterDate)
            : papers;

        if (filtered.length === 0) {
            return `<div class="tm-no-papers">No papers match the selected date filter.</div>`;
        }

        const rows = filtered.map(p => {
            const dateStr = this._fmtDate((p.date || p.updatedAt || '').slice(0, 10));
            const timeStr = this._fmtTime(p.date || p.updatedAt || '');
            const marks   = p.obtainedMarks != null && p.obtainedMarks !== '' ? `${p.obtainedMarks}/${p.maxMarks || '?'}` : '—';
            const status  = p.status || 'Pending';
            const statusClass = status.toLowerCase().includes('complet') ? 'status-done' : (status.toLowerCase().includes('pend') ? 'status-pending' : 'status-other');
            const hasPdf  = !!(p.pdfStorageUrl || (Array.isArray(p.pages) && p.pages.length));
            const isSelected = this.selectedPaperIds.has(String(p.id));

            return `
            <tr class="tm-paper-row ${isSelected ? 'is-selected' : ''}" data-paper-id="${this._esc(p.id)}">
                <td class="tm-td-check">
                    <input type="checkbox" class="tm-paper-check" data-paper-id="${this._esc(p.id)}" ${isSelected ? 'checked' : ''} />
                </td>
                <td class="tm-td-name">${this._esc(p.studentName || 'Unknown Student')}</td>
                <td class="tm-td-roll">${this._esc(p.rollNo || '—')}</td>
                <td class="tm-td-class">${this._esc(p.className || p.class || '—')}</td>
                <td class="tm-td-marks">${marks}</td>
                <td class="tm-td-status"><span class="tm-status-pill ${statusClass}">${this._esc(status)}</span></td>
                <td class="tm-td-date" title="${this._esc(p.date || p.updatedAt || '')}">
                    ${dateStr}<br><span class="tm-time">${timeStr}</span>
                </td>
                <td class="tm-td-actions">
                    ${hasPdf
                        ? `<button class="tm-btn-preview" data-paper-id="${this._esc(p.id)}" title="Preview PDF">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            Preview
                          </button>`
                        : `<span class="tm-no-pdf">No PDF</span>`
                    }
                    <button class="tm-btn-delete-paper" data-paper-id="${this._esc(p.id)}" title="Delete this paper">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                </td>
            </tr>`;
        }).join('');

        const selectedInGrp = filtered.filter(p => this.selectedPaperIds.has(String(p.id))).length;

        return `
        <div class="tm-papers-toolbar">
            <label class="tm-check-all-wrap">
                <input type="checkbox" class="tm-check-all" data-tpl-id="${this._esc(grp.id)}" ${selectedInGrp === filtered.length && filtered.length > 0 ? 'checked' : ''} />
                Select All (${filtered.length})
            </label>
            ${selectedInGrp > 0
                ? `<button class="tm-btn-delete-selected" data-tpl-id="${this._esc(grp.id)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    Delete Selected (${selectedInGrp})
                   </button>`
                : ''}
        </div>
        <div class="tm-table-wrap">
            <table class="tm-papers-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Student Name</th>
                        <th>Roll No</th>
                        <th>Class</th>
                        <th>Marks</th>
                        <th>Status</th>
                        <th>Uploaded On</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    /* ── Event wiring ────────────────────────────────────────────────────── */
    _attachListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('tm-btn-refresh');
        if (refreshBtn) refreshBtn.onclick = () => this._load();

        // Sort select
        const sortSel = document.getElementById('tm-sort-select');
        if (sortSel) {
            sortSel.value = this.sortBy;
            sortSel.onchange = (e) => {
                this.sortBy = e.target.value;
                this._sortGroups();
                this._renderPage();
            };
        }

        // Date filter
        const dateInput = document.getElementById('tm-date-filter');
        if (dateInput) {
            dateInput.value = this.filterDate;
            dateInput.onchange = (e) => this._onDateChange(e.target.value);
        }

        // Expand/collapse buttons
        document.querySelectorAll('.tm-btn-expand').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.tplId;
                this.expandedTemplateId = (this.expandedTemplateId === id) ? null : id;
                this._renderPage();
            };
        });

        // Delete template buttons
        document.querySelectorAll('.tm-btn-delete-tpl').forEach(btn => {
            btn.onclick = () => this._confirmDeleteTemplate(btn.dataset.tplId, btn.dataset.hardcoded === 'true');
        });

        // Paper checkboxes
        document.querySelectorAll('.tm-paper-check').forEach(cb => {
            cb.onchange = () => {
                const pid = String(cb.dataset.paperId);
                cb.checked ? this.selectedPaperIds.add(pid) : this.selectedPaperIds.delete(pid);
                this._refreshExpandedCard();
            };
        });

        // Check all
        document.querySelectorAll('.tm-check-all').forEach(cb => {
            cb.onchange = () => {
                const grpId = cb.dataset.tplId;
                const grp = this.templateGroups.find(g => g.id === grpId);
                if (!grp) return;
                const filtered = this.filterDate
                    ? grp.papers.filter(p => (p.date || p.updatedAt || '').slice(0, 10) === this.filterDate)
                    : grp.papers;
                filtered.forEach(p => {
                    cb.checked ? this.selectedPaperIds.add(String(p.id)) : this.selectedPaperIds.delete(String(p.id));
                });
                this._refreshExpandedCard();
            };
        });

        // Delete selected
        document.querySelectorAll('.tm-btn-delete-selected').forEach(btn => {
            btn.onclick = () => this._confirmDeleteSelected(btn.dataset.tplId);
        });

        // Delete individual paper
        document.querySelectorAll('.tm-btn-delete-paper').forEach(btn => {
            btn.onclick = () => this._confirmDeletePaper(btn.dataset.paperId);
        });

        // Preview paper
        document.querySelectorAll('.tm-btn-preview').forEach(btn => {
            btn.onclick = () => this._openPreview(btn.dataset.paperId);
        });

        // Store reference globally for date-filter inline clear button
        window._tmPage = this;
    }

    _onDateChange(val) {
        this.filterDate = val || '';
        this._renderPage();
    }

    _refreshExpandedCard() {
        // Re-render only the expanded card's papers section to update checkboxes + toolbar
        if (!this.expandedTemplateId) return;
        const grp = this.templateGroups.find(g => g.id === this.expandedTemplateId);
        if (!grp) return;
        const cardEl = document.querySelector(`.tm-template-card[data-tpl-id="${CSS.escape(grp.id)}"] .tm-papers-area`);
        if (cardEl) {
            cardEl.innerHTML = this._papersTable(grp);
            // Re-wire listeners for the refreshed section
            this._attachListeners();
        }
    }

    /* ── Delete confirmations ────────────────────────────────────────────── */
    _confirmDeletePaper(paperId) {
        const ev = this.allEvaluations.find(e => String(e.id) === String(paperId));
        if (!ev) return;
        this._showConfirmModal({
            title: 'Delete Paper',
            message: `Delete paper for <strong>${this._esc(ev.studentName || 'this student')}</strong>?
                      <br><small style="color:#64748B">This will remove it from Firebase Firestore, Storage, and all local caches.</small>`,
            confirmLabel: 'Delete Paper',
            danger: true,
            onConfirm: async () => {
                await this._deletePapers([paperId]);
            }
        });
    }

    _confirmDeleteSelected(tplId) {
        const count = this.selectedPaperIds.size;
        if (count === 0) return;
        this._showConfirmModal({
            title: `Delete ${count} Selected Paper${count !== 1 ? 's' : ''}`,
            message: `Permanently delete <strong>${count}</strong> selected paper${count !== 1 ? 's' : ''}?
                      <br><small style="color:#64748B">Removes from Firebase Firestore, Storage, and all local caches.</small>`,
            confirmLabel: `Delete ${count} Papers`,
            danger: true,
            onConfirm: async () => {
                const ids = Array.from(this.selectedPaperIds);
                this.selectedPaperIds.clear();
                await this._deletePapers(ids);
            }
        });
    }

    _confirmDeleteTemplate(tplId, isHardcoded) {
        const grp = this.templateGroups.find(g => g.id === tplId);
        if (!grp) return;
        const count = grp.papers.length;
        const hcWarning = isHardcoded
            ? `<div class="tm-hc-warning">
                   ⟨/⟩ <strong>Hard‑coded template:</strong> Deleting papers here only removes the <em>uploaded student papers</em> from Firebase.
                   The template blueprint itself is in <code>mock-data.js</code> / <code>upload-portal.js</code> – you must remove it from the source code separately.
               </div>`
            : '';
        this._showConfirmModal({
            title: `Delete Template & All Papers`,
            message: `${hcWarning}
                      Delete template <strong>${this._esc(grp.name)}</strong> and all <strong>${count}</strong> paper${count !== 1 ? 's' : ''} inside?
                      <br><small style="color:#EF4444;font-weight:600">This action cannot be undone.</small>`,
            confirmLabel: `Delete Template + ${count} Papers`,
            danger: true,
            onConfirm: async () => {
                const paperIds = grp.papers.map(p => p.id);
                await this._deletePapers(paperIds);
                // Also delete the template document from Firestore exam_templates collection
                if (window.firebaseManager && window.firebaseManager.firestore && tplId !== '__no_template__') {
                    try {
                        await window.firebaseManager.firestore.collection('exam_templates').doc(String(tplId)).delete();
                    } catch (e) { /* template doc may not exist – that's fine */ }
                }
            }
        });
    }

    async _deletePapers(ids) {
        const modal = document.getElementById('tm-confirm-modal');
        const confirmBtn = document.getElementById('tm-modal-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Deleting…';
        }

        let failed = 0;
        for (const id of ids) {
            try {
                await window.appStorage.deleteEvaluation(id);
            } catch (e) {
                console.warn('[TemplateManager] Delete failed for', id, e);
                failed++;
            }
        }

        if (modal) modal.style.display = 'none';

        if (failed > 0) {
            this._toast(`⚠ ${failed} paper${failed !== 1 ? 's' : ''} could not be deleted from cloud. Local copies removed.`, 'warn');
        } else {
            this._toast(`✓ ${ids.length} paper${ids.length !== 1 ? 's' : ''} deleted successfully.`, 'success');
        }

        // Reload
        await this._load();
    }

    /* ── PDF Preview modal ───────────────────────────────────────────────── */
    async _openPreview(paperId) {
        const ev = this.allEvaluations.find(e => String(e.id) === String(paperId));
        if (!ev) return;

        const modal = document.getElementById('tm-preview-modal');
        const titleEl = document.getElementById('tm-preview-title');
        const frameEl = document.getElementById('tm-preview-frame');
        const pagesEl = document.getElementById('tm-preview-pages');

        if (!modal) return;
        modal.style.display = 'flex';
        if (titleEl) titleEl.textContent = `${ev.studentName || 'Student'} – ${ev.templateName || ev.examName || 'Paper Preview'}`;
        if (frameEl) frameEl.innerHTML = `<div class="tm-preview-loading"><div class="tm-spinner"></div><p>Loading preview…</p></div>`;
        if (pagesEl) pagesEl.innerHTML = '';

        // Try to load pages
        let pages = [];
        if (Array.isArray(ev.pages) && ev.pages.length > 0) {
            pages = ev.pages;
        } else {
            // Try PDF cache
            try {
                const cached = await window.appStorage.getPdfCache(String(ev.id));
                if (cached && Array.isArray(cached.pages)) pages = cached.pages;
            } catch (e) {}
        }

        if (pages.length > 0) {
            if (frameEl) {
                frameEl.innerHTML = pages.map((src, i) =>
                    `<div class="tm-preview-page-wrap">
                        <div class="tm-preview-page-label">Page ${i + 1} of ${pages.length}</div>
                        <img src="${src}" alt="Page ${i + 1}" class="tm-preview-page-img" loading="lazy" />
                    </div>`
                ).join('');
            }
        } else if (ev.pdfStorageUrl) {
            if (frameEl) {
                frameEl.innerHTML = `
                <div class="tm-preview-ext-link">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <p>PDF is stored in Firebase Cloud Storage.</p>
                    <a href="${this._esc(ev.pdfStorageUrl)}" target="_blank" rel="noopener" class="tm-btn-open-pdf">Open PDF ↗</a>
                </div>`;
            }
        } else {
            if (frameEl) {
                frameEl.innerHTML = `<div class="tm-preview-empty"><p>No preview available. The PDF was not cached on this device.</p></div>`;
            }
        }
    }

    /* ── Confirm modal ───────────────────────────────────────────────────── */
    _showConfirmModal({ title, message, confirmLabel, danger, onConfirm }) {
        const modal = document.getElementById('tm-confirm-modal');
        const titleEl = document.getElementById('tm-modal-title');
        const bodyEl  = document.getElementById('tm-modal-body');
        const confirmBtn = document.getElementById('tm-modal-confirm-btn');
        const cancelBtn  = document.getElementById('tm-modal-cancel-btn');

        if (!modal) return;
        if (titleEl) titleEl.textContent = title;
        if (bodyEl)  bodyEl.innerHTML = message;
        if (confirmBtn) {
            confirmBtn.textContent = confirmLabel;
            confirmBtn.className = `tm-modal-btn ${danger ? 'tm-modal-btn-danger' : 'tm-modal-btn-primary'}`;
            confirmBtn.disabled = false;
            confirmBtn.onclick = onConfirm;
        }
        if (cancelBtn) cancelBtn.onclick = () => { modal.style.display = 'none'; };
        modal.style.display = 'flex';

        // Close on backdrop click
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }

    /* ── Toast ───────────────────────────────────────────────────────────── */
    _toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `tm-toast tm-toast-${type}`;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('tm-toast-show'), 10);
        setTimeout(() => { el.classList.remove('tm-toast-show'); setTimeout(() => el.remove(), 400); }, 3500);
    }

    /* ── Loading state ───────────────────────────────────────────────────── */
    _setLoading(loading) {
        const ls = document.getElementById('tm-loading-state');
        if (ls) ls.style.display = loading ? 'flex' : 'none';
    }

    _renderError(msg) {
        const listArea = document.getElementById('tm-list-area');
        if (listArea) {
            listArea.innerHTML = `<div class="tm-error-state"><p>⚠ ${this._esc(msg)}</p><button class="tm-btn-secondary" onclick="window._tmPage._load()">Retry</button></div>`;
        }
    }

    /* ── Modal HTML ──────────────────────────────────────────────────────── */
    _modalHtml() {
        return `
        <!-- Confirm Modal -->
        <div class="tm-modal-overlay" id="tm-confirm-modal" style="display:none;">
            <div class="tm-modal-card">
                <h3 class="tm-modal-title" id="tm-modal-title">Confirm</h3>
                <div class="tm-modal-body" id="tm-modal-body"></div>
                <div class="tm-modal-actions">
                    <button class="tm-modal-btn tm-modal-btn-secondary" id="tm-modal-cancel-btn">Cancel</button>
                    <button class="tm-modal-btn tm-modal-btn-danger" id="tm-modal-confirm-btn">Delete</button>
                </div>
            </div>
        </div>

        <!-- PDF Preview Modal -->
        <div class="tm-modal-overlay" id="tm-preview-modal" style="display:none;" onclick="if(event.target===this)this.style.display='none'">
            <div class="tm-modal-card tm-preview-modal-card">
                <div class="tm-modal-preview-header">
                    <h3 class="tm-modal-title" id="tm-preview-title">Paper Preview</h3>
                    <button class="tm-modal-close-btn" onclick="document.getElementById('tm-preview-modal').style.display='none'">✕</button>
                </div>
                <div class="tm-preview-scroll" id="tm-preview-frame"></div>
                <div id="tm-preview-pages"></div>
            </div>
        </div>`;
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */
    _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _fmtDate(iso) {
        if (!iso || iso === 'null') return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return iso; }
    }

    _fmtTime(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    }

    _subjectIcon(subject) {
        const s = (subject || '').toLowerCase();
        if (s.includes('physics'))   return '⚛';
        if (s.includes('math'))      return '∑';
        if (s.includes('chem'))      return '🧪';
        if (s.includes('bio'))       return '🧬';
        if (s.includes('english'))   return '📖';
        if (s.includes('econom'))    return '📈';
        if (s.includes('tamil'))     return 'த';
        if (s.includes('hindi'))     return 'ह';
        if (s.includes('history'))   return '📜';
        if (s.includes('geo'))       return '🌍';
        if (s.includes('computer') || s.includes('cs')) return '💻';
        if (s.includes('science'))   return '🔬';
        return '📄';
    }

    /* ── CSS (scoped inside .tm-page) ─────────────────────────────────────── */
    _styles() {
        return `<style>
        /* ── Layout ── */
        .tm-page { padding: 24px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #1E293B; max-width: 1200px; margin: 0 auto; }
        .tm-header-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .tm-header-left { display: flex; flex-direction: column; gap: 4px; }
        .tm-title { margin: 0; font-size: 1.35rem; font-weight: 700; display: flex; align-items: center; gap: 10px; color: #0F172A; }
        .tm-subtitle { font-size: 0.83rem; color: #64748B; }
        .tm-header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .tm-filter-group { display: flex; flex-direction: column; gap: 3px; }
        .tm-filter-label { font-size: 0.72rem; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; }
        .tm-date-input, .tm-sort-select { border: 1.5px solid #E2E8F0; border-radius: 8px; padding: 6px 10px; font-size: 0.83rem; color: #1E293B; background: #F8FAFC; cursor: pointer; outline: none; }
        .tm-date-input:focus, .tm-sort-select:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        .tm-btn-refresh { display: flex; align-items: center; gap: 6px; padding: 7px 14px; background: #F1F5F9; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 0.82rem; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.15s; }
        .tm-btn-refresh:hover { background: #E2E8F0; color: #1E293B; }
        /* ── Template cards ── */
        .tm-list-area { display: flex; flex-direction: column; gap: 14px; }
        .tm-template-card { background: #fff; border: 1.5px solid #E2E8F0; border-radius: 14px; overflow: hidden; transition: box-shadow 0.2s; }
        .tm-template-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
        .tm-template-card.is-expanded { border-color: #BFDBFE; box-shadow: 0 2px 20px rgba(59,130,246,0.09); }
        .tm-card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; gap: 12px; flex-wrap: wrap; }
        .tm-card-left { display: flex; align-items: flex-start; gap: 14px; flex: 1; min-width: 0; }
        .tm-card-icon { width: 44px; height: 44px; background: #F1F5F9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0; }
        .tm-card-meta { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .tm-card-name { font-size: 0.97rem; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 560px; }
        .tm-card-detail { font-size: 0.78rem; color: #64748B; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .tm-card-detail code { background: #F1F5F9; border-radius: 4px; padding: 1px 5px; font-size: 0.72rem; }
        .tm-card-dates { font-size: 0.75rem; color: #94A3B8; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .tm-card-dates strong { color: #475569; }
        .tm-dot { color: #CBD5E1; }
        .tm-card-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        /* ── Badges ── */
        .tm-badge { font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 20px; white-space: nowrap; }
        .tm-badge-hardcoded { background: rgba(245,158,11,0.12); color: #D97706; border: 1px solid rgba(245,158,11,0.25); }
        .tm-badge-firebase  { background: rgba(59,130,246,0.1); color: #2563EB; border: 1px solid rgba(59,130,246,0.2); }
        .tm-paper-count { font-size: 0.8rem; font-weight: 700; background: #F1F5F9; border-radius: 20px; padding: 3px 10px; color: #475569; }
        /* ── Buttons ── */
        .tm-btn-expand { background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 8px; padding: 6px 8px; cursor: pointer; color: #64748B; display: flex; align-items: center; transition: all 0.15s; }
        .tm-btn-expand:hover { background: #EFF6FF; border-color: #BFDBFE; color: #3B82F6; }
        .tm-btn-delete-tpl { display: flex; align-items: center; gap: 5px; padding: 6px 12px; background: rgba(239,68,68,0.07); border: 1.5px solid rgba(239,68,68,0.2); border-radius: 8px; font-size: 0.78rem; font-weight: 600; color: #DC2626; cursor: pointer; transition: all 0.15s; }
        .tm-btn-delete-tpl:hover { background: rgba(239,68,68,0.14); }
        .tm-btn-secondary { padding: 7px 16px; background: #F1F5F9; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 0.82rem; font-weight: 600; color: #475569; cursor: pointer; }
        /* ── Papers area ── */
        .tm-papers-area { border-top: 1.5px solid #F1F5F9; background: #FAFBFC; padding: 16px 20px; }
        .tm-papers-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .tm-check-all-wrap { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 600; color: #475569; cursor: pointer; }
        .tm-btn-delete-selected { display: flex; align-items: center; gap: 5px; padding: 6px 12px; background: rgba(239,68,68,0.08); border: 1.5px solid rgba(239,68,68,0.2); border-radius: 7px; font-size: 0.78rem; font-weight: 600; color: #DC2626; cursor: pointer; }
        .tm-table-wrap { overflow-x: auto; border-radius: 10px; border: 1.5px solid #E2E8F0; background: #fff; }
        .tm-papers-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .tm-papers-table thead th { background: #F8FAFC; padding: 10px 12px; text-align: left; font-weight: 600; color: #64748B; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; border-bottom: 1.5px solid #E2E8F0; }
        .tm-papers-table tbody tr { border-bottom: 1px solid #F1F5F9; transition: background 0.1s; }
        .tm-papers-table tbody tr:last-child { border-bottom: none; }
        .tm-papers-table tbody tr:hover { background: #F8FAFC; }
        .tm-papers-table tbody tr.is-selected { background: #EFF6FF; }
        .tm-papers-table td { padding: 10px 12px; vertical-align: middle; }
        .tm-td-check { width: 36px; }
        .tm-td-actions { display: flex; align-items: center; gap: 6px; }
        .tm-time { font-size: 0.72rem; color: #94A3B8; }
        .tm-status-pill { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
        .status-done    { background: rgba(16,185,129,0.1); color: #059669; }
        .status-pending { background: rgba(245,158,11,0.1); color: #D97706; }
        .status-other   { background: rgba(100,116,139,0.1); color: #475569; }
        .tm-btn-preview { display: flex; align-items: center; gap: 4px; padding: 4px 9px; background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: #2563EB; cursor: pointer; white-space: nowrap; }
        .tm-btn-preview:hover { background: #DBEAFE; }
        .tm-btn-delete-paper { display: flex; align-items: center; padding: 5px 7px; background: rgba(239,68,68,0.07); border: 1.5px solid rgba(239,68,68,0.18); border-radius: 6px; color: #DC2626; cursor: pointer; }
        .tm-btn-delete-paper:hover { background: rgba(239,68,68,0.14); }
        .tm-no-pdf { font-size: 0.72rem; color: #94A3B8; }
        /* ── Empty/error states ── */
        .tm-empty-state, .tm-error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 24px; text-align: center; }
        .tm-empty-state h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1E293B; }
        .tm-empty-state p, .tm-error-state p { margin: 0; color: #64748B; font-size: 0.88rem; }
        .tm-no-papers { padding: 18px; text-align: center; font-size: 0.83rem; color: #94A3B8; }
        /* ── Loading ── */
        .tm-loading-state { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px; }
        .tm-spinner { width: 34px; height: 34px; border: 3px solid rgba(59,130,246,0.15); border-top-color: #3B82F6; border-radius: 50%; animation: tmSpin 0.75s linear infinite; }
        @keyframes tmSpin { to { transform: rotate(360deg); } }
        /* ── Modals ── */
        .tm-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .tm-modal-card { background: #fff; border-radius: 16px; padding: 28px 28px 24px; max-width: 480px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
        .tm-preview-modal-card { max-width: 860px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
        .tm-modal-preview-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 14px; border-bottom: 1px solid #F1F5F9; }
        .tm-modal-close-btn { background: #F1F5F9; border: none; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; font-size: 1rem; color: #64748B; display: flex; align-items: center; justify-content: center; }
        .tm-modal-close-btn:hover { background: #E2E8F0; }
        .tm-preview-scroll { overflow-y: auto; flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 16px; background: #F8FAFC; }
        .tm-preview-page-wrap { background: #fff; border-radius: 8px; border: 1px solid #E2E8F0; overflow: hidden; }
        .tm-preview-page-label { font-size: 0.75rem; font-weight: 600; color: #64748B; padding: 6px 12px; background: #F8FAFC; border-bottom: 1px solid #F1F5F9; }
        .tm-preview-page-img { width: 100%; display: block; }
        .tm-preview-loading, .tm-preview-empty, .tm-preview-ext-link { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px; text-align: center; color: #64748B; }
        .tm-btn-open-pdf { padding: 10px 20px; background: #3B82F6; color: #fff; border: none; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; cursor: pointer; }
        .tm-modal-title { margin: 0 0 14px; font-size: 1.05rem; font-weight: 700; color: #0F172A; }
        .tm-modal-body { font-size: 0.88rem; color: #475569; line-height: 1.6; margin-bottom: 22px; }
        .tm-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .tm-modal-btn { padding: 9px 20px; border-radius: 9px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
        .tm-modal-btn-secondary { background: #F1F5F9; color: #475569; }
        .tm-modal-btn-secondary:hover { background: #E2E8F0; }
        .tm-modal-btn-primary { background: #3B82F6; color: #fff; }
        .tm-modal-btn-primary:hover { background: #2563EB; }
        .tm-modal-btn-danger { background: #EF4444; color: #fff; }
        .tm-modal-btn-danger:hover { background: #DC2626; }
        .tm-modal-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        /* ── Hard-coded warning box ── */
        .tm-hc-warning { background: rgba(245,158,11,0.08); border: 1.5px solid rgba(245,158,11,0.25); border-radius: 9px; padding: 12px 14px; margin-bottom: 14px; font-size: 0.82rem; color: #92400E; line-height: 1.5; }
        .tm-hc-warning code { background: rgba(245,158,11,0.15); border-radius: 4px; padding: 1px 5px; font-size: 0.77rem; }
        /* ── Toast ── */
        .tm-toast { position: fixed; bottom: 28px; right: 28px; z-index: 10000; padding: 12px 20px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; box-shadow: 0 8px 30px rgba(0,0,0,0.15); opacity: 0; transform: translateY(12px); transition: all 0.3s; pointer-events: none; }
        .tm-toast-show { opacity: 1; transform: translateY(0); }
        .tm-toast-success { background: #059669; color: #fff; }
        .tm-toast-warn { background: #D97706; color: #fff; }
        .tm-toast-error { background: #DC2626; color: #fff; }
        </style>`;
    }
}

/* ── Register with app.js view system ───────────────────────────────────── */
window.TemplateManagerPage = TemplateManagerPage;
