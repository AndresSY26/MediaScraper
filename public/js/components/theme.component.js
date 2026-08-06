/**
 * Componente Administrador de Temas (Claro / Oscuro)
 */
export class ThemeComponent {
  constructor(toggleBtnId, iconId) {
    this.toggleBtn = document.getElementById(toggleBtnId);
    this.icon = document.getElementById(iconId);
    this.init();
  }

  init() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateIcon(savedTheme);

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleTheme());
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateIcon(newTheme);
  }

  updateIcon(theme) {
    if (this.icon) {
      this.icon.className = theme === 'dark' ? 'ri-moon-clear-line' : 'ri-sun-line';
    }
  }
}
