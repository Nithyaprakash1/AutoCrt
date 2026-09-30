/**
 * OneSpace Digital Correction - Canvas Annotation Engine
 * Handles high-DPI multi-page paper rendering, relative coordinate projection,
 * vector tools (Select, Tick, Wrong, Circle, Underline, Highlight, Comment, Eraser, Pen, Arrow, Marks),
 * hold-and-drag repositioning, 4-corner resize handles, floating Apple inspector,
 * and full Undo/Redo history.
 */

class CanvasEngine {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = Object.assign({
            onAnnotationsChange: null,
            onPageChange: null,
            onRadialMarkAwarded: null,
            getActiveQuestionInfo: null
        }, options);

        // Core state - Strict Teacher Red Ink for Ticks & Correction
        this.pages = []; // Array of { imageSrc, imgObj, origWidth, origHeight, annotations: [], undoStack: [], redoStack: [] }
        this.currentPageIndex = 0;
        this.currentTool = "tick"; // select, tick, wrong, circle, underline, highlight, comment, eraser, pen, arrow, marks
        this.currentColor = "#DC2626"; // Default Teacher Red Ink
        this.strokeWidth = 3;
        this.zoom = 1.0; // 100%
        this.activeMarksValue = "+1";

        // Drawing & manipulation state
        this.isDrawing = false;
        this.drawStartPoint = null;
        this.currentStrokePoints = []; // for pen

        // Selection & Interactive Manipulation state
        this.selectedAnnotation = null;
        this.selectedAnnotations = []; // Multi-selection array for marquee drag
        this.isMarqueeSelecting = false;
        this.marqueeStartPixel = null;
        this.marqueeStartNorm = null;
        this.marqueeBoxEl = null;

        this.isDraggingAnnotation = false;
        this.isResizingAnnotation = false;
        this.activeResizeHandle = null;
        this.dragStartNorm = null;
        this.dragStartPixelPos = null;
        this.dragInitialState = null;
        this.origScale = 1.0;

        // Radial wheel DOM references
        this.radialWheelContainer = null;
        this.radialBackdrop = null;

        // Create canvas elements
        this.setupDOM();
        this.bindEvents();
    }

    setupDOM() {
        this.container.innerHTML = "";
        this.container.style.position = "relative";
        this.container.style.overflow = "auto";
        this.container.style.display = "flex";
        this.container.style.justifyContent = "center";
        this.container.style.alignItems = "flex-start";
        this.container.style.backgroundColor = "#E2E8F0";

        this.wrapper = document.createElement("div");
        this.wrapper.className = "canvas-stage-wrapper";
        this.wrapper.style.position = "relative";
        this.wrapper.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)";
        this.wrapper.style.margin = "20px auto";
        this.wrapper.style.backgroundColor = "#FFFFFF";
        this.wrapper.style.transition = "width 0.15s ease, height 0.15s ease";

        // Base image canvas (paper page)
        this.baseCanvas = document.createElement("canvas");
        this.baseCanvas.className = "paper-base-canvas";
        this.baseCanvas.style.display = "block";
        this.baseCanvas.style.position = "absolute";
        this.baseCanvas.style.top = "0";
        this.baseCanvas.style.left = "0";
        this.baseCtx = this.baseCanvas.getContext("2d");

        // Overlay annotation canvas
        this.overlayCanvas = document.createElement("canvas");
        this.overlayCanvas.className = "paper-annotation-canvas";
        this.overlayCanvas.style.display = "block";
        this.overlayCanvas.style.position = "absolute";
        this.overlayCanvas.style.top = "0";
        this.overlayCanvas.style.left = "0";
        this.overlayCanvas.style.cursor = "crosshair";
        this.overlayCtx = this.overlayCanvas.getContext("2d");

        // Selection layer container (holds bounding box, handles, and floating inspector)
        this.selectionLayer = document.createElement("div");
        this.selectionLayer.className = "canvas-selection-layer";
        this.selectionLayer.style.position = "absolute";
        this.selectionLayer.style.top = "0";
        this.selectionLayer.style.left = "0";
        this.selectionLayer.style.width = "100%";
        this.selectionLayer.style.height = "100%";
        this.selectionLayer.style.pointerEvents = "none";
        this.selectionLayer.style.zIndex = "25";

        this.wrapper.appendChild(this.baseCanvas);
        this.wrapper.appendChild(this.overlayCanvas);
        this.wrapper.appendChild(this.selectionLayer);
        this.container.appendChild(this.wrapper);
    }

    static generateDefaultLinedPageDataUrl(titleText = "Student Answer Sheet", rollNo = "101") {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 1650;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 1200, 1650);

        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(0, 0, 1200, 140);
        ctx.strokeStyle = "#CBD5E1";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 1200, 140);

        ctx.fillStyle = "#0F172A";
        ctx.font = "400 24px system-ui, -apple-system, sans-serif";
        ctx.fillText(`${titleText} (Roll: ${rollNo})`, 40, 55);

        ctx.fillStyle = "#64748B";
        ctx.font = "400 16px system-ui, -apple-system, sans-serif";
        ctx.fillText("Niprak OSM Platform • Official Physics Examination Answer Sheet", 40, 95);

        ctx.strokeStyle = "rgba(220, 38, 38, 0.4)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(140, 140);
        ctx.lineTo(140, 1650);
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 122, 255, 0.12)";
        ctx.lineWidth = 1;
        for (let y = 190; y < 1620; y += 44) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1200, y);
            ctx.stroke();
        }

        return canvas.toDataURL("image/jpeg", 0.92);
    }

    /**
     * Universally fetch PDF bytes from Base64 Data URL, Direct Fetch (native CORS), or Local Proxy
     */
    static async fetchPdfBytes(url) {
        if (!url || typeof url !== "string") return null;

        // 1. Base64 Data URL
        if (url.startsWith("data:")) {
            try {
                const base64Data = url.split(",")[1] || url;
                const raw = atob(base64Data);
                const uint8Array = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) {
                    uint8Array[i] = raw.charCodeAt(i);
                }
                return uint8Array;
            } catch (e) {
                console.warn("Error decoding Base64 PDF:", e);
                return null;
            }
        }

        // 2. HTTP/HTTPS URL:
        // Priority 1: Direct Fetch (works natively across all origins with bucket CORS configured)
        // Priority 2: Local Node proxy if available
        const candidates = [url];

        const isLocalHost = typeof window !== "undefined" && window.location && (
            window.location.hostname === "127.0.0.1" || 
            window.location.hostname === "localhost" ||
            window.location.port === "8000"
        );
        if (isLocalHost) {
            candidates.push(`/proxy?url=${encodeURIComponent(url)}`);
        }

        for (const targetUrl of candidates) {
            try {
                const resp = await fetch(targetUrl);
                if (resp.ok) {
                    const buf = await resp.arrayBuffer();
                    if (buf && buf.byteLength > 100) {
                        const uint8 = new Uint8Array(buf);
                        // Validate PDF signature: %PDF (0x25, 0x50, 0x44, 0x46)
                        if (uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46) {
                            return uint8;
                        } else {
                            console.warn("Fetched response was not a valid PDF binary (%PDF signature missing) from", targetUrl);
                        }
                    }
                }
            } catch (err) {
                // Try next candidate
            }
        }

        return null;
    }

    async setPages(pageImages, savedAnnotations = []) {
        let expandedPages = Array.isArray(pageImages) ? [...pageImages] : [];
        this.pdfDoc = null;

        // Check if pages contains a PDF (either Base64 or Firebase Storage / HTTP URL)
        const firstPage = expandedPages.length > 0 ? expandedPages[0] : null;
        const isPdf = typeof firstPage === "string" && (
            firstPage.startsWith("data:application/pdf") ||
            firstPage.includes("evaluations_pdf") ||
            firstPage.toLowerCase().includes(".pdf") ||
            firstPage.includes("alt=media") ||
            firstPage.includes("firebasestorage")
        );

        if (isPdf && window.pdfjsLib) {
            try {
                const uint8Array = await CanvasEngine.fetchPdfBytes(firstPage);
                if (uint8Array) {
                    const loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
                    this.pdfDoc = await loadingTask.promise;
                }
            } catch (e) {
                console.warn("Could not load PDF document via bytes in setPages:", e);
            }

            // Direct URL streaming fallback in case fetchPdfBytes failed or was intercepted
            if (!this.pdfDoc && typeof firstPage === "string" && (firstPage.startsWith("http://") || firstPage.startsWith("https://"))) {
                try {
                    const loadingTask = window.pdfjsLib.getDocument({ url: firstPage, withCredentials: false });
                    this.pdfDoc = await loadingTask.promise;
                } catch (urlErr) {
                    console.warn("Direct URL streaming with pdfjsLib failed:", urlErr);
                }
            }
        }

        // Build pages array:
        if (this.pdfDoc && this.pdfDoc.numPages >= 1) {
            const numPages = this.pdfDoc.numPages;
            this.pages = [];
            for (let i = 0; i < numPages; i++) {
                const pageAnn = savedAnnotations.filter(a => a.pageIndex === i);
                this.pages.push({
                    pageIndex: i,
                    pdfPageNum: i + 1,
                    imageSrc: null,
                    imgObj: null,
                    origWidth: 1200,
                    origHeight: 1650,
                    isLoaded: false,
                    annotations: JSON.parse(JSON.stringify(pageAnn)),
                    undoStack: [],
                    redoStack: []
                });
            }
        } else {
            if (!expandedPages || expandedPages.length === 0) {
                expandedPages = [CanvasEngine.generateDefaultLinedPageDataUrl()];
            }
            this.pages = expandedPages.map((src, idx) => {
                const pageAnn = savedAnnotations.filter(a => a.pageIndex === idx);
                return {
                    pageIndex: idx,
                    pdfPageNum: null,
                    imageSrc: src,
                    imgObj: null,
                    origWidth: 1200,
                    origHeight: 1650,
                    isLoaded: false,
                    annotations: JSON.parse(JSON.stringify(pageAnn)),
                    undoStack: [],
                    redoStack: []
                };
            });
        }

        this.currentPageIndex = 0;
        this.deselectAnnotation();
        await this.loadCurrentPage();
    }

    async loadCurrentPage() {
        if (!this.pages || this.pages.length === 0) return;
        const page = this.pages[this.currentPageIndex];

        if (!page.imgObj) {
            // Case 1: Render on-demand directly from loaded this.pdfDoc
            if (this.pdfDoc && page.pdfPageNum) {
                try {
                    const pdfPage = await this.pdfDoc.getPage(page.pdfPageNum);
                    const viewport = pdfPage.getViewport({ scale: 1.8 });
                    const offCanvas = document.createElement("canvas");
                    offCanvas.width = viewport.width;
                    offCanvas.height = viewport.height;
                    const offCtx = offCanvas.getContext("2d");
                    await pdfPage.render({ canvasContext: offCtx, viewport }).promise;

                    await new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            page.imgObj = img;
                            page.origWidth = img.naturalWidth || viewport.width;
                            page.origHeight = img.naturalHeight || viewport.height;
                            page.isLoaded = true;
                            resolve();
                        };
                        img.onerror = () => {
                            page.origWidth = viewport.width;
                            page.origHeight = viewport.height;
                            page.isLoaded = true;
                            resolve();
                        };
                        img.src = offCanvas.toDataURL("image/jpeg", 0.90);
                    });
                } catch (renderErr) {
                    console.warn(`Error rendering PDF page ${page.pdfPageNum}:`, renderErr);
                }
            }

            // Case 2: Render from imageSrc if still not loaded
            if (!page.imgObj && page.imageSrc) {
                let srcToLoad = page.imageSrc;

                // Handle PDF Data URL or Remote PDF URL fallback
                const isItemPdf = typeof srcToLoad === "string" && (
                    srcToLoad.startsWith("data:application/pdf") ||
                    srcToLoad.includes("evaluations_pdf") ||
                    srcToLoad.toLowerCase().includes(".pdf") ||
                    srcToLoad.includes("firebasestorage")
                );

                if (isItemPdf && window.pdfjsLib) {
                    try {
                        const uint8Array = await CanvasEngine.fetchPdfBytes(srcToLoad);
                        if (uint8Array) {
                            const loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
                            const pdfDoc = await loadingTask.promise;
                            const pdfPage = await pdfDoc.getPage(page.pdfPageNum || 1);
                            const viewport = pdfPage.getViewport({ scale: 1.8 });
                            const offCanvas = document.createElement("canvas");
                            offCanvas.width = viewport.width;
                            offCanvas.height = viewport.height;
                            const offCtx = offCanvas.getContext("2d");
                            await pdfPage.render({ canvasContext: offCtx, viewport }).promise;
                            srcToLoad = offCanvas.toDataURL("image/jpeg", 0.90);
                        }
                    } catch (pdfErr) {
                        console.warn("Could not load PDF page via fetchPdfBytes:", pdfErr);
                        srcToLoad = CanvasEngine.generateDefaultLinedPageDataUrl();
                    }
                }

                // If remote HTTP/HTTPS image URL
                if (typeof srcToLoad === "string" && (srcToLoad.startsWith("http://") || srcToLoad.startsWith("https://"))) {
                    try {
                        const resp = await fetch(srcToLoad, { mode: "cors" });
                        if (resp.ok) {
                            const blob = await resp.blob();
                            srcToLoad = URL.createObjectURL(blob);
                        }
                    } catch (corsErr) {}
                }

                const img = new Image();
                img.crossOrigin = "anonymous";
                await new Promise((resolve) => {
                    img.onload = () => {
                        page.imgObj = img;
                        page.origWidth = img.naturalWidth || 1200;
                        page.origHeight = img.naturalHeight || 1650;
                        page.isLoaded = true;
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn("Failed to load page image, generating default lined page:", srcToLoad);
                        const fbData = CanvasEngine.generateDefaultLinedPageDataUrl();
                        const fbImg = new Image();
                        fbImg.onload = () => {
                            page.imgObj = fbImg;
                            page.origWidth = fbImg.naturalWidth || 1200;
                            page.origHeight = fbImg.naturalHeight || 1650;
                            page.isLoaded = true;
                            resolve();
                        };
                        fbImg.onerror = () => {
                            page.origWidth = 1200;
                            page.origHeight = 1650;
                            page.isLoaded = true;
                            resolve();
                        };
                        fbImg.src = fbData;
                    };
                    img.src = srcToLoad;
                });
            }

            // Fallback: If still no image, generate lined page
            if (!page.imgObj) {
                const fbData = CanvasEngine.generateDefaultLinedPageDataUrl();
                const fbImg = new Image();
                await new Promise((resolve) => {
                    fbImg.onload = () => {
                        page.imgObj = fbImg;
                        page.origWidth = fbImg.naturalWidth || 1200;
                        page.origHeight = fbImg.naturalHeight || 1650;
                        page.isLoaded = true;
                        resolve();
                    };
                    fbImg.src = fbData;
                });
            }
        }

        this.updateCanvasDimensions();
        this.renderAll();

        if (this.options.onPageChange) {
            this.options.onPageChange(this.currentPageIndex, this.pages.length);
        }
    }

    updateCanvasDimensions() {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const displayWidth = Math.round(page.origWidth * this.zoom);
        const displayHeight = Math.round(page.origHeight * this.zoom);

        this.wrapper.style.width = `${displayWidth}px`;
        this.wrapper.style.height = `${displayHeight}px`;

        const dpr = window.devicePixelRatio || 1;

        // Base canvas
        this.baseCanvas.width = displayWidth * dpr;
        this.baseCanvas.height = displayHeight * dpr;
        this.baseCanvas.style.width = `${displayWidth}px`;
        this.baseCanvas.style.height = `${displayHeight}px`;
        this.baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Overlay canvas
        this.overlayCanvas.width = displayWidth * dpr;
        this.overlayCanvas.height = displayHeight * dpr;
        this.overlayCanvas.style.width = `${displayWidth}px`;
        this.overlayCanvas.style.height = `${displayHeight}px`;
        this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.updateSelectionOverlay();
    }

    setZoom(newZoom) {
        this.zoom = Math.max(0.25, Math.min(3.0, newZoom));
        this.updateCanvasDimensions();
        this.renderAll();
    }

    zoomIn() {
        this.setZoom(this.zoom + 0.15);
    }

    zoomOut() {
        this.setZoom(this.zoom - 0.15);
    }

    fitToWidth() {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;
        const availableWidth = this.container.clientWidth - 60;
        if (availableWidth > 200) {
            this.setZoom(availableWidth / page.origWidth);
        }
    }

    fitToPage() {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;
        const availableWidth = this.container.clientWidth - 60;
        const availableHeight = this.container.clientHeight - 60;
        const zoomW = availableWidth / page.origWidth;
        const zoomH = availableHeight / page.origHeight;
        this.setZoom(Math.min(zoomW, zoomH, 1.2));
    }

    async goToPage(index) {
        if (index >= 0 && index < this.pages.length) {
            this.deselectAnnotation();
            this.currentPageIndex = index;
            await this.loadCurrentPage();
        }
    }

    async nextPage() {
        if (this.currentPageIndex < this.pages.length - 1) {
            await this.goToPage(this.currentPageIndex + 1);
        }
    }

    async prevPage() {
        if (this.currentPageIndex > 0) {
            await this.goToPage(this.currentPageIndex - 1);
        }
    }

    setTool(toolName, color = null) {
        this.currentTool = toolName;
        if (color) {
            this.currentColor = color;
        } else {
            // Sensible defaults per tool - Strict Teacher Red Ink for Tick, Wrong, and Marks
            if (toolName === "tick") this.currentColor = "#DC2626"; // Teacher Red Ink
            else if (toolName === "wrong") this.currentColor = "#DC2626"; // Teacher Red Ink
            else if (toolName === "circle") this.currentColor = "#059669";
            else if (toolName === "highlight") this.currentColor = "#FFCC00"; // Apple yellow
            else if (toolName === "comment") this.currentColor = "#007AFF"; // Apple blue
            else if (toolName === "underline") this.currentColor = "#DC2626";
            else if (toolName === "arrow") this.currentColor = "#FF9500"; // Apple orange
            else if (toolName === "pen") this.currentColor = "#DC2626";
            else if (toolName === "marks") this.currentColor = "#DC2626";
        }

        // Set cursor
        if (toolName === "select") {
            this.overlayCanvas.style.cursor = "default";
        } else if (toolName === "eraser") {
            this.overlayCanvas.style.cursor = "pointer";
        } else if (toolName === "pen") {
            this.overlayCanvas.style.cursor = "crosshair";
        } else {
            this.overlayCanvas.style.cursor = "crosshair";
        }

        if (toolName !== "select") {
            // Don't necessarily deselect, but keep selection active unless clicking elsewhere
        }
    }

    setMarksValue(val) {
        this.activeMarksValue = val;
    }

    // --- Annotation Selection, Bounding Box & Floating Inspector ---

    getAnnotationBounds(ann) {
        const page = this.pages[this.currentPageIndex];
        if (!page) return null;
        const w = page.origWidth;
        const h = page.origHeight;
        const scale = ann.scale || 1.0;

        let minX, minY, maxX, maxY;

        switch (ann.type) {
            case "tick":
            case "wrong": {
                const hasBadge = ann.marks !== undefined && ann.marks !== null && ann.marks !== "";
                const extraW = hasBadge ? (70 * scale) / w : 0;
                const halfW = (24 * scale) / w;
                const halfH = (24 * scale) / h;
                minX = ann.x - halfW;
                maxX = ann.x + halfW + extraW;
                minY = ann.y - halfH;
                maxY = ann.y + halfH;
                break;
            }

            case "circle":
                minX = ann.x;
                minY = ann.y;
                maxX = ann.x + (ann.width || 0.08) * scale;
                maxY = ann.y + (ann.height || 0.06) * scale;
                break;

            case "underline":
                const uStartX = ann.startX !== undefined ? ann.startX : ann.x;
                const uStartY = ann.startY !== undefined ? ann.startY : ann.y;
                const uEndX = ann.endX !== undefined ? ann.endX : ann.x + (ann.width || 0.1) * scale;
                const uEndY = ann.endY !== undefined ? ann.endY : ann.y;
                minX = Math.min(uStartX, uEndX);
                maxX = Math.max(uStartX, uEndX);
                minY = Math.min(uStartY, uEndY) - (14 / h);
                maxY = Math.max(uStartY, uEndY) + (14 / h);
                break;

            case "highlight":
                minX = ann.x;
                minY = ann.y;
                maxX = ann.x + (ann.width || 0.1) * scale;
                maxY = ann.y + (ann.height || 0.04) * scale;
                break;

            case "arrow":
                const aStartX = ann.startX !== undefined ? ann.startX : ann.x;
                const aStartY = ann.startY !== undefined ? ann.startY : ann.y;
                const aEndX = ann.endX !== undefined ? ann.endX : ann.x + 0.08 * scale;
                const aEndY = ann.endY !== undefined ? ann.endY : ann.y + 0.05 * scale;
                minX = Math.min(aStartX, aEndX) - (12 / w);
                maxX = Math.max(aStartX, aEndX) + (12 / w);
                minY = Math.min(aStartY, aEndY) - (12 / h);
                maxY = Math.max(aStartY, aEndY) + (12 / h);
                break;

            case "comment":
                const textLen = (ann.text || "Note").length;
                const estW = ((textLen * 9 + 40) * scale) / w;
                const estH = (32 * scale) / h;
                minX = ann.x;
                minY = ann.y;
                maxX = ann.x + estW;
                maxY = ann.y + estH;
                break;

            case "marks":
                const markLen = (ann.text || "+1").length;
                const mW = ((markLen * 12 + 28) * scale) / w;
                const mH = (32 * scale) / h;
                minX = ann.x - mW / 2;
                maxX = ann.x + mW / 2;
                minY = ann.y - mH / 2;
                maxY = ann.y + mH / 2;
                break;

            case "margin_mark":
            case "left_mark": {
                const markVal = ann.marks !== undefined ? ann.marks : (ann.text || "");
                const qLabel = ann.qLabel || (ann.qNo ? `Q${ann.qNo}` : "");
                const scoreText = qLabel ? `${qLabel}: ${markVal}M` : `${markVal}M`;
                const markW = ((scoreText.length * 8 + 14) * scale) / w;
                const markH = (21 * scale) / h;
                const markX = (ann.x !== undefined && ann.x !== null ? ann.x : 0.08);
                minX = markX - markW / 2;
                maxX = markX + markW / 2;
                minY = ann.y - markH / 2;
                maxY = ann.y + markH / 2;
                break;
            }

            case "pen":
                if (!ann.points || ann.points.length === 0) return null;
                minX = Math.min(...ann.points.map(p => p.x));
                maxX = Math.max(...ann.points.map(p => p.x));
                minY = Math.min(...ann.points.map(p => p.y));
                maxY = Math.max(...ann.points.map(p => p.y));
                const padX = (12 * scale) / w;
                const padH = (12 * scale) / h;
                minX -= padX;
                maxX += padX;
                minY -= padH;
                maxY += padH;
                break;

            default:
                minX = ann.x - 0.02;
                maxX = ann.x + 0.02;
                minY = ann.y - 0.02;
                maxY = ann.y + 0.02;
        }

        return { minX, minY, maxX, maxY, width: Math.max(0.015, maxX - minX), height: Math.max(0.015, maxY - minY) };
    }

    hitTestAnnotation(normPos) {
        const page = this.pages[this.currentPageIndex];
        if (!page || !page.annotations) return null;

        // Search in reverse order to pick top-most annotation
        for (let i = page.annotations.length - 1; i >= 0; i--) {
            const ann = page.annotations[i];
            const bounds = this.getAnnotationBounds(ann);
            if (bounds) {
                const hitTolX = 14 / page.origWidth;
                const hitTolY = 14 / page.origHeight;
                if (
                    normPos.x >= bounds.minX - hitTolX &&
                    normPos.x <= bounds.maxX + hitTolX &&
                    normPos.y >= bounds.minY - hitTolY &&
                    normPos.y <= bounds.maxY + hitTolY
                ) {
                    return ann;
                }
            }
        }
        return null;
    }

    selectAnnotation(ann) {
        this.selectedAnnotation = ann;
        this.selectedAnnotations = [ann];
        this.updateSelectionOverlay();
    }

    deselectAnnotation() {
        this.selectedAnnotation = null;
        this.selectedAnnotations = [];
        if (this.selectionLayer) {
            this.selectionLayer.innerHTML = "";
        }
    }

    deselectAll() {
        this.deselectAnnotation();
    }

    selectAnnotations(annList) {
        this.selectedAnnotation = null;
        this.selectedAnnotations = Array.isArray(annList) ? [...annList] : [];
        if (this.selectedAnnotations.length === 1) {
            this.selectedAnnotation = this.selectedAnnotations[0];
            this.updateSelectionOverlay();
        } else if (this.selectedAnnotations.length > 1) {
            this.updateMultiSelectionOverlay();
        } else {
            this.deselectAll();
        }
    }

    selectAll() {
        const page = this.pages[this.currentPageIndex];
        if (!page || !page.annotations || page.annotations.length === 0) return;
        this.selectAnnotations(page.annotations);
    }

    updateMultiSelectionOverlay() {
        if (!this.selectionLayer) return;
        if (!this.selectedAnnotations || this.selectedAnnotations.length === 0) {
            this.selectionLayer.innerHTML = "";
            return;
        }

        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const canvasW = page.origWidth * this.zoom;
        const canvasH = page.origHeight * this.zoom;

        let combinedMinX = Infinity, combinedMinY = Infinity, combinedMaxX = -Infinity, combinedMaxY = -Infinity;

        const ringsHTML = this.selectedAnnotations.map(ann => {
            const b = this.getAnnotationBounds(ann);
            if (!b) return "";
            combinedMinX = Math.min(combinedMinX, b.minX);
            combinedMinY = Math.min(combinedMinY, b.minY);
            combinedMaxX = Math.max(combinedMaxX, b.maxX);
            combinedMaxY = Math.max(combinedMaxY, b.maxY);

            const l = Math.round(b.minX * canvasW);
            const t = Math.round(b.minY * canvasH);
            const w = Math.round(b.width * canvasW);
            const h = Math.round(b.height * canvasH);
            return `<div class="ann-multi-selection-ring" style="left: ${l}px; top: ${t}px; width: ${w}px; height: ${h}px;"></div>`;
        }).join("");

        const barLeft = Math.round(((combinedMinX + combinedMaxX) / 2) * canvasW);
        const barTop = Math.max(38, Math.round(combinedMinY * canvasH));

        this.selectionLayer.innerHTML = `
            ${ringsHTML}
            <div class="ann-multi-action-bar" style="left: ${barLeft}px; top: ${barTop}px;">
                <span class="multi-action-count">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>${this.selectedAnnotations.length} selected</span>
                </span>
                <div class="multi-action-divider"></div>
                <button type="button" class="btn-delete-selected-batch" id="btn-batch-delete" title="Delete all selected annotations">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    <span>Delete All</span>
                </button>
                <button type="button" class="btn-deselect-batch" id="btn-batch-deselect" title="Deselect all">
                    Cancel
                </button>
            </div>
        `;

        const btnDel = this.selectionLayer.querySelector("#btn-batch-delete");
        if (btnDel) {
            btnDel.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteSelectedBatch();
            });
        }

        const btnCancel = this.selectionLayer.querySelector("#btn-batch-deselect");
        if (btnCancel) {
            btnCancel.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deselectAll();
            });
        }
    }

    deleteSelectedBatch() {
        const page = this.pages[this.currentPageIndex];
        if (!page || !this.selectedAnnotations || this.selectedAnnotations.length === 0) return;

        const toDelete = [...this.selectedAnnotations];
        toDelete.forEach(ann => {
            const idx = page.annotations.indexOf(ann);
            if (idx >= 0) page.annotations.splice(idx, 1);
        });

        page.undoStack.push({ action: "delete_batch", items: toDelete });
        page.redoStack = [];

        const count = toDelete.length;
        this.deselectAll();
        this.renderOverlay();
        this.notifyChange();
        if (window.app && typeof window.app.showToast === "function") {
            window.app.showToast(`Deleted ${count} annotation${count === 1 ? '' : 's'}`);
        }
    }

    updateSelectionOverlay() {
        if (!this.selectionLayer) return;
        if (!this.selectedAnnotation) {
            this.selectionLayer.innerHTML = "";
            return;
        }

        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const bounds = this.getAnnotationBounds(this.selectedAnnotation);
        if (!bounds) {
            this.selectionLayer.innerHTML = "";
            return;
        }

        const canvasW = page.origWidth * this.zoom;
        const canvasH = page.origHeight * this.zoom;

        const left = Math.round(bounds.minX * canvasW);
        const top = Math.round(bounds.minY * canvasH);
        const width = Math.round(bounds.width * canvasW);
        const height = Math.round(bounds.height * canvasH);

        const currentScalePct = Math.round((this.selectedAnnotation.scale || 1.0) * 100);

        this.selectionLayer.innerHTML = `
            <!-- Selection Bounding Box -->
            <div class="ann-selection-box" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;">
                <div class="ann-resize-handle handle-tl" data-handle="tl"></div>
                <div class="ann-resize-handle handle-tr" data-handle="tr"></div>
                <div class="ann-resize-handle handle-bl" data-handle="bl"></div>
                <div class="ann-resize-handle handle-br" data-handle="br"></div>
            </div>

            <!-- Floating Apple Mini-Inspector -->
            <div class="ann-floating-inspector" style="left: ${left + width / 2}px; top: ${Math.max(38, top)}px;">
                <!-- Scale controls -->
                <div class="inspector-scale-group">
                    <button type="button" class="inspector-btn" id="insp-btn-scale-down" title="Decrease Size">−</button>
                    <span class="inspector-scale-text">${currentScalePct}%</span>
                    <button type="button" class="inspector-btn" id="insp-btn-scale-up" title="Increase Size">+</button>
                </div>

                <!-- Color dots -->
                <div class="inspector-color-dot" style="background: #34C759;" data-color="#34C759" title="Emerald Green"></div>
                <div class="inspector-color-dot" style="background: #FF3B30;" data-color="#FF3B30" title="Apple Red"></div>
                <div class="inspector-color-dot" style="background: #007AFF;" data-color="#007AFF" title="Apple Blue"></div>
                <div class="inspector-color-dot" style="background: #FF9500;" data-color="#FF9500" title="Apple Orange"></div>

                <!-- Delete button -->
                <button type="button" class="inspector-btn inspector-btn-delete" id="insp-btn-delete" title="Delete Annotation">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>

                <!-- Close / Deselect -->
                <button type="button" class="inspector-btn" id="insp-btn-close" title="Deselect">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        this.bindInspectorEvents();
    }

    bindInspectorEvents() {
        const btnScaleDown = this.selectionLayer.querySelector("#insp-btn-scale-down");
        const btnScaleUp = this.selectionLayer.querySelector("#insp-btn-scale-up");
        const btnDelete = this.selectionLayer.querySelector("#insp-btn-delete");
        const btnClose = this.selectionLayer.querySelector("#insp-btn-close");

        if (btnScaleDown) {
            btnScaleDown.addEventListener("click", (e) => {
                e.stopPropagation();
                this.adjustAnnotationScale(-0.15);
            });
        }

        if (btnScaleUp) {
            btnScaleUp.addEventListener("click", (e) => {
                e.stopPropagation();
                this.adjustAnnotationScale(0.15);
            });
        }

        if (btnDelete) {
            btnDelete.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.selectedAnnotation) {
                    this.deleteAnnotation(this.selectedAnnotation);
                }
            });
        }

        if (btnClose) {
            btnClose.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deselectAnnotation();
            });
        }

        // Color dots
        this.selectionLayer.querySelectorAll(".inspector-color-dot").forEach(dot => {
            dot.addEventListener("click", (e) => {
                e.stopPropagation();
                const color = dot.getAttribute("data-color");
                if (this.selectedAnnotation && color) {
                    const oldColor = this.selectedAnnotation.color;
                    this.selectedAnnotation.color = color;
                    const page = this.pages[this.currentPageIndex];
                    if (page) {
                        page.undoStack.push({ action: "color", item: this.selectedAnnotation, oldColor, newColor: color });
                        page.redoStack = [];
                    }
                    this.renderOverlay();
                    this.updateSelectionOverlay();
                    this.notifyChange();
                }
            });
        });
    }

    adjustAnnotationScale(delta) {
        if (!this.selectedAnnotation) return;
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const oldScale = this.selectedAnnotation.scale || 1.0;
        const newScale = Math.max(0.4, Math.min(3.5, Math.round((oldScale + delta) * 100) / 100));

        this.selectedAnnotation.scale = newScale;
        page.undoStack.push({ action: "modify", item: this.selectedAnnotation, oldScale, newScale });
        page.redoStack = [];

        this.renderOverlay();
        this.updateSelectionOverlay();
        this.notifyChange();
    }

    deleteAnnotation(ann) {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const idx = page.annotations.indexOf(ann);
        if (idx >= 0) {
            page.annotations.splice(idx, 1);
            page.undoStack.push({ action: "delete", item: ann });
            page.redoStack = [];
            this.deselectAnnotation();
            this.renderOverlay();
            this.notifyChange();
        }
    }

    // --- Events & Drawing ---

    bindEvents() {
        const getPos = (e) => {
            const rect = this.overlayCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const onDown = (e) => {
            if (e.button !== 0 && !e.touches) return;

            // Check if clicking an inspector element, multi-action bar, or radial wheel
            if (e.target.closest(".ann-floating-inspector") || e.target.closest(".ann-multi-action-bar") || e.target.closest(".gta-radial-container")) return;

            const handle = e.target.closest(".ann-resize-handle");
            if (handle && this.selectedAnnotation) {
                e.preventDefault();
                e.stopPropagation();
                this.isResizingAnnotation = true;
                this.activeResizeHandle = handle.getAttribute("data-handle");
                this.dragStartPixelPos = getPos(e);
                this.origScale = this.selectedAnnotation.scale || 1.0;
                return;
            }

            const pos = getPos(e);
            const page = this.pages[this.currentPageIndex];
            if (!page) return;

            const normPos = {
                x: pos.x / (page.origWidth * this.zoom),
                y: pos.y / (page.origHeight * this.zoom)
            };
            this.lastClickNormPos = { ...normPos };
            this.currentCursorNormPos = { ...normPos };

            // Check if clicked inside currently selected annotation body to drag
            if (this.selectedAnnotation) {
                const bounds = this.getAnnotationBounds(this.selectedAnnotation);
                if (bounds && normPos.x >= bounds.minX && normPos.x <= bounds.maxX && normPos.y >= bounds.minY && normPos.y <= bounds.maxY) {
                    e.preventDefault();
                    this.isDraggingAnnotation = true;
                    this.dragStartNorm = { ...normPos };
                    this.dragInitialState = JSON.parse(JSON.stringify(this.selectedAnnotation));
                    this.overlayCanvas.style.cursor = "grabbing";
                    return;
                }
            }

            // Hit test for selecting any existing annotation
            const hit = this.hitTestAnnotation(normPos);

            if (this.currentTool === "eraser") {
                this.handleEraser(normPos);
                return;
            }

            if (this.currentTool === "select") {
                if (hit) {
                    this.selectAnnotation(hit);
                    this.isDraggingAnnotation = true;
                    this.dragStartNorm = { ...normPos };
                    this.dragInitialState = JSON.parse(JSON.stringify(hit));
                    this.overlayCanvas.style.cursor = "grabbing";
                } else {
                    // Start Marquee drag-to-select!
                    this.deselectAll();
                    this.isMarqueeSelecting = true;
                    this.marqueeStartPixel = { ...pos };
                    this.marqueeStartNorm = { ...normPos };
                    this.marqueeBoxEl = document.createElement("div");
                    this.marqueeBoxEl.className = "ann-marquee-box";
                    this.marqueeBoxEl.style.left = `${pos.x}px`;
                    this.marqueeBoxEl.style.top = `${pos.y}px`;
                    this.marqueeBoxEl.style.width = "0px";
                    this.marqueeBoxEl.style.height = "0px";
                    this.selectionLayer.appendChild(this.marqueeBoxEl);
                }
                return;
            }

            // If another tool is active, but clicked an existing annotation
            if (hit && !["pen", "circle", "highlight", "underline", "arrow", "tick"].includes(this.currentTool)) {
                this.selectAnnotation(hit);
                this.isDraggingAnnotation = true;
                this.dragStartNorm = { ...normPos };
                this.dragInitialState = JSON.parse(JSON.stringify(hit));
                this.overlayCanvas.style.cursor = "grabbing";
                return;
            }

            // Clicking outside deselects
            this.deselectAll();

            // Normal drawing tool
            this.startDrawing(pos);
        };

        const onMove = (e) => {
            const pos = getPos(e);
            const page = this.pages[this.currentPageIndex];
            if (!page) return;

            const normPos = {
                x: Math.max(0, Math.min(1, pos.x / (page.origWidth * this.zoom))),
                y: Math.max(0, Math.min(1, pos.y / (page.origHeight * this.zoom)))
            };
            this.currentCursorNormPos = { ...normPos };

            // 0. Marquee Selection Dragging
            if (this.isMarqueeSelecting && this.marqueeStartPixel && this.marqueeBoxEl) {
                e.preventDefault();
                const mLeft = Math.min(this.marqueeStartPixel.x, pos.x);
                const mTop = Math.min(this.marqueeStartPixel.y, pos.y);
                const mWidth = Math.abs(pos.x - this.marqueeStartPixel.x);
                const mHeight = Math.abs(pos.y - this.marqueeStartPixel.y);

                this.marqueeBoxEl.style.left = `${mLeft}px`;
                this.marqueeBoxEl.style.top = `${mTop}px`;
                this.marqueeBoxEl.style.width = `${mWidth}px`;
                this.marqueeBoxEl.style.height = `${mHeight}px`;

                const normMinX = Math.min(this.marqueeStartNorm.x, normPos.x);
                const normMaxX = Math.max(this.marqueeStartNorm.x, normPos.x);
                const normMinY = Math.min(this.marqueeStartNorm.y, normPos.y);
                const normMaxY = Math.max(this.marqueeStartNorm.y, normPos.y);

                const canvasW = page.origWidth * this.zoom;
                const canvasH = page.origHeight * this.zoom;

                const intersecting = (page.annotations || []).filter(ann => {
                    const b = this.getAnnotationBounds(ann);
                    if (!b) return false;
                    return !(b.maxX < normMinX || b.minX > normMaxX || b.maxY < normMinY || b.minY > normMaxY);
                });

                this.selectedAnnotations = intersecting;

                // Render live outline rings
                const existingRings = this.selectionLayer.querySelectorAll(".ann-multi-selection-ring");
                existingRings.forEach(r => r.remove());

                this.selectedAnnotations.forEach(ann => {
                    const b = this.getAnnotationBounds(ann);
                    if (b) {
                        const ring = document.createElement("div");
                        ring.className = "ann-multi-selection-ring";
                        ring.style.left = `${Math.round(b.minX * canvasW)}px`;
                        ring.style.top = `${Math.round(b.minY * canvasH)}px`;
                        ring.style.width = `${Math.round(b.width * canvasW)}px`;
                        ring.style.height = `${Math.round(b.height * canvasH)}px`;
                        this.selectionLayer.appendChild(ring);
                    }
                });
                return;
            }

            // 1. Resizing selected annotation via corner handle
            if (this.isResizingAnnotation && this.selectedAnnotation) {
                e.preventDefault();
                const bounds = this.getAnnotationBounds(this.selectedAnnotation);
                if (bounds) {
                    const canvasW = page.origWidth * this.zoom;
                    const canvasH = page.origHeight * this.zoom;
                    const centerX = ((bounds.minX + bounds.maxX) / 2) * canvasW;
                    const centerY = ((bounds.minY + bounds.maxY) / 2) * canvasH;

                    const curDist = Math.hypot(pos.x - centerX, pos.y - centerY);
                    const startDist = Math.hypot(this.dragStartPixelPos.x - centerX, this.dragStartPixelPos.y - centerY);

                    if (startDist > 8) {
                        const ratio = curDist / startDist;
                        const newScale = Math.max(0.4, Math.min(3.5, Math.round(this.origScale * ratio * 100) / 100));
                        this.selectedAnnotation.scale = newScale;
                        this.renderOverlay();
                        this.updateSelectionOverlay();
                    }
                }
                return;
            }

            // 2. Dragging & Repositioning selected annotation
            if (this.isDraggingAnnotation && this.selectedAnnotation) {
                e.preventDefault();
                const dx = normPos.x - this.dragStartNorm.x;
                const dy = normPos.y - this.dragStartNorm.y;

                if (this.selectedAnnotation.type === "pen" && this.dragInitialState.points) {
                    this.selectedAnnotation.points = this.dragInitialState.points.map(p => ({
                        x: Math.max(0, Math.min(1, p.x + dx)),
                        y: Math.max(0, Math.min(1, p.y + dy))
                    }));
                } else if (["arrow", "underline"].includes(this.selectedAnnotation.type) && this.dragInitialState.startX !== undefined) {
                    this.selectedAnnotation.startX = Math.max(0, Math.min(1, this.dragInitialState.startX + dx));
                    this.selectedAnnotation.startY = Math.max(0, Math.min(1, this.dragInitialState.startY + dy));
                    this.selectedAnnotation.endX = Math.max(0, Math.min(1, this.dragInitialState.endX + dx));
                    this.selectedAnnotation.endY = Math.max(0, Math.min(1, this.dragInitialState.endY + dy));
                    this.selectedAnnotation.x = Math.max(0, Math.min(1, this.dragInitialState.x + dx));
                    this.selectedAnnotation.y = Math.max(0, Math.min(1, this.dragInitialState.y + dy));
                } else {
                    this.selectedAnnotation.x = Math.max(0, Math.min(1, this.dragInitialState.x + dx));
                    this.selectedAnnotation.y = Math.max(0, Math.min(1, this.dragInitialState.y + dy));
                }

                this.renderOverlay();
                this.updateSelectionOverlay();
                return;
            }

            // 3. Regular Drawing
            if (this.isDrawing) {
                e.preventDefault();
                this.continueDrawing(pos);
            }
        };

        const onUp = (e) => {
            if (this.isMarqueeSelecting) {
                this.isMarqueeSelecting = false;
                if (this.marqueeBoxEl) {
                    this.marqueeBoxEl.remove();
                    this.marqueeBoxEl = null;
                }
                if (this.selectedAnnotations.length === 1) {
                    this.selectAnnotation(this.selectedAnnotations[0]);
                } else if (this.selectedAnnotations.length > 1) {
                    this.updateMultiSelectionOverlay();
                } else {
                    this.deselectAll();
                }
                return;
            }

            if (this.isResizingAnnotation && this.selectedAnnotation) {
                this.isResizingAnnotation = false;
                const page = this.pages[this.currentPageIndex];
                if (page) {
                    page.undoStack.push({
                        action: "modify",
                        item: this.selectedAnnotation,
                        oldScale: this.origScale,
                        newScale: this.selectedAnnotation.scale
                    });
                    page.redoStack = [];
                }
                this.notifyChange();
                return;
            }

            if (this.isDraggingAnnotation && this.selectedAnnotation) {
                this.isDraggingAnnotation = false;
                this.overlayCanvas.style.cursor = this.currentTool === "select" ? "default" : "crosshair";
                const page = this.pages[this.currentPageIndex];
                if (page) {
                    page.undoStack.push({
                        action: "move",
                        item: this.selectedAnnotation,
                        oldState: this.dragInitialState,
                        newState: JSON.parse(JSON.stringify(this.selectedAnnotation))
                    });
                    page.redoStack = [];
                }
                this.notifyChange();
                return;
            }

            if (this.isDrawing) {
                e.preventDefault();
                this.finishDrawing();
            }
        };

        this.overlayCanvas.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        // Touch support for phones & tablets
        this.overlayCanvas.addEventListener("touchstart", onDown, { passive: false });
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onUp, { passive: false });
    }

    startDrawing(pos) {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const normPos = {
            x: pos.x / (page.origWidth * this.zoom),
            y: pos.y / (page.origHeight * this.zoom)
        };

        this.isDrawing = true;
        this.drawStartPoint = { ...normPos };

        if (this.currentTool === "pen") {
            this.currentStrokePoints = [normPos];
        } else if (this.currentTool === "tick") {
            // GTA V Style Radial Wheel for Ticks & Step Marks
            this.openRadialMarkingWheel(normPos, pos);
            this.isDrawing = false;
        } else if (this.currentTool === "wrong" || this.currentTool === "marks") {
            this.placeStamp(this.currentTool, normPos);
            this.isDrawing = false;
        } else if (this.currentTool === "comment") {
            this.promptComment(normPos);
            this.isDrawing = false;
        }
    }

    // --- GTA V Style Radial Marking Wheel ---

    getDynamicRadialOptions(qMax) {
        // Step marks: always +0.5 and +1.0
        const opts = [
            { label: "+0.5", sub: "Step", val: 0.5, isStep: true, cls: "is-step-btn" },
            { label: "+1.0", sub: "Step", val: 1.0, isStep: true, cls: "is-step-btn" }
        ];

        // Based on qMax (which can be 2, 3, 5, 7, 10, 12, 15, etc.):
        if (qMax <= 2) {
            opts.push(
                { label: "0.5", sub: "Marks", val: 0.5, isStep: false, cls: "" },
                { label: "1.0", sub: "Marks", val: 1.0, isStep: false, cls: "" },
                { label: "1.5", sub: "Marks", val: 1.5, isStep: false, cls: "" },
                { label: "2.0", sub: "Marks", val: 2.0, isStep: false, cls: "" }
            );
        } else if (qMax <= 4) {
            opts.push(
                { label: "0.5", sub: "Marks", val: 0.5, isStep: false, cls: "" },
                { label: "1.0", sub: "Marks", val: 1.0, isStep: false, cls: "" },
                { label: "1.5", sub: "Marks", val: 1.5, isStep: false, cls: "" },
                { label: "2.0", sub: "Marks", val: 2.0, isStep: false, cls: "" },
                { label: "2.5", sub: "Marks", val: 2.5, isStep: false, cls: "" },
                { label: "3.0", sub: "Marks", val: 3.0, isStep: false, cls: "" }
            );
            if (qMax === 4) opts.push({ label: "4.0", sub: "Marks", val: 4.0, isStep: false, cls: "" });
        } else if (qMax <= 7) {
            // Questions up to 7M (e.g. CBSE 5M, 7M)
            for (let m = 1; m < qMax; m++) {
                opts.push({ label: `${m}`, sub: "Marks", val: m, isStep: false, cls: "" });
            }
            if (qMax <= 5) {
                opts.push({ label: `${qMax - 0.5}`, sub: "Marks", val: qMax - 0.5, isStep: false, cls: "" });
            }
        } else if (qMax <= 12) {
            // Questions up to 12M (e.g. 8M, 10M, 12M)
            const step = qMax > 10 ? 2 : 1;
            for (let m = 2; m < qMax; m += step) {
                opts.push({ label: `${m}`, sub: "Marks", val: m, isStep: false, cls: "" });
            }
            if (!opts.find(o => o.val === qMax - 1)) {
                opts.push({ label: `${qMax - 1}`, sub: "Marks", val: qMax - 1, isStep: false, cls: "" });
            }
        } else {
            // 15 or higher marks questions (e.g. 15M long essays)
            const intermediate = [2, 5, 7, 10, 12, 14].filter(m => m < qMax);
            intermediate.forEach(m => {
                opts.push({ label: `${m}`, sub: "Marks", val: m, isStep: false, cls: "" });
            });
        }

        // Full marks button and Zero button
        opts.push({ label: "Full", sub: `${qMax}M`, val: qMax, isStep: false, cls: "is-full-btn" });
        opts.push({ label: "0", sub: "Zero", val: 0, isStep: false, cls: "is-zero-btn" });

        return opts;
    }

    stampRightMarginMark(qNo, marks, yNorm = null, xNorm = null) {
        const page = this.pages[this.currentPageIndex];
        if (!page) return null;

        const y = (yNorm !== null && yNorm !== undefined)
            ? yNorm
            : (this.lastClickNormPos ? this.lastClickNormPos.y : (this.currentCursorNormPos ? this.currentCursorNormPos.y : 0.4));
        const marginX = (xNorm !== null && xNorm !== undefined) ? Math.max(0.02, Math.min(0.96, xNorm)) : 0.08;
        const targetKey = this.normalizeQKey(qNo);

        // Check if there is already a margin_mark or left_mark for this question on this page
        const existingIdx = (page.annotations || []).findIndex(a => 
            (a.type === "margin_mark" || a.type === "left_mark") && 
            this.normalizeQKey(a.qNo || a.qLabel) === targetKey
        );
        const newAnn = {
            id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            pageIndex: this.currentPageIndex,
            type: "margin_mark",
            qNo: qNo,
            qLabel: qNo ? (String(qNo).toUpperCase().startsWith("Q") ? String(qNo) : `Q${qNo}`) : "",
            marks: marks,
            color: "#DC2626", // Strict Teacher Red Ink
            x: marginX,
            y: Math.max(0.02, Math.min(0.98, y)),
            scale: 1.0,
            timestamp: Date.now()
        };

        if (existingIdx >= 0) {
            page.annotations[existingIdx] = newAnn;
            if (this.options.onAnnotationsChange) {
                this.options.onAnnotationsChange(page.annotations);
            }
        } else {
            this.addAnnotation(newAnn);
        }
        this.renderOverlay();
        return newAnn;
    }

    // Stamp question marks label (alias for compatibility)
    stampLeftMarginMark(qNo, marks, yNorm = null, xNorm = null) {
        return this.stampRightMarginMark(qNo, marks, yNorm, xNorm);
    }

    openRadialMarkingWheel(normPos, pixelPos) {
        this.closeRadialMarkingWheel();

        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const canvasW = page.origWidth * this.zoom;
        const canvasH = page.origHeight * this.zoom;

        const posX = pixelPos ? pixelPos.x : (normPos.x * canvasW);
        const posY = pixelPos ? pixelPos.y : (normPos.y * canvasH);

        const qInfo = (this.options.getActiveQuestionInfo ? this.options.getActiveQuestionInfo() : null) || { label: "Q1", maxMarks: 2, qNo: 1, section: "Section A" };
        const qMax = Number(qInfo.maxMarks) || 2;
        const qLabel = qInfo.label || "Q1";
        const secName = qInfo.section || "";

        // Dynamic nodes adapted to question ceiling (e.g. 7M, 12M, 15M)
        const radialOptions = this.getDynamicRadialOptions(qMax);

        const container = document.createElement("div");
        container.className = "gta-radial-container";
        const boundedX = Math.max(140, Math.min(canvasW - 140, posX));
        const boundedY = Math.max(140, Math.min(canvasH - 140, posY));
        container.style.left = `${Math.round(boundedX)}px`;
        container.style.top = `${Math.round(boundedY)}px`;

        const R = 104;
        const centerX = 140;
        const centerY = 140;

        const nodesHTML = radialOptions.map((opt, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI / radialOptions.length);
            const nx = Math.round(centerX + R * Math.cos(angle));
            const ny = Math.round(centerY + R * Math.sin(angle));
            return `
                <button type="button" class="radial-node-btn ${opt.cls}" data-idx="${i}" style="left: ${nx}px; top: ${ny}px;" title="Award ${opt.label} ${opt.sub}">
                    <span class="radial-node-val">${opt.label}</span>
                    <span class="radial-node-label">${opt.sub}</span>
                </button>
            `;
        }).join("");

        const secPillHtml = secName ? `<span class="radial-center-sec">${secName}</span>` : '';

        container.innerHTML = `
            <div class="gta-radial-wheel">
                <div class="radial-guide-ring"></div>
                ${nodesHTML}
                <div class="radial-center-hub" id="radial-hub-btn" title="Click or Press F to award full marks (${qMax}M) with right-margin stamp">
                    ${secPillHtml}
                    <span class="radial-center-qtag" id="radial-hub-qtag">${qLabel}</span>
                    <span class="radial-center-val" id="radial-hub-val">+${qMax}M</span>
                    <span class="radial-center-action" id="radial-hub-action">Award Full (F)</span>
                </div>
                <button type="button" class="btn-radial-close" id="btn-radial-dismiss" title="Cancel">×</button>
            </div>
        `;

        const backdrop = document.createElement("div");
        backdrop.className = "gta-radial-backdrop";
        backdrop.addEventListener("click", () => this.closeRadialMarkingWheel());

        document.body.appendChild(backdrop);
        this.wrapper.appendChild(container);

        this.radialBackdrop = backdrop;
        this.radialWheelContainer = container;

        const hubBtn = container.querySelector("#radial-hub-btn");
        const hubVal = container.querySelector("#radial-hub-val");
        const hubAction = container.querySelector("#radial-hub-action");

        container.querySelectorAll(".radial-node-btn").forEach(btn => {
            const idx = Number(btn.getAttribute("data-idx"));
            const opt = radialOptions[idx];

            btn.addEventListener("mouseenter", () => {
                if (hubVal) hubVal.textContent = opt.isStep ? `${opt.label} Step` : `${opt.label} M`;
                if (hubAction) hubAction.textContent = opt.isStep ? "Award Step" : (opt.val === 0 ? "Mark Zero" : "Award Mark");
            });

            btn.addEventListener("mouseleave", () => {
                if (hubVal) hubVal.textContent = `+${qMax}M`;
                if (hubAction) hubAction.textContent = "Award Full (F)";
            });

            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.awardRadialMark(normPos, opt.val, opt.isStep, opt.label);
            });
        });

        if (hubBtn) {
            hubBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.awardRadialMark(normPos, qMax, false, `${qMax}`);
            });
        }

        const closeBtn = container.querySelector("#btn-radial-dismiss");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.closeRadialMarkingWheel();
            });
        }
    }

    closeRadialMarkingWheel() {
        if (this.radialWheelContainer) {
            this.radialWheelContainer.remove();
            this.radialWheelContainer = null;
        }
        if (this.radialBackdrop) {
            this.radialBackdrop.remove();
            this.radialBackdrop = null;
        }
    }

    awardRadialMark(normPos, val, isStep = false, label = "") {
        this.closeRadialMarkingWheel();

        const qInfo = (this.options.getActiveQuestionInfo ? this.options.getActiveQuestionInfo() : null) || { label: "Q1", maxMarks: 2, qNo: 1 };
        const qMax = Number(qInfo.maxMarks) || 2;
        const numVal = Number(val) || 0;
        const isFull = !isStep && numVal >= qMax;
        const isZero = numVal === 0;

        // When mark is 0, show "wrong" (X mark) not "tick"
        const stampType = isZero ? "wrong" : "tick";

        // When giving full mark alone, place tick slightly left and print question label at the side edge of the mark
        const tickX = isFull ? Math.max(0.02, normPos.x - 0.025) : normPos.x;
        const labelX = Math.min(0.96, normPos.x + 0.035);

        // Stamp tick or X cross in red ink with marks badge at clicked position
        const stamp = {
            id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            pageIndex: this.currentPageIndex,
            type: stampType,
            x: tickX,
            y: normPos.y,
            color: "#DC2626", // Teacher Red Ink
            marks: numVal,
            qNo: qInfo.qNo || 1,
            qLabel: qInfo.label || `Q${qInfo.qNo || 1}`,
            isStep: !!isStep,
            hasMarginMark: isFull, // Full mark alone prints question label at side edge
            scale: 1.0,
            timestamp: Date.now()
        };

        this.addAnnotation(stamp);

        // When giving full mark alone, print the question label right at the side edge of the mark
        if (isFull) {
            this.stampRightMarginMark(qInfo.qNo || qInfo.label, numVal, normPos.y, labelX);
        }

        this.renderOverlay();

        // Callback to app / marking panel to calculate and update totals
        if (this.options.onRadialMarkAwarded) {
            this.options.onRadialMarkAwarded(numVal, !!isStep, normPos);
        }
    }

    continueDrawing(pos) {
        const page = this.pages[this.currentPageIndex];
        if (!page || !this.isDrawing) return;

        const normPos = {
            x: Math.max(0, Math.min(1, pos.x / (page.origWidth * this.zoom))),
            y: Math.max(0, Math.min(1, pos.y / (page.origHeight * this.zoom)))
        };

        if (this.currentTool === "pen") {
            this.currentStrokePoints.push(normPos);
            this.renderOverlay();
            this.renderPenLive(this.currentStrokePoints, this.currentColor, this.strokeWidth);
        } else if (["circle", "underline", "highlight", "arrow"].includes(this.currentTool)) {
            this.renderOverlay();
            this.renderLiveDragShape(this.currentTool, this.drawStartPoint, normPos);
        }
    }

    finishDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        if (this.currentTool === "pen" && this.currentStrokePoints.length > 1) {
            this.addAnnotation({
                pageIndex: this.currentPageIndex,
                type: "pen",
                points: this.currentStrokePoints,
                color: this.currentColor,
                width: this.strokeWidth,
                scale: 1.0,
                timestamp: Date.now()
            });
            this.currentStrokePoints = [];
        } else if (["circle", "underline", "highlight", "arrow"].includes(this.currentTool)) {
            const start = this.drawStartPoint;
            const end = this.lastDragPoint || start;
            const width = Math.abs(end.x - start.x);
            const height = Math.abs(end.y - start.y);

            if (width < 0.008 && height < 0.008) {
                if (this.currentTool === "circle") {
                    this.addAnnotation({
                        pageIndex: this.currentPageIndex,
                        type: "circle",
                        x: start.x - 0.04,
                        y: start.y - 0.03,
                        width: 0.08,
                        height: 0.06,
                        color: this.currentColor,
                        scale: 1.0,
                        timestamp: Date.now()
                    });
                }
            } else {
                this.addAnnotation({
                    pageIndex: this.currentPageIndex,
                    type: this.currentTool,
                    x: Math.min(start.x, end.x),
                    y: Math.min(start.y, end.y),
                    width: Math.max(width, 0.02),
                    height: Math.max(height, 0.015),
                    startX: start.x,
                    startY: start.y,
                    endX: end.x,
                    endY: end.y,
                    color: this.currentColor,
                    scale: 1.0,
                    timestamp: Date.now()
                });
            }
        }

        this.renderOverlay();
    }

    placeStamp(type, pos) {
        const stamp = {
            id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            pageIndex: this.currentPageIndex,
            type: type,
            x: pos.x,
            y: pos.y,
            color: (type === "wrong") ? "#DC2626" : (this.currentColor || "#007AFF"),
            scale: 1.0,
            timestamp: Date.now()
        };

        if (type === "marks") {
            stamp.text = this.activeMarksValue || "+1";
        }

        this.addAnnotation(stamp);
        this.renderOverlay();
    }

    promptComment(pos) {
        const text = prompt("Enter teacher comment or feedback:", "Good explanation");
        if (text && text.trim().length > 0) {
            this.addAnnotation({
                pageIndex: this.currentPageIndex,
                type: "comment",
                x: pos.x,
                y: pos.y,
                text: text.trim(),
                color: this.currentColor || "#007AFF",
                scale: 1.0,
                timestamp: Date.now()
            });
            this.renderOverlay();
        }
    }

    addPresetComment(text) {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;
        this.addAnnotation({
            pageIndex: this.currentPageIndex,
            type: "comment",
            x: 0.65,
            y: 0.35 + (page.annotations.length * 0.05) % 0.5,
            text: text,
            color: "#007AFF",
            scale: 1.0,
            timestamp: Date.now()
        });
        this.renderOverlay();
    }

    handleEraser(pos) {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        let hitIdx = -1;
        let minDist = 0.06;

        page.annotations.forEach((ann, i) => {
            const dist = Math.hypot(ann.x - pos.x, ann.y - pos.y);
            if (dist < minDist) {
                minDist = dist;
                hitIdx = i;
            }
        });

        if (hitIdx >= 0) {
            const removed = page.annotations.splice(hitIdx, 1)[0];
            page.undoStack.push({ action: "delete", item: removed });
            page.redoStack = [];
            this.deselectAnnotation();
            this.renderOverlay();
            this.notifyChange();
        }
    }

    addAnnotation(ann) {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;
        page.annotations.push(ann);
        page.undoStack.push({ action: "add", item: ann });
        page.redoStack = [];
        this.notifyChange();
    }

    undo() {
        const page = this.pages[this.currentPageIndex];
        if (!page || page.undoStack.length === 0) return;

        const record = page.undoStack.pop();
        if (record.action === "add") {
            const idx = page.annotations.indexOf(record.item);
            if (idx >= 0) {
                page.annotations.splice(idx, 1);
                page.redoStack.push(record);
            }
        } else if (record.action === "delete") {
            page.annotations.push(record.item);
            page.redoStack.push(record);
        } else if (record.action === "delete_batch") {
            (record.items || []).forEach(item => page.annotations.push(item));
            page.redoStack.push(record);
        } else if (record.action === "move") {
            Object.assign(record.item, record.oldState);
            page.redoStack.push(record);
        } else if (record.action === "modify") {
            record.item.scale = record.oldScale;
            page.redoStack.push(record);
        } else if (record.action === "color") {
            record.item.color = record.oldColor;
            page.redoStack.push(record);
        }

        this.renderOverlay();
        this.updateSelectionOverlay();
        this.notifyChange();
    }

    redo() {
        const page = this.pages[this.currentPageIndex];
        if (!page || page.redoStack.length === 0) return;

        const record = page.redoStack.pop();
        if (record.action === "add") {
            page.annotations.push(record.item);
            page.undoStack.push(record);
        } else if (record.action === "delete") {
            const idx = page.annotations.indexOf(record.item);
            if (idx >= 0) {
                page.annotations.splice(idx, 1);
                page.undoStack.push(record);
            }
        } else if (record.action === "delete_batch") {
            (record.items || []).forEach(item => {
                const idx = page.annotations.indexOf(item);
                if (idx >= 0) page.annotations.splice(idx, 1);
            });
            page.undoStack.push(record);
        } else if (record.action === "move") {
            Object.assign(record.item, record.newState);
            page.undoStack.push(record);
        } else if (record.action === "modify") {
            record.item.scale = record.newScale;
            page.undoStack.push(record);
        } else if (record.action === "color") {
            record.item.color = record.newColor;
            page.undoStack.push(record);
        }

        this.renderOverlay();
        this.updateSelectionOverlay();
        this.notifyChange();
    }

    notifyChange() {
        if (this.options.onAnnotationsChange) {
            this.options.onAnnotationsChange(this.getAllAnnotations());
        }
    }

    getAllAnnotations() {
        const all = [];
        this.pages.forEach((p, idx) => {
            p.annotations.forEach(a => {
                all.push({ ...a, pageIndex: idx });
            });
        });
        return all;
    }

    normalizeQKey(val) {
        if (val === null || val === undefined) return null;
        const str = String(val).trim().toLowerCase().replace(/^q/, "");
        const num = parseInt(str, 10);
        return isNaN(num) ? String(val).trim().toLowerCase() : `q${num}`;
    }

    getPageTotalMarks(pageIndex = this.currentPageIndex) {
        if (!this.pages || !this.pages[pageIndex]) return 0;
        const page = this.pages[pageIndex];
        if (!page.annotations || page.annotations.length === 0) return 0;

        // Group mark annotations on this page by normalized qKey to prevent double-counting margin marks + ticks
        const questionMarksMap = new Map();
        let unassignedTotal = 0;

        page.annotations.forEach(a => {
            const rawVal = a.marks !== undefined && a.marks !== null ? String(a.marks) : String(a.text || "");
            const val = parseFloat(rawVal.replace(/^\+/, "").trim());
            if (isNaN(val)) return;

            const qKey = this.normalizeQKey(a.qNo || a.qLabel);

            if (a.type === "margin_mark" || a.type === "left_mark") {
                if (qKey) {
                    if (!questionMarksMap.has(qKey)) {
                        questionMarksMap.set(qKey, { committed: val, ticksSum: 0 });
                    } else {
                        questionMarksMap.get(qKey).committed = val;
                    }
                } else {
                    unassignedTotal += val;
                }
            } else if (a.type === "tick" || a.type === "marks") {
                if (qKey) {
                    if (!questionMarksMap.has(qKey)) {
                        questionMarksMap.set(qKey, { committed: null, ticksSum: 0 });
                    }
                    const entry = questionMarksMap.get(qKey);
                    entry.ticksSum = Math.round((entry.ticksSum + val) * 10) / 10;
                } else {
                    unassignedTotal += val;
                }
            }
        });

        let total = unassignedTotal;
        questionMarksMap.forEach(entry => {
            if (entry.committed !== null && entry.committed !== undefined) {
                total += entry.committed;
            } else {
                total += entry.ticksSum;
            }
        });

        return Math.round(total * 10) / 10;
    }

    getPaperTotalMarks() {
        if (!this.pages || this.pages.length === 0) return 0;
        let total = 0;
        this.pages.forEach((p, idx) => {
            total += this.getPageTotalMarks(idx);
        });
        return Math.round(total * 10) / 10;
    }

    getAnnotationsForQuestion(targetQNo) {
        if (!targetQNo) return [];
        const targetKey = this.normalizeQKey(targetQNo);
        const result = [];
        this.pages.forEach(page => {
            (page.annotations || []).forEach(a => {
                // "wrong" (X mark) is purely a visual mistake/step-zero indicator, not score-bearing
                if (a.type === "wrong") return;
                if (this.normalizeQKey(a.qNo || a.qLabel) === targetKey) {
                    result.push(a);
                }
            });
        });
        return result;
    }

    getQuestionTotalFromAnnotations(targetQNo) {
        if (!targetQNo) return 0;
        const targetKey = this.normalizeQKey(targetQNo);
        let committedVal = null;
        let ticksSum = 0;

        this.pages.forEach(page => {
            (page.annotations || []).forEach(a => {
                const qKey = this.normalizeQKey(a.qNo || a.qLabel);
                if (qKey !== targetKey) return;

                const rawVal = a.marks !== undefined && a.marks !== null ? String(a.marks) : String(a.text || "");
                const val = parseFloat(rawVal.replace(/^\+/, "").trim());
                if (isNaN(val)) return;

                if (a.type === "margin_mark" || a.type === "left_mark") {
                    committedVal = val;
                } else if (a.type === "tick" || a.type === "marks") {
                    ticksSum = Math.round((ticksSum + val) * 10) / 10;
                }
            });
        });

        const finalVal = (committedVal !== null && committedVal !== undefined) ? committedVal : ticksSum;
        return Math.round(finalVal * 10) / 10;
    }

    // --- Rendering ---

    renderAll() {
        this.renderBase();
        this.renderOverlay();
    }

    renderBase() {
        const page = this.pages[this.currentPageIndex];
        if (!page || !page.imgObj) return;

        const ctx = this.baseCtx;
        const w = page.origWidth * this.zoom;
        const h = page.origHeight * this.zoom;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(page.imgObj, 0, 0, w, h);
    }

    renderOverlay() {
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const ctx = this.overlayCtx;
        const w = page.origWidth * this.zoom;
        const h = page.origHeight * this.zoom;

        ctx.clearRect(0, 0, w, h);

        // Draw all saved annotations for this page
        page.annotations.forEach(ann => {
            this.drawAnnotationItem(ctx, ann, w, h);
        });

        // Compact smart page total number badge at bottom-right margin (avoids overlapping student paper)
        this.renderPageTotalFooter(ctx, page, w, h);
    }

    renderPageTotalFooter(ctx, page, w, h) {
        const pageTotal = this.getPageTotalMarks(this.currentPageIndex);

        ctx.save();
        const scale = Math.max(0.85, Math.min(1.25, this.zoom));
        const numText = `Total: ${pageTotal}M`;

        ctx.font = `400 ${Math.round(15 * scale)}px system-ui, -apple-system, sans-serif`;
        const textW = ctx.measureText(numText).width;

        // Prominent badge on the RIGHT margin of paper canvas
        const boxW = Math.max(64 * scale, textW + 24 * scale);
        const boxH = 34 * scale;
        const padRight = 16 * scale;
        const padBottom = 16 * scale;
        const x = w - boxW - padRight; // Placed ONLY on the right side!
        const y = h - boxH - padBottom;

        ctx.shadowColor = "rgba(220, 38, 38, 0.16)";
        ctx.shadowBlur = 8 * scale;
        ctx.shadowOffsetY = 2 * scale;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(x, y, boxW, boxH, [17 * scale]);
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.lineWidth = 2.0 * scale;
        ctx.strokeStyle = "#DC2626"; // Teacher red ink
        ctx.stroke();

        // Clean teacher red numeral inside right margin badge
        ctx.fillStyle = "#DC2626";
        ctx.font = `400 ${Math.round(15 * scale)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(numText, x + boxW / 2, y + boxH / 2);

        ctx.restore();
    }

    renderLiveDragShape(tool, start, end) {
        this.lastDragPoint = end;
        const page = this.pages[this.currentPageIndex];
        if (!page) return;

        const ctx = this.overlayCtx;
        const w = page.origWidth * this.zoom;
        const h = page.origHeight * this.zoom;

        const tempAnn = {
            type: tool,
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
            color: this.currentColor,
            scale: 1.0
        };

        this.drawAnnotationItem(ctx, tempAnn, w, h, true);
    }

    renderPenLive(points, color, width) {
        const page = this.pages[this.currentPageIndex];
        if (!page || points.length < 2) return;

        const ctx = this.overlayCtx;
        const w = page.origWidth * this.zoom;
        const h = page.origHeight * this.zoom;

        ctx.save();
        ctx.strokeStyle = color || "#DC2626";
        ctx.lineWidth = (width || 3) * this.zoom;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(points[0].x * w, points[0].y * h);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x * w, points[i].y * h);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawAnnotationItem(ctx, ann, canvasW, canvasH, isDraft = false) {
        CanvasEngine.drawAnnotation(ctx, ann, canvasW, canvasH, this.zoom, isDraft);
    }

    static drawAnnotation(ctx, ann, canvasW, canvasH, scale = 1.0, isDraft = false) {
        ctx.save();

        const annScale = (ann.scale !== undefined && ann.scale !== null) ? Number(ann.scale) : 1.0;
        const effScale = scale * annScale;

        if (isDraft) {
            ctx.setLineDash([4, 4]);
        }

        const x = ann.x * canvasW;
        const y = ann.y * canvasH;

        switch (ann.type) {
            case "tick": {
                // Strict Teacher Red Ink checkmark
                const tickCol = (ann.color === "#34C759" || ann.color === "#10B981" || !ann.color) ? "#DC2626" : ann.color;
                ctx.strokeStyle = tickCol;
                ctx.lineWidth = 4.5 * effScale;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(x - 14 * effScale, y);
                ctx.lineTo(x - 4 * effScale, y + 14 * effScale);
                ctx.lineTo(x + 20 * effScale, y - 16 * effScale);
                ctx.stroke();

                // If this tick has an awarded mark or step mark attached (GTA V radial wheel mark)
                if (ann.marks !== undefined && ann.marks !== null && ann.marks !== "" && !ann.hasMarginMark) {
                    const rawVal = Number(ann.marks);
                    const markStr = String(ann.marks).startsWith("+") || rawVal <= 0 ? String(ann.marks) : `+${ann.marks}`;
                    const badgeText = ann.isStep ? `${markStr} Step` : `${markStr} M`;
                    const badgeFontSize = Math.max(11, Math.round(12 * effScale));
                    ctx.font = `600 ${badgeFontSize}px system-ui, -apple-system, sans-serif`;
                    const textMetrics = ctx.measureText(badgeText);
                    const bPadX = 6 * effScale;
                    const bPadY = 3 * effScale;
                    const bW = textMetrics.width + bPadX * 2;
                    const bH = badgeFontSize + bPadY * 2;
                    const bX = x + 20 * effScale;
                    const bY = y - 12 * effScale;

                    ctx.fillStyle = tickCol;
                    ctx.beginPath();
                    ctx.roundRect(bX, bY - bH / 2, bW, bH, [4 * effScale]);
                    ctx.fill();

                    ctx.fillStyle = "#FFFFFF";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(badgeText, bX + bW / 2, bY);
                }
                break;
            }

            case "wrong": {
                // Strict Teacher Red Ink cross
                const wrongCol = (!ann.color || ann.color === "#34C759" || ann.color === "#10B981") ? "#DC2626" : ann.color;
                ctx.strokeStyle = wrongCol;
                ctx.lineWidth = 4.5 * effScale;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(x - 14 * effScale, y - 14 * effScale);
                ctx.lineTo(x + 14 * effScale, y + 14 * effScale);
                ctx.moveTo(x + 14 * effScale, y - 14 * effScale);
                ctx.lineTo(x - 14 * effScale, y + 14 * effScale);
                ctx.stroke();

                // Optional marks badge next to the X cross mark
                if (ann.marks !== undefined && ann.marks !== null && ann.marks !== "") {
                    const badgeText = `${ann.marks}`;
                    ctx.font = `bold ${Math.round(11 * effScale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                    const textMetrics = ctx.measureText(badgeText);
                    const bW = textMetrics.width + 12 * effScale;
                    const bH = 18 * effScale;
                    const bX = x + 18 * effScale;
                    const bY = y;

                    ctx.fillStyle = "#DC2626";
                    ctx.beginPath();
                    ctx.roundRect(bX, bY - bH / 2, bW, bH, [4 * effScale]);
                    ctx.fill();

                    ctx.fillStyle = "#FFFFFF";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(badgeText, bX + bW / 2, bY);
                }
                break;
            }

            case "circle":
                ctx.strokeStyle = ann.color || "#34C759";
                ctx.lineWidth = 3 * effScale;
                const rW = ((ann.width || 0.08) * canvasW * annScale) / 2;
                const rH = ((ann.height || 0.06) * canvasH * annScale) / 2;
                const cX = x + rW;
                const cY = y + rH;
                ctx.beginPath();
                ctx.ellipse(cX, cY, Math.max(rW, 10 * effScale), Math.max(rH, 10 * effScale), 0, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case "underline":
                ctx.strokeStyle = ann.color || "#FF3B30";
                ctx.lineWidth = 3 * effScale;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(ann.startX ? ann.startX * canvasW : x, ann.startY ? ann.startY * canvasH : y);
                ctx.lineTo(ann.endX ? ann.endX * canvasW : x + (ann.width || 0.1) * canvasW * annScale, ann.endY ? ann.endY * canvasH : y);
                ctx.stroke();
                break;

            case "highlight":
                ctx.fillStyle = ann.color || "#FFCC00";
                ctx.globalAlpha = 0.35;
                ctx.fillRect(x, y, (ann.width || 0.1) * canvasW * annScale, (ann.height || 0.04) * canvasH * annScale);
                break;

            case "arrow":
                ctx.strokeStyle = ann.color || "#FF9500";
                ctx.fillStyle = ann.color || "#FF9500";
                ctx.lineWidth = 3.5 * effScale;
                const sx = (ann.startX !== undefined ? ann.startX : ann.x) * canvasW;
                const sy = (ann.startY !== undefined ? ann.startY : ann.y) * canvasH;
                const ex = (ann.endX !== undefined ? ann.endX : ann.x + 0.08 * annScale) * canvasW;
                const ey = (ann.endY !== undefined ? ann.endY : ann.y + 0.05 * annScale) * canvasH;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();

                // Arrow head
                const angle = Math.atan2(ey - sy, ex - sx);
                const headLen = 14 * effScale;
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                break;

            case "comment":
                const text = ann.text || "Note";
                const fontSize = Math.max(12, 14 * effScale);
                ctx.font = `400 ${fontSize}px system-ui, -apple-system, sans-serif`;
                const textMetrics = ctx.measureText(text);
                const pad = 8 * effScale;
                const boxW = textMetrics.width + pad * 2 + 18 * effScale;
                const boxH = fontSize + pad * 2;

                ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
                ctx.shadowBlur = 6 * effScale;
                ctx.shadowOffsetY = 2 * effScale;
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = ann.color || "#007AFF";
                ctx.lineWidth = 2 * effScale;

                const r = 6 * effScale;
                ctx.beginPath();
                ctx.roundRect(x, y, boxW, boxH, [r]);
                ctx.fill();
                ctx.shadowColor = "transparent";
                ctx.stroke();

                ctx.fillStyle = ann.color || "#007AFF";
                ctx.beginPath();
                ctx.arc(x + 10 * effScale, y + boxH / 2, 4 * effScale, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#0F172A";
                ctx.textBaseline = "middle";
                ctx.fillText(text, x + 20 * effScale, y + boxH / 2);
                break;

            case "marks":
                const markText = ann.text || "+1";
                const mFontSize = Math.max(14, 16 * effScale);
                ctx.font = `400 ${mFontSize}px system-ui, -apple-system, sans-serif`;
                const mWidth = ctx.measureText(markText).width + 18 * effScale;
                const mHeight = mFontSize + 14 * effScale;

                ctx.fillStyle = ann.color || "#34C759";
                ctx.beginPath();
                ctx.roundRect(x - mWidth / 2, y - mHeight / 2, mWidth, mHeight, [8 * effScale]);
                ctx.fill();

                ctx.fillStyle = "#FFFFFF";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(markText, x, y);
                break;

            case "margin_mark":
            case "left_mark": {
                // Question Total Mark Stamp - COMPACT & NEAT
                const markVal = ann.marks !== undefined ? ann.marks : (ann.text || "");
                const qLabel = ann.qLabel || (ann.qNo ? `Q${ann.qNo}` : "");
                const col = ann.color || "#DC2626"; // Teacher Red Ink

                const scoreText = qLabel ? `${qLabel}: ${markVal}M` : `${markVal}M`;
                const numFontSize = Math.max(11, Math.round(13 * effScale));

                ctx.font = `600 ${numFontSize}px system-ui, -apple-system, sans-serif`;
                const textMetrics = ctx.measureText(scoreText);
                const bPadX = 6 * effScale;
                const bPadY = 3 * effScale;
                const bW = textMetrics.width + bPadX * 2;
                const bH = numFontSize + bPadY * 2;

                // Render at the exact x coordinate of the annotation (where cursor was placed)
                const markX = (ann.x !== undefined && ann.x !== null ? ann.x : 0.08) * canvasW;

                // Neat pill badge on paper sheet
                ctx.shadowColor = "rgba(220, 38, 38, 0.14)";
                ctx.shadowBlur = 4 * effScale;
                ctx.shadowOffsetY = 1 * effScale;
                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.roundRect(markX - bW / 2, y - bH / 2, bW, bH, [bH / 2]);
                ctx.fill();

                ctx.shadowColor = "transparent";
                ctx.lineWidth = 1.5 * effScale;
                ctx.strokeStyle = col;
                ctx.stroke();

                ctx.fillStyle = col;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(scoreText, markX, y);
                break;
            }

            case "pen":
                if (ann.points && ann.points.length > 1) {
                    ctx.strokeStyle = ann.color || "#FF3B30";
                    ctx.lineWidth = (ann.width || 3) * effScale;
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";
                    ctx.beginPath();
                    ctx.moveTo(ann.points[0].x * canvasW, ann.points[0].y * canvasH);
                    for (let p = 1; p < ann.points.length; p++) {
                        ctx.lineTo(ann.points[p].x * canvasW, ann.points[p].y * canvasH);
                    }
                    ctx.stroke();
                }
                break;
        }

        ctx.restore();
    }
}

window.CanvasEngine = CanvasEngine;

