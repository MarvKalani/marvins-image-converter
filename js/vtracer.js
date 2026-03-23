/**
 * vtracer.js - VTracer WASM lazy-loading for SVG conversion
 * Part of Marvin's Image Converter modular architecture
 */

// ============================================
// STATE
// ============================================
let vtracerModule = null;
let vtracerLoading = false;
let vtracerLoadPromise = null;

// ============================================
// WASM LOADER
// ============================================

/**
 * Lazy-load VTracer WASM module
 * @returns {Promise<{BinaryImageConverter, ColorImageConverter}>}
 */
export async function loadVTracer() {
    if (vtracerModule) return vtracerModule;
    if (vtracerLoading) return vtracerLoadPromise;

    vtracerLoading = true;
    vtracerLoadPromise = new Promise(async (resolve, reject) => {
        try {
            // Import the generated JS loader
            const { default: init, BinaryImageConverter, ColorImageConverter } = await import('../libs/vtracer/loader.js');

            // Initialize the WASM module
            await init('../libs/vtracer/vtracer_webapp_bg.wasm');

            // Store the module exports/classes directly
            vtracerModule = { BinaryImageConverter, ColorImageConverter };

            vtracerLoading = false;
            resolve(vtracerModule);
        } catch (error) {
            console.error('VTracer load error:', error);
            vtracerLoading = false;
            reject(new Error('Failed to load VTracer library'));
        }
    });

    return vtracerLoadPromise;
}

// ============================================
// SVG CONVERSION
// ============================================

/**
 * Convert image to SVG using VTracer
 * @param {ImageData|HTMLCanvasElement|string} input - Image source
 * @param {Object} options - Conversion options
 * @returns {Promise<string>} SVG string
 */
export async function convertToSVG(input, options = {}) {
    const vtracer = await loadVTracer();
    if (!vtracer) {
        throw new Error('VTracer not loaded');
    }

    let imageData;
    let tempCanvas = null;

    if (input instanceof ImageData) {
        imageData = input;
    } else if (input instanceof HTMLCanvasElement) {
        const ctx = input.getContext('2d');
        imageData = ctx.getImageData(0, 0, input.width, input.height);
    } else {
        // Assume string URL
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = input;
        });

        tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }

    // Config defaults - ensure numeric values for Rust
    const config = {
        ...options,
        colorMode: options.colorMode || 'color',
        filterSpeckle: parseInt(options.filterSpeckle || 4, 10),
        cornerThreshold: parseInt(options.cornerThreshold || 60, 10),
        pathPrecision: parseInt(options.pathPrecision || 2, 10),
    };

    let converter = null;
    let hiddenContainer = null;

    try {
        const { ColorImageConverter } = vtracer;
        if (!ColorImageConverter) {
            throw new Error('ColorImageConverter not found');
        }

        // VTracer webapp build requires existing DOM elements
        const canvasId = 'vtracer-canvas-' + Date.now() + Math.floor(Math.random() * 1000);
        const svgId = 'vtracer-svg-' + Date.now() + Math.floor(Math.random() * 1000);

        console.log(`[VTracer] Setup - Canvas ID: ${canvasId}, SVG ID: ${svgId}`);
        console.log(`[VTracer] Input Stats - Width: ${imageData.width}, Height: ${imageData.height}`);

        // Create temporary DOM elements
        hiddenContainer = document.createElement('div');
        hiddenContainer.style.position = 'absolute';
        hiddenContainer.style.left = '-9999px';
        hiddenContainer.style.top = '0';
        hiddenContainer.style.width = '1px';
        hiddenContainer.style.height = '1px';
        hiddenContainer.style.overflow = 'hidden';
        document.body.appendChild(hiddenContainer);

        // Canvas must be in DOM for VTracer to find it by ID
        const vtracerCanvas = document.createElement('canvas');
        vtracerCanvas.id = canvasId;
        vtracerCanvas.width = imageData.width;
        vtracerCanvas.height = imageData.height;
        hiddenContainer.appendChild(vtracerCanvas);

        // Put image data into the temp canvas
        const vtracerCtx = vtracerCanvas.getContext('2d');
        vtracerCtx.putImageData(imageData, 0, 0);

        // Create SVG container
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        tempSvg.id = svgId;
        tempSvg.setAttribute('width', imageData.width);
        tempSvg.setAttribute('height', imageData.height);
        tempSvg.setAttribute('viewBox', `0 0 ${imageData.width} ${imageData.height}`);
        tempSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        hiddenContainer.appendChild(tempSvg);

        // Construct params object for COLOR mode
        const hierarchical = config.hierarchical || 'stacked';
        const corner_threshold_deg = config.cornerThreshold || 60;
        const splice_threshold_deg = config.spliceThreshold || 45;
        const length_threshold = config.lengthThreshold !== undefined ? config.lengthThreshold : 4.0;
        const max_iterations = config.maxIterations || 10;
        const color_precision = config.colorPrecision || 2;
        const layer_difference = config.layerDifference !== undefined ? config.layerDifference : 16;

        // Helper for degrees to radians
        const deg2rad = (deg) => deg / 180 * 3.141592654;

        const vtracerParams = {
            'canvas_id': canvasId,
            'svg_id': svgId,
            'mode': 'spline',
            'clustering_mode': 'color',
            'hierarchical': hierarchical,
            'corner_threshold': deg2rad(corner_threshold_deg),
            'length_threshold': parseFloat(length_threshold),
            'max_iterations': parseInt(max_iterations),
            'splice_threshold': deg2rad(splice_threshold_deg),
            'filter_speckle': (config.filterSpeckle * config.filterSpeckle),
            'color_precision': parseInt(color_precision),
            'layer_difference': parseInt(layer_difference),
            'path_precision': config.pathPrecision,
        };

        const paramsString = JSON.stringify(vtracerParams);
        console.log('[VTracer] Final Params:', paramsString);

        // Initialize Color Converter
        console.log('[VTracer] Initializing ColorImageConverter...');
        converter = ColorImageConverter.new_with_string(paramsString);
        converter.init();

        // Run conversion tick loop with UI unblocking
        console.log('[VTracer] Starting async tick loop...');
        let iterations = 0;
        const startTime = performance.now();

        // Async loop helper
        await new Promise((resolve) => {
            const nextTick = () => {
                let batchSize = 20;
                let ticks = 0;

                // Run a batch of ticks
                while (ticks < batchSize) {
                    if (converter.tick()) {
                        resolve();
                        return;
                    }
                    ticks++;
                    iterations++;
                }

                // Report progress every 500 iterations
                if (iterations % 500 === 0 && config.onProgress) {
                    config.onProgress(iterations);
                }

                // Safety breaks - 120s timeout for complex images
                if (iterations > 200000 || (performance.now() - startTime > 120000)) {
                    console.warn('[VTracer] Safety break! Iterations:', iterations);
                    resolve();
                } else {
                    setTimeout(nextTick, 0);
                }
            };
            nextTick();
        });

        const duration = performance.now() - startTime;
        console.log(`[VTracer] Finished in ${iterations} iterations (${duration.toFixed(2)}ms)`);

        // Extract result
        let svgString = tempSvg.outerHTML;
        console.log(`[VTracer] Raw Output Length: ${svgString.length} chars`);

        // Ensure the xmlns attribute is present
        if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        // Add XML declaration
        svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;

        // Cleanup
        converter.free();
        converter = null;

        return svgString;

    } finally {
        // Ensure cleanup happens even on error
        if (converter && converter.free) {
            try { converter.free(); } catch (e) { /* ignore */ }
        }
        if (hiddenContainer && hiddenContainer.parentNode) {
            hiddenContainer.parentNode.removeChild(hiddenContainer);
        }
        if (tempCanvas) {
            tempCanvas.width = 1;
            tempCanvas.height = 1;
        }
    }
}

/**
 * Check if VTracer is available
 * @returns {boolean}
 */
export function isVTracerLoaded() {
    return vtracerModule !== null;
}
