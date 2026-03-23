/**
 * memory.js - Memory management and cleanup utilities
 * Part of Marvin's Image Converter modular architecture
 */

// ============================================
// STATE
// ============================================
let memoryCleanupTimer = null;
const objectUrlsToRevoke = new Set();

// ============================================
// GC HINTS
// ============================================

/**
 * Trigger garbage collection hints
 * Forces modern browsers to clean up memory more aggressively
 */
export function triggerMemoryCleanup() {
    // Revoke pending object URLs
    for (const url of objectUrlsToRevoke) {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {
            // Ignore errors for already revoked URLs
        }
    }
    objectUrlsToRevoke.clear();

    // Force GC if available (Chrome DevTools only)
    if (typeof window.gc === 'function') {
        try {
            window.gc();
        } catch (e) {
            // gc() not available in normal mode
        }
    }

    // Encourage garbage collection through memory pressure
    // This is a hint, not a guarantee
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
            // Empty callback just to trigger the idle callback queue
        }, { timeout: 100 });
    }
}

// ============================================
// OBJECT URL MANAGEMENT
// ============================================

/**
 * Create an object URL and track it for cleanup
 * @param {Blob} blob 
 * @returns {string} Object URL
 */
export function createObjectURL(blob) {
    const url = URL.createObjectURL(blob);
    objectUrlsToRevoke.add(url);
    return url;
}

/**
 * Revoke an object URL immediately
 * @param {string} url 
 */
export function revokeObjectURL(url) {
    if (url && url.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(url);
            objectUrlsToRevoke.delete(url);
        } catch (e) {
            // Ignore errors
        }
    }
}

/**
 * Revoke multiple object URLs
 * @param {string[]} urls 
 */
export function revokeObjectURLs(urls) {
    for (const url of urls) {
        revokeObjectURL(url);
    }
}

// ============================================
// CANVAS CLEANUP
// ============================================

/**
 * Aggressively clean up canvas resources
 * @param {HTMLCanvasElement} canvas 
 */
export function releaseCanvasResources(canvas) {
    if (!canvas) return;

    try {
        // Get context and clear
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Minimize canvas size to release GPU texture memory
        canvas.width = 1;
        canvas.height = 1;

        // Clear again at minimal size
        if (ctx) {
            ctx.clearRect(0, 0, 1, 1);
        }

        // Remove from DOM if present
        if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    } catch (e) {
        console.warn('Error releasing canvas resources:', e);
    }
}

/**
 * Clean up an image element
 * @param {HTMLImageElement} img 
 */
export function releaseImageResources(img) {
    if (!img) return;

    try {
        // Revoke blob URL if applicable
        if (img.src && img.src.startsWith('blob:')) {
            revokeObjectURL(img.src);
        }

        // Clear source
        img.src = '';
        img.removeAttribute('src');

        // Remove from DOM if present
        if (img.parentNode) {
            img.parentNode.removeChild(img);
        }
    } catch (e) {
        console.warn('Error releasing image resources:', e);
    }
}

// ============================================
// PERIODIC CLEANUP
// ============================================

/**
 * Start periodic memory cleanup timer
 * @param {number} intervalMs - Interval in milliseconds (default: 10000)
 */
export function startMemoryCleanup(intervalMs = 10000) {
    if (memoryCleanupTimer) {
        clearInterval(memoryCleanupTimer);
    }
    memoryCleanupTimer = setInterval(triggerMemoryCleanup, intervalMs);
}

/**
 * Stop periodic memory cleanup timer
 */
export function stopMemoryCleanup() {
    if (memoryCleanupTimer) {
        clearInterval(memoryCleanupTimer);
        memoryCleanupTimer = null;
    }
}

// ============================================
// BATCH CLEANUP
// ============================================

/**
 * Clean up resources after batch processing
 * Call this after processing multiple images
 */
export function cleanupAfterBatch() {
    triggerMemoryCleanup();

    // Additional aggressive cleanup
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
            triggerMemoryCleanup();
        }, { timeout: 500 });
    } else {
        setTimeout(triggerMemoryCleanup, 500);
    }
}
