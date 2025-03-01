export class RenderEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.offscreenCanvas = document.createElement('canvas');
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid(state) {
        this.ctx.save();
        this.ctx.translate(state.offset.x, state.offset.y);
        this.ctx.scale(state.scale, state.scale);
        
        // Dibujar cuadrícula
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        // ... lógica de dibujado ...
        
        this.ctx.restore();
    }

    drawStitch(stitch) {
        this.ctx.fillStyle = stitch.color;
        this.ctx.beginPath();
        this.ctx.arc(stitch.x, stitch.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
