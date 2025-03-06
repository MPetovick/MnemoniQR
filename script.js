const STITCH_TYPES = new Map([
    ['cadeneta', { symbol: '#', color: '#e74c3c', desc: 'Cadena' }],
    ['punt_baix', { symbol: '•', color: '#2ecc71', desc: 'Bajo' }],
    ['punt_pla', { symbol: '-', color: '#3498db', desc: 'Plano' }],
    ['punt_mitja', { symbol: '●', color: '#f1c40f', desc: 'Medio' }],
    ['punt_alt', { symbol: '↑', color: '#9b59b6', desc: 'Alto' }],
    ['punt_doble_alt', { symbol: '⇑', color: '#e67e22', desc: 'Doble' }],
    ['picot', { symbol: '¤', color: '#1abc9c', desc: 'Picot' }]
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
        this.spacing = 50;
    }

    updateStitch(ring, segment) {
        if (ring >= this.rings.length) this.addRing();
        this.rings[ring].stitches[segment] = this.selectedStitch;
    }

    addRing() {
        const last = this.rings[this.rings.length - 1];
        this.rings.push({
            segments: last.segments * 2,
            stitches: Array(last.segments * 2).fill(this.selectedStitch)
        });
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
        this.ctx.save();
        this.ctx.translate(
            this.canvas.width/2 + state.offset.x, 
            this.canvas.height/2 + state.offset.y
        );
        this.ctx.scale(state.scale, state.scale);

        // Dibujar cuadrícula
        this.ctx.strokeStyle = '#eee';
        state.rings.forEach((_, i) => {
            const radius = (i + 1) * state.spacing;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });

        // Dibujar puntos
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '18px Arial';
        
        state.rings.forEach((ring, ringIdx) => {
            const radius = (ringIdx + 0.5) * state.spacing;
            const angleStep = (Math.PI * 2) / ring.segments;
            
            ring.stitches.forEach((stitch, segmentIdx) => {
                const angle = angleStep * segmentIdx;
                const { symbol, color } = STITCH_TYPES.get(stitch);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                this.ctx.fillStyle = color;
                this.ctx.fillText(symbol, x, y);
            });
        });
        
        this.ctx.restore();
    }
}

class InputManager {
    constructor(canvas, state, renderer) {
        this.canvas = canvas;
        this.state = state;
        this.renderer = renderer;
        this.init();
    }

    init() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleZoom(e));
        this.setupDrag();
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.state.offset.x - this.canvas.width/2) / this.state.scale;
        const y = (e.clientY - rect.top - this.state.offset.y - this.canvas.height/2) / this.state.scale;
        
        const ring = Math.floor(Math.sqrt(x**2 + y**2) / this.state.spacing);
        const angle = Math.atan2(y, x) + Math.PI;
        const segment = Math.floor((angle / (Math.PI * 2)) * 8);

        this.state.updateStitch(ring, segment);
        this.renderer.render(this.state);
    }

    handleZoom(e) {
        e.preventDefault();
        this.state.scale = Math.min(3, Math.max(0.5, this.state.scale + (e.deltaY > 0 ? -0.1 : 0.1)));
        this.renderer.render(this.state);
    }

    setupDrag() {
        let dragging = false;
        let lastPos = { x: 0, y: 0 };

        this.canvas.addEventListener('mousedown', (e) => {
            dragging = true;
            lastPos = { x: e.clientX, y: e.clientY };
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            this.state.offset.x += e.clientX - lastPos.x;
            this.state.offset.y += e.clientY - lastPos.y;
            lastPos = { x: e.clientX, y: e.clientY };
            this.renderer.render(this.state);
        });

        document.addEventListener('mouseup', () => dragging = false);
    }
}

class UIController {
    constructor(state) {
        this.state = state;
        this.init();
    }

    init() {
        const container = document.querySelector('.stitch-buttons');
        
        STITCH_TYPES.forEach((stitch, key) => {
            const button = document.createElement('button');
            button.className = 'stitch-button';
            button.innerHTML = `
                <span class="stitch-symbol">${stitch.symbol}</span>
                <span class="stitch-label">${stitch.desc}</span>
            `;
            button.style.color = stitch.color;
            
            button.addEventListener('click', () => {
                document.querySelectorAll('.stitch-button').forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                this.state.selectedStitch = key;
            });

            container.appendChild(button);
        });

        document.getElementById('reset').addEventListener('click', () => {
            this.state.reset();
            document.querySelector('.stitch-button').classList.add('active');
        });

        document.querySelector('.stitch-button').classList.add('active');
    }
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
    const state = new PatternState();
    const canvas = document.getElementById('patternCanvas');
    const renderer = new CanvasRenderer(canvas);
    new InputManager(canvas, state, renderer);
    new UIController(state);
    renderer.render(state);
});
