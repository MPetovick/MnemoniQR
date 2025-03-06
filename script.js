const STITCH_TYPES = new Map([
    ['cadeneta', { symbol: '#', color: '#e74c3c', desc: 'Cadena base' }],
    ['punt_baix', { symbol: '•', color: '#2ecc71', desc: 'Punto bajo' }],
    ['punt_pla', { symbol: '-', color: '#3498db', desc: 'Punto plano' }],
    ['punt_mitja', { symbol: '●', color: '#f1c40f', desc: 'Punto medio' }],
    ['punt_alt', { symbol: '↑', color: '#9b59b6', desc: 'Punto alto' }],
    ['punt_doble_alt', { symbol: '⇑', color: '#e67e22', desc: 'Punto doble alto' }],
    ['picot', { symbol: '¤', color: '#1abc9c', desc: 'Picot decorativo' }]
]);

class PatternState {
    constructor() {
        this.reset();
    }

    reset() {
        this.rings = [{ segments: 8, stitches: Array(8).fill('cadeneta') }];
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.selectedStitch = 'cadeneta';
        this.guides = 8;
        this.spacing = 50;
    }

    addRing() {
        const last = this.rings[this.rings.length - 1];
        this.rings.push({
            segments: last.segments * 2,
            stitches: Array(last.segments * 2).fill(this.selectedStitch)
        });
    }

    updateStitch(ringIdx, segmentIdx) {
        if (ringIdx >= this.rings.length) this.addRing();
        this.rings[ringIdx].stitches[segmentIdx] = this.selectedStitch;
    }
}

class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.render(this.state);
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
        this.ctx.font = '20px Arial';
        
        state.rings.forEach((ring, ringIdx) => {
            const radius = (ringIdx + 0.5) * state.spacing;
            const angleStep = (Math.PI * 2) / ring.segments;
            
            ring.stitches.forEach((stitch, segmentIdx) => {
                const angle = angleStep * segmentIdx;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const { symbol, color } = STITCH_TYPES.get(stitch);
                
                this.ctx.fillStyle = color;
                this.ctx.fillText(symbol, x, y);
            });
        });
    }
}

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

class UIController {
    constructor(state, renderer) {
        this.state = state;
        this.renderer = renderer;
        this.initControls();
    }

    initControls() {
        const palette = document.querySelector('.stitch-palette');
        
        // Generar botones dinámicamente
        STITCH_TYPES.forEach((stitch, key) => {
            const btn = document.createElement('button');
            btn.className = 'stitch-btn';
            btn.innerHTML = `
                <span class="stitch-symbol">${stitch.symbol}</span>
                <span class="stitch-label">${stitch.desc}</span>
            `;
            btn.style.setProperty('--stitch-color', stitch.color);
            btn.dataset.stitch = key;
            
            btn.addEventListener('click', () => {
                this.state.selectedStitch = key;
                document.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            
            palette.appendChild(btn);
        });

        // Activar primer botón
        palette.firstElementChild.classList.add('active');

        // Evento para reiniciar
        document.getElementById('reset').addEventListener('click', () => {
            this.state.reset();
            this.renderer.render(this.state);
        });
    }
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
    const state = new PatternState();
    const canvas = document.getElementById('patternCanvas');
    const renderer = new CanvasRenderer(canvas);
    new InputManager(canvas, state, renderer);
    new UIController(state, renderer);
    renderer.render(state);
});
