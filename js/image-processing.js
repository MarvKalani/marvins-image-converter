/**
 * image-processing.js - Core image processing logic
 * Part of Marvin's Image Converter modular architecture
 */

import { DOM, FORMATS } from './config.js';
import { getMimeType, createCanvas, canvasToBlob } from './utils.js';
import { releaseCanvasResources, releaseImageResources, triggerMemoryCleanup } from './memory.js';
import { convertToSVG } from './vtracer.js';
import * as state from './state.js';

// ============================================
// TARGET DIMENSIONS
// ============================================

/**
 * Calculate target dimensions based on size mode
 * @param {number} originalWidth 
 * @param {number} originalHeight 
 * @param {number} rotation - Rotation in degrees
 * @returns {{width: number, height: number}}
 */
export function calculateTargetDimensions(originalWidth, originalHeight, rotation) {
    const isSideways = rotation === 90 || rotation === 270;
    const w = isSideways ? originalHeight : originalWidth;
    const h = isSideways ? originalWidth : originalHeight;

    // Check size mode from modal or localStorage
    const sizeMode = localStorage.getItem('marvins-image-converter-size-mode') || 'percent';
    const modalSizeMode = document.getElementById('modal-size-mode');
    const currentMode = modalSizeMode ? modalSizeMode.value : sizeMode;

    if (currentMode === 'pixels') {
        // Pixel mode: scale to target pixel size (longest edge)
        const modalPixelInput = document.getElementById('modal-pixel-input');
        const targetPixels = parseInt(
            modalPixelInput?.value ||
            localStorage.getItem('marvins-image-converter-pixel-size') ||
            '512',
            10
        );

        // Scale based on longest edge while maintaining aspect ratio
        const longestEdge = Math.max(w, h);
        const scale = targetPixels / longestEdge;

        return {
            width: Math.round(w * scale) || 1,
            height: Math.round(h * scale) || 1
        };
    } else {
        // Percent mode (default)
        const percentSlider = DOM.percentSlider || document.getElementById('percent-slider');
        const percent = parseInt(percentSlider?.value || 100, 10) / 100;
        return {
            width: Math.round(w * percent) || 1,
            height: Math.round(h * percent) || 1
        };
    }
}

// ============================================
// SIZE ESTIMATION
// ============================================

/**
 * Estimate processed file size without actual processing
 * @param {Object} fileObj - File object from queue
 * @returns {{size: number, width: number, height: number}}
 */
export function estimateFileSize(fileObj) {
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');

    const format = formatSelect?.value || 'webp';
    const quality = parseFloat(qualitySlider?.value || 85) / 100;

    // Calculate target dimensions
    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
        fileObj.originalWidth,
        fileObj.originalHeight,
        fileObj.rotation || 0
    );

    // Estimate size
    const estimate = estimateProcessedSize(fileObj, targetWidth, targetHeight, format, quality);

    return {
        size: estimate,
        width: targetWidth,
        height: targetHeight,
    };
}

/**
 * Estimate the processed file size based on format and dimensions
 * @param {Object} fileObj 
 * @param {number} targetWidth 
 * @param {number} targetHeight 
 * @param {string} format 
 * @param {number} quality 
 * @returns {number} Estimated size in bytes
 */
export function estimateProcessedSize(fileObj, targetWidth, targetHeight, format, quality) {
    const pixelCount = targetWidth * targetHeight;

    // Use format from params if provided
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    format = format || formatSelect?.value || 'webp';

    const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');
    quality = quality !== undefined ? quality : parseFloat(qualitySlider?.value || 85) / 100;

    // Compression factors based on format
    const compressionFactors = {
        jpeg: 0.15 + (1 - quality) * 0.25,  // 0.15-0.40 bytes per pixel
        webp: 0.10 + (1 - quality) * 0.20,  // 0.10-0.30 bytes per pixel
        png: 0.5,                            // PNG is lossless, ~0.5 bytes per pixel
        svg: 0.3,                            // Vector, rough estimate
    };

    const factor = compressionFactors[format] || 0.2;
    let estimatedSize = pixelCount * factor;

    // Apply quality factor for lossy formats
    if (format !== 'png' && format !== 'svg') {
        estimatedSize *= (0.3 + quality * 0.7);
    }

    // Minimum file size
    return Math.max(1000, Math.round(estimatedSize));
}

// ============================================
// BUDGET CALCULATION
// ============================================

/**
 * Calculate optimal quality and scale to fit all files within a budget.
 * Tries to maximize quality/scale while staying within budget.
 * Constraints: scale <= 100%, quality >= 10 (90% compression).
 *
 * @param {number} budgetMB - Total budget in MB
 * @param {Array<Object>} files - File queue
 * @param {number} calibrationFactor - Correction factor from real vs estimated sizes (default 1.0)
 * @returns {{quality: number, scale: number, totalEstimated: number, achievable: boolean}}
 */
export function calculateBudgetSettings(budgetMB, files, calibrationFactor = 1.0) {
    if (files.length === 0) return { quality: 95, scale: 100, totalEstimated: 0, achievable: true };

    const budgetBytes = budgetMB * 1024 * 1024;
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    const format = formatSelect?.value || 'webp';

    const estimateTotal = (q, s) => {
        let total = 0;
        for (const fileObj of files) {
            const rotation = fileObj.rotation || 0;
            const isSideways = rotation === 90 || rotation === 270;
            const w = isSideways ? fileObj.originalHeight : fileObj.originalWidth;
            const h = isSideways ? fileObj.originalWidth : fileObj.originalHeight;
            const tw = Math.round(w * s / 100) || 1;
            const th = Math.round(h * s / 100) || 1;
            total += estimateProcessedSize(fileObj, tw, th, format, q / 100) * calibrationFactor;
        }
        return total;
    };

    // Start high, step down in 5-unit increments for precision
    let quality = 95;
    let scale = 100;

    // Phase 1: Lower quality to 60 (in 5er steps)
    while (quality > 60) {
        if (estimateTotal(quality, scale) <= budgetBytes) {
            return { quality, scale, totalEstimated: estimateTotal(quality, scale), achievable: true };
        }
        quality -= 5;
    }

    // Phase 2: Lower scale to 50 (in 5er steps), quality stays at 60
    while (scale > 50) {
        if (estimateTotal(quality, scale) <= budgetBytes) {
            return { quality, scale, totalEstimated: estimateTotal(quality, scale), achievable: true };
        }
        scale -= 5;
    }

    // Phase 3: Lower quality further down to 10 (90% compression limit)
    while (quality > 10) {
        if (estimateTotal(quality, scale) <= budgetBytes) {
            return { quality, scale, totalEstimated: estimateTotal(quality, scale), achievable: true };
        }
        quality -= 5;
    }

    // Phase 4: Last resort — lower scale below 50
    while (scale > 10) {
        if (estimateTotal(quality, scale) <= budgetBytes) {
            return { quality, scale, totalEstimated: estimateTotal(quality, scale), achievable: true };
        }
        scale -= 5;
    }

    // Can't fit — return best effort
    const totalEstimated = estimateTotal(quality, scale);
    return { quality, scale, totalEstimated, achievable: false };
}

// ============================================
// SINGLE IMAGE PROCESSING
// ============================================

/**
 * Process a single image with transformations
 * @param {Object} fileObj - File object from queue
 * @param {Object} options - Processing options
 * @returns {Promise<{dataUrl: string, size: number, targetWidth: number, targetHeight: number, blob: Blob, canvas: HTMLCanvasElement}>}
 */
export async function processSingleImage(fileObj, options = {}) {
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');

    const format = options.format || formatSelect?.value || 'webp';
    const quality = options.quality !== undefined
        ? options.quality
        : parseFloat(qualitySlider?.value || 85) / 100;
    const mimeType = getMimeType(format);

    // Calculate target dimensions
    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
        fileObj.originalWidth,
        fileObj.originalHeight,
        fileObj.rotation || 0
    );

    let canvas = null;
    let ctx = null;
    let img = null;
    let timeoutId = null;

    try {
        // Create image element
        img = new Image();
        img.crossOrigin = 'anonymous';

        // Load image from preview URL
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = fileObj.previewUrl;
        });

        // Create canvas
        canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx = canvas.getContext('2d');

        // Apply transformations
        const rotation = fileObj.rotation || 0;
        const scaleX = fileObj.scaleX || 1;
        const scaleY = fileObj.scaleY || 1;

        // Calculate scaled dimensions
        const isSideways = rotation === 90 || rotation === 270;
        const scaledOriginalW = isSideways ? targetHeight : targetWidth;
        const scaledOriginalH = isSideways ? targetWidth : targetHeight;

        // Clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scaleX, scaleY);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, -scaledOriginalW / 2, -scaledOriginalH / 2, scaledOriginalW, scaledOriginalH);
        ctx.restore();

        // Generate output
        let dataUrl, blob;

        if (format === 'svg') {
            // SVG conversion using VTracer
            const svgOptions = {
                colorMode: 'color',
                filterSpeckle: document.getElementById('svg-filter-speckle')?.value || 4,
                cornerThreshold: document.getElementById('svg-corner-threshold')?.value || 60,
                pathPrecision: document.getElementById('svg-path-precision')?.value || 2,
                colorPrecision: document.getElementById('svg-color-precision')?.value || 2,
                layerDifference: document.getElementById('svg-layer-difference')?.value || 16,
                spliceThreshold: document.getElementById('svg-splice-threshold')?.value || 45,
                lengthThreshold: document.getElementById('svg-length-threshold')?.value || 4,
                maxIterations: document.getElementById('svg-max-iterations')?.value || 10,
                hierarchical: document.getElementById('svg-hierarchical')?.value || 'stacked',
                onProgress: options.onProgress,
            };

            // Extract ImageData for VTracer
            const svgImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const svgString = await convertToSVG(svgImageData, svgOptions);
            blob = new Blob([svgString], { type: 'image/svg+xml' });
            dataUrl = URL.createObjectURL(blob);
        } else {
            // Raster format (WebP, JPEG, PNG)
            dataUrl = canvas.toDataURL(mimeType, quality);
            blob = await canvasToBlob(canvas, mimeType, quality);
        }

        return {
            dataUrl,
            size: blob.size,
            targetWidth,
            targetHeight,
            canvas,
            mimeType,
            quality,
            blob,
        };

    } finally {
        // Cleanup resources
        if (timeoutId) clearTimeout(timeoutId);

        if (ctx) {
            ctx.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
        }

        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }

        if (img) {
            img.onload = null;
            img.onerror = null;
            img.src = '';
        }
    }
}

// ============================================
// REAL SIZE CALCULATION
// ============================================

/**
 * Calculate the real size for a file
 * @param {number} index - Index in file queue
 * @returns {Promise<void>}
 */
export async function calculateRealSize(index) {
    if (index < 0 || index >= state.fileQueue.length) return;

    const fileObj = state.fileQueue[index];

    try {
        const result = await processSingleImage(fileObj);

        // Update file object with real values
        fileObj.realSize = result.size;
        fileObj.realDims = { w: result.targetWidth, h: result.targetHeight };
        fileObj.hasRealCalculation = true;
        fileObj.needsRecalculation = false;

        // Clean up the data URL if it's a blob URL
        if (result.dataUrl && result.dataUrl.startsWith('blob:')) {
            URL.revokeObjectURL(result.dataUrl);
        }

        // Trigger memory cleanup
        triggerMemoryCleanup();

    } catch (error) {
        console.error('Error calculating real size:', error);
    }
}

/**
 * Calculate all real sizes for files in queue
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<void>}
 */
export async function calculateAllRealSizes(onProgress) {
    const total = state.fileQueue.length;

    for (let i = 0; i < total; i++) {
        // Check for cancellation
        if (state.calculateProcessCancelled) {
            break;
        }

        await calculateRealSize(i);

        if (onProgress) {
            onProgress(i + 1, total);
        }

        // Small delay between files to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Final cleanup
    triggerMemoryCleanup();
}
