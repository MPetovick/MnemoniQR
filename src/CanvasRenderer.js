import { STITCH_TYPES } from './constants.js';
import { clamp } from './utils.js';

export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        this.staticCache = null;
        this.staticDirty = true;
        this.cachedFont = '';
        this.resize();
    }

    resize() {
        const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
        const dpr = window.devicePixelRatio;
        [this.canvas, this.offscreenCanvas].forEach(c => {
            c.width = w * dpr;
            c.height = h * dpr;
            c.style.width = `${w}px`;
            c.style.height = `${h}px`;
        });
        this.ctx.scale(dpr, dpr);
        this.offscreenCtx.scale(dpr, dpr);
        this.staticDirty = true;
    }

    render(state, mouseX = null, mouseY = null) {
        this.updateTransform(state);
        this.drawToOffscreen(state, mouseX, mouseY);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    updateTransform(state) {
        state.scale += (state.targetScale - state.scale) * 0.2;
        state.offset.x += (state.targetOffset.x - state.offset.x) * 0.2;
        state.offset.y += (state.targetOffset.y - state.offset.y) * 0.2;
        const maxOffset = Math.max(this.canvas.width, this.canvas.height) / (2 * state.scale) - state.rings.length * state.ringSpacing;
        state.targetOffset.x = clamp(state.targetOffset.x, -maxOffset, maxOffset);
        state.targetOffset.y = clamp(state.targetOffset.y, -maxOffset, maxOffset);
    }

    drawToOffscreen(state, mouseX, mouseY) {
        const ctx = this.offscreenCtx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(state.scale, state.scale);
        ctx.translate(state.offset.x, state.offset.y);
        this.drawStaticElements(ctx, state);
        this.drawStitches(ctx, state);
        if (mouseX !== null && mouseY !== null) this.drawHover(ctx, state, mouseX, mouseY);
        ctx.restore();
    }

    drawStaticElements(ctx, state) {
        if (!this.staticCache || this.staticDirty) {
            this.staticCache = document.createElement('canvas');
            this.staticCache.width = this.canvas.width;
            this.staticCache.height = this.canvas.height;
            const staticCtx = this.staticCache.getContext('2d');
            staticCtx.save();
            staticCtx.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.drawRings(staticCtx, state);
            staticCtx.restore();
            this.staticDirty = false;
        }
        ctx.drawImage(this.staticCache, -this.canvas.width / 2, -this.canvas.height / 2);
    }

    drawRings(ctx, state) {
        ctx.lineWidth = 1 / state.scale;
        ctx.strokeStyle = '#ddd';
        state.rings.forEach((_, r) => {
            ctx.beginPath();
            ctx.arc(0, 0, (r + 1) * state.ringSpacing, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.strokeStyle = '#eee';
        const segments = state.guideLines, angleStep = Math.PI * 2 / segments, maxRadius = state.rings.length * state.ringSpacing;
        ctx.beginPath();
        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep, x = Math.cos(angle) * maxRadius, y = Math.sin(angle) * maxRadius;
            ctx.moveTo(0, 0);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    drawStitches(ctx, state) {
        const font = `${20 / state.scale}px Arial`;
        if (this.cachedFont !== font) {
            ctx.font = font;
            this.cachedFont = font;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        state.rings.forEach((ring, rIdx) => {
            const segments = ring.segments, angleStep = Math.PI * 2 / segments, radius = (rIdx + 0.5) * state.ringSpacing;
            ring.points.forEach((type, sIdx) => {
                if (sIdx >= segments) return;
                const angle = sIdx * angleStep + (angleStep / 2), x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
                const { stitchType, symbol, isSpecial } = this.parseStitch(type);
                if (STITCH_TYPES.has(stitchType)) {
                    ctx.fillStyle = STITCH_TYPES.get(stitchType).color;
                    ctx.fillText(symbol, x, y);
                    if (isSpecial) {
                        ctx.beginPath();
                        ctx.arc(x, y, 5 / state.scale, 0, Math.PI * 2);
                        ctx.strokeStyle = '#ff0000';
                        ctx.stroke();
                    }
                }
            });
        });
    }

    drawHover(ctx, state, mouseX, mouseY) {
        const { ring, segment } = this.getRingSegment(state, mouseX, mouseY);
        if (ring >= 0 && ring < state.rings.length) {
            const segments = state.rings[ring].segments, angleStep = Math.PI * 2 / segments, radius = (ring + 0.5) * state.ringSpacing;
            const angle = segment * angleStep + (angleStep / 2), x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
            const stitch = STITCH_TYPES.get(state.selectedStitch);
            ctx.fillStyle = stitch.color + '80';
            ctx.fillText(stitch.symbol, x, y);
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
        exportCanvas.width = size;
        exportCanvas.height = size + 200;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size + 200);
        ctx.save();
        ctx.translate(size / 2, size / 2);
        this.drawRings(ctx, state);
        this.drawStitches(ctx, state);
        ctx.restore();
        this.drawLegend(ctx, padding, size + 20);
        const link = document.createElement('a');
        link.download = `${name || 'patron_crochet'}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    drawLegend(ctx, x, y) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('Leyenda:', x, y);
        y += 20;
        for (const [, s] of STITCH_TYPES) {
            ctx.fillStyle = s.color;
            ctx.fillText(`${s.symbol} - ${s.desc}`, x, y);
            y += 20;
        }
        ctx.fillStyle = '#000';
        ctx.fillText('▿ - Aumento', x, y);
        y += 20;
        ctx.fillText('▵ - Disminución', x, y);
    }
}
