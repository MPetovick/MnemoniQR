export class ThemeManager {
    constructor() {
        this.themes = ['light', 'dark', 'contrast'];
        this.initThemeButtons();
    }

    initThemeButtons() {
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.setAttribute('data-theme', btn.dataset.theme);
            });
        });
    }
}
