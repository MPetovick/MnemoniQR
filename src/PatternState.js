import { DEFAULT_STATE } from './constants.js';
import { clamp } from './utils.js';

export class PatternState {
    constructor() {
        this.state = structuredClone(DEFAULT_STATE);
        this.saveState();
    }

    reset() {
        this.state = structuredClone(DEFAULT_STATE);
        this.state.rings[0].points = Array(this.state.guideLines).fill('cadeneta');
        this.saveState();
    }

    saveState() {
        const current = this.state.rings;
        const prev = this.state.history[this.state.historyIndex] || [];
        if (this.areRingsEqual(current, prev)) return;
        this.state.history.push(this.deepCloneRings(current));
        this.state.historyIndex++;
        if (this.state.history.length > 100) {
            this.state.history = [this.state.history[0], ...this.state.history.slice(-98)];
            this.state.historyIndex = this.state.history.length - 1;
        }
    }

    undo() {
        if (this.state.historyIndex <= 0) return false;
        this.state.rings = structuredClone(this.state.history[--this.state.historyIndex]);
        return true;
    }

    redo() {
        if (this.state.historyIndex >= this.state.history.length - 1) return false;
        this.state.rings = structuredClone(this.state.history[++this.state.historyIndex]);
        return true;
    }

    setRings(rings) {
        this.state.rings = structuredClone(rings);
        this.saveState();
    }

    updateGuideLines(v) {
        this.state.guideLines = clamp(v, 4, 24);
        this.state.rings[0].segments = this.state.guideLines;
        this.state.rings[0].points = Array(this.state.guideLines).fill('cadeneta');
        if (this.state.rings.length > 1) this.state.rings[1].segments = this.state.guideLines;
        this.saveState();
    }

    updateRingSpacing(v) {
        this.state.ringSpacing = clamp(v, 30, 80);
    }

    addRing() {
        this.state.rings.push({ segments: this.state.rings.at(-1)?.segments || this.state.guideLines, points: [] });
        this.saveState();
    }

    increasePoints(ringIdx, segIdx) {
        if (ringIdx + 1 < this.state.rings.length) this.state.rings[ringIdx + 1].segments++;
        this.saveState();
    }

    decreasePoints(ringIdx, segIdx) {
        if (ringIdx + 1 < this.state.rings.length && this.state.rings[ringIdx + 1].segments > this.state.guideLines) 
            this.state.rings[ringIdx + 1].segments--;
        this.saveState();
    }

    deepCloneRings(rings) {
        return rings.map(ring => ({ segments: ring.segments, points: [...ring.points] }));
    }

    areRingsEqual(a, b) {
        if (a.length !== b.length) return false;
        return a.every((ring, i) => 
            ring.segments === b[i].segments &&
            ring.points.length === b[i].points.length &&
            ring.points.every((p, j) => p === b[i].points[j])
        );
    }
}
