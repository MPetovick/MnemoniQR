import { PatternState } from './PatternState.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { InputHandler } from './InputHandler.js';
import { UIController } from './UIController.js';

export class CrochetEditor {
    constructor() {
        this.state = new PatternState();
        this.canvas = document.getElementById('patternCanvas');
        this.renderer = new CanvasRenderer(this.canvas);
        this.inputHandler = new InputHandler(this.canvas, this.state, this.renderer);
        this.ui = new UIController(this.state, this.renderer, this.inputHandler);
        
        // Inicialización del canvas
        this.initCanvas();
        this.ui.loadProjects();
        this.ui.loadFromLocalStorage();
    }

    initCanvas() {
        // Mostrar canvas y ocultar logo
        this.canvas.style.display = 'block';
        document.getElementById('logoContainer').style.display = 'none';
        
        // Renderizado inicial
        this.renderer.initialize();
        this.renderer.draw(this.state);
    }
}
