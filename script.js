// script.js

// Definir los símbolos de crochet y sus descripciones
const stitches = [
    { symbol: "○", name: "Cadeneta (ch)", description: "Punto de cadena" },
    { symbol: "●", name: "Punto deslizado (sl st)", description: "Punto deslizado" },
    { symbol: "✚", name: "Punto bajo (sc)", description: "Punto bajo o medio punto" },
    { symbol: "𝖙", name: "Punto alto (dc)", description: "Punto alto o vareta" },
    { symbol: "𝖳", name: "Punto alto doble (tr)", description: "Punto alto doble" },
    { symbol: "V", name: "Aumento (inc)", description: "2 puntos en el mismo espacio" },
    { symbol: "Λ", name: "Disminución (dec)", description: "2 puntos juntos" }
];

// Elementos del DOM
const stitchPalette = document.getElementById("stitchPalette");
const stitchHelpBtn = document.getElementById("stitchHelpBtn");
const stitchTooltip = document.getElementById("stitchTooltip");
const canvas = document.getElementById("patternCanvas");
const ctx = canvas.getContext("2d");
const guideLines = document.getElementById("guideLines");
const guideLinesValue = document.getElementById("guideLinesValue");
const ringSpacing = document.getElementById("ringSpacing");
const ringSpacingValue = document.getElementById("ringSpacingValue");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const resetView = document.getElementById("resetView");

// Variables de estado
let selectedStitch = null;
let zoomLevel = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;

// Generar botones de la paleta de puntadas
function createStitchButtons() {
    stitches.forEach(stitch => {
        const button = document.createElement("button");
        button.className = "stitch-btn";
        button.textContent = stitch.symbol;
        button.dataset.name = stitch.name;
        button.dataset.description = stitch.description;
        button.addEventListener("click", () => selectStitch(stitch, button));
        stitchPalette.appendChild(button);
    });
}

// Seleccionar un punto
function selectStitch(stitch, button) {
    selectedStitch = stitch;
    document.querySelectorAll(".stitch-btn").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
}

// Mostrar tooltip al pasar el mouse o tocar
stitchPalette.addEventListener("mouseover", (e) => {
    if (e.target.classList.contains("stitch-btn")) {
        showTooltip(e.target, e);
    }
});

stitchPalette.addEventListener("mouseout", () => {
    hideTooltip();
});

// Mostrar tooltip al hacer clic en el botón de ayuda
stitchHelpBtn.addEventListener("click", () => {
    const helpText = stitches.map(s => `${s.symbol}: ${s.name} - ${s.description}`).join("\n");
    stitchTooltip.textContent = helpText;
    stitchTooltip.style.left = "50%";
    stitchTooltip.style.top = "50%";
    stitchTooltip.style.transform = "translate(-50%, -50%)";
    stitchTooltip.classList.remove("hidden");
    setTimeout(hideTooltip, 5000); // Ocultar después de 5 segundos
});

// Funciones de tooltip
function showTooltip(element, event) {
    stitchTooltip.textContent = `${element.dataset.name}: ${element.dataset.description}`;
    stitchTooltip.style.left = `${event.pageX + 10}px`;
    stitchTooltip.style.top = `${event.pageY + 10}px`;
    stitchTooltip.classList.remove("hidden");
}

function hideTooltip() {
    stitchTooltip.classList.add("hidden");
}

// Configurar el canvas
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    drawPattern();
}

function drawPattern() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX + canvas.width / 2, offsetY + canvas.height / 2);
    ctx.scale(zoomLevel, zoomLevel);

    const centerX = 0;
    const centerY = 0;
    const divisions = parseInt(guideLines.value);
    const spacing = parseInt(ringSpacing.value);

    // Dibujar anillos
    for (let r = 1; r <= 5; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * spacing, 0, Math.PI * 2);
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 1 / zoomLevel;
        ctx.stroke();
    }

    // Dibujar líneas guía
    for (let i = 0; i < divisions; i++) {
        const angle = (i / divisions) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(angle) * spacing * 5, centerY + Math.sin(angle) * spacing * 5);
        ctx.strokeStyle = "#ccc";
        ctx.stroke();
    }

    ctx.restore();
}

// Interacción con el canvas
canvas.addEventListener("mousedown", (e) => {
    if (selectedStitch) {
        // Aquí podrías añadir lógica para colocar puntos
    } else {
        isDragging = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
        drawPattern();
    }
});

canvas.addEventListener("mouseup", () => {
    isDragging = false;
});

// Controles de zoom
zoomIn.addEventListener("click", () => {
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    drawPattern();
});

zoomOut.addEventListener("click", () => {
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    drawPattern();
});

resetView.addEventListener("click", () => {
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    drawPattern();
});

// Actualizar valores de configuración
guideLines.addEventListener("input", () => {
    guideLinesValue.textContent = guideLines.value;
    drawPattern();
});

ringSpacing.addEventListener("input", () => {
    ringSpacingValue.textContent = `${ringSpacing.value}px`;
    drawPattern();
});

// Inicialización
window.addEventListener("load", () => {
    createStitchButtons();
    resizeCanvas();
});

window.addEventListener("resize", resizeCanvas);
