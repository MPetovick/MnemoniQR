class CrochetEditor {
    constructor() {
        this.stitches = [
            { symbol: "○", name: "Cadeneta (ch)", description: "Punto de cadena" },
            { symbol: "●", name: "Punto deslizado (sl st)", description: "Punto deslizado" },
            { symbol: "✚", name: "Punto bajo (sc)", description: "Punto bajo o medio punto" },
            { symbol: "𝖙", name: "Punto alto (dc)", description: "Punto alto o vareta" },
            { symbol: "𝖳", name: "Punto alto doble (tr)", description: "Punto alto doble" },
            { symbol: "V", name: "Aumento (inc)", description: "2 puntos en el mismo espacio" },
            { symbol: "Λ", name: "Disminución (dec)", description: "2 puntos juntos" }
        ];

        this.dom = {
            canvas: document.getElementById('patternCanvas'),
            stitchPalette: document.getElementById('stitchPalette'),
            patternLog: document.getElementById('patternLog'),
            guideLines: document.getElementById('guideLines'),
            guideLinesValue: document.getElementById('guideLinesValue'),
            ringSpacing: document.getElementById('ringSpacing'),
            ringSpacingValue: document.getElementById('ringSpacingValue'),
            helpImage: document.querySelector('.help-image-container'),
            stitchHelpBtn: document.getElementById('stitchHelpBtn')
        };

        this.state = {
            selectedStitch: null,
            zoomLevel: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            startX: 0,
            startY: 0,
            patternSequence: [],
            ctx: this.dom.canvas.getContext('2d')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createStitchPalette();
        this.resizeCanvas();
        this.updateConfigDisplay();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Eventos del canvas
        this.dom.canvas.addEventListener('mousedown', e => this.startDrag(e));
        this.dom.canvas.addEventListener('mousemove', e => this.drag(e));
        this.dom.canvas.addEventListener('mouseup', () => this.stopDrag());
        this.dom.canvas.addEventListener('mouseleave', () => this.stopDrag());
        this.dom.canvas.addEventListener('touchstart', e => this.startDrag(e));
        this.dom.canvas.addEventListener('touchmove', e => this.drag(e));
        this.dom.canvas.addEventListener('touchend', () => this.stopDrag());

        // Controles
        document.getElementById('zoomIn').addEventListener('click', e => this.adjustZoom(e, 0.2));
        document.getElementById('zoomOut').addEventListener('click', e => this.adjustZoom(e, -0.2));
        document.getElementById('resetView').addEventListener('click', e => this.resetView(e));
        document.getElementById('deleteLastStitchBtn').addEventListener('click', () => this.deleteLastStitch());
        this.dom.stitchHelpBtn.addEventListener('click', () => this.toggleHelp());

        // Configuraciones
        this.dom.guideLines.addEventListener('input', () => this.updateConfig());
        this.dom.ringSpacing.addEventListener('input', () => this.updateConfig());
    }

    createStitchPalette() {
        this.stitches.forEach(stitch => {
            const button = document.createElement('button');
            button.className = 'stitch-btn';
            button.textContent = stitch.symbol;
            button.title = `${stitch.name}: ${stitch.description}`;
            button.addEventListener('click', () => this.selectStitch(stitch, button));
            this.dom.stitchPalette.appendChild(button);
        });
    }

    selectStitch(stitch, button) {
        document.querySelectorAll('.stitch-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        this.state.selectedStitch = stitch;
        this.addStitchToPattern();
    }

    addStitchToPattern() {
        if (!this.state.selectedStitch) return;
        
        this.state.patternSequence.push({
            ...this.state.selectedStitch,
            position: this.state.patternSequence.length + 1
        });
        
        this.updatePatternLog();
        this.drawPattern();
    }

    updatePatternLog() {
        const divisions = parseInt(this.dom.guideLines.value);
        const logLines = [];
        let currentRing = 1;
        let ringStitches = [];

        this.state.patternSequence.forEach((stitch, index) => {
            if (index % divisions === 0 && index !== 0) {
                logLines.push(`Anillo ${currentRing}: ${ringStitches.join(' ')}`);
                currentRing++;
                ringStitches = [];
            }
            ringStitches.push(stitch.symbol);
        });

        if (ringStitches.length > 0) {
            logLines.push(`Anillo ${currentRing}: ${ringStitches.join(' ')}`);
        }

        this.dom.patternLog.value = logLines.join('\n');
        this.dom.patternLog.scrollTop = this.dom.patternLog.scrollHeight;
    }

    resizeCanvas() {
        this.dom.canvas.width = this.dom.canvas.offsetWidth;
        this.dom.canvas.height = this.dom.canvas.offsetHeight;
        this.drawPattern();
    }

    drawPattern() {
        const { ctx, zoomLevel, offsetX, offsetY } = this.state;
        ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);
        
        ctx.save();
        ctx.translate(offsetX + this.dom.canvas.width / 2, offsetY + this.dom.canvas.height / 2);
        ctx.scale(zoomLevel, zoomLevel);

        const centerX = 0;
        const centerY = 0;
        const divisions = parseInt(this.dom.guideLines.value);
        const spacing = parseInt(this.dom.ringSpacing.value);
        const totalRings = Math.max(1, Math.ceil(this.state.patternSequence.length / divisions));

        // Dibujar anillos
        for (let r = 1; r <= totalRings; r++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, r * spacing, 0, Math.PI * 2);
            ctx.strokeStyle = "#ddd";
            ctx.lineWidth = 1 / zoomLevel;
            ctx.stroke();
        }

        // Dibujar guías
        for (let i = 0; i < divisions; i++) {
            const angle = (i / divisions) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(angle) * spacing * totalRings, 
                      centerY + Math.sin(angle) * spacing * totalRings);
            ctx.strokeStyle = "#ccc";
            ctx.lineWidth = 1 / zoomLevel;
            ctx.stroke();
        }

        // Dibujar puntos
        this.state.patternSequence.forEach((stitch, index) => {
            const ring = Math.floor(index / divisions) + 1;
            const positionInRing = index % divisions;
            const angle = (positionInRing / divisions) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * (ring * spacing);
            const y = centerY + Math.sin(angle) * (ring * spacing);

            ctx.font = `${20 / zoomLevel}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#2c3e50";
            ctx.fillText(stitch.symbol, x, y);
        });

        ctx.restore();
    }

    startDrag(e) {
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        this.state.isDragging = true;
        this.state.startX = clientX - this.state.offsetX;
        this.state.startY = clientY - this.state.offsetY;
    }

    drag(e) {
        if (!this.state.isDragging) return;
        e.preventDefault();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        this.state.offsetX = clientX - this.state.startX;
        this.state.offsetY = clientY - this.state.startY;
        this.drawPattern();
    }

    stopDrag() {
        this.state.isDragging = false;
    }

    adjustZoom(e, delta) {
        e.preventDefault();
        this.state.zoomLevel = Math.min(Math.max(this.state.zoomLevel + delta, 0.5), 3);
        this.drawPattern();
    }

    resetView(e) {
        e.preventDefault();
        this.state.zoomLevel = 1;
        this.state.offsetX = 0;
        this.state.offsetY = 0;
        this.drawPattern();
    }

    updateConfig() {
        this.dom.guideLinesValue.textContent = this.dom.guideLines.value;
        this.dom.ringSpacingValue.textContent = `${this.dom.ringSpacing.value}px`;
        this.updatePatternLog();
        this.drawPattern();
    }

    updateConfigDisplay() {
        this.dom.guideLinesValue.textContent = this.dom.guideLines.value;
        this.dom.ringSpacingValue.textContent = `${this.dom.ringSpacing.value}px`;
    }

    toggleHelp() {
        this.dom.helpImage.style.display = 
            this.dom.helpImage.style.display === 'none' ? 'block' : 'none';
    }

    deleteLastStitch() {
        if (this.state.patternSequence.length > 0) {
            this.state.patternSequence.pop();
            this.updatePatternLog();
            this.drawPattern();
        }
    }
}

// Inicialización de la aplicación
window.addEventListener('load', () => new CrochetEditor());