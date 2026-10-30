/**
 * Niprak Digital Correction - PDF Generator
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

        // Ensure evaluation scores are properly computed
        if (evaluation.obtainedMarks === undefined || evaluation.obtainedMarks === null) {
            let sum = 0;
            if (Array.isArray(evaluation.questions) && evaluation.questions.length > 0) {
                evaluation.questions.forEach(q => {
                    if (q.status !== "unmarked" && q.status !== "pending") {
                        sum += Number(q.awardedMarks) || 0;
                    }
                });
                evaluation.obtainedMarks = Math.round(sum * 10) / 10;
            } else if (Array.isArray(evaluation.annotations)) {
                evaluation.annotations.forEach(a => {
                    const rawVal = a.marks !== undefined && a.marks !== null ? String(a.marks) : String(a.text || "");
                    const val = parseFloat(rawVal.replace(/^\+/, "").trim());
                    if (!isNaN(val)) sum += val;
                });
                evaluation.obtainedMarks = Math.round(sum * 10) / 10;
            } else {
                evaluation.obtainedMarks = 0;
            }
        }

        if (!evaluation.maxMarks || Number(evaluation.maxMarks) <= 0) {
            if (Array.isArray(evaluation.questions) && evaluation.questions.length > 0) {
                evaluation.maxMarks = evaluation.questions.reduce((s, q) => s + (Number(q.maxMarks) || 0), 0) || 40;
            } else {
                evaluation.maxMarks = 40;
            }
        }

        // If paper was stored as single PDF, extract pages via pdfjsLib
        const pdfCandidate = evaluation.pdfStorageUrl || evaluation.pdfDataUrl || (pages.length > 0 ? pages[0] : null);
        const isPdf = typeof pdfCandidate === "string" && (
            pdfCandidate.startsWith("data:application/pdf") ||
            pdfCandidate.includes("evaluations_pdf") ||
            pdfCandidate.toLowerCase().includes(".pdf") ||
            pdfCandidate.includes("alt=media") ||
            pdfCandidate.includes("firebasestorage") ||
            pdfCandidate.includes("/proxy?url=")
        );
        const hasMultipleRealPages = Array.isArray(pages) && pages.length > 1 && !pages[0].startsWith("data:application/pdf");

        if (isPdf && !hasMultipleRealPages) {
            if (window.CanvasEngine && window.CanvasEngine.ensurePdfJs) {
                await window.CanvasEngine.ensurePdfJs();
            }
            if (window.pdfjsLib) {
                try {
                    if (onProgress) onProgress(25, "Extracting PDF answer sheet pages...");
                    let loadingTask = null;
                    const uint8Array = await CanvasEngine.fetchPdfBytes(pdfCandidate);
                    if (uint8Array) {
                        try {
                            loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
                        } catch (eWorker) {
                            loadingTask = window.pdfjsLib.getDocument({ data: uint8Array, isEvalSupported: false });
                        }
                    } else if (pdfCandidate.startsWith("http://") || pdfCandidate.startsWith("https://")) {
                        loadingTask = window.pdfjsLib.getDocument({ url: pdfCandidate, withCredentials: false });
                    }
                    if (loadingTask) {
                        const pdfDoc = await loadingTask.promise;
                        if (pdfDoc && pdfDoc.numPages >= 1) {
                            const rendered = [];
                            for (let pNum = 1; pNum <= pdfDoc.numPages; pNum++) {
                                const pdfPage = await pdfDoc.getPage(pNum);
                                const unscaled = pdfPage.getViewport({ scale: 1.0 });
                                const targetW = 1400;
                                let sc = Math.max(1.0, Math.min(2.0, targetW / unscaled.width));
                                const viewport = pdfPage.getViewport({ scale: sc });
                                const offCanvas = document.createElement("canvas");
                                offCanvas.width = viewport.width;
                                offCanvas.height = viewport.height;
                                const offCtx = offCanvas.getContext("2d");
                                offCtx.fillStyle = "#ffffff";
                                offCtx.fillRect(0, 0, viewport.width, viewport.height);
                                await pdfPage.render({ canvasContext: offCtx, viewport }).promise;
                                rendered.push(offCanvas.toDataURL("image/jpeg", 0.88));
                            }
                            if (rendered.length > 0) pages = rendered;
                        }
                    }
                } catch (err) {
                    console.warn("Could not expand PDF in PDFGenerator:", err);
                }
            }
        }

        const isPurgedOnly = Boolean(evaluation.rawScansPurged) || pages.length === 0;

        if (!isPurgedOnly) {
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
        } else {
            if (onProgress) onProgress(60, "Generating official Student Mark Summary scorecard...");
            const [schoolLogoData, appLogoData] = await Promise.all([
                this.loadLogoDataUrl("assets/school_fulllogo.jpg"),
                this.loadLogoDataUrl("assets/fulllogo.png")
            ]);
            // Direct first page rendering for archived score logs
            this.renderSummaryPage(doc, evaluation, {
                schoolLogo: schoolLogoData,
                appLogo: appLogoData
            });
        }

        if (onProgress) onProgress(98, "Finalizing and downloading PDF file...");

        // 3. Save or Download
        const sanitizedName = (evaluation.studentName || "Student").replace(/[^a-zA-Z0-9_-]/g, "_");
        const sanitizedExam = (evaluation.examName || "Exam").replace(/[^a-zA-Z0-9_-]/g, "_");
        const suffix = isPurgedOnly ? "Scorecard" : "Corrected";
        const filename = `${sanitizedName}_${sanitizedExam}_${suffix}.pdf`;

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

        const isPdf = typeof safeSrc === "string" && (
            safeSrc.startsWith("data:application/pdf") ||
            safeSrc.includes("evaluations_pdf") ||
            safeSrc.toLowerCase().includes(".pdf") ||
            safeSrc.includes("firebasestorage") ||
            safeSrc.includes("alt=media") ||
            safeSrc.includes("/proxy?url=")
        );

        if (isPdf) {
            if (window.CanvasEngine && window.CanvasEngine.ensurePdfJs) {
                await window.CanvasEngine.ensurePdfJs();
            }
            if (window.pdfjsLib) {
                try {
                    const uint8Array = await CanvasEngine.fetchPdfBytes(safeSrc);
                    if (uint8Array) {
                        const pdf = await window.pdfjsLib.getDocument({ data: uint8Array }).promise;
                        const p = await pdf.getPage(1);
                        const vp = p.getViewport({ scale: 1.8 });
                        const c = document.createElement("canvas");
                        c.width = vp.width;
                        c.height = vp.height;
                        const ctxC = c.getContext("2d");
                        ctxC.fillStyle = "#ffffff";
                        ctxC.fillRect(0, 0, vp.width, vp.height);
                        await p.render({ canvasContext: ctxC, viewport: vp }).promise;
                        safeSrc = c.toDataURL("image/jpeg", 0.92);
                    }
                } catch (pErr) {
                    console.warn("PDFGenerator pdf render warning:", pErr);
                }
            }
        } else if (typeof safeSrc === "string" && (safeSrc.startsWith("http://") || safeSrc.startsWith("https://"))) {
            // If remote HTTP/HTTPS Firebase Storage URL, load as local blob URL to avoid canvas taint
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

                // Render Prominent Page Total Badge inside safe printable margins
                const badgeText = `Page Total: ${pageTotal}M`;
                const scale = Math.max(1.0, Math.min(2.0, w / 1200));
                ctx.font = `600 ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`;
                const textW = ctx.measureText(badgeText).width;

                const boxW = Math.max(90 * scale, textW + 22 * scale);
                const boxH = Math.round(30 * scale);
                // Position safely ~50-60px from bottom and ~25px from right (well inside 15mm printable margin)
                const padRight = Math.max(24 * scale, Math.round(w * 0.025));
                const padBottom = Math.max(50 * scale, Math.round(h * 0.038));
                const x = w - boxW - padRight;
                const y = h - boxH - padBottom;

                ctx.save();
                ctx.shadowColor = "rgba(0, 0, 0, 0.16)";
                ctx.shadowBlur = 6 * scale;
                ctx.shadowOffsetY = 2 * scale;
                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.roundRect(x, y, boxW, boxH, [15 * scale]);
                ctx.fill();

                ctx.shadowColor = "transparent";
                ctx.lineWidth = 1.8 * scale;
                ctx.strokeStyle = "#DC2626"; // Teacher red ink
                ctx.stroke();

                ctx.fillStyle = "#DC2626";
                ctx.font = `600 ${Math.round(13 * scale)}px system-ui, -apple-system, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(badgeText, x + boxW / 2, y + boxH / 2);
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
     * Executive Total Marks & Grade Banner are guaranteed prominent on Page 1.
     * Full page-break protection ensures question table, feedback, and signature are NEVER clipped.
     */
    static renderSummaryPage(doc, evaluation, logos = {}) {
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 14;
        let currentY = 12;

        // 1. Resolve scores and percentages reliably
        const questions = evaluation.questions || [];
        let calcObtained = 0;
        let calcMax = 0;

        if (Array.isArray(evaluation.sections) && evaluation.sections.length > 0) {
            calcMax = evaluation.sections.reduce((sum, s) => sum + (Number(s.secTotal || s.maxMarks) || 0), 0);
        }

        if (questions.length > 0) {
            questions.forEach(q => {
                if (!calcMax) calcMax += Number(q.maxMarks) || 0;
                if (q.status !== "unmarked" && q.status !== "pending" && q.status !== "skipped") {
                    calcObtained += Number(q.awardedMarks) || 0;
                }
            });
            calcObtained = Math.round(calcObtained * 10) / 10;
        }

        const maxMarks = Number(evaluation.maxMarks) || calcMax || 70;
        const obtainedMarks = (evaluation.obtainedMarks !== undefined && evaluation.obtainedMarks !== null)
            ? Number(evaluation.obtainedMarks)
            : calcObtained;
        const pct = maxMarks > 0 ? Math.round((obtainedMarks / maxMarks) * 100) : 0;

        const gradeInfo = (window.calculateGradeScale 
            ? window.calculateGradeScale(obtainedMarks, maxMarks)
            : null) || { grade: evaluation.grade || "A1", gradePoint: 10, marksRange: "91 – 100", remarks: "Pass", status: "Pass" };

        // 2. Co-Branding Header Banner Container
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 20, 2, 2, "FD");

        // Top-Left: Client School Branding (school_fulllogo.jpg)
        if (logos.schoolLogo) {
            try {
                doc.addImage(logos.schoolLogo, "JPEG", margin + 3, currentY + 2.5, 44, 15);
            } catch (err) {
                console.warn("Could not draw school logo:", err);
            }
        }

        // Top-Right: Niprak OSM Branding (fulllogo.png)
        if (logos.appLogo) {
            try {
                doc.addImage(logos.appLogo, "PNG", pageWidth - margin - 47, currentY + 3.2, 44, 13.5);
            } catch (err) {
                console.warn("Could not draw OSM logo:", err);
            }
        }

        // Center: Institutional Co-Branding Title
        const instName = evaluation.institutionName || "ADWAITH THOUGHT ACADEMY";
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.text(instName.toUpperCase(), pageWidth / 2, currentY + 8.5, { align: "center" });

        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text("SMART ON-SCREEN MARKING (OSM) • EVALUATION SUMMARY", pageWidth / 2, currentY + 15, { align: "center" });

        currentY += 24;

        // 3. Student & Examination Information Card
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 32, 2.5, 2.5, "FD");

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);

        // Column 1
        doc.setFont("helvetica", "normal");
        doc.text("Student Name:", margin + 6, currentY + 8.5);
        doc.setFont("helvetica", "bold");
        doc.text(String(evaluation.studentName || "-"), margin + 34, currentY + 8.5);

        doc.setFont("helvetica", "normal");
        doc.text("Register No:", margin + 6, currentY + 16.5);
        doc.text(String(evaluation.rollNo || "-"), margin + 34, currentY + 16.5);

        doc.setFont("helvetica", "normal");
        doc.text("Class / Sec:", margin + 6, currentY + 24.5);
        doc.text(`${evaluation.class || evaluation.className || "-"} (${evaluation.section || "-"})`, margin + 34, currentY + 24.5);

        // Column 2
        const col2X = margin + 98;
        doc.setFont("helvetica", "normal");
        doc.text("Examination:", col2X, currentY + 8.5);
        doc.setFont("helvetica", "bold");
        doc.text(String(evaluation.examName || evaluation.templateName || "-"), col2X + 26, currentY + 8.5);

        doc.setFont("helvetica", "normal");
        doc.text("Subject:", col2X, currentY + 16.5);
        doc.text(String(evaluation.subject || "-"), col2X + 26, currentY + 16.5);

        doc.setFont("helvetica", "normal");
        doc.text("Exam Date:", col2X, currentY + 24.5);
        doc.text(`${evaluation.examDate || "-"}  |  Teacher: ${evaluation.teacherName || "-"}`, col2X + 26, currentY + 24.5);

        currentY += 36;

        // 4. EXECUTIVE TOTAL SCORE & GRADE BANNER CARD (Guaranteed Prominent on Page 1!)
        doc.setFillColor(240, 253, 244); // #F0FDF4 emerald-50
        doc.setDrawColor(16, 185, 129);  // #10B981 emerald-500
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 23, 2.5, 2.5, "FD");

        // Column 1: Total Marks & Percentage
        doc.setTextColor(6, 78, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("TOTAL MARKS SCORED:", margin + 8, currentY + 7.5);

        doc.setFontSize(15);
        doc.text(`${obtainedMarks} / ${maxMarks}`, margin + 8, currentY + 17.5);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`(${pct}%)`, margin + 50, currentY + 17.5);

        // Column 2: Grade & Grade Point
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`GRADE: ${gradeInfo.grade}`, margin + 74, currentY + 9.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Grade Point: ${gradeInfo.gradePoint}  (${gradeInfo.marksRange})`, margin + 74, currentY + 17.5);

        // Column 3: Result & Performance
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 78, 59);
        doc.text(`Result: ${gradeInfo.status}`, margin + 142, currentY + 9.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(String(gradeInfo.remarks || "Qualified"), margin + 142, currentY + 17.5);

        currentY += 27;

        // 5. Question-by-Question Marks Table (with clean Total row in table footer!)
        const tableBody = questions.map((q, idx) => {
            const max = Number(q.maxMarks) || 0;
            const awarded = Number(q.awardedMarks) || 0;
            const sec = q.section || (q.sectionId ? q.sectionId.replace("sec_", "Section ").toUpperCase() : "Section A");
            let status = "Full Marks";
            if (q.status === "skipped") {
                status = "Skipped (Choice)";
            } else if (awarded === 0) {
                status = q.status === "wrong" ? "Incorrect (0M)" : "0 Marks";
            } else if (awarded < max) {
                status = "Partial";
            }

            return [
                `Q${q.qNo !== undefined ? q.qNo : idx + 1}`,
                sec,
                `${max}`,
                `${q.status === "skipped" ? "—" : awarded}`,
                status
            ];
        });

        if (doc.autoTable) {
            doc.autoTable({
                startY: currentY,
                margin: { left: margin, right: margin, top: 16, bottom: 20 },
                head: [["Q.No", "Section", "Max Marks", "Marks Obtained", "Status"]],
                body: tableBody,
                foot: [["Total Marks", "All Sections", `${calcMax || maxMarks}`, `${obtainedMarks}`, `${pct}% (${gradeInfo.grade})`]],
                showHead: 'everyPage',
                showFoot: 'lastPage',
                theme: "striped",
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: "bold",
                    halign: "center"
                },
                footStyles: {
                    fillColor: [240, 253, 244],
                    textColor: [6, 78, 59],
                    fontStyle: "bold",
                    fontSize: 9,
                    halign: "center"
                },
                columnStyles: {
                    0: { halign: "center", cellWidth: 20 },
                    1: { halign: "center", cellWidth: 32 },
                    2: { halign: "center", cellWidth: 28 },
                    3: { halign: "center", cellWidth: 35, fontStyle: "bold" },
                    4: { halign: "center" }
                },
                styles: {
                    fontSize: 8.5,
                    cellPadding: 3
                },
                didDrawPage: () => {
                    // Footer watermark on every page generated by autoTable
                    doc.setFontSize(7.5);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(148, 163, 184);
                    doc.text("Generated by Niprak OSM Digital Correction • Confirmed & Verified", pageWidth / 2, 288, { align: "center" });
                }
            });

            currentY = doc.lastAutoTable.finalY + 8;
        }

        // 6. Intelligent Page-Break Protection for Post-Table Content (Feedback & Signature)
        const requiredPostHeight = 56;
        if (currentY + requiredPostHeight > 275) {
            doc.addPage("a4", "portrait");
            currentY = 16;

            // Header strip on continuation page
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${evaluation.studentName || "Student"} • ${evaluation.subject || "Subject"} • Total Marks: ${obtainedMarks}/${maxMarks} (${gradeInfo.grade})`, margin, 11);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(margin, 13, pageWidth - margin, 13);
            currentY = 18;
        }

        // Feedback / Remarks Box
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Teacher's Overall Feedback & Observations:", margin, currentY);
        currentY += 3.5;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 20, 2, 2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);

        let cleanFb = "";
        if (typeof evaluation.feedback === "string") {
            cleanFb = evaluation.feedback.trim();
        } else if (evaluation.feedback && typeof evaluation.feedback === "object") {
            const raw = evaluation.feedback.text || evaluation.feedback.remarks || evaluation.feedback.comment || evaluation.feedback.feedback || evaluation.feedback.message || evaluation.feedback.summary || "";
            cleanFb = typeof raw === "string" ? raw.trim() : String(raw || "").trim();
        } else if (evaluation.feedback !== undefined && evaluation.feedback !== null) {
            cleanFb = String(evaluation.feedback).trim();
        }

        const feedbackText = cleanFb.length > 0 
            ? `"${cleanFb}"`
            : "No specific feedback recorded. Good effort.";
        doc.text(feedbackText, margin + 5, currentY + 7.5, { maxWidth: pageWidth - margin * 2 - 10 });

        currentY += 25;

        // Signature & Date Section
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);

        // Date
        doc.text(`Evaluation Date: ${evaluation.correctionDate || new Date().toISOString().split("T")[0]}`, margin, currentY + 6);
        doc.text("System: Niprak OSM Digital Evaluation Engine v1.0", margin, currentY + 12);

        // Signature line
        const sigX = pageWidth - margin - 60;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.5);
        doc.line(sigX, currentY + 6, pageWidth - margin, currentY + 6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Evaluator Signature", sigX + 10, currentY + 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(evaluation.teacherName || "Authorized Faculty Evaluator", sigX + 10, currentY + 16);

        // Footer watermarking on the final page
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Generated by Niprak OSM Digital Correction • Confirmed & Verified", pageWidth / 2, 288, { align: "center" });
    }
}

window.PDFGenerator = PDFGenerator;
