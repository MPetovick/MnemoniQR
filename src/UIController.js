import { STITCH_TYPES } from './constants.js';

export class UIController {
    constructor(state, renderer, inputHandler) {
        this.state = state;
        this.renderer = renderer;
        this.inputHandler = inputHandler;
        this.currentProjectName = null;
        this.logoContainer = document.getElementById('logoContainer');
        this.canvas = document.getElementById('patternCanvas');
        this.logoContainer.style.display = 'block';
        this.canvas.style.display = 'none';
        this.setupUI();
    }

    setupUI() {
        this.bindButtons([
            ['newBtn', () => this.newProject()],
            ['saveBtn', () => this.saveProject()],
            ['saveAsBtn', () => this.saveProjectAs()],
            ['undoBtn', () => this.state.undo() && this.renderer.render(this.state.state)],
            ['redoBtn', () => this.state.redo() && this.renderer.render(this.state.state)],
            ['zoomIn', () => this.inputHandler.adjustZoom(0.2)],
            ['zoomOut', () => this.inputHandler.adjustZoom(-0.2)],
            ['resetView', () => this.inputHandler.resetView()],
            ['stitchHelpBtn', e => this.toggleTooltip(e)],
            ['exportTxt', () => this.exportText()],
            ['exportPng', () => this.renderer.exportAsImage(this.state.state, this.currentProjectName)],
            ['exportPdf', () => this.exportPDF()],
            ['addRingBtn', () => {
                this.state.addRing();
                this.updateRingCounter();
                this.renderer.staticDirty = true;
                this.renderer.render(this.state.state);
            }]
        ]);
        this.bindRange('guideLines', v => {
            this.state.updateGuideLines(v);
            this.renderer.staticDirty = true;
        }, 'guideLinesValue', v => v);
        this.bindRange('ringSpacing', v => this.state.updateRingSpacing(v), 'ringSpacingValue', v => `${v}px`);
        this.setupStitchPalette();
        this.updateRingCounter();
    }

    bindButtons(buttons) {
        buttons.forEach(([id, fn]) => document.getElementById(id)?.addEventListener('click', fn));
    }

    bindRange(id, fn, valueId, format) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const v = parseInt(el.value);
            fn(v);
            document.getElementById(valueId).textContent = format(v);
            this.renderer.render(this.state.state);
        });
    }

    newProject() {
        this.state.reset();
        this.currentProjectName = null;
        this.logoContainer.style.display = 'none';
        this.canvas.style.display = 'block';
        this.renderer.resize();
        this.renderer.staticDirty = true;
        this.renderer.render(this.state.state);
        this.updateUI();
    }

    saveProject() {
        this.currentProjectName = this.currentProjectName || `Patrón ${new Date().toLocaleDateString()}`;
        const projects = this.getProjects();
        projects[this.currentProjectName] = this.state.state.rings;
        localStorage.setItem('crochetProjects', JSON.stringify(projects));
        this.loadProjects();
        alert(`Guardado: "${this.currentProjectName}"`);
    }

    saveProjectAs() {
        const name = prompt('Nombre:', this.currentProjectName || `Patrón ${new Date().toLocaleDateString()}`);
        if (name) {
            this.currentProjectName = name;
            this.saveProject();
        }
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('crochetPattern');
        if (saved) {
            this.state.setRings(JSON.parse(saved));
            this.logoContainer.style.display = 'none';
            this.canvas.style.display = 'block';
            this.renderer.staticDirty = true;
            this.renderer.render(this.state.state);
            this.updateUI();
        } else {
            this.logoContainer.style.display = 'block';
            this.canvas.style.display = 'none';
        }
    }

    getProjects() {
        return JSON.parse(localStorage.getItem('crochetProjects') || '{}');
    }

    loadProjects() {
        const projects = this.getProjects(), select = document.getElementById('loadProjects');
        const fragment = document.createDocumentFragment();
        fragment.appendChild(new Option('Cargar...', ''));
        Object.keys(projects).forEach(n => {
            const option = new Option(n, n);
            if (n === this.currentProjectName) option.selected = true;
            fragment.appendChild(option);
        });
        select.replaceChildren(fragment);
        select.onchange = () => {
            if (select.value) {
                this.state.setRings(structuredClone(projects[select.value]));
                this.currentProjectName = select.value;
                this.logoContainer.style.display = 'none';
                this.canvas.style.display = 'block';
                this.renderer.resize();
                this.renderer.staticDirty = true;
                this.renderer.render(this.state.state);
                this.updateUI();
            } else {
                this.state.reset();
                this.currentProjectName = null;
                this.logoContainer.style.display = 'block';
                this.canvas.style.display = 'none';
            }
        };
    }

    exportText() {
        const text = this.state.state.rings.map((r, ri) => r.points.map((t, si) => {
            let desc = STITCH_TYPES.get(t.replace(/(_increase|_decrease)/, ''))?.desc || 'Desconocido';
            if (t.includes('_increase')) desc += ' (Aumento)';
            else if (t.includes('_decrease')) desc += ' (Disminución)';
            return `Anillo ${ri + 1}, Segmento ${si}: ${desc}`;
        }).join('\n')).join('\n') || 'Patrón vacío';
        document.getElementById('exportText').value = text;
        const blob = new Blob([text], { type: 'text/plain' }), link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.currentProjectName || 'patron_crochet'}.txt`;
        link.click();
    }

    exportPDF() {
        const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const w = doc.internal.pageSize.width, h = doc.internal.pageSize.height, m = 15;
        doc.setFontSize(18);
        doc.setTextColor('#2c3e50');
        doc.text(this.currentProjectName || 'Patrón de Crochet', w / 2, m + 10, { align: 'center' });
        let y = m + 25;
        doc.setFontSize(12);
        doc.setTextColor('#000');
        doc.text('Leyenda:', m, y);
        y += 10;
        for (const [, s] of STITCH_TYPES) {
            doc.setTextColor(s.color);
            doc.text(`${s.symbol} - ${s.desc}`, m + 5, y);
            y += 8;
        }
        doc.setTextColor('#000');
        doc.text('▿ - Aumento', m + 5, y);
        y += 8;
        doc.text('▵ - Disminución', m + 5, y);
        y += 10;
        const maxR = this.state.state.rings.length * this.state.state.ringSpacing, scale = Math.min((w - 2 * m) / (maxR * 2), (h - y - m) / (maxR * 2));
        doc.setDrawColor('#ddd');
        doc.setLineWidth(0.2);
        this.state.state.rings.forEach((r, ri) => {
            const rMM = (ri + 1) * this.state.state.ringSpacing * scale * 0.0353;
            doc.circle(w / 2, y + (h - y) / 2, rMM);
            const s = r.segments, aStep = Math.PI * 2 / s, sR = (ri + 0.5) * this.state.state.ringSpacing * scale * 0.0353;
            r.points.forEach((t, si) => {
                if (si >= s) return;
                const a = si * aStep + aStep / 2, x = w / 2 + Math.cos(a) * sR, yPos = y + (h - y) / 2 + Math.sin(a) * sR;
                const { stitchType, symbol } = this.renderer.parseStitch(t);
                if (STITCH_TYPES.has(stitchType)) {
                    doc.setTextColor(STITCH_TYPES.get(stitchType).color);
                    doc.setFontSize(12 * scale);
                    doc.text(symbol, x, yPos, { align: 'center', baseline: 'middle' });
                }
            });
        });
        doc.save(`${this.currentProjectName || 'patron_crochet'}.pdf`);
    }

    setupStitchPalette() {
        const palette = document.getElementById('stitchPalette');
        const fragment = document.createDocumentFragment();
        STITCH_TYPES.forEach(([k, s], i) => {
            const btn = document.createElement('button');
            btn.className = `stitch-btn ${i === 0 ? 'active' : ''}`;
            btn.style.color = s.color;
            btn.title = s.desc;
            btn.dataset.key = k;
            btn.textContent = s.symbol;
            btn.onclick = () => {
                this.state.state.selectedStitch = k;
                palette.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderer.render(this.state.state);
            };
            fragment.appendChild(btn);
        });
        palette.appendChild(fragment);
    }

    toggleTooltip(e) {
        const tooltip = document.getElementById('stitchTooltip');
        if (tooltip.classList.contains('hidden')) {
            tooltip.innerHTML = [...STITCH_TYPES].map(([, s]) => `<span style="color:${s.color}">${s.symbol}</span> - ${s.desc}`).join('<br>') + '<br><span>▿</span> - Aumento<br><span>▵</span> - Disminución';
            const rect = e.target.getBoundingClientRect();
            tooltip.style.left = `${rect.right + 5}px`;
            tooltip.style.top = `${rect.top - 5}px`;
            tooltip.classList.remove('hidden');
        } else tooltip.classList.add('hidden');
    }

    updateRingCounter() {
        const btn = document.getElementById('addRingBtn');
        btn.innerHTML = `<span class="ring-counter">${this.state.state.rings.length}</span>`;
    }

    updateUI() {
        document.getElementById('undoBtn').disabled = this.state.state.historyIndex === 0;
        document.getElementById('redoBtn').disabled = this.state.state.historyIndex === this.state.history.length - 1;
        this.updateRingCounter();
        document.getElementById('exportText').value = this.state.state.rings.map((r, ri) => r.points.map((t, si) => {
            let desc = STITCH_TYPES.get(t.replace(/(_increase|_decrease)/, ''))?.desc || 'Desconocido';
            if (t.includes('_increase')) desc += ' (Aumento)';
            else if (t.includes('_decrease')) desc += ' (Disminución)';
            return `Anillo ${ri + 1}, Segmento ${si}: ${desc}`;
        }).join('\n')).join('\n') || 'Patrón vacío';
    }
}
