(function() {
    'use strict';
    
    const STITCH_TYPES = new Map([
        ['cadeneta', { symbol: '⛓', color: '#e74c3c', desc: 'Cadena base' }],
        ['punt_baix', { symbol: '•', color: '#2ecc71', desc: 'Punto bajo' }],
        ['punt_pla', { symbol: '─', color: '#3498db', desc: 'Punto plano' }],
        ['punt_alt', { symbol: '↑', color: '#9b59b6', desc: 'Punto alto' }]
    ]);

    class PatternState {
        constructor() {
            this.reset();
        }

        reset() {
            this.state = {
                rings: [{ segments: 8, points: Array(8).fill('') }],
                history: [],
                historyIndex: -1,
                scale: 1,
                offset: { x: 0, y: 0 },
                selectedStitch: 'punt_baix',
                guideLines: 8,
                ringSpacing: 50,
                needsRender: true
            };
            this.saveState();
        }

        saveState() {
            this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
            this.state.history.push(JSON.parse(JSON.stringify(this.state.rings)));
            this.state.historyIndex++;
        }

        updateGuideLines(value) {
            const newPoints = Array(value).fill('').map((_, i) => 
                i < this.state.rings[0].points.length ? this.state.rings[0].points[i] : ''
            );
            this.state.rings[0] = { segments: value, points: newPoints };
            this.saveState();
        }

        addStitch(ring, segment) {
            if (!this.state.rings[ring].points[segment]) {
                this.state.rings[ring].points[segment] = this.state.selectedStitch;
                this.saveState();
                return true;
            }
            return false;
        }

        removeStitch(ring, segment) {
            if (this.state.rings[ring].points[segment]) {
                this.state.rings[ring].points[segment] = '';
                this.saveState();
                return true;
            }
            return false;
        }
    }

    class CanvasRenderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.dpr = window.devicePixelRatio || 1;
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(canvas.parentElement);
        }

        resize() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width * this.dpr;
            this.canvas.height = rect.height * this.dpr;
            this.canvas.style.width = `${rect.width}px`;
            this.canvas.style.height = `${rect.height}px`;
            this.ctx.scale(this.dpr, this.dpr);
        }

        render(state, mousePos) {
            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Transformación principal
            this.ctx.translate(
                this.canvas.width / 2 + state.offset.x * this.dpr,
                this.canvas.height / 2 + state.offset.y * this.dpr
            );
            this.ctx.scale(state.scale, state.scale);

            this.drawGrid(state);
            this.drawStitches(state);
            
            if (mousePos) {
                this.drawHover(state, mousePos);
            }
            
            this.ctx.restore();
        }

        drawGrid(state) {
            this.ctx.strokeStyle = '#ddd';
            this.ctx.lineWidth = 1;
            
            // Anillos
            state.rings.forEach((_, i) => {
                const radius = (i + 1) * state.ringSpacing;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            });
            
            // Guías
            this.ctx.strokeStyle = '#eee';
            const angleStep = (Math.PI * 2) / state.guideLines;
            for (let i = 0; i < state.guideLines; i++) {
                const angle = i * angleStep;
                const x = Math.cos(angle) * state.rings.length * state.ringSpacing;
                const y = Math.sin(angle) * state.rings.length * state.ringSpacing;
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            }
        }

        drawStitches(state) {
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.font = '18px Arial';
            
            state.rings.forEach((ring, ringIndex) => {
                const radius = (ringIndex + 0.5) * state.ringSpacing;
                const angleStep = (Math.PI * 2) / ring.segments;
                
                ring.points.forEach((stitch, segment) => {
                    if (!stitch) return;
                    
                    const angle = segment * angleStep + angleStep / 2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    const { symbol, color } = STITCH_TYPES.get(stitch);
                    this.ctx.fillStyle = color;
                    this.ctx.fillText(symbol, x, y);
                });
            });
        }

        drawHover(state, [x, y]) {
            const matrix = this.ctx.getTransform().inverse();
            const tx = matrix.a * x + matrix.c * y + matrix.e;
            const ty = matrix.b * x + matrix.d * y + matrix.f;
            
            const distance = Math.sqrt(tx ** 2 + ty ** 2);
            const ring = Math.floor(distance / state.ringSpacing);
            
            if (ring >= 0 && ring < state.rings.length) {
                const angle = Math.atan2(ty, tx) + Math.PI * 2;
                const segment = Math.floor((angle / (Math.PI * 2)) * state.rings[ring].segments) % state.rings[ring].segments;
                
                if (!state.rings[ring].points[segment]) {
                    const radius = (ring + 0.5) * state.ringSpacing;
                    const angleStep = (Math.PI * 2) / state.rings[ring].segments;
                    const a = segment * angleStep + angleStep / 2;
                    
                    this.ctx.beginPath();
                    this.ctx.arc(
                        Math.cos(a) * radius,
                        Math.sin(a) * radius,
                        8, 0, Math.PI * 2
                    );
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    this.ctx.fill();
                }
            }
        }
    }

    class CrochetApp {
        constructor() {
            this.canvas = document.getElementById('patternCanvas');
            this.state = new PatternState();
            this.renderer = new CanvasRenderer(this.canvas);
            this.initEventListeners();
            this.animate();
        }

        animate() {
            requestAnimationFrame(() => {
                this.renderer.render(this.state.state, this.currentMousePos);
                this.animate();
            });
        }

        initEventListeners() {
            let isDragging = false;
            let lastPos = { x: 0, y: 0 };
            
            // Manejo de ratón
            this.canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                lastPos = { x: e.clientX, y: e.clientY };
            });
            
            window.addEventListener('mousemove', (e) => {
                this.currentMousePos = [e.clientX, e.clientY];
                
                if (isDragging) {
                    const dx = e.clientX - lastPos.x;
                    const dy = e.clientY - lastPos.y;
                    this.state.state.offset.x += dx;
                    this.state.state.offset.y += dy;
                    lastPos = { x: e.clientX, y: e.clientY };
                }
            });
            
            window.addEventListener('mouseup', () => isDragging = false);
            
            // Manejo de zoom
            this.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoom = e.deltaY > 0 ? 0.9 : 1.1;
                this.state.state.scale = Math.max(0.5, Math.min(3, this.state.state.scale * zoom));
            });
            
            // Botones de control
            document.getElementById('newBtn').addEventListener('click', () => {
                this.state.reset();
            });
            
            document.getElementById('zoomIn').addEventListener('click', () => {
                this.state.state.scale = Math.min(3, this.state.state.scale * 1.1);
            });
            
            document.getElementById('zoomOut').addEventListener('click', () => {
                this.state.state.scale = Math.max(0.5, this.state.state.scale * 0.9);
            });
            
            document.getElementById('resetView').addEventListener('click', () => {
                this.state.state.offset = { x: 0, y: 0 };
                this.state.state.scale = 1;
            });
        }
    }

    window.addEventListener('load', () => new CrochetApp());
})();
