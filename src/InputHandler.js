import { debounce } from './utils.js';

export class InputHandler {
    constructor(canvas, state, renderer) {
        this.canvas = canvas;
        this.state = state;
        this.renderer = renderer;
        this.isAnimating = false;
        this.lastRender = 0;
        this.renderThrottle = 16;
        this.cachedRect = null;
        this.rectCacheTime = 0;
        this.lastFrame = 0;
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
            this.renderer.staticDirty = true;
            this.renderer.render(this.state.state);
        }
    }

    handleMouseMove(e) {
        const now = performance.now();
        if (now - this.lastRender >= this.renderThrottle) {
            this.renderer.render(this.state.state, ...this.getCoords(e));
            this.lastRender = now;
        }
    }

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

    endDrag() {
        this.state.state.isDragging = false;
        this.isAnimating = false;
    }

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

    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.endDrag();
            this.state.state.pinchDistance = null;
        }
    }

    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX, dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getCoords(e) {
        if (!this.cachedRect || Date.now() - this.rectCacheTime > 1000) {
            this.cachedRect = this.canvas.getBoundingClientRect();
            this.rectCacheTime = Date.now();
        }
        return [
            (e.clientX - this.cachedRect.left - this.canvas.width / 2) / this.state.state.scale - this.state.state.offset.x,
            (e.clientY - this.cachedRect.top - this.canvas.height / 2) / this.state.state.scale - this.state.state.offset.y
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

    adjustZoom(amount) {
        this.state.state.targetScale = clamp(this.state.state.targetScale + amount, 0.3, 3);
        this.animate();
    }

    resetView() {
        this.state.state.targetScale = 1;
        this.state.state.targetOffset = { x: 0, y: 0 };
        this.state.state.offset = { x: 0, y: 0 };
        this.renderer.render(this.state.state);
    }

    animate() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            const animateFrame = (timestamp) => {
                const elapsed = timestamp - (this.lastFrame || timestamp);
                if (elapsed > this.renderThrottle) {
                    this.renderer.render(this.state.state);
                    this.lastFrame = timestamp;
                }
                if (this.needsAnimation()) {
                    requestAnimationFrame(animateFrame);
                } else {
                    this.isAnimating = false;
                }
            };
            requestAnimationFrame(animateFrame);
        }
    }

    needsAnimation() {
        return this.state.state.isDragging || Math.abs(this.state.state.scale - this.state.state.targetScale) > 0.01;
    }
}
