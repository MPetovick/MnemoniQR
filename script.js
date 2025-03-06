// Utilidades
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const debounce = (fn, wait) => {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), wait); };
};

// Constantes
const STITCH_TYPES = new Map([
    ['cadeneta', { symbol: '#', color: '#e74c3c', desc: 'Cadena base' }],
    ['punt_baix', { symbol: '•', color: '#2ecc71', desc: 'Punto bajo' }],
    ['punt_pla', { symbol: '-', color: '#3498db', desc: 'Punto plano' }],
    ['punt_mitja', { symbol: '●', color: '#f1c40f', desc: 'Punto medio' }],
    ['punt_alt', { symbol: '↑', color: '#9b59b6', desc: 'Punto alto' }],
    ['punt_doble_alt', { symbol: '⇑', color: '#e67e22', desc: 'Punto doble alto' }],
    ['picot', { symbol: '¤', color: '#1abc9c', desc: 'Picot decorativo' }]
]);

const DEFAULT_STATE = {
    rings: [
        { segments: 8, points: Array(8).fill('cadeneta') }, // Anillo 0
        { segments: 8, points: [] }                         // Anillo 1
    ],
    history: [],
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

// Clase Estado
class PatternState {
    constructor() { this.state = structuredClone(DEFAULT_STATE); this.saveState(); }
    reset() { 
        this.state = structuredClone(DEFAULT_STATE); 
        this.state.rings[0].points = Array(this.state.guideLines).fill('cadeneta');
        this.saveState(); 
    }
    saveState() {
        if (this.state.historyIndex < this.state.history.length - 1) this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        this.state.history.push(structuredClone(this.state.rings));
        this.state.historyIndex++;
        if (this.state.history.length > 100) this.state.history.shift();
    }
    undo() { if (this.state.historyIndex <= 0) return false; this.state.rings = structuredClone(this.state.history[--this.state.historyIndex]); return true; }
    redo() { if (this.state.historyIndex >= this.state.history.length - 1) return false; this.state.rings = structuredClone(this.state.history[++this.state.historyIndex]); return true; }
    setRings(rings) { this.state.rings = structuredClone(rings); this.saveState(); }
    updateGuideLines(v) { 
        this.state.guideLines = clamp(v, 4, 24); 
        this.state.rings[0].segments = this.state.guideLines; 
        this.state.rings[0].points = Array(this.state.guideLines).fill('cadeneta');
        if (this.state.rings.length > 1) this.state.rings[1].segments = this.state.guideLines; 
        this.saveState(); 
    }
    updateRingSpacing(v) { this.state.ringSpacing = clamp(v, 30, 80); }
    addRing() { this.state.rings.push({ segments: this.state.rings.at(-1)?.segments || this.state.guideLines, points: [] }); this.saveState(); }
    increasePoints(ringIdx, segIdx) { if (ringIdx + 1 < this.state.rings.length) this.state.rings[ringIdx + 1].segments++; this.saveState(); }
    decreasePoints(ringIdx, segIdx) { if (ringIdx + 1 < this.state.rings.length && this.state.rings[ringIdx + 1].segments > this.state.guideLines) this.state.rings[ringIdx + 1].segments--; this.saveState(); }
}

// Clase Renderizado
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
    }
    resize() {
        const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
        this.canvas.width = w * devicePixelRatio;
        this.canvas.height = h * devicePixelRatio;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    render(state, mouseX = null, mouseY = null) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateTransform(state);
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(state.scale, state.scale);
        this.ctx.translate(state.offset.x, state.offset.y);
        this.drawRings(state);
        this.drawStitches(state);
        if (mouseX !== null && mouseY !== null) this.drawHover(state, mouseX, mouseY);
        this.ctx.restore();
    }
    updateTransform(state) {
        state.scale += (state.targetScale - state.scale) * 0.2;
        state.offset.x += (state.targetOffset.x - state.offset.x) * 0.2;
        state.offset.y += (state.targetOffset.y - state.offset.y) * 0.2;
        const maxOffset = Math.max(this.canvas.width, this.canvas.height) / (2 * state.scale) - state.rings.length * state.ringSpacing;
        state.targetOffset.x = clamp(state.targetOffset.x, -maxOffset, maxOffset);
        state.targetOffset.y = clamp(state.targetOffset.y, -maxOffset, maxOffset);
    }
    drawRings(state) {
        this.ctx.lineWidth = 1 / state.scale;
        this.ctx.strokeStyle = '#ddd';
        state.rings.forEach((_, r) => { 
            this.ctx.beginPath(); 
            this.ctx.arc(0, 0, (r + 1) * state.ringSpacing, 0, Math.PI * 2); 
            this.ctx.stroke(); 
        });
        this.ctx.strokeStyle = '#eee';
        const segments = state.guideLines, angleStep = Math.PI * 2 / segments, maxRadius = state.rings.length * state.ringSpacing;
        this.ctx.beginPath();
        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep, x = Math.cos(angle) * maxRadius, y = Math.sin(angle) * maxRadius;
            this.ctx.moveTo(0, 0); this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }
    drawStitches(state) {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = `${20 / state.scale}px Arial`;
        state.rings.forEach((ring, rIdx) => {
            const segments = ring.segments, angleStep = Math.PI * 2 / segments, radius = (rIdx + 0.5) * state.ringSpacing;
            ring.points.forEach((type, sIdx) => {
                if (sIdx >= segments) return;
                const angle = sIdx * angleStep + (angleStep / 2), x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
                const { stitchType, symbol, isSpecial } = this.parseStitch(type);
                if (STITCH_TYPES.has(stitchType)) {
                    this.ctx.fillStyle = STITCH_TYPES.get(stitchType).color;
                    this.ctx.fillText(symbol, x, y);
                    if (isSpecial) {
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, 5 / state.scale, 0, Math.PI * 2);
                        this.ctx.strokeStyle = '#ff0000';
                        this.ctx.stroke();
                    }
                }
            });
        });
    }
    drawHover(state, mouseX, mouseY) {
        const { ring, segment } = this.getRingSegment(state, mouseX, mouseY);
        if (ring >= 0 && ring < state.rings.length) {
            const segments = state.rings[ring].segments, angleStep = Math.PI * 2 / segments, radius = (ring + 0.5) * state.ringSpacing;
            const angle = segment * angleStep + (angleStep / 2), x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
            const stitch = STITCH_TYPES.get(state.selectedStitch);
            this.ctx.fillStyle = stitch.color + '80';
            this.ctx.fillText(stitch.symbol, x, y);
        }
    }
    getRingSegment(state, x, y) {
        const distance = Math.sqrt(x * x + y * y), ring = Math.floor(distance / state.ringSpacing);
        if (ring < 0 || ring >= state.rings.length) return { ring: -1, segment: -1 };
        const segments = state.rings[ring].segments, angle = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
        return { ring, segment: Math.floor((angle / (Math.PI * 2)) * segments) % segments };
    }
    parseStitch(type) {
        let stitchType = type, symbol = STITCH_TYPES.get(type)?.symbol || '', isSpecial = false;
        if (type.includes('_increase')) { stitchType = type.replace('_increase', ''); symbol = '▿'; isSpecial = true; }
        else if (type.includes('_decrease')) { stitchType = type.replace('_decrease', ''); symbol = '▵'; isSpecial = true; }
        return { stitchType, symbol, isSpecial };
    }
    exportAsImage(state, name) {
        const exportCanvas = document.createElement('canvas'), ctx = exportCanvas.getContext('2d');
        const maxRadius = state.rings.length * state.ringSpacing, padding = 100, size = Math.max(800, maxRadius * 2 + padding * 2);
        exportCanvas.width = size; exportCanvas.height = size + 200;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size + 200);
        ctx.save(); ctx.translate(size / 2, size / 2);
        this.drawRings(ctx, state, 1); this.drawStitches(ctx, state, 1);
        ctx.restore(); this.drawLegend(ctx, padding, size + 20);
        const link = document.createElement('a');
        link.download = `${name || 'patron_crochet'}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }
    drawRings(ctx, state, scale) { this.drawRings(state); }
    drawStitches(ctx, state, scale) { this.drawStitches(state); }
    drawLegend(ctx, x, y) {
        ctx.font = '16px Arial'; ctx.fillStyle = '#000'; ctx.textAlign = 'left';
        ctx.fillText('Leyenda:', x, y); y += 20;
        for (const [, s] of STITCH_TYPES) { ctx.fillStyle = s.color; ctx.fillText(`${s.symbol} - ${s.desc}`, x, y); y += 20; }
        ctx.fillStyle = '#000'; ctx.fillText('▿ - Aumento', x, y); y += 20; ctx.fillText('▵ - Disminución', x, y);
    }
}

// Clase Entrada
class InputHandler {
    constructor(canvas, state, renderer) {
        this.canvas = canvas;
        this.state = state;
        this.renderer = renderer;
        this.isAnimating = false;
        this.bindEvents();
    }
    bindEvents() {
        const events = [
            ['click', e => this.handleClick(e)],
            ['mousemove', e => this.handleMouseMove(e)],
            ['wheel', e => { e.preventDefault(); this.adjustZoom(e.deltaY > 0 ? -0.1 : 0.1); }, { passive: false }],
            ['mousedown', e => this.startDrag(e)],
            ['touchstart', e => this.handleTouchStart(e), { passive: false }],
            ['touchmove', debounce(e => this.handleTouchMove(e), 16), { passive: false }],
            ['touchend', e => this.handleTouchEnd(e)]
        ];
        events.forEach(([ev, fn, opts]) => this.canvas.addEventListener(ev, fn, opts));
        document.addEventListener('mousemove', debounce(e => this.handleDrag(e), 16));
        document.addEventListener('mouseup', () => this.endDrag());
        document.addEventListener('keydown', e => this.handleKeyDown(e));
        window.addEventListener('resize', debounce(() => this.renderer.resize(), 100));
    }
    handleClick(e) {
        const [x, y] = this.getCoords(e);
        const { ring, segment } = this.renderer.getRingSegment(this.state.state, x, y);
        if (ring >= 0 && ring < this.state.state.rings.length && segment < this.state.state.rings[ring].segments) {
            const ringData = this.state.state.rings[ring];
            if (e.shiftKey && ring < this.state.state.rings.length - 1) this.state.increasePoints(ring, segment);
            else if (e.ctrlKey && ring < this.state.state.rings.length - 1) this.state.decreasePoints(ring, segment);
            else ringData.points[segment] = this.state.state.selectedStitch;
            this.state.saveState();
            this.renderer.render(this.state.state);
        }
    }
    handleMouseMove(e) { this.renderer.render(this.state.state, ...this.getCoords(e)); }
    startDrag(e) {
        this.state.state.isDragging = true;
        this.state.state.lastPos = { x: e.clientX, y: e.clientY };
        this.animate();
    }
    handleDrag(e) {
        if (!this.state.state.isDragging) return;
        const deltaX = (e.clientX - this.state.state.lastPos.x) / this.state.state.scale;
        const deltaY = (e.clientY - this.state.state.lastPos.y) / this.state.state.scale;
        this.state.state.targetOffset.x += deltaX;
        this.state.state.targetOffset.y += deltaY;
        this.state.state.lastPos = { x: e.clientX, y: e.clientY };
    }
    endDrag() { this.state.state.isDragging = false; this.isAnimating = false; }
    handleTouchStart(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1) this.startDrag(touches[0]);
        else if (touches.length === 2) this.state.state.pinchDistance = this.getPinchDistance(touches);
    }
    handleTouchMove(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1 && this.state.state.isDragging) this.handleDrag(touches[0]);
        else if (touches.length === 2) {
            const newDist = this.getPinchDistance(touches);
            if (this.state.state.pinchDistance) this.adjustZoom((newDist - this.state.state.pinchDistance) * 0.005);
            this.state.state.pinchDistance = newDist;
        }
    }
    handleTouchEnd(e) { if (e.touches.length === 0) { this.endDrag(); this.state.state.pinchDistance = null; } }
    getPinchDistance(touches) { const dx = touches[0].clientX - touches[1].clientX, dy = touches[0].clientY - touches[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
    getCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return [
            (e.clientX - rect.left - this.canvas.width / 2) / this.state.state.scale - this.state.state.offset.x,
            (e.clientY - rect.top - this.canvas.height / 2) / this.state.state.scale - this.state.state.offset.y
        ];
    }
    handleKeyDown(e) {
        if (e.ctrlKey) {
            if (e.key === 'z' && this.state.undo()) this.renderer.render(this.state.state);
            else if (e.key === 'y' && this.state.redo()) this.renderer.render(this.state.state);
            else if (e.key === 's') e.preventDefault();
        } else if (e.key === '+') this.adjustZoom(0.2);
        else if (e.key === '-') this.adjustZoom(-0.2);
    }
    adjustZoom(amount) { this.state.state.targetScale = clamp(this.state.state.targetScale + amount, 0.3, 3); this.animate(); }
    resetView() { this.state.state.targetScale = 1; this.state.state.targetOffset = { x: 0, y: 0 }; this.state.state.offset = { x: 0, y: 0 }; this.renderer.render(this.state.state); }
    animate() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            const loop = () => {
                this.renderer.render(this.state.state);
                if (this.state.state.isDragging || Math.abs(this.state.state.scale - this.state.state.targetScale) > 0.01) {
                    requestAnimationFrame(loop);
                } else {
                    this.isAnimating = false;
                }
            };
            requestAnimationFrame(loop);
        }
    }
}

// Clase UI
class UIController {
    constructor(state, renderer, inputHandler) {
        this.state = state;
        this.renderer = renderer;
        this.inputHandler = inputHandler;
        this.currentProjectName = null;
        this.logoContainer = document.getElementById('logoContainer');
        this.canvas = document.getElementById('patternCanvas');
        // Estado inicial: logo visible, canvas oculto
        this.logoContainer.style.display = 'block';
        this.canvas.style.display = 'none';
        this.setupUI();
    }
    setupUI() {
        this.bindButtons([
            ['newBtn', () => this.newProject()],
            ['saveBtn', () => this.saveProject()],
            ['saveAsBtn', () => this.saveProjectAs()],
            ['undoBtn', () => this.state.undo() && this.renderer.render(this.state.state)],
            ['redoBtn', () => this.state.redo() && this.renderer.render(this.state.state)],
            ['zoomIn', () => this.inputHandler.adjustZoom(0.2)],
            ['zoomOut', () => this.inputHandler.adjustZoom(-0.2)],
            ['resetView', () => this.inputHandler.resetView()],
            ['stitchHelpBtn', e => this.toggleTooltip(e)],
            ['exportTxt', () => this.exportText()],
            ['exportPng', () => this.renderer.exportAsImage(this.state.state, this.currentProjectName)],
            ['exportPdf', () => this.exportPDF()],
            ['addRingBtn', () => { this.state.addRing(); this.updateRingCounter(); this.renderer.render(this.state.state); }]
        ]);
        this.bindRange('guideLines', v => this.state.updateGuideLines(v), 'guideLinesValue', v => v);
        this.bindRange('ringSpacing', v => this.state.updateRingSpacing(v), 'ringSpacingValue', v => `${v}px`);
        this.setupStitchPalette();
        this.updateRingCounter();
    }
    bindButtons(buttons) { buttons.forEach(([id, fn]) => document.getElementById(id)?.addEventListener('click', fn)); }
    bindRange(id, fn, valueId, format) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const v = parseInt(el.value);
            fn(v);
            document.getElementById(valueId).textContent = format(v);
            this.renderer.render(this.state.state);
        });
    }
    newProject() { 
        this.state.reset(); 
        this.currentProjectName = null; 
        // Ocultar logo y mostrar canvas
        this.logoContainer.style.display = 'none'; 
        this.canvas.style.display = 'block'; 
        this.renderer.resize();
        this.renderer.render(this.state.state); 
        this.updateUI(); 
    }
    saveProject() {
        this.currentProjectName = this.currentProjectName || `Patrón ${new Date().toLocaleDateString()}`;
        const projects = this.getProjects();
        projects[this.currentProjectName] = this.state.state.rings;
        localStorage.setItem('crochetProjects', JSON.stringify(projects));
        this.loadProjects();
        alert(`Guardado: "${this.currentProjectName}"`);
    }
    saveProjectAs() {
        const name = prompt('Nombre:', this.currentProjectName || `Patrón ${new Date().toLocaleDateString()}`);
        if (name) { this.currentProjectName = name; this.saveProject(); }
    }
    loadFromLocalStorage() {
        const saved = localStorage.getItem('crochetPattern');
        if (saved) { 
            this.state.setRings(JSON.parse(saved)); 
            // Solo ocultar logo si hay datos guardados
            this.logoContainer.style.display = 'none'; 
            this.canvas.style.display = 'block'; 
            this.renderer.render(this.state.state); 
            this.updateUI(); 
        } else {
            // Mostrar logo si no hay datos
            this.logoContainer.style.display = 'block';
            this.canvas.style.display = 'none';
        }
    }
    getProjects() { return JSON.parse(localStorage.getItem('crochetProjects') || '{}'); }
    loadProjects() {
        const projects = this.getProjects(), select = document.getElementById('loadProjects');
        select.innerHTML = '<option value="">Cargar...</option>' + Object.keys(projects).map(n => `<option value="${n}" ${n === this.currentProjectName ? 'selected' : ''}>${n}</option>`).join('');
        select.onchange = () => {
            if (select.value) {
                this.state.setRings(structuredClone(projects[select.value]));
                this.currentProjectName = select.value;
                this.logoContainer.style.display = 'none'; 
                this.canvas.style.display = 'block'; 
                this.renderer.resize(); // Añadido para consistencia
                this.renderer.render(this.state.state);
                this.updateUI();
            } else {
                // Si se selecciona "Cargar..." (valor vacío), volver al logo
                this.state.reset();
                this.currentProjectName = null;
                this.logoContainer.style.display = 'block';
                this.canvas.style.display = 'none';
            }
        };
    }
    exportText() {
        const text = this.state.state.rings.map((r, ri) => r.points.map((t, si) => {
            let desc = STITCH_TYPES.get(t.replace(/(_increase|_decrease)/, ''))?.desc || 'Desconocido';
            if (t.includes('_increase')) desc += ' (Aumento)';
            else if (t.includes('_decrease')) desc += ' (Disminución)';
            return `Anillo ${ri + 1}, Segmento ${si}: ${desc}`;
        }).join('\n')).join('\n') || 'Patrón vacío';
        document.getElementById('exportText').value = text;
        const blob = new Blob([text], { type: 'text/plain' }), link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.currentProjectName || 'patron_crochet'}.txt`;
        link.click();
    }
    exportPDF() {
        const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const w = doc.internal.pageSize.width, h = doc.internal.pageSize.height, m = 15;
        doc.setFontSize(18); doc.setTextColor('#2c3e50');
        doc.text(this.currentProjectName || 'Patrón de Crochet', w / 2, m + 10, { align: 'center' });
        let y = m + 25; doc.setFontSize(12); doc.setTextColor('#000');
        doc.text('Leyenda:', m, y); y += 10;
        for (const [, s] of STITCH_TYPES) { doc.setTextColor(s.color); doc.text(`${s.symbol} - ${s.desc}`, m + 5, y); y += 8; }
        doc.setTextColor('#000'); doc.text('▿ - Aumento', m + 5, y); y += 8; doc.text('▵ - Disminución', m + 5, y); y += 10;
        const maxR = this.state.state.rings.length * this.state.state.ringSpacing, scale = Math.min((w - 2 * m) / (maxR * 2), (h - y - m) / (maxR * 2));
        doc.setDrawColor('#ddd'); doc.setLineWidth(0.2);
        this.state.state.rings.forEach((r, ri) => {
            const rMM = (ri + 1) * this.state.state.ringSpacing * scale * 0.0353;
            doc.circle(w / 2, y + (h - y) / 2, rMM);
            const s = r.segments, aStep = Math.PI * 2 / s, sR = (ri + 0.5) * this.state.state.ringSpacing * scale * 0.0353;
            r.points.forEach((t, si) => {
                if (si >= s) return;
                const a = si * aStep + aStep / 2, x = w / 2 + Math.cos(a) * sR, yPos = y + (h - y) / 2 + Math.sin(a) * sR;
                const { stitchType, symbol } = this.renderer.parseStitch(t);
                if (STITCH_TYPES.has(stitchType)) { doc.setTextColor(STITCH_TYPES.get(stitchType).color); doc.setFontSize(12 * scale); doc.text(symbol, x, yPos, { align: 'center', baseline: 'middle' }); }
            });
        });
        doc.save(`${this.currentProjectName || 'patron_crochet'}.pdf`);
    }
    setupStitchPalette() {
        const palette = document.getElementById('stitchPalette');
        palette.innerHTML = [...STITCH_TYPES].map(([k, s], i) => `<button class="stitch-btn ${i === 0 ? 'active' : ''}" style="color:${s.color}" title="${s.desc}" data-key="${k}">${s.symbol}</button>`).join('');
        palette.querySelectorAll('.stitch-btn').forEach(btn => btn.onclick = () => {
            this.state.state.selectedStitch = btn.dataset.key;
            palette.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.renderer.render(this.state.state);
        });
    }
    toggleTooltip(e) {
        const tooltip = document.getElementById('stitchTooltip');
        if (tooltip.classList.contains('hidden')) {
            tooltip.innerHTML = [...STITCH_TYPES].map(([, s]) => `<span style="color:${s.color}">${s.symbol}</span> - ${s.desc}`).join('<br>') + '<br><span>▿</span> - Aumento<br><span>▵</span> - Disminución';
            const rect = e.target.getBoundingClientRect();
            tooltip.style.left = `${rect.right + 5}px`;
            tooltip.style.top = `${rect.top - 5}px`;
            tooltip.classList.remove('hidden');
        } else tooltip.classList.add('hidden');
    }
    updateRingCounter() {
        const btn = document.getElementById('addRingBtn');
        btn.innerHTML = `<span class="ring-counter">${this.state.state.rings.length}</span>`;
    }
    updateUI() {
        document.getElementById('undoBtn').disabled = this.state.state.historyIndex === 0;
        document.getElementById('redoBtn').disabled = this.state.state.historyIndex === this.state.history.length - 1;
        this.updateRingCounter();
        document.getElementById('exportText').value = this.state.state.rings.map((r, ri) => r.points.map((t, si) => {
            let desc = STITCH_TYPES.get(t.replace(/(_increase|_decrease)/, ''))?.desc || 'Desconocido';
            if (t.includes('_increase')) desc += ' (Aumento)';
            else if (t.includes('_decrease')) desc += ' (Disminución)';
            return `Anillo ${ri + 1}, Segmento ${si}: ${desc}`;
        }).join('\n')).join('\n') || 'Patrón vacío';
    }
}

// Clase Principal
class CrochetEditor {
    constructor() {
        this.state = new PatternState();
        this.renderer = new CanvasRenderer(document.getElementById('patternCanvas'));
        this.inputHandler = new InputHandler(this.renderer.canvas, this.state, this.renderer);
        this.ui = new UIController(this.state, this.renderer, this.inputHandler);
        this.ui.loadProjects();
        this.ui.loadFromLocalStorage();
        // No renderizamos inicialmente para mostrar el logo
    }
}

window.addEventListener('DOMContentLoaded', () => new CrochetEditor());