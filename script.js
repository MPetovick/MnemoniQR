class CrochetEditor {
    constructor() {
        this.STITCH_TYPES = new Map([
            ['cadeneta', { symbol: '#', color: '#e74c3c', desc: 'Cadena base' }],
            ['punt_baix', { symbol: '•', color: '#2ecc71', desc: 'Punto bajo' }],
            ['punt_pla', { symbol: '-', color: '#3498db', desc: 'Punto plano' }],
            ['punt_mitja', { symbol: '●', color: '#f1c40f', desc: 'Punto medio' }],
            ['punt_alt', { symbol: '↑', color: '#9b59b6', desc: 'Punto alto' }],
            ['punt_doble_alt', { symbol: '⇑', color: '#e67e22', desc: 'Punto doble alto' }],
            ['picot', { symbol: '¤', color: '#1abc9c', desc: 'Picot decorativo' }]
        ]);

        this.DEFAULT_STATE = {
            rings: [{ segments: 8, points: [] }],
            history: [[]],
            historyIndex: 0,
            scale: 1,
            targetScale: 1,
            offset: { x: 0, y: 0 },
            targetOffset: { x: 0, y: 0 },
            selectedStitch: 'punt_baix',
            guideLines: 8,
            ringSpacing: 50,
            isDragging: false,
            lastPos: { x: 0, y: 0 },
            pinchDistance: null
        };

        this.canvas = null;
        this.ctx = null;
        this.state = null;
        this.currentProjectName = null;
        this.tooltip = null;

        this.initialize();
    }

    initialize() {
        this.setupCanvas();
        this.resetState();
        this.setupEventListeners();
        this.setupStitchPalette();
        this.loadProjects();
        this.loadFromLocalStorage();
        this.render();
    }

    setupCanvas() {
        this.canvas = document.getElementById('patternCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }

    resetState() {
        this.state = { ...this.DEFAULT_STATE };
        this.state.rings[0].points = Array(this.state.guideLines).fill('cadeneta');
        this.state.history = [this.cloneRings()];
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.render();
    }

    setupEventListeners() {
        const eventMap = [
            { el: this.canvas, ev: 'click', fn: this.handleCanvasClick.bind(this) },
            { el: this.canvas, ev: 'mousemove', fn: this.handleMouseMove.bind(this) },
            { el: this.canvas, ev: 'wheel', fn: this.handleWheel.bind(this), opts: { passive: false } },
            { el: this.canvas, ev: 'mousedown', fn: this.startDrag.bind(this) },
            { el: document, ev: 'mousemove', fn: this.debounce(this.handleDrag.bind(this), 16) },
            { el: document, ev: 'mouseup', fn: this.endDrag.bind(this) },
            { el: this.canvas, ev: 'touchstart', fn: this.handleTouchStart.bind(this), opts: { passive: false } },
            { el: this.canvas, ev: 'touchmove', fn: this.debounce(this.handleTouchMove.bind(this), 16), opts: { passive: false } },
            { el: this.canvas, ev: 'touchend', fn: this.handleTouchEnd.bind(this) },
            { el: this.canvas, ev: 'touchcancel', fn: this.endDrag.bind(this) },
            { el: document, ev: 'keydown', fn: this.handleKeyDown.bind(this) },
            { el: window, ev: 'resize', fn: this.resizeCanvas.bind(this) }
        ];

        eventMap.forEach(({ el, ev, fn, opts }) => el.addEventListener(ev, fn, opts));

        this.setupButtonListeners();
        this.setupInputListeners();
    }

    setupButtonListeners() {
        const buttonMap = [
            { id: 'newBtn', fn: this.newProject.bind(this) },
            { id: 'saveBtn', fn: this.saveProject.bind(this) },
            { id: 'saveAsBtn', fn: this.saveProjectAs.bind(this) },
            { id: 'undoBtn', fn: this.undo.bind(this) },
            { id: 'redoBtn', fn: this.redo.bind(this) },
            { id: 'zoomIn', fn: () => this.adjustZoom(0.2) },
            { id: 'zoomOut', fn: () => this.adjustZoom(-0.2) },
            { id: 'resetView', fn: this.resetView.bind(this) },
            { id: 'stitchHelpBtn', fn: this.toggleStitchTooltip.bind(this) },
            { id: 'exportTxt', fn: this.exportAsText.bind(this) },
            { id: 'exportPng', fn: this.exportAsImage.bind(this) },
            { id: 'exportPdf', fn: this.generatePDF.bind(this) }
        ];

        buttonMap.forEach(({ id, fn }) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', fn);
        });
    }

    setupInputListeners() {
        const guideLines = document.getElementById('guideLines');
        if (guideLines) {
            guideLines.addEventListener('input', () => {
                this.state.guideLines = parseInt(guideLines.value);
                this.state.rings[0].segments = this.state.guideLines;
                this.state.rings[0].points = Array(this.state.guideLines).fill('cadeneta');
                document.getElementById('guideLinesValue').textContent = this.state.guideLines;
                this.render();
            });
        }

        const ringSpacing = document.getElementById('ringSpacing');
        if (ringSpacing) {
            ringSpacing.addEventListener('input', () => {
                this.state.ringSpacing = parseInt(ringSpacing.value);
                document.getElementById('ringSpacingValue').textContent = `${this.state.ringSpacing}px`;
                this.render();
            });
        }
    }

    handleKeyDown(e) {
        if (e.ctrlKey) {
            if (e.key === 'z') this.undo();
            else if (e.key === 'y') this.redo();
            else if (e.key === 's') {
                e.preventDefault();
                this.saveProject();
            }
        } else if (e.key === 'n') this.newProject();
        else if (e.key === '+') this.adjustZoom(0.2);
        else if (e.key === '-') this.adjustZoom(-0.2);
    }

    handleCanvasClick(e) {
        const { x, y } = this.getCanvasCoordinates(e);
        const { ring, segment } = this.getRingAndSegment(x, y);

        if (ring >= 0 && ring < this.state.rings.length) {
            if (e.shiftKey) this.increasePoints(ring, segment);
            else if (e.ctrlKey) this.decreasePoints(ring, segment);
            else this.state.rings[ring].points[segment] = this.state.selectedStitch;
            this.saveState();
            this.render();
        }
    }

    increasePoints(ringIndex, segmentIndex) {
        const nextRingIndex = ringIndex + 1;
        const currentRing = this.state.rings[ringIndex];
        
        if (nextRingIndex >= this.state.rings.length) {
            this.state.rings.push({
                segments: currentRing.segments,
                points: currentRing.points.map(() => this.state.selectedStitch)
            });
        }

        const nextRing = this.state.rings[nextRingIndex];
        nextRing.segments += 1;
        const newPoint = `${this.state.selectedStitch}_increase`;
        nextRing.points.splice(segmentIndex + 1, 0, newPoint);

        this.propagateSegmentChange(nextRingIndex);
        this.saveState();
    }

    decreasePoints(ringIndex, segmentIndex) {
        const nextRingIndex = ringIndex + 1;
        if (nextRingIndex >= this.state.rings.length || this.state.rings[nextRingIndex].segments <= this.state.guideLines) {
            return;
        }

        const nextRing = this.state.rings[nextRingIndex];
        nextRing.segments -= 1;
        const combinedPoint = `${this.state.selectedStitch}_decrease`;
        nextRing.points.splice(segmentIndex, 2, combinedPoint);

        this.propagateSegmentChange(nextRingIndex);
        this.saveState();
    }

    propagateSegmentChange(startIndex) {
        const targetSegments = this.state.rings[startIndex].segments;
        for (let i = startIndex + 1; i < this.state.rings.length; i++) {
            const ring = this.state.rings[i];
            const diff = ring.segments - targetSegments;
            if (diff > 0) {
                ring.segments = targetSegments;
                ring.points.splice(targetSegments);
            } else if (diff < 0) {
                ring.segments = targetSegments;
                const pointsToAdd = targetSegments - ring.points.length;
                ring.points.push(...Array(pointsToAdd).fill(this.state.selectedStitch));
            }
        }
    }

    handleMouseMove(e) {
        const { x, y } = this.getCanvasCoordinates(e);
        this.render(x, y);
    }

    handleWheel(e) {
        e.preventDefault();
        this.adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
    }

    startDrag(e) {
        this.state.isDragging = true;
        this.state.lastPos = { x: e.clientX, y: e.clientY };
    }

    handleDrag(e) {
        if (!this.state.isDragging) return;
        const deltaX = e.clientX - this.state.lastPos.x;
        const deltaY = e.clientY - this.state.lastPos.y;
        this.state.targetOffset.x += deltaX;
        this.state.targetOffset.y += deltaY;
        this.state.lastPos = { x: e.clientX, y: e.clientY };
        this.animate();
    }

    endDrag() {
        this.state.isDragging = false;
        this.state.offset.x = this.state.targetOffset.x;
        this.state.offset.y = this.state.targetOffset.y;
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1) this.startDrag(touches[0]);
        else if (touches.length === 2) {
            this.state.pinchDistance = this.getPinchDistance(touches);
            this.state.isDragging = false;
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1 && this.state.isDragging) this.handleDrag(touches[0]);
        else if (touches.length === 2) {
            const newDistance = this.getPinchDistance(touches);
            if (this.state.pinchDistance) this.adjustZoom((newDistance - this.state.pinchDistance) * 0.005);
            this.state.pinchDistance = newDistance;
        }
    }

    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.endDrag();
            this.state.pinchDistance = null;
        }
    }

    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.state.offset.x - this.canvas.width / 2) / this.state.scale,
            y: (e.clientY - rect.top - this.state.offset.y - this.canvas.height / 2) / this.state.scale
        };
    }

    getRingAndSegment(x, y) {
        const distance = Math.sqrt(x * x + y * y);
        const ring = Math.round(distance / this.state.ringSpacing) - 1;
        if (ring < 0 || ring >= this.state.rings.length) return { ring: -1, segment: -1 };
        
        const segments = this.state.rings[ring].segments;
        const angle = Math.atan2(y, x) + Math.PI * 2;
        const segment = Math.round((angle / (Math.PI * 2)) * segments) % segments;
        return { ring, segment };
    }

    render(mouseX = null, mouseY = null) {
        requestAnimationFrame(() => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.updateTransform();
            this.applyTransform();

            this.drawRings();
            this.drawStitches();
            if (mouseX !== null && mouseY !== null) this.drawHoverEffect(mouseX, mouseY);

            this.ctx.restore();
            this.updateUI();
        });
    }

    updateTransform() {
        this.state.offset.x += (this.state.targetOffset.x - this.state.offset.x) * 0.1;
        this.state.offset.y += (this.state.targetOffset.y - this.state.offset.y) * 0.1;
        this.state.scale += (this.state.targetScale - this.state.scale) * 0.1;
    }

    applyTransform() {
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2 + this.state.offset.x, this.canvas.height / 2 + this.state.offset.y);
        this.ctx.scale(this.state.scale, this.state.scale);
    }

    drawRings() {
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1 / this.state.scale;
        for (let r = 0; r < this.state.rings.length; r++) {
            const radius = (r + 1) * this.state.ringSpacing;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            this.drawGuideLines(r);
            this.drawIntersectionPoints(r);
        }
    }

    drawGuideLines(ringIndex) {
        const segments = this.state.rings[ringIndex].segments;
        const angleStep = Math.PI * 2 / segments;
        const maxRadius = this.state.rings.length * this.state.ringSpacing;
        this.ctx.strokeStyle = '#eee';
        this.ctx.beginPath();
        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * maxRadius;
            const y = Math.sin(angle) * maxRadius;
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }

    drawIntersectionPoints(ringIndex) {
        const segments = this.state.rings[ringIndex].segments;
        const angleStep = Math.PI * 2 / segments;
        this.ctx.fillStyle = '#000';
        for (let i = 0; i < segments; i++) {
            if (!this.state.rings[ringIndex].points[i]) {
                const angle = i * angleStep;
                const x = Math.cos(angle) * (ringIndex + 1) * this.state.ringSpacing;
                const y = Math.sin(angle) * (ringIndex + 1) * this.state.ringSpacing;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2 / this.state.scale, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    drawStitches() {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = `${20 / this.state.scale}px Arial`;
        this.state.rings.forEach((ring, ringIndex) => {
            const segments = ring.segments;
            const angleStep = Math.PI * 2 / segments;
            ring.points.forEach((type, segmentIndex) => {
                const angle = segmentIndex * angleStep;
                const x = Math.cos(angle) * (ringIndex + 1) * this.state.ringSpacing;
                const y = Math.sin(angle) * (ringIndex + 1) * this.state.ringSpacing;
                let stitchType = type;
                let isSpecial = false;

                if (type.includes('_increase')) {
                    stitchType = type.replace('_increase', '');
                    isSpecial = true;
                    this.ctx.fillStyle = this.STITCH_TYPES.get(stitchType).color;
                    this.ctx.fillText(this.STITCH_TYPES.get(stitchType).symbol + '+', x, y);
                } else if (type.includes('_decrease')) {
                    stitchType = type.replace('_decrease', '');
                    isSpecial = true;
                    this.ctx.fillStyle = this.STITCH_TYPES.get(stitchType).color;
                    this.ctx.fillText(this.STITCH_TYPES.get(stitchType).symbol + '-', x, y);
                } else {
                    this.ctx.fillStyle = this.STITCH_TYPES.get(type).color;
                    this.ctx.fillText(this.STITCH_TYPES.get(type).symbol, x, y);
                }

                if (isSpecial) {
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 5 / this.state.scale, 0, Math.PI * 2);
                    this.ctx.strokeStyle = '#ff0000';
                    this.ctx.lineWidth = 1 / this.state.scale;
                    this.ctx.stroke();
                }
            });
        });
    }

    drawHoverEffect(mouseX, mouseY) {
        const { ring, segment } = this.getRingAndSegment(mouseX, mouseY);
        if (ring >= 0 && ring < this.state.rings.length) {
            const segments = this.state.rings[ring].segments;
            const angleStep = Math.PI * 2 / segments;
            const angle = segment * angleStep;
            const x = Math.cos(angle) * (ring + 1) * this.state.ringSpacing;
            const y = Math.sin(angle) * (ring + 1) * this.state.ringSpacing;
            const stitch = this.STITCH_TYPES.get(this.state.selectedStitch);
            this.ctx.fillStyle = stitch.color + '80';
            this.ctx.fillText(stitch.symbol, x, y);
        }
    }

    updateUI() {
        document.getElementById('undoBtn').disabled = this.state.historyIndex === 0;
        document.getElementById('redoBtn').disabled = this.state.historyIndex === this.state.history.length - 1;
        this.updateExportPreview();
    }

    animate() {
        this.render();
        if (this.needsAnimation()) requestAnimationFrame(this.animate.bind(this));
    }

    needsAnimation() {
        return (
            Math.abs(this.state.scale - this.state.targetScale) > 0.01 ||
            Math.abs(this.state.offset.x - this.state.targetOffset.x) > 1 ||
            Math.abs(this.state.offset.y - this.state.targetOffset.y) > 1
        );
    }

    adjustZoom(amount) {
        this.state.targetScale = Math.max(0.3, Math.min(3, this.state.targetScale + amount));
        this.animate();
    }

    resetView() {
        this.state.targetScale = 1;
        this.state.targetOffset = { x: 0, y: 0 };
        this.state.offset = { x: 0, y: 0 };
        this.animate();
    }

    saveState() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        }
        this.state.history.push(this.cloneRings());
        this.state.historyIndex++;
        if (this.state.history.length > 100) {
            this.state.history.shift();
            this.state.historyIndex--;
        }
    }

    cloneRings() {
        return JSON.parse(JSON.stringify(this.state.rings));
    }

    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            this.state.rings = this.cloneRingsFromHistory();
            this.render();
        }
    }

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            this.state.rings = this.cloneRingsFromHistory();
            this.render();
        }
    }

    cloneRingsFromHistory() {
        return JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
    }

    newProject() {
        this.state.rings = [{ segments: this.state.guideLines, points: Array(this.state.guideLines).fill('cadeneta') }];
        this.state.history = [this.cloneRings()];
        this.state.historyIndex = 0;
        this.currentProjectName = null;
        this.resetView();
    }

    saveProject() {
        const defaultName = `Patrón ${new Date().toLocaleDateString()}`;
        this.currentProjectName = this.currentProjectName || defaultName;
        const projects = this.getProjects();
        projects[this.currentProjectName] = this.state.rings;
        localStorage.setItem('crochetProjects', JSON.stringify(projects));
        this.loadProjects();
        alert(`Proyecto "${this.currentProjectName}" guardado!`);
    }

    saveProjectAs() {
        const suggestedName = this.currentProjectName || `Patrón ${new Date().toLocaleDateString()}`;
        const name = prompt('Nombre del proyecto:', suggestedName);
        if (name) {
            this.currentProjectName = name;
            const projects = this.getProjects();
            projects[name] = this.state.rings;
            localStorage.setItem('crochetProjects', JSON.stringify(projects));
            this.loadProjects();
            alert(`Proyecto "${name}" guardado!`);
        }
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('crochetPattern');
        if (saved) {
            this.state.rings = JSON.parse(saved);
            this.state.history = [this.cloneRings()];
            this.state.historyIndex = 0;
            this.currentProjectName = null;
            this.render();
        }
    }

    getProjects() {
        return JSON.parse(localStorage.getItem('crochetProjects') || '{}');
    }

    loadProjects() {
        const projects = this.getProjects();
        const select = document.getElementById('loadProjects');
        const controls = select.parentElement;
        const existingDeleteBtn = controls.querySelector('.delete-btn');
        if (existingDeleteBtn) existingDeleteBtn.remove();

        select.innerHTML = '<option value="">Cargar...</option>' +
            Object.keys(projects).map(name => 
                `<option value="${name}" ${name === this.currentProjectName ? 'selected' : ''}>${name}</option>`
            ).join('');

        select.onchange = () => {
            const deleteBtn = controls.querySelector('.delete-btn');
            if (deleteBtn) deleteBtn.remove();

            if (select.value) {
                this.state.rings = JSON.parse(JSON.stringify(projects[select.value]));
                this.state.history = [this.cloneRings()];
                this.state.historyIndex = 0;
                this.currentProjectName = select.value;
                this.render();

                const btn = document.createElement('button');
                btn.className = 'delete-btn';
                btn.innerHTML = '<i class="fas fa-trash"></i>';
                btn.title = 'Eliminar proyecto';
                btn.onclick = () => this.deleteProject(select.value);
                controls.insertBefore(btn, select.nextSibling);
            }
        };
    }

    deleteProject(projectName) {
        if (confirm(`¿Seguro que quieres eliminar el proyecto "${projectName}"?`)) {
            const projects = this.getProjects();
            delete projects[projectName];
            localStorage.setItem('crochetProjects', JSON.stringify(projects));
            this.loadProjects();
            this.newProject();
            alert(`Proyecto "${projectName}" eliminado.`);
        }
    }

    updateExportPreview() {
        const text = this.state.rings
            .map((ring, ringIndex) => 
                ring.points.map((type, segmentIndex) => {
                    let desc = this.STITCH_TYPES.get(type.replace(/(_increase|_decrease)/, '')).desc;
                    if (type.includes('_increase')) desc += ' (Aumento)';
                    else if (type.includes('_decrease')) desc += ' (Disminución)';
                    return `Anillo ${ringIndex + 1}, Segmento ${segmentIndex}: ${desc}`;
                }).join('\n')
            )
            .join('\n') || 'Patrón vacío';
        document.getElementById('exportText').value = text;
    }

    exportAsText() {
        this.updateExportPreview();
        const text = document.getElementById('exportText').value;
        const blob = new Blob([text], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.currentProjectName || 'patron_crochet'}.txt`;
        link.click();
    }

    exportAsImage() {
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        const maxRadius = this.state.rings.length * this.state.ringSpacing;
        const padding = 100;
        const canvasSize = Math.max(800, (maxRadius * 2) + padding * 2);

        exportCanvas.width = canvasSize;
        exportCanvas.height = canvasSize + 200;
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        exportCtx.save();
        exportCtx.translate(canvasSize / 2, canvasSize / 2);
        this.drawRingsOnContext(exportCtx, 1);
        this.drawStitchesOnContext(exportCtx, 1);
        exportCtx.restore();

        this.drawLegendOnCanvas(exportCtx, padding, canvasSize + 20);

        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${this.currentProjectName || 'patron_crochet'}.png`;
        link.href = dataUrl;
        link.click();
    }

    generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;

        this.addPDFTitle(doc, pageWidth, margin);
        const legendHeight = this.addPDFLegend(doc, margin);
        this.addPDFPattern(doc, pageWidth, pageHeight, margin, contentWidth, legendHeight);

        doc.save(`${this.currentProjectName || 'patron_crochet'}.pdf`);
    }

    addPDFTitle(doc, pageWidth, margin) {
        doc.setFontSize(18);
        doc.setTextColor('#2c3e50');
        doc.text(this.currentProjectName || 'Patrón de Crochet Radial', pageWidth / 2, margin + 10, { align: 'center' });
    }

    addPDFLegend(doc, margin) {
        doc.setFontSize(12);
        doc.setTextColor('#000000');
        let y = margin + 25;
        doc.text('Leyenda de puntadas:', margin, y);
        y += 10;

        for (const [, stitch] of this.STITCH_TYPES) {
            doc.setTextColor(stitch.color);
            doc.text(`${stitch.symbol} - ${stitch.desc}`, margin + 5, y);
            y += 8;
        }
        doc.setTextColor('#000000');
        return y;
    }

    addPDFPattern(doc, pageWidth, pageHeight, margin, contentWidth, legendHeight) {
        const maxRadius = this.state.rings.length * this.state.ringSpacing;
        const availableHeight = pageHeight - legendHeight - margin;
        const scale = Math.min(contentWidth / (maxRadius * 2), availableHeight / (maxRadius * 2));
        const centerX = pageWidth / 2;
        const centerY = legendHeight + (availableHeight / 2);

        doc.setDrawColor('#ddd');
        doc.setLineWidth(0.2);
        this.state.rings.forEach((ring, ringIndex) => {
            const radius = (ringIndex + 1) * this.state.ringSpacing * scale * 0.0353;
            doc.circle(centerX, centerY, radius);

            const segments = ring.segments;
            const angleStep = Math.PI * 2 / segments;
            ring.points.forEach((type, segmentIndex) => {
                const angle = segmentIndex * angleStep;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                let stitchType = type;
                let symbol = this.STITCH_TYPES.get(stitchType).symbol;

                if (type.includes('_increase')) {
                    stitchType = type.replace('_increase', '');
                    symbol = this.STITCH_TYPES.get(stitchType).symbol + '+';
                } else if (type.includes('_decrease')) {
                    stitchType = type.replace('_decrease', '');
                    symbol = this.STITCH_TYPES.get(stitchType).symbol + '-';
                } else {
                    symbol = this.STITCH_TYPES.get(stitchType).symbol;
                }

                doc.setTextColor(this.STITCH_TYPES.get(stitchType).color);
                doc.setFontSize(12 * scale);
                doc.text(symbol, x, y, { aline: 'center', baseline: 'middle' });
            });
        });

        this.addPDFGuideLines(doc, centerX, centerY, maxRadius, scale);
    }

    addPDFGuideLines(doc, centerX, centerY, maxRadius, scale) {
        doc.setDrawColor('#eee');
        const maxRadiusMM = maxRadius * scale * 0.0353;
        const angleStep = Math.PI * 2 / this.state.guideLines;
        for (let i = 0; i < this.state.guideLines; i++) {
            const angle = i * angleStep;
            const xEnd = centerX + Math.cos(angle) * maxRadiusMM;
            const yEnd = centerY + Math.sin(angle) * maxRadiusMM;
            doc.line(centerX, centerY, xEnd, yEnd);
        }
    }

    drawRingsOnContext(ctx, scale) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1 / scale;
        for (let r = 0; r < this.state.rings.length; r++) {
            const radius = (r + 1) * this.state.ringSpacing;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
            this.drawGuideLinesOnContext(ctx, r, scale);
            this.drawIntersectionPointsOnContext(ctx, r, scale);
        }
    }

    drawGuideLinesOnContext(ctx, ringIndex, scale) {
        const segments = this.state.rings[ringIndex].segments;
        const angleStep = Math.PI * 2 / segments;
        const maxRadius = this.state.rings.length * this.state.ringSpacing;
        ctx.strokeStyle = '#eee';
        ctx.beginPath();
        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * maxRadius;
            const y = Math.sin(angle) * maxRadius;
            ctx.moveTo(0, 0);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    drawIntersectionPointsOnContext(ctx, ringIndex, scale) {
        const segments = this.state.rings[ringIndex].segments;
        const angleStep = Math.PI * 2 / segments;
        ctx.fillStyle = '#000';
        for (let i = 0; i < segments; i++) {
            if (!this.state.rings[ringIndex].points[i]) {
                const angle = i * angleStep;
                const x = Math.cos(angle) * (ringIndex + 1) * this.state.ringSpacing;
                const y = Math.sin(angle) * (ringIndex + 1) * this.state.ringSpacing;
                ctx.beginPath();
                ctx.arc(x, y, 2 / scale, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawStitchesOnContext(ctx, scale) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${20 / scale}px Arial`;
        this.state.rings.forEach((ring, ringIndex) => {
            const segments = ring.segments;
            const angleStep = Math.PI * 2 / segments;
            ring.points.forEach((type, segmentIndex) => {
                const angle = segmentIndex * angleStep;
                const x = Math.cos(angle) * (ringIndex + 1) * this.state.ringSpacing;
                const y = Math.sin(angle) * (ringIndex + 1) * this.state.ringSpacing;
                let stitchType = type;
                let isSpecial = false;

                if (type.includes('_increase')) {
                    stitchType = type.replace('_increase', '');
                    isSpecial = true;
                    ctx.fillStyle = this.STITCH_TYPES.get(stitchType).color;
                    ctx.fillText(this.STITCH_TYPES.get(stitchType).symbol + '+', x, y);
                } else if (type.includes('_decrease')) {
                    stitchType = type.replace('_decrease', '');
                    isSpecial = true;
                    ctx.fillStyle = this.STITCH_TYPES.get(stitchType).color;
                    ctx.fillText(this.STITCH_TYPES.get(stitchType).symbol + '-', x, y);
                } else {
                    ctx.fillStyle = this.STITCH_TYPES.get(type).color;
                    ctx.fillText(this.STITCH_TYPES.get(type).symbol, x, y);
                }

                if (isSpecial) {
                    ctx.beginPath();
                    ctx.arc(x, y, 5 / scale, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 1 / scale;
                    ctx.stroke();
                }
            });
        });
    }

    drawLegendOnCanvas(ctx, x, y) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.fillText('Leyenda de puntadas:', x, y);
        y += 20;
        for (const [, stitch] of this.STITCH_TYPES) {
            ctx.fillStyle = stitch.color;
            ctx.fillText(`${stitch.symbol} - ${stitch.desc}`, x, y);
            y += 20;
        }
    }

    toggleStitchTooltip(e) {
        this.tooltip = this.tooltip || document.getElementById('stitchTooltip');
        if (this.tooltip.classList.contains('hidden')) {
            const content = Array.from(this.STITCH_TYPES)
                .map(([, stitch]) => `<span style="color: ${stitch.color}">${stitch.symbol}</span> - ${stitch.desc}`)
                .join('<br>');
            this.tooltip.innerHTML = content;

            const rect = e.target.getBoundingClientRect();
            this.tooltip.style.left = `${rect.right + 5}px`;
            this.tooltip.style.top = `${rect.top - 5}px`;
            this.tooltip.classList.remove('hidden');
        } else {
            this.tooltip.classList.add('hidden');
        }
    }

    setupStitchPalette() {
        const palette = document.getElementById('stitchPalette');
        if (!palette) return console.error('El elemento #stitchPalette no se encontró');

        palette.innerHTML = '';
        let isFirst = true;
        for (const [key, stitch] of this.STITCH_TYPES) {
            const btn = document.createElement('button');
            btn.className = 'stitch-btn';
            btn.innerHTML = stitch.symbol;
            btn.style.color = stitch.color;
            btn.title = stitch.desc;
            btn.onclick = () => {
                this.state.selectedStitch = key;
                palette.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            if (isFirst) {
                btn.classList.add('active');
                isFirst = false;
            }
            palette.appendChild(btn);
        }
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}

window.addEventListener('DOMContentLoaded', () => new CrochetEditor());
