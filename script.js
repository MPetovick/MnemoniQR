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
const patternLog = document.getElementById("patternLog");

// Variables de estado
let selectedStitch = null;
let zoomLevel = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;
let patternSequence = [];

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

// Seleccionar un punto y añadirlo a la secuencia
function selectStitch(stitch, button) {
    selectedStitch = stitch;
    document.querySelectorAll(".stitch-btn").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    
    const stitchCount = patternSequence.length + 1;
    patternSequence.push({ ...stitch, position: stitchCount });
    updatePatternLog();
    drawPattern();
}

// Actualizar el log de la secuencia por anillos
function updatePatternLog() {
    const divisions = parseInt(guideLines.value);
    const rings = Math.ceil(patternSequence.length / divisions);
    let logText = "";

    for (let ring = 0; ring < rings; ring++) {
        const startIdx = ring * divisions;
        const endIdx = Math.min(startIdx + divisions, patternSequence.length);
        const ringStitches = patternSequence.slice(startIdx, endIdx);
        const ringText = ringStitches.map(s => `${s.symbol}`).join(" ");
        logText += `Anillo ${ring + 1}: ${ringText || "Vacío"}\n`;
    }

    patternLog.value = logText.trim();
    patternLog.scrollTop = patternLog.scrollHeight;
}

// Mostrar tooltip al pasar el mouse o tocar
stitchPalette.addEventListener("mouseover", (e) => {
    if (e.target.classList.contains("stitch-btn")) {
        showTooltip(e.target, e);
    }
});

stitchPalette.addEventListener("mouseout", hideTooltip);

stitchPalette.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const target = e.target.closest(".stitch-btn");
    if (target) {
        const stitch = stitches.find(s => s.symbol === target.textContent);
        if (stitch) selectStitch(stitch, target);
        showTooltip(target, e.touches[0]);
    }
}, { passive: false });

// Mostrar tooltip al hacer clic en el botón de ayuda
stitchHelpBtn.addEventListener("click", () => {
    const helpText = stitches.map(s => `${s.symbol}: ${s.name} - ${s.description}`).join("\n");
    stitchTooltip.textContent = helpText;
    stitchTooltip.style.left = "50%";
    stitchTooltip.style.top = "50%";
    stitchTooltip.style.transform = "translate(-50%, -50%)";
    stitchTooltip.classList.remove("hidden");
    setTimeout(hideTooltip, 5000);
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

    // Dibujar puntos de crochet en el patrón
    patternSequence.forEach((stitch, index) => {
        const ring = Math.floor(index / divisions) + 1;
        const positionInRing = index % divisions;
        const angle = (positionInRing / divisions) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * (ring * spacing);
        const y = centerY + Math.sin(angle) * (ring * spacing);

        ctx.font = `${20 / zoomLevel}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2c3e50";
        ctx.fillText(stitch.symbol, x, y);
    });

    ctx.restore();
}

// Interacción con el canvas
canvas.addEventListener("mousedown", startDragging);
canvas.addEventListener("mousemove", drag);
canvas.addEventListener("mouseup", stopDragging);
canvas.addEventListener("mouseleave", stopDragging);

canvas.addEventListener("touchstart", startDragging, { passive: false });
canvas.addEventListener("touchmove", drag, { passive: false });
canvas.addEventListener("touchend", stopDragging);
canvas.addEventListener("touchcancel", stopDragging);

function startDragging(e) {
    e.preventDefault();
    if (e.type === "touchstart") {
        const touch = e.touches[0];
        startX = touch.clientX - offsetX;
        startY = touch.clientY - offsetY;
    } else {
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
    }
    isDragging = true;
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    if (e.type === "touchmove") {
        const touch = e.touches[0];
        offsetX = touch.clientX - startX;
        offsetY = touch.clientY - startY;
    } else {
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
    }
    drawPattern();
}

function stopDragging() {
    isDragging = false;
}

// Controles de zoom
zoomIn.addEventListener("click", zoomInHandler);
zoomOut.addEventListener("click", zoomOutHandler);
resetView.addEventListener("click", resetViewHandler);

function zoomInHandler(e) {
    e.preventDefault();
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    drawPattern();
}

function zoomOutHandler(e) {
    e.preventDefault();
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    drawPattern();
}

function resetViewHandler(e) {
    e.preventDefault();
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    drawPattern();
}

// Actualizar valores de configuración
guideLines.addEventListener("input", () => {
    guideLinesValue.textContent = guideLines.value;
    updatePatternLog();
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
