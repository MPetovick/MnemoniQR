export const STITCH_TYPES = new Map([
    ['cadeneta', { symbol: '#', color: '#e74c3c', desc: 'Cadena base' }],
    ['punt_baix', { symbol: '•', color: '#2ecc71', desc: 'Punto bajo' }],
    ['punt_pla', { symbol: '-', color: '#3498db', desc: 'Punto plano' }],
    ['punt_mitja', { symbol: '●', color: '#f1c40f', desc: 'Punto medio' }],
    ['punt_alt', { symbol: '↑', color: '#9b59b6', desc: 'Punto alto' }],
    ['punt_doble_alt', { symbol: '⇑', color: '#e67e22', desc: 'Punto doble alto' }],
    ['picot', { symbol: '¤', color: '#1abc9c', desc: 'Picot decorativo' }]
]);

export const DEFAULT_STATE = {
    rings: [
        { segments: 8, points: Array(8).fill('cadeneta') }, // Anillo 0 con cadenetas
        { segments: 8, points: [] } // Anillo 1 vacío
    ],
    history: [],
    historyIndex: 0,
    scale: 1,
    targetScale: 1,
    offset: { x: 0, y: 0 },
    targetOffset: { x: 0, y: 0 },
    selectedStitch: 'punt_baix',
    guideLines: 8,
    ringSpacing: 50,
    isDragging: false,
    lastPos: { x: 0, y: 0 },
    pinchDistance: null
};
