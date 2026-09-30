/**
 * OneSpace Digital Correction - PDF Generator
 * Renders original paper pages overlaid with crisp annotations,
 * followed by a professional final Student Mark Summary Page.
 */

class PDFGenerator {
    /**
     * Generate and download the evaluated student PDF
     */
    static async generateCorrectedPaperPDF(evaluation, onProgress = null) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error("jsPDF library is not loaded");
        }

        if (onProgress) onProgress(15, "Initializing high-resolution PDF document engine...");

        const { jsPDF } = window.jspdf;
        // Default A4 portrait (210 x 297 mm)
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        let pages = evaluation.pages || [];
        const annotations = evaluation.annotations || [];

        // If paper was stored as optimized single PDF, expand pages on demand via pdfjsLib
        const isPdf = (pages.length === 1 && typeof pages[0] === "string" && (pages[0].startsWith("data:application/pdf") || pages[0].includes(".pdf") || pages[0].includes("alt=media") || pages[0].includes("firebasestorage"))) ||
                      (evaluation.pdfDataUrl && (!pages || pages.length <= 1));
        const pdfSrc = (pages.length === 1 && typeof pages[0] === "string" && (pages[0].startsWith("data:application/pdf") || pages[0].includes("firebasestorage") || pages[0].includes(".pdf"))) 
                       ? pages[0] 
                       : (evaluation.pdfStorageUrl || evaluation.pdfDataUrl || pages[0]);

        if (isPdf && pdfSrc && window.pdfjsLib) {
            try {
                if (onProgress) onProgress(25, "Extracting PDF answer sheet pages...");
                let loadingTask = null;
                const uint8Array = await CanvasEngine.fetchPdfBytes(pdfSrc);
                if (uint8Array) {
                    loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
                } else {
                    loadingTask = window.pdfjsLib.getDocument({ url: pdfSrc });
                }
                const pdfDoc = await loadingTask.promise;
                if (pdfDoc && pdfDoc.numPages >= 1) {
                    const rendered = [];
                    for (let pNum = 1; pNum <= pdfDoc.numPages; pNum++) {
                        const pdfPage = await pdfDoc.getPage(pNum);
                        const unscaled = pdfPage.getViewport({ scale: 1.0 });
                        const targetW = 1300;
                        let sc = Math.max(1.0, Math.min(1.5, targetW / unscaled.width));
                        const viewport = pdfPage.getViewport({ scale: sc });
                        const offCanvas = document.createElement("canvas");
                        offCanvas.width = viewport.width;
                        offCanvas.height = viewport.height;
                        const offCtx = offCanvas.getContext("2d");
                        await pdfPage.render({ canvasContext: offCtx, viewport }).promise;
                        rendered.push(offCanvas.toDataURL("image/jpeg", 0.82));
                    }
                    if (rendered.length > 0) pages = rendered;
                }
            } catch (err) {
                console.warn("Could not expand PDF in PDFGenerator:", err);
            }
        }

        // 1. Render each answer sheet page with overlaid annotations
        for (let i = 0; i < pages.length; i++) {
            if (onProgress) {
                const pct = Math.round(35 + ((i + 1) / (pages.length + 1)) * 50);
                onProgress(pct, `Composing page ${i + 1} of ${pages.length} with markings...`);
            }
            if (i > 0) {
                doc.addPage("a4", "portrait");
            }

            const pageAnnotations = annotations.filter(a => (a.pageIndex || 0) === i);
            const compositeDataUrl = await this.renderCompositePage(pages[i], pageAnnotations);

            // A4 is 210 x 297 mm
            doc.addImage(compositeDataUrl, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        }

        if (onProgress) onProgress(88, "Appending official Student Mark Summary scorecard...");

        // Preload co-branding logos for institutional co-branding header
        const [schoolLogoData, appLogoData] = await Promise.all([
            this.loadLogoDataUrl("assets/school_fulllogo.jpg"),
            this.loadLogoDataUrl("assets/fulllogo.png")
        ]);

        // 2. Add Final Student Mark Summary Page
        doc.addPage("a4", "portrait");
        this.renderSummaryPage(doc, evaluation, {
            schoolLogo: schoolLogoData,
            appLogo: appLogoData
        });

        if (onProgress) onProgress(98, "Finalizing and downloading PDF file...");

        // 3. Save or Download
        const sanitizedName = (evaluation.studentName || "Student").replace(/[^a-zA-Z0-9_-]/g, "_");
        const sanitizedExam = (evaluation.examName || "Exam").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `${sanitizedName}_${sanitizedExam}_Corrected.pdf`;

        doc.save(filename);
        return filename;
    }

    /**
     * Cache and convert image asset into Base64 data URL via canvas
     */
    static async loadLogoDataUrl(src) {
        if (!this._logoCache) this._logoCache = {};
        if (this._logoCache[src]) return this._logoCache[src];

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL(src.endsWith(".png") ? "image/png" : "image/jpeg");
                this._logoCache[src] = dataUrl;
                resolve(dataUrl);
            };
            img.onerror = () => {
                console.warn("Failed to load logo asset:", src);
                resolve(null);
            };
            img.src = src;
        });
    }

    /**
     * Renders base image + annotations onto a high-res offscreen canvas
     */
    static async renderCompositePage(imageSrc, annotations) {
        let safeSrc = imageSrc;

        // If remote HTTP/HTTPS Firebase Storage URL, load as local blob URL to avoid canvas taint
        if (typeof safeSrc === "string" && (safeSrc.startsWith("http://") || safeSrc.startsWith("https://"))) {
            try {
                const resp = await fetch(safeSrc, { mode: "cors" });
                if (resp.ok) {
                    const blob = await resp.blob();
                    safeSrc = URL.createObjectURL(blob);
                }
            } catch (fErr) {
                console.warn("PDFGenerator fetch image blob warning:", fErr);
            }
        }

        // If safeSrc is a PDF data URL, render it via PDF.js to image
        if (typeof safeSrc === "string" && safeSrc.startsWith("data:application/pdf") && window.pdfjsLib) {
            try {
                const base64Data = safeSrc.split(",")[1] || safeSrc;
                const raw = atob(base64Data);
                const uint8Array = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) {
                    uint8Array[i] = raw.charCodeAt(i);
                }
                const pdf = await window.pdfjsLib.getDocument({ data: uint8Array }).promise;
                const p = await pdf.getPage(1);
                const vp = p.getViewport({ scale: 1.8 });
                const c = document.createElement("canvas");
                c.width = vp.width;
                c.height = vp.height;
                await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
                safeSrc = c.toDataURL("image/jpeg", 0.92);
            } catch (pErr) {
                console.warn("PDFGenerator pdf render warning:", pErr);
            }
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const w = img.naturalWidth || 1200;
                const h = img.naturalHeight || 1650;
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");

                // Draw base page
                ctx.drawImage(img, 0, 0, w, h);

                // Overlay annotations using static CanvasEngine drawing method
                annotations.forEach(ann => {
                    CanvasEngine.drawAnnotation(ctx, ann, w, h, 1.0);
                });

                // Render Compact Smart Page Total Footer on composite page
                const pageTotal = (window.CanvasEngine && typeof window.CanvasEngine.calculatePageTotal === "function")
                    ? window.CanvasEngine.calculatePageTotal(annotations)
                    : (() => {
                        let total = 0;
                        annotations.forEach(a => {
                            if (a.type === "margin_mark" || a.type === "left_mark") {
                                const val = parseFloat(String(a.marks !== undefined ? a.marks : (a.text || "")).replace(/^\+/, "").trim());
                                if (!isNaN(val)) total += val;
                            } else if (a.type === "tick" || a.type === "marks") {
                                const val = parseFloat(String(a.marks !== undefined && a.marks !== null ? a.marks : (a.text || "")).replace(/^\+/, "").trim());
                                if (!isNaN(val)) total += val;
                            }
                        });
                        return Math.round(total * 10) / 10;
                    })();

                const scale = 1.0;
                const numText = String(pageTotal);
                ctx.font = `400 ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`;
                const textW = ctx.measureText(numText).width;

                const boxW = Math.max(34 * scale, textW + 16 * scale);
                const boxH = 24 * scale;
                const padRight = 16 * scale;
                const padBottom = 14 * scale;
                const x = w - boxW - padRight;
                const y = h - boxH - padBottom;

                ctx.save();
                ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
                ctx.shadowBlur = 4 * scale;
                ctx.shadowOffsetY = 1 * scale;
                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.roundRect(x, y, boxW, boxH, [12 * scale]);
                ctx.fill();

                ctx.shadowColor = "transparent";
                ctx.lineWidth = 1.5 * scale;
                ctx.strokeStyle = "#DC2626"; // Teacher red ink
                ctx.stroke();

                ctx.fillStyle = "#DC2626";
                ctx.font = `400 ${Math.round(13 * scale)}px system-ui, -apple-system, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(numText, x + boxW / 2, y + boxH / 2);
                ctx.restore();

                resolve(canvas.toDataURL("image/jpeg", 0.88));
            };
            img.onerror = () => {
                // Fallback white canvas
                const canvas = document.createElement("canvas");
                canvas.width = 1200;
                canvas.height = 1650;
                resolve(canvas.toDataURL("image/jpeg", 0.8));
            };
            img.src = safeSrc;
        });
    }

    /**
     * Renders the comprehensive Final Summary Page with Co-Branded Institutional Header
     * Strict Regular Typography: 0 Bold Fonts (font-weight: 400 !important;)
     */
    static renderSummaryPage(doc, evaluation, logos = {}) {
        const pageWidth = 210;
        const margin = 14;
        let currentY = 12;

        // 1. Co-Branding Header Banner Container
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, "FD");

        // Top-Left: Client School Branding (school_fulllogo.jpg)
        if (logos.schoolLogo) {
            try {
                doc.addImage(logos.schoolLogo, "JPEG", margin + 3, currentY + 2.5, 46, 15.6);
            } catch (err) {
                console.warn("Could not draw school logo:", err);
            }
        }

        // Top-Right: OneSpace OSM Branding (fulllogo.png)
        if (logos.appLogo) {
            try {
                doc.addImage(logos.appLogo, "PNG", pageWidth - margin - 49, currentY + 3.8, 46, 13.8);
            } catch (err) {
                console.warn("Could not draw OSM logo:", err);
            }
        }

        // Center: Institutional Co-Branding Title
        const instName = evaluation.institutionName || "ADWAITH THOUGHT ACADEMY";
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(instName.toUpperCase(), pageWidth / 2, currentY + 9, { align: "center" });

        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text("SMART ON-SCREEN MARKING (OSM) • EVALUATION SUMMARY", pageWidth / 2, currentY + 16, { align: "center" });

        currentY += 27;

        // Student Info Card
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 38, 3, 3, "FD");

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);

        // Column 1
        doc.setFont("helvetica", "normal");
        doc.text("Student Name:", margin + 6, currentY + 10);
        doc.setFont("helvetica", "normal");
        doc.text(String(evaluation.studentName || "-"), margin + 35, currentY + 10);

        doc.setFont("helvetica", "normal");
        doc.text("Register No:", margin + 6, currentY + 18);
        doc.setFont("helvetica", "normal");
        doc.text(String(evaluation.rollNo || "-"), margin + 35, currentY + 18);

        doc.setFont("helvetica", "normal");
        doc.text("Class / Sec:", margin + 6, currentY + 26);
        doc.setFont("helvetica", "normal");
        doc.text(`${evaluation.class || "-"} (${evaluation.section || "-"})`, margin + 35, currentY + 26);

        // Column 2
        const col2X = margin + 100;
        doc.setFont("helvetica", "normal");
        doc.text("Examination:", col2X, currentY + 10);
        doc.setFont("helvetica", "normal");
        doc.text(String(evaluation.examName || "-"), col2X + 26, currentY + 10);

        doc.setFont("helvetica", "normal");
        doc.text("Subject:", col2X, currentY + 18);
        doc.setFont("helvetica", "normal");
        doc.text(String(evaluation.subject || "-"), col2X + 26, currentY + 18);

        doc.setFont("helvetica", "normal");
        doc.text("Exam Date:", col2X, currentY + 26);
        doc.setFont("helvetica", "normal");
        doc.text(String(evaluation.examDate || "-"), col2X + 26, currentY + 26);

        doc.setFont("helvetica", "normal");
        doc.text("Teacher:", col2X, currentY + 34);
        doc.setFont("helvetica", "normal");
        doc.text(String(evaluation.teacherName || "-"), col2X + 26, currentY + 34);

        currentY += 44;

        // Question Marks Table - Clean format without individual question %
        const questions = evaluation.questions || [];
        const tableBody = questions.map((q, idx) => {
            const max = Number(q.maxMarks) || 0;
            const awarded = Number(q.awardedMarks) || 0;
            const sec = q.section || (q.sectionId ? q.sectionId.replace("sec_", "Section ").toUpperCase() : "Section A");
            let status = "Full Marks";
            if (awarded === 0) status = "0 Marks";
            else if (awarded < max) status = "Partial";

            return [
                `Q${q.qNo !== undefined ? q.qNo : idx + 1}`,
                sec,
                `${max}`,
                `${awarded}`,
                status
            ];
        });

        // Use autoTable
        if (doc.autoTable) {
            doc.autoTable({
                startY: currentY,
                margin: { left: margin, right: margin },
                head: [["Q.No", "Section", "Max Marks", "Marks Obtained", "Status"]],
                body: tableBody,
                theme: "striped",
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontSize: 9.5,
                    fontStyle: "normal",
                    halign: "center"
                },
                columnStyles: {
                    0: { halign: "center", cellWidth: 20 },
                    1: { halign: "center", cellWidth: 32 },
                    2: { halign: "center", cellWidth: 28 },
                    3: { halign: "center", cellWidth: 35, fontStyle: "normal" },
                    4: { halign: "center" }
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 3.5
                }
            });

            currentY = doc.lastAutoTable.finalY + 10;
        }

        // Official Total Score & Grade Banner Card (Total Marks + Grade + Grade Point)
        const gradeInfo = (window.calculateGradeScale 
            ? window.calculateGradeScale(evaluation.obtainedMarks, evaluation.maxMarks)
            : null) || { grade: evaluation.grade || "A1", gradePoint: 10, marksRange: "91 – 100", remarks: "Pass", status: "Pass" };

        doc.setFillColor(240, 253, 244); // #F0FDF4 emerald-50
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, "FD");

        doc.setTextColor(6, 78, 59);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("TOTAL MARKS:", margin + 8, currentY + 11);

        doc.setFontSize(18);
        doc.text(`${evaluation.obtainedMarks !== undefined ? evaluation.obtainedMarks : 0} / ${evaluation.maxMarks || 70}`, margin + 8, currentY + 22);

        doc.setFontSize(12);
        doc.text(`GRADE: ${gradeInfo.grade}`, margin + 75, currentY + 13);
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Grade Point: ${gradeInfo.gradePoint}  (${gradeInfo.marksRange})`, margin + 75, currentY + 22);

        doc.setFontSize(10.5);
        doc.setTextColor(6, 78, 59);
        doc.text(`Result: ${gradeInfo.status}`, margin + 145, currentY + 13);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${gradeInfo.remarks}`, margin + 145, currentY + 22);

        currentY += 36;

        // Feedback / Remarks Box
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        doc.text("Teacher's Overall Feedback & Observations:", margin, currentY);
        currentY += 4;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        const feedbackText = evaluation.feedback && evaluation.feedback.trim().length > 0 
            ? `"${evaluation.feedback}"`
            : "No specific feedback recorded. Good effort.";
        doc.text(feedbackText, margin + 5, currentY + 9, { maxWidth: pageWidth - margin * 2 - 10 });

        currentY += 34;

        // Signature & Date Section
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);

        // Date
        doc.text(`Evaluation Date: ${evaluation.correctionDate || new Date().toISOString().split("T")[0]}`, margin, currentY + 8);
        doc.text("System: Niprak OSM Digital Evaluation Engine v1.0", margin, currentY + 14);

        // Signature line
        const sigX = pageWidth - margin - 60;
        doc.setDrawColor(148, 163, 184);
        doc.line(sigX, currentY + 8, pageWidth - margin, currentY + 8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        doc.text("Evaluator Signature", sigX + 10, currentY + 14);
        doc.setFont("helvetica", "normal");
        doc.text(evaluation.teacherName || "Authorized Evaluator", sigX + 10, currentY + 19);

        // Footer watermarking
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Generated by Niprak OSM Digital Correction - Confirmed & Verified", pageWidth / 2, 288, { align: "center" });
    }
}

window.PDFGenerator = PDFGenerator;
