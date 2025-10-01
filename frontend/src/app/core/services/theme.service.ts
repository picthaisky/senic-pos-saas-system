import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app_theme';
  private themeSignal = signal<Theme>(this.getStoredTheme());

  readonly theme = this.themeSignal.asReadonly();

  constructor() {
    // Apply theme changes to the document
    effect(() => {
      const theme = this.themeSignal();
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(theme);
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem(this.THEME_KEY, theme);
    });
  }

  toggleTheme(): void {
    this.themeSignal.update(current => current === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: Theme): void {
    this.themeSignal.set(theme);
  }

  private getStoredTheme(): Theme {
    const stored = localStorage.getItem(this.THEME_KEY) as Theme;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
