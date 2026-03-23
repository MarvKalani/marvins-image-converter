/**
 * webmcp.js - Web Model Context Protocol Integration
 * Part of Marvin's Image Converter modular architecture
 * 
 * This module exposes application logic to browser-based AI agents
 * via the experimental navigator.modelContext API.
 */

import { DOM } from './config.js';
import * as state from './state.js';
import { handleFiles, resetWorkspace } from './file-queue-v2.js';
import { processAndDownload } from './zip.js';
import { processSingleImage } from './image-processing.js';

export function initWebMCP() {
    // Check if WebMCP is supported by the browser
    if (!navigator.modelContext || typeof navigator.modelContext.registerTool !== 'function') {
        console.log('WebMCP not supported or not enabled in this browser.');
        return;
    }

    try {
        // 1. Get App State Tool
        navigator.modelContext.registerTool({
            name: 'get_app_state',
            description: 'Get the current state of the Image Converter app, including selected format, quality, and the number of files currently in the conversion queue.',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            execute: async () => {
                const formatSelect = DOM.formatSelect || document.getElementById('format-select');
                const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');

                return {
                    format: formatSelect ? formatSelect.value : 'webp',
                    quality: qualitySlider ? parseInt(qualitySlider.value, 10) : 85,
                    queueLength: state.fileQueue.length
                };
            }
        });

        // 2. Set Conversion Settings Tool
        navigator.modelContext.registerTool({
            name: 'set_conversion_settings',
            description: 'Set the global conversion format and quality for the Image Converter app.',
            inputSchema: {
                type: 'object',
                properties: {
                    format: {
                        type: 'string',
                        enum: ['webp', 'png', 'jpeg', 'svg'],
                        description: 'The target image format'
                    },
                    quality: {
                        type: 'number',
                        minimum: 1,
                        maximum: 100,
                        description: 'The output quality (1-100), not applicable for PNG'
                    }
                }
            },
            execute: async (args) => {
                const formatSelect = DOM.formatSelect || document.getElementById('format-select');
                const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');
                const percentSlider = DOM.percentSlider || document.getElementById('percent-slider');

                // Format fallback and dispatch
                if (args.format && formatSelect) {
                    formatSelect.value = args.format;
                    formatSelect.dispatchEvent(new Event('change'));
                }
                // Quality fallback and dispatch
                if (args.quality && qualitySlider) {
                    qualitySlider.value = args.quality;
                    qualitySlider.dispatchEvent(new Event('input'));
                }

                return { success: true, message: `Settings updated to format: ${args.format || 'unchanged'}, quality: ${args.quality || 'unchanged'}.` };
            }
        });

        // 3. Add Image From URL Tool
        navigator.modelContext.registerTool({
            name: 'add_image_from_url',
            description: 'Fetch an image from a given URL and add it to the conversion queue.',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The absolute URL of the image to add' },
                    filename: { type: 'string', description: 'Optional filename for the downloaded image' }
                },
                required: ['url']
            },
            execute: async (args) => {
                try {
                    const response = await fetch(args.url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const blob = await response.blob();

                    let filename = args.filename;
                    if (!filename) {
                        const urlParts = args.url.split('/');
                        filename = urlParts[urlParts.length - 1] || 'downloaded_image.jpg';
                        if (!filename.includes('.')) filename += '.jpg';
                    }

                    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
                    await handleFiles([file]);

                    return { success: true, message: `Image '${filename}' added to queue.` };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }
        });

        // 4. Clear Queue Tool
        navigator.modelContext.registerTool({
            name: 'clear_queue',
            description: 'Clear all files from the Image Converter queue and reset the workspace.',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            execute: async () => {
                resetWorkspace();
                return { success: true, message: 'Queue cleared.' };
            }
        });

        // 5. Process and Download Tool
        navigator.modelContext.registerTool({
            name: 'process_and_download',
            description: 'Start processing the files in the queue based on current settings and download them as a ZIP archive.',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            execute: async () => {
                if (state.fileQueue.length === 0) {
                    return { success: false, message: 'Queue is empty. Nothing to process.' };
                }

                // We don't await because processAndDownload handles its own async / UI states
                // and we don't want to block the agent while the user downloads.
                setTimeout(() => {
                    processAndDownload();
                }, 100);

                return { success: true, message: 'Processing started.' };
            }
        });

        // 6. Transform Image Tool
        navigator.modelContext.registerTool({
            name: 'transform_image',
            description: 'Apply geometric transformations (rotate, flip) to an image in the queue.',
            inputSchema: {
                type: 'object',
                properties: {
                    fileIndex: {
                        type: 'number',
                        description: 'The zero-based index of the file in the queue to transform.',
                        minimum: 0
                    },
                    action: {
                        type: 'string',
                        enum: ['rotate-left', 'rotate-right', 'flip-horizontal', 'flip-vertical'],
                        description: 'The transformation action to apply.'
                    }
                },
                required: ['fileIndex', 'action']
            },
            execute: async (args) => {
                const { fileIndex, action } = args;
                if (fileIndex < 0 || fileIndex >= state.fileQueue.length) {
                    return { success: false, error: `Invalid fileIndex: ${fileIndex}. Queue length is ${state.fileQueue.length}.` };
                }

                // Import handleTransformation dynamically to avoid circular dependencies if needed
                const { handleTransformation } = await import('./transformations.js');
                await handleTransformation(fileIndex, action);

                return { success: true, message: `Applied ${action} to file at index ${fileIndex}.` };
            }
        });

        // 7. Set SVG Settings Tool
        navigator.modelContext.registerTool({
            name: 'set_svg_settings',
            description: 'Set various parameters for SVG vector tracing for the entire app. These take effect when the target format is "svg".',
            inputSchema: {
                type: 'object',
                properties: {
                    filterSpeckle: { type: 'number', description: 'Filter speckle threshold (e.g. 4)' },
                    cornerThreshold: { type: 'number', description: 'Corner threshold angle (e.g. 60)' },
                    pathPrecision: { type: 'number', description: 'Path precision (e.g. 2)' },
                    colorPrecision: { type: 'number', description: 'Color precision (e.g. 2)' },
                    layerDifference: { type: 'number', description: 'Layer difference (e.g. 16)' },
                    spliceThreshold: { type: 'number', description: 'Splice threshold (e.g. 45)' },
                    lengthThreshold: { type: 'number', description: 'Length threshold (e.g. 4)' },
                    maxIterations: { type: 'number', description: 'Max iterations (e.g. 10)' },
                    hierarchical: { type: 'string', enum: ['stacked', 'cutout'], description: 'Hierarchical mode ("stacked" or "cutout")' }
                }
            },
            execute: async (args) => {
                const mappings = {
                    filterSpeckle: 'svg-filter-speckle',
                    cornerThreshold: 'svg-corner-threshold',
                    pathPrecision: 'svg-path-precision',
                    colorPrecision: 'svg-color-precision',
                    layerDifference: 'svg-layer-difference',
                    spliceThreshold: 'svg-splice-threshold',
                    lengthThreshold: 'svg-length-threshold',
                    maxIterations: 'svg-max-iterations',
                    hierarchical: 'svg-hierarchical'
                };

                const updatedParams = [];

                for (const [argKey, elementId] of Object.entries(mappings)) {
                    if (args[argKey] !== undefined) {
                        const el = document.getElementById(elementId);
                        if (el) {
                            el.value = args[argKey];
                            el.dispatchEvent(new Event('input'));
                            el.dispatchEvent(new Event('change'));
                            updatedParams.push(`${argKey}=${args[argKey]}`);
                        }
                    }
                }

                return {
                    success: true,
                    message: updatedParams.length > 0 ? `Updated SVG settings: ${updatedParams.join(', ')}.` : 'No SVG settings provided or elements not found.'
                };
            }
        });

        // 8. Download Single Image Tool
        navigator.modelContext.registerTool({
            name: 'download_single_image',
            description: 'Process and download a single image from the queue (not as ZIP). Useful when only one image needs to be converted.',
            inputSchema: {
                type: 'object',
                properties: {
                    fileIndex: {
                        type: 'number',
                        description: 'The zero-based index of the file in the queue to process and download.',
                        minimum: 0
                    }
                },
                required: ['fileIndex']
            },
            execute: async (args) => {
                const { fileIndex } = args;
                if (fileIndex < 0 || fileIndex >= state.fileQueue.length) {
                    return { success: false, error: `Invalid fileIndex: ${fileIndex}. Queue length is ${state.fileQueue.length}.` };
                }

                const fileObj = state.fileQueue[fileIndex];
                const formatSelect = DOM.formatSelect || document.getElementById('format-select');
                const format = formatSelect ? formatSelect.value : 'webp';

                try {
                    if (format === 'svg' && fileObj.svgData) {
                        const blob = new Blob([fileObj.svgData], { type: 'image/svg+xml' });
                        const originalName = fileObj.file.name.replace(/\.[^/.]+$/, '');
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${originalName}.svg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        return { success: true, message: `Downloaded ${originalName}.svg` };
                    }

                    const result = await processSingleImage(fileObj);
                    if (result && result.dataUrl) {
                        const originalName = fileObj.file.name.replace(/\.[^/.]+$/, '');
                        const a = document.createElement('a');
                        a.href = result.dataUrl;
                        a.download = `${originalName}.${result.extension || format}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        return { success: true, message: `Downloaded ${originalName}.${result.extension || format}` };
                    }

                    return { success: false, error: 'Processing returned no result.' };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }
        });

        // 9. Set Budget Mode Tool
        navigator.modelContext.registerTool({
            name: 'set_budget_mode',
            description: 'Enable or disable budget mode. When enabled, the app automatically adjusts quality and scale to fit all images within the given MB budget.',
            inputSchema: {
                type: 'object',
                properties: {
                    enabled: { type: 'boolean', description: 'Whether to enable budget mode' },
                    targetMB: { type: 'number', minimum: 1, maximum: 25, description: 'Target budget in MB (1-25)' }
                },
                required: ['enabled']
            },
            execute: async (args) => {
                const toggle = document.getElementById('budget-mode-toggle');
                if (toggle) {
                    toggle.checked = args.enabled;
                    toggle.dispatchEvent(new Event('change'));
                }
                if (args.targetMB !== undefined) {
                    const slider = document.getElementById('budget-slider');
                    if (slider) {
                        slider.value = args.targetMB;
                        slider.dispatchEvent(new Event('input'));
                    }
                }
                return { success: true, message: `Budget mode ${args.enabled ? 'enabled' : 'disabled'}${args.targetMB ? ` with target ${args.targetMB} MB` : ''}.` };
            }
        });

        console.log("🚀 WebMCP tools registered successfully.");
    } catch (e) {
        console.error("Error registering WebMCP tools:", e);
    }
}
