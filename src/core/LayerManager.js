export class LayerManager {
    constructor() {
        this.layers = [];
        this.activeLayerIndex = 0;
        this.createDefaultLayer();
    }

    createDefaultLayer() {
        this.layers.push({
            name: 'Capa 1',
            visible: true,
            locked: false,
            stitches: []
        });
    }

    getActiveLayer() {
        return this.layers[this.activeLayerIndex];
    }

    addLayer(name = `Capa ${this.layers.length + 1}`) {
        this.layers.push({
            name,
            visible: true,
            locked: false,
            stitches: []
        });
    }
}
