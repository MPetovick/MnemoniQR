import { LayerManager } from './core/LayerManager.js';
import { RenderEngine } from './core/RenderEngine.js';
import { ThemeManager } from './core/ThemeManager.js';
import localforage from 'localforage';

class CrochetEditor {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = {
            scale: 1,
            offset: { x: 0, y: 0 },
            selectedStitch: 'punt_baix',
            rings: []
        };
        
        this.init();
    }

    async init() {
        this.layerManager = new LayerManager();
        this.renderEngine = new RenderEngine(this.canvas);
        this.themeManager = new ThemeManager();
        
        this.initEventListeners();
        this.initStitchPalette();
        await this.loadState();
        
        this.render();
    }

    initEventListeners() {
        // Eventos del Canvas
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('wheel', (e) => this.handleZoom(e));
        
        // Eventos de UI
        document.getElementById('zoomIn').addEventListener('click', () => this.adjustZoom(0.1));
        document.getElementById('zoomOut').addEventListener('click', () => this.adjustZoom(-0.1));
        document.getElementById('saveProject').addEventListener('click', () => this.saveState());
        
        // Eventos del Teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveState();
            }
        });
    }

    initStitchPalette() {
        const stitches = {
            punt_baix: '•', 
            punt_alt: '↑',
            cadeneta: '#',
            picot: '¤'
        };
        
        const container = document.getElementById('stitchPalette');
        Object.entries(stitches).forEach(([key, symbol]) => {
            const btn = document.createElement('button');
            btn.className = 'stitch-btn';
            btn.textContent = symbol;
            btn.addEventListener('click', () => {
                this.state.selectedStitch = key;
            });
            container.appendChild(btn);
        });
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.state.offset.x) / this.state.scale;
        const y = (e.clientY - rect.top - this.state.offset.y) / this.state.scale;
        
        // Lógica para añadir puntadas
        this.addStitch(x, y);
    }

    addStitch(x, y) {
        const currentLayer = this.layerManager.getActiveLayer();
        currentLayer.stitches.push({
            x,
            y,
            type: this.state.selectedStitch,
            color: getComputedStyle(document.documentElement)
                .getPropertyValue('--primary')
        });
        this.render();
    }

    adjustZoom(amount) {
        this.state.scale = Math.min(3, Math.max(0.3, this.state.scale + amount));
        this.render();
    }

    async saveState() {
        try {
            await localforage.setItem('projectState', {
                layers: this.layerManager.layers,
                state: this.state
            });
            this.showToast('Proyecto guardado');
        } catch (error) {
            console.error('Error saving:', error);
        }
    }

    async loadState() {
        try {
            const saved = await localforage.getItem('projectState');
            if (saved) {
                this.layerManager.layers = saved.layers;
                this.state = saved.state;
            }
        } catch (error) {
            console.error('Error loading:', error);
        }
    }

    render() {
        this.renderEngine.clear();
        this.renderEngine.drawGrid(this.state);
        this.layerManager.layers.forEach(layer => {
            layer.stitches.forEach(stitch => {
                this.renderEngine.drawStitch(stitch);
            });
        });
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
    const editor = new CrochetEditor();
    window.editor = editor;
});
