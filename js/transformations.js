/**
 * transformations.js - Image transformations and UI state management
 * Part of Marvin's Image Converter modular architecture
 */

import { getTranslation } from './i18n.js';
import { triggerMemoryCleanup } from './memory.js';
import * as state from './state.js';
import { renderFileQueue, debouncedSelectiveUpdate } from './file-queue-v2.js';
import { calculateRealSize } from './image-processing.js';

// ============================================
// TRANSFORMATION STATE
// ============================================

let transformationTimeout = null;

// ============================================
// TRANSFORMATION HANDLERS
// ============================================

/**
 * Handle a transformation action on a file
 * @param {number} index - File index in queue
 * @param {string} action - Action to perform
 */
export async function handleTransformation(index, action) {
    if (index < 0 || index >= state.fileQueue.length) return;

    // Cancel any existing transformation
    cancelCurrentTransformation();

    // Create new abort controller
    const controller = new AbortController();
    state.setCurrentTransformationController(controller);
    state.setIsTransforming(true);

    // Set timeout for long operations
    transformationTimeout = setTimeout(() => {
        console.warn('Transformation timeout - cancelling');
        cancelCurrentTransformation();
    }, 30000);

    const signal = controller.signal;

    try {
        lockUI();
        showStatusIndicator(getTranslation('processing') || 'Verarbeite...');

        const fileObj = state.fileQueue[index];

        // Apply transformation
        switch (action) {
            case 'rotate-left':
                fileObj.rotation = ((fileObj.rotation || 0) - 90 + 360) % 360;
                fileObj.needsRecalculation = true;
                fileObj.hasRealCalculation = false;
                state.changedFiles.add(fileObj.id);
                break;

            case 'rotate-right':
                fileObj.rotation = ((fileObj.rotation || 0) + 90) % 360;
                fileObj.needsRecalculation = true;
                fileObj.hasRealCalculation = false;
                state.changedFiles.add(fileObj.id);
                break;

            case 'flip-horizontal':
                fileObj.scaleX = (fileObj.scaleX || 1) * -1;
                fileObj.needsRecalculation = true;
                fileObj.hasRealCalculation = false;
                state.changedFiles.add(fileObj.id);
                break;

            case 'flip-vertical':
                fileObj.scaleY = (fileObj.scaleY || 1) * -1;
                fileObj.needsRecalculation = true;
                fileObj.hasRealCalculation = false;
                state.changedFiles.add(fileObj.id);
                break;

            case 'calculate-real':
                await calculateRealSize(index);
                break;

            case 'remove-file':
                // Import dynamically to avoid circular dependency
                const { removeFile } = await import('./file-queue-v2.js');
                removeFile(index);
                break;
        }

        // Check if cancelled
        if (signal.aborted) return;

        // Update UI
        renderFileQueue();

        // Update modal if needed
        if (state.activePreviewIndex === index) {
            // Will be called from modal.js
            const event = new CustomEvent('updateModalContent', { detail: { generatePreview: false } });
            document.dispatchEvent(event);
        }

        // Memory cleanup
        triggerMemoryCleanup();

        // Debounced recalculation
        debouncedSelectiveUpdate();

        console.log(`Transformation ${action} completed successfully`);

    } catch (error) {
        if (!signal.aborted) {
            console.error('Transformation error:', error);
        }
    } finally {
        if (transformationTimeout) {
            clearTimeout(transformationTimeout);
            transformationTimeout = null;
        }

        state.setCurrentTransformationController(null);
        state.setIsTransforming(false);
        unlockUI();
        hideStatusIndicator();
    }
}

/**
 * Cancel the current transformation
 */
export function cancelCurrentTransformation() {
    if (state.currentTransformationController) {
        state.currentTransformationController.abort();
        state.setCurrentTransformationController(null);
    }

    if (transformationTimeout) {
        clearTimeout(transformationTimeout);
        transformationTimeout = null;
    }

    state.setIsTransforming(false);
    unlockUI();
    hideStatusIndicator();
}

// ============================================
// UI LOCKING
// ============================================

/**
 * Lock UI during processing
 */
export function lockUI() {
    const allInteractive = document.querySelectorAll(`
		button:not(#cancel-zip-btn):not(#cancel-calculate-btn), 
		input[type="file"], input[type="range"], select,
		.control-btn, .modal-control-btn, .modal-button,
		[onclick], [onchange], [data-action]
	`);

    allInteractive.forEach((element) => {
        element.disabled = true;
        element.style.opacity = '0.7';
        element.style.pointerEvents = 'none';
        element.style.cursor = 'wait';
    });

    document.body.style.cursor = 'wait';
}

/**
 * Unlock UI after processing
 */
export function unlockUI() {
    const allInteractive = document.querySelectorAll(`
		button, input[type="file"], input[type="range"], select,
		.control-btn, .modal-control-btn, .modal-button,
		[onclick], [onchange], [data-action]
	`);

    allInteractive.forEach((element) => {
        element.disabled = false;
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
        element.style.cursor = '';
    });

    document.body.style.cursor = '';
}

/**
 * Enable all controls
 */
export function enableAllControls() {
    const elements = document.querySelectorAll('button, select, input[type="range"]');
    elements.forEach((element) => {
        element.disabled = false;
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
        element.style.cursor = '';
    });

    document.body.style.cursor = '';
}

// ============================================
// STATUS INDICATOR
// ============================================

/**
 * Show status indicator
 * @param {string} message 
 */
export function showStatusIndicator(message) {
    let statusElement = document.getElementById('transformation-status');

    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'transformation-status';
        statusElement.style.cssText = `
			position: fixed; top: 20px; right: 20px;
			background: rgba(0, 123, 255, 0.95); color: white;
			padding: 8px 12px; border-radius: 6px; z-index: 10000;
			font-family: system-ui, -apple-system, sans-serif;
			font-size: 13px; font-weight: 500;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
			transition: all 0.2s ease;
		`;
        document.body.appendChild(statusElement);
    }

    statusElement.textContent = message;
    statusElement.style.display = 'block';
}

/**
 * Hide status indicator
 */
export function hideStatusIndicator() {
    const statusElement = document.getElementById('transformation-status');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}
