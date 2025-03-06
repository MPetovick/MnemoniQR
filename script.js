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
        return structuredClone({...this.state, rings: this.state.rings.map(r => ({...r, points: [...r.points]}))});
    }

    reset() {
        this.state = structuredClone(DEFAULT_STATE);
        this.commitHistory();
    }

    modifyRings(modifier) {
        modifier(this.state.rings);
        this.commitHistory();
    }

    updateGuideLines(value) {
        this.state.guideLines = value;
        const baseRing = this.state.rings[0];
        baseRing.segments = value;
        baseRing.points = Array(value).fill('cadeneta');
    }
}

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
                this.ctx.fillText(operation ? (operation === 'increase' ? '▿' : '▵') : symbol, 
                    Math.cos(angle) * radius, 
                    Math.sin(angle) * radius
                );
            });
        });
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
}

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
            this.canvas.addEventListener(type, e => handler(e))
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
        this.renderer.render(this.state, this.mousePos);
    }

    handleClick(e) {
        const { ring, segment } = this.renderer.getHoverPosition(this.state, ...this.mousePos);
        if (ring === -1) return;

        const stitch = e.shiftKey ? `${this.state.selectedStitch}_increase` :
                     e.ctrlKey ? `${this.state.selectedStitch}_decrease` :
                     this.state.selectedStitch;

        this.state.modifyRings(rings => {
            rings[ring].points[segment] = stitch;
            if (e.shiftKey && ring === rings.length - 1) {
                rings.push({ segments: rings[ring].segments * 2, points: Array(rings[ring].segments * 2).fill(stitch) });
            }
        });
    }

    handleZoom(factor) {
        this.state.targetScale = Math.max(0.3, Math.min(3, this.state.scale * factor));
        this.animate();
    }

    startDrag(e) {
        this.state.isDragging = true;
        this.state.lastPos = [e.clientX, e.clientY];
    }

    animate() {
        const { scale, targetScale, offset, targetOffset } = this.state;
        if (Math.abs(scale - targetScale) > 0.01 || Math.hypot(offset.x - targetOffset.x, offset.y - targetOffset.y) > 1) {
            this.state.scale += (targetScale - scale) * 0.1;
            this.state.offset.x += (targetOffset.x - offset.x) * 0.1;
            this.state.offset.y += (targetOffset.y - offset.y) * 0.1;
            requestAnimationFrame(() => this.animate());
        }
        this.renderer.render(this.state);
    }

    handleTouch(e) {
        if (e.touches.length === 1) {
            this.handleMove(e.touches[0]);
        } else if (e.touches.length === 2) {
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this.handleZoom(this.state.pinchDistance ? distance / this.state.pinchDistance : 1);
            this.state.pinchDistance = distance;
        }
    }
}

class UIController {
    constructor(state, renderer) {
        this.state = state;
        this.renderer = renderer;
        this.initUI();
    }

    initUI() {
        this.createStitchPalette();
        this.bindControls({
            '#guideLines': v => this.state.updateGuideLines(v),
            '#ringSpacing': v => this.state.ringSpacing = v,
            '#undoBtn': () => this.state.historyIndex > 0 && this.state.historyIndex--,
            '#redoBtn': () => this.state.historyIndex < this.state.history.length - 1 && this.state.historyIndex++
        });
    }

    bindControls(controls) {
        Object.entries(controls).forEach(([selector, handler]) => {
            const el = document.querySelector(selector);
            if (el) el.addEventListener('input', e => handler(e.target.value));
        });
    }

    createStitchPalette() {
        const container = document.querySelector('#stitchPalette');
        STITCH_TYPES.forEach((stitch, key) => {
            const btn = Object.assign(document.createElement('button'), {
                className: 'stitch-btn',
                innerHTML: stitch.symbol,
                style: `color: ${stitch.color}`,
                onclick: () => this.state.selectedStitch = key
            });
            container.appendChild(btn);
        });
    }
}

class CrochetEditor {
    constructor() {
        this.state = new PatternState();
        this.renderer = new CanvasRenderer(document.querySelector('#patternCanvas'));
        this.ui = new UIController(this.state, this.renderer);
        new InputManager(this.renderer.canvas, this.state, this.renderer);
        this.renderer.render(this.state);
    }
}

new CrochetEditor();