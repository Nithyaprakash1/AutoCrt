/**
 * Niprak Digital Correction - WhatsApp & Direct Link Sharing Manager
 * Enables instant one-click sharing of uploaded examination subjects,
 * batch archives, and individual student answer sheets to WhatsApp.
 * Direct links navigate recipients directly to the exact target with zero misleading steps.
 */

class ShareManager {
    /**
     * Get the canonical base URL of the application
     */
    static getBaseUrl() {
        let href = window.location.href.split('?')[0].split('#')[0];
        if (href.endsWith('admin.html')) {
            href = href.replace('admin.html', 'index.html');
        }
        return href;
    }

    /**
     * Build direct access URL for an uploaded subject batch (Navigates directly to Teacher Desk)
     */
    static buildSubjectUrl(subject, batchKey = null) {
        const base = this.getBaseUrl();
        let url = `${base}?view=dashboard`;
        if (subject && subject !== "all") {
            url += `&subject=${encodeURIComponent(subject)}`;
        }
        if (batchKey && batchKey !== "all") {
            url += `&batch=${encodeURIComponent(batchKey)}`;
        }
        return url;
    }

    /**
     * Build direct evaluation workspace URL for a single student paper / page
     */
    static buildPaperUrl(paperId) {
        const base = this.getBaseUrl();
        return `${base}?paperId=${encodeURIComponent(paperId)}`;
    }

    /**
     * Generate WhatsApp formatted text message for a subject or batch
     */
    static generateSubjectMessage({ subject, className, templateName, paperCount, batchKey }) {
        const sub = subject || "Examination";
        const cls = className ? ` (${className})` : "";
        const url = this.buildSubjectUrl(sub, batchKey);

        let lines = [
            `📚 *Niprak OSM - Exam Papers Ready for Correction*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📖 *Subject:* ${sub}${cls}`,
        ];

        if (templateName) {
            lines.push(`📝 *Assessment:* ${templateName}`);
        }
        if (paperCount) {
            lines.push(`📄 *Uploaded Papers:* ${paperCount} Answer Sheet(s)`);
        }

        lines.push(
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🔗 *Direct Access Link:*`,
            url,
            ``,
            `_(Click the link above to view and evaluate these papers directly)_`
        );

        return lines.join("\n");
    }

    /**
     * Generate WhatsApp formatted text message for a single student paper
     */
    static generatePaperMessage({ paperId, studentName, rollNo, subject, className }) {
        const name = studentName || "Student Paper";
        const roll = rollNo ? ` (Roll: ${rollNo})` : "";
        const sub = subject ? ` | ${subject}` : "";
        const cls = className ? ` - ${className}` : "";
        const url = this.buildPaperUrl(paperId);

        return [
            `📝 *Niprak OSM - Student Answer Sheet*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `👤 *Student:* ${name}${roll}`,
            `📖 *Course:* ${subject || 'Physics'}${cls}`,
            `📑 *Status:* Ready for Faculty Evaluation`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🔗 *Direct Evaluation Link:*`,
            url,
            ``,
            `_(Click the link above to open and grade this answer sheet directly)_`
        ].join("\n");
    }

    /**
     * Launch WhatsApp Web or Mobile with pre-filled message text
     */
    static openWhatsApp(messageText) {
        const encoded = encodeURIComponent(messageText);
        const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
    }

    /**
     * Copy text to clipboard with feedback
     */
    static async copyToClipboard(text, btnElement = null) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }

            if (btnElement) {
                const origHtml = btnElement.innerHTML;
                btnElement.innerHTML = `✓ Copied!`;
                btnElement.style.background = "#16A34A";
                btnElement.style.color = "#FFFFFF";
                setTimeout(() => {
                    btnElement.innerHTML = origHtml;
                    btnElement.style.background = "";
                    btnElement.style.color = "";
                }, 2200);
            }

            if (window.app && typeof window.app.showToast === "function") {
                window.app.showToast("✓ Direct access link copied to clipboard!");
            }
        } catch (err) {
            console.error("Clipboard copy failed:", err);
            prompt("Copy this direct link:", text);
        }
    }

    /**
     * Show interactive Cupertino Share Modal
     */
    static showShareModal({
        type = "subject", // "subject" or "paper"
        title = "Share Exam Papers",
        subject = "Physics",
        className = "Class 12-A",
        templateName = "",
        paperCount = 0,
        paperId = "",
        studentName = "",
        rollNo = "",
        batchKey = null
    }) {
        const modalId = "modal-whatsapp-share-dialog";
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        let messageText = "";
        let directUrl = "";
        let metaBadge = "";

        if (type === "paper" && paperId) {
            messageText = this.generatePaperMessage({ paperId, studentName, rollNo, subject, className });
            directUrl = this.buildPaperUrl(paperId);
            metaBadge = `Student Paper • ${studentName || 'Student'} (Roll ${rollNo || '—'})`;
        } else {
            messageText = this.generateSubjectMessage({ subject, className, templateName, paperCount, batchKey });
            directUrl = this.buildSubjectUrl(subject, batchKey);
            metaBadge = `Subject Batch • ${subject} (${className || 'All Classes'})`;
        }

        const backdrop = document.createElement("div");
        backdrop.id = modalId;
        backdrop.className = "share-modal-backdrop";
        backdrop.innerHTML = `
            <div class="share-modal-card" role="dialog" aria-modal="true">
                <div class="share-modal-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="share-modal-icon-badge">
                            ${window.Icons?.whatsapp || `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`}
                        </div>
                        <div>
                            <h3 class="share-modal-title">Share to WhatsApp</h3>
                            <span class="share-modal-meta-tag">${metaBadge}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-share-modal-close" id="btn-close-share-modal" title="Close dialog">×</button>
                </div>

                <div class="share-modal-body">
                    <p class="share-modal-desc">
                        Recipients who click this link navigate <strong>directly</strong> to ${type === 'paper' ? 'this student answer sheet workspace' : 'this subject papers repository'} with zero misleading steps.
                    </p>

                    <!-- Direct URL Box -->
                    <div class="share-url-box">
                        <label class="share-url-label">Direct Destination Link</label>
                        <div class="share-url-input-wrap">
                            <input type="text" readonly id="share-direct-url-input" class="share-direct-url-input" value="${directUrl}" />
                            <button type="button" class="btn-copy-share-url" id="btn-copy-share-url" title="Copy direct access URL">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                <span>Copy Link</span>
                            </button>
                        </div>
                    </div>

                    <!-- WhatsApp Message Preview -->
                    <div class="share-preview-box">
                        <div class="share-preview-header">
                            <span class="share-preview-label">WhatsApp Message Preview</span>
                            <button type="button" class="btn-copy-preview-text" id="btn-copy-full-text" title="Copy complete message text">
                                Copy Message Text
                            </button>
                        </div>
                        <div class="share-preview-bubble">
                            <pre class="share-preview-pre">${messageText}</pre>
                        </div>
                    </div>
                </div>

                <div class="share-modal-footer">
                    <button type="button" class="btn-share-whatsapp-primary" id="btn-open-whatsapp-now">
                        ${window.Icons?.whatsapp || ''}
                        <span>Share on WhatsApp</span>
                    </button>
                    <button type="button" class="btn-share-modal-dismiss" id="btn-dismiss-share-modal">
                        Done
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Bind Actions
        const closeModal = () => backdrop.remove();

        backdrop.querySelector("#btn-close-share-modal")?.addEventListener("click", closeModal);
        backdrop.querySelector("#btn-dismiss-share-modal")?.addEventListener("click", closeModal);
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) closeModal();
        });

        // WhatsApp trigger
        backdrop.querySelector("#btn-open-whatsapp-now")?.addEventListener("click", () => {
            this.openWhatsApp(messageText);
        });

        // Copy URL button
        const copyUrlBtn = backdrop.querySelector("#btn-copy-share-url");
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener("click", () => {
                this.copyToClipboard(directUrl, copyUrlBtn);
            });
        }

        // Copy full text button
        const copyFullBtn = backdrop.querySelector("#btn-copy-full-text");
        if (copyFullBtn) {
            copyFullBtn.addEventListener("click", () => {
                this.copyToClipboard(messageText, copyFullBtn);
            });
        }

        // Auto select on click of input
        const urlInput = backdrop.querySelector("#share-direct-url-input");
        if (urlInput) {
            urlInput.addEventListener("click", () => urlInput.select());
        }
    }

    /**
     * Shortcut to share a Subject
     */
    static shareSubject(params) {
        this.showShareModal({
            type: "subject",
            ...params
        });
    }

    /**
     * Shortcut to share a single Student Paper
     */
    static sharePaper(params) {
        this.showShareModal({
            type: "paper",
            ...params
        });
    }
}

window.ShareManager = ShareManager;
