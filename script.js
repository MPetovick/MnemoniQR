// Constantes globales
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
    rings: [{ segments: 8, points: Array(8).fill('cadeneta') }],
    history: [],
    historyIndex: -1,
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

// Clase para manejar el estado del patrón
class PatternState {
    constructor() {
        this.state = structuredClone(DEFAULT_STATE);
        this.commitHistory();
    }

    commitHistory() {
        this.state.history = this.state.history.slice(0, ++this.state.historyIndex);
        this.state.history.push(this.cloneState());
        if (this.state.history.length > 100) this.state.history.shift();
    }

    cloneState() {
        return structuredClone({
            ...this.state,
            rings: this.state.rings.map(r => ({
                ...r,
                points: [...r.points]
            }))
        });
    }

    reset() {
        this.state = structuredClone(DEFAULT_STATE);
        this.commitHistory();
    }

    modifyRings(modifier) {
        modifier(this.state.rings);
        this.commitHistory();
        this.adjustRingStructure();
    }

    adjustRingStructure() {
        for (let i = 1; i < this.state.rings.length; i++) {
            const prevSegments = this.state.rings[i - 1].segments;
            if (this.state.rings[i].segments !== prevSegments * 2) {
                this.state.rings[i].segments = prevSegments * 2;
                this.state.rings[i].points = Array(prevSegments * 2)
                    .fill(this.state.selectedStitch);
            }
        }
    }

    updateGuideLines(value) {
        this.state.guideLines = value;
        this.modifyRings(rings => {
            rings[0].segments = value;
            rings[0].points = Array(value).fill('cadeneta');
        });
    }

    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            this.state = structuredClone(this.state.history[this.state.historyIndex]);
            return true;
        }
        return false;
    }

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            this.state = structuredClone(this.state.history[this.state.historyIndex]);
            return true;
        }
        return false;
    }
}

// Clase para manejar el renderizado en el canvas
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
    }

    resize() {
        const { width, height } = this.canvas.parentElement.getBoundingClientRect();
        Object.assign(this.canvas, { width, height });
    }

    render(state, mousePos = null) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.applyTransform(state);
        this.drawRings(state);
        this.drawStitches(state);
        if (mousePos) this.drawHover(state, mousePos);
        this.ctx.restore();
    }

    applyTransform({ scale, offset }) {
        const centerX = this.canvas.width / 2 + offset.x;
        const centerY = this.canvas.height / 2 + offset.y;
        this.ctx.setTransform(scale, 0, 0, scale, centerX, centerY);
    }

    drawRings({ rings, ringSpacing }) {
        this.ctx.strokeStyle = '#ddd';
        rings.forEach((_, i) => {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, (i + 1) * ringSpacing, 0, Math.PI * 2);
            this.ctx.stroke();
        });
    }

    drawStitches({ rings, ringSpacing, guideLines }) {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '20px Arial';

        rings.forEach((ring, ringIndex) => {
            const radius = (ringIndex + 0.5) * ringSpacing;
            ring.points.forEach((stitch, segment) => {
                const [type, operation] = stitch.split('_');
                const angle = (segment * 2 * Math.PI) / ring.segments + Math.PI / ring.segments;
                const { symbol, color } = STITCH_TYPES.get(type);
                
                this.ctx.fillStyle = color;
                this.ctx.fillText(
                    operation ? (operation === 'increase' ? '▿' : '▵') : symbol,
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius
                );
            });
        });

        this.drawGuideLines(rings, ringSpacing, guideLines);
    }

    drawGuideLines(rings, ringSpacing, guideLines) {
        this.ctx.strokeStyle = '#eee';
        this.ctx.beginPath();
        const maxRadius = rings.length * ringSpacing;
        const angleStep = (2 * Math.PI) / guideLines;
        
        for (let i = 0; i < guideLines; i++) {
            const angle = i * angleStep;
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(Math.cos(angle) * maxRadius, Math.sin(angle) * maxRadius);
        }
        this.ctx.stroke();
    }

    drawHover(state, [x, y]) {
        const { ring, segment } = this.getHoverPosition(state, x, y);
        if (ring === -1) return;

        const { symbol, color } = STITCH_TYPES.get(state.selectedStitch);
        const radius = (ring + 0.5) * state.ringSpacing;
        const angle = (segment * 2 * Math.PI) / state.rings[ring].segments + Math.PI / state.rings[ring].segments;
        
        this.ctx.fillStyle = color + '80';
        this.ctx.fillText(symbol, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    getHoverPosition({ rings, ringSpacing }, x, y) {
        const distance = Math.hypot(x, y);
        const ring = Math.floor(distance / ringSpacing);
        if (ring < 0 || ring >= rings.length) return { ring: -1, segment: -1 };

        const angle = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
        const segment = Math.floor(angle * rings[ring].segments / (Math.PI * 2));
        return { ring, segment };
    }

    exportAsImage(state, projectName) {
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        const maxRadius = state.rings.length * state.ringSpacing;
        const padding = 100;
        const canvasSize = Math.max(800, (maxRadius * 2) + padding * 2);

        exportCanvas.width = canvasSize;
        exportCanvas.height = canvasSize + 200;
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        exportCtx.save();
        exportCtx.translate(canvasSize / 2, canvasSize / 2);
        this.drawRingsOnContext(exportCtx, state);
        this.drawStitchesOnContext(exportCtx, state);
        exportCtx.restore();

        this.drawLegendOnCanvas(exportCtx, padding, canvasSize + 20);

        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${projectName || 'patron_crochet'}.png`;
        link.href = dataUrl;
        link.click();
    }

    drawRingsOnContext(ctx, state) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        state.rings.forEach((_, r) => {
            const radius = (r + 1) * state.ringSpacing;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    drawStitchesOnContext(ctx, state) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '20px Arial';
        
        state.rings.forEach((ring, ringIndex) => {
            const radius = (ringIndex + 0.5) * state.ringSpacing;
            ring.points.forEach((stitch, segment) => {
                const [type, operation] = stitch.split('_');
                const angle = (segment * 2 * Math.PI) / ring.segments + Math.PI / ring.segments;
                const { symbol, color } = STITCH_TYPES.get(type);
                
                ctx.fillStyle = color;
                ctx.fillText(
                    operation ? (operation === 'increase' ? '▿' : '▵') : symbol,
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius
                );
            });
        });
    }

    drawLegendOnCanvas(ctx, x, y) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('Leyenda de puntadas:', x, y);
        y += 20;

        STITCH_TYPES.forEach((stitch) => {
            ctx.fillStyle = stitch.color;
            ctx.fillText(`${stitch.symbol} - ${stitch.desc}`, x, y);
            y += 20;
        });

        ctx.fillStyle = '#000';
        ctx.fillText('▿ - Aumento', x, y);
        y += 20;
        ctx.fillText('▵ - Disminución', x, y);
    }

    generatePDF(state, projectName) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;

        // Título
        doc.setFontSize(18);
        doc.text(projectName || 'Patrón de Crochet', pageWidth / 2, margin + 10, { align: 'center' });

        // Leyenda
        let y = margin + 25;
        doc.setFontSize(12);
        STITCH_TYPES.forEach((stitch) => {
            doc.setTextColor(stitch.color);
            doc.text(`${stitch.symbol} - ${stitch.desc}`, margin, y);
            y += 8;
        });
        doc.setTextColor(0);
        doc.text('▿ - Aumento', margin, y);
        y += 8;
        doc.text('▵ - Disminución', margin, y);

        // Patrón
        const maxRadius = state.rings.length * state.ringSpacing;
        const scale = Math.min(contentWidth / (maxRadius * 2), (pageHeight - y - margin) / (maxRadius * 2));
        const centerX = pageWidth / 2;
        const centerY = y + (maxRadius * scale) + margin;

        state.rings.forEach((ring, ringIndex) => {
            const radius = (ringIndex + 1) * state.ringSpacing * scale;
            doc.setDrawColor(200);
            doc.circle(centerX, centerY, radius, 'S');
        });

        doc.save(`${projectName || 'patron_crochet'}.pdf`);
    }
}

// Clase para manejar la interacción del usuario
class InputManager {
    constructor(canvas, state, renderer) {
        this.canvas = canvas;
        this.state = state;
        this.renderer = renderer;
        this.mousePos = [0, 0];
        this.initEvents();
    }

    initEvents() {
        const events = [
            ['mousedown', e => this.startDrag(e)],
            ['mousemove', e => this.handleMove(e)],
            ['click', e => this.handleClick(e)],
            ['wheel', e => this.handleZoom(e.deltaY < 0 ? 1.1 : 0.9)],
            ['touchstart', e => this.handleTouch(e)],
            ['touchmove', e => this.handleTouch(e)],
            ['touchend', () => this.endDrag()]
        ];

        events.forEach(([type, handler]) => 
            this.canvas.addEventListener(type, e => {
                e.preventDefault();
                handler(e);
            })
        );
    }

    getCanvasCoords({ clientX, clientY }) {
        const rect = this.canvas.getBoundingClientRect();
        return [
            (clientX - rect.left - this.canvas.width/2 - this.state.offset.x) / this.state.scale,
            (clientY - rect.top - this.canvas.height/2 - this.state.offset.y) / this.state.scale
        ];
    }

    handleMove(e) {
        this.mousePos = this.getCanvasCoords(e);
        this.renderer.render(this.state.state, this.mousePos);
    }

    handleClick(e) {
        const { ring, segment } = this.renderer.getHoverPosition(this.state.state, ...this.mousePos);
        if (ring === -1) return;

        const operation = e.shiftKey ? 'increase' : e.ctrlKey ? 'decrease' : null;
        const stitch = operation ? `${this.state.state.selectedStitch}_${operation}` : this.state.state.selectedStitch;

        this.state.modifyRings(rings => {
            rings[ring].points[segment] = stitch;
            if (operation === 'increase' && ring === rings.length - 1) {
                rings.push({
                    segments: rings[ring].segments * 2,
                    points: Array(rings[ring].segments * 2).fill(stitch)
                });
            }
        });
    }

    handleZoom(factor) {
        this.state.state.targetScale = Math.max(0.3, Math.min(3, this.state.state.scale * factor));
        this.animate();
    }

    startDrag(e) {
        this.state.state.isDragging = true;
        this.state.state.lastPos = [e.clientX, e.clientY];
    }

    animate() {
        const { scale, targetScale, offset, targetOffset } = this.state.state;
        if (Math.abs(scale - targetScale) > 0.01 || Math.hypot(offset.x - targetOffset.x, offset.y - targetOffset.y) > 1) {
            this.state.state.scale += (targetScale - scale) * 0.1;
            this.state.state.offset.x += (targetOffset.x - offset.x) * 0.1;
            this.state.state.offset.y += (targetOffset.y - offset.y) * 0.1;
            requestAnimationFrame(() => this.animate());
        }
        this.renderer.render(this.state.state);
    }

    handleTouch(e) {
        if (e.touches.length === 1) {
            this.handleMove(e.touches[0]);
        } else if (e.touches.length === 2) {
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this.handleZoom(this.state.state.pinchDistance ? distance / this.state.state.pinchDistance : 1);
            this.state.state.pinchDistance = distance;
        }
    }

    endDrag() {
        this.state.state.isDragging = false;
        this.state.state.pinchDistance = null;
    }
}

// Clase para manejar la interfaz de usuario
class UIController {
    constructor(state, renderer) {
        this.state = state;
        this.renderer = renderer;
        this.currentProject = null;
        this.initUI();
    }

    initUI() {
        this.createStitchPalette();
        this.bindControls();
        this.setupProjectManagement();
        this.setupExportButtons();
    }

    createStitchPalette() {
        const container = document.querySelector('#stitchPalette');
        container.innerHTML = '';
        
        STITCH_TYPES.forEach((stitch, key) => {
            const btn = document.createElement('button');
            btn.className = 'stitch-btn';
            btn.innerHTML = stitch.symbol;
            btn.style.color = stitch.color;
            btn.title = stitch.desc;
            btn.onclick = () => {
                this.state.state.selectedStitch = key;
                container.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            container.appendChild(btn);
        });
    }

    bindControls() {
        const controls = {
            '#guideLines': (v) => this.state.updateGuideLines(parseInt(v)),
            '#ringSpacing': (v) => this.state.state.ringSpacing = parseInt(v),
            '#undoBtn': () => this.state.undo() && this.renderer.render(this.state.state),
            '#redoBtn': () => this.state.redo() && this.renderer.render(this.state.state),
            '#resetView': () => {
                this.state.state.targetScale = 1;
                this.state.state.targetOffset = { x: 0, y: 0 };
                this.renderer.render(this.state.state);
            }
        };

        Object.entries(controls).forEach(([selector, handler]) => {
            const el = document.querySelector(selector);
            if (el) el.addEventListener('input', e => handler(e.target.value));
        });
    }

    setupProjectManagement() {
        const projects = JSON.parse(localStorage.getItem('crochetProjects') || '{}');
        const loadSelect = document.querySelector('#loadProjects');
        
        loadSelect.innerHTML = '<option value="">Cargar proyecto...</option>' +
            Object.keys(projects).map(name => 
                `<option value="${name}">${name}</option>`
            ).join('');

        document.querySelector('#saveBtn').addEventListener('click', () => this.saveProject());
        document.querySelector('#newBtn').addEventListener('click', () => this.newProject());
        loadSelect.addEventListener('change', (e) => this.loadProject(e.target.value));
    }

    saveProject() {
        const projectName = prompt('Nombre del proyecto:', this.currentProject || `Patrón ${new Date().toLocaleDateString()}`);
        if (!projectName) return;

        const projects = JSON.parse(localStorage.getItem('crochetProjects') || {});
        projects[projectName] = this.state.state;
        localStorage.setItem('crochetProjects', JSON.stringify(projects));
        this.currentProject = projectName;
        alert('Proyecto guardado correctamente');
    }

    newProject() {
        if (confirm('¿Estás seguro de comenzar un nuevo proyecto?')) {
            this.state.reset();
            this.currentProject = null;
            this.renderer.render(this.state.state);
        }
    }

    loadProject(projectName) {
        const projects = JSON.parse(localStorage.getItem('crochetProjects') || '{}');
        if (projects[projectName]) {
            this.state.state = structuredClone(projects[projectName]);
            this.currentProject = projectName;
            this.renderer.render(this.state.state);
        }
    }

    setupExportButtons() {
        document.querySelector('#exportPng').addEventListener('click', () => 
            this.renderer.exportAsImage(this.state.state, this.currentProject)
        );
        
        document.querySelector('#exportPdf').addEventListener('click', () => 
            this.renderer.generatePDF(this.state.state, this.currentProject)
        );
    }
}

// Clase principal que coordina las subclases
class CrochetEditor {
    constructor() {
        this.state = new PatternState();
        this.renderer = new CanvasRenderer(document.querySelector('#patternCanvas'));
        this.ui = new UIController(this.state, this.renderer);
        new InputManager(this.renderer.canvas, this.state, this.renderer);
        this.renderer.render(this.state.state);
    }
}

// Inicializar la aplicación
window.addEventListener('DOMContentLoaded', () => new CrochetEditor());
