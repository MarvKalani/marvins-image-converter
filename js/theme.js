/**
 * theme.js - Theme management (dark/light mode)
 * Part of Marvin's Image Converter modular architecture
 */

import { icons, DOM } from './config.js';

// ============================================
// THEME APPLICATION
// ============================================

/**
 * Apply a theme to the page
 * @param {string} theme - 'dark' or 'light'
 */
export function applyTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');

    const themeToggle = DOM.themeToggle || document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'dark' ? icons.lightMode : icons.darkMode;
    }

    // Switch YouTube logo based on theme
    const youtubeLogo = document.getElementById('youtube-logo');
    if (youtubeLogo) {
        youtubeLogo.src = theme === 'dark'
            ? './icons/yt_logo_rgb_dark.png'
            : './icons/yt_logo_rgb_light.png';
    }
}

/**
 * Toggle between dark and light theme
 */
export function toggleTheme() {
    const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

/**
 * Initialize theme from localStorage or system preference
 */
export function initTheme() {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // Check system preference
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only update if user hasn't set a preference
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}
