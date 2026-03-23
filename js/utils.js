/**
 * utils.js - General utility functions
 * Part of Marvin's Image Converter modular architecture
 */

import { FORMATS } from './config.js';

// ============================================
// ID GENERATION
// ============================================
let idCounter = 0;

/**
 * Generate a unique ID for file objects
 * @returns {string} Unique ID
 */
export function generateId() {
    return `file-${Date.now()}-${idCounter++}`;
}

// ============================================
// FORMATTING
// ============================================

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    if (!bytes || isNaN(bytes)) return '...';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get MIME type for a format
 * @param {string} format - Format key (jpeg, png, webp, etc.)
 * @returns {string} MIME type
 */
export function getMimeType(format) {
    return FORMATS[format]?.mimeType || 'image/jpeg';
}

/**
 * Get file extension for a format
 * @param {string} format - Format key
 * @returns {string} File extension without dot
 */
export function getExtension(format) {
    return FORMATS[format]?.extension || 'jpg';
}

/**
 * Check if format supports quality setting
 * @param {string} format - Format key
 * @returns {boolean}
 */
export function supportsQuality(format) {
    return FORMATS[format]?.supportsQuality ?? true;
}

// ============================================
// FORMAT SUPPORT DETECTION
// ============================================

/**
 * Detect which output formats the browser can encode via Canvas.
 * Tests canvas.toDataURL() for each format. If the browser doesn't
 * support encoding a format, it silently returns image/png instead.
 * SVG is always supported (handled via VTracer, not Canvas encoding).
 * @returns {Object<string, boolean>} Map of format key → supported
 */
export function detectFormatSupport() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const support = {};
    for (const [key, fmt] of Object.entries(FORMATS)) {
        if (key === 'svg') {
            support[key] = true;
            continue;
        }
        const dataUrl = canvas.toDataURL(fmt.mimeType);
        support[key] = dataUrl.startsWith(`data:${fmt.mimeType}`);
    }
    return support;
}

/**
 * Disable unsupported format options in a <select> element.
 * Unsupported options get disabled and show a browser hint.
 * @param {HTMLSelectElement} select
 * @param {Object<string, boolean>} support
 * @param {string} [hint] - Text to append to unsupported options
 */
export function applyFormatSupport(select, support, hint) {
    if (!select) return;
    const label = hint || 'not supported';
    for (const option of select.options) {
        const fmt = option.value;
        if (support[fmt] === false) {
            option.disabled = true;
            option.textContent += ` (${label})`;
        }
    }
    // If currently selected format is unsupported, switch to first supported
    if (select.selectedOptions[0]?.disabled) {
        const first = Array.from(select.options).find(o => !o.disabled);
        if (first) select.value = first.value;
    }
}

// ============================================
// DEBOUNCING
// ============================================

/**
 * Create a debounced function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Create a throttled function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// ============================================
// FILE UTILITIES
// ============================================

/**
 * Get filename without extension
 * @param {string} filename - Full filename
 * @returns {string} Filename without extension
 */
export function getBaseName(filename) {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
}

/**
 * Check if a file is an image
 * @param {File} file - File object
 * @returns {boolean}
 */
export function isImageFile(file) {
    return file.type.startsWith('image/');
}

/**
 * Read file as Data URL
 * @param {File} file - File to read
 * @returns {Promise<string>} Data URL
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Load image from URL
 * @param {string} src - Image source URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
    });
}

// ============================================
// CANVAS UTILITIES
// ============================================

/**
 * Create a canvas with specified dimensions
 * @param {number} width 
 * @param {number} height 
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
 */
export function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
}

/**
 * Convert canvas to blob
 * @param {HTMLCanvasElement} canvas 
 * @param {string} mimeType 
 * @param {number} quality - Quality 0-1
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
            },
            mimeType,
            quality
        );
    });
}

// ============================================
// PERFORMANCE DETECTION
// ============================================

/**
 * Detect if the client is slow based on load performance
 * @returns {boolean}
 */
export function detectSlowClient() {
    try {
        // Use PerformanceNavigationTiming API if available
        const entries = performance.getEntriesByType('navigation');
        if (entries.length > 0) {
            const navEntry = entries[0];
            const loadTime = navEntry.loadEventEnd - navEntry.startTime;
            if (loadTime > 2000) return true;
        }

        // Fallback to legacy timing API
        const timing = performance.timing;
        if (timing && timing.loadEventEnd > 0 && timing.navigationStart > 0) {
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            if (loadTime > 2000) return true;
        }

        // Check for memory constraints if available
        const memInfo = performance.memory;
        if (memInfo && memInfo.jsHeapSizeLimit < 500 * 1024 * 1024) {
            return true; // Less than 500MB heap limit suggests constrained device
        }

        return false;
    } catch (e) {
        console.warn('Could not detect client performance:', e);
        return false;
    }
}
