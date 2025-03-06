import { PatternState } from './PatternState.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { InputHandler } from './InputHandler.js';
import { UIController } from './UIController.js';

export class CrochetEditor {
    constructor() {
        this.state = new PatternState();
        this.renderer = new CanvasRenderer(document.getElementById('patternCanvas'));
        this.inputHandler = new InputHandler(this.renderer.canvas, this.state, this.renderer);
        this.ui = new UIController(this.state, this.renderer, this.inputHandler);
        this.ui.loadProjects();
        this.ui.loadFromLocalStorage();
    }
}
