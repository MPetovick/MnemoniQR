import { DEFAULT_STATE } from './constants.js';

export class PatternState {
    constructor() {
        this.state = { ...DEFAULT_STATE };
        this.state.history = [this.cloneRings()];
    }

    // Métodos como reset(), saveState(), undo(), etc.
    // ... resto del código de la clase
}
