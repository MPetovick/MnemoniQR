// 1. CONSTANTES Y CONFIGURACIÓN INICIAL
const STITCHES = {
    chain: { symbol: '⛓', color: '#e74c3c', desc: 'Cadeneta' },
    single: { symbol: '•', color: '#2ecc71', desc: 'Punto bajo' },
    double: { symbol: '↟', color: '#3498db', desc: 'Punto alto' }
};

const INITIAL_STATE = {
    rings: [{ segments: 8, stitches: Array(8).fill('chain') }],
    scale: 1,
    offset: { x: 0, y: 0 },
    selectedStitch: 'single',
    guides: 8,
    spacing: 40
};

// 2. GESTIÓN DEL ESTADO (SIMPLIFICADA)
class PatternState {
    constructor() {
        this.reset();
    }

    reset() {
        Object.assign(this, JSON.parse(JSON.stringify(INITIAL_STATE)));
    }

    addRing() {
        const lastRing = this.rings[this.rings.length - 1];
        this.rings.push({
            segments: lastRing.segments * 2,
            stitches: Array(lastRing.segments * 2).fill(this.selectedStitch)
        });
    }

    updateStitch(ringIdx, segmentIdx) {
        if (ringIdx >= this.rings.length) this.addRing();
        this.rings[ringIdx].stitches[segmentIdx] = this.selectedStitch;
    }
}

// 3. RENDERIZADO (CANVAS OPTIMIZADO)
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        this.lastRender = 0;
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    render(state) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Transformaciones
        this.ctx.save();
        this.ctx.translate(
            this.canvas.width/2 + state.offset.x, 
            this.canvas.height/2 + state.offset.y
        );
        this.ctx.scale(state.scale, state.scale);

        // Dibujado
        this.drawGrid(state);
        this.drawStitches(state);
        
        this.ctx.restore();
    }

    drawGrid(state) {
        this.ctx.strokeStyle = '#ddd';
        state.rings.forEach((_, i) => {
            const radius = (i + 1) * state.spacing;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
    }

    drawStitches(state) {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '18px Arial';
        
        state.rings.forEach((ring, ringIdx) => {
            const radius = (ringIdx + 0.5) * state.spacing;
            const angleStep = (Math.PI * 2) / ring.segments;
            
            ring.stitches.forEach((stitch, segmentIdx) => {
                const angle = angleStep * segmentIdx;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                this.ctx.fillStyle = STITCHES[stitch].color;
                this.ctx.fillText(STITCHES[stitch].symbol, x, y);
            });
        });
    }
}

// 4. MANEJO DE ENTRADA (ESENCIAL)
class InputManager {
    constructor(canvas, state, renderer) {
        this.canvas = canvas;
        this.state = state;
        this.renderer = renderer;
        this.isDragging = false;
        this.lastPos = { x: 0, y: 0 };

        this.setupEvents();
    }

    setupEvents() {
        this.canvas.addEventListener('click', e => this.handleClick(e));
        this.canvas.addEventListener('mousedown', e => this.startDrag(e));
        document.addEventListener('mousemove', e => this.handleDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());
        this.canvas.addEventListener('wheel', e => this.handleZoom(e));
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.state.offset.x - this.canvas.width/2) / this.state.scale;
        const mouseY = (e.clientY - rect.top - this.state.offset.y - this.canvas.height/2) / this.state.scale;
        
        const distance = Math.sqrt(mouseX**2 + mouseY**2);
        const ringIdx = Math.floor(distance / this.state.spacing);
        const angle = Math.atan2(mouseY, mouseX) + Math.PI;
        const segmentIdx = Math.floor((angle / (Math.PI * 2)) * this.state.guides);

        this.state.updateStitch(ringIdx, segmentIdx);
        this.renderer.render(this.state);
    }

    handleZoom(e) {
        e.preventDefault();
        this.state.scale += e.deltaY > 0 ? -0.1 : 0.1;
        this.state.scale = Math.min(3, Math.max(0.5, this.state.scale));
        this.renderer.render(this.state);
    }

    startDrag(e) {
        this.isDragging = true;
        this.lastPos = { x: e.clientX, y: e.clientY };
    }

    handleDrag(e) {
        if (!this.isDragging) return;
        this.state.offset.x += e.clientX - this.lastPos.x;
        this.state.offset.y += e.clientY - this.lastPos.y;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.renderer.render(this.state);
    }

    endDrag() {
        this.isDragging = false;
    }
}

// 5. INTERFAZ DE USUARIO (MÍNIMA)
class UIController {
    constructor(state, renderer) {
        this.state = state;
        this.renderer = renderer;
        this.initControls();
    }

    initControls() {
        document.getElementById('reset').addEventListener('click', () => {
            this.state.reset();
            this.renderer.render(this.state);
        });

        document.querySelectorAll('.stitch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.state.selectedStitch = btn.dataset.stitch;
                document.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
}

// INICIALIZACIÓN
window.addEventListener('DOMContentLoaded', () => {
    const state = new PatternState();
    const canvas = document.getElementById('patternCanvas');
    const renderer = new CanvasRenderer(canvas);
    new InputManager(canvas, state, renderer);
    new UIController(state, renderer);
    renderer.render(state);
});
